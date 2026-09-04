"use client";

import Link from "next/link";
import { useState } from "react";
import type { FinderAnswers, PhotographyStyle } from "@/lib/types";
import { findRecommendations, BUDGET_RANGES } from "@/lib/services/finder-service";
import { formatVND, cn } from "@/lib/utils/format";
import { RatingStars } from "@/components/ui/rating-stars";

const QUESTIONS = [
  { key: "budget", question: "Ngân sách của bạn nằm ở đâu?", options: Object.entries(BUDGET_RANGES).map(([value, r]) => ({ value, label: r.label })) },
  {
    key: "experience",
    question: "Trình độ nhiếp ảnh hiện tại?",
    options: [
      { value: "beginner", label: "Mới bắt đầu" },
      { value: "intermediate", label: "Có kinh nghiệm" },
      { value: "professional", label: "Chuyên nghiệp" },
    ],
  },
  {
    key: "sensorPreference",
    question: "Sở thích kích thước cảm biến?",
    options: [
      { value: "fullframe", label: "Full-frame" },
      { value: "medium_format", label: "Medium format" },
      { value: "apsc", label: "APS-C" },
      { value: "any", label: "Không quan trọng" },
    ],
  },
  {
    key: "sizePreference",
    question: "Ưu tiên kích thước & trọng lượng?",
    options: [
      { value: "compact", label: "Gọn nhẹ mỗi ngày" },
      { value: "balanced", label: "Cân bằng" },
      { value: "performance", label: "Hiệu năng tối đa" },
    ],
  },
  {
    key: "brandPreference",
    question: "Có thương hiệu yêu thích?",
    options: [
      { value: "", label: "Mở với mọi thương hiệu" },
      { value: "Lumina", label: "Lumina" },
      { value: "Hasselblad", label: "Hasselblad" },
      { value: "Leica", label: "Leica" },
      { value: "Sony", label: "Sony" },
    ],
  },
] as const;

const STYLE_OPTIONS: { value: PhotographyStyle; label: string; icon: string }[] = [
  { value: "portrait", label: "Chân dung", icon: "face" },
  { value: "landscape", label: "Phong cảnh", icon: "landscape" },
  { value: "street", label: "Đường phố", icon: "location_city" },
  { value: "wildlife", label: "Hoang dã", icon: "pets" },
  { value: "sports", label: "Thể thao", icon: "sports_basketball" },
  { value: "video", label: "Video/Cine", icon: "movie" },
  { value: "hybrid", label: "Hybrid chụp + quay", icon: "auto_awesome" },
  { value: "travel", label: "Du lịch", icon: "flight_takeoff" },
];

const DEFAULT_ANSWERS: FinderAnswers = {
  budget: "100m_250m",
  experience: "intermediate",
  styles: ["portrait"],
  sensorPreference: "any",
  sizePreference: "balanced",
};

