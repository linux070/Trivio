Looking at the current Lobby before advising. Here is my honest audit of this page and exactly what I'd do:

---

**REMOVE**

- **The spectral rainbow top-stripe on the wallet card** — decorative noise, distracts from the content, doesn't match the purple brand at all
- **"Need test USDC? Use 'Get test USDC' in the sidebar"** — judges won't see a sidebar, this is confusing and looks unfinished
- **The "Your Wallet" label above the address row** — the USDC icon and wallet address speak for themselves, the label is redundant space
- **The wallet card as a separate full card** — it's taking up half the screen for just an address and a balance. Collapse it into the header as a compact chip instead

---

**ADD**

- **Category selector** — a 2x3 or 3x2 grid of tappable category tiles (🧠 General · ⚡ Crypto · 🏆 Sports · 🎬 Pop Culture · 🔬 Science · 🎭 Movies) between the wallet and the action buttons. Player picks a category here, and it pre-fills into CreateRoom/JoinRoom. Makes the page feel alive and purposeful
- **A compact wallet chip in the header** — address truncated + USDC balance, right next to the ConnectKit button. Replaces the full card
- **A subtle "Pick a category to start" label** above the category grid — guides the user's eye and makes the flow obvious

---

**IMPROVE**

- **The two action buttons** — instead of stacked full-width rows that look like settings menu items, make them two equal side-by-side cards on tablet+ and stacked on mobile. More visual balance
- **Background** — the current off-white gradient doesn't match the purple landing page at all. Either continue the purple into this page (darker, muted) or use a deep near-black (`#0f0a1a`) so the glass cards pop. Right now it looks like a different app

---

**Simplified flow after changes:**

```
Header: TRIVIO wordmark | wallet chip | ConnectKit button
─────────────────────────────────────────────
Pick a category:
[ 🧠 General ]  [ ⚡ Crypto ]  [ 🏆 Sports ]
[ 🎬 Movies  ]  [ 🔬 Science ]  [ 🎭 Culture ]
─────────────────────────────────────────────
[ + Create a Room ]   [ → Join a Room ]
```

Clean, purposeful, one screen. Want me to build this now?
