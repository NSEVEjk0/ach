/**
 * ACH — multilateral netting engine
 *
 * Given a set of gross obligations (A owes B, B owes C, C owes A), compute
 * the minimal set of transfers that settles everyone's net position.
 *
 * This is the same core primitive banks have used for a century (and CLS
 * uses daily for FX, cutting funding needs by 90%+). We implement the
 * classic greedy matching: repeatedly pair the largest net debtor with the
 * largest net creditor until everyone is flat. This yields at most n-1
 * transfers for n participants — the theoretical minimum number of legs.
 */
export function computeNetPositions(obligations) {
    const nets = new Map();
    for (const obl of obligations) {
        if (obl.debtor === obl.creditor)
            continue; // self-obligation, ignore
        nets.set(obl.debtor, (nets.get(obl.debtor) ?? 0n) - obl.amount);
        nets.set(obl.creditor, (nets.get(obl.creditor) ?? 0n) + obl.amount);
    }
    return [...nets.entries()]
        .filter(([, net]) => net !== 0n)
        .map(([accountId, net]) => ({ accountId, net }))
        .sort((a, b) => (a.net < b.net ? -1 : a.net > b.net ? 1 : 0));
}
export function minimizeTransfers(positions) {
    // Debtors: negative net, most negative first. Creditors: positive, largest first.
    const debtors = positions
        .filter((p) => p.net < 0n)
        .map((p) => ({ accountId: p.accountId, remaining: -p.net }))
        .sort((a, b) => (a.remaining > b.remaining ? -1 : 1));
    const creditors = positions
        .filter((p) => p.net > 0n)
        .map((p) => ({ accountId: p.accountId, remaining: p.net }))
        .sort((a, b) => (a.remaining > b.remaining ? -1 : 1));
    const transfers = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const amount = debtor.remaining < creditor.remaining ? debtor.remaining : creditor.remaining;
        transfers.push({ from: debtor.accountId, to: creditor.accountId, amount });
        debtor.remaining -= amount;
        creditor.remaining -= amount;
        if (debtor.remaining === 0n)
            i++;
        if (creditor.remaining === 0n)
            j++;
    }
    return transfers;
}
export function clearObligations(obligations) {
    const positions = computeNetPositions(obligations);
    const transfers = minimizeTransfers(positions);
    const grossVolume = obligations.reduce((acc, o) => acc + o.amount, 0n);
    const netVolume = transfers.reduce((acc, t) => acc + t.amount, 0n);
    return {
        positions,
        transfers,
        grossVolume,
        netVolume,
        compression: grossVolume > 0n ? Number(netVolume) / Number(grossVolume) : 0,
        obligationCount: obligations.length,
        obligationIds: obligations.map((o) => o.id),
    };
}
/** Pretty-print a clearing result (used by the agent's reasoning log). */
export function formatClearing(result) {
    const lines = [
        `Clearing round: ${result.obligationCount} obligations, gross ${result.grossVolume.toString()}`,
        `Net volume: ${result.netVolume.toString()} (${(result.compression * 100).toFixed(1)}% of gross)`,
        `Transfers (${result.transfers.length}):`,
    ];
    for (const t of result.transfers) {
        lines.push(`  ${t.from} → ${t.to}: ${t.amount.toString()}`);
    }
    return lines.join("\n");
}
