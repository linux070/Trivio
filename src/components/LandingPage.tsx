import { useState, useEffect, startTransition } from 'react'
import { usePrivy, useLogin } from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Zap, Trophy, X, Sparkles, ShieldCheck, HelpCircle } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import { getDiceBearAvatarUrl, getUserProfile, generateRandomUsername } from '@/lib/userProfile'
import { useOnchainProfile } from '@/hooks/useTrivioProfileRegistry'
import { useLiveWinners } from '@/hooks/useLiveWinners'
import { formatTimeAgo, type WinnerPayoutRecord } from '@/lib/winnersStorage'
import { setPendingJoin, getPendingJoin, getRoomCategory, saveRoomCategory, extractRoomCode } from '@/lib/roomStorage'
import type { Category } from '@/lib/questions'

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
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
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
    desc: 'Create a room and invite friends, or join with a 6 or 8-digit code.',
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
    label: 'Earn prizes',
    desc: 'Top scorers split the USDC prize pool. Payouts settle onchain, instantly.',
    iconBg: '#dcfce7',
    iconColor: '#166534',
  },
]

/* ── HowToPlayModal (Landing Quick Preview) ────────────────────────────────── */
function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-6 overflow-hidden">
          {/* Smooth Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed inset-0 bg-[#0f0528]/70 backdrop-blur-xs cursor-pointer transform-gpu"
            onClick={onClose}
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg sm:max-w-2xl rounded-[28px] my-auto flex flex-col overflow-hidden max-h-[90dvh] bg-[#f5f3ff] shadow-[0_28px_90px_rgba(30,10,60,0.38)] z-10 transform-gpu"
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
                  All prizes paid in <strong>USDC</strong> on Arc — instant onchain payouts straight to your wallet.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ── Live Winners Marquee ─────────────────────────────────────────────────── */
function TickerWinnerButton({
  item,
  onClick,
}: {
  item: WinnerPayoutRecord
  onClick: () => void
}) {
  const { profile: onchainProfile } = useOnchainProfile(item.winnerAddress)
  const localProfile = getUserProfile(item.winnerAddress)

  const rawUsername =
    onchainProfile?.username ||
    localProfile?.username ||
    (item.username && !item.username.startsWith('0x')
      ? item.username
      : generateRandomUsername(item.winnerAddress))

  const formattedUsername = rawUsername.startsWith('@')
    ? rawUsername
    : `@${rawUsername}`

  const resolvedAvatar =
    onchainProfile?.avatarUrl ||
    localProfile?.avatarUrl ||
    (item.avatarSeed
      ? getDiceBearAvatarUrl(localProfile?.avatarStyle || 'bottts-neutral', item.avatarSeed)
      : getDiceBearAvatarUrl('bottts-neutral', item.winnerAddress || rawUsername))

  return (
    <button
      onClick={onClick}
      type="button"
      className="group flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs text-white transition-all duration-200 hover:bg-white/25 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
      style={{
        background: 'rgba(255, 255, 255, 0.16)',
        border: '1px solid rgba(255, 255, 255, 0.26)',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08)',
      }}
    >
      <img
        src={resolvedAvatar}
        alt={rawUsername}
        className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-white/20 border border-white/40 shrink-0 object-cover"
        onError={(e) => {
          e.currentTarget.src = getDiceBearAvatarUrl('bottts-neutral', item.winnerAddress || rawUsername)
        }}
      />
      <span className="font-semibold text-white/90 tracking-tight">{formattedUsername}</span>
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
        {formatTimeAgo(item.timestamp)}
      </span>
    </button>
  )
}

