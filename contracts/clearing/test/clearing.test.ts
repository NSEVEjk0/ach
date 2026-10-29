import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Worker, NearAccount } from "near-workspaces";

const CONTRACT_WASM = new URL("../build/clearing.wasm", import.meta.url).pathname;

describe("ACH clearing contract", () => {
  let worker: Worker;
  let root: NearAccount;
  let clearing: NearAccount;
  let alice: NearAccount;
  let bob: NearAccount;
  let carol: NearAccount;
  let dave: NearAccount;

  beforeAll(async () => {
    worker = await Worker.init();
    root = worker.rootAccount;
    clearing = await root.devDeploy(CONTRACT_WASM);

    alice = await root.createSubAccount("alice");
    bob = await root.createSubAccount("bob");
    carol = await root.createSubAccount("carol");
    dave = await root.createSubAccount("dave");

    await clearing.call(clearing, "init", { owner_id: root.accountId });
  });

  afterAll(async () => {
    await worker.tearDown();
  });

  async function join(acct: NearAccount, name: string, kind = "agent") {
    await acct.call(clearing, "join", { name, kind, bio: "test participant", icon: "🤖" });
  }

  async function deposit(acct: NearAccount, amount: string) {
    await acct.call(clearing, "deposit", {}, { attachedDeposit: amount });
  }

  async function recordObligation(
    caller: NearAccount,
    debtor: string,
    creditor: string,
    amount: string,
    memo: string,
    dueAt: number | null = null
  ) {
    return caller.call(clearing, "record_obligation", {
      debtor,
      creditor,
      amount,
      memo,
      due_at: dueAt,
    });
  }

  describe("registration", () => {
    it("lets participants join", async () => {
      await join(alice, "Alice");
      await join(bob, "Bob");
      await join(carol, "Carol");
      await join(dave, "Dave");
      const participants = await clearing.view("get_participants");
      expect(participants.length).toBe(4);
    });

    it("rejects duplicate registration", async () => {
      await expect(join(alice, "Alice Again")).rejects.toThrow();
    });

    it("rejects invalid names", async () => {
      await expect(join(dave, "X")).rejects.toThrow();
    });
  });

  describe("deposits & withdrawals", () => {
    it("accepts deposits and tracks balance", async () => {
      await deposit(alice, "1000000000000000000000000"); // 1 NEAR
      const bal = await clearing.view("get_balance", { account_id: alice.accountId });
      expect(bal).toBe("1000000000000000000000000");
    });

    it("rejects deposits from non-participants", async () => {
      const stranger = await root.createSubAccount("stranger");
      await expect(
        stranger.call(clearing, "deposit", {}, { attachedDeposit: "1000000000000000000000000" })
      ).rejects.toThrow();
    });

    it("withdraws back to the account", async () => {
      const before = await alice.balance();
      await alice.call(clearing, "withdraw", { amount: "500000000000000000000000" });
      const after = await alice.balance();
      expect(after.total - before.total).toBeGreaterThan(0);
      const bal = await clearing.view("get_balance", { account_id: alice.accountId });
      expect(bal).toBe("500000000000000000000000");
    });

    it("rejects over-withdrawal", async () => {
      await expect(
        alice.call(clearing, "withdraw", { amount: "999999999999999999999999999999" })
      ).rejects.toThrow();
    });
  });

  describe("obligations", () => {
    it("records an obligation between parties", async () => {
      const res = await recordObligation(alice, alice.accountId, bob.accountId, "300000000000000000000000", "design work");
      expect(res.id).toMatch(/^obl-/);
      const list = await clearing.view("get_obligations", {});
      expect(list.length).toBe(1);
      expect(list[0].debtor).toBe(alice.accountId);
      expect(list[0].amount).toBe("300000000000000000000000");
    });

    it("rejects obligations from non-parties", async () => {
      await expect(
        recordObligation(carol, alice.accountId, bob.accountId, "100", "nope")
      ).rejects.toThrow();
    });

    it("rejects self-obligations", async () => {
      await expect(
        recordObligation(alice, alice.accountId, alice.accountId, "100", "self")
      ).rejects.toThrow();
    });

    it("rejects unregistered parties", async () => {
      const stranger = await root.createSubAccount("stranger2");
      await expect(
        recordObligation(stranger, stranger.accountId, bob.accountId, "100", "x")
      ).rejects.toThrow();
    });

    it("disputes and resolves", async () => {
      const list = await clearing.view("get_obligations", {});
      const id = list[0].id;
      await bob.call(clearing, "dispute", { obligation_id: id });
      let obl = (await clearing.view("get_obligations", { status: "disputed" }))[0];
      expect(obl.id).toBe(id);

      await bob.call(clearing, "resolve_dispute", { obligation_id: id, outcome: "keep" });
      obl = (await clearing.view("get_obligations", { status: "open" })).find((o: any) => o.id === id);
      expect(obl).toBeTruthy();
    });
  });

  describe("clearing", () => {
    it("computes net positions correctly", async () => {
      // reset: clear existing obligations by settling them
      const view = await clearing.view("compute_net_positions", {});
      expect(view).toHaveProperty("positions");
      expect(view).toHaveProperty("transfers");
    });

    it("settles a three-way cycle atomically", async () => {
      // reset balances to zero so this test is deterministic
      await alice.call(clearing, "withdraw", { amount: "500000000000000000000000" });

      // alice owes bob 300 (existing), bob owes carol 200, carol owes alice 100
      await recordObligation(bob, bob.accountId, carol.accountId, "200000000000000000000000", "data");
      await recordObligation(carol, carol.accountId, alice.accountId, "100000000000000000000000", "compute");

      // fund the net debtors: alice net -200, bob net +100? no — bob is net +100, so only alice needs funding
      await deposit(alice, "200000000000000000000000");

      const view = await clearing.view("compute_net_positions", {});
      expect(view.grossVolume).toBe("600000000000000000000000");
      // positions: alice -200, bob +100, carol +100 → transfers: alice→carol 100, alice→bob 100
      expect(view.netVolume).toBe("200000000000000000000000");
      expect(view.transfers.length).toBe(2);
      expect(view.transfers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ from: alice.accountId, to: carol.accountId, amount: "100000000000000000000000" }),
          expect.objectContaining({ from: alice.accountId, to: bob.accountId, amount: "100000000000000000000000" }),
        ])
      );

      const res = await carol.call(clearing, "clear", {});
      expect(res.roundId).toMatch(/^round-/);
      expect(res.transfers.length).toBe(2);

      const aliceBal = await clearing.view("get_balance", { account_id: alice.accountId });
      const bobBal = await clearing.view("get_balance", { account_id: bob.accountId });
      const carolBal = await clearing.view("get_balance", { account_id: carol.accountId });
      expect(aliceBal).toBe("0");
      expect(bobBal).toBe("100000000000000000000000");
      expect(carolBal).toBe("100000000000000000000000");

      const settled = await clearing.view("get_obligations", { status: "settled" });
      expect(settled.length).toBe(3);

      const rounds = await clearing.view("get_settlements", {});
      expect(rounds.length).toBe(1);
      expect(rounds[0].compression).toBeCloseTo(200 / 600, 5);
      // timestamp must be a real block-derived ms value, not 0 (Date.now() is
      // unimplemented in the NEAR JS VM — we read the block timestamp instead)
      expect(rounds[0].timestamp).toBeGreaterThan(0);
      expect(rounds[0].timestamp).toBeLessThan(Date.now() + 60_000);
    });

    it("fails when nothing to clear", async () => {
      await expect(carol.call(clearing, "clear", {})).rejects.toThrow(/Nothing to clear/);
    });

    it("fails when a debtor is underfunded", async () => {
      // alice has 0 balance; make her owe 1 NEAR to dave
      await recordObligation(alice, alice.accountId, dave.accountId, "1000000000000000000000000", "big invoice");
      await expect(carol.call(clearing, "clear", {})).rejects.toThrow(/Risk check failed/);
    });
  });

  describe("risk controls", () => {
    it("enforces credit limits", async () => {
      // alice owes dave 1 NEAR (existing). Set her limit to 0.5 NEAR → clear must fail.
      await root.call(clearing, "set_credit_limit", {
        account_id: alice.accountId,
        limit: "500000000000000000000000",
      });
      await expect(carol.call(clearing, "clear", {})).rejects.toThrow(/credit limit/);

      // Raise the limit above her net debit → clear succeeds.
      await root.call(clearing, "set_credit_limit", {
        account_id: alice.accountId,
        limit: "2000000000000000000000000",
      });
      await deposit(alice, "1000000000000000000000000");
      const res = await carol.call(clearing, "clear", {});
      expect(res.roundId).toMatch(/^round-/);
    });

    it("only the owner can set credit limits", async () => {
      await expect(
        alice.call(clearing, "set_credit_limit", {
          account_id: bob.accountId,
          limit: "100",
        })
      ).rejects.toThrow(/Only the owner/);
    });

    it("enforces the collateral ratio", async () => {
      // bob owes carol 200 (settled already? no — create fresh obligations).
      await recordObligation(bob, bob.accountId, carol.accountId, "200000000000000000000000", "collateral test");
      // bob has 100 (from earlier settlement). Set ratio 2.0 → needs 400 → fails.
      await root.call(clearing, "set_collateral_ratio", { ratio: 2 });
      await expect(carol.call(clearing, "clear", {})).rejects.toThrow(/collateral/);
      // Reset ratio to 1.
      await root.call(clearing, "set_collateral_ratio", { ratio: 1 });
    });

    it("produces participant statements", async () => {
      const st = await clearing.view("get_statement", { account_id: alice.accountId });
      expect(st.accountId).toBe(alice.accountId);
      expect(st).toHaveProperty("balance");
      expect(st).toHaveProperty("grossPayable");
      expect(st).toHaveProperty("grossReceivable");
      expect(st).toHaveProperty("netPosition");
      expect(Array.isArray(st.openOutgoing)).toBe(true);
      expect(Array.isArray(st.settlements)).toBe(true);
    });

    it("produces a risk summary", async () => {
      const risk = await clearing.view("get_risk");
      expect(risk.length).toBeGreaterThanOrEqual(4);
      const aliceRisk = risk.find((r: any) => r.accountId === alice.accountId);
      expect(aliceRisk).toHaveProperty("balance");
      expect(aliceRisk).toHaveProperty("creditLimit");
      expect(aliceRisk).toHaveProperty("collateralRequired");
      expect(typeof aliceRisk.covered).toBe("boolean");
    });
  });
});
