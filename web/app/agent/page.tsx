import Nav from "@/components/Nav";
import BackButton from "@/components/BackButton";
import AgentLog from "@/components/AgentLog";
import { getAgentLog, getAgentStats, AGENT_URL, getStats, yoctoToNear } from "@/lib/ach";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const [log, agentStats, stats] = await Promise.all([
    getAgentLog().catch(() => []),
    getAgentStats().catch(() => null),
    getStats().catch(() => null),
  ]);

  const uptime = agentStats ? Math.floor(agentStats.uptimeMs / 1000) : null;
  const uptimeLabel = uptime !== null
    ? uptime >= 3600
      ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
      : `${Math.floor(uptime / 60)}m ${uptime % 60}s`
    : "—";

  return (
    <main className="grid-bg relative flex min-h-screen flex-col bg-cream">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-radial-glow" />
      <Nav />
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:py-8">
        <div className="mb-4">
          <BackButton />
        </div>
        <div className="mb-6">
          <div className="kicker">the agent</div>
            <h1 className="mt-2 text-2xl font-semibold text-ink-950">The clearing agent</h1>
          <p className="mt-1 text-sm text-slate-500">
            ACH is not a dashboard — it is an operator. These are its results, its policy, and the audit trail behind every decision.
          </p>
        </div>

        {/* OUTCOME METRICS — the headline layer */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass window-card-sm px-4 py-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">rounds settled</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-ink-950">
              {agentStats?.roundsSettled ?? stats?.settlementCount ?? "—"}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">autonomous clear() calls</div>
          </div>
          <div className="glass window-card-sm px-4 py-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">gross volume compressed</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-ink-950">
              {agentStats ? `${yoctoToNear(agentStats.grossSettled).toFixed(2)} Ⓝ` : "—"}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">moved as {agentStats ? yoctoToNear(agentStats.netSettled).toFixed(2) : "—"} Ⓝ net</div>
          </div>
          <div className="glass window-card-sm px-4 py-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">liquidity saved</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-brand-700">
              {agentStats ? `${agentStats.compressionSaved}%` : "—"}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">vs. paying every obligation gross</div>
          </div>
          <div className="glass window-card-sm px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="pulse-dot h-2 w-2 rounded-full bg-brand-600" />
              <span className="text-[11px] uppercase tracking-widest text-slate-500">agent status</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold text-ink-950">watching</div>
            <div className="mt-1 text-[11px] text-slate-500">up {uptimeLabel}</div>
          </div>
        </div>

        {/* POLICY + HOW IT DECIDES — one cohesive block */}
        <div className="mt-6 window-card bg-white p-6 shadow-card sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <div className="kicker">policy</div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">min compression</span>
                  <span className="font-mono text-sm font-semibold text-ink-900">10%</span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">cadence</span>
                  <span className="font-mono text-sm font-semibold text-ink-900">every 8s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">contract</span>
                  <span className="truncate pl-3 font-mono text-xs text-ink-900">ach-clearing-v2.testnet</span>
                </div>
              </div>
            </div>
            <div className="border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="kicker">how it decides</div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Every poll, the agent reads open obligations and computes the minimal settlement. If netting
                would cut volume by more than its policy threshold and every net payer is funded, it settles the
                round in one atomic transaction. It logs every observation, proposal, and settlement — a complete
                audit trail of the agent economy's back office.
              </p>
            </div>
          </div>
        </div>

        {/* AUDIT TRAIL — the reasoning log, grows to fill the page */}
        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          <AgentLog initialLog={log} agentUrl={AGENT_URL} grow />
        </div>

        {/* FOOTER — divider, GitHub, description */}
        <div className="mt-8 border-t border-line pt-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                ACH · autonomous clearing house
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                The clearing house for the agent economy — nets agent-to-agent obligations
                multilaterally and settles the whole circle atomically on NEAR.
              </p>
            </div>
            <a
              href="https://github.com/NSEVEjk0/ach"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 font-mono text-xs text-ink-900 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              github.com/NSEVEjk0/ach
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
