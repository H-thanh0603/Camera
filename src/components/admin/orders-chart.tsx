"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Biểu đồ đơn hàng + doanh thu 14 ngày gần nhất (dữ liệu server tính). */
export function OrdersChart({ data }: { data: { day: string; orders: number; revenue: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Biểu đồ đơn hàng 14 ngày gần nhất">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#31353c" />
          <XAxis dataKey="day" tick={{ fill: "#d0c5af", fontSize: 10, fontFamily: "var(--font-jetbrains)" }} stroke="#31353c" />
          <YAxis tick={{ fill: "#d0c5af", fontSize: 10, fontFamily: "var(--font-jetbrains)" }} stroke="#31353c" allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#1c2026", border: "1px solid #31353c", borderRadius: 8, fontFamily: "var(--font-jetbrains)", fontSize: 12 }}
            labelStyle={{ color: "#f2ca50" }}
            itemStyle={{ color: "#dfe2eb" }}
            formatter={(value) => (Number(value) ? Number(value).toLocaleString("vi-VN") : value)}
          />
          <Bar dataKey="orders" name="orders" fill="#f2ca50" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
