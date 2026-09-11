"use client";

import { useState } from "react";
import { formatDate, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

interface ArticleRow {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  author: string;
  date: string;
  readingTimeMinutes: number;
  heroImage: string;
  heroAlt: string;
  body: string[];
  relatedSlugs: string[];
  published: boolean;
}

type Draft = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  author: string;
  date: string;
  readingTimeMinutes: string;
  heroImage: string;
  heroAlt: string;
  body: string;
  relatedSlugs: string;
  published: boolean;
};

function toDraft(a?: ArticleRow): Draft {
  return {
    slug: a?.slug ?? "",
    title: a?.title ?? "",
    category: a?.category ?? "Camera Guides",
    excerpt: a?.excerpt ?? "",
    author: a?.author ?? "Biên tập Lumina Journal",
    date: a ? a.date.slice(0, 16) : "",
    readingTimeMinutes: String(a?.readingTimeMinutes ?? 5),
    heroImage: a?.heroImage ?? "",
    heroAlt: a?.heroAlt ?? "",
    body: (a?.body ?? []).join("\n\n"),
    relatedSlugs: (a?.relatedSlugs ?? []).join(", "),
    published: a?.published ?? false,
  };
}

/** Quản trị nội dung: banner site + bài journal (nháp/xuất bản). */
export function ContentAdmin({
  initialArticles,
  initialSettings,
}: {
  initialArticles: ArticleRow[];
  initialSettings: Record<string, string>;
}) {
  const [articles, setArticles] = useState(initialArticles);
  const [settings, setSettings] = useState(initialSettings);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const set = (key: keyof Draft, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const saveSettings = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const key of ["announcement.enabled", "announcement.text", "announcement.link"]) {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: settings[key] ?? "" }),
        });
        if (!res.ok) throw new Error("Lưu banner thất bại.");
      }
      setMessage("Đã lưu banner site.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const saveArticle = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        slug: draft.slug,
        title: draft.title,
        category: draft.category,
        excerpt: draft.excerpt,
        author: draft.author,
        date: draft.date ? new Date(draft.date).toISOString() : undefined,
        readingTimeMinutes: Number(draft.readingTimeMinutes),
        heroImage: draft.heroImage,
        heroAlt: draft.heroAlt,
        body: draft.body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean),
        relatedSlugs: draft.relatedSlugs.split(",").map((s) => s.trim()).filter(Boolean),
        published: draft.published,
      };
      const url = editing ? `/api/admin/articles/${editing}` : "/api/admin/articles";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Lưu bài viết thất bại.");
        return;
      }
      setMessage(editing ? "Đã cập nhật bài viết." : "Đã tạo bài viết.");
      setEditing(null);
      setDraft(toDraft());
      const list = await fetch("/api/admin/articles").then((r) => r.json());
      setArticles(list.articles ?? []);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slug: string, title: string) => {
    if (!window.confirm(`Xóa bài "${title}"? Hành động này không thể hoàn tác.`)) return;
    const res = await fetch(`/api/admin/articles/${slug}`, { method: "DELETE" });
    if (res.ok) {
      setArticles((prev) => prev.filter((a) => a.slug !== slug));
      setMessage("Đã xóa bài viết.");
    } else {
      setError("Xóa bài viết thất bại.");
    }
  };

  const field = (label: string, key: keyof Draft, opts?: { wide?: boolean; type?: string }) => (
    <div className={cn("flex flex-col gap-space-2xs", opts?.wide && "sm:col-span-2")}>
      <label htmlFor={`c-${key}`} className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{label}</label>
      <input
        id={`c-${key}`}
        type={opts?.type ?? "text"}
        value={draft[key] as string}
        disabled={key === "slug" && editing !== null}
        onChange={(e) => set(key, e.target.value)}
        className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">CONTENT OPS</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Quản Trị Nội Dung</h1>
      </header>

      {message && <p className="rounded-lg bg-surface-container-low p-space-sm font-body-sm text-body-sm text-primary" role="status">{message}</p>}
      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{error}</p>}

      <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl" aria-label="Banner site">
        <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Banner Toàn Site</h2>
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="banner-text" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Nội dung banner</label>
            <input
              id="banner-text"
              value={settings["announcement.text"] ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, "announcement.text": e.target.value }))}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="banner-link" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Link khi bấm</label>
            <input
              id="banner-link"
              value={settings["announcement.link"] ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, "announcement.link": e.target.value }))}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
          <input
            type="checkbox"
            checked={settings["announcement.enabled"] === "true"}
            onChange={(e) => setSettings((s) => ({ ...s, "announcement.enabled": e.target.checked ? "true" : "false" }))}
            className="h-4 w-4 accent-primary"
          />
          Hiển thị banner
        </label>
        <button
          type="button"
          onClick={saveSettings}
          disabled={busy}
          className="w-fit rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
        >
          {busy ? "Đang lưu…" : "Lưu banner"}
        </button>
      </section>

      <section className="flex flex-col gap-space-md" aria-label="Bài viết">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">Bài Viết ({articles.length})</h2>
          <button
            type="button"
            onClick={() => { setDraft(toDraft()); setEditing(null); setError(null); }}
            className="rounded-lg bg-primary px-space-md py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim"
          >
            + Bài mới
          </button>
        </div>

        <ul className="flex flex-col gap-space-sm">
          {articles.map((a) => (
            <li key={a.slug} className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container p-space-md shadow-xl">
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface">{a.title}</span>
                <span className="font-telemetry-xs text-telemetry-xs text-outline">
                  /{a.slug} • {formatDate(a.date)} • {a.published ? "Đã xuất bản" : "Nháp"}
                </span>
              </div>
              <div className="flex gap-space-xs">
                <button
                  type="button"
                  onClick={() => { setDraft(toDraft(a)); setEditing(a.slug); setError(null); window.scrollTo({ top: 0 }); }}
                  className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface transition-colors hover:bg-surface-container-highest"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => remove(a.slug, a.title)}
                  className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-error transition-colors hover:bg-error-container/20"
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl" aria-label="Form bài viết">
          <h3 className="font-headline-sm text-headline-sm uppercase text-on-surface">
            {editing ? `Sửa: ${editing}` : "Bài viết mới"}
          </h3>
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            {field("Tiêu đề", "title", { wide: true })}
            {field("Slug", "slug")}
            {field("Chuyên mục", "category")}
            {field("Tác giả", "author")}
            {field("Ngày đăng", "date", { type: "datetime-local" })}
            {field("Phút đọc", "readingTimeMinutes", { type: "number" })}
            {field("Ảnh hero (URL)", "heroImage", { wide: true })}
            {field("Alt ảnh", "heroAlt", { wide: true })}
            {field("Tóm tắt", "excerpt", { wide: true })}
            {field("Slug SP liên quan (phẩy)", "relatedSlugs", { wide: true })}
          </div>
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="c-body" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Nội dung (mỗi đoạn cách nhau 1 dòng trống)</label>
            <textarea
              id="c-body"
              rows={8}
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => set("published", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Xuất bản (hiện trên Journal + sitemap)
          </label>
          <button
            type="button"
            onClick={saveArticle}
            disabled={busy}
            className="flex w-fit items-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
          >
            {busy && <Spinner className="border-on-primary border-t-transparent" />}
            Lưu bài viết
          </button>
        </div>
      </section>
    </div>
  );
}
