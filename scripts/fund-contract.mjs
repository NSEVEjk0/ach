/**
 * Fund the clearing contract account from a participant sub-account.
 * The contract account needs balance to stake for on-chain storage growth.
 * Usage: node scripts/fund-contract.mjs [amount]
 */
import { Account, JsonRpcProvider, actions, parseNearAmount } from "near-api-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTICIPANTS_PATH = path.join(__dirname, "participants.json");

const CONTRACT = process.env.ACH_FUND_TO ?? process.env.ACH_CONTRACT ?? "ach-clearing-v2.testnet";
const RPC_URL = process.env.ACH_RPC ?? "https://test.rpc.fastnear.com";
const FROM_ACCOUNT = process.env.ACH_FUND_FROM ?? "bob.ach-clearing-v2.testnet";
const AMOUNT = parseNearAmount(process.argv[2] ?? "0.25");

const participants = JSON.parse(readFileSync(PARTICIPANTS_PATH, "utf8"));
const from = participants[FROM_ACCOUNT];
if (!from) {
  console.error(`No key for ${FROM_ACCOUNT} in participants.json`);
  process.exit(1);
}

const provider = new JsonRpcProvider({ url: RPC_URL });
const account = new Account(FROM_ACCOUNT, provider, from.secretKey);

const res = await account.signAndSendTransaction({
  receiverId: CONTRACT,
  actions: [actions.transfer(AMOUNT)],
});

console.log(`Transferred ${process.argv[2] ?? "0.25"} Ⓝ from ${FROM_ACCOUNT} → ${CONTRACT}`);
console.log("Tx:", res.transaction?.hash ?? res.transaction_outcome?.id);

const state = await provider.query({
  request_type: "view_account",
  account_id: CONTRACT,
  finality: "final",
});
console.log("Contract balance now:", (BigInt(state.amount) / 10n ** 24n).toString(), "Ⓝ");
