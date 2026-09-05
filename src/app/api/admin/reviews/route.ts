import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";

/** GET /api/admin/reviews — danh sách review kèm tên sản phẩm (?status=pending|approved|all). */

export async function GET(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const status = request.nextUrl.searchParams.get("status") ?? "pending";
  const where =
    status === "all" ? {} : status === "approved" ? { approved: true } : { approved: false };

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const productIds = [...new Set(reviews.map((r) => r.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true },
  });
  const productNameById = new Map(products.map((p) => [p.id, { name: p.name, slug: p.slug }]));

  return NextResponse.json({
    reviews: reviews.map((r) => ({ ...r, product: productNameById.get(r.productId) ?? null })),
  });
}
