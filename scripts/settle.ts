/**
 * Settle a prediction market using the PNP SDK.
 *
 * Usage:
 *   import { settleMarket, getSettlementStatus, initClient } from "./settle";
 *   const client = initClient();
 *   await settleMarket(client, { conditionId: "0x...", outcome: "YES" });
 */

import { PNPClient } from "pnp-evm";

// Re-export shared helper
export { initClient } from "./create-market";
import { initClient } from "./create-market";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SettleParams {
  /** Market condition ID */
  conditionId: string;
  /** Winning outcome: "YES" or "NO" */
  outcome: "YES" | "NO";
}

export interface SettleResult {
  hash: string;
  winner: "YES" | "NO";
  conditionId: string;
}

export interface SettlementStatus {
  question: string;
  endTime: number;
  isSettled: boolean;
  canSettle: boolean;
  winner?: "YES" | "NO";
  timeLeftHours?: number;
  timeLeftMinutes?: number;
}

// ---------------------------------------------------------------------------
// Status check
// ---------------------------------------------------------------------------

/**
 * Check whether a market is settled, and if not, whether it can be settled now.
 */
export async function getSettlementStatus(
  client: PNPClient,
  conditionId: string
): Promise<SettlementStatus> {
  if (!conditionId) throw new Error("conditionId is required");

  const info = await client.market.getMarketInfo(conditionId);
  const isSettled = await client.redemption.isResolved(conditionId);
  const endTime = parseInt(info.endTime);
  const now = Math.floor(Date.now() / 1000);

  const status: SettlementStatus = {
    question: info.question,
    endTime,
    isSettled,
    canSettle: now >= endTime && !isSettled,
  };

  if (isSettled) {
    const winningToken = await client.redemption.getWinningToken(conditionId);
    const yesTokenId = await client.trading.getTokenId(conditionId, "YES");
    status.winner = winningToken === yesTokenId.toString() ? "YES" : "NO";
  } else if (now < endTime) {
    const remaining = endTime - now;
    status.timeLeftHours = Math.floor(remaining / 3600);
    status.timeLeftMinutes = Math.floor((remaining % 3600) / 60);
  }

  return status;
}

// ---------------------------------------------------------------------------
// Settle
// ---------------------------------------------------------------------------

/**
 * Settle a market with the winning outcome.
 * Only the market creator can call this, and only after the trading period has ended.
 *
 * @param client  - Initialised PNPClient
 * @param params  - Condition ID and winning outcome
 * @returns       - Transaction hash and settlement details
 */
export async function settleMarket(
  client: PNPClient,
  params: SettleParams
): Promise<SettleResult> {
  const { conditionId, outcome } = params;

  if (!conditionId) throw new Error("conditionId is required");
  if (outcome !== "YES" && outcome !== "NO") throw new Error("outcome must be YES or NO");

  // Pre-flight checks
  const status = await getSettlementStatus(client, conditionId);

  if (status.isSettled) {
    throw new Error(`Market is already settled. Winner: ${status.winner}`);
  }

  if (!status.canSettle) {
    throw new Error(
      `Cannot settle yet. Trading ends in ${status.timeLeftHours}h ${status.timeLeftMinutes}m`
    );
  }

  console.log("\n--- Settling Market ---");
  console.log(`Question: ${status.question}`);
  console.log(`Outcome:  ${outcome}`);
  console.log(`Wallet:   ${client.client.signer?.address}\n`);

  const winningTokenId = await client.trading.getTokenId(conditionId, outcome);
  const result = await client.market.settleMarket(conditionId, winningTokenId);

  console.log("Market Settled!");
  console.log(`Winner:   ${outcome}`);
  console.log(`Tx Hash:  ${result.hash}`);
  console.log(`BaseScan: https://basescan.org/tx/${result.hash}\n`);

  return { hash: result.hash, winner: outcome, conditionId };
}

// ---------------------------------------------------------------------------
// Standalone entry-point
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const client = initClient();
    const conditionId = process.argv[2];
    if (!conditionId) {
      console.log("Usage: npx ts-node settle.ts <conditionId>");
      console.log("This will display settlement status.");
      process.exit(0);
    }

    const status = await getSettlementStatus(client, conditionId);
    console.log("--- Settlement Status ---");
    console.log(JSON.stringify(status, null, 2));
  })().catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
}
