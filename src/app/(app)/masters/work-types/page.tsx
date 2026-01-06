import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import {
  createWorkCategory,
  createWorkType,
  deleteWorkCategory,
  deleteWorkType,
  importWorkTypesCsv,
  updateWorkCategory,
  updateWorkType,
} from "@/app/(app)/masters/work-types/actions";
import AutoDismissAlert from "@/components/AutoDismissAlert";
import LogArea from "@/components/LogArea";

type SearchParams = {
  error?: string;
  success?: string;
};

export default async function WorkTypesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const session = await getSession();
  if (!session || session.role === "guest") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">作業内容</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストユーザーは閲覧できません。
        </p>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [{ data: workCategories }, { data: workTypes }] = await Promise.all([
    supabase
      .from("work_categories")
      .select("id, name")
      .or("id_deleted.is.false,id_deleted.is.null")
      .order("name"),
    supabase
      .from("work_types")
      .select("id, name, category_id")
      .or("id_deleted.is.false,id_deleted.is.null")
      .order("name"),
  ]);
  const categoryNameMap = new Map(
    (workCategories ?? []).map((category) => [category.id, category.name])
  );
  const sortedWorkTypes = (workTypes ?? []).toSorted((a, b) => {
    const aCategory = categoryNameMap.get(a.category_id ?? "") ?? "";
    const bCategory = categoryNameMap.get(b.category_id ?? "") ?? "";
    const categoryCompare = aCategory.localeCompare(bCategory, "ja");
    if (categoryCompare !== 0) {
      return categoryCompare;
    }
    return a.name.localeCompare(b.name, "ja");
  });
  const errorMessage = resolvedParams?.error
    ? decodeURIComponent(resolvedParams.error)
    : null;
  const successMessage = resolvedParams?.success?.startsWith("imported:")
    ? `作業内容を${resolvedParams.success.split(":")[1] ?? "0"}件取り込みました。`
    : resolvedParams?.success === "created"
      ? "作業内容を登録しました。"
      : resolvedParams?.success === "restored"
        ? "作業内容を復活しました。"
        : resolvedParams?.success === "categoryCreated"
          ? "カテゴリを登録しました。"
          : resolvedParams?.success === "categoryRestored"
            ? "カテゴリを復活しました。"
        : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">作業内容</h1>
        <p className="text-sm text-zinc-600">
          作業カテゴリと作業内容の候補を管理します。
        </p>
      </div>
      <LogArea>
        {(errorMessage || successMessage) && (
          <AutoDismissAlert
            message={errorMessage ?? successMessage ?? ""}
            tone={errorMessage ? "error" : "success"}
          />
        )}
      </LogArea>

      <form action={createWorkCategory} className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">カテゴリ新規登録</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            name="name"
            placeholder="カテゴリ名"
            className="min-w-[240px] rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-zinc-800 active:scale-95"
          >
            登録
          </button>
        </div>
      </form>

      <form
        action={importWorkTypesCsv}
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4"
      >
        <div>
          <h2 className="text-lg font-semibold">CSV一括登録</h2>
          <p className="text-sm text-zinc-500">
            形式: カテゴリ名,作業内容
          </p>
        </div>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-zinc-800 active:scale-95"
        >
          一括登録
        </button>
        <a
          href="/api/masters/work-types/template"
          className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
        >
          CSVテンプレート
        </a>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2">カテゴリ名</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {workCategories?.map((category) => (
              <tr key={category.id} className="border-t">
                <td className="px-4 py-2">
                  <form id={`category-${category.id}`} action={updateWorkCategory}>
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input
                      name="name"
                      defaultValue={category.name}
                      className="w-full rounded border border-zinc-300 px-2 py-1"
                    />
                  </form>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      form={`category-${category.id}`}
                      className="rounded border border-zinc-300 px-3 py-1 text-xs transition-all duration-150 ease-out hover:bg-zinc-100 active:scale-95"
                    >
                      更新
                    </button>
                    <form action={deleteWorkCategory}>
                      <input
                        type="hidden"
                        name="categoryId"
                        value={category.id}
                      />
                      <button
                        type="submit"
                        className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 transition-all duration-150 ease-out hover:bg-red-50 active:scale-95"
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

      <div className="border-t border-zinc-200 pt-4">
        <h2 className="text-base font-semibold text-zinc-700">作業内容</h2>
      </div>

      <form action={createWorkType} className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold">作業内容新規登録</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            name="categoryId"
            className="min-w-[200px] rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          >
            <option value="">カテゴリ</option>
            {workCategories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            name="name"
            placeholder="作業内容"
            className="min-w-[240px] rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-zinc-800 active:scale-95"
          >
            登録
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2">カテゴリ</th>
              <th className="px-4 py-2">作業内容</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedWorkTypes.map((workType) => (
              <tr key={workType.id} className="border-t">
                <td className="px-4 py-2">
                  <form id={`worktype-${workType.id}`} action={updateWorkType}>
                    <input type="hidden" name="workTypeId" value={workType.id} />
                  </form>
                  <select
                    name="categoryId"
                    defaultValue={workType.category_id ?? ""}
                    className="rounded border border-zinc-300 px-2 py-1"
                    form={`worktype-${workType.id}`}
                  >
                    <option value="">-</option>
                    {workCategories?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    name="name"
                    defaultValue={workType.name}
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                    form={`worktype-${workType.id}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      form={`worktype-${workType.id}`}
                      className="rounded border border-zinc-300 px-3 py-1 text-xs transition-all duration-150 ease-out hover:bg-zinc-100 active:scale-95"
                    >
                      更新
                    </button>
                    <form action={deleteWorkType}>
                      <input type="hidden" name="workTypeId" value={workType.id} />
                      <button
                        type="submit"
                        className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 transition-all duration-150 ease-out hover:bg-red-50 active:scale-95"
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
