import { useState, useEffect, startTransition } from 'react'
import { usePrivy, useLogin } from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Zap, Trophy, X, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { getDiceBearAvatarUrl } from '@/lib/userProfile'
import { RECENT_WINNERS_FEED } from '@/lib/lobbyData'

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
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 90% 5%, rgba(192,132,252,0.22) 0%, transparent 45%), radial-gradient(circle at 10% 95%, rgba(139,92,246,0.20) 0%, transparent 45%), radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.06) 0%, transparent 60%)',
        isolation: 'isolate',
      }}
    >
      {SHAPES.map(([type, x, y, size, rot], i) => {
        const s = size as number
        const style: React.CSSProperties = {
          left: `${x}%`, top: `${y}%`,
          width: s, height: s,
          transform: `rotate(${rot}deg)`,
          WebkitTransform: `rotate(${rot}deg)`,
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          style={{
            background: 'rgba(15, 5, 40, 0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 16px))',
          }}
          onClick={onClose}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg sm:max-w-2xl rounded-[28px] my-auto flex flex-col overflow-hidden"
            style={{
              background: '#f5f3ff',
              boxShadow: '0 28px 90px rgba(30,10,60,0.38)',
              maxHeight: 'min(88dvh, 88vh)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
              <h2 className="text-xl font-bold" style={{ color: '#1e0a3c', fontFamily: "'Space Grotesk', sans-serif" }}>
                How to play trivio?
              </h2>
              <button
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-purple-100"
                style={{ color: '#7c3aed' }}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Scrollable content container */}
            <div className="overflow-y-auto px-6 pb-6 pt-1">
              {/* Step cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {HOW_TO_PLAY.map(({ icon: Icon, label, desc, iconBg, iconColor }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + i * 0.06, duration: 0.28 }}
                    className="rounded-2xl bg-white p-4 sm:p-5"
                    style={{ border: '1px solid rgba(109,40,217,0.10)', boxShadow: '0 2px 12px rgba(109,40,217,0.06)' }}
                  >
                    <div className="mb-3 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl" style={{ background: iconBg }}>
                      <Icon size={19} style={{ color: iconColor }} />
                    </div>
                    <p className="mb-1 text-sm font-bold" style={{ color: '#1e0a3c' }}>{label}</p>
                    <p className="text-xs sm:text-sm leading-snug text-pretty" style={{ color: '#6b7280' }}>{desc}</p>
                  </motion.div>
                ))}
              </div>

              {/* USDC note */}
              <div className="mt-3.5 flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: '#ede9fe' }}>
                <TokenUSDC variant="branded" size={15} />
                <p className="text-xs" style={{ color: '#5b21b6' }}>
                  All prizes paid in <strong>USDC</strong> on Arc — instant, verifiable, zero ETH needed.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Live Winners Marquee ─────────────────────────────────────────────────── */
function LiveWinnersTicker({ onWinnerClick }: { onWinnerClick: () => void }) {
  // Duplicate array for a seamless infinite loop where items follow each other
  const continuousList = [...RECENT_WINNERS_FEED, ...RECENT_WINNERS_FEED]

  return (
    <div className="w-full max-w-full overflow-hidden select-none relative py-1 trivio-ticker-mask">
      {/* Single continuous line where items follow each other */}
      <div className="animate-marquee flex items-center gap-2 sm:gap-3 py-0.5">
        {continuousList.map((item, idx) => (
          <button
            key={`${item.id}-${idx}`}
            onClick={onWinnerClick}
            type="button"
            className="group flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs text-white transition-all duration-200 hover:bg-white/25 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
            style={{
              background: 'rgba(255, 255, 255, 0.16)',
              border: '1px solid rgba(255, 255, 255, 0.26)',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08)',
            }}
          >
            <img
              src={getDiceBearAvatarUrl('bottts-neutral', item.avatarSeed)}
              alt={item.username}
              className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-white/20 border border-white/40 shrink-0"
            />
            <span className="font-semibold text-white/90 tracking-tight">@{item.username}</span>
            <span className="font-black text-white tracking-tight inline-flex items-center gap-0.5 sm:gap-1">
              +${item.amount}
            </span>
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-white/95 uppercase tracking-wide leading-none">
              <TokenUSDC variant="branded" size={14} className="shrink-0" />
              <span>USDC</span>
            </span>
            <span className="text-[10px] sm:text-[11px] text-white/70 font-medium truncate max-w-[110px] sm:max-w-none">
              · {item.category}
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono text-purple-200/90 ml-0.5">
              {item.timeAgo}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── LandingPage ──────────────────────────────────────────────────────────── */
interface LandingPageProps {
  onConnected: () => void
}

export default function LandingPage({ onConnected }: LandingPageProps) {
  const { authenticated } = usePrivy()
  const { login } = useLogin({
    onComplete: () => {
      onConnected()
    },
  })
  const [modalOpen, setModalOpen] = useState(false)

  const { displayed, done } = useTypewriter('having fun onchain', 52, 800)

  // If already authenticated via Privy, immediately notify parent
  useEffect(() => {
    if (authenticated) {
      onConnected()
    }
  }, [authenticated, onConnected])

  const handleGetStarted = () => {
    login()
  }

  return (
    <>
      <HowToPlayModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <div
        className="trivio-bg relative flex flex-1 min-h-screen min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden px-3.5 sm:px-6"
        style={{
          paddingTop: 'max(1.75rem, env(safe-area-inset-top, 1.75rem))',
          paddingBottom: 'max(5.5rem, calc(env(safe-area-inset-bottom, 20px) + 4.5rem))',
        }}
      >
        <FloatingShapes />

        {/* ── Main Hero Container ───────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-xl my-auto text-center">
          {/* Wordmark Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mb-1 sm:mb-2 text-center w-full"
          >
            {/* TRIVIO wordmark */}
            <h1
              className="trivio-title select-none leading-none"
              style={{
                fontSize: 'clamp(52px, 17vw, 114px)',
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
              className="mt-1 flex items-center justify-center text-xs sm:text-base font-semibold"
              style={{ color: 'rgba(255,255,255,0.85)', minHeight: 22, letterSpacing: '0.02em' }}
            >
              <span>{displayed}</span>
              {!done && <span className="cursor-blink" />}
            </div>
          </motion.div>

          {/* ── Start Playing Call-To-Action & How to play ──────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3 sm:mt-5 flex flex-col items-center gap-2 sm:gap-2.5 w-full mb-3 sm:mb-4"
          >
            <button
              onClick={handleGetStarted}
              className="relative inline-flex items-center justify-center rounded-full bg-white px-8 py-3 sm:px-11 sm:py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1e1b2e] shadow-xl transition-all duration-200 hover:scale-105 hover:bg-slate-50 active:scale-95 cursor-pointer"
              style={{
                boxShadow: '0 8px 30px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.12)',
                letterSpacing: '0.07em',
              }}
            >
              GET STARTED
            </button>

            {/* How to play pill */}
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-full px-4 py-1 text-[11px] sm:text-xs font-medium text-white/80 transition-all duration-200 hover:bg-black/40 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                backdropFilter: 'blur(8px)',
              }}
            >
              How to play?
            </button>
          </motion.div>

          {/* ── Free-Flowing Live Winners Stream (Underneath Buttons, Non-simultaneous) ── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.5 }}
            className="w-full flex flex-col items-center mt-1"
          >
            <LiveWinnersTicker onWinnerClick={handleGetStarted} />
          </motion.div>
        </div>
      </div>
    </>
  )
}


