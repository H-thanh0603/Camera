"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ContactInfo, Order, ShippingInfo } from "@/lib/types";
import { placeOrder } from "@/lib/services/order-service";
import { ApiError, apiPayDemo } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import { contactSchema, shippingSchema, type ContactInput, type ShippingInput } from "@/lib/schemas";
import { formatVND, cn } from "@/lib/utils/format";
import { useStore } from "@/state/store";
import { EmptyState, Spinner } from "@/components/ui/states";

const STEPS = ["Liên hệ", "Vận chuyển", "Giao nhận", "Thanh toán", "Xác nhận"] as const;

const DELIVERY_OPTIONS: { value: "standard" | "express" | "pickup"; label: string; desc: string; price: number }[] = [
  { value: "standard", label: "Giao chuẩn", desc: "2–4 ngày, bảo hiểm thiết bị trọn gói", price: 0 },
  { value: "express", label: "Giao nhanh trong 24h", desc: "Kỹ thuật viên giao tận studio", price: 500_000 },
  { value: "pickup", label: "Nhận tại Vault", desc: "Quận 1 (HCM) hoặc Hoàn Kiếm (HN)", price: 0 },
];

const PAYMENT_OPTIONS: { value: "bank_transfer" | "cod" | "card_on_delivery"; label: string; desc: string }[] = [
  { value: "bank_transfer", label: "Chuyển khoản ngân hàng", desc: "Xác nhận chuyển khoản trong 30 phút, hỗ trợ trả góp 0%" },
  { value: "card_on_delivery", label: "Quẹt thẻ khi nhận máy", desc: "POS di động hỗ trợ Visa/Master/JCB" },
  { value: "cod", label: "COD — Thanh toán khi nhận hàng", desc: "Chỉ áp dụng đơn dưới 200 triệu" },
];

