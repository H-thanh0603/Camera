import { NextResponse, type NextRequest } from "next/server";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";
import {
  StorageNotConfigured,
  isStorageConfigured,
  uploadImage,
  validateImageBytes,
  validateUploadFile,
} from "@/lib/server/storage";

/**
 * POST /api/admin/upload — upload ảnh sản phẩm lên R2.
 * Form: file (binary) + scope (productId hoặc "tmp", optional).
 * Trả { url, key }. Chưa cấu hình R2_* → 503 (admin paste URL thủ công).
 */
export async function POST(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Object storage chưa cấu hình. Paste URL ảnh thủ công." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const file = form.get("file");
  const scope = String(form.get("scope") ?? "tmp").slice(0, 64);
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file ảnh." }, { status: 422 });
  }
  const invalid = validateUploadFile(file.type || null, file.size);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const verified = validateImageBytes(bytes, file.type || null);
    if ("error" in verified) return NextResponse.json({ error: verified.error }, { status: 422 });
    const { url, key } = await uploadImage(bytes, verified.mime, scope);
    const user = await getSessionUser();
    await logAudit(
      user ? { id: user.id, name: user.name, email: user.email } : null,
      "image.uploaded",
      "Product",
      scope,
      { key },
    );
    return NextResponse.json({ url, key });
  } catch (error) {
    if (error instanceof StorageNotConfigured) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    logger.error("upload.failed", { scope });
    return NextResponse.json({ error: "Upload thất bại. Thử lại sau." }, { status: 502 });
  }
}
