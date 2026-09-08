"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/format";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  deviceBrand: string;
  deviceModel: string;
  condition: string;
  note: string;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: "Mới",
  contacted: "Đã gọi",
  quoted: "Đã báo giá",
  done: "Chốt",
  dropped: "Bỏ",
};

const CONDITION_LABEL: Record<string, string> = {
  like_new: "Như mới",
  good: "Tốt",
  fair: "Trung bình",
  broken: "Hỏng/lỗi",
};

export function TradeInAdmin() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState("");

  const refresh = async (status = filter) => {
    const res = await fetch(status ? `/api/trade-in?status=${status}` : "/api/trade-in");
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads ?? []);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: string) => {
    const res = await fetch("/api/trade-in", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) refresh();
  };

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-wrap gap-space-xs">
        {["", "new", "contacted", "quoted", "done", "dropped"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setFilter(s);
              refresh(s);
            }}
            aria-pressed={filter === s}
            className={cn(
              "rounded-lg px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase",
              filter === s ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant",
            )}
          >
            {s ? STATUS_LABEL[s] : "Tất cả"}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl bg-surface-container shadow-xl">
        <table className="w-full min-w-[760px] border-collapse">
          <caption className="sr-only">Lead thu cũ đổi mới</caption>
          <thead>
            <tr className="border-b border-surface-container-highest">
              {["Khách", "Máy", "Tình trạng", "Ngày gửi", "Trạng thái"].map((h) => (
                <th key={h} scope="col" className="p-space-md text-left font-telemetry-xs text-telemetry-xs uppercase text-outline">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-surface-container-high last:border-b-0">
                <td className="p-space-md">
                  <p className="font-body-md text-body-md text-on-surface">{l.name}</p>
                  <p className="font-telemetry-xs text-telemetry-xs text-on-surface-variant">{l.phone}{l.email ? ` • ${l.email}` : ""}</p>
                  {l.note && <p className="pt-space-2xs font-body-sm text-body-sm text-outline">{l.note}</p>}
                </td>
                <td className="p-space-md font-body-md text-body-md text-on-surface">{l.deviceBrand} {l.deviceModel}</td>
                <td className="p-space-md font-body-sm text-body-sm text-on-surface-variant">{CONDITION_LABEL[l.condition] ?? l.condition}</td>
                <td className="p-space-md font-telemetry-data text-telemetry-data text-on-surface-variant">{new Date(l.createdAt).toLocaleDateString("vi-VN")}</td>
                <td className="p-space-md">
                  <select
                    value={l.status}
                    onChange={(e) => setStatus(l.id, e.target.value)}
                    className="rounded-lg bg-surface-container-low px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs text-on-surface outline-none"
                    aria-label={`Trạng thái lead ${l.name}`}
                  >
                    {Object.entries(STATUS_LABEL).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="p-space-xl text-center font-body-md text-body-md text-outline">Chưa có lead nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="font-body-sm text-body-sm text-outline">Tổng: {leads.length} lead.</p>
    </div>
  );
}
