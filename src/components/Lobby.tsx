import { useState } from 'react'
import { motion } from 'framer-motion'
import { ConnectKitButton } from 'connectkit'
import { Plus, LogIn } from 'lucide-react'
import type { Category } from '@/lib/questions'

const CATEGORIES: { label: Category; emoji: string }[] = [
  { label: 'General Knowledge', emoji: '🧠' },
  { label: 'Crypto',            emoji: '⚡' },
  { label: 'Sports',            emoji: '🏆' },
  { label: 'Pop Culture',       emoji: '🎬' },
  { label: 'Science',           emoji: '🔬' },
  { label: 'History',           emoji: '📜' },
]

interface LobbyProps {
  onCreateRoom: (category: Category) => void
  onJoinRoom: (category: Category) => void
}

export default function Lobby({ onCreateRoom, onJoinRoom }: LobbyProps) {
  const [selected, setSelected] = useState<Category>('General Knowledge')

  return (
    <div className="relative min-h-dvh overflow-hidden bg-white">
      {/* Subtle light background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '-5%', left: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '0%', right: '-6%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)', filter: 'blur(55px)' }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-12 pt-6 sm:max-w-lg sm:px-6">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8 flex items-center justify-between gap-3"
        >
          <h1
            className="funoa-title shrink-0 select-none"
            style={{ fontSize: 'clamp(22px, 6vw, 32px)', color: '#1e0a3c', letterSpacing: '0.04em' }}
          >
            TRIVIO
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
          className="mb-6"
        >
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: '#7c3aed', letterSpacing: '0.12em' }}
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
                  className="group flex flex-col items-center justify-center min-h-[74px] sm:min-h-[82px] gap-1.5 rounded-2xl p-1.5 sm:p-2.5 text-center transition-all duration-150 active:scale-95"
                  style={{
                    background: active ? '#ede9fe' : '#f3f4f6',
                    border: active ? '1px solid #7c3aed' : '1px solid transparent',
                    boxShadow: active ? '0 2px 10px rgba(124,58,237,0.15)' : 'none',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget).style.background = '#e5e7eb' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget).style.background = '#f3f4f6' }}
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  <span
                    className="text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2"
                    style={{ color: active ? '#5b21b6' : '#6b7280' }}
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
            className="group flex flex-col items-center gap-2.5 sm:gap-3 rounded-2xl p-3.5 sm:py-5 sm:px-4 text-center transition-all duration-150 hover:brightness-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', boxShadow: '0 4px 20px rgba(124,58,237,0.28)' }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.18)' }}>
              <Plus size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Create</p>
              <p className="text-xs text-white/60">Host a game</p>
            </div>
          </button>

          {/* Join */}
          <button
            onClick={() => onJoinRoom(selected)}
            className="group flex flex-col items-center gap-2.5 sm:gap-3 rounded-2xl p-3.5 sm:py-5 sm:px-4 text-center transition-all duration-150 hover:bg-violet-50 active:scale-95"
            style={{ background: '#f5f3ff', border: '1.5px solid #ede9fe' }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#ede9fe' }}>
              <LogIn size={18} style={{ color: '#7c3aed' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#1e0a3c' }}>Join</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Enter a code</p>
            </div>
          </button>
        </motion.div>

        {/* ── Footer note ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="mt-6 text-center text-xs text-gray-300"
        >
          Prizes paid in USDC on Arc Testnet · instant, verifiable, zero ETH
        </motion.p>
      </div>
    </div>
  )
}
