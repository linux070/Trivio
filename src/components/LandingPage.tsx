import { useState, useEffect, useRef, startTransition } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { ConnectKitButton } from 'connectkit'
import { Users, Zap, Trophy, X, Wallet, Fingerprint } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'

/* ── Typewriter hook ─────────────────────────────────────────────────────── */
function useTypewriter(text: string, speed = 52, startDelay = 800) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    const start = setTimeout(() => {
      startTransition(() => { setDisplayed(''); setDone(false) })
      let i = 0
      const tick = setInterval(() => {
        i++
        startTransition(() => {
          setDisplayed(text.slice(0, i))
          if (i >= text.length) setDone(true)
        })
        if (i >= text.length) clearInterval(tick)
      }, speed)
      return () => clearInterval(tick)
    }, startDelay)
    return () => clearTimeout(start)
  }, [text, speed, startDelay])
  return { displayed, done }
}

/* ── Floating shapes ───────────────────────────────────────────────────────── */
const SHAPES = [
  ['triangle', 6, 6, 40, 18],
  ['cross', 85, 8, 30, 0],
  ['circle', 74, 22, 50, 0],
  ['triangle', 12, 52, 32, 50],
  ['cross', 90, 48, 24, 12],
  ['cross', 28, 80, 28, 30],
  ['circle', 4, 82, 58, 0],
  ['diamond', 80, 76, 38, 45],
  ['triangle', 54, 10, 26, 8],
  ['diamond', 46, 65, 30, 20],
  ['cross', 60, 88, 22, 5],
  ['circle', 92, 86, 34, 0],
  ['diamond', 18, 25, 22, 15],
  ['triangle', 40, 40, 18, 35],
  ['cross', 68, 55, 16, 0],
] as const

function FloatingShapes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {SHAPES.map(([type, x, y, size, rot], i) => {
        const s = size as number
        const style: React.CSSProperties = {
          left: `${x}%`, top: `${y}%`,
          width: s, height: s,
          transform: `rotate(${rot}deg)`,
          position: 'absolute',
          opacity: 0.11,
          pointerEvents: 'none',
        }
        if (type === 'triangle') return (
          <svg key={i} viewBox="0 0 40 40" fill="none" style={style}>
            <polygon points="20,4 36,36 4,36" stroke="white" strokeWidth="2.8" fill="none" />
          </svg>
        )
        if (type === 'cross') return (
          <svg key={i} viewBox="0 0 40 40" fill="none" style={style}>
            <line x1="20" y1="4" x2="20" y2="36" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
            <line x1="4" y1="20" x2="36" y2="20" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
        )
        if (type === 'circle') return (
          <svg key={i} viewBox="0 0 40 40" fill="none" style={style}>
            <circle cx="20" cy="20" r="14" stroke="white" strokeWidth="2.8" fill="none" />
          </svg>
        )
        if (type === 'diamond') return (
          <svg key={i} viewBox="0 0 40 40" fill="none" style={style}>
            <polygon points="20,4 36,20 20,36 4,20" stroke="white" strokeWidth="2.8" fill="none" />
          </svg>
        )
        return null
      })}
      <div style={{ position: 'absolute', top: '-12%', right: '-8%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,132,252,0.28) 0%, transparent 65%)', filter: 'blur(55px)' }} />
      <div style={{ position: 'absolute', bottom: '-8%', left: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 65%)', filter: 'blur(52px)' }} />
      <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.07) 0%, transparent 68%)', filter: 'blur(28px)' }} />
    </div>
  )
}

/* ── How-to-play data ──────────────────────────────────────────────────────── */
const HOW_TO_PLAY = [
  {
    icon: Users,
    label: 'Join or host',
    desc: 'Create a room and invite friends, or join with a 6-digit code.',
    iconBg: '#ede9fe',
    iconColor: '#6d28d9',
  },
  {
    icon: Zap,
    label: 'Answer fast',
    desc: 'Answer 10 questions by category. Faster correct answers earn more points.',
    iconBg: '#fef9c3',
    iconColor: '#92400e',
  },
  {
    icon: Trophy,
    label: 'Winner takes all',
    desc: 'Top scorer receives the full USDC prize pool, paid out onchain instantly.',
    iconBg: '#dcfce7',
    iconColor: '#166534',
  },
]

