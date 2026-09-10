# Runbook vận hành production — LUMINA Optics

## 1. Deploy lần đầu (Vercel + Postgres)

1. Tạo Postgres (Supabase/Neon), lấy connection string `?sslmode=require`.
2. Cấu hình env (xem `.env.example`) — bắt buộc production:
   - `DATABASE_URL` (postgres), `ADMIN_PASSWORD` (≥ 12 ký tự),
   - `PAYMENT_DEMO_MODE="false"`, `NEXT_PUBLIC_PAYMENT_DEMO_MODE="false"`,
   - `PAYMENT_WEBHOOK_SECRET` (random ≥ 16 ký tự),
   - `RESEND_API_KEY` + `EMAIL_FROM`, `SENTRY_DSN`, `UPSTASH_REDIS_REST_URL/TOKEN`.
   - App **từ chối khởi động** nếu production mà demo payment còn bật
     (`src/lib/server/env.ts` throw) — kiểm tra bằng `GET /api/health`
     (`paymentDemoMode` phải `false`).
3. Schema lần đầu trên Postgres (đã drill 2026-09-10, xem
   `docs/backup-drill-log.md`): history migrations là SQLite-only nên
   **không** `migrate deploy` / **không** `db push` trực tiếp lên prod.
   Chạy `DATABASE_URL=... ADMIN_PASSWORD=... node scripts/db-pg-init.mjs --seed`
   (apply `prisma/postgres-baseline.sql` đã verify + `postgres-extensions.sql`
   + seed 18 SP/3 coupon; EXPLAIN dùng `Order_status_idx`, trigram hoạt động;
   CI job `postgres-check` khóa lại mỗi push). Verify thêm
   `DATABASE_URL=... npx tsx scripts/smoke-trigram.ts`.
   Từ sau lần này, mọi đổi schema phải là migration mới có review —
   cấm `db push` lên prod.
4. Gắn uptime monitor vào `GET /api/health` (200 = ok; 503 = DB down).
   Response còn báo `paymentWebhook/email/sentry/redis` đã cấu hình hay chưa.

## 2. Cổng thanh toán (webhook HMAC)

- Endpoint: `POST /api/payments/webhook`, header `x-payment-signature` =
  hex(HMAC-SHA256(raw body, PAYMENT_WEBHOOK_SECRET)).
- Body: `{ provider, eventId, orderNumber, amount, status: "paid"|"failed", timestamp }`
  (`timestamp` lệch tối đa 5 phút — chống replay).
- Server đối soát `amount` với totals đã tính, chỉ chuyển `pending → paid`;
  webhook gửi lại khi đơn đã ở trạng thái cuối → `{ deduped: true }`.
- VNPay/MoMo/Stripe: viết adapter nhỏ map callback của cổng về shape trên
  rồi ký lại bằng `PAYMENT_WEBHOOK_SECRET` (không forward chữ ký gốc).
- Xóa nút demo: đã tự ẩn khi `NEXT_PUBLIC_PAYMENT_DEMO_MODE=false`;
  endpoint `/pay-demo` trả 403 khi demo tắt.

## 3. Email (Resend + outbox bền vững)

- Mọi mail (xác nhận đơn, reset password, reward, kit-share) ghi vào bảng
  `EmailOutbox` TRONG tx nghiệp vụ — đơn commit thì mail không mất, kể cả
  khi Resend lỗi hoặc thiếu Redis. Dispatch inline best-effort sau commit.
- Worker `npm run worker:email` quét outbox DB (backoff tới 6h, giữ row dead
  sau 5 lần fail) + Redis fast-lane nếu có. Chạy như service riêng hoặc cron
  mỗi phút với `EMAIL_WORKER_MAX_JOBS`. Xem độ sâu ở `GET /api/admin/queue`.
- Chưa có `RESEND_API_KEY`: chế độ log — nội dung ghi ra logger, job đánh
  dấu sent (không retry vô ích). Có key: gửi thật qua `api.resend.com`.
- Verify domain gửi trong dashboard Resend trước khi mở bán.

## 4. Backup / Restore

- `npm run db:backup` — SQLite: copy file; Postgres: `pg_dump`. Giữ 7 bản
  (`--keep N`, `--dir ./backups`). Chạy cron mỗi đêm + trước mỗi deploy.
- Restore Postgres: `psql $DATABASE_URL < backups/lumina-....sql`.
- Drill restore 1 lần/tháng trên staging.

## 5. Rate limit / Đa instance

- Có `UPSTASH_*`: sliding-window Redis dùng chung mọi instance.
- Chưa có: fallback in-memory fail-open + warn (1 instance ok, đa instance yếu).
- Phủ limiter: login 10, register/forgot/reset 5, order/cancel/paydemo 10,
  review 5, coupon-validate 30, webhook 60 req/phút/IP.
- **Client IP** (`lib/server/client-ip.ts`): ưu tiên `cf-connecting-ip` /
  `x-real-ip` (edge đảm bảo); XFF chỉ tin entry phải-nhất khi
  `TRUST_PROXY_COUNT>0` (set `=1` ở prod sau 1 proxy). Self-host trần:
  chặn direct-origin ở firewall.

## 6. Giám sát & Alerting

- Sentry server: set `SENTRY_DSN` (+ `SENTRY_AUTH_TOKEN/ORG/PROJECT` để upload
  sourcemap). Lỗi client chảy về `POST /api/metrics` → `logger.error` →
  Sentry, không tốn bundle (1.30/1.43 MB).
- UptimeRobot (mỗi 5 phút): monitor `GET /api/health` với keyword `"db":"up"`;
  alert (Pager/Telegram/Slack) khi 503 hoặc mất keyword. Không monitor
  `/api/payments/webhook` từ ngoài (cần chữ ký — chỉ gây 401 noise).
- Sau mỗi deploy: `BASE_URL=... npm run smoke:prod` (health, demo-flag,
  catalogue, admin-403, webhook) — fail thì rollback trước khi mở traffic.
- Dọn session/token hết hạn: cron `npm run db:sweep` mỗi giờ (đã tách khỏi
  health để health read-only).
- Audit log: `order.placed/cancelled/paid_via_webhook`, `coupon.*`,
  `auth.password_reset_*` — xem ở admin dashboard.

## 7. Checklist bàn giao

- [ ] Env production đủ + health báo đúng cờ
- [ ] Migrate + seed chạy sạch, backup cron hoạt động, đã drill restore
- [ ] Webhook test với chữ ký thật (200 + deduped khi retry)
- [ ] Email xác nhận đơn đến tay, reset password end-to-end
- [ ] Sentry nhận event thử, uptime monitor xanh
- [ ] `npm run check:bundle` xanh, E2E xanh

## 8. Migration roadmap (khi cần scale)

| Phase | Trigger | Doc | Effort |
|-------|---------|-----|--------|
| 2.2 pg_trgm | ✅ implemented (SQLite fallback giữ nguyên) | `docs/migration-pg-trgm.md` | — |
| 2.3 S3/R2 | ✅ implemented (upload endpoint + admin UI; chưa sharp/seed-migrate) | `docs/migration-s3-r2-images.md` | — |
| 2.4 BullMQ | ✅ implemented (email queue Redis-list; chưa order-events) | `docs/migration-bullmq-queue.md` | — |
