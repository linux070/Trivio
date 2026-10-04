import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Check, Copy, ArrowUpRight } from 'lucide-react'
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
  getRoomAllScores,
  getPendingPayoutRooms,
  getActiveGame,
  getRegisteredLiveRooms,
  getRoomTxHash,
} from '@/lib/roomStorage'
import { useRoomScores } from '@/lib/roomSync'
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
  {
    label: '1st Place',
    badgeText: '1st',
    icon: '🥇',
    pill: 'bg-amber-400/15 text-amber-800 border-amber-300/80',
    dot: 'bg-amber-500',
    rankBg: 'bg-amber-400 text-white',
  },
  {
    label: '2nd Place',
    badgeText: '2nd',
    icon: '🥈',
    pill: 'bg-slate-200/60 text-slate-800 border-slate-300/80',
    dot: 'bg-slate-400',
    rankBg: 'bg-slate-400 text-white',
  },
  {
    label: '3rd Place',
    badgeText: '3rd',
    icon: '🥉',
    pill: 'bg-amber-600/15 text-amber-900 border-amber-400/80',
    dot: 'bg-amber-600',
    rankBg: 'bg-amber-600 text-white',
  },
  {
    label: '4th Place',
    badgeText: '4th',
    icon: '#4',
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    rankBg: 'bg-slate-200 text-slate-600',
  },
  {
    label: '5th Place',
    badgeText: '5th',
    icon: '#5',
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    rankBg: 'bg-slate-200 text-slate-600',
  },
]

/**
 * Modern Web3 trading-dashboard style player identity badge
 * Harmoniously balances avatar, scaled username, and wallet address
 */
