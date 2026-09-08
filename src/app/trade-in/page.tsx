"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { cn } from "@/lib/utils/format";

const schema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập họ tên."),
  phone: z.string().trim().min(9, "Số điện thoại chưa đúng.").max(15),
  email: z.string().trim().email("Email chưa đúng.").optional().or(z.literal("")),
  deviceBrand: z.string().trim().min(1, "Chọn hãng máy."),
  deviceModel: z.string().trim().min(1, "Nhập model máy."),
  condition: z.enum(["like_new", "good", "fair", "broken"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

type Form = z.infer<typeof schema>;

const CONDITIONS: { value: Form["condition"]; label: string; hint: string }[] = [
  { value: "like_new", label: "Như mới", hint: "Máy đẹp, đủ hộp, shutter thấp" },
  { value: "good", label: "Tốt", hint: "Xước nhẹ, hoạt động hoàn hảo" },
  { value: "fair", label: "Trung bình", hint: "Xước rõ, vẫn chụp tốt" },
  { value: "broken", label: "Hỏng/lỗi", hint: "Lỗi chức năng — thu linh kiện" },
];

const inputCls = "rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary";

export default function TradeInPage() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: "", note: "", condition: "good" } });
  const err = (k: keyof Form) => form.formState.errors[k]?.message;

  const onSubmit = async (values: Form) => {
    setServerError(null);
    try {
      const res = await fetch("/api/trade-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors) {
          for (const [k, v] of Object.entries(data.fieldErrors)) {
            form.setError(k as keyof Form, { message: String((v as string[])[0] ?? v) });
          }
          return;
        }
        setServerError(data.error ?? "Gửi thất bại.");
        return;
      }
      setDone(true);
    } catch {
      setServerError("Lỗi mạng. Thử lại sau.");
    }
  };

  return (
    <div className="container-page flex max-w-2xl flex-col gap-space-lg py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">THU CŨ ĐỔI MỚI</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Đổi Máy Cũ Lên Đời</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Khai máy đang dùng — concierge gọi lại trong 24h với giá thu và gói lên đời. Không mua cũng không sao.
        </p>
      </header>

      {done ? (
        <div className="rounded-xl bg-surface-container p-space-xl text-center shadow-xl" role="status">
          <span className="material-symbols-outlined text-[40px] text-primary" aria-hidden="true">mark_email_read</span>
          <h2 className="pt-space-sm font-headline-md text-headline-md text-on-surface">Đã nhận thông tin!</h2>
          <p className="pt-space-xs font-body-md text-body-md text-on-surface-variant">Concierge sẽ gọi lại trong 24 giờ làm việc. Trong lúc chờ, nghía trước kho máy mới:</p>
          <Link href="/products?category=camera" className="mt-space-md inline-block rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary">
            Xem máy mới
          </Link>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl">
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            <label className="flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
              Họ và tên
              <input {...form.register("name")} className={inputCls} />
              {err("name") && <span className="text-error" role="alert">{err("name")}</span>}
            </label>
            <label className="flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
              Số điện thoại
              <input {...form.register("phone")} inputMode="tel" className={inputCls} />
              {err("phone") && <span className="text-error" role="alert">{err("phone")}</span>}
            </label>
          </div>
          <label className="flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
            Email (nhận báo giá chi tiết)
            <input {...form.register("email")} type="email" className={inputCls} />
            {err("email") && <span className="text-error" role="alert">{err("email")}</span>}
          </label>
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            <label className="flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
              Hãng máy đang dùng
              <input {...form.register("deviceBrand")} placeholder="Sony, Canon, Nikon…" className={inputCls} />
              {err("deviceBrand") && <span className="text-error" role="alert">{err("deviceBrand")}</span>}
            </label>
            <label className="flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
              Model
              <input {...form.register("deviceModel")} placeholder="A7 III, R6…" className={inputCls} />
              {err("deviceModel") && <span className="text-error" role="alert">{err("deviceModel")}</span>}
            </label>
          </div>
          <fieldset className="flex flex-col gap-space-xs">
            <legend className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Tình trạng máy</legend>
            <div className="grid grid-cols-1 gap-space-xs sm:grid-cols-2">
              {CONDITIONS.map((c) => (
                <label key={c.value} className={cn("flex cursor-pointer items-start gap-space-xs rounded-lg p-space-sm", form.watch("condition") === c.value ? "bg-primary/15 ring-1 ring-primary" : "bg-surface-container-low")}>
                  <input type="radio" value={c.value} {...form.register("condition")} className="mt-1 accent-primary" />
                  <span>
                    <span className="block font-headline-sm text-headline-sm text-on-surface">{c.label}</span>
                    <span className="block font-body-sm text-body-sm text-on-surface-variant">{c.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
            Ghi chú thêm (shutter count, phụ kiện kèm theo…)
            <textarea {...form.register("note")} rows={3} className={cn(inputCls, "resize-y")} />
          </label>
          {serverError && <p className="text-error" role="alert">{serverError}</p>}
          <button type="submit" disabled={form.formState.isSubmitting} className="rounded-lg bg-primary px-space-lg py-space-sm font-headline-sm text-headline-sm uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60">
            Gửi yêu cầu định giá
          </button>
        </form>
      )}
    </div>
  );
}
