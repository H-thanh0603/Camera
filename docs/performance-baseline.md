# Baseline hiệu năng & A11y (Lighthouse)

Đo ngày 2026-09-05, Chrome headless, Lighthouse mobile throttling (slow 4G),
production build (`next build` + `next start`), chạy trên máy dev cá nhân —
số tuyệt đối sẽ khác trên Vercel/hạ tầng thật, dùng để so sánh tương đối.

## Cách đo lại

```bash
npm run build && npm run start
npx lighthouse http://localhost:3000 --quiet \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" \
  --only-categories=performance,accessibility,best-practices,seo
```

## Kết quả sau quick wins (2026-09-05)

| Trang                        | Perf (biến động 50–66) | A11y | Best Practices | SEO | LCP      | CLS     |
| ---------------------------- | ---------------------- | ---- | -------------- | --- | -------- | ------- |
| `/` (Home)                   | 55–62                  | 100  | 100            | 100 | ~6.3s    | **0**   |
| `/products/lumina-x1-monolith` | 50–66                | 100  | 100            | 100 | ~5.9s    | 0.003   |

Perf score dao động ±7 điểm giữa các lần chạy cùng bản build (nhiễu CPU máy đo) —
so sánh phải dùng trung bình nhiều lần chạy.

## Đã sửa trong đợt này

1. **CLS 0.121 → 0**: Material Symbols icon font thêm `display=block` — icon font
   swap đang đẩy layout khi ligature nạp xong.
2. **A11y 97 → 100 (PDP)**: tăng contrast SKU (`text-outline` 4.23:1 →
   `on-surface-variant`); sửa 2 accessible name không chứa visible text (logo,
   nút zoom).
3. **LCP hero**: `fetchPriority="high"` + preconnect tới `lh3.googleusercontent.com`.

## Nút thắt còn lại (chờ giai đoạn backend)

LCP ~6s (mobile throttled) bị chi phối bởi ảnh hero ~hàng trăm KB từ Google CDN
không có srcset/AVIF. Fix cấu trúc duy nhất là chuyển sang **`next/image` +
CDN/own bucket** (đã có trong lộ trình giai đoạn 2 — khi đó FCP/LCP dự kiến giảm
mạnh, và icon font có thể tự host cùng fonts.gstatic).
