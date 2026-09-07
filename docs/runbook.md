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
3. `npx prisma migrate deploy && npx prisma db seed`
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

## 3. Email (Resend)

- Chưa có `RESEND_API_KEY`: chế độ log — nội dung ghi ra logger, không gửi.
- Có key: gửi thật qua `api.resend.com` — xác nhận đơn (fire-and-forget
  trong `placeOrderServer`) + link reset mật khẩu (60 phút, dùng 1 lần).
- Verify domain gửi trong dashboard Resend trước khi mở bán.

## 4. Backup / Restore

- `npm run db:backup` — SQLite: copy file; Postgres: `pg_dump`. Giữ 7 bản
  (`--keep N`, `--dir ./backups`). Chạy cron mỗi đêm + trước mỗi deploy.
- Restore Postgres: `psql $DATABASE_URL < backups/lumina-....sql`.
- Drill restore 1 lần/tháng trên staging.

## 5. Rate limit / Đa instance

- Có `UPSTASH_*`: sliding-window Redis dùng chung mọi instance.
- Chưa có: fallback in-memory fail-open + warn (1 instance ok, đa instance yếu).
- Quên mật khẩu giới hạn 5 req/phút/IP; đặt hàng 10 req/phút/IP.

## 6. Giám sát

- Sentry server: set `SENTRY_DSN` (+ `SENTRY_AUTH_TOKEN/ORG/PROJECT` để upload
  sourcemap). Lỗi client chảy về `POST /api/metrics` → `logger.error` →
  Sentry, không tốn bundle (1.30/1.43 MB).
- Audit log: `order.placed/cancelled/paid_via_webhook`, `coupon.*`,
  `auth.password_reset_*` — xem ở admin dashboard.

## 7. Checklist bàn giao

- [ ] Env production đủ + health báo đúng cờ
- [ ] Migrate + seed chạy sạch, backup cron hoạt động, đã drill restore
- [ ] Webhook test với chữ ký thật (200 + deduped khi retry)
- [ ] Email xác nhận đơn đến tay, reset password end-to-end
- [ ] Sentry nhận event thử, uptime monitor xanh
- [ ] `npm run check:bundle` xanh, E2E xanh
