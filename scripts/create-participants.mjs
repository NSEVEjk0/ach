/**
 * Create participant sub-accounts under ach-clearing.testnet.
 * Each participant gets its own named sub-account + keypair + 5 NEAR.
 */
import { Account, JsonRpcProvider, KeyPair, actions, parseNearAmount } from "near-api-js";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const OWNER = process.env.ACH_ACCOUNT_ID ?? "ach-clearing.testnet";
const OWNER_KEY = process.env.ACH_SECRET_KEY ?? "";
const RPC_URL = "https://test.rpc.fastnear.com";
const OUT_FILE = new URL("./participants.json", import.meta.url).pathname;

const NAMES = ["alice", "bob", "carol", "dave"];
const FUNDING = parseNearAmount("0.25"); // 0.25 NEAR each (contract account has a storage stake)

const provider = new JsonRpcProvider({ url: RPC_URL });
const owner = new Account(OWNER, provider, OWNER_KEY);

async function main() {
  const existing = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, "utf8")) : {};
  const participants = { ...existing };

  for (const name of NAMES) {
    const accountId = `${name}.${OWNER}`;
    if (participants[accountId]) {
      console.log(`exists: ${accountId}`);
      continue;
    }
    const kp = KeyPair.fromRandom("ed25519");
    const publicKey = kp.getPublicKey();

    console.log(`creating ${accountId} ...`);
    await owner.createAccount({
      newAccountId: accountId,
      publicKey,
      nearToTransfer: BigInt(FUNDING),
    });

    participants[accountId] = { accountId, secretKey: kp.toString() };
    console.log(`  done: ${accountId}`);
  }

  writeFileSync(OUT_FILE, JSON.stringify(participants, null, 2));
  console.log(`\nSaved ${Object.keys(participants).length} participants to ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
