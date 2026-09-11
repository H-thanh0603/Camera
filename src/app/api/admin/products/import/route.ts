import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/server/product-db";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { getSessionUser } from "@/lib/server/session";
import { logAudit } from "@/lib/server/audit";
import { buildSearchText } from "@/lib/server/product-search-pg";
import { buildTagString } from "@/lib/server/product-validation";
import { parseCsvProducts } from "@/lib/server/csv-import";
import { Prisma } from "@/generated/prisma/client";

/**
 * POST /api/admin/products/import { csv, dryRun } — nhập catalogue từ CSV.
 * dryRun=true → chỉ validate, trả preview (không ghi DB).
 * dryRun=false → upsert theo slug: SP mới tạo tối giản (ảnh/spec rỗng,
 * admin bổ sung sau), SP cũ cập nhật giá/tồn/trạng thái + ghi sổ kho khi
 * tồn đổi. Tối đa 500 dòng/file.
 */

export async function POST(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const csv = String(body.csv ?? "");
  if (!csv.trim() || csv.length > 2_000_000) {
    return NextResponse.json({ error: "CSV trống hoặc quá lớn (tối đa ~2MB)." }, { status: 422 });
  }
  const { rows, issues } = parseCsvProducts(csv);
  if (body.dryRun !== false) {
    return NextResponse.json({
      dryRun: true,
      valid: rows.length,
      issues,
      sample: rows.slice(0, 5).map((r) => ({ line: r.line, slug: r.slug, name: r.name, price: r.price })),
    });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "Không có dòng hợp lệ để nhập.", issues }, { status: 422 });
  }
  const actor = await getSessionUser();
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const existing = await prisma.product.findUnique({
      where: { slug: r.slug },
      select: { id: true, stock: true },
    });
    const tagString = buildTagString(r.tags);
    const searchText = buildSearchText({ name: r.name, brand: r.brand, subcategory: r.subcategory, sku: r.slug.toUpperCase(), tags: r.tags });
    if (existing) {
      await prisma.product.update({
        where: { slug: r.slug },
        data: {
          name: r.name,
          brand: r.brand,
          category: r.category,
          subcategory: r.subcategory,
          price: r.price,
          compareAtPrice: r.compareAtPrice,
          stock: r.stock,
          availability: r.availability,
          shortDescription: r.shortDescription,
          ...(r.description ? { description: r.description } : {}),
          tags: r.tags,
          tagString,
          searchText,
        },
      });
      if (existing.stock !== r.stock) {
        await prisma.stockMovement.create({
          data: {
            productId: existing.id,
            variantId: null,
            type: "adjust",
            quantity: r.stock - existing.stock,
            balanceAfter: r.stock,
            reason: "Nhập CSV",
            createdBy: actor?.id ?? null,
          },
        });
      }
      updated++;
    } else {
      const id = `p-${r.slug}`;
      await prisma.product.create({
        data: {
          id,
          sku: r.slug.toUpperCase().slice(0, 32),
          slug: r.slug,
          name: r.name,
          brand: r.brand,
          category: r.category,
          subcategory: r.subcategory,
          description: r.description,
          shortDescription: r.shortDescription,
          price: r.price,
          compareAtPrice: r.compareAtPrice,
          currency: "VND",
          stock: r.stock,
          availability: r.availability,
          images: [],
          thumbnail: { url: "", alt: "" },
          specifications: {},
          tags: r.tags,
          tagString,
          badges: [],
          searchText,
        },
      });
      if (r.stock > 0) {
        await prisma.stockMovement.create({
          data: {
            productId: id,
            variantId: null,
            type: "in",
            quantity: r.stock,
            balanceAfter: r.stock,
            reason: "Tồn đầu kỳ (nhập CSV)",
            createdBy: actor?.id ?? null,
          },
        });
      }
      created++;
    }
  }
  revalidatePath("/", "layout");
  revalidateTag(CATALOG_TAG, "max");
  await logAudit(actor, "product.csv_imported", "product", "bulk", { created, updated, issues: issues.length });
  return NextResponse.json({ created, updated, issues });
}
