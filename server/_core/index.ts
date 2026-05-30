import { handleWpWatchdog } from "../wpWatchdog";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import {
  handleMonitorCheck,
  handleDailyMorning,
  handleDailyEvening,
  handleWeeklyReport,
  handleMonthlyReport,
  handleCFSnapshot,
  handleMorningBrief,
  handleExecutiveBrief,
  handleKeepalive,
  handleWeeklyQualityAudit,
  handleFBCommentModeration,
  handleFBViralScout,
  handleFBAdGovernance,
  handleFBEthicalResponder,
  handleViralPostGenerator,
  handlePublicMoodScanner,
  handle404SpikeDetection,
  handleCacheEfficiencyAudit,
  handleFBTrafficValidation,
  handleCacheWarmup,
  } from "../heartbeatHandlers";
import { handleWpWatchdog } from "../wpWatchdog";  // ← ถูกต้อง
import { handleWpPublish } from "../webhookHandlers";
  handlePageSpeedPayloadAlert,
} from "../heartbeatHandlers";
import { handleWpPublish } from "../webhookHandlers";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? "")
    .split(",")
    .map(origin => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const allowedOrigins = new Set<string>([
    "https://ncr-watchdog-dashboard.pages.dev",
    "https://29bfa18a.ncr-dashboard.pages.dev",
    "https://ncr-dashboard.pages.dev",
    ...configuredAllowedOrigins,
  ]);

  app.use((req, res, next) => {
    const origin = req.headers.origin?.replace(/\/$/, "");
    const isAllowedOrigin =
      !origin ||
      allowedOrigins.has(origin) ||
      /^https:\/\/[a-z0-9-]+\.ncr-watchdog-dashboard\.pages\.dev$/i.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.ncr-dashboard\.pages\.dev$/i.test(origin);

    if (origin && isAllowedOrigin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, trpc-accept");
    res.header("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.sendStatus(isAllowedOrigin ? 204 : 403);
      return;
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Protocol 3: WordPress publish webhook for cache warming
  app.post("/api/webhook/wp-publish", handleWpPublish);

  // Heartbeat scheduled endpoints — MUST be registered before tRPC fallthrough
  app.post("/api/scheduled/cf-snapshot", handleCFSnapshot);
  app.post("/api/scheduled/morning-brief", handleMorningBrief);
  app.post("/api/scheduled/monitor-check", handleMonitorCheck);
  app.post("/api/scheduled/daily-morning", handleDailyMorning);
  app.post("/api/scheduled/daily-evening", handleDailyEvening);
  app.post("/api/scheduled/weekly-report", handleWeeklyReport);
  app.post("/api/scheduled/monthly-report", handleMonthlyReport);
  app.post("/api/scheduled/executive-brief", handleExecutiveBrief);
  app.post("/api/scheduled/keepalive", handleKeepalive);
  app.post("/api/scheduled/weekly-quality-audit", handleWeeklyQualityAudit);
  // V3.2: Facebook integration
  app.post("/api/scheduled/fb-comment-moderation", handleFBCommentModeration);
  app.post("/api/scheduled/fb-viral-scout", handleFBViralScout);
  app.post("/api/scheduled/fb-ad-governance", handleFBAdGovernance);
  app.post("/api/scheduled/fb-ethical-responder", handleFBEthicalResponder);
  // V4.0: AI Intelligence Modules
  app.post("/api/scheduled/viral-post-generator", handleViralPostGenerator);
  app.post("/api/scheduled/public-mood-scanner", handlePublicMoodScanner);
  // V4.1: Performance Analytics Patch
  app.post("/api/scheduled/404-spike-detection", handle404SpikeDetection);
  app.post("/api/scheduled/cache-efficiency-audit", handleCacheEfficiencyAudit);
  app.post("/api/scheduled/fb-traffic-validation", handleFBTrafficValidation);
  // V5.1: Performance Stabilizer
  app.post("/api/scheduled/wp-watchdog", handleWpWatchdog);
  app.post("/api/scheduled/pagespeed-payload", handlePageSpeedPayloadAlert);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
