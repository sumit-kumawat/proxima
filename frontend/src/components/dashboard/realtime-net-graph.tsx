"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Activity } from "lucide-react";
import { api, apiError } from "@/lib/api";
import type { LiveStats } from "@/lib/types";
import { formatBytes } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NetSample {
  netInSec: number;
  netOutSec: number;
  time: string;
}

/** Standard Proxmox KiB/s / MiB/s speed formatter. */
function formatNetSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0.00 KiB/s";
  const kib = bytesPerSec / 1024;
  if (kib < 1024) return `${kib.toFixed(2)} KiB/s`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(2)} MiB/s`;
  const gib = mib / 1024;
  return `${gib.toFixed(2)} GiB/s`;
}

export function RealtimeNetGraph() {
  const [samples, setSamples] = useState<NetSample[]>([]);
  const [currentNetIn, setCurrentNetIn] = useState<number>(0);
  const [currentNetOut, setCurrentNetOut] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const prevStats = useRef<LiveStats | null>(null);
  const prevTime = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const res = await api.get<LiveStats>("/admin/live-stats");
        if (cancelled) return;
        const now = Date.now();
        const dt = Math.max(0.5, (now - prevTime.current) / 1000);
        prevTime.current = now;

        const currentMap = res.data;
        let totalNetIn = 0;
        let totalNetOut = 0;

        if (prevStats.current) {
          // Calculate delta bytes/sec across all running guests
          Object.entries(currentMap).forEach(([vmid, stats]) => {
            const prev = prevStats.current?.[Number(vmid)];
            if (prev) {
              const dIn = Math.max(0, stats.netin - prev.netin);
              const dOut = Math.max(0, stats.netout - prev.netout);
              totalNetIn += dIn / dt;
              totalNetOut += dOut / dt;
            }
          });
        }
        prevStats.current = currentMap;

        setCurrentNetIn(totalNetIn);
        setCurrentNetOut(totalNetOut);

        const timeStr = new Date().toLocaleTimeString(undefined, { hour12: false, minute: "2-digit", second: "2-digit" });
        setSamples((prev) => [...prev, { netInSec: totalNetIn, netOutSec: totalNetOut, time: timeStr }].slice(-30));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(apiError(err));
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const maxVal = Math.max(1024, ...samples.map((s) => Math.max(s.netInSec, s.netOutSec)));

  return (
    <Card className="mt-6 shadow-xs border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/40">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity className="size-4 text-muted-foreground" />
          Cluster Network Traffic (net0 / bridge)
        </CardTitle>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-foreground">
            <ArrowDownRight className="size-3.5 text-sky-500" />
            <span>netin: {formatNetSpeed(currentNetIn)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground">
            <ArrowUpRight className="size-3.5 text-slate-400" />
            <span>netout: {formatNetSpeed(currentNetOut)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {error ? (
          <div className="py-6 text-center text-xs text-destructive">{error}</div>
        ) : samples.length < 2 ? (
          <div className="py-12 text-center text-xs text-muted-foreground font-mono">
            Loading Proxmox cluster network stream...
          </div>
        ) : (
          <div className="space-y-3">
            {/* Standard Neutral Proxmox Chart SVG */}
            <div className="h-44 w-full relative bg-muted/10 rounded-md p-1 border border-border/30">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                {/* Proxmox Neutral Grid lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="currentColor" strokeDasharray="2 2" className="text-border/50" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="currentColor" strokeDasharray="2 2" className="text-border/50" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="currentColor" strokeDasharray="2 2" className="text-border/50" />

                {/* Net IN line (Proxmox Sky Blue) */}
                <polyline
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                  points={samples
                    .map((s, i) => {
                      const x = (i / (samples.length - 1)) * 500;
                      const y = 110 - (s.netInSec / maxVal) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />

                {/* Net OUT line (Neutral Slate Gray) */}
                <polyline
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  points={samples
                    .map((s, i) => {
                      const x = (i / (samples.length - 1)) * 500;
                      const y = 110 - (s.netOutSec / maxVal) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              </svg>
            </div>

            <div className="flex justify-between text-[11px] text-muted-foreground font-mono pt-1 border-t border-border/40">
              <span>{samples[0]?.time || ""}</span>
              <span>Max Rate: {formatNetSpeed(maxVal)}</span>
              <span>{samples[samples.length - 1]?.time || ""}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
