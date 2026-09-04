import { cn } from "@/lib/utils/format";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-space-sm py-space-3xl text-center", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
        <span className="material-symbols-outlined text-[32px] text-outline" aria-hidden="true">{icon}</span>
      </div>
      <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
      {description && <p className="max-w-md font-body-md text-body-md text-on-surface-variant">{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent", className)}
      role="status"
      aria-label="Đang tải"
    />
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-space-xl md:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl bg-surface-container">
          <div className="aspect-[4/3] bg-surface-container-high" />
          <div className="flex flex-col gap-3 p-space-lg">
            <div className="h-3 w-1/3 rounded bg-surface-container-high" />
            <div className="h-5 w-2/3 rounded bg-surface-container-high" />
            <div className="h-10 w-full rounded bg-surface-container-high" />
          </div>
        </div>
      ))}
    </div>
  );
}
