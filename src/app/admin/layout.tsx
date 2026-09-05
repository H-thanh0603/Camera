import Link from "next/link";
import { redirect } from "next/navigation";
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

  // Chặn trước khi render: redirect thay vì render lock UI (tránh streaming double-render)
  if (!admin) redirect("/account");

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
