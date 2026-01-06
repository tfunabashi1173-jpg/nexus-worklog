"use client";

import { ReactNode, useState } from "react";

type TabMode = "normal" | "bulk";

export default function WorkersTabs({
  initialTab = "normal",
  normalContent,
  bulkContent,
}: {
  initialTab?: TabMode;
  normalContent: ReactNode;
  bulkContent: ReactNode;
}) {
  const [mode, setMode] = useState<TabMode>(initialTab);

  return (
    <div className="space-y-4">
      <div className="relative inline-flex rounded-full border border-zinc-300 bg-white p-1 text-sm">
        <div
          className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-zinc-900 transition-transform duration-200 ease-out ${
            mode === "bulk" ? "translate-x-full" : "translate-x-0"
          }`}
        />
        <button
          type="button"
          onClick={() => setMode("normal")}
          className={`relative z-10 rounded-full px-4 py-1 transition-all duration-150 ease-out active:scale-95 ${
            mode === "normal" ? "text-white" : "text-zinc-600"
          }`}
          aria-pressed={mode === "normal"}
        >
          通常
        </button>
        <button
          type="button"
          onClick={() => setMode("bulk")}
          className={`relative z-10 rounded-full px-4 py-1 transition-all duration-150 ease-out active:scale-95 ${
            mode === "bulk" ? "text-white" : "text-zinc-600"
          }`}
          aria-pressed={mode === "bulk"}
        >
          一括編集
        </button>
      </div>

      <section className={mode === "normal" ? "" : "hidden"}>
        {normalContent}
      </section>
      <section className={mode === "bulk" ? "" : "hidden"}>{bulkContent}</section>
    </div>
  );
}
