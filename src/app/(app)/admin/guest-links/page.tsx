import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GuestLinkForm from "@/app/(app)/admin/guest-links/GuestLinkForm";

export default async function GuestLinksPage() {
  const session = await getSession();
  if (!session || session.role === "guest") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">ゲストURL</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストユーザーは閲覧できません。
        </p>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  await supabase.from("guest_links").delete().lt("expires_at", today);
  const { data: sites } = await supabase
    .from("projects")
    .select("project_id, site_name, start_date, end_date")
    .or("is_deleted.is.false,is_deleted.is.null")
    .order("site_name");

  const { data: guestLinks } = await supabase
    .from("guest_links")
    .select("token, project_id, created_at, expires_at, projects(site_name)")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const normalizedGuestLinks =
    (
      guestLinks as
        | Array<{
            token: string;
            project_id: string;
            expires_at: string | null;
            projects: { site_name: string } | { site_name: string }[] | null;
          }>
        | null
    )?.map((link) => ({
      token: link.token,
      projectId: link.project_id,
      siteName: Array.isArray(link.projects)
        ? link.projects[0]?.site_name ?? link.project_id
        : link.projects?.site_name ?? link.project_id,
      expiresAt: link.expires_at,
    })) ?? [];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ゲストURL</h1>
        <p className="text-sm text-zinc-600">
          指定した現場のみ閲覧可能なゲストURLを発行します。
        </p>
      </div>
      <GuestLinkForm
        sites={sites ?? []}
        baseUrl={baseUrl}
        links={normalizedGuestLinks}
      />
    </div>
  );
}
