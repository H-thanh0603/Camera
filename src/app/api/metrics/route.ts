import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/metrics — điểm nhận event analytics + web vitals + client error.
 * Hiện ghi ra console có cấu trúc (grep được khi vận hành); chưa persist.
 * Production: đổi thân hàm này thành client của GA4 Measurement Protocol /
 * Plausible API / tự lưu vào DB — instrumentation phía UI không đổi.
 *
 * GET trả về counters in-memory (tính từ lúc server start) cho demo giám sát.
 */

const counters = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { event?: string; props?: Record<string, unknown> };
    if (!body.event || typeof body.event !== "string" || body.event.length > 64) {
      return NextResponse.json({ error: "Event không hợp lệ." }, { status: 422 });
    }
    counters.set(body.event, (counters.get(body.event) ?? 0) + 1);
    console.info(JSON.stringify({ type: "analytics", event: body.event, props: body.props ?? {}, ts: new Date().toISOString() }));
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ events: Object.fromEntries(counters) });
}
