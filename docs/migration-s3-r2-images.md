# Phase 2.3 — S3/R2 Image Storage Migration

## Trigger
Khi cần upload ảnh sản phẩm thật (thay placeholder URLs), CDN caching,
image optimization (WebP/AVIF), hoặc catalogue >500 products với nhiều images.

## Trạng thái hiện tại
- Ảnh sản phẩm là URLs trong seed data (`src/lib/data/products.ts`)
- `Product.thumbnail` và `Product.images` là JSON `{ url, alt }`
- `ProductVariant.image` cũng `{ url, alt }`
- Admin form chấp nhận URL strings cho thumbnail/images
- Không có upload endpoint — admin paste URL trực tiếp
- Next.js `<Image>` dùng `remotePatterns` cho external URLs

## Mục tiêu
- Upload ảnh lên Cloudflare R2 (hoặc S3) thay vì paste URL
- CDN caching với cache invalidation
- Image optimization (WebP/AVIF转换, responsive sizes)
- Signed URLs cho ảnh private (nếu cần)

## Implementation

### 1. Infrastructure
```
Cloudflare R2 bucket: lumina-images
├── products/
│   ├── {productId}/
│   │   ├── thumb.webp        (400×400, <50KB)
│   │   ├── main.webp         (1200×1200, <200KB)
│   │   └── gallery/
│   │       ├── 1.webp
│   │       └── 2.webp
```

### 2. Environment variables
```env
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=lumina-images
R2_PUBLIC_URL=https://images.lumina.vn  # CDN domain
```

### 3. Upload endpoint
```
POST /api/admin/upload
Content-Type: multipart/form-data
Body: file (ImageFile), productId, variantId?, type (thumb|main|gallery)

→ Returns: { url: "https://images.lumina.vn/products/x-1/thumb.webp" }
```

### 4. Code changes

**New: `src/lib/server/storage.ts`**
```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

export async function uploadImage(file: Buffer, key: string, contentType: string) {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}
```

**Admin form: `src/app/admin/products/[id]/edit-form.tsx`**
```typescript
// Thay input URL bằng file upload
<input type="file" accept="image/*" onChange={handleUpload} />
// Upload →得到 URL → set vào form state
```

**Image component update**
```typescript
// src/components/ui/app-image.tsx
// Thêm blur placeholder, sizes, quality
<AppImage
  src={product.thumbnail.url}
  placeholder="blur"
  blurDataURL={product.thumbnail.blurDataURL}  // optional
  sizes="(max-width: 768px) 100vw, 400px"
/>
```

### 5. Migration strategy
1. **Phase A**: Upload endpoint + admin form (non-breaking)
2. **Phase B**: Migrate seed data images to R2 (replace URLs)
3. **Phase C**: Add image optimization pipeline (sharp/sharp)
4. **Phase D**: CDN cache headers + invalidation

### 6. Image optimization (optional)
```typescript
// Using sharp for WebP/AVIF conversion
import sharp from "sharp";

export async function optimizeImage(buffer: Buffer) {
  const webp = await sharp(buffer).webp({ quality: 80 }).toBuffer();
  const thumb = await sharp(buffer).resize(400, 400).webp({ quality: 70 }).toBuffer();
  return { main: webp, thumb };
}
```

## Rollback
- Upload endpoint vẫn hoạt động (URL-based)
-旧 images URLs vẫn work (R2 public bucket)
- Code change reversible (file upload → URL input)

## Effort
~3-5 ngày: R2 setup, upload endpoint, admin form, image optimization, seed migration.

## Files affected
- `src/lib/server/storage.ts` — new (R2 client)
- `src/app/api/admin/upload/route.ts` — new endpoint
- `src/app/admin/products/[id]/edit-form.tsx` — file upload UI
- `src/components/ui/app-image.tsx` — optimization props
- `src/lib/data/products.ts` — seed image URLs
- `prisma/schema.prisma` — add `blurDataURL` field (optional)
- `.env.example` — R2 credentials
