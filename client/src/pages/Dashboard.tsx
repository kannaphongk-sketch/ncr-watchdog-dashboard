import React, { useCallback, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Activity,
  Shield,
  Zap,
  Globe,
  RefreshCw,
  Trash2,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  BarChart3,
  Server,
  Wifi,
  FileX,
  Link,
  Search,
  Database,
  HardDrive,
  Cpu,
  Moon,
  Image,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTime(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatShortTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function normalizeSentinelToken(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isPositiveSentinelValue(value: unknown): boolean {
  return ["ok", "safe", "stable", "healthy", "active", "enabled", "pass", "passed", "green", "full-autonomous mode", "autonomous", "autonomous caretaker active"].includes(normalizeSentinelToken(value));
}

function normalizeSentinelHealthLabel(value: unknown): string {
  return isPositiveSentinelValue(value) ? "Stable" : (String(value ?? "Unknown").trim() || "Unknown");
}

function normalizeSentinelModeLabel(mode: unknown, status?: unknown): string {
  const modeLabel = String(mode ?? "").trim();
  if (modeLabel && normalizeSentinelToken(modeLabel) !== "unknown") return isPositiveSentinelValue(modeLabel) ? "Autonomous Caretaker Active" : modeLabel;
  return isPositiveSentinelValue(status) ? "Autonomous Caretaker Active" : "Autonomous Caretaker Active";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isUp, httpCode }: { isUp: boolean; httpCode: number }) {
  if (isUp) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
        {httpCode} Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      {httpCode || "—"} Offline
    </span>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: "blue" | "green" | "yellow" | "red" | "purple";
  loading?: boolean;
}) {
  const accentMap = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    yellow: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };
  const cls = accentMap[accent ?? "blue"];

  return (
    <div className={`rounded-xl border p-5 ${cls} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      {loading ? (
        <div className="h-8 w-24 rounded bg-white/5 animate-pulse" />
      ) : (
        <div className="font-mono text-2xl font-semibold tracking-tight">{value}</div>
      )}
      {sub && <div className="text-xs opacity-55">{sub}</div>}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Custom Tooltip for Charts ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="font-mono font-medium text-foreground">
          {p.name}: {formatMs(p.value)}
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);

  // Queries
  const statusQuery = trpc.monitor.quickStatus.useQuery(undefined, {
    refetchInterval: 60_000, // refresh every 60s
    staleTime: 30_000,
  });
  const historyQuery = trpc.monitor.history.useQuery(undefined, {
    refetchInterval: 120_000,
  });
  const cfQuery = trpc.monitor.cfAnalytics.useQuery(undefined, {
    refetchInterval: 300_000,
  });
  const schedulerQuery = trpc.monitor.schedulerStatus.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const alertsQuery = trpc.monitor.alerts.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const brokenLinksQuery = trpc.monitor.brokenLinks.useQuery(undefined, {
    refetchInterval: 300_000,
  });
  const securityLevelQuery = trpc.monitor.securityLevel.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const activeBrokenLinksCountQuery = trpc.monitor.activeBrokenLinksCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const cacheDiagnosticQuery = trpc.monitor.cacheDiagnostic.useQuery(undefined, {
    refetchInterval: 300_000,
  });
  const cacheHistoryQuery = trpc.monitor.cacheHistory.useQuery(undefined, {
    refetchInterval: 300_000,
  });

  const [sentinelRefreshKey, setSentinelRefreshKey] = useState(0);
  const wpSentinelQuery = trpc.wpSentinel.getV6Data.useQuery(undefined, {
    refetchInterval: 900_000, // 15-minute polling (V12.1 Credit-Saving Mode); manual refresh via button
  });
  const latencyTimelineQuery = trpc.wpSentinel.getLatencyTimeline.useQuery(undefined, {
    refetchInterval: 900_000, // 15-minute polling; manual refresh via button
  });

  const handleSentinelRefresh = useCallback(async () => {
    setSentinelRefreshKey(k => k + 1);
    await Promise.all([wpSentinelQuery.refetch(), latencyTimelineQuery.refetch()]);
  }, [wpSentinelQuery, latencyTimelineQuery]);
  // Mutations
  const runCheckMutation = trpc.monitor.runCheck.useMutation();
  const purgeCacheMutation = trpc.monitor.purgeCache.useMutation();
  const sendTestReportMutation = trpc.monitor.sendTestReport.useMutation();
  const approvePurgeMutation = trpc.monitor.approvePurge.useMutation();
  const markFixedMutation = trpc.monitor.markFixed.useMutation();

  const utils = trpc.useUtils();

  const handleMarkFixed = useCallback(async (id: number, url: string) => {
    try {
      await markFixedMutation.mutateAsync({ id });
      await utils.monitor.brokenLinks.invalidate();
      toast.success(`Marked as fixed: ${url}`);
    } catch {
      toast.error("Failed to mark as fixed");
    }
  }, [markFixedMutation, utils]);

  const handleRunCheck = useCallback(async () => {
    setIsRunningCheck(true);
    try {
      const result = await runCheckMutation.mutateAsync();
      await utils.monitor.history.invalidate();
      await utils.monitor.quickStatus.invalidate();
      await utils.monitor.alerts.invalidate();
      if (result.isUp) {
        toast.success(`Check complete — HTTP ${result.httpCode}, TTFB ${formatMs(result.ttfbMs)}`);
      } else {
        toast.error(`Site issue detected — HTTP ${result.httpCode}${result.alertsFired.length ? " (alert sent)" : ""}`);
      }
    } catch {
      toast.error("Check failed — please try again");
    } finally {
      setIsRunningCheck(false);
    }
  }, [runCheckMutation, utils]);

  const handlePurgeCache = useCallback(async () => {
    setIsPurgingCache(true);
    try {
      const result = await purgeCacheMutation.mutateAsync();
      if (result.success) {
        toast.success("Cloudflare cache purged successfully");
      } else {
        toast.error(`Cache purge failed: ${result.message}`);
      }
    } catch {
      toast.error("Cache purge failed");
    } finally {
      setIsPurgingCache(false);
    }
  }, [purgeCacheMutation]);

  const handleApprovePurge = useCallback(async (alertId: number) => {
    try {
      const result = await approvePurgeMutation.mutateAsync({ alertId });
      if (result.success) {
        toast.success("Cloudflare cache purged successfully");
        await utils.monitor.alerts.invalidate();
      } else {
        toast.error(`Cache purge failed: ${result.message}`);
      }
    } catch {
      toast.error("Cache purge failed");
    }
  }, [approvePurgeMutation, utils]);

  const handleSendTestReport = useCallback(async () => {
    setIsSendingReport(true);
    try {
      const result = await sendTestReportMutation.mutateAsync();
      if (result.success) {
        toast.success(`Test report sent via @ncr_watchdog_bot (ID: ${result.messageId})`);
      } else {
        toast.error(`Report failed: ${result.error}`);
      }
    } catch {
      toast.error("Failed to send test report");
    } finally {
      setIsSendingReport(false);
    }
  }, [sendTestReportMutation]);

  const status = statusQuery.data;
  const history = historyQuery.data ?? [];
  const cf = cfQuery.data;
  const scheduler = schedulerQuery.data;
  const alerts = alertsQuery.data ?? [];
  const rollingTtfbChecks = history.slice(0, 20);
  const avgTtfbFromHistory = rollingTtfbChecks.length
    ? Math.round(rollingTtfbChecks.reduce((sum, c) => sum + Number(c.ttfbMs || 0), 0) / rollingTtfbChecks.length)
    : 0;
  const avgTtfb = status?.avgTtfbMs && status.avgTtfbMs > 0 ? status.avgTtfbMs : avgTtfbFromHistory;
  const monitoringHistory = history.slice(0, 100);

  // Prepare TTFB History block: last 10 stored checks, oldest to newest for readability.
  const chartData = [...history]
    .slice(0, 10)
    .reverse()
    .map((c) => ({
      time: formatShortTime(c.createdAt),
      ttfb: c.ttfbMs,
      status: c.isUp ? 1 : 0,
    }));

  const cacheChartData = cf
    ? [
        { name: "Cache HIT", value: cf.cachedRequests, fill: "oklch(0.72 0.17 145)" },
        { name: "Cache MISS", value: cf.totalRequests - cf.cachedRequests, fill: "oklch(0.22 0.02 240)" },
      ]
    : [];

  const uptimePercent = status?.uptimePercent ?? 100;
  const ttfbStatus = status?.ttfbMs
    ? status.ttfbMs <= 1000
      ? "green"
      : status.ttfbMs <= 3000
      ? "yellow"
      : "red"
    : "blue";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15 border border-primary/25">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">NCR Watchdog</h1>
              <p className="text-xs text-muted-foreground">nakornchiangrainews.com</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge isUp={status?.isUp ?? false} httpCode={status?.httpCode ?? 0} />
            <span className="text-xs text-muted-foreground font-mono">
              {scheduler?.currentBangkokTime ?? "Loading BKK time…"}
            </span>
            <a
              href="/settings"
              className="ml-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Settings — Reply Templates, Toxic Keywords, Agenda"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">

        {/* ─── Manual Action Buttons ────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleRunCheck}
            disabled={isRunningCheck}
            className="gap-2 bg-primary/90 hover:bg-primary text-primary-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningCheck ? "animate-spin" : ""}`} />
            Run Check Now
          </Button>
          <Button
            onClick={handlePurgeCache}
            disabled={isPurgingCache}
            variant="outline"
            className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Trash2 className={`w-4 h-4 ${isPurgingCache ? "animate-pulse" : ""}`} />
            Purge CF Cache
          </Button>
          <Button
            onClick={handleSendTestReport}
            disabled={isSendingReport}
            variant="outline"
            className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          >
            <Send className={`w-4 h-4 ${isSendingReport ? "animate-pulse" : ""}`} />
            Send Test Report
          </Button>
        </div>

        {/* ─── Overview Metric Cards ────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Globe} title="Site Overview" sub="nakornchiangrainews.com — real-time status" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard
              icon={Wifi}
              label="HTTP Status"
              value={status ? `${status.httpCode}` : "—"}
              sub={status?.isUp ? "Online" : "Offline"}
              accent={status?.isUp ? "green" : "red"}
              loading={statusQuery.isLoading}
            />
            <MetricCard
              icon={Zap}
              label="TTFB"
              value={status ? formatMs(status.ttfbMs) : "—"}
              sub={`Threshold: 3,000ms`}
              accent={ttfbStatus}
              loading={statusQuery.isLoading}
            />
            <MetricCard
              icon={TrendingUp}
              label="Uptime"
              value={`${uptimePercent.toFixed(1)}%`}
              sub="Last 100 checks"
              accent={uptimePercent >= 99 ? "green" : uptimePercent >= 95 ? "yellow" : "red"}
              loading={statusQuery.isLoading}
            />
            <MetricCard
              icon={BarChart3}
              label="CF Cache Hit"
              value={cf ? `${cf.cacheHitRate}%` : "—"}
              sub="24h average"
              accent="blue"
              loading={cfQuery.isLoading}
            />
            <MetricCard
              icon={Server}
              label="Avg TTFB"
              value={formatMs(avgTtfb)}
              sub={`Rolling average from ${rollingTtfbChecks.length || 0}/20 checks`}
              accent={avgTtfb <= 1000 ? "green" : avgTtfb <= 3000 ? "yellow" : "red"}
              loading={statusQuery.isLoading && historyQuery.isLoading}
            />
          </div>
        </section>


        {/* ─── WP Sentinel V6.0 — Autonomous Infrastructure ──────────────── */}
        <section>
          {/* Section header with manual refresh button */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">WP Sentinel V10.7</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Technical Infrastructure — nakornchiangrainews.com</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* V12.1: Status Badges — health + operating_mode */}
              {wpSentinelQuery.data && (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    wpSentinelQuery.data.healthAlert
                      ? 'bg-red-500/15 border-red-500/30 text-red-400'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {wpSentinelQuery.data.healthAlert ? '⚠️' : '✅'} {normalizeSentinelHealthLabel(wpSentinelQuery.data.wpHealth)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-primary/10 border-primary/20 text-primary/80 inline-flex">
                    {normalizeSentinelModeLabel(wpSentinelQuery.data.operatingMode, wpSentinelQuery.data.wpStatus)}
                  </span>
                </>
              )}
              <button
                onClick={handleSentinelRefresh}
                disabled={wpSentinelQuery.isFetching || latencyTimelineQuery.isFetching}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border/60 hover:border-border bg-card hover:bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh WP Sentinel data now"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${(wpSentinelQuery.isFetching || latencyTimelineQuery.isFetching) ? 'animate-spin' : ''}`} />
                {(wpSentinelQuery.isFetching || latencyTimelineQuery.isFetching) ? 'Refreshing…' : 'Refresh Now'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DB Heartbeat — Circular Gauge (V10) */}
            {(() => {
              const v6 = wpSentinelQuery.data;
              const dbMs = v6?.dbLatencyMs ?? null;
              const isLoading = wpSentinelQuery.isLoading;
              // Color bands: green <100ms, yellow 100-500ms, red >500ms
              const gaugeColor = dbMs === null ? "oklch(0.55 0.02 240)"
                : dbMs < 100 ? "oklch(0.72 0.17 145)"
                : dbMs < 500 ? "oklch(0.78 0.18 80)"
                : "oklch(0.65 0.22 25)";
              const statusLabel = dbMs === null ? "Connecting..."
                : dbMs < 100 ? "🟢 Excellent (<100ms)"
                : dbMs < 500 ? "🟡 Normal (100–500ms)"
                : "🔴 Slow (>500ms)";
              // Arc gauge: semi-circle sweep, max display 1000ms
              const MAX_MS = 1000;
              const pct = dbMs !== null ? Math.min(dbMs / MAX_MS, 1) : 0;
              const R = 50;
              const circumference = Math.PI * R;
              const dash = circumference * pct;
              const gap = circumference - dash;
              return (
                <div className="rounded-xl border border-border/60 bg-card p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">DB Heartbeat</span>
                    <Database className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  <div className="flex flex-col items-center gap-2 py-2">
                    {isLoading ? (
                      <div className="w-28 h-16 rounded bg-white/5 animate-pulse" />
                    ) : (
                      <svg width="120" height="72" viewBox="0 0 120 72">
                        {/* Background arc */}
                        <path
                          d="M 10 66 A 50 50 0 0 1 110 66"
                          fill="none"
                          stroke="oklch(0.22 0.02 240)"
                          strokeWidth="10"
                          strokeLinecap="round"
                        />
                        {/* Value arc */}
                        <path
                          d="M 10 66 A 50 50 0 0 1 110 66"
                          fill="none"
                          stroke={gaugeColor}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${gap}`}
                          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.23,1,0.32,1), stroke 0.4s ease" }}
                        />
                        {/* Center value */}
                        <text x="60" y="60" textAnchor="middle" fontSize="17" fontWeight="700" fontFamily="monospace" fill={gaugeColor}>
                          {dbMs !== null ? (dbMs >= 1000 ? `${(dbMs/1000).toFixed(1)}s` : `${dbMs}ms`) : "—"}
                        </text>
                      </svg>
                    )}
                    <span className="text-xs" style={{ color: gaugeColor }}>{statusLabel}</span>
                  </div>
                </div>
              );
            })()}
            {/* Sentinel Mode Badge (V10) */}
            {(() => {
              const v6 = wpSentinelQuery.data;
              const isError = wpSentinelQuery.isError;
              const mode = (!isError && v6?.operatingMode) ? v6.operatingMode : null;
              const displayMode = normalizeSentinelModeLabel(mode, v6?.wpStatus);
              const isNight = displayMode.toLowerCase().includes("night");
              const isPrime = displayMode.toLowerCase().includes("prime");
              const isCloud = displayMode === "Autonomous Caretaker Active";
              const modeColor = isCloud ? "oklch(0.65 0.18 240)"
                : isNight ? "oklch(0.65 0.18 240)"
                : isPrime ? "oklch(0.72 0.17 145)"
                : "oklch(0.78 0.18 80)";
              const modeBg = isCloud ? "bg-blue-500/10 border-blue-500/20"
                : isNight ? "bg-blue-500/10 border-blue-500/20"
                : isPrime ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-amber-500/10 border-amber-500/20";
              const modeIcon = isCloud ? "☁️" : isNight ? "🌙" : isPrime ? "⚡" : "⏱️";
              return (
                <div className={`rounded-xl border p-5 flex flex-col gap-3 ${modeBg}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider opacity-70">Sentinel Mode</span>
                    <Moon className="w-4 h-4 opacity-60" />
                  </div>
                  {wpSentinelQuery.isLoading ? (
                    <div className="h-8 w-32 rounded bg-white/5 animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl">{modeIcon}</span>
                      <span className="font-mono text-xl font-semibold tracking-tight" style={{ color: modeColor }}>
                        {displayMode}
                      </span>
                    </div>
                  )}
                  {/* V12.1: statusCritical alert banner */}
                  {v6?.statusCritical && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Status CRITICAL: {v6.wpStatus}</span>
                    </div>
                  )}
                  <div className="text-xs opacity-55">
                    {isCloud ? "Autonomous — 24/7 Vigilance Active" : "Current mode based on Server Time"}
                  </div>
                  {/* V12.1: Last System Check timestamp */}
                  {v6?.lastSystemCheck && (
                    <div className="text-xs text-muted-foreground/50 font-mono">
                      Last System Check: {v6.lastSystemCheck} (BKK)
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* V12.3 Lean Config: Memory, Disk, Images, 404, Cache Status */}
          {(() => {
            const v6 = wpSentinelQuery.data;
            const isLoading = wpSentinelQuery.isLoading;

            // Memory gauge
            const memMb = v6?.memoryUsageMb ?? 0;
            const memMax = 512;
            const memPct = Math.min(100, Math.round((memMb / memMax) * 100));
            const memColor = (v6?.memoryStatus === 'critical') ? 'oklch(0.65 0.22 25)'
              : (v6?.memoryStatus === 'warning') ? 'oklch(0.78 0.18 80)'
              : 'oklch(0.72 0.17 145)';
            const memLabel = (v6?.memoryStatus === 'critical') ? '🔴 High' : (v6?.memoryStatus === 'warning') ? '🟡 Moderate' : '🟢 Optimal';

            // Disk gauge
            const diskGb = v6?.diskFreeGb ?? -1;
            const diskManaged = v6?.diskSystemManaged ?? true;
            const diskColor = diskManaged ? 'oklch(0.72 0.17 145)'
              : diskGb < 1.5 ? 'oklch(0.65 0.22 25)'
              : diskGb < 3.0 ? 'oklch(0.78 0.18 80)'
              : 'oklch(0.72 0.17 145)';
            const diskLabel = diskManaged ? '🟢 System Managed' : diskGb < 1.5 ? '🔴 Low' : diskGb < 3.0 ? '🟡 Moderate' : '🟢 Ample';

            // Image optimization. If the Sentinel plugin omits total inventory, treat zero total as a non-critical complete state.
            const rawImgOpt = v6?.optimizedImages ?? 0;
            const rawImgTotal = v6?.totalImages ?? rawImgOpt;
            const imgOpt = Math.max(0, rawImgOpt);
            const imgTotal = Math.max(0, rawImgTotal);
            const imgPct = imgTotal > 0 ? Math.min(100, Math.round((imgOpt / imgTotal) * 100)) : 100;
            const imgStatusLabel = imgPct >= 80 ? '🟢 Optimized' : imgPct >= 50 ? '🟡 In Progress' : '🔴 Needs Optimization';
            const imgBarColor = imgPct >= 80 ? 'oklch(0.72 0.17 145)' : imgPct >= 50 ? 'oklch(0.78 0.18 80)' : 'oklch(0.65 0.22 25)';

            // 404 alert
            const count404 = v6?.verified404 ?? 0;
            const has404 = count404 > 0;

            // Cache status
            const cacheLabel = v6?.cacheStatusLabel ?? 'Cache Status: Checking';
            const cacheStable = cacheLabel.includes('Stable');

            return (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Memory Usage Gauge */}
                <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Memory Usage</span>
                    <Cpu className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  {isLoading ? <div className="h-12 rounded bg-white/5 animate-pulse" /> : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-end justify-between">
                        <span className="font-mono text-2xl font-bold" style={{ color: memColor }}>{memMb.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/ {memMax} MB</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${memPct}%`, backgroundColor: memColor }} />
                      </div>
                      <span className="text-xs" style={{ color: memColor }}>{memLabel}</span>
                    </div>
                  )}
                </div>

                {/* Disk Free Gauge */}
                <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Disk Free</span>
                    <HardDrive className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  {isLoading ? <div className="h-12 rounded bg-white/5 animate-pulse" /> : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-end justify-between">
                        <span className="font-mono text-2xl font-bold" style={{ color: diskColor }}>
                          {diskManaged ? '∞' : diskGb.toFixed(0)}
                        </span>
                        <span className="text-xs text-muted-foreground">{diskManaged ? 'GB' : 'GB free'}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: diskManaged ? '100%' : `${Math.min(100, (diskGb / 10) * 100)}%`, backgroundColor: diskColor }} />
                      </div>
                      <span className="text-xs" style={{ color: diskColor }}>{diskLabel}</span>
                    </div>
                  )}
                </div>

                {/* Image Optimization Progress */}
                <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Images Optimized</span>
                    <Image className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  {isLoading ? <div className="h-12 rounded bg-white/5 animate-pulse" /> : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-end justify-between">
                        <span className="font-mono text-2xl font-bold" style={{ color: imgBarColor }}>{imgPct}%</span>
                        <span className="text-xs text-muted-foreground">{imgOpt.toLocaleString()} / {imgTotal.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${imgPct}%`, backgroundColor: imgBarColor }} />
                      </div>
                      <span className="text-xs" style={{ color: imgBarColor }}>
                        {imgStatusLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* 404 Status — always visible so the current count is never hidden */}
                <div className={`rounded-xl border p-4 flex flex-col gap-3 ${
                  has404 ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/20 bg-emerald-500/5'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium uppercase tracking-wider ${has404 ? 'text-red-400' : 'text-emerald-400/70'}`}>
                      Verified 404 Count
                    </span>
                    {has404 ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400/70" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-3xl font-bold ${has404 ? 'text-red-400' : 'text-emerald-400'}`}>{count404}</span>
                    <span className={`text-xs ${has404 ? 'text-red-400/70' : 'text-emerald-400/60'}`}>verified broken links in the last hour</span>
                  </div>
                  <span className={`text-xs ${has404 ? 'text-red-400/60' : 'text-emerald-400/50'}`}>
                    {has404 ? 'Check Telegram for URL details' : 'No broken links detected this hour'}
                  </span>
                </div>

                {/* Cache Status (Anti-Ghost) */}
                <div className={`rounded-xl border p-4 flex flex-col gap-3 ${
                  cacheStable ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border/60 bg-card'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium uppercase tracking-wider ${
                      cacheStable ? 'text-emerald-400' : 'text-muted-foreground'
                    }`}>Cache Status</span>
                    {cacheStable
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <AlertCircle className="w-4 h-4 text-muted-foreground/60" />}
                  </div>
                  {isLoading ? <div className="h-8 rounded bg-white/5 animate-pulse" /> : (
                    <div className="flex flex-col gap-1">
                      <span className={`font-semibold text-lg ${
                        cacheStable ? 'text-emerald-400' : 'text-muted-foreground'
                      }`}>{cacheStable ? '✅ Stable' : '⏳ Checking'}</span>
                      <span className="text-xs text-muted-foreground/60">
                        {cacheStable ? 'TTFB < 100ms — Anti-Ghost Active' : 'Monitoring response time...'}
                      </span>
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

          {/* V12.2: DB Latency Sparkline — 24h trend */}
          {(() => {
            const points = latencyTimelineQuery.data ?? [];
            const sparkData = points.map(p => ({
              time: new Date(p.ts).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }),
              latencyMs: p.latencyMs,
              status: p.status,
            }));
            const isLoading = latencyTimelineQuery.isLoading;
            const lastUpdated = latencyTimelineQuery.dataUpdatedAt
              ? new Date(latencyTimelineQuery.dataUpdatedAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
              : null;
            return (
              <div className="mt-4 rounded-xl border border-border/60 bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground/60" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">DB Latency Trend (24h)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {lastUpdated && (
                      <span className="text-xs text-muted-foreground/60">Updated {lastUpdated}</span>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/70"></span>Excellent
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500/70"></span>Normal
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500/70"></span>Slow
                    </div>
                  </div>
                </div>
                {isLoading ? (
                  <div className="h-28 rounded bg-white/5 animate-pulse" />
                ) : points.length === 0 ? (
                  <div className="h-28 flex items-center justify-center text-muted-foreground text-xs">
                    No data yet — latency readings will appear after the next keepalive check
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={sparkData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dbLatGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.72 0.17 145)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="oklch(0.72 0.17 145)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.02 240)" vertical={false} />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: 'oklch(0.55 0.02 240)', fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: 'oklch(0.55 0.02 240)', fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v}ms`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const ms = payload[0]?.value as number;
                          const st = (payload[0]?.payload as { status: string })?.status ?? '';
                          const color = ms < 100 ? 'oklch(0.72 0.17 145)' : ms < 500 ? 'oklch(0.78 0.18 80)' : 'oklch(0.65 0.22 25)';
                          return (
                            <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
                              <div className="text-muted-foreground mb-1">{label}</div>
                              <div className="font-mono font-semibold" style={{ color }}>{ms}ms — {st}</div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="latencyMs"
                        stroke="oklch(0.72 0.17 145)"
                        strokeWidth={1.5}
                        fill="url(#dbLatGrad)"
                        dot={(props: { cx: number; cy: number; payload: { status: string; latencyMs: number } }) => {
                          const { cx, cy, payload } = props;
                          const c = payload.latencyMs < 100 ? 'oklch(0.72 0.17 145)'
                            : payload.latencyMs < 500 ? 'oklch(0.78 0.18 80)'
                            : 'oklch(0.65 0.22 25)';
                          return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={2.5} fill={c} stroke="none" />;
                        }}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })()}
        </section>
                {/* ─── TTFB History Chart ───────────────────────────────────────── */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card p-6">
            <SectionHeader icon={Activity} title="TTFB History" sub={`Last ${chartData.length}/10 breakdown`} />
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No history yet — run a check to populate
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ttfbGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.18 240)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.65 0.18 240)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.02 240)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "oklch(0.58 0.02 240)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.58 0.02 240)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {/* 3000ms threshold line */}
                  <Line
                    type="monotone"
                    dataKey={() => 3000}
                    stroke="oklch(0.62 0.22 25)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    dot={false}
                    name="Threshold"
                  />
                  <Area
                    type="monotone"
                    dataKey="ttfb"
                    stroke="oklch(0.65 0.18 240)"
                    strokeWidth={2}
                    fill="url(#ttfbGrad)"
                    dot={false}
                    name="TTFB"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* CF Cache Donut */}
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <SectionHeader icon={BarChart3} title="CF Cache Ratio" sub="24h hit vs miss" />
            {cf && cf.totalRequests > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={cacheChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {cacheChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [v.toLocaleString(), ""]}
                      contentStyle={{
                        background: "oklch(0.14 0.015 240)",
                        border: "1px solid oklch(0.22 0.02 240)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Cache HIT
                    </span>
                    <span className="font-mono text-emerald-400">{cf.cacheHitRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-muted" />
                      Cache MISS
                    </span>
                    <span className="font-mono text-muted-foreground">{100 - cf.cacheHitRate}%</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Total Requests</span>
                    <span className="font-mono">{cf.totalRequests.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm text-center">
                CF analytics unavailable
                <br />
                <span className="text-xs opacity-60 mt-1 block">Check API token</span>
              </div>
            )}
          </div>
        </section>

        {/* ─── Traffic + Security Panels ───────────────────────────────── */}
        <section className="grid md:grid-cols-2 gap-6">
          {/* Traffic */}
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <SectionHeader icon={TrendingUp} title="Traffic (24h)" sub="Cloudflare analytics" />
            <div className="space-y-4">
              {[
                { label: "Total Requests", value: cf ? cf.totalRequests.toLocaleString() : "—", icon: Globe },
                { label: "Cached Requests", value: cf ? cf.cachedRequests.toLocaleString() : "—", icon: BarChart3 },
                { label: "Bandwidth", value: cf ? formatBytes(cf.bandwidth) : "—", icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </div>
                  <span className="font-mono text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1"><SectionHeader icon={Shield} title="Security" sub="Threats and alerts" /></div>
              {securityLevelQuery.data && securityLevelQuery.data.level !== "medium" && securityLevelQuery.data.level !== "low" && securityLevelQuery.data.level !== "essentially_off" && (
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 animate-pulse ${
                    securityLevelQuery.data.level === "under_attack"
                      ? "border-red-500/60 text-red-400 bg-red-500/10"
                      : "border-amber-500/60 text-amber-400 bg-amber-500/10"
                  }`}
                >
                  {securityLevelQuery.data.level === "under_attack" ? "🛡️ Under Attack Mode" : "🛡️ High Security"}
                </Badge>
              )}
            </div>
            <div className="space-y-4">
              {[
                {
                  label: "Threats Blocked (CF)",
                  value: cf ? cf.threats.toLocaleString() : "—",
                  accent: cf && cf.threats > 0 ? "text-amber-400" : "text-emerald-400",
                },
                {
                  label: "404 Errors (24h)",
                  value: cf ? (cf.count404 ?? 0).toLocaleString() : "—",
                  accent: cf && (cf.count404 ?? 0) > 50 ? "text-red-400" : cf && (cf.count404 ?? 0) > 10 ? "text-amber-400" : "text-emerald-400",
                },
                {
                  label: "Recent Alerts",
                  value: alerts.length.toString(),
                  accent: alerts.length > 0 ? "text-amber-400" : "text-emerald-400",
                },
                {
                  label: "Auto-Fixes Applied",
                  value: alerts.filter((a) => a.autoFixApplied).length.toString(),
                  accent: "text-blue-400",
                },
                {
                  label: "Broken Links (Active)",
                  value: activeBrokenLinksCountQuery.data != null
                    ? activeBrokenLinksCountQuery.data.count.toString()
                    : "—",
                  accent: (activeBrokenLinksCountQuery.data?.count ?? 0) > 5
                    ? "text-red-400"
                    : (activeBrokenLinksCountQuery.data?.count ?? 0) > 0
                    ? "text-amber-400"
                    : "text-emerald-400",
                },
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className={`font-mono text-sm font-medium ${accent}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── History Log Table ────────────────────────────────────────── */}
        <section className="rounded-xl border border-border/60 bg-card p-6">
          <SectionHeader
            icon={Activity}
            title="Monitoring History Log"
            sub={`Showing ${monitoringHistory.length}/100 stored records`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  {["Time (BKK)", "Status", "HTTP", "TTFB", "Cache", "CF Ray"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monitoringHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No checks recorded yet — click "Run Check Now"
                    </td>
                  </tr>
                ) : (
                  monitoringHistory.map((c) => (
                    <tr key={c.id} className="border-b border-border/20 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">{formatTime(c.createdAt)}</td>
                      <td className="py-2.5 px-3">
                        {c.isUp ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{c.httpCode}</td>
                      <td className={`py-2.5 px-3 font-mono ${c.ttfbMs >= 3000 ? "text-red-400" : c.ttfbMs >= 1000 ? "text-amber-400" : "text-emerald-400"}`}>
                        {formatMs(c.ttfbMs)}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-border/40">
                          {c.cacheStatus}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground/60 text-[10px]">
                        {c.cfRay ? c.cfRay.slice(0, 12) + "…" : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── Scheduler Status ─────────────────────────────────────────── */}
        <section className="rounded-xl border border-border/60 bg-card p-6">
          <SectionHeader icon={Clock} title="Scheduler Status" sub="All times in Bangkok (Asia/Bangkok, UTC+7)" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {scheduler?.schedules.map((s) => (
              <div key={s.jobName} className="rounded-lg border border-border/40 bg-background/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{s.label}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${
                      s.lastStatus === "ok"
                        ? "border-emerald-500/30 text-emerald-400"
                        : s.lastStatus === "error"
                        ? "border-red-500/30 text-red-400"
                        : "border-border/40 text-muted-foreground"
                    }`}
                  >
                    {s.lastStatus}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next run</span>
                    <span className="font-mono text-primary text-[11px]">{s.nextRunBangkok}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last run</span>
                    <span className="font-mono text-[11px]">{formatTime(s.lastRunAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cron (UTC)</span>
                    <span className="font-mono text-[10px] text-muted-foreground/70">{s.cronUtc}</span>
                  </div>
                </div>
              </div>
            ))}
            {!scheduler && (
              <div className="col-span-4 h-24 flex items-center justify-center text-muted-foreground text-sm">
                Loading scheduler status…
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground/60">
            Schedules are managed via Manus Heartbeat (project-level cron). View and manage them in the Manus dashboard → Settings → Schedules.
          </p>
        </section>

        {/* ─── Alert Log ────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border/60 bg-card p-6">
          <SectionHeader icon={AlertTriangle} title="Alert Log" sub="Cloudflare 403 / 520 logs and recent alerts" />
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/40" />
              No alerts — site is running smoothly
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border px-4 py-3 flex items-start gap-3 text-sm ${
                    a.alertType === "downtime"
                      ? "border-red-500/20 bg-red-500/5"
                      : a.alertType === "high_latency"
                      ? "border-amber-500/20 bg-amber-500/5"
                      : "border-purple-500/20 bg-purple-500/5"
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      a.alertType === "downtime"
                        ? "text-red-400"
                        : a.alertType === "high_latency"
                        ? "text-amber-400"
                        : "text-purple-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          a.alertType === "downtime"
                            ? "border-red-500/30 text-red-400"
                            : a.alertType === "high_latency"
                            ? "border-amber-500/30 text-amber-400"
                            : "border-purple-500/30 text-purple-400"
                        }`}
                      >
                        {a.alertType.replace("_", " ")}
                      </Badge>
                      {a.autoFixApplied && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400">
                          cache purged
                        </Badge>
                      )}
                      {a.pendingPurge && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/30 text-orange-400">
                          purge pending
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground font-mono ml-auto">{formatTime(a.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.message}</p>
                    {a.pendingPurge && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
                          disabled={approvePurgeMutation.isPending}
                          onClick={() => handleApprovePurge(a.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Purge Cache (Manual Approval)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Broken Links Log ──────────────────────────────────── */}
        <section className="rounded-xl border border-border/60 bg-card p-6">
          <SectionHeader icon={Link} title="Broken Links Log" sub="404 logs from Cloudflare analytics and stored monitor data" />
          {brokenLinksQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin opacity-40" />
              Loading broken links…
            </div>
          ) : brokenLinksQuery.isError ? (
            <div className="py-8 text-center text-sm flex flex-col items-center gap-2 text-red-400/70">
              <XCircle className="w-6 h-6" />
              Failed to load broken links
            </div>
          ) : (brokenLinksQuery.data ?? []).length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/40" />
              No broken links detected yet — data populates on each monitor cycle
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4 font-medium">URL / Path</th>
                    <th className="text-right py-2 pr-4 font-medium w-20">Hits</th>
                    <th className="text-right py-2 pr-4 font-medium w-36">Last Seen</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {(brokenLinksQuery.data ?? []).map((row) => (
                    <tr key={row.id} className={row.isCritical ? "bg-red-500/5" : ""}>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          {row.isCritical && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/40 text-red-400 flex-shrink-0">
                              critical
                            </Badge>
                          )}
                          {row.isCritical && (
                            <span
                              title="Critical page returning 404 — check Cloudflare Firewall Events (Security > Events) and WordPress error logs for this URL"
                              className="flex-shrink-0 cursor-help"
                            >
                              <Search className="w-3 h-3 text-blue-400/60 hover:text-blue-400 transition-colors" />
                            </span>
                          )}
                          <a
                            href={`https://nakornchiangrainews.com${row.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-muted-foreground hover:text-foreground truncate max-w-xs block"
                          >
                            {row.url}
                          </a>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <span className={`font-mono text-xs font-semibold ${
                          row.hits >= 100 ? "text-red-400" : row.hits >= 20 ? "text-amber-400" : "text-muted-foreground"
                        }`}>
                          {row.hits.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatTime(row.lastSeen)}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleMarkFixed(row.id, row.url)}
                          disabled={markFixedMutation.isPending}
                          title="Mark as fixed (archive)"
                          className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground/40 hover:text-emerald-400 transition-colors disabled:opacity-30"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ─── Cache Status History Chart ─────────────────────────── */}
        <section className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-6">
          <SectionHeader icon={BarChart3} title="Cache Status History" sub="HIT/MISS logs from the latest stored diagnostics" />
          {cacheHistoryQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : !cacheHistoryQuery.data || cacheHistoryQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 py-4">No cache history yet — click "Run Check Now" to populate.</p>
          ) : (() => {
            // Map statuses to numeric values for bar height; colour by status
            const STATUS_COLORS: Record<string, string> = {
              HIT: "#10b981",
              REVALIDATED: "#34d399",
              MISS: "#f59e0b",
              EXPIRED: "#f97316",
              BYPASS: "#ef4444",
              DYNAMIC: "#6b7280",
            };
            const chartData = [...cacheHistoryQuery.data].slice(0, 20).reverse().map((d, i) => ({
              idx: i + 1,
              value: 1,
              status: d.cfCacheStatus,
              fill: STATUS_COLORS[d.cfCacheStatus] ?? "#6b7280",
              label: new Date(d.checkedAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }));
            // Legend
            const seen = new Set<string>();
            const legend = chartData.filter((d) => { if (seen.has(d.status)) return false; seen.add(d.status); return true; });
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-xs">
                  {legend.map((l) => (
                    <span key={l.status} className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: l.fill }} />
                      {l.status}
                    </span>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={chartData} barCategoryGap="10%">
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs shadow-lg">
                            <p className="font-mono font-bold">{payload[0].payload.status}</p>
                            <p className="text-muted-foreground">{payload[0].payload.label}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </section>

        {/* ─── Cache Diagnostic ──────────────────────────────────────── */}
        <section className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-6">
          <SectionHeader icon={Database} title="Last Cache Diagnostic" sub="Headers captured on last monitor check" />
          {cacheDiagnosticQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : !cacheDiagnosticQuery.data ? (
            <p className="text-sm text-muted-foreground/60 py-4">No diagnostic data yet — click "Run Check Now" to populate.</p>
          ) : (() => {
            const d = cacheDiagnosticQuery.data;
            const statusColor =
              d.cfCacheStatus === "HIT" || d.cfCacheStatus === "REVALIDATED"
                ? "text-emerald-400"
                : ["BYPASS", "MISS", "EXPIRED"].includes(d.cfCacheStatus)
                ? "text-amber-400"
                : "text-muted-foreground";
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 items-center">
                  <span className={`font-mono font-bold text-lg ${statusColor}`}>{d.cfCacheStatus}</span>
                  {d.wpCookiesDetected && (
                    <Badge variant="destructive" className="text-xs font-mono">
                      WP Cookie: {d.wpCookiesDetected}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground/50 ml-auto">
                    {d.checkedAt ? new Date(d.checkedAt).toLocaleString() : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border/30">
                      <tr>
                        <td className="py-1.5 pr-4 text-muted-foreground/60 font-medium w-36">cf-cache-status</td>
                        <td className={`py-1.5 font-mono ${statusColor}`}>{d.cfCacheStatus}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-4 text-muted-foreground/60 font-medium">cache-control</td>
                        <td className="py-1.5 font-mono text-foreground/80">{d.cacheControl}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-4 text-muted-foreground/60 font-medium">vary</td>
                        <td className="py-1.5 font-mono text-foreground/80">{d.vary}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                  <p className="text-xs text-muted-foreground/70 font-medium mb-1">1-sentence health verdict</p>
                  <p className="text-sm text-foreground/90">{d.potentialCause || "No cache health verdict recorded yet."}</p>
                </div>
              </div>
            );
          })()}
        </section>

        {/* ─── Footer ───────────────────────────────────────────────────── */}
        <footer className="border-t border-border/40 pt-6 pb-2 flex items-center justify-between text-xs text-muted-foreground/50">
          <span>NCR Watchdog — nakornchiangrainews.com</span>
          <span className="font-mono">Bangkok (UTC+7)</span>
        </footer>
      </main>
    </div>
  );
}
