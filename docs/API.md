# API.md — REST API LUMINA Optics

Base URL production: `https://<domain>` (staging dùng domain staging — xem `docs/runbook.md`).
Định dạng: JSON request/response trừ khi ghi chú khác (CSV cho export, SSE cho agent chat).

## Quy ước chung

| Quy tắc | Chi tiết |
|---|---|
| **Auth** | Cookie `lumina.session` (HttpOnly, SameSite=Lax, Secure ở HTTPS). Không dùng header token. |
| **Vai trò** | `customer` (mặc định) / `staff` / `admin` — kiểm tra server-side từng request, đọc từ DB. |
| **CSRF** | Mọi request GHI (`POST/PATCH/DELETE`) phải cùng origin: header `Origin` (hoặc `Referer`) khớp host — không có thì 403. Ngoại lệ: webhook/IPN (chữ ký HMAC thay thế). |
| **Rate limit** | Chan chung 60 ghi/phút/IP cho `/api/*`; nhiều endpoint có giới hạn riêng chặt hơn (ghi ở từng endpoint). Lưu ý: trụ trên Redis (Upstash) ở production, in-memory khi dev. Vượt → `429` + header `Retry-After` (giây). |
| **Lỗi** | `{ "error": "…" }`, kèm `fieldErrors` (zod) khi validate form: `{ "error": "...", "fieldErrors": { "<field>": "..." } }`. |
| **Giá tiền** | VND nguyên (đồng), kiểu số. |

Mã lỗi dùng lại: `400` body lỗi định dạng, `401` chưa đăng nhập, `403` sai vai trò/CSRF, `404` không tìm thấy (cũng dùng để che sự tồn tại của resource người khác), `409` xung đột trạng thái, `422` dữ liệu hợp lệ cú pháp nhưng sai nghiệp vụ, `429` rate limit, `503` tính năng chưa cấu hình (fail-closed), `502` cổng thanh toán từ chối.

## Auth — `/api/auth`

| Endpoint | Method | Body / Query | Quyền | Ghi chú |
|---|---|---|---|---|
| `/register` | POST | `{name, email, password}` (≥8 ký tự) | public | 5/phút/IP. Trùng email → 409. Tạo session ngay. |
| `/login` | POST | `{email, password}` | public | 10/phút/IP. Lỗi chung chung (không lộ email tồn tại). Bật 2FA → trả `{challenge}` (không session). |
| `/logout` | POST | — | đã đăng nhập | Xóa session DB + cookie. |
| `/me` | GET | — | đã đăng nhập | `{id, name, email, role}`. |
| `/google` | GET | — | public | Redirect sang Google (state cookie, 10 phút). Cần `GOOGLE_CLIENT_ID/SECRET`. |
| `/google/callback` | GET | `code, state` | public | Hoàn tất OAuth; email phải verified; tài khoản bị khóa từ chối. |
| `/forgot-password` | POST | `{email}` | public | 5/phút/IP. Luôn trả 200 (chống dò email). Gửi email có link (token 60 phút). |
| `/reset-password` | GET | `token` | public | Check token hợp lệ trước khi hiện form (không tốn lượt dùng). |
| `/reset-password` | POST | `{token, password}` | public | 5/phút/IP. Đổi mật khẩu + thu hồi MỌI phiên cũ. Token 1 lần. |
| `/2fa/setup` | POST | — | đã đăng nhập | Trả `{secret, otpauthUrl}` — quét bằng app authenticator. |
| `/2fa/confirm` | POST | `{code}` | đã đăng nhập | Bật 2FA; trả `{backupCodes}` 8 mã (hiện 1 lần duy nhất). |
| `/2fa/disable` | POST | `{code}` | đã đăng nhập + 2FA | Tắt 2FA bằng code hiện tại. |
| `/2fa/status` | GET | — | đã đăng nhập | 2FA đang bật? |
| `/2fa/verify` | POST | `{challenge, code}` | public (challenge) | 5/phút/IP. Xong → session tạo. Code = TOTP hoặc 1 mã dự phòng. Challenge 5 phút, 1 lần dùng. |

## Catalogue — public

