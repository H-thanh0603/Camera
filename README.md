# LUMINA Optics — Camera E-Commerce Platform

Nền tảng thương mại điện tử bán máy ảnh / ống kính / phụ kiện cao cấp, được nâng cấp
từ UI prototype **LUMINA Optics** (giữ nguyên 100% design system: gold accent, dark
luxury aesthetic, telemetry HUD, typography Syne / Hanken Grotesk / JetBrains Mono).

## Chạy dự án

```bash
npm install
npm run dev        # dev server
npm run build      # production build
npm run start      # production server
npx vitest run     # unit tests (cart / finder / catalogue logic)
```

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
    data/                 # Seed data — chỉ tồn tại ở lớp mock repository
    repositories/         # Nơi truy cập dữ liệu (thay bằng API khi có backend)
    services/             # Business logic thuần hàm (cart, finder, recommendation, order, auth, search)
    utils/                # format VND, validation, URL params, availability
  state/store.tsx         # Global state (cart/wishlist/compare/auth/recent/toast) + persistence
tests/                    # Vitest — cart calc, finder scoring, filter/URL sync
```

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

## Việc cần làm khi nối backend

1. `MockProductRepository` → `ApiProductRepository` (giữ nguyên interface).
2. `OrderService.placeOrder` → `POST /orders` (backend verify giá, stock, payment).
3. `AuthService` → JWT/session cookie (httpOnly), bỏ mock session trong localStorage.
4. Ảnh sản phẩm → CDN + responsive images (`next/image` với `remotePatterns`).
