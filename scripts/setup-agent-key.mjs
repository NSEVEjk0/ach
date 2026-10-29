/**
 * Give the ACH agent a least-privilege function-call key on the contract.
 *
 * NEAR function-call keys can only call a specified set of methods on a
 * specified contract — they cannot withdraw funds or change keys. This is the
 * "agents act without full keys" primitive from the README, demonstrated live.
 *
 * Usage: node scripts/setup-agent-key.mjs
 * Requires ACH_SECRET_KEY (owner) and ACH_AGENT_KEY (the agent's public key)
 * in the environment.
 */
import { Account, JsonRpcProvider, actions, KeyPair } from "near-api-js";

const ACCOUNT_ID = process.env.ACH_ACCOUNT_ID ?? "ach-clearing.testnet";
const SECRET_KEY = process.env.ACH_SECRET_KEY ?? "";
const AGENT_KEY = process.env.ACH_AGENT_KEY ?? "";

if (!SECRET_KEY || !AGENT_KEY) {
  console.error("Set ACH_SECRET_KEY and ACH_AGENT_KEY first.");
  process.exit(1);
}

const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });
const owner = new Account(ACCOUNT_ID, provider, SECRET_KEY);

// The agent's public key (derived from its secret key).
const agentPub = KeyPair.fromString(AGENT_KEY).getPublicKey();

// Function-call access: only `clear` (the one state-changing method the agent
// needs). Views are public and need no key. No allowance cap on gas.
const accessKey = actions.functionCallAccessKey(
  ACCOUNT_ID,
  ["clear"],
  null
);

const res = await owner.signAndSendTransaction({
  receiverId: ACCOUNT_ID,
  actions: [actions.addFunctionCallAccessKey(agentPub, accessKey)],
});

console.log("Function-call key added for the agent:");
console.log("  public key :", agentPub.toString());
console.log("  contract   :", ACCOUNT_ID);
console.log("  methods    : clear (only)");
console.log("  tx        :", res.transaction?.hash ?? res.transaction_outcome?.id);
console.log();
console.log("Verify with: curl -s https://test.rpc.fastnear.com/access_key/");
console.log(`${ACCOUNT_ID}/${agentPub.toString()}`);
