import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/server/admin";
import { getSessionUser } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Guard server-side cho toàn bộ /admin: role tra từ DB theo session.
 * Client không thể tự "mở khóa" — API cũng guard riêng từng route.
 * Layout đồng thời tải badge tồn việc cho sidebar console.
 */

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();

  // Chặn trước khi render: redirect thay vì render lock UI (tránh streaming double-render)
  if (!admin) redirect("/account");

  const me = await getSessionUser();
  const [pendingOrders, pendingReviews, newTradeIns, lowStocks] = await Promise.all([
    prisma.order.count({ where: { status: "pending" } }),
    prisma.review.count({ where: { approved: false } }),
    prisma.tradeInLead.count({ where: { status: "new" } }),
    prisma.product.count({ where: { OR: [{ stock: 0 }, { availability: "out_of_stock" }] } }),
  ]);

  return (
    <AdminShell
      email={me?.email ?? ""}
      items={[
        { href: "/admin", label: "Dashboard", icon: "dashboard" },
        { href: "/admin/products", label: "Sản phẩm", icon: "inventory_2", badge: lowStocks },
        { href: "/admin/orders", label: "Đơn hàng", icon: "receipt_long", badge: pendingOrders },
        { href: "/admin/coupons", label: "Mã giảm giá", icon: "sell" },
        { href: "/admin/users", label: "Tài khoản", icon: "group" },
        { href: "/admin/reviews", label: "Kiểm duyệt", icon: "rate_review", badge: pendingReviews },
        { href: "/admin/trade-in", label: "Thu cũ", icon: "autorenew", badge: newTradeIns },
      ]}
    >
      {children}
    </AdminShell>
  );
}
