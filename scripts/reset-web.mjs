/**
 * Reset the obligation web: pool raw balances into the net debtor (alice),
 * deposit enough to cover her net debit, settle the entire web, and verify.
 * Usage: node scripts/reset-web.mjs
 */
import { Account, JsonRpcProvider, actions, parseNearAmount } from "near-api-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTICIPANTS_PATH = path.join(__dirname, "participants.json");

const CONTRACT = process.env.ACH_CONTRACT ?? "ach-clearing-v2.testnet";
const RPC_URL = process.env.ACH_RPC ?? "https://test.rpc.fastnear.com";
const AGENT_KEY = process.env.ACH_AGENT_KEY ?? "";
const AGENT_ACCOUNT = process.env.ACH_AGENT_ACCOUNT ?? "agent.ach-clearing-v2.testnet";

const participants = JSON.parse(readFileSync(PARTICIPANTS_PATH, "utf8"));
const provider = new JsonRpcProvider({ url: RPC_URL });

const account = (id, key) => new Account(id, provider, key);
const bal = async (id) => {
  const s = await provider.query({ request_type: "view_account", account_id: id, finality: "final" });
  return BigInt(s.amount);
};
const transfer = async (from, to, amountYocto) => {
  const res = await from.signAndSendTransaction({
    receiverId: to,
    actions: [actions.transfer(amountYocto)],
  });
  return res.transaction?.hash ?? res.transaction_outcome?.id;
};
const call = async (acc, method, args, deposit = "0") => {
  const res = await acc.signAndSendTransaction({
    receiverId: CONTRACT,
    actions: [actions.functionCall(method, args, "300000000000000", BigInt(deposit))],
  });
  return res;
};

// 1. Pool raw balances into alice from bob, carol, dave, agent.
const ALICE = "alice.ach-clearing-v2.testnet";
const poolers = [
  { id: "bob.ach-clearing-v2.testnet", key: participants["bob.ach-clearing-v2.testnet"]?.secretKey, amt: "0.15" },
  { id: "carol.ach-clearing-v2.testnet", key: participants["carol.ach-clearing-v2.testnet"]?.secretKey, amt: "0.25" },
  { id: "dave.ach-clearing-v2.testnet", key: participants["dave.ach-clearing-v2.testnet"]?.secretKey, amt: "0.04" },
  { id: AGENT_ACCOUNT, key: AGENT_KEY, amt: "0.29" },
];

for (const p of poolers) {
  if (!p.key) { console.log(`skip ${p.id} (no key)`); continue; }
  const from = account(p.id, p.key);
  const tx = await transfer(from, ALICE, parseNearAmount(p.amt));
  console.log(`transferred ${p.amt} Ⓝ ${p.id} → alice (${tx})`);
}

// 2. Alice deposits enough to cover her net debit (0.725 + buffer).
const alice = account(ALICE, participants[ALICE].secretKey);
const aliceBal = await bal(ALICE);
console.log("alice balance now:", (Number(aliceBal) / 1e24).toFixed(4), "Ⓝ");
const depositAmt = Math.min(Number(aliceBal) / 1e24, 0.78);
await call(alice, "deposit", {}, parseNearAmount(String(depositAmt)));
console.log(`alice deposited ${depositAmt.toFixed(4)} Ⓝ into contract`);

// 3. Settle the entire eligible web.
try {
  const cleared = await call(alice, "clear", { include_not_due: false });
  console.log("clear tx sent:", cleared.transaction?.hash ?? cleared.transaction_outcome?.id);
} catch (e) {
  console.error("clear failed:", e.message ?? e);
}

// 4. Verify state.
const net = await provider.query({
  request_type: "call_function",
  account_id: CONTRACT,
  method_name: "compute_net_positions",
  args_base64: Buffer.from("{}").toString("base64"),
  finality: "final",
});
try {
  const bytes = net.result.result;
  const str = Buffer.from(bytes).toString();
  const d = JSON.parse(str);
  console.log("open obligations:", d.obligationCount);
  console.log("transfers:", d.transfers.length);
  for (const t of d.transfers) console.log("  ", t.from, "→", t.to, (Number(t.amount) / 1e24).toFixed(4));
} catch {
  console.log("net view failed (web may be clear)");
}

for (const name of ["alice", "bob", "carol", "dave"]) {
  const id = `${name}.ach-clearing-v2.testnet`;
  const s = await provider.query({ request_type: "view_account", account_id: id, finality: "final" });
  console.log(id, "raw:", (Number(s.amount) / 1e24).toFixed(4), "Ⓝ");
}
