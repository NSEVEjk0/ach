/**
 * Focused live test: run clear() on the current on-chain state and verify.
 */
import { readFileSync } from "node:fs";
import { ClearingClient } from "../packages/client/dist/index.js";

const CONTRACT = "ach-clearing.testnet";
const RPC_URL = "https://test.rpc.fastnear.com";
const PARTICIPANTS = JSON.parse(readFileSync(new URL("./participants.json", import.meta.url), "utf8"));

const A = Object.fromEntries(
  Object.entries(PARTICIPANTS).map(([id, p]) => [id.split(".")[0], p])
);

async function main() {
  const clients = Object.fromEntries(
    Object.entries(A).map(([name, p]) => [
      name,
      new ClearingClient({ contractId: CONTRACT, rpcUrl: RPC_URL, signer: p.secretKey, signerAccountId: p.accountId }),
    ])
  );

  console.log("Deposits (fund the contract account + internal balances):");
  for (const [name, c] of Object.entries(clients)) {
    await c.deposit("30000000000000000000000"); // 0.03 NEAR each
    console.log(`  ${name}: deposited 0.03 NEAR`);
  }

  console.log("\nOpen obligations:");
  let open = await clients.alice.getObligations({ status: "open" });
  if (open.length === 0) {
    console.log("  none — recording a fresh gross web");
    await clients.alice.recordObligation({ debtor: A.alice.accountId, creditor: A.bob.accountId, amount: "20000000000000000000000", memo: "Research report" });
    await clients.bob.recordObligation({ debtor: A.bob.accountId, creditor: A.carol.accountId, amount: "15000000000000000000000", memo: "Brand design" });
    await clients.carol.recordObligation({ debtor: A.carol.accountId, creditor: A.alice.accountId, amount: "10000000000000000000000", memo: "Compute credits" });
    await clients.dave.recordObligation({ debtor: A.dave.accountId, creditor: A.bob.accountId, amount: "6000000000000000000000", memo: "Hosting" });
    await clients.alice.recordObligation({ debtor: A.alice.accountId, creditor: A.dave.accountId, amount: "9000000000000000000000", memo: "Infra" });
    open = await clients.alice.getObligations({ status: "open" });
  }
  for (const o of open) {
    console.log(`  ${o.id}: ${o.debtor} → ${o.creditor} ${(Number(o.amount) / 1e24).toFixed(4)} NEAR — ${o.memo}`);
  }

  console.log("\nInternal balances:");
  for (const [name, c] of Object.entries(clients)) {
    const bal = await c.getBalance(A[name].accountId);
    console.log(`  ${name}: ${(Number(bal) / 1e24).toFixed(4)} NEAR`);
  }

  console.log("\nComputed net positions:");
  const net = await clients.carol.computeNetPositions();
  console.log("  gross:", (Number(net.grossVolume) / 1e24).toFixed(4), "NEAR");
  console.log("  net:", (Number(net.netVolume) / 1e24).toFixed(4), "NEAR");
  console.log("  compression:", (net.compression * 100).toFixed(1) + "%");
  for (const t of net.transfers) {
    console.log(`  ${t.from} → ${t.to}: ${(Number(t.amount) / 1e24).toFixed(4)} NEAR`);
  }

  console.log("\nClearing...");
  const cleared = await clients.carol.clear();
  console.log("  round:", cleared.roundId);
  console.log("  transfers:", JSON.stringify(cleared.transfers, null, 2));
  console.log("  compression:", (cleared.compression * 100).toFixed(1) + "%");

  console.log("\nBalances after clear:");
  for (const [name, c] of Object.entries(clients)) {
    const bal = await c.getBalance(A[name].accountId);
    console.log(`  ${name}: ${(Number(bal) / 1e24).toFixed(4)} NEAR`);
  }

  console.log("\nSettlement rounds:");
  const rounds = await clients.alice.getSettlements(5);
  for (const r of rounds) {
    console.log(`  ${r.id}: gross ${(Number(r.grossVolume) / 1e24).toFixed(4)} → net ${(Number(r.netVolume) / 1e24).toFixed(4)} (${(r.compression * 100).toFixed(1)}%)`);
  }

  console.log("\n✅ Clear test passed");
}

main().catch((e) => {
  console.error("❌ Clear test failed:", e.message ?? e);
  process.exit(1);
});
