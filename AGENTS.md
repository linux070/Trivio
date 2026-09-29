# trivio — Having Fun Onchain


## Deployed Contracts

| Contract | Chain | Address | Explorer |
|---|---|---|---|
| TrivioProfileRegistry | Arc Testnet | `0xd69522761493ce3fc74fc07ae99d5cbd6de5f480` | [View](https://explorer.testnet.arc.io/address/0xd69522761493ce3fc74fc07ae99d5cbd6de5f480) |
| TriviaGame | Arc Testnet | `0x1b785e38e8ebb334b52a305a10e92b5ef9564624` | [View](https://explorer.testnet.arc.io/address/0x1b785e38e8ebb334b52a305a10e92b5ef9564624) |

USDC constructor arg (Arc Testnet): `0x3600000000000000000000000000000000000000`

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What trivio Does :

**trivio** is a high-speed, competitive onchain trivia platform built on Arc Network where players test their knowledge, compete in real-time multiplayer rooms, and win USDC prize pools.

### Key Features & Capabilities:
- **Frictionless Web3 Onboarding**: Instant zero-gas play powered by Privy (Google, Email, Passkeys, and Injected Web3 Wallets).
- **Onchain Identity & Profiles**: Verifiable usernames and customizable avatars registered onchain via `TrivioProfileRegistry`.
- **Dynamic Game Modes & Infinite Categories**: Diverse trivia arenas (Crypto & Web3, Candle Rush chart patterns, Pop Culture, Science, Word Blitz, and procedural Logic & Math puzzles) with live OpenTDB integration.
- **Customizable Prize Pools & Multi-Winner Payouts**: Support for both Buy-in (entry fee) and Sponsored (free-to-play) rooms with onchain customizable prize splits:
  - 🥇 Winner Takes All (100%)
  - 🥈 Top 2 Split (70% / 30%)
  - 🥉 Top 3 Podium (50% / 30% / 20%)
  - 🏅 Top 5 Split (40% / 25% / 15% / 10% / 10%)
- **Anti-Cheat & Player Protection**: Non-custodial escrow with EIP-712 cryptographic score validation, question seed hash commitments, in-progress cancellation locks, and emergency inactivity timeout refunds.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
