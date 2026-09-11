import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { getSessionUser } from "@/lib/server/session";
import { logAudit } from "@/lib/server/audit";

/**
 * GET  /api/admin/settings — toàn bộ cấu hình site.
 * PUT  /api/admin/settings { key, value } — chỉ key trong whitelist.
 */
const ALLOWED_KEYS = ["announcement.enabled", "announcement.text", "announcement.link"] as const;

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const settings = await prisma.siteSetting.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const key = String(body.key ?? "");
  const value = String(body.value ?? "").slice(0, 500);
  if (!(ALLOWED_KEYS as readonly string[]).includes(key)) {
    return NextResponse.json({ error: "Key cấu hình không được phép." }, { status: 422 });
  }
  if (key === "announcement.enabled" && value !== "true" && value !== "false") {
    return NextResponse.json({ error: "announcement.enabled phải là true/false." }, { status: 422 });
  }
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  await logAudit(await getSessionUser(), "setting.updated", "setting", key, { value: value.slice(0, 80) });
  return NextResponse.json({ ok: true, key, value });
}
