# trivio — Having Fun Onchain

[![Chain](https://img.shields.io/badge/Network-Arc_Testnet-6366f1?style=flat-square)](https://explorer.testnet.arc.io)
[![Token](https://img.shields.io/badge/Prize_Token-USDC-2775ca?style=flat-square)](https://circle.com)
[![Framework](https://img.shields.io/badge/Frontend-React_18_+_Vite-61dafb?style=flat-square)](https://reactjs.org)
[![Contracts](https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square)](https://soliditylang.org)
[![Build](https://img.shields.io/badge/Foundry-Passing-success?style=flat-square)](https://getfoundry.sh)

**trivio** is a high-speed, competitive onchain trivia platform built on Arc Network where players test their knowledge, compete in real-time multiplayer rooms, and win USDC prize pools.

---

## 🚀 Deployed Smart Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| **TrivioProfileRegistry** | Arc Testnet (`5042002`) | `0xd69522761493ce3fc74fc07ae99d5cbd6de5f480` | [View on Explorer](https://explorer.testnet.arc.io/address/0xd69522761493ce3fc74fc07ae99d5cbd6de5f480) |
| **TriviaGame** | Arc Testnet (`5042002`) | `0x1b785e38e8ebb334b52a305a10e92b5ef9564624` | [View on Explorer](https://explorer.testnet.arc.io/address/0x1b785e38e8ebb334b52a305a10e92b5ef9564624) |

* **USDC Token (Arc Testnet)**: `0x3600000000000000000000000000000000000000` (6 decimals)

---

## ✨ Key Features & Capabilities

### 1. ⚡ Frictionless Web3 Onboarding
- Zero-gas play powered by **Privy**.
- Instant login with Google, Email, Passkeys, or Injected Web3 Wallets (MetaMask, Coinbase Wallet, etc.) with embedded funding options.

### 2. 🛡️ Onchain Identity & Profile Registry
- Verifiable, unique usernames registered onchain via `TrivioProfileRegistry`.
- Customizable avatars with SVG seeds, avatars, and persistent onchain ownership.

### 3. 🎮 Dynamic Game Modes & Infinite Categories
- **Crypto & Web3**: Bitcoin, Ethereum, DeFi, Smart Contracts & Culture.
- **Candle Rush**: Fast-paced chart patterns, price spikes, and halving cycles.
- **Puzzles & Logic**: Procedural math speed grids, number sequences, and word scrambles.
- **Pop Culture, Science, Sports & History**: Live questions powered by OpenTDB integration.
- **Solo Practice Arena**: Zero-risk practice mode with speed timers to warm up before multiplayer matches.

### 4. 💰 Customizable Prize Pools & Multi-Winner Payouts
Support for both **Buy-in** (entry fee) and **Sponsored** (free-to-play) rooms with customizable onchain prize distributions:
- 🥇 **Winner Takes All**: 100% to 1st place
- 🥈 **Top 2 Split**: 70% / 30%
- 🥉 **Top 3 Podium**: 50% / 30% / 20%
- 🏅 **Top 5 Split**: 40% / 25% / 15% / 10% / 10%

### 5. 🔒 Anti-Cheat & Player Protection
- **Cryptographic Score Validation**: EIP-712 score receipts verify player achievements and prevent falsified leaderboards.
- **Question Seed Commitment**: PRNG seed hash committed onchain at room creation to prevent mid-game question swapping.
- **In-Progress Cancellation Lock**: Hosts cannot cancel a game once it begins.
- **Host Inactivity Timeout**: Emergency player self-refund circuit breaker if a host disconnects or abandons a room.
- **Non-Custodial Vault**: `SafeERC20`, `ReentrancyGuard`, and `Pausable` protection for all prize pools.

---

## 🛠️ Tech Stack

### Frontend & Client
- **Framework**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, Vanilla CSS Glassmorphism
- **Web3 Layer**: Wagmi v2, Viem v2, ConnectKit, Privy Auth
- **Animations & Icons**: Framer Motion, Lucide React, Web3Icons
- **Notifications**: Sonner

### Smart Contracts
- **Language**: Solidity 0.8.28
- **Toolchain**: Foundry (`forge build`, `forge test`)
- **Libraries**: OpenZeppelin Contracts (SafeERC20, ReentrancyGuard, Pausable, Ownable2Step, Initializable, UUPSUpgradeable)
- **Deployment**: Arc Studio & Circle Smart Contract Platform

---

## 📦 Project Structure

```text
├── contracts/                  # Solidity smart contracts & test suites
│   ├── TriviaGame.sol          # Main game engine & escrow contract
│   ├── TrivioProfileRegistry.sol # Onchain profile & username registry
│   ├── test/                   # Foundry unit tests
│   └── script/                 # Deployment scripts
├── src/
│   ├── components/             # React UI components
│   │   ├── Lobby.tsx           # Main game lobby & mode browser
│   │   ├── CreateRoom.tsx      # Room creation with multi-winner splits
│   │   ├── JoinRoom.tsx        # Room code entry & buy-in flow
│   │   ├── GameRoom.tsx        # Real-time multiplayer trivia room
│   │   ├── QuestionCard.tsx    # Responsive question container
│   │   ├── SoloPracticeModal.tsx # Solo practice speed mode
│   │   ├── OnboardingModal.tsx # Zero-gas onboarding & claim profile
│   │   └── Results.tsx         # Podium leaderboard & payout reveal
│   ├── hooks/                  # Wagmi contract read/write hooks
│   ├── lib/                    # Questions engine, lobby data, and local storage
│   ├── config.ts               # Chain configurations & contract addresses
│   └── App.tsx                 # Core app state & navigation
└── package.json
```

---

## 🏃 Local Development

### Prerequisites
- Node.js (v18+) or [Bun](https://bun.sh)
- [Foundry](https://getfoundry.sh) (for smart contracts)

### 1. Install Dependencies
```bash
bun install
# or
npm install
```

### 2. Run the Dev Server
```bash
bun run dev
# or
npm run dev
```

### 3. Build & Test Smart Contracts
```bash
# Build contracts
bun run contracts:build

# Run Foundry unit tests
bun run contracts:test
```

---

## 📄 License

MIT License. Built with ❤️ on **Arc Network**.