export default function CheckoutPage() {
  const { cartSnapshot, clearCart, hydrated, user, pushToast } = useStore();
  const { lines, totals } = cartSnapshot;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [checkoutTracked, setCheckoutTracked] = useState(false);

  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [shipping, setShipping] = useState<ShippingInfo | null>(null);
  const [delivery, setDelivery] = useState<"standard" | "express" | "pickup">("standard");
  const [payment, setPayment] = useState<"bank_transfer" | "cod" | "card_on_delivery">("bank_transfer");

  const contactForm = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { fullName: user?.name ?? "", email: user?.email ?? "", phone: "" },
  });
  const shippingForm = useForm<ShippingInput>({ resolver: zodResolver(shippingSchema) });

  // Mỗi intent đặt hàng có đúng 1 idempotency key: sinh khi vào bước xác nhận,
  // hủy khi lùi lại sửa — server dùng key này để trả lại đơn cũ nếu double-submit.
  useEffect(() => {
    if (step === 4) setIdempotencyKey((k) => k ?? crypto.randomUUID());
    else setIdempotencyKey(null);
  }, [step]);

  if (!hydrated) return <div className="container-page py-space-3xl"><EmptyState icon="hourglass_empty" title="Đang tải..." /></div>;

  if (placedOrder) {
    return (
      <div className="container-page flex flex-col gap-space-lg py-space-3xl">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-space-md rounded-xl bg-surface-container p-space-2xl text-center shadow-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <span className="material-symbols-outlined text-[36px] text-primary" aria-hidden="true">check_circle</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface lg:text-headline-lg">Đơn hàng đã được ghi nhận</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Mã đơn <strong className="font-telemetry-data text-primary">{placedOrder.number}</strong>. Concierge Lumina sẽ liên hệ xác nhận trong 30 phút.
            {placedOrder.payment === "bank_transfer" && " Vui lòng chuyển khoản theo hướng dẫn được gửi tới email của bạn."}
          </p>
          <div className="grid w-full grid-cols-2 gap-space-sm pt-space-sm font-body-sm text-body-sm">
            <div className="rounded-lg bg-surface-container-low p-space-sm text-left">
              <p className="text-outline">Trạng thái</p>
              <p className="font-telemetry-data text-telemetry-data text-primary uppercase">{placedOrder.status === "paid" ? "Đã thanh toán" : "Chờ thanh toán"}</p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-space-sm text-left">
              <p className="text-outline">Tổng giá trị (server xác minh)</p>
              <p className="font-telemetry-data text-telemetry-data text-on-surface">{formatVND(placedOrder.totals.total)}</p>
            </div>
          </div>

          {placedOrder.status === "pending" && (
            <div className="flex w-full flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-md text-left">
              <p className="font-telemetry-xs text-telemetry-xs uppercase text-primary">HƯỚNG DẪN THANH TOÁN</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {placedOrder.payment === "bank_transfer"
                  ? `Chuyển khoản đúng số tiền ${formatVND(placedOrder.totals.total)} với nội dung "${placedOrder.number}" tới STK 0123456789 — LUMINA OPTICS (VCB).`
                  : placedOrder.payment === "cod"
                    ? "Chuẩn bị số tiền đúng khi nhận máy. Kỹ thuật viên sẽ hỗ trợ kiểm tra thiết bị trước khi thanh toán."
                    : "Quẹt thẻ tại chỗ với kỹ thuật viên khi nhận máy (Visa/Master/JCB)."}
              </p>
              {process.env.NEXT_PUBLIC_PAYMENT_DEMO_MODE === "true" && (
                <div className="flex items-center justify-between gap-space-sm border-t border-surface-container-high pt-space-sm">
                  <p className="font-telemetry-xs text-[10px] uppercase leading-relaxed text-outline">
                    DEMO — không có giao dịch thật. Nút dưới mô phỏng webhook của cổng payment để test order tracking.
                  </p>
                  <button
                    type="button"
                    disabled={paying}
                    onClick={async () => {
                      setPaying(true);
                      try {
                        setPlacedOrder(await apiPayDemo(placedOrder.id));
                      } catch {
                        pushToast("Không xác nhận được thanh toán demo. Thử lại.", "error");
                      } finally {
                        setPaying(false);
                      }
                    }}
                    className="shrink-0 rounded-lg bg-surface-container-high px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-50"
                  >
                    {paying ? "Đang xử lý..." : "Mô phỏng đã thanh toán"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-space-sm pt-space-sm">
            <Link href="/account" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
              Theo dõi đơn hàng
            </Link>
            <Link href="/products" className="rounded-lg bg-surface-container-high px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest">
              Tiếp tục khám phá
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (lines.length > 0 && !checkoutTracked) {
    setCheckoutTracked(true);
    track("begin_checkout", { itemCount: totals.itemCount, total: totals.total });
  }

  if (lines.length === 0) {
    return (
      <div className="container-page py-space-3xl">
        <EmptyState
          icon="shopping_bag"
          title="Chưa có gì để thanh toán"
          description="Thêm thiết bị vào giỏ hàng trước khi tiến hành checkout."
          action={
            <Link href="/products" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary">
              Khám phá thiết bị
            </Link>
          }
        />
      </div>
    );
  }

  const expressFee = DELIVERY_OPTIONS.find((d) => d.value === delivery)?.price ?? 0;
  const grandTotal = totals.total + expressFee;

  const submitOrder = async () => {
    if (!contact || !shipping) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await placeOrder({ contact, shipping, delivery, payment, snapshot: cartSnapshot }, idempotencyKey ?? undefined);
      clearCart();
      setPlacedOrder(order);
      track("purchase", { orderId: order.id, total: order.totals.total, itemCount: order.totals.itemCount, payment: order.payment });
    } catch (error) {
      if (error instanceof ApiError) {
        // Lỗi nghiệp vụ từ server (hết hàng, dữ liệu lệch) — message tiếng Việt từ API
        setSubmitError(error.message);
      } else {
        setSubmitError("Không thể đặt hàng do lỗi mạng. Vui lòng thử lại — nếu tiếp tục lỗi, liên hệ concierge qua hotline.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">SECURE CHECKOUT</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Thanh Toán Bảo Vệ</h1>
      </header>

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-space-xs" aria-label="Các bước thanh toán">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-space-xs">
            <button
              type="button"
              onClick={() => {
                if (i <= step) setStep(i);
              }}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-space-2xs rounded-lg px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase transition-colors",
                i === step ? "bg-primary text-on-primary" : i < step ? "bg-primary/15 text-primary" : "bg-surface-container text-outline",
              )}
            >
              <span className="font-bold">{i + 1}</span> {label}
            </button>
            {i < STEPS.length - 1 && <span className="h-[1px] w-4 bg-surface-container-highest" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-12">
        <div className="flex flex-col gap-space-md lg:col-span-7">
          {step === 0 && (
            <form
              onSubmit={contactForm.handleSubmit((values) => {
                setContact(values);
                setStep(1);
              })}
              noValidate
              className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg"
            >
              <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Thông tin liên hệ</h2>
              <Field label="Họ và tên" inputProps={contactForm.register("fullName")} error={contactForm.formState.errors.fullName?.message} autoComplete="name" />
              <Field label="Email" type="email" inputProps={contactForm.register("email")} error={contactForm.formState.errors.email?.message} autoComplete="email" />
              <Field label="Số điện thoại" type="tel" inputProps={contactForm.register("phone")} error={contactForm.formState.errors.phone?.message} autoComplete="tel" placeholder="0901234567" />
              <button type="submit" className="self-end rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
                Tiếp tục
              </button>
            </form>
          )}

          {step === 1 && (
            <form
              onSubmit={shippingForm.handleSubmit((values) => {
                setShipping(values);
                setStep(2);
              })}
              noValidate
              className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg"
            >
              <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Địa chỉ nhận hàng</h2>
              <Field label="Địa chỉ" inputProps={shippingForm.register("address")} error={shippingForm.formState.errors.address?.message} autoComplete="street-address" />
              <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
                <Field label="Phường/xã" inputProps={shippingForm.register("ward")} error={shippingForm.formState.errors.ward?.message} />
                <Field label="Quận/huyện" inputProps={shippingForm.register("district")} error={shippingForm.formState.errors.district?.message} />
                <Field label="Tỉnh/thành" inputProps={shippingForm.register("city")} error={shippingForm.formState.errors.city?.message} />
              </div>
              <Field label="Ghi chú cho kỹ thuật viên (tùy chọn)" inputProps={shippingForm.register("notes")} />
              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(0)} className="font-telemetry-data text-telemetry-data uppercase text-on-surface-variant transition-colors hover:text-primary">
                  Bước trước
                </button>
                <button type="submit" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
                  Tiếp tục
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <fieldset className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg">
              <legend className="font-headline-sm text-headline-sm uppercase text-on-surface">Phương thức giao nhận</legend>
              {DELIVERY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-space-sm rounded-lg p-space-sm transition-colors",
                    delivery === option.value ? "bg-primary/15 ring-1 ring-primary" : "bg-surface-container-low hover:bg-surface-container-high",
                  )}
                >
                  <span className="flex items-center gap-space-xs">
                    <input type="radio" name="delivery" checked={delivery === option.value} onChange={() => setDelivery(option.value)} className="h-4 w-4 accent-primary" />
                    <span className="flex flex-col">
                      <span className="font-body-md text-body-md text-on-surface">{option.label}</span>
                      <span className="font-telemetry-xs text-telemetry-xs text-outline">{option.desc}</span>
                    </span>
                  </span>
                  <span className="font-telemetry-data text-telemetry-data text-primary">{option.price === 0 ? "0 ₫" : formatVND(option.price)}</span>
                </label>
              ))}
              <div className="flex justify-between pt-space-xs">
                <button type="button" onClick={() => setStep(1)} className="font-telemetry-data text-telemetry-data uppercase text-on-surface-variant transition-colors hover:text-primary">
                  Bước trước
                </button>
                <button type="button" onClick={() => setStep(3)} className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
                  Tiếp tục
                </button>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg">
              <legend className="font-headline-sm text-headline-sm uppercase text-on-surface">Phương thức thanh toán</legend>
              <p className="rounded-lg bg-surface-container-low p-space-sm font-telemetry-xs text-telemetry-xs leading-relaxed text-outline">
                BẢO MẬT: Lumina không lưu trữ thông tin thẻ trên hệ thống. Giá và tồn kho cuối cùng được xác minh bởi backend khi đặt hàng.
              </p>
              {PAYMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-space-xs rounded-lg p-space-sm transition-colors",
                    payment === option.value ? "bg-primary/15 ring-1 ring-primary" : "bg-surface-container-low hover:bg-surface-container-high",
                  )}
                >
                  <input type="radio" name="payment" checked={payment === option.value} onChange={() => setPayment(option.value)} className="mt-1 h-4 w-4 accent-primary" />
                  <span className="flex flex-col">
                    <span className="font-body-md text-body-md text-on-surface">{option.label}</span>
                    <span className="font-telemetry-xs text-telemetry-xs text-outline">{option.desc}</span>
                  </span>
                </label>
              ))}
              <div className="flex justify-between pt-space-xs">
                <button type="button" onClick={() => setStep(2)} className="font-telemetry-data text-telemetry-data uppercase text-on-surface-variant transition-colors hover:text-primary">
                  Bước trước
                </button>
                <button type="button" onClick={() => setStep(4)} className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
                  Tiếp tục
                </button>
              </div>
            </fieldset>
          )}

          {step === 4 && contact && shipping && (
            <section className="flex flex-col gap-space-md rounded-xl bg-surface-container p-space-lg" aria-label="Xác nhận đơn hàng">
              <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Xem lại đơn hàng</h2>
              <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                <SummaryBlock title="Liên hệ" onEdit={() => setStep(0)} rows={[contact.fullName, contact.email, contact.phone]} />
                <SummaryBlock title="Vận chuyển" onEdit={() => setStep(1)} rows={[`${shipping.address}, ${shipping.ward}`, `${shipping.district}, ${shipping.city}`, shipping.notes || "—"]} />
                <SummaryBlock title="Giao nhận" onEdit={() => setStep(2)} rows={[DELIVERY_OPTIONS.find((d) => d.value === delivery)?.label ?? ""]} />
                <SummaryBlock title="Thanh toán" onEdit={() => setStep(3)} rows={[PAYMENT_OPTIONS.find((p) => p.value === payment)?.label ?? ""]} />
              </div>
              <ul className="flex flex-col gap-space-sm border-t border-surface-container-high pt-space-sm">
                {lines.map((line) => (
                  <li key={`${line.productId}::${line.variantId ?? ""}`} className="flex items-center gap-space-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={line.product.thumbnail.url} alt="" loading="lazy" className="h-12 w-12 rounded bg-surface-container-low object-contain" />
                    <span className="flex flex-1 flex-col">
                      <span className="font-body-sm text-body-sm text-on-surface">{line.product.name}{line.variant ? ` — ${line.variant.name}` : ""}</span>
                      <span className="font-telemetry-xs text-telemetry-xs text-outline">× {line.quantity}</span>
                    </span>
                    <span className="font-telemetry-data text-telemetry-data text-primary">{formatVND(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {submitError && (
                <div className="flex items-center justify-between gap-space-sm rounded-lg border border-error/40 bg-error-container/20 p-space-sm" role="alert">
                  <p className="font-body-sm text-body-sm text-error">{submitError}</p>
                  <button type="button" onClick={submitOrder} disabled={submitting} className="shrink-0 rounded-lg bg-surface-container-high px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface">
                    Thử lại
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className="flex items-center justify-center gap-space-xs rounded-lg bg-primary py-space-md font-headline-sm text-telemetry-data uppercase text-on-primary shadow-[0_8px_32px_rgba(212,175,55,0.15)] transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
              >
                {submitting ? <><Spinner className="border-on-primary border-t-transparent" /> Đang xử lý...</> : <>Xác nhận đặt hàng — {formatVND(grandTotal)}</>}
              </button>
            </section>
          )}
        </div>

        {/* Summary rail */}
        <aside className="flex h-fit flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl lg:col-span-5 lg:sticky lg:top-24" aria-label="Tổng kết">
          <h2 className="font-telemetry-xs text-telemetry-xs font-bold uppercase tracking-wider text-primary">TỔNG KẾT ĐƠN</h2>
          <div className="flex flex-col gap-space-xs font-body-sm text-body-sm">
            <Row label={`Tạm tính (${totals.itemCount} sp)`} value={formatVND(totals.subtotal)} />
            {totals.savings > 0 && <Row label="Tiết kiệm" value={`−${formatVND(totals.savings)}`} accent />}
            <Row label="Vận chuyển" value={totals.shipping === 0 && delivery !== "express" ? "Miễn phí" : formatVND(totals.shipping + expressFee)} />
            <div className="flex justify-between border-t border-surface-container-high pt-space-sm">
              <span className="font-headline-sm text-headline-sm text-on-surface">Tổng cộng</span>
              <span className="font-telemetry-data text-[20px] font-bold text-primary">{formatVND(grandTotal)}</span>
            </div>
          </div>
          <p className="font-telemetry-xs text-[10px] uppercase leading-relaxed text-outline">
            Bước thanh toán được mã hóa TLS. Số tiền cuối cùng được server xác minh khi đặt hàng.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  inputProps,
  error,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  inputProps: Record<string, unknown>;
  error?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = (inputProps.name as string) ?? label;
  return (
    <div className="flex flex-col gap-space-2xs">
      <label htmlFor={id} className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{label}</label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
        className={cn(
          "rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none transition-colors placeholder:text-outline",
          error ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary",
        )}
      />
      {error && <p id={`${id}-error`} className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{error}</p>}
    </div>
  );
}

function SummaryBlock({ title, rows, onEdit }: { title: string; rows: string[]; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-space-2xs rounded-lg bg-surface-container-low p-space-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-telemetry-xs text-telemetry-xs uppercase text-primary">{title}</h3>
        <button type="button" onClick={onEdit} className="font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-primary">
          Sửa
        </button>
      </div>
      {rows.map((row, i) => (
        <p key={i} className="font-body-sm text-body-sm text-on-surface-variant">{row}</p>
      ))}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={cn("text-on-surface-variant", accent && "text-primary")}>{label}</span>
      <span className={cn("font-telemetry-data text-telemetry-data text-on-surface", accent && "text-primary")}>{value}</span>
    </div>
  );
}
