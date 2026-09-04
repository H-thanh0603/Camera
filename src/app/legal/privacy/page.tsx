import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chính Sách Bảo Mật" };

const SECTIONS = [
  {
    title: "1. Dữ liệu chúng tôi thu thập",
    body: [
      "Khi bạn tạo tài khoản hoặc đặt hàng, Lumina Optics thu thập: họ tên, email, số điện thoại và địa chỉ giao hàng. Khi thanh toán, dữ liệu thẻ được xử lý trực tiếp bởi cổng thanh toán — Lumina Optics không lưu trữ số thẻ, CVV hay thông tin nhạy cảm nào của thẻ trên hệ thống.",
      "Dữ liệu hành vi (sản phẩm đã xem, wishlist, giỏ hàng) được lưu trữ cục bộ trên trình duyệt của bạn nhằm cá nhân hóa trải nghiệm và không rời khỏi thiết bị cho tới khi bạn đặt hàng.",
    ],
  },
  {
    title: "2. Mục đích sử dụng",
    body: [
      "Dữ liệu được sử dụng để: xử lý và giao đơn hàng, hỗ trợ kỹ thuật thiết bị (bảo hành, vệ sinh sensor), thông báo trạng thái đơn hàng, và — nếu bạn đăng ký — gửi thư Masterclass. Chúng tôi không bán hay cho thuê dữ liệu cá nhân cho bên thứ ba.",
    ],
  },
  {
    title: "3. Lưu trữ và bảo vệ",
    body: [
      "Mật khẩu được mã hóa một chiều (không thể khôi phục dạng gốc). Phiên đăng nhập dùng cookie httpOnly mà JavaScript phía trình duyệt không đọc được. Quyền truy cập dữ liệu khách hàng nội bộ được giới hạn theo vai trò và ghi nhật ký truy cập.",
    ],
  },
  {
    title: "4. Quyền của bạn",
    body: [
      "Bạn có quyền xem, sửa hoặc yêu cầu xóa dữ liệu cá nhân của mình bất kỳ lúc nào bằng cách liên hệ concierge. Yêu cầu xóa tài khoản được xử lý trong vòng 30 ngày, trừ dữ liệu hóa đơn bắt buộc lưu theo quy định kế toán.",
    ],
  },
  {
    title: "5. Cookie",
    body: [
      "Chúng tôi chỉ dùng cookie bắt buộc (phiên đăng nhập) và localStorage chức năng (giỏ hàng, wishlist). Không có cookie quảng cáo theo dõi của bên thứ ba.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="container-page flex flex-col gap-space-lg py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">PHÁP LÝ & MINH BẠCH</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Chính Sách Bảo Mật</h1>
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
        Câu hỏi về dữ liệu cá nhân? Liên hệ <span className="text-primary">concierge@luminaoptics.vn</span> hoặc xem{" "}
        <Link href="/legal/terms" className="text-primary hover:underline">Điều khoản sử dụng</Link>.
      </p>
    </article>
  );
}
