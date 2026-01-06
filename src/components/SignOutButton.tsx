import { logout } from "@/app/(app)/actions";

export default function SignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100"
      >
        ログアウト
      </button>
    </form>
  );
}
