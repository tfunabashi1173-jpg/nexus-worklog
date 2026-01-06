"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LogArea from "@/components/LogArea";

type Site = {
  project_id: string;
  site_name: string;
  start_date: string | null;
  end_date: string | null;
};

type Contractor = {
  partner_id: string;
  name: string;
  default_work_category_id?: string | null;
  show_in_attendance?: boolean | null;
};

type Worker = {
  id: string;
  name: string;
  contractor_id: string;
  last_entry_date: string | null;
};

type WorkType = {
  id: string;
  name: string;
  category_id: string | null;
};

type WorkCategory = {
  id: string;
  name: string;
};

type NexusUser = {
  user_id: string;
  username: string | null;
};

type AttendanceFormProps = {
  sites: Site[];
  contractors: Contractor[];
  workers: Worker[];
  workCategories: WorkCategory[];
  workTypes: WorkType[];
  nexusUsers: NexusUser[];
  defaultSiteId: string | null;
  readOnly?: boolean;
};

type EntryRow = {
  id: string;
  entryId?: string | null;
  contractorId: string;
  workerId: string;
  nexusUserId: string;
  workCategoryId: string;
  workTypeId: string;
  workTypeText: string;
};

const DEFAULT_ROWS = 1;

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

const NEXUS_OPTION = {
  partner_id: "__NEXUS__",
  name: "ネクサス",
};

function isInactiveMoreThanYear(lastEntryDate: string | null) {
  if (!lastEntryDate) {
    return true;
  }
  const last = new Date(lastEntryDate);
  const now = new Date();
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 365;
}

