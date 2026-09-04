"use client";

import Link from "next/link";
import { useState } from "react";
import { IMG } from "@/lib/data/images";
import { findRecommendations } from "@/lib/services/finder-service";
import type { FinderAnswers } from "@/lib/types";
import { formatVND } from "@/lib/utils/format";
import { cn } from "@/lib/utils/format";

/** Hero Section 4 — Sensor & Low-Light Simulator (port từ prototype, matchmaker gắn FinderService). */
type SensorKey = "medium" | "fullframe" | "apsc";

const SENSORS: Record<SensorKey, { label: string; size: string; crop: string }> = {
  medium: { label: "Medium Format (53.4 x 40mm)", size: "100%", crop: "MEDIUM FORMAT 0.79X (DIỆN TÍCH LỚN NHẤT)" },
  fullframe: { label: "Full Frame (36 x 24mm)", size: "88%", crop: "FULL FRAME 1.0X (CHUẨN CÔNG NGHIỆP)" },
  apsc: { label: "APS-C (23.5 x 15.6mm)", size: "64%", crop: "APS-C 1.5X CROP FACTOR" },
};

const STYLES: { key: string; label: string; desc: string; icon: string; answers: FinderAnswers }[] = [
  {
    key: "fashion",
    label: "Studio Thời Trang & Quảng Cáo",
    desc: "Cần độ phân giải cực đại & tái tạo da chuẩn",
    icon: "apparel",
    answers: { budget: "250m_400m", experience: "professional", styles: ["portrait"], sensorPreference: "medium_format", sizePreference: "performance" },
  },
  {
    key: "cinema",
    label: "Điện Ảnh & MV Âm Nhạc",
    desc: "Cần Dynamic Range 15+ EV & Apple ProRes",
    icon: "movie",
    answers: { budget: "above_400m", experience: "professional", styles: ["video"], sensorPreference: "fullframe", sizePreference: "performance" },
  },
  {
    key: "travel",
    label: "Du Lịch, Tư Liệu & Đời Thường",
    desc: "Cần máy gọn nhẹ, kháng thời tiết IP54",
    icon: "landscape",
    answers: { budget: "250m_400m", experience: "intermediate", styles: ["travel", "street"], sensorPreference: "fullframe", sizePreference: "compact" },
  },
];

