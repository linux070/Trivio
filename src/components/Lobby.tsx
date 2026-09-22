import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useDisconnect } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { Plus, LogIn, LogOut, Copy, Check, Fingerprint, Wallet, ChevronDown } from 'lucide-react'
import { getUserProfile } from '@/lib/userProfile'
import type { Category } from '@/lib/questions'

const CATEGORIES: { label: Category; emoji: string }[] = [
  { label: 'General Knowledge', emoji: '🧠' },
  { label: 'Crypto', emoji: '⚡' },
  { label: 'Sports', emoji: '🏆' },
  { label: 'Pop Culture', emoji: '🎬' },
  { label: 'Science', emoji: '🔬' },
  { label: 'History', emoji: '📜' },
]

interface LobbyProps {
  onCreateRoom: (category: Category) => void
  onJoinRoom: (category: Category) => void
  onDisconnect?: () => void
}

function WalletProfile({ onDisconnect }: { onDisconnect?: () => void }) {
  const { address: wagmiAddress } = useAccount()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const profile = getUserProfile()
  const { user } = usePrivy()
  const privyWalletAddress = user?.wallet?.address as `0x${string}` | undefined
  const activeAddress = wagmiAddress || privyWalletAddress || '0x0000000000000000000000000000000000000000'
  const provider = (() => {
    if (!user) return 'wallet' as const
    const linkedAccounts = user.linkedAccounts || []
    if ((user as any).google || linkedAccounts.some((a: any) => a.type === 'google_oauth' || a.type === 'google')) return 'google' as const
    if ((user as any).passkey || linkedAccounts.some((a: any) => a.type === 'passkey')) return 'passkey' as const
    if ((user as any).email || linkedAccounts.some((a: any) => a.type === 'email')) return 'email' as const
    return 'wallet' as const
  })()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopy = () => {
    if (!activeAddress) return
    navigator.clipboard.writeText(activeAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnectClick = () => {
    try {
      disconnect()
    } catch {
      // ignore
    }
    setOpen(false)
    if (onDisconnect) {
      onDisconnect()
    }
  }

  const shortAddr = activeAddress ? `${activeAddress.slice(0, 5)}...${activeAddress.slice(-4)}` : ''
  const displayName = profile?.username ? `@${profile.username}` : shortAddr

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Chip */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 rounded-full border border-purple-200/80 bg-purple-50/70 py-1 pl-1.5 pr-3 text-xs font-semibold text-purple-950 transition-all hover:bg-purple-100 hover:border-purple-300 active:scale-95 shadow-sm"
      >
        {/* Avatar / Provider Icon */}
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.username}
            className="h-6 w-6 rounded-full bg-white ring-1 ring-purple-300 object-cover"
          />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-xs">
            {provider === 'google' && (
              <svg width="13" height="13" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.003 24.003 0 0 0 0 21.56l7.98-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            )}
            {provider === 'passkey' && (
              <Fingerprint size={13} className="text-purple-600" />
            )}
            {provider === 'wallet' && (
              <Wallet size={13} className="text-purple-600" />
            )}
          </span>
        )}

        <span className="font-medium text-[11px] sm:text-xs tracking-tight max-w-[110px] truncate">{displayName}</span>
        <ChevronDown size={13} className={`text-purple-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Profile Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white p-3.5 shadow-xl border border-purple-100 z-50"
            style={{ boxShadow: '0 12px 36px rgba(30, 10, 60, 0.14)' }}
          >
            {/* Header info */}
            <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2">
                {profile?.avatarUrl && (
                  <img src={profile.avatarUrl} alt="" className="h-7 w-7 rounded-full bg-purple-50 ring-1 ring-purple-200" />
                )}
                <div>
                  <p className="text-xs font-bold text-gray-900">{profile?.username ? `@${profile.username}` : 'Player'}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {provider === 'google' ? 'Google' : provider === 'passkey' ? 'Passkey' : provider === 'email' ? 'Email' : 'Wallet'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-medium text-gray-500">Arc Testnet</span>
              </div>
            </div>

            {/* Address Box */}
            <div className="mb-3 flex items-center justify-between rounded-xl bg-gray-50 p-2 border border-gray-100">
              <span className="font-mono text-[11px] text-gray-700 truncate mr-2">{activeAddress}</span>
              <button
                onClick={handleCopy}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-gray-200 transition-colors text-gray-500"
                title="Copy Address"
              >
                {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              </button>
            </div>

            {/* Disconnect Button */}
            <button
              onClick={handleDisconnectClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 active:scale-98"
            >
              <LogOut size={13} />
              <span>Disconnect</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Lobby({ onCreateRoom, onJoinRoom, onDisconnect }: LobbyProps) {
  const [selected, setSelected] = useState<Category>('General Knowledge')

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] w-full flex-col justify-between overflow-x-hidden bg-white">
      {/* Subtle light background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '-5%', left: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '0%', right: '-6%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)', filter: 'blur(55px)' }} />
      </div>

      <div className="relative z-10 mx-auto my-auto w-full max-w-md px-4 py-5 sm:max-w-lg sm:px-6 sm:py-8">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 sm:mb-7 flex items-center justify-between gap-3"
        >
          <h1
            className="trivio-title shrink-0 select-none"
            style={{ fontSize: 'clamp(22px, 6vw, 32px)', color: '#1e0a3c', letterSpacing: '0.04em' }}
          >
            trivio
          </h1>
          <div className="shrink-0">
            <WalletProfile onDisconnect={onDisconnect} />
          </div>
        </motion.header>

        {/* ── Category picker ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-4 sm:mb-6"
        >
          <p
            className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-black"
            style={{ color: '#000000', letterSpacing: '0.12em' }}
          >
            Pick a category
          </p>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(({ label, emoji }) => {
              const active = selected === label
              return (
                <button
                  key={label}
                  onClick={() => setSelected(label)}
                  className="group flex flex-col items-center justify-center min-h-[68px] sm:min-h-[80px] gap-1 sm:gap-1.5 rounded-2xl p-1.5 sm:p-2 text-center transition-all duration-150 active:scale-95"
                  style={{
                    background: '#f3f4f6',
                    border: active ? '1.5px solid #7c3aed' : '1.5px solid transparent',
                    boxShadow: 'none',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget).style.background = '#e5e7eb' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget).style.background = '#f3f4f6' }}
                >
                  <span className="text-lg sm:text-xl leading-none">{emoji}</span>
                  <span
                    className="text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 text-black"
                    style={{ color: '#000000' }}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </motion.section>

        {/* ── Action buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="grid grid-cols-2 gap-2.5 sm:gap-3"
        >
          {/* Create */}
          <button
            onClick={() => onCreateRoom(selected)}
            className="group flex flex-col items-center gap-2 sm:gap-3 rounded-2xl p-3 sm:py-4 sm:px-4 text-center transition-all duration-150 hover:brightness-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', boxShadow: '0 4px 16px rgba(124,58,237,0.20)' }}
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.18)' }}>
              <Plus size={17} className="text-white" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-white">Create</p>
              <p className="text-[11px] sm:text-xs text-white/70">Host a game</p>
            </div>
          </button>

          {/* Join */}
          <button
            onClick={() => onJoinRoom(selected)}
            className="group flex flex-col items-center gap-2 sm:gap-3 rounded-2xl p-3 sm:py-4 sm:px-4 text-center transition-all duration-150 hover:bg-violet-50 active:scale-95"
            style={{ background: '#f5f3ff', border: '1.5px solid #ede9fe' }}
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl" style={{ background: '#ede9fe' }}>
              <LogIn size={17} style={{ color: '#7c3aed' }} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold" style={{ color: '#1e0a3c' }}>Join</p>
              <p className="text-[11px] sm:text-xs" style={{ color: '#9ca3af' }}>Enter a code</p>
            </div>
          </button>
        </motion.div>

        {/* ── Footer note ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="mt-4 sm:mt-6 text-center text-xs font-medium"
          style={{ color: '#4b5563' }}
        >
          Prizes paid in USDC on Arc Testnet · instant, verifiable, zero ETH
        </motion.p>
      </div>
    </div>
  )
}
