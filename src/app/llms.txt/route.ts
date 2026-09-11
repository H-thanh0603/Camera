import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

/**
 * GET /llms.txt — file machine-readable cho AI agent / AI search.
 * Convention: https://llmstxt.org — tóm tắt site + link catalogue JSON.
 */
export const revalidate = 3600;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn";
  const rows = await prisma.product.findMany({
    select: { slug: true, name: true, brand: true, price: true, currency: true, availability: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const lines = [
    "# LUMINA Optics",
    "",
    "> Không gian trưng bày và phân phối máy ảnh flagship, medium format, ống kính cine và phụ kiện cao cấp.",
    "> Giá VND, kiểm chuẩn collimator, bảo hành 5 năm tận nơi.",
    "",
    "## Catalogue API (machine-readable)",
    "",
    `- Catalogue JSON: ${siteUrl}/api/catalog`,
    `- Catalogue phân trang: ${siteUrl}/api/catalog?page=2&pageSize=100 (tối đa 200/trang)`,
    `- Tìm kiếm + phân trang: ${siteUrl}/api/products?q=&brand=&category=&sort=&page=`,
    `- Sitemap: ${siteUrl}/sitemap.xml`,
    "",
    "## Quy tắc cho agent",
    "",
    "- Giá/stock chỉ mang tính tham khảo tại thời điểm đọc; xác nhận lại ở trang sản phẩm trước khi báo giá.",
    "- Không tự ý đặt hàng / thanh toán thay người dùng; mọi action consequential cần human approval.",
    "- Trang không index (giỏ/checkout/tài khoản): không crawl.",
    "",
    "## Sản phẩm",
    "",
  ];
  for (const p of rows) {
    lines.push(`- [${p.name} — ${p.brand} — ${p.price.toLocaleString("vi-VN")} ${p.currency} — ${p.availability}](${siteUrl}/products/${p.slug})`);
  }
  lines.push("");

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
