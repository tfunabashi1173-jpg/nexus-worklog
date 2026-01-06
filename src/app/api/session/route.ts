import { NextResponse } from "next/server";
import { getSessionCookie } from "@/lib/session";

export async function GET() {
  const session = await getSessionCookie();
  if (!session) {
    return NextResponse.json({ session: null }, { status: 401 });
  }
  return NextResponse.json({ session });
}
