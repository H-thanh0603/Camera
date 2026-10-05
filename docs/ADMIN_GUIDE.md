# ADMIN_GUIDE — Hướng dẫn vận hành shop cho chủ cửa hàng

Tài liệu này dành cho **chủ shop / nhân viên vận hành** — không cần biết kỹ thuật.
Mọi thao tác làm trên web, không cần gọi developer. Tài khoản quản trị đầu tiên:
`admin@lumina.vn` (mật khẩu do người deploy đặt khi cài đặt — xem `docs/runbook.md`).

> Quy ước vai trò trong hệ thống:
> - **Admin** — chủ shop: toàn quyền (sản phẩm, giá, tiền, nhân sự, nội dung).
> - **Staff** — nhân viên vận hành: đơn hàng, kho, kiểm duyệt đánh giá, thu cũ. KHÔNG được: sửa sản phẩm, đổi giá, hoàn tiền, quản lý tài khoản.
>
> Khi mở nhân viên mới: vào **Khách hàng → đổi vai trò thành Staff** (xem mục 8).

## 1. Đăng nhập

1. Mở trang web, bấm **Đăng nhập** (góc phải).
2. Nhập email + mật khẩu admin.
3. Nếu tài khoản đã bật **2FA** (khuyến nghị bật, xem mục 10): nhập mã 6 số từ app xác thực (Google Authenticator / 1Password) hoặc mã dự phòng 8 ký tự dạng `XXXX-XXXX`.
4. Vào `/admin` (menu **Quản trị** xuất hiện sau khi đăng nhập).

**Quên mật khẩu admin?** Dùng trang **Quên mật khẩu** như khách hàng; email đặt lại đến hộp thư admin. Mất cả 2FA: một admin KHÁC vào **Khách hàng → Thu hồi phiên** rồi reset thủ công — vì vậy shop nên có **ít nhất 2 tài khoản admin**.

## 2. Dashboard

Trang đầu tiên sau khi vào `/admin`:

- **Đơn hôm nay / Doanh thu** (tính trên đơn đã thanh toán), số sản phẩm, đánh giá chờ duyệt.
- **Biểu đồ đơn 14 ngày** + 5 đơn mới nhất.
- **Menu bên trái có số đỏ** = việc cần làm ngay: đơn chờ (`pending`), đánh giá chờ duyệt, thu cũ chờ báo giá, hàng sắp hết (tồn ≤ 2).

Quy tắc ngày: đơn `pending` quá 2 tiếng chưa thanh toán → nhắc khách (gọi/SMS bằng thông tin liên hệ trong đơn); quá 12 tiếng → hủy để trả hàng về kho (script `payment:reconcile` cũng tự quét — xem `docs/runbook.md` mục Cron).

## 3. Thêm / sửa sản phẩm

**Sản phẩm → Thêm sản phẩm.** Các trường:

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Tên, Slug (URL), SKU | ✔ | Slug/SKU không trùng sản phẩm cũ |
| Thương hiệu, Danh mục, Nhóm con | ✔ | dùng đúng chính tả để lọc hoạt động |
| Giá bán (VND nguyên), Tồn kho | ✔ | giá SALE đặt thêm "Giá so sánh" |
| Ngày hết hạn KM | — | có sale + ngày tương lai thì Google hiện gạch giá |
| Ảnh thumbnail | — | bấm **Tải ảnh lên** (cần cấu hình lưu trữ ảnh — không có thì dán link ảnh `https://` vào ô thủ công) |
| Nhãn (badges), tags | — | tag ảnh hưởng bộ lọc — viết gọn, không dấu |

**Lưu** → sản phẩm lên web gần như tức thì (trang catalogue tự làm mới). Sửa/xóa tương tự: vào **Sản phẩm**, bấm dòng sản phẩm.

- **Xóa sản phẩm**: chỉ cho xóa khi CHƯA có đơn/đánh giá nào (giữ lịch sử). Đã bán rồi thì đặt Tồn kho = 0 + trạng thái "Ngừng bán" để ẩn khỏi web.
- **Nhiều sản phẩm cùng lúc**: dùng **Nhập CSV** (mục 7).

