import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  HeatmapChart,
  ScatterChart,
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
  useEffect(() => {
    instance.current?.setOption(
      {
        ...option,
        animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        animationDuration: 500,
        animationDurationUpdate: 350,
      },
      { notMerge: true },
    );
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
  items.forEach(({ name, result, color }) => {
    const c =
      color ??
      (light && name === "Lab" ? "#66757d" : COLORS[name as Scenario]) ??
      "#14b8a6";
    const lower = result.curve.map((x) => [x.year, x.p10 * 100]);
    const width = result.curve.map((x) => [x.year, (x.p90 - x.p10) * 100]);
    series.push(
      {
        name: `${name} P10`,
        type: "line",
        stack: `band-${name}`,
        data: lower,
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        silent: true,
        tooltip: { show: false },
        emphasis: { disabled: true },
      },
      {
        name: `${name} P90`,
        type: "line",
        stack: `band-${name}`,
        data: width,
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color: c, opacity: 0.08 },
        silent: true,
        tooltip: { show: false },
        emphasis: { disabled: true },
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
        endLabel: {
          show: true,
          formatter: `${name}`,
          color: c,
          fontFamily: "Inter",
          fontSize: 11,
        },
        labelLayout: { moveOverlap: "shiftY" },
        markLine:
          name === items[0].name
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { color: p.text, type: "dashed", opacity: 0.7 },
                label: {
                  formatter: `Year 10 · ${num(guarantee * 100, 0)}%`,
                  color: p.text,
                  position: "insideEndTop",
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
    label: {
      show: true,
      formatter: "Y12 · 70%",
      position: "bottom",
      color: p.text,
      fontSize: 10,
    },
  });
  return {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter", color: p.text },
    grid: { left: 48, right: 68, top: 30, bottom: 45 },
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
            .filter((x) => !x.seriesName.includes(" P"))
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
      axisLabel: { color: p.text },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: 45,
      max: 100,
      interval: 10,
      name: "Usable capacity (%)",
      nameLocation: "middle",
      nameGap: 36,
      nameRotate: 90,
      nameTextStyle: { color: p.text },
      axisLabel: { formatter: "{value}%", color: p.text },
      splitLine: { lineStyle: { color: p.grid, type: "dashed" } },
    },
    series,
  };
}
export function histogramOption(r: Result, light = false): EChartsCoreOption {
  const p = palette(light);
  return {
    grid: { left: 45, right: 18, top: 25, bottom: 45 },
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
      nameGap: 30,
      axisLabel: { color: p.text },
      splitLine: { show: false },
      min: Math.max(0, r.histogram[0]?.value - 2),
    },
    yAxis: {
      type: "value",
      name: "Simulated projects",
      nameLocation: "middle",
      nameGap: 30,
      nameRotate: 90,
      axisLabel: { color: p.text },
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
          symbol: "none",
          lineStyle: { color: p.white, type: "dashed" },
          label: { formatter: "Guarantee", color: p.text },
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
      nameGap: 32,
      axisLabel: { color: p.text },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true },
    },
    yAxis: {
      type: "category",
      data: Array.from({ length: 8 }, (_, i) => num((i + 1) / 10, 1)),
      name: "Ambient coupling β",
      nameTextStyle: { color: p.text },
      axisLabel: { color: p.text },
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
          fontSize: 11,
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
    grid: { left: 178, right: 35, top: 25, bottom: 45 },
    tooltip: {
      trigger: "axis",
      backgroundColor: p.bg,
      borderColor: p.grid,
      textStyle: { color: p.white },
    },
    legend: {
      textStyle: { color: p.text },
      data: ["Lower-risk assumption", "Higher-risk assumption"],
      bottom: 0,
    },
    xAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%", color: p.text },
      splitLine: { lineStyle: { color: p.grid } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map((x) => x.label),
      axisLabel: { color: p.text, fontSize: 11 },
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
