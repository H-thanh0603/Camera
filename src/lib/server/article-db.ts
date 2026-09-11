import type { JournalArticle } from "@/lib/data/articles";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/** Journal từ DB — admin CRUD, public chỉ đọc published. */

type ArticleRow = Prisma.ArticleGetPayload<Record<string, never>>;

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function dbArticleToDomain(row: ArticleRow): JournalArticle {
  return {
    slug: row.slug,
    title: row.title,
    category: row.category,
    excerpt: row.excerpt,
    author: row.author,
    date: row.date.toISOString(),
    readingTimeMinutes: row.readingTimeMinutes,
    heroImage: row.heroImage,
    heroAlt: row.heroAlt,
    body: asStringList(row.body),
    relatedProductSlugs: asStringList(row.relatedSlugs),
  };
}

export async function dbPublishedArticles(): Promise<JournalArticle[]> {
  const rows = await prisma.article.findMany({
    where: { published: true },
    orderBy: { date: "desc" },
  });
  return rows.map(dbArticleToDomain);
}

export async function dbGetArticleBySlug(slug: string): Promise<JournalArticle | null> {
  const row = await prisma.article.findUnique({ where: { slug } });
  if (!row || !row.published) return null;
  return dbArticleToDomain(row);
}

export async function dbArticleSlugs(): Promise<string[]> {
  const rows = await prisma.article.findMany({
    where: { published: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}
