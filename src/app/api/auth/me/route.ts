import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";

/** GET /api/auth/me — phiên hiện tại hoặc null. */

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}
