import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  HeatmapChart,
  ScatterChart,
  CustomChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import type { Result, Scenario, RateCell, Sensitivity } from "./model";
import { COLORS } from "./model";
import { num, money } from "./format";
echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  CanvasRenderer,
]);
export function Chart({
  option,
  height = 340,
  onClick,
  id,
  label,
}: {
  option: EChartsCoreOption;
  height?: number;
  onClick?: (data: unknown) => void;
  id?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    instance = useRef<echarts.ECharts | null>(null),
    click = useRef(onClick);
  click.current = onClick;
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, {
      renderer: "canvas",
      devicePixelRatio: Math.min(devicePixelRatio, 2),
    });
    instance.current = chart;
    chart.on("click", (p) => click.current?.(p.data));
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, []);
  // Merge updates into the existing chart (each chart keeps a fixed series
  // list) so lines morph smoothly instead of replaying their draw-in animation.
  useEffect(() => {
    instance.current?.setOption({
      ...option,
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      animationDuration: 500,
      animationDurationUpdate: 350,
    });
  }, [option]);
  return (
    <div
      ref={ref}
      id={id}
      role="img"
      aria-label={label}
      style={{ height, width: "100%" }}
    />
  );
}
export function exportChart(id: string) {
  const dom = document.getElementById(id);
  if (!dom) return;
  const instance = echarts.getInstanceByDom(dom);
  if (!instance) return;
  const a = document.createElement("a");
  a.href = instance.getDataURL({
    type: "png",
    pixelRatio: 2,
    backgroundColor:
      document.documentElement.dataset.theme === "light"
        ? "#f3f5f4"
        : "#101b2b",
  });
  const raw = atob(a.href.split(",")[1]);
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  a.href = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  a.download = "GuaranteeIQ-capacity-chart.png";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const palette = (light: boolean) => ({
  text: light ? "#27384a" : "#a3b0bf",
  grid: light ? "#dce2e5" : "#243145",
  white: light ? "#172535" : "#e7ecf4",
  bg: light ? "#ffffff" : "#172334",
});
export function capacityOption(
  items: { name: string; result: Result; color?: string }[],
  guarantee = 0.75,
  light = false,
): EChartsCoreOption {
  const p = palette(light);
  const series: Record<string, unknown>[] = [];
  const colorOf = (name: string, color?: string) =>
    color ??
    (light && name === "Lab" ? "#66757d" : COLORS[name as Scenario]) ??
    "#14b8a6";
  // 60–100% keeps the curves apart; extend down only if a P10 band needs it.
  const lowest = Math.min(
    ...items.flatMap(({ result }) => result.curve.map((x) => x.p10 * 100)),
  );
  const yMin = Math.min(60, Math.floor(lowest / 10) * 10);
  items.forEach(({ name, result, color }) => {
    const c = colorOf(name, color);
    series.push(
      // P10–P90 band as one filled polygon (stacked areas do not render on a
      // numeric x-axis).
      {
        name: `${name} band`,
        type: "custom",
        silent: true,
        tooltip: { show: false },
        data: [[0, 100]],
        renderItem: (
          _params: unknown,
          api: { coord: (value: number[]) => number[] },
        ) => ({
          type: "polygon",
          shape: {
            points: [
              ...result.curve.map((x) => api.coord([x.year, x.p90 * 100])),
              ...[...result.curve]
                .reverse()
                .map((x) => api.coord([x.year, x.p10 * 100])),
            ],
          },
          style: { fill: c, opacity: 0.18 },
        }),
      },
      {
        name,
        type: "line",
        data: result.curve.map((x) => [x.year, x.median * 100]),
        symbol: "none",
        smooth: 0.15,
        lineStyle: {
          width: name === "Lab" ? 2 : 2.8,
          type: name === "Lab" ? "dotted" : "solid",
          color: c,
        },
        itemStyle: { color: c },
        markLine:
          name === items[0].name
            ? {
                silent: true,
                animation: false,
                symbol: "none",
                lineStyle: { color: p.text, type: "dashed", opacity: 0.7 },
                // Left end: every curve is still near 100% there, so the
                // label never sits on a line.
                label: {
                  formatter: `Year-10 guarantee · ${num(guarantee * 100, 0)}%`,
                  color: p.text,
                  fontSize: 12,
                  position: "insideStartTop",
                },
                data: [
                  [
                    { coord: [0, guarantee * 100] },
                    { coord: [10, guarantee * 100] },
                  ],
                ],
              }
            : undefined,
      },
    );
  });
  series.push({
    name: "Year-12 reference",
    type: "scatter",
    symbolSize: 9,
    itemStyle: { color: "#14b8a6" },
    data: [[12, 70]],
    silent: true,
    tooltip: { show: false },
  });
  // Right-hand labels (curve ends + Y12 reference) as one column, nudged
  // apart so close curves such as Lab and Best never overlap.
  const gap = (100 - yMin) * 0.075;
  const labels = [
    ...items.map(({ name, result, color }) => ({
      text: name,
      color: colorOf(name, color),
      y: result.curve[result.curve.length - 1].median * 100,
    })),
    { text: "Y12 · 70%", color: p.text, y: 70 },
  ].sort((a, b) => b.y - a.y);
  labels.forEach((l, i) => {
    if (i > 0) l.y = Math.min(l.y, labels[i - 1].y - gap);
  });
  for (let i = labels.length - 1; i >= 0; i--)
    labels[i].y = Math.max(
      labels[i].y,
      i === labels.length - 1 ? yMin + gap / 2 : labels[i + 1].y + gap,
    );
  labels.forEach((l) =>
    series.push({
      name: `${l.text} label`,
      type: "scatter",
      data: [[12, l.y]],
      symbolSize: 1,
      // Transparent, not opacity 0: labels inherit the symbol opacity.
      itemStyle: { color: "transparent" },
      silent: true,
      tooltip: { show: false },
      label: {
        show: true,
        formatter: l.text,
        position: "right",
        distance: 9,
        color: l.color,
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: 500,
      },
    }),
  );
  const curveNames = new Set(items.map((x) => x.name));
  return {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter", color: p.text },
    grid: { left: 52, right: 80, top: 30, bottom: 45 },
    tooltip: {
      trigger: "axis",
      backgroundColor: p.bg,
      borderColor: p.grid,
      textStyle: { color: p.white },
      formatter: (params: unknown) => {
        const a = params as {
          seriesName: string;
          value: number[];
          marker: string;
        }[];
        return (
          `Year ${num(a[0]?.value[0] ?? 0, 1)}<br/>` +
          a
            .filter((x) => curveNames.has(x.seriesName))
            .map(
              (x) =>
                `${x.marker} ${x.seriesName}: <b>${num(x.value[1], 1)}%</b>`,
            )
            .join("<br/>")
        );
      },
    },
    xAxis: {
      type: "value",
      min: 0,
      max: 12,
      interval: 2,
      name: "Years in service",
      nameLocation: "middle",
      nameGap: 30,
      axisLine: { lineStyle: { color: p.grid } },
      axisLabel: { color: p.text, fontSize: 12 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: yMin,
      max: 100,
      interval: 10,
      name: "Usable capacity (%)",
      nameLocation: "middle",
      nameGap: 40,
      nameRotate: 90,
      nameTextStyle: { color: p.text, fontSize: 12 },
      axisLabel: { formatter: "{value}%", color: p.text, fontSize: 12 },
      splitLine: { lineStyle: { color: p.grid, type: "dashed" } },
    },
    series,
  };
}
export function histogramOption(r: Result, light = false): EChartsCoreOption {
  const p = palette(light);
  const span =
      (r.histogram.at(-1)?.value ?? 100) - (r.histogram[0]?.value ?? 0),
    step = span > 30 ? 10 : 5;
  return {
    grid: { left: 64, right: 18, top: 28, bottom: 48 },
    tooltip: {
      trigger: "axis",
      backgroundColor: p.bg,
      borderColor: p.grid,
      textStyle: { color: p.white },
    },
    xAxis: {
      type: "value",
      name: "Year-10 usable capacity (%)",
      nameLocation: "middle",
      nameGap: 32,
      nameTextStyle: { fontSize: 12 },
      axisLabel: { color: p.text, fontSize: 12 },
      splitLine: { show: false },
      min: Math.max(0, Math.floor((r.histogram[0]?.value - 2) / step) * step),
      interval: step,
    },
    yAxis: {
      type: "value",
      name: "Simulated projects",
      nameLocation: "middle",
      nameGap: 48,
      nameRotate: 90,
      nameTextStyle: { fontSize: 12 },
      axisLabel: { color: p.text, fontSize: 12 },
      splitLine: { lineStyle: { color: p.grid } },
    },
    series: [
      {
        name: "Projects",
        type: "bar",
        barWidth: "80%",
        data: r.histogram.map((x) => ({
          value: [x.value, x.count],
          itemStyle: {
            color: x.value < r.inputs.guarantee * 100 ? "#e66767" : "#14b8a6",
            opacity: 0.7,
            borderRadius: [3, 3, 0, 0],
          },
        })),
        markLine: {
          silent: true,
          animation: false,
          symbol: "none",
          lineStyle: { color: p.white, type: "dashed" },
          label: { formatter: "Guarantee", color: p.text, fontSize: 12 },
          data: [{ xAxis: r.inputs.guarantee * 100 }],
        },
      },
    ],
  };
}
export function rateOption(
  cells: RateCell[],
  light = false,
): EChartsCoreOption {
  const p = palette(light);
  return {
    grid: { left: 70, right: 32, top: 25, bottom: 75 },
    tooltip: {
      position: "top",
      backgroundColor: p.bg,
      borderColor: p.grid,
      textStyle: { color: p.white },
      formatter: (arg: unknown) => {
        const a = arg as { data: number[] };
        const cell = cells[a.data[3]];
        return `β ${num(cell.beta, 1)} · ${num(cell.cycles, 2)} cycles/day<br/><b>${money(cell.premium)}</b><br/>Modeled shortfall: ${num(cell.p * 100, 1)}%`;
      },
    },
    xAxis: {
      type: "category",
      data: Array.from({ length: 8 }, (_, i) => num(0.8 + i * 0.05, 2)),
      name: "Average cycles per day",
      nameLocation: "middle",
      nameGap: 34,
      nameTextStyle: { fontSize: 12 },
      axisLabel: { color: p.text, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true },
    },
    yAxis: {
      type: "category",
      data: Array.from({ length: 8 }, (_, i) => num((i + 1) / 10, 1)),
      name: "Ambient coupling β",
      nameTextStyle: { color: p.text, fontSize: 12 },
      axisLabel: { color: p.text, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      show: false,
      dimension: 2,
      min: 0,
      max: Math.max(1, ...cells.map((c) => c.premium * 100)),
      inRange: { color: ["#142f49", "#235173", "#c98500", "#e66767"] },
    },
    series: [
      {
        name: "Premium (₹ lakh)",
        type: "heatmap",
        data: cells.map((c, i) => [
          i % 8,
          Math.floor(i / 8),
          c.premium * 100,
          i,
        ]),
        label: {
          show: true,
          formatter: (p: { value: number[] }) => num(p.value[2], 0),
          color: "#ffffff",
          fontFamily: "JetBrains Mono",
          fontSize: 12,
        },
        itemStyle: {
          borderWidth: 4,
          borderColor: light ? "#f3f5f4" : "#0f1a2a",
          borderRadius: 5,
        },
        emphasis: { itemStyle: { borderColor: "#14b8a6", borderWidth: 3 } },
      },
    ],
  };
}
export function tornadoOption(
  rows: Sensitivity[],
  light = false,
): EChartsCoreOption {
  const p = palette(light);
  return {
    grid: { left: 192, right: 35, top: 25, bottom: 48 },
    tooltip: {
      trigger: "axis",
      backgroundColor: p.bg,
      borderColor: p.grid,
      textStyle: { color: p.white },
    },
    legend: {
      textStyle: { color: p.text, fontSize: 12 },
      data: ["Lower-risk assumption", "Higher-risk assumption"],
      bottom: 0,
    },
    xAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%", color: p.text, fontSize: 12 },
      splitLine: { lineStyle: { color: p.grid } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map((x) => x.label),
      axisLabel: { color: p.text, fontSize: 12 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        name: "Lower-risk assumption",
        type: "bar",
        data: rows.map((x) => x.low * 100),
        barWidth: 9,
        itemStyle: { color: "#3987e5", borderRadius: [0, 3, 3, 0] },
      },
      {
        name: "Higher-risk assumption",
        type: "bar",
        data: rows.map((x) => x.high * 100),
        barWidth: 9,
        itemStyle: { color: "#e66767", borderRadius: [0, 3, 3, 0] },
      },
    ],
  };
}
