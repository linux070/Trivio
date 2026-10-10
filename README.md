# trivio — Having Fun Onchain

[![Chain](https://img.shields.io/badge/Network-Arc_Testnet_|_Arc_Mainnet-6366f1?style=flat-square)](https://explorer.testnet.arc.io)
[![Token](https://img.shields.io/badge/Prize_Token-USDC-2775ca?style=flat-square)](https://circle.com)
[![Framework](https://img.shields.io/badge/Frontend-React_18_+_Vite-61dafb?style=flat-square)](https://reactjs.org)
[![Contracts](https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square)](https://soliditylang.org)
[![Build](https://img.shields.io/badge/Foundry-Passing-success?style=flat-square)](https://getfoundry.sh)

**trivio**: play real-time multiplayer onchain trivia and win USDC on Arc.

---

## 🚀 Deployed Smart Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| **TrivioProfileRegistry** | Arc Testnet (`5042002`) | `0xd69522761493ce3fc74fc07ae99d5cbd6de5f480` | [View on Explorer](https://explorer.testnet.arc.io/address/0xd69522761493ce3fc74fc07ae99d5cbd6de5f480) |
| **TriviaGame** | Arc Testnet (`5042002`) | `0x1b785e38e8ebb334b52a305a10e92b5ef9564624` | [View on Explorer](https://explorer.testnet.arc.io/address/0x1b785e38e8ebb334b52a305a10e92b5ef9564624) |
| **TrivioProfileRegistry** | Arc Mainnet (`5042`) | `0x0000000000000000000000000000000000000000` | [View on Explorer](https://explorer.arc.io) |
| **TriviaGame** | Arc Mainnet (`5042`) | `0x0000000000000000000000000000000000000000` | [View on Explorer](https://explorer.arc.io) |

* **USDC Token Address (Arc Testnet & Mainnet)**: `0x3600000000000000000000000000000000000000` (6 decimals)

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

---

## 🛡️ Comprehensive Anti-Cheat & Fair-Play Engine

Trivio implements a multi-layer anti-cheat architecture protecting prize pools and guaranteeing honest competition across web clients and smart contracts:

### 1. 🔒 Mid-Game Answer Locking & Persistence
- **Locked Choice**: Once a player selects an option or time expires (`0s`), their decision is immediately locked in session storage.
- **Refresh Protection**: If a user refreshes the page mid-game, they return to their exact question index with their chosen answer locked (`disabled`), preventing players from peeking at the correct answer, refreshing, and picking another choice.

### 2. ⏱️ Question Timestamp Lock (Anti-Timer Reset)
- **Epoch Tracking**: `questionStartTime` is recorded at the start of each round.
- **Elapsed Calculation**: Upon refresh, remaining time is strictly computed as $\text{Duration} - (\text{Now} - \text{StartTime})$. If the round duration has elapsed while away, the question is evaluated as timed out (`0s`), preventing timer manipulation or stalling.

### 3. 👁️ Tab Switching & Defocus Detection (Anti-Googling / Anti-ChatGPT)
- **Focus Monitoring**: Monitors `document.visibilitychange` (`document.hidden`) and `window.blur` events during active questions.
- **Fair-Play Speed Penalty**: If a player switches tabs or defocuses the window to search for answers, a warning toast triggers, a badge appears on their score bar, and speed bonus points on that question are capped to baseline ($25\text{ pts}$).

### 4. 🔀 Player-Specific Option Shuffling (Anti-Collusion & Screen Peeking)
- **Personalized Shuffling**: While all room participants answer the identical 10 questions in real time, the 4 answer choices (A, B, C, D) are deterministically shuffled per player address (`shuffleQuestionOptionsForPlayer`).
- **Collusion Shield**: Option A on Player 1's screen is different from Option A on Player 2's screen, neutralizing voice-chat collusion (*"Choose B!"*).

### 5. 🚫 Anti-Bot Scraping & Copy/Paste Lock
- **Clipboard & Context Lock**: Suppresses `user-select`, right-click context menus, `onCopy`, `onCut`, and dragging across all question cards and answer buttons.
- **Prompt Protection**: Prevents instant copying of question text into search engines or AI bots.

### 6. ⚡ Minimum Human Reaction Time Threshold (Anti-Bot Scripts)
- **Reflex Validation**: Human visual perception and motor synaptic response take at least **$250\text{ms}$–$300\text{ms}$**.
- **Macro Blocking**: Submissions in $< 250\text{ms}$ from question render are flagged as automated scripts/macros, triggering a warning and capping points to baseline ($10\text{ pts}$).

### 7. 🔐 In-Memory Salted Cryptographic Answer Hashing
- **Zero Plain Answers in State**: Active questions stored in React memory and DOM only contain a cryptographic hash:
  $$\text{answerHash} = \text{hash}(\text{SALT} + \text{questionText} + \text{correctOptionText})$$
- **Inspection-Proof**: Inspecting React DevTools, state dumps, or DOM attributes reveals zero hints about which choice is correct until the player has submitted their answer.

### 8. 📜 Smart Contract & Escrow Protections
- **EIP-712 Score Verification**: Cryptographic score proofs committed onchain.
- **Question Seed Commitments**: Seed hashes committed at room creation.
- **In-Progress Cancellation Locks**: Hosts cannot cancel a game once it begins.
- **Emergency Inactivity Timeout**: Automated player self-refund circuit breaker if a host disconnects.
- **Non-Custodial Vault**: Built with `SafeERC20`, `ReentrancyGuard`, `Pausable`, and `Ownable2Step`.

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
