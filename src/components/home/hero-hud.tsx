"use client";

import { useState } from "react";
import { IMG } from "@/lib/data/images";
import { AppFillImage } from "@/components/ui/app-image";

/**
 * Hero — Photographic fold (Hallmark redesign, mood: điện ảnh).
 * Một khung hình full-bleed; chữ là caption chú thích, không phải headline
 * trình diễn. Giữ nguyên logic: video modal, spec telemetry thật.
 */
/* Hallmark · genre: atmospheric · macrostructure: Photographic · theme: Midnight · enrichment: none · nav: preserved · footer: preserved */
export function HeroHud() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section className="relative flex min-h-[94svh] w-full flex-col justify-end overflow-hidden bg-surface-container-lowest">
      <div className="absolute inset-0">
        <AppFillImage
          alt="Lumina X-1 Monolith 61MP Flagship Mirrorless Camera"
          className="h-full w-full object-cover object-center contrast-[1.12] brightness-[0.72]"
          src={IMG.heroBackdrop}
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
      </div>

      {/* Plate caption — góc trên, không eyebrow trình diễn */}
      <p className="absolute left-gutter-mobile top-20 font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant/80 lg:left-gutter-desktop">
        Plate 01 — Wetzlar · f/1.2 · 1/8000s
      </p>
      <p className="absolute right-gutter-mobile top-20 hidden font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant/80 sm:block lg:right-gutter-desktop">
        61.2MP BSI · 15+ EV
      </p>

      <div className="relative z-10 mx-auto flex w-full max-w-container-max flex-col gap-space-md px-gutter-mobile pb-space-3xl lg:px-gutter-desktop">
        <h1 className="max-w-3xl font-display-hero text-display-hero-mobile font-bold leading-[1.06] tracking-tight text-on-surface [overflow-wrap:anywhere] lg:text-display-hero">
          Nghệ Thuật Thu Nhận Ánh Sáng Ở Đẳng Cấp <span className="text-primary">Thuần Khiết.</span>
        </h1>
        <p className="max-w-xl font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
          Cảm biến 61.2MP BSI CMOS, ngàm Magie hàng không. Dải tương phản 15+ EV
          bộc lộ độ sâu tinh vi nhất của bóng tối và hào quang.
        </p>

        <div className="flex flex-wrap items-center gap-x-space-lg gap-y-space-xs pt-space-xs">
          <a
            href="#lens-spec-section"
            className="group whitespace-nowrap font-headline-sm text-headline-sm uppercase tracking-wider text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
          >
            Khám phá X-1 Monolith
            <span className="material-symbols-outlined ml-space-2xs inline-block text-[20px] align-[-4px] transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
          </a>
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="group whitespace-nowrap font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface underline decoration-outline/50 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
          >
            <span className="material-symbols-outlined mr-space-2xs inline-block text-[20px] align-[-4px] text-primary" aria-hidden="true">play_circle</span>
            Thước phim mẫu 8K 60p
          </button>
        </div>

        {/* Telemetry strip — số liệu thật, tabular-nums */}
        <dl className="mt-space-lg grid grid-cols-2 gap-x-space-lg border-t border-on-surface/15 pt-space-sm tabular-nums sm:grid-cols-4">
          {[
            { label: "Độ phân giải", value: "61.2 MP" },
            { label: "Chống rung", value: "8.5 stops" },
            { label: "Tương phản động", value: "15+ EV" },
            { label: "Lấy nét AI", value: "759 điểm" },
          ].map((spec) => (
            <div key={spec.label} className="flex flex-col gap-space-3xs py-space-2xs">
              <dt className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant/70">{spec.label}</dt>
              <dd className="font-headline-sm text-headline-sm font-semibold text-on-surface">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Video Modal — accessible dialog (giữ nguyên logic) */}
      {videoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-container-lowest/90 p-space-md backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Thước phim mẫu Lumina X-1">
          <div className="flex w-full max-w-4xl flex-col gap-space-md overflow-hidden rounded-xl bg-surface-container p-space-md shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Thước Phim 8K 60p Lumina X-1 Master Reel</span>
              <button type="button" onClick={() => setVideoOpen(false)} className="p-space-2xs text-on-surface-variant transition-colors hover:text-on-surface" aria-label="Đóng video">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-surface-container-lowest">
              <AppFillImage className="h-full w-full object-cover" alt="Thước phim điện ảnh quay trên Lumina X-1: núi lửa Iceland với vệt sáng anamorphic xanh" src={IMG.videoReel} />
              <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/40">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary">
                  <span className="material-symbols-outlined text-[32px]" aria-hidden="true">play_arrow</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between font-telemetry-xs text-telemetry-xs text-outline">
              <span>ProRes 422 HQ • DCI-P3 100%</span>
              <span>2200 Mbps • 10-bit 4:2:2</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
