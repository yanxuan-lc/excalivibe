// Bar chart for comparison ("how do categories compare"). Set layout="vertical"
// for a horizontal ranking bar (good for many categories / long labels on mobile).
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { CHART, ChartTooltip, seriesColor } from "./chart-theme";
import type { SeriesDef } from "./area-trend";

export function BarSeries({
  data,
  categoryKey,
  series,
  height = 240,
  layout = "horizontal",
  colorByCategory = false,
}: {
  data: Array<Record<string, number | string>>;
  categoryKey: string;
  series: SeriesDef[];
  height?: number;
  layout?: "horizontal" | "vertical";
  colorByCategory?: boolean; // single series, one color per bar
}) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, bottom: 0, left: vertical ? 8 : -10 }}>
        <CartesianGrid stroke={CHART.grid} vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" stroke={CHART.axis} tickLine={false} axisLine={false} fontSize={CHART.fontSize} />
            <YAxis type="category" dataKey={categoryKey} stroke={CHART.axis} tickLine={false} axisLine={false} fontSize={CHART.fontSize} width={72} />
          </>
        ) : (
          <>
            <XAxis dataKey={categoryKey} stroke={CHART.axis} tickLine={false} axisLine={false} fontSize={CHART.fontSize} tickMargin={8} />
            <YAxis stroke={CHART.axis} tickLine={false} axisLine={false} fontSize={CHART.fontSize} width={40} />
          </>
        )}
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--ued-border)", fillOpacity: 0.3 }} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label || s.key} fill={seriesColor(i, s.color)} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={48}>
            {colorByCategory && series.length === 1
              ? data.map((_, idx) => <Cell key={idx} fill={seriesColor(idx)} />)
              : null}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
