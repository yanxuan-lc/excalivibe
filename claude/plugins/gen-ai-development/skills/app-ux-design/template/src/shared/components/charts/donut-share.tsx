// Donut chart for proportion ("share of total"). Keep to ≤5–6 slices; for more
// categories prefer a horizontal BarSeries. Legend on the side.
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { CHART, ChartTooltip, seriesColor } from "./chart-theme";

export function DonutShare({
  data,
  nameKey,
  valueKey,
  height = 240,
}: {
  data: Array<Record<string, number | string>>;
  nameKey: string;
  valueKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--ued-surface)"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={seriesColor(i)} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
