import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chính Sách Đổi Trả & Vận Chuyển" };

const STEPS = [
  { step: "Bước 1", text: "Liên hệ concierge trong 30 ngày kể từ bàn giao, cung cấp số hóa đơn và tình trạng thiết bị." },
  { step: "Bước 2", text: "Kỹ thuật viên thẩm định thiết bị tại studio (miễn phí) — kiểm tra phụ kiện, cảm biến, số serial." },
  { step: "Bước 3", text: "Chọn đổi sang phân hệ khác (trừ/k cộng chênh lệch) hoặc hoàn tiền qua phương thức thanh toán gốc." },
  { step: "Bước 4", text: "Hoàn tiền xử lý trong 5–7 ngày làm việc sau khi thiết bị về kho." },
];

export default function ReturnsPage() {
  return (
    <article className="container-page flex flex-col gap-space-lg py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">PHÁP LÝ & MINH BẠCH</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Đổi Trả & Vận Chuyển</h1>
        <p className="font-body-sm text-body-sm text-outline">Cập nhật lần cuối: 09/2026</p>
      </header>

      <section className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Quy trình đổi mới 30 ngày</h2>
        <ol className="flex flex-col gap-space-sm pt-space-xs">
          {STEPS.map((s) => (
            <li key={s.step} className="flex items-start gap-space-sm">
              <span className="mt-0.5 shrink-0 rounded bg-primary/20 px-space-xs py-0.5 font-telemetry-xs text-telemetry-xs font-bold uppercase text-primary">{s.step}</span>
              <span className="font-body-md text-body-md leading-relaxed text-on-surface-variant">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Vận chuyển</h2>
        <ul className="flex flex-col gap-space-xs font-body-md text-body-md leading-relaxed text-on-surface-variant">
          <li>• Miễn phí vận chuyển toàn quốc cho đơn từ 20.000.000 ₫; đơn dưới ngưỡng tính phí 350.000 ₫.</li>
          <li>• Giao nhanh 24h nội thành HCM & Hà Nội với kỹ thuật viên hướng dẫn setup tận nơi.</li>
          <li>• Mọi thiết bị được đóng gói chống sốc chuẩn hàng dễ vỡ và bảo hiểm giá trị trọn gói trong quá trình vận chuyển.</li>
          <li>• Bạn được kiểm tra thiết bị trước khi ký nhận; từ chối nhận nếu phát hiện sai lệch mà không mất phí.</li>
        </ul>
      </section>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Xem thêm <Link href="/legal/terms" className="text-primary hover:underline">Điều khoản sử dụng</Link>.
      </p>
    </article>
  );
}
