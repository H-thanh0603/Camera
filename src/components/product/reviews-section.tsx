"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product, Review } from "@/lib/types";
import { apiGetProductReviews, apiSubmitReview, ApiError } from "@/lib/api-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { reviewSchema, type ReviewInput } from "@/lib/schemas";
import { formatDate, cn } from "@/lib/utils/format";
import { RatingStars } from "@/components/ui/rating-stars";
import { EmptyState, Spinner } from "@/components/ui/states";
import { useStore } from "@/state/store";

/**
 * ReviewsSection — hiển thị đánh giá + form gửi review qua POST /api/reviews.
 * Review mới vào DB với approved=false ("chờ kiểm duyệt") và KHÔNG cộng
 * vào điểm trung bình — chống review ảo. Verified chỉ backend đối chiếu
 * đơn hàng mới gắn.
 */


export function ReviewsSection({ product }: { product: Product }) {
  const { user, hydrated, pushToast } = useStore();
  const [pending, setPending] = useState<Review[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitFailed, setSubmitFailed] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);

  const form = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { author: "", rating: 0, title: "", body: "" },
  });
  const rating = form.watch("rating");

  const refreshPending = useCallback(() => {
    if (!hydrated) return;
    apiGetProductReviews(product.id)
      .then((r) => setPending(r.pending))
      .catch(() => undefined); // pending là Enhancement — lỗi im lặng
  }, [product.id, hydrated]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const seedReviews = product.reviews ?? [];

  const fieldError = (key: keyof ReviewInput): string | undefined =>
    form.formState.errors[key]?.message ?? serverErrors[key];

  const onSubmit = async (values: ReviewInput) => {
    setSubmitFailed(false);
    try {
      await apiSubmitReview({ productId: product.id, ...values });
      setSubmittedOk(true);
      setShowForm(false);
      form.reset({ author: "", rating: 0, title: "", body: "" });
      setServerErrors({});
      refreshPending();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        setServerErrors(error.fieldErrors);
      } else if (error instanceof ApiError) {
        pushToast(error.message, "error");
      } else {
        setSubmitFailed(true);
      }
    }
  };

  const allReviews: { review: Review; pending: boolean }[] = [
    ...seedReviews.map((review) => ({ review, pending: false })),
    ...pending.map((review) => ({ review, pending: true })),
  ];

  return (
    <section className="flex flex-col gap-space-md" aria-label="Đánh giá của khách hàng">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface">Đánh Giá Từ Chủ Nhân ({product.reviewCount})</h2>
        <div className="flex items-center gap-space-md">
          <span className="flex items-center gap-space-xs">
            <RatingStars rating={product.rating} />
            <span className="font-telemetry-data text-telemetry-data text-primary">{product.rating.toFixed(1)}/5</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setSubmittedOk(false);
            }}
            className="rounded-lg bg-primary px-space-md py-space-2xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim"
            aria-expanded={showForm}
          >
            {showForm ? "Đóng form" : "Viết đánh giá"}
          </button>
        </div>
      </div>

      {submittedOk && (
        <p className="rounded-lg bg-surface-container-low p-space-sm font-body-sm text-body-sm text-primary" role="status">
          Cảm ơn bạn! Đánh giá đã được ghi nhận và đang chờ kiểm duyệt — sẽ hiển thị công khai sau khi duyệt.
        </p>
      )}

      {showForm && (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg">
          <fieldset className="flex items-center gap-space-xs">
            <legend className="sr-only">Số sao đánh giá</legend>
            <span className="mr-space-xs font-telemetry-xs text-telemetry-xs uppercase text-outline">Đánh giá của bạn:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => form.setValue("rating", star, { shouldValidate: true })}
                aria-label={`${star} sao`}
                aria-pressed={rating === star}
                className="p-space-2xs"
              >
                <span
                  className={cn("material-symbols-outlined text-[24px]", rating >= star ? "text-primary" : "text-outline")}
                  aria-hidden="true"
                >
                  {rating >= star ? "star" : "star_border"}
                </span>
              </button>
            ))}
            {fieldError("rating") && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{fieldError("rating")}</p>}
          </fieldset>

          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="review-title" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Tiêu đề</label>
            <input
              id="review-title"
              {...form.register("title")}
              aria-invalid={Boolean(fieldError("title"))}
              className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none", fieldError("title") ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")}
            />
            {fieldError("title") && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{fieldError("title")}</p>}
          </div>

          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="review-body" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Nội dung (tối thiểu 20 ký tự)</label>
            <textarea
              id="review-body"
              rows={4}
              {...form.register("body")}
              aria-invalid={Boolean(fieldError("body"))}
              className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none resize-y", fieldError("body") ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")}
            />
            {fieldError("body") && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{fieldError("body")}</p>}
          </div>

          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="review-author" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">
              Tên của bạn {user && `(đang đăng nhập: ${user.name})`}
            </label>
            <input
              id="review-author"
              placeholder={user ? user.name : "VD: Nguyễn V. A."}
              {...form.register("author")}
              aria-invalid={Boolean(fieldError("author"))}
              className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none", fieldError("author") ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")}
            />
            {fieldError("author") && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{fieldError("author")}</p>}
          </div>

          {submitFailed && (
            <div className="flex items-center justify-between gap-space-sm rounded-lg border border-error/40 bg-error-container/20 p-space-sm" role="alert">
              <p className="font-body-sm text-body-sm text-error">Không gửi được do lỗi mạng. Vui lòng thử lại.</p>
              <button type="button" onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting} className="shrink-0 rounded-lg bg-surface-container-high px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface">
                Thử lại
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="flex w-fit items-center justify-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
          >
            {form.formState.isSubmitting && <Spinner className="border-on-primary border-t-transparent" />}
            Gửi đánh giá
          </button>
        </form>
      )}

      {allReviews.length === 0 ? (
        <EmptyState
          icon="rate_review"
          title="Chưa có đánh giá chi tiết"
          description={`Trở thành chủ nhân đầu tiên chia sẻ trải nghiệm về ${product.name}.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
          {allReviews.map(({ review, pending: isPending }) => (
            <article key={review.id} className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-lg">
              <div className="flex items-center justify-between">
                <RatingStars rating={review.rating} size={14} />
                <span className="font-telemetry-xs text-telemetry-xs text-outline">{formatDate(review.date)}</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{review.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{review.body}</p>
              <footer className="flex items-center gap-space-xs pt-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-outline">
                <span className="text-on-surface">{review.author}</span>
                {isPending ? (
                  <span className="text-tertiary">CHỜ KIỂM DUYỆT</span>
                ) : review.verified ? (
                  <span className="flex items-center gap-space-2xs text-primary">
                    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">verified</span> ĐÃ MUA TẠI LUMINA
                  </span>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
