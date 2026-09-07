import { describe, expect, test } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  StorageNotConfigured,
  buildImageKey,
  getStorageConfig,
  isStorageConfigured,
  uploadImage,
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
