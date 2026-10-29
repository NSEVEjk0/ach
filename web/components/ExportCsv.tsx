"use client";

import { useState } from "react";
import { getSettlements, getRisk, getStatement, yoctoToNear } from "@/lib/ach";

function download(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportCsv({ accountId }: { accountId?: string }) {
  const [busy, setBusy] = useState(false);

  async function exportSettlements() {
    setBusy(true);
    try {
      const settlements = await getSettlements(200);
      const rows: (string | number)[][] = [
        ["round", "timestamp", "gross_volume_near", "net_volume_near", "gross_saved_pct", "obligation_count", "transfer_count"],
        ...settlements.map((s) => [
          s.id,
          new Date(s.timestamp).toISOString(),
          yoctoToNear(s.grossVolume).toFixed(6),
          yoctoToNear(s.netVolume).toFixed(6),
          ((1 - s.compression) * 100).toFixed(1),
          s.obligationCount,
          s.transfers.length,
        ]),
      ];
      download("ach-settlements.csv", rows);
    } finally {
      setBusy(false);
    }
  }

  async function exportRisk() {
    setBusy(true);
    try {
      const risk = await getRisk();
      const rows: (string | number)[][] = [
        ["participant", "balance_near", "gross_payable_near", "gross_receivable_near", "net_position_near", "credit_limit_near", "collateral_required_near", "covered"],
        ...risk.map((r) => [
          r.accountId,
          yoctoToNear(r.balance).toFixed(6),
          yoctoToNear(r.grossPayable).toFixed(6),
          yoctoToNear(r.grossReceivable).toFixed(6),
          yoctoToNear(r.netPosition).toFixed(6),
          yoctoToNear(r.creditLimit).toFixed(6),
          yoctoToNear(r.collateralRequired).toFixed(6),
          r.covered ? "yes" : "no",
        ]),
      ];
      download("ach-risk.csv", rows);
    } finally {
      setBusy(false);
    }
  }

  async function exportStatement() {
    if (!accountId) return;
    setBusy(true);
    try {
      const st = await getStatement(accountId);
      const rows: (string | number)[][] = [
        ["field", "value"],
        ["account", st.accountId],
        ["name", st.name],
        ["balance_near", yoctoToNear(st.balance).toFixed(6)],
        ["credit_limit_near", yoctoToNear(st.creditLimit).toFixed(6)],
        ["gross_payable_near", yoctoToNear(st.grossPayable).toFixed(6)],
        ["gross_receivable_near", yoctoToNear(st.grossReceivable).toFixed(6)],
        ["net_position_near", yoctoToNear(st.netPosition).toFixed(6)],
        ["", ""],
        ["open_outgoing", ""],
        ...st.openOutgoing.map((o) => [o.id, `${o.debtor.split(".")[0]} → ${o.creditor.split(".")[0]} ${yoctoToNear(o.amount).toFixed(6)} Ⓝ ${o.memo}`]),
        ["", ""],
        ["settlements", ""],
        ...st.settlements.map((s) => [s.id, `${new Date(s.timestamp).toISOString()} · net ${yoctoToNear(s.netVolume).toFixed(6)} Ⓝ · ${s.transfers.length} legs`]),
      ];
      download(`ach-statement-${st.accountId.split(".")[0]}.csv`, rows);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={exportSettlements}
        disabled={busy}
        className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-900 transition hover:bg-cream-dim disabled:opacity-50"
      >
        Export settlements CSV
      </button>
      <button
        onClick={exportRisk}
        disabled={busy}
        className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-900 transition hover:bg-cream-dim disabled:opacity-50"
      >
        Export risk CSV
      </button>
      {accountId && (
        <button
          onClick={exportStatement}
          disabled={busy}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-900 transition hover:bg-cream-dim disabled:opacity-50"
        >
          Export statement CSV
        </button>
      )}
    </div>
  );
}
