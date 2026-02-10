---
name: pnp-markets
description: Create, trade, settle, and redeem prediction markets on Base with any ERC20 collateral using the pnp-evm SDK. Use when building prediction market infrastructure, running contests, crowdsourcing probability estimates, adding utility to tokens, or tapping into true information finance via market-based forecasting.
---

# PNP Markets

Create and manage permissionless prediction markets on Base Mainnet with any ERC20 collateral token, powered by the `pnp-evm` SDK.

## Environment

```bash
export PRIVATE_KEY=<wallet_private_key>    # Required
export RPC_URL=<base_rpc_endpoint>         # Optional (defaults to public Base RPC)
```

For production, use a dedicated RPC (Alchemy, QuickNode) to avoid rate limits.

## Installation

**IMPORTANT: Always install the latest version of `pnp-evm` before running any scripts.** The SDK is actively developed and older versions may be incompatible with the current on-chain contracts.

```bash
cd scripts && npm install pnp-evm@latest ethers
```

The current latest version is **`0.1.3`**. To verify you have it:

```bash
npm list pnp-evm
```

If you already have `node_modules`, force-update to the latest:

```bash
npm update pnp-evm
```

## Quick Decision

```
Need prediction markets?
├─ Full lifecycle demo   → import functions from the scripts or run lifecycle.ts
├─ Create market         → import { createMarket } from "./scripts/create-market"
├─ Trade (buy/sell)      → import { buyTokens, sellTokens } from "./scripts/trade"
├─ Settle market         → import { settleMarket } from "./scripts/settle"
└─ Redeem winnings       → import { redeemWinnings } from "./scripts/redeem"
```

## SDK Usage

All scripts export clean functions that accept a `PNPClient` instance and typed parameters. Import and compose them in your agent code.

### Initialise Client

Every script re-exports `initClient()` which loads credentials from environment variables:

```typescript
import { initClient } from "./scripts/create-market";

const client = initClient(); // reads PRIVATE_KEY and RPC_URL from env
```

### Create Market

```typescript
import { createMarket, initClient } from "./scripts/create-market";

const client = initClient();
const { conditionId, hash, endTime } = await createMarket(client, {
  question: "Will ETH reach $10k by Dec 2025?",
  durationHours: 168,       // 7 days
  liquidity: "100",          // 100 USDC
  collateral: "USDC",       // or "WETH", "cbETH", or a 0x address
});
```

**Parameters:**
- `question` — The prediction question
- `durationHours` — Trading duration in hours
- `liquidity` — Initial liquidity amount (human-readable)
- `collateral` — Token symbol or contract address (default: `"USDC"`)
- `decimals` — Override token decimals (auto-detected for known tokens)

### Trade (Buy / Sell)

```typescript
import { buyTokens, sellTokens, getMarketInfo } from "./scripts/trade";
import { initClient } from "./scripts/create-market";

const client = initClient();

// Check current prices
const info = await getMarketInfo(client, conditionId);
console.log(info.yesPrice, info.noPrice);

// Buy YES tokens with 10 USDC
await buyTokens(client, {
  conditionId,
  outcome: "YES",
  amount: "10",
  decimals: 6,     // collateral decimals (USDC = 6)
});

// Sell 2 YES outcome tokens
await sellTokens(client, {
  conditionId,
  outcome: "YES",
  amount: "2",
  decimals: 18,    // outcome tokens are always 18 decimals
});
```

**Parameters:**
- `conditionId` — Market condition ID
- `outcome` — `"YES"` or `"NO"`
- `amount` — Human-readable amount
- `decimals` — Token decimals (default: 6 for buy, 18 for sell)
- `minOut` — Minimum output for slippage protection (default: `"0"`)

### Settle

```typescript
import { settleMarket, getSettlementStatus } from "./scripts/settle";
import { initClient } from "./scripts/create-market";

const client = initClient();

// Check if market can be settled
const status = await getSettlementStatus(client, conditionId);
console.log(status.canSettle, status.isSettled);

// Settle with winning outcome (only market creator, only after endTime)
if (status.canSettle) {
  const { hash } = await settleMarket(client, {
    conditionId,
    outcome: "YES",
  });
}
```

### Redeem

