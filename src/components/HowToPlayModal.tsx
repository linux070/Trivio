import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HelpCircle,
  Zap,
  Trophy,
  ShieldCheck,
  X,
  Sparkles,
  Coins,
  CheckCircle2,
  Gamepad2,
  Gift,
  Flame,
} from 'lucide-react'

interface HowToPlayModalProps {
  open: boolean
  onClose: () => void
}

export default function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  const [activeTab, setActiveTab] = useState<'basics' | 'scoring' | 'payouts'>('basics')

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          {/* Smooth Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer transform-gpu"
            onClick={onClose}
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg flex flex-col max-h-[90dvh] overflow-hidden rounded-3xl bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-slate-200/80 z-10 transform-gpu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Clean Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-2.5 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-100/80 shadow-2xs shrink-0">
                  <Gamepad2 size={19} className="stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight">
                    How to Play & Win
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    Simple guide to games, speed scoring & prizes
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-90 transition-all cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modern Segmented Tab Pills */}
            <div className="px-4 sm:px-5 pt-1 pb-2 shrink-0">
              <div className="flex items-center p-1 rounded-xl bg-slate-100/90 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('basics')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer select-none active:scale-[0.98] ${
                    activeTab === 'basics'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  1. Basics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('scoring')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer select-none active:scale-[0.98] ${
                    activeTab === 'scoring'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  2. Scoring
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('payouts')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer select-none active:scale-[0.98] ${
                    activeTab === 'payouts'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  3. Prizes
                </button>
              </div>
            </div>

            {/* Tab Contents - Scrollable with Momentum on Mobile */}
            <div className="px-4 sm:px-5 py-2.5 flex-1 overflow-y-auto overscroll-contain space-y-3">
              {/* TAB 1: BASICS */}
              {activeTab === 'basics' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2.5"
                >
                  {/* Step 1 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white font-bold text-xs shadow-2xs">
                      1
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900">
                        Pick a Category & Mode
                      </h4>
                      <p className="text-[12px] text-slate-600 leading-relaxed mt-0.5">
                        Choose what you enjoy (Crypto, Pop Culture, Science, or Puzzles). Practice <strong>Solo</strong> for free, or host/join <strong>Multiplayer Rooms</strong> with friends.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white font-bold text-xs shadow-2xs">
                      2
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900">
                        Buy-In vs. Sponsored Prize Pools
                      </h4>
                      <p className="text-[12px] text-slate-600 leading-relaxed mt-0.5">
                        Hosts can fund <strong>Sponsored rooms</strong> (100% free for friends to enter, you pay gas fee) or set a competitive USDC <strong>Buy-in fee</strong> where all entry fees accumulate into the prize pool.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white font-bold text-xs shadow-2xs">
                      3
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900">
                        Zero-Gas Instant Settlement
                      </h4>
                      <p className="text-[12px] text-slate-600 leading-relaxed mt-0.5">
                        Powered by Arc Network escrow. As soon as the host declares the winners, the smart contract automatically deposits USDC rewards directly into the winners' wallets.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white font-bold text-xs shadow-2xs">
                      4
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900">
                        Invite Friends (6 or 8-Digit Code)
                      </h4>
                      <p className="text-[12px] text-slate-600 leading-relaxed mt-0.5">
                        Share your <strong>6 or 8-digit room code</strong> or send the invite link directly so friends can jump straight into your live game in seconds!
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: SPEED SCORING */}
              {activeTab === 'scoring' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        10 Questions · Faster Answers Win More Points
                      </h4>
                      <p className="text-[12px] text-slate-600 leading-relaxed mt-0.5">
                        Each question has a <strong>countdown timer</strong> (typically 10s–15s). You get points only if your answer is correct. The faster you lock in, the higher your score!
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs">
                        <span className="text-[11px] font-semibold text-emerald-600 block">&lt; 2s (Fast)</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">90 – 100 pts</span>
                      </div>
                      <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs">
                        <span className="text-[11px] font-semibold text-amber-600 block">3 – 8s (Mid)</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">50 – 80 pts</span>
                      </div>
                      <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs">
                        <span className="text-[11px] font-semibold text-slate-500 block">9 – 15s (Late)</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">10 – 30 pts</span>
                      </div>
                    </div>
                  </div>

                  {/* Clean Modern Site Style Note */}
                  <div className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-[12px] text-slate-600">
                    <p className="leading-snug">
                      <strong className="font-semibold text-slate-900">Note:</strong> Incorrect answers award <strong className="text-rose-600 font-semibold">0 points</strong>. Speed only boosts score when your answer is correct.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: PAYOUT SPLITS */}
              {activeTab === 'payouts' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  <p className="text-[12px] text-slate-600 font-medium">
                    The room host chooses how the prize pool is shared before the match starts:
                  </p>

                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        🥇 Winner Takes All
                      </span>
                      <span className="font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                        100% to 1st Place
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        🥈 Top 2 Split
                      </span>
                      <span className="font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                        70% (1st) · 30% (2nd)
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        🥉 Top 3 Podium
                      </span>
                      <span className="font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                        50% · 30% · 20%
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        🏅 Top 5 Split
                      </span>
                      <span className="font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                        40 · 25 · 15 · 10 · 10%
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Clean Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Safe onchain escrow</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Got It, Let's Play
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

