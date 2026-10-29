import Nav from "@/components/Nav";
import BackButton from "@/components/BackButton";
import ExportCsv from "@/components/ExportCsv";
import SettlementRounds from "@/components/SettlementRounds";
import {
  getParticipants,
  getSettlements,
  getStats,
  getRisk,
  getCollateralRatio,
  yoctoToNear,
} from "@/lib/ach";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let participants: Awaited<ReturnType<typeof getParticipants>> = [];
  let settlements: Awaited<ReturnType<typeof getSettlements>> = [];
  let stats: Awaited<ReturnType<typeof getStats>> | null = null;
  let risk: Awaited<ReturnType<typeof getRisk>> = [];
  let collateralRatio = 1;
  let error = "";

  try {
    [participants, settlements, stats, risk, collateralRatio] = await Promise.all([
      getParticipants(),
      getSettlements(20),
      getStats(),
      getRisk().catch(() => []),
      getCollateralRatio().catch(() => 1),
    ]);
  } catch (e) {
    error = String(e instanceof Error ? e.message : e);
  }

  return (
    <main className="grid-bg relative min-h-screen bg-cream">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-radial-glow" />
      <Nav />
      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-4">
          <BackButton />
        </div>
        <div className="kicker">dashboard</div>
            <h1 className="mt-2 text-2xl font-semibold text-ink-950">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">On-chain state of the clearing house.</p>

        <div className="mt-4">
          <ExportCsv />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Could not reach the contract: {error}
          </div>
        )}

        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "participants", value: String(stats.participantCount) },
              { label: "obligations", value: String(stats.obligationCount) },
              { label: "open", value: String(stats.openObligations) },
              { label: "settled volume", value: `${yoctoToNear(stats.totalSettledVolume).toFixed(2)} Ⓝ` },
            ].map((s) => (
              <div key={s.label} className="glass window-card-sm px-4 py-3.5">
                <div className="font-mono text-xl font-semibold text-ink-950">{s.value}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-widest text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* RISK PANEL — exposures, credit limits, collateral coverage */}
        {risk.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
                risk & exposure
              </h2>
              <span className="font-mono text-[11px] text-slate-500">
                collateral ratio <span className="font-semibold text-brand-700">×{collateralRatio}</span>
              </span>
            </div>
            <div className="overflow-x-auto window-card-sm bg-white shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-cream-dim text-left font-mono text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-2.5 font-medium">participant</th>
                    <th className="px-4 py-2.5 text-right font-medium">balance</th>
                    <th className="px-4 py-2.5 text-right font-medium">gross payable</th>
                    <th className="px-4 py-2.5 text-right font-medium">gross receivable</th>
                    <th className="px-4 py-2.5 text-right font-medium">net position</th>
                    <th className="px-4 py-2.5 text-right font-medium">credit limit</th>
                    <th className="px-4 py-2.5 text-right font-medium">collateral req.</th>
                    <th className="px-4 py-2.5 text-right font-medium">status</th>
                  </tr>
                </thead>
                <tbody>
                  {risk.map((r) => {
                    const net = Number(r.netPosition);
                    const limit = Number(r.creditLimit);
                    return (
                      <tr key={r.accountId} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink-950">{r.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{r.accountId}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                          {yoctoToNear(r.balance).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-rose-600">
                          {yoctoToNear(r.grossPayable).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-brand-700">
                          {yoctoToNear(r.grossReceivable).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                          {net < 0 ? "−" : "+"}
                          {Math.abs(yoctoToNear(r.netPosition)).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                          {limit > 0 ? yoctoToNear(r.creditLimit).toFixed(4) : "∞"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                          {yoctoToNear(r.collateralRequired).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              r.covered ? "bg-brand-50 text-brand-700" : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${r.covered ? "bg-brand-700" : "bg-rose-500"}`} />
                            {r.covered ? "covered" : "undercollateralized"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* participants */}
          <div>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-slate-500">participants</h2>
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
              <table className="w-full text-sm">
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.accountId} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-base">
                            {p.icon}
                          </span>
                          <div>
                            <div className="font-medium text-ink-950">{p.name}</div>
                            <div className="font-mono text-[11px] text-slate-500">{p.accountId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="rounded-full border border-line bg-cream-dim px-2 py-0.5 text-[11px] text-slate-600">
                          {p.kind}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {participants.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-slate-500">No participants yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* settlements */}
          <div>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-slate-500">
              settlement rounds ({settlements.length}) · click to expand
            </h2>
            <SettlementRounds settlements={settlements} />
          </div>
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
