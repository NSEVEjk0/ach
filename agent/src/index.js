/**
 * ACH Agent — the autonomous clearing house operator.
 *
 * The agent watches the clearing contract, analyzes the web of obligations,
 * and settles rounds when it finds a worthwhile compression opportunity with
 * all debtors funded. It keeps a reasoning log so humans can audit every
 * decision — the "AI judge" equivalent of a clearing house's back office.
 *
 * It also exposes the billing seam: agents arrive at debts by delivering
 * services and billing each other. POST /bill records that obligation on-chain
 * (signed by the debtor), so the clearing engine has real debts to net.
 *
 * Run: node src/index.js
 * API: GET /status, GET /log, GET /net, GET /stats
 *      POST /bill {debtor, creditor, amount, memo}  — record an obligation
 *      POST /demo/run {rounds?}                     — scripted agent commerce
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ClearingClient, nearToYocto } from "@ach/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTICIPANTS_PATH = path.join(__dirname, "../../scripts/participants.json");

const CONTRACT = process.env.ACH_CONTRACT ?? "ach-clearing.testnet";
const RPC_URL = process.env.ACH_RPC ?? "https://test.rpc.fastnear.com";
const SIGNER_KEY = process.env.ACH_AGENT_KEY;
const SIGNER_ACCOUNT = process.env.ACH_AGENT_ACCOUNT ?? "ach-clearing.testnet";
const POLL_MS = Number(process.env.ACH_POLL_MS ?? 15000);
const MIN_COMPRESSION = Number(process.env.ACH_MIN_COMPRESSION ?? 0.1);
const PORT = Number(process.env.ACH_AGENT_PORT ?? 4170);
const HOLD_LOG_COOLDOWN_MS = 5 * 60 * 1000; // log a "hold" at most every 5 min
const AMBIENT_INTERVAL_MS = 3 * 60 * 1000; // keep the web alive every ~3 min
const AMBIENT_MIN_OPEN = 4; // don't add if at least this many are open
const AMBIENT_MAX_OPEN = 6; // top up to at most this many open obligations

/** Participant sub-accounts (the demo agents) — loaded for billing. */
function loadParticipants() {
  try {
    return JSON.parse(readFileSync(PARTICIPANTS_PATH, "utf8"));
  } catch {
    return {};
  }
}

class ClearingAgent {
  constructor() {
    this.client = new ClearingClient({
      contractId: CONTRACT,
      rpcUrl: RPC_URL,
      signer: SIGNER_KEY,
      signerAccountId: SIGNER_ACCOUNT,
    });
    this.log = [];
    this.startedAt = Date.now();
    this.lastRun = null;
    this.running = false;
    this.demoLock = false;
    this.lastHoldAt = 0;
    this.lastHoldOpen = -1;
    this.lastAmbientAt = 0;
    this.stats = {
      roundsSettled: 0,
      grossSettled: 0n,
      netSettled: 0n,
      errors: 0,
    };
  }

  logEvent(kind, detail) {
    const entry = { t: Date.now(), kind, ...detail };
    this.log.push(entry);
    if (this.log.length > 500) this.log.shift();
    console.log(`[agent] ${kind}:`, JSON.stringify(detail).slice(0, 300));
    return entry;
  }

  /** Format a yoctoNEAR bigint as a readable Ⓝ number. */
  fmtNear(yocto) {
    return (Number(yocto) / 1e24).toFixed(3);
  }

