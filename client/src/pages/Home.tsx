import { useEffect, useState, useCallback } from "react";
import { Shield, Wifi, Zap, TrendingUp, RefreshCw, Database, Clock, Globe, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface QuickStatus {
  httpCode: number;
  ttfbMs: number;
  isUp: boolean;
  cacheStatus: string;
  cfRay: string;
  uptimePercent: number;
  avgTtfbMs: number;
  checkedAt: string;
}

interface CfAnalytics {
  totalRequests: number;
  cachedRequests: number;
  bandwidth: number;
  threats: number;
  cacheHitRate: number;
  visits: number;
  pageViews: number;
  analyticsAvailable: boolean;
  unavailableReason?: string;
}

interface SentinelData {
  operatingMode: string;
  wpStatus: string;
  wpHealth: string;
  dbLatencyMs: number;
  memoryStatus: string;
  statusCritical: boolean;
  healthAlert: boolean;
}

// ── API helpers ────────────────────────────────────────────────────────────

const API = "/api/trpc";

async function fetchProc<T>(proc: string): Promise<T> {
  const res = await fetch(`${API}/${proc}?batch=1`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // Pages Function returns [{result:{data:...}}] for batch=1
  const item = Array.isArray(json) ? json[0] : json;
  return item?.result?.data ?? item?.result ?? item;
}

// ── Stat card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;   // Tailwind color class for icon bg
  status?: "ok" | "warn" | "error" | "neutral";
}

function StatCard({ label, value, sub, icon, accent, status = "neutral" }: StatCardProps) {
  const statusDot: Record<string, string> = {
    ok: "bg-emerald-400",
    warn: "bg-amber-400",
    error: "bg-red-500",
    neutral: "bg-slate-500",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/8">
      <div className="mb-3 flex items-start justify-between">
        <div className={`rounded-xl p-2.5 ${accent}`}>
          {icon}
        </div>
        <span className={`mt-1 h-2 w-2 rounded-full ${statusDot[status]}`} />
      </div>
      <p className="mb-0.5 font-mono text-2xl font-bold tracking-tight text-white">
        {value}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [status, setStatus] = useState<QuickStatus | null>(null);
  const [analytics, setAnalytics] = useState<CfAnalytics | null>(null);
  const [sentinel, setSentinel] = useState<SentinelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [s, a, sv] = await Promise.allSettled([
        fetchProc<QuickStatus>("monitor.quickStatus"),
        fetchProc<CfAnalytics>("monitor.cfAnalytics"),
        fetchProc<SentinelData>("wpSentinel.getV6Data"),
      ]);
      if (s.status === "fulfilled") setStatus(s.value);
      if (a.status === "fulfilled") setAnalytics(a.value);
      if (sv.status === "fulfilled") setSentinel(sv.value);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatNum = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);

  const siteUp = status?.isUp ?? false;
  const httpCode = status?.httpCode ?? "—";
  const ttfb = status?.ttfbMs != null ? `${status.ttfbMs}ms` : "—";
  const uptime = status?.uptimePercent != null ? `${status.uptimePercent.toFixed(1)}%` : "—";

  const cacheHit =
    analytics?.analyticsAvailable && analytics?.cacheHitRate != null
      ? `${analytics.cacheHitRate}%`
      : analytics?.analyticsAvailable === false
      ? "No data"
      : "—";

  const cacheStatus =
    analytics?.analyticsAvailable
      ? analytics.cacheHitRate >= 70
        ? "ok"
        : analytics.cacheHitRate >= 40
        ? "warn"
        : "error"
      : "neutral";

  const dbLatency = sentinel?.dbLatencyMs != null ? `${sentinel.dbLatencyMs}ms` : "—";
  const dbStatus: "ok" | "warn" | "error" | "neutral" =
    sentinel?.dbLatencyMs != null
      ? sentinel.dbLatencyMs < 100
        ? "ok"
        : sentinel.dbLatencyMs < 500
        ? "warn"
        : "error"
      : "neutral";

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20">
                <Shield className="h-4 w-4 text-cyan-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                NCR Watchdog
              </span>
            </div>
            <h1 className="font-mono text-2xl font-bold text-white">
              nakornchiangrainews.com
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">Real-time status · auto refresh 60s</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${siteUp ? "bg-emerald-400" : "bg-red-500"} ${loading ? "animate-pulse" : ""}`}
              />
              <span className="font-mono text-xs text-slate-300">
                {loading ? "Checking..." : siteUp ? `${httpCode} Online` : "Offline"}
              </span>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Top metrics */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="HTTP Status"
            value={loading ? "—" : httpCode}
            sub={siteUp ? "Online" : "Offline"}
            icon={<Wifi className="h-4 w-4 text-emerald-300" />}
            accent="bg-emerald-500/15"
            status={loading ? "neutral" : siteUp ? "ok" : "error"}
          />
          <StatCard
            label="TTFB"
            value={loading ? "—" : ttfb}
            sub="Warning: 2,500ms · Critical: 5,000ms"
            icon={<Zap className="h-4 w-4 text-amber-300" />}
            accent="bg-amber-500/15"
            status={
              loading
                ? "neutral"
                : (status?.ttfbMs ?? 0) < 2500
                ? "ok"
                : (status?.ttfbMs ?? 0) < 5000
                ? "warn"
                : "error"
            }
          />
          <StatCard
            label="Uptime"
            value={loading ? "—" : uptime}
            sub="Last 100 checks"
            icon={<TrendingUp className="h-4 w-4 text-sky-300" />}
            accent="bg-sky-500/15"
            status={loading ? "neutral" : (status?.uptimePercent ?? 0) >= 99 ? "ok" : "warn"}
          />
          <StatCard
            label="CF Cache Hit"
            value={loading ? "—" : cacheHit}
            sub={
              analytics?.analyticsAvailable
                ? `${formatNum(analytics.cachedRequests ?? 0)} / ${formatNum(analytics.totalRequests ?? 0)} req (24h)`
                : analytics?.unavailableReason ?? "Connecting..."
            }
            icon={<Globe className="h-4 w-4 text-violet-300" />}
            accent="bg-violet-500/15"
            status={loading ? "neutral" : cacheStatus}
          />
        </div>

        {/* Second row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Avg TTFB"
            value={loading ? "—" : ttfb}
            sub="Rolling average"
            icon={<Clock className="h-4 w-4 text-rose-300" />}
            accent="bg-rose-500/15"
            status="neutral"
          />
          <StatCard
            label="Bandwidth"
            value={loading || !analytics?.analyticsAvailable ? "—" : formatBytes(analytics.bandwidth ?? 0)}
            sub="Last 24h"
            icon={<TrendingUp className="h-4 w-4 text-teal-300" />}
            accent="bg-teal-500/15"
            status={analytics?.analyticsAvailable ? "ok" : "neutral"}
          />
          <StatCard
            label="DB Latency"
            value={loading ? "—" : dbLatency}
            sub={sentinel?.memoryStatus ?? "Excellent (<100ms)"}
            icon={<Database className="h-4 w-4 text-indigo-300" />}
            accent="bg-indigo-500/15"
            status={loading ? "neutral" : dbStatus}
          />
          <StatCard
            label="Threats"
            value={loading || !analytics?.analyticsAvailable ? "—" : formatNum(analytics.threats ?? 0)}
            sub="Last 24h"
            icon={<AlertTriangle className="h-4 w-4 text-orange-300" />}
            accent="bg-orange-500/15"
            status={
              !analytics?.analyticsAvailable
                ? "neutral"
                : (analytics.threats ?? 0) === 0
                ? "ok"
                : "warn"
            }
          />
        </div>

        {/* WP Sentinel panel */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20">
                <Shield className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">WP Sentinel V10.7</p>
                <p className="text-[11px] text-slate-500">Technical Infrastructure — nakornchiangrainews.com</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sentinel?.statusCritical ? (
                <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-400">
                  <XCircle className="h-3 w-3" /> Critical
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                  <CheckCircle className="h-3 w-3" /> Stable
                </span>
              )}
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-400">
                Autonomous Caretaker Active
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* DB Heartbeat */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                DB Heartbeat
              </p>
              <p className="font-mono text-xl font-bold text-white">
                {loading ? "—" : dbLatency}
              </p>
              <p className={`mt-1 flex items-center gap-1 text-xs ${dbStatus === "ok" ? "text-emerald-400" : dbStatus === "warn" ? "text-amber-400" : "text-red-400"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${dbStatus === "ok" ? "bg-emerald-400" : dbStatus === "warn" ? "bg-amber-400" : "bg-red-500"}`} />
                {loading
                  ? "Checking..."
                  : dbStatus === "ok"
                  ? "Excellent (<100ms)"
                  : dbStatus === "warn"
                  ? "Elevated"
                  : "High latency"}
              </p>
            </div>

            {/* Sentinel mode */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Sentinel Mode
              </p>
              <p className="font-mono text-sm font-bold text-cyan-300">
                {sentinel?.operatingMode ?? "Autonomous Caretaker Active"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Autonomous — 24/7 Vigilance Active</p>
            </div>

            {/* CF Cache status */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-4 sm:col-span-1 col-span-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                CF Cache Hit Rate
              </p>
              <p className={`font-mono text-xl font-bold ${cacheStatus === "ok" ? "text-emerald-400" : cacheStatus === "warn" ? "text-amber-400" : cacheStatus === "error" ? "text-red-400" : "text-slate-400"}`}>
                {loading ? "—" : cacheHit}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {analytics?.analyticsAvailable
                  ? `${formatNum(analytics.totalRequests ?? 0)} total requests · 24h`
                  : analytics?.analyticsAvailable === false
                  ? analytics.unavailableReason
                  : "Loading..."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span>
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })} (Bangkok)`
              : "Loading..."}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-slate-600" />
            NCR Watchdog Dashboard
          </span>
        </div>
      </div>
    </div>
  );
}
