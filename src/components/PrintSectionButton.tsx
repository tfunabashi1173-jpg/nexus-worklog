"use client";

import { useCallback } from "react";

type PrintSize = "A4-L" | "A3-P";

type PrintSectionButtonProps = {
  label: string;
  sectionId: string;
  printSize: PrintSize;
};

const PAGE_CSS: Record<PrintSize, string> = {
  "A4-L": "@page { size: A4 landscape; margin: 0mm; }",
  "A3-P": "@page { size: A3 portrait; margin: 0mm; }",
};

export default function PrintSectionButton({
  label,
  sectionId,
  printSize,
}: PrintSectionButtonProps) {
  const handlePrint = useCallback(() => {
    const root = document.body;
    root.dataset.printSection = sectionId;

    const styleId = "print-page-size";
    const existing = document.getElementById(styleId);
    if (existing) {
      existing.remove();
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = PAGE_CSS[printSize];
    document.head.appendChild(style);

    const cleanup = () => {
      delete root.dataset.printSection;
      const current = document.getElementById(styleId);
      if (current) {
        current.remove();
      }
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    requestAnimationFrame(() => {
      window.print();
    });
  }, [printSize, sectionId]);

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
    >
      {label}
    </button>
  );
}
