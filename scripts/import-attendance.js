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

function normalizeMappingKey(value) {
  return normalizeText(normalizeContractorLabel(value));
}

function loadConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return { mappings: {} };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
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

function parseDate(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return null;
  const year = match[1];
  const month = String(match[2]).padStart(2, "0");
  const day = String(match[3]).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseWorkerLine(line) {
  const trimmed = line.trim().replace(/[△▲■●◆★☆※＊*]+$/g, "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.*?)[（(](.*?)[）)]$/);
  if (!match) {
    return { name: trimmed, contractor: null };
  }
  return {
    name: match[1].trim(),
    contractor: match[2].trim(),
  };
}

function isNexusMapping(value) {
  const lowered = String(value).toLowerCase();
  return lowered === "__nexus__" || lowered === "nexus" || lowered === "ネクサス";
}

function parseNexusName(value) {
  if (!value?.startsWith("ネクサス /")) return null;
  const parts = value.split(" / ").map((part) => part.trim());
  return parts[1] ?? null;
}

async function run() {
  const [,, inputPath, ...rest] = process.argv;
  if (!inputPath) {
    console.log(
      "使い方: node scripts/import-attendance.js <csv-path> [--project-id=xxxx] [--site-name=現場名] [--config=path] [--create-missing] [--execute]"
    );
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

  const projectArg = rest.find((arg) => arg.startsWith("--project-id=")) || "";
  const projectOverride = projectArg.replace("--project-id=", "").trim();
  const siteArg = rest.find((arg) => arg.startsWith("--site-name=")) || "";
  const siteOverride = siteArg.replace("--site-name=", "").trim();
  const shouldCreateMissing = rest.includes("--create-missing");
  const reportSkips = rest.includes("--report");
  const reportFileArg = rest.find((arg) => arg.startsWith("--report-file=")) || "";
  const reportFile =
    reportFileArg.replace("--report-file=", "") ||
    path.join(ROOT, "scripts", "import-attendance.skips.json");

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

  const { data: workers } = await supabase
    .from("workers")
    .select("id, name, contractor_id")
    .or("id_deleted.is.false,id_deleted.is.null");

  const partnerNameMap = new Map();
  const partnerDisplayMap = new Map();
  (partners ?? []).forEach((partner) => {
    const normalized = normalizeText(normalizeContractorLabel(partner.name));
    partnerNameMap.set(normalized, partner.partner_id);
    partnerDisplayMap.set(partner.partner_id, stripLegalSuffix(partner.name));
  });

  const workerMap = new Map();
  (workers ?? []).forEach((worker) => {
    const key = `${worker.contractor_id}::${normalizeText(worker.name)}`;
    workerMap.set(key, worker.id);
  });

  let siteName = "";
  rows.forEach((row) => {
    if (row[0] === "現場名:" && row[1]) {
      siteName = String(row[1]).trim();
    }
  });

  let projectId = projectOverride;
  const siteLookupName = siteOverride || siteName;
  if (!projectId && siteLookupName) {
    const { data: projects } = await supabase
      .from("projects")
      .select("project_id, site_name")
      .or("is_deleted.is.false,is_deleted.is.null");
    const match = (projects ?? []).find(
      (project) => project.site_name === siteLookupName
    );
    if (match) {
      projectId = match.project_id;
    } else {
      const suggestions = getSuggestions(
        siteLookupName,
        (projects ?? []).map((project) => project.site_name)
      );
      console.log("現場名が一致しません。--project-id を指定してください。");
      console.log(`現場名: ${siteLookupName}`);
      if (suggestions.length) {
        console.log(`候補: ${suggestions.join(", ")}`);
      }
      process.exit(1);
    }
  }

  if (!projectId) {
    console.log("project_id が特定できません。--project-id を指定してください。");
    process.exit(1);
  }

  const entries = [];
  const missingContractors = new Map();
  const missingWorkers = new Map();
  const invalidLines = [];
  const skippedByMapping = new Set();
  const skippedDetails = [];
  let skippedEmpty = 0;

  rows.forEach((row, index) => {
    if (index < 4) return;
    const entryDate = parseDate(String(row[0] ?? ""));
    if (!entryDate) return;
    const rawCell = String(row[7] ?? "").trim();
    if (!rawCell) return;
    const lines = rawCell.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    lines.forEach((line) => {
      const parsed = parseWorkerLine(line);
      if (!parsed) {
        skippedEmpty += 1;
        return;
      }
      if (!parsed.contractor) {
        invalidLines.push(line);
        skippedDetails.push({
          entry_date: entryDate,
          contractor: "",
          name: parsed.name,
          reason: "invalid_format",
          raw: line,
        });
        return;
      }
      const normalizedContractor = normalizeMappingKey(parsed.contractor);
      const mappedValue = mappingMap.get(normalizedContractor);
      if (mappedValue && String(mappedValue).toLowerCase() === "skip") {
        skippedByMapping.add(parsed.contractor);
        skippedDetails.push({
          entry_date: entryDate,
          contractor: parsed.contractor,
          name: parsed.name,
          reason: "mapping_skip",
        });
        return;
      }
      if (mappedValue && isNexusMapping(mappedValue)) {
        entries.push({
          entry_date: entryDate,
          project_id: projectId,
          contractor_id: null,
          worker_id: null,
          work_type_id: null,
          work_type_text: `ネクサス / ${parsed.name}`,
          created_by: "import",
          _dedupeKey: `${entryDate}::nexus::${normalizeText(parsed.name)}`,
        });
        return;
      }
      const normalizedMapped = mappedValue
        ? normalizeMappingKey(String(mappedValue))
        : normalizedContractor;
      const contractorId = partnerNameMap.get(normalizedMapped);
      if (!contractorId) {
        const suggestions = getSuggestions(
          normalizeContractorLabel(mappedValue ? String(mappedValue) : parsed.contractor),
          (partners ?? []).map((partner) => stripLegalSuffix(partner.name))
        );
        if (!missingContractors.has(parsed.contractor)) {
          missingContractors.set(parsed.contractor, suggestions);
        }
        skippedDetails.push({
          entry_date: entryDate,
          contractor: parsed.contractor,
          name: parsed.name,
          reason: "missing_contractor",
        });
        return;
      }
      const workerKey = `${contractorId}::${normalizeText(parsed.name)}`;
      const workerId = workerMap.get(workerKey) ?? null;
      if (!workerId) {
        const list = missingWorkers.get(contractorId) ?? new Set();
        list.add(parsed.name);
        missingWorkers.set(contractorId, list);
        skippedDetails.push({
          entry_date: entryDate,
          contractor: partnerDisplayMap.get(contractorId) ?? contractorId,
          name: parsed.name,
          reason: "missing_worker",
        });
      }
      entries.push({
        entry_date: entryDate,
        project_id: projectId,
        contractor_id: contractorId,
        worker_id: workerId,
        worker_name: parsed.name,
        work_type_id: null,
        work_type_text: null,
        created_by: "import",
        _dedupeKey: workerId
          ? `${entryDate}::${workerId}`
          : `${entryDate}::${contractorId}::${normalizeText(parsed.name)}`,
      });
    });
  });

  const uniqueEntries = [];
  const seenKeys = new Set();
  entries.forEach((entry) => {
    const key = entry._dedupeKey ?? `${entry.entry_date}::${entry.worker_id}`;
    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    const { _dedupeKey, ...restEntry } = entry;
    uniqueEntries.push(restEntry);
  });

  const dates = uniqueEntries.map((entry) => entry.entry_date);
  const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  const existingKeys = new Set();
  const existingNexusKeys = new Set();
  if (minDate && maxDate) {
    const { data: existing } = await supabase
      .from("attendance_entries")
      .select("entry_date, worker_id")
      .eq("project_id", projectId)
      .gte("entry_date", minDate)
      .lte("entry_date", maxDate);
    (existing ?? []).forEach((row) => {
      existingKeys.add(`${row.entry_date}::${row.worker_id}`);
    });

    const { data: existingNexus } = await supabase
      .from("attendance_entries")
      .select("entry_date, work_type_text")
      .eq("project_id", projectId)
      .gte("entry_date", minDate)
      .lte("entry_date", maxDate)
      .is("worker_id", null)
      .ilike("work_type_text", "ネクサス / %");
    (existingNexus ?? []).forEach((row) => {
      const name = parseNexusName(row.work_type_text ?? "");
      if (name) {
        existingNexusKeys.add(
          `${row.entry_date}::${normalizeText(name)}`
        );
      }
    });
  }

  const toInsert = uniqueEntries.filter((entry) => {
    if (!entry.worker_id && !entry.work_type_text) {
      return shouldCreateMissing;
    }
    if (!entry.worker_id) {
      const name = parseNexusName(entry.work_type_text ?? "");
      if (!name) return false;
      const isDuplicate = existingNexusKeys.has(
        `${entry.entry_date}::${normalizeText(name)}`
      );
      if (isDuplicate) {
        skippedDetails.push({
          entry_date: entry.entry_date,
          contractor: "ネクサス",
          name,
          reason: "duplicate_existing",
        });
      }
      return !isDuplicate;
    }
    const duplicate = existingKeys.has(`${entry.entry_date}::${entry.worker_id}`);
    if (duplicate) {
      skippedDetails.push({
        entry_date: entry.entry_date,
        contractor:
          partnerDisplayMap.get(entry.contractor_id ?? "") ??
          entry.contractor_id ??
          "",
        name:
          (entry.worker_name ? entry.worker_name : entry.worker_id) ?? "",
        reason: "duplicate_existing",
      });
    }
    return !duplicate;
  });

  console.log(`取込予定: ${toInsert.length}件`);
  console.log(`重複スキップ: ${uniqueEntries.length - toInsert.length}件`);
  console.log(`空欄スキップ: ${skippedEmpty}件`);
  console.log(`未一致業者: ${missingContractors.size}件`);
  console.log(`作業員未一致: ${missingWorkers.size}件`);
  console.log(`マッピングでスキップ: ${skippedByMapping.size}件`);
  console.log(`形式不明: ${invalidLines.length}件`);
  console.log(`詳細スキップ: ${skippedDetails.length}件`);

  if (missingContractors.size) {
    console.log("\n未一致業者一覧（候補）:");
    for (const [name, suggestions] of missingContractors.entries()) {
      console.log(`- ${name}${suggestions.length ? ` -> ${suggestions.join(", ")}` : ""}`);
    }
  }

  if (missingWorkers.size) {
    console.log("\n作業員未一致一覧:");
    for (const [contractorId, names] of missingWorkers.entries()) {
      const contractorName = partnerDisplayMap.get(contractorId) ?? contractorId;
      console.log(`- ${contractorName}: ${Array.from(names).join(", ")}`);
    }
  }

  if (invalidLines.length) {
    console.log("\n形式不明の行:");
    invalidLines.slice(0, 20).forEach((line) => console.log(`- ${line}`));
    if (invalidLines.length > 20) {
      console.log(`... ${invalidLines.length - 20}件`);
    }
  }

  if (reportSkips) {
    fs.writeFileSync(reportFile, JSON.stringify(skippedDetails, null, 2), "utf8");
    console.log(`\nスキップ詳細を出力しました: ${reportFile}`);
  }

  if (!toInsert.length) {
    console.log("追加対象がありません。");
    process.exit(0);
  }

  const confirm = rest.includes("--execute");
  if (!confirm) {
    console.log("\n実行する場合は --execute を付けて再実行してください。");
    process.exit(0);
  }

  if (shouldCreateMissing && missingWorkers.size) {
    const newWorkers = [];
    for (const [contractorId, names] of missingWorkers.entries()) {
      for (const name of names) {
        newWorkers.push({
          contractor_id: contractorId,
          name,
          id_deleted: false,
        });
      }
    }
    const { error: workerError } = await supabase
      .from("workers")
      .insert(newWorkers);
    if (workerError) {
      console.log("作業員追加エラー:", workerError.message);
      process.exit(1);
    }

    const { data: refreshedWorkers } = await supabase
      .from("workers")
      .select("id, name, contractor_id")
      .or("id_deleted.is.false,id_deleted.is.null");
    workerMap.clear();
    (refreshedWorkers ?? []).forEach((worker) => {
      const key = `${worker.contractor_id}::${normalizeText(worker.name)}`;
      workerMap.set(key, worker.id);
    });

    const patchedEntries = [];
    for (const entry of toInsert) {
      if (!entry.worker_id && entry.contractor_id && entry.worker_name) {
        const workerKey = `${entry.contractor_id}::${normalizeText(entry.worker_name)}`;
        const workerId = workerMap.get(workerKey) ?? null;
        if (workerId) {
          patchedEntries.push({ ...entry, worker_id: workerId });
        }
        continue;
      }
      patchedEntries.push(entry);
    }
    toInsert.length = 0;
    toInsert.push(
      ...patchedEntries.filter(
        (entry) =>
          entry.worker_id || entry.work_type_text
      )
    );
  }

  const chunkSize = 500;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize).map((entry) => {
      const { worker_name, ...rest } = entry;
      return rest;
    });
    const { error } = await supabase.from("attendance_entries").upsert(chunk, {
      onConflict: "entry_date,project_id,worker_id",
    });
    if (error) {
      console.log("挿入エラー:", error.message);
      process.exit(1);
    }
  }

  console.log("完了しました。");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
