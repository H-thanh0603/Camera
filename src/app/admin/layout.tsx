import Link from "next/link";
import { isAdmin } from "@/lib/server/admin";

/**
 * Guard server-side cho toàn bộ /admin: role tra từ DB theo session.
 * Client không thể tự "mở khóa" — API cũng guard riêng từng route.
 */

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/products", label: "Sản phẩm", icon: "inventory_2" },
  { href: "/admin/orders", label: "Đơn hàng", icon: "receipt_long" },
  { href: "/admin/reviews", label: "Kiểm duyệt", icon: "rate_review" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-space-md py-space-3xl text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
          <span className="material-symbols-outlined text-[32px] text-error" aria-hidden="true">lock</span>
        </div>
        <span className="section-telemetry">VÙNG HẠN CHẾ</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Chỉ Admin Mới Vào Được</h1>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Đăng nhập bằng tài khoản admin (seed mặc định: admin@lumina.vn) rồi quay lại đây.
        </p>
        <Link href="/account" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
          Đến trang đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page flex flex-col gap-space-lg py-space-lg">
      <nav aria-label="Điều hướng admin" className="flex flex-wrap items-center gap-space-xs rounded-xl bg-surface-container p-space-2xs shadow-xl">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-space-2xs rounded-lg px-space-md py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