## 4. Quản lý tồn kho

**Kho** — ba loại phiếu:

- **Nhập kho (in)**: hàng về từ nhà cung cấp.
- **Xuất kho (out)**: hư hỏng, trưng bày, thất thoát.
- **Chốt số (set)**: kiểm kê phát hiện lệch — hệ thống ghi lệch = chốt − hiện tại.

Mỗi phiếu **bắt buộc ghi lý do ≥ 3 ký tự**. Dưới bảng là **lịch sử biến động 100 dòng** — mọi thay đổi tồn đều có dấu vết: bán hàng, hủy đơn, hoàn tiền, nhập tay.

Lưu ý quan trọng: **tồn kho chỉ nên đổi qua trang Kho hoặc đơn hàng**. Đổi trực tiếp field "Tồn kho" khi sửa sản phẩm KHÔNG ghi lịch sử — chỉ dùng khi chấp nhận mất dấu vết.

## 5. Đơn hàng

**Đơn hàng** — vòng đời một đơn (chỉ đi tới, không lùi):

```
Chờ thanh toán → Đã thanh toán → Đang xử lý → Đã giao → Hoàn tất
       │              │              │
       └── Hủy ←───────┴────── Hủy ───┘
                      └── Hoàn tiền
```

Việc cần làm theo trạng thái:

| Trạng thái | Shop cần làm |
|---|---|
| Chờ thanh toán | đợi khách trả qua VNPay/COD — xem 2. |
| Đã thanh toán | **gói hàng + bàn giao vận đơn** (mục 6), đổi trạng thái "Đang xử lý" |
| Đang xử lý | khi shipper lấy hàng → đổi "Đã giao", điền mã vận đơn |
| Đã giao | khách nhận rồi → "Hoàn tất" (đánh giá mới được mở cho khách) |
| Hủy / Hoàn tiền | tồn kho tự trả về, mã giảm giá tự hoàn lượt — không làm tay |

**Hoàn tiền (chỉ admin)**: nút **Hoàn tiền VNPay** hiện với đơn đã thanh toán qua VNPay. Hệ thống gọi VNPay hoàn TOÀN BỘ số tiền, đối chiếu chữ ký phản hồi, chỉ khi VNPay xác nhận mới chuyển đơn sang "Hoàn tiền" + trả hàng về kho. Hiện tại chỉ hỗ trợ hoàn toàn bộ — hoàn một phần phải làm trên cổng VNPay rồi dùng đổi trạng thái tay.

**Xuất danh sách**: **Xuất CSV** — lọc theo trạng thái/khoảng ngày, mở được bằng Excel tiếng Việt (file có BOM).

## 6. Vận đơn (GHN / GHTK / tự giao)

Trên mỗi đơn: **Nhà vận chuyển** (GHN/GHTK/Nhập tay) + **Mã vận đơn**.

- Nhà shop chưa kết nối API vận chuyển: tự in đơn trên app GHN/GHTK, rồi **dán mã vận đơn vào** để khách tra cứu. Format mã: GHN `~ \d{6,}`... (hệ thống tự kiểm tra định dạng).
- Muốn hệ thống tự tính phí + tạo vận đơn GHN: cần cấu hình token (xem `docs/shipping-integration.md` — việc một lần của người kỹ thuật).

## 7. Nhập sản phẩm hàng loạt (CSV)

**Sản phẩm → Nhập CSV** — dán nội dung CSV rồi:

1. **Kiểm tra trước (dry-run)**: liệt kê dòng hợp lệ/lỗi (thiếu cột, giá sai định dạng...), hiện vài dòng mẫu.
2. Sửa file, kiểm tra lại đến khi sạch.
3. **Nhập thật**: sản phẩm tồn tại (trùng slug) thì CẬP NHẬT, sản phẩm mới thì THÊM. Thay đổi tồn kho đều ghi sổ kho.

Giới hạn 500 dòng/lần. Cột bắt buộc: `slug,sku,name,brand,category,price,stock`. File mẫu lấy bằng cách xuất… hãy copy header từ dry-run lỗi đầu tiên (hệ thống báo thiếu cột nào).

