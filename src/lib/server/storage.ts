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

/**
 * Ảnh review do client gửi kèm phải là URL do chính endpoint upload của shop
 * tạo ra (R2_PUBLIC_URL + "/products/reviews/" hoặc legacy scope "reviews/").
 * Chặn attacker POST trực tiếp URL ngoài (tracking pixel, phishing, IP leak
 * người xem) vào review rồi chờ duyệt hiển thị.
 * Chưa cấu hình R2 → từ chối tất cả (fail-closed, khỏi kiểm duyệt URL lạ).
 */
export function isTrustedReviewPhotoUrl(url: string): boolean {
  const cfg = getStorageConfig();
  if (!cfg) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  let publicHost: string;
  try {
    publicHost = new URL(cfg.publicUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (parsed.hostname.toLowerCase() !== publicHost) return false;
  const path = parsed.pathname;
  return path.startsWith("/products/reviews/") || path.startsWith("/reviews/");
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

/**
 * Sniff magic bytes — `File.type` do client tự khai nên không tin được
 * (SVG/EXE đổi tên .png vẫn qua). Trả mime thật hoặc null khi không nhận diện.
 * Đọc tối đa 32 byte đầu, không load cả file.
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // AVIF/HEIF: ....ftyp + major brand avif/avis/mif1/msf1/heic/heix
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (brand === "avif" || brand === "avis") return "image/avif";
    return null; // HEIC không trong allowlist → từ chối
  }
  return null;
}

/**
 * Đối chiếu nội dung thật với mime khai báo. Trả { mime } đã xác minh
 * (dùng mime này khi upload — không dùng `file.type`), hoặc lỗi tiếng Việt.
 */
export function validateImageBytes(bytes: Uint8Array, claimedMime: string | null): { mime: string } | { error: string } {
  const sniffed = sniffImageMime(bytes);
  if (!sniffed) {
    return { error: "File không phải ảnh hợp lệ (định dạng không nhận diện được)." };
  }
  if (claimedMime && claimedMime !== sniffed) {
    return { error: `File thực tế là ${sniffed}, không khớp định dạng khai báo.` };
  }
  return { mime: sniffed };
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/**
 * Kích thước ảnh tối đa (pixel mỗi chiều) — chống decompression bomb (L7):
 * PNG 5MB có thể nở tới hàng trăm MP, DoS next/image + R2 bandwidth.
 * Parse header thuần (không thêm sharp): PNG IHDR, JPEG SOF, GIF header,
 * WebP VP8/VP8L/VP8X. AVIF parse phức tạp → chặn theo kích thước file
 * (≤2MB) thay vì dimensions.
 */
export const MAX_IMAGE_DIMENSION = 8000;
export const MAX_AVIF_BYTES = 2 * 1024 * 1024;

export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  // PNG: 8-byte sig + IHDR (width/height BE u32 tại offset 16/20)
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // GIF: width/height LE u16 tại offset 6/8
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
  }
  // JPEG: quét markers tìm SOF0-SOF3 (FF C0-C3), dimensions BE u16
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      }
      const len = dv.getUint16(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
    return null;
  }
  // WebP: RIFF....WEBP + VP8/VP8L/VP8X
  if (
    bytes.length >= 30 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    const fourcc = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
    if (fourcc === "VP8 " && bytes.length >= 30) {
      const w = dv.getUint16(26, true) & 0x3fff;
      const h = dv.getUint16(28, true) & 0x3fff;
      if (w > 0 && h > 0) return { width: w, height: h };
    } else if (fourcc === "VP8L" && bytes.length >= 25) {
      const b0 = bytes[21]!;
      const b1 = bytes[22]!;
      const b2 = bytes[23]!;
      const b3 = bytes[24]!;
      const w = 1 + (((b1 & 0x3f) << 8) | b0);
      const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      if (w > 0 && h > 0) return { width: w, height: h };
    } else if (fourcc === "VP8X" && bytes.length >= 30) {
      const w = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
      const h = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
      if (w > 0 && h > 0) return { width: w, height: h };
    }
    return null;
  }
  return null; // AVIF + lạ: caller áp giới hạn file thay vì dimensions
}

/** Validate dimensions/file cho upload — trả lỗi tiếng Việt hoặc null. */
export function validateImageDimensions(mime: string, bytes: Uint8Array): string | null {
  if (mime === "image/avif") {
    // AVIF không parse header thuần được — chặn file lớn thay vì dimensions
    if (bytes.length > MAX_AVIF_BYTES) return "Ảnh AVIF tối đa 2MB.";
    return null;
  }
  const dims = imageDimensions(bytes);
  if (!dims) return "Không đọc được kích thước ảnh.";
  if (dims.width <= 0 || dims.height <= 0 || dims.width > MAX_IMAGE_DIMENSION || dims.height > MAX_IMAGE_DIMENSION) {
    return `Ảnh tối đa ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}px.`;
  }
  if (dims.width * dims.height > 50_000_000) return "Ảnh quá lớn (tối đa 50 megapixel).";
  return null;
}

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
