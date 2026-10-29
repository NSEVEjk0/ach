"use client";

import { useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* Netting engine (mirror of the on-chain algorithm)                    */
/* ------------------------------------------------------------------ */

interface ObligationInput {
  id: string;
  payer: string;
  payee: string;
  amount: number; // NEAR
  memo: string;
}

interface Transfer {
  from: string;
  to: string;
  amount: number;
}

function computeNetPositions(obligations: ObligationInput[]): Map<string, number> {
  const nets = new Map<string, number>();
  for (const o of obligations) {
    if (o.payer === o.payee) continue;
    nets.set(o.payer, (nets.get(o.payer) ?? 0) - o.amount);
    nets.set(o.payee, (nets.get(o.payee) ?? 0) + o.amount);
  }
  return new Map([...nets.entries()].filter(([, n]) => Math.abs(n) > 1e-12));
}

function minimizeTransfers(positions: Map<string, number>): Transfer[] {
  const debtors = [...positions.entries()]
    .filter(([, n]) => n < 0)
    .map(([accountId, net]) => ({ accountId, remaining: -net }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = [...positions.entries()]
    .filter(([, n]) => n > 0)
    .map(([accountId, net]) => ({ accountId, remaining: net }))
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.remaining, creditor.remaining);
    transfers.push({ from: debtor.accountId, to: creditor.accountId, amount });
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining < 1e-12) i++;
    if (creditor.remaining < 1e-12) j++;
  }
  return transfers;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const fmt = (n: number) => n.toFixed(3);

/* ------------------------------------------------------------------ */
/* Web graph — dynamic circles per participant, edges per obligation    */
/* ------------------------------------------------------------------ */

function WebGraph({
  participants,
  obligations,
  netTransfers,
  ran,
}: {
  participants: string[];
  obligations: ObligationInput[];
  netTransfers: Transfer[];
  ran: boolean;
}) {
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const N = Math.max(participants.length, 1);
  const cx = 400;
  const cy = 240;
  const rx = Math.min(340, 120 + N * 22);
  const ry = Math.min(190, 90 + N * 14);

  const pos = (i: number) => {
    const angle = (2 * Math.PI * i) / N - Math.PI / 2;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  };
  const idxOf = (name: string) => {
    const i = participants.indexOf(name);
    return i === -1 ? 0 : i;
  };

  // curved edge path between two nodes
  const edgePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ox = (-dy / len) * 28;
    const oy = (dx / len) * 28;
    return `M ${a.x} ${a.y} Q ${mx + ox} ${my + oy} ${b.x} ${b.y}`;
  };

  const showNet = ran && mode === "net";

  return (
    <div className="mt-5 rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {showNet ? "net result — only what actually moves" : "obligation web — gross"}
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-cream-dim p-0.5">
          <button
            onClick={() => setMode("gross")}
            className={`rounded-md px-3 py-1 font-mono text-[11px] transition ${
              mode === "gross" ? "bg-white text-ink-950 shadow-sm" : "text-slate-500 hover:text-ink-950"
            }`}
          >
            gross
          </button>
          <button
            onClick={() => setMode("net")}
            className={`rounded-md px-3 py-1 font-mono text-[11px] transition ${
              mode === "net" ? "bg-white text-ink-950 shadow-sm" : "text-slate-500 hover:text-ink-950"
            }`}
          >
            net
          </button>
        </div>
      </div>

      <svg viewBox="0 0 800 480" className="w-full">
        {/* edges */}
        {!showNet &&
          obligations.map((o, i) => {
            const a = pos(idxOf(o.payer));
            const b = pos(idxOf(o.payee));
            return (
              <g key={o.id}>
                <path
                  d={edgePath(a, b)}
                  fill="none"
                  stroke="#c9a87c"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                  className="edge-anim"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 8}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#b45309"
                  fontFamily="var(--font-geist), monospace"
                >
                  {fmt(o.amount)}
                </text>
              </g>
            );
          })}

        {/* net transfers */}
        {showNet &&
          netTransfers.map((t, i) => {
            const a = pos(idxOf(t.from));
            const b = pos(idxOf(t.to));
            return (
              <g key={i}>
                <path
                  d={edgePath(a, b)}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.5"
                  className="edge-anim"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 8}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill="#065f46"
                  fontFamily="var(--font-geist), monospace"
                >
                  {fmt(t.amount)}
                </text>
              </g>
            );
          })}

        {/* nodes */}
        {participants.map((p, i) => {
          const { x, y } = pos(i);
          return (
            <g key={p}>
              <circle cx={x} cy={y} r="30" fill="#fff" stroke="#83593b" strokeWidth="1.5" />
              <text x={x} y={y + 5} textAnchor="middle" fontSize="15" fill="#4a382c">
                {p.slice(0, 1).toUpperCase()}
              </text>
              <text
                x={x}
                y={y + 48}
                textAnchor="middle"
                fontSize="11"
                fill="#5c4a3c"
                fontFamily="var(--font-geist), monospace"
              >
                {p}
              </text>
            </g>
          );
        })}

        {obligations.length === 0 && (
          <text x={400} y={240} textAnchor="middle" fontSize="14" fill="#9ca3af" fontFamily="var(--font-geist), monospace">
            add obligations to see the web
          </text>
        )}
        {showNet && !ran && (
          <text x={400} y={280} textAnchor="middle" fontSize="12" fill="#9ca3af" fontFamily="var(--font-geist), monospace">
            run netting to see what actually moves
          </text>
        )}
      </svg>

      <div className="mt-2 flex items-center justify-center gap-5 font-mono text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-[#c9a87c]" /> gross obligation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-[#059669]" /> net transfer
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_PARTICIPANTS = ["alice", "bob", "carol", "dave"];

export default function ManualNetting() {
  const [participants, setParticipants] = useState<string[]>(DEFAULT_PARTICIPANTS);
  const [obligations, setObligations] = useState<ObligationInput[]>([]);
  const [payer, setPayer] = useState(DEFAULT_PARTICIPANTS[0]);
  const [payee, setPayee] = useState(DEFAULT_PARTICIPANTS[1]);
  const [amount, setAmount] = useState("0.01");
  const [memo, setMemo] = useState("");
  const [newParticipant, setNewParticipant] = useState("");
  const [ran, setRan] = useState(false);

  const result = useMemo(() => {
    if (obligations.length === 0) return null;
    const positions = computeNetPositions(obligations);
    const transfers = minimizeTransfers(positions);
    const gross = obligations.reduce((s, o) => s + o.amount, 0);
    const net = transfers.reduce((s, t) => s + t.amount, 0);
    return {
      positions,
      transfers,
      gross,
      net,
      compression: gross > 0 ? (1 - net / gross) * 100 : 0,
    };
  }, [obligations]);

  const addObligation = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (payer === payee) return;
    setObligations((prev) => [
      ...prev,
      { id: `obl-${prev.length + 1}`, payer, payee, amount: amt, memo: memo || "service" },
    ]);
    setMemo("");
    setRan(false);
  };

  const removeObligation = (id: string) => {
    setObligations((prev) => prev.filter((o) => o.id !== id));
    setRan(false);
  };

  const addParticipant = () => {
    const name = newParticipant.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return;
    if (!participants.includes(name)) {
      setParticipants((prev) => [...prev, name]);
    }
    setNewParticipant("");
  };

  const clearAll = () => {
    setObligations([]);
    setRan(false);
  };

  const runNetting = () => setRan(true);

  return (
    <div className="window-card bg-white p-6 shadow-card-lg sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="kicker">manual netting</div>
          <h3 className="mt-2 text-xl font-semibold text-ink-950">Build a web, net it out</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            Add obligations between participants — the engine computes the minimal settlement,
            exactly like the on-chain contract does.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500">
            {obligations.length} obligations
          </span>
          {obligations.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-lg border border-line px-3 py-1.5 font-mono text-[11px] text-slate-500 transition hover:bg-cream-dim"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* participant manager */}
      <div className="mt-5 rounded-xl border border-line bg-cream-dim p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">participants</span>
          {participants.map((p) => (
            <span
              key={p}
              className="rounded-full border border-brand-200 bg-white px-2.5 py-1 font-mono text-[11px] text-brand-700"
            >
              {p}
            </span>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <input
            value={newParticipant}
            onChange={(e) => setNewParticipant(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addParticipant(); }}
            placeholder="add a participant (e.g. eve)"
            className="w-full max-w-[240px] rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink-950 outline-none placeholder:text-slate-400 focus:border-brand-400"
          />
          <button
            onClick={addParticipant}
            disabled={!newParticipant.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs font-medium text-ink-900 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add
          </button>
        </div>
      </div>

      {/* input row */}
      <div className="mt-6 rounded-xl border border-line bg-cream-dim p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_1fr_110px_1fr] sm:items-end">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              payer
            </label>
            <select
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs text-ink-950 outline-none focus:border-brand-400"
            >
              {participants.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="hidden pb-2 text-center font-mono text-sm text-slate-400 sm:block">→</div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              payee
            </label>
            <select
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs text-ink-950 outline-none focus:border-brand-400"
            >
              {participants.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              amount Ⓝ
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs text-ink-950 outline-none focus:border-brand-400"
              placeholder="0.01"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              memo
            </label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addObligation(); }}
              placeholder="optional"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs text-ink-950 outline-none placeholder:text-slate-400 focus:border-brand-400"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-slate-400">
            {payer === payee ? "payer and payee must differ" : `${payer} pays ${payee} ${amount || "0.00"} Ⓝ`}
          </p>
          <button
            onClick={addObligation}
            disabled={payer === payee || !parseFloat(amount) || parseFloat(amount) <= 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink-950 px-4 py-2 font-mono text-xs font-semibold text-cream transition hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add obligation
          </button>
        </div>
      </div>

      {/* the web graph */}
      <WebGraph
        participants={participants}
        obligations={obligations}
        netTransfers={result?.transfers ?? []}
        ran={ran}
      />

      {/* obligations list */}
      {obligations.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {obligations.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-lg border border-line/70 bg-cream-dim px-3 py-2 font-mono text-xs"
            >
              <span className="text-slate-600">
                {o.payer} <span className="text-slate-400">→</span> {o.payee}
                <span className="ml-2 text-slate-400">/* {o.memo} */</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-semibold text-ink-900">{fmt(o.amount)} Ⓝ</span>
                <button
                  onClick={() => removeObligation(o.id)}
                  className="text-slate-400 transition hover:text-rose-600"
                  aria-label={`remove ${o.id}`}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* run */}
      {obligations.length >= 2 && (
        <div className="mt-5">
          <button
            onClick={runNetting}
            className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-800 active:scale-[0.98]"
          >
            Run netting →
          </button>
        </div>
      )}

      {/* results */}
      {ran && result && (
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50/50 p-5">
          <div className="kicker text-brand-700">net result</div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div>
              <div className="font-mono text-2xl font-bold text-ink-950">
                {obligations.length} <span className="text-sm font-medium text-slate-500">→</span> {result.transfers.length}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                obligations → transfers
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-brand-700">
                {result.compression.toFixed(1)}%
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                volume saved
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-ink-950">
                {fmt(result.gross)} <span className="text-sm font-medium text-slate-500">→</span> {fmt(result.net)}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                gross → net Ⓝ
              </div>
            </div>
          </div>

          {result.transfers.length > 0 ? (
            <div className="mt-4 space-y-1.5">
              {result.transfers.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-brand-200 bg-white px-3 py-2 font-mono text-xs">
                  <span className="text-brand-700">
                    {t.from} <span className="text-slate-400">→</span> {t.to}
                  </span>
                  <span className="font-semibold text-ink-900">{fmt(t.amount)} Ⓝ</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-brand-200 bg-white px-3 py-2 font-mono text-xs text-brand-700">
              The web nets to zero — no transfers needed. Everyone is even.
            </div>
          )}
        </div>
      )}

      {obligations.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-cream-dim p-6 text-center font-mono text-xs text-slate-500">
          add at least two obligations to see the engine work
        </div>
      )}
    </div>
  );
}
