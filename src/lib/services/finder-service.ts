import type { FinderAnswers, FinderRecommendation, PhotographyStyle, Product } from "@/lib/types";
import { getCatalog } from "@/lib/repositories/product-repository";

/**
 * FinderService — chấm điểm gợi ý máy ảnh từ câu trả lời khảo sát.
 * Logic tách khỏi UI để có thể test và sau này thay bằng recommendation engine.
 */

export const BUDGET_RANGES: Record<FinderAnswers["budget"], { label: string; min: number; max: number }> = {
  under_100m: { label: "Dưới 100 triệu", min: 0, max: 100_000_000 },
  "100m_250m": { label: "100 – 250 triệu", min: 100_000_000, max: 250_000_000 },
  "250m_400m": { label: "250 – 400 triệu", min: 250_000_000, max: 400_000_000 },
  above_400m: { label: "Trên 400 triệu", min: 400_000_000, max: Number.POSITIVE_INFINITY },
};

const STYLE_TAGS: PhotographyStyle[] = ["portrait", "landscape", "street", "wildlife", "sports", "video", "hybrid", "travel"];

const EXPERIENCE_WEIGHT: Record<FinderAnswers["experience"], number> = {
  beginner: 0.18,
  intermediate: 0.12,
  professional: 0.08,
};

export function isCamera(p: Product): boolean {
  return p.category === "camera" && p.availability !== "contact";
}

/** Chấm điểm một sản phẩm so với câu trả lời — điểm trả về trong khoảng 0..1. */
export function scoreProduct(product: Product, answers: FinderAnswers): number {
  if (!isCamera(product)) return 0;
  let score = 0;

  // 1. Ngân sách (trọng số lớn nhất — quyền quyết định thật sự của người mua)
  const budget = BUDGET_RANGES[answers.budget];
  if (product.price >= budget.min && product.price <= budget.max) score += 0.42;
  else {
    const overshoot = product.price > budget.max ? (product.price - budget.max) / budget.max : 0;
    score += Math.max(0, 0.2 - overshoot * 0.2); // vượt ngân sách chỉ được điểm rất thấp
  }

  // 2. Phong cách chụp
  const styleMatches = answers.styles.filter((s) => product.tags.includes(s)).length;
  if (answers.styles.length) score += Math.min(0.28, (styleMatches / answers.styles.length) * 0.28);

  // 3. Cảm biến
  const sensorTag = `sensor:${answers.sensorPreference}`;
  if (answers.sensorPreference === "any" || product.tags.includes(sensorTag)) score += 0.14;

  // 4. Kích thước/cân nặng
  if (product.tags.includes(`size:${answers.sizePreference}`)) score += 0.1;

  // 5. Trình độ phù hợp (điểm nhỏ, không loại sản phẩm tốt)
  const expFit = ["exp:beginner", "exp:intermediate", "exp:professional"].includes(`exp:${answers.experience}`);
  if (expFit && product.tags.includes(`exp:${answers.experience}`)) score += EXPERIENCE_WEIGHT[answers.experience];

  // 6. Thương hiệu ưa thích
  if (answers.brandPreference && product.brand === answers.brandPreference) score += 0.06;

  // 7. Độ tin cậy cộng đồng (rất nhỏ, tránh dominated bởi rating)
  score += (product.rating - 4.5) * 0.02;

  return Math.min(1, score);
}

function buildReasons(product: Product, answers: FinderAnswers): string[] {
  const reasons: string[] = [];
  const budget = BUDGET_RANGES[answers.budget];
  if (product.price >= budget.min && product.price <= budget.max)
    reasons.push(`Nằm trong ngân sách ${budget.label.toLowerCase()}`);
  if (answers.sensorPreference !== "any" && product.tags.includes(`sensor:${answers.sensorPreference}`)) {
    const sensorLabel =
      answers.sensorPreference === "fullframe" ? "Full-frame" : answers.sensorPreference === "medium_format" ? "Medium format" : "APS-C";
    reasons.push(`Cảm biến ${sensorLabel} đúng sở thích của bạn`);
  }
  const matched = answers.styles.filter((s) => product.tags.includes(s));
  if (matched.length) reasons.push(`Tối ưu cho: ${matched.join(", ")}`);
  if (answers.sizePreference === "compact" && product.tags.includes("size:compact"))
    reasons.push("Nhỏ gọn, dễ mang theo mỗi ngày");
  if (answers.sizePreference === "performance" && product.tags.includes("size:performance"))
    reasons.push("Cân nặng xứng đáng với hiệu năng tối đa");
  for (const h of product.highlights?.slice(0, 1) ?? []) reasons.push(h);
  return reasons.slice(0, 4);
}

export function findRecommendations(answers: FinderAnswers, limit = 3): FinderRecommendation[] {
  return getCatalog().map((product) => ({ product, score: scoreProduct(product, answers) }))
    .filter((r) => r.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({
      product: r.product,
      score: r.score,
      matchPercent: Math.round(r.score * 100),
      reasons: buildReasons(r.product, answers),
      alternatives: STYLE_TAGS.includes(answers.styles[0])
        ? getCatalog().filter(
            (p) => p.id !== r.product.id && p.category === "camera" && answers.styles.some((s) => p.tags.includes(s)),
          )
            .slice(0, 2)
            .map((p) => p.name)
        : undefined,
    }));
}
