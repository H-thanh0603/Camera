/**
 * Seed: chép catalogue từ seed file vào DB (upsert — chạy lại an toàn)
 * + tạo tài khoản admin mặc định cho đồ án.
 *
 * Chạy: npx prisma db seed
 * Đăng nhập admin: admin@lumina.vn / ADMIN_PASSWORD (mặc định admin-lumina-2026)
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { products } from "../src/lib/data/products";

const prisma = new PrismaClient();
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
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        ...rest,
        ...seedFields,
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
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin-lumina-2026";  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "admin" },
    create: {
      email: adminEmail,
      name: "Lumina Admin",
      passwordHash: await hashPassword(adminPassword),
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
