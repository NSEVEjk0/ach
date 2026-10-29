/**
 * ACH — typed client for the clearing contract on NEAR.
 *
 * Works with near-api-js v7. Views are public; calls require a signer
 * (a KeyPairString for server-side use, or a wallet-backed signer in the
 * browser).
 */

import { Account, JsonRpcProvider, actions } from "near-api-js";
import type { Action, Signer, KeyPairString } from "near-api-js";

export const DEFAULT_RPC_URL = "https://test.rpc.fastnear.com";
export const DEFAULT_CONTRACT_ID = "ach-clearing.testnet";

export const YOCTO_PER_NEAR = 1_000_000_000_000_000_000_000_000n;

export const nearToYocto = (near: string | number): string =>
  (BigInt(Math.round(Number(near) * 1e24))).toString();

export interface ParticipantProfile {
  accountId: string;
  name: string;
  kind: string;
  bio: string;
  icon: string;
  createdAt: number;
}

export interface ObligationDTO {
  id: string;
  debtor: string;
  creditor: string;
  amount: string;
  memo: string;
  createdAt: number;
  dueAt: number | null;
  status: "open" | "disputed" | "settled" | "voided";
  disputedBy?: string;
}

export interface TransferDTO {
  from: string;
  to: string;
  amount: string;
}

export interface ClearingResultDTO {
  positions: { accountId: string; net: string }[];
  transfers: TransferDTO[];
  grossVolume: string;
  netVolume: string;
  compression: number;
  obligationCount: number;
  obligationIds: string[];
}

export interface SettlementDTO {
  id: string;
  timestamp: number;
  grossVolume: string;
  netVolume: string;
  compression: number;
  obligationCount: number;
  obligationIds: string[];
  transfers: TransferDTO[];
}

export interface StatsDTO {
  ownerId: string;
  participantCount: number;
  obligationCount: number;
  openObligations: number;
  settlementCount: number;
  totalSettledVolume: string;
}

export interface ClearResult {
  roundId: string;
  remaining?: number;
  transfers: TransferDTO[];
  grossVolume: string;
  netVolume: string;
  compression: number;
  obligationCount: number;
}

export interface RiskRow {
  accountId: string;
  name: string;
  balance: string;
  creditLimit: string;
  grossPayable: string;
  grossReceivable: string;
  netPosition: string;
  collateralRequired: string;
  covered: boolean;
}

export interface StatementDTO {
  accountId: string;
  name: string;
  kind: string;
  balance: string;
  creditLimit: string;
  grossPayable: string;
  grossReceivable: string;
  netPosition: string;
  openIncoming: ObligationDTO[];
  openOutgoing: ObligationDTO[];
  settlements: {
    id: string;
    timestamp: number;
    netVolume: string;
    compression: number;
    transfers: TransferDTO[];
  }[];
}

export interface ClearingClientOptions {
  contractId?: string;
  rpcUrl?: string;
  /** KeyPairString or Signer for signing calls (server-side). */
  signer?: KeyPairString | Signer;
  /** The account id that owns `signer` (required when signer is a KeyPairString). */
  signerAccountId?: string;
}

export class ClearingClient {
  readonly contractId: string;
  readonly provider: JsonRpcProvider;
  private account: Account | null = null;

  constructor(opts: ClearingClientOptions = {}) {
    this.contractId = opts.contractId ?? DEFAULT_CONTRACT_ID;
    this.provider = new JsonRpcProvider({ url: opts.rpcUrl ?? DEFAULT_RPC_URL });
    if (opts.signer) {
      if (!opts.signerAccountId) {
        throw new Error("signerAccountId is required when using a KeyPairString signer");
      }
      this.account = new Account(opts.signerAccountId, this.provider, opts.signer);
    }
  }

  /** Attach a signer later (e.g. after wallet login). */
  withSigner(signer: KeyPairString | Signer, accountId: string): ClearingClient {
    this.account = new Account(accountId, this.provider, signer);
    return this;
  }

