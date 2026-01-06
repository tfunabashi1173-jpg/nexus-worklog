"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Site = {
  project_id: string;
  site_name: string;
};

export default function ReportsFilters({
  sites,
  selectedSiteId,
  monthValue,
  guestProjectId,
}: {
  sites: Site[];
  selectedSiteId: string;
  monthValue: string;
  guestProjectId: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [site, setSite] = useState(selectedSiteId);
  const [month, setMonth] = useState(monthValue);

  const pushParams = (nextSite: string, nextMonth: string) => {
    const params = new URLSearchParams();
    if (nextSite) {
      params.set("site", nextSite);
    }
    if (nextMonth) {
      params.set("month", nextMonth);
    }
    startTransition(() => {
      router.replace(`/reports?${params.toString()}`);
    });
  };

  const handleSiteChange = (value: string) => {
    setSite(value);
    pushParams(value, month);
  };

  const handleMonthChange = (value: string) => {
    setMonth(value);
    pushParams(site, value);
  };

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
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
    </div>
  );
}
