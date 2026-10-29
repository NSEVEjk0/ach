"use client";

import { useState } from "react";
import { yoctoToNear } from "@/lib/ach";

interface TransferDTO {
  from: string;
  to: string;
  amount: string;
}

interface SettlementDTO {
  id: string;
  timestamp: number;
  grossVolume: string;
  netVolume: string;
  compression: number;
  obligationCount: number;
  obligationIds: string[];
  transfers: TransferDTO[];
}

const short = (acct: string) => acct.split(".")[0];

export default function SettlementRounds({ settlements }: { settlements: SettlementDTO[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {settlements.map((s) => {
        const isOpen = openId === s.id;
        return (
          <div key={s.id} className="window-card-sm bg-white shadow-card">
            <button
              onClick={() => setOpenId(isOpen ? null : s.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-cream-dim"
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md border font-mono text-[10px] transition ${
                    isOpen ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line text-slate-400"
                  }`}
                >
                  {isOpen ? "−" : "+"}
                </span>
                <span className="font-mono text-xs text-slate-500">{s.id}</span>
              </span>
              <span className="flex items-center gap-4">
                <span className="hidden font-mono text-[11px] text-slate-500 sm:block">
                  {s.obligationCount} obligations · {s.transfers.length} transfers
                </span>
                <span className="font-mono text-xs font-semibold text-brand-700">
                  {yoctoToNear(s.grossVolume).toFixed(3)} → {yoctoToNear(s.netVolume).toFixed(3)} Ⓝ
                </span>
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-line px-4 pb-4 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                    how it cleared
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {s.timestamp > 0 ? new Date(s.timestamp).toLocaleString() : "—"} ·{" "}
                    {((1 - s.compression) * 100).toFixed(1)}% of gross saved
                  </div>
                </div>

                {s.transfers.length > 0 ? (
                  <div className="mt-2.5 space-y-1.5">
                    {s.transfers.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-2 font-mono text-xs"
                      >
                        <span className="text-brand-700">
                          {short(t.from)} <span className="text-slate-400">→</span> {short(t.to)}
                        </span>
                        <span className="font-semibold text-ink-900">
                          {yoctoToNear(t.amount).toFixed(4)} Ⓝ
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-2 font-mono text-xs text-brand-700">
                    The web netted to zero — no transfers were needed.
                  </div>
                )}

                <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-700"
                    style={{ width: `${Math.min(100, (1 - s.compression) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
      {settlements.length === 0 && (
        <div className="window-card-sm bg-white p-8 text-center text-sm text-slate-500 shadow-card">
          No settlements yet
        </div>
      )}
    </div>
  );
}
