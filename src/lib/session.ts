import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "session";
const SESSION_TTL_DAYS = 30;

export type SessionData = {
  userId: string;
  username: string | null;
  role: "admin" | "user" | "guest";
  guestProjectId?: string | null;
  guestToken?: string | null;
  guestCanEdit?: boolean;
  exp: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is missing.");
  }
  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = `${padded}${"=".repeat(padLength)}`;
  return Buffer.from(normalized, "base64").toString("utf8");
}

function sign(payload: string) {
  const secret = getSecret();
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function createSessionCookie({
  userId,
  username,
  role,
  guestProjectId,
  guestToken,
  guestCanEdit,
}: {
  userId: string;
  username: string | null;
  role: "admin" | "user" | "guest";
  guestProjectId?: string | null;
  guestToken?: string | null;
  guestCanEdit?: boolean;
}) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 24 * 60 * 60;
  const payload: SessionData = {
    userId,
    username,
    role,
    guestProjectId: guestProjectId ?? null,
    guestToken: guestToken ?? null,
    guestCanEdit: Boolean(guestCanEdit),
    exp,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  const cookieStore = await cookies();

  cookieStore.set({
    name: COOKIE_NAME,
    value: `${encoded}.${signature}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionCookie(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = sign(encoded);
  const signatureOk =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!signatureOk) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encoded)) as SessionData;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
