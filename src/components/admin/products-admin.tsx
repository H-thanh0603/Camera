"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatVND, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

/**
 * Quản trị sản phẩm: danh sách + form tạo/sửa/xóa.
 * Điền chính là các trường scalar; trường cấu trúc (specifications, images,
 * variants…) nhập dạng JSON — đủ dùng cho admin nội bộ.
 */

type Draft = Record<string, string>;

function toDraft(p?: Product): Draft {
  return {
    id: p?.id ?? "",
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    sku: p?.sku ?? "",
    brand: p?.brand ?? "Lumina",
    category: p?.category ?? "camera",
    subcategory: p?.subcategory ?? "",
    price: String(p?.price ?? ""),
    compareAtPrice: p?.compareAtPrice ? String(p.compareAtPrice) : "",
    stock: String(p?.stock ?? 0),
    availability: p?.availability ?? "in_stock",
    monthlyFrom: p?.monthlyFrom ? String(p.monthlyFrom) : "",
    rating: p ? String(p.rating) : "5",
    reviewCount: p ? String(p.reviewCount) : "0",
    shortDescription: p?.shortDescription ?? "",
    description: p?.description ?? "",
    thumbnail: JSON.stringify(p?.thumbnail ?? { url: "", alt: "" }, null, 2),
    images: JSON.stringify(p?.images ?? [], null, 2),
    specifications: JSON.stringify(p?.specifications ?? {}, null, 2),
    tags: (p?.tags ?? []).join(", "),
    badges: (p?.badges ?? []).join(", "),
    variants: p?.variants ? JSON.stringify(p.variants, null, 2) : "[]",
  };
}

function parseJSONField(raw: string, field: string, errors: Record<string, string>): unknown {
  try {
    return JSON.parse(raw || "null") ?? (field === "images" || field === "variants" ? [] : field === "specifications" ? {} : "");
  } catch {
    errors[field] = "JSON không hợp lệ.";
    return undefined;
  }
}

