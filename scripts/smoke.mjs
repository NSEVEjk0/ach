/**
 * Live smoke test against the deployed testnet contract.
 * Uses the participant sub-accounts from participants.json and runs the
 * full join → deposit → obligations → net → clear flow.
 */
import { readFileSync } from "node:fs";
import { ClearingClient, nearToYocto } from "../packages/client/dist/index.js";

const CONTRACT = process.env.ACH_CONTRACT ?? "ach-clearing.testnet";
const RPC_URL = "https://test.rpc.fastnear.com";
const PARTICIPANTS = JSON.parse(readFileSync(new URL("./participants.json", import.meta.url), "utf8"));

const A = Object.fromEntries(
  Object.entries(PARTICIPANTS).map(([id, p]) => [id.split(".")[0], p])
);

async function main() {
  console.log("Participants:", Object.keys(A).join(", "));

  const clients = Object.fromEntries(
    Object.entries(A).map(([name, p]) => [
      name,
      new ClearingClient({ contractId: CONTRACT, rpcUrl: RPC_URL, signer: p.secretKey, signerAccountId: p.accountId }),
    ])
  );

  console.log("\n1. Join participants");
  const existing = await clients.alice.getParticipants();
  const existingIds = new Set(existing.map((p) => p.accountId));
  for (const [name, p] of Object.entries(A)) {
    if (existingIds.has(p.accountId)) {
      console.log(`  ${name}: already joined`);
      continue;
    }
    const profiles = {
      alice: { name: "Alice", kind: "analyst", bio: "Market research agent", icon: "🤖" },
      bob: { name: "Bob", kind: "data", bio: "Data pipeline agent", icon: "⚙️" },
      carol: { name: "Carol", kind: "designer", bio: "Design agent", icon: "🎨" },
      dave: { name: "Dave", kind: "infra", bio: "Infra agent", icon: "🖥️" },
    };
    await clients[name].join(profiles[name]);
    console.log(`  ${name}: joined ✅`);
  }

  console.log("\n2. Reset: void any open obligations and withdraw balances");
  const allObligations = await clients.alice.getObligations({});
  for (const obl of allObligations) {
    if (obl.status !== "open") continue;
    const caller = obl.debtor === A.alice.accountId ? clients.alice : obl.debtor === A.bob.accountId ? clients.bob : obl.debtor === A.carol.accountId ? clients.carol : clients.dave;
    try {
      await caller.dispute(obl.id);
      await caller.resolveDispute(obl.id, "void");
      console.log(`  voided ${obl.id}`);
    } catch (e) {
      console.log(`  skip ${obl.id}: ${String(e.message ?? e).slice(0, 80)}`);
    }
  }
  // Withdraw is best-effort: the contract must keep its storage stake, so if
  // its free balance is thin we skip rather than fail the whole sweep.
  const contractState = await clients.alice.provider.query({
    request_type: "view_account",
    account_id: CONTRACT,
    finality: "final",
  });
  const freeBalance = BigInt(contractState.amount) - BigInt(contractState.storage_usage) * 10_000_000_000_000_000_000n;
  for (const [name, c] of Object.entries(clients)) {
    const bal = BigInt(await c.getBalance(A[name].accountId));
    if (bal > 0n) {
      if (bal > freeBalance) {
        console.log(`  ${name}: skip withdraw ${(Number(bal) / 1e24).toFixed(4)} NEAR (contract free balance ${(Number(freeBalance) / 1e24).toFixed(4)} — keeping storage stake)`);
        continue;
      }
      await c.withdraw(bal.toString());
      console.log(`  ${name} withdrew ${(Number(bal) / 1e24).toFixed(4)} NEAR`);
    }
  }

  console.log("\n3. Deposits (adaptive — deposit 40% of each account's balance)");
  for (const [name, c] of Object.entries(clients)) {
    const state = await c.provider.query({
      request_type: "view_account",
      account_id: A[name].accountId,
      finality: "final",
    });
    const balance = BigInt(state.amount);
    const depositAmt = (balance * 40n) / 100n;
    await c.deposit(depositAmt.toString());
    console.log(`  ${name}: deposited ${(Number(depositAmt) / 1e24).toFixed(4)} NEAR (balance ${(Number(balance) / 1e24).toFixed(4)})`);
  }

  console.log("\n4. Record obligations (gross web)");
  await clients.alice.recordObligation({ debtor: A.alice.accountId, creditor: A.bob.accountId, amount: nearToYocto("0.02"), memo: "Research report" });
  await clients.bob.recordObligation({ debtor: A.bob.accountId, creditor: A.carol.accountId, amount: nearToYocto("0.015"), memo: "Brand design" });
  await clients.carol.recordObligation({ debtor: A.carol.accountId, creditor: A.alice.accountId, amount: nearToYocto("0.01"), memo: "Compute credits" });
  await clients.dave.recordObligation({ debtor: A.dave.accountId, creditor: A.bob.accountId, amount: nearToYocto("0.006"), memo: "Hosting" });
  await clients.alice.recordObligation({ debtor: A.alice.accountId, creditor: A.dave.accountId, amount: nearToYocto("0.009"), memo: "Infra" });
  console.log("  recorded 5 obligations ✅");

  console.log("\n5. Compute net positions");
  const net = await clients.carol.computeNetPositions();
  console.log("  gross:", (Number(net.grossVolume) / 1e24).toFixed(4), "NEAR | net:", (Number(net.netVolume) / 1e24).toFixed(4), "NEAR | compression:", (net.compression * 100).toFixed(1) + "%");
  console.log("  transfers:", JSON.stringify(net.transfers, null, 2));

  console.log("\n6. Clear (triggered by Carol)");
  const cleared = await clients.carol.clear();
  console.log("  round:", cleared.roundId);
  console.log("  transfers:", JSON.stringify(cleared.transfers));

  console.log("\n7. Verify balances");
  for (const [name, c] of Object.entries(clients)) {
    const bal = await c.getBalance(A[name].accountId);
    console.log(`  ${name}: ${(Number(bal) / 1e24).toFixed(4)} NEAR`);
  }

  console.log("\n8. Settlement history");
  const rounds = await clients.alice.getSettlements(5);
  console.log("  rounds:", rounds.length);
  if (rounds.length) {
    console.log("  latest:", rounds[0].id, "| compression:", (rounds[0].compression * 100).toFixed(1) + "%");
  }

  console.log("\n9. Stats");
  const stats = await clients.alice.getStats();
  console.log("  ", stats);

  console.log("\n✅ Smoke test passed");
}

main().catch((e) => {
  console.error("❌ Smoke test failed:", e);
  process.exit(1);
});
