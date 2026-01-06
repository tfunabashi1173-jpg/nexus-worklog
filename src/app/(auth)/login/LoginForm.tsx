"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "@/app/(auth)/login/actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
    >
      {pending ? "処理中..." : "ログイン"}
    </button>
  );
}

export default function LoginForm({ guestToken }: { guestToken?: string | null }) {
  const [state, formAction] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {guestToken && <input type="hidden" name="guestToken" value={guestToken} />}
      <div>
        <label className="text-sm font-medium">ログインID</label>
        <input
          type="text"
          name="loginId"
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">パスワード</label>
        <div className="relative mt-1">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            className="w-full rounded border border-zinc-300 px-3 py-2 pr-10 text-sm"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-2 flex items-center text-zinc-500 hover:text-zinc-800"
            aria-label={showPassword ? "パスワードを非表示" : "パスワードを表示"}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-7.5a11.8 11.8 0 0 1 5.06-6.06" />
                <path d="M1 1l22 22" />
                <path d="M9.9 9.9a3 3 0 0 0 4.24 4.24" />
                <path d="M14.12 14.12 9.88 9.88" />
                <path d="M12 5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 0 1-4.38 5.2" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
