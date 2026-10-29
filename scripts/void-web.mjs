/**
 * Void all eligible open obligations (dispute + resolve=void) to reset the
 * obligation web. The accumulated web is too large for clear() to settle
 * within the 300 TGas protocol cap, so we void the stale obligations.
 *
 * Usage: node scripts/void-web.mjs
 */
import { Account, JsonRpcProvider, actions } from "near-api-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTICIPANTS_PATH = path.join(__dirname, "participants.json");

const CONTRACT = process.env.ACH_CONTRACT ?? "ach-clearing-v2.testnet";
const RPC_URL = process.env.ACH_RPC ?? "https://rpc.testnet.near.org";
const GAS = "10000000000000"; // 10 Tgas per action
const BATCH = 5; // obligations per tx (2 actions each)

const participants = JSON.parse(readFileSync(PARTICIPANTS_PATH, "utf8"));
const provider = new JsonRpcProvider({ url: RPC_URL });
const NAMES = ["alice", "bob", "carol", "dave"];
const signers = NAMES.map((n) => {
  const id = `${n}.ach-clearing-v2.testnet`;
  return { id, acc: new Account(id, provider, participants[id].secretKey) };
});

// Fetch open obligations.
const view = await provider.query({
  request_type: "call_function",
  account_id: CONTRACT,
  method_name: "get_obligations",
  args_base64: Buffer.from(JSON.stringify({ status: "open", limit: 500 })).toString("base64"),
  finality: "final",
});
const open = JSON.parse(Buffer.from(view.result).toString("utf8"));
const now = Date.now();
const eligible = open.filter((o) => o.dueAt === null || o.dueAt <= now);
console.log(`open: ${open.length}, eligible: ${eligible.length}`);

// Group eligible obligations by debtor (fallback creditor) so each batch is
// signed by a party entitled to dispute/resolve it.
const bySigner = new Map();
for (const o of eligible) {
  const debtor = o.debtor;
  const key = signers.find((s) => s.id === debtor) ?? signers.find((s) => s.id === o.creditor);
  if (!key) { console.log(`no signer for ${o.id}`); continue; }
  if (!bySigner.has(key.id)) bySigner.set(key.id, []);
  bySigner.get(key.id).push(o);
}

let done = 0;
let failed = 0;
for (const [signerId, list] of bySigner) {
  const signer = signers.find((s) => s.id === signerId);
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const actionsList = [];
    for (const o of batch) {
      actionsList.push(actions.functionCall("dispute", { obligation_id: o.id }, GAS, 0n));
      actionsList.push(actions.functionCall("resolve_dispute", { obligation_id: o.id, outcome: "void" }, GAS, 0n));
    }
    try {
      const res = await signer.acc.signAndSendTransaction({
        receiverId: CONTRACT,
        actions: actionsList,
      });
      const ok = res.status?.SuccessValue !== undefined;
      if (ok) { done += batch.length; console.log(`voided ${batch.length} (${done}/${eligible.length}) via ${signer.id}`); }
      else { failed += batch.length; console.log(`batch failed for ${batch.map(b => b.id).join(",")}`); }
    } catch (e) {
      failed += batch.length;
      console.log(`batch error (${batch.map(b => b.id).join(",")}): ${(e.message ?? e).slice(0, 120)}`);
    }
  }
}

console.log(`\ndone: ${done}, failed: ${failed}`);
