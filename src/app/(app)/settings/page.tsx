"use client";

import { useState } from "react";
import LogArea from "@/components/LogArea";
import GuardedSettings from "@/app/(app)/settings/GuardedSettings";

export default function SettingsPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    const response = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setSaving(false);

    if (!response.ok) {
      setMessage("パスワードの更新に失敗しました。");
      return;
    }

    setPassword("");
    setMessage("パスワードを更新しました。");
  };

  return (
    <GuardedSettings>
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">設定</h1>
          <p className="text-sm text-zinc-600">パスワードを変更できます。</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-4">
          <label className="text-sm font-medium">新しいパスワード</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "更新中..." : "更新"}
          </button>
          <LogArea>
            {message && <p className="text-sm text-zinc-600">{message}</p>}
          </LogArea>
        </form>
      </div>
    </GuardedSettings>
  );
}
