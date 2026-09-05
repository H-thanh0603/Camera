import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { dbProductToDomain } from "@/lib/server/product-db";
import type { Prisma } from "@prisma/client";

/** PUT /api/admin/products/:id — cập nhật; DELETE — xóa (cascade variants). */

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  try {
    const variantsInput = Array.isArray(body.variants) ? (body.variants as Record<string, unknown>[]) : [];
    const variantData = variantsInput
      .filter((v) => v.id && v.sku && v.name)
      .map((v) => ({
        id: String(v.id),
        sku: String(v.sku),
        name: String(v.name),
        price: Number(v.price) || Number(body.price),
        compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
        stock: Number.isInteger(Number(v.stock)) ? Number(v.stock) : 0,
        availability: String(v.availability ?? "in_stock"),
        image: (v.image ?? null) as Prisma.InputJsonValue,
      }));

    const row = await prisma.product.update({
      where: { id },
      data: {
        name: String(body.name),
        price: Number(body.price),
        compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : null,
        stock: Number.isInteger(Number(body.stock)) ? Number(body.stock) : 0,
        availability: String(body.availability ?? "in_stock"),
        description: String(body.description ?? ""),
        shortDescription: String(body.shortDescription ?? ""),
        subcategory: String(body.subcategory ?? "Khác"),
        monthlyFrom: body.monthlyFrom ? Number(body.monthlyFrom) : null,
        rating: Math.min(5, Math.max(0, Number(body.rating) || 0)),
        images: (body.images ?? []) as Prisma.InputJsonValue,
        thumbnail: (body.thumbnail ?? { url: "", alt: "" }) as Prisma.InputJsonValue,
        specifications: (body.specifications ?? {}) as Prisma.InputJsonValue,
        tags: (body.tags ?? []) as Prisma.InputJsonValue,
        badges: (body.badges ?? []) as Prisma.InputJsonValue,
        highlights: (body.highlights ?? null) as Prisma.InputJsonValue,
        inTheBox: (body.inTheBox ?? null) as Prisma.InputJsonValue,
        compatibleWith: (body.compatibleWith ?? null) as Prisma.InputJsonValue,
        variants: { deleteMany: {}, create: variantData },
      },
      include: { variants: true },
    });

    revalidatePath("/", "layout");
    await logAudit(await getSessionUser(), "product.update", "product", row.id, { name: row.name, price: row.price });
    return NextResponse.json({ product: dbProductToDomain(row) });
  } catch {
    return NextResponse.json({ error: "Không cập nhật được sản phẩm." }, { status: 409 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  revalidatePath("/", "layout");
  await logAudit(await getSessionUser(), "product.delete", "product", id);
  return NextResponse.json({ ok: true });
}
