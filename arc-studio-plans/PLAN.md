# Implementation Plan: FUNOA — Having Fun Onchain

## Summary
FUNOA ("having fun onchain") is a live multiplayer trivia game where players buy in with USDC, answer AI-generated questions by category, and the fastest correct answers win the prize pool — all settled on Arc Testnet. The landing page introduces the brand, explains the game, and lets both non-crypto users (email / Circle wallet) and crypto users (ConnectKit) sign in without leaving the page.

## Architecture

- **Blockchain:** Arc Testnet — USDC is the native gas token, so buy-ins and payouts are a single asset with no ETH complexity. Sub-second finality makes live game rounds feel instant.
- **Contract:** `TriviaGame.sol` — stores rooms, manages buy-ins, supports both host-funded (free-to-play) and player buy-in modes, records winners, and releases the prize pool to the winner's address. Deployed via Arc Studio's platform deployer.
- **Frontend:** React + Tailwind. Entry point is a full landing page branded "FUNOA" with the tagline "having fun onchain", a short game explainer, and both sign-in options (email + ConnectKit wallet button) rendered directly on the page — no separate auth modal needed. From there: Host creates a room (picks mode, category, buy-in amount); Players join via a 6-character room code. Game screen shows questions with a countdown timer, live player list, and scores. Results screen shows winner + onchain payout status.
- **Wallet:** Dual-path — email OTP via Circle user-controlled wallets (`@circle-fin/w3s-pw-web-sdk`) for non-crypto users; ConnectKit for existing wallet holders. Both paths resolve to a wallet address the contract pays out to.
- **Questions:** A small server-side API route calls an AI model with a category prompt and returns 10 questions. Categories: Crypto, Sports, Pop Culture, Science, General Knowledge.

## Files to Create / Modify

1. `contracts/TriviaGame.sol` — smart contract: create room, join room, record winner, release prize pool
2. `src/server/api.ts` — Express-style Vite server plugin endpoints: create Circle user, generate questions, relay transactions for email-wallet users
3. `src/providers/Web3Provider.tsx` — wagmi + ConnectKit config pointing at Arc Testnet
4. `src/providers/CircleWalletProvider.tsx` — Circle user-controlled wallet context (email OTP flow)
5. `src/components/LandingPage.tsx` — full hero landing page: "FUNOA" wordmark, "having fun onchain" tagline, game explainer (how it works, categories, prize model), email sign-in input + OTP flow, and ConnectKit wallet connect button — both auth paths render here, no separate screen
6. `src/components/CreateRoom.tsx` — host flow: set category, mode (buy-in vs sponsored), buy-in amount, question count
7. `src/components/JoinRoom.tsx` — player flow: enter room code, see buy-in amount, confirm and pay
8. `src/components/GameRoom.tsx` — live game: question display, answer buttons, countdown timer, live scoreboard
9. `src/components/Results.tsx` — end screen: winner announcement, prize amount, link to Arc Testnet explorer tx
10. `src/hooks/useTriviaContract.ts` — wagmi hooks wrapping TriviaGame contract reads and writes
11. `src/hooks/useCircleWallet.ts` — Circle SDK helpers: create user, wallet, send contract tx via challenge flow
12. `src/lib/questions.ts` — question generation logic (category → AI prompt → structured Q&A array)
13. `src/App.tsx` — routing: LandingPage (unauthenticated) → Lobby → GameRoom → Results
14. `src/config.ts` — update with contract address post-deploy, Arc Testnet chain config

## Build Sequence

1. Write and deploy `TriviaGame.sol` to Arc Testnet (create room, join, record winner, payout)
2. Set up `Web3Provider.tsx` with Arc Testnet + ConnectKit and `CircleWalletProvider.tsx` with email OTP
3. Build `LandingPage.tsx` — FUNOA hero, tagline, game explainer, email OTP input, and ConnectKit button all on one page
4. Build `CreateRoom.tsx` + `JoinRoom.tsx` — room creation and joining with USDC buy-in logic
5. Build `GameRoom.tsx` — question display, timer, answer selection, real-time score tracking
6. Build `Results.tsx` — winner display, prize release trigger, explorer link
7. Wire `useTriviaContract.ts` and `useCircleWallet.ts` hooks to connect UI to contract
8. Implement `questions.ts` + server API route for AI-generated questions by category
9. End-to-end test: host creates room, 2 players join and play, winner receives USDC payout

## Done When

- [ ] Landing page shows "FUNOA" wordmark, "having fun onchain" tagline, game explainer, email sign-in, and ConnectKit wallet button
- [ ] Host can create a room in buy-in mode and sponsored mode, choosing a category
- [ ] Non-crypto user can sign up with email, get a wallet, and join a room — no seed phrase or prior crypto knowledge needed
- [ ] Crypto user can connect MetaMask/existing wallet and join the same room
- [ ] Players see AI-generated questions with a countdown timer and answer buttons
- [ ] Fastest correct answers accumulate points; game ends after all questions
- [ ] Winner's wallet receives the USDC prize pool via the smart contract on Arc Testnet
- [ ] Results screen shows winner, prize amount, and a verifiable Arc Testnet explorer link
- [ ] Contract is deployed and verified on Arc Testnet
