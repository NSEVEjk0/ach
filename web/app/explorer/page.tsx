import Nav from "@/components/Nav";
import BackButton from "@/components/BackButton";
import ExplorerDemo from "@/components/ExplorerDemo";
import ManualNetting from "@/components/ManualNetting";
import { getParticipants, getObligations, getNet, yoctoToNear } from "@/lib/ach";

export const dynamic = "force-dynamic";

export default async function Explorer() {
  let participants: Awaited<ReturnType<typeof getParticipants>> = [];
  let obligations: Awaited<ReturnType<typeof getObligations>> = [];
  let net: Awaited<ReturnType<typeof getNet>> | null = null;
  let error = "";

  try {
    [participants, obligations, net] = await Promise.all([
      getParticipants(),
      getObligations({ limit: 200 }),
      getNet(),
    ]);
  } catch (e) {
    error = String(e instanceof Error ? e.message : e);
  }

  const open = obligations.filter((o) => o.status === "open");
  const now = Date.now();
  const queued = open.filter((o) => o.dueAt !== null && o.dueAt > now);

  return (
    <main className="grid-bg relative min-h-screen bg-cream">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-radial-glow" />
      <Nav />
      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-4">
          <BackButton />
        </div>
        <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="kicker">explorer</div>
            <h1 className="mt-2 text-2xl font-semibold text-ink-950">Clearing explorer</h1>
            <p className="mt-1 text-sm text-slate-500">
              Live view of the obligation web and what ACH nets it down to.
            </p>
          </div>
          {net && open.length > 0 && BigInt(net.grossVolume) > 0n && (
            <div className="text-right">
              <div className="font-mono text-lg font-semibold text-brand-700">
                {yoctoToNear(net.grossVolume).toFixed(3)} → {yoctoToNear(net.netVolume).toFixed(3)} Ⓝ
              </div>
              <div className="font-mono text-xs text-slate-500">
                {net.obligationCount} clearable → {net.transfers.length} transfers ·{" "}
                {((1 - net.compression) * 100).toFixed(1)}% of gross saved
              </div>
            </div>
          )}
          {net && open.length > 0 && BigInt(net.grossVolume) === 0n && (
            <div className="text-right">
              <div className="font-mono text-sm text-slate-500">
                {open.length} open · none clearable yet
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Could not reach the contract: {error}
          </div>
        )}

        {participants.length === 0 && !error && (
          <div className="window-card bg-white p-6 text-center text-sm text-slate-500 shadow-card sm:p-10">
            No participants on-chain yet — the demo agents haven't joined.
          </div>
        )}

        {/* manual netting — the interactive engine */}
        <div className="mt-6">
          <ManualNetting />
        </div>

        <div className="mt-6">
          <ExplorerDemo />
        </div>

        {/* obligations table */}
        {open.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-slate-500">
              open obligations ({open.length})
              {queued.length > 0 && (
                <span className="ml-2 text-brand-700">· {queued.length} scheduled</span>
              )}
            </h2>
            <div className="overflow-x-auto window-card-sm bg-white shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-cream-dim text-left font-mono text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-2.5 font-medium">id</th>
                    <th className="px-4 py-2.5 font-medium">payer</th>
                    <th className="px-4 py-2.5 font-medium">payee</th>
                    <th className="px-4 py-2.5 font-medium">amount</th>
                    <th className="px-4 py-2.5 font-medium">memo</th>
                    <th className="px-4 py-2.5 font-medium">due</th>
                    <th className="px-4 py-2.5 font-medium">status</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((o) => {
                    const scheduled = o.dueAt !== null && o.dueAt > now;
                    return (
                      <tr key={o.id} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{o.id}</td>
                        <td className="px-4 py-2.5 text-ink-900">{o.debtor.split(".")[0]}</td>
                        <td className="px-4 py-2.5 text-ink-900">{o.creditor.split(".")[0]}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                          {yoctoToNear(o.amount).toFixed(4)} Ⓝ
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{o.memo}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                          {o.dueAt !== null ? new Date(o.dueAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {scheduled ? (
                            <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-medium text-brand-700">
                              scheduled
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-700">
                              {o.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
