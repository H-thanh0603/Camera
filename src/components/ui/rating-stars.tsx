import { cn } from "@/lib/utils/format";

export function RatingStars({ rating, size = 16, className }: { rating: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Đánh giá ${rating} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={cn("material-symbols-outlined", rating >= star - 0.25 ? "text-primary" : "text-outline")}
          style={{ fontSize: size }}
          aria-hidden="true"
        >
          {rating >= star - 0.25 ? "star" : "star_border"}
        </span>
      ))}
    </span>
  );
}