export function ProductsAdmin({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const setField = (key: keyof Draft, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const filtered = products.filter((p) =>
    `${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
  );

  const startCreate = () => {
    setDraft(toDraft());
    setEditing(true);
    setErrors({});
    setMessage(null);
  };

  const startEdit = (p: Product) => {
    setDraft(toDraft(p));
    setEditing(true);
    setErrors({});
    setMessage(null);
  };

  const save = async () => {
    const localErrors: Record<string, string> = {};
    const specifications = parseJSONField(draft.specifications, "specifications", localErrors);
    const images = parseJSONField(draft.images, "images", localErrors);
    const thumbnail = parseJSONField(draft.thumbnail, "thumbnail", localErrors);
    const variants = parseJSONField(draft.variants, "variants", localErrors);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      const payload = {
        id: draft.id || undefined,
        name: draft.name,
        slug: draft.slug,
        sku: draft.sku,
        brand: draft.brand,
        category: draft.category,
        subcategory: draft.subcategory,
        price: Number(draft.price),
        compareAtPrice: draft.compareAtPrice ? Number(draft.compareAtPrice) : null,
        stock: Number(draft.stock),
        availability: draft.availability,
        monthlyFrom: draft.monthlyFrom ? Number(draft.monthlyFrom) : null,
        rating: Number(draft.rating),
        reviewCount: Number(draft.reviewCount),
        shortDescription: draft.shortDescription,
        description: draft.description,
        thumbnail,
        images,
        specifications,
        tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
        badges: draft.badges.split(",").map((t) => t.trim()).filter(Boolean),
        variants,
      };
      const res = await fetch(draft.id ? `/api/admin/products/${draft.id}` : "/api/admin/products", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ form: data.error ?? "Lưu thất bại." });
        return;
      }
      setMessage(draft.id ? "Đã cập nhật sản phẩm." : "Đã tạo sản phẩm mới.");
      setEditing(false);
      setProducts((prev) => {
        const next = draft.id ? prev.map((p) => (p.id === data.product.id ? data.product : p)) : [data.product, ...prev];
        return next;
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Xóa "${name}"? Hành động này không thể hoàn tác.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setMessage("Đã xóa sản phẩm.");
        router.refresh();
      } else {
        const data = await res.json();
        setErrors({ form: data.error ?? "Xóa thất bại." });
      }
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: keyof Draft, opts?: { type?: string; wide?: boolean }) => (
    <div className={cn("flex flex-col gap-space-2xs", opts?.wide && "sm:col-span-2")}>
      <label htmlFor={`f-${key}`} className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{label}</label>
      <input
        id={`f-${key}`}
        type={opts?.type ?? "text"}
        value={draft[key]}
        onChange={(e) => setField(key, e.target.value)}
        className={cn(
          "rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none",
          errors[key] ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary",
          opts?.wide && "min-h-20",
        )}
      />
      {errors[key] && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex flex-col gap-space-2xs">
          <span className="section-telemetry">CATALOGUE OPS</span>
          <h1 className="font-headline-md text-headline-md text-on-surface">Quản Trị Sản Phẩm ({products.length})</h1>
        </div>
        <div className="flex items-center gap-space-sm">
          <label className="sr-only" htmlFor="admin-product-search">Tìm sản phẩm</label>
          <input
            id="admin-product-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên/SKU..."
            className="rounded-lg bg-surface-container px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
          />
          <button type="button" onClick={startCreate} className="rounded-lg bg-primary px-space-md py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
            + Thêm mới
          </button>
        </div>
      </header>

      {message && <p className="rounded-lg bg-surface-container-low p-space-sm font-body-sm text-body-sm text-primary" role="status">{message}</p>}
      {errors.form && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{errors.form}</p>}

      {editing && (
        <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl" aria-label="Form sản phẩm">
          <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">
            {draft.id ? `Sửa: ${draft.name || draft.id}` : "Tạo sản phẩm mới"}
          </h2>
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-3">
            {field("Tên", "name")}
            {field("Slug", "slug", { type: "text" })}
            {field("SKU", "sku")}
            {field("Thương hiệu", "brand")}
            <div className="flex flex-col gap-space-2xs">
              <label htmlFor="f-category" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Danh mục</label>
              <select
                id="f-category"
                value={draft.category}
                onChange={(e) => setField("category", e.target.value)}
                className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none"
              >
                {["camera", "lens", "lighting", "tripod", "storage", "battery", "bag", "accessory"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {field("Phân loại phụ", "subcategory")}
            {field("Giá (₫)", "price", { type: "number" })}
            {field("Giá trước giảm (₫)", "compareAtPrice", { type: "number" })}
            {field("Tồn kho", "stock", { type: "number" })}
            <div className="flex flex-col gap-space-2xs">
              <label htmlFor="f-availability" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Tình trạng</label>
              <select
                id="f-availability"
                value={draft.availability}
                onChange={(e) => setField("availability", e.target.value)}
                className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none"
              >
                {["in_stock", "low_stock", "pre_order", "out_of_stock", "contact"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            {field("Trả góp/tháng (₫)", "monthlyFrom", { type: "number" })}
            {field("Rating", "rating", { type: "number" })}
            {field("Số review", "reviewCount", { type: "number" })}
            {field("Mô tả ngắn", "shortDescription", { wide: true })}
            {field("Mô tả đầy đủ", "description", { wide: true })}
            {field("Tags (phẩy)", "tags")}
            {field("Badges (phẩy)", "badges")}
            <div className="flex flex-col gap-space-2xs sm:col-span-2 lg:col-span-3">
              <label htmlFor="f-thumbnail" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Thumbnail (JSON)</label>
              <textarea id="f-thumbnail" rows={3} value={draft.thumbnail} onChange={(e) => setField("thumbnail", e.target.value)}
                className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-telemetry-data text-telemetry-data text-on-surface outline-none font-mono", errors.thumbnail ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")} />
            </div>
            <div className="flex flex-col gap-space-2xs sm:col-span-2 lg:col-span-3">
              <label htmlFor="f-images" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Images (JSON array)</label>
              <textarea id="f-images" rows={4} value={draft.images} onChange={(e) => setField("images", e.target.value)}
                className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-telemetry-data text-telemetry-data text-on-surface outline-none font-mono", errors.images ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")} />
            </div>
            <div className="flex flex-col gap-space-2xs sm:col-span-2 lg:col-span-3">
              <label htmlFor="f-specifications" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Specifications (JSON)</label>
              <textarea id="f-specifications" rows={5} value={draft.specifications} onChange={(e) => setField("specifications", e.target.value)}
                className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-telemetry-data text-telemetry-data text-on-surface outline-none font-mono", errors.specifications ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")} />
            </div>
            <div className="flex flex-col gap-space-2xs sm:col-span-2 lg:col-span-3">
              <label htmlFor="f-variants" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Variants (JSON array)</label>
              <textarea id="f-variants" rows={5} value={draft.variants} onChange={(e) => setField("variants", e.target.value)}
                className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-telemetry-data text-telemetry-data text-on-surface outline-none font-mono", errors.variants ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")} />
            </div>
          </div>
          <div className="flex gap-space-sm pt-space-xs">
            <button type="button" onClick={save} disabled={busy} className="flex items-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60">
              {busy && <Spinner className="border-on-primary border-t-transparent" />}
              Lưu sản phẩm
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg bg-surface-container-high px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest">
              Hủy
            </button>
          </div>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl bg-surface-container shadow-xl">
        <table className="w-full min-w-[720px] border-collapse">
          <caption className="sr-only">Danh sách sản phẩm</caption>
          <thead>
            <tr className="border-b border-surface-container-highest">
              <th scope="col" className="p-space-md text-left font-telemetry-xs text-telemetry-xs uppercase text-outline">Sản phẩm</th>
              <th scope="col" className="p-space-md text-left font-telemetry-xs text-telemetry-xs uppercase text-outline">Giá</th>
              <th scope="col" className="p-space-md text-left font-telemetry-xs text-telemetry-xs uppercase text-outline">Tồn kho</th>
              <th scope="col" className="p-space-md text-left font-telemetry-xs text-telemetry-xs uppercase text-outline">Trạng thái</th>
              <th scope="col" className="p-space-md text-right font-telemetry-xs text-telemetry-xs uppercase text-outline">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-surface-container-high last:border-b-0">
                <td className="p-space-md">
                  <p className="font-headline-sm text-headline-sm text-on-surface">{p.name}</p>
                  <p className="font-telemetry-xs text-telemetry-xs text-outline">{p.sku} • {p.brand}</p>
                </td>
                <td className="p-space-md font-telemetry-data text-telemetry-data text-primary">{formatVND(p.price)}</td>
                <td className="p-space-md font-telemetry-data text-telemetry-data text-on-surface">{p.stock}</td>
                <td className="p-space-md font-telemetry-xs text-telemetry-xs uppercase text-on-surface-variant">{p.availability}</td>
                <td className="p-space-md text-right">
                  <div className="flex justify-end gap-space-xs">
                    <button type="button" onClick={() => startEdit(p)} className="rounded-lg bg-surface-container-high px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface transition-colors hover:bg-surface-container-highest">
                      Sửa
                    </button>
                    <button type="button" onClick={() => remove(p.id, p.name)} disabled={busy} className="rounded-lg bg-surface-container-high px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-error">
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
