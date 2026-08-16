"use client";

import { Cpu, MemoryStick, HardDrive, Gauge as GaugeIcon, Server, Boxes, ShieldCheck } from "lucide-react";
import type { ClusterStats } from "@/lib/types";
import { formatBytes, usedPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";

function loadColor(pct: number): string {
  if (pct >= 90) return "text-destructive stroke-destructive";
  if (pct >= 75) return "text-amber-500 stroke-amber-500";
  return "text-primary stroke-primary";
}

function RadialGauge({
  pct,
  label,
  sub,
  icon: Icon,
}: {
  pct: number;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  const color = loadColor(pct);

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/50 hover:bg-muted/30 transition-colors">
      <div className="relative">
        <svg viewBox="0 0 100 100" className="size-24 -rotate-90 sm:size-28">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/60" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className={cn("transition-all duration-700 ease-out", color)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-xl font-bold tabular-nums sm:text-2xl", color)}>{pct}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-primary" /> {label}
      </div>
      <span className="text-center text-xs text-muted-foreground tabular-nums font-mono">{sub}</span>
    </div>
  );
}

/** Aggregate cluster-wide load shown as three radial gauges (CPU / RAM / storage). */
export function ClusterLoadCard({
  cluster,
  cpuHistory,
  memHistory,
}: {
  cluster: ClusterStats;
  cpuHistory?: number[];
  memHistory?: number[];
}) {
  const cpuPct = usedPercent(cluster.cpu.used, cluster.cpu.total);
  const memPct = usedPercent(cluster.memory.used, cluster.memory.total);
  const stPct = usedPercent(cluster.storage.used, cluster.storage.total);
  const hasTrend = (cpuHistory?.length ?? 0) > 1 || (memHistory?.length ?? 0) > 1;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <GaugeIcon className="size-5 text-primary" />
          Total Cluster Load & Capacity
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
            <ShieldCheck className="size-3" />
            Healthy
          </Badge>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Server className="size-3" />
            {cluster.nodes} Node{cluster.nodes === 1 ? "" : "s"} Online
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RadialGauge pct={cpuPct} label="vCPU Load" icon={Cpu} sub={`${cluster.cpu.used} / ${cluster.cpu.total} Cores`} />
          <RadialGauge
            pct={memPct}
            label="Cluster Memory"
            icon={MemoryStick}
            sub={`${formatBytes(cluster.memory.used)} / ${formatBytes(cluster.memory.total)}`}
          />
          <RadialGauge
            pct={stPct}
            label="Pool Storage"
            icon={HardDrive}
            sub={`${formatBytes(cluster.storage.used)} / ${formatBytes(cluster.storage.total)}`}
          />
        </div>

        {hasTrend && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/60 pt-4">
            <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Cpu className="size-3.5 text-primary" /> Realtime CPU Load Trend
                </span>
                <span className="tabular-nums font-mono text-primary font-bold">{cpuPct}%</span>
              </div>
              <Sparkline data={cpuHistory ?? []} max={100} className="text-primary h-10" />
            </div>
            <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5 text-foreground">
                  <MemoryStick className="size-3.5 text-primary" /> Memory Usage Trend
                </span>
                <span className="tabular-nums font-mono text-primary font-bold">{memPct}%</span>
              </div>
              <Sparkline data={memHistory ?? []} max={100} className="text-primary h-10" />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium">
            <Server className="size-3.5 text-primary" /> Proxmox VE Cluster
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Boxes className="size-3.5 text-primary" /> {cluster.vmCount} Total Guest{cluster.vmCount === 1 ? "" : "s"} Running / Provisioned
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
