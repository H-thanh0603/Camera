import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articles } from "@/lib/data/articles";
import { getProductBySlug } from "@/lib/repositories/product-repository";
import { ProductCard } from "@/components/product/product-card";
import { formatDate } from "@/lib/utils/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) return { title: "Bài viết không tồn tại" };
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      images: [{ url: article.heroImage, alt: article.heroAlt }],
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();

  const relatedProducts = article.relatedProductSlugs
    .map((s) => getProductBySlug(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const related = articles.filter((a) => a.slug !== article.slug);

  return (
    <article className="flex flex-col">
      <div className="relative flex min-h-[440px] flex-col justify-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={article.heroImage} alt={article.heroAlt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" aria-hidden="true" />
        <div className="container-page relative z-10 flex flex-col gap-space-xs pb-space-xl">
          <span className="w-fit rounded-lg bg-primary/90 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase text-on-primary">{article.category}</span>
          <h1 className="max-w-3xl font-headline-lg text-headline-lg-mobile text-on-surface lg:text-headline-lg">{article.title}</h1>
          <p className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant">
            {article.author} • {formatDate(article.date)} • {article.readingTimeMinutes} phút đọc
          </p>
        </div>
      </div>

      <div className="container-page flex flex-col gap-space-xl py-space-xl">
        <div className="mx-auto flex max-w-3xl flex-col gap-space-md">
          <p className="font-body-lg text-body-lg italic leading-relaxed text-primary">{article.excerpt}</p>
          {article.body.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="font-body-lg text-body-lg leading-relaxed text-on-surface-variant">{paragraph}</p>
          ))}
        </div>

        {relatedProducts.length > 0 && (
          <section className="flex flex-col gap-space-md" aria-label="Thiết bị liên quan trong bài">
            <span className="section-telemetry">GEAR TRONG BÀI</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Thiết Bị Liên Quan</h2>
            <div className="grid grid-cols-1 gap-space-xl md:grid-cols-2">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-space-md" aria-label="Bài viết liên quan">
          <span className="section-telemetry">TIẾP TỤC ĐỌC</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">Bài Viết Khác</h2>
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
            {related.map((a) => (
              <Link key={a.slug} href={`/journal/${a.slug}`} className="group flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-lg transition-colors hover:bg-surface-container-high">
                <span className="font-telemetry-xs text-telemetry-xs uppercase text-primary">{a.category}</span>
                <span className="font-headline-sm text-headline-sm text-on-surface transition-colors group-hover:text-primary">{a.title}</span>
                <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{formatDate(a.date)} • {a.readingTimeMinutes} phút đọc</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
