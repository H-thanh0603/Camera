import type { Metadata } from "next";
/* Hallmark · genre: atmospheric · macrostructure: Photographic · theme: Midnight · enrichment: none · nav: preserved · footer: preserved · contrast: pass (40-41) · honest: pass (46) · chrome: pass (47) · tokens: pass (48) · responsive: pass (49) · icons: pass (30) · mobile: pass (34, 49, 50-57) · slop: 58/58 */
/* Hallmark · pre-emit critique: P5 H4 E4 S5 R4 V5 */
import { HeroHud } from "@/components/home/hero-hud";
import { LensAnatomy } from "@/components/home/lens-anatomy";
import { CollectionGrid } from "@/components/home/collection-grid";
import { SensorLab } from "@/components/home/sensor-lab";
import { VaultBestsellers } from "@/components/home/vault-bestsellers";
import { Testimonials } from "@/components/home/testimonials";

// ISR: admin sửa giá/stock hiển thị trong ~30s
export const revalidate = 30;

export const metadata: Metadata = {
  title: "LUMINA Optics — Nghệ Thuật Thu Nhận Ánh Sáng Đẳng Cấp Thuần Khiết",
  description:
    "Khám phá Lumina X-1 Monolith 61.2MP, medium format 100MP, ống kính cine anamorphic và phụ kiện studio cao cấp — kiểm chuẩn collimator, bảo hành 5 năm tận nơi.",
};

export default function HomePage() {
  return (
    <div className="flex w-full flex-col text-on-surface select-none">
      <HeroHud />
      <LensAnatomy />
      <CollectionGrid />
      <SensorLab />
      <VaultBestsellers />
      <Testimonials />
    </div>
  );
}
