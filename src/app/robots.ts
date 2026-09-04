import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Trang cá nhân / giao dịch không cần index
      disallow: ["/cart", "/checkout", "/account", "/wishlist", "/compare"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
