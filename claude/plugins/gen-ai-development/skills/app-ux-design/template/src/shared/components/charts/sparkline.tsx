import { cn } from "@/lib/utils";

// Tiny KPI sparkline — pure SVG, no chart lib. Sized via className (default a
// small bounded box, `shrink-0` so it can never push past its card — the classic
// "sparkline bleeds past the edge" bug). If it shares a flex row with a big
// number, give the number `min-w-0` (or stack them). Stretches to its box via a
// viewBox; the stroke stays crisp (non-scaling-stroke).
export function Sparkline({
  data,
  up = true,
  className,
}: {
  data: number[];
  up?: boolean;
  className?: string;
}) {
  const W = 72;
  const H = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const line = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / span) * (H - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const stroke = up ? "var(--ued-accent)" : "var(--ued-danger)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-7 w-16 shrink-0", className)}
      aria-hidden="true"
    >
      <path d={area} fill={stroke} opacity="0.1" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
