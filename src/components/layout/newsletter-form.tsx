"use client";

import { useState } from "react";
import { contactSchema } from "@/lib/schemas";
import { useStore } from "@/state/store";

export function NewsletterForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const { pushToast } = useStore();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.shape.email.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Email không hợp lệ.");
      return;
    }
    setError(undefined);
    setDone(true);
    pushToast("Cảm ơn bạn! Thư mời Masterclass sẽ được gửi tới hộp thư của bạn.", "success");
  };

  if (done) {
    return (
      <p className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-primary" role="status">
        Đã ghi danh — kiểm tra email để xác nhận.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex items-center rounded-lg bg-surface-container-low p-space-2xs">
      <label htmlFor="newsletter-email" className="sr-only">Email nhận thư Masterclass</label>
      <input
        id="newsletter-email"
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "newsletter-error" : undefined}
        placeholder="nhập email của bạn..."
        className="w-full bg-transparent px-space-xs py-space-2xs font-body-sm text-body-sm text-on-surface outline-none placeholder:text-outline"
      />
      <button type="submit" className="rounded bg-primary px-space-sm py-space-2xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-all hover:bg-primary-fixed-dim">
        Gửi
      </button>
      {error && <p id="newsletter-error" className="sr-only">{error}</p>}
    </form>
  );
}
