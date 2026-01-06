"use client";

import { useState } from "react";
import LogArea from "@/components/LogArea";

type Site = {
  project_id: string;
  site_name: string;
};

type GuestLinkItem = {
  token: string;
  projectId: string;
  siteName: string;
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
  const [projectId, setProjectId] = useState(sites[0]?.project_id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkItems, setLinkItems] = useState<GuestLinkItem[]>(links);
  const [saving, setSaving] = useState(false);

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
      body: JSON.stringify({ projectId }),
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
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="text-sm font-medium">対象現場</label>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              {sites.map((site) => (
                <option key={site.project_id} value={site.project_id}>
                  {site.site_name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-fit self-end rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
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
                  className="min-w-[280px] flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(item.token)}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100"
                >
                  コピー
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.token)}
                  className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
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
