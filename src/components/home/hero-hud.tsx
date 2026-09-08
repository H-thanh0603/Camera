"use client";

import Link from "next/link";

/**
 * Hero Section 1 — video nền full-bleed + nội dung trái.
 * H1 giữ nguyên text (SEO + E2E catalog.spec phụ thuộc).
 */
export function HeroHud() {
  return (
    <section className="relative flex min-h-[94vh] w-full select-none items-end overflow-hidden bg-surface-container-lowest">
      {/* Video nền — cùng reel CraftFilm, cover kín, không crop chữ */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/videos/craft.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/20 to-surface-container-lowest/30" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface-container-lowest/50 via-transparent to-transparent" aria-hidden="true" />

      {/* Telemetry top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-space-md font-telemetry-xs text-telemetry-xs tracking-widest lg:p-space-xl">
        <div className="flex items-center gap-space-2xs rounded-lg bg-surface-container-low/80 px-space-xs py-space-2xs shadow-sm backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-error" aria-hidden="true" />
          <span className="font-semibold tracking-wider text-on-surface">REC [8K 60P PRORES HQ]</span>
        </div>
        <div className="hidden items-center gap-space-2xs rounded-lg bg-surface-container-low/80 px-space-sm py-space-2xs shadow-sm backdrop-blur-md sm:flex">
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">battery_full</span>
          <span className="font-bold text-on-surface">98% (2h 45m)</span>
        </div>
      </div>

      {/* Nội dung */}
      <div className="relative z-20 mx-auto flex w-full max-w-container-max flex-col gap-space-md px-gutter-mobile pb-space-2xl pt-40 lg:px-gutter-desktop">
        <div className="flex flex-wrap items-center gap-space-xs">
          <span className="rounded-lg bg-primary/20 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase tracking-widest text-primary">
            FLAGSHIP CINEMA EDITION
          </span>
          <span className="rounded-lg bg-surface-container-high/90 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase tracking-wider text-on-surface-variant">
            CHẾ TÁC THỦ CÔNG TẠI WETZLAR & KYOTO
          </span>
        </div>
        <h1 className="max-w-4xl font-display-hero text-display-hero-mobile leading-[1.08] tracking-tight text-on-surface drop-shadow-lg lg:text-display-hero">
          Nghệ Thuật Thu Nhận Ánh Sáng Ở Đẳng Cấp <span className="italic text-primary">Thuần Khiết.</span>
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
          Cảm biến <strong className="font-semibold text-on-surface">61.2MP BSI CMOS</strong>, dải tương phản động 15+ EV — bộc lộ độ sâu tinh vi nhất của bóng tối và hào quang.
        </p>

        <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
          <Link
            href="/products/lumina-x1-monolith"
            className="group flex items-center gap-space-xs rounded-lg bg-primary px-space-xl py-space-md font-headline-sm text-headline-sm uppercase tracking-wider text-on-primary shadow-[0_12px_40px_rgba(242,202,80,0.25)] transition-all hover:bg-primary-fixed-dim"
          >
            <span>Khám phá X-1 Monolith</span>
            <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
          </Link>
          <Link
            href="/products"
            className="flex items-center gap-space-xs rounded-lg bg-surface-container-high/80 px-space-lg py-space-md font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface shadow-md backdrop-blur-md transition-all hover:bg-surface-container-highest"
          >
            <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">photo_library</span>
            <span>Xem toàn bộ Vault</span>
          </Link>
        </div>

        {/* Spec rút gọn 1 hàng */}
        <dl className="flex flex-wrap gap-x-space-xl gap-y-space-2xs pt-space-md font-telemetry-data text-telemetry-data">
          {[
            ["61.2 MP", "Full-Frame BSI"],
            ["15+ EV", "Dynamic Range"],
            ["8.5 stops", "IBIS 5 trục"],
            ["759 điểm", "AF AI 0.02s"],
          ].map(([value, label]) => (
            <div key={label} className="flex items-baseline gap-space-2xs">
              <dt className="sr-only">{label}</dt>
              <dd className="font-bold text-primary">{value}</dd>
              <dd className="text-on-surface-variant">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
