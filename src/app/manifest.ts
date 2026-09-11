import type { MetadataRoute } from "next";

/** Web App Manifest — PWA installable (icons trong public/icons). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LUMINA Optics — Thiết Bị Quang Học Cao Cấp",
    short_name: "LUMINA",
    description:
      "Máy ảnh flagship, medium format, ống kính cine và phụ kiện studio cao cấp — kiểm chuẩn collimator, bảo hành 5 năm tận nơi.",
    start_url: "/",
    display: "standalone",
    background_color: "#10141a",
    theme_color: "#10141a",
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
