// Shared chart theming for the bundled Recharts wrappers. Colors resolve to the
// design tokens in tokens.css, so charts re-skin with the rest of the prototype.
// Categorical series fall back to a fixed, accessible-ish palette after the
// brand accent.

export const CHART = {
  accent: "var(--ued-accent)",
  grid: "var(--ued-border)",
  axis: "var(--ued-muted)",
  // first = brand accent (token), rest = fixed distinguishable hues
  series: ["var(--ued-accent)", "#3B82F6", "#D97706", "#16A34A", "#9333EA", "#0EA5E9", "#E11D48"],
  fontSize: 11,
};

export function seriesColor(i: number, override?: string) {
  return override || CHART.series[i % CHART.series.length];
}

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
}

// Compact, token-styled tooltip used by every wrapper.
export function ChartTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md">
      {label != null && <div className="mb-1 font-medium text-foreground">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto font-mono tabular-nums text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}
