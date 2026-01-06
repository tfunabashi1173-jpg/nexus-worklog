import { redirect } from "next/navigation";
import LoginForm from "@/app/(auth)/login/LoginForm";
import { getSession } from "@/lib/auth";

type SearchParams = {
  guest?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  const resolvedParams = await Promise.resolve(searchParams);
  const guestToken = resolvedParams?.guest?.trim() ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">ログイン</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ログインIDとパスワードを入力してください。
        </p>
        <LoginForm guestToken={guestToken} />
      </div>
    </div>
  );
}