function PlayerIdentity({
  address,
  isMe,
  subtext,
}: {
  address?: string
  isMe?: boolean
  subtext?: string
}) {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return <span className="text-xs text-slate-400">Position unclaimed</span>
  }

  const normalized = address.toLowerCase()
  const { profile: onchainProfile } = useOnchainProfile(address)
  const localProfile = getUserProfile(normalized)

  const username = localProfile?.username || onchainProfile?.username || generateRandomUsername(address)
  const avatarUrl =
    localProfile?.avatarUrl ||
    onchainProfile?.avatarUrl ||
    getDiceBearAvatarUrl('bottts-neutral', address || username)

  return (
    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 text-left">
      <img
        src={avatarUrl}
        alt={username}
        className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border border-slate-200/90 bg-white object-cover shrink-0 ring-1 ring-slate-100 shadow-2xs"
        onError={(e) => {
          e.currentTarget.src = getDiceBearAvatarUrl('bottts-neutral', address || username)
        }}
      />
      <div className="min-w-0 flex flex-col justify-center items-start text-left">
        <div className="flex items-center gap-1.5 leading-tight max-w-full">
          <span className="font-medium text-xs sm:text-[13px] text-slate-800 truncate tracking-tight text-left">
            @{username.replace(/^@/, '')}
          </span>
          {isMe && (
            <span className="text-[9px] font-semibold text-purple-700 bg-purple-100/70 border border-purple-200/80 px-1.5 py-0.5 rounded-full shrink-0 tracking-tight leading-none">
              you
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5 text-left">
          <span className="font-mono text-slate-400">
            {shortAddr(address)}
          </span>
          {subtext && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-600 font-semibold">{subtext}</span>
            </>
          )}
        </div>
      </div>
    </div>
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

  // Resolve txHash from prop, live sync, or stored payouts (for user/guest side)
  const resolvedTxHash = txHash || (roomCode ? getRoomTxHash(roomCode) : undefined) || storedPayout?.txHash || (() => {
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

  const txUrl = resolvedTxHash
    ? buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, resolvedTxHash)
    : 'https://explorer.testnet.arc.io/address/0x1b785e38e8ebb334b52a305a10e92b5ef9564624'

  // Retrieve user's actual game score recorded during gameplay
  const activeSession = getActiveGame()
  const savedScore = (roomCode && myAddress) ? getRoomUserScore(roomCode, myAddress) : null
  const activeScore = (typeof activeSession?.score === 'number') ? activeSession.score : null
  const userActualScore = (typeof myScore === 'number')
    ? myScore
    : (savedScore ?? activeScore ?? 0)

  const { scores: liveRoomScores } = useRoomScores(roomCode, myAddress)
  const roomScoresMap = roomCode ? getRoomAllScores(roomCode) : {}

  // Build clean player leaderboard using actual match participants (NO score cloning, NO duplicate entries)
  const board: LeaderboardEntry[] = (() => {
    if (leaderboard.length > 0) return leaderboard

    const candidateAddresses: string[] = []
    const seen = new Set<string>()

    // 1. Declared winners first
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

    // 4. Any players with recorded scores in cloud / room storage
    for (const addr of [...Object.keys(liveRoomScores), ...Object.keys(roomScoresMap)]) {
      if (addr && !seen.has(addr.toLowerCase()) && addr.startsWith('0x')) {
        candidateAddresses.push(addr)
        seen.add(addr.toLowerCase())
      }
    }

    // Fallback if viewing as host and no other players were collected
    if (candidateAddresses.length === 0 && myAddress) {
      candidateAddresses.push(myAddress)
    }

    // Assign true recorded gameplay scores
    const playerScores = candidateAddresses.map((addr) => {
      const lowerAddr = addr.toLowerCase()
      const isMe = Boolean(myAddress && lowerAddr === myAddress.toLowerCase())

      // 1. If viewing player is themselves, use their verified gameplay score
      if (isMe && userActualScore > 0) {
        return { address: addr, score: userActualScore }
      }

      // 2. Live synchronized score from cloud room database
      const liveScore = liveRoomScores[lowerAddr]
      if (typeof liveScore === 'number' && liveScore > 0) {
        return { address: addr, score: liveScore }
      }

      // 3. Score directly stored for this participant address in room storage
      const scoreFromStorage = roomCode ? getRoomUserScore(roomCode, addr) : null
      if (typeof scoreFromStorage === 'number' && scoreFromStorage > 0) {
        return { address: addr, score: scoreFromStorage }
      }

      // 4. Score stored in room-wide scores map
      const mapScore = roomScoresMap[lowerAddr]
      if (typeof mapScore === 'number' && mapScore > 0) {
        return { address: addr, score: mapScore }
      }

      // 5. Host payout record lookup
      const pendingPayout = roomCode ? getPendingPayoutRooms().find(p => p.roomCode === roomCode.trim().toUpperCase()) : null
      if (pendingPayout?.scores && typeof pendingPayout.scores[lowerAddr] === 'number') {
        return { address: addr, score: pendingPayout.scores[lowerAddr] }
      }

      if (isMe) {
        return { address: addr, score: userActualScore }
      }

      return { address: addr, score: 0 }
    })

    // Strict descending sort by real score
    playerScores.sort((a, b) => b.score - a.score)

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

        {/* ─── Prize Pool Card ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-2xl bg-white border border-slate-200/80 mb-4 overflow-hidden shadow-2xs"
        >
          {/* Top metadata row */}
          <div className="relative flex items-center justify-center px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
            <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 text-center">
              Total Prize Pool
            </span>
            <span className="absolute right-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {payout.label}
            </span>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-center gap-2.5 px-4 py-5">
            <TokenUSDC variant="branded" size={28} />
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 tabular-nums">
              {effectivePrizeAmount}
            </span>
            <span className="text-sm font-semibold text-slate-500 self-end mb-0.5">USDC</span>
          </div>

          {/* Bottom status row */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/60 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-600">
              Settled on Arc Testnet
            </span>
            <span className="text-xs font-medium text-slate-600">
              Room Code:{' '}
              <span className="font-mono font-bold text-slate-800 uppercase">
                {roomCode || 'TRIVIA'}
              </span>
            </span>
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
              {/* ── Winning Distribution — clean leaderboard ── */}
              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">

                {/* Column headers */}
                <div className="grid items-center px-3.5 sm:px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 gap-2 sm:gap-3" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 w-8 sm:w-9 text-left">#</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Player</span>
                  <div className="flex items-center gap-2.5 sm:gap-5 md:gap-7">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 w-8 sm:w-10 text-right">Score</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 w-14 sm:w-20 text-right">Payout</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 w-6 sm:w-7 text-center">Tx</span>
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-100">
                  {splits.map((split, i) => {
                    const recipient = board[i]?.address || onchainWinners[i] || (i === 0 ? winnerAddress : undefined)
                    // Only show "You" if the active user is a PLAYER (never for host)
                    const isRecipientMe = !isHost && Boolean(myAddress && recipient && myAddress.toLowerCase() === recipient.toLowerCase())
                    const badge = RANK_BADGES[i] ?? RANK_BADGES[3]
                    const recipientScore = board[i]?.score ?? (roomCode && recipient ? getRoomUserScore(roomCode, recipient) : null) ?? (isRecipientMe ? userActualScore : null) ?? (i === 0 ? (board[0]?.score ?? userActualScore) : 0)

                    return (
                      <div
                        key={split.rank}
                        className="grid items-center px-3.5 sm:px-4 py-2.5 sm:py-3 transition-colors duration-100 gap-2 sm:gap-3 hover:bg-slate-50/70"
                        style={{ gridTemplateColumns: 'auto 1fr auto' }}
                      >
                        {/* Rank number */}
                        <div className="w-8 sm:w-9 flex items-center justify-start">
                          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-extrabold ${badge.rankBg}`}>
                            {split.rank}
                          </span>
                        </div>

                        {/* Player identity */}
                        <div className="min-w-0 pr-1">
                          <PlayerIdentity
                            address={recipient}
                            isMe={isRecipientMe}
                          />
                        </div>

                        {/* Score + Payout + Tx */}
                        <div className="flex items-center gap-2.5 sm:gap-5 md:gap-7">
                          <span className="text-xs sm:text-[13px] font-bold text-slate-700 tabular-nums w-8 sm:w-10 text-right">
                            {recipientScore}
                          </span>

                          <div className="flex items-center gap-1 w-14 sm:w-20 justify-end">
                            <TokenUSDC variant="branded" size={13} className="shrink-0" />
                            <span className="text-xs sm:text-[13px] font-bold text-slate-900 tabular-nums">
                              {split.amount}
                            </span>
                          </div>

                          <a
                            href={txUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                            title={resolvedTxHash ? `View on Arc Explorer` : 'View Trivia Escrow on Arc Explorer'}
                          >
                            <ArrowUpRight size={14} className="stroke-[2]" />
                          </a>
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
            >
              {/* ── Full Leaderboard — matching table style ── */}
              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">

                {/* Column headers */}
                <div className="grid items-center px-3.5 sm:px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 gap-2 sm:gap-3" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 w-8 sm:w-9 text-left">#</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Player</span>
                  <div className="flex items-center gap-2.5 sm:gap-5 md:gap-7">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 w-8 sm:w-10 text-right">Score</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 w-14 sm:w-20 text-right">Payout</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 w-6 sm:w-7 text-center">Tx</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {board.map((entry, idx) => {
                    const isEntryMe = !isHost && Boolean(myAddress && entry.address.toLowerCase() === myAddress.toLowerCase())
                    const earnedSplit = splits.find(s => s.rank === entry.rank)
                    const badge = RANK_BADGES[idx] ?? RANK_BADGES[3]

                    return (
                      <div
                        key={entry.address}
                        className="grid items-center px-3.5 sm:px-4 py-2.5 sm:py-3 transition-colors duration-100 gap-2 sm:gap-3 hover:bg-slate-50/70"
                        style={{ gridTemplateColumns: 'auto 1fr auto' }}
                      >
                        {/* Rank number */}
                        <div className="w-8 sm:w-9 flex items-center justify-start">
                          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-extrabold ${badge.rankBg}`}>
                            {entry.rank}
                          </span>
                        </div>

                        {/* Player identity */}
                        <div className="min-w-0 pr-1">
                          <PlayerIdentity
                            address={entry.address}
                            isMe={isEntryMe}
                          />
                        </div>

                        {/* Score + Payout + Explorer */}
                        <div className="flex items-center gap-2.5 sm:gap-5 md:gap-7">
                          <span className="text-xs sm:text-[13px] font-bold text-slate-700 tabular-nums text-right w-8 sm:w-10">
                            {entry.score}
                          </span>

                          <div className="flex items-center gap-1 w-14 sm:w-20 justify-end">
                            {earnedSplit ? (
                              <>
                                <TokenUSDC variant="branded" size={13} className="shrink-0" />
                                <span className="text-xs sm:text-[13px] font-bold text-slate-900 tabular-nums">
                                  {earnedSplit.amount}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs font-semibold text-slate-300 tabular-nums pr-2">—</span>
                            )}
                          </div>

                          {earnedSplit ? (
                            <a
                              href={txUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                              title={resolvedTxHash ? `View Payout on Arc Explorer` : 'View Trivia Escrow on Arc Explorer'}
                            >
                              <ArrowUpRight size={14} className="stroke-[2]" />
                            </a>
                          ) : (
                            <span className="w-6 sm:w-7" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Transaction Explorer Box ─ redesigned ───────────────── */}
        {resolvedTxHash && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            {/* Top label row */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border-b border-slate-100">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600">
                Payout Transaction
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Arc Testnet
              </span>
            </div>

            {/* Hash row */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5">
              <p className="flex-1 min-w-0 font-mono text-xs text-slate-700 truncate select-all">
                {resolvedTxHash}
              </p>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyTx}
                  className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                  title="Copy transaction hash"
                >
                  {copiedTx ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>

                {txUrl && (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white transition-all shadow-xs cursor-pointer"
                  >
                    <span>Explorer</span>
                    <ExternalLink size={12} className="stroke-[2.5]" />
                  </a>
                )}
              </div>
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
            <span>{isHost ? 'Host Another Room' : 'Play Another Match'}</span>
          </button>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs font-medium text-slate-500">
          trivio — having fun onchain with Arc Network
        </p>

      </div>
    </div>
  )
}
