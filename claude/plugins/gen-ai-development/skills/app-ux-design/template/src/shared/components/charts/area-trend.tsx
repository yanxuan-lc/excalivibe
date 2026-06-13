// Area/line trend chart for time series (1–N series). Use for "how did X change
// over time". Themed + responsive; pass `height` to fit the card.
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { CHART, ChartTooltip, seriesColor } from "./chart-theme";

export interface SeriesDef {
  key: string;
  label?: string;
  color?: string;
}

export function AreaTrend({
  data,
  xKey,
  series,
  height = 240,
}: {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: SeriesDef[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`ued-area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor(i, s.color)} stopOpacity={0.18} />
              <stop offset="100%" stopColor={seriesColor(i, s.color)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey={xKey} stroke={CHART.axis} tickLine={false} axisLine={false} fontSize={CHART.fontSize} tickMargin={8} />
        <YAxis stroke={CHART.axis} tickLine={false} axisLine={false} fontSize={CHART.fontSize} width={40} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.grid }} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label || s.key}
            stroke={seriesColor(i, s.color)}
            strokeWidth={2.5}
            fill={`url(#ued-area-${s.key})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
