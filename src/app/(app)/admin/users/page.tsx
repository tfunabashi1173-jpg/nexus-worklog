import { getSession, requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUser, deleteUser, updateUser } from "@/app/(app)/admin/users/actions";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || session.role === "guest") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">ユーザー管理</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストユーザーは閲覧できません。
        </p>
      </div>
    );
  }

  const adminProfile = await requireAdmin();

  if (!adminProfile) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">ユーザー管理</h1>
        <p className="mt-2 text-sm text-zinc-600">
          このページは管理者のみ利用できます。
        </p>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: users } = await supabase
    .from("users")
    .select("user_id, username, role")
    .or("is_deleted.is.false,is_deleted.is.null")
    .order("user_id");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ユーザー管理</h1>
        <p className="text-sm text-zinc-600">新規作成・更新・削除ができます。</p>
      </div>

      <form action={createUser} className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">新規ユーザー</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input
            name="loginId"
            placeholder="ログインID"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="password"
            placeholder="初期パスワード"
            type="password"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="displayName"
            placeholder="表示名"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            name="role"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            defaultValue="user"
          >
            <option value="user">一般</option>
            <option value="admin">管理者</option>
          </select>
        </div>
        <button
          type="submit"
          className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          作成
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2">ログインID</th>
              <th className="px-4 py-2">表示名</th>
              <th className="px-4 py-2">権限</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.user_id} className="border-t">
                <td className="px-4 py-2">{user.user_id}</td>
                <td className="px-4 py-2">
                  <form id={`update-${user.user_id}`} action={updateUser}>
                    <input type="hidden" name="userId" value={user.user_id} />
                    <input
                      name="displayName"
                      defaultValue={user.username ?? ""}
                      className="w-full rounded border border-zinc-300 px-2 py-1"
                    />
                  </form>
                </td>
                <td className="px-4 py-2">
                  <select
                    name="role"
                    defaultValue={user.role === "admin" ? "admin" : "user"}
                    className="rounded border border-zinc-300 px-2 py-1"
                    form={`update-${user.user_id}`}
                  >
                    <option value="user">一般</option>
                    <option value="admin">管理者</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      form={`update-${user.user_id}`}
                      className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100"
                    >
                      更新
                    </button>
                    <form action={deleteUser}>
                    <input type="hidden" name="userId" value={user.user_id} />
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
