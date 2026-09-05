import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { recentAuditLogs } from "@/lib/server/audit";
import { formatVND, formatDate, cn } from "@/lib/utils/format";

export const metadata = { title: "Admin Dashboard" };

const STATUS_CLASS: Record<string, string> = {
  pending: "text-secondary",
  paid: "text-primary",
  processing: "text-tertiary",
  shipped: "text-tertiary",
  delivered: "text-primary",
  cancelled: "text-error",
  refunded: "text-error",
};

export default async function AdminDashboardPage() {
  const [orderCount, productCount, pendingReviewCount, paidOrders, recentOrders, auditLogs] = await Promise.all([
    prisma.order.count(),
    prisma.product.count(),
    prisma.review.count({ where: { approved: false } }),
    prisma.order.findMany({
      where: { status: { in: ["paid", "processing", "shipped", "delivered"] } },
      select: { totals: true },
    }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { lines: true } }),
    recentAuditLogs(8),
  ]);

  // SQLite Json: tổng tiền tính ở application level từ totals.total
  const revenue = paidOrders.reduce((sum, o) => sum + ((o.totals as { total?: number })?.total ?? 0), 0);

  const stats = [
    { label: "Đơn hàng", value: String(orderCount), icon: "receipt_long", href: "/admin/orders" },
    { label: "Doanh thu xác nhận", value: formatVND(revenue), icon: "payments", href: "/admin/orders" },
    { label: "Sản phẩm", value: String(productCount), icon: "inventory_2", href: "/admin/products" },
    { label: "Review chờ duyệt", value: String(pendingReviewCount), icon: "rate_review", href: "/admin/reviews" },
  ];

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">LUMINA OPS CENTER</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Admin Dashboard</h1>
      </header>

      <section className="grid grid-cols-2 gap-space-md lg:grid-cols-4" aria-label="Thống kê">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="flex flex-col gap-space-2xs rounded-xl bg-surface-container p-space-lg shadow-xl transition-colors hover:bg-surface-container-high">
            <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">{s.icon}</span>
            <span className={cn("font-headline-sm text-headline-sm text-on-surface", s.value.length > 12 && "text-headline-sm-mobile")}>{s.value}</span>
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{s.label}</span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container p-space-lg shadow-xl" aria-label="Đơn hàng gần đây">
        <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Đơn Hàng Gần Đây</h2>
        {recentOrders.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">Chưa có đơn hàng nào.</p>
        ) : (
          <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low px-space-sm py-space-xs">
                <span className="font-telemetry-data text-telemetry-data text-on-surface">{o.number}</span>
                <span className="text-on-surface-variant">{formatDate(o.createdAt.toISOString())}</span>
                <span className={cn("font-telemetry-xs text-telemetry-xs uppercase", STATUS_CLASS[o.status])}>{o.status}</span>
                <span className="font-telemetry-data text-telemetry-data text-primary">
                  {formatVND((o.totals as { total?: number })?.total ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container p-space-lg shadow-xl" aria-label="Nhật ký quản trị">
        <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Nhật Ký Quản Trị</h2>
        {auditLogs.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">Chưa có thao tác nào được ghi.</p>
        ) : (
          <ul className="flex flex-col gap-space-2xs font-telemetry-xs text-telemetry-xs text-on-surface-variant">
            {auditLogs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low px-space-sm py-space-2xs">
                <span className="text-primary uppercase">{log.action}</span>
                <span className="text-on-surface-variant">{log.user?.email ?? "system"} → {log.targetId.slice(0, 18)}</span>
                <span className="text-outline">{formatDate(log.createdAt.toISOString())}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
