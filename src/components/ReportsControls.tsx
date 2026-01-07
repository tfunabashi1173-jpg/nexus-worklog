"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Site = {
  project_id: string;
  site_name: string;
};

type WorkCategory = {
  id: string;
  name: string;
};

type WorkType = {
  id: string;
  name: string;
  category_id: string | null;
};

type ContractorOption = {
  id: string;
  name: string;
};

type ViewMode = "month" | "period" | "detail";

export default function ReportsControls({
  sites,
  selectedSiteId,
  monthValue,
  fromValue,
  toValue,
  categoryValue,
  workTypeValue,
  contractorValue,
  workerValue,
  memoValue,
  memoMatchValue,
  view,
  guestProjectId,
  workCategories,
  workTypes,
  contractorOptions,
  workerOptions,
}: {
  sites: Site[];
  selectedSiteId: string;
  monthValue: string;
  fromValue: string;
  toValue: string;
  categoryValue: string;
  workTypeValue: string;
  contractorValue: string;
  workerValue: string;
  memoValue: string;
  memoMatchValue: "exact" | "partial";
  view: ViewMode;
  guestProjectId: string | null;
  workCategories: WorkCategory[];
  workTypes: WorkType[];
  contractorOptions: ContractorOption[];
  workerOptions: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [site, setSite] = useState(selectedSiteId);
  const [month, setMonth] = useState(monthValue);
  const [from, setFrom] = useState(fromValue);
  const [to, setTo] = useState(toValue);
  const [categoryId, setCategoryId] = useState(categoryValue);
  const [workTypeId, setWorkTypeId] = useState(workTypeValue);
  const [contractorId, setContractorId] = useState(contractorValue);
  const [workerName, setWorkerName] = useState(workerValue);
  const [memo, setMemo] = useState(memoValue);
  const [memoMatch, setMemoMatch] = useState<"exact" | "partial">(
    memoMatchValue
  );
  const [mode, setMode] = useState<ViewMode>(view);

  useEffect(() => {
    setSite(selectedSiteId);
  }, [selectedSiteId]);

  useEffect(() => {
    setMonth(monthValue);
  }, [monthValue]);

  useEffect(() => {
    setFrom(fromValue);
    setTo(toValue);
  }, [fromValue, toValue]);

  useEffect(() => {
    setMode(view);
  }, [view]);

  useEffect(() => {
    setCategoryId(categoryValue);
  }, [categoryValue]);

  useEffect(() => {
    setWorkTypeId(workTypeValue);
  }, [workTypeValue]);

  useEffect(() => {
    setContractorId(contractorValue);
  }, [contractorValue]);

  useEffect(() => {
    setWorkerName(workerValue);
  }, [workerValue]);

  useEffect(() => {
    setMemo(memoValue);
  }, [memoValue]);

  useEffect(() => {
    setMemoMatch(memoMatchValue);
  }, [memoMatchValue]);

  const pushParams = (next: {
    site?: string;
    month?: string;
    from?: string;
    to?: string;
    category?: string;
    workType?: string;
    contractor?: string;
    worker?: string;
    memo?: string;
    memoMatch?: "exact" | "partial";
    view?: ViewMode;
  }) => {
    const params = new URLSearchParams();
    const siteValue = next.site ?? site;
    const viewValue = next.view ?? mode;
    const monthVal = next.month ?? month;
    const fromVal = next.from ?? from;
    const toVal = next.to ?? to;
    const categoryVal = next.category ?? categoryId;
    const workTypeVal = next.workType ?? workTypeId;
    const contractorVal = next.contractor ?? contractorId;
    const workerVal = next.worker ?? workerName;
    const memoVal = next.memo ?? memo;
    const memoMatchVal = next.memoMatch ?? memoMatch;

    if (siteValue) params.set("site", siteValue);
    if (viewValue) params.set("view", viewValue);
    if (viewValue === "month") {
      if (monthVal) params.set("month", monthVal);
    } else if (viewValue === "period") {
      if (fromVal) params.set("from", fromVal);
      if (toVal) params.set("to", toVal);
    } else {
      if (fromVal) params.set("from", fromVal);
      if (toVal) params.set("to", toVal);
      if (categoryVal) params.set("category", categoryVal);
      if (workTypeVal) params.set("workType", workTypeVal);
      if (contractorVal) params.set("contractor", contractorVal);
      if (workerVal) params.set("worker", workerVal);
      if (memoVal) params.set("memo", memoVal);
      if (memoMatchVal) params.set("memoMatch", memoMatchVal);
    }

    startTransition(() => {
      router.replace(`/reports?${params.toString()}`);
    });
  };

  const handleSiteChange = (value: string) => {
    setSite(value);
    pushParams({ site: value });
  };

  const handleMonthChange = (value: string) => {
    setMonth(value);
    pushParams({ month: value });
  };

  const handleFromChange = (value: string) => {
    setFrom(value);
    pushParams({ from: value });
  };

  const handleToChange = (value: string) => {
    setTo(value);
    pushParams({ to: value });
  };

  const handleViewChange = (value: ViewMode) => {
    setMode(value);
    if (value === "period") {
      setFrom(fromValue);
      setTo(toValue);
      pushParams({ view: value, from: fromValue, to: toValue });
      return;
    }
    if (value === "detail") {
      setFrom(fromValue);
      setTo(toValue);
      pushParams({
        view: value,
        from: fromValue,
        to: toValue,
        category: categoryValue,
        workType: workTypeValue,
        contractor: contractorValue,
        worker: workerValue,
        memo: memoValue,
        memoMatch: memoMatchValue,
      });
      return;
    }
    pushParams({ view: value, month: monthValue });
  };

  const availableWorkTypes = workTypes.filter((item) =>
    categoryId ? item.category_id === categoryId : true
  );

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center text-sm">
        <div className="relative inline-flex rounded-full border border-zinc-300 bg-white p-1">
          <div
            className={`absolute inset-y-1 w-[calc(33.333%-6px)] rounded-full bg-zinc-900 transition-transform duration-200 ease-out ${
              mode === "period"
                ? "translate-x-[calc(100%+6px)]"
                : mode === "detail"
                  ? "translate-x-[calc(200%+12px)]"
                  : "translate-x-0"
            }`}
          />
          <button
            type="button"
            onClick={() => handleViewChange("month")}
            className={`relative z-10 rounded-full px-4 py-1 transition-all duration-150 ease-out active:scale-95 ${
              mode === "month" ? "text-white" : "text-zinc-600"
            }`}
          >
            月集計
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("period")}
            className={`relative z-10 rounded-full px-4 py-1 transition-all duration-150 ease-out active:scale-95 ${
              mode === "period" ? "text-white" : "text-zinc-600"
            }`}
          >
            期間集計
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("detail")}
            className={`relative z-10 rounded-full px-4 py-1 transition-all duration-150 ease-out active:scale-95 ${
              mode === "detail" ? "text-white" : "text-zinc-600"
            }`}
          >
            詳細検索
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm font-medium">現場</label>
          <select
            name="site"
            value={site}
            onChange={(event) => handleSiteChange(event.target.value)}
            disabled={Boolean(guestProjectId)}
            className="mt-1 min-w-[240px] rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            {sites.map((siteItem) => (
              <option key={siteItem.project_id} value={siteItem.project_id}>
                {siteItem.site_name}
              </option>
            ))}
          </select>
        </div>
        {mode === "month" ? (
          <div>
            <label className="text-sm font-medium">対象月</label>
            <input
              name="month"
              type="month"
              value={month}
              onChange={(event) => handleMonthChange(event.target.value)}
              className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        ) : mode === "period" ? (
          <>
            <div>
              <label className="text-sm font-medium">開始日</label>
              <input
                name="from"
                type="date"
                value={from}
                onChange={(event) => handleFromChange(event.target.value)}
                className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">終了日</label>
              <input
                name="to"
                type="date"
                value={to}
                onChange={(event) => handleToChange(event.target.value)}
                className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </>
        ) : (
          <div className="w-full space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-sm font-medium">開始日</label>
                <input
                  name="from"
                  type="date"
                  value={from}
                  onChange={(event) => handleFromChange(event.target.value)}
                  className="mt-1 h-9 w-[130px] rounded border border-zinc-300 px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">終了日</label>
                <input
                  name="to"
                  type="date"
                  value={to}
                  onChange={(event) => handleToChange(event.target.value)}
                  className="mt-1 h-9 w-[130px] rounded border border-zinc-300 px-2 text-sm"
                />
              </div>
              <div className="w-[160px]">
                <label className="text-sm font-medium">業者</label>
                <select
                  value={contractorId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setContractorId(value);
                    if (workerName && !workerOptions.includes(workerName)) {
                      setWorkerName("");
                    }
                    pushParams({ contractor: value, worker: "" });
                  }}
                  className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                >
                  <option value="">全て</option>
                  {contractorOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-[150px]">
                <label className="text-sm font-medium">作業員</label>
                <select
                  value={workerName}
                  onChange={(event) => {
                    const value = event.target.value;
                    setWorkerName(value);
                    pushParams({ worker: value });
                  }}
                  className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                >
                  <option value="">全て</option>
                  {workerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">カテゴリ</label>
                <select
                  value={categoryId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCategoryId(value);
                    const nextWorkTypes = workTypes.filter((item) =>
                      value ? item.category_id === value : true
                    );
                    if (
                      workTypeId &&
                      !nextWorkTypes.some((item) => item.id === workTypeId)
                    ) {
                      setWorkTypeId("");
                    }
                    pushParams({ category: value, workType: "" });
                  }}
                  className="mt-1 h-9 w-[150px] rounded border border-zinc-300 px-2 text-sm"
                >
                  <option value="">全て</option>
                  {workCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">作業内容</label>
                <select
                  value={workTypeId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setWorkTypeId(value);
                    pushParams({ workType: value });
                  }}
                  className="mt-1 h-9 w-[200px] rounded border border-zinc-300 px-2 text-sm"
                >
                  <option value="">全て</option>
                  {availableWorkTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[420px]">
                <label className="text-sm font-medium">備考キーワード</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMemo(value);
                    pushParams({ memo: value });
                  }}
                  placeholder="例: 仕上げ -手直し"
                  className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  半角/全角スペース区切り。除外は「-除外語」。
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">&nbsp;</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600">一致条件</span>
                  <select
                    value={memoMatch}
                    onChange={(event) => {
                      const value =
                        event.target.value === "exact" ? "exact" : "partial";
                      setMemoMatch(value);
                      pushParams({ memoMatch: value });
                    }}
                    className="h-9 w-[160px] rounded border border-zinc-300 px-2 text-sm"
                  >
                    <option value="partial">部分一致</option>
                    <option value="exact">完全一致</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
