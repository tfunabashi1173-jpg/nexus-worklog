"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LogArea from "@/components/LogArea";

type Contractor = {
  partner_id: string;
  name: string;
};

type WorkerRow = {
  id: string;
  name: string;
  contractor_id: string;
};

type BulkRow = {
  id?: string | null;
  contractorName: string;
  workerName: string;
};

const CORPORATE_TOKENS = [
  "株式会社",
  "有限会社",
  "合同会社",
  "合名会社",
  "合資会社",
  "（株）",
  "(株)",
  "㈱",
  "（有）",
  "(有)",
  "㈲",
  "（同）",
  "(同)",
];

function stripLegalSuffix(name: string) {
  let trimmed = name.trim();
  CORPORATE_TOKENS.forEach((token) => {
    if (trimmed.startsWith(token)) {
      trimmed = trimmed.slice(token.length).trim();
    }
    if (trimmed.endsWith(token)) {
      trimmed = trimmed.slice(0, -token.length).trim();
    }
  });
  return trimmed || name;
}

export default function WorkersBulkEditor({
  contractors,
  workers,
}: {
  contractors: Contractor[];
  workers: WorkerRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const contractorOptions = useMemo(
    () =>
      contractors.map((item) => ({
        id: item.partner_id,
        name: stripLegalSuffix(item.name),
      })),
    [contractors]
  );
  const contractorNameById = useMemo(() => {
    const map = new Map<string, string>();
    contractorOptions.forEach((item) => {
      map.set(item.id, item.name);
    });
    return map;
  }, [contractorOptions]);

  const [filterContractorId, setFilterContractorId] = useState("");
  const [rows, setRows] = useState<BulkRow[]>(
    workers.map((worker) => ({
      id: worker.id,
      contractorName: contractorNameById.get(worker.contractor_id) ?? "",
      workerName: worker.name,
    }))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedContractorName = filterContractorId
    ? contractorNameById.get(filterContractorId) ?? ""
    : "";
  const visibleRows = useMemo(() => {
    if (!filterContractorId) {
      return [];
    }
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.contractorName === selectedContractorName);
  }, [rows, filterContractorId, selectedContractorName]);

  const visibleRowIndices = useMemo(
    () => visibleRows.map((item) => item.index),
    [visibleRows]
  );

  const paddedCount = useMemo(() => {
    if (!filterContractorId) {
      return 0;
    }
    if (visibleRows.length === 0) {
      return 4;
    }
    return (4 - (visibleRows.length % 4)) % 4;
  }, [filterContractorId, visibleRows.length]);

  const displayRows = useMemo(
    () => [
      ...visibleRows.map((item) => ({ ...item, isPlaceholder: false })),
      ...Array.from({ length: paddedCount }, () => ({
        row: { contractorName: selectedContractorName, workerName: "" },
        index: null as number | null,
        isPlaceholder: true,
      })),
    ],
    [visibleRows, paddedCount, selectedContractorName]
  );

  const getVisibleIndices = (list: BulkRow[]) =>
    list
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.contractorName === selectedContractorName)
      .map((item) => item.index);

  const updateRow = (index: number, next: Partial<BulkRow>) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...next };
      return copy;
    });
  };

  const addRows = (count = 1) => {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => ({
        contractorName: selectedContractorName || "",
        workerName: "",
      })),
    ]);
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    startVisibleIndex: number
  ) => {
    if (!selectedContractorName) {
      return;
    }
    const text = event.clipboardData.getData("text");
    if (!text.includes("\n") && !text.includes("\t")) {
      return;
    }
    event.preventDefault();
    const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
    const values = lines
      .map((line) => {
        const cols = line.split("\t").map((value) => value.trim());
        return (cols[cols.length - 1] ?? "").trim();
      })
      .filter(Boolean);
    setRows((prev) => {
      const next = [...prev];
      const indices = getVisibleIndices(prev);
      const requiredVisible = startVisibleIndex + values.length;
      const missing = requiredVisible - indices.length;
      if (missing > 0) {
        next.push(
          ...Array.from({ length: missing }, () => ({
            contractorName: selectedContractorName || "",
            workerName: "",
          }))
        );
      }
      const updatedVisibleIndices = [
        ...indices,
        ...Array.from({ length: missing }, (_, index) => prev.length + index),
      ];
      values.forEach((value, offset) => {
        const targetIndex = updatedVisibleIndices[startVisibleIndex + offset];
        if (targetIndex === undefined) return;
        const current = next[targetIndex] ?? {
          contractorName: selectedContractorName || "",
          workerName: "",
        };
        next[targetIndex] = {
          ...current,
          contractorName: selectedContractorName || current.contractorName,
          workerName: value,
        };
      });
      return next;
    });
  };

  const updateVisibleWorker = (visibleIndex: number, value: string) => {
    if (!selectedContractorName) {
      return;
    }
    setRows((prev) => {
      const next = [...prev];
      const indices = getVisibleIndices(prev);
      if (visibleIndex < indices.length) {
        const rowIndex = indices[visibleIndex];
        next[rowIndex] = {
          ...next[rowIndex],
          contractorName: selectedContractorName,
          workerName: value,
        };
        return next;
      }
      const missing = visibleIndex - indices.length + 1;
      const startIndex = next.length;
      next.push(
        ...Array.from({ length: missing }, () => ({
          contractorName: selectedContractorName,
          workerName: "",
        }))
      );
      next[startIndex + missing - 1] = {
        ...next[startIndex + missing - 1],
        contractorName: selectedContractorName,
        workerName: value,
      };
      return next;
    });
  };

  const handleSave = async () => {
    setMessage(null);
    if (!filterContractorId) {
      setMessage("協力業者を選択してください。");
      return;
    }
    const payload = rows
      .map((row) => ({
        id: row.id ?? undefined,
        contractorName: row.contractorName.trim(),
        workerName: row.workerName.trim(),
      }))
      .filter(
        (row) => row.contractorName === selectedContractorName && row.workerName
      );

    if (!payload.length) {
      setMessage("登録対象の行がありません。");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/masters/workers/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: payload }),
    });
    setSaving(false);

    if (!response.ok) {
      setMessage("一括保存に失敗しました。");
      return;
    }
    const data = (await response.json()) as {
      inserted: number;
      updated: number;
      restored: number;
      skipped: number;
      errors: string[];
    };
    const summary = `追加 ${data.inserted}件 / 更新 ${data.updated}件 / 復活 ${data.restored}件 / 既存 ${data.skipped}件`;
    setMessage(data.errors.length ? `${summary}\n${data.errors.join("\n")}` : summary);
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="text-sm font-medium">協力業者</label>
          <select
            value={filterContractorId}
            onChange={(event) => setFilterContractorId(event.target.value)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">選択してください</option>
            {contractorOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => addRows(4)}
            disabled={!filterContractorId}
            className="rounded border border-zinc-300 px-3 py-1 text-sm transition-all duration-150 ease-out hover:bg-zinc-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            行を追加
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
          >
            {saving ? "保存中..." : "まとめて保存"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-3">
        {!filterContractorId && (
          <p className="text-sm text-zinc-500">
            協力業者を選択すると作業員一覧が表示されます。
          </p>
        )}
        {filterContractorId && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {displayRows.map(({ row, index }, visibleIndex) => (
              <input
                key={`${row.id ?? "new"}-${index ?? `empty-${visibleIndex}`}`}
                value={row.workerName}
                onChange={(event) =>
                  updateVisibleWorker(visibleIndex, event.target.value)
                }
                onPaste={(event) => handlePaste(event, visibleIndex)}
                className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                placeholder="作業員名"
              />
            ))}
          </div>
        )}
      </div>

      <LogArea>
        {message && (
          <pre className="whitespace-pre-wrap text-sm text-zinc-600">
            {message}
          </pre>
        )}
      </LogArea>
    </div>
  );
}
