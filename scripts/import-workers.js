#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = process.cwd();

function loadEnvFile(filename) {
  const fullPath = path.join(ROOT, filename);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (char === "," || char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      cell = "";
      if (char === ",") {
        continue;
      }
      rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const CORPORATE_TOKENS = [
  "株式会社",
  "有限会社",
  "合同会社",
  "合名会社",
  "合資会社",
  "（株）",
  "(株)",
  "㈱",
  "（有）",
  "(有)",
  "㈲",
  "（同）",
  "(同)",
];

function stripLegalSuffix(name) {
  let trimmed = name.trim();
  for (const token of CORPORATE_TOKENS) {
    if (trimmed.startsWith(token)) {
      trimmed = trimmed.slice(token.length).trim();
    }
    if (trimmed.endsWith(token)) {
      trimmed = trimmed.slice(0, -token.length).trim();
    }
  }
  return trimmed || name;
}

function normalizeText(value) {
  return value
    .replace(/\s+/g, "")
    .replace(/\u3000/g, "")
    .toLowerCase();
}

function normalizeContractorLabel(value) {
  const cleaned = stripLegalSuffix(value).trim();
  return cleaned.replace(/[ 　]*[0-9０-９]+$/g, "");
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function getSuggestions(target, candidates) {
  const normalizedTarget = normalizeText(target);
  return candidates
    .map((candidate) => {
      const normalizedCandidate = normalizeText(candidate);
      return {
        name: candidate,
        score: levenshtein(normalizedTarget, normalizedCandidate),
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((item) => item.name);
}

function loadConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return { mappings: {} };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function normalizeMappingKey(value) {
  return normalizeText(normalizeContractorLabel(value));
}

async function run() {
  const [,, inputPath, ...rest] = process.argv;
  if (!inputPath) {
    console.log("使い方: node scripts/import-workers.js <csv-path> [--mode=skip|revive]");
    process.exit(1);
  }

  const modeArg = rest.find((arg) => arg.startsWith("--mode=")) || "";
  const mode = modeArg.replace("--mode=", "") || "skip";
  if (!["skip", "revive"].includes(mode)) {
    console.log("mode は skip または revive を指定してください。");
    process.exit(1);
  }

  const configArg = rest.find((arg) => arg.startsWith("--config=")) || "";
  const configPath =
    configArg.replace("--config=", "") ||
    path.join(ROOT, "scripts", "import-workers.config.json");
  const config = loadConfig(configPath);
  const mappingEntries = Object.entries(config.mappings ?? {}).map(
    ([key, value]) => [normalizeMappingKey(key), value]
  );
  const mappingMap = new Map(mappingEntries);

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.log("Supabaseの環境変数が見つかりません。");
    process.exit(1);
  }

  const csvText = fs.readFileSync(path.resolve(inputPath), "utf8");
  const rows = parseCsv(csvText);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: partners } = await supabase
    .from("partners")
    .select("partner_id, name")
    .or("is_deleted.is.false,is_deleted.is.null")
    .order("partner_id");

  const { data: existingWorkers } = await supabase
    .from("workers")
    .select("id, name, contractor_id, id_deleted")
    .or("id_deleted.is.false,id_deleted.is.null");

  const partnerNameMap = new Map();
  const partnerDisplayMap = new Map();
  (partners ?? []).forEach((partner) => {
    const normalized = normalizeText(normalizeContractorLabel(partner.name));
    partnerNameMap.set(normalized, partner.partner_id);
    partnerDisplayMap.set(partner.partner_id, stripLegalSuffix(partner.name));
  });

  const existingMap = new Map();
  (existingWorkers ?? []).forEach((worker) => {
    const key = `${worker.contractor_id}::${normalizeText(worker.name)}`;
    existingMap.set(key, worker.id);
  });

  const toInsert = [];
  const toRevive = [];
  const missingContractors = new Map();
  const mappedSkips = new Set();
  let skippedEmpty = 0;
  let skippedDuplicate = 0;

  rows.forEach((row, index) => {
    if (!row.length) return;
    if (index < 2) return;
    const rawContractor = String(row[0] ?? "").trim();
    if (!rawContractor || rawContractor === "業者名") return;
    const normalizedContractor = normalizeMappingKey(rawContractor);
    const mappedValue = mappingMap.get(normalizedContractor);
    if (mappedValue) {
      if (String(mappedValue).toLowerCase() === "skip") {
        mappedSkips.add(rawContractor);
        return;
      }
    }
    const normalizedMapped = mappedValue
      ? normalizeMappingKey(String(mappedValue))
      : normalizedContractor;
    const contractorId = partnerNameMap.get(normalizedMapped);
    if (!contractorId) {
      const suggestions = getSuggestions(
        normalizeContractorLabel(mappedValue ? String(mappedValue) : rawContractor),
        (partners ?? []).map((partner) => stripLegalSuffix(partner.name))
      );
      if (!missingContractors.has(rawContractor)) {
        missingContractors.set(rawContractor, suggestions);
      }
      return;
    }

    for (let col = 1; col < row.length; col += 1) {
      const name = String(row[col] ?? "").trim();
      if (!name) {
        skippedEmpty += 1;
        continue;
      }
      const key = `${contractorId}::${normalizeText(name)}`;
      if (existingMap.has(key)) {
        skippedDuplicate += 1;
        if (mode === "revive") {
          toRevive.push(existingMap.get(key));
        }
        continue;
      }
      toInsert.push({
        contractor_id: contractorId,
        name,
        id_deleted: false,
      });
    }
  });

  console.log(`取込予定: ${toInsert.length}件`);
  console.log(`重複スキップ: ${skippedDuplicate}件`);
  console.log(`空欄スキップ: ${skippedEmpty}件`);
  console.log(`未一致業者: ${missingContractors.size}件`);
  console.log(`マッピングでスキップ: ${mappedSkips.size}件`);

  if (missingContractors.size) {
    console.log("\n未一致業者一覧（候補）:");
    for (const [name, suggestions] of missingContractors.entries()) {
      console.log(`- ${name}${suggestions.length ? ` -> ${suggestions.join(", ")}` : ""}`);
    }
  }

  if (mappedSkips.size) {
    console.log("\nスキップ対象（マッピング）:");
    for (const name of mappedSkips) {
      console.log(`- ${name}`);
    }
  }

  if (!toInsert.length && !toRevive.length) {
    console.log("追加対象がありません。");
    process.exit(0);
  }

  const confirm = rest.includes("--execute");
  if (!confirm) {
    console.log("\n実行する場合は --execute を付けて再実行してください。");
    process.exit(0);
  }

  if (toRevive.length) {
    await supabase
      .from("workers")
      .update({ id_deleted: false, deleted_at: null })
      .in("id", Array.from(new Set(toRevive)));
  }

  const { error } = await supabase.from("workers").insert(toInsert);
  if (error) {
    console.log("挿入エラー:", error.message);
    process.exit(1);
  }

  console.log("完了しました。");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
