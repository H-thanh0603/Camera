import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/server/product-db";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { dbProductToDomain } from "@/lib/server/product-db";
import { validateProductPayload, validateVariants, sanitizeProductJson, buildTagString } from "@/lib/server/product-validation";
import type { Prisma } from "@/generated/prisma/client";

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

    // Create-only: trùng id/slug/SKU → 409, không bao giờ ghi đè qua POST
    const json = sanitizeProductJson(body);
    const row = await prisma.product.create({
      data: {
        ...(data as Prisma.ProductUncheckedCreateInput),
        id,
        ...json,
        tagString: buildTagString((json.tags ?? []) as string[]),
        variants: { create: variantData },
      },
      include: { variants: true },
    });

    revalidatePath("/", "layout");
    revalidateTag(CATALOG_TAG, "max");
    const actor = await getSessionUser();
    // Sổ kho: tồn đầu kỳ khi tạo SP
    if (row.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: row.id,
          variantId: null,
          type: "in",
          quantity: row.stock,
          balanceAfter: row.stock,
          reason: "Tồn đầu kỳ (tạo sản phẩm)",
          createdBy: actor?.id ?? null,
        },
      });
    }
    await logAudit(await getSessionUser(), "product.created", "product", row.id, { name: row.name, price: row.price });
    return NextResponse.json({ product: dbProductToDomain(row) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error && e.message.includes("Unique") ? "SKU hoặc slug đã tồn tại." : "Không lưu được sản phẩm.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
