"use client";

import { useEffect, useState } from "react";

type Session = {
  role: "admin" | "user" | "guest";
  username: string | null;
};

export default function GuardedSettings({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSession(data?.session ?? null))
      .catch(() => setSession(null));
  }, []);

  if (!session) {
    return null;
  }

  if (session.role === "guest") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">設定</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストユーザーは閲覧できません。
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
