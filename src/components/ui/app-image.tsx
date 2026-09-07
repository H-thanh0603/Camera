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

export function AppImage({ loading = "lazy", decoding = "async", ...props }: FixedProps) {
  // alt bắt buộc qua type FixedProps — eslint không suy được qua spread.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image loading={loading} decoding={decoding} {...props} />;
}

export function AppFillImage({
  sizes = "(max-width: 768px) 100vw, 50vw",
  ...props
}: Omit<FixedProps, "width" | "height" | "fill">) {
  // alt bắt buộc qua type — xem AppImage.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image fill sizes={sizes} loading="lazy" {...props} />;
}
