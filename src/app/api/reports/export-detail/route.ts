import ExcelJS from "exceljs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";

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

const stripLegalSuffix = (name: string) => {
  let trimmed = name.trim();
  CORPORATE_TOKENS.forEach((token) => {
    if (trimmed.startsWith(token)) {
      trimmed = trimmed.slice(token.length).trim();
    }
    if (trimmed.endsWith(token)) {
      trimmed = trimmed.slice(0, -token.length).trim();
    }
  });
  return trimmed || name;
};

const parseNexusName = (value: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/／/g, "/").replace(/\u3000/g, " ").trim();
  if (!normalized.startsWith("ネクサス")) {
    return null;
  }
  let rest = normalized.replace(/^ネクサス\s*/u, "");
  if (rest.startsWith("/")) {
    rest = rest.slice(1).trim();
  }
  if (!rest) {
    return null;
  }
  const name = rest.split("/")[0]?.trim() ?? "";
  return name || null;
};

const stripNexusMemo = (value: string | null) => {
  if (!value) return "";
  const normalized = value.replace(/／/g, "/").replace(/\u3000/g, " ").trim();
  if (!normalized.startsWith("ネクサス")) {
    return value;
  }
  let rest = normalized.replace(/^ネクサス\s*/u, "");
  if (rest.startsWith("/")) {
    rest = rest.slice(1).trim();
  }
  if (!rest) {
    return "";
  }
  const parts = rest.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }
  return parts.slice(1).join(" / ");
};

const parseMemoTerms = (value: string) => {
  const tokens = value.split(/[\s\u3000]+/).filter(Boolean);
  const include: string[] = [];
  const exclude: string[] = [];
  tokens.forEach((token) => {
    if (token.startsWith("-") && token.length > 1) {
      exclude.push(token.slice(1));
    } else {
      include.push(token);
    }
  });
  return { include, exclude };
};

const memoMatches = (
  memo: string,
  terms: ReturnType<typeof parseMemoTerms>,
  mode: "exact" | "partial"
) => {
  if (!terms.include.length && !terms.exclude.length) {
    return true;
  }
  if (!memo) {
    return terms.include.length === 0;
  }
  if (mode === "exact") {
    const memoTokens = memo.split(/[\s\u3000]+/).filter(Boolean);
    if (terms.include.some((term) => !memoTokens.includes(term))) {
      return false;
    }
    if (terms.exclude.some((term) => memoTokens.includes(term))) {
      return false;
    }
    return true;
  }
  if (terms.include.some((term) => !memo.includes(term))) {
    return false;
  }
  if (terms.exclude.some((term) => memo.includes(term))) {
    return false;
  }
  return true;
};

const firstOrNull = <T,>(value: T | T[] | null | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export async function GET(request: Request) {
  const session = await getSessionCookie();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const selectedSiteId = url.searchParams.get("site") ?? "";
  const fromValue = url.searchParams.get("from") ?? "";
  const toValue = url.searchParams.get("to") ?? "";
  if (!selectedSiteId || !fromValue || !toValue) {
    return new Response("Missing parameters", { status: 400 });
  }

  const categoryValue = url.searchParams.get("category") ?? "";
  const workTypeValue = url.searchParams.get("workType") ?? "";
  const contractorValue = url.searchParams.get("contractor") ?? "";
  const workerValue = url.searchParams.get("worker") ?? "";
  const memoValue = url.searchParams.get("memo") ?? "";
  const memoMatchValue =
    url.searchParams.get("memoMatch") === "exact" ? "exact" : "partial";

  const supabase = createSupabaseServerClient();
  if (session.role === "guest" && session.guestProjectId) {
    if (session.guestProjectId !== selectedSiteId) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const { data: site } = await supabase
    .from("projects")
    .select("project_id, site_name")
    .eq("project_id", selectedSiteId)
    .maybeSingle();

  const entries: any[] = [];
  const pageSize = 1000;
  let fromIndex = 0;
  while (true) {
    const { data, error } = await supabase
      .from("attendance_entries")
      .select(
        "entry_date, contractor_id, worker_id, work_type_text, partners(partner_id,name), workers(id,name), work_types(id,name,category_id, work_categories(name))"
      )
      .eq("project_id", selectedSiteId)
      .gte("entry_date", fromValue)
      .lte("entry_date", toValue)
      .order("entry_date")
      .range(fromIndex, fromIndex + pageSize - 1);
    if (error) {
      console.error("Failed to load entries", error);
      return new Response("Failed to load entries", { status: 500 });
    }
    entries.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      break;
    }
    fromIndex += pageSize;
  }
    supabase
      .from("projects")
      .select("project_id, site_name")
      .eq("project_id", selectedSiteId)
      .maybeSingle(),
    supabase
      .from("attendance_entries")
      .select(
        "entry_date, contractor_id, worker_id, work_type_text, partners(partner_id,name), workers(id,name), work_types(id,name,category_id, work_categories(name))"
      )
      .eq("project_id", selectedSiteId)
      .gte("entry_date", fromValue)
      .lte("entry_date", toValue)
      .order("entry_date"),
  ]);

  const terms = parseMemoTerms(memoValue);
  const rows = entries
    .filter((entry) => {
      const workType = firstOrNull(entry.work_types);
      if (categoryValue && workType?.category_id !== categoryValue) {
        return false;
      }
      if (workTypeValue && workType?.id !== workTypeValue) {
        return false;
      }
      const memoText = stripNexusMemo(entry.work_type_text);
      if (!memoMatches(memoText, terms, memoMatchValue)) {
        return false;
      }
      const memoHasNexus = entry.work_type_text?.includes("ネクサス");
      const contractor = firstOrNull(entry.partners);
      const contractorKey = contractor
        ? contractor.partner_id
        : memoHasNexus
          ? "__NEXUS__"
          : "";
      if (contractorValue && contractorKey !== contractorValue) {
        return false;
      }
      const workerName =
        firstOrNull(entry.workers)?.name ??
        parseNexusName(entry.work_type_text ?? "") ??
        entry.worker_id ??
        "";
      if (workerValue && workerName !== workerValue) {
        return false;
      }
      return true;
    })
    .map((entry) => {
      const rawMemo = entry.work_type_text ?? "";
      const memoText = stripNexusMemo(rawMemo);
      const nexusName = parseNexusName(rawMemo);
      const contractor = firstOrNull(entry.partners);
      const contractorName = contractor
        ? stripLegalSuffix(contractor.name)
        : nexusName
          ? "ネクサス"
          : "";
      const workerName =
        firstOrNull(entry.workers)?.name ?? nexusName ?? "";
      const workType = firstOrNull(entry.work_types);
      const workCategory = firstOrNull(workType?.work_categories);
      return [
        entry.entry_date,
        contractorName,
        workerName,
        workCategory?.name ?? "",
        workType?.name ?? "",
        memoText,
      ];
    });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("詳細検索");
  sheet.columns = [
    { header: "日付", key: "date", width: 12 },
    { header: "業者", key: "contractor", width: 20 },
    { header: "作業員", key: "worker", width: 18 },
    { header: "カテゴリ", key: "category", width: 16 },
    { header: "作業内容", key: "workType", width: 20 },
    { header: "備考", key: "memo", width: 30 },
  ];
  rows.forEach((row) => sheet.addRow(row));

  const filename = `report_detail_${site?.site_name ?? "site"}_${fromValue}_${toValue}_${Date.now()}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const output = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer as ArrayBuffer);

  return new Response(output, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
    },
  });
}
