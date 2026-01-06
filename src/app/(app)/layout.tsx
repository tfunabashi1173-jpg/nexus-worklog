import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell role={session.role} username={session.username}>
      {children}
    </AppShell>
  );
}