## 8. Khách hàng & nhân sự

**Khách hàng** — tìm theo email/tên; mỗi người hiện số đơn + số đánh giá. Với từng người:

- **Đổi vai trò** customer ↔ staff ↔ admin (dropdown, lưu ngay).
- **Khóa tài khoản**: chặn đăng nhập, **đá toàn bộ phiên đang đăng nhập** ngay lập tức — dùng cho spam/lừa đơn. Khách vẫn giữ lịch sử đơn.
- **Thu hồi phiên**: mất máy/c nghi lộ tài khoản — đăng xuất họ khỏi mọi thiết bị mà không xóa tài khoản.
- **Xóa tài khoản**: chỉ khi chắc chắn; đơn/đánh giá giữ nguyên (ẩn danh).

Chặn nâng admin cuối cùng / tự hạ chính mình — hệ thống từ chối để shop không mất quyền quản trị.

## 9. Đánh giá sản phẩm

Đánh giá của khách **không hiện ngay** — vào **Đánh giá → Chờ duyệt**:

- **Duyệt**: hiện công khai; điểm sản phẩm tự tính lại (trung bình có trọng số với lượt đánh giá nền).
- **Từ chối / Xóa**: không hiện, không ảnh hưởng điểm.
- Ảnh kèm đánh giá đầu tiên có phần thưởng coupon — hệ thống tự phát khi bạn duyệt.

Bật **Duyệt nhanh** cả tab "Tất cả" để xem lại cái đã duyệt. Khoan dung với đánh giá 3 sao có nội dung thật — xóa hết đánh giá trái chiều làm shop mất uy tín.

## 10. Bảo mật tài khoản shop (đọc một lần)

- **Bật 2FA ngay** (Tài khoản → Bật 2FA): quét mã QR bằng Google Authenticator, nhập mã xác nhận, **lưu 8 mã dự phòng** ra nơi an toàn (mỗi mã dùng 1 lần khi mất điện thoại). Dashboard hiện cảnh báo vàng cho admin chưa bật.
- **Đừng bao giờ** gửi mật khẩu qua chat/email; mỗi nhân viên một tài khoản riêng (đặt vai trò Staff) — đừng dùng chung admin.
- Mọi thao tác nhạy cảm (đổi giá, hoàn tiền, khóa khách) được ghi vào **Nhật ký kiểm tra** trên dashboard — ai làm gì, lúc nào.
- Cảm thấy bất thường: đổi mật khẩu ngay (tài khoản tự mất phiên), rồi liên hệ người vận hành hệ thống.

## 11. Banner thông báo trên web

**Nội dung → Thông báo**: bật/tắt banner, nhập nội dung + link. Lưu là hiện ngay trên đầu mọi trang. Dùng cho khuyến mãiFlash, thông báo nghỉ lễ.

## 12. Khi có sự cố

| Tình huống | Xử lý |
|---|---|
| Không vào được /admin | kiểm tra mạng → thử đăng nhập lại → xem `docs/runbook.md` mục sự cố |
| Web chậm / treo | chờ 1–2 phút, tải lại; kéo dài → gọi người vận hành (số trong runbook) |
| Đơn thanh toán nhưng trạng thái vẫn "Chờ" | VNPay đôi khi báo chậm 1–2 phút; quá 5 phút chưa tự chuyển → chạy đối soát (`npm run payment:reconcile`) hoặc gọi người vận hành — KHÔNG đổi trạng thái tay khi chưa chắc tiền đã về |
| Khách hỏi "đơn tôi ở đâu?" | mã đơn dạng `LUM-XXXX` + email khách tra trong **Đơn hàng**; khách vãng lai tự tra bằng trang "Tra cứu đơn" |
| Đánh giá spam | Từ chối + **Khóa tài khoản** khách spam |

---

*Cập nhật lần cuối: 2026-09-14. Gặp khó ở màn hình nào — chụp màn hình gửi người vận hành; tài liệu này sẽ được bổ sung.*
