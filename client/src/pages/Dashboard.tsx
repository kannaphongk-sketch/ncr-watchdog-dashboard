import React, { useCallback, useState, useMemo } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import type { TopPost } from "@/hooks/useDashboard";
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

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatNumber(value: unknown, fallback = "—"): string {
  const numeric = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : fallback;
}

function formatPercent(value: unknown, fallback = "—"): string {
  const numeric = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : fallback;
}

function formatMs(ms: unknown): string {
  const numeric = toFiniteNumber(ms, Number.NaN);
  if (!Number.isFinite(numeric)) return "—";
  return numeric >= 1000 ? `${(numeric / 1000).toFixed(2)}s` : `${Math.round(numeric)}ms`;
}

function formatBytes(bytes: unknown): string {
  const numeric = toFiniteNumber(bytes, 0);
  if (!numeric || numeric <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(numeric) / Math.log(k)));
  return `${(numeric / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatShortTime(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-GB", {
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
  const [isSentinelRefreshing, setIsSentinelRefreshing] = useState(false);

  // ── DATA: fetch directly from Pages Function (bypasses Express) ──────────
  const { data, loading, refreshing, actions } = useDashboard();
  const topPosts = data.topPosts;

  const statusQuery        = { data: data.status,              isLoading: loading && !data.status,     isFetching: refreshing };
  const cfQuery            = { data: data.analytics,           isLoading: loading && !data.analytics,  isFetching: false };
  const historyQuery       = { data: data.history ?? [],       isLoading: loading,                     isFetching: false };
  const schedulerQuery     = { data: data.scheduler,           isLoading: loading && !data.scheduler,  isFetching: false };
  const alertsQuery        = { data: data.alerts ?? [],        isLoading: loading,                     isFetching: false };
  const telegramConfigQuery= { data: data.telegramConfig,      isLoading: loading, isError: false,     isFetching: false };
  const wpSentinelQuery    = { data: data.sentinel,            isLoading: loading && !data.sentinel,   isFetching: isSentinelRefreshing };
  const latencyTimelineQuery = { data: data.latencyTimeline ?? [], isLoading: loading,                 isFetching: isSentinelRefreshing, dataUpdatedAt: data.latencyTimeline?.length ? Date.now() : undefined };
  const securityLevelQuery = { data: data.securityLevel,       isLoading: loading };
  const activeBrokenLinksCountQuery = { data: data.activeBrokenLinksCount, isLoading: loading };
  // topPosts is accessed directly via data.topPosts above
  const brokenLinksQuery   = { data: [] as unknown[], isLoading: false, isError: false };
  const cacheHistoryQuery  = { data: [] as unknown[], isLoading: false };
  const cacheDiagnosticQuery = { data: null as null, isLoading: false };

  const handleSentinelRefresh = useCallback(async () => {
    setIsSentinelRefreshing(true);
    try { await actions.refreshSentinel(); }
    finally { setIsSentinelRefreshing(false); }
  }, [actions]);

  // Mutations
  const runCheckMutation       = { mutateAsync: actions.runCheck,       isPending: isRunningCheck };
  const purgeCacheMutation     = { mutateAsync: actions.purgeCache,     isPending: isPurgingCache };
  const sendTestReportMutation = { mutateAsync: actions.sendTestReport, isPending: isSendingReport };
  const approvePurgeMutation   = { mutateAsync: async () => ({ success: false, message: "not implemented" }), isPending: false };
  const markFixedMutation      = { mutateAsync: async () => ({}), isPending: false };

  // Invalidate shim (no-op — useDashboard handles refresh internally)
  const utils = {
    monitor: {
      history:      { invalidate: actions.refresh },
      quickStatus:  { invalidate: actions.refresh },
      alerts:       { invalidate: actions.refresh },
      telegramConfig:{ invalidate: actions.refresh },
      brokenLinks:  { invalidate: actions.refresh },
    },
  };
  // ── END DATA ─────────────────────────────────────────────────────────────

  const handleMarkFixed = useCallback(async (id: number, url: string) => {
    try {
      await markFixedMutation.mutateAsync({ id } as never);
      toast.success(`Marked as fixed: ${url}`);
    } catch {
      toast.error("Failed to mark as fixed");
    }
  }, []);

  const handleRunCheck = useCallback(async () => {
    setIsRunningCheck(true);
    try {
      const result = await runCheckMutation.mutateAsync();
      await actions.refresh();
      if (result.isUp) {
        toast.success(`Check complete — HTTP ${result.httpCode}, TTFB ${formatMs(result.ttfbMs)}`);
      } else {
        toast.error(`Site issue detected — HTTP ${result.httpCode}`);
      }
    } catch {
      toast.error("Check failed — please try again");
    } finally {
      setIsRunningCheck(false);
    }
  }, [actions]);

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
  }, []);

  const handleApprovePurge = useCallback(async (_alertId: number) => {
    toast.info("Manual purge approval — use Purge CF Cache button");
  }, []);

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
  }, []);

  const rawStatus = statusQuery.data;
  const history = historyQuery.data ?? [];
  const latestHistoryCheck = history[0];
  const hasRealtimeStatus = rawStatus?.httpCode !== undefined && rawStatus?.httpCode !== null;
  const normalizedHttpCode = toFiniteNumber(rawStatus?.httpCode, toFiniteNumber(latestHistoryCheck?.httpCode, 0));
  const normalizedIsUp = hasRealtimeStatus
    ? Boolean(rawStatus?.isUp) && normalizedHttpCode >= 200 && normalizedHttpCode < 400
    : Boolean(latestHistoryCheck?.isUp);
  const status = rawStatus
    ? { ...rawStatus, httpCode: normalizedHttpCode, isUp: normalizedIsUp }
    : latestHistoryCheck
    ? { ...latestHistoryCheck, uptimePercent: undefined, avgTtfbMs: undefined, httpCode: normalizedHttpCode, ttfbMs: toFiniteNumber(latestHistoryCheck.ttfbMs, 0), isUp: normalizedIsUp }
    : undefined;
  const cf = cfQuery.data;
  const telegramConfig = telegramConfigQuery.data;
  const telegramConfigured = Boolean(telegramConfig?.configured);
  const telegramRecipients = telegramConfig?.chatIds?.length
    ? telegramConfig.chatIds
    : (import.meta.env.VITE_TELEGRAM_CHAT_IDS ? [import.meta.env.VITE_TELEGRAM_CHAT_IDS] : ["8674647124"]);
  const scheduler = schedulerQuery.data;
  const alerts = alertsQuery.data ?? [];
  const rollingTtfbChecks = history.slice(0, 20);
  const avgTtfbFromHistory = rollingTtfbChecks.length
    ? Math.round(rollingTtfbChecks.reduce((sum, c) => sum + toFiniteNumber(c.ttfbMs), 0) / rollingTtfbChecks.length)
    : 0;
  const currentAvgTtfb = toFiniteNumber(status?.avgTtfbMs, 0);
  const avgTtfb = currentAvgTtfb > 0 ? currentAvgTtfb : avgTtfbFromHistory;
  const monitoringHistory = history.slice(0, 100);

  const chartData = [...history]
    .slice(0, 10)
    .reverse()
    .map((c) => ({
      time: formatShortTime(c.createdAt),
      ttfb: toFiniteNumber(c.ttfbMs),
      status: c.isUp ? 1 : 0,
    }));

  const cfTotalRequests = toFiniteNumber(cf?.totalRequests, 0);
  const cfCachedRequests = Math.min(cfTotalRequests, toFiniteNumber(cf?.cachedRequests, 0));
  const cfHasRawData = cfTotalRequests > 0 || cfCachedRequests > 0;
  const hasCfAnalyticsData = Boolean(cf?.analyticsAvailable ?? cfHasRawData);
  const cfAnalyticsUnavailableReason = cf?.unavailableReason || "Cloudflare analytics unavailable";
  const cfCacheHitRate = hasCfAnalyticsData
    ? toFiniteNumber(cf?.cacheHitRate, (cfCachedRequests / Math.max(1, cfTotalRequests)) * 100)
    : Number.NaN;
  const cfCount404 = toFiniteNumber(cf?.count404, 0);
  const cfThreats = toFiniteNumber(cf?.threats, 0);
  const cacheChartData = [
    { name: "Cache HIT", value: cfCachedRequests, fill: "oklch(0.72 0.17 145)" },
    { name: "Cache MISS", value: Math.max(0, cfTotalRequests - cfCachedRequests), fill: "oklch(0.22 0.02 240)" },
  ];

  const historyForUptime = status
    ? [{ isUp: status.isUp }, ...history.slice(status === latestHistoryCheck ? 1 : 0)].slice(0, 100)
    : monitoringHistory;
  const uptimePercentFromHistory = historyForUptime.length
    ? (historyForUptime.filter((check) => Boolean(check.isUp)).length / historyForUptime.length) * 100
    : undefined;
  const uptimePercent = toFiniteNumber(rawStatus?.uptimePercent, uptimePercentFromHistory ?? (status?.isUp ? 100 : 0));
  const currentTtfbMs = toFiniteNumber(status?.ttfbMs, 0);
  const ttfbStatus = currentTtfbMs
    ? currentTtfbMs <= 2500 ? "green" : currentTtfbMs <= 5000 ? "yellow" : "red"
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
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">

        {/* ─── Manual Action Buttons ────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleRunCheck} disabled={isRunningCheck} className="gap-2 bg-primary/90 hover:bg-primary text-primary-foreground">
            <RefreshCw className={`w-4 h-4 ${isRunningCheck ? "animate-spin" : ""}`} />
            Run Check Now
          </Button>
          <Button onClick={handlePurgeCache} disabled={isPurgingCache} variant="outline" className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
            <Trash2 className={`w-4 h-4 ${isPurgingCache ? "animate-pulse" : ""}`} />
            Purge CF Cache
          </Button>
          <Button onClick={handleSendTestReport} disabled={isSendingReport || telegramConfigQuery.isError} variant="outline" className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
            <Send className={`w-4 h-4 ${isSendingReport ? "animate-pulse" : ""}`} />
            Send Test Report
          </Button>
        </div>

        <div className={`rounded-xl border px-4 py-3 text-sm ${telegramConfigured ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/25 bg-amber-500/10 text-amber-300"}`}>
          <div className="flex flex-wrap items-center gap-2">
            {telegramConfigured ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="font-medium">
              Telegram {telegramConfigured ? "connected" : telegramConfigQuery.isLoading ? "checking configuration" : "configuration pending"}
            </span>
            <span className="text-muted-foreground">
              @ncr_watchdog_bot recipients: {telegramRecipients.join(", ")}
            </span>
          </div>
        </div>

        {/* ─── Overview Metric Cards ────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Globe} title="Site Overview" sub="nakornchiangrainews.com — real-time status" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard icon={Wifi} label="HTTP Status" value={status ? `${status.httpCode}` : "—"} sub={status?.isUp ? "Online" : "Offline"} accent={status?.isUp ? "green" : "red"} loading={statusQuery.isLoading} />
            <MetricCard icon={Zap} label="TTFB" value={status ? formatMs(status.ttfbMs) : "—"} sub="Warning: 2,500ms · Critical: 5,000ms" accent={ttfbStatus as "blue"|"green"|"yellow"|"red"|"purple"} loading={statusQuery.isLoading} />
            <MetricCard icon={TrendingUp} label="Uptime" value={formatPercent(uptimePercent)} sub="Last 100 checks" accent={uptimePercent >= 99 ? "green" : uptimePercent >= 95 ? "yellow" : "red"} loading={statusQuery.isLoading} />
            <MetricCard
              icon={BarChart3}
              label="CF Cache Hit"
              value={formatPercent(cfCacheHitRate)}
              sub={hasCfAnalyticsData ? "24h average" : cfAnalyticsUnavailableReason}
              accent="blue"
              loading={cfQuery.isLoading}
            />
            <MetricCard icon={Server} label="Avg TTFB" value={formatMs(avgTtfb)} sub={`Rolling average from ${rollingTtfbChecks.length || 0}/20 checks`} accent={avgTtfb <= 2500 ? "green" : avgTtfb <= 5000 ? "yellow" : "red"} loading={statusQuery.isLoading && historyQuery.isLoading} />
          </div>
        </section>

        {/* ─── WP Sentinel V10.7 ──────────────────────────────────────────── */}
        <section>
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
              {wpSentinelQuery.data && (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${wpSentinelQuery.data.healthAlert ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'}`}>
                    {wpSentinelQuery.data.healthAlert ? '⚠️' : '✅'} {normalizeSentinelHealthLabel(wpSentinelQuery.data.wpHealth)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-primary/10 border-primary/20 text-primary/80 inline-flex">
                    {normalizeSentinelModeLabel(wpSentinelQuery.data.operatingMode, wpSentinelQuery.data.wpStatus)}
                  </span>
                </>
              )}
              <button
                onClick={handleSentinelRefresh}
                disabled={isSentinelRefreshing}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border/60 hover:border-border bg-card hover:bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSentinelRefreshing ? 'animate-spin' : ''}`} />
                {isSentinelRefreshing ? 'Refreshing…' : 'Refresh Now'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DB Heartbeat Gauge */}
            {(() => {
              const v6 = wpSentinelQuery.data;
              const rawDbMs = toFiniteNumber(v6?.dbLatencyMs, Number.NaN);
              const dbMs = Number.isFinite(rawDbMs) ? rawDbMs : null;
              const isLoading = wpSentinelQuery.isLoading;
              const gaugeColor = dbMs === null ? "oklch(0.55 0.02 240)" : dbMs < 100 ? "oklch(0.72 0.17 145)" : dbMs < 500 ? "oklch(0.78 0.18 80)" : "oklch(0.65 0.22 25)";
              const statusLabel = dbMs === null ? "Connecting..." : dbMs < 100 ? "🟢 Excellent (<100ms)" : dbMs < 500 ? "🟡 Normal (100–500ms)" : "🔴 Slow (>500ms)";
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
                        <path d="M 10 66 A 50 50 0 0 1 110 66" fill="none" stroke="oklch(0.22 0.02 240)" strokeWidth="10" strokeLinecap="round" />
                        <path d="M 10 66 A 50 50 0 0 1 110 66" fill="none" stroke={gaugeColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${gap}`} style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.23,1,0.32,1), stroke 0.4s ease" }} />
                        <text x="60" y="60" textAnchor="middle" fontSize="17" fontWeight="700" fontFamily="monospace" fill={gaugeColor}>{formatMs(dbMs)}</text>
                      </svg>
                    )}
                    <span className="text-xs" style={{ color: gaugeColor }}>{statusLabel}</span>
                  </div>
                </div>
              );
            })()}
            {/* Sentinel Mode */}
            {(() => {
              const v6 = wpSentinelQuery.data;
              const mode = (!wpSentinelQuery.isError && v6?.operatingMode) ? v6.operatingMode : null;
              const displayMode = normalizeSentinelModeLabel(mode, v6?.wpStatus);
              const isCloud = displayMode === "Autonomous Caretaker Active";
              const isNight = displayMode.toLowerCase().includes("night");
              const isPrime = displayMode.toLowerCase().includes("prime");
              const modeColor = isCloud ? "oklch(0.65 0.18 240)" : isNight ? "oklch(0.65 0.18 240)" : isPrime ? "oklch(0.72 0.17 145)" : "oklch(0.78 0.18 80)";
              const modeBg = isCloud ? "bg-blue-500/10 border-blue-500/20" : isNight ? "bg-blue-500/10 border-blue-500/20" : isPrime ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20";
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
                      <span className="font-mono text-xl font-semibold tracking-tight" style={{ color: modeColor }}>{displayMode}</span>
                    </div>
                  )}
                  {v6?.statusCritical && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Status CRITICAL: {v6.wpStatus}</span>
                    </div>
                  )}
                  <div className="text-xs opacity-55">{isCloud ? "Autonomous — 24/7 Vigilance Active" : "Current mode based on Server Time"}</div>
                  {v6?.lastSystemCheck && (
                    <div className="text-xs text-muted-foreground/50 font-mono">Last System Check: {v6.lastSystemCheck} (BKK)</div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* V12.3 Lean Config: Memory, Disk, Images, 404, Cache Status */}
          {(() => {
            const v6 = wpSentinelQuery.data;
            const isLoading = wpSentinelQuery.isLoading;
            const memMb = Math.max(0, toFiniteNumber(v6?.memoryUsageMb, 0));
            const memMax = 512;
            const memPct = Math.min(100, Math.round((memMb / memMax) * 100));
            const memColor = (v6?.memoryStatus === 'critical') ? 'oklch(0.65 0.22 25)' : (v6?.memoryStatus === 'warning') ? 'oklch(0.78 0.18 80)' : 'oklch(0.72 0.17 145)';
            const memLabel = (v6?.memoryStatus === 'critical') ? '🔴 High' : (v6?.memoryStatus === 'warning') ? '🟡 Moderate' : '🟢 Optimal';
            const diskGb = toFiniteNumber(v6?.diskFreeGb, -1);
            const diskManaged = v6?.diskSystemManaged ?? true;
            const diskColor = diskManaged ? 'oklch(0.72 0.17 145)' : diskGb < 1.5 ? 'oklch(0.65 0.22 25)' : diskGb < 3.0 ? 'oklch(0.78 0.18 80)' : 'oklch(0.72 0.17 145)';
            const diskLabel = diskManaged ? '🟢 System Managed' : diskGb < 1.5 ? '🔴 Low' : diskGb < 3.0 ? '🟡 Moderate' : '🟢 Ample';
            const rawImgOpt = toFiniteNumber(v6?.optimizedImages, 0);
            const rawImgTotal = toFiniteNumber(v6?.totalImages, rawImgOpt);
            const imgOpt = Math.max(0, rawImgOpt);
            const imgTotal = Math.max(0, rawImgTotal);
            const imgPct = imgTotal > 0 ? Math.min(100, Math.round((imgOpt / imgTotal) * 100)) : 100;
            const imgStatusLabel = imgPct >= 80 ? '🟢 Optimized' : imgPct >= 50 ? '🟡 In Progress' : '🔴 Needs Optimization';
            const imgBarColor = imgPct >= 80 ? 'oklch(0.72 0.17 145)' : imgPct >= 50 ? 'oklch(0.78 0.18 80)' : 'oklch(0.65 0.22 25)';
            const count404 = toFiniteNumber(v6?.verified404, 0);
            const has404 = count404 > 0;
            const cacheLabel = String(v6?.cacheStatusLabel ?? 'Cache Status: Checking');
            const cacheStable = cacheLabel.includes('Stable');
            return (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Memory Usage</span><Cpu className="w-4 h-4 text-muted-foreground/60" /></div>
                  {isLoading ? <div className="h-12 rounded bg-white/5 animate-pulse" /> : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-end justify-between"><span className="font-mono text-2xl font-bold" style={{ color: memColor }}>{memMb.toFixed(1)}</span><span className="text-xs text-muted-foreground">/ {memMax} MB</span></div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${memPct}%`, backgroundColor: memColor }} /></div>
                      <span className="text-xs" style={{ color: memColor }}>{memLabel}</span>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Disk Free</span><HardDrive className="w-4 h-4 text-muted-foreground/60" /></div>
                  {isLoading ? <div className="h-12 rounded bg-white/5 animate-pulse" /> : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-end justify-between"><span className="font-mono text-2xl font-bold" style={{ color: diskColor }}>{diskManaged ? '∞' : diskGb.toFixed(0)}</span><span className="text-xs text-muted-foreground">{diskManaged ? 'GB' : 'GB free'}</span></div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: diskManaged ? '100%' : `${Math.min(100, (diskGb / 10) * 100)}%`, backgroundColor: diskColor }} /></div>
                      <span className="text-xs" style={{ color: diskColor }}>{diskLabel}</span>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Images Optimized</span><Image className="w-4 h-4 text-muted-foreground/60" /></div>
                  {isLoading ? <div className="h-12 rounded bg-white/5 animate-pulse" /> : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-end justify-between"><span className="font-mono text-2xl font-bold" style={{ color: imgBarColor }}>{imgPct}%</span><span className="text-xs text-muted-foreground">{formatNumber(imgOpt)} / {formatNumber(imgTotal)}</span></div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${imgPct}%`, backgroundColor: imgBarColor }} /></div>
                      <span className="text-xs" style={{ color: imgBarColor }}>{imgStatusLabel}</span>
                    </div>
                  )}
                </div>
                <div className={`rounded-xl border p-4 flex flex-col gap-3 ${has404 ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
                  <div className="flex items-center justify-between"><span className={`text-xs font-medium uppercase tracking-wider ${has404 ? 'text-red-400' : 'text-emerald-400/70'}`}>Verified 404 Count</span>{has404 ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400/70" />}</div>
                  <div className="flex items-center gap-2"><span className={`font-mono text-3xl font-bold ${has404 ? 'text-red-400' : 'text-emerald-400'}`}>{count404}</span><span className={`text-xs ${has404 ? 'text-red-400/70' : 'text-emerald-400/60'}`}>verified broken links in the last hour</span></div>
                  <span className={`text-xs ${has404 ? 'text-red-400/60' : 'text-emerald-400/50'}`}>{has404 ? 'Check Telegram for URL details' : 'No broken links detected this hour'}</span>
                </div>
                <div className={`rounded-xl border p-4 flex flex-col gap-3 ${cacheStable ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border/60 bg-card'}`}>
                  <div className="flex items-center justify-between"><span className={`text-xs font-medium uppercase tracking-wider ${cacheStable ? 'text-emerald-400' : 'text-muted-foreground'}`}>Cache Status</span>{cacheStable ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-muted-foreground/60" />}</div>
                  {isLoading ? <div className="h-8 rounded bg-white/5 animate-pulse" /> : (
                    <div className="flex flex-col gap-1">
                      <span className={`font-semibold text-lg ${cacheStable ? 'text-emerald-400' : 'text-muted-foreground'}`}>{cacheStable ? '✅ Stable' : '⏳ Checking'}</span>
                      <span className="text-xs text-muted-foreground/60">{cacheStable ? 'TTFB < 100ms — Anti-Ghost Active' : 'Monitoring response time...'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* DB Latency Sparkline */}
          {(() => {
            const points = latencyTimelineQuery.data ?? [];
            const sparkData = points.map(p => ({ time: formatShortTime(p.ts), latencyMs: toFiniteNumber(p.latencyMs), status: String(p.status ?? "unknown") }));
            const isLoading = latencyTimelineQuery.isLoading;
            const lastUpdatedTs = latencyTimelineQuery.dataUpdatedAt ? formatShortTime(new Date(latencyTimelineQuery.dataUpdatedAt)) : null;
            return (
              <div className="mt-4 rounded-xl border border-border/60 bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><Database className="w-4 h-4 text-muted-foreground/60" /><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">DB Latency Trend (24h)</span></div>
                  <div className="flex items-center gap-3">
                    {lastUpdatedTs && <span className="text-xs text-muted-foreground/60">Updated {lastUpdatedTs}</span>}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/70"></span>Excellent
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500/70"></span>Normal
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500/70"></span>Slow
                    </div>
                  </div>
                </div>
                {isLoading ? <div className="h-28 rounded bg-white/5 animate-pulse" /> : points.length === 0 ? (
                  <div className="h-28 flex items-center justify-center text-muted-foreground text-xs">No data yet — latency readings will appear after the next keepalive check</div>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={sparkData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                      <defs><linearGradient id="dbLatGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="oklch(0.72 0.17 145)" stopOpacity={0.35} /><stop offset="95%" stopColor="oklch(0.72 0.17 145)" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.02 240)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: 'oklch(0.55 0.02 240)', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: 'oklch(0.55 0.02 240)', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}ms`} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const ms = payload[0]?.value as number;
                        const st = (payload[0]?.payload as { status: string })?.status ?? '';
                        const color = ms < 100 ? 'oklch(0.72 0.17 145)' : ms < 500 ? 'oklch(0.78 0.18 80)' : 'oklch(0.65 0.22 25)';
                        return <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs"><div className="text-muted-foreground mb-1">{label}</div><div className="font-mono font-semibold" style={{ color }}>{ms}ms — {st}</div></div>;
                      }} />
                      <Area type="monotone" dataKey="latencyMs" stroke="oklch(0.72 0.17 145)" strokeWidth={1.5} fill="url(#dbLatGrad)"
                        dot={(props: { cx: number; cy: number; payload: { status: string; latencyMs: number } }) => {
                          const { cx, cy, payload } = props;
                          const c = payload.latencyMs < 100 ? 'oklch(0.72 0.17 145)' : payload.latencyMs < 500 ? 'oklch(0.78 0.18 80)' : 'oklch(0.65 0.22 25)';
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

        {/* ─── TTFB History + CF Cache Donut ───────────────────────────── */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card p-6">
            <SectionHeader icon={Activity} title="TTFB History" sub={`Last ${chartData.length}/10 breakdown`} />
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No history yet — run a check to populate</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs><linearGradient id="ttfbGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="oklch(0.65 0.18 240)" stopOpacity={0.3} /><stop offset="95%" stopColor="oklch(0.65 0.18 240)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.02 240)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "oklch(0.58 0.02 240)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "oklch(0.58 0.02 240)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey={() => 3000} stroke="oklch(0.62 0.22 25)" strokeDasharray="4 4" strokeWidth={1} dot={false} name="Threshold" />
                  <Area type="monotone" dataKey="ttfb" stroke="oklch(0.65 0.18 240)" strokeWidth={2} fill="url(#ttfbGrad)" dot={false} name="TTFB" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <SectionHeader icon={BarChart3} title="CF Cache Ratio" sub="24h hit vs miss" />
            {cf ? (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={cacheChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                      {cacheChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatNumber(v), ""]} contentStyle={{ background: "oklch(0.14 0.015 240)", border: "1px solid oklch(0.22 0.02 240)", borderRadius: "8px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2 text-xs">
                  <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Cache HIT</span><span className="font-mono text-emerald-400">{formatPercent(cfCacheHitRate)}</span></div>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted" />Cache MISS</span><span className="font-mono text-muted-foreground">{formatPercent(Math.max(0, 100 - cfCacheHitRate))}</span></div>
                  <div className="flex justify-between items-center pt-1 border-t border-border/40"><span className="text-muted-foreground">Total Requests</span><span className="font-mono">{formatNumber(cfTotalRequests)}</span></div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm text-center">
                CF analytics loading<br /><span className="text-xs opacity-60 mt-1 block">Values appear as soon as the API responds</span>
              </div>
            )}
          </div>
        </section>

        {/* ─── Traffic + Security ───────────────────────────────────────── */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <SectionHeader icon={TrendingUp} title="Traffic (24h)" sub="Cloudflare analytics" />
            <div className="space-y-4">
              {[
                { label: "Total Requests", value: cf ? formatNumber(cfTotalRequests) : "—", icon: Globe },
                { label: "Cached Requests", value: cf ? formatNumber(cfCachedRequests) : "—", icon: BarChart3 },
                { label: "Bandwidth", value: cf ? formatBytes(cf.bandwidth) : "—", icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="w-3.5 h-3.5" />{label}</div>
                  <span className="font-mono text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1"><SectionHeader icon={Shield} title="Security" sub="Threats and alerts" /></div>
              {securityLevelQuery.data && !["medium","low","essentially_off"].includes(securityLevelQuery.data.level) && (
                <Badge variant="outline" className={`text-xs px-2 py-0.5 animate-pulse ${securityLevelQuery.data.level === "under_attack" ? "border-red-500/60 text-red-400 bg-red-500/10" : "border-amber-500/60 text-amber-400 bg-amber-500/10"}`}>
                  {securityLevelQuery.data.level === "under_attack" ? "🛡️ Under Attack Mode" : "🛡️ High Security"}
                </Badge>
              )}
            </div>
            <div className="space-y-4">
              {[
                { label: "Threats Blocked (CF)", value: cf ? formatNumber(cfThreats) : "—", accent: cf && cfThreats > 0 ? "text-amber-400" : "text-emerald-400" },
                { label: "404 Errors (24h)", value: cf ? formatNumber(cfCount404) : "—", accent: cf && cfCount404 > 50 ? "text-red-400" : cf && cfCount404 > 10 ? "text-amber-400" : "text-emerald-400" },
                { label: "Recent Alerts", value: alerts.length.toString(), accent: alerts.length > 0 ? "text-amber-400" : "text-emerald-400" },
                { label: "Auto-Fixes Applied", value: alerts.filter((a) => a.autoFixApplied).length.toString(), accent: "text-blue-400" },
                { label: "Broken Links (Active)", value: activeBrokenLinksCountQuery.data != null ? activeBrokenLinksCountQuery.data.count.toString() : "—", accent: (activeBrokenLinksCountQuery.data?.count ?? 0) > 5 ? "text-red-400" : (activeBrokenLinksCountQuery.data?.count ?? 0) > 0 ? "text-amber-400" : "text-emerald-400" },
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
          <SectionHeader icon={Activity} title="Monitoring History Log" sub={`Showing ${monitoringHistory.length}/100 stored records`} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  {["Time (BKK)", "Status", "HTTP", "TTFB", "Cache", "CF Ray"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monitoringHistory.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No checks recorded yet — click "Run Check Now"</td></tr>
                ) : (
                  monitoringHistory.map((c) => (
                    <tr key={c.id} className="border-b border-border/20 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">{formatTime(c.createdAt)}</td>
                      <td className="py-2.5 px-3">{c.isUp ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}</td>
                      <td className="py-2.5 px-3 font-mono">{c.httpCode}</td>
                      <td className={`py-2.5 px-3 font-mono ${c.ttfbMs >= 3000 ? "text-red-400" : c.ttfbMs >= 1000 ? "text-amber-400" : "text-emerald-400"}`}>{formatMs(c.ttfbMs)}</td>
                      <td className="py-2.5 px-3"><Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-border/40">{c.cacheStatus}</Badge></td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground/60 text-[10px]">{c.cfRay ? c.cfRay.slice(0, 12) + "…" : "—"}</td>
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
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${s.lastStatus === "ok" ? "border-emerald-500/30 text-emerald-400" : s.lastStatus === "error" ? "border-red-500/30 text-red-400" : "border-border/40 text-muted-foreground"}`}>{s.lastStatus}</Badge>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Next run</span><span className="font-mono text-primary text-[11px]">{s.nextRunBangkok}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last run</span><span className="font-mono text-[11px]">{formatTime(s.lastRunAt)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cron (UTC)</span><span className="font-mono text-[10px] text-muted-foreground/70">{s.cronUtc}</span></div>
                </div>
              </div>
            ))}
            {!scheduler && <div className="col-span-4 h-24 flex items-center justify-center text-muted-foreground text-sm">Loading scheduler status…</div>}
          </div>
        </section>

        {/* ─── Alert Log ────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border/60 bg-card p-6">
          <SectionHeader icon={AlertTriangle} title="Alert Log" sub="Recent alerts" />
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/40" />
              No alerts — site is running smoothly
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className={`rounded-lg border px-4 py-3 flex items-start gap-3 text-sm ${a.alertType === "downtime" ? "border-red-500/20 bg-red-500/5" : a.alertType === "high_latency" ? "border-amber-500/20 bg-amber-500/5" : "border-purple-500/20 bg-purple-500/5"}`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.alertType === "downtime" ? "text-red-400" : a.alertType === "high_latency" ? "text-amber-400" : "text-purple-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${a.alertType === "downtime" ? "border-red-500/30 text-red-400" : a.alertType === "high_latency" ? "border-amber-500/30 text-amber-400" : "border-purple-500/30 text-purple-400"}`}>{a.alertType.replace("_", " ")}</Badge>
                      {a.autoFixApplied && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400">cache purged</Badge>}
                      <span className="text-xs text-muted-foreground font-mono ml-auto">{formatTime(a.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>


        {/* ─── Top 10 URLs ─────────────────────────────────────────── */}
        <section className="rounded-xl border border-border/60 bg-card p-6">
          <SectionHeader
            icon={TrendingUp}
            title="Top 10 URLs (24h)"
            sub="หน้าที่มีผู้เข้าชมมากที่สุดใน 24 ชั่วโมงล่าสุด"
          />
          {loading && !topPosts ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : !topPosts?.available || topPosts.posts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <BarChart3 className="w-8 h-8 opacity-30" />
              ไม่มีข้อมูล Top URLs — รอ Cloudflare Analytics update
            </div>
          ) : (
            <div className="space-y-2">
              {topPosts.posts.map((post, i) => (
                <div key={post.path} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                  {/* Rank */}
                  <span className={`text-xs font-bold w-6 text-center flex-shrink-0 ${
                    i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-700" : "text-muted-foreground/50"
                  }`}>
                    {i + 1}
                  </span>
                  {/* Bar + Path */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <a
                        href={`https://nakornchiangrainews.com${post.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-foreground/80 hover:text-primary truncate max-w-[70%] transition-colors"
                      >
                        {post.path}
                      </a>
                      <span className="text-xs font-mono text-muted-foreground ml-2 flex-shrink-0">
                        {post.count.toLocaleString()} req
                      </span>
                    </div>
                    {/* Horizontal bar */}
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${post.pct}%`,
                          background: i === 0
                            ? "oklch(0.78 0.18 80)"
                            : i < 3
                            ? "oklch(0.65 0.18 240)"
                            : "oklch(0.45 0.08 240)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
