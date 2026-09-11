"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Banner khuyến mãi toàn site — đọc /api/settings/public, ẩn khi admin tắt. */
export function AnnouncementBar() {
  const [promo, setPromo] = useState<{ text: string; link: string } | null>(null);
  useEffect(() => {
    fetch("/api/settings/public", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.announcement) setPromo(data.announcement);
      })
      .catch(() => undefined);
  }, []);
  if (!promo) return null;
  return (
    <Link
      href={promo.link}
      className="block w-full bg-primary px-space-sm py-space-2xs text-center font-telemetry-xs text-telemetry-xs font-bold uppercase text-on-primary"
    >
      {promo.text}
    </Link>
  );
}
