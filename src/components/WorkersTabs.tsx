import { ReactNode } from "react";

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
  const isBulk = initialTab === "bulk";

  return (
    <div className="space-y-4">
      <input
        type="radio"
        name="workers-tab"
        id="workers-tab-normal"
        className="sr-only"
        defaultChecked={!isBulk}
      />
      <input
        type="radio"
        name="workers-tab"
        id="workers-tab-bulk"
        className="sr-only"
        defaultChecked={isBulk}
      />
      <div className="tabs relative inline-flex rounded-full border border-zinc-300 bg-white p-1 text-sm">
        <div className="indicator absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-zinc-900 transition-transform duration-200 ease-out" />
        <label
          htmlFor="workers-tab-normal"
          className="tab tab-normal relative z-10 cursor-pointer rounded-full px-4 py-1 text-zinc-600 transition-all duration-150 ease-out active:scale-95"
        >
          通常
        </label>
        <label
          htmlFor="workers-tab-bulk"
          className="tab tab-bulk relative z-10 cursor-pointer rounded-full px-4 py-1 text-zinc-600 transition-all duration-150 ease-out active:scale-95"
        >
          一括編集
        </label>
      </div>

      <section className="tab-panel tab-panel-normal">{normalContent}</section>
      <section className="tab-panel tab-panel-bulk">{bulkContent}</section>
      <style>
        {`
          #workers-tab-bulk:checked ~ .tabs .indicator { transform: translateX(100%); }
          #workers-tab-normal:checked ~ .tabs .tab-normal { color: #ffffff; }
          #workers-tab-bulk:checked ~ .tabs .tab-bulk { color: #ffffff; }
          #workers-tab-bulk:checked ~ .tab-panel-normal { display: none; }
          #workers-tab-normal:checked ~ .tab-panel-bulk { display: none; }
        `}
      </style>
    </div>
  );
}
