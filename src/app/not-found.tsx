import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-space-md py-space-3xl text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high">
        <span className="material-symbols-outlined text-[40px] text-primary" aria-hidden="true">sensor_occupied</span>
      </div>
      <span className="section-telemetry">ERROR 404 • KHUNG HÌNH KHÔNG TỒN TẠI</span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Trang Không Được Tìm Thấy</h1>
      <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
        Trang bạn tìm kiếm đã bị rút khỏi vault hoặc đường dẫn không chính xác. Khám phá tiếp từ kho thiết bị.
      </p>
      <div className="flex gap-space-sm">
        <Link href="/" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
          Về trang chủ
        </Link>
        <Link href="/products" className="rounded-lg bg-surface-container-high px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest">
          Xem kho thiết bị
        </Link>
      </div>
    </div>
  );
}
