"use client";

import Link from "next/link";
import { IMG } from "@/lib/data/images";
import { getProductById } from "@/lib/repositories/product-repository";
import { useStore } from "@/state/store";
import { AppFillImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils/format";

/**
 * Master Series Collection — Photographic bands (Hallmark redesign).
 * 4 phân hệ thành 4 băng ảnh full-bleed xen kẽ trái/phải; caption góc thay
 * eyebrow. Giữ nguyên: link phân hệ, giá, wishlist toggle thật.
 */
const COLLECTIONS = [
  {
    number: "Phân hệ 01",
    metric: "61MP · 120 FPS",
    kind: "Commercial & Sport",
    title: "Mirrorless Flagship",
    desc: "Chiến hạm ghi hình cho nhiếp ảnh gia thương mại và phóng viên thể thao đỉnh cao thế giới.",
    price: "185.000.000 đ",
    image: IMG.flagshipMirrorless,
    alt: "Sony Alpha 1 II và Lumina flagship trên đá núi lửa đen với ánh sáng studio",
    href: "/products?category=camera&tag=flagship",
    wishlistId: "p-lumina-x1",
  },
  {
    number: "Phân hệ 02",
    metric: "100MP · 16-bit color",
    kind: "Fine-art gallery",
    title: "Medium Format 100MP",
    desc: "Độ phân giải siêu thực, chuyển màu mượt mà cho tác phẩm in ấn triển lãm cỡ lớn.",
    price: "245.000.000 đ",
    image: IMG.mediumFormatX2D,
    alt: "Hasselblad X2D 100C trên đế thép với ánh sáng amber",
    href: "/products?category=camera&tag=medium_format",
    wishlistId: "p-hasselblad-x2d",
  },
  {
    number: "Phân hệ 03",
    metric: "8K RAW · PL mount",
    kind: "Hollywood production",
    title: "Cine & Anamorphic",
    desc: "Hệ sinh thái máy quay điện ảnh chuyên nghiệp, màu sắc kinh điển chuẩn rạp phim.",
    price: "360.000.000 đ",
    image: IMG.cineRig,
    alt: "Rig máy quay điện ảnh với ống kính anamorphic, matte box trên soundstage",
    href: "/products?category=camera&tag=cine",
    wishlistId: "p-lumina-cine-8k",
  },
  {
    number: "Phân hệ 04",
    metric: "Rangefinder · Heritage",
    kind: "Collector & street",
    title: "Vintage & Rangefinder",
    desc: "Linh hồn cơ khí cổ điển hòa cùng cảm biến và thuật toán đo sáng tối tân.",
    price: "142.000.000 đ",
    image: IMG.rangefinder,
    alt: "Leica M rangefinder patina đồng với lens Summilux 35mm",
    href: "/products?category=camera&tag=rangefinder",
    wishlistId: "p-leica-m11p",
  },
];

export function CollectionGrid() {
  const { toggleWishlist, isWishlisted } = useStore();

  return (
    <section aria-label="Master Series Collection" className="w-full bg-surface-container-lowest">
      <div className="mx-auto w-full max-w-container-max px-gutter-mobile pb-space-xl pt-space-3xl lg:px-gutter-desktop">
        <p className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant/70">
          Tuyệt phẩm quang học — bốn phân hệ
        </p>
        <div className="mt-space-xs flex flex-wrap items-end justify-between gap-space-sm">
          <h2 className="max-w-xl font-headline-lg text-headline-lg leading-tight text-on-surface">
            Master Series Collection
          </h2>
          <Link href="/products" className="whitespace-nowrap font-headline-sm text-headline-sm uppercase tracking-wider text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary">
            Tất cả phân hệ
          </Link>
        </div>
      </div>

      <div className="flex flex-col">
        {COLLECTIONS.map((c, i) => {
          const representative = getProductById(c.wishlistId);
          const wished = representative ? isWishlisted(representative.id) : false;
          const flip = i % 2 === 1;
          return (
            <figure key={c.title} className="relative flex min-h-[72svh] w-full flex-col justify-end overflow-hidden">
              <AppFillImage
                src={c.image}
                alt={c.alt}
                sizes="100vw"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" aria-hidden="true" />
              <p className={cn(
                "absolute top-space-lg font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant/80",
                flip ? "right-gutter-mobile text-right lg:right-gutter-desktop" : "left-gutter-mobile lg:left-gutter-desktop",
              )}>
                {c.number} · {c.metric}
              </p>
              <figcaption className={cn(
                "relative z-10 mx-auto flex w-full max-w-container-max flex-col gap-space-xs px-gutter-mobile pb-space-2xl lg:px-gutter-desktop",
                flip && "lg:items-end lg:text-right",
              )}>
                <span className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-primary">{c.kind}</span>
                <h3 className="font-headline-lg text-headline-lg-mobile text-on-surface lg:text-headline-lg">{c.title}</h3>
                <p className="max-w-md font-body-md text-body-md text-on-surface-variant">{c.desc}</p>
                <p className="font-telemetry-data text-telemetry-data tabular-nums text-on-surface">
                  Khởi điểm từ <strong className="text-primary">{c.price}</strong>
                </p>
                <div className={cn("flex items-center gap-space-md pt-space-2xs", flip && "lg:flex-row-reverse")}>
                  <Link href={c.href} className="group whitespace-nowrap font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface underline decoration-outline/50 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary">
                    Khám phá phân hệ
                    <span className="material-symbols-outlined ml-space-2xs inline-block text-[18px] align-[-3px] transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => representative && toggleWishlist(representative)}
                    aria-label={wished ? `Bỏ ${representative?.name} khỏi yêu thích` : `Lưu ${representative?.name} vào yêu thích`}
                    aria-pressed={wished}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low/80 backdrop-blur transition-colors hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true" style={{ color: wished ? "#f2ca50" : undefined }}>
                      {wished ? "favorite" : "favorite_border"}
                    </span>
                  </button>
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
