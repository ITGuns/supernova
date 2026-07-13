const DEFAULT_TIMES = [
  '7:00AM',
  '8:00AM',
  '9:00AM',
  '10:00AM',
  '11:00AM',
  '12:00PM',
  '1:00PM',
  '2:00PM',
  '3:00PM',
  '4:00PM',
  '5:00PM',
];
const DEFAULT_TICKS = [0, 500, 1000, 1500, 2000];

export function SalesChart({
  today,
  comp,
  times = DEFAULT_TIMES,
  yTicks = DEFAULT_TICKS,
  height = 224,
}: {
  today: number[];
  comp: number[];
  times?: string[];
  yTicks?: number[];
  height?: number;
}) {
  const W = 760;
  const H = height;
  const padL = 38;
  const padR = 12;
  const padT = 12;
  const padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxY = Math.max(...yTicks, 1);
  const n = times.length;

  const x = (i: number) => padL + (plotW * i) / (n - 1);
  const y = (v: number) => padT + plotH - (Math.min(v, maxY) / maxY) * plotH;
  const path = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const yLabel = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="saleschart">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="sc-grid" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="sc-ylabel">
            {yLabel(t)}
          </text>
        </g>
      ))}
      {times.map((t, i) => (
        <text
          key={t}
          x={x(i)}
          y={H - padB + 22}
          textAnchor="middle"
          className="sc-xlabel"
          transform={`rotate(-35 ${x(i)} ${H - padB + 22})`}
        >
          {t}
        </text>
      ))}
      <path d={path(comp)} fill="none" className="sc-comp" />
      <path d={path(today)} fill="none" className="sc-today" />
      {today.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={3.2} className="sc-dot" />
      ))}
    </svg>
  );
}
