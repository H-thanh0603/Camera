/**
 * Seed: chép catalogue từ seed file vào DB (upsert — chạy lại an toàn)
 * + tạo tài khoản admin mặc định cho đồ án.
 *
 * Chạy: npx prisma db seed
 * Đăng nhập admin: admin@lumina.vn / ADMIN_PASSWORD (mặc định admin-lumina-2026)
 */

import { Prisma } from "../src/generated/prisma/client";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { products } from "../src/lib/data/products";
import { articles } from "../src/lib/data/articles";
import { buildSearchText } from "../src/lib/server/product-search-pg";
import { prisma } from "../src/lib/server/prisma";
const scryptAsync = promisify(scrypt) as (p: string | Buffer, s: string | Buffer, k: number) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function main() {
  for (const p of products) {
    // reviews tĩnh không seed vào DB (DB chỉ lưu review người dùng gửi, có moderation)
  const { variants, reviews, images, thumbnail, specifications, tags, badges, highlights, inTheBox, compatibleWith, ...rest } = p;
  void reviews;
    // rating/reviewCount của seed là nền BẤT BIẾN cho aggregate (chống drift)
    const seedFields = { seedCount: p.reviewCount, seedTotal: p.rating * p.reviewCount };
    const tagString = `|${p.tags.map((t) => t.trim().toLowerCase()).join("|")}|`;
    const searchText = buildSearchText({ name: p.name, brand: p.brand, subcategory: p.subcategory, sku: p.sku, tags: p.tags });
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        ...rest,
        ...seedFields,
        tagString,
        searchText,
        images: images as unknown as object,
        thumbnail: thumbnail as unknown as object,
        specifications: specifications as object,
        tags: tags as unknown as object,
        badges: badges as unknown as object,
        highlights: (highlights ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        inTheBox: (inTheBox ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        compatibleWith: (compatibleWith ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
      create: {
        ...rest,
        ...seedFields,
        tagString,
        searchText,
        images: images as unknown as object,
        thumbnail: thumbnail as unknown as object,
        specifications: specifications as object,
        tags: tags as unknown as object,
        badges: badges as unknown as object,
        highlights: (highlights ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        inTheBox: (inTheBox ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        compatibleWith: (compatibleWith ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        variants: {
          create:
            variants?.map((v) => ({
              id: v.id,
              sku: v.sku,
              name: v.name,
              price: v.price,
              compareAtPrice: v.compareAtPrice ?? null,
              stock: v.stock,
              availability: v.availability,
              image: (v.image ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
            })) ?? [],
        },
      },
    });
  }
  console.log(`Seeded ${products.length} products.`);

  const adminEmail = "admin@lumina.vn";
  const adminPassword = process.env.ADMIN_PASSWORD;
  // Production: cấm seed mật khẩu mặc định (backdoor nếu quên env)
  if (process.env.NODE_ENV === "production" && !adminPassword) {
    throw new Error("ADMIN_PASSWORD là bắt buộc khi seed ở production.");
  }
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "admin" },
    create: {
      email: adminEmail,
      name: "Lumina Admin",
      passwordHash: await hashPassword(adminPassword ?? "admin-lumina-2026"),
      role: "admin",
    },
  });
  console.log(`Admin ready: ${adminEmail} (password từ ADMIN_PASSWORD hoặc mặc định)`);

  const coupons = [
    { code: "LUMINA10", kind: "percent", value: 10, minSubtotal: 5_000_000, maxUses: 500 },
    { code: "FREESHIP", kind: "fixed", value: 350_000, minSubtotal: 2_000_000, maxUses: 1000 },
    { code: "VIP500K", kind: "fixed", value: 500_000, minSubtotal: 20_000_000, maxUses: 200 },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { kind: c.kind, value: c.value, minSubtotal: c.minSubtotal, maxUses: c.maxUses, active: true },
      create: { ...c, active: true },
    });
  }
  console.log(`Seeded ${coupons.length} coupons.`);

  // Journal từ file seed → DB (admin sửa tiếp trên UI, public đọc published)
  for (const a of articles) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      update: {
        title: a.title,
        category: a.category,
        excerpt: a.excerpt,
        author: a.author,
        date: new Date(a.date),
        readingTimeMinutes: a.readingTimeMinutes,
        heroImage: a.heroImage,
        heroAlt: a.heroAlt,
        body: a.body as unknown as object,
        relatedSlugs: a.relatedProductSlugs as unknown as object,
        published: true,
      },
      create: {
        slug: a.slug,
        title: a.title,
        category: a.category,
        excerpt: a.excerpt,
        author: a.author,
        date: new Date(a.date),
        readingTimeMinutes: a.readingTimeMinutes,
        heroImage: a.heroImage,
        heroAlt: a.heroAlt,
        body: a.body as unknown as object,
        relatedSlugs: a.relatedProductSlugs as unknown as object,
        published: true,
      },
    });
  }
  console.log(`Seeded ${articles.length} articles.`);

  // Cấu hình site mặc định (banner tắt — admin bật trên UI khi cần)
  const settings: Record<string, string> = {
    "announcement.enabled": "false",
    "announcement.text": "ƯU ĐÃI CUỐI NĂM — GIẢM ĐẾN 15% LENS & PHỤ KIỆN ĐẾN 31/12",
    "announcement.link": "/products?tag=sale",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log(`Seeded ${Object.keys(settings).length} settings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
