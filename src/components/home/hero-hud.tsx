"use client";

import { useState } from "react";
import { IMG } from "@/lib/data/images";

/** Hero Section 1 — Cinematic Viewfinder HUD (port nguyên vẹn từ prototype). */
export function HeroHud() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section className="relative flex min-h-[92vh] w-full select-none items-center justify-center overflow-hidden bg-surface-container-lowest">
      {/* Cinematic Dark Backdrop Image with Optical Gradient Scrim */}
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Lumina X-1 Monolith 61MP Flagship Mirrorless Camera"
          className="h-full w-full scale-105 object-cover object-center contrast-[1.12] brightness-[0.78]"
          src={IMG.heroBackdrop}
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-surface-container-lowest/60 to-surface-container-lowest/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      </div>

      {/* Live HUD Reticle & Viewfinder Telemetry Grid */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-space-md lg:p-space-xl">
        <div className="flex items-center justify-between font-telemetry-xs text-telemetry-xs tracking-widest text-on-surface-variant/70">
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-2xs rounded-lg bg-surface-container-low/80 px-space-xs py-space-2xs shadow-sm backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-error" aria-hidden="true" />
              <span className="font-semibold tracking-wider text-on-surface">REC [8K 60P PRORES HQ]</span>
            </div>
            <span className="hidden rounded bg-surface-container-low/70 px-space-xs py-space-2xs text-primary backdrop-blur sm:inline-block">COLOR LOG3 • 16-BIT RAW</span>
            <span className="hidden text-outline md:inline-block">TIME: 00:14:38:19</span>
          </div>
          <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low/80 px-space-sm py-space-2xs shadow-sm backdrop-blur-md">
            <span className="font-bold text-primary">RAW UNCOMPRESSED</span>
            <span className="text-outline">|</span>
            <div className="flex items-center gap-space-2xs">
              <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">battery_full</span>
              <span className="font-bold text-on-surface">98% (2h 45m)</span>
            </div>
          </div>
        </div>

        {/* Center Dynamic Crosshair Focus Reticle */}
        <div className="relative flex w-full flex-1 items-center justify-center">
          <div className="relative flex h-64 w-64 items-center justify-center rounded-xl border border-dashed border-primary/25 md:h-96 md:w-96" aria-hidden="true">
            <div className="absolute -left-2 -top-2 h-4 w-4 border-l-2 border-t-2 border-primary" />
            <div className="absolute -right-2 -top-2 h-4 w-4 border-r-2 border-t-2 border-primary" />
            <div className="absolute -bottom-2 -left-2 h-4 w-4 border-b-2 border-l-2 border-primary" />
            <div className="absolute -bottom-2 -right-2 h-4 w-4 border-b-2 border-r-2 border-primary" />
            <div className="h-[1px] w-8 bg-primary/60" />
            <div className="absolute h-8 w-[1px] bg-primary/60" />
            <div className="absolute left-1/4 top-1/3 h-16 w-16 animate-pulse border border-primary flex items-end justify-end p-1">
              <span className="font-telemetry-xs text-[9px] text-primary">AF-C EYE</span>
            </div>
            <div className="absolute -bottom-6 flex items-center gap-space-xs font-telemetry-xs text-telemetry-xs text-primary/80">
              <span>-0.0°</span>
              <div className="flex h-[2px] w-24 items-center justify-center bg-primary/40">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <span>HORIZON LOCKED</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-space-sm font-telemetry-data text-telemetry-data">
          <div className="flex items-center gap-space-xs rounded-lg bg-surface-container-low/90 px-space-md py-space-xs shadow-sm backdrop-blur">
            <span className="text-outline">EXPOSURE:</span>
            <span className="font-bold tracking-wider text-primary">1/8000s</span>
            <span className="text-outline">/</span>
            <span className="font-bold tracking-wider text-primary">f/1.2</span>
            <span className="text-outline">/</span>
            <span className="font-bold tracking-wider text-primary">ISO 100</span>
            <span className="text-outline">/</span>
            <span className="text-on-surface">50mm F/1.2 ASPH</span>
          </div>
          <div className="hidden items-center gap-space-sm font-telemetry-xs text-outline lg:flex">
            <span>CALIBRATED: ZEISS COLLIMATOR #992</span>
            <span>•</span>
            <span>CHOPPER ZERO BACKLASH</span>
          </div>
        </div>
      </div>

      {/* Main Foreground Hero Content */}
      <div className="relative z-20 mx-auto flex w-full max-w-container-max flex-col justify-end px-gutter-mobile pb-space-2xl pt-space-2xl lg:px-gutter-desktop">
        <div className="flex max-w-3xl flex-col gap-space-md">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="rounded-lg bg-primary/20 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase tracking-widest text-primary">
              FLAGSHIP CINEMA EDITION
            </span>
            <span className="rounded-lg bg-surface-container-high/90 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase tracking-wider text-on-surface-variant">
              CHẾ TÁC THỦ CÔNG TẠI WETZLAR & KYOTO
            </span>
          </div>
          <h1 className="font-display-hero text-display-hero-mobile leading-[1.08] tracking-tight text-on-surface drop-shadow-lg lg:text-display-hero">
            Nghệ Thuật Thu Nhận Ánh Sáng Ở Đẳng Cấp <span className="italic text-primary">Thuần Khiết.</span>
          </h1>
          <p className="max-w-2xl font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
            Được trang bị cảm biến thế hệ mới <strong className="font-semibold text-on-surface">61.2MP BSI CMOS</strong> kết hợp cùng ngàm hợp kim Magie hàng không siêu nhẹ. Dải tương phản động 15+ EV bộc lộ độ sâu tinh vi nhất của bóng tối và hào quang.
          </p>

          <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
            <a
              href="#lens-spec-section"
              className="group flex items-center gap-space-xs rounded-lg bg-primary px-space-xl py-space-md font-headline-sm text-headline-sm uppercase tracking-wider text-on-primary shadow-[0_12px_40px_rgba(242,202,80,0.25)] transition-all hover:bg-primary-fixed-dim"
            >
              <span>Khám phá X-1 Monolith</span>
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
            </a>
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="flex items-center gap-space-xs rounded-lg bg-surface-container-high/80 px-space-lg py-space-md font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface shadow-md backdrop-blur-md transition-all hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">play_circle</span>
              <span>Thước Phim Mẫu 8K 60p ProRes</span>
            </button>
          </div>

          {/* Telemetry Key Specs Ribbon */}
          <div className="grid grid-cols-2 gap-space-sm pt-space-lg sm:grid-cols-4">
            {[
              { label: "ĐỘ PHÂN GIẢI SENSOR", value: "61.2 MP", accent: true, sub: "Full-Frame BSI Exmor R" },
              { label: "CHỐNG RUNG CƠ HỌC", value: "8.5 STOPS", accent: false, sub: "IBIS 5 trục chủ động" },
              { label: "DẢI TƯƠNG PHẢN ĐỘNG", value: "15+ STOPS", accent: true, sub: "Dual Native ISO 800/3200" },
              { label: "HỆ THỐNG LẤY NÉT AI", value: "759 ĐIỂM", accent: false, sub: "Deep Learning 0.02s Lock" },
            ].map((spec) => (
              <div key={spec.label} className="rounded-lg bg-surface-container-low/80 p-space-sm shadow-sm backdrop-blur-md">
                <span className="block font-telemetry-xs text-telemetry-xs uppercase text-outline">{spec.label}</span>
                <span className={`font-headline-sm text-headline-sm ${spec.accent ? "text-primary" : "text-on-surface"}`}>{spec.value}</span>
                <span className="block font-body-sm text-body-sm text-on-surface-variant">{spec.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center pt-space-xl">
          <a href="#lens-spec-section" className="flex flex-col items-center gap-space-2xs text-on-surface-variant transition-colors hover:text-primary">
            <span className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest">CUỘN ĐỂ KHÁM PHÁ QUANG HỌC</span>
            <div className="flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-surface-container-high shadow-md">
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">expand_more</span>
            </div>
          </a>
        </div>
      </div>

      {/* Video Modal — accessible dialog */}
      {videoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-container-lowest/90 p-space-md backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Thước phim mẫu Lumina X-1">
          <div className="flex w-full max-w-4xl flex-col gap-space-md overflow-hidden rounded-xl bg-surface-container p-space-md shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-primary" aria-hidden="true" />
                <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Thước Phim 8K 60p Lumina X-1 Master Reel</span>
              </div>
              <button type="button" onClick={() => setVideoOpen(false)} className="p-space-2xs text-on-surface-variant transition-colors hover:text-on-surface" aria-label="Đóng video">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-surface-container-lowest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-full w-full object-cover" alt="Thước phim điện ảnh quay trên Lumina X-1: núi lửa Iceland với vệt sáng anamorphic xanh" src={IMG.videoReel} />
              <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/40">
                <div className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-transform hover:scale-105">
                  <span className="material-symbols-outlined text-[32px]" aria-hidden="true">play_arrow</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between font-telemetry-xs text-telemetry-xs text-outline">
              <span>Định dạng: Apple ProRes 422 HQ • Gamut: DCI-P3 100%</span>
              <span>Bitrate: 2200 Mbps • Bit Depth: 10-bit 4:2:2</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
