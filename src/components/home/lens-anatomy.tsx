"use client";

import { useState } from "react";
import Link from "next/link";
import { IMG } from "@/lib/data/images";
import { cn } from "@/lib/utils/format";

/** Hero Section 2 — Dissection & Interactive Optical Anatomy (port từ prototype). */
const MODES = {
  portrait: {
    title: "Chế Độ Chân Dung f/1.2 Master",
    elements: "14 thấu kính / 10 nhóm (3 ED, 2 Aspherical)",
    aperture: "f/1.2 – f/16 (11 lá khẩu tròn)",
    distortion: "< 0.12% (Gần như triệt tiêu hoàn toàn)",
    focus: "0.40 m (Độ phóng đại 0.17x)",
    mtfScore: "ĐIỂM HIỆU QUẢ: 99.4%",
    curve: "M 0,15 Q 120,18 200,24 T 300,32",
  },
  anamorphic: {
    title: "Chế Độ Cine Anamorphic 2x Squeeze",
    elements: "18 thấu kính / 13 nhóm (Phần tử thấu kính trụ Cine)",
    aperture: "T2.0 – T22 (16 lá khẩu Cine)",
    distortion: "Đặc tính Anamorphic Oval Cinematic",
    focus: "0.85 m (Góc nhìn ngang siêu rộng)",
    mtfScore: "ĐIỂM HIỆU QUẢ: 97.8% (Organic Flare)",
    curve: "M 0,22 Q 110,25 210,38 T 300,48",
  },
  astro: {
    title: "Chế Độ Thiên Văn & High-ISO Pinpoint",
    elements: "Fluorite nhân tạo đa lớp, triệt Coma viền biên",
    aperture: "f/1.4 – f/11 (Tối ưu hóa phản xạ gương)",
    distortion: "< 0.05% (Hình học phẳng tuyệt đối)",
    focus: "Vô cực chuẩn xác với khóa cơ học",
    mtfScore: "ĐIỂM HIỆU QUẢ: 99.8% (Cực Nét Rìa Ảnh)",
    curve: "M 0,10 Q 140,12 220,16 T 300,20",
  },
} as const;

type ModeKey = keyof typeof MODES;

const MODE_LABELS: Record<ModeKey, { tag: string; name: string; desc: string }> = {
  portrait: { tag: "Chế Độ 01", name: "Chân Dung f/1.2", desc: "Bokeh bơ mịn quang học tròn 11 lá" },
  anamorphic: { tag: "Chế Độ 02", name: "Cine Anamorphic 2x", desc: "Vệt sáng xanh điện ảnh chuẩn 2.39:1" },
  astro: { tag: "Chế Độ 03", name: "Thiên Văn High-ISO", desc: "Cắt giảm nhiễu nhiệt hạt sao pinpoint" },
};

