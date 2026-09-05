"use client";

import { useReportWebVitals } from "next/web-vitals";
import { track } from "@/lib/analytics";

/** Báo cáo Core Web Vitals thực tế của người dùng (LCP/CLS/INP/FCP/TTFB). */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    track("web_vital", { name: metric.name, value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value), rating: metric.rating });
  });
  return null;
}
