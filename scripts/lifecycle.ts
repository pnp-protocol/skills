/**
 * Full prediction market lifecycle: Create → Trade → Settle → Redeem
 *
 * Demonstrates the complete PNP SDK flow using exported functions
 * from the individual modules. Loads PRIVATE_KEY from environment.
 *
 * Usage:
 *   export PRIVATE_KEY=<your_private_key>
 *   export RPC_URL=<optional_base_rpc>      # defaults to public RPC
 *   npx ts-node lifecycle.ts
 */

import { ethers } from "ethers";
import { initClient, createMarket } from "./create-market";
import { buyTokens, sellTokens, getMarketInfo } from "./trade";
import { settleMarket, getSettlementStatus } from "./settle";
import { redeemWinnings } from "./redeem";

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  // 1. INITIALISE CLIENT (loads PRIVATE_KEY + RPC_URL from env)
  // -----------------------------------------------------------------------
  console.log("=== PNP Market Lifecycle Demo ===\n");
  const client = initClient();
  console.log(`Wallet: ${client.client.signer?.address}\n`);

  // -----------------------------------------------------------------------
  // 2. CREATE MARKET
  // -----------------------------------------------------------------------
  console.log("STEP 1 — Create Market");
  const market = await createMarket(client, {
    question: "Will ETH reach $10k by Dec 2025?",
    durationHours: 168, // 7 days
    liquidity: "100",
    collateral: "USDC",
  });
  console.log(`Condition ID: ${market.conditionId}\n`);

  // -----------------------------------------------------------------------
  // 3. CHECK MARKET INFO
  // -----------------------------------------------------------------------
  console.log("STEP 2 — Check Market Info");
  const info = await getMarketInfo(client, market.conditionId);
  console.log(`Question:  ${info.question}`);
  console.log(`YES Price: ${info.yesPrice}`);
  console.log(`NO Price:  ${info.noPrice}\n`);

  // -----------------------------------------------------------------------
  // 4. BUY YES TOKENS
  // -----------------------------------------------------------------------
  console.log("STEP 3 — Buy YES tokens");
  const buyResult = await buyTokens(client, {
    conditionId: market.conditionId,
    outcome: "YES",
    amount: "10",
    decimals: 6, // USDC has 6 decimals
  });
  console.log(`Buy tx: ${buyResult.hash}\n`);

  // -----------------------------------------------------------------------
  // 5. SELL SOME YES TOKENS
  // -----------------------------------------------------------------------
  console.log("STEP 4 — Sell some YES tokens");
  const sellResult = await sellTokens(client, {
    conditionId: market.conditionId,
    outcome: "YES",
    amount: "2",
    decimals: 18, // outcome tokens are always 18 decimals
  });
  console.log(`Sell tx: ${sellResult.hash}\n`);

  // -----------------------------------------------------------------------
  // 6. CHECK SETTLEMENT STATUS
  // -----------------------------------------------------------------------
  console.log("STEP 5 — Check Settlement Status");
  const status = await getSettlementStatus(client, market.conditionId);
  console.log(`Can settle: ${status.canSettle}`);
  if (!status.canSettle && !status.isSettled) {
    console.log(
      `Time remaining: ${status.timeLeftHours}h ${status.timeLeftMinutes}m`
    );
  }
  console.log();

  // -----------------------------------------------------------------------
  // 7. SETTLE (only works after endTime — skipped in demo if too early)
  // -----------------------------------------------------------------------
  if (status.canSettle) {
    console.log("STEP 6 — Settle Market");
    const settleResult = await settleMarket(client, {
      conditionId: market.conditionId,
      outcome: "YES",
    });
    console.log(`Settle tx: ${settleResult.hash}\n`);

    // ---------------------------------------------------------------------
    // 8. REDEEM WINNINGS
    // ---------------------------------------------------------------------
    console.log("STEP 7 — Redeem Winnings");
    const redeemResult = await redeemWinnings(client, market.conditionId);
    console.log(`Redeem tx: ${redeemResult.hash}\n`);
  } else {
    console.log(
      "STEP 6 — Settle & Redeem skipped (trading period has not ended yet)."
    );
    console.log(
      "Run settle and redeem separately after the market end time.\n"
    );
  }

  // -----------------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------------
  console.log("=== Lifecycle Complete ===");
  console.log(JSON.stringify({
    conditionId: market.conditionId,
    createTx: market.hash,
    buyTx: buyResult.hash,
    sellTx: sellResult.hash,
    endTime: new Date(market.endTime * 1000).toISOString(),
  }, null, 2));
}

main().catch((err) => {
  console.error("\nLifecycle failed:", err.message);
  process.exit(1);
});
