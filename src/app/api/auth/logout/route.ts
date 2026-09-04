import { NextResponse } from "next/server";
import { destroySession } from "@/lib/server/session";

/** POST /api/auth/logout — xóa phiên DB + cookie. */

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
