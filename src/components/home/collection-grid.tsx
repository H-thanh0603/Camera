"use client";

import Link from "next/link";
import { IMG } from "@/lib/data/images";
import { getProductById } from "@/lib/repositories/product-repository";
import { useStore } from "@/state/store";

/** Hero Section 3 — Master Series Collection (port nguyên vẹn, heart gắn wishlist thật). */
const COLLECTIONS = [
  {
    number: "PHÂN HỆ 01",
    metric: "61MP - 120 FPS",
    kind: "COMMERCIAL & SPORT",
    title: "Mirrorless Flagship",
    desc: "Chiến hạm ghi hình cho nhiếp ảnh gia thương mại và phóng viên thể thao đỉnh cao thế giới.",
    price: "185.000.000 đ",
    image: IMG.flagshipMirrorless,
    alt: "Sony Alpha 1 II và Lumina flagship trên đá núi lửa đen với ánh sáng studio",
    href: "/products?category=camera&tag=flagship",
    wishlistId: "p-lumina-x1",
  },
  {
    number: "PHÂN HỆ 02",
    metric: "100MP • 16-BIT COLOR",
    kind: "FINE-ART GALLERY",
    title: "Medium Format 100MP",
    desc: "Độ phân giải siêu thực, chuyển đổi màu mượt mà tuyệt đối cho những tác phẩm in ấn triển lãm cỡ lớn.",
    price: "245.000.000 đ",
    image: IMG.mediumFormatX2D,
    alt: "Hasselblad X2D 100C trên đế thép với ánh sáng amber",
    href: "/products?category=camera&tag=medium_format",
    wishlistId: "p-hasselblad-x2d",
  },
  {
    number: "PHÂN HỆ 03",
    metric: "8K RAW • PL MOUNT",
    kind: "HOLLYWOOD PRODUCTION",
    title: "Cine & Anamorphic",
    desc: "Hệ sinh thái máy quay điện ảnh chuyên nghiệp, giải pháp tái tạo màu sắc kinh điển chuẩn rạp phim.",
    price: "360.000.000 đ",
    image: IMG.cineRig,
    alt: "Rig máy quay điện ảnh với ống kính anamorphic, matte box trên soundstage",
    href: "/products?category=camera&tag=cine",
    wishlistId: "p-lumina-cine-8k",
  },
  {
    number: "PHÂN HỆ 04",
    metric: "RANGEFINDER • HERITAGE",
    kind: "COLLECTOR & STREET",
    title: "Vintage & Rangefinder",
    desc: "Linh hồn nhiếp ảnh cơ khí cổ điển hòa quyện cùng công nghệ cảm biến và thuật toán đo sáng tối tân.",
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
    <section className="relative w-full bg-surface py-space-4xl">
      <div className="mx-auto flex w-full max-w-container-max flex-col gap-space-3xl px-gutter-mobile lg:px-gutter-desktop">
        <div className="flex flex-col justify-between gap-space-md md:flex-row md:items-end">
          <div>
            <span className="section-telemetry block">TUYỆT PHẨM QUANG HỌC</span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Master Series Collection</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Bốn phân hệ đại diện cho những đỉnh cao quang học cơ khí và cảm biến hình ảnh đương đại.</p>
          </div>
          <div className="flex items-center gap-space-xs overflow-x-auto rounded-xl bg-surface-container-low p-space-2xs shadow-sm">
            <Link href="/products" className="rounded-lg bg-primary px-space-sm py-space-2xs font-headline-sm text-telemetry-data uppercase text-on-primary">Tất cả Phân Hệ</Link>
            <Link href="/products?category=camera&tag=flagship" className="whitespace-nowrap rounded-lg px-space-sm py-space-2xs font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-on-surface">Flagship</Link>
            <Link href="/products?category=camera&tag=medium_format" className="whitespace-nowrap rounded-lg px-space-sm py-space-2xs font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-on-surface">Medium Format</Link>
            <Link href="/products?category=camera&tag=cine" className="whitespace-nowrap rounded-lg px-space-sm py-space-2xs font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-on-surface">Cine Cinema</Link>
            <Link href="/products?category=camera&tag=rangefinder" className="whitespace-nowrap rounded-lg px-space-sm py-space-2xs font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-on-surface">Rangefinder</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-4">
          {COLLECTIONS.map((c) => {
            const representative = getProductById(c.wishlistId);
            const wished = representative ? isWishlisted(representative.id) : false;
            return (
              <div key={c.title} className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container shadow-xl transition-all hover:shadow-[0_16px_48px_rgba(242,202,80,0.12)]">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-container-low">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" src={c.image} alt={c.alt} loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent" aria-hidden="true" />
                  <div className="absolute left-space-sm top-space-sm flex flex-col gap-1">
                    <span className="rounded-lg bg-surface-container-high/90 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase text-primary">{c.number}</span>
                    <span className="rounded bg-surface-container-low/80 px-space-xs py-0.5 font-telemetry-xs text-[10px] text-on-surface-variant">{c.metric}</span>
                  </div>
                  <div className="absolute right-space-sm top-space-sm">
                    <button
                      type="button"
                      onClick={() => representative && toggleWishlist(representative)}
                      aria-label={wished ? `Bỏ ${representative?.name} khỏi yêu thích` : `Lưu ${representative?.name} vào yêu thích`}
                      aria-pressed={wished}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high/90 transition-colors hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true" style={{ color: wished ? "#f2ca50" : undefined }}>
                        {wished ? "favorite" : "favorite_border"}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-space-sm p-space-lg">
                  <div>
                    <span className="block font-telemetry-xs text-telemetry-xs uppercase tracking-wider text-outline">{c.kind}</span>
                    <h3 className="font-headline-md text-headline-md text-on-surface transition-colors group-hover:text-primary">
                      <Link href={c.href}>{c.title}</Link>
                    </h3>
                    <p className="line-clamp-2 pt-space-2xs font-body-sm text-body-sm text-on-surface-variant">{c.desc}</p>
                  </div>
                  <div className="flex flex-col gap-space-xs border-t border-surface-container-high pt-space-sm">
                    <div className="flex items-center justify-between font-telemetry-data text-telemetry-data">
                      <span className="text-on-surface-variant">Khởi điểm từ</span>
                      <span className="text-[16px] font-bold text-primary">{c.price}</span>
                    </div>
                    <Link
                      href={c.href}
                      className="flex w-full items-center justify-center gap-space-2xs rounded-lg bg-surface-container-high py-space-xs text-center font-headline-sm text-telemetry-xs uppercase text-on-surface transition-all group-hover:bg-primary group-hover:text-on-primary"
                    >
                      <span>Khám Phá Phân Hệ</span>
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
