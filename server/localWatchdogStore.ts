import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { CacheDiagnosticInput } from "./db";
import type { InsertAlertLog, InsertMonitorCheck } from "../drizzle/schema";

type StoredDate = string | Date | null | undefined;

export type LocalMonitorCheck = Required<Pick<InsertMonitorCheck, "httpCode" | "ttfbMs" | "isUp">> & {
  id: number;
  cacheStatus: string | null;
  cfRay: string | null;
  createdAt: Date;
};

export type LocalAlertLog = Required<Pick<InsertAlertLog, "alertType" | "message">> & {
  id: number;
  autoFixApplied: boolean | null;
  httpCode: number | null;
  ttfbMs: number | null;
  resolved: boolean | null;
  pendingPurge: boolean | null;
  createdAt: Date;
};

export type LocalBrokenLink = {
  id: number;
  url: string;
  hits: number;
  isCritical: boolean;
  isFixed: boolean;
  lastSeen: Date;
  firstSeen: Date;
};

export type LocalCacheDiagnostic = CacheDiagnosticInput & {
  id: number;
  checkedAt: Date;
};

type JsonMonitorCheck = Omit<LocalMonitorCheck, "createdAt"> & { createdAt: string };
type JsonAlertLog = Omit<LocalAlertLog, "createdAt"> & { createdAt: string };
type JsonBrokenLink = Omit<LocalBrokenLink, "lastSeen" | "firstSeen"> & { lastSeen: string; firstSeen: string };
type JsonCacheDiagnostic = Omit<LocalCacheDiagnostic, "checkedAt"> & { checkedAt: string };

type WatchdogStoreFile = {
  monitorChecks: JsonMonitorCheck[];
  alerts: JsonAlertLog[];
  brokenLinks: JsonBrokenLink[];
  cacheDiagnostics: JsonCacheDiagnostic[];
};

const emptyStore = (): WatchdogStoreFile => ({
  monitorChecks: [],
  alerts: [],
  brokenLinks: [],
  cacheDiagnostics: [],
});

