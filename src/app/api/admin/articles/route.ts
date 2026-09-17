import { NextResponse, type NextRequest } from "next/server";
import { adminRateLimit } from "@/lib/server/rate-limit-redis";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { getSessionUser } from "@/lib/server/session";
import { logAudit } from "@/lib/server/audit";
import { Prisma } from "@/generated/prisma/client";

/** GET /api/admin/articles — mọi bài (kể cả nháp). POST — tạo bài mới. */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Chỉ https:// hoặc / nội bộ, tối đa 500 ký tự (L6): chặn javascript:/data:
 * persist qua heroImage rồi render thành link/hình (stored XSS khi đổi render).
 */
function safeHttpUrl(input: unknown): string {
  const s = String(input ?? "").trim().slice(0, 500);
  if (!s) return "";
  return s.startsWith("https://") || s.startsWith("/") ? s : "";
}

function parseList(input: unknown, maxItems: number, maxLen: number): string[] | null {
  if (!Array.isArray(input)) return null;
  const out = input
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, maxLen))
    .slice(0, maxItems);
  return out;
}

function validateArticle(body: Record<string, unknown>): { error?: string; data?: Record<string, unknown> } {
  const slug = String(body.slug ?? "").trim();
  const title = String(body.title ?? "").trim();
  if (!SLUG_RE.test(slug)) return { error: "Slug chỉ gồm chữ thường, số và dấu gạch." };
  if (title.length < 2) return { error: "Tiêu đề bắt buộc." };
  const bodyList = parseList(body.body, 50, 2000);
  if (!bodyList || bodyList.length === 0) return { error: "Nội dung cần ít nhất 1 đoạn." };
  const related = parseList(body.relatedSlugs, 10, 64) ?? [];
  const dateRaw = String(body.date ?? "").trim();
  const date = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(date.getTime())) return { error: "Ngày đăng không hợp lệ." };
  const readingTime = Number(body.readingTimeMinutes);
  return {
    data: {
      slug,
      title,
      category: String(body.category ?? "Camera Guides").trim().slice(0, 60) || "Camera Guides",
      excerpt: String(body.excerpt ?? "").trim().slice(0, 300),
      author: String(body.author ?? "Biên tập Lumina Journal").trim().slice(0, 120),
      date,
      readingTimeMinutes: Number.isInteger(readingTime) && readingTime > 0 ? readingTime : 5,
      heroImage: safeHttpUrl(body.heroImage),
      heroAlt: String(body.heroAlt ?? "").slice(0, 200),
      body: bodyList as unknown as Prisma.InputJsonValue,
      relatedSlugs: related as unknown as Prisma.InputJsonValue,
      published: body.published === true,
    },
  };
}

export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const rows = await prisma.article.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json({
    articles: rows.map((r) => ({ ...r, date: r.date.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
  });
}

export async function POST(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const limited = await adminRateLimit(request, "articles-post");
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const { error, data } = validateArticle(body);
  if (error || !data) return NextResponse.json({ error }, { status: 422 });
  try {
    const row = await prisma.article.create({ data: data as Prisma.ArticleUncheckedCreateInput });
    revalidatePath("/journal", "layout");
    await logAudit(await getSessionUser(), "article.created", "article", row.slug, { title: row.title });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Slug đã tồn tại." }, { status: 409 });
    }
    throw e;
  }
}
