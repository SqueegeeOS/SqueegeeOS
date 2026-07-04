"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ChartPoint } from "@/lib/admin/closed-jobs-types";
import { formatCurrency } from "@/lib/admin/sales-calculations";
import { riseSubtle, spring } from "@/lib/motion/system";
import { useBootLayerDelay } from "@/components/motion/boot-provider";
import { CountValue } from "@/components/motion/count-value";

interface RevenueLineChartProps {
  title: string;
  subtitle: string;
  points: ChartPoint[];
  accent?: boolean;
  index?: number;
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
  index = 0,
}: RevenueLineChartProps) {
  const reduceMotion = useReducedMotion();
  const delay = useBootLayerDelay("charts", index);
  const [drawReady, setDrawReady] = useState(reduceMotion);
  const max = Math.max(...points.map((point) => point.value), 1);
  const latest = points[points.length - 1]?.value ?? 0;
  const stroke = accent ? "rgba(201,184,150,0.95)" : "rgba(245,242,235,0.75)";
  const fill = accent
    ? "rgba(201,184,150,0.18)"
    : "rgba(245,242,235,0.08)";
  const linePath = buildPath(points, max);
  const areaPath = buildArea(points, max);

  useEffect(() => {
    if (reduceMotion) {
      setDrawReady(true);
      return;
    }
    const timer = window.setTimeout(() => setDrawReady(true), delay * 1000 + 120);
    return () => window.clearTimeout(timer);
  }, [delay, reduceMotion]);

  if (points.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
          {title}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Your growth story begins with the first sale.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={riseSubtle}
      transition={{ delay }}
      className="rounded-[1.5rem] border border-border/80 bg-gradient-to-b from-surface/70 to-background/20 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
            {title}
          </p>
          <p className="mt-2 font-serif text-2xl font-light text-foreground">
            <CountValue
              value={formatCurrency(latest)}
              delay={delay + 0.2}
            />
          </p>
          <p className="mt-1 text-xs text-muted/80">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5">
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="h-28 w-full"
          aria-hidden
        >
          <motion.path
            d={areaPath}
            fill={fill}
            initial={{ opacity: 0 }}
            animate={{ opacity: drawReady ? 1 : 0 }}
            transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            d={linePath}
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{
              pathLength: drawReady ? 1 : 0,
              opacity: drawReady ? 1 : 0.4,
            }}
            transition={{ ...spring.draw, delay: delay + 0.06 }}
          />
        </svg>
        <div className="mt-3 flex justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-muted/70">
          {points.map((point) => (
            <span key={`${title}-${point.label}`}>{point.label}</span>
          ))}
        </div>
      </div>
    </motion.div>
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
        index={0}
      />
      <RevenueLineChart
        title="ARR Growth"
        subtitle="Annual recurring value generated"
        points={arrGenerated}
        accent
        index={1}
      />
      <RevenueLineChart
        title="Monthly Sales Performance"
        subtitle="Business value created"
        points={monthlySalesPerformance}
        accent
        index={2}
      />
    </div>
  );
}
