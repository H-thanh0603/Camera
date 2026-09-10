# Mở rộng & giới hạn chịu tải — LUMINA Optics

Baseline đo 2026-09-10 (máy dev, SQLite, build production): 50 VUs đọc + 1 VU
ghi, 9382 req/60s, **0 lỗi, p95 18.8ms** (`docs/performance-baseline.md`).
Số dưới đây là trần kiến trúc, không phải benchmark.

## Cái gì stateless sẵn (scale ngang được ngay)

- Session trong DB (`Session`), không sticky-server.
- Rate-limit dùng chung qua Upstash Redis khi có `UPSTASH_*` (thiếu là
  fail-open theo instance — production bắt buộc có, `getEnv()` chặn deploy).
- Outbox mail +idempotency key chống double-send/double-order khi retry qua LB.

## Nút thắt theo thứ tự sẽ gặp

1. **Ghi đơn (Postgres row-lock `Product.stock`)**: flash sale dồn vào vài SKU
   hot → tx xếp hàng trên cùng rows. Chịu được ~trăm đơn/phút/SKU; hơn nữa
   phải tách kho riêng (allocated stock) hoặc queue đặt hàng.
2. **CPU SSR Next**: listing/PDP render server mỗi miss cache. Cache 60s/tag
   `catalog` (`src/lib/server/product-db.ts`) đã giảm DB, nhưng HTML vẫn render
   lại mỗi instance. Lên nữa: CDN cache trang listing (`s-maxage`) + PDP ISR.
3. **Băng thông ảnh**: `next/image` optimize tại server — nhiều instance là
   nhiều lần optimize trùng. Dùng loader CDN (R2 + Cloudflare Polish) thay vì
   optimize local khi traffic ảnh lớn.
4. **unstable_cache theo instance**: 2 instance có thể lệch nhau tối đa 60s sau
   ghi admin (chấp nhận được cho giá/stock hiển thị; giá CHỐT vẫn verify ở
   `placeOrderServer`). Muốn đồng nhất tuyệt đối: chuyển cache sang Redis.

## Postgres production (Supabase/Neon)

- Dùng **pooler transaction mode** (PgBouncer/Neon pooled URL) cho
  `DATABASE_URL`; migration/seed chạy bằng direct URL.
- Prisma: `connection_limit` nhỏ (5–10/instance) — serverless scale instance
  nhanh hơn scale connection. Không tăng bừa: mỗi connection là RAM trên PG.
- PITR bật từ ngày đầu (Supabase/Neon đều có) + giữ cron `db:backup` off-site
  (`BACKUP_HOOK`) — PITR không thay backup chống xóa nhầm toàn cụm.
- Đọc nặng (admin dashboard aggregate, export) tách sang **read replica** khi
  p95 DB >200ms sustained (dùng Prisma `readReplicas` extension — chưa đấu,
  interface đã tách ở `product-db.ts`).

## Khi nào KHÔNG cần làm gì thêm

- <100 đơn/ngày, catalogue <500 SKU: 1 instance + PG gói nhỏ + Upstash free
  là đủ. Đừng dựng K8s/BullMQ cluster — `email-worker` 1 tiến trình + cron
  quét outbox đã đủ (idempotent, chạy 2 worker song song cũng không gửi trùng).