const toDate = (value: StoredDate): Date => {
  if (value instanceof Date) return value;
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getStorePathCandidates = () => {
  const configured = process.env.NCR_WATCHDOG_STORE_PATH;
  return [
    ...(configured ? [configured] : []),
    path.join(process.cwd(), ".data", "ncr-watchdog-store.json"),
    path.join(os.tmpdir(), "ncr-watchdog-store.json"),
  ];
};

let activeStorePath: string | null = null;
let writeChain = Promise.resolve();

const normalizeStore = (raw: Partial<WatchdogStoreFile> | null | undefined): WatchdogStoreFile => ({
  monitorChecks: Array.isArray(raw?.monitorChecks) ? raw!.monitorChecks : [],
  alerts: Array.isArray(raw?.alerts) ? raw!.alerts : [],
  brokenLinks: Array.isArray(raw?.brokenLinks) ? raw!.brokenLinks : [],
  cacheDiagnostics: Array.isArray(raw?.cacheDiagnostics) ? raw!.cacheDiagnostics : [],
});

const readStoreFromPath = async (storePath: string): Promise<WatchdogStoreFile> => {
  try {
    const text = await readFile(storePath, "utf8");
    return normalizeStore(JSON.parse(text) as Partial<WatchdogStoreFile>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    console.warn("[watchdog-store] failed to read local JSON store", { storePath, error });
    return emptyStore();
  }
};

const resolveReadableStore = async () => {
  const candidates = activeStorePath ? [activeStorePath, ...getStorePathCandidates().filter(p => p !== activeStorePath)] : getStorePathCandidates();
  for (const candidate of candidates) {
    const store = await readStoreFromPath(candidate);
    activeStorePath = candidate;
    return { storePath: candidate, store };
  }
  const fallback = path.join(os.tmpdir(), "ncr-watchdog-store.json");
  activeStorePath = fallback;
  return { storePath: fallback, store: emptyStore() };
};

const writeStore = async (store: WatchdogStoreFile): Promise<void> => {
  const candidates = activeStorePath ? [activeStorePath, ...getStorePathCandidates().filter(p => p !== activeStorePath)] : getStorePathCandidates();
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      await mkdir(path.dirname(candidate), { recursive: true });
      const tmpPath = `${candidate}.${process.pid}.tmp`;
      await writeFile(tmpPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      await rename(tmpPath, candidate);
      activeStorePath = candidate;
      return;
    } catch (error) {
      lastError = error;
      console.warn("[watchdog-store] failed to write local JSON store; trying next path", { storePath: candidate, error });
    }
  }
  console.warn("[watchdog-store] all local JSON store writes failed", lastError);
};

const updateStore = async (mutator: (store: WatchdogStoreFile) => void): Promise<void> => {
  writeChain = writeChain.then(async () => {
    const { store } = await resolveReadableStore();
    mutator(store);
    await writeStore(store);
  });
  return writeChain;
};

const nextId = (items: Array<{ id: number }>) => Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;

export async function saveLocalMonitorCheck(check: InsertMonitorCheck): Promise<void> {
  await updateStore((store) => {
    store.monitorChecks.unshift({
      id: nextId(store.monitorChecks),
      httpCode: Number(check.httpCode ?? 0),
      ttfbMs: Number(check.ttfbMs ?? 0),
      cacheStatus: check.cacheStatus ?? "UNKNOWN",
      cfRay: check.cfRay ?? "",
      isUp: Boolean(check.isUp),
      createdAt: toDate(check.createdAt).toISOString(),
    });
    store.monitorChecks = store.monitorChecks.slice(0, 100);
  });
}

export async function getLocalRecentChecks(limit = 100): Promise<LocalMonitorCheck[]> {
  const { store } = await resolveReadableStore();
  return store.monitorChecks.slice(0, limit).map((row) => ({ ...row, createdAt: toDate(row.createdAt) }));
}

export async function getLocalUptimePercent(): Promise<number> {
  const checks = await getLocalRecentChecks(100);
  if (checks.length === 0) return 100;
  return (checks.filter((check) => check.isUp).length / checks.length) * 100;
}

export async function getLocalAvgTtfb(): Promise<number> {
  const checks = await getLocalRecentChecks(20);
  if (checks.length === 0) return 0;
  return Math.round(checks.reduce((sum, check) => sum + Number(check.ttfbMs || 0), 0) / checks.length);
}

export async function saveLocalAlert(alert: InsertAlertLog): Promise<void> {
  await updateStore((store) => {
    store.alerts.unshift({
      id: nextId(store.alerts),
      alertType: alert.alertType,
      message: alert.message,
      autoFixApplied: alert.autoFixApplied ?? false,
      httpCode: alert.httpCode ?? null,
      ttfbMs: alert.ttfbMs ?? null,
      resolved: alert.resolved ?? false,
      pendingPurge: alert.pendingPurge ?? false,
      createdAt: toDate(alert.createdAt).toISOString(),
    });
    store.alerts = store.alerts.slice(0, 100);
  });
}

export async function getLocalRecentAlerts(limit = 20): Promise<LocalAlertLog[]> {
  const { store } = await resolveReadableStore();
  return store.alerts.slice(0, limit).map((row) => ({ ...row, createdAt: toDate(row.createdAt) }));
}

export async function resolveLocalAlertPurge(id: number): Promise<void> {
  await updateStore((store) => {
    store.alerts = store.alerts.map((alert) => alert.id === id ? { ...alert, pendingPurge: false, autoFixApplied: true, resolved: true } : alert);
  });
}

export async function upsertLocalBrokenLinks(entries: Array<{ url: string; hits: number }>, isCritical: (url: string) => boolean): Promise<void> {
  if (entries.length === 0) return;
  await updateStore((store) => {
    const now = new Date().toISOString();
    for (const entry of entries) {
      const existing = store.brokenLinks.find((row) => row.url === entry.url);
      if (existing) {
        existing.hits += Number(entry.hits || 0);
        existing.isCritical = isCritical(entry.url);
        existing.isFixed = false;
        existing.lastSeen = now;
      } else {
        store.brokenLinks.push({
          id: nextId(store.brokenLinks),
          url: entry.url,
          hits: Number(entry.hits || 0),
          isCritical: isCritical(entry.url),
          isFixed: false,
          lastSeen: now,
          firstSeen: now,
        });
      }
    }
    store.brokenLinks = store.brokenLinks.sort((a, b) => b.hits - a.hits).slice(0, 100);
  });
}

export async function getLocalTopBrokenLinks(limit = 20): Promise<LocalBrokenLink[]> {
  const { store } = await resolveReadableStore();
  return store.brokenLinks
    .filter((row) => !row.isFixed)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((row) => ({ ...row, firstSeen: toDate(row.firstSeen), lastSeen: toDate(row.lastSeen) }));
}

export async function markLocalBrokenLinkFixed(id: number): Promise<void> {
  await updateStore((store) => {
    store.brokenLinks = store.brokenLinks.map((row) => row.id === id ? { ...row, isFixed: true } : row);
  });
}

export async function getLocalActiveBrokenLinksCount(): Promise<number> {
  const { store } = await resolveReadableStore();
  return store.brokenLinks.filter((row) => !row.isFixed).length;
}

export async function getLocalCriticalBrokenLinks(): Promise<LocalBrokenLink[]> {
  const links = await getLocalTopBrokenLinks(100);
  return links.filter((row) => row.isCritical);
}

export async function saveLocalCacheDiagnostic(data: CacheDiagnosticInput): Promise<void> {
  await updateStore((store) => {
    store.cacheDiagnostics.unshift({
      id: nextId(store.cacheDiagnostics),
      ...data,
      checkedAt: new Date().toISOString(),
    });
    store.cacheDiagnostics = store.cacheDiagnostics.slice(0, 50);
  });
}

export async function getLocalRecentCacheDiagnostics(limit = 20): Promise<LocalCacheDiagnostic[]> {
  const { store } = await resolveReadableStore();
  return store.cacheDiagnostics.slice(0, limit).map((row) => ({ ...row, checkedAt: toDate(row.checkedAt) }));
}

export async function getLocalLatestCacheDiagnostic(): Promise<LocalCacheDiagnostic | null> {
  const diagnostics = await getLocalRecentCacheDiagnostics(1);
  return diagnostics[0] ?? null;
}
