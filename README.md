# Token Migrator

A Solana program for migrating tokens from one mint to another using configurable migration strategies.

## Overview

This Anchor program enables users to migrate their tokens from an old token mint to a new token mint based on predefined migration strategies. The program supports two migration strategies:

- **ProRata**: Calculates withdrawal amounts based on proportional supply of both tokens
- **Fixed**: Scales the deposited amount up or down by 10^e for decimal redenomination

## Quick Start

### Prerequisites

- Node.js and Yarn
- Rust and Cargo
- Solana CLI tools
- Anchor CLI

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

## Security

⚠️ **Warning**: The test files contain hardcoded admin keypairs for development purposes only. Never use these in production environments.

## License

MIT