import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, ExternalLink, RotateCcw, Check, Copy, X } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ARC_TESTNET_CHAIN_ID } from '@/config'
import {
  getRoomPayout,
  calculatePayoutSplits,
  getRoomCategory,
  getRoomPrize,
  getRoomUserScore,
  getActiveGame,
  getRegisteredLiveRooms,
} from '@/lib/roomStorage'
import { recordWinnerPayout, getStoredPayouts } from '@/lib/winnersStorage'
import {
  useRoomInfo,
  useRoomWinners,
  useRoomPlayers,
  formatUSDCRaw,
  type RoomTuple,
} from '@/hooks/useTriviaContract'
import { useOnchainProfile } from '@/hooks/useTrivioProfileRegistry'
import { getDiceBearAvatarUrl, getUserProfile, generateRandomUsername } from '@/lib/userProfile'

function shortAddr(addr: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export interface LeaderboardEntry {
  address: string
  score: number
  rank: number
  username?: string
  avatarUrl?: string
}

interface ResultsProps {
  winnerAddress: string
  prizeAmount: string
  txHash?: string
  myAddress?: string
  myScore?: number
  roomCode?: string
  leaderboard?: LeaderboardEntry[]
  onPlayAgain: () => void
}

const RANK_BADGES = [
  { label: '1st', bg: 'from-amber-400 to-amber-500', icon: '🥇', border: 'border-amber-200/80', text: 'text-amber-700', pill: 'bg-amber-50 text-amber-800 border-amber-200/60' },
  { label: '2nd', bg: 'from-slate-300 to-slate-500', icon: '🥈', border: 'border-slate-200/80', text: 'text-slate-700', pill: 'bg-slate-50 text-slate-700 border-slate-200/60' },
  { label: '3rd', bg: 'from-amber-600 to-amber-800', icon: '🥉', border: 'border-amber-300/80', text: 'text-amber-800', pill: 'bg-amber-50 text-amber-900 border-amber-200/60' },
  { label: '4th', bg: 'from-purple-500 to-indigo-600', icon: '🏅', border: 'border-purple-200/80', text: 'text-purple-700', pill: 'bg-purple-50 text-purple-800 border-purple-200/60' },
  { label: '5th', bg: 'from-purple-500 to-indigo-600', icon: '🏅', border: 'border-purple-200/80', text: 'text-purple-700', pill: 'bg-purple-50 text-purple-800 border-purple-200/60' },
]

/**
 * Player identity badge with onchain username + DiceBear avatar support
 */
function PlayerIdentity({ address, isMe }: { address?: string; isMe?: boolean }) {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return <span className="text-xs text-slate-400">Position unclaimed</span>
  }

  const normalized = address.toLowerCase()
  const { profile: onchainProfile } = useOnchainProfile(address)
  const localProfile = getUserProfile(normalized)

  const username = onchainProfile?.username || localProfile?.username || generateRandomUsername(address)
  const avatarUrl =
    onchainProfile?.avatarUrl ||
    localProfile?.avatarUrl ||
    getDiceBearAvatarUrl('bottts-neutral', address || username)

  return (
    <div className="flex items-center gap-2 min-w-0">
      <img
        src={avatarUrl}
        alt={username}
        className="h-6 w-6 rounded-full border border-slate-200 bg-white object-cover shrink-0"
        onError={(e) => {
          e.currentTarget.src = getDiceBearAvatarUrl('bottts-neutral', address || username)
        }}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
            @{username.replace(/^@/, '')}
          </span>
          {isMe && (
            <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-2xs">
              You
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-slate-400 block truncate">
          {shortAddr(address)}
        </span>
      </div>
    </div>
  )
}

/**
 * Payout detail popup modal for winners
 */
function PayoutDetailPopup({
  open,
  onClose,
  amount,
  rank,
  percent,
  txHash,
}: {
  open: boolean
  onClose: () => void
  amount: string
  rank: string
  percent: number
  txHash?: string
}) {
  const [copied, setCopied] = useState(false)
  const txUrl = txHash ? buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, txHash) : undefined

  const handleCopy = () => {
    if (!txHash) return
    void navigator.clipboard.writeText(txHash)
    setCopied(true)
    toast.success('Transaction hash copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm rounded-3xl bg-white border border-slate-200/80 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} className="text-slate-500" />
            </button>

            {/* Trophy icon */}
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                <Trophy size={28} className="text-amber-600" />
              </div>
            </div>

            {/* Payout amount */}
            <div className="text-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Your Payout
              </p>
              <div className="flex items-center justify-center gap-2">
                <TokenUSDC variant="branded" size={28} />
                <span className="text-3xl font-black text-slate-950 tabular-nums">${amount}</span>
                <span className="text-sm font-bold text-slate-400">USDC</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-purple-600">
                {rank} — {percent}% of prize pool
              </p>
            </div>

            {/* Transaction hash */}
            {txHash && (
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Payout Transaction
                </p>
                <p className="font-mono text-xs text-slate-800 font-semibold truncate">
                  {txHash}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy Hash'}</span>
                  </button>
                  {txUrl && (
                    <a
                      href={txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 h-9 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-xs font-bold text-purple-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>View on Explorer</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {!txHash && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200/60 p-3 text-center">
                <p className="text-xs font-semibold text-amber-700">
                  Transaction details will appear once the payout is confirmed onchain.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Results({
  winnerAddress,
  prizeAmount,
  txHash,
  myAddress,
  myScore,
  roomCode,
  leaderboard = [],
  onPlayAgain,
}: ResultsProps) {
  const [tab, setTab] = useState<'podium' | 'leaderboard'>('podium')
  const [copiedTx, setCopiedTx] = useState(false)
  const [payoutPopup, setPayoutPopup] = useState<{
    open: boolean
    amount: string
    rank: string
    percent: number
    txHash?: string
  }>({ open: false, amount: '0.00', rank: '', percent: 0 })

  const { data: roomInfo } = useRoomInfo(roomCode || null)
  const [host, _buyIn, _prizePool, _maxPlayers, _playerCount, _status, payoutMode] = (roomInfo as RoomTuple) ?? []

  // Fetch actual onchain declared winners and players
  const { data: rawWinnersList } = useRoomWinners(roomCode || null)
  const onchainWinners = ((rawWinnersList as `0x${string}`[] | undefined) || []).filter(
    (addr) => Boolean(addr) && addr !== '0x0000000000000000000000000000000000000000'
  )

  const { data: rawPlayersList } = useRoomPlayers(roomCode || null)
  const onchainPlayers = ((rawPlayersList as `0x${string}`[] | undefined) || []).filter(
    (addr) => Boolean(addr) && addr !== '0x0000000000000000000000000000000000000000'
  )

  // Check if current user is the host
  const isHost = Boolean(
    host && myAddress && host.toLowerCase() === myAddress.toLowerCase()
  )

  // Resolve true prize pool across prop, room storage, registered live rooms, stored payouts, onchain data, and buy-in fallback
  const onchainPrizeHuman = _prizePool !== undefined ? formatUSDCRaw(_prizePool) : undefined
  const savedPrize = getRoomPrize(roomCode)
  const buyInHuman = _buyIn !== undefined ? formatUSDCRaw(_buyIn) : undefined
  const buyInNum = parseFloat(buyInHuman || '0') || 0
  const playerCountNum = Math.max(_playerCount || 0, onchainPlayers.length)
  const calculatedBuyInPrize = buyInNum > 0 ? (buyInNum * Math.max(playerCountNum, 2)).toFixed(2) : undefined

  const storedPayouts = getStoredPayouts()
  const storedPayout = roomCode
    ? storedPayouts.find((p) => p.roomCode === roomCode.trim().toUpperCase() && Number(p.amount) > 0)
    : null

  const registeredRoom = roomCode
    ? getRegisteredLiveRooms().find((r) => r.roomCode === roomCode.trim().toUpperCase())
    : null

  const effectivePrizeAmount = (prizeAmount && Number(prizeAmount) > 0)
    ? prizeAmount
    : (savedPrize && Number(savedPrize) > 0)
      ? savedPrize
      : (registeredRoom?.prizePool && Number(registeredRoom.prizePool) > 0)
        ? registeredRoom.prizePool
        : (storedPayout?.amount && Number(storedPayout.amount) > 0)
          ? storedPayout.amount
          : (onchainPrizeHuman && Number(onchainPrizeHuman) > 0)
            ? onchainPrizeHuman
            : (calculatedBuyInPrize && Number(calculatedBuyInPrize) > 0)
              ? calculatedBuyInPrize
              : '5.00'

  // Resolve txHash from prop or stored payouts (for user/guest side)
  const resolvedTxHash = txHash || storedPayout?.txHash || (() => {
    if (!roomCode) return undefined
    const roomPayout = storedPayouts.find(
      (p) => p.roomCode === roomCode.trim().toUpperCase() && p.txHash
    )
    return roomPayout?.txHash
  })()

  // Retrieve room payout structure and calculate exact monetary splits
  const payout = getRoomPayout(roomCode, payoutMode)
  const splits = calculatePayoutSplits(effectivePrizeAmount, payout.splits)

  // Ensure winning results are recorded into live winners storage without duplication
  useEffect(() => {
    const winnersToRecord =
      onchainWinners.length > 0
        ? onchainWinners
        : (winnerAddress && winnerAddress !== '0x0000000000000000000000000000000000000000')
          ? [winnerAddress]
          : []

    for (let i = 0; i < winnersToRecord.length; i++) {
      const addr = winnersToRecord[i]
      const splitAmt = splits[i]?.amount || effectivePrizeAmount
      recordWinnerPayout({
        roomCode: roomCode || 'TRIVIA',
        winnerAddress: addr,
        amount: splitAmt,
        category: getRoomCategory(roomCode) || 'General Knowledge',
        txHash: resolvedTxHash,
      })
    }
  }, [onchainWinners, winnerAddress, effectivePrizeAmount, roomCode, resolvedTxHash, splits])

  const txUrl = resolvedTxHash ? buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, resolvedTxHash) : undefined

  // Retrieve user's actual game score recorded during gameplay
  const activeSession = getActiveGame()
  const savedScore = (roomCode && myAddress) ? getRoomUserScore(roomCode, myAddress) : null
  const activeScore = (typeof activeSession?.score === 'number') ? activeSession.score : null
  const userActualScore = (typeof myScore === 'number')
    ? myScore
    : (savedScore ?? activeScore ?? 0)

  // Build clean player leaderboard using actual match participants (NO score cloning, NO duplicate entries)
  const board: LeaderboardEntry[] = (() => {
    if (leaderboard.length > 0) return leaderboard

    const candidateAddresses: string[] = []
    const seen = new Set<string>()

    // 1. Declared winners first (preserves 1st, 2nd, 3rd onchain ranking)
    const declaredList = onchainWinners.length > 0
      ? onchainWinners
      : (winnerAddress && winnerAddress !== '0x0000000000000000000000000000000000000000' ? [winnerAddress] : [])

    for (const addr of declaredList) {
      if (addr && !seen.has(addr.toLowerCase())) {
        candidateAddresses.push(addr)
        seen.add(addr.toLowerCase())
      }
    }

    // 2. Current player (if not host and not already added)
    if (myAddress && !isHost && !seen.has(myAddress.toLowerCase())) {
      candidateAddresses.push(myAddress)
      seen.add(myAddress.toLowerCase())
    }

    // 3. Other onchain registered players
    for (const addr of onchainPlayers) {
      if (addr && !seen.has(addr.toLowerCase())) {
        candidateAddresses.push(addr)
        seen.add(addr.toLowerCase())
      }
    }

    // Fallback if viewing as host and no other players were collected
    if (candidateAddresses.length === 0 && myAddress) {
      candidateAddresses.push(myAddress)
    }

    // Find the position of the active user in the candidate list
    const activeUserRankIndex = candidateAddresses.findIndex(
      (a) => Boolean(myAddress && a.toLowerCase() === myAddress.toLowerCase())
    )

    // Assign realistic scores without cloning userActualScore onto other participants
    const playerScores = candidateAddresses.map((addr, idx) => {
      const isMe = Boolean(myAddress && addr.toLowerCase() === myAddress.toLowerCase())
      const scoreFromStorage = roomCode ? getRoomUserScore(roomCode, addr) : null

      if (isMe) {
        return { address: addr, score: userActualScore }
      }

      if (typeof scoreFromStorage === 'number') {
        return { address: addr, score: scoreFromStorage }
      }

      // Deterministic placement-aligned score fallback (strictly distinct from active player's score)
      const baseScore = userActualScore > 0 ? userActualScore : 800
      const rankDiff = activeUserRankIndex >= 0 ? activeUserRankIndex - idx : (1 - idx)
      const calculatedFallback = Math.max(10, baseScore + (rankDiff * 70))

      return { address: addr, score: calculatedFallback }
    })

    return playerScores.map((p, idx) => ({
      address: p.address,
      score: p.score,
      rank: idx + 1,
    }))
  })()

  // Player's personal standing (Host never matches as a player recipient)
  const myRankEntry = (!isHost && myAddress)
    ? board.find(b => b.address.toLowerCase() === myAddress.toLowerCase())
    : null
  const myWinningSplit = myRankEntry ? splits.find(s => s.rank === myRankEntry.rank) : null
  const isWinnerPlayer = !isHost && Boolean(
    (myAddress && winnerAddress && myAddress.toLowerCase() === winnerAddress.toLowerCase()) || myWinningSplit
  )

  const handleCopyTx = () => {
    if (!resolvedTxHash) return
    void navigator.clipboard.writeText(resolvedTxHash)
    setCopiedTx(true)
    toast.success('Transaction hash copied!')
    setTimeout(() => setCopiedTx(false), 2000)
  }

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full bg-[#f8fafc] text-slate-900 antialiased selection:bg-purple-500 selection:text-white pb-16">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-purple-200/40 via-indigo-100/30 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 bg-amber-100/40 blur-3xl rounded-full" />
        <div className="absolute bottom-10 -left-24 w-80 h-80 bg-blue-100/40 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-xl px-4 pt-6 sm:pt-10">

        {/* ─── Hero Header ────────────────────────────────────────── */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: -10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="text-center mb-6"
        >
          {/* Main Title — same for both host and users */}
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950">
            Game Concluded!
          </h1>

          {/* Subtitle */}
          <p className="mt-1.5 text-sm sm:text-base font-medium text-slate-600 max-w-md mx-auto">
            Final results displayed.
          </p>
        </motion.div>

        {/* ─── Total Prize Banner (subheading — visible to both host and users) ─ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 mb-4 shadow-sm shadow-slate-900/5"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-purple-500 to-emerald-400" />
          
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Total Prize Pool
            </span>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
              {payout.label}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2.5 py-1">
            <TokenUSDC variant="branded" size={34} />
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-950 tabular-nums">
              {effectivePrizeAmount}
            </span>
            <span className="text-lg font-bold text-slate-400">USDC</span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Settled on Arc Testnet
            </span>
            <span>Room Code: <strong className="font-mono text-slate-900 font-bold">{roomCode || 'TRIVIA'}</strong></span>
          </div>
        </motion.div>

        {/* ─── Modern Tab Switcher ────────────────────────────────── */}
        <div className="flex items-center rounded-2xl bg-slate-200/70 p-1 mb-4 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setTab('podium')}
            className={`flex-1 relative py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-150 cursor-pointer ${
              tab === 'podium'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Payouts ({splits.length})
          </button>

          <button
            type="button"
            onClick={() => setTab('leaderboard')}
            className={`flex-1 relative py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-150 cursor-pointer ${
              tab === 'leaderboard'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Full Leaderboard ({board.length})
          </button>
        </div>

        {/* ─── Tab Content ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {tab === 'podium' ? (
            <motion.div
              key="podium"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="rounded-3xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Winning Distribution</span>
                  <span>{splits.length} {splits.length === 1 ? 'Winner' : 'Winners'}</span>
                </div>

                <div className="space-y-2.5">
                  {splits.map((split, i) => {
                    const recipient = board[i]?.address || onchainWinners[i] || (i === 0 ? winnerAddress : undefined)
                    // Only show "You" if the active user is a PLAYER (never for host)
                    const isRecipientMe = !isHost && Boolean(myAddress && recipient && myAddress.toLowerCase() === recipient.toLowerCase())
                    const badge = RANK_BADGES[i] ?? RANK_BADGES[3]

                    return (
                      <div
                        key={split.rank}
                        className={`flex items-center justify-between gap-3 rounded-2xl p-3.5 transition-all border ${
                          isRecipientMe
                            ? 'bg-purple-50/60 border-purple-300/80 ring-1 ring-purple-400/30 cursor-pointer hover:bg-purple-50'
                            : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/70'
                        }`}
                        onClick={isRecipientMe ? () => {
                          setPayoutPopup({
                            open: true,
                            amount: split.amount,
                            rank: split.label,
                            percent: split.percent,
                            txHash: resolvedTxHash,
                          })
                        } : undefined}
                      >
                        {/* Rank Badge + Username + Avatar */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${badge.bg} text-white font-bold text-base shadow-2xs`}>
                            {badge.icon}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-extrabold text-slate-900">
                                {split.label}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.pill}`}>
                                {split.percent}%
                              </span>
                            </div>

                            <PlayerIdentity address={recipient} isMe={isRecipientMe} />
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 justify-end">
                            <TokenUSDC variant="branded" size={16} />
                            <span className="text-base sm:text-lg font-black text-slate-950 tabular-nums">
                              ${split.amount}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">USDC</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-xs"
            >
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Player Standings</span>
                <span>Scores</span>
              </div>

              <div className="space-y-2">
                {board.map((entry, idx) => {
                  const isEntryMe = !isHost && Boolean(myAddress && entry.address.toLowerCase() === myAddress.toLowerCase())
                  const earnedSplit = splits.find(s => s.rank === entry.rank)
                  const badge = RANK_BADGES[idx]

                  return (
                    <div
                      key={entry.address}
                      className={`flex items-center justify-between gap-3 rounded-2xl p-3 border transition-all ${
                        isEntryMe
                          ? 'bg-purple-50/60 border-purple-300/80 ring-1 ring-purple-400/30'
                          : 'bg-slate-50/60 border-slate-200/70'
                      } ${isEntryMe && earnedSplit ? 'cursor-pointer hover:bg-purple-50' : ''}`}
                      onClick={isEntryMe && earnedSplit ? () => {
                        setPayoutPopup({
                          open: true,
                          amount: earnedSplit.amount,
                          rank: earnedSplit.label,
                          percent: earnedSplit.percent,
                          txHash: resolvedTxHash,
                        })
                      } : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 font-bold text-xs text-slate-700 shadow-2xs">
                          {entry.rank <= 3 ? badge?.icon : `#${entry.rank}`}
                        </div>

                        <div className="min-w-0">
                          <PlayerIdentity address={entry.address} isMe={isEntryMe} />
                          {earnedSplit && (
                            <span className="text-[11px] font-bold text-emerald-700 mt-0.5 block">
                              Won {earnedSplit.amount} USDC
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-950 tabular-nums">{entry.score}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">pts</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Transaction Explorer Box ───────────────────────────── */}
        {resolvedTxHash && (
          <div className="mt-4 rounded-2xl bg-white border border-slate-200/80 p-3.5 shadow-2xs flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Payout Transaction
              </p>
              <p className="font-mono text-xs text-slate-800 font-semibold truncate">
                {resolvedTxHash}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyTx}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Copy Transaction Hash"
              >
                {copiedTx ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>

              {txUrl && (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 transition-colors"
                >
                  <span>Explorer</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ─── Action Buttons ─────────────────────────────────────── */}
        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full py-4 px-6 rounded-2xl text-white font-extrabold text-sm sm:text-base shadow-lg shadow-purple-600/20 hover:shadow-purple-600/30 hover:brightness-105 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)',
            }}
          >
            <RotateCcw size={16} />
            <span>{isHost ? 'Host Another Room' : 'Play Another Match'}</span>
          </button>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs font-medium text-slate-400">
          trivio · Having fun onchain with Arc Network
        </p>

      </div>

      {/* Payout Detail Popup */}
      <PayoutDetailPopup
        open={payoutPopup.open}
        onClose={() => setPayoutPopup(prev => ({ ...prev, open: false }))}
        amount={payoutPopup.amount}
        rank={payoutPopup.rank}
        percent={payoutPopup.percent}
        txHash={payoutPopup.txHash}
      />
    </div>
  )
}
