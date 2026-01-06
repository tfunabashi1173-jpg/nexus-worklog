"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Site = {
  project_id: string;
  site_name: string;
};

type ViewMode = "month" | "period";

export default function ReportsControls({
  sites,
  selectedSiteId,
  monthValue,
  fromValue,
  toValue,
  view,
  guestProjectId,
}: {
  sites: Site[];
  selectedSiteId: string;
  monthValue: string;
  fromValue: string;
  toValue: string;
  view: ViewMode;
  guestProjectId: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [site, setSite] = useState(selectedSiteId);
  const [month, setMonth] = useState(monthValue);
  const [from, setFrom] = useState(fromValue);
  const [to, setTo] = useState(toValue);
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

  const pushParams = (next: {
    site?: string;
    month?: string;
    from?: string;
    to?: string;
    view?: ViewMode;
  }) => {
    const params = new URLSearchParams();
    const siteValue = next.site ?? site;
    const viewValue = next.view ?? mode;
    const monthVal = next.month ?? month;
    const fromVal = next.from ?? from;
    const toVal = next.to ?? to;

    if (siteValue) params.set("site", siteValue);
    if (viewValue) params.set("view", viewValue);
    if (viewValue === "month") {
      if (monthVal) params.set("month", monthVal);
    } else {
      if (fromVal) params.set("from", fromVal);
      if (toVal) params.set("to", toVal);
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
    pushParams({ view: value, month: monthValue });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center text-sm">
        <div className="relative inline-flex rounded-full border border-zinc-300 bg-white p-1">
          <div
            className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-zinc-900 transition-transform duration-200 ease-out ${
              mode === "period" ? "translate-x-full" : "translate-x-0"
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
        ) : (
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
        )}
      </div>
    </div>
  );
}
