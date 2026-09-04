"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Order, OrderStep } from "@/lib/types";
import { ORDER_STEP_ORDER } from "@/lib/types";
import { listOrders, cancelOrder } from "@/lib/services/order-service";
import { toAuthError, type AuthError } from "@/lib/api-client";
import { useStore } from "@/state/store";
import { formatVND, formatDate, cn } from "@/lib/utils/format";
import { EmptyState, Spinner } from "@/components/ui/states";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  processing: "Đang xử lý",
  shipped: "Đang vận chuyển",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
};

const STEP_LABEL: Record<OrderStep, string> = {
  order_placed: "Đặt hàng",
  confirmed: "Đã xác nhận",
  processing: "Chuẩn bị",
  packed: "Đóng gói",
  shipped: "Đã gửi",
  out_for_delivery: "Đang giao",
  delivered: "Giao thành công",
};

export default function AccountPage() {
  const { user, hydrated, authLoading, login, register, logout, pushToast } = useStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listOrders()
      .then(setOrders)
      .catch(() => setOrdersError("Không tải được đơn hàng. Vui lòng thử lại sau."));
  }, [user]);

  if (!hydrated || authLoading) return <div className="container-page py-space-3xl"><EmptyState icon="hourglass_empty" title="Đang tải..." /></div>;

  if (!user) {
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        if (mode === "login") await login(email, password);
        else await register(name, email, password);
        pushToast("Đăng nhập thành công. Chào mừng đến Lumina Optics!", "success");
      } catch (err) {
        setError(toAuthError(err));
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="container-page flex flex-col gap-space-xl py-space-3xl">
        <div className="mx-auto flex w-full max-w-md flex-col gap-space-md rounded-xl bg-surface-container p-space-xl shadow-xl">
          <div className="flex flex-col gap-space-2xs text-center">
            <span className="section-telemetry">LUMINA CONCIERGE ACCOUNT</span>
            <h1 className="font-headline-md text-headline-md text-on-surface">{mode === "login" ? "Đăng Nhập" : "Tạo Tài Khoản"}</h1>
          </div>

          <div className="flex rounded-lg bg-surface-container-low p-space-2xs" role="tablist" aria-label="Chọn chế độ đăng nhập">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setError(null); }}
                className={cn(
                  "flex-1 rounded px-space-sm py-space-2xs font-telemetry-data text-telemetry-data uppercase transition-colors",
                  mode === m ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                {m === "login" ? "Đăng nhập" : "Đăng ký"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} noValidate className="flex flex-col gap-space-sm">
            {mode === "register" && (
              <div className="flex flex-col gap-space-2xs">
                <label htmlFor="account-name" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Họ và tên</label>
                <input id="account-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={error?.field === "name"} className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary" />
                {error?.field === "name" && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{error.message}</p>}
              </div>
            )}
            <div className="flex flex-col gap-space-2xs">
              <label htmlFor="account-email" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Email</label>
              <input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={error?.field === "email"} className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary" />
              {error?.field === "email" && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{error.message}</p>}
            </div>
            <div className="flex flex-col gap-space-2xs">
              <label htmlFor="account-password" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Mật khẩu (tối thiểu 8 ký tự)</label>
              <input id="account-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={error?.field === "password"} className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary" />
              {error?.field === "password" && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{error.message}</p>}
            </div>
            <button type="submit" disabled={busy} className="mt-space-xs flex items-center justify-center gap-space-xs rounded-lg bg-primary py-space-sm font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60">
              {busy && <Spinner className="border-on-primary border-t-transparent" />}
              {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>

          <p className="text-center font-telemetry-xs text-telemetry-xs uppercase leading-relaxed text-outline">
            Demo authentication phía client — khi tích hợp backend sẽ dùng JWT/session cookie, không lưu thông tin nhạy cảm trong localStorage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <header className="flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex flex-col gap-space-2xs">
          <span className="section-telemetry">MY LUMINA ACCOUNT</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Xin chào, {user.name}</h1>
        </div>
        <button type="button" onClick={logout} className="rounded-lg bg-surface-container-high px-space-md py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface transition-colors hover:text-error">
          Đăng xuất
        </button>
      </header>

      <section className="grid grid-cols-2 gap-space-md sm:grid-cols-4" aria-label="Tổng quan tài khoản">
        {[
          { icon: "receipt_long", label: "Đơn hàng", value: orders?.length ?? 0 },
          { icon: "favorite", label: "Yêu thích", href: "/wishlist", value: "Xem" },
          { icon: "compare_arrows", label: "So sánh", href: "/compare", value: "Xem" },
          { icon: "explore", label: "Camera Finder", href: "/camera-finder", value: "Mở" },
        ].map((item) =>
          item.href ? (
            <Link key={item.label} href={item.href} className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-md transition-colors hover:bg-surface-container-high">
              <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">{item.icon}</span>
              <span className="font-headline-sm text-headline-sm text-on-surface">{item.value}</span>
              <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{item.label}</span>
            </Link>
          ) : (
            <div key={item.label} className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-md">
              <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">{item.icon}</span>
              <span className="font-headline-sm text-headline-sm text-on-surface">{item.value}</span>
              <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{item.label}</span>
            </div>
          ),
        )}
      </section>

      <section className="flex flex-col gap-space-md" aria-label="Lịch sử đơn hàng">
        <h2 className="font-headline-md text-headline-md text-on-surface">Đơn Hàng & Theo Dõi</h2>
        {ordersError && (
          <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{ordersError}</p>
        )}
        {ordersError ? null : orders === null ? (
          <div className="flex justify-center py-space-lg"><Spinner className="border-primary border-t-transparent" /></div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="Chưa có đơn hàng nào"
            description="Sau khi hoàn tất checkout, đơn hàng và timeline giao nhận sẽ xuất hiện tại đây."
            action={
              <Link href="/products" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary">
                Bắt đầu mua sắm
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-space-md">
            {orders.map((order) => {
              const stepIndex = ORDER_STEP_ORDER.indexOf(order.currentStep);
              const cancelled = order.status === "cancelled";
              return (
                <li key={order.id} className="flex flex-col gap-space-md rounded-xl bg-surface-container p-space-lg shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-space-sm">
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">{order.number}</span>
                      <span className="font-telemetry-xs text-telemetry-xs text-outline">{formatDate(order.createdAt)} • {order.lines.length} thiết bị • {formatVND(order.totals.total)}</span>
                    </div>
                    <div className="flex items-center gap-space-sm">
                      <span className={cn(
                        "rounded-lg px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase",
                        cancelled ? "bg-error-container text-error" : "bg-primary/20 text-primary",
                      )}>
                        {STATUS_LABEL[order.status]}
                      </span>
                      {(order.status === "pending" || order.status === "paid" || order.status === "processing") && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const updated = await cancelOrder(order.id);
                              setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? prev);
                              pushToast("Đã hủy đơn hàng.", "info");
                            } catch {
                              pushToast("Không thể hủy đơn ở giai đoạn này.", "error");
                            }
                          }}
                          className="font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-error"
                        >
                          Hủy đơn
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  {!cancelled ? (
                    <ol className="flex items-center gap-0" aria-label="Tiến trình đơn hàng">
                      {ORDER_STEP_ORDER.map((step, i) => (
                        <li key={step} className="flex flex-1 flex-col items-center gap-space-2xs">
                          <div className="flex w-full items-center">
                            <div className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= stepIndex ? "bg-primary" : "bg-surface-container-highest")} />
                            <div className={cn("h-3 w-3 rounded-full", i <= stepIndex ? "bg-primary" : "bg-surface-container-highest")} />
                            <div className={cn("h-0.5 flex-1", i === ORDER_STEP_ORDER.length - 1 ? "bg-transparent" : i < stepIndex ? "bg-primary" : "bg-surface-container-highest")} />
                          </div>
                          <span className={cn("text-center font-telemetry-xs text-[9px] uppercase", i <= stepIndex ? "text-primary" : "text-outline")}>{STEP_LABEL[step]}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="rounded-lg bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error">Đơn hàng đã bị hủy. Liên hệ concierge nếu cần hỗ trợ thêm.</p>
                  )}

                  <ul className="flex flex-wrap gap-space-sm">
                    {order.lines.map((line) => (
                      <li key={`${line.productId}-${line.variantId ?? ""}`} className="flex items-center gap-space-2xs rounded-lg bg-surface-container-low p-space-2xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={line.image} alt="" loading="lazy" className="h-10 w-10 rounded object-contain" />
                        <span className="font-telemetry-xs text-telemetry-xs text-on-surface">{line.name} × {line.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
