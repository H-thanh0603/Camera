/**
 * Smoke test sau deploy — chạy vào staging/prod trước khi mở traffic.
 * Dùng: BASE_URL=https://staging.lumina.vn node scripts/smoke-prod.mjs
 * Exit != 0 khi bất kỳ check nào fail (gắn vào CD pipeline).
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL - ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const get = (p) => fetch(`${BASE}${p}`).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

await check("health 200 + db up", async () => {
  const r = await get("/api/health");
  assert(r.status === 200, `status ${r.status}`);
  assert(r.body.db === "up", "db down");
});

await check("production không bật demo payment", async () => {
  const r = await get("/api/health");
  if (String(process.env.REQUIRE_PROD_FLAGS ?? "") === "true") {
    assert(r.body.paymentDemoMode === false, "demo payment đang bật!");
  }
});

await check("catalogue phân trang 200", async () => {
  const r = await get("/api/products?page=1&pageSize=5");
  assert(r.status === 200, `status ${r.status}`);
  assert(Array.isArray(r.body.items), "thiếu items");
});

await check("admin API chặn anonymous (403)", async () => {
  const r = await get("/api/admin/orders?status=all&page=1&pageSize=1");
  assert(r.status === 403, `status ${r.status}, mong đợi 403`);
});

await check("webhook thiếu chữ ký → 401/503", async () => {
  const r = await fetch(`${BASE}/api/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert(r.status === 401 || r.status === 503, `status ${r.status}`);
});

if (failed > 0) {
  console.error(`${failed} smoke check(s) FAILED`);
  process.exit(1);
}
console.log("smoke-prod: tất cả đạt");