```typescript
import { redeemWinnings } from "./scripts/redeem";
import { initClient } from "./scripts/create-market";

const client = initClient();

// Redeem winning tokens for collateral (market must be settled)
const { hash, winner } = await redeemWinnings(client, conditionId);
```

## Full Lifecycle

The `scripts/lifecycle.ts` script demonstrates the complete flow — create, trade, settle, and redeem — in a single run:

```typescript
import { initClient, createMarket } from "./scripts/create-market";
import { buyTokens, sellTokens, getMarketInfo } from "./scripts/trade";
import { settleMarket, getSettlementStatus } from "./scripts/settle";
import { redeemWinnings } from "./scripts/redeem";

const client = initClient();

// 1. Create
const market = await createMarket(client, {
  question: "Will our community reach 1000 members?",
  durationHours: 168,
  liquidity: "100",
});

// 2. Trade
await buyTokens(client, { conditionId: market.conditionId, outcome: "YES", amount: "10" });
await sellTokens(client, { conditionId: market.conditionId, outcome: "YES", amount: "2", decimals: 18 });

// 3. Settle (after endTime)
await settleMarket(client, { conditionId: market.conditionId, outcome: "YES" });

// 4. Redeem
await redeemWinnings(client, market.conditionId);
```

Or run it directly:

```bash
npx ts-node scripts/lifecycle.ts
```

---

## Market Creator Responsibilities

**When you create a market, you own it end-to-end.** Only the creator wallet can settle the market. This means you are responsible for:

1. **Defining clear trading rules** — A market is only useful if traders trust that it will be settled fairly. Write unambiguous questions with objective resolution criteria. Bad rules lead to zero participation.
2. **Settling the market after the trading period ends** — If you don't settle, traders cannot redeem their winnings. An unsettled market is a broken promise.
3. **Storing market details locally** — You must persist the condition ID, trading rules, end time, and settlement criteria so you can settle correctly later.

### What Makes Good Trading Rules?

Trading rules define how the market question will be resolved. They should be:

- **Unambiguous** — One clear interpretation. "Will ETH reach $10k?" is vague. "Will ETH/USD on CoinGecko exceed $10,000 at any point before the market end time?" is precise.
- **Objectively verifiable** — Resolution must be based on a publicly observable fact, not an opinion.
- **Time-bounded** — The question must have a definitive end point that matches the market's `endTime`.
- **Source-specified** — State which data source or oracle determines the outcome (e.g., "according to CoinGecko spot price", "according to the official project announcement").

Example of well-written trading rules:

```json
{
  "question": "Will ETH/USD exceed $10,000 before market close?",
  "resolutionSource": "CoinGecko ETH/USD spot price",
  "resolutionCriteria": "Resolves YES if ETH/USD spot price on CoinGecko equals or exceeds $10,000.00 at any point before the market end time. Resolves NO otherwise.",
  "endTime": "2025-12-31T23:59:59Z"
}
```

---

## Local Market Registry (`markets/` Directory)

**IMPORTANT: Every time you create a market, you MUST save its details to the `markets/` directory.** This is the agent's source of truth for all active markets. Without it, you will lose track of condition IDs, forget to settle, and break trader trust.

### Directory Structure

```
markets/
├── registry.json                          # Master index of all markets
├── 0x1a2b3c...conditionId1.json           # Individual market file
├── 0x4d5e6f...conditionId2.json           # Individual market file
└── ...
```

### Market File Format

After every `createMarket()` call, immediately write a JSON file to `markets/<conditionId>.json`:

```json
{
  "conditionId": "0x1a2b3c4d5e6f...",
  "question": "Will ETH/USD exceed $10,000 before market close?",
  "createdAt": "2025-06-15T10:30:00Z",
  "endTime": "2025-12-31T23:59:59Z",
  "endTimeUnix": 1735689599,
  "collateral": {
    "symbol": "USDC",
    "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "decimals": 6
  },
  "initialLiquidity": "100",
  "createTxHash": "0xabc123...",
  "tradingRules": {
    "resolutionSource": "CoinGecko ETH/USD spot price",
    "resolutionCriteria": "Resolves YES if ETH/USD on CoinGecko >= $10,000 at any point before endTime. Resolves NO otherwise.",
    "additionalNotes": "Price checked at 1-minute granularity."
  },
  "settlement": {
    "isSettled": false,
    "settleTxHash": null,
    "winner": null,
    "settledAt": null
  }
}
```

