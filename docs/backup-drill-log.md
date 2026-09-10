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

## RPO / RTO (small-prod)

- RPO ≤ 24h (backup đêm 2h + trước mỗi deploy).
- RTO ≤ 4h (restore file + `migrate deploy` + smoke `/api/health`).
- Drill lại: mỗi tháng trên staging, log tiếp vào file này.
