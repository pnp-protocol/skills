/**
 * Redeem winning tokens for collateral after market settlement using the PNP SDK.
 *
 * Usage:
 *   import { redeemWinnings, initClient } from "./redeem";
 *   const client = initClient();
 *   await redeemWinnings(client, "0x<conditionId>");
 */

import { PNPClient } from "pnp-evm";

// Re-export shared helper
export { initClient } from "./create-market";
import { initClient } from "./create-market";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RedeemResult {
  hash: string;
  conditionId: string;
  winner: "YES" | "NO";
  question: string;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Redeem winning outcome tokens for collateral.
 * The market must be settled and the caller must hold winning tokens.
 *
 * @param client      - Initialised PNPClient
 * @param conditionId - Market condition ID
 * @returns           - Transaction hash and redemption details
 */
export async function redeemWinnings(
  client: PNPClient,
  conditionId: string
): Promise<RedeemResult> {
  if (!conditionId) throw new Error("conditionId is required");

  // Check settlement status
  const isSettled = await client.redemption.isResolved(conditionId);
  if (!isSettled) {
    const info = await client.market.getMarketInfo(conditionId);
    throw new Error(
      `Market is not yet settled. Question: "${info.question}". Cannot redeem.`
    );
  }

  // Get winning info
  const info = await client.market.getMarketInfo(conditionId);
  const winningToken = await client.redemption.getWinningToken(conditionId);
  const yesTokenId = await client.trading.getTokenId(conditionId, "YES");
  const winner: "YES" | "NO" = winningToken === yesTokenId.toString() ? "YES" : "NO";

  console.log("\n--- Redeeming Winnings ---");
  console.log(`Question:   ${info.question}`);
  console.log(`Winner:     ${winner}`);
  console.log(`Collateral: ${info.collateral}`);
  console.log(`Wallet:     ${client.client.signer?.address}\n`);

  const result = await client.redemption.redeem(conditionId);

  console.log("Redemption Successful!");
  console.log(`Tx Hash:  ${result.hash}`);
  console.log(`BaseScan: https://basescan.org/tx/${result.hash}\n`);

  return { hash: result.hash, conditionId, winner, question: info.question };
}

// ---------------------------------------------------------------------------
// Standalone entry-point
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const client = initClient();
    const conditionId = process.argv[2];
    if (!conditionId) {
      console.log("Usage: npx ts-node redeem.ts <conditionId>");
      process.exit(0);
    }

    const result = await redeemWinnings(client, conditionId);
    console.log("--- JSON OUTPUT ---");
    console.log(JSON.stringify(result, null, 2));
  })().catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
}
