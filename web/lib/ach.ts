/**
 * Server-side data access for the ACH clearing contract.
 * Views are public — we read them straight from the RPC.
 */

export const CONTRACT_ID = process.env.ACH_CONTRACT ?? "ach-clearing.testnet";
export const RPC_URL = process.env.ACH_RPC ?? "https://test.rpc.fastnear.com";
export const AGENT_URL = process.env.ACH_AGENT_URL ?? "http://127.0.0.1:4170";

async function rpc(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }),
    next: { revalidate: 5 },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export async function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const raw = await rpc({
    method: "query",
    params: {
      request_type: "call_function",
      account_id: CONTRACT_ID,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      finality: "final",
    },
  });
  return JSON.parse(Buffer.from(raw.result, "base64").toString("utf8")) as T;
}

export interface Participant {
  accountId: string;
  name: string;
  kind: string;
  bio: string;
  icon: string;
  createdAt: number;
}

export interface Obligation {
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

export interface Transfer {
  from: string;
  to: string;
  amount: string;
}

export interface NetResult {
  positions: { accountId: string; net: string }[];
  transfers: Transfer[];
  grossVolume: string;
  netVolume: string;
  compression: number;
  obligationCount: number;
  obligationIds: string[];
}

export interface Settlement {
  id: string;
  timestamp: number;
  grossVolume: string;
  netVolume: string;
  compression: number;
  obligationCount: number;
  obligationIds: string[];
  transfers: Transfer[];
}

export interface Stats {
  ownerId: string;
  participantCount: number;
  obligationCount: number;
  openObligations: number;
  settlementCount: number;
  totalSettledVolume: string;
}

export const getStats = () => view<Stats>("get_stats");
export const getParticipants = () => view<Participant[]>("get_participants");
export const getObligations = (filter: { status?: string; account_id?: string; limit?: number } = {}) =>
  view<Obligation[]>("get_obligations", filter);
export const getSettlements = (limit = 50) => view<Settlement[]>("get_settlements", { limit });
export const getNet = () => view<NetResult>("compute_net_positions", { include_not_due: false });
export const getBalance = (accountId: string) => view<string>("get_balance", { account_id: accountId });

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

export interface Statement {
  accountId: string;
  name: string;
  kind: string;
  balance: string;
  creditLimit: string;
  grossPayable: string;
  grossReceivable: string;
  netPosition: string;
  openIncoming: Obligation[];
  openOutgoing: Obligation[];
  settlements: { id: string; timestamp: number; netVolume: string; compression: number; transfers: Transfer[] }[];
}

export const getRisk = () => view<RiskRow[]>("get_risk");
export const getStatement = (accountId: string) => view<Statement>("get_statement", { account_id: accountId });
export const getCreditLimits = () =>
  view<{ accountId: string; creditLimit: string }[]>("get_credit_limits");
export const getCollateralRatio = () => view<number>("get_collateral_ratio");

export const yoctoToNear = (y: string | number | bigint) => Number(y) / 1e24;

export async function getAgentLog(): Promise<any[]> {
  try {
    const res = await fetch(`${AGENT_URL}/log`, { next: { revalidate: 3 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface AgentStats {
  contract: string;
  startedAt: number;
  uptimeMs: number;
  roundsSettled: number;
  grossSettled: string;
  netSettled: string;
  compressionSaved: number;
  errors: number;
  lastRun: { at: number; openCount: number; grossVolume: string; netVolume: string; compression: number; transfers: Transfer[] } | null;
}

export async function getAgentStats(): Promise<AgentStats | null> {
  try {
    const res = await fetch(`${AGENT_URL}/stats`, { next: { revalidate: 3 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
