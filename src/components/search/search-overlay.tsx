"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { search, POPULAR_SEARCHES } from "@/lib/services/search-service";
import { formatVND } from "@/lib/utils/format";
import { useDebounce } from "@/hooks/useDebounce";
import { loadJSON, saveJSON } from "@/lib/repositories/storage-repository";
import { useStore } from "@/state/store";
import { track } from "@/lib/analytics";

const RECENT_KEY = "search.recent";

export function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);
  const result = search(debouncedQuery);

  useEffect(() => {
    if (searchOpen) {
      setRecent(loadJSON<string[]>(RECENT_KEY, []));
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    if (searchOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, setSearchOpen]);

  if (!searchOpen) return null;

  const commitSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...loadJSON<string[]>(RECENT_KEY, []).filter((t) => t !== trimmed)].slice(0, 5);
    saveJSON(RECENT_KEY, updated);
    setSearchOpen(false);
    track("search", { query: trimmed, results: result.total });
    router.push(`/products?search=${encodeURIComponent(trimmed)}`);
  };

  const showSuggestions = debouncedQuery.trim().length === 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-space-md pt-24" role="dialog" aria-modal="true" aria-label="Tìm kiếm">
      <button type="button" className="absolute inset-0 bg-surface-container-lowest/90 backdrop-blur-xl" aria-label="Đóng tìm kiếm" onClick={() => setSearchOpen(false)} />
      <div className="relative w-full max-w-2xl animate-fade-in-up overflow-hidden rounded-xl bg-surface-container shadow-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitSearch(query);
          }}
          className="flex items-center gap-space-sm border-b border-surface-container-high px-space-md py-space-sm"
        >
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">search</span>
          <label htmlFor="global-search" className="sr-only">Tìm kiếm sản phẩm, thương hiệu, danh mục</label>
          <input
            ref={inputRef}
            id="global-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm máy ảnh, ống kính, phụ kiện..."
            className="w-full bg-transparent font-body-lg text-body-lg text-on-surface outline-none placeholder:text-outline"
            autoComplete="off"
          />
          <button type="button" onClick={() => setSearchOpen(false)} className="rounded bg-surface-container-high px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs text-outline" aria-label="Đóng">
            ESC
          </button>
        </form>

        <div className="max-h-[50vh] overflow-y-auto p-space-md">
          {showSuggestions ? (
            <div className="flex flex-col gap-space-md">
              {recent.length > 0 && (
                <section aria-label="Tìm kiếm gần đây">
                  <h3 className="section-telemetry mb-space-xs">Tìm kiếm gần đây</h3>
                  <div className="flex flex-wrap gap-space-xs">
                    {recent.map((term) => (
                      <button key={term} type="button" onClick={() => commitSearch(term)} className="rounded-lg bg-surface-container-high px-space-sm py-space-2xs font-body-sm text-body-sm text-on-surface transition-colors hover:bg-surface-container-highest">
                        {term}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section aria-label="Tìm kiếm phổ biến">
                <h3 className="section-telemetry mb-space-xs">Tìm kiếm phổ biến</h3>
                <div className="flex flex-wrap gap-space-xs">
                  {POPULAR_SEARCHES.map((term) => (
                    <button key={term} type="button" onClick={() => commitSearch(term)} className="rounded-lg border border-surface-container-highest px-space-sm py-space-2xs font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-primary">
                      {term}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : result.total === 0 ? (
            <p className="py-space-lg text-center font-body-md text-body-md text-on-surface-variant" role="status">
              {`Không tìm thấy kết quả cho "${query}". Thử "Leica", "anamorphic" hoặc "medium format".`}
            </p>
          ) : (
            <ul className="flex flex-col gap-space-xs" aria-label="Gợi ý sản phẩm">
              {result.products.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/products/${p.slug}`}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center gap-space-sm rounded-lg p-space-xs transition-colors hover:bg-surface-container-high"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbnail.url} alt="" loading="lazy" className="h-12 w-12 rounded bg-surface-container-low object-contain" />
                    <span className="flex flex-1 flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">{p.name}</span>
                      <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{p.brand} • {p.subcategory}</span>
                    </span>
                    <span className="font-telemetry-data text-telemetry-data text-primary">{formatVND(p.price)}</span>
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => commitSearch(query)}
                  className="w-full rounded-lg bg-surface-container-high py-space-xs font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest"
                >
                  Xem tất cả {result.total} kết quả
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
