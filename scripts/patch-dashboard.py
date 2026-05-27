#!/usr/bin/env python3
with open('/home/ubuntu/ncr-watchdog/client/src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '        {/* ─── WP Sentinel V6.0 — Autonomous Infrastructure ──────────────── */'
end_marker = '        {/* ─── TTFB History Chart'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

new_section = '''        {/* ─── WP Sentinel V6.0 — Autonomous Infrastructure ──────────────── */}
        <section>
          <SectionHeader icon={Cpu} title="WP Sentinel V6.0" sub="Autonomous Infrastructure — nakornchiangrainews.com" />
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
              const displayMode = mode ?? "Cloud Managed";
              const isNight = displayMode.toLowerCase().includes("night");
              const isPrime = displayMode.toLowerCase().includes("prime");
              const isCloud = displayMode === "Cloud Managed";
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
                  <div className="text-xs opacity-55">
                    {isCloud ? "Autonomous — no data required" : "Current mode based on Server Time"}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
        '''

new_content = content[:start_idx] + new_section + content[end_idx:]

with open('/home/ubuntu/ncr-watchdog/client/src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done — section replaced successfully")
