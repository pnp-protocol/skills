/**
 * Create a prediction market on Base using the PNP SDK.
 *
 * Usage:
 *   import { createMarket, initClient } from "./create-market";
 *   const client = initClient();
 *   const result = await createMarket(client, { question: "...", durationHours: 168, liquidity: "100" });
 */

import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Well-known collateral tokens on Base Mainnet
// ---------------------------------------------------------------------------
export const TOKENS: Record<string, { address: string; decimals: number }> = {
  USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  cbETH: { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18 },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CreateMarketParams {
  /** The prediction question */
  question: string;
  /** Trading duration in hours */
  durationHours: number;
  /** Initial liquidity amount (human-readable, e.g. "100") */
  liquidity: string;
  /** Collateral token symbol (USDC, WETH, cbETH) or contract address */
  collateral?: string;
  /** Token decimals – auto-detected for known tokens */
  decimals?: number;
}

export interface CreateMarketResult {
  conditionId: string;
  hash: string;
  endTime: number;
}

// ---------------------------------------------------------------------------
// Client helper
// ---------------------------------------------------------------------------

/**
 * Initialise a PNPClient from environment variables.
 *
 * Requires `PRIVATE_KEY` in env. Optionally reads `RPC_URL`
 * (defaults to the public Base mainnet RPC).
 */
export function initClient(): PNPClient {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  return new PNPClient({
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    privateKey,
  });
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Create a new prediction market.
 *
 * @param client  - An initialised PNPClient instance
 * @param params  - Market parameters
 * @returns       - The conditionId, transaction hash, and computed end time
 */
export async function createMarket(
  client: PNPClient,
  params: CreateMarketParams
): Promise<CreateMarketResult> {
  const {
    question,
    durationHours,
    liquidity,
    collateral = "USDC",
    decimals: explicitDecimals,
  } = params;

  // Validate
  if (!question) throw new Error("question is required");
  if (!durationHours || durationHours <= 0) throw new Error("durationHours must be positive");
  if (!liquidity || parseFloat(liquidity) <= 0) throw new Error("liquidity must be positive");

  // Resolve collateral token
  let collateralAddress: string;
  let decimals: number;

  const knownToken = TOKENS[collateral.toUpperCase()];
  if (knownToken) {
    collateralAddress = knownToken.address;
    decimals = explicitDecimals ?? knownToken.decimals;
  } else if (collateral.startsWith("0x")) {
    collateralAddress = collateral;
    decimals = explicitDecimals ?? 18;
  } else {
    throw new Error(
      `Unknown token "${collateral}". Use USDC, WETH, cbETH, or a 0x contract address.`
    );
  }

  const endTime = Math.floor(Date.now() / 1000) + durationHours * 3600;
  const liquidityWei = ethers.parseUnits(liquidity, decimals);

  console.log("\n--- Creating Prediction Market ---");
  console.log(`Question:    ${question}`);
  console.log(`Duration:    ${durationHours} hours`);
  console.log(`End Time:    ${new Date(endTime * 1000).toISOString()}`);
  console.log(`Liquidity:   ${liquidity} tokens`);
  console.log(`Collateral:  ${collateralAddress}`);
  console.log(`Wallet:      ${client.client.signer?.address}\n`);

  const { conditionId, hash } = await client.market.createMarket({
    question,
    endTime,
    initialLiquidity: liquidityWei.toString(),
    collateralToken: collateralAddress,
  });

  console.log("Market Created!");
  console.log(`Condition ID: ${conditionId}`);
  console.log(`Tx Hash:      ${hash}`);
  console.log(`BaseScan:     https://basescan.org/tx/${hash}\n`);

  return { conditionId: conditionId!, hash: hash!, endTime };
}

// ---------------------------------------------------------------------------
// Standalone entry-point (run directly with ts-node)
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const client = initClient();
    const result = await createMarket(client, {
      question: "Will ETH reach $10k by Dec 2025?",
      durationHours: 168,
      liquidity: "100",
      collateral: "USDC",
    });
    console.log("--- JSON OUTPUT ---");
    console.log(JSON.stringify(result, null, 2));
  })().catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
}
