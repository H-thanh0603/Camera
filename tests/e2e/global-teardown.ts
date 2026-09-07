import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const DB_TARGET = resolve("tests/e2e/.test.db");
const WAL_TARGET = resolve("tests/e2e/.test.db-wal");
const SHM_TARGET = resolve("tests/e2e/.test.db-shm");

export default function globalTeardown() {
  for (const f of [DB_TARGET, WAL_TARGET, SHM_TARGET]) {
    if (existsSync(f)) rmSync(f);
  }
}
