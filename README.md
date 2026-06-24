# Token Migrator

A Solana program for migrating tokens from one mint to another using configurable migration strategies.

## Overview

This Anchor program enables users to migrate their tokens from an old token mint to a new token mint based on predefined migration strategies. The program supports three migration strategies:

- **ProRata**: Calculates withdrawal amounts based on proportional supply of both tokens
- **Fixed**: Scales the deposited amount up or down by 10^e for decimal redenomination
- **Ratio**: Applies a fixed rational rate `numerator / denominator` to the deposited amount

## Quick Start

### Prerequisites

- Node.js and Yarn
- Rust and Cargo
- Solana CLI (v2.3.0) tools
- Anchor CLI (v0.31.1)

### Installation

```bash
# Install dependencies
yarn install

# Build the program
anchor build
```

### Testing

```bash
# Run tests
anchor test
```

### Deployment

```bash
# Deploy to localnet
anchor deploy

# Deploy to devnet/mainnet
anchor deploy --provider.cluster devnet
```

## Usage

### Initialize Migration

The admin can initialize a new token migration strategy:

```typescript
await program.methods.initialize(
  mintFrom,        // Source token mint
  mintTo,          // Destination token mint  
  { fixed: { e: 0 } }  // Migration strategy
)
```

### Migrate Tokens

Users can migrate their tokens using the configured strategy:

```typescript
await program.methods.migrate(
  new BN(amount)  // Amount to migrate
)
```

## Migration Strategies

### ProRata Strategy
Proportionally distributes new tokens based on supply ratios:
```
withdraw_amount = (supply_to * deposit_amount) / supply_from
```

### Fixed Strategy
Scales amounts by powers of 10:
- `Fixed(1)`: Multiply by 10 (e.g., 100 → 1000)
- `Fixed(-1)`: Divide by 10 (e.g., 100 → 10)
- `Fixed(0)`: 1:1 ratio (e.g., 100 → 100)

### Ratio Strategy
Applies a fixed rational conversion rate, ignoring token supply:
```
withdraw_amount = floor(deposit_amount * numerator / denominator)
```
- `Ratio { numerator: 3, denominator: 2 }`: 3 out per 2 in (e.g., 100 → 150)
- `Ratio { numerator: 1, denominator: 2 }`: 1 out per 2 in (e.g., 100 → 50)
- `Ratio { numerator: 1, denominator: 1 }`: 1:1 ratio (e.g., 100 → 100)

Both `numerator` and `denominator` must be non-zero. Like `Fixed`, this operates on **raw base units** and is not decimal-aware: if the mints have different decimals, fold the `10^(decimals_to - decimals_from)` factor into the ratio (see the worked example in `RATIO_STRATEGY.md`). Division floors; the residue stays in the vault.

## Security

⚠️ **Warning**: The test files contain hardcoded admin keypairs for development purposes only. Never use these in production environments.

## License

MIT