/* ── HowToPlayModal ───────────────────────────────────────────────────────── */
function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          style={{ background: 'rgba(15,5,40,0.72)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 56, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full sm:max-w-2xl sm:rounded-[28px]"
            style={{
              background: '#f5f3ff',
              borderRadius: '28px 28px 0 0',
              boxShadow: '0 28px 90px rgba(30,10,60,0.38)',
              maxHeight: '90dvh',
              overflowY: 'auto',
            }}
          >
            {/* Drag pill */}
            <div className="mx-auto mt-3 mb-0 h-1 w-10 rounded-full bg-purple-200 sm:hidden" />

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4">
              <div>
                <h2 className="mt-0.5 text-xl font-bold" style={{ color: '#1e0a3c', fontFamily: "'Space Grotesk', sans-serif" }}>
                  How to play trivio?
                </h2>
              </div>
              <button
                onClick={onClose}
                className="ml-4 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-purple-100"
                style={{ color: '#7c3aed' }}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Step cards */}
            <div className="grid grid-cols-1 gap-3 px-6 pb-2 sm:grid-cols-3">
              {HOW_TO_PLAY.map(({ icon: Icon, label, desc, iconBg, iconColor }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.08, duration: 0.32 }}
                  className="rounded-2xl bg-white p-5"
                  style={{ border: '1px solid rgba(109,40,217,0.10)', boxShadow: '0 2px 12px rgba(109,40,217,0.06)' }}
                >
                  <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: iconBg }}>
                    <Icon size={20} style={{ color: iconColor }} />
                  </div>
                  <p className="mb-1 text-sm font-bold" style={{ color: '#1e0a3c' }}>{label}</p>
                  <p className="text-sm leading-snug text-pretty" style={{ color: '#6b7280' }}>{desc}</p>
                </motion.div>
              ))}
            </div>

            {/* USDC note */}
            <div className="mx-6 mb-6 mt-3 flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: '#ede9fe' }}>
              <TokenUSDC variant="branded" size={15} />
              <p className="text-xs" style={{ color: '#5b21b6' }}>
                All prizes paid in <strong>USDC</strong> on Arc Testnet — instant, verifiable, zero ETH needed.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── LandingPage ──────────────────────────────────────────────────────────── */
interface LandingPageProps {
  onConnected: () => void
}

