import { describe, it, expect } from "vitest";
import { clearObligations, computeNetPositions, minimizeTransfers } from "../src/netting";
import type { NettingInput } from "../src/types";

const obl = (
  id: string,
  debtor: string,
  creditor: string,
  amount: bigint
): NettingInput[number] => ({ id, debtor, creditor, amount });

describe("computeNetPositions", () => {
  it("computes net positions for a simple pair", () => {
    const positions = computeNetPositions([
      obl("1", "a", "b", 100n),
    ]);
    expect(positions).toEqual([
      { accountId: "a", net: -100n },
      { accountId: "b", net: 100n },
    ]);
  });

  it("nests a three-way cycle", () => {
    const positions = computeNetPositions([
      obl("1", "a", "b", 100n),
      obl("2", "b", "c", 100n),
      obl("3", "c", "a", 100n),
    ]);
    // everyone nets to zero
    expect(positions).toEqual([]);
  });

  it("handles partial offsetting", () => {
    const positions = computeNetPositions([
      obl("1", "a", "b", 100n),
      obl("2", "b", "a", 40n),
    ]);
    expect(positions).toEqual([
      { accountId: "a", net: -60n },
      { accountId: "b", net: 60n },
    ]);
  });

  it("ignores self-obligations", () => {
    const positions = computeNetPositions([
      obl("1", "a", "a", 100n),
    ]);
    expect(positions).toEqual([]);
  });
});

describe("minimizeTransfers", () => {
  it("produces a single transfer for a pair", () => {
    const transfers = minimizeTransfers([
      { accountId: "a", net: -100n },
      { accountId: "b", net: 100n },
    ]);
    expect(transfers).toEqual([{ from: "a", to: "b", amount: 100n }]);
  });

  it("settles a hub-and-spoke with n-1 transfers", () => {
    const transfers = minimizeTransfers([
      { accountId: "a", net: -300n },
      { accountId: "b", net: 100n },
      { accountId: "c", net: 100n },
      { accountId: "d", net: 100n },
    ]);
    expect(transfers).toHaveLength(3);
    expect(transfers.reduce((s, t) => s + t.amount, 0n)).toBe(300n);
    // every transfer originates from the sole debtor
    for (const t of transfers) expect(t.from).toBe("a");
  });

  it("pairs largest debtor with largest creditor", () => {
    const transfers = minimizeTransfers([
      { accountId: "big-debtor", net: -500n },
      { accountId: "small-debtor", net: -100n },
      { accountId: "big-creditor", net: 400n },
      { accountId: "small-creditor", net: 200n },
    ]);
    expect(transfers).toHaveLength(3);
    // first transfer should be big-debtor → big-creditor for 400
    expect(transfers[0]).toEqual({ from: "big-debtor", to: "big-creditor", amount: 400n });
    // remaining 100 from big-debtor goes to small-creditor
    expect(transfers[1]).toEqual({ from: "big-debtor", to: "small-creditor", amount: 100n });
    // small-debtor pays remaining 100 to small-creditor
    expect(transfers[2]).toEqual({ from: "small-debtor", to: "small-creditor", amount: 100n });
  });
});

describe("clearObligations", () => {
  it("compresses a tangled web dramatically", () => {
    const result = clearObligations([
      obl("1", "alice", "bob", 120n),
      obl("2", "bob", "carol", 90n),
      obl("3", "carol", "alice", 60n),
      obl("4", "alice", "dave", 30n),
      obl("5", "dave", "carol", 50n),
    ]);
    // gross = 350
    expect(result.grossVolume).toBe(350n);
    // net positions: alice: -120+60-30 = -90; bob: +120-90=+30; carol: +90-60+50=+80; dave: +30-50=-20
    // transfers: alice→carol 80, alice→bob 10, dave→carol 0? dave owes 20, carol still owed 0 after alice pays 80... let's verify by reconstruction
    expect(result.transfers.reduce((s, t) => s + t.amount, 0n)).toBe(result.netVolume);
    // net volume should be 110 (90 + 20)
    expect(result.netVolume).toBe(110n);
    expect(result.compression).toBeCloseTo(110 / 350, 5);
    // transfers should sum per account to their net positions
    const paid = new Map<string, bigint>();
    const received = new Map<string, bigint>();
    for (const t of result.transfers) {
      paid.set(t.from, (paid.get(t.from) ?? 0n) + t.amount);
      received.set(t.to, (received.get(t.to) ?? 0n) + t.amount);
    }
    for (const p of result.positions) {
      const net = (received.get(p.accountId) ?? 0n) - (paid.get(p.accountId) ?? 0n);
      expect(net).toBe(p.net);
    }
  });

  it("returns empty transfers when everyone nets to zero", () => {
    const result = clearObligations([
      obl("1", "a", "b", 100n),
      obl("2", "b", "c", 100n),
      obl("3", "c", "a", 100n),
    ]);
    expect(result.transfers).toEqual([]);
    expect(result.netVolume).toBe(0n);
    expect(result.compression).toBe(0);
  });

  it("counts obligations and ids", () => {
    const result = clearObligations([
      obl("x1", "a", "b", 10n),
      obl("x2", "b", "a", 10n),
    ]);
    expect(result.obligationCount).toBe(2);
    expect(result.obligationIds).toEqual(["x1", "x2"]);
  });
});
