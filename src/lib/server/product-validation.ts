import { Prisma } from "@prisma/client";

/**
 * Validate payload sản phẩm dùng chung cho POST (tạo) và PUT (sửa) admin.
 * Trước đây PUT nhận body tự do — giờ cùng một luật như POST.
 */

const AVAILABILITY = ["in_stock", "low_stock", "pre_order", "out_of_stock", "contact"];

export interface ValidatedProduct {
  error?: string;
  data?: Record<string, unknown>;
}

export function validateProductPayload(body: Record<string, unknown>): ValidatedProduct {
  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  const brand = String(body.brand ?? "").trim();
  const category = String(body.category ?? "").trim();
  const price = Number(body.price);
  const sku = String(body.sku ?? "").trim();

  if (name.length < 2) return { error: "Tên sản phẩm bắt buộc." };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { error: "Slug chỉ gồm chữ thường, số và dấu gạch." };
  if (!brand) return { error: "Thương hiệu bắt buộc." };
  if (!category) return { error: "Danh mục bắt buộc." };
  if (!Number.isInteger(price) || price <= 0) return { error: "Giá phải là số nguyên dương." };
  if (!sku) return { error: "SKU bắt buộc." };

  const data: Record<string, unknown> = {
    name,
    slug,
    brand,
    category,
    sku,
    subcategory: String(body.subcategory ?? "").trim() || "Khác",
    description: String(body.description ?? "").trim(),
    shortDescription:
      String(body.shortDescription ?? "").trim() || String(body.description ?? "").slice(0, 140),
    price,
    compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : null,
    stock: Number.isInteger(Number(body.stock)) ? Number(body.stock) : 0,
    availability: AVAILABILITY.includes(String(body.availability)) ? String(body.availability) : "in_stock",
    rating: Math.min(5, Math.max(0, Number(body.rating) || 0)),
    reviewCount: Number.isInteger(Number(body.reviewCount)) ? Number(body.reviewCount) : 0,
    monthlyFrom: body.monthlyFrom ? Number(body.monthlyFrom) : null,
  };
  return { data };
}

export interface ValidatedVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  availability: string;
  image: Prisma.InputJsonValue;
}

/** Lọc variant thiếu trường bắt buộc + chuẩn hoá kiểu (dùng chung POST/PUT). */
export function validateVariants(body: Record<string, unknown>, fallbackPrice: number): ValidatedVariant[] {
  const input = Array.isArray(body.variants) ? (body.variants as Record<string, unknown>[]) : [];
  const out: ValidatedVariant[] = [];
  for (const v of input) {
    if (!v.id || !v.sku || !v.name) continue;
    // Giá khai báo mà <= 0/không nguyên → loại (không fallback âm thầm);
    // thiếu giá mới dùng giá SP. Giá 0 = hàng tặng miễn phí = abuse vector.
    const rawPrice = v.price === undefined || v.price === null || v.price === "" ? fallbackPrice : Number(v.price);
    const price = rawPrice;
    // Giá âm/0 và stock âm là data-poisoning (tổng đơn có thể âm) → loại variant
    if (!Number.isInteger(price) || price <= 0) continue;
    const stock = Number(v.stock);
    if (!Number.isInteger(stock) || stock < 0) continue;
    out.push({
      id: String(v.id),
      sku: String(v.sku),
      name: String(v.name).slice(0, 120),
      price,
      compareAtPrice: v.compareAtPrice && Number(v.compareAtPrice) > 0 ? Number(v.compareAtPrice) : null,
      stock,
      availability: AVAILABILITY.includes(String(v.availability)) ? String(v.availability) : "in_stock",
      image: sanitizeImage(v.image),
    });
  }
  return out;
}

function isSafeUrl(url: unknown): url is string {
  return typeof url === "string" && (url.startsWith("https://") || url.startsWith("/")) && url.length <= 500;
}

function sanitizeImage(input: unknown): Prisma.InputJsonValue {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const rec = input as Record<string, unknown>;
    if (isSafeUrl(rec.url)) {
      return { url: rec.url, alt: String(rec.alt ?? "").slice(0, 200) } as Prisma.InputJsonValue;
    }
  }
  return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
}

/** Whitelist JSON tự do của admin — chặn Stored-XSS/data-poisoning qua ảnh/spec/tags. */
export interface SanitizedProductJson {
  images: Prisma.InputJsonValue;
  thumbnail: Prisma.InputJsonValue;
  specifications: Prisma.InputJsonValue;
  tags: Prisma.InputJsonValue;
  badges: Prisma.InputJsonValue;
  highlights: Prisma.InputJsonValue;
  inTheBox: Prisma.InputJsonValue;
  compatibleWith: Prisma.InputJsonValue;
}

function stringList(input: unknown, maxItems: number, maxLen: number): string[] {  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function sanitizeProductJson(body: Record<string, unknown>): SanitizedProductJson {
  const images = Array.isArray(body.images)
    ? body.images
        .map((img) => {
          if (img && typeof img === "object" && !Array.isArray(img)) {
            const rec = img as Record<string, unknown>;
            return isSafeUrl(rec.url)
              ? { url: rec.url, alt: String(rec.alt ?? "").slice(0, 200) }
              : null;
          }
          return null;
        })
        .filter((v): v is { url: string; alt: string } => v !== null)
        .slice(0, 20)
    : [];
  const specs: Record<string, string> =
    body.specifications && typeof body.specifications === "object" && !Array.isArray(body.specifications)
      ? Object.fromEntries(
          Object.entries(body.specifications as Record<string, unknown>)
            .filter(([k, v]) => typeof k === "string" && typeof v === "string")
            .map(([k, v]) => [k.slice(0, 40), (v as string).slice(0, 300)] as [string, string])
            .slice(0, 30),
        )
      : {};
  const thumb =
    body.thumbnail && typeof body.thumbnail === "object" && !Array.isArray(body.thumbnail)
      ? (() => {
          const rec = body.thumbnail as Record<string, unknown>;
          return isSafeUrl(rec.url)
            ? { url: rec.url, alt: String(rec.alt ?? "").slice(0, 200) }
            : { url: "", alt: "" };
        })()
      : { url: "", alt: "" };
  return {
    images: images as unknown as Prisma.InputJsonValue,
    thumbnail: thumb as unknown as Prisma.InputJsonValue,
    specifications: specs as unknown as Prisma.InputJsonValue,
    tags: stringList(body.tags, 20, 40) as unknown as Prisma.InputJsonValue,
    badges: stringList(body.badges, 10, 40) as unknown as Prisma.InputJsonValue,
    highlights: (body.highlights ? stringList(body.highlights, 20, 200) : null) as unknown as Prisma.InputJsonValue,
    inTheBox: (body.inTheBox ? stringList(body.inTheBox, 20, 200) : null) as unknown as Prisma.InputJsonValue,
    compatibleWith: (body.compatibleWith
      ? stringList(body.compatibleWith, 20, 64)
      : null) as unknown as Prisma.InputJsonValue,
  };
}

/**
 * Chuỗi tag phi chuẩn hóa "|t1|t2|" cho filter LIKE portable.
 * Match chính xác nhờ pipe bao quanh — "|cine|" không khớp "|cinema|".
 */
export function buildTagString(tags: string[]): string {
  const clean = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  return `|${clean.join("|")}|`;
}
