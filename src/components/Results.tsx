import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, ExternalLink, RotateCcw, Medal } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ARC_TESTNET_CHAIN_ID } from '@/config'

const spectral = 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)'

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.46)',
    border: '1px solid rgba(255,255,255,0.56)',
  } as React.CSSProperties,
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export interface LeaderboardEntry {
  address: string
  score: number
  rank: number
}

interface ResultsProps {
  winnerAddress: string
  prizeAmount: string
  txHash?: string
  myAddress?: string
  leaderboard?: LeaderboardEntry[]
  onPlayAgain: () => void
}

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#b45309']
const RANK_LABELS = ['1st', '2nd', '3rd']

export default function Results({
  winnerAddress,
  prizeAmount,
  txHash,
  myAddress,
  leaderboard = [],
  onPlayAgain,
}: ResultsProps) {
  const [tab, setTab] = useState<'result' | 'leaderboard'>('result')
  const isWinner = myAddress?.toLowerCase() === winnerAddress.toLowerCase()
  const txUrl = txHash ? buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, txHash) : null

  // Build a demo leaderboard if none passed in
  const board: LeaderboardEntry[] = leaderboard.length > 0 ? leaderboard : [
    { address: winnerAddress, score: 980, rank: 1 },
    { address: myAddress && myAddress !== winnerAddress ? myAddress : '0xabc1230000000000000000000000000000001234', score: 720, rank: 2 },
    { address: '0xdef4560000000000000000000000000000005678', score: 540, rank: 3 },
  ]

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '5%', left: '5%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.22) 0%, transparent 70%)', filter: 'blur(75px)' }} />
        <div style={{ position: 'absolute', bottom: '8%', right: '5%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.22) 0%, transparent 70%)', filter: 'blur(70px)' }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-3.5 pb-12 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">

        {/* Trophy header */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          className="mb-5 sm:mb-6 text-center"
        >
          <div className="mx-auto mb-3 flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-full" style={{ background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.25)' }}>
            <Trophy size={30} style={{ color: '#f59e0b' }} />
          </div>
          <h1 className="display text-3xl sm:text-4xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
            {isWinner ? 'You won!' : 'Game over!'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--muted)' }}>
            {isWinner
              ? 'The USDC prize is on its way to your wallet.'
              : `${shortAddr(winnerAddress)} won this round.`}
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4 flex rounded-2xl p-1"
          style={{ background: 'rgba(18,45,69,0.06)', border: '1px solid rgba(18,45,69,0.06)' }}
        >
          {(['result', 'leaderboard'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-xl py-2 sm:py-2.5 text-xs sm:text-sm font-semibold capitalize transition-all duration-150"
              style={{
                background: tab === t ? 'white' : 'transparent',
                color: tab === t ? 'var(--ink)' : 'var(--muted)',
                boxShadow: tab === t ? '0 1px 6px rgba(18,45,69,0.1)' : 'none',
              }}
            >
              {t === 'result' ? 'Result' : 'Leaderboard'}
            </button>
          ))}
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {tab === 'result' ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {/* Prize card */}
              <div className="overflow-hidden rounded-2xl sm:rounded-3xl" style={glass.card}>
                <div style={{ height: 3, background: spectral }} />
                <div className="p-5 sm:p-6">
                  <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.1em' }}>
                    {isWinner ? 'Prize paid to you' : 'Prize paid to winner'}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <TokenUSDC variant="branded" size={24} />
                    <span className="display text-3xl sm:text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
                      {prizeAmount}
                    </span>
                    <span className="text-base sm:text-xl font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
                  </div>
                  {winnerAddress && (
                    <p className="mt-3 text-center text-xs" style={{ color: 'var(--subtle)' }}>
                      Paid to <span className="mono font-semibold" style={{ color: 'var(--ink-2)' }}>{shortAddr(winnerAddress)}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Explorer link */}
              {txUrl && (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl px-5 py-4 transition-opacity hover:opacity-75"
                  style={glass.card}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>View payout transaction</p>
                    <p className="text-xs" style={{ color: 'var(--subtle)' }}>Arc Testnet Explorer</p>
                  </div>
                  <ExternalLink size={16} style={{ color: 'var(--muted)' }} />
                </a>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden rounded-2xl sm:rounded-3xl"
              style={glass.card}
            >
              <div style={{ height: 3, background: spectral }} />
              <div className="p-4 sm:p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.1em' }}>
                  Final Standings
                </p>
                <div className="space-y-2">
                  {board.map((entry, i) => {
                    const isMe = myAddress?.toLowerCase() === entry.address.toLowerCase()
                    const rankColor = RANK_COLORS[i] ?? 'var(--muted)'
                    const rankLabel = RANK_LABELS[i] ?? `${i + 1}th`
                    return (
                      <motion.div
                        key={entry.address}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-2.5 sm:gap-3 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3"
                        style={{
                          ...glass.inner,
                          background: isMe ? 'rgba(124,58,237,0.07)' : glass.inner.background,
                          border: isMe ? '1px solid rgba(124,58,237,0.2)' : glass.inner.border,
                        }}
                      >
                        {/* Rank badge */}
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${rankColor}18` }}>
                          {i < 3
                            ? <Medal size={16} style={{ color: rankColor }} />
                            : <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{entry.rank}</span>
                          }
                        </div>

                        {/* Address */}
                        <div className="min-w-0 flex-1">
                          <p className="mono text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                            {shortAddr(entry.address)}
                            {isMe && <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'rgba(124,58,237,0.12)', color: '#5b21b6' }}>you</span>}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--subtle)' }}>{rankLabel} place</p>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{entry.score}</p>
                          <p className="text-xs" style={{ color: 'var(--subtle)' }}>pts</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play again */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onPlayAgain}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <RotateCcw size={15} />
          Play Again
        </motion.button>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--subtle)' }}>
          TRIVIO · having fun onchain
        </p>
      </div>
    </div>
  )
}