export function LensAnatomy() {
  const [mode, setMode] = useState<ModeKey>("portrait");
  const data = MODES[mode];

  return (
    <section id="lens-spec-section" className="relative w-full overflow-hidden bg-surface-container-lowest py-space-4xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#d4af37_1px,transparent_1px)] opacity-10 [background-size:24px_24px]" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex w-full max-w-container-max flex-col gap-space-3xl px-gutter-mobile lg:px-gutter-desktop">
        <div className="flex flex-col justify-between gap-space-md md:flex-row md:items-end">
          <div className="flex flex-col gap-space-2xs">
            <span className="section-telemetry">PHÂN HỆ CẤU TẠO LÕI • OPTICAL CORE LAB</span>
            <h2 className="font-headline-lg text-headline-lg leading-tight text-on-surface">
              Giải Phẫu Lăng Kính & <span className="text-primary">Trái Tim Cảm Biến</span>
            </h2>
          </div>
          <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
            Mỗi thấu kính được tiện quang sai bằng hệ máy laser giao thoa kế phân cực, triệt tiêu viền tím tới ngưỡng nano mét.
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-space-xl lg:grid-cols-12">
          <div className="flex flex-col gap-space-md lg:col-span-7">
            <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-surface-container-low p-space-lg shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="h-full w-full object-contain drop-shadow-[0_20px_50px_rgba(242,202,80,0.15)] transition-all duration-700"
                alt="Sơ đồ exploded view các thấu kính quang học và khối cảm biến của Lumina"
                src={IMG.anatomy}
                loading="lazy"
              />
              <div className="absolute left-8 top-8 rounded-lg bg-surface-container-high/90 p-space-xs shadow-sm backdrop-blur-md">
                <span className="block font-telemetry-xs text-telemetry-xs font-bold text-primary">LỚP PHỦ NANO T* & FLUORINE</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Truyền dẫn 99.8% quang phổ khả kiến</span>
              </div>
              <div className="absolute bottom-8 right-8 rounded-lg bg-surface-container-high/90 p-space-xs shadow-sm backdrop-blur-md">
                <span className="block font-telemetry-xs text-telemetry-xs font-bold text-secondary">ĐỒNG NGUYÊN KHỐI TẢN NHIỆT</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Quay 8K liên tục không quá nhiệt</span>
              </div>
              <div className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-primary/40" aria-hidden="true">
                <div className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-space-sm" role="tablist" aria-label="Chế độ quang học">
              {(Object.keys(MODES) as ModeKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={cn(
                    "rounded-lg p-space-sm text-left shadow-sm transition-all hover:bg-surface-container-highest",
                    mode === key ? "bg-surface-container-high shadow-md" : "bg-surface-container-low",
                  )}
                >
                  <span className={cn("block font-telemetry-xs text-telemetry-xs uppercase", mode === key ? "text-primary" : "text-outline")}>
                    {MODE_LABELS[key].tag}
                  </span>
                  <span className="block font-headline-sm text-headline-sm text-on-surface">{MODE_LABELS[key].name}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{MODE_LABELS[key].desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-space-lg rounded-xl bg-surface-container p-space-xl shadow-xl lg:col-span-5" aria-live="polite">
            <div className="flex items-center justify-between border-b border-surface-container-highest pb-space-sm">
              <div>
                <span className="font-telemetry-xs text-telemetry-xs font-bold uppercase tracking-wider text-primary">THÔNG SỐ PHÒNG THÍ NGHIỆM</span>
                <h3 className="font-headline-md text-headline-md text-on-surface">{data.title}</h3>
              </div>
              <span className="rounded-lg bg-primary/20 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold text-primary">
                CHUẨN ZEISS MTF
              </span>
            </div>

            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between font-telemetry-xs text-telemetry-xs">
                <span className="uppercase text-on-surface-variant">Biểu Đồ Độ Nét Quang Sai (MTF 50 lp/mm)</span>
                <span className="font-bold text-primary">{data.mtfScore}</span>
              </div>
              <div className="flex h-28 w-full items-end rounded-lg bg-surface-container-lowest p-space-xs">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 300 70" role="img" aria-label="Biểu đồ MTF">
                  <line stroke="#31353c" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="300" y1="10" y2="10" />
                  <line stroke="#31353c" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="300" y1="35" y2="35" />
                  <line stroke="#31353c" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="300" y1="60" y2="60" />
                  <path d={data.curve} fill="none" stroke="#f2ca50" strokeWidth="2.5" className="transition-all duration-500" />
                  <path d="M 0,22 Q 100,28 200,36 T 300,45" fill="none" stroke="#99907c" strokeDasharray="3 3" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            <div className="flex flex-col gap-space-sm font-body-sm text-body-sm">
              {[
                { label: "Cấu trúc thấu kính", value: data.elements, accent: false },
                { label: "Độ mở khẩu tối đa", value: data.aperture, accent: true },
                { label: "Độ méo hình học (Distortion)", value: data.distortion, accent: false },
                { label: "Khoảng cách lấy nét tối thiểu", value: data.focus, accent: false },
                { label: "Đường kính filter trước", value: "Ø 82 mm Chuẩn Cine", accent: false },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b border-surface-container-high py-space-2xs last:border-b-0">
                  <span className="text-on-surface-variant">{row.label}</span>
                  <span className={cn("font-telemetry-data", row.accent ? "font-bold text-primary" : "font-semibold text-on-surface")}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-space-md pt-space-xs">
              <Link
                href="/products/lumina-50mm-f12-asph"
                className="flex flex-1 items-center justify-center gap-space-2xs rounded-lg bg-surface-container-highest px-space-md py-space-sm font-headline-sm text-telemetry-data uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-bright"
              >
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">science</span>
                <span>Xem Lens Master Prime</span>
              </Link>
              <Link
                href="/products/lumina-50mm-f12-asph"
                className="flex items-center justify-center rounded-lg bg-primary p-space-sm text-on-primary transition-colors hover:bg-primary-fixed-dim"
                aria-label="Thêm Lumina 50mm f/1.2 vào giỏ"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add_shopping_cart</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
