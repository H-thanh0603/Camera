"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IMG } from "@/lib/data/images";
import { AppFillImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils/format";

/**
 * #7 Photo Lab — simulator scene × lens × aperture × ISO trên cùng 1 ảnh.
 * Lens → crop FOV (scale), aperture → bokeh blur, ISO → brightness + noise.
 * Không cần ảnh thật/AI: toàn bộ bằng CSS filter trên ảnh có sẵn.
 */

const SCENES = [
  { key: "portrait", label: "Chân dung", icon: "face", src: IMG.dopPortrait, alt: "Chân dung mẫu" },
  { key: "night", label: "Đêm", icon: "nightlife", src: IMG.lowLightPortrait, alt: "Phố đêm thiếu sáng" },
  { key: "landscape", label: "Phong cảnh", icon: "landscape", src: IMG.videoReel, alt: "Núi lửa Iceland" },
] as const;

type SceneKey = (typeof SCENES)[number]["key"];

const LENSES = [
  { mm: 24, fov: "84°", scale: 1.0, note: "Góc siêu rộng — phong cảnh, kiến trúc" },
  { mm: 35, fov: "63°", scale: 1.25, note: "Góc rộng tự nhiên — đường phố, đời thường" },
  { mm: 50, fov: "46°", scale: 1.6, note: "Gần mắt người — đa dụng nhất" },
  { mm: 85, fov: "28°", scale: 2.2, note: "Tele ngắn — chân dung xóa phông" },
] as const;

const APERTURES = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16] as const;
const ISO_STOPS = [100, 200, 400, 800, 1600, 3200, 6400, 12800] as const;

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")";

function apertureBlur(f: number): number {
  if (f <= 1.4) return 2.2;
  if (f <= 2) return 1.6;
  if (f <= 2.8) return 1.1;
  if (f <= 4) return 0.7;
  if (f <= 5.6) return 0.4;
  if (f <= 8) return 0.2;
  return 0;
}

function isoAdjust(iso: number): { brightness: number; noise: number } {
  const stops = Math.log2(iso / 100);
  return {
    brightness: Math.min(1.35, 1 + stops * 0.045),
    noise: Math.min(0.55, Math.max(0, (stops - 3) * 0.09)),
  };
}

function verdict(lens: number, f: number, iso: number, scene: SceneKey): string {
  const parts: string[] = [];
  if (scene === "portrait" && lens >= 50 && f <= 2.8) parts.push("Combo chân dung kinh điển: tele + khẩu lớn, chủ thể tách nền mịn.");
  else if (scene === "portrait" && lens <= 35) parts.push("Góc rộng chụp chân dung dễ méo mặt — lùi xa hoặc đổi 50mm+.");
  if (scene === "night" && iso >= 6400) parts.push("ISO rất cao: ảnh sáng nhưng nhiễu rõ — máy full-frame/medium format xử lý tốt hơn.");
  else if (scene === "night" && iso <= 800 && f >= 8) parts.push("Thiếu sáng mà khép khẩu + ISO thấp = ảnh tối — mở khẩu hoặc tăng ISO.");
  if (scene === "landscape" && f >= 8 && lens <= 35) parts.push("Chuẩn phong cảnh: góc rộng + khép khẩu, nét từ tiền cảnh tới vô cực.");
  else if (scene === "landscape" && f <= 2) parts.push("Khẩu lớn chụp phong cảnh phí DOF — khép tới f/8–f/11.");
  if (!parts.length) {
    if (f <= 2.8) parts.push("DOF nông, bokeh mịn — hợp chân dung, đêm, chi tiết.");
    else parts.push("DOF sâu, nét toàn khung — hợp phong cảnh, kiến trúc, nhóm đông.");
  }
  return parts.join(" ");
}

