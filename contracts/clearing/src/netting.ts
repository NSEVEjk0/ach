/**
 * ACH — multilateral netting engine (vendored into the contract).
 *
 * Same algorithm as packages/core, kept self-contained because the NEAR
 * contract must compile to a single wasm bundle with no external imports.
 */

export interface NettingInput {
  id: string;
  debtor: string;
  creditor: string;
  amount: bigint;
}

export interface NetPosition {
  accountId: string;
  net: bigint;
}

export interface Transfer {
  from: string;
  to: string;
  amount: bigint;
}

export interface ClearingResult {
  positions: NetPosition[];
  transfers: Transfer[];
  grossVolume: bigint;
  netVolume: bigint;
  compression: number;
  obligationCount: number;
  obligationIds: string[];
}

export function computeNetPositions(obligations: NettingInput[]): NetPosition[] {
  const nets = new Map<string, bigint>();
  for (const obl of obligations) {
    if (obl.debtor === obl.creditor) continue;
    nets.set(obl.debtor, (nets.get(obl.debtor) ?? 0n) - obl.amount);
    nets.set(obl.creditor, (nets.get(obl.creditor) ?? 0n) + obl.amount);
  }
  return [...nets.entries()]
    .filter(([, net]) => net !== 0n)
    .map(([accountId, net]) => ({ accountId, net }))
    .sort((a, b) => (a.net < b.net ? -1 : a.net > b.net ? 1 : 0));
}

export function minimizeTransfers(positions: NetPosition[]): Transfer[] {
  const debtors = positions
    .filter((p) => p.net < 0n)
    .map((p) => ({ accountId: p.accountId, remaining: -p.net }))
    .sort((a, b) => (a.remaining > b.remaining ? -1 : 1));
  const creditors = positions
    .filter((p) => p.net > 0n)
    .map((p) => ({ accountId: p.accountId, remaining: p.net }))
    .sort((a, b) => (a.remaining > b.remaining ? -1 : 1));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = debtor.remaining < creditor.remaining ? debtor.remaining : creditor.remaining;
    transfers.push({ from: debtor.accountId, to: creditor.accountId, amount });
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0n) i++;
    if (creditor.remaining === 0n) j++;
  }
  return transfers;
}

export function clearObligations(obligations: NettingInput[]): ClearingResult {
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