export function SensorLab() {
  const [sensor, setSensor] = useState<SensorKey>("fullframe");
  const [iso, setIso] = useState(6400);
  const [recommendation, setRecommendation] = useState(() => findRecommendations(STYLES[0].answers)[0]);

  const snr = Math.max(28, 48 - iso / 2200).toFixed(1);
  const snrNote = iso > 25600 ? "Nhiễu Kỹ Thuật Số Rõ" : iso > 6400 ? "Hạt Phim Hữu Cơ Mịn" : "Sạch Tuyệt Đối";
  const imgFilter = iso < 3200 ? "contrast(1.15) brightness(1.0)" : iso < 12800 ? "contrast(1.08) brightness(1.08)" : "contrast(0.98) brightness(1.18)";

  return (
    <section className="relative w-full bg-surface-container-lowest py-space-4xl">
      <div className="mx-auto flex w-full max-w-container-max flex-col gap-space-2xl px-gutter-mobile lg:px-gutter-desktop">
        <div className="flex flex-col justify-between gap-space-md md:flex-row md:items-end">
          <div>
            <span className="section-telemetry block">CÔNG CỤ THỰC NGHIỆM TƯƠNG TÁC</span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Mô Phỏng Cảm Biến & Thiếu Sáng</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Kéo thanh trượt để so sánh hạt nhiễu (Noise Floor) và độ sâu trường ảnh (DoF) giữa các định dạng.</p>
          </div>
          <div className="flex flex-wrap items-center gap-space-2xs rounded-lg bg-surface-container p-space-2xs" role="group" aria-label="Chọn kích thước cảm biến">
            {(Object.keys(SENSORS) as SensorKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSensor(key)}
                aria-pressed={sensor === key}
                className={cn(
                  "rounded px-space-sm py-space-2xs font-headline-sm text-telemetry-data uppercase transition-colors",
                  sensor === key ? "bg-primary text-on-primary" : "text-on-surface hover:bg-surface-container-high",
                )}
              >
                {SENSORS[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-space-xl rounded-xl bg-surface-container p-space-xl shadow-2xl lg:grid-cols-12">
          <div className="flex flex-col gap-space-md lg:col-span-8">
            <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg bg-surface-container-lowest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="h-full w-full object-cover transition-all duration-300"
                style={{ filter: imgFilter }}
                alt="Chân dung thiếu sáng với bokeh mịn và kiểm soát nhiễu vượt trội"
                src={IMG.lowLightPortrait}
                loading="lazy"
              />
              <div className="pointer-events-none absolute flex h-full w-full items-start justify-end border-2 border-primary p-space-xs transition-all duration-500" style={{ width: SENSORS[sensor].size, height: SENSORS[sensor].size }} aria-hidden="true">
                <span className="rounded bg-primary px-1.5 py-0.5 font-telemetry-xs text-[10px] font-bold uppercase text-on-primary">{SENSORS[sensor].crop}</span>
              </div>
              <div className="absolute bottom-4 left-4 flex items-center gap-space-md rounded-lg bg-surface-container-lowest/85 px-space-sm py-space-xs backdrop-blur-md">
                <div className="flex flex-col">
                  <span className="font-telemetry-xs text-[10px] text-outline">ĐỘ NHẠY SÁNG HIỆN TẠI</span>
                  <span className="text-[16px] font-bold text-primary font-telemetry-data" aria-live="polite">ISO {iso.toLocaleString("vi-VN")}</span>
                </div>
                <div className="h-6 w-[1px] bg-surface-container-highest" aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="font-telemetry-xs text-[10px] text-outline">TỶ LỆ TÍN HIỆU/NHIỄU (SNR)</span>
                  <span className="text-[16px] font-semibold text-on-surface font-telemetry-data">{snr} dB ({snrNote})</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-md">
              <div className="flex items-center justify-between font-telemetry-xs text-telemetry-xs">
                <span className="uppercase text-on-surface">Kéo để tăng ISO từ 100 đến 102,400:</span>
                <span className="font-bold text-primary">ISO {iso.toLocaleString("vi-VN")}</span>
              </div>
              <label htmlFor="iso-slider" className="sr-only">Độ nhạy sáng ISO</label>
              <input
                id="iso-slider"
                type="range"
                min={100}
                max={51200}
                step={100}
                value={iso}
                onChange={(e) => setIso(Number(e.target.value))}
                className="h-2 w-full cursor-pointer rounded-lg bg-surface-container-high accent-primary"
              />
              <div className="flex justify-between font-telemetry-xs text-[10px] text-outline">
                <span>ISO 100 (Studio)</span>
                <span>ISO 1,600 (Hoàng Hôn)</span>
                <span>ISO 6,400 (Sân Khấu Đêm)</span>
                <span>ISO 25,600 (Bầu Trời Đêm)</span>
                <span>ISO 51,200 (Thám Hiểm)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-space-md lg:col-span-4">
            <div className="flex flex-col gap-space-sm">
              <span className="font-telemetry-xs text-telemetry-xs font-bold uppercase text-primary">LỰA CHỌN THEO PHONG CÁCH CỦA BẠN</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Bạn Thường Ghi Hình Thể Loại Nào Nhất?</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Hệ thống gợi ý combo ống kính và thân máy tối ưu theo yêu cầu công việc thực tế.</p>
            </div>

            <div className="flex flex-col gap-space-xs">
              {STYLES.map((style) => (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => setRecommendation(findRecommendations(style.answers)[0])}
                  className="group flex items-center justify-between rounded-lg bg-surface-container-high p-space-sm text-left transition-colors hover:bg-surface-container-highest"
                >
                  <span className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-primary" aria-hidden="true">{style.icon}</span>
                    <span>
                      <span className="block font-headline-sm text-body-md text-on-surface">{style.label}</span>
                      <span className="font-telemetry-xs text-[11px] text-outline">{style.desc}</span>
                    </span>
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-outline transition-colors group-hover:text-primary" aria-hidden="true">chevron_right</span>
                </button>
              ))}
            </div>

            {recommendation && (
              <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-md shadow-inner" aria-live="polite">
                <span className="font-telemetry-xs text-telemetry-xs font-bold uppercase text-primary">GỢI Ý TỪ CHUYÊN GIA LUMINA — {recommendation.matchPercent}% MATCH:</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{recommendation.product.name}</span>
                <p className="text-[12px] font-body-sm text-on-surface-variant">{recommendation.reasons[0]}</p>
                <div className="flex items-center justify-between pt-space-xs">
                  <span className="font-telemetry-data font-bold text-primary">{formatVND(recommendation.product.price)}</span>
                  <Link href={`/products/${recommendation.product.slug}`} className="rounded bg-primary px-space-sm py-1 font-headline-sm text-telemetry-xs uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
                    Xem Chi Tiết Combo
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