export default function LandingPage({ onConnected }: LandingPageProps) {
  const { isConnected } = useAccount()
  const [modalOpen, setModalOpen] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  const { displayed, done } = useTypewriter('having fun onchain', 52, 800)

  if (isConnected) { onConnected(); return null }

  return (
    <>
      <HowToPlayModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* ── Sign-in modal overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {showSignIn && (
          <motion.div
            key="signin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-end sm:justify-center overflow-y-auto"
            style={{
              background: 'rgba(25, 8, 55, 0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              padding: 'env(safe-area-inset-top, 16px) 16px env(safe-area-inset-bottom, 24px)',
            }}
            onClick={() => setShowSignIn(false)}
          >
            <motion.div
              key="signin-card"
              initial={{ opacity: 0, y: 56, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-[380px] overflow-hidden rounded-3xl my-auto sm:my-0"
              style={{
                background: 'rgba(255,255,255,0.97)',
                boxShadow: '0 24px 70px rgba(30,10,60,0.35)',
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowSignIn(false)}
                className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-purple-100 z-10"
                style={{ color: '#7c3aed' }}
                aria-label="Close"
              >
                <X size={17} />
              </button>

              <div className="px-6 pb-6 pt-7 sm:px-7 sm:pb-7">
                <p className="mb-1.5 text-center text-base font-bold" style={{ color: '#1e0a3c' }}>
                  Sign in to trivio
                </p>
                <p className="mb-5 text-center text-sm font-normal" style={{ color: '#334155' }}>
                  Choose how you'd like to continue
                </p>

                <div className="space-y-2.5">
                  {/* ── Social / Passkey sign-in buttons ──────────────── */}

                  {/* Continue with Google */}
                  <button
                    onClick={() => {
                      // TODO: Wire Circle User-Controlled Wallet social login
                      console.log('Google sign-in clicked')
                    }}
                    className="group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all hover:shadow-md hover:border-purple-200 active:scale-[0.98]"
                    style={{ borderColor: 'rgba(109,40,217,0.14)', color: '#1e0a3c', background: '#fff' }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                      <svg width="16" height="16" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.003 24.003 0 0 0 0 21.56l7.98-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                    </span>
                    <span className="flex-1 text-left">Continue with Google</span>
                    <svg className="shrink-0 opacity-30 group-hover:opacity-50 transition-opacity" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  {/* Continue with Passkey */}
                  <button
                    onClick={() => {
                      // TODO: Wire Circle Modular Wallet passkey registration/login
                      console.log('Passkey sign-in clicked')
                    }}
                    className="group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all hover:shadow-md hover:border-purple-200 active:scale-[0.98]"
                    style={{ borderColor: 'rgba(109,40,217,0.14)', color: '#1e0a3c', background: '#fff' }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: '#ede9fe' }}>
                      <Fingerprint size={16} style={{ color: '#7c3aed' }} />
                    </span>
                    <span className="flex-1 text-left">Continue with Passkey</span>
                    <svg className="shrink-0 opacity-30 group-hover:opacity-50 transition-opacity" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  {/* ── Divider ───────────────────────────────────────── */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1" style={{ background: 'rgba(109,40,217,0.10)' }} />
                    <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#a78bfa' }}>or</span>
                    <div className="h-px flex-1" style={{ background: 'rgba(109,40,217,0.10)' }} />
                  </div>

                  {/* ── Connect Wallet ────────────────────────────────── */}
                  <ConnectKitButton.Custom>
                    {({ show }) => (
                      <button
                        onClick={show}
                        className="group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all hover:shadow-md hover:border-purple-200 active:scale-[0.98]"
                        style={{ borderColor: 'rgba(109,40,217,0.14)', color: '#1e0a3c', background: '#fff' }}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: '#ede9fe' }}>
                          <Wallet size={15} style={{ color: '#7c3aed' }} />
                        </span>
                        <span className="flex-1 text-left">Connect Wallet</span>
                        <svg className="shrink-0 opacity-30 group-hover:opacity-50 transition-opacity" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}
                  </ConnectKitButton.Custom>
                </div>

                {/* Terms note */}
                <p className="mt-5 text-center text-xs font-normal leading-relaxed" style={{ color: '#475569' }}>
                  By continuing, you agree to trivio's Terms of Service
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="trivio-bg relative flex min-h-screen min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden px-4 py-6 sm:px-5 sm:py-10">
        <FloatingShapes />

        {/* ── Wordmark + Get Started ───────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md my-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="order-1 mb-2.5 sm:mb-3 text-center w-full"
          >
            {/* TRIVIO wordmark */}
            <h1
              className="trivio-title select-none leading-none"
              style={{
                fontSize: 'clamp(52px, 18vw, 108px)',
                color: '#ffffff',
                textShadow: [
                  '0 3px 0 rgba(0,0,0,0.30)',
                  '0 6px 0 rgba(0,0,0,0.18)',
                  '0 10px 28px rgba(0,0,0,0.22)',
                  '-3px 0 0 rgba(196,160,255,0.55)',
                  '3px 0 0 rgba(196,160,255,0.35)',
                ].join(', '),
                WebkitTextStroke: '1.5px rgba(255,255,255,0.35)',
                letterSpacing: '0.04em',
              }}
            >
              trivio
            </h1>

            {/* Typewriter tagline */}
            <div
              className="mt-1.5 sm:mt-2 flex items-center justify-center text-sm sm:text-base font-medium"
              style={{ color: 'rgba(255,255,255,0.72)', minHeight: 26, letterSpacing: '0.02em' }}
            >
              <span>{displayed}</span>
              {!done && <span className="cursor-blink" />}
            </div>
          </motion.div>

          {/* ── Social proof + USDC badge ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.4 }}
            className="order-3 sm:order-2 mt-5 sm:mt-0 sm:mb-4 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 px-2 text-center"
          >
            {/* Live player count */}
            <div
              className="flex items-center gap-1.5 rounded-full px-3 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: '#4ade80' }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#22c55e' }} />
              </span>
              247 games played
            </div>

            {/* USDC callout */}
            <div
              className="flex items-center gap-1.5 rounded-full px-3 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <TokenUSDC variant="branded" size={13} />
              Win real USDC · No ETH needed
            </div>
          </motion.div>

          {/* ── Start Playing button ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
            className="order-2 sm:order-3 mt-4 sm:mt-7 flex flex-col items-center gap-3"
          >
            <button
              onClick={() => setShowSignIn(true)}
              className="rounded-full bg-white px-8 py-2.5 sm:px-9 sm:py-3 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#1e1b2e] shadow-lg transition-all duration-200 hover:scale-105 hover:bg-slate-50 hover:shadow-xl active:scale-95"
              style={{
                boxShadow: '0 6px 22px rgba(0,0,0,0.20), 0 2px 5px rgba(0,0,0,0.10)',
                letterSpacing: '0.07em',
              }}
            >
              GET STARTED
            </button>

            {/* ── How to play pill ─────────────────────────────────────────── */}
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-full px-5 py-1.5 text-xs sm:text-sm font-medium text-white/80 transition-all duration-200 hover:bg-black/40 hover:text-white hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(0, 0, 0, 0.28)',
                backdropFilter: 'blur(8px)',
              }}
            >
              How to play?
            </button>
          </motion.div>
        </div>
      </div>
    </>
  )
}
