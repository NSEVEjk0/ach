import {
  NearBindgen,
  call,
  view,
  initialize,
  near,
  LookupMap,
  UnorderedMap,
  assert,
  validateAccountId,
} from "near-sdk-js";

import { clearObligations } from "./netting";
import type { ClearingResult, Transfer } from "./netting";

/**
 * Current time in milliseconds since epoch.
 *
 * NB: `Date.now()` returns 0 inside the NEAR JS VM (not implemented), so we
 * read the block timestamp instead (nanoseconds) and convert to ms. This is
 * what backs settlement timestamps, obligation createdAt, and due-date checks.
 */
function nowMs(): number {
  return Number(near.blockTimestamp() / 1000000n);
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ObligationStatus = "open" | "disputed" | "settled" | "voided";

interface Obligation {
  id: string;
  debtor: string;
  creditor: string;
  amount: bigint;
  memo: string;
  createdAt: number;
  dueAt: number | null;
  status: ObligationStatus;
  disputedBy?: string;
}

interface ParticipantProfile {
  accountId: string;
  name: string;
  kind: string;
  bio: string;
  icon: string;
  createdAt: number;
  /** Max net debit this participant will accept per round. 0 = unlimited. */
  creditLimit: bigint;
}

interface SettlementRecord {
  id: string;
  timestamp: number;
  grossVolume: bigint;
  netVolume: bigint;
  compression: number;
  obligationCount: number;
  obligationIds: string[];
  transfers: Transfer[];
}

/* JSON-safe DTOs (bigint → string) for view methods */

interface ObligationDTO {
  id: string;
  debtor: string;
  creditor: string;
  amount: string;
  memo: string;
  createdAt: number;
  dueAt: number | null;
  status: ObligationStatus;
  disputedBy?: string;
}

interface TransferDTO {
  from: string;
  to: string;
  amount: string;
}

interface ClearingResultDTO {
  positions: { accountId: string; net: string }[];
  transfers: TransferDTO[];
  grossVolume: string;
  netVolume: string;
  compression: number;
  obligationCount: number;
  obligationIds: string[];
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

const STORAGE_BYTES_PER_PARTICIPANT = 400n;
const MAX_MEMO_LEN = 200;

@NearBindgen({})
export class ClearingHouse {
  ownerId: string;
  participants: UnorderedMap<ParticipantProfile>;
  balances: LookupMap<bigint>;
  obligations: UnorderedMap<Obligation>;
  settlements: UnorderedMap<SettlementRecord>;
  nextObligationId: number;
  nextSettlementId: number;
  totalObligations: number;
  totalSettledVolume: bigint;
  /** Collateral ratio: a net debtor must hold balance >= ratio × net debit. */
  collateralRatio: number;

  constructor() {
    this.ownerId = "";
    this.participants = new UnorderedMap("p");
    this.balances = new LookupMap("b");
    this.obligations = new UnorderedMap("o");
    this.settlements = new UnorderedMap("s");
    this.nextObligationId = 1;
    this.nextSettlementId = 1;
    this.totalObligations = 0;
    this.totalSettledVolume = 0n;
    this.collateralRatio = 1;
  }

  /* ---------------------------------------------------------------- */
  /* Open-obligation index (raw storage — avoids state-layout breaks)   */
  /* ---------------------------------------------------------------- */

  private static OPEN_IDS_KEY = "open_ids";

  private openIds(): string[] {
    const raw = near.storageRead(ClearingHouse.OPEN_IDS_KEY);
    if (raw === null) return this.migrateOpenIds();
    return JSON.parse(raw) as string[];
  }

  private persistOpenIds(ids: string[]) {
    near.storageWrite(ClearingHouse.OPEN_IDS_KEY, JSON.stringify(ids));
  }

  /** One-time backfill from existing obligations (safe to re-run). */
  private migrateOpenIds(): string[] {
    const ids: string[] = [];
    for (const [id, obl] of this.obligations.toArray()) {
      if (obl.status === "open") ids.push(id);
    }
    this.persistOpenIds(ids);
    return ids;
  }

  /**
   * Chunked backfill of the open-obligation index. Iterating all stored
   * obligations in one call exceeds the 300 TGas cap once history grows,
   * so we process `batch_size` per call and persist a cursor.
   */
  @call({})
  migrate_open_index({ batch_size }: { batch_size?: number }) {
    const batch = Math.max(1, Math.min(batch_size ?? 50, 100));
    const cursorKey = "open_ids_cursor";
    const rawCursor = near.storageRead(cursorKey);
    const start = rawCursor === null ? 0 : Number(rawCursor);
    const all = this.obligations.toArray();
    const end = Math.min(start + batch, all.length);
    const rawIds = near.storageRead(ClearingHouse.OPEN_IDS_KEY);
    const ids: string[] = rawIds === null ? [] : (JSON.parse(rawIds) as string[]);
    let added = 0;
    for (let i = start; i < end; i++) {
      const [id, obl] = all[i];
      if (obl.status === "open" && !ids.includes(id)) {
        ids.push(id);
        added += 1;
      }
    }
    near.storageWrite(ClearingHouse.OPEN_IDS_KEY, JSON.stringify(ids));
    if (end >= all.length) {
      near.storageRemove(cursorKey);
      return { done: true, processed: end, added };
    }
    near.storageWrite(cursorKey, String(end));
    return { done: false, processed: end, added, next: end };
  }

  private addOpenId(id: string) {
    const ids = this.openIds();
    if (!ids.includes(id)) {
      ids.push(id);
      this.persistOpenIds(ids);
    }
  }

  private removeOpenId(id: string) {
    const ids = this.openIds();
    const idx = ids.indexOf(id);
    if (idx !== -1) {
      ids.splice(idx, 1);
      this.persistOpenIds(ids);
    }
  }

  @initialize({})
  init({ owner_id }: { owner_id: string }) {
    validateAccountId(owner_id);
    this.ownerId = owner_id;
  }

  /* ---------------------------------------------------------------- */
  /* Registration                                                      */
  /* ---------------------------------------------------------------- */

  @call({})
  join({
    name,
    kind,
    bio,
    icon,
  }: {
    name: string;
    kind: string;
    bio: string;
    icon: string;
  }) {
    const accountId = near.predecessorAccountId();
    assert(this.participants.get(accountId) === null, "Already registered");
    assert(name.length >= 2 && name.length <= 40, "Name must be 2-40 chars");
    assert(kind.length >= 2 && kind.length <= 24, "Kind must be 2-24 chars");
    assert(bio.length <= 200, "Bio too long");
    assert(icon.length <= 8, "Icon too long");

    // Registration is free; the contract account pays storage.
    this.participants.set(accountId, {
      accountId,
      name,
      kind,
      bio,
      icon,
      createdAt: nowMs(),
      creditLimit: 0n,
    });
    return { accountId };
  }

  @view({})
  get_participants(): ParticipantProfile[] {
    return this.participants.toArray().map(([, p]) => p);
  }

  @view({})
  get_participant({ account_id }: { account_id: string }): ParticipantProfile | null {
    return this.participants.get(account_id) ?? null;
  }

  /* ---------------------------------------------------------------- */
  /* Risk controls: credit limits & collateral ratio                  */
  /* ---------------------------------------------------------------- */

  @call({})
  set_credit_limit({ account_id, limit }: { account_id: string; limit: string }) {
    const caller = near.predecessorAccountId();
    assert(caller === this.ownerId, "Only the owner can set credit limits");
    const participant = this.participants.get(account_id);
    assert(participant !== null, "Participant not found");
    const limitBig = BigInt(limit);
    assert(limitBig >= 0n, "Limit must be >= 0");
    participant.creditLimit = limitBig;
    this.participants.set(account_id, participant);
    return { account_id, creditLimit: limitBig.toString() };
  }

  @call({})
  set_collateral_ratio({ ratio }: { ratio: number }) {
    const caller = near.predecessorAccountId();
    assert(caller === this.ownerId, "Only the owner can set the collateral ratio");
    assert(Number.isFinite(ratio) && ratio >= 0 && ratio <= 10, "Ratio must be 0-10");
    this.collateralRatio = ratio;
    return { collateralRatio: ratio };
  }

  @view({})
  get_collateral_ratio(): number {
    return this.collateralRatio ?? 1;
  }

  @view({})
  get_credit_limits(): { accountId: string; creditLimit: string }[] {
    return this.participants
      .toArray()
      .map(([, p]) => ({ accountId: p.accountId, creditLimit: (p.creditLimit ?? 0n).toString() }));
  }

  /* ---------------------------------------------------------------- */
  /* Statements & risk (reconciliation)                                */
  /* ---------------------------------------------------------------- */

  private participantExposure(accountId: string) {
    let grossPayable = 0n; // obligations where accountId owes
    let grossReceivable = 0n; // obligations where accountId is owed
    const openIncoming: ObligationDTO[] = [];
    const openOutgoing: ObligationDTO[] = [];
    for (const [, obl] of this.obligations.toArray()) {
      if (obl.status !== "open") continue;
      const dto: ObligationDTO = {
        id: obl.id,
        debtor: obl.debtor,
        creditor: obl.creditor,
        amount: obl.amount.toString(),
        memo: obl.memo,
        createdAt: obl.createdAt,
        dueAt: obl.dueAt,
        status: obl.status,
        disputedBy: obl.disputedBy,
      };
      if (obl.debtor === accountId) {
        grossPayable += obl.amount;
        openOutgoing.push(dto);
      } else if (obl.creditor === accountId) {
        grossReceivable += obl.amount;
        openIncoming.push(dto);
      }
    }
    return { grossPayable, grossReceivable, openIncoming, openOutgoing };
  }

  @view({})
  get_statement({ account_id }: { account_id: string }) {
    assert(this.participants.get(account_id) !== null, "Participant not found");
    const balance = this.balances.get(account_id) ?? 0n;
    const participant = this.participants.get(account_id)!;
    const { grossPayable, grossReceivable, openIncoming, openOutgoing } = this.participantExposure(account_id);
    const netPosition = grossReceivable - grossPayable;

    // Settlement history involving this participant.
    const settlements: { id: string; timestamp: number; netVolume: string; compression: number; transfers: TransferDTO[] }[] = [];
    for (const [, s] of this.settlements.toArray()) {
      const mine = s.transfers.filter((t) => t.from === account_id || t.to === account_id);
      if (mine.length > 0) {
        settlements.push({
          id: s.id,
          timestamp: s.timestamp,
          netVolume: s.netVolume.toString(),
          compression: s.compression,
          transfers: mine.map((t) => ({ from: t.from, to: t.to, amount: t.amount.toString() })),
        });
      }
    }

    return {
      accountId: account_id,
      name: participant.name,
      kind: participant.kind,
      balance: balance.toString(),
      creditLimit: (participant.creditLimit ?? 0n).toString(),
      grossPayable: grossPayable.toString(),
      grossReceivable: grossReceivable.toString(),
      netPosition: netPosition.toString(),
      openIncoming,
      openOutgoing,
      settlements,
    };
  }

  @view({})
  get_risk() {
    const out: {
      accountId: string;
      name: string;
      balance: string;
      creditLimit: string;
      grossPayable: string;
      grossReceivable: string;
      netPosition: string;
      collateralRequired: string;
      covered: boolean;
    }[] = [];
    for (const [, p] of this.participants.toArray()) {
      const balance = this.balances.get(p.accountId) ?? 0n;
      const { grossPayable, grossReceivable } = this.participantExposure(p.accountId);
      const netPosition = grossReceivable - grossPayable;
      const netDebit = netPosition < 0n ? -netPosition : 0n;
      const collateralRequired = BigInt(Math.round(Number(netDebit) * (this.collateralRatio ?? 1)));
      out.push({
        accountId: p.accountId,
        name: p.name,
        balance: balance.toString(),
        creditLimit: (p.creditLimit ?? 0n).toString(),
        grossPayable: grossPayable.toString(),
        grossReceivable: grossReceivable.toString(),
        netPosition: netPosition.toString(),
        collateralRequired: collateralRequired.toString(),
        covered: balance >= collateralRequired,
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Deposits & withdrawals (settlement currency = NEAR)               */
  /* ---------------------------------------------------------------- */

  @call({ payableFunction: true })
  deposit() {
    const accountId = near.predecessorAccountId();
    assert(this.participants.get(accountId) !== null, "Not registered");
    const attached = near.attachedDeposit();
    assert(attached > 0n, "Attach a deposit");
    const balance = this.balances.get(accountId) ?? 0n;
    this.balances.set(accountId, balance + attached);
    return { accountId, deposited: attached.toString(), balance: (balance + attached).toString() };
  }

  @call({})
  withdraw({ amount }: { amount: string }) {
    const accountId = near.predecessorAccountId();
    const amountBig = BigInt(amount);
    assert(amountBig > 0n, "Amount must be positive");
    const balance = this.balances.get(accountId) ?? 0n;
    assert(balance >= amountBig, `Insufficient balance: have ${balance.toString()}, want ${amountBig.toString()}`);
    this.balances.set(accountId, balance - amountBig);
    const promise = near.promiseBatchCreate(accountId);
    near.promiseBatchActionTransfer(promise, amountBig);
    near.promiseReturn(promise);
    return { accountId, withdrawn: amountBig.toString(), balance: (balance - amountBig).toString() };
  }

  @view({})
  get_balance({ account_id }: { account_id: string }): string {
    return (this.balances.get(account_id) ?? 0n).toString();
  }

  /* ---------------------------------------------------------------- */
  /* Obligations                                                       */
  /* ---------------------------------------------------------------- */

  @call({})
  record_obligation({
    debtor,
    creditor,
    amount,
    memo,
    due_at,
  }: {
    debtor: string;
    creditor: string;
    amount: string;
    memo: string;
    due_at: number | null;
  }) {
    const caller = near.predecessorAccountId();
    validateAccountId(debtor);
    validateAccountId(creditor);
    assert(debtor !== creditor, "Debtor and creditor must differ");
    assert(caller === debtor || caller === creditor, "Only debtor or creditor can record");
    assert(this.participants.get(debtor) !== null, `Debtor ${debtor} not registered`);
    assert(this.participants.get(creditor) !== null, `Creditor ${creditor} not registered`);
    const amountBig = BigInt(amount);
    assert(amountBig > 0n, "Amount must be positive");
    assert(memo.length <= MAX_MEMO_LEN, `Memo too long (max ${MAX_MEMO_LEN})`);
    if (due_at !== null) {
      assert(Number.isFinite(due_at) && due_at > 0, "Invalid due_at");
    }

    const id = `obl-${this.nextObligationId}`;
    this.nextObligationId += 1;
    this.totalObligations += 1;

    this.obligations.set(id, {
      id,
      debtor,
      creditor,
      amount: amountBig,
      memo,
      createdAt: nowMs(),
      dueAt: due_at,
      status: "open",
    });
    this.addOpenId(id);
    return { id };
  }

  @call({})
  dispute({ obligation_id }: { obligation_id: string }) {
    const caller = near.predecessorAccountId();
    const obl = this.obligations.get(obligation_id);
    assert(obl !== null, "Obligation not found");
    assert(obl.debtor === caller || obl.creditor === caller, "Only debtor or creditor can dispute");
    assert(obl.status === "open", "Only open obligations can be disputed");
    obl.status = "disputed";
    obl.disputedBy = caller;
    this.obligations.set(obligation_id, obl);
    this.removeOpenId(obligation_id);
    return { obligation_id, status: "disputed" };
  }

  @call({})
  resolve_dispute({
    obligation_id,
    outcome,
  }: {
    obligation_id: string;
    outcome: "keep" | "void";
  }) {
    const caller = near.predecessorAccountId();
    const obl = this.obligations.get(obligation_id);
    assert(obl !== null, "Obligation not found");
    assert(obl.debtor === caller || obl.creditor === caller, "Only debtor or creditor can resolve");
    assert(obl.status === "disputed", "Only disputed obligations can be resolved");
    assert(outcome === "keep" || outcome === "void", "Outcome must be keep or void");
    if (outcome === "keep") {
      obl.status = "open";
      obl.disputedBy = undefined;
      this.addOpenId(obligation_id);
    } else {
      obl.status = "voided";
    }
    this.obligations.set(obligation_id, obl);
    return { obligation_id, status: obl.status };
  }

  @view({})
  get_obligations({
    status,
    account_id,
    limit,
  }: {
    status?: ObligationStatus;
    account_id?: string;
    limit?: number;
  }): ObligationDTO[] {
    const max = Math.min(limit ?? 100, 500);
    const out: ObligationDTO[] = [];
    for (const [, obl] of this.obligations.toArray()) {
      if (out.length >= max) break;
      if (status && obl.status !== status) continue;
      if (account_id && obl.debtor !== account_id && obl.creditor !== account_id) continue;
      out.push({
        id: obl.id,
        debtor: obl.debtor,
        creditor: obl.creditor,
        amount: obl.amount.toString(),
        memo: obl.memo,
        createdAt: obl.createdAt,
        dueAt: obl.dueAt,
        status: obl.status,
        disputedBy: obl.disputedBy,
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Clearing                                                          */
  /* ---------------------------------------------------------------- */

  private eligibleObligations(includeNotDue: boolean): Obligation[] {
    const now = nowMs();
    const out: Obligation[] = [];
    for (const id of this.openIds()) {
      const obl = this.obligations.get(id);
      if (obl === null || obl.status !== "open") continue;
      if (obl.dueAt !== null && obl.dueAt > now && !includeNotDue) continue;
      out.push(obl);
    }
    return out;
  }

  private toDTO(result: ClearingResult): ClearingResultDTO {
    return {
      positions: result.positions.map((p) => ({ accountId: p.accountId, net: p.net.toString() })),
      transfers: result.transfers.map((t) => ({ from: t.from, to: t.to, amount: t.amount.toString() })),
      grossVolume: result.grossVolume.toString(),
      netVolume: result.netVolume.toString(),
      compression: result.compression,
      obligationCount: result.obligationCount,
      obligationIds: result.obligationIds,
    };
  }

  @view({})
  compute_net_positions({
    include_not_due,
  }: {
    include_not_due?: boolean;
  }): ClearingResultDTO {
    const eligible = this.eligibleObligations(include_not_due ?? false);
    const result = clearObligations(
      eligible.map((o) => ({ id: o.id, debtor: o.debtor, creditor: o.creditor, amount: o.amount }))
    );
    return this.toDTO(result);
  }

  @call({})
  clear({
    include_not_due,
    max_obligations,
  }: {
    include_not_due?: boolean;
    max_obligations?: number;
  }) {
    const eligible = this.eligibleObligations(include_not_due ?? false);
    assert(eligible.length > 0, "Nothing to clear");

    // Settle in batches: the 300 TGas protocol cap bounds how many
    // obligations one call can process. The caller loops until `remaining`
    // is 0. Default batch 10 — comfortably inside the gas budget even as
    // obligation history grows.
    const max = Math.max(1, Math.min(max_obligations ?? 10, 200));
    const batch = eligible.slice(0, max);

    const result = clearObligations(
      batch.map((o) => ({ id: o.id, debtor: o.debtor, creditor: o.creditor, amount: o.amount }))
    );
    // A batch can coincidentally net to zero — that is a legitimate clear
    // (the obligations cancel out; nothing moves). No assert, no expansion.

    // Risk checks before settlement — mirrors how real clearinghouses enforce
    // collateralization and credit limits before releasing funds.
    const netDebits = new Map<string, bigint>();
    for (const t of result.transfers) {
      netDebits.set(t.from, (netDebits.get(t.from) ?? 0n) + t.amount);
    }

    const shortfalls: string[] = [];
    for (const [accountId, netDebit] of netDebits) {
      const balance = this.balances.get(accountId) ?? 0n;
      const ratio = this.collateralRatio ?? 1;
      const required = BigInt(Math.round(Number(netDebit) * ratio));
      if (balance < required) {
        shortfalls.push(`${accountId} needs ${required.toString()} collateral (ratio ${ratio}), has ${balance.toString()}`);
      }
      const participant = this.participants.get(accountId);
      if (participant && (participant.creditLimit ?? 0n) > 0n && netDebit > participant.creditLimit) {
        shortfalls.push(`${accountId} net debit ${netDebit.toString()} exceeds credit limit ${participant.creditLimit.toString()}`);
      }
    }
    assert(shortfalls.length === 0, `Risk check failed: ${shortfalls.join("; ")}`);

    // Apply transfers atomically.
    for (const t of result.transfers) {
      const fromBalance = this.balances.get(t.from) ?? 0n;
      const toBalance = this.balances.get(t.to) ?? 0n;
      this.balances.set(t.from, fromBalance - t.amount);
      this.balances.set(t.to, toBalance + t.amount);
    }

    // Mark obligations settled (iterate only the batch).
    for (const obl of batch) {
      obl.status = "settled";
      this.obligations.set(obl.id, obl);
      this.removeOpenId(obl.id);
    }

    // Record the settlement round.
    const roundId = `round-${this.nextSettlementId}`;
    this.nextSettlementId += 1;
    this.totalSettledVolume += result.netVolume;
    const record: SettlementRecord = {
      id: roundId,
      timestamp: nowMs(),
      grossVolume: result.grossVolume,
      netVolume: result.netVolume,
      compression: result.compression,
      obligationCount: result.obligationCount,
      obligationIds: result.obligationIds,
      transfers: result.transfers,
    };
    this.settlements.set(roundId, record);

    return {
      roundId,
      remaining: eligible.length - batch.length,
      transfers: result.transfers.map((t) => ({ from: t.from, to: t.to, amount: t.amount.toString() })),
      grossVolume: result.grossVolume.toString(),
      netVolume: result.netVolume.toString(),
      compression: result.compression,
      obligationCount: result.obligationCount,
    };
  }

  @view({})
  get_settlements({ limit }: { limit?: number }): SettlementDTO[] {
    const max = Math.min(limit ?? 50, 200);
    const all: SettlementDTO[] = [];
    for (const [, s] of this.settlements.toArray()) {
      all.push({
        id: s.id,
        timestamp: s.timestamp,
        grossVolume: s.grossVolume.toString(),
        netVolume: s.netVolume.toString(),
        compression: s.compression,
        obligationCount: s.obligationCount,
        obligationIds: s.obligationIds,
        transfers: s.transfers.map((t) => ({ from: t.from, to: t.to, amount: t.amount.toString() })),
      });
    }
    // Newest first — the UI shows the most recent rounds.
    return all.slice(-max).reverse();
  }

  /**
   * Maintenance: purge settled/voided/disputed obligations and old
   * settlement records to free storage. The contract pays for storage, so
   * history growth eventually starves it — this keeps it operational.
   * Only the owner may call it.
   */
  @call({})
  purge_history({ keep_settlements }: { keep_settlements?: number }) {
    const caller = near.predecessorAccountId();
    assert(caller === this.ownerId, "Only the owner can purge history");

    // Purge non-open obligations.
    let purgedObligations = 0;
    for (const [id, obl] of this.obligations.toArray()) {
      if (obl.status !== "open") {
        this.obligations.remove(id);
        this.removeOpenId(id);
        purgedObligations += 1;
      }
    }

    // Keep the most recent `keep_settlements` settlement records.
    const keep = Math.max(1, Math.min(keep_settlements ?? 50, 200));
    const all = this.settlements.toArray().map(([id]) => id);
    const drop = all.length - keep;
    let purgedSettlements = 0;
    for (let i = 0; i < drop; i++) {
      this.settlements.remove(all[i]);
      purgedSettlements += 1;
    }

    return { purgedObligations, purgedSettlements };
  }

  @view({})
  get_stats() {
    return {
      ownerId: this.ownerId,
      participantCount: this.participants.length,
      obligationCount: this.totalObligations,
      openObligations: this.obligations.toArray().filter(([, o]) => o.status === "open").length,
      settlementCount: this.settlements.length,
      totalSettledVolume: this.totalSettledVolume.toString(),
    };
  }
}
