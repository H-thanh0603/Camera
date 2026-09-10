import { describe, expect, test } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  StorageNotConfigured,
  buildImageKey,
  getStorageConfig,
  isStorageConfigured,
  sniffImageMime,
  uploadImage,
  validateImageBytes,
  validateUploadFile,
} from "@/lib/server/storage";

describe("validateUploadFile", () => {
  test("chấp nhận mime ảnh hợp lệ", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]) {
      expect(validateUploadFile(mime, 1024)).toBeNull();
    }
  });
  test("từ chối mime lạ / rỗng", () => {
    expect(validateUploadFile("application/pdf", 1024)).toContain("ảnh");
    expect(validateUploadFile("text/html", 1024)).toContain("ảnh");
    expect(validateUploadFile(null, 1024)).toContain("ảnh");
    expect(validateUploadFile("", 1024)).toContain("ảnh");
  });
  test("từ chối file rỗng / quá 5MB", () => {
    expect(validateUploadFile("image/png", 0)).toContain("rỗng");
    expect(validateUploadFile("image/png", MAX_UPLOAD_BYTES + 1)).toContain("5MB");
    expect(validateUploadFile("image/png", MAX_UPLOAD_BYTES)).toBeNull();
  });
});

describe("buildImageKey", () => {
  test("shape products/{scope}/{uuid}.{ext}", () => {
    const key = buildImageKey("p-lumina-x1", "image/jpeg");
    expect(key).toMatch(/^products\/p-lumina-x1\/[0-9a-f-]{36}\.jpg$/);
  });
  test("scope lạ sanitize về tmp, mime lạ về jpg", () => {
    expect(buildImageKey("../../etc", "image/png")).toMatch(/^products\/etc\/.*\.png$/);
    expect(buildImageKey("", "image/png")).toMatch(/^products\/tmp\//);
    expect(buildImageKey("x", "image/bmp")).toMatch(/\.jpg$/);
  });
  test("uuid duy nhất mỗi lần gọi", () => {
    expect(buildImageKey("a", "image/webp")).not.toBe(buildImageKey("a", "image/webp"));
  });
});

describe("sniffImageMime (magic bytes)", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  const AVIF = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
  const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
  const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

  test("nhận diện JPEG/PNG/GIF/WebP/AVIF", () => {
    expect(sniffImageMime(JPEG)).toBe("image/jpeg");
    expect(sniffImageMime(PNG)).toBe("image/png");
    expect(sniffImageMime(GIF)).toBe("image/gif");
    expect(sniffImageMime(WEBP)).toBe("image/webp");
    expect(sniffImageMime(AVIF)).toBe("image/avif");
  });
  test("từ chối SVG/EXE/giả mạo", () => {
    expect(sniffImageMime(SVG)).toBeNull();
    expect(sniffImageMime(EXE)).toBeNull();
    expect(sniffImageMime(new Uint8Array([]))).toBeNull();
  });
  test("validateImageBytes: khớp thì pass, lệch mime thì 422", () => {
    expect(validateImageBytes(PNG, "image/png")).toEqual({ mime: "image/png" });
    const mismatch = validateImageBytes(PNG, "image/jpeg");
    expect("error" in mismatch && mismatch.error).toContain("không khớp");
    const fake = validateImageBytes(SVG, "image/png");
    expect("error" in fake).toBe(true);
  });
});

describe("chưa cấu hình R2", () => {
  test("getStorageConfig null, upload throw StorageNotConfigured", async () => {
    for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]) {
      delete process.env[k];
    }
    expect(getStorageConfig()).toBeNull();
    expect(isStorageConfigured()).toBe(false);
    await expect(uploadImage(new Uint8Array([1]), "image/png", "tmp")).rejects.toBeInstanceOf(StorageNotConfigured);
  });
});
