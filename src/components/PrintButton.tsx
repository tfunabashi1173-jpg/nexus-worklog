"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
    >
      印刷
    </button>
  );
}
