/**
 * Backup DB — chạy định kỳ (cron) mỗi đêm + trước mỗi deploy.
 * - SQLite (dev/staging file): checkpoint WAL rồi copy + giữ N bản.
 * - Postgres (production): pg_dump qua DATABASE_URL.
 * - `--encrypt`: mã hóa AES-256-CBC (PBKDF2) bằng BACKUP_ENCRYPTION_KEY.
 *   Backup chứa passwordHash/tokenHash/PII — production BẮT BUỘC encrypt.
 * - Sau backup: chạy BACKUP_HOOK với FILE=<đường dẫn> (rclone/aws s3 —
 *   operator tự đấu nối off-site). Không có hook → cảnh báo rõ ràng.
 * - Cảnh báo nếu thư mục backup nằm trong repo mà chưa gitignore.
 *
 * Dùng: node scripts/db-backup.mjs [--keep 7] [--dir ./backups] [--encrypt]
 */
import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const val = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const KEEP = Number(val("--keep")) || 7;
const DIR = val("--dir") ?? "./backups";
const ENCRYPT = args.includes("--encrypt");
const DATABASE_URL = process.env.DATABASE_URL ?? "";

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function prune(dir, keep) {
  const files = readdirSync(dir).filter((f) => f.startsWith("lumina-")).sort();
  while (files.length > keep) {
    const oldest = files.shift();
    if (oldest) rmSync(join(dir, oldest));
  }
}

function encryptFile(path) {
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  if (!key) {
    console.error("Thiếu BACKUP_ENCRYPTION_KEY — không thể --encrypt.");
    process.exit(1);
  }
  execFileSync("openssl", [
    "enc", "-aes-256-cbc", "-pbkdf2", "-salt",
    "-in", path, "-out", `${path}.enc`,
    "-pass", `env:BACKUP_ENCRYPTION_KEY`,
  ]);
  rmSync(path);
  return `${path}.enc`;
}

function warnIfTracked(dir) {
  if (resolve(dir).startsWith(resolve(process.cwd()) + "/") === false) return; // ngoài repo: khỏi lo commit
  try {
    execSync(`git check-ignore -q ${dir}`, { stdio: "ignore" });
  } catch {
    console.warn(
      `CẢNH BÁO: ${dir} chưa gitignore — backup chứa PII/hash, đừng commit! Thêm "/${dir.replace(/^\.\//, "")}/" vào .gitignore.`,
    );
  }
}

mkdirSync(DIR, { recursive: true });

let dest = "";
if (DATABASE_URL.startsWith("file:")) {
  // Prisma resolve file: tương đối từ thư mục schema (prisma/)
  const src = join(process.cwd(), "prisma", DATABASE_URL.replace(/^file:/, "").replace(/^\.\//, ""));
  if (!existsSync(src)) {
    console.error(`Không tìm thấy DB file: ${src}`);
    process.exit(1);
  }
  // Checkpoint WAL trước khi copy để file nhất quán khi đang ghi
  try {
    execFileSync("sqlite3", [src, "PRAGMA wal_checkpoint(TRUNCATE);"], { stdio: "ignore" });
  } catch {
    // sqlite3 CLI không có → copy trực tiếp (chấp nhận rủi ro nhỏ ở dev)
  }
  dest = join(DIR, `lumina-${stamp()}.db`);
  copyFileSync(src, dest);
  console.log(`Backup SQLite xong: ${dest}`);
} else if (/^postgres(ql)?:/.test(DATABASE_URL)) {
  dest = join(DIR, `lumina-${stamp()}.sql`);
  try {
    execFileSync("pg_dump", [DATABASE_URL, "-f", dest], { stdio: "inherit" });
  } catch {
    console.error("pg_dump thất bại — kiểm tra PATH và DATABASE_URL.");
    process.exit(1);
  }
  console.log(`Backup Postgres xong: ${dest}`);
} else {
  console.error("DATABASE_URL không nhận diện được (file: hoặc postgres).");
  process.exit(1);
}

if (ENCRYPT) {
  dest = encryptFile(dest);
  console.log(`Đã mã hóa: ${dest}`);
}
prune(DIR, KEEP);
warnIfTracked(DIR);

const hook = process.env.BACKUP_HOOK;
if (hook) {
  try {
    execSync(hook, { env: { ...process.env, FILE: resolve(dest) }, stdio: "inherit" });
    console.log("BACKUP_HOOK chạy xong (off-site).");
  } catch {
    console.error("BACKUP_HOOK thất bại — backup vẫn nằm local, kiểm tra off-site!");
    process.exit(1);
  }
} else {
  console.warn("Chưa cấu hình BACKUP_HOOK — backup CHỈ nằm local, chưa off-site!");
}
