"use client";

import { useState } from "react";

/**
 * Interactive demo trigger for the Explorer page — the hero "do X → see Y"
 * moment. Injects a realistic circle of agent debts and lets the clearing
 * agent net and settle them atomically on-chain, then shows a big summary
 * card and refreshes to the new state.
 */
export default function ExplorerDemo() {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [summary, setSummary] = useState<{
    roundId: string;
    obligations: number;
    transfers: number;
    compression: number;
    gross: number;
    net: number;
  } | null>(null);
  const [retryMsg, setRetryMsg] = useState("");

  async function run() {
    setPhase("running");
    setSummary(null);
    try {
      const res = await fetch("/api/agent-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "demo failed");
      const cleared = data.cleared;
      const gross = Number(data.grossVolume ?? 0) / 1e24;
      const net = Number(data.netVolume ?? 0) / 1e24;
      const compression = Math.round((data.compression ?? 0) * 1000) / 10;
      setSummary({
        roundId: cleared?.roundId ?? "—",
        obligations: cleared?.obligationCount ?? data.bills?.length ?? 0,
        transfers: cleared?.transfers?.length ?? 0,
        compression,
        gross,
        net,
      });
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      setRetryMsg(String(e instanceof Error ? e.message : e));
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-cream shadow-card">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-brand-700">
              live netting demo
            </div>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Injects a realistic web of agent-to-agent debts, then lets the
              clearing agent net and settle them in one atomic transaction.
            </p>
          </div>
          <button
            onClick={run}
            disabled={phase === "running"}
            className="shrink-0 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 active:scale-[0.98] disabled:opacity-60"
          >
            {phase === "running" ? "Settling…" : "Run Live Netting Demo"}
          </button>
        </div>

        {phase === "running" && (
          <div className="mt-4 flex items-center gap-2.5 text-sm text-slate-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" />
            <span>
              Agent is billing 6 services, computing net positions, and settling on-chain…
              <span className="ml-1 font-mono text-[11px] text-slate-400">takes ~15–20s</span>
            </span>
          </div>
        )}

        {retryMsg && phase === "idle" && (
          <div className="mt-4 rounded-xl border border-line bg-cream-dim p-4 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>The agent didn't respond — try again in a moment.</span>
              <button
                onClick={run}
                className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink-900 transition hover:bg-brand-50"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {summary && phase === "done" && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-brand-700">
                  ✅ Settlement complete
                </div>
                <div className="mt-0.5 text-sm text-slate-500">
                  {summary.roundId} · atomic clear() executed on NEAR testnet
                </div>
              </div>
              <div className="flex items-end gap-6">
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold text-ink-950">
                    {summary.obligations} <span className="text-sm font-medium text-slate-500">→</span> {summary.transfers}
                  </div>
                  <div className="text-[11px] text-slate-500">obligations → transfers</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold text-brand-700">
                    {summary.compression}%
                  </div>
                  <div className="text-[11px] text-slate-500">compression</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold text-ink-950">
                    {summary.net.toFixed(3)} <span className="text-sm font-medium text-slate-500">Ⓝ</span>
                  </div>
                  <div className="text-[11px] text-slate-500">liquidity freed</div>
                </div>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-700 transition-all duration-1000"
                style={{ width: `${Math.min(100, summary.compression)}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[11px] text-slate-500">
              {summary.gross.toFixed(3)} Ⓝ gross → {summary.net.toFixed(3)} Ⓝ net · refreshing…
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
