"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils/format";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  /** Số việc tồn (hiển thị badge khi > 0). */
  badge?: number;
}

/**
 * Vỏ console quản trị: sidebar desktop + topbar mobile, active state theo
 * route, badge tồn việc, lối về cửa hàng + đăng xuất. Guard vẫn ở server
 * (layout) — shell chỉ lo hiển thị.
 */
export function AdminShell({
  items,
  email,
  children,
}: {
  items: AdminNavItem[];
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useStore();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="container-page flex flex-col gap-space-lg py-space-lg lg:flex-row lg:items-start">
      <aside className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-md shadow-xl lg:sticky lg:top-32 lg:w-64 lg:shrink-0">
        <div className="hidden flex-col gap-space-2xs border-b border-surface-container-high pb-space-sm lg:flex">
          <span className="section-telemetry">LUMINA OPS CENTER</span>
          <span className="truncate font-body-sm text-body-sm text-on-surface-variant" title={email}>
            {email}
          </span>
        </div>
        <nav aria-label="Điều hướng admin" className="flex gap-space-2xs overflow-x-auto lg:flex-col">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-space-2xs rounded-lg px-space-md py-space-xs font-telemetry-data text-telemetry-data uppercase transition-colors",
                isActive(item.href)
                  ? "bg-primary/15 text-primary ring-1 ring-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="ml-auto rounded-full bg-error px-space-2xs font-telemetry-xs text-telemetry-xs font-bold text-on-primary"
                  aria-label={`${item.badge} việc tồn`}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="hidden flex-col gap-space-2xs border-t border-surface-container-high pt-space-sm lg:flex">
          <Link
            href="/"
            className="flex items-center gap-space-2xs rounded-lg px-space-md py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">storefront</span>
            Về cửa hàng
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push("/");
            }}
            className="flex items-center gap-space-2xs rounded-lg px-space-md py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">logout</span>
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-space-lg">{children}</div>
    </div>
  );
}
