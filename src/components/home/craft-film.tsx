import Link from "next/link";

/**
 * Section phim nghề — video craft 8s full-bleed (autoplay muted loop),
 * đặt sau CollectionGrid như quãng nghỉ điện ảnh trước SensorLab.
 * Video H.264 720p (~2.3MB, faststart), preload="none" để không chặn LCP.
 */
export function CraftFilm() {
  return (
    <section aria-label="Phim nghề Lumina" className="relative w-full overflow-hidden bg-surface-container-lowest">
      <video
        className="h-[62vh] min-h-[380px] w-full object-cover"
        src="/videos/craft.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        aria-label="Video nghề nhiếp ảnh Lumina"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-surface-container-lowest/60" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto flex w-full max-w-container-max flex-col gap-space-xs px-gutter-mobile pb-space-xl lg:px-gutter-desktop">
          <span className="section-telemetry">LUMINA IN MOTION</span>
          <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-end">
            <h2 className="max-w-xl font-headline-lg text-headline-lg text-on-surface">
              Nghề Nhuộm Ánh Sáng Thành Phim
            </h2>
            <Link
              href="/products?tag=cine"
              className="inline-flex w-fit items-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim"
            >
              <span>Khám phá hệ Cine</span>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">movie</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
