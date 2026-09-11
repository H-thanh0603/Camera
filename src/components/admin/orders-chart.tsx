/** Biểu đồ cột đơn hàng 14 ngày — SVG thuần (thay recharts để nhẹ bundle). */
export function OrdersChart({ data }: { data: { day: string; orders: number; revenue: number }[] }) {
  const W = 700;
  const H = 256;
  const PAD_BOTTOM = 28;
  const PAD_TOP = 12;
  const max = Math.max(1, ...data.map((d) => d.orders));
  const n = Math.max(1, data.length);
  const slot = W / n;
  const barW = Math.min(24, slot * 0.55);
  const scale = (H - PAD_BOTTOM - PAD_TOP) / max;

  return (
    <div className="h-64 w-full" role="img" aria-label="Biểu đồ đơn hàng 14 ngày gần nhất">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={PAD_TOP + (H - PAD_BOTTOM - PAD_TOP) * (1 - f)}
            y2={PAD_TOP + (H - PAD_BOTTOM - PAD_TOP) * (1 - f)}
            stroke="#31353c"
            strokeDasharray="3 3"
          />
        ))}
        {data.map((d, i) => {
          const h = Math.max(d.orders > 0 ? 3 : 0, d.orders * scale);
          const x = i * slot + (slot - barW) / 2;
          const y = H - PAD_BOTTOM - h;
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barW} height={h} rx={4} fill="#f2ca50">
                <title>{`${d.day}: ${d.orders} đơn`}</title>
              </rect>
              {(i % 2 === 0 || n <= 7) && (
                <text
                  x={i * slot + slot / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fill="#d0c5af"
                  fontSize={13}
                  fontFamily="var(--font-jetbrains)"
                >
                  {d.day}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
