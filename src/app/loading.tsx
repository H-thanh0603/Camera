import { CardSkeletonGrid } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="container-page flex flex-col gap-space-xl py-space-3xl" role="status" aria-label="Đang tải trang">
      <div className="h-10 w-1/3 animate-pulse rounded-lg bg-surface-container-high" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-surface-container" />
      <CardSkeletonGrid count={3} />
    </div>
  );
}