  async tick() {
    if (this.running) return;
    if (this.demoLock) return; // demo owns the flow while it runs
    this.running = true;
    try {
      const [open, net] = await Promise.all([
        this.client.getObligations({ status: "open" }),
        this.client.computeNetPositions(),
      ]);
      this.lastRun = {
        at: Date.now(),
        openCount: open.length,
        grossVolume: net.grossVolume,
        netVolume: net.netVolume,
        compression: net.compression,
        transfers: net.transfers,
      };

      if (open.length === 0) {
        // Coalesce: only log the idle state when it changes or every 5 min.
        if (this.lastHoldOpen !== 0 || Date.now() - this.lastHoldAt > HOLD_LOG_COOLDOWN_MS) {
          this.logEvent("observe", { open: 0, note: "no open obligations" });
          this.lastHoldAt = Date.now();
          this.lastHoldOpen = 0;
        }
        return;
      }

      const gross = BigInt(net.grossVolume);
      const netVol = BigInt(net.netVolume);

      if (gross > 0n && netVol > 0n && Number(netVol) / Number(gross) < 1 - MIN_COMPRESSION) {
        const compressionPct = Math.round((1 - Number(netVol) / Number(gross)) * 1000) / 10;
        this.logEvent("propose", {
          open: open.length,
          gross: gross.toString(),
          net: netVol.toString(),
          compression: compressionPct,
          transfers: net.transfers.length,
          note: `${open.length} open obligations (${this.fmtNear(gross)} Ⓝ gross) net to ${net.transfers.length} transfers (${this.fmtNear(netVol)} Ⓝ net) — ${compressionPct}% compression, above the ${Math.round(MIN_COMPRESSION * 100)}% threshold`,
        });

        // check funding before attempting clearance
        const shortfalls = [];
        for (const t of net.transfers) {
          const bal = BigInt(await this.client.getBalance(t.from));
          if (bal < BigInt(t.amount)) shortfalls.push(t.from);
        }
        if (shortfalls.length > 0) {
          this.logEvent("defer", {
            reason: "underfunded",
            shortfalls,
            note: `proposal would require ${shortfalls.length} net debtor(s) to pay more than they hold — holding until funded`,
          });
          return;
        }

        let cleared;
        try {
          // clear() settles in batches of 50 (300 TGas protocol cap); loop
          // until the whole eligible web is done.
          cleared = await this.client.clear();
          let guard = 0;
          while (cleared.remaining > 0 && guard < 20) {
            cleared = await this.client.clear();
            guard += 1;
          }
        } catch (e) {
          const msg = String(e.message ?? e);
          // Another actor (e.g. the guided demo) settled the same round first —
          // that's fine, not an error.
          if (msg.includes("Nothing to clear")) {
            this.logEvent("hold", {
              open: open.length,
              note: "round was already settled by another actor — nothing to clear",
            });
            this.lastHoldOpen = -1;
            return;
          }
          throw e;
        }
        this.stats.roundsSettled += 1;
        this.stats.grossSettled += BigInt(cleared.grossVolume);
        this.stats.netSettled += BigInt(cleared.netVolume);
        const settleCompression = Math.round(cleared.compression * 1000) / 10;
        this.logEvent("settle", {
          roundId: cleared.roundId,
          gross: cleared.grossVolume,
          net: cleared.netVolume,
          compression: settleCompression,
          transfers: cleared.transfers.length,
          note: `${cleared.roundId} settled atomically on-chain: ${cleared.transfers.length} net transfers moved ${this.fmtNear(BigInt(cleared.netVolume))} Ⓝ instead of ${this.fmtNear(BigInt(cleared.grossVolume))} Ⓝ gross — ${settleCompression}% of volume cut`,
        });
        this.lastHoldOpen = -1;
      } else {
        // Coalesce holds: only log when the open-count changes or every 5 min.
        if (open.length !== this.lastHoldOpen || Date.now() - this.lastHoldAt > HOLD_LOG_COOLDOWN_MS) {
          this.logEvent("hold", {
            open: open.length,
            note: "no material compression opportunity yet",
          });
          this.lastHoldAt = Date.now();
          this.lastHoldOpen = open.length;
        }
      }
    } catch (e) {
      this.stats.errors += 1;
      this.logEvent("error", { message: String(e.message ?? e).slice(0, 200) });
    } finally {
      this.running = false;
    }
  }

  /**
   * Ambient activity: keep the obligation web alive so the explorer never
   * looks empty. Every ~3 minutes, if there are fewer than 4 open
   * obligations, bill a couple of small service debts between random
   * participants — exactly what agents do in the wild.
   */
  async ambientBills() {
    if (this.demoLock) return;
    const now = Date.now();
    if (now - this.lastAmbientAt < AMBIENT_INTERVAL_MS) return;
    this.lastAmbientAt = now;

    try {
      const open = await this.client.getObligations({ status: "open" });
      // Only obligations that are due now can be cleared — future-dated
      // scheduled invoices don't create a netting opportunity yet.
      const now = Date.now();
      const clearable = open.filter((o) => o.dueAt === null || o.dueAt <= now);
      if (clearable.length >= AMBIENT_MIN_OPEN) return;

      const participants = loadParticipants();
      const names = Object.keys(participants);
      if (names.length < 2) return;

      const services = ["data feed", "API access", "compute", "subtask", "referral", "hosting", "model inference"];
      const count = AMBIENT_MAX_OPEN - clearable.length;
      // Prefer cycles: A→B, B→C, C→A creates a netting opportunity, so the
      // agent has something to propose and settle — that's the story.
      const cycle = count >= 3 && names.length >= 3;
      if (cycle) {
        const shuffled = [...names].sort(() => Math.random() - 0.5).slice(0, 3);
        for (let i = 0; i < 3; i++) {
          const debtor = shuffled[i].split(".")[0];
          const creditor = shuffled[(i + 1) % 3].split(".")[0];
          const amount = (0.004 + Math.random() * 0.012).toFixed(4);
          const memo = services[Math.floor(Math.random() * services.length)];
          await this.bill({ debtor, creditor, amountNear: Number(amount), memo });
        }
        console.log(`[agent] ambient: seeded a 3-way cycle (${open.length} → ${open.length + 3} open)`);
        return;
      }
      for (let i = 0; i < count; i++) {
        const debtor = names[Math.floor(Math.random() * names.length)].split(".")[0];
        let creditor = names[Math.floor(Math.random() * names.length)].split(".")[0];
        if (creditor === debtor) creditor = names[(names.indexOf(debtor + "." + CONTRACT) + 1) % names.length].split(".")[0];
        const amount = (0.003 + Math.random() * 0.02).toFixed(4);
        const memo = services[Math.floor(Math.random() * services.length)];
        await this.bill({ debtor, creditor, amountNear: Number(amount), memo });
      }
      console.log(`[agent] ambient: billed ${count} small obligations (${open.length} → ${open.length + count} open)`);
    } catch (e) {
      console.log(`[agent] ambient error: ${String(e.message ?? e).slice(0, 120)}`);
    }
  }

