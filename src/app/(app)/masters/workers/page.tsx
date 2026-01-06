import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import {
  createWorker,
  deleteWorker,
  updateWorker,
} from "@/app/(app)/masters/workers/actions";
import WorkersFilterForm from "@/components/WorkersFilterForm";
import AutoDismissAlert from "@/components/AutoDismissAlert";
import LogArea from "@/components/LogArea";

type WorkerRow = {
  id: string;
  name: string;
  contractor_id: string;
  partners: { name: string } | null;
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

type SearchParams = {
  error?: string;
  success?: string;
  contractor?: string;
};

export default async function WorkersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const session = await getSession();
  if (!session || session.role === "guest") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">作業員</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストユーザーは閲覧できません。
        </p>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const contractorFilter = resolvedParams?.contractor ?? "";
  const workersQuery = supabase
    .from("workers")
    .select("id, name, contractor_id, partners(name)")
    .or("id_deleted.is.false,id_deleted.is.null");
  if (contractorFilter) {
    workersQuery.eq("contractor_id", contractorFilter);
  }

  const [{ data: workers }, { data: contractors }] = await Promise.all([
    workersQuery,
    supabase
      .from("partners")
      .select("partner_id, name")
      .eq("category", "協力業者")
      .or("is_deleted.is.false,is_deleted.is.null")
      .order("partner_id"),
  ]);

  const errorMessage = resolvedParams?.error
    ? decodeURIComponent(resolvedParams.error)
    : null;
  const successMessage =
    resolvedParams?.success === "created"
      ? "作業員を登録しました。"
      : resolvedParams?.success === "restored"
        ? "作業員を復活しました。"
      : resolvedParams?.success === "updated"
        ? "作業員を更新しました。"
        : resolvedParams?.success === "deleted"
          ? "作業員を削除しました。"
          : null;

  const contractorNameMap = new Map(
    (contractors ?? []).map((contractor) => [
      contractor.partner_id,
      stripLegalSuffix(contractor.name),
    ])
  );
  const contractorOptions = (contractors ?? []).map((contractor) => ({
    partner_id: contractor.partner_id,
    name: stripLegalSuffix(contractor.name),
  }));

  const sortedWorkers = (workers ?? [])
    .filter((worker) =>
      contractorFilter ? worker.contractor_id === contractorFilter : true
    )
    .toSorted((a, b) => {
      const aName = contractorNameMap.get(a.contractor_id) ?? "";
      const bName = contractorNameMap.get(b.contractor_id) ?? "";
      const contractorCompare = aName.localeCompare(bName, "ja");
      if (contractorCompare !== 0) {
        return contractorCompare;
      }
      return a.name.localeCompare(b.name, "ja");
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">作業員</h1>
        <p className="text-sm text-zinc-600">協力業者に紐付く作業員を管理します。</p>
      </div>
      <LogArea>
        {(errorMessage || successMessage) && (
          <AutoDismissAlert
            message={errorMessage ?? successMessage ?? ""}
            tone={errorMessage ? "error" : "success"}
          />
        )}
      </LogArea>

      <form action={createWorker} className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">新規登録</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select
            name="contractorId"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          >
            <option value="">協力業者を選択</option>
            {contractors?.map((contractor) => (
              <option key={contractor.partner_id} value={contractor.partner_id}>
                {stripLegalSuffix(contractor.name)}
              </option>
            ))}
          </select>
          <input
            name="name"
            placeholder="作業員名"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            登録
          </button>
        </div>
      </form>

      <WorkersFilterForm
        contractors={contractorOptions}
        contractorFilter={contractorFilter}
      />

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2">協力業者</th>
              <th className="px-4 py-2">作業員名</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedWorkers.map((worker) => {
              const row = worker as WorkerRow;
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-2">
                    <select
                      name="contractorId"
                      defaultValue={row.contractor_id}
                      className="rounded border border-zinc-300 px-2 py-1"
                      form={`worker-${row.id}`}
                    >
                      {contractors?.map((contractor) => (
                        <option
                          key={contractor.partner_id}
                          value={contractor.partner_id}
                        >
                          {stripLegalSuffix(contractor.name)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <form id={`worker-${row.id}`} action={updateWorker}>
                      <input type="hidden" name="workerId" value={row.id} />
                      <input
                        name="name"
                        defaultValue={row.name}
                        className="w-full rounded border border-zinc-300 px-2 py-1"
                      />
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        form={`worker-${row.id}`}
                        className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100"
                      >
                        更新
                      </button>
                      <form action={deleteWorker}>
                        <input type="hidden" name="workerId" value={row.id} />
                        <button
                          type="submit"
                          className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          削除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
