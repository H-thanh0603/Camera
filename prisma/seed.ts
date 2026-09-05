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
    const { variants, reviews, images, thumbnail, specifications, tags, badges, highlights, inTheBox, compatibleWith, ...rest } = p;
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        ...rest,
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
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin-lumina-2026";
  await prisma.user.upsert({
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
