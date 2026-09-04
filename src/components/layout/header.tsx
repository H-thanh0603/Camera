"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IMG } from "@/lib/data/images";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils/format";

const NAV_LINKS = [
  { label: "Máy ảnh Flagship", href: "/products?category=camera&tag=flagship" },
  { label: "Ống kính Cine & Prime", href: "/products?category=lens" },
  { label: "Hệ thống Medium Format", href: "/products?category=camera&tag=medium_format" },
  { label: "Phụ kiện Studio", href: "/products?category=lighting" },
  { label: "Dịch vụ Đổi mới & Thu cũ", href: "/#concierge" },
  { label: "Lumina Journal", href: "/journal" },
];

export function Header() {
  const { cartSnapshot, wishlist, user, setSearchOpen, setCartDrawerOpen, hydrated } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Phím tắt ⌘K / Ctrl+K mở search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSearchOpen]);

  const cartCount = cartSnapshot.totals.itemCount;
  const wishlistCount = wishlist.length;

  return (
    <header className="fixed top-0 z-50 w-full bg-surface-container-lowest/85 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-container-max items-center justify-between gap-space-md px-gutter-mobile lg:px-gutter-desktop">
        <div className="flex shrink-0 items-center gap-space-lg">
          <Link href="/" className="group flex items-center gap-space-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="LUMINA Optics Logo" className="h-8 w-auto object-contain" src={IMG.logo} />
            <span className="flex flex-col">
              <span className="font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface transition-colors group-hover:text-primary">LUMINA OPTICS</span>
              <span className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-outline">PRECISION CINEMA APPARATUS</span>
            </span>
          </Link>
          <div className="hidden items-center gap-space-2xs rounded-full bg-surface-container-high px-space-xs py-space-2xs xl:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-primary">SENSOR 61MP RAW ONLINE</span>
          </div>
        </div>

        <nav className="hidden items-center gap-space-md lg:flex" aria-label="Điều hướng chính">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="px-space-xs py-space-2xs font-body-sm text-body-sm uppercase tracking-wider text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-space-sm">
          <div className="hidden items-center rounded-lg bg-surface-container px-space-xs py-space-2xs sm:flex" aria-label="Đơn vị tiền tệ: VND">
            <button type="button" className="px-space-2xs font-telemetry-xs text-telemetry-xs text-primary" aria-pressed="true">VND</button>
            <span className="font-telemetry-xs text-telemetry-xs text-outline">/</span>
            <button type="button" className="px-space-2xs font-telemetry-xs text-telemetry-xs text-on-surface-variant hover:text-on-surface" title="Sắp có sẵn">USD</button>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-space-2xs rounded-lg bg-surface-container-low px-space-xs py-space-2xs text-on-surface-variant transition-colors hover:text-on-surface"
            aria-label="Tìm kiếm sản phẩm"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">search</span>
            <span className="hidden rounded bg-surface-container-high px-space-2xs font-telemetry-xs text-telemetry-xs text-outline md:inline">⌘K</span>
          </button>

          <Link
            href="/wishlist"
            className="relative p-space-2xs text-on-surface-variant transition-colors hover:text-on-surface"
            aria-label={`Wishlist${wishlistCount ? ` — ${wishlistCount} sản phẩm` : ""}`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">favorite</span>
            <Badge value={wishlistCount} tone="gold" />
          </Link>

          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="relative p-space-2xs text-on-surface-variant transition-colors hover:text-on-surface"
            aria-label={`Giỏ hàng${cartCount ? ` — ${cartCount} sản phẩm` : " trống"}`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">shopping_bag</span>
            <Badge value={cartCount} tone="container" />
          </button>

          <Link
            href="/account"
            className="hidden items-center gap-space-2xs rounded-lg bg-primary px-space-sm py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary shadow-[0_8px_32px_rgba(212,175,55,0.15)] transition-all hover:bg-primary-fixed-dim md:flex"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">support_agent</span>
            <span>{user ? user.name.split(" ")[0] : "Tư vấn chuyên gia"}</span>
          </Link>

          <Link
            href="/account"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary"
            aria-label={user ? `Tài khoản ${user.name}` : "Đăng nhập / Tài khoản"}
          >
            <span className="material-symbols-outlined text-[18px] text-on-primary" aria-hidden="true">
              {hydrated && user ? "person" : "person_outline"}
            </span>
          </Link>

          <button
            type="button"
            className="p-space-2xs text-on-surface-variant transition-colors hover:text-on-surface lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">{mobileOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav className="border-t border-surface-container-high bg-surface-container-lowest px-gutter-mobile py-space-md lg:hidden" aria-label="Menu di động">
          <ul className="flex flex-col gap-space-xs">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-space-sm py-space-xs font-body-md text-body-md uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

function Badge({ value, tone }: { value: number; tone: "gold" | "container" }) {
  if (!hydratedCountable(value)) return null;
  return (
    <span
      className={cn(
        "absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full font-telemetry-xs text-telemetry-xs font-bold",
        tone === "gold" ? "bg-primary text-on-primary" : "bg-primary-container text-on-primary-container",
      )}
    >
      {value > 9 ? "9+" : value}
    </span>
  );
}

function hydratedCountable(value: number) {
  // Đếm chỉ hiển thị sau hydrate để tránh mismatch — Badge được render client-side.
  return value > 0;
}
