if (proc.includes("monitor.history")) {
  const backendOrigin = env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try {
    const r = await fetch(`${backendOrigin}/api/public/history`);
    return r.ok ? await r.json() : [];
  } catch { return []; }
}
if (proc.includes("monitor.alerts")) {
  const backendOrigin = env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try {
    const r = await fetch(`${backendOrigin}/api/public/alerts`);
    return r.ok ? await r.json() : [];
  } catch { return []; }
}
