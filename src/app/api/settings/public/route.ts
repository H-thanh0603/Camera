import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

/** GET /api/settings/public — cấu hình công khai cho storefront (banner…). */
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ["announcement.enabled", "announcement.text", "announcement.link"] } },
  });
  const get = (key: string) => rows.find((r) => r.key === key)?.value ?? "";
  const enabled = get("announcement.enabled") === "true";
  const text = get("announcement.text").trim();
  return NextResponse.json(
    { announcement: enabled && text ? { text, link: get("announcement.link").trim() || "/" } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
