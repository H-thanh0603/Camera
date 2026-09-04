import type { Metadata } from "next";
import Link from "next/link";
import { articles } from "@/lib/data/articles";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Lumina Journal — Camera Guides, Reviews & Buying Guides",
  description: "Tạp chí điện ảnh và nhiếp ảnh của Lumina Optics: hướng dẫn chọn máy, đánh giá ống kính, kiến thức quang học chuyên sâu.",
};

export default function JournalPage() {
  const [featured, ...rest] = articles;

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">EDITORIAL • PHOTOGRAPHY MAGAZINE</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Lumina Journal</h1>
        <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
          Camera guides, buying guides và photography stories từ những người làm hình ảnh thực chiến.
        </p>
      </header>

      <Link
        href={`/journal/${featured.slug}`}
        className="group relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-xl shadow-xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={featured.heroImage} alt={featured.heroAlt} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-space-xs p-space-xl">
          <span className="w-fit rounded-lg bg-primary/90 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase text-on-primary">{featured.category}</span>
          <h2 className="max-w-2xl font-headline-lg text-headline-lg-mobile text-on-surface lg:text-headline-lg">{featured.title}</h2>
          <p className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant">
            {featured.author} • {formatDate(featured.date)} • {featured.readingTimeMinutes} phút đọc
          </p>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-space-xl md:grid-cols-2">
        {rest.map((article) => (
          <Link key={article.slug} href={`/journal/${article.slug}`} className="group flex flex-col overflow-hidden rounded-xl bg-surface-container shadow-xl transition-shadow hover:shadow-[0_16px_48px_rgba(242,202,80,0.12)]">
            <div className="aspect-[16/9] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.heroImage} alt={article.heroAlt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="flex flex-col gap-space-xs p-space-lg">
              <span className="w-fit rounded bg-primary/20 px-space-xs py-0.5 font-telemetry-xs text-telemetry-xs font-bold uppercase text-primary">{article.category}</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface transition-colors group-hover:text-primary">{article.title}</h2>
              <p className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{article.excerpt}</p>
              <p className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-outline">
                {article.author} • {formatDate(article.date)} • {article.readingTimeMinutes} phút đọc
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
