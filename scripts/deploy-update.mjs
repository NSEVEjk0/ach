/**
 * Deploy a new contract build WITHOUT re-initializing (state-preserving).
 * Usage: node scripts/deploy-update.mjs
 */
import { Account, JsonRpcProvider } from "near-api-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCOUNT_ID = process.env.ACH_CONTRACT ?? "ach-clearing-v2.testnet";
const SECRET_KEY = process.env.ACH_SECRET_KEY ?? "";
const WASM_PATH = path.join(__dirname, "../contracts/clearing/build/clearing.wasm");

const provider = new JsonRpcProvider({ url: process.env.ACH_RPC ?? "https://rpc.testnet.near.org" });
const account = new Account(ACCOUNT_ID, provider, SECRET_KEY);

const wasm = readFileSync(WASM_PATH);
console.log(`Deploying clearing.wasm (${wasm.length} bytes) to ${ACCOUNT_ID}...`);

const res = await account.deployContract(wasm);
console.log("Deploy tx:", res.transaction?.hash ?? res.transaction_outcome?.id);
const status = res.status?.SuccessValue !== undefined ? "OK" : JSON.stringify(res.status);
console.log("Status:", status);
