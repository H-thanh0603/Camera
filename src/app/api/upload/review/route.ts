import { NextResponse, type NextRequest } from "next/server";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { logger } from "@/lib/server/logger";
import {
  StorageNotConfigured,
  isStorageConfigured,
  uploadImage,
  validateUploadFile,
} from "@/lib/server/storage";

/**
 * POST /api/upload/review — upload ảnh đánh giá (public, không cần admin).
 * Giới hạn 3/phút/IP, ≤3MB. Ảnh chỉ hiển thị sau khi review được duyệt
 * nên lạm dụng bị chặn ở khâu kiểm duyệt.
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 3 });
const MAX_REVIEW_BYTES = 3 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const limit = await limiter.check(`upload-review:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Tải quá nhiều ảnh. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
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
    const { url } = await uploadImage(bytes, file.type, "reviews");
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof StorageNotConfigured) {
      return NextResponse.json({ error: "Tải ảnh tạm bảo trì." }, { status: 503 });
    }
    logger.error("upload.review_failed", {});
    return NextResponse.json({ error: "Upload thất bại. Thử lại sau." }, { status: 502 });
  }
}