  private async view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    const raw = (await this.provider.query({
      request_type: "call_function",
      account_id: this.contractId,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      finality: "final",
    })) as any;
    // The RPC returns the contract's JSON return value as base64 bytes.
    const decoded = Buffer.from(raw.result, "base64").toString("utf8");
    return JSON.parse(decoded) as T;
  }

  private static GAS: Record<string, bigint> = {
    // 80 TGas — enough for a 10-obligation batch (measured ~60); keeps the
    // prepay estimate low so a small agent balance stays sufficient.
    clear: BigInt("80000000000000"),
  };

  private async call(method: string, args: Record<string, unknown>, deposit = "0"): Promise<unknown> {
    if (!this.account) throw new Error("No signer attached — call withSigner() first");
    const gas = ClearingClient.GAS[method] ?? BigInt("30000000000000"); // 30 TGas default
    const res = (await this.account.signAndSendTransaction({
      receiverId: this.contractId,
      actions: [actions.functionCall(method, args, gas, BigInt(deposit))],
    })) as any;
    const success = res?.status?.SuccessValue;
    if (success === undefined) {
      throw new Error(`Transaction failed: ${JSON.stringify(res?.status)}`);
    }
    if (success === "") return undefined;
    return JSON.parse(Buffer.from(success, "base64").toString("utf8"));
  }

  /* ---------------- views ---------------- */

  getParticipants(): Promise<ParticipantProfile[]> {
    return this.view("get_participants");
  }

  getParticipant(accountId: string): Promise<ParticipantProfile | null> {
    return this.view("get_participant", { account_id: accountId });
  }

  getBalance(accountId: string): Promise<string> {
    return this.view("get_balance", { account_id: accountId });
  }

  getObligations(filter: { status?: string; account_id?: string; limit?: number } = {}): Promise<ObligationDTO[]> {
    return this.view("get_obligations", filter);
  }

  getSettlements(limit = 50): Promise<SettlementDTO[]> {
    return this.view("get_settlements", { limit });
  }

  getStats(): Promise<StatsDTO> {
    return this.view("get_stats");
  }

  computeNetPositions(includeNotDue = false): Promise<ClearingResultDTO> {
    return this.view("compute_net_positions", { include_not_due: includeNotDue });
  }

  getRisk(): Promise<RiskRow[]> {
    return this.view("get_risk");
  }

  getStatement(accountId: string): Promise<StatementDTO> {
    return this.view("get_statement", { account_id: accountId });
  }

  getCreditLimits(): Promise<{ accountId: string; creditLimit: string }[]> {
    return this.view("get_credit_limits");
  }

  getCollateralRatio(): Promise<number> {
    return this.view("get_collateral_ratio");
  }

  /* ---------------- calls ---------------- */

  async join(profile: { name: string; kind: string; bio: string; icon: string }): Promise<void> {
    await this.call("join", profile);
  }

  async deposit(amountYocto: string): Promise<void> {
    await this.call("deposit", {}, amountYocto);
  }

  async withdraw(amountYocto: string): Promise<void> {
    await this.call("withdraw", { amount: amountYocto });
  }

  async recordObligation(args: {
    debtor: string;
    creditor: string;
    amount: string;
    memo: string;
    dueAt?: number | null;
  }): Promise<string> {
    const res = (await this.call("record_obligation", {
      debtor: args.debtor,
      creditor: args.creditor,
      amount: args.amount,
      memo: args.memo,
      due_at: args.dueAt ?? null,
    })) as any;
    return res?.id ?? "";
  }

  async dispute(obligationId: string): Promise<void> {
    await this.call("dispute", { obligation_id: obligationId });
  }

  async resolveDispute(obligationId: string, outcome: "keep" | "void"): Promise<void> {
    await this.call("resolve_dispute", { obligation_id: obligationId, outcome });
  }

  async clear(includeNotDue = false, maxObligations?: number): Promise<ClearResult> {
    return (await this.call("clear", {
      include_not_due: includeNotDue,
      max_obligations: maxObligations,
    })) as ClearResult;
  }

  async setCreditLimit(accountId: string, limitYocto: string): Promise<void> {
    await this.call("set_credit_limit", { account_id: accountId, limit: limitYocto });
  }

  async setCollateralRatio(ratio: number): Promise<void> {
    await this.call("set_collateral_ratio", { ratio });
  }
}