### Registry File Format

The `markets/registry.json` file is a master index for quick lookup. Update it every time a market is created or settled:

```json
{
  "markets": [
    {
      "conditionId": "0x1a2b3c4d5e6f...",
      "question": "Will ETH/USD exceed $10,000 before market close?",
      "endTimeUnix": 1735689599,
      "isSettled": false,
      "winner": null
    },
    {
      "conditionId": "0x4d5e6f7a8b9c...",
      "question": "Will Base TVL exceed $20B by March 2026?",
      "endTimeUnix": 1743465599,
      "isSettled": true,
      "winner": "YES"
    }
  ]
}
```

### Agent Workflow After Creating a Market

Every time you call `createMarket()`, follow this exact sequence:

1. Call `createMarket()` and capture the result
2. Define clear, unambiguous trading rules for the question
3. Write the market JSON file to `markets/<conditionId>.json`
4. Update `markets/registry.json` to include the new market
5. Log the condition ID and end time for settlement tracking

```typescript
import { createMarket, initClient } from "./scripts/create-market";
import * as fs from "fs";
import * as path from "path";

const client = initClient();
const marketsDir = path.resolve("markets");
if (!fs.existsSync(marketsDir)) fs.mkdirSync(marketsDir, { recursive: true });

// 1. Create market
const result = await createMarket(client, {
  question: "Will ETH/USD exceed $10,000 before market close?",
  durationHours: 168,
  liquidity: "100",
});

// 2. Define trading rules
const marketRecord = {
  conditionId: result.conditionId,
  question: "Will ETH/USD exceed $10,000 before market close?",
  createdAt: new Date().toISOString(),
  endTime: new Date(result.endTime * 1000).toISOString(),
  endTimeUnix: result.endTime,
  collateral: { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  initialLiquidity: "100",
  createTxHash: result.hash,
  tradingRules: {
    resolutionSource: "CoinGecko ETH/USD spot price",
    resolutionCriteria: "Resolves YES if ETH/USD >= $10,000 at any point before endTime. NO otherwise.",
    additionalNotes: "",
  },
  settlement: { isSettled: false, settleTxHash: null, winner: null, settledAt: null },
};

// 3. Write individual market file
fs.writeFileSync(
  path.join(marketsDir, `${result.conditionId}.json`),
  JSON.stringify(marketRecord, null, 2)
);

// 4. Update registry
const registryPath = path.join(marketsDir, "registry.json");
const registry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, "utf-8"))
  : { markets: [] };
registry.markets.push({
  conditionId: result.conditionId,
  question: marketRecord.question,
  endTimeUnix: result.endTime,
  isSettled: false,
  winner: null,
});
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
```

---

## Settlement Tracking

**The agent MUST proactively check for markets that need settling.** Markets that pass their end time without settlement leave traders unable to redeem. This is the most critical ongoing responsibility.

### How It Works

The agent should **regularly read `markets/registry.json`** to find markets where:
- `isSettled` is `false`
- `endTimeUnix` is in the past (i.e., `endTimeUnix < Date.now() / 1000`)

For each such market, the agent should:
1. Read the full market file `markets/<conditionId>.json` to review the trading rules
2. Evaluate the resolution criteria against the specified data source
3. Determine the winning outcome (`"YES"` or `"NO"`)
4. Call `settleMarket()` with the winning outcome
5. Update both the individual market file and `markets/registry.json`

### Settlement Check Logic

