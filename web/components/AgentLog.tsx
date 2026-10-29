"use client";

import { useEffect, useMemo, useState } from "react";

interface AgentEvent {
  t: number;
  kind: string;
  [key: string]: unknown;
}

const KIND_BADGE: Record<string, { label: string; cls: string }> = {
  settle: { label: "SETTLED", cls: "bg-brand-800 text-white" },
  propose: { label: "PROPOSED", cls: "bg-brand-100 text-brand-800" },
  defer: { label: "DEFERRED", cls: "bg-slate-100 text-slate-600" },
  observe: { label: "OBSERVED", cls: "bg-slate-100 text-slate-600" },
  hold: { label: "HOLD", cls: "bg-slate-100 text-slate-500" },
  bill: { label: "BILL", cls: "bg-slate-100 text-slate-500" },
};

const STORY_KINDS = new Set(["propose", "settle", "defer", "observe"]);

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtAge(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function timelineLines(e: AgentEvent): string[] {
  const kind = e.kind;
  const note = typeof e.note === "string" ? e.note : "";

  if (kind === "settle") {
    const lines: string[] = [];
    const roundId = typeof e.roundId === "string" ? e.roundId : "round";
    lines.push(`${roundId} settled atomically on-chain`);
    if (typeof e.transfers === "number") lines.push(`${e.transfers} net transfers executed`);
    if (typeof e.compression === "number") lines.push(`Compression: ${e.compression}% (above policy threshold)`);
    if (note) lines.push(note);
    return lines;
  }

  if (kind === "propose") {
    const lines: string[] = [];
    if (typeof e.open === "number") lines.push(`Observed ${e.open} open obligations`);
    if (typeof e.transfers === "number") lines.push(`Computed net positions → only ${e.transfers} transfers required`);
    if (typeof e.compression === "number") lines.push(`Compression: ${e.compression}% (above 10% policy)`);
    if (note) lines.push(note);
    return lines;
  }

  if (kind === "defer") {
    const lines: string[] = [];
    if (e.reason === "underfunded") {
      lines.push("Net positions ready — but net payers underfunded");
      if (Array.isArray(e.shortfalls) && e.shortfalls.length > 0) {
        lines.push(`Waiting for deposits: ${e.shortfalls.map((s: string) => s.split(".")[0]).join(", ")}`);
      }
    }
    if (note) lines.push(note);
    return lines;
  }

  if (kind === "observe") {
    const lines: string[] = [];
    if (typeof e.open === "number") lines.push(`Observed ${e.open} open obligations`);
    if (note) lines.push(note);
    return lines;
  }

  if (kind === "hold") {
    return [note || "Idle"];
  }

  if (kind === "bill") {
    const payer = typeof e.debtor === "string" ? e.debtor.split(".")[0] : "";
    const payee = typeof e.creditor === "string" ? e.creditor.split(".")[0] : "";
    const amount = typeof e.amount === "number" ? e.amount.toFixed(4) : "";
    const memo = typeof e.memo === "string" ? e.memo : "";
    return [`${payer} → ${payee} · ${amount} Ⓝ · ${memo}`];
  }

  return note ? [note] : [];
}

interface Group {
  kind: string;
  count: number;
  first: AgentEvent;
  last: AgentEvent;
}

export default function AgentLog({
  initialLog,
  agentUrl,
  grow = false,
}: {
  initialLog: AgentEvent[];
  agentUrl: string;
  grow?: boolean;
}) {
  const [log, setLog] = useState<AgentEvent[]>(initialLog);
  const [showAll, setShowAll] = useState(false);
  const [openGroup, setOpenGroup] = useState<number | null>(null);

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${agentUrl}/log`, { cache: "no-store" });
        if (res.ok) setLog(await res.json());
      } catch {
        /* agent offline */
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [agentUrl]);

  // Group consecutive same-kind events so the log doesn't read as a wall.
  const groups = useMemo(() => {
    const source = showAll ? [...log].reverse() : [...log].reverse().filter((e) => STORY_KINDS.has(e.kind));
    const out: Group[] = [];
    for (const e of source) {
      const last = out[out.length - 1];
      if (last && last.kind === e.kind) {
        last.count += 1;
        last.last = e;
      } else {
        out.push({ kind: e.kind, count: 1, first: e, last: e });
      }
    }
    return out;
  }, [log, showAll]);

  if (log.length === 0) {
    return (
      <div className="window-card-sm bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-sm font-medium text-ink-950">The agent is warming up</div>
        <div className="mt-1 font-mono text-xs text-slate-500">
          first observations will appear here shortly
        </div>
      </div>
    );
  }

  return (
    <div className={`window-card-sm bg-white shadow-card ${grow ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
          agent reasoning log
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-slate-400 sm:block">
            {groups.length} events · live
          </span>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] font-medium text-slate-600 transition hover:bg-cream-dim"
          >
            {showAll ? "Showing all events" : "Showing key decisions"}
          </button>
        </div>
      </div>
      <div className={`relative ${grow ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        <div className={`overflow-y-auto p-3 ${grow ? "min-h-0 flex-1" : "max-h-[480px]"}`}>
          {groups.map((g, i) => {
            const badge = KIND_BADGE[g.kind] ?? { label: g.kind.toUpperCase(), cls: "bg-slate-100 text-slate-600" };
            const isStory = STORY_KINDS.has(g.kind);
            const isOpen = openGroup === i;
            const lines = timelineLines(g.first);
            return (
              <div
                key={g.first.t + "-" + i}
                className={`mb-2 rounded-lg border transition ${
                  isStory ? "border-brand-200 bg-brand-50/60" : "border-line/70 bg-cream-dim"
                }`}
              >
                <button
                  onClick={() => setOpenGroup(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
                  aria-expanded={isOpen}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {g.kind === "settle" && typeof g.first.roundId === "string" && (
                      <span className="truncate font-mono text-[11px] text-slate-500">{g.first.roundId}</span>
                    )}
                    {g.count > 1 && (
                      <span className="rounded-full border border-brand-200 bg-white px-2 py-0.5 font-mono text-[10px] text-brand-700">
                        ×{g.count}
                      </span>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">
                      {fmtAge(g.last.t as number)}
                    </span>
                    <svg
                      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-brand-200/60 px-3.5 py-2.5">
                    <div className="space-y-0.5">
                      {lines.map((line, j) => (
                        <div key={j} className="text-xs leading-5 text-slate-600">
                          {line}
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 font-mono text-[10px] text-slate-400">
                      {fmtTime(g.first.t as number)} · {g.count} similar event{g.count > 1 ? "s" : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {groups.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              No key decisions yet — the agent is watching.
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  );
}
