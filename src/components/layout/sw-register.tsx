"use client";

import { useEffect } from "react";

/** Đăng ký Service Worker (chỉ production — tránh nhiễu HMR lúc dev). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
