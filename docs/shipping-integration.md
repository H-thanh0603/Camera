# Tích hợp vận chuyển GHN / GHTK

## Hiện trạng (đã chạy được, không cần API key)

1. Khách đặt hàng, chọn VAT nếu cần (MST validate 10 số).
2. Admin vào `/admin` → đơn hàng → chọn đơn vị (Tự bàn giao/GHN/GHTK),
   nhập mã vận đơn → **Lưu vận đơn**. Khách thấy mã ở trang Tài khoản.
3. Trạng thái đơn đi tiến pending → paid → processing → shipped →
   delivered (không nhảy cóc, đã khóa ở API).

Quy trình tay: concierge tạo đơn trên dashboard GHN/GHTK, copy mã về admin.
Chấp nhận được dưới ~50 đơn/ngày.

## Lên tự động (khi có API key)

1. GHN: dashboard → API → lấy `Token` + `ShopId` → env `GHN_TOKEN`,
   `GHN_SHOP_ID`. GHTK: dashboard → API → `Token` → env `GHTK_TOKEN`.
2. Implement `ShipperAdapter` trong `src/lib/server/shipping.ts`
   (`getShipperAdapter` hiện throw có chủ đích):
   - GHN `POST https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create`
     (headers `Token`, `ShopId`; body: to_name/to_phone/to_address/to_ward_code/
     to_district_id, cod_amount, weight, service_type_id) → `order_code`.
   - GHTK `POST https://services.giaohangtietkiem.vn/services/shipment/order`
     (header `Token`; body order: id/hub/pick_address + products) → `label`.
   - Map tỉnh/huyện/xã của shop sang `district_id/ward_code` GHN (dùng
     `GET .../master-data/district`, cache vào DB 30 ngày — đừng gọi mỗi đơn).
3. Hook vào admin: khi đơn sang `processing` và carrier là ghn/ghtk mà chưa
   có trackingCode → gọi adapter → lưu `trackingCode` (claim updateMany như
   chuyển trạng thái để không tạo trùng khi bấm 2 lần).
4. Webhook trạng thái GHN/GHTK → map về PATCH nội bộ (verify IP/token của
   cổng theo doc của họ, không dùng chung PAYMENT_WEBHOOK_SECRET).
5. Kiểm tra: tạo đơn test, quá trình tạo trùng (double-click) chỉ sinh 1
   vận đơn; hủy đơn sau khi có vận đơn phải gọi API hủy phía cổng + hoàn kho.

## Cước phí

Hiện tại phí cố định theo hình thức (chuẩn 0₫ / nhanh 500k / nhận tại vault 0₫).
Khi đấu API: gọi API tính cước lúc checkout (cache theo tỉnh + khối lượng),
server verify lại trước khi ghi đơn (như đã làm với giá sản phẩm).
