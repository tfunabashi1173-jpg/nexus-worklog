import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { createSite, deleteSite, updateSite } from "@/app/(app)/masters/sites/actions";

type SearchParams = {
  scope?: "range" | "all";
  from?: string;
  to?: string;
};

function computeStatus(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return "受注";
  }
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) {
    return "受注";
  }
  if (now > end) {
    return "完工";
  }
  return "着工中";
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { start, end };
}

function isOverlappingRange(
  siteStart: string | null,
  siteEnd: string | null,
  rangeStart: string,
  rangeEnd: string
) {
  const start = siteStart ?? "0000-01-01";
  const end = siteEnd ?? "9999-12-31";
  return start <= rangeEnd && end >= rangeStart;
}

export default async function SitesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const session = await getSession();
  if (!session || session.role === "guest") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">現場</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストユーザーは閲覧できません。
        </p>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const today = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(today);
  const scope = resolvedParams?.scope === "all" ? "all" : "range";
  const rangeStart = resolvedParams?.from ?? monthStart;
  const rangeEnd = resolvedParams?.to ?? monthEnd;

  const [{ data: sites }, { data: managers }, { data: partners }] = await Promise.all([
    supabase
      .from("projects")
      .select("project_id, site_name, start_date, end_date, status, customer_id")
      .or("is_deleted.is.false,is_deleted.is.null")
      .order("site_name"),
    supabase
      .from("users")
      .select("user_id, username")
      .or("is_deleted.is.false,is_deleted.is.null")
      .order("user_id"),
    supabase
      .from("partners")
      .select("partner_id, name")
      .like("partner_id", "C%")
      .order("partner_id"),
  ]);

  const filteredSites =
    scope === "all"
      ? sites
      : (sites ?? []).filter((site) =>
          isOverlappingRange(site.start_date, site.end_date, rangeStart, rangeEnd)
        );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">現場</h1>
        <p className="text-sm text-zinc-600">現場と工期を管理します。</p>
      </div>

      <form action={createSite} className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">新規登録</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <input
            name="name"
            placeholder="現場名"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <select
            name="managerId"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">担当者</option>
            {managers?.map((manager) => (
              <option key={manager.user_id} value={manager.user_id}>
                {manager.username ?? manager.user_id}
              </option>
            ))}
          </select>
          <select
            name="customerId"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">得意先</option>
            {partners?.map((partner) => (
              <option key={partner.partner_id} value={partner.partner_id}>
                {partner.name}
              </option>
            ))}
          </select>
          <input
            name="startDate"
            type="date"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="endDate"
            type="date"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            登録
          </button>
        </div>
      </form>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div>
          <label className="text-sm font-medium">表示</label>
          <select
            name="scope"
            defaultValue={scope}
            className="mt-1 min-w-[200px] rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="range">期間指定（デフォルト: 今月稼働中）</option>
            <option value="all">全て表示</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">開始日</label>
          <input
            type="date"
            name="from"
            defaultValue={rangeStart}
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">終了日</label>
          <input
            type="date"
            name="to"
            defaultValue={rangeEnd}
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          反映
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2">現場名</th>
              <th className="px-4 py-2">得意先</th>
              <th className="px-4 py-2">ステータス</th>
              <th className="px-4 py-2">開始日</th>
              <th className="px-4 py-2">終了日</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredSites?.map((site) => (
              <tr key={site.project_id} className="border-t">
                <td className="px-4 py-2">
                  <form id={`site-${site.project_id}`} action={updateSite}>
                    <input type="hidden" name="siteId" value={site.project_id} />
                    <input
                      name="name"
                      defaultValue={site.site_name}
                      className="w-full rounded border border-zinc-300 px-2 py-1"
                    />
                  </form>
                </td>
                <td className="px-4 py-2">
                  <select
                    name="customerId"
                    defaultValue={site.customer_id ?? ""}
                    className="rounded border border-zinc-300 px-2 py-1"
                    form={`site-${site.project_id}`}
                  >
                    <option value="">-</option>
                    {partners?.map((partner) => (
                      <option key={partner.partner_id} value={partner.partner_id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-sm text-zinc-600">
                  {site.status === "精算完了"
                    ? "完工"
                    : computeStatus(site.start_date, site.end_date)}
                </td>
                <td className="px-4 py-2">
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={site.start_date ?? ""}
                    className="rounded border border-zinc-300 px-2 py-1"
                    form={`site-${site.project_id}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    name="endDate"
                    type="date"
                    defaultValue={site.end_date ?? ""}
                    className="rounded border border-zinc-300 px-2 py-1"
                    form={`site-${site.project_id}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      form={`site-${site.project_id}`}
                      className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100"
                    >
                      更新
                    </button>
                    <form action={deleteSite}>
                      <input type="hidden" name="siteId" value={site.project_id} />
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
