"use client";

import { useEffect, useState } from "react";
import { yoctoToNear } from "@/lib/ach";

interface Bill {
  id: string;
  debtor: string;
  creditor: string;
  amount: number;
  memo: string;
}

interface Step {
  kind: string;
  detail: any;
}

interface DemoResult {
  ok?: boolean;
  scenario?: string;
  bills?: Bill[];
  steps?: Step[];
  grossVolume?: string;
  netVolume?: string;
  compression?: number;
  cleared?: { roundId?: string; transfers?: any[] } | null;
  note?: string;
  error?: string;
  simulated?: boolean;
}

type Phase = "idle" | "running" | "done";


const name = (id: string) => id.split(".")[0];

const STEP_COPY: Record<Step["kind"], { label: string; icon: string; color: string }> = {
  observe: { label: "Observing", icon: "👀", color: "#64748b" },
  propose: { label: "Computing net positions", icon: "🧮", color: "#b45309" },
  funding: { label: "Checking funding", icon: "💰", color: "#6b452e" },
  settle: { label: "Settling atomically", icon: "⚡", color: "#1b5e20" },
  defer: { label: "Holding scheduled obligation", icon: "⏳", color: "#6b5d4f" },
};

export default function AgentDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");
  const [visibleSteps, setVisibleSteps] = useState(0);

  async function run() {
    setPhase("running");
    setError("");
    setResult(null);
    setVisibleSteps(0);
    try {
      const res = await fetch("/api/agent-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("demo failed");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "demo failed");
      setResult(data);
      setPhase("done");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("idle");
    }
  }

  // Reveal steps one by one after the result arrives.
  useEffect(() => {
    if (phase !== "done" || !result?.steps?.length) return;
    setVisibleSteps(0);
    const iv = setInterval(() => {
      setVisibleSteps((n) => {
        if (n >= result.steps!.length) {
          clearInterval(iv);
          return n;
        }
        return n + 1;
      });
    }, 900);
    return () => clearInterval(iv);
  }, [phase, result]);

  const bills = result?.bills ?? [];
  const steps = result?.steps ?? [];

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-mono text-[11px] uppercase tracking-widest text-brand-700">live demo</div>
            {result?.simulated && (
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[10px] text-brand-700">
                simulated
              </span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-ink-950">
            {result?.scenario ?? "The DAO month-end"}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            Four contributors traded services for a month. Watch the agent observe the web,
            net it down, and settle atomically — and decide what to hold.
          </p>
        </div>
        <button
          onClick={run}
          disabled={phase === "running"}
          className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-900 disabled:opacity-50"
        >
          {phase === "running" ? "Agent working…" : phase === "done" ? "Replay" : "Run demo"}
        </button>
      </div>

      {phase === "running" && !result && (
        <div className="mt-5 rounded-xl border border-line bg-cream-dim p-6 text-center text-sm text-slate-500">
          <span className="pulse-dot mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" />
          Agents are delivering services and billing each other…
        </div>
      )}

      {phase === "idle" && !result && !error && (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-cream-dim p-6 text-center font-mono text-xs text-slate-500">
          the agent will bill six services, net the web, and settle atomically on NEAR
        </div>
      )}

      {phase === "idle" && error && (
        <div className="mt-5 rounded-xl border border-line bg-cream-dim p-5 text-center">
          <div className="text-sm text-slate-600">The agent didn't respond — try again in a moment.</div>
          <button
            onClick={run}
            className="mt-3 rounded-lg border border-line bg-white px-4 py-2 font-mono text-xs text-ink-900 transition hover:bg-brand-50"
          >
            Retry
          </button>
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-5 space-y-5">
          {/* The bills (the mess) */}
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">
              {bills.length} services delivered · billed on-chain
            </div>
            <div className="space-y-1.5">
              {bills.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-line/70 bg-cream-dim px-3 py-2 font-mono text-xs">
                  <span className="text-slate-600">
                    {name(b.debtor)} → {name(b.creditor)} · {b.memo}
                  </span>
                  <span className="font-semibold text-ink-900">{b.amount.toFixed(3)} Ⓝ</span>
                </div>
              ))}
            </div>
          </div>

          {/* The agent's reasoning timeline */}
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">the agent's reasoning</div>
            <div className="space-y-2">
              {steps.slice(0, visibleSteps).map((s, i) => {
                const c = STEP_COPY[s.kind];
                return (
                  <div key={i} className="fade-up rounded-lg border border-line/70 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{c.icon}</span>
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.color }}>
                        {c.label}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-slate-400">step {i + 1}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs leading-5 text-slate-600">
                      {s.kind === "observe" && s.detail}
                      {s.kind === "propose" && (
                        <>
                          {s.detail.gross.toFixed(3)} Ⓝ gross → {s.detail.net.toFixed(3)} Ⓝ net ·{" "}
                          <span className="font-semibold text-brand-700">−{s.detail.compression}% volume</span> ·{" "}
                          {s.detail.transfers} transfers
                        </>
                      )}
                      {s.kind === "funding" && s.detail}
                      {s.kind === "settle" && (
                        <>
                          {s.detail.roundId} · {s.detail.transfers} transfers ·{" "}
                          <span className="font-semibold text-brand-700">−{s.detail.compression}% volume</span>
                        </>
                      )}
                      {s.kind === "defer" && s.detail}
                    </div>
                  </div>
                );
              })}
              {visibleSteps < steps.length && (
                <div className="rounded-lg border border-dashed border-line px-3 py-2 text-center font-mono text-[11px] text-slate-400">
                  …
                </div>
              )}
            </div>
          </div>

          {/* Outcome headline */}
          {result.cleared && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-600">
                  <span className="font-mono font-semibold text-ink-950">{bills.length}</span> services →{" "}
                  <span className="font-mono font-semibold text-brand-700">{result.cleared.transfers?.length}</span> transfers
                </span>
                <span className="font-mono text-brand-700">→</span>
                <span className="text-slate-600">
                  <span className="font-mono font-semibold text-ink-950">
                    {yoctoToNear(result.grossVolume ?? "0").toFixed(3)}
                  </span>{" "}
                  Ⓝ gross →{" "}
                  <span className="font-mono font-semibold text-brand-700">
                    {yoctoToNear(result.netVolume ?? "0").toFixed(3)}
                  </span>{" "}
                  Ⓝ net
                </span>
                <span className="rounded-full bg-brand-700 px-2.5 py-1 text-[11px] font-semibold text-white">
                  −{((1 - (result.compression ?? 0)) * 100).toFixed(0)}% volume
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "idle" && (
        <p className="muted mt-4 text-sm text-slate-500">
          Press “Replay” to run the guided scenario.
        </p>
      )}
    </div>
  );
}