export default function CameraFinderPage() {
  const [answers, setAnswers] = useState<FinderAnswers>(DEFAULT_ANSWERS);
  const [submitted, setSubmitted] = useState(false);
  const recommendations = findRecommendations(answers, 3);

  const toggleStyle = (style: PhotographyStyle) => {
    setAnswers((a) => {
      const styles = a.styles.includes(style) ? a.styles.filter((s) => s !== style) : [...a.styles, style];
      return { ...a, styles: styles.length ? styles : a.styles };
    });
  };

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">CAMERA FINDER • ĐỐI TÁC TÌM MÁY</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Tìm Người Bạn Quang Học Của Bạn</h1>
        <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
          Trả lời vài câu hỏi — thuật toán gợi ý của Lumina chấm điểm từng thiết bị trong vault theo ngân sách, thể loại và phong cách làm việc của bạn.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-12">
        <section className="flex flex-col gap-space-md lg:col-span-7" aria-label="Câu hỏi gợi ý">
          <fieldset className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg">
            <legend className="mb-space-xs font-headline-sm text-headline-sm uppercase text-on-surface">Bạn thường chụp thể loại nào?</legend>
            <div className="grid grid-cols-2 gap-space-xs sm:grid-cols-4">
              {STYLE_OPTIONS.map((style) => {
                const active = answers.styles.includes(style.value);
                return (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => toggleStyle(style.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-center gap-space-2xs rounded-lg p-space-sm font-body-sm text-body-sm transition-colors",
                      active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                    )}
                  >
                    <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{style.icon}</span>
                    {style.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {QUESTIONS.map((q) => (
            <fieldset key={q.key} className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-lg">
              <legend className="mb-space-xs font-headline-sm text-headline-sm uppercase text-on-surface">{q.question}</legend>
              <div className="flex flex-wrap gap-space-xs">
                {q.options.map((option) => {
                  const active = answers[q.key] === option.value;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.key]: option.value }))}
                      aria-pressed={active}
                      className={cn(
                        "rounded-lg px-space-md py-space-xs font-body-sm text-body-sm transition-colors",
                        active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <button
            type="button"
            onClick={() => setSubmitted(true)}
            className="self-start rounded-lg bg-primary px-space-xl py-space-sm font-headline-sm text-telemetry-data uppercase text-on-primary shadow-[0_8px_32px_rgba(212,175,55,0.15)] transition-colors hover:bg-primary-fixed-dim"
          >
            Chấm điểm gợi ý
          </button>
        </section>

        <section className="flex flex-col gap-space-md lg:col-span-5" aria-label="Kết quả gợi ý" aria-live="polite">
          {submitted ? (
            recommendations.length > 0 ? (
              recommendations.map((rec, index) => (
                <article key={rec.product.id} className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className={cn("rounded-lg px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase", index === 0 ? "bg-primary text-on-primary" : "bg-primary/20 text-primary")}>
                      {rec.matchPercent}% MATCH {index === 0 && "— BEST PICK"}
                    </span>
                    <RatingStars rating={rec.product.rating} size={14} />
                  </div>
                  <div className="flex gap-space-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rec.product.thumbnail.url} alt={rec.product.thumbnail.alt} loading="lazy" className="h-24 w-24 shrink-0 rounded-lg bg-surface-container-low object-contain p-1" />
                    <div className="flex flex-col gap-space-2xs">
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">{rec.product.name}</h2>
                      <span className="font-telemetry-data text-telemetry-data font-bold text-primary">{formatVND(rec.product.price)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <span className="font-telemetry-xs text-telemetry-xs uppercase text-primary">Why this camera?</span>
                    <ul className="flex flex-col gap-space-2xs">
                      {rec.reasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                          <span className="material-symbols-outlined mt-0.5 text-[14px] text-primary" aria-hidden="true">check_circle</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {rec.alternatives && rec.alternatives.length > 0 && (
                    <p className="font-telemetry-xs text-telemetry-xs text-outline">Cân nhắc thêm: {rec.alternatives.join(" • ")}</p>
                  )}
                  <div className="flex gap-space-xs pt-space-2xs">
                    <Link href={`/products/${rec.product.slug}`} className="flex-1 rounded-lg bg-primary py-space-xs text-center font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
                      Xem chi tiết
                    </Link>
                    <Link href={`/compare?ids=${rec.product.id}`} className="flex-1 rounded-lg bg-surface-container-high py-space-xs text-center font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest">
                      Thêm so sánh
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-xl bg-surface-container p-space-lg font-body-md text-body-md text-on-surface-variant" role="status">
                Không có thiết bị nào khớp hoàn toàn. Thử mở rộng ngân sách hoặc thay đổi sở thích cảm biến.
              </p>
            )
          ) : (
            <div className="flex flex-col items-center gap-space-sm rounded-xl bg-surface-container p-space-2xl text-center shadow-xl">
              <span className="material-symbols-outlined text-[40px] text-primary" aria-hidden="true">explore</span>
              <p className="font-body-md text-body-md text-on-surface-variant">Trả lời xong rồi bấm “Chấm điểm gợi ý” — kết quả hiện ra tại đây.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