```typescript
import * as fs from "fs";
import * as path from "path";
import { initClient } from "./scripts/create-market";
import { settleMarket } from "./scripts/settle";

async function checkAndSettleDueMarkets(): Promise<void> {
  const registryPath = path.resolve("markets", "registry.json");
  if (!fs.existsSync(registryPath)) return;

  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const now = Math.floor(Date.now() / 1000);
  const client = initClient();

  for (const entry of registry.markets) {
    // Skip already settled
    if (entry.isSettled) continue;

    // Skip if trading period not over yet
    if (entry.endTimeUnix > now) continue;

    console.log(`Market due for settlement: ${entry.question}`);
    console.log(`  Condition: ${entry.conditionId}`);
    console.log(`  Ended:     ${new Date(entry.endTimeUnix * 1000).toISOString()}`);

    // Read the full market file for trading rules
    const marketPath = path.resolve("markets", `${entry.conditionId}.json`);
    const marketData = JSON.parse(fs.readFileSync(marketPath, "utf-8"));

    console.log(`  Rules:     ${marketData.tradingRules.resolutionCriteria}`);
    console.log(`  Source:    ${marketData.tradingRules.resolutionSource}`);

    // ⚠️  AGENT DECISION POINT:
    // The agent must evaluate the resolution criteria against the specified
    // data source and determine the winner. This requires judgment — the
    // agent should fetch the relevant data (price feeds, announcements, etc.)
    // and apply the resolution criteria.
    //
    // Example: if resolutionSource is "CoinGecko ETH/USD spot price" and
    // criteria is "Resolves YES if >= $10,000", the agent should check
    // whether ETH ever reached that price during the trading period.

    const winner: "YES" | "NO" = "YES"; // ← agent determines this

    // Settle on-chain
    const result = await settleMarket(client, {
      conditionId: entry.conditionId,
      outcome: winner,
    });

    // Update individual market file
    marketData.settlement = {
      isSettled: true,
      settleTxHash: result.hash,
      winner,
      settledAt: new Date().toISOString(),
    };
    fs.writeFileSync(marketPath, JSON.stringify(marketData, null, 2));

    // Update registry
    entry.isSettled = true;
    entry.winner = winner;
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
}
```

### When to Run Settlement Checks

The agent should check `markets/registry.json` for due settlements:

- **On every agent startup / new session** — First thing the agent does is scan for overdue markets
- **Before creating a new market** — Settle any overdue markets first; don't accumulate unsettled obligations
- **Periodically** — If the agent runs continuously, check every 15-30 minutes
- **When the user mentions settling** — Immediately scan the registry

### Priority Order

1. Settle any overdue markets (past endTime, not yet settled)
2. Then proceed with whatever the user asked for
3. If creating a new market, save it to the registry immediately

---

## Collateral Tokens

Use any ERC20 as collateral. Common Base Mainnet tokens:

| Token | Address | Decimals |
|-------|---------|----------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |
| cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | 18 |

For custom tokens, pass the contract address directly:

```typescript
await createMarket(client, {
  question: "Will our DAO pass Proposal #42?",
  durationHours: 336,
  liquidity: "10000",
  collateral: "0xYourTokenAddress",
  decimals: 18,
});
```

## ERC20 Approvals

Before interacting with PNP contracts, the SDK approves them to spend your collateral tokens.

- **First interaction**: An approval transaction is sent automatically
- **Infinite approvals**: Uses `type(uint256).max` (standard EVM pattern) — approve once per token
- **Subsequent interactions**: Execute directly, no extra approval needed

If you see `ERC20: transfer amount exceeds allowance`, the approval has not been mined yet. Wait a few seconds and retry.

## Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| PNP Factory | `0xc2a4CCE465EB6013eb4B7Fdf6905fb6C836e2B15` |
| Fee Manager | `0xA919362052CDeB14e88656A4Ae56A41416Fe4fc0` |

## Why Prediction Markets?

- **Information Discovery**: Market prices reveal collective probability estimates
- **Token Utility**: Use your token as collateral to drive engagement
- **Contests**: Run competitions where participants stake on outcomes
- **Forecasting**: Aggregate crowd wisdom for decision-making

The pAMM virtual liquidity model ensures smooth trading even with minimal initial liquidity.

## Troubleshooting

| Error | Solution |
|-------|----------|
| `ERC20: transfer amount exceeds allowance` | Approval transaction pending. Wait 5-10 seconds and retry. |
| `Market doesn't exist` | Creation may have failed or is pending. Verify on BaseScan. |
| `over rate limit` / RPC errors | Use a dedicated RPC: `export RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY` |
| `Only creator` | Only the market creator wallet can settle the market. |
| `Cannot settle yet` | Trading period has not ended. Check `getSettlementStatus()`. |

## Reference Files

- **API Reference**: See [references/api-reference.md](references/api-reference.md) for complete SDK documentation
- **Use Cases**: See [references/use-cases.md](references/use-cases.md) for detailed use case patterns
- **Examples**: See [references/examples.md](references/examples.md) for complete code examples
