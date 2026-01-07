"use client";

import { useState } from "react";
import LogArea from "@/components/LogArea";

type Site = {
  project_id: string;
  site_name: string;
  start_date: string | null;
  end_date: string | null;
};

type GuestLinkItem = {
  token: string;
  projectId: string;
  siteName: string;
  expiresAt?: string | null;
};

export default function GuestLinkForm({
  sites,
  links,
  baseUrl,
}: {
  sites: Site[];
  links: GuestLinkItem[];
  baseUrl: string;
}) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
  const [monthValue, setMonthValue] = useState(defaultMonth);
  const [projectId, setProjectId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkItems, setLinkItems] = useState<GuestLinkItem[]>(links);
  const [saving, setSaving] = useState(false);
  const filterSitesByMonth = (value: string) => {
    const monthStart = new Date(`${value}-01T00:00:00`);
    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
      23,
      59,
      59
    );
    return sites.filter((site) => {
      if (!site.start_date && !site.end_date) {
        return true;
      }
      const start = site.start_date ? new Date(site.start_date) : null;
      const end = site.end_date ? new Date(site.end_date) : null;
      if (start && monthEnd < start) {
        return false;
      }
      if (end && monthStart > end) {
        return false;
      }
      return true;
    });
  };
  const filteredSites = filterSitesByMonth(monthValue);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setLink(null);
    if (!projectId) {
      setMessage("現場を選択してください。");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/guest-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        expiresAt: expiresAt.trim() ? expiresAt.trim() : null,
      }),
    });
    setSaving(false);
    const data = (await response.json()) as {
      url?: string;
      details?: string;
      token?: string;
      existing?: boolean;
    };
    if (!response.ok) {
      setMessage(
        data.details
          ? `ゲストURLの発行に失敗しました。(${data.details})`
          : "ゲストURLの発行に失敗しました。"
      );
      return;
    }
    const nextUrl =
      data.url?.startsWith("/") && typeof window !== "undefined"
        ? `${window.location.origin}${data.url}`
        : data.url ?? null;
    setLink(nextUrl);
    if (typeof data.token === "string") {
      const token = data.token;
      setLinkItems((prev) => {
        if (prev.some((item) => item.token === token)) {
          return prev;
        }
        const site = sites.find((item) => item.project_id === projectId);
        return [
          {
            token,
            projectId,
            siteName: site?.site_name ?? projectId,
            expiresAt: expiresAt.trim() ? expiresAt.trim() : null,
          },
          ...prev,
        ];
      });
    }
    setMessage(
      data.existing ? "作成済みのゲストURLを表示しました。" : "ゲストURLを発行しました。"
    );
  };

  const handleDelete = async (token: string) => {
    if (!confirm("このゲストURLを削除しますか？")) {
      return;
    }
    const response = await fetch(`/api/guest-links/${token}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setMessage("ゲストURLの削除に失敗しました。");
      return;
    }
    setLinkItems((prev) => prev.filter((item) => item.token !== token));
    if (link?.includes(token)) {
      setLink(null);
    }
    setMessage("ゲストURLを削除しました。");
  };

  const handleUpdateExpiry = async (token: string) => {
    const target = linkItems.find((item) => item.token === token);
    if (!target) {
      return;
    }
    const response = await fetch(`/api/guest-links/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expiresAt: target.expiresAt && target.expiresAt.trim()
          ? target.expiresAt.trim()
          : null,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (payload?.error === "expired") {
        setMessage("有効期限が切れているため更新できません。");
        setLinkItems((prev) => prev.filter((item) => item.token !== token));
        return;
      }
      setMessage("有効期限の更新に失敗しました。");
      return;
    }
    setMessage("有効期限を更新しました。");
  };

  const handleCopy = async (token: string) => {
    const url = buildUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("URLをコピーしました。");
    } catch {
      setMessage("コピーに失敗しました。");
    }
  };

  const getOrigin = () => {
    if (baseUrl) {
      return baseUrl;
    }
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "";
  };

  const buildUrl = (token: string) => {
    const origin = getOrigin();
    if (!origin) {
      return `/login?guest=${token}`;
    }
    return `${origin}/login?guest=${token}`;
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">ゲストURL発行</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr_220px_auto] md:items-end">
          <div>
            <label className="text-sm font-medium">対象月</label>
            <input
              name="month"
              type="month"
              value={monthValue}
              onChange={(event) => {
                const value = event.target.value;
                setMonthValue(value);
                const nextSites = filterSitesByMonth(value);
                if (projectId && !nextSites.some((site) => site.project_id === projectId)) {
                  setProjectId("");
                }
              }}
              className="mt-1 h-10 w-full rounded border border-zinc-300 px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">対象現場</label>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-1 h-10 w-full rounded border border-zinc-300 px-3 text-sm"
            >
              <option value="">現場を選択してください</option>
              {filteredSites.map((site) => (
                <option key={site.project_id} value={site.project_id}>
                  {site.site_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">有効期限</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-1 h-10 w-full rounded border border-zinc-300 px-3 text-sm"
            />
            <p className="mt-1 h-4 text-xs text-zinc-500">未設定なら無期限。</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded bg-zinc-900 px-6 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
          >
            {saving ? "発行中..." : "発行"}
          </button>
        </div>
        {link && (
          <div className="mt-4">
            <label className="text-sm font-medium">ゲストURL</label>
            <input
              type="text"
              readOnly
              value={link}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">
              ゲストは `guest` / `guest` でログインしてください。
            </p>
          </div>
        )}
        <LogArea>
          {message && <p className="text-sm text-zinc-600">{message}</p>}
        </LogArea>
      </form>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">発行済みURL</h2>
        {linkItems.length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">発行済みURLはありません。</p>
        )}
        {linkItems.length > 0 && (
          <div className="mt-3 space-y-3">
            {linkItems.map((item) => (
              <div
                key={item.token}
                className="flex flex-wrap items-center gap-3 rounded border border-zinc-200 p-3"
              >
                <div className="min-w-[220px] text-sm font-medium">
                  {item.siteName}
                </div>
                <input
                  type="text"
                  readOnly
                  value={buildUrl(item.token)}
                  className="min-w-[280px] flex-1 rounded border border-zinc-300 px-2 text-xs h-8"
                />
                <input
                  type="date"
                  value={item.expiresAt ?? ""}
                  onChange={(event) =>
                    setLinkItems((prev) =>
                      prev.map((link) =>
                        link.token === item.token
                          ? { ...link, expiresAt: event.target.value }
                          : link
                      )
                    )
                  }
                  className="rounded border border-zinc-300 px-2 text-xs h-8"
                />
                <button
                  type="button"
                  onClick={() => handleUpdateExpiry(item.token)}
                  className="h-8 rounded border border-zinc-300 px-3 text-xs transition-all duration-150 ease-out hover:bg-zinc-100 active:scale-95"
                >
                  期限更新
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(item.token)}
                  className="h-8 rounded border border-zinc-300 px-3 text-xs transition-all duration-150 ease-out hover:bg-zinc-100 active:scale-95"
                >
                  コピー
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.token)}
                  className="h-8 rounded border border-red-300 px-3 text-xs text-red-600 transition-all duration-150 ease-out hover:bg-red-50 active:scale-95"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
