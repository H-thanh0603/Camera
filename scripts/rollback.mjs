#!/usr/bin/env node
/**
 * Rollback production về deployment cũ hơn (Vercel) hoặc restart deployment
 * tag cũ (self-host). Không cần tưởng — mỗi lần chạy đều in kế hoạch TRƯỚC,
 * yêu cầu gõ `yes` để xác nhận.
 *
 * Vercel:
 *   node scripts/rollback.mjs                     # liệt kê 5 deployment gần nhất
 *   node scripts/rollback.mjs <deploymentId>      # rollback về deployment đó
 *
 * Self-host (một máy chạy `npm run start`):
 *   node scripts/rollback.mjs --self-host <gitSha>
 *   → hướng dẫn từng bước: checkout SHA, install, build, restart (systemd/pm2).
 *
 * An toàn:
 * - KHÔNG rollback DB schema tự động (migrate down nguy hiểm hơn deploy cũ).
 *   Nếu deployment mới đã chạy migration, đọc docs/runbook.md mục "Rollback
 *   có migration" trước khi tiếp tục.
 * - Script chỉ đọc trạng thái; thay đổi thật qua `vercel` CLI của bạn
 *   (script in đúng lệnh để copy-paste).
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const SELF_HOST = args.includes("--self-host");
const target = args.find((a) => !a.startsWith("--"));

function run(cmd, args2, opts = {}) {
  return execFileSync(cmd, args2, { encoding: "utf8", ...opts }).trim();
}

console.log("=== LUMINA Rollback Assistant ===\n");

if (!SELF_HOST) {
  // ---- Vercel path ----
  const hasVercel = run("bash", ["-c", "command -v vercel || true"]);
  if (!hasVercel) {
    console.error("Cần cài vercel CLI: npm i -g vercel (rồi `vercel login`).");
    process.exit(1);
  }
  const list = run("vercel", ["ls", "--json"], { stdio: ["ignore", "pipe", "pipe"] });
  const deployments = JSON.parse(list)
    .filter((d) => d.state === "READY" || d.state === "BUILDING")
    .slice(0, 6);
  console.log("Deployments gần nhất (mới nhất trước):");
  for (const d of deployments) {
    console.log(`  ${d.uid}  ${String(d.url).padEnd(45)} ${d.created? new Date(d.created).toISOString().slice(0, 16) : ""} ${d.state}`);
  }
  if (!target) {
    console.log("\nChưa chỉ định deployment — chạy lại:");
    console.log("  node scripts/rollback.mjs <deploymentId>");
    process.exit(0);
  }
  const chosen = deployments.find((d) => d.uid === target || d.url === target);
  if (!chosen) {
    console.error(`\nDeployment "${target}" không nằm trong 6 deployment gần nhất — kiểm tra lại id.`);
    process.exit(1);
  }
  console.log(`\nKế hoạch rollback:`);
  console.log(`  1. vercel rollback ${chosen.uid}`);
  console.log(`     (production trỏ về deployment ${chosen.url} — instant, không rebuild)`);
  console.log(`  2. Không đổi DB. Nếu deployment mới đã áp migration:`);
  console.log(`     xem docs/runbook.md mục "Rollback có migration".`);
  console.log(`  3. Verify sau rollback:`);
  console.log(`     BASE_URL=<prod-url> REQUIRE_PROD_FLAGS=true npm run smoke:prod`);
  const answer = run("bash", ["-c", 'read -p "Chạy rollback thật? gõ yes: " a; echo "$a"'], { stdio: ["inherit", "pipe", "inherit"] });
  if (answer !== "yes") {
    console.log("Hủy — không thay đổi gì.");
    process.exit(0);
  }
  console.log(run("vercel", ["rollback", chosen.uid]));
  console.log("\nĐã rollback. Chạy smoke:prod để xác nhận.");
} else {
  // ---- Self-host path ----
  if (!target) {
    console.error("Cần SHA commit cũ: node scripts/rollback.mjs --self-host <gitSha>");
    process.exit(1);
  }
  console.log(`Kế hoạch rollback self-host về ${target}:\n`);
  console.log(`  git fetch origin && git checkout ${target}`);
  console.log(`  npm ci && npm run build`);
  console.log(`  # restart process manager: systemctl restart lumina  (hoặc pm2 restart lumina)`);
  console.log(`  BASE_URL=<prod-url> REQUIRE_PROD_FLAGS=true npm run smoke:prod`);
  console.log(`\nLưu ý: prisma/migrations là moving-forward — KHÔNG migrate down.`);
}
