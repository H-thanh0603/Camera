/**
 * Dọn rác DB (tách khỏi /api/health để health read-only).
 * Chạy bằng cron mỗi giờ — xem scripts/backup.cron.example.
 * Dùng: DATABASE_URL=... npx tsx scripts/db-sweep.ts
 *
 * - Session + reset-token hết hạn (auth).
 * - TotpChallenge đã dùng/hết hạn (2FA, 5 phút TTL — không để phình).
 * - EmailOutbox đã gửi >30 ngày (giữ log vừa đủ truy vết).
 * - EmailOutbox dead (hết lượt) >90 ngày (giữ lâu để operator xử lý tay).
 * KHÔNG dọn: orders/reviews/audit/payment events (kế toán + pháp lý).
 */
import { prisma } from "../src/lib/server/prisma";

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 3600_000);
// Đồng bộ tay với OUTBOX_MAX_ATTEMPTS trong src/lib/server/email-outbox.ts
const OUTBOX_MAX_ATTEMPTS = 5;

async function main() {
  const expired = { lt: new Date() };
  const [sessions, tokens, challenges, outboxSent, outboxDead] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: expired } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: expired } }),
    prisma.totpChallenge.deleteMany({
      where: { OR: [{ expiresAt: expired }, { usedAt: { lt: daysAgo(1) } }] },
    }),
    prisma.emailOutbox.deleteMany({
      where: { sentAt: { lt: daysAgo(30) } },
    }),
    prisma.emailOutbox.deleteMany({
      where: { sentAt: null, attempts: { gte: OUTBOX_MAX_ATTEMPTS }, nextRunAt: { lt: daysAgo(90) } },
    }),
  ]);
  console.log(
    JSON.stringify({
      level: "info",
      message: "db.sweep",
      sessions: sessions.count,
      tokens: tokens.count,
      challenges: challenges.count,
      outboxSent: outboxSent.count,
      outboxDead: outboxDead.count,
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
