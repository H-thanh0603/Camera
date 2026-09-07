import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const DB_SRC = resolve("prisma/dev.db");
const DB_DIR = resolve("tests/e2e");
const DB_TARGET = resolve("tests/e2e/.test.db");
const WAL_TARGET = resolve("tests/e2e/.test.db-wal");
const SHM_TARGET = resolve("tests/e2e/.test.db-shm");

export default function globalSetup() {
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  if (existsSync(DB_TARGET)) rmSync(DB_TARGET);
  if (existsSync(WAL_TARGET)) rmSync(WAL_TARGET);
  if (existsSync(SHM_TARGET)) rmSync(SHM_TARGET);
  copyFileSync(DB_SRC, DB_TARGET);
  // Copy WAL + SHM nếu có (đảm bảo snapshot nhất quán)
  if (existsSync(DB_SRC + "-wal")) copyFileSync(DB_SRC + "-wal", WAL_TARGET);
  if (existsSync(DB_SRC + "-shm")) copyFileSync(DB_SRC + "-shm", SHM_TARGET);
}
