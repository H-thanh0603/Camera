# Runbook vận hành production — LUMINA Optics

## 1. Deploy lần đầu (Vercel + Postgres)

1. Tạo Postgres (Supabase/Neon), lấy connection string `?sslmode=require`.
2. Cấu hình env (xem `.env.example`) — bắt buộc production:
   - `DATABASE_URL` (postgres), `ADMIN_PASSWORD` (≥ 12 ký tự),
   - `VNPAY_TMN_CODE` + `VNPAY_HASH_SECRET` (sandbox khi chưa có keys thật),
   - `RESEND_API_KEY` + `EMAIL_FROM`, `SENTRY_DSN`, `UPSTASH_REDIS_REST_URL/TOKEN`.
   - App **từ chối khởi động** nếu production mà thiếu VNPay keys
     (`src/lib/server/env.ts` throw) — kiểm tra bằng `GET /api/health`
     (`paymentVnpay` phải `true`, `ready` phải `true`).
3. Schema lần đầu trên Postgres (đã drill 2026-09-10 và 2026-09-11 Prisma 7,
   xem `docs/backup-drill-log.md`): history migrations là SQLite-only nên
   **không** `migrate deploy` / **không** `db push` trực tiếp lên prod.
   Chạy `DATABASE_URL=... ADMIN_PASSWORD=... node scripts/db-pg-init.mjs --seed`
   (apply `prisma/postgres-baseline.sql` đã verify + `postgres-extensions.sql`
   + seed 18 SP/3 coupon; EXPLAIN dùng `Order_status_idx`, trigram hoạt động;
   CI job `postgres-check` khóa lại mỗi push). Verify thêm
   `DATABASE_URL=... npx tsx scripts/smoke-trigram.ts`.
   Từ sau lần này, mọi đổi schema phải là migration mới có review —
   cấm `db push` lên prod.
   Prisma 7 notes: CLI đọc URL từ `prisma.config.ts` (cần `dotenv`);
   `db push`/`migrate dev` không tự generate/seed nữa — chạy `prisma generate`
   + `prisma db seed` tường minh sau đó. Pool PG qua driver (`connectionTimeout` 5s
   trong `src/lib/server/prisma.ts`); Supabase/Neon dùng pooled URL.
4. Gắn uptime monitor vào `GET /api/health` (200 = ok; 503 = DB down).
   Response còn báo `paymentWebhook/email/sentry/redis` đã cấu hình hay chưa.

## 2. Cổng thanh toán (VNPay — đã thay pay-demo từ 2026-09-11)

- Checkout phương thức `vnpay` → `POST /api/orders/:id/vnpay-url` trả URL
  sandbox/prod (`vnp_TxnRef` = mã đơn `LUM-...`, amount = totals.total).
- IPN server-to-server: `GET /api/payments/vnpay-ipn` verify HMAC-SHA512
  (đúng sample VNPay: sort + encodeURIComponent, `%20` → `+`), map về
  `PaymentWebhookInput` rồi tái dùng `handlePaymentWebhook` (dedupe theo
  `(vnpay, TxnRef:TransactionNo)` + đối soát tiền + claim `pending → paid`).
  Trả RspCode đúng spec: `00` nhận, `97` sai checksum, `01` không tìm đơn,
  `04` sai số tiền, `02` đơn đã xác nhận, `99` lỗi khác.
- Browser return: `GET /api/payments/vnpay-return` verify rồi redirect về
  `/account?pay=vnpay&order=&result=` (banner `VnpayNotice`). Trạng thái
  chuẩn vẫn do IPN quyết định — return URL chỉ để hiển thị.
- Endpoint generic `POST /api/payments/webhook` (HMAC-SHA256 + secret riêng)
  giữ lại dự phòng cho cổng khác; thiếu secret → 503 fail-closed.
- Lấy keys: VNPay Merchant Admin → Terminal (`VNPAY_TMN_CODE`) + Hash Secret
  (`VNPAY_HASH_SECRET`); prod đổi `VNPAY_PAY_URL` sang
  `https://www.vnpayment.vn/paymentv2/vpcpay.html`.

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

## 5. Rate limit / CSRF / Đa instance

- CSRF: mọi POST/PATCH/DELETE `/api/*` (trừ webhook HMAC + metrics) yêu cầu
  `Origin` (hoặc `Referer`) khớp host. Script/curl gọi API phải thêm
  `-H "Origin: https://shop.lumina.vn"`, nếu không nhận 403.


- Có `UPSTASH_*`: sliding-window Redis dùng chung mọi instance.
- Chưa có: fallback in-memory fail-open + warn (1 instance ok, đa instance yếu).
- Phủ limiter: login 10, register/forgot/reset 5, order/cancel/vnpay-url 10,
  review 5, coupon-validate 30, webhook/vnpay-ipn 60 req/phút/IP.
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

## 6b. Khôi phục 2FA (mất điện thoại)

- User thường: dùng 1 trong 8 mã dự phòng ở bước 2 (mỗi mã 1 lần).
- Admin mất cả backup: admin khác vào `/admin` → thu hồi phiên
  (`POST /api/admin/users/:id/revoke-sessions`), rồi reset trực tiếp DB:
  `UPDATE "User" SET "totpEnabled"=false, "totpSecret"=NULL,
  "totpBackupCodes"='[]' WHERE email='...';` — ghi audit tay (ai, khi nào,
  ticket nào). Dashboard cảnh báo admin chưa bật 2FA.

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
