import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { revalidatePath } from "next/cache";
import { adminGuardResponse } from "@/lib/server/admin";
import { getSessionUser } from "@/lib/server/session";
import { logAudit } from "@/lib/server/audit";

/** PUT /api/admin/articles/:slug — sửa (slug bất biến). DELETE — xóa. */

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const { slug } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const title = String(body.title ?? "").trim();
  if (title.length < 2) return NextResponse.json({ error: "Tiêu đề bắt buộc." }, { status: 422 });
  const toList = (input: unknown, maxItems: number, maxLen: number): string[] =>
    Array.isArray(input)
      ? input
          .filter((v): v is string => typeof v === "string")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.slice(0, maxLen))
          .slice(0, maxItems)
      : [];
  const bodyList = toList(body.body, 50, 2000);
  if (bodyList.length === 0) return NextResponse.json({ error: "Nội dung cần ít nhất 1 đoạn." }, { status: 422 });
  const dateRaw = String(body.date ?? "").trim();
  const date = dateRaw ? new Date(dateRaw) : undefined;
  if (date && Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Ngày đăng không hợp lệ." }, { status: 422 });
  }
  const readingTime = Number(body.readingTimeMinutes);
  try {
    const row = await prisma.article.update({
      where: { slug },
      data: {
        title,
        category: String(body.category ?? "Camera Guides").trim().slice(0, 60) || "Camera Guides",
        excerpt: String(body.excerpt ?? "").trim().slice(0, 300),
        author: String(body.author ?? "").trim().slice(0, 120) || "Biên tập Lumina Journal",
        ...(date ? { date } : {}),
        readingTimeMinutes: Number.isInteger(readingTime) && readingTime > 0 ? readingTime : 5,
        heroImage: String(body.heroImage ?? "").slice(0, 500),
        heroAlt: String(body.heroAlt ?? "").slice(0, 200),
        body: bodyList,
        relatedSlugs: toList(body.relatedSlugs, 10, 64),
        published: body.published === true,
      },
    });
    revalidatePath("/journal", "layout");
    await logAudit(await getSessionUser(), "article.updated", "article", slug, { title });
    return NextResponse.json({ ok: true, updatedAt: row.updatedAt.toISOString() });
  } catch {
    return NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const { slug } = await params;
  try {
    await prisma.article.delete({ where: { slug } });
    revalidatePath("/journal", "layout");
    await logAudit(await getSessionUser(), "article.deleted", "article", slug, {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
  }
}
