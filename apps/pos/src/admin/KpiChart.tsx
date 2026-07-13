// Per-card area chart for the Retail dashboard KPI tiles.
// Green line + dots + area fill, dashed y-gridlines with labels, x-axis day labels.
export function KpiChart({
  data,
  labels,
  yTicks,
  fmtY = (v: number) => String(v),
}: {
  data: number[];
  labels: string[];
  yTicks: number[];
  fmtY?: (v: number) => string;
}) {
  const W = 268;
  const H = 150;
  const padL = 30;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxY = Math.max(...yTicks, 1);
  const n = Math.max(data.length, 2);

  const x = (i: number) => padL + (plotW * i) / (n - 1);
  const y = (v: number) => padT + plotH - (Math.min(Math.max(v, 0), maxY) / maxY) * plotH;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${padL},${(padT + plotH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet" className="kchart">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="kc-grid" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="kc-ylabel">
            {fmtY(t)}
          </text>
        </g>
      ))}
      <path d={area} className="kc-area" />
      <path d={line} fill="none" className="kc-line" />
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.8} className="kc-dot" />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={H - 6} textAnchor="middle" className="kc-xlabel">
          {l}
        </text>
      ))}
    </svg>
  );
}
