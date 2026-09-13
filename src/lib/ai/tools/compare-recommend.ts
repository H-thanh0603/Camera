/**
 * Comparison + recommendation tools. Read-only, data-source backed, provider
 * independent. They return structured JSON the model summarises into advice.
 */

import { z } from "zod";
import type { Product } from "@/lib/types";
import type { CommerceTool } from "../agent/executor";
import { ToolRunError } from "../agent/executor";
import { fenceProduct } from "../agent/fencing";
import type { CommerceDataSource } from "./data-source";

const CATEGORIES = ["camera", "lens", "lighting", "tripod", "storage", "battery", "bag", "accessory"] as const;

const compareSchema = z.object({
  productIds: z.array(z.string().min(1).max(80)).min(2).max(4).describe("2–4 id hoặc slug sản phẩm để so sánh"),
});

const recommendSchema = z.object({
  budgetMin: z.number().int().min(0).optional(),
  budgetMax: z.number().int().min(0).optional(),
  category: z.enum(CATEGORIES).optional(),
  brand: z.string().min(1).max(80).optional(),
  styles: z.array(z.string().min(1).max(40)).max(6).optional(),
  limit: z.number().int().min(1).max(8).default(4),
});

/** Extract max number from a spec string (e.g. "1/8000s" -> 8000). */
function specNum(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const nums = value.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return undefined;
  const parsed = nums.map(Number).filter(Number.isFinite);
  if (parsed.length === 0) return undefined;
  return Math.max(...parsed);
}

interface Metric {
  key: string;
  label: string;
  direction: 1 | -1;
  num: (p: Product) => number | undefined;
}

const METRICS: Metric[] = [
  { key: "price", label: "Giá", direction: -1, num: (p) => p.price },
  { key: "rating", label: "Đánh giá", direction: 1, num: (p) => p.rating },
  { key: "burst", label: "Chụp liên tiếp", direction: 1, num: (p) => specNum(p.specifications.burst) },
  { key: "resolution", label: "Độ phân giải", direction: 1, num: (p) => specNum(p.specifications.resolution) },
  { key: "iso", label: "ISO tối đa", direction: 1, num: (p) => specNum(p.specifications.iso) },
  { key: "battery", label: "Pin (số ảnh)", direction: 1, num: (p) => specNum(p.specifications.battery) },
  { key: "weight", label: "Trọng lượng", direction: -1, num: (p) => specNum(p.specifications.weight) },
];

const SPEC_KEYS = ["sensor", "resolution", "iso", "autofocus", "burst", "video", "ibis", "battery", "weight", "dimensions", "mount"] as const;

export function compareProductsTool(source: CommerceDataSource): CommerceTool<typeof compareSchema, unknown> {
  return {
    name: "compare_products",
    description: "So sánh 2–4 sản phẩm (id hoặc slug). Trả matrix thông số + mỗi sản phẩm mạnh hơn ở đâu.",
    input: compareSchema,
    run: async (args) => {
      const unique = [...new Set(args.productIds)];
      const rows = await Promise.all(
        unique.map((ref) => (ref.includes("/") ? source.getProduct({ slug: ref }) : source.getProduct({ id: ref }))),
      );
      const products = rows.filter((p): p is Product => Boolean(p));
      if (products.length < 2) {
        throw new ToolRunError("not_found", "Cần ít nhất 2 sản phẩm hợp lệ để so sánh.");
      }

      const specs: Record<string, Record<string, string>> = {};
      for (const key of SPEC_KEYS) {
        const values = products.map((p) => ({ id: p.id, value: p.specifications[key] ?? "—" }));
        specs[key] = Object.fromEntries(values.map((v) => [v.id, v.value]));
      }

      const advantages: Array<{ id: string; name: string; advantage: string[] }> = products.map((p) => {
        const adv: string[] = [];
        for (const m of METRICS) {
          const vals = products.map((x) => m.num(x)).filter((n): n is number => n !== undefined);
          if (vals.length < 2) continue;
          const mine = m.num(p);
          if (mine === undefined) continue;
          const allSame = vals.every((v) => v === vals[0]);
          if (allSame) continue;
          const best = m.direction === 1 ? Math.max(...vals) : Math.min(...vals);
          if (mine === best) adv.push(m.label);
        }
        return { id: p.id, name: p.name, advantage: adv };
      });

      return {
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          priceVND: p.price,
          currency: p.currency,
          availability: p.availability,
          rating: p.rating,
          reviewCount: p.reviewCount,
        })),
        specifications: specs,
        advantages,
      };
    },
  };
}

function scoreProduct(p: Product, args: z.infer<typeof recommendSchema>): number {
  if (args.budgetMin != null && p.price < args.budgetMin) return 0;
  if (args.budgetMax != null && p.price > args.budgetMax) return 0;
  let s = 0.45; // in budget
  const styles = args.styles ?? [];
  if (styles.length) {
    const m = styles.filter((st) => p.tags.includes(st)).length;
    s += (m / styles.length) * 0.35;
  }
  if (args.brand && p.brand === args.brand) s += 0.15;
  s += (p.rating - 4.5) * 0.05;
  return Math.max(0, Math.min(1, s));
}

function buildReasons(p: Product, args: z.infer<typeof recommendSchema>): string[] {
  const out: string[] = [];
  if (args.budgetMin != null || args.budgetMax != null) out.push("Phù hợp ngân sách");
  out.push(`Thương hiệu ${p.brand}`);
  if (p.highlights?.[0]) out.push(p.highlights[0]);
  return out.slice(0, 3);
}

export function recommendProductsTool(source: CommerceDataSource): CommerceTool<typeof recommendSchema, unknown> {
  return {
    name: "recommend_products",
    description:
      "Gợi ý sản phẩm phù hợp theo ngân sách/category/brand/kiểu chụp. Trả về kèm điểm khớp % và lý do.",
    input: recommendSchema,
    run: async (args) => {
      const items = await source.searchProducts({
        category: args.category,
        brand: args.brand,
        minPrice: args.budgetMin,
        maxPrice: args.budgetMax,
        sort: "featured",
        limit: Math.min(60, args.limit * 12),
      });
      const scored = items
        .map((p) => ({ p, score: scoreProduct(p, args) }))
        .filter((s) => s.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, args.limit);
      return {
        recommendations: scored.map((s) => ({
          product: fenceProduct(s.p),
          matchPercent: Math.round(s.score * 100),
          reasons: buildReasons(s.p, args),
        })),
      };
    },
  };
}