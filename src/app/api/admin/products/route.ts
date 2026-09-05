import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { dbProductToDomain } from "@/lib/server/product-db";
import type { Prisma } from "@prisma/client";

/**
 * GET  /api/admin/products — danh sách sản phẩm (mọi trạng thái).
 * POST /api/admin/products — tạo sản phẩm mới.
 */

export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const rows = await prisma.product.findMany({ include: { variants: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ products: rows.map((r) => dbProductToDomain(r)) });
}

/** Nhận payload tự do từ admin form, validate tối thiểu trước khi ghi DB. */
function validateProductPayload(body: Record<string, unknown>): { error?: string; data?: Record<string, unknown> } {
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
    shortDescription: String(body.shortDescription ?? "").trim() || String(body.description ?? "").slice(0, 140),
    price,
    compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : null,
    stock: Number.isInteger(Number(body.stock)) ? Number(body.stock) : 0,
    availability: ["in_stock", "low_stock", "pre_order", "out_of_stock", "contact"].includes(String(body.availability))
      ? String(body.availability)
      : "in_stock",
    rating: Math.min(5, Math.max(0, Number(body.rating) || 0)),
    reviewCount: Number.isInteger(Number(body.reviewCount)) ? Number(body.reviewCount) : 0,
    monthlyFrom: body.monthlyFrom ? Number(body.monthlyFrom) : null,
  };
  return { data };
}

export async function POST(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { error, data } = validateProductPayload(body);
  if (error || !data) return NextResponse.json({ error }, { status: 422 });

  try {
    const id = body.id ? String(body.id) : `p-${String(body.slug)}`;
    const variantsInput = Array.isArray(body.variants) ? (body.variants as Record<string, unknown>[]) : [];
    const variantData = variantsInput
      .filter((v) => v.id && v.sku && v.name)
      .map((v) => ({
        id: String(v.id),
        sku: String(v.sku),
        name: String(v.name),
        price: Number(v.price) || Number(data.price),
        compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
        stock: Number.isInteger(Number(v.stock)) ? Number(v.stock) : 0,
        availability: String(v.availability ?? "in_stock"),
        image: (v.image ?? null) as Prisma.InputJsonValue,
      }));

    const row = await prisma.product.upsert({
      where: { id },
      update: { ...data, variants: { deleteMany: {}, create: variantData } } as Prisma.ProductUncheckedUpdateInput,
      create: {
        ...(data as Prisma.ProductUncheckedCreateInput),
        id,
        images: (body.images ?? []) as Prisma.InputJsonValue,
        thumbnail: (body.thumbnail ?? { url: "", alt: "" }) as Prisma.InputJsonValue,
        specifications: (body.specifications ?? {}) as Prisma.InputJsonValue,
        tags: (body.tags ?? []) as Prisma.InputJsonValue,
        badges: (body.badges ?? []) as Prisma.InputJsonValue,
        variants: { create: variantData },
      },
      include: { variants: true },
    });

    revalidatePath("/", "layout");
    return NextResponse.json({ product: dbProductToDomain(row) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error && e.message.includes("Unique") ? "SKU hoặc slug đã tồn tại." : "Không lưu được sản phẩm.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
