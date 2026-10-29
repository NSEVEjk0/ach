import Link from "next/link";
import Nav from "@/components/Nav";
import { getStats, getParticipants, getSettlements, getNet, yoctoToNear } from "@/lib/ach";
import AgentDemo from "@/components/AgentDemo";

export const dynamic = "force-dynamic";

/** Animated hero motif — the obligation web drawing itself in. */
function HeroMotif() {
  const nodes = [
    { x: 120, y: 110, label: "alice", emoji: "🤖" },
    { x: 380, y: 40, label: "bob", emoji: "⚙️" },
    { x: 640, y: 110, label: "carol", emoji: "🎨" },
    { x: 380, y: 200, label: "dave", emoji: "🖥️" },
  ];
  const edges = [
    { x1: 120, y1: 110, x2: 380, y2: 40, amt: "0.02" },
    { x1: 380, y1: 40, x2: 640, y2: 110, amt: "0.015" },
    { x1: 640, y1: 110, x2: 380, y2: 200, amt: "0.01" },
    { x1: 380, y1: 200, x2: 120, y2: 110, amt: "0.009" },
    { x1: 120, y1: 110, x2: 640, y2: 110, amt: "0.012" },
  ];
  return (
    <svg viewBox="0 0 760 260" className="w-full" aria-hidden="true">
      {edges.map((e, i) => (
        <g key={i}>
          <line
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="#c9a87c" strokeWidth="1.5"
            strokeDasharray="6 5"
            className="edge-anim"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
          <text
            x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 6}
            textAnchor="middle" fontSize="11" fill="#b45309"
            fontFamily="var(--font-geist), monospace"
          >
            {e.amt}
          </text>
        </g>
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="30" fill="#fff" stroke="#83593b" strokeWidth="1.5" />
          <text x={n.x} y={n.y + 6} textAnchor="middle" fontSize="22">{n.emoji}</text>
          <text
            x={n.x} y={n.y + 52} textAnchor="middle" fontSize="11"
            fill="#5c4a3c" fontFamily="var(--font-geist), monospace"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default async function Home() {
  let stats: Awaited<ReturnType<typeof getStats>> | null = null;
  let participants: Awaited<ReturnType<typeof getParticipants>> = [];
  let settlements: Awaited<ReturnType<typeof getSettlements>> = [];
  let net: Awaited<ReturnType<typeof getNet>> | null = null;
  let error = "";

  try {
    [stats, participants, settlements, net] = await Promise.all([
      getStats(),
      getParticipants(),
      getSettlements(5),
      getNet(),
    ]);
  } catch (e) {
    error = String(e instanceof Error ? e.message : e);
  }

  const totalSettled = settlements.reduce((s, r) => s + Number(r.netVolume), 0);
  const totalGross = settlements.reduce((s, r) => s + Number(r.grossVolume), 0);
  const liquiditySaved = Math.max(0, totalGross - totalSettled);

  return (
    <main className="grid-bg relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-radial-glow" />
      <Nav />

      {/* HERO */}
      <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 text-center sm:pt-24 sm:pb-20">
        <div className="hero-in hero-in-1 kicker">The agent economy</div>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-ink-950 sm:text-6xl">
          <span className="hero-in hero-in-2 inline-block">The clearing house</span>
          <br />
          <span className="hero-in hero-in-3 inline-block">
            for{" "}
            <span className="bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
              the agent economy
            </span>
          </span>
        </h1>
        <p className="hero-in hero-in-4 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          The agent economy is coming. Agents will book travel, buy compute, hire freelancers,
          and trade data — billing each other for every service. ACH nets all those debts into
          one atomic settlement, so agents keep their capital working instead of waiting on payments.
        </p>
        <div className="hero-in hero-in-4 mt-8 flex items-center justify-center gap-2.5 sm:gap-3">
          <Link
            href="/explorer"
            className="rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-cream shadow-glow transition hover:bg-brand-800 sm:px-6 sm:py-3"
          >
            Open the explorer
          </Link>
          <Link
            href="/agent"
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition hover:bg-cream-dim sm:px-6 sm:py-3"
          >
            Watch the agent
          </Link>
        </div>

        {/* animated web motif */}
        <div className="hero-in hero-in-4 mx-auto mt-12 max-w-2xl">
          <HeroMotif />
        </div>

        {/* live stats strip */}
        {stats && !error && (
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-2.5 sm:mt-14 sm:grid-cols-4 sm:gap-3">
            {[
              { label: "participants", value: String(stats.participantCount) },
              { label: "obligations cleared", value: String(stats.obligationCount) },
              { label: "settlement rounds", value: String(stats.settlementCount) },
              { label: "liquidity freed", value: `${yoctoToNear(BigInt(Math.round(liquiditySaved))).toFixed(2)} Ⓝ` },
            ].map((s) => (
              <div key={s.label} className="glass window-card-sm px-4 py-3.5 text-left">
                <div className="font-mono text-lg font-semibold text-ink-950 sm:text-xl">{s.value}</div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="reveal window-card bg-white p-6 shadow-card sm:p-8">
            <div className="kicker">the problem</div>
            <h2 className="mt-3 text-2xl font-semibold text-ink-950">Agents owe each other. Grossly.</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              When AI agents do real work, they hire each other: a research agent buys a data feed,
              a scheduling agent pays a booking agent, a coding agent invoices its orchestrator.
              Every delivered service becomes a bill — a small obligation recorded on-chain between
              the two agents. Paid one by one, those micro-payments stretch an agent's capital thin
              — every payment ties up funds in transit, fragments what's left across dozens of
              counterparties, and burns fees at every hop. The more agents trade, the more of their
              capital is stuck in motion instead of doing work. That is not an economy — that is a
              drain.
            </p>
            <div className="hatch mt-6 rounded-xl border border-line bg-cream-dim p-4 font-mono text-xs leading-7 text-slate-600">
              <div>alice → bob: 0.020 Ⓝ <span className="text-slate-500">/* research */</span></div>
              <div>bob → carol: 0.015 Ⓝ <span className="text-slate-500">/* design */</span></div>
              <div>carol → alice: 0.010 Ⓝ <span className="text-slate-500">/* compute */</span></div>
              <div>dave → bob: 0.006 Ⓝ <span className="text-slate-500">/* hosting */</span></div>
              <div>alice → dave: 0.009 Ⓝ <span className="text-slate-500">/* infra */</span></div>
              <div className="mt-2 border-t border-line pt-2 text-slate-500">
                5 transfers · 0.060 Ⓝ gross · everyone still owes
              </div>
            </div>
          </div>

          <div className="reveal-blur window-card border border-brand-200 bg-brand-50/60 p-6 sm:p-8">
            <div className="kicker text-brand-700">the solution</div>
            <h2 className="mt-3 text-2xl font-semibold text-ink-950">ACH nets it. Atomically.</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              ACH uses multilateral compression to net and cancel out overlapping debts — so only
              the actual net moves. Agents stop paying each other gross and start moving a fraction
              of the volume, keeping their capital working instead of stuck in transit.
            </p>

            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-700">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span><span className="font-semibold text-ink-900">Capital stays productive</span> — only net balances move, so agents hold far less idle liquidity.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-700">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span><span className="font-semibold text-ink-900">Fewer transfers, lower fees</span> — 5 payments become 2; network fees and overhead shrink with them.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-700">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span><span className="font-semibold text-ink-900">One atomic round</span> — everyone settles at once; no partial payments, no stranded IOUs, no waiting on counterparties.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-700">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span><span className="font-semibold text-ink-900">Less risk in transit</span> — money is never floating between counterparties; settlement is final the moment it happens.</span>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-brand-200 bg-white p-4 font-mono text-xs leading-7 text-slate-700">
              <div className="text-brand-700">alice → bob: 0.011 Ⓝ</div>
              <div className="text-brand-700">alice → carol: 0.005 Ⓝ</div>
              <div className="text-brand-700">alice → dave: 0.003 Ⓝ</div>
              <div className="mt-2 border-t border-brand-200 pt-2 text-brand-700/80">
                3 transfers · 0.019 Ⓝ net · <span className="font-semibold text-brand-700">−68% volume</span>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-brand-200/60 bg-white/70 p-4 text-[13px] leading-relaxed text-slate-600">
              <span className="font-semibold text-ink-900">The same infrastructure banks rely on.</span>{" "}
              CLS nets FX trades and cuts daily funding needs by 90%+; central counterparties (CCPs)
              net derivatives positions; RTGS systems settle net balances between banks. ACH brings
              that same multilateral compression to the agent economy.
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="text-center">
          <div className="kicker">clearing-house grade</div>
          <h2 className="mt-3 text-2xl font-semibold text-ink-950">The features a settlement system must have</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            ACH is built to the standard of real clearing infrastructures — CLS, CCPs, RTGS systems —
            not a toy ledger. Every control below is enforced on-chain, not promised in a whitepaper.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              t: "Multilateral netting",
              d: "Obligations are compressed into the minimal set of transfers — the same liquidity-savings mechanism CLS uses to cut daily FX funding by 90%+.",
            },
            {
              t: "Atomic finality",
              d: "A settlement round either completes for every participant or reverts for all. No partial settlement, no stranded IOUs, no Herstatt risk.",
            },
            {
              t: "Collateralization",
              d: "Every net debtor must hold balance covering a configurable collateral ratio before any round settles — pre-funding, enforced by the contract.",
            },
            {
              t: "Credit limits",
              d: "Participants can cap their maximum net debit per round. Exposure is computed and checked on-chain before settlement, like a clearing house's limit system.",
            },
            {
              t: "Scheduled settlement",
              d: "Obligations carry due dates and queue until they are ripe — settlement cycles, not fire-and-forget transfers.",
            },
            {
              t: "Dispute isolation",
              d: "A contested obligation freezes in place while the rest of the circle keeps flowing. Resolve to keep or void — the ledger stays honest.",
            },
            {
              t: "Statements & reconciliation",
              d: "Every participant gets a full on-chain statement: balance, open exposure, net position, and settlement history. Books reconcile straight from the chain.",
            },
            {
              t: "Autonomous operation",
              d: "The ACH agent watches the obligation web, detects worthwhile compression, and settles rounds on its own — with a public reasoning log for audit.",
            },
            {
              t: "Verifiable by construction",
              d: "Every round, transfer, and balance lives on NEAR. The certificate is the receipt; the explorer is the back office.",
            },
          ].map((b, i) => (
            <div key={b.t} className="reveal window-card-sm bg-white p-6 shadow-card" style={{ animationDelay: `${(i % 3) * 0.08}s` }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mt-3 text-base font-semibold text-ink-950">{b.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE DEMO */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <AgentDemo />
      </section>

      {/* FOR AGENTS */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="reveal window-card bg-white p-6 shadow-card-lg sm:p-8">
          <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <div className="kicker">for agents</div>
              <h2 className="mt-3 text-2xl font-semibold text-ink-950">Plug your agent in with one call</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Any agent that delivers a service can post the resulting debt to ACH. The obligation
                is recorded on-chain, signed by the debtor, and enters the next clearing round — no
                manual bookkeeping, no integration beyond a single HTTP call.
              </p>
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span><span className="font-semibold text-ink-900">Deliver a service</span> — data, compute, a subtask, an API call.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span><span className="font-semibold text-ink-900">Bill the buyer</span> — sign the obligation on-chain (debtor signs).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span><span className="font-semibold text-ink-900">ACH handles the rest</span> — nets the web, settles atomically, keeps the statement.</span>
                </div>
              </div>
            </div>
            <div>
              <div className="rounded-xl border border-line bg-cream-dim p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">POST /bill</span>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 font-mono text-[10px] font-medium text-brand-700">agent SDK</span>
                </div>
                <pre className="overflow-x-auto font-mono text-xs leading-6 text-slate-700">
{`await ach.bill({
  debtor:  "agent-b.ach.testnet",
  creditor: "agent-a.ach.testnet",
  amount:   "0.02",
  memo:     "data feed — invoice #42",
});`}
                </pre>
                <div className="mt-3 border-t border-line pt-3 font-mono text-[11px] leading-5 text-slate-500">
                  <div>→ obligation recorded on-chain, signed by debtor</div>
                  <div>→ enters the next clearing round automatically</div>
                  <div>→ statement + settlement history queryable</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <h2 className="text-center text-2xl font-semibold text-ink-950">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: "01",
              title: "Agents transact & bill",
              body: "One agent delivers a service — a data feed, a subtask, an API call — and bills the other. The debt is recorded on-chain.",
            },
            {
              n: "02",
              title: "Obligations accrue",
              body: "Every service delivered records an IOU on-chain — debtor, creditor, amount, terms.",
            },
            {
              n: "03",
              title: "ACH nets",
              body: "The clearing agent watches the web, computes net positions, and finds the minimal settlement.",
            },
            {
              n: "04",
              title: "Settlement",
              body: "One atomic round moves only the net balances. Certificates for everyone. Disputes isolated.",
            },
          ].map((s, i) => (
            <div key={s.n} className="reveal window-card-sm bg-white p-6 shadow-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="font-mono text-xs font-semibold text-brand-700">{s.n}</div>
              <h3 className="mt-2 text-base font-semibold text-ink-950">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHY NEAR */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="reveal window-card bg-white p-6 shadow-card sm:p-8">
          <h2 className="text-xl font-semibold text-ink-950">Built on the only chain that fits</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "Sub-accounts", d: "Every agent is a real, named on-chain entity — alice.ach.testnet." },
              { t: "Atomicity by construction", d: "A NEAR contract call either fully settles or fully reverts." },
              { t: "Chain abstraction", d: "Intents + chain signatures let obligations settle across 35+ chains." },
              { t: "Gasless UX", d: "Meta transactions mean agents never touch gas." },
              { t: "Verifiable", d: "Every round is auditable on-chain — the certificate is the receipt." },
              { t: "Policy-ready", d: "Function-call keys cap what any agent may do with money." },
            ].map((f) => (
              <div key={f.t} className="hatch rounded-xl border border-line bg-cream-dim p-4">
                <div className="text-sm font-semibold text-ink-900">{f.t}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-slate-600">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER — divider, GitHub, description */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-10">
        <div className="border-t border-line pt-6">
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
