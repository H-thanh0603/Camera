import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Điều Khoản Sử Dụng" };

const SECTIONS = [
  {
    title: "1. Điều khoản giao dịch",
    body: [
      "Mọi đơn hàng trên luminaoptics.vn chỉ có hiệu lực sau khi Lumina Optics xác nhận (tổng đài hoặc email). Giá hiển thị trên website đã bao gồm VAT và được xác minh lại trên hệ thống tại thời điểm đặt hàng — trường hợp chênh lệch do trễ cập nhật, chúng tôi sẽ liên hệ và bạn có quyền hủy mà không mất phí.",
    ],
  },
  {
    title: "2. Giá và thanh toán",
    body: [
      "Giá niêm yết áp dụng cho thanh toán chuyển khoản và quẹt thẻ khi nhận máy. Trả góp 0% qua thẻ tín dụng áp dụng theo chương trình của ngân hàng phát hành tại thời điểm giao dịch. COD áp dụng cho đơn dưới 200 triệu.",
    ],
  },
  {
    title: "3. Bảo hành",
    body: [
      "Thiết bị chính hãng bảo hành theo chính sách của nhà sản xuất, tối thiểu 12 tháng; gói Lumina Care+ nâng lên 5 năm bảo hành tận nơi. Bảo hành không áp dụng với hư hỏng do va đập, ngấm nước, tự ý can thiệp phần cứng, hoặc thiết bị đã sửa chữa bên ngoài.",
    ],
  },
  {
    title: "4. Đổi mới 30 ngày",
    body: [
      "Trong 30 ngày kể từ bàn giao, bạn có thể đổi sang phân hệ khác với giá trị hóa đơn tương đương, điều kiện thiết bị còn nguyên phụ kiện và không có hư hỏng vật lý. Chi phí chênh lệch (nếu có) được trừ/k cộng vào hóa đơn mới.",
    ],
  },
  {
    title: "5. Trách nhiệm người dùng",
    body: [
      "Bạn cam kết cung cấp thông tin chính xác khi đặt hàng và không sử dụng website cho mục đích gian lận. Chúng tôi có quyền từ chối giao dịch khi có dấu hiệu bất thường mà không cần báo trước.",
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="container-page flex flex-col gap-space-lg py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">PHÁP LÝ & MINH BẠCH</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Điều Khoản Sử Dụng</h1>
        <p className="font-body-sm text-body-sm text-outline">Cập nhật lần cuối: 09/2026</p>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-lg">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p.slice(0, 24)} className="font-body-md text-body-md leading-relaxed text-on-surface-variant">{p}</p>
          ))}
        </section>
      ))}
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Xem thêm <Link href="/legal/privacy" className="text-primary hover:underline">Chính sách bảo mật</Link> và{" "}
        <Link href="/legal/returns" className="text-primary hover:underline">Chính sách đổi trả</Link>.
      </p>
    </article>
  );
}
