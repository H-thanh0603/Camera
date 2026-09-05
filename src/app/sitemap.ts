import type { MetadataRoute } from "next";
import { dbAllProducts } from "@/lib/server/product-db";
import { articles } from "@/lib/data/articles";

// ISR: admin sửa giá/stock hiển thị trong ~30s
export const revalidate = 30;

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await dbAllProducts();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/journal`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/camera-finder`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/compare`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${siteUrl}/products/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${siteUrl}/journal/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...productRoutes, ...articleRoutes];
}
