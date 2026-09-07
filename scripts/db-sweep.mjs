/**
 * Dọn session + reset-token hết hạn (tách khỏi /api/health để health
 * read-only). Chạy bằng cron mỗi giờ — xem scripts/backup.cron.example.
 * Dùng: DATABASE_URL=... node scripts/db-sweep.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const expired = { lt: new Date() };
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: expired } });
  const tokens = await prisma.passwordResetToken.deleteMany({ where: { expiresAt: expired } });
  console.log(
    JSON.stringify({
      level: "info",
      message: "auth.sweep_expired",
      sessions: sessions.count,
      tokens: tokens.count,
      timestamp: new Date().toISOString(),
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
