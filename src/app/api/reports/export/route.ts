import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";
import ExcelJS from "exceljs";

type EntryRow = {
  entry_date: string;
  contractor_id: string | null;
  worker_id: string | null;
  contractor: { partner_id: string; name: string } | null;
  worker: { id: string; name: string } | null;
  work_type_text: string | null;
};

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

function stripLegalSuffix(name: string) {
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
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end, daysInMonth: endDate.getDate() };
}

function parseNexusName(value: string | null) {
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
}

function applyTableBorders(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) {
  const border: ExcelJS.Borders = {
    top: { style: "thin", color: { argb: "FFD0D0D0" } },
    left: { style: "thin", color: { argb: "FFD0D0D0" } },
    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
    right: { style: "thin", color: { argb: "FFD0D0D0" } },
  };
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = worksheet.getCell(row, col);
      cell.border = border;
    }
  }
}

export async function GET(request: Request) {
  const session = await getSessionCookie();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const url = new URL(request.url);
  const viewMode = url.searchParams.get("view") === "period" ? "period" : "month";
  const today = new Date();
  const todayValue = today.toISOString().slice(0, 10);
  const monthValue =
    url.searchParams.get("month") ??
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const guestProjectId = session.role === "guest" ? session.guestProjectId : null;
  const sitesQuery = supabase
    .from("projects")
    .select("project_id, site_name, start_date, end_date")
    .or("is_deleted.is.false,is_deleted.is.null")
    .order("site_name");

  if (guestProjectId) {
    sitesQuery.eq("project_id", guestProjectId);
  } else {
    sitesQuery.lte("start_date", todayValue).gte("end_date", todayValue);
  }

  const { data: sites } = await sitesQuery;
  if (!sites || sites.length === 0) {
    return new Response("No sites", { status: 404 });
  }

  let defaultProjectId: string | null = null;
  if (session.role !== "guest") {
    const { data } = await supabase
      .from("user_settings")
      .select("default_project_id")
      .eq("user_id", session.userId)
      .maybeSingle();
    defaultProjectId = data?.default_project_id ?? null;
  }

  const selectedSiteId =
    guestProjectId ??
    url.searchParams.get("site") ??
    defaultProjectId ??
    sites?.[0]?.project_id ??
    "";

  const selectedSite =
    sites?.find((site) => site.project_id === selectedSiteId) ?? null;

  const { start, end, daysInMonth } = getMonthRange(monthValue);
  const defaultFrom = selectedSite?.start_date ?? start;
  const defaultTo = selectedSite?.end_date ?? todayValue;
  const fromValue = url.searchParams.get("from") ?? defaultFrom;
  const toValue = url.searchParams.get("to") ?? defaultTo;
  const rangeStart = viewMode === "period" ? fromValue : start;
  const rangeEnd = viewMode === "period" ? toValue : end;

  const all: any[] = [];
  const pageSize = 1000;
  let fromIndex = 0;
  while (true) {
    const { data, error } = await supabase
      .from("attendance_entries")
      .select(
        "entry_date, contractor_id, worker_id, work_type_text, partners(partner_id,name), workers(id,name)"
      )
      .eq("project_id", selectedSiteId)
      .gte("entry_date", rangeStart)
      .lte("entry_date", rangeEnd)
      .order("entry_date")
      .range(fromIndex, fromIndex + pageSize - 1);
    if (error) {
      return new Response(error.message, { status: 500 });
    }
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      break;
    }
    fromIndex += pageSize;
  }

  const typedEntries = (all ?? []).map((entry) => ({
    entry_date: entry.entry_date,
    contractor_id: entry.contractor_id ?? null,
    worker_id: entry.worker_id ?? null,
    contractor: entry.partners,
    worker: entry.workers,
    work_type_text: entry.work_type_text,
  })) as EntryRow[];

  const contractorCounts = new Map<string, { name: string; dayKeys: Set<string> }>();
  typedEntries.forEach((entry) => {
    const memoHasNexus = entry.work_type_text?.includes("ネクサス");
    const contractorKey = entry.contractor
      ? entry.contractor.partner_id
      : memoHasNexus
        ? "__NEXUS__"
        : null;
    const contractorName = entry.contractor
      ? stripLegalSuffix(entry.contractor.name)
      : memoHasNexus
        ? "ネクサス"
        : entry.contractor_id ?? null;

    if (!contractorKey || !contractorName) return;

    if (!contractorCounts.has(contractorKey)) {
      contractorCounts.set(contractorKey, {
        name: contractorName,
        dayKeys: new Set(),
      });
    }

    if (contractorKey === "__NEXUS__") {
      const nexusName = parseNexusName(entry.work_type_text) ?? "";
      if (nexusName) {
        contractorCounts
          .get(contractorKey)
          ?.dayKeys.add(`${entry.entry_date}::${nexusName}`);
      }
      return;
    }

    if (entry.worker_id) {
      contractorCounts
        .get(contractorKey)
        ?.dayKeys.add(`${entry.entry_date}::${entry.worker_id}`);
    }
  });

  const contractorRows = Array.from(contractorCounts.values())
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
    .map((item) => [item.name, item.dayKeys.size]);

  const rangeLabel =
    viewMode === "month"
      ? `${monthValue.split("-")[0]}年${Number(monthValue.split("-")[1])}月`
      : `${rangeStart}〜${rangeEnd}`;

  const attendanceMap = new Map<
    string,
    { contractorName: string; workerName: string; dates: Set<string> }
  >();
  typedEntries.forEach((entry) => {
    const nexusName = parseNexusName(entry.work_type_text);
    const contractorName = entry.contractor
      ? stripLegalSuffix(entry.contractor.name)
      : nexusName
        ? "ネクサス"
        : entry.contractor_id ?? null;
    const workerName = entry.worker?.name ?? nexusName ?? entry.worker_id;
    if (!contractorName || !workerName) {
      return;
    }
    const key = `${contractorName}::${workerName}`;
    if (!attendanceMap.has(key)) {
      attendanceMap.set(key, {
        contractorName,
        workerName,
        dates: new Set(),
      });
    }
    attendanceMap.get(key)?.dates.add(entry.entry_date);
  });

  const attendanceRows = Array.from(attendanceMap.values()).sort((a, b) => {
    if (a.contractorName === "ネクサス" && b.contractorName !== "ネクサス") {
      return -1;
    }
    if (b.contractorName === "ネクサス" && a.contractorName !== "ネクサス") {
      return 1;
    }
    const contractorCompare = a.contractorName.localeCompare(b.contractorName, "ja");
    if (contractorCompare !== 0) return contractorCompare;
    return a.workerName.localeCompare(b.workerName, "ja");
  });

  const workbook = new ExcelJS.Workbook();
  workbook.views = [{ activeTab: 0 }];

  const titleText = `${selectedSite?.site_name ?? ""} / ${rangeLabel}`;

  const summarySheet = workbook.addWorksheet("業者別人数", {
    views: [{ state: "pageLayout", zoomScale: 90, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      showGridLines: false,
      printTitlesRow: "1:3",
    },
  });
  summarySheet.columns = [{ width: 24 }, { width: 8 }];
  summarySheet.addRow([titleText]);
  summarySheet.getRow(1).font = { size: 14 };
  summarySheet.getRow(1).alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: false,
  };
  summarySheet.getRow(1).height = 24;
  summarySheet.addRow([]);
  summarySheet.addRow(["業者", "人工"]);
  contractorRows.forEach((row) => summarySheet.addRow(row));

  const summaryTableStart = 3;
  const summaryTableEnd = 3 + contractorRows.length;
  applyTableBorders(summarySheet, summaryTableStart, summaryTableEnd, 1, 2);
  for (let r = summaryTableStart; r <= summaryTableEnd; r += 1) {
    summarySheet.getRow(r).alignment = { vertical: "middle" };
    summarySheet.getCell(r, 2).alignment = {
      vertical: "middle",
      horizontal: "center",
    };
  }

  const dailySheet = workbook.addWorksheet("日別入場一覧", {
    views: [{ state: "pageLayout", zoomScale: 90, showGridLines: false }],
    pageSetup: {
      paperSize: 8,
      orientation: "landscape",
      fitToPage: false,
      scale: 100,
      showGridLines: false,
      printTitlesRow: "1:3",
    },
  });

  if (viewMode !== "month") {
    dailySheet.columns = [{ width: 40 }];
    dailySheet.addRow([titleText]);
    dailySheet.mergeCells(1, 1, 1, 1);
    dailySheet.getRow(1).font = { size: 14 };
    dailySheet.addRow([]);
    dailySheet.addRow(["月集計のみ日別入場一覧を出力します。"]);
  } else {
    const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
    const [yearValue, monthNumber] = monthValue.split("-").map(Number);
    const dayHeaders = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const weekday = weekdayLabels[
        new Date(yearValue, monthNumber - 1, day).getDay()
      ];
      return `${day}\n(${weekday})`;
    });

    dailySheet.columns = [
      { width: 18 },
      { width: 12 },
      { width: 6 },
      ...Array.from({ length: daysInMonth }, () => ({ width: 4 })),
    ];

    dailySheet.addRow([titleText]);
    dailySheet.mergeCells(1, 1, 1, 3 + daysInMonth);
    dailySheet.getRow(1).font = { size: 14 };
    dailySheet.getRow(1).alignment = { vertical: "middle", horizontal: "left" };
    dailySheet.getRow(1).height = 24;
    dailySheet.addRow([]);
    dailySheet.addRow(["業者", "氏名", "入場\n日数", ...dayHeaders]);

    const headerRow = dailySheet.getRow(3);
    headerRow.height = 30;
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
    });
    headerRow.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    const mergedStarts: number[] = [];
    const pageBreakRowCount = 50;
    const manualBreaks: number[] = [];
    let currentContractor = "";
    let mergeStart = 4;
    attendanceRows.forEach((row, index) => {
      const marks = Array.from({ length: daysInMonth }, (_, dayIndex) => {
        const day = String(dayIndex + 1).padStart(2, "0");
        const date = `${monthValue}-${day}`;
        return row.dates.has(date) ? "◯" : "";
      });
      const rowIndex = 4 + index;
      const breakAfterRow = rowIndex - 1;
      if (breakAfterRow >= 4 && breakAfterRow % pageBreakRowCount === 0) {
        manualBreaks.push(breakAfterRow);
        if (mergeStart < breakAfterRow) {
          dailySheet.mergeCells(mergeStart, 1, breakAfterRow, 1);
          mergedStarts.push(mergeStart);
        }
        mergeStart = rowIndex;
        currentContractor = "";
      }
      if (row.contractorName !== currentContractor) {
        if (index > 0 && mergeStart < rowIndex - 1) {
          dailySheet.mergeCells(mergeStart, 1, rowIndex - 1, 1);
          mergedStarts.push(mergeStart);
        }
        mergeStart = rowIndex;
        currentContractor = row.contractorName;
        dailySheet.addRow([row.contractorName, row.workerName, row.dates.size, ...marks]);
      } else {
        dailySheet.addRow(["", row.workerName, row.dates.size, ...marks]);
      }
    });
    const lastRow = 3 + attendanceRows.length;
    if (attendanceRows.length > 0 && mergeStart < lastRow) {
      dailySheet.mergeCells(mergeStart, 1, lastRow, 1);
      mergedStarts.push(mergeStart);
    }

    const dataStartRow = 3;
    const dataEndRow = 3 + attendanceRows.length;
    const totalCols = 3 + daysInMonth;
    applyTableBorders(dailySheet, dataStartRow, dataEndRow, 1, totalCols);

    for (let r = dataStartRow; r <= dataEndRow; r += 1) {
      dailySheet.getRow(r).alignment = { vertical: "middle" };
      dailySheet.getCell(r, 1).alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: r === 3,
      };
      dailySheet.getCell(r, 2).alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: r === 3,
      };
      dailySheet.getCell(r, 3).alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: r === 3,
      };
      for (let c = 4; c <= totalCols; c += 1) {
        dailySheet.getCell(r, c).alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: r === 3,
        };
      }
    }
    mergedStarts.forEach((rowIndex) => {
      dailySheet.getCell(rowIndex, 1).alignment = {
        vertical: "middle",
        horizontal: "left",
      };
    });
    manualBreaks.forEach((row) => {
      const targetRow = dailySheet.getRow(row);
      targetRow.pageBreak = true;
      if (typeof targetRow.addPageBreak === "function") {
        targetRow.addPageBreak();
      }
    });
  }

  summarySheet.views = [{ state: "pageLayout", zoomScale: 90, showGridLines: false }];
  dailySheet.views = [{ state: "pageLayout", zoomScale: 90, showGridLines: false }];

  const buffer = await workbook.xlsx.writeBuffer();
  const output = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer as ArrayBuffer);
  const filename = `report_${selectedSite?.site_name ?? "site"}_${rangeLabel}_${Date.now()}.xlsx`;

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
