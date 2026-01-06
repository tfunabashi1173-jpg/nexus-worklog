import AttendanceForm from "@/components/AttendanceForm";
import { getSession, getUserSettings } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const session = await getSession();
  const settings = await getUserSettings();

  if (!session) {
    return null;
  }
  if (session.role === "guest" && !session.guestProjectId) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-2xl font-semibold">入場記録</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストURLからログインしてください。
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const guestProjectId = session.role === "guest" ? session.guestProjectId : null;
  const sitesQuery = supabase
    .from("projects")
    .select("project_id, site_name, start_date, end_date")
    .or("is_deleted.is.false,is_deleted.is.null")
    .order("site_name");

  if (guestProjectId) {
    sitesQuery.eq("project_id", guestProjectId);
  } else {
    sitesQuery.lte("start_date", today).gte("end_date", today);
  }

  const [
    { data: sites },
    { data: partners },
    { data: workers },
    { data: workCategories },
    { data: workTypes },
    { data: nexusUsers },
  ] =
    await Promise.all([
      sitesQuery,
      supabase
        .from("partners")
        .select("partner_id, name, default_work_category_id, show_in_attendance")
        .eq("category", "協力業者")
        .or("is_deleted.is.false,is_deleted.is.null")
        .order("partner_id"),
      supabase
        .from("workers")
        .select("id, name, contractor_id, last_entry_date")
        .or("id_deleted.is.false,id_deleted.is.null")
        .order("name"),
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
      supabase
        .from("users")
        .select("user_id, username, role")
        .or("is_deleted.is.false,is_deleted.is.null")
        .neq("role", "admin")
        .order("user_id"),
    ]);

  if (!sites || sites.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-2xl font-semibold">入場登録</h1>
        <p className="mt-2 text-sm text-zinc-600">
          現場が未登録です。管理者が現場を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">入場記録</h1>
        <p className="text-sm text-zinc-600">
          現場と日付を選択して入場した作業員を登録します。
        </p>
      </div>
      <AttendanceForm
        sites={sites ?? []}
        contractors={partners ?? []}
        workers={workers ?? []}
        workCategories={workCategories ?? []}
        workTypes={workTypes ?? []}
        nexusUsers={nexusUsers ?? []}
        defaultSiteId={
          session.role === "guest"
            ? session.guestProjectId ?? null
            : settings?.default_project_id ?? null
        }
        readOnly={session.role === "guest"}
      />
    </div>
  );
}
