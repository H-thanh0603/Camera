# LUMINA Optics — Camera E-Commerce Platform

[![CI](https://github.com/H-thanh0603/Camera/actions/workflows/ci.yml/badge.svg)](https://github.com/H-thanh0603/Camera/actions/workflows/ci.yml)

Nền tảng thương mại điện tử bán máy ảnh / ống kính / phụ kiện cao cấp, được nâng cấp
từ UI prototype **LUMINA Optics** (giữ nguyên 100% design system: gold accent, dark
luxury aesthetic, telemetry HUD, typography Syne / Hanken Grotesk / JetBrains Mono).

## Chạy dự án

```bash
npm install              # tự động `prisma generate` (postinstall)
npx prisma migrate deploy  # tạo SQLite DB (prisma/dev.db)
npm run dev              # dev server
npm run build && npm run start   # production
npx vitest run           # 57 unit tests
npx playwright test      # 9 E2E tests (cần `npm run build` trước)
npm run db:reset         # xóa sạch DB về trạng thái ban đầu
```

Env (xem `.env.example`): `DATABASE_URL` (SQLite dev / Postgres production),
`NEXT_PUBLIC_SITE_URL`, `PAYMENT_DEMO_MODE` + `NEXT_PUBLIC_PAYMENT_DEMO_MODE`
(bật nút "mô phỏng đã thanh toán" — tắt ở production thật).

## Kiến trúc

```
src/
  app/                    # Next.js App Router (SSG + ISR-ready)
    page.tsx              # Home — port nguyên vẹn 6 section của prototype
    products/             # Catalogue (?brand=&category=&minPrice=&sort=&page=) + PDP /[slug]
    cart/ checkout/       # Giỏ hàng + checkout 5 bước (Contact → Shipping → Delivery → Payment → Review)
    wishlist/ compare/    # Wishlist + so sánh 2–4 máy (?ids=)
    camera-finder/        # Wizard gợi ý máy ảnh (scoring tách khỏi UI)
    account/              # Auth mock + đơn hàng + order timeline
    journal/              # Editorial / magazine
  components/             # UI theo domain: product, cart, catalog, home, layout, search, ui
  lib/
    types.ts              # Domain model (Product, Variant, Cart, Order, Finder…)
    data/                 # Catalogue seed (read-only) — sản phẩm chưa cần admin CRUD
    repositories/         # Truy cập catalogue (server + client dùng chung seed snapshot)
    services/             # Business logic thuần hàm (cart, finder, recommendation, search, orders client)
    server/               # Server-only: Prisma, scrypt password, session, đặt hàng + verify
    api-client.ts         # Cầu nối UI → API routes, xử lý lỗi thống nhất
    utils/                # format VND, validation, URL params, rate-limit
  app/api/                # auth (register/login/logout/me), orders (+cancel, pay-demo), reviews
  state/store.tsx         # Global state (cart/wishlist/compare/auth/recent/toast) + persistence
tests/                    # Vitest (57) + Playwright E2E (9): cart, finder, filter, order verification, luồng mua thật
```

### Admin panel

- `/admin` — guard server-side theo `user.role` trong DB (API routes guard riêng từng route).
- Tài khoản seed: `admin@lumina.vn` / `ADMIN_PASSWORD` (mặc định `admin-lumina-2026`).
- Dashboard (đơn, doanh thu, sản phẩm, review chờ duyệt), CRUD sản phẩm (viết DB +
  `revalidatePath` — catalogue hiển thị lại gần như tức thì), đổi trạng thái đơn,
  duyệt/xóa review (tự tính lại rating sản phẩm).
- Catalogue sản phẩm nằm trong DB: client refresh qua `/api/products/snapshot`.

### Backend hiện trạng

- **Database (Prisma + SQLite)**: `users`, `sessions`, `orders` + `order_lines`,
  `reviews`, `products` + `product_variants`. Catalogue đọc từ DB (ISR + on-demand
  revalidate khi admin ghi).
- **Auth thật**: scrypt hash, session token (cookie httpOnly, DB chỉ lưu SHA-256),
  rate limit login/register. Không còn thông tin user trong localStorage.
- **Đặt hàng**: client chỉ gửi productId/variantId/quantity — **server tự lấy giá,
  kẹp stock và tính lại toàn bộ totals** trước khi ghi DB.
- **Payment**: abstraction qua endpoint; `pay-demo` chỉ chạy khi `PAYMENT_DEMO_MODE=true`
  (đồ án). Production: thay bằng webhook VNPay/MoMo/Stripe verify chữ ký HMAC.
- **Reviews**: ghi DB với `approved=false`, hiển thị công khai sau kiểm duyệt.

### Nguyên tắc

- **UI ↔ data tách bạch**: component chỉ nhận data; giá/stock/discount nằm trong
  `services` + `repositories`. Khi có backend, thay thân hàm repository bằng `fetch`
  — UI không đổi.
- **Tiền tệ VND nguyên (đồng)**, format qua `formatVND`.
- **Bảo mật**: client không lưu token/password; giá cuối cùng phải được backend xác
  minh khi đặt hàng (đã ghi chú trong `OrderService` / `Checkout`).
- **Không dark pattern**: mọi trạng thái loading / empty / error đều có UI; số liệu
  chỉ hiển thị khi có dữ liệu thật.
- **A11y**: semantic HTML, ARIA cho modal/tab/progressbar, focus-visible,
  `prefers-reduced-motion`.

## Việc cần làm tiếp theo (production)

1. Deploy: Vercel + Postgres (Supabase/Neon) — đổi `provider` + `DATABASE_URL`, chạy `prisma migrate deploy`.
2. Payment thật: webhook VNPay/MoMo/Stripe thay `pay-demo`, xóa endpoint demo.
3. Email (xác nhận đơn, reset password), ảnh CDN + `next/image`, Sentry.
4. Snapshot API → phân trang server-side khi catalogue lên hàng nghìn SP.
