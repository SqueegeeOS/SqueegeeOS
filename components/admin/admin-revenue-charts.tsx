"use client";

import { useReducedMotion } from "framer-motion";
import type { ChartPoint } from "@/lib/admin/closed-jobs-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";

interface RevenueLineChartProps {
  title: string;
  subtitle: string;
  points: ChartPoint[];
  accent?: boolean;
}

function buildPath(points: ChartPoint[], max: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const y = 36 - (points[0].value / max) * 28;
    return `M 0 ${y} L 100 ${y}`;
  }

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 36 - (point.value / max) * 28;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildArea(points: ChartPoint[], max: number): string {
  const line = buildPath(points, max);
  if (!line) return "";
  return `${line} L 100 40 L 0 40 Z`;
}

export function RevenueLineChart({
  title,
  subtitle,
  points,
  accent = false,
}: RevenueLineChartProps) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...points.map((point) => point.value), 1);
  const latest = points[points.length - 1]?.value ?? 0;
  const stroke = accent ? "rgba(201,184,150,0.95)" : "rgba(245,242,235,0.75)";
  const fill = accent
    ? "rgba(201,184,150,0.18)"
    : "rgba(245,242,235,0.08)";

  if (points.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
          {title}
        </p>
        <p className="mt-6 text-sm text-muted">Log sales to see this trend.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-border/80 bg-gradient-to-b from-surface/70 to-background/20 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
            {title}
          </p>
          <p className="mt-2 font-serif text-2xl font-light text-foreground">
            {formatCurrency(latest)}
          </p>
          <p className="mt-1 text-xs text-muted/80">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5">
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className={`h-28 w-full ${reduceMotion ? "" : "transition-opacity duration-700"}`}
          aria-hidden
        >
          <path d={buildArea(points, max)} fill={fill} />
          <path
            d={buildPath(points, max)}
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-3 flex justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-muted/70">
          {points.map((point) => (
            <span key={`${title}-${point.label}`}>{point.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AdminRevenueChartsProps {
  revenueCollected: ChartPoint[];
  arrGenerated: ChartPoint[];
  monthlySalesPerformance: ChartPoint[];
}

export function AdminRevenueCharts({
  revenueCollected,
  arrGenerated,
  monthlySalesPerformance,
}: AdminRevenueChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <RevenueLineChart
        title="Revenue Collected"
        subtitle="Cash collected over time"
        points={revenueCollected}
      />
      <RevenueLineChart
        title="ARR Growth"
        subtitle="Annual recurring value generated"
        points={arrGenerated}
        accent
      />
      <RevenueLineChart
        title="Monthly Sales Performance"
        subtitle="Business value created"
        points={monthlySalesPerformance}
        accent
      />
    </div>
  );
}
