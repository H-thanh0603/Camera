import { redirect } from "next/navigation";
import { getSessionUserWithRole } from "@/lib/server/admin";
import { prisma } from "@/lib/server/prisma";
import { AdminShell, type AdminNavItem } from "@/components/admin/admin-shell";

/**
 * Guard server-side cho toàn bộ /admin: admin full, staff vận hành
 * (dashboard, kho, đơn, thu cũ, kiểm duyệt). Trang admin-only
 * (sản phẩm, coupon, nội dung, tài khoản) guard riêng bằng requireAdminPage.
 * Layout đồng thời tải badge tồn việc cho sidebar console.
 */

type Role = "admin" | "staff";

const ALL_ITEMS: (AdminNavItem & { roles: Role[] })[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", roles: ["admin", "staff"] },
  { href: "/admin/products", label: "Sản phẩm", icon: "inventory_2", roles: ["admin"] },
  { href: "/admin/stock", label: "Kho hàng", icon: "warehouse", roles: ["admin", "staff"] },
  { href: "/admin/orders", label: "Đơn hàng", icon: "receipt_long", roles: ["admin", "staff"] },
  { href: "/admin/coupons", label: "Mã giảm giá", icon: "sell", roles: ["admin"] },
  { href: "/admin/content", label: "Nội dung", icon: "article", roles: ["admin"] },
  { href: "/admin/users", label: "Tài khoản", icon: "group", roles: ["admin"] },
  { href: "/admin/reviews", label: "Kiểm duyệt", icon: "rate_review", roles: ["admin", "staff"] },
  { href: "/admin/trade-in", label: "Thu cũ", icon: "autorenew", roles: ["admin", "staff"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getSessionUserWithRole();

  // Chặn trước khi render: redirect thay vì render lock UI (tránh streaming double-render)
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/account");
  const role = me.role as Role;

  const [pendingOrders, pendingReviews, newTradeIns, lowStocks] = await Promise.all([
    prisma.order.count({ where: { status: "pending" } }),
    prisma.review.count({ where: { approved: false } }),
    prisma.tradeInLead.count({ where: { status: "new" } }),
    prisma.product.count({ where: { OR: [{ stock: 0 }, { availability: "out_of_stock" }] } }),
  ]);
  const badges: Record<string, number> = {
    "/admin/products": lowStocks,
    "/admin/orders": pendingOrders,
    "/admin/reviews": pendingReviews,
    "/admin/trade-in": newTradeIns,
  };

  return (
    <AdminShell
      email={me.email}
      items={ALL_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
        href: item.href,
        label: item.label,
        icon: item.icon,
        badge: badges[item.href],
      }))}
    >
      {children}
    </AdminShell>
  );
}