| Endpoint | Method | Query | Ghi chú |
|---|---|---|---|
| `/products` | GET | `q≤100, brand, brands, category, categories, tag, minPrice, maxPrice, minRating, inStockOnly, sort` (`featured\|newest\|price_asc\|price_desc\|rating_desc\|best_selling`), `page`, `pageSize≤60` | Phân trang server-side; `Cache-Control: s-maxage=60, stale-while-revalidate=120`. Tìm kiếm không dấu hoạt động (Postgres dùng pg_trgm). |
| `/products/resolve` | POST | `{ids: string[≤50]}` | Giá/tồn mới nhất cho giỏ client — không trust cache cũ. |
| `/catalog` | GET | — | Toàn bộ catalogue dạng mảng (dùng cho compare/finder), cache 300s. |
| `/products/:id/reviews` | GET | `page` | Chỉ review đã duyệt. |
| `/settings/public` | GET | — | Banner công khai (whitelist key). |
| `/battles` | GET/POST | — | So sánh máy đã lưu (khách: 20 tối đa). |
| `/kit/share-email` | POST | `{items: [{productId, quantity}] ≤20}` | Đã đăng nhập. Gửi email tóm tắt kit. |
| `/trade-in` | POST | `{name, contact, gear…}` | Thu cũ — form dẫn nhập. 3/phút/IP. |

## Giỏ hàng & đơn hàng

Cart sống ở client (localStorage) + xác thực lại giá mỗi lần qua `/products/resolve`.

| Endpoint | Method | Body / Query | Quyền | Ghi chú |
|---|---|---|---|---|
| `/orders` | POST | `{contact, shipping, delivery, payment, lines[], idempotencyKey?, guestToken?, couponCode?}` | public (guest ok) | 10/phút/IP. **Server tự tính lại toàn bộ giá + kẹp tồn kho** — client chỉ gửi id + số lượng. Trả đơn + `guestToken` (chỉ 1 lần, hash lưu DB). Header `Idempotency-Key` gửi lại → trả đúng đơn cũ, không trùng lặp. |
| `/orders` | GET | — | đã đăng nhập | Chỉ đơn CỦA MÌNH. |
| `/orders/lookup` | GET | `number, token` | public | 10/phút/IP. Tra đơn guest bằng mã `LUM-…` + token; sai → 404 chung. |
| `/orders/:id/cancel` | POST | — | chủ đơn (session hoặc guest token) | Đơn hủy được khi: chờ thanh toán/đã thanh toán/đang xử lý. Trả kho + hoàn lượt coupon tự động. |
| `/orders/:id/vnpay-url` | POST | — | chủ đơn | 10/phút/IP. Trả link VNPay sandbox/prod. Chưa cấu hình keys → 503. |

## Thanh toán

| Endpoint | Method | Chữ ký | Ghi chú |
|---|---|---|---|
| `/payments/vnpay-ipn` | GET | HMAC-SHA512 (server-to-server VNPay) | Trả RspCode đúng spec VNPay: `00` nhận, `97` sai checksum, `01` không tìm đơn, `04` sai tiền, `02` đã xác nhận. Số tiền so với totals server — không tin số tiền từ URL. |
| `/payments/vnpay-return` | GET | HMAC-SHA512 | Chỉ hiển thị (redirect kèm kết quả) — trạng thái chuẩn do IPN quyết định. |
| `/payments/webhook` | POST | HMAC-SHA256 raw body, header `X-Signature` (PAYMENT_WEBHOOK_SECRET) | Webhook generic dự phòng. Dedupe theo `(provider,eventId)`; timestamp lệch ≤5 phút. Thiếu secret → 503. |

Hành vi dedupe/replay: 2 webhook trùng → bên sau nhận `deduped: true`, KHÔNG áp dụng 2 lần (unique constraint chặn).

## Đánh giá

| Endpoint | Method | Body | Ghi chú |
|---|---|---|---|
| `/reviews` | POST | `{author, rating 1-5, title ≤120, body ≤2000, photos[≤3] (https URL)}` | 5/phút/IP. Lưu chờ duyệt (chưa hiện). |
| `/upload/review` | POST | FormData: `file` (jpg/png/webp/gif, ≤3MB) | 3/phút/IP + 20/ngày/IP. Magic-byte sniff — đổi đuôi giả mạo bị chặn; SVG từ chối. Trả `{url}` R2 public. |

## Tài khoản

| Endpoint | Method | Ghi chú |
|---|---|---|
| `/account/delete` | POST | 3/phút/IP. Xóa tài khoản (GDPR-style): thu hồi phiên, giữ đơn ẩn danh. Cần nhập lại mật khẩu. |
| `/account/export` | GET | Tải dữ liệu cá nhân JSON. |

