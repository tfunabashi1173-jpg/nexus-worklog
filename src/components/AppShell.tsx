"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import SignOutButton from "@/components/SignOutButton";

export default function AppShell({
  children,
  role,
  username,
}: {
  children: ReactNode;
  role: "admin" | "user" | "guest";
  username: string | null;
}) {
  const rawVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
  const appVersion = rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`;
  const isGuest = role === "guest";
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: "入場記録" },
    { href: "/reports", label: "集計" },
    { href: "/masters/sites", label: "現場" },
    { href: "/masters/contractors", label: "協力業者" },
    { href: "/masters/workers", label: "作業員" },
    { href: "/masters/work-types", label: "作業内容" },
    { href: "/admin/users", label: "ユーザー", adminOnly: true },
    { href: "/admin/guest-links", label: "ゲストURL" },
    { href: "/settings", label: "設定" },
  ];
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="fixed left-0 right-0 top-0 z-20 border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-semibold">
            現場入場管理
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            {navItems
              .filter((item) => {
                if (isGuest) {
                  return item.href === "/" || item.href === "/reports";
                }
                return item.adminOnly ? role === "admin" : true;
              })
              .map((item) => {
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded px-2 py-1 ${
                      isActive
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-zinc-600">
            <span>{username ?? ""}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 overflow-auto px-4 pb-16 pt-20">
        {children}
      </main>
      <footer className="fixed bottom-0 left-0 right-0 border-t bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-zinc-500">
          <span>v{appVersion}</span>
          <span>© 2025 株式会社デザイン・オフィス・ネクサス</span>
        </div>
      </footer>
    </div>
  );
}
