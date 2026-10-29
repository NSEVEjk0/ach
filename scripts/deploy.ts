/**
 * Deploy the clearing contract to NEAR testnet.
 * Usage: node scripts/deploy.ts
 */
import { connect, keyStores, KeyPair, utils } from "near-api-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACCOUNT_ID = process.env.ACH_ACCOUNT_ID ?? "ach-clearing.testnet";
const SECRET_KEY = process.env.ACH_SECRET_KEY ?? "";
const WASM_PATH = path.join(__dirname, "../contracts/clearing/build/clearing.wasm");

async function main() {
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey("testnet", ACCOUNT_ID, KeyPair.fromString(SECRET_KEY));

  const near = await connect({
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    keyStore,
  });

  const account = await near.account(ACCOUNT_ID);
  const wasm = readFileSync(WASM_PATH);

  console.log(`Deploying clearing.wasm (${wasm.length} bytes) to ${ACCOUNT_ID}...`);
  const result = await account.deployContract(wasm);
  console.log("Deploy tx:", result.transaction_outcome?.id ?? result);

  // verify code is live
  const state = await account.state();
  console.log("Account state:", {
    amount: state.amount,
    storageUsage: state.storage_usage,
    codeHash: state.code_hash,
  });

  // init the contract
  const initRes = await account.functionCall({
    contractId: ACCOUNT_ID,
    methodName: "init",
    args: { owner_id: ACCOUNT_ID },
    gas: utils.format.parseNearAmount("0.03") ? undefined : undefined,
  });
  console.log("init tx:", initRes.transaction_outcome?.id ?? initRes);
  console.log("Deploy + init complete ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