function LiveWinnersTicker({ onWinnerClick }: { onWinnerClick: () => void }) {
  const { payouts } = useLiveWinners()

  // If we have real recorded winner payouts, prepare a seamless loop
  if (payouts && payouts.length > 0) {
    const repeatCount = Math.max(2, Math.ceil(8 / payouts.length))
    const continuousList = Array.from({ length: repeatCount }, () => payouts).flat()

    return (
      <div className="w-full max-w-full overflow-hidden select-none relative py-1 trivio-ticker-mask">
        <div className="animate-marquee flex items-center gap-2 sm:gap-3 py-0.5">
          {continuousList.map((item, idx) => (
            <TickerWinnerButton
              key={`${item.roomCode}-${item.timestamp}-${idx}`}
              item={item}
              onClick={onWinnerClick}
            />
          ))}
        </div>
      </div>
    )
  }

  // Live onchain platform ticker when no payouts are recorded yet
  const platformHighlights = [
    { label: '⚡ Zero-Gas USDC Trivia on Arc Network', action: 'Play Now' },
    { label: '🏆 Instant Onchain Payouts to Your Wallet', action: 'Join' },
    { label: '🛡️ Non-Custodial Smart Escrow & EIP-712 Anti-Cheat', action: 'Learn' },
    { label: '🎮 Real-Time Multiplayer Rooms & Solo Practice', action: 'Enter' },
    { label: '🥇 100% USDC Prize Pools & Multi-Winner Splits', action: 'Compete' },
  ]
  const continuousHighlights = [...platformHighlights, ...platformHighlights]

  return (
    <div className="w-full max-w-full overflow-hidden select-none relative py-1 trivio-ticker-mask">
      <div className="animate-marquee flex items-center gap-2 sm:gap-3 py-0.5">
        {continuousHighlights.map((item, idx) => (
          <button
            key={`highlight-${idx}`}
            onClick={onWinnerClick}
            type="button"
            className="group flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs text-white transition-all duration-200 hover:bg-white/25 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
            style={{
              background: 'rgba(255, 255, 255, 0.16)',
              border: '1px solid rgba(255, 255, 255, 0.26)',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08)',
            }}
          >
            <span className="font-semibold text-white/95 tracking-tight">{item.label}</span>
            <span className="text-[10px] font-bold text-purple-200 bg-white/15 px-2 py-0.5 rounded-full uppercase tracking-wider group-hover:bg-white/25 transition-colors">
              {item.action}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── LandingPage ──────────────────────────────────────────────────────────── */
interface LandingPageProps {
  onConnected: (prefillCode?: string, category?: Category) => void
}

export default function LandingPage({ onConnected }: LandingPageProps) {
  const { authenticated } = usePrivy()
  const { login } = useLogin({
    onComplete: () => {
      const pending = getPendingJoin()
      onConnected(pending?.roomCode, pending?.category)
    },
  })
  const [modalOpen, setModalOpen] = useState(false)

  const [roomCode, setRoomCode] = useState('')
  const { displayed, done } = useTypewriter('having fun onchain', 52, 800)

  // If already authenticated via Privy, immediately notify parent
  useEffect(() => {
    if (authenticated) {
      const pending = getPendingJoin()
      onConnected(pending?.roomCode, pending?.category)
    }
  }, [authenticated, onConnected])

  const handleGetStarted = () => {
    if (roomCode.trim()) {
      const extracted = extractRoomCode(roomCode)
      if (extracted?.roomCode) {
        const cat = getRoomCategory(extracted.roomCode) || extracted.category || undefined
        if (cat) saveRoomCategory(extracted.roomCode, cat)
        setPendingJoin(extracted.roomCode, cat)
        if (authenticated) {
          onConnected(extracted.roomCode, cat)
          return
        }
      }
    }
    login()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    if (!pastedText) return
    const extracted = extractRoomCode(pastedText)
    if (extracted && extracted.roomCode) {
      e.preventDefault()
      setRoomCode(extracted.roomCode)
      if (extracted.category) saveRoomCategory(extracted.roomCode, extracted.category)
      toast.success(`Room code detected: ${extracted.roomCode}`)
    }
  }

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault()
    const extracted = extractRoomCode(roomCode)
    if (!extracted || !extracted.roomCode) {
      toast.error('Please enter a valid 4 to 8-character room code or invite link')
      return
    }

    const code = extracted.roomCode
    const category = getRoomCategory(code) || extracted.category || undefined
    if (category) saveRoomCategory(code, category)
    setPendingJoin(code, category)

    if (authenticated) {
      onConnected(code, category)
    } else {
      login()
    }
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

          {/* ── Start Playing Call-To-Action & Fast-Track Join (Option 1 Hierarchy) ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3.5 sm:mt-6 flex flex-col items-center gap-2.5 sm:gap-3 w-full mb-3 sm:mb-4"
          >
            {/* 1. Primary Hero Action (Squircle Rounded Rectangle) */}
            <button
              onClick={handleGetStarted}
              className="relative inline-flex items-center justify-center rounded-2xl bg-white px-9 py-3.5 sm:px-12 sm:py-4 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1e1b2e] border border-white/60 shadow-[0_8px_25px_rgba(0,0,0,0.24)] transition-all duration-200 hover:scale-105 hover:bg-slate-50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] active:scale-95 cursor-pointer"
              style={{
                letterSpacing: '0.07em',
              }}
            >
              GET STARTED
            </button>

            {/* 2. Direct Room Code / Invite Link Fast-Track Input */}
            <form
              onSubmit={handleJoinWithCode}
              className="w-full max-w-[290px] sm:max-w-[325px] px-1 sm:px-0"
            >
              <div
                className="relative flex items-center w-full rounded-2xl p-1 pl-3.5 pr-1.5 transition-all duration-200 focus-within:border-white/60 focus-within:bg-black/35 focus-within:ring-2 focus-within:ring-white/20 shadow-md group"
                style={{
                  background: 'rgba(0, 0, 0, 0.22)',
                  border: '1px solid rgba(255, 255, 255, 0.24)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => {
                    const val = e.target.value
                    const extracted = extractRoomCode(val)
                    if (extracted && (val.includes('http') || val.includes('join=') || val.includes('?'))) {
                      setRoomCode(extracted.roomCode)
                    } else {
                      setRoomCode(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                    }
                  }}
                  onPaste={handlePaste}
                  placeholder="Enter room code (e.g. CRYP99)"
                  maxLength={100}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  aria-label="Room Code"
                  className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-mono font-bold tracking-wider text-white placeholder:font-sans placeholder:tracking-normal placeholder:font-medium placeholder:text-white/50 focus:outline-none placeholder:text-[11px] sm:placeholder:text-xs"
                />
                <button
                  type="submit"
                  disabled={!roomCode.trim()}
                  className="flex h-7 px-2.5 sm:h-7.5 sm:px-3 shrink-0 items-center justify-center rounded-xl bg-white text-[#1e0a3c] font-black text-[11px] sm:text-xs tracking-wider uppercase transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-xs select-none"
                  title="Join Room"
                  aria-label="Join Room"
                >
                  GO
                </button>
              </div>
            </form>

            {/* 3. Subtle Helper Link below */}
            <button
              onClick={() => setModalOpen(true)}
              type="button"
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-white/75 hover:text-white transition-colors cursor-pointer py-1 px-2.5 rounded-lg hover:bg-white/10 active:scale-95 mt-0.5"
            >
              <span>How to play trivio?</span>
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


