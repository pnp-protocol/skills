# PNP Markets Skill

Create, trade, settle, and redeem **permissionless prediction markets** on Base with any ERC20 collateral using the `pnp-evm` SDK. This skill enables AI agents to build prediction market infrastructure, run contests, crowdsource probability estimates, add utility to tokens, and tap into true information finance via market-based forecasting.

## Quick Install for Agents

```bash
# Using Skills
npx skills add pnp-protocol/skills

# Using Clawhub
npx clawhub@latest install proxima424/create-prediction-markets
```

## Setup

```bash
# Install dependencies
cd scripts && npm install

# Set environment variables
export PRIVATE_KEY=<wallet_private_key>    # Required
export RPC_URL=<base_rpc_endpoint>         # Optional (defaults to public Base RPC)
```

## How It Works

All scripts export clean, importable functions powered by the `pnp-evm` SDK. No CLI argument parsing — just import and call.

```typescript
import { initClient, createMarket } from "./scripts/create-market";
import { buyTokens, sellTokens } from "./scripts/trade";
import { settleMarket } from "./scripts/settle";
import { redeemWinnings } from "./scripts/redeem";

const client = initClient(); // reads PRIVATE_KEY & RPC_URL from env

// Create → Trade → Settle → Redeem
const market = await createMarket(client, {
  question: "Will ETH reach $10k by Dec 2025?",
  durationHours: 168,
  liquidity: "100",
});

await buyTokens(client, { conditionId: market.conditionId, outcome: "YES", amount: "10" });
await settleMarket(client, { conditionId: market.conditionId, outcome: "YES" });
await redeemWinnings(client, market.conditionId);
```

## Scripts

| Script | Exports | Purpose |
|--------|---------|---------|
| `create-market.ts` | `initClient`, `createMarket`, `TOKENS` | Create markets with any ERC20 collateral |
| `trade.ts` | `buyTokens`, `sellTokens`, `getMarketInfo` | Buy/sell YES or NO outcome tokens |
| `settle.ts` | `settleMarket`, `getSettlementStatus` | Settle markets after trading ends |
| `redeem.ts` | `redeemWinnings` | Redeem winning tokens for collateral |
| `lifecycle.ts` | — | Full create→trade→settle→redeem demo |

## Documentation

- **[SKILL.md](SKILL.md)** — Full skill documentation with all parameters and examples
- **[API Reference](references/api-reference.md)** — Complete `pnp-evm` SDK documentation
- **[Use Cases](references/use-cases.md)** — Detailed use case patterns
- **[Examples](references/examples.md)** — Complete code examples

## License

MIT
