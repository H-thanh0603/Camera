/**
 * Kiểm thử tải k6 — baseline API + SSR.
 * Chạy: npm run build && npm run start (port 3000), rồi:
 *   k6 run scripts/load-test.js
 *   k6 run -e BASE_URL=https://staging.lumina.vn scripts/load-test.js
 *
 * Lưu ý: endpoint GHI (POST validate) chịu global mutation limit 60 req/phút
 * theo IP ở middleware — scenario coupon cố ý chạy chậm (30 req/phút) để
 * không đo nhầm 429 (rate limit đúng thiết kế) thành lỗi.
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    reads: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 10 }, // warm-up
        { duration: "30s", target: 50 }, // tải đỉnh
        { duration: "10s", target: 0 }, // cool-down
      ],
      exec: "reads",
    },
    coupon: {
      executor: "constant-vus",
      vus: 1,
      duration: "60s",
      exec: "coupon",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800", "p(99)<2000"],
  },
};

const BASE = __ENV.BASE_URL ?? "http://localhost:3000";

export function reads() {
  let r = http.get(`${BASE}/api/products?page=1&pageSize=12`);
  check(r, { "products 200": (x) => x.status === 200 });

  r = http.get(`${BASE}/api/products?q=sony&pageSize=6`);
  check(r, { "search 200": (x) => x.status === 200 });

  r = http.get(`${BASE}/api/health`);
  check(r, { "health 200": (x) => x.status === 200 });

  r = http.get(`${BASE}/`);
  check(r, { "home 200": (x) => x.status === 200 });

  sleep(0.5);
}

export function coupon() {
  const r = http.post(
    `${BASE}/api/coupons/validate`,
    JSON.stringify({ code: "LUMINA10", subtotal: 10_000_000 }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(r, { "coupon 200": (x) => x.status === 200 });
  sleep(2); // ~30 req/phút — dưới mutation limit 60/phút
}
