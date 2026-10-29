/**
 * ACH — multilateral netting engine
 *
 * Given a set of gross obligations (A owes B, B owes C, C owes A), compute
 * the minimal set of transfers that settles everyone's net position.
 *
 * This is the same core primitive banks have used for a century (and CLS
 * uses daily for FX, cutting funding needs by 90%+). We implement the
 * classic greedy matching: repeatedly pair the largest net debtor with the
 * largest net creditor until everyone is flat. This yields at most n-1
 * transfers for n participants — the theoretical minimum number of legs.
 */
import type { ClearingResult, NetPosition, NettingInput, Transfer } from "./types";
export declare function computeNetPositions(obligations: NettingInput): NetPosition[];
export declare function minimizeTransfers(positions: NetPosition[]): Transfer[];
export declare function clearObligations(obligations: NettingInput): ClearingResult;
/** Pretty-print a clearing result (used by the agent's reasoning log). */
export declare function formatClearing(result: ClearingResult): string;