  start() {
    console.log(`[agent] watching ${CONTRACT} every ${POLL_MS}ms (min compression ${MIN_COMPRESSION})`);
    setInterval(() => this.tick(), POLL_MS);
    // first tick after a short delay
    setTimeout(() => this.tick(), 2000);
    setInterval(() => this.ambientBills(), 60000);
    this.ambientBills();
  }

  /* ---------------------------------------------------------------- */
  /* Billing seam — how agents arrive at debts                         */
  /* ---------------------------------------------------------------- */

  /** A client that signs as a specific participant (debtor/creditor). */
  participantClient(accountId) {
    const participants = loadParticipants();
    const fullId = `${accountId}.${CONTRACT}`;
    const p = participants[fullId] ?? participants[accountId];
    if (!p) throw new Error(`Unknown participant ${accountId}`);
    return new ClearingClient({
      contractId: CONTRACT,
      rpcUrl: RPC_URL,
      signer: p.secretKey,
      signerAccountId: p.accountId,
    });
  }

  /**
   * Record a debt: one agent delivered a service to another, so the debtor
   * signs an obligation on-chain. This is the moment a "debt" is born.
   */
  async bill({ debtor, creditor, amountNear, memo, dueAt = null }) {
    const client = this.participantClient(debtor);
    const participants = loadParticipants();
    const debtorAcct = participants[`${debtor}.${CONTRACT}`]?.accountId ?? participants[debtor]?.accountId;
    const creditorAcct = participants[`${creditor}.${CONTRACT}`]?.accountId ?? participants[creditor]?.accountId;
    if (!debtorAcct || !creditorAcct) throw new Error("Unknown participant");
    const id = await client.recordObligation({
      debtor: debtorAcct,
      creditor: creditorAcct,
      amount: nearToYocto(String(amountNear)),
      memo: memo ?? "service delivered",
      dueAt,
    });
    this.logEvent("bill", { id, debtor, creditor, amount: amountNear, memo: memo ?? "service delivered", dueAt });
    return { id, debtor, creditor, amount: amountNear, memo: memo ?? "service delivered", dueAt };
  }

  /**
   * Guided demo — "The DAO month-end".
   *
   * A fixed, believable scenario: four contributors traded services for a
   * month. The agent observes the web, computes the minimal settlement, checks
   * funding, settles atomically — and deliberately holds one scheduled
   * obligation until it is due. Returns the full story for the UI to play
   * back step by step.
   */
  async runDemo() {
    const participants = loadParticipants();
    const names = Object.keys(participants);
    if (names.length < 4) throw new Error("Need at least 4 participants for the demo");

    this.demoLock = true; // pause the watcher so the demo owns the flow
    try {
      return await this._runDemoLocked();
    } finally {
      this.demoLock = false;
    }
  }

