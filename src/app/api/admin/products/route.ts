import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { dbProductToDomain } from "@/lib/server/product-db";
import { validateProductPayload, validateVariants } from "@/lib/server/product-validation";
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
    const variantData = validateVariants(body, Number(data.price));

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
    await logAudit(await getSessionUser(), "product.upsert", "product", row.id, { name: row.name, price: row.price });
    return NextResponse.json({ product: dbProductToDomain(row) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error && e.message.includes("Unique") ? "SKU hoặc slug đã tồn tại." : "Không lưu được sản phẩm.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
