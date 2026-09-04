import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton — tránh mở nhiều connection khi Next hot-reload trong dev.
 * SQLite (dev/demo); deploy Postgres chỉ cần đổi DATABASE_URL.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
