/**
 * ACH funding watchdog.
 *
 * The contract pays for its own storage and the agent prepays tx gas —
 * both need liquid testnet NEAR. When balances run low, operations fail
 * (the "demo failed" class of errors). This watchdog keeps them topped up
 * using the testnet helper, which funds new accounts with 10 NEAR.
 *
 * Run every 5 minutes via systemd timer.
 */
import { Account, JsonRpcProvider, KeyPair, actions, parseNearAmount } from "near-api-js";

const CONTRACT = process.env.ACH_CONTRACT ?? "ach-clearing-v2.testnet";
const AGENT = process.env.ACH_AGENT_ACCOUNT ?? "agent.ach-clearing-v2.testnet";
const RPC_URL = process.env.ACH_RPC ?? "https://rpc.testnet.near.org";
const HELPER = "https://helper.testnet.near.org";

const AGENT_MIN = 1.0; // Ⓝ free before topping up the agent
const CONTRACT_MIN = 1.5; // Ⓝ free before topping up the contract
const AGENT_TOPUP = 2.0;
const CONTRACT_TOPUP = 3.0;

const provider = new JsonRpcProvider({ url: RPC_URL });

async function freeBalance(accountId) {
  const s = await provider.query({ request_type: "view_account", account_id: accountId, finality: "final" });
  return (BigInt(s.amount) - BigInt(s.storage_usage) * 10n ** 19n) / 10n ** 24n;
}

async function createTempAccount() {
  const kp = KeyPair.fromRandom("ed25519");
  const id = `ach-watchdog-${Date.now()}-${Math.floor(Math.random() * 1e9)}.testnet`;
  const res = await fetch(`${HELPER}/account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newAccountId: id, newAccountPublicKey: kp.getPublicKey().toString() }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`helper create failed: ${res.status} ${body.slice(0, 120)}`);
  }
  return { id, key: kp.toString() };
}

const main = async () => {
  const agentFree = await freeBalance(AGENT);
  const contractFree = await freeBalance(CONTRACT);
  console.log(`[watchdog] agent free ${agentFree} Ⓝ, contract free ${contractFree} Ⓝ`);

  if (agentFree >= AGENT_MIN && contractFree >= CONTRACT_MIN) {
    console.log("[watchdog] healthy — no action");
    return;
  }

  const { id: tempId, key: tempKey } = await createTempAccount();
  const temp = new Account(tempId, provider, tempKey);
  console.log(`[watchdog] temp account ${tempId} created (10 Ⓝ)`);

  if (agentFree < AGENT_MIN) {
    await temp.signAndSendTransaction({
      receiverId: AGENT,
      actions: [actions.transfer(parseNearAmount(String(AGENT_TOPUP)))],
    });
    console.log(`[watchdog] agent topped up +${AGENT_TOPUP} Ⓝ`);
  }
  if (contractFree < CONTRACT_MIN) {
    await temp.signAndSendTransaction({
      receiverId: CONTRACT,
      actions: [actions.transfer(parseNearAmount(String(CONTRACT_TOPUP)))],
    });
    console.log(`[watchdog] contract topped up +${CONTRACT_TOPUP} Ⓝ`);
  }

  // Delete the temp account, recycling the remainder to the contract.
  try {
    const acc = await temp.account?.deleteAccount?.(CONTRACT);
    console.log(`[watchdog] temp account deleted → contract (${acc?.transaction_outcome?.id ?? "ok"})`);
  } catch (e) {
    console.log(`[watchdog] temp delete skipped: ${(e.message ?? e).slice(0, 80)}`);
  }
};

main().catch((e) => {
  console.error("[watchdog] error:", (e.message ?? e).slice(0, 200));
  process.exit(1);
});
