/**
 * ACH — typed client for the clearing contract on NEAR.
 *
 * Works with near-api-js v7. Views are public; calls require a signer
 * (a KeyPairString for server-side use, or a wallet-backed signer in the
 * browser).
 */
import { Account, JsonRpcProvider, actions } from "near-api-js";
export const DEFAULT_RPC_URL = "https://test.rpc.fastnear.com";
export const DEFAULT_CONTRACT_ID = "ach-clearing.testnet";
export const YOCTO_PER_NEAR = 1000000000000000000000000n;
export const nearToYocto = (near) => (BigInt(Math.round(Number(near) * 1e24))).toString();
export class ClearingClient {
    contractId;
    provider;
    account = null;
    constructor(opts = {}) {
        this.contractId = opts.contractId ?? DEFAULT_CONTRACT_ID;
        this.provider = new JsonRpcProvider({ url: opts.rpcUrl ?? DEFAULT_RPC_URL });
        if (opts.signer) {
            if (!opts.signerAccountId) {
                throw new Error("signerAccountId is required when using a KeyPairString signer");
            }
            this.account = new Account(opts.signerAccountId, this.provider, opts.signer);
        }
    }
    /** Attach a signer later (e.g. after wallet login). */
    withSigner(signer, accountId) {
        this.account = new Account(accountId, this.provider, signer);
        return this;
    }
    async view(method, args = {}) {
        const raw = (await this.provider.query({
            request_type: "call_function",
            account_id: this.contractId,
            method_name: method,
            args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
            finality: "final",
        }));
        // The RPC returns the contract's JSON return value as base64 bytes.
        const decoded = Buffer.from(raw.result, "base64").toString("utf8");
        return JSON.parse(decoded);
    }
    static GAS = {
        // 80 TGas — enough for a 10-obligation batch (measured ~60); keeps the
        // prepay estimate low so a small agent balance stays sufficient.
        clear: BigInt("80000000000000"),
    };
    async call(method, args, deposit = "0") {
        if (!this.account)
            throw new Error("No signer attached — call withSigner() first");
        const gas = ClearingClient.GAS[method] ?? BigInt("30000000000000"); // 30 TGas default
        const res = (await this.account.signAndSendTransaction({
            receiverId: this.contractId,
            actions: [actions.functionCall(method, args, gas, BigInt(deposit))],
        }));
        const success = res?.status?.SuccessValue;
        if (success === undefined) {
            throw new Error(`Transaction failed: ${JSON.stringify(res?.status)}`);
        }
        if (success === "")
            return undefined;
        return JSON.parse(Buffer.from(success, "base64").toString("utf8"));
    }
    /* ---------------- views ---------------- */
    getParticipants() {
        return this.view("get_participants");
    }
    getParticipant(accountId) {
        return this.view("get_participant", { account_id: accountId });
    }
    getBalance(accountId) {
        return this.view("get_balance", { account_id: accountId });
    }
    getObligations(filter = {}) {
        return this.view("get_obligations", filter);
    }
    getSettlements(limit = 50) {
        return this.view("get_settlements", { limit });
    }
    getStats() {
        return this.view("get_stats");
    }
    computeNetPositions(includeNotDue = false) {
        return this.view("compute_net_positions", { include_not_due: includeNotDue });
    }
    getRisk() {
        return this.view("get_risk");
    }
    getStatement(accountId) {
        return this.view("get_statement", { account_id: accountId });
    }
    getCreditLimits() {
        return this.view("get_credit_limits");
    }
    getCollateralRatio() {
        return this.view("get_collateral_ratio");
    }
    /* ---------------- calls ---------------- */
    async join(profile) {
        await this.call("join", profile);
    }
    async deposit(amountYocto) {
        await this.call("deposit", {}, amountYocto);
    }
    async withdraw(amountYocto) {
        await this.call("withdraw", { amount: amountYocto });
    }
    async recordObligation(args) {
        const res = (await this.call("record_obligation", {
            debtor: args.debtor,
            creditor: args.creditor,
            amount: args.amount,
            memo: args.memo,
            due_at: args.dueAt ?? null,
        }));
        return res?.id ?? "";
    }
    async dispute(obligationId) {
        await this.call("dispute", { obligation_id: obligationId });
    }
    async resolveDispute(obligationId, outcome) {
        await this.call("resolve_dispute", { obligation_id: obligationId, outcome });
    }
    async clear(includeNotDue = false, maxObligations) {
        return (await this.call("clear", {
            include_not_due: includeNotDue,
            max_obligations: maxObligations,
        }));
    }
    async setCreditLimit(accountId, limitYocto) {
        await this.call("set_credit_limit", { account_id: accountId, limit: limitYocto });
    }
    async setCollateralRatio(ratio) {
        await this.call("set_collateral_ratio", { ratio });
    }
}