## AI Agent — `/api/agent`

| Endpoint | Method | Ghi chú |
|---|---|---|
| `/chat` | POST | **SSE stream** (`text/event-stream`). 10/phút/IP + ≤3 stream đồng thời/IP. `{message, history?, context?}`. Hộp thoại mua sắm: model chỉ được trả lời dựa tool. Thiếu AI keys → 503. |
| `/action` | POST | Duyệt hành động agent (thêm giỏ / theo dõi giá). Client chỉ gửi `{actionKey}` — payload nằm server. TTL duyệt 10 phút. |
| `/feedback` | POST | 👍/👎 trên câu trả lời. |
| `/reset` | POST | Xóa lịch sử hội thoại của session cookie. |
| `/health` | GET | Trạng thái cấu hình provider. |

Chat có **kill-switch ngân sách**: vượt `AI_MONTHLY_TOKEN_CAP` tháng → 503 tới kỳ sau.

## Admin — `/api/admin/*` (yêu cầu vai trò)

`[A]` = admin, `[A|S]` = admin hoặc staff.

| Endpoint | Method | `[A]`/`[A|S]` | Ghi chú |
|---|---|---|---|
| `/products` + `/:id` | GET/POST/PUT/DELETE | A | CRUD; DELETE chặn khi có đơn/review; mọi ghi → revalidate catalogue. |
| `/products/import` | POST | A | CSV import (dry-run + commit; ≤500 dòng). |
| `/orders` | GET | A\|S | Lọc trạng thái + phân trang. |
| `/orders/export` | GET | A\|S | CSV (BOM Excel-VN), lọc ngày/trạng thái, ≤2000 dòng. |
| `/orders/:id` | PATCH | A\|S | Đổi trạng thái theo state machine (chỉ tiến); kèm `carrier`, `trackingCode`. Hủy/refund từ pending/paid/processing tự trả kho + coupon. |
| `/orders/:id/refund` | POST | A | Hoàn tiền VNPay full-amount; RspCode 00 mới `paid → refunded` + bù kho + coupon + ledger. 10/phút/IP. |
| `/reviews` `/reviews/:id` | GET/PATCH/DELETE | A\|S | Duyệt / từ chối / xóa; tự tính lại điểm sản phẩm. |
| `/stock` | GET/POST | A\|S | Phiếu nhập/xuất/chốt + lịch sử 100 dòng. |
| `/users` `/users/:id` | GET/PATCH/DELETE | A | Đổi vai trò, khóa (đá phiên), xóa; chặn tự hạ admin cuối. |
| `/users/:id/revoke-sessions` | POST | A | Đá mọi phiên của 1 tài khoản. |
| `/coupons` `/:code` | GET/POST/PATCH/DELETE | A | Tạo (percent 1-90 / số tiền, minSubtotal), bật/tắt, xóa. |
| `/articles` `/:slug` | GET/POST/PUT/DELETE | A | Journal CMS. |
| `/settings` | GET/PUT | A | Chỉ key whitelist (banner). |
| `/upload` | POST | A | Ảnh sản phẩm → R2; scope ≤64 ký tự. |
| `/queue` | GET | A | Email outbox queue trạng thái. |

## Ops

| Endpoint | Method | Ghi chú |
|---|---|---|
| `/health` | GET | Uptime monitor. 200 app+DB sống; 503 DB chết. Booleans cấu hình (vnpay/email/redis/sentry) + `latencyMs` DB. |
| `/metrics` | GET/POST | POST = telemetry client (120/phút/IP). GET = counters — **chỉ admin**. |

---

Ví dụ curl nhanh (dev):

```bash
# Register + đặt đơn guest
curl -c jar -X POST localhost:3000/api/auth/register \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"t@t.vn","password":"password-123"}'

curl -b jar -X POST localhost:3000/api/orders \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"contact":{"name":"Test","email":"t@t.vn","phone":"0900000000"},
       "shipping":{"address":"1 PASTE","district":"1","city":"HCM"},
       "delivery":"standard","payment":"cod",
       "lines":[{"productId":"...","quantity":1}]}'
```

Schema đầy đủ từng field: xem zod schemas nguồn thật ở `src/lib/schemas.ts` — tài liệu này không lặp lại constraint từng chuỗi (độ dài max v.v.) vì zod là nguồn sự thật.
