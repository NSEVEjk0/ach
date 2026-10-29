/**
 * Deploy the clearing contract to NEAR testnet (near-api-js v7 API).
 * Usage: node scripts/deploy.mjs
 */
import { Account, JsonRpcProvider, actions } from "near-api-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACCOUNT_ID = process.env.ACH_ACCOUNT_ID ?? "ach-clearing.testnet";
const SECRET_KEY = process.env.ACH_SECRET_KEY ?? "";
const WASM_PATH = path.join(__dirname, "../contracts/clearing/build/clearing.wasm");

const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });
const account = new Account(ACCOUNT_ID, provider, SECRET_KEY);

const wasm = readFileSync(WASM_PATH);
console.log(`Deploying clearing.wasm (${wasm.length} bytes) to ${ACCOUNT_ID}...`);

const deployRes = await account.deployContract(wasm);
console.log("Deploy tx:", deployRes.transaction?.hash ?? deployRes.transaction_outcome?.id);

const initRes = await account.signAndSendTransaction({
  receiverId: ACCOUNT_ID,
  actions: [actions.functionCall("init", { owner_id: ACCOUNT_ID }, "30000000000000", "0")],
});
console.log("init tx:", initRes.transaction?.hash);

const state = await provider.query({
  request_type: "view_account",
  account_id: ACCOUNT_ID,
  finality: "final",
});
console.log("Account:", { amount: state.amount, codeHash: state.code_hash });
console.log("Deploy + init complete ✅");
