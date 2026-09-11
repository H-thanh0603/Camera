"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

/** Nhập catalogue từ CSV: dán nội dung → xem trước (dry-run) → xác nhận ghi DB. */
export function CsvImport({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ valid: number; issues: { line: number; message: string }[]; sample: { line: number; slug: string; name: string; price: number }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const call = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, dryRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Import thất bại.");
        if (data.issues) setPreview({ valid: 0, issues: data.issues, sample: [] });
        return;
      }
      if (dryRun) {
        setPreview(data);
      } else {
        setResult(`Đã nhập: ${data.created} mới + ${data.updated} cập nhật (${data.issues?.length ?? 0} dòng lỗi bỏ qua).`);
        setPreview(null);
        setText("");
        onDone();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl" aria-label="Nhập catalogue CSV">
      <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Nhập Catalogue Từ CSV</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Cột: <code className="font-mono">slug,name,brand,category,price</code> bắt buộc;
        optional: <code className="font-mono">compareAtPrice,stock,availability,subcategory,shortDescription,description,tags</code> (tags cách nhau `;`).
        Upsert theo slug, tối đa 500 dòng.
      </p>
      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"slug,name,brand,category,price,stock\nlumina-x1-monolith,Lumina X-1 Monolith,Lumina,camera,185000000,12"}
        aria-label="Nội dung CSV"
        className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-mono font-body-sm text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary")}
      />
      {error && <p className="font-body-sm text-body-sm text-error" role="alert">{error}</p>}
      {result && <p className="font-body-sm text-body-sm text-primary" role="status">{result}</p>}
      {preview && (
        <div className="rounded-lg bg-surface-container-low p-space-sm font-body-sm text-body-sm" role="status">
          <p className="text-on-surface">Hợp lệ: <strong className="text-primary">{preview.valid}</strong> dòng.</p>
          {preview.issues.length > 0 && (
            <ul className="mt-space-2xs flex max-h-32 flex-col gap-space-2xs overflow-y-auto text-error">
              {preview.issues.slice(0, 20).map((i, n) => (
                <li key={n}>Dòng {i.line}: {i.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex gap-space-sm">
        <button
          type="button"
          onClick={() => call(true)}
          disabled={busy || !text.trim()}
          className="rounded-lg bg-surface-container-high px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-60"
        >
          {busy ? "Đang xử lý…" : "Xem trước"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (preview && preview.valid > 0 && window.confirm(`Ghi ${preview.valid} dòng vào catalogue?`)) call(false);
            else if (!preview) call(true);
          }}
          disabled={busy || !text.trim()}
          className="flex items-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
        >
          {busy && <Spinner className="border-on-primary border-t-transparent" />}
          Xác nhận nhập
        </button>
      </div>
    </section>
  );
}
