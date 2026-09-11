import { prisma } from "@/lib/server/prisma";
import { ContentAdmin } from "@/components/admin/content-admin";

export const metadata = { title: "Quản trị nội dung" };

export default async function AdminContentPage() {
  const [rows, settingsRows] = await Promise.all([
    prisma.article.findMany({ orderBy: { date: "desc" } }),
    prisma.siteSetting.findMany(),
  ]);
  const articles = rows.map((r) => ({
    ...r,
    date: r.date.toISOString(),
    body: (Array.isArray(r.body) ? r.body : []) as string[],
    relatedSlugs: (Array.isArray(r.relatedSlugs) ? r.relatedSlugs : []) as string[],
  }));
  const settings: Record<string, string> = {};
  for (const s of settingsRows) settings[s.key] = s.value;
  return <ContentAdmin initialArticles={articles} initialSettings={settings} />;
}
