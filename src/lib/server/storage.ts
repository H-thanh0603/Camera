import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

/**
 * Phase 2.3 — Object storage (Cloudflare R2, S3-compatible) cho ảnh sản phẩm.
 * Chưa cấu hình credentials → mọi hàm upload throw StorageNotConfigured
 * (endpoint trả 503), luồng paste-URL cũ của admin vẫn hoạt động.
 * next/image tự optimize remote (AVIF/WebP) nên không convert ở đây.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export class StorageNotConfigured extends Error {
  constructor() {
    super("Object storage chưa cấu hình (thiếu R2_* env).");
  }
}

export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export function getStorageConfig(): StorageConfig | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) {
    return null;
  }
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL.replace(/\/$/, ""),
  };
}

export function isStorageConfigured(): boolean {
  return getStorageConfig() !== null;
}

function storageClient(cfg: StorageConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

/** Validate file upload: đúng mime ảnh + ≤5MB. Trả lỗi tiếng Việt hoặc null. */
export function validateUploadFile(mime: string | null, size: number): string | null {
  if (!mime || !ALLOWED_MIME.has(mime)) {
    return "Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, AVIF, GIF).";
  }
  if (!Number.isFinite(size) || size <= 0) return "File ảnh rỗng.";
  if (size > MAX_UPLOAD_BYTES) return "File ảnh tối đa 5MB.";
  return null;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/**
 * Key ảnh: products/{scope}/{uuid}.{ext} — uuid chống đoán trước/dup,
 * scope gom theo productId (hoặc "tmp" khi upload trước lúc tạo SP).
 */
export function buildImageKey(scope: string, mime: string): string {
  const safe = scope.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "tmp";
  const ext = MIME_EXT[mime] ?? "jpg";
  return `products/${safe}/${randomUUID()}.${ext}`;
}

export async function uploadImage(
  body: Uint8Array,
  mime: string,
  scope: string,
): Promise<{ url: string; key: string }> {
  const cfg = getStorageConfig();
  if (!cfg) throw new StorageNotConfigured();
  const key = buildImageKey(scope, mime);
  await storageClient(cfg).send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { url: `${cfg.publicUrl}/${key}`, key };
}
