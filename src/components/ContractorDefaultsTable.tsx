"use client";

import { useEffect, useState, type ChangeEvent } from "react";

type ContractorRow = {
  partner_id: string;
  name: string;
  display_name: string;
  default_work_category_id?: string | null;
  show_in_attendance?: boolean | null;
};

type WorkCategory = {
  id: string;
  name: string;
};

type ContractorDefaultsTableProps = {
  contractors: ContractorRow[];
  workCategories: WorkCategory[];
};

type SavePayload = {
  partnerId: string;
  defaultWorkCategoryId: string | null;
  showInAttendance: boolean;
};

export default function ContractorDefaultsTable({
  contractors,
  workCategories,
}: ContractorDefaultsTableProps) {
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      contractors.map((contractor) => [
        contractor.partner_id,
        contractor.default_work_category_id ?? "",
      ])
    )
  );
  const [showMap, setShowMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      contractors.map((contractor) => [
        contractor.partner_id,
        contractor.show_in_attendance !== false,
      ])
    )
  );

  useEffect(() => {
    setCategoryMap(
      Object.fromEntries(
        contractors.map((contractor) => [
          contractor.partner_id,
          contractor.default_work_category_id ?? "",
        ])
      )
    );
    setShowMap(
      Object.fromEntries(
        contractors.map((contractor) => [
          contractor.partner_id,
          contractor.show_in_attendance !== false,
        ])
      )
    );
  }, [contractors]);

  const updateContractor = async (payload: SavePayload) => {
    setSavingMap((prev) => ({ ...prev, [payload.partnerId]: true }));
    setErrorMap((prev) => ({ ...prev, [payload.partnerId]: "" }));

    try {
      const response = await fetch("/api/masters/contractors/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message =
          typeof data?.error === "string" ? data.error : "更新に失敗しました。";
        throw new Error(message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新に失敗しました。";
      setErrorMap((prev) => ({ ...prev, [payload.partnerId]: message }));
    } finally {
      setSavingMap((prev) => ({ ...prev, [payload.partnerId]: false }));
    }
  };

  const handleCategoryChange = (
    contractor: ContractorRow,
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const nextCategoryId = event.target.value || null;
    setCategoryMap((prev) => ({
      ...prev,
      [contractor.partner_id]: nextCategoryId ?? "",
    }));
    updateContractor({
      partnerId: contractor.partner_id,
      defaultWorkCategoryId: nextCategoryId,
      showInAttendance: showMap[contractor.partner_id] ?? true,
    });
  };

  const handleShowToggle = (
    contractor: ContractorRow,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setShowMap((prev) => ({
      ...prev,
      [contractor.partner_id]: event.target.checked,
    }));
    updateContractor({
      partnerId: contractor.partner_id,
      defaultWorkCategoryId: categoryMap[contractor.partner_id] || null,
      showInAttendance: event.target.checked,
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-2">協力業者名</th>
            <th className="px-4 py-2">デフォルト作業カテゴリ</th>
            <th className="px-4 py-2">入場記録に表示</th>
          </tr>
        </thead>
        <tbody>
          {contractors.map((contractor) => (
            <tr key={contractor.partner_id} className="border-t">
              <td className="px-4 py-2">
                <span className="text-sm text-zinc-700">
                  {contractor.display_name}
                </span>
              </td>
              <td className="px-4 py-2">
                <select
                  name="defaultWorkCategoryId"
                  value={categoryMap[contractor.partner_id] ?? ""}
                  className="rounded border border-zinc-300 px-2 py-1"
                  onChange={(event) => handleCategoryChange(contractor, event)}
                  disabled={savingMap[contractor.partner_id]}
                >
                  <option value="">-</option>
                  {workCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    name="showInAttendance"
                    checked={showMap[contractor.partner_id] ?? true}
                    className="h-4 w-4"
                    onChange={(event) => handleShowToggle(contractor, event)}
                    disabled={savingMap[contractor.partner_id]}
                  />
                  表示
                </label>
                {errorMap[contractor.partner_id] ? (
                  <div className="mt-1 text-xs text-red-600">
                    {errorMap[contractor.partner_id]}
                  </div>
                ) : savingMap[contractor.partner_id] ? (
                  <div className="mt-1 text-xs text-zinc-500">保存中...</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
