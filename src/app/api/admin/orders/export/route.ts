import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";

/**
 * GET /api/admin/orders/export?status=&from=&to= — xuất báo cáo đơn CSV.
 * from/to ISO date (lọc createdAt). BOM UTF-8 để Excel VN mở không lỗi font.
 * Giới hạn 2000 dòng/export (kế toán lọc theo tháng).
 */

const MAX_ROWS = 2000;

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const status = params.get("status")?.trim();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if ((from && (!fromDate || Number.isNaN(fromDate.getTime()))) || (to && (!toDate || Number.isNaN(toDate.getTime())))) {
    return NextResponse.json({ error: "from/to phải là ngày ISO hợp lệ." }, { status: 422 });
  }
  const orders = await prisma.order.findMany({
    where: {
      ...(status && status !== "all" ? { status } : {}),
      ...((fromDate || toDate)
        ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS + 1,
    include: { lines: true },
  });
  const truncated = orders.length > MAX_ROWS;
  const rows = orders.slice(0, MAX_ROWS);
  const header = ["Mã đơn", "Ngày tạo", "Khách hàng", "Điện thoại", "Trạng thái", "Thanh toán", "Tổng (VND)", "Giảm (VND)", "Số món", "Địa chỉ"];
  const lines = [header.map(csvCell).join(",")];
  for (const o of rows) {
    const totals = (o.totals ?? {}) as { total?: number; discount?: number };
    const contact = (o.contact ?? {}) as { fullName?: string; phone?: string };
    const shipping = (o.shipping ?? {}) as { address?: string; district?: string; city?: string };
    const itemCount = o.lines.reduce((sum, l) => sum + l.quantity, 0);
    lines.push(
      [
        o.number,
        o.createdAt.toISOString(),
        contact.fullName ?? "",
        contact.phone ?? "",
        o.status,
        o.payment,
        totals.total ?? 0,
        totals.discount ?? 0,
        itemCount,
        [shipping.address, shipping.district, shipping.city].filter(Boolean).join(", "),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lumina-orders-${stamp}.csv"`,
      "X-Truncated": truncated ? "true" : "false",
    },
  });
}
