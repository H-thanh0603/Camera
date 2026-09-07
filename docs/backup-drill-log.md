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

## RPO / RTO (small-prod)

- RPO ≤ 24h (backup đêm 2h + trước mỗi deploy).
- RTO ≤ 4h (restore file + `migrate deploy` + smoke `/api/health`).
- Drill lại: mỗi tháng trên staging, log tiếp vào file này.