export default function AttendanceForm({
  sites,
  contractors,
  workers,
  workCategories,
  workTypes,
  nexusUsers,
  defaultSiteId,
  readOnly = false,
}: AttendanceFormProps) {
  const newRow = (preset?: Partial<EntryRow>) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    entryId: null,
    contractorId: "",
    workerId: "",
    nexusUserId: "",
    workCategoryId: "",
    workTypeId: "",
    workTypeText: "",
    ...preset,
  });
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSiteId, setSelectedSiteId] = useState(
    defaultSiteId ?? sites[0]?.project_id ?? ""
  );
  const [currentDefaultSiteId, setCurrentDefaultSiteId] = useState(
    defaultSiteId ?? null
  );
  const [rows, setRows] = useState<EntryRow[]>(
    Array.from({ length: DEFAULT_ROWS }, () => newRow())
  );
  const [initialRows, setInitialRows] = useState<EntryRow[]>(
    Array.from({ length: DEFAULT_ROWS }, () => newRow())
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    setCurrentDefaultSiteId(defaultSiteId ?? null);
  }, [defaultSiteId]);

  const workersByContractor = useMemo(() => {
    return workers.reduce<Record<string, Worker[]>>((acc, worker) => {
      acc[worker.contractor_id] = acc[worker.contractor_id] ?? [];
      acc[worker.contractor_id].push(worker);
      return acc;
    }, {});
  }, [workers]);

  const contractorDefaultCategoryMap = useMemo(() => {
    return new Map(
      contractors.map((contractor) => [
        contractor.partner_id,
        contractor.default_work_category_id ?? "",
      ])
    );
  }, [contractors]);

  const orderedContractors = useMemo(() => {
    const visibleContractors = contractors.filter(
      (contractor) => contractor.show_in_attendance !== false
    );
    const sorted = visibleContractors
      .toSorted((a, b) =>
        stripLegalSuffix(a.name).localeCompare(stripLegalSuffix(b.name), "ja")
      );
    return [NEXUS_OPTION, ...sorted];
  }, [contractors]);

  const workerMap = useMemo(() => {
    return workers.reduce<Record<string, Worker>>((acc, worker) => {
      acc[worker.id] = worker;
      return acc;
    }, {});
  }, [workers]);

  const workTypeMap = useMemo(() => {
    return workTypes.reduce<Record<string, WorkType>>((acc, workType) => {
      acc[workType.id] = workType;
      return acc;
    }, {});
  }, [workTypes]);

  const parseNexusMemo = (value: string | null) => {
    if (!value) return null;
    if (!value.startsWith("ネクサス /")) return null;
    const parts = value.split(" / ").map((part) => part.trim());
    const name = parts[1] ?? "";
    const memo = parts.length > 2 ? parts.slice(2).join(" / ") : "";
    return { name, memo };
  };

  const buildNexusMemo = (row: EntryRow) => {
    const memo = row.workTypeText.trim();
    const nexusUser = nexusUsers.find((user) => user.user_id === row.nexusUserId);
    const display = nexusUser?.username ?? row.nexusUserId;
    return memo ? `ネクサス / ${display} / ${memo}` : `ネクサス / ${display}`;
  };

  const normalizeRow = (row: EntryRow) => ({
    contractorId: row.contractorId,
    workerId: row.workerId,
    nexusUserId: row.nexusUserId,
    workCategoryId: row.workCategoryId,
    workTypeId: row.workTypeId,
    workTypeText: row.workTypeText,
  });

  const isDirty = useMemo(() => {
    const current = rows.map(normalizeRow);
    const baseline = initialRows.map(normalizeRow);
    if (current.length !== baseline.length) {
      return true;
    }
    return JSON.stringify(current) !== JSON.stringify(baseline);
  }, [rows, initialRows]);

  const handleRowChange = (rowId: string, next: Partial<EntryRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...next } : row))
    );
  };

  const handleAddRow = (afterId?: string) => {
    setRows((prev) => {
      if (!afterId) {
        return [...prev, newRow()];
      }
      const index = prev.findIndex((row) => row.id === afterId);
      if (index === -1) {
        return [...prev, newRow()];
      }
      const base = prev[index];
      const inheritedContractorId =
        base.contractorId ||
        prev.slice(0, index).reverse().find((row) => row.contractorId)
          ?.contractorId ||
        "";
      const copy = [...prev];
      copy.splice(
        index + 1,
        0,
        newRow({
          contractorId: inheritedContractorId,
          workCategoryId: base.workCategoryId,
          workTypeId: base.workTypeId,
          workTypeText: base.workTypeText,
        })
      );
      return copy;
    });
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [newRow()];
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handleSave = async () => {
    if (readOnly) {
      return;
    }
    setSaving(true);
    setMessage(null);
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }

    if (!selectedSiteId) {
      setMessage("現場を選択してください。");
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
      setSaving(false);
      return;
    }

    const invalidWorkerIds = rows
      .map((row) => row.workerId)
      .filter((value) => value && !uuidRegex.test(value));
    if (invalidWorkerIds.length) {
      setMessage("作業員が正しく選択されていない行があります。");
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
      setSaving(false);
      return;
    }

    const payload = rows
      .filter((row) => row.workerId || row.nexusUserId)
      .map((row) => {
        const normalizedWorkerId =
          row.workerId && row.workerId === row.contractorId ? "" : row.workerId;
        const worker = workerMap[normalizedWorkerId];
        const isNexus = row.contractorId === NEXUS_OPTION.partner_id;
        const memoWithNexus = isNexus ? buildNexusMemo(row) : row.workTypeText.trim();
        return {
          entry_date: selectedDate,
          project_id: selectedSiteId,
          contractor_id: isNexus
            ? null
            : row.contractorId || worker?.contractor_id || null,
          worker_id: isNexus ? null : normalizedWorkerId || null,
          work_type_id: row.workTypeId || null,
          work_type_text: memoWithNexus || null,
        };
      });

    if (!payload.length) {
      const response = await fetch(
        `/api/attendance?date=${encodeURIComponent(
          selectedDate
        )}&projectId=${encodeURIComponent(selectedSiteId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        setMessage("当日のデータ削除に失敗しました。");
        messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
        setSaving(false);
        return;
      }
      const emptyRows = Array.from({ length: DEFAULT_ROWS }, () => newRow());
      setRows(emptyRows);
      setInitialRows(emptyRows);
      setMessage("当日のデータを削除しました。");
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
      setSaving(false);
      return;
    }

    const currentByEntryId = new Map(
      rows
        .filter((row) => row.entryId)
        .map((row) => [row.entryId as string, row])
    );
    const deletedIds: string[] = [];
    initialRows.forEach((row) => {
      if (!row.entryId) {
        return;
      }
      const current = currentByEntryId.get(row.entryId);
      if (!current) {
        deletedIds.push(row.entryId);
        return;
      }
      const wasNexus = row.contractorId === NEXUS_OPTION.partner_id;
      const isNexusNow = current.contractorId === NEXUS_OPTION.partner_id;
      if (wasNexus !== isNexusNow) {
        deletedIds.push(row.entryId);
        return;
      }
      if (wasNexus) {
        if (
          row.nexusUserId !== current.nexusUserId ||
          row.workTypeText.trim() !== current.workTypeText.trim()
        ) {
          deletedIds.push(row.entryId);
        }
        return;
      }
      if (row.workerId !== current.workerId) {
        deletedIds.push(row.entryId);
      }
    });

    const response = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: payload, deletedIds }),
    });

    if (!response.ok) {
      setMessage("保存に失敗しました。再度お試しください。");
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
      setSaving(false);
      return;
    }

    setMessage("保存しました。");
    await loadEntries();
    messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
    setSaving(false);
  };

  const loadEntries = async () => {
    if (!selectedSiteId || !selectedDate) {
      return;
    }
    setLoadingEntries(true);
    try {
      const response = await fetch(
        `/api/attendance?date=${encodeURIComponent(
          selectedDate
        )}&projectId=${encodeURIComponent(selectedSiteId)}`
      );
      if (!response.ok) {
        throw new Error("failed");
      }
      const data = await response.json();
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      if (!entries.length) {
        const emptyRows = Array.from({ length: DEFAULT_ROWS }, () => newRow());
        setRows(emptyRows);
        setInitialRows(emptyRows);
        return;
      }
      const nextRows = entries.map((entry: any, order: number) => {
        const nexusMemo = parseNexusMemo(entry.work_type_text ?? null);
        const isNexus = Boolean(nexusMemo);
        const matchUser = nexusMemo
          ? nexusUsers.find(
              (user) =>
                user.username === nexusMemo.name ||
                user.user_id === nexusMemo.name
            )
          : null;
        const workType = entry.work_type_id
          ? workTypeMap[entry.work_type_id]
          : null;
        return {
          order,
          row: newRow({
            entryId: entry.id ?? null,
            contractorId: isNexus
              ? NEXUS_OPTION.partner_id
              : entry.contractor_id ?? "",
            workerId: isNexus ? "" : entry.worker_id ?? "",
            nexusUserId: matchUser?.user_id ?? "",
            workCategoryId: workType?.category_id ?? "",
            workTypeId: entry.work_type_id ?? "",
            workTypeText: isNexus ? nexusMemo?.memo ?? "" : entry.work_type_text ?? "",
          }),
          isNexus,
        };
      });
      const sortedRows = nextRows
        .sort((a, b) => {
          if (a.isNexus !== b.isNexus) {
            return a.isNexus ? -1 : 1;
          }
          return a.order - b.order;
        })
        .map((item) => item.row);
      setRows(sortedRows);
      setInitialRows(sortedRows);
    } catch {
      setMessage("入場記録の取得に失敗しました。");
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!selectedSiteId || !selectedDate) {
      return () => {
        active = false;
      };
    }
    loadEntries().finally(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [selectedDate, selectedSiteId, nexusUsers, workTypeMap]);

  const handleSaveDefaultSite = async () => {
    if (!selectedSiteId) {
      return;
    }

    const response = await fetch("/api/settings/default-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultProjectId: selectedSiteId }),
    });

    if (!response.ok) {
      setMessage("デフォルト現場の更新に失敗しました。");
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
      return;
    }

    setCurrentDefaultSiteId(selectedSiteId);
    setMessage("デフォルト現場を更新しました。");
    messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
  };

  const isDefaultSite =
    Boolean(currentDefaultSiteId) && selectedSiteId === currentDefaultSiteId;
  const totalWorkers = rows.filter(
    (row) => row.workerId || row.nexusUserId
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-medium">日付</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">現場</label>
            <select
              value={selectedSiteId}
              onChange={(event) => setSelectedSiteId(event.target.value)}
              className="mt-1 min-w-[240px] rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              {sites.map((site) => (
                <option key={site.project_id} value={site.project_id}>
                  {site.site_name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleSaveDefaultSite}
            disabled={readOnly || isDefaultSite}
            className="rounded bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            デフォルト現場に設定
          </button>
          <div className="text-sm text-zinc-600">
            当日人数: <span className="font-semibold">{totalWorkers}</span> 名
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">入場記録</h2>
          <button
            type="button"
            onClick={() => handleAddRow()}
            disabled={readOnly}
            className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100"
          >
            業者を追加
          </button>
        </div>
        {loadingEntries && (
          <p className="mb-3 text-sm text-zinc-500">読み込み中...</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-black bg-zinc-50">
                <th className="px-3 py-2">業者名</th>
                <th className="px-3 py-2">作業員</th>
                <th className="px-3 py-2">作業内容</th>
                <th className="px-3 py-2">備考</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                  const selectedWorker = row.workerId
                    ? workerMap[row.workerId]
                    : null;
                const isNexus = row.contractorId === NEXUS_OPTION.partner_id;
                const workerList =
                  row.contractorId &&
                  row.contractorId !== NEXUS_OPTION.partner_id
                    ? workersByContractor[row.contractorId] ?? []
                    : workers;
                const isInactive = selectedWorker
                  ? isInactiveMoreThanYear(selectedWorker.last_entry_date)
                  : false;
                const prevContractorId = rows[index - 1]?.contractorId ?? "";
                const nextContractorId = rows[index + 1]?.contractorId ?? "";
                const isGroupStart =
                  index === 0 || row.contractorId !== prevContractorId;
                const isGroupEnd =
                  index === rows.length - 1 || row.contractorId !== nextContractorId;
                const cellPadding = isGroupStart ? "py-2" : "py-1";
                const showContractorSelect = isGroupStart || !row.contractorId;

                return (
                  <tr
                    key={row.id}
                    className={`${isGroupEnd ? "border-b border-black" : ""}`}
                  >
                    <td className={`px-3 ${cellPadding}`}>
                      {showContractorSelect ? (
                        <select
                          value={row.contractorId}
                          onChange={(event) =>
                            {
                              const nextContractorId = event.target.value;
                              const defaultCategory =
                                contractorDefaultCategoryMap.get(nextContractorId) ??
                                "";
                              handleRowChange(row.id, {
                                contractorId: nextContractorId,
                                workerId: "",
                                nexusUserId: "",
                                workCategoryId: defaultCategory,
                                workTypeId: "",
                              });
                            }
                          }
                          disabled={readOnly}
                          className="w-full rounded border border-zinc-300 px-2 py-1"
                        >
                          <option value="">選択</option>
                          {orderedContractors.map((contractor) => (
                            <option
                              key={contractor.partner_id}
                              value={contractor.partner_id}
                            >
                              {stripLegalSuffix(contractor.name)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-zinc-600">&nbsp;</span>
                      )}
                    </td>
                      <td className={`px-3 ${cellPadding}`}>
                        {isNexus ? (
                          <select
                            value={row.nexusUserId}
                            onChange={(event) =>
                              handleRowChange(row.id, {
                                nexusUserId: event.target.value,
                              })
                            }
                            disabled={readOnly}
                            className="w-full rounded border border-zinc-300 px-2 py-1"
                          >
                            <option value="">選択</option>
                            {nexusUsers.map((user) => (
                              <option key={user.user_id} value={user.user_id}>
                                {user.username ?? user.user_id}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={row.workerId}
                            onChange={(event) => {
                              const nextWorkerId = event.target.value;
                              const worker = workerMap[nextWorkerId];
                              handleRowChange(row.id, {
                                workerId: nextWorkerId,
                                contractorId:
                                  row.contractorId === NEXUS_OPTION.partner_id
                                    ? row.contractorId
                                    : worker?.contractor_id ?? row.contractorId,
                              });
                            }}
                            disabled={readOnly}
                            className={`w-full rounded border px-2 py-1 ${
                              isInactive ? "border-red-400" : "border-zinc-300"
                            }`}
                          >
                            <option value="">選択</option>
                            {workerList.map((worker) => (
                              <option key={worker.id} value={worker.id}>
                                {worker.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                  <td className={`px-3 ${cellPadding}`}>
                    <div className="flex gap-2">
                      <select
                        value={row.workCategoryId}
                        onChange={(event) =>
                          handleRowChange(row.id, {
                            workCategoryId: event.target.value,
                            workTypeId: "",
                          })
                        }
                        disabled={readOnly}
                        className="w-full rounded border border-zinc-300 px-2 py-1"
                      >
                        <option value="">カテゴリ</option>
                        {workCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.workTypeId}
                        onChange={(event) =>
                          handleRowChange(row.id, {
                            workTypeId: event.target.value,
                          })
                        }
                        disabled={readOnly || !row.workCategoryId}
                        className="w-full rounded border border-zinc-300 px-2 py-1"
                      >
                        <option value="">作業内容</option>
                        {workTypes
                          .filter(
                            (workType) =>
                              workType.category_id === row.workCategoryId
                          )
                          .map((workType) => (
                            <option key={workType.id} value={workType.id}>
                              {workType.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </td>
                      <td className={`px-3 ${cellPadding}`}>
                        <input
                          type="text"
                          value={row.workTypeText}
                          onChange={(event) =>
                            handleRowChange(row.id, {
                              workTypeText: event.target.value,
                            })
                          }
                          disabled={readOnly}
                          placeholder="備考"
                          className="w-full rounded border border-zinc-300 px-2 py-1"
                        />
                      </td>
                      <td className={`px-3 ${cellPadding}`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddRow(row.id)}
                            disabled={readOnly || !row.contractorId}
                            className="h-7 w-7 rounded border border-zinc-400 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="行を追加"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            disabled={readOnly}
                            className="h-7 w-7 rounded border border-zinc-400 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="行を削除"
                          >
                            -
                          </button>
                        </div>
                      </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || readOnly || !isDirty}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
        <LogArea>
          {message && <span className="text-sm text-zinc-600">{message}</span>}
        </LogArea>
      </section>
    </div>
  );
}