export default function PhotoLabPage() {
  const [scene, setScene] = useState<SceneKey>("night");
  const [lensIdx, setLensIdx] = useState(2);
  const [apIdx, setApIdx] = useState(2);
  const [isoIdx, setIsoIdx] = useState(3);

  const current = SCENES.find((s) => s.key === scene) ?? SCENES[0];
  const lens = LENSES[lensIdx];
  const f = APERTURES[apIdx];
  const iso = ISO_STOPS[isoIdx];
  const { brightness, noise } = isoAdjust(iso);
  const blur = apertureBlur(f);

  const style = useMemo(
    () => ({ filter: `brightness(${brightness.toFixed(2)}) blur(${blur.toFixed(1)}px)` }),
    [brightness, blur],
  );

  return (
    <div className="container-page flex flex-col gap-space-xl pb-24 pt-space-lg">
      <header className="flex flex-col gap-space-xs">
        <span className="section-telemetry">PHOTO LAB</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Chụp Thử Trước Khi Mua</h1>
        <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
          Đổi scene, tiêu cự, khẩu độ, ISO — xem ảnh thay đổi trực tiếp. Thông số khô khan thành trải nghiệm.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-12">
        {/* Viewport */}
        <div className="lg:col-span-7">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-surface-container-lowest shadow-2xl">
            <div className="absolute inset-0 transition-transform duration-300" style={{ transform: `scale(${lens.scale})` }}>
              <AppFillImage src={current.src} alt={current.alt} sizes="(max-width: 1024px) 100vw, 60vw" className="h-full w-full object-cover" style={style} />
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay" style={{ backgroundImage: NOISE_BG, opacity: noise }} aria-hidden="true" />
            <div className="absolute left-3 top-3 flex items-center gap-space-xs rounded-lg bg-surface-container-lowest/85 px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs backdrop-blur-md">
              <span className="text-primary">{lens.mm}mm</span>
              <span className="text-outline">FOV {lens.fov}</span>
              <span className="text-outline">•</span>
              <span className="text-on-surface">f/{f}</span>
              <span className="text-outline">•</span>
              <span className="text-on-surface">ISO {iso.toLocaleString("vi-VN")}</span>
            </div>
          </div>
          <p className="pt-space-sm font-body-md text-body-md text-on-surface-variant" role="status">{verdict(lens.mm, f, iso, scene)}</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-space-lg lg:col-span-5">
          <section aria-label="Chọn scene">
            <h2 className="section-telemetry mb-space-xs">01 — Scene</h2>
            <div className="grid grid-cols-3 gap-space-xs">
              {SCENES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScene(s.key)}
                  aria-pressed={scene === s.key}
                  className={cn(
                    "flex flex-col items-center gap-space-2xs rounded-lg px-space-sm py-space-sm transition-colors",
                    scene === s.key ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{s.icon}</span>
                  <span className="font-headline-sm text-headline-sm">{s.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section aria-label="Chọn tiêu cự">
            <h2 className="section-telemetry mb-space-xs">02 — Tiêu cự: {lens.mm}mm (FOV {lens.fov})</h2>
            <input
              type="range" min={0} max={LENSES.length - 1} step={1} value={lensIdx}
              onChange={(e) => setLensIdx(Number(e.target.value))}
              className="w-full accent-primary" aria-label="Tiêu cự ống kính"
            />
            <div className="flex justify-between font-telemetry-xs text-telemetry-xs text-outline">
              {LENSES.map((l) => <span key={l.mm}>{l.mm}</span>)}
            </div>
            <p className="pt-space-2xs font-body-sm text-body-sm text-on-surface-variant">{lens.note}</p>
          </section>

          <section aria-label="Chọn khẩu độ">
            <h2 className="section-telemetry mb-space-xs">03 — Khẩu độ: f/{f} {f <= 2.8 ? "(xóa phông)" : f >= 8 ? "(nét sâu)" : ""}</h2>
            <input
              type="range" min={0} max={APERTURES.length - 1} step={1} value={apIdx}
              onChange={(e) => setApIdx(Number(e.target.value))}
              className="w-full accent-primary" aria-label="Khẩu độ"
            />
            <div className="flex justify-between font-telemetry-xs text-telemetry-xs text-outline">
              {APERTURES.map((a) => <span key={a}>{a}</span>)}
            </div>
          </section>

          <section aria-label="Chọn ISO">
            <h2 className="section-telemetry mb-space-xs">04 — ISO: {iso.toLocaleString("vi-VN")}</h2>
            <input
              type="range" min={0} max={ISO_STOPS.length - 1} step={1} value={isoIdx}
              onChange={(e) => setIsoIdx(Number(e.target.value))}
              className="w-full accent-primary" aria-label="Độ nhạy sáng ISO"
            />
            <div className="flex justify-between font-telemetry-xs text-telemetry-xs text-outline">
              {ISO_STOPS.map((v) => <span key={v}>{v >= 1000 ? `${v / 1000}k` : v}</span>)}
            </div>
          </section>

          <Link
            href="/camera-finder"
            className="flex items-center justify-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-sm font-headline-sm text-headline-sm uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim"
          >
            <span>Tìm máy hợp kiểu chụp này</span>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