  async _runDemoLocked() {

    // Fixed scenario — deterministic, believable amounts.
    const scenario = [
      ["alice", "bob", 0.02, "research"],
      ["bob", "carol", 0.015, "design"],
      ["carol", "alice", 0.01, "compute"],
      ["dave", "bob", 0.006, "hosting"],
      ["alice", "dave", 0.009, "infra"],
      ["bob", "alice", 0.012, "scheduled invoice"], // due in 2 days — held
    ];

    const bills = [];
    const now = Date.now();
    for (const [debtor, creditor, amount, memo] of scenario) {
      const dueAt = memo.includes("scheduled") ? now + 2 * 24 * 3600 * 1000 : null;
      const bill = await this.bill({ debtor, creditor, amountNear: amount, memo, dueAt });
      bills.push(bill);
    }

    // The agent's reasoning, step by step.
    const steps = [];
    steps.push({ kind: "observe", detail: `${bills.length} obligations across 4 agents` });

    const net = await this.client.computeNetPositions();
    const gross = Number(net.grossVolume);
    const netVol = Number(net.netVolume);
    const compression = gross > 0 ? 1 - netVol / gross : 0;
    steps.push({
      kind: "propose",
      detail: {
        gross: gross / 1e24,
        net: netVol / 1e24,
        compression: Math.round(compression * 1000) / 10,
        transfers: net.transfers.length,
      },
    });

    // Funding check.
    const shortfalls = [];
    for (const t of net.transfers) {
      const bal = BigInt(await this.client.getBalance(t.from));
      if (bal < BigInt(t.amount)) shortfalls.push(t.from);
    }
    steps.push({
      kind: "funding",
      detail: shortfalls.length === 0 ? "all net debtors funded" : `underfunded: ${shortfalls.join(", ")}`,
    });

    let cleared = null;
    let note = null;
    if (net.transfers.length > 0 && shortfalls.length === 0) {
      try {
        cleared = await this.client.clear();
        let guard = 0;
        while (cleared.remaining > 0 && guard < 20) {
          cleared = await this.client.clear();
          guard += 1;
        }
        steps.push({
          kind: "settle",
          detail: {
            roundId: cleared.roundId,
            transfers: cleared.transfers.length,
            gross: Number(cleared.grossVolume) / 1e24,
            net: Number(cleared.netVolume) / 1e24,
            compression: Math.round((1 - Number(cleared.netVolume) / Number(cleared.grossVolume)) * 1000) / 10,
          },
        });
      } catch (e) {
        const msg = String(e.message ?? e);
        if (msg.includes("Nothing to clear")) {
          note = "already settled by the watcher";
          const rounds = await this.client.getSettlements(1);
          if (rounds.length > 0) cleared = rounds[0];
          steps.push({ kind: "settle", detail: { roundId: cleared.id, note } });
        } else {
          throw e;
        }
      }
    }

    // The scheduled obligation is deliberately held until due.
    steps.push({
      kind: "defer",
      detail: "1 scheduled obligation held until due (2 days) — the agent won't settle early",
    });

    return {
      ok: true,
      scenario: "The DAO month-end",
      bills,
      steps,
      grossVolume: net.grossVolume,
      netVolume: net.netVolume,
      compression: net.compression,
      cleared,
      note,
    };
  }
}

const agent = new ClearingAgent();
agent.start();

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("bad json"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/status") {
    res.end(JSON.stringify({ contract: CONTRACT, running: agent.running, lastRun: agent.lastRun }));
  } else if (req.url === "/log") {
    res.end(JSON.stringify(agent.log.slice(-100)));
  } else if (req.url === "/net") {
    agent.client.computeNetPositions().then((net) => res.end(JSON.stringify(net))).catch((e) => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e.message ?? e) }));
    });
  } else if (req.url === "/stats") {
    const gross = agent.stats.grossSettled;
    const net = agent.stats.netSettled;
    res.end(
      JSON.stringify({
        contract: CONTRACT,
        startedAt: agent.startedAt,
        uptimeMs: Date.now() - agent.startedAt,
        roundsSettled: agent.stats.roundsSettled,
        grossSettled: gross.toString(),
        netSettled: net.toString(),
        compressionSaved: gross > 0n ? Math.round((1 - Number(net) / Number(gross)) * 1000) / 10 : 0,
        errors: agent.stats.errors,
        lastRun: agent.lastRun,
      })
    );
  } else if (req.method === "POST" && req.url === "/bill") {
    readBody(req)
      .then((body) =>
        agent.bill({
          debtor: body.debtor,
          creditor: body.creditor,
          amountNear: body.amount,
          memo: body.memo,
        })
      )
      .then((bill) => res.end(JSON.stringify({ ok: true, bill })))
      .catch((e) => {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(e.message ?? e) }));
      });
  } else if (req.method === "POST" && req.url === "/demo/run") {
    readBody(req)
      .then((body) => agent.runDemo({ rounds: body.rounds ?? 1 }))
      .then((story) => res.end(JSON.stringify({ ok: true, ...story })))
      .catch((e) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(e.message ?? e) }));
      });
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(PORT, () => console.log(`[agent] API on :${PORT}`));
