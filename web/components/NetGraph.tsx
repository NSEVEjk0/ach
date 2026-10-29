"use client";

import { useMemo, useState } from "react";
import type { Participant, Obligation, NetResult } from "@/lib/ach";
import { yoctoToNear } from "@/lib/ach";

interface Props {
  participants: Participant[];
  obligations: Obligation[];
  net: NetResult;
}

const COLORS = ["#83593b", "#9c7350", "#b78f6e", "#6b452e", "#cfb096", "#553726", "#a67c52", "#8a5a3b"];

export default function NetGraph({ participants, obligations, net }: Props) {
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const [hover, setHover] = useState<string | null>(null);

  const nodes = useMemo(() => {
    const ids = participants.map((p) => p.accountId);
    const n = ids.length || 1;
    return ids.map((id, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = 150;
      return {
        id,
        x: 220 + r * Math.cos(angle),
        y: 220 + r * Math.sin(angle),
        color: COLORS[i % COLORS.length],
      };
    });
  }, [participants]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const grossEdges = useMemo(
    () =>
      obligations
        .filter((o) => o.status === "open")
        .map((o) => ({
          id: o.id,
          from: nodeMap.get(o.debtor),
          to: nodeMap.get(o.creditor),
          amount: BigInt(o.amount),
          memo: o.memo,
        }))
        .filter((e) => e.from && e.to),
    [obligations, nodeMap]
  );

  const netEdges = useMemo(
    () =>
      net.transfers
        .map((t) => ({
          id: `net-${t.from}-${t.to}`,
          from: nodeMap.get(t.from),
          to: nodeMap.get(t.to),
          amount: BigInt(t.amount),
          memo: "net",
        }))
        .filter((e) => e.from && e.to),
    [net.transfers, nodeMap]
  );

  const edges = mode === "gross" ? grossEdges : netEdges;
  const grossTotal = grossEdges.reduce((s, e) => s + e.amount, 0n);
  const netTotal = netEdges.reduce((s, e) => s + e.amount, 0n);

  function edgePath(from: { x: number; y: number }, to: { x: number; y: number }) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const off = 26;
    const cx = mx - (dy / len) * off;
    const cy = my + (dx / len) * off;
    return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-line bg-cream-dim p-0.5">
          <button
            onClick={() => setMode("gross")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              mode === "gross" ? "bg-white text-ink-950 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Gross · {obligations.filter((o) => o.status === "open").length} obligations ·{" "}
            {yoctoToNear(grossTotal).toFixed(3)} Ⓝ
          </button>
          <button
            onClick={() => setMode("net")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              mode === "net" ? "bg-brand-800 text-white" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Net · {netEdges.length} transfers · {yoctoToNear(netTotal).toFixed(3)} Ⓝ
          </button>
        </div>
        {mode === "net" && grossTotal > 0n && (
          <span className="font-mono text-xs font-semibold text-brand-700">
            −{(100 - (Number(netTotal) / Number(grossTotal)) * 100).toFixed(1)}% volume
          </span>
        )}
      </div>

      <svg viewBox="0 0 440 440" className="w-full">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>

        {edges.map((e) => {
          const active = hover === e.id;
          const color = mode === "gross" ? (e.from?.color ?? "#b78f6e") : "#6b452e";
          // Stroke width scales with amount (min 1, max 5.5).
          const maxAmt = edges.reduce((s, x) => (x.amount > s ? x.amount : s), 0n);
          const width = maxAmt > 0n ? 1 + (Number(e.amount) / Number(maxAmt)) * 4.5 : 1.4;
          const showLabel = !active && e.amount > 0n && Number(e.amount) >= Number(maxAmt) * 0.6;
          return (
            <g
              key={e.id}
              onMouseEnter={() => setHover(e.id)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            >
              <path
                d={edgePath(e.from!, e.to!)}
                fill="none"
                stroke={color}
                strokeWidth={active ? width + 1.2 : width}
                strokeOpacity={active ? 0.95 : mode === "gross" ? 0.55 : 0.8}
                className={mode === "net" ? "edge-anim" : ""}
                markerEnd={`url(#arrow)`}
                style={{ color }}
              />
              {active && e.amount > 0n && (
                <g>
                  <rect
                    x={220 - 52}
                    y={212 - 11}
                    width={104}
                    height={22}
                    rx={6}
                    fill="#ffffff"
                    stroke="rgba(15,23,42,0.15)"
                    filter="drop-shadow(0 2px 6px rgba(15,23,42,0.08))"
                  />
                  <text x={220} y={225} textAnchor="middle" fontSize="11" fill="#0f172a" fontFamily="var(--font-jetbrains)">
                    {yoctoToNear(e.amount).toFixed(4)} Ⓝ
                  </text>
                </g>
              )}
              {showLabel && (
                <text
                  x={(e.from!.x + e.to!.x) / 2}
                  y={(e.from!.y + e.to!.y) / 2 - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={600}
                  fill={color}
                  opacity={0.85}
                  fontFamily="var(--font-jetbrains)"
                >
                  {yoctoToNear(e.amount).toFixed(3)}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={26} fill="#ffffff" stroke={n.color} strokeOpacity={0.5} strokeWidth={1.4} />
            <circle cx={n.x} cy={n.y} r={26} fill="none" stroke={n.color} strokeOpacity={0.12} strokeWidth={6} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12" fontWeight={600} fill="#0f172a">
              {n.id.split(".")[0]}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {nodes.map((n) => (
          <span key={n.id} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: n.color }} />
            {n.id.split(".")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}
