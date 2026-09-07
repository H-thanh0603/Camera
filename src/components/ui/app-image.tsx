import Image, { type ImageProps } from "next/image";

/**
 * AppImage — wrapper duy nhất cho ảnh toàn app (next/image: resize, lazy,
 * AVIF/WebP, chống CLS). Remote cho phép: lh3.googleusercontent.com
 * (xem images.remotePatterns trong next.config.ts).
 *
 * - AppImage: kích thước cố định (thumbnail, logo…) — bắt buộc width/height.
 * - AppFillImage: phủ kín khung cha đã có size (card, hero, grid…) — cha
 *   phải `relative` + có h/w.
 */

type FixedProps = Omit<ImageProps, "src" | "alt"> & {
  src: string;
  alt: string;
};

export function AppImage({ loading, decoding = "async", priority = false, ...props }: FixedProps) {
  // alt bắt buộc qua type FixedProps — eslint không suy được qua spread.
  // priority=true thì không kèm loading="lazy" (next/image throw).
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image loading={priority ? undefined : (loading ?? "lazy")} decoding={decoding} priority={priority} {...props} />;
}

export function AppFillImage({
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  ...props
}: Omit<FixedProps, "width" | "height" | "fill">) {
  // alt bắt buộc qua type — xem AppImage.
  // priority=true thì không được kèm loading="lazy" (next/image throw).
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image fill sizes={sizes} priority={priority} loading={priority ? undefined : "lazy"} {...props} />;
}
