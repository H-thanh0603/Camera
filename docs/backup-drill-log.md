# Backup drill log

## 2026-09-07 — drill đầu tiên (SQLite dev.db → file tạm)

- Backup: `node scripts/db-backup.mjs --dir /tmp/lumina-drill` → OK
- Restore: `node scripts/db-restore.mjs <file> --target restored.db` → OK
- Verify: `PRAGMA integrity_check` → `ok`; counts live vs restored khớp
  (User 49, Product 18, Order 20, Coupon 3)
- Vòng mã hóa: `--encrypt` (AES-256-CBC PBKDF2) → restore `.enc` →
  integrity `ok`, Product 18. OK
- Phát hiện khi drill: script cũ resolve `file:./dev.db` sai thư mục
  (Prisma tính từ `prisma/`) — đã fix trong đợt này.

## 2026-09-10 — drill Postgres 18 (baseline → seed → backup → restore)

- Cluster: Postgres 18.6 tạm (initdb, port 55433), DB `lumina_drill`.
- Baseline: `prisma/postgres-baseline.sql` (sinh bằng
  `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.postgres.prisma`)
  apply qua `psql -f` → sạch, không lỗi.
- Extensions: `prisma/postgres-extensions.sql` → `pg_trgm` + 4 GIN index OK.
- Seed: `ADMIN_PASSWORD="drill-mat-khau-12" prisma db seed` →
  Product 18, Coupon 3, User 1 (admin).
- Verify: `EXPLAIN SELECT * FROM "Order" WHERE status='pending'` dùng
  `Order_status_idx`; fuzzy `name % 'Hasselblad'` trả 2 dòng (trigram hoạt động).
- Backup: `node scripts/db-backup.mjs` (pg_dump) → file 52KB OK.
- Restore: DB mới `lumina_restore` + `psql -f backup.sql` →
  Product 18, Coupon 3. Khớp.
- Khởi tạo prod về sau: `node scripts/db-pg-init.mjs --seed`
  (chặn SQLite, bắt buộc ADMIN_PASSWORD ≥12 ký tự).
- Phát hiện khi drill: Prisma không parse URL socket `host=/tmp`
  (empty host) — dùng TCP `127.0.0.1:55433` cho seed.

## 2026-09-11 — drill Prisma 7 (adapter-pg + tx + backup/restore)

- Cluster Postgres 18.6 tạm (port 55438), DB `v7`.
- Baseline + extensions apply sạch. Generate client PG, seed qua adapter:
  Product 18, Coupon 3, User 1.
- Transaction trừ kho + tạo đơn + outbox qua `PrismaPg` adapter: commit OK,
  đơn đọc lại được. `EXPLAIN` dùng `Order_status_idx`.
- Backup `pg_dump` → restore DB mới: Product 18, Coupon 3. Khớp.
- Phát hiện khi drill: DateTime SQLite lẫn kiểu sau upgrade (engine v6 ghi
  INTEGER millis, adapter better-sqlite3 v7 ghi TEXT ISO) → ORDER BY ngày
  sai trong dev. Đã chuẩn hóa dev.db một lần (INTEGER → TEXT ISO).
  DB mới (`migrate reset`/seed tươi) và Postgres không bị. Dev.db cũ từ v6
  chưa chuẩn hóa sẽ gặp lỗi tương tự — chạy `npm run db:reset` để làm mới.

## 2026-09-11 — verify baseline saleEndsAt (local PG 18, chuẩn bị Supabase)

- Cluster Postgres 18 tạm (port 5439), DB `lumina`.
- Baseline (`postgres-baseline.sql` đã thêm `"saleEndsAt" TIMESTAMP(3)`) +
  extensions apply sạch.
- Drift check kiểu CI (baseline live vs `schema.prisma` sed postgresql):
  `migrate diff` không còn CREATE/ALTER/INDEX → baseline đồng bộ.
- Seed PG: Product 18, Coupon 3; 2 SP giảm giá có `saleEndsAt`
  (24-70mm, filter kit → 2026-12-31). Sẵn sàng cho Supabase deploy.

## 2026-09-11 — deploy Supabase thật (project lumina-optics, Singapore)

- Tạo project qua CLI: ref `qaiftjevyctfrwlkefsr`, region ap-southeast-1.
- Baseline + extensions apply qua pooler (6543) sạch.
- Seed qua pooler: Product 18, Coupon 3, User 1 (admin@lumina.vn).
  2 SP giảm giá có `saleEndsAt` 2026-12-31.
- Lưu ý môi trường: Node driver trong sandbox này verify TLS strict
  (P1011 self-signed chain) → seed dùng `sslmode=no-verify` qua pooler.
  Production (Vercel) dùng URL pooler chuẩn `sslmode=require` — CA đầy đủ,
  không đổi code app vì quirk của sandbox.
- DATABASE_URL pooler (dùng cho Vercel env):
  `postgresql://postgres.qaiftjevyctfrwlkefsr:[DB_PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`

## RPO / RTO (small-prod)

- RPO ≤ 24h (backup đêm 2h + trước mỗi deploy).
- RTO ≤ 4h (restore file + `migrate deploy` + smoke `/api/health`).
- Drill lại: mỗi tháng trên staging, log tiếp vào file này.
