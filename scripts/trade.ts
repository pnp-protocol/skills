/**
 * Trade on a prediction market (buy / sell YES or NO tokens) using the PNP SDK.
 *
 * Usage:
 *   import { buyTokens, sellTokens, getMarketInfo, initClient } from "./trade";
 *   const client = initClient();
 *   await buyTokens(client, { conditionId: "0x...", outcome: "YES", amount: "10" });
 */

import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

// Re-export shared helper
export { initClient } from "./create-market";
import { initClient } from "./create-market";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TradeParams {
  /** Market condition ID */
  conditionId: string;
  /** Outcome to trade: "YES" or "NO" */
  outcome: "YES" | "NO";
  /** Human-readable amount (e.g. "10") */
  amount: string;
  /** Collateral token decimals (default 6 for buying with USDC, 18 for selling outcome tokens) */
  decimals?: number;
  /** Minimum output for slippage protection (human-readable, default "0") */
  minOut?: string;
}

export interface TradeResult {
  hash: string;
  action: "buy" | "sell";
  outcome: "YES" | "NO";
  amount: string;
  updatedPrices: { yes: string; no: string };
}

export interface MarketInfo {
  question: string;
  endTime: string;
  isSettled: boolean;
  yesPrice: string;
  noPrice: string;
  reserve: string;
  collateral: string;
}

// ---------------------------------------------------------------------------
// Market info helper
// ---------------------------------------------------------------------------

/**
 * Fetch current market information and prices.
 */
export async function getMarketInfo(
  client: PNPClient,
  conditionId: string
): Promise<MarketInfo> {
  if (!conditionId) throw new Error("conditionId is required");

  const info = await client.market.getMarketInfo(conditionId);
  const prices = await client.market.getMarketPrices(conditionId);

  return {
    question: info.question,
    endTime: info.endTime,
    isSettled: info.isSettled,
    yesPrice: prices.yesPricePercent,
    noPrice: prices.noPricePercent,
    reserve: info.reserve,
    collateral: info.collateral,
  };
}

// ---------------------------------------------------------------------------
// Buy
// ---------------------------------------------------------------------------

/**
 * Buy outcome tokens with collateral.
 *
 * @param client      - Initialised PNPClient
 * @param params      - Trade parameters
 * @returns           - Transaction hash and updated prices
 */
export async function buyTokens(
  client: PNPClient,
  params: TradeParams
): Promise<TradeResult> {
  const { conditionId, outcome, amount, decimals = 6, minOut = "0" } = params;

  if (!conditionId) throw new Error("conditionId is required");
  if (outcome !== "YES" && outcome !== "NO") throw new Error("outcome must be YES or NO");
  if (!amount || parseFloat(amount) <= 0) throw new Error("amount must be positive");

  // Pre-flight: check market is tradeable
  const info = await client.market.getMarketInfo(conditionId);
  const now = Math.floor(Date.now() / 1000);
  if (now >= parseInt(info.endTime)) throw new Error("Market trading period has ended");
  if (info.isSettled) throw new Error("Market is already settled");

  const amountWei = ethers.parseUnits(amount, decimals);
  const minOutWei = ethers.parseUnits(minOut, 18); // outcome tokens are 18 decimals

  console.log("\n--- Buying Outcome Tokens ---");
  console.log(`Market:   ${info.question}`);
  console.log(`Action:   BUY ${outcome}`);
  console.log(`Amount:   ${amount}`);
  console.log(`Wallet:   ${client.client.signer?.address}\n`);

  const result = await client.trading.buy(conditionId, amountWei, outcome, minOutWei);

  const newPrices = await client.market.getMarketPrices(conditionId);

  console.log("Trade Executed!");
  console.log(`Tx Hash:  ${result.hash}`);
  console.log(`BaseScan: https://basescan.org/tx/${result.hash}`);
  console.log(`Updated:  YES ${newPrices.yesPricePercent} | NO ${newPrices.noPricePercent}\n`);

  return {
    hash: result.hash,
    action: "buy",
    outcome,
    amount,
    updatedPrices: { yes: newPrices.yesPricePercent, no: newPrices.noPricePercent },
  };
}

// ---------------------------------------------------------------------------
// Sell
// ---------------------------------------------------------------------------

/**
 * Sell outcome tokens for collateral.
 *
 * @param client      - Initialised PNPClient
 * @param params      - Trade parameters (decimals default 18 for outcome tokens)
 * @returns           - Transaction hash and updated prices
 */
export async function sellTokens(
  client: PNPClient,
  params: TradeParams
): Promise<TradeResult> {
  const { conditionId, outcome, amount, decimals = 18, minOut = "0" } = params;

  if (!conditionId) throw new Error("conditionId is required");
  if (outcome !== "YES" && outcome !== "NO") throw new Error("outcome must be YES or NO");
  if (!amount || parseFloat(amount) <= 0) throw new Error("amount must be positive");

  const info = await client.market.getMarketInfo(conditionId);
  const now = Math.floor(Date.now() / 1000);
  if (now >= parseInt(info.endTime)) throw new Error("Market trading period has ended");
  if (info.isSettled) throw new Error("Market is already settled");

  const amountWei = ethers.parseUnits(amount, decimals);
  const minOutWei = ethers.parseUnits(minOut, 6); // collateral decimals

  console.log("\n--- Selling Outcome Tokens ---");
  console.log(`Market:   ${info.question}`);
  console.log(`Action:   SELL ${outcome}`);
  console.log(`Amount:   ${amount}`);
  console.log(`Wallet:   ${client.client.signer?.address}\n`);

  const result = await client.trading.sell(conditionId, amountWei, outcome, minOutWei);

  const newPrices = await client.market.getMarketPrices(conditionId);

  console.log("Trade Executed!");
  console.log(`Tx Hash:  ${result.hash}`);
  console.log(`BaseScan: https://basescan.org/tx/${result.hash}`);
  console.log(`Updated:  YES ${newPrices.yesPricePercent} | NO ${newPrices.noPricePercent}\n`);

  return {
    hash: result.hash,
    action: "sell",
    outcome,
    amount,
    updatedPrices: { yes: newPrices.yesPricePercent, no: newPrices.noPricePercent },
  };
}

// ---------------------------------------------------------------------------
// Standalone entry-point
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const client = initClient();

    // Example: fetch market info for a condition ID passed as first arg
    const conditionId = process.argv[2];
    if (!conditionId) {
      console.log("Usage: npx ts-node trade.ts <conditionId>");
      console.log("This will display market info. Import buyTokens/sellTokens for trading.");
      process.exit(0);
    }

    const info = await getMarketInfo(client, conditionId);
    console.log("--- Market Info ---");
    console.log(JSON.stringify(info, null, 2));
  })().catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
}
