import Link from "next/link";
import { NewsletterForm } from "@/components/layout/newsletter-form";

const COLLECTION_LINKS = [
  { label: "Máy ảnh Medium Format 100MP", href: "/products?category=camera&tag=medium_format" },
  { label: "Ống kính Cine Anamorphic 2x", href: "/products?category=lens&tag=cine" },
  { label: "Hệ thống T* Coating Prime T1.3", href: "/products?category=lens" },
  { label: "Chân máy Carbon Hàng không", href: "/products?category=tripod" },
  { label: "Thiết bị lưu trữ 8K RAW", href: "/products?category=storage" },
];

const CONCIERGE_LINKS = [
  { label: "Lên lịch Trải nghiệm Studio 1:1", href: "/camera-finder" },
  { label: "Đo quang sai chuẩn MTF", href: "/products?category=lens" },
  { label: "So sánh hệ thống máy ảnh", href: "/compare" },
  { label: "Tìm máy ảnh phù hợp", href: "/camera-finder" },
  { label: "Bảo hành toàn cầu Lumina Care+", href: "/#concierge" },
];

export function Footer() {
  return (
    <footer className="w-full bg-surface-container-lowest py-space-3xl text-on-surface-variant">
      <div className="mx-auto flex w-full max-w-container-max flex-col gap-space-2xl px-gutter-mobile lg:px-gutter-desktop">
        <div className="grid grid-cols-1 gap-space-xl md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-space-md lg:col-span-2">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-md text-headline-md uppercase tracking-wider text-on-surface">LUMINA OPTICS</span>
            </div>
            <p className="max-w-md font-body-md text-body-md">
              Không gian trưng bày và phân phối thiết bị quang học cine, medium format cao cấp hàng đầu Việt Nam. Mỗi thành phẩm đều trải qua quy trình kiểm chuẩn quang sai nghiêm ngặt với hệ chuẩn collimator công nghiệp.
            </p>
            <div className="flex items-center gap-space-md pt-space-xs">
              <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Bảo chứng đối tác ủy quyền:</span>
              <div className="flex items-center gap-space-sm text-on-surface">
                <span className="font-headline-sm text-headline-sm tracking-widest">LEICA</span>
                <span className="text-outline">|</span>
                <span className="font-headline-sm text-headline-sm tracking-widest">HASSELBLAD</span>
                <span className="text-outline">|</span>
                <span className="font-headline-sm text-headline-sm tracking-widest">SONY CINE</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-space-sm">
            <span className="font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface">Phân hệ Tuyệt tác</span>
            <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm">
              {COLLECTION_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-primary">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-space-sm">
            <span className="font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface">Đặc quyền Concierge</span>
            <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm">
              {CONCIERGE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-primary">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-space-md">
            <span className="font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface">Masterclass & Journal</span>
            <p className="font-body-sm text-body-sm">
              Nhận thư tin độc quyền về kỹ thuật điện ảnh và mời tham dự các buổi thẩm định quang học giới hạn.
            </p>
            <NewsletterForm />
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">verified</span>
              <span className="font-telemetry-xs text-telemetry-xs text-outline">100% NHẬP KHẨU CHÍNH NGẠCH NGUYÊN SEAL</span>
            </div>
          </div>
        </div>

          <div className="flex flex-col items-center justify-between gap-space-md rounded-lg bg-surface-container-low/30 px-space-md py-space-sm md:flex-row">
          <div className="flex items-center gap-space-md font-telemetry-xs text-telemetry-xs text-outline">
            <span>PATENT NO. VN-OPTIC-8842-X</span>
            <span>ISO 9001:2015 CERTIFIED BENCH</span>
            <span>CALIBRATED TO ZERO RUNOUT</span>
          </div>
          <div className="flex items-center gap-space-md">
            <Link href="/legal/privacy" className="font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-primary">Bảo mật</Link>
            <Link href="/legal/terms" className="font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-primary">Điều khoản</Link>
            <Link href="/legal/returns" className="font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-primary">Đổi trả</Link>
            <span className="font-body-sm text-body-sm text-outline">© 2024–2026 LUMINA OPTICS. TOÀN BỘ QUYỀN ĐƯỢC BẢO LƯU. KIẾN TẠO CHO ĐIỆN ẢNH ĐỈNH CAO.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
