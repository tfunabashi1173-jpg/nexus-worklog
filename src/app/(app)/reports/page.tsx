import { getSession, getUserSettings } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReportsControls from "@/components/ReportsControls";

type SearchParams = {
  site?: string;
  month?: string;
  from?: string;
  to?: string;
  category?: string;
  workType?: string;
  memo?: string;
  memoMatch?: "exact" | "partial";
  view?: "month" | "period" | "detail";
};

type EntryRow = {
  entry_date: string;
  contractor_id: string | null;
  worker_id: string | null;
  contractor: { partner_id: string; name: string } | null;
  worker: { id: string; name: string } | null;
  work_type: {
    id: string;
    name: string;
    category_id: string | null;
    work_categories: { name: string } | null;
  } | null;
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const supabase = createSupabaseServerClient();
  const session = await getSession();
  const profile = await getUserSettings();
  const today = new Date();
  const todayValue = today.toISOString().slice(0, 10);
  const viewMode =
    resolvedParams.view === "period"
      ? "period"
      : resolvedParams.view === "detail"
        ? "detail"
        : "month";
  const monthValue =
    resolvedParams.month ??
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  if (!session) {
    return null;
  }

  if (session.role === "guest" && !session.guestProjectId) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">集計</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストURLからログインしてください。
        </p>
      </div>
    );
  }

  const guestProjectId =
    session.role === "guest" ? session.guestProjectId ?? null : null;
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
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">集計</h1>
        <p className="mt-2 text-sm text-zinc-600">
          現場が未登録です。管理者が現場を登録してください。
        </p>
      </div>
    );
  }

  const selectedSiteId =
    guestProjectId ??
    resolvedParams.site ??
    profile?.default_project_id ??
    sites?.[0]?.project_id ??
    "";

  const selectedSite =
    sites?.find((site) => site.project_id === selectedSiteId) ?? null;
  const { start, end, daysInMonth } = getMonthRange(monthValue);
  const [monthYear, monthNum] = monthValue.split("-");
  const monthLabel = `${monthYear}年${Number(monthNum)}月`;
  const defaultFrom = selectedSite?.start_date ?? start;
  const defaultTo = selectedSite?.end_date ?? todayValue;
  const fromValue = resolvedParams.from ?? defaultFrom;
  const toValue = resolvedParams.to ?? defaultTo;
  const rangeStart = viewMode === "month" ? start : fromValue;
  const rangeEnd = viewMode === "month" ? end : toValue;
  const categoryValue = resolvedParams.category ?? "";
  const workTypeValue = resolvedParams.workType ?? "";
  const memoValue = resolvedParams.memo ?? "";
  const memoMatchValue =
    resolvedParams.memoMatch === "exact" ? "exact" : "partial";

  const fetchEntries = async () => {
    const all: any[] = [];
    const pageSize = 1000;
    let fromIndex = 0;
    while (true) {
      const { data, error } = await supabase
        .from("attendance_entries")
        .select(
          "entry_date, contractor_id, worker_id, work_type_text, partners(partner_id,name), workers(id,name), work_types(id,name,category_id, work_categories(name))"
        )
        .eq("project_id", selectedSiteId)
        .gte("entry_date", rangeStart)
        .lte("entry_date", rangeEnd)
        .order("entry_date")
        .range(fromIndex, fromIndex + pageSize - 1);
      if (error) {
        throw error;
      }
      all.push(...(data ?? []));
      if (!data || data.length < pageSize) {
        break;
      }
      fromIndex += pageSize;
    }
    return all;
  };

  const entries = await fetchEntries();

  const [{ data: workCategories }, { data: workTypes }] = await Promise.all([
    supabase
      .from("work_categories")
      .select("id, name")
      .or("id_deleted.is.false,id_deleted.is.null")
      .order("name"),
    supabase
      .from("work_types")
      .select("id, name, category_id")
      .or("id_deleted.is.false,id_deleted.is.null")
      .order("name"),
  ]);

  const typedEntries = (entries ?? []).map((entry) => ({
    entry_date: entry.entry_date,
    contractor_id: entry.contractor_id ?? null,
    worker_id: entry.worker_id ?? null,
    contractor: entry.partners,
    worker: entry.workers,
    work_type: entry.work_types,
    work_type_text: entry.work_type_text,
  })) as EntryRow[];

  const parseNexusName = (value: string | null) => {
    if (!value) return null;
    const normalized = value
      .replace(/／/g, "/")
      .replace(/\u3000/g, " ")
      .trim();
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

  const dailyEntries =
    viewMode === "month"
      ? Array.from({ length: daysInMonth }, (_, index) => {
          const day = String(index + 1).padStart(2, "0");
          const date = `${monthValue}-${day}`;
          return {
            date,
            entries: typedEntries.filter((entry) => entry.entry_date === date),
          };
        })
      : [];
  const [yearValue, monthNumber] = monthValue.split("-").map(Number);
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

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

  const buildGroupedRows = (
    rows: typeof attendanceRows,
    pageSize?: number
  ) => {
    return rows.reduce<
      Array<{
        row: { contractorName: string; workerName: string; dates: Set<string> };
        showContractor: boolean;
        rowSpan: number;
        pageIndex: number;
      }>
    >((acc, row, index) => {
      const pageIndex = pageSize ? Math.floor(index / pageSize) : 0;
      const prev = acc[acc.length - 1];
      if (
        prev &&
        prev.row.contractorName === row.contractorName &&
        prev.pageIndex === pageIndex
      ) {
        acc.push({ row, showContractor: false, rowSpan: 0, pageIndex });
        const firstIndex = acc.findIndex(
          (item, itemIndex) =>
            item.pageIndex === pageIndex &&
            item.showContractor &&
            item.row.contractorName === row.contractorName &&
            itemIndex < acc.length
        );
        if (firstIndex >= 0) {
          acc[firstIndex].rowSpan += 1;
        }
        return acc;
      }
      acc.push({ row, showContractor: true, rowSpan: 1, pageIndex });
      return acc;
    }, []);
  };

  const groupedRows = buildGroupedRows(attendanceRows);

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

  const memoMatches = (memo: string, terms: ReturnType<typeof parseMemoTerms>) => {
    if (!terms.include.length && !terms.exclude.length) {
      return true;
    }
    if (!memo) {
      return terms.include.length === 0;
    }
    if (memoMatchValue === "exact") {
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

  const memoTerms = parseMemoTerms(memoValue);
  const detailedEntries = typedEntries
    .filter((entry) => {
      if (categoryValue && entry.work_type?.category_id !== categoryValue) {
        return false;
      }
      if (workTypeValue && entry.work_type?.id !== workTypeValue) {
        return false;
      }
      return memoMatches(entry.work_type_text ?? "", memoTerms);
    })
    .map((entry) => {
      const memoText = entry.work_type_text ?? "";
      const nexusName = parseNexusName(memoText);
      const contractorName = entry.contractor
        ? stripLegalSuffix(entry.contractor.name)
        : nexusName
          ? "ネクサス"
          : entry.contractor_id ?? "";
      const workerName = entry.worker?.name ?? nexusName ?? entry.worker_id ?? "";
      return {
        entryDate: entry.entry_date,
        contractorName,
        workerName,
        categoryName: entry.work_type?.work_categories?.name ?? "",
        workTypeName: entry.work_type?.name ?? "",
        memo: memoText,
      };
    })
    .sort((a, b) => {
      const dateCompare = a.entryDate.localeCompare(b.entryDate);
      if (dateCompare !== 0) return dateCompare;
      const contractorCompare = a.contractorName.localeCompare(b.contractorName, "ja");
      if (contractorCompare !== 0) return contractorCompare;
      return a.workerName.localeCompare(b.workerName, "ja");
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">集計</h1>
          <p className="text-sm text-zinc-600">
            現場ごとの入場人数と日別一覧を表示します。
          </p>
        </div>
        <a
          href={
            viewMode === "detail"
              ? `/api/reports/export-detail?${new URLSearchParams({
                  site: selectedSiteId,
                  from: fromValue,
                  to: toValue,
                  category: categoryValue,
                  workType: workTypeValue,
                  memo: memoValue,
                  memoMatch: memoMatchValue,
                }).toString()}`
              : `/api/reports/export?${new URLSearchParams({
                  site: selectedSiteId,
                  view: viewMode,
                  ...(viewMode === "month"
                    ? { month: monthValue }
                    : { from: fromValue, to: toValue }),
                }).toString()}`
          }
          className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
        >
          Excel出力
        </a>
      </div>

      <ReportsControls
        sites={sites ?? []}
        selectedSiteId={selectedSiteId}
        monthValue={monthValue}
        fromValue={fromValue}
        toValue={toValue}
        categoryValue={categoryValue}
        workTypeValue={workTypeValue}
        memoValue={memoValue}
        memoMatchValue={memoMatchValue}
        view={viewMode}
        guestProjectId={guestProjectId}
        workCategories={workCategories ?? []}
        workTypes={workTypes ?? []}
      />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">業者別人数</h2>
        <div className="mt-2 text-sm text-zinc-600">
          合計人数:{" "}
          <span className="font-semibold">
            {Array.from(contractorCounts.values()).reduce(
              (sum, item) => sum + item.dayKeys.size,
              0
            )}
          </span>{" "}
          人工
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Array.from(contractorCounts.values()).map((item) => (
            <div key={item.name} className="rounded border border-zinc-200 p-3">
              <div className="text-sm text-zinc-500">{item.name}</div>
              <div className="text-xl font-semibold">{item.dayKeys.size} 人工</div>
            </div>
          ))}
          {!contractorCounts.size && (
            <p className="text-sm text-zinc-500">対象期間の入場がありません。</p>
          )}
        </div>
      </section>

      {viewMode === "month" ? (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">日別入場一覧</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="border-r border-zinc-300 px-3 py-2">業者</th>
                  <th className="border-r border-zinc-300 px-3 py-2">氏名</th>
                  <th className="border-r border-zinc-300 px-2 py-2 text-center leading-tight">
                    <span className="block text-[11px]">入場</span>
                    <span className="block text-[11px]">日数</span>
                  </th>
                  {dailyEntries.map((day) => (
                    <th
                      key={day.date}
                      className="border-r border-zinc-300 px-1 py-2 text-center"
                    >
                      <div className="leading-tight">
                        <div>{String(Number(day.date.split("-")[2]))}</div>
                        <div className="text-xs text-zinc-500">
                          {weekdayLabels[
                            new Date(
                              yearValue,
                              monthNumber - 1,
                              Number(day.date.split("-")[2])
                            ).getDay()
                          ]}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((item) => {
                  return (
                  <tr
                    key={`${item.row.contractorName}-${item.row.workerName}`}
                    className="border-t"
                  >
                    {item.showContractor && (
                      <td
                        rowSpan={item.rowSpan}
                        className="border-r border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700"
                      >
                        <span className="block max-w-[200px] whitespace-nowrap tracking-tight">
                          {item.row.contractorName}
                        </span>
                      </td>
                    )}
                    <td className="border-r border-zinc-300 px-3 py-2">
                      <span className="block min-w-[80px] whitespace-nowrap text-xs">
                        {item.row.workerName}
                      </span>
                    </td>
                    <td className="border-r border-zinc-300 px-3 py-2">
                      {item.row.dates.size}
                    </td>
                    {dailyEntries.map((day) => (
                      <td
                        key={`${item.row.workerName}-${day.date}`}
                        className="border-r border-zinc-300 px-1 py-2 text-center"
                      >
                        {item.row.dates.has(day.date) ? "◯" : ""}
                      </td>
                    ))}
                  </tr>
                );
                })}
                {!attendanceRows.length && (
                  <tr>
                    <td
                      className="px-3 py-3 text-sm text-zinc-500"
                      colSpan={3 + daysInMonth}
                    >
                      対象期間の入場がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : viewMode === "period" ? (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">期間集計（ネクサス内訳）</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Array.from(
              attendanceRows
                .filter((row) => row.contractorName === "ネクサス")
                .reduce<Map<string, Set<string>>>((acc, row) => {
                  acc.set(row.workerName, row.dates);
                  return acc;
                }, new Map())
            ).map(([name, dates]) => (
              <div key={name} className="rounded border border-zinc-200 p-3">
                <div className="text-sm text-zinc-500">{name}</div>
                <div className="text-lg font-semibold">{dates.size} 人工</div>
              </div>
            ))}
            {!attendanceRows.some((row) => row.contractorName === "ネクサス") && (
              <p className="text-sm text-zinc-500">ネクサスの入場がありません。</p>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">詳細検索結果</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2">日付</th>
                  <th className="px-3 py-2">業者</th>
                  <th className="px-3 py-2">作業員</th>
                  <th className="px-3 py-2">カテゴリ</th>
                  <th className="px-3 py-2">作業内容</th>
                  <th className="px-3 py-2">備考</th>
                </tr>
              </thead>
              <tbody>
                {detailedEntries.map((entry, index) => (
                  <tr key={`${entry.entryDate}-${entry.workerName}-${index}`} className="border-t">
                    <td className="px-3 py-2">{entry.entryDate}</td>
                    <td className="px-3 py-2">{entry.contractorName}</td>
                    <td className="px-3 py-2">{entry.workerName}</td>
                    <td className="px-3 py-2">{entry.categoryName}</td>
                    <td className="px-3 py-2">{entry.workTypeName}</td>
                    <td className="px-3 py-2">{entry.memo}</td>
                  </tr>
                ))}
                {!detailedEntries.length && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-500" colSpan={6}>
                      条件に一致する入場記録がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
