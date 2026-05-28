import { useCallback, useEffect, useRef, useState } from "react";

export interface QuickStatus {
  httpCode: number;
  ttfbMs: number;
  isUp: boolean;
  cacheStatus: string;
  cfRay: string;
  uptimePercent: number;
  avgTtfbMs: number;
  checkedAt: string;
}

export interface CfAnalytics {
  totalRequests: number;
  cachedRequests: number;
  bandwidth: number;
  threats: number;
  cacheHitRate: number;
  count404: number;
  visits: number;
  pageViews: number;
  analyticsAvailable: boolean;
  unavailableReason?: string;
}

export interface SentinelData {
  operatingMode: string;
  wpStatus: string;
  wpHealth: string;
  dbLatencyMs: number;
  memoryUsageMb: number;
  memoryStatus: string;
  diskFreeGb: number;
  diskSystemManaged: boolean;
  optimizedImages: number;
  totalImages: number;
  verified404: number;
  cacheStatusLabel: string;
  statusCritical: boolean;
  healthAlert: boolean;
  lastSystemCheck: string | null;
}

export interface HistoryRecord {
  id: number;
  httpCode: number;
  ttfbMs: number;
  isUp: boolean;
  cacheStatus: string;
  cfRay: string;
  createdAt: string;
}

export interface SchedulerStatus {
  currentBangkokTime: string;
  schedules: {
    jobName: string;
    label: string;
    cronUtc: string;
    nextRunBangkok: string;
    lastRunAt: string | null;
    lastStatus: string;
  }[];
}

export interface AlertRecord {
  id: number;
  alertType: string;
  message: string;
  autoFixApplied: boolean;
  pendingPurge: boolean;
  createdAt: string;
}

export interface TelegramConfig {
  configured: boolean;
  botConfigured: boolean;
  chatIds: string[];
  status: string;
}

export interface LatencyPoint {
  ts: string;
  latencyMs: number;
  status: string;
}

export interface SecurityLevel {
  level: string;
}

export interface ActiveBrokenLinksCount {
  count: number;
}

async function fetchProc<T>(proc: string): Promise<T> {
  const res = await fetch(`/api/trpc/${proc}?batch=1`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${proc}`);
  const json: unknown = await res.json();
  const item = Array.isArray(json) ? json[0] : json;
  const nested = (item as Record<string, unknown>)?.result;
  if (nested && typeof nested === "object" && "data" in (nested as object)) {
    return (nested as Record<string, unknown>).data as T;
  }
  return (nested ?? item) as T;
}

async function mutateProc<T>(proc: string): Promise<T> {
  const res = await fetch(`/api/trpc/${proc}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${proc}`);
  const json: unknown = await res.json();
  const item = Array.isArray(json) ? json[0] : json;
  const nested = (item as Record<string, unknown>)?.result;
  if (nested && typeof nested === "object" && "data" in (nested as object)) {
    return (nested as Record<string, unknown>).data as T;
  }
  return (nested ?? item) as T;
}

export interface DashboardData {
  status: QuickStatus | null;
  analytics: CfAnalytics | null;
  sentinel: SentinelData | null;
  history: HistoryRecord[];
  scheduler: SchedulerStatus | null;
  alerts: AlertRecord[];
  telegramConfig: TelegramConfig | null;
  latencyTimeline: LatencyPoint[];
  securityLevel: SecurityLevel | null;
  activeBrokenLinksCount: ActiveBrokenLinksCount | null;
}

export interface DashboardActions {
  runCheck: () => Promise<QuickStatus & { alertsFired: unknown[]; autoFixApplied: boolean }>;
  purgeCache: () => Promise<{ success: boolean; message: string }>;
  sendTestReport: () => Promise<{ success: boolean; messageId?: number; error?: string }>;
  refreshSentinel: () => Promise<void>;
  refresh: (showSpinner?: boolean) => Promise<void>;
}

export function useDashboard(refreshInterval = 60_000) {
  const [data, setData] = useState<DashboardData>({
    status: null, analytics: null, sentinel: null, history: [],
    scheduler: null, alerts: [], telegramConfig: null,
    latencyTimeline: [], securityLevel: null, activeBrokenLinksCount: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const refresh = useCallback(async (_showSpinner = false) => {
    try {
      const [statusR, analyticsR, sentinelR] = await Promise.allSettled([
        fetchProc<QuickStatus>("monitor.quickStatus"),
        fetchProc<CfAnalytics>("monitor.cfAnalytics"),
        fetchProc<SentinelData>("wpSentinel.getV6Data"),
      ]);
      if (!isMounted.current) return;
      setData(prev => ({
        ...prev,
        status: statusR.status === "fulfilled" ? statusR.value : prev.status,
        analytics: analyticsR.status === "fulfilled" ? analyticsR.value : prev.analytics,
        sentinel: sentinelR.status === "fulfilled" ? sentinelR.value : prev.sentinel,
      }));
      setLoading(false);
      setLastUpdated(new Date());
      const [historyR, schedulerR, alertsR, telegramR, latencyR, securityR, brokenR] =
        await Promise.allSettled([
          fetchProc<HistoryRecord[]>("monitor.history"),
          fetchProc<SchedulerStatus>("monitor.schedulerStatus"),
          fetchProc<AlertRecord[]>("monitor.alerts"),
          fetchProc<TelegramConfig>("monitor.telegramConfig"),
          fetchProc<LatencyPoint[]>("wpSentinel.getLatencyTimeline"),
          fetchProc<SecurityLevel>("monitor.securityLevel"),
          fetchProc<ActiveBrokenLinksCount>("monitor.activeBrokenLinksCount"),
        ]);
      if (!isMounted.current) return;
      setData(prev => ({
        ...prev,
        history: historyR.status === "fulfilled" ? (historyR.value ?? []) : prev.history,
        scheduler: schedulerR.status === "fulfilled" ? schedulerR.value : prev.scheduler,
        alerts: alertsR.status === "fulfilled" ? (alertsR.value ?? []) : prev.alerts,
        telegramConfig: telegramR.status === "fulfilled" ? telegramR.value : prev.telegramConfig,
        latencyTimeline: latencyR.status === "fulfilled" ? (latencyR.value ?? []) : prev.latencyTimeline,
        securityLevel: securityR.status === "fulfilled" ? securityR.value : prev.securityLevel,
        activeBrokenLinksCount: brokenR.status === "fulfilled" ? brokenR.value : prev.activeBrokenLinksCount,
      }));
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, refreshInterval);
    return () => clearInterval(timer);
  }, [refresh, refreshInterval]);

  const actions: DashboardActions = {
    runCheck: () => mutateProc<QuickStatus & { alertsFired: unknown[]; autoFixApplied: boolean }>("monitor.runCheck"),
    purgeCache: () => mutateProc<{ success: boolean; message: string }>("monitor.purgeCache"),
    sendTestReport: () => mutateProc<{ success: boolean; messageId?: number; error?: string }>("monitor.sendTestReport"),
    refreshSentinel: async () => {
      const [sentinelR, latencyR] = await Promise.allSettled([
        fetchProc<SentinelData>("wpSentinel.getV6Data"),
        fetchProc<LatencyPoint[]>("wpSentinel.getLatencyTimeline"),
      ]);
      if (!isMounted.current) return;
      setData(prev => ({
        ...prev,
        sentinel: sentinelR.status === "fulfilled" ? sentinelR.value : prev.sentinel,
        latencyTimeline: latencyR.status === "fulfilled" ? (latencyR.value ?? []) : prev.latencyTimeline,
      }));
    },
    refresh,
  };

  return { data, loading, refreshing, lastUpdated, actions };
}
