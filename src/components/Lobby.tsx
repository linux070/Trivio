import { useState } from 'react'
import { motion } from 'framer-motion'
import { ConnectKitButton } from 'connectkit'
import { Plus, LogIn } from 'lucide-react'
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
}

export default function Lobby({ onCreateRoom, onJoinRoom }: LobbyProps) {
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
            <ConnectKitButton showBalance={false} />
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
