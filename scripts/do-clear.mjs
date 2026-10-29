/**
 * Trigger a settlement round as alice (the funded net debtor).
 * Usage: node scripts/do-clear.mjs
 */
import { Account, JsonRpcProvider, actions } from "near-api-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTICIPANTS_PATH = path.join(__dirname, "participants.json");

const CONTRACT = process.env.ACH_CONTRACT ?? "ach-clearing-v2.testnet";
const RPC_URL = process.env.CLEAR_RPC ?? "https://rpc.testnet.near.org";
const ALICE = "alice.ach-clearing-v2.testnet";

const participants = JSON.parse(readFileSync(PARTICIPANTS_PATH, "utf8"));
const provider = new JsonRpcProvider({ url: RPC_URL });
const alice = new Account(ALICE, provider, participants[ALICE].secretKey);

const GAS = process.env.CLEAR_GAS ?? "100000000000000"; // 100 TGas
const res = await alice.signAndSendTransaction({
  receiverId: CONTRACT,
  actions: [actions.functionCall("clear", { include_not_due: false }, GAS, 0n)],
});
console.log("clear tx:", res.transaction?.hash ?? res.transaction_outcome?.id);
const status = res.status?.SuccessValue ?? res.status;
if (typeof status === "string" && status) {
  const d = JSON.parse(Buffer.from(status, "base64").toString("utf8"));
  console.log("round:", d.roundId);
  console.log("obligations:", d.obligationCount, "| transfers:", d.transfers.length, "| compression:", (d.compression * 100).toFixed(1) + "%");
  for (const t of d.transfers) console.log("  ", t.from, "→", t.to, (Number(t.amount) / 1e24).toFixed(4));
} else {
  console.log("status:", JSON.stringify(res.status));
}
