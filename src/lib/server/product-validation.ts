import type { Prisma } from "@prisma/client";

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
  return input
    .filter((v) => v.id && v.sku && v.name)
    .map((v) => ({
      id: String(v.id),
      sku: String(v.sku),
      name: String(v.name),
      price: Number(v.price) || fallbackPrice,
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      stock: Number.isInteger(Number(v.stock)) ? Number(v.stock) : 0,
      availability: AVAILABILITY.includes(String(v.availability)) ? String(v.availability) : "in_stock",
      image: (v.image ?? null) as Prisma.InputJsonValue,
    }));
}
