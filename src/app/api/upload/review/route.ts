import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { logger } from "@/lib/server/logger";
import { hashId } from "@/lib/server/scrub";
import {
  StorageNotConfigured,
  isStorageConfigured,
  uploadImage,
  validateImageBytes,
  validateUploadFile,
} from "@/lib/server/storage";

/**
 * POST /api/upload/review — upload ảnh đánh giá (public, không cần login
 * vì review cho phép guest). Chống abuse 3 lớp:
 * 1. Rate 3/phút/IP + quota 20/ngày/IP (chặn farm ảnh/R2 bill).
 * 2. Magic-byte sniff — `File.type` client tự khai nên phải đối chiếu nội
 *    dung thật (chặn SVG/EXE đổi tên .png).
 * 3. Ảnh chỉ hiển thị sau khi review được duyệt (kiểm duyệt tay).
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 3 });
const dailyQuota = getRequestLimiter({ windowMs: 24 * 60 * 60_000, max: 20 });
const MAX_REVIEW_BYTES = 3 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = await limiter.check(`upload-review:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Tải quá nhiều ảnh. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const quota = await dailyQuota.check(`upload-review-day:${ip}`);
  if (!quota.allowed) {
    logger.warn("upload.review_quota_exceeded", { ipHash: hashId(ip) });
    return NextResponse.json(
      { error: "Bạn đã tải quá nhiều ảnh hôm nay. Thử lại ngày mai." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Tải ảnh tạm bảo trì." }, { status: 503 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Thiếu file ảnh." }, { status: 422 });
  if (file.size > MAX_REVIEW_BYTES) return NextResponse.json({ error: "Ảnh review tối đa 3MB." }, { status: 422 });
  const invalid = validateUploadFile(file.type || null, file.size);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Mime xác minh từ magic bytes — không dùng file.type để upload.
    const verified = validateImageBytes(bytes, file.type || null);
    if ("error" in verified) return NextResponse.json({ error: verified.error }, { status: 422 });
    const { url } = await uploadImage(bytes, verified.mime, "reviews");
    logger.info("upload.review_ok", {
      ipHash: hashId(ip),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
    });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof StorageNotConfigured) {
      return NextResponse.json({ error: "Tải ảnh tạm bảo trì." }, { status: 503 });
    }
    logger.error("upload.review_failed", {});
    return NextResponse.json({ error: "Upload thất bại. Thử lại sau." }, { status: 502 });
  }
}
