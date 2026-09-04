import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/session";

/**
 * GET /api/products/:id/reviews
 * - approved: các đánh giá đã duyệt (công khai)
 * - pending: đánh giá chưa duyệt của chính phiên hiện tại
 * Seed reviews tĩnh đi kèm từ server component, không qua API này.
 */

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const approved = await prisma.review.findMany({
    where: { productId: id, approved: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const pending = user
    ? await prisma.review.findMany({
        where: { productId: id, userId: user.id, approved: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  return NextResponse.json({ approved, pending });
}
