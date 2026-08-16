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
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="size-5 text-primary animate-pulse" />
          Realtime Cluster Network Traffic
        </CardTitle>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <ArrowDownRight className="size-4" />
            <span>IN: {formatBytes(currentNetIn)}/s</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <ArrowUpRight className="size-4" />
            <span>OUT: {formatBytes(currentNetOut)}/s</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="py-6 text-center text-xs text-destructive">{error}</div>
        ) : samples.length < 2 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Initializing live network stream...</div>
        ) : (
          <div className="space-y-3">
            {/* Live Visual Chart SVG */}
            <div className="h-44 w-full relative">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="currentColor" strokeDasharray="3 3" opacity="0.1" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="currentColor" strokeDasharray="3 3" opacity="0.1" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="currentColor" strokeDasharray="3 3" opacity="0.1" />

                {/* Net IN line (Emerald) */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  points={samples
                    .map((s, i) => {
                      const x = (i / (samples.length - 1)) * 500;
                      const y = 110 - (s.netInSec / maxVal) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />

                {/* Net OUT line (Electric Blue) */}
                <polyline
                  fill="none"
                  stroke="#035ffd"
                  strokeWidth="2.5"
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

            <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>{samples[0]?.time || ""}</span>
              <span className="font-mono text-xs">Peak: {formatBytes(maxVal)}/s</span>
              <span>{samples[samples.length - 1]?.time || ""}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
