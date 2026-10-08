import { useState, useEffect, useRef, startTransition, useMemo } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Trophy, Copy, Check, Link2, Users, Loader2, Share2 } from 'lucide-react'
import { buildJoinUrl } from '@/App'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import {
  useStartGame,
  useDeclareWinners,
  useCancelRoom,
  useRoomInfo,
  useRoomPlayers,
  useRoomWinners,
  formatUSDCRaw,
  type RoomTuple,
} from '@/hooks/useTriviaContract'
import { getQuestions, type Category, type TriviaQuestion, CATEGORY_GROUPS } from '@/lib/questions'
import {
  getRoomCategory,
  inferCategoryFromCode,
  saveRoomCategory,
  getRoomDuration,
  getRoomPayout,
  calculatePayoutSplits,
  saveActiveGame,
  clearActiveGame,
  getActiveGame,
  saveRoomPrize,
  getRoomPrize,
  saveRoomUserScore,
  getRoomUserScore,
  getRoomAllScores,
  savePendingPayoutRoom,
  removePendingPayoutRoom,
  getPendingPayoutRooms,
  saveRoomTxHash,
  getRoomTxHash,
} from '@/lib/roomStorage'
import { useRoomScores, broadcastRoomTxHash, broadcastGameStart } from '@/lib/roomSync'
import { fetchAuthoritativeScores, fetchRoomMetadata, submitFinalLeaderboard } from '@/lib/roomDb'
import { getUserProfile } from '@/lib/userProfile'
import { recordWinnerPayout } from '@/lib/winnersStorage'
import { ARC_TESTNET_CHAIN_ID, TRIVIA_GAME_ADDRESS } from '@/config'
import { QuestionCard } from '@/components/QuestionCard'
import { PlayerTag } from '@/components/PlayerTag'

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

interface GameRoomProps {
  roomCode: string
  category: Category
  onBack: () => void
  onGameEnd: (winnerAddress: string, prizeAmount: string, txHash?: string, myScore?: number) => void
}

type GamePhase = 'lobby' | 'playing' | 'finished'

export default function GameRoom({ roomCode, category, onBack, onGameEnd }: GameRoomProps) {
  const { address: wagmiAddress, chainId } = useAccount()
  const { user } = usePrivy()
  const { switchChain } = useSwitchChain()

  const privyWalletAddress = user?.wallet?.address as `0x${string}` | undefined
  const activeAddress = wagmiAddress || privyWalletAddress || ''

  const [cloudCategory, setCloudCategory] = useState<Category | null>(() => {
    return getRoomCategory(roomCode) || (roomCode ? inferCategoryFromCode(roomCode) : null)
  })

  // Fetch authoritative cloud metadata & category for the room
  useEffect(() => {
    if (!roomCode) return
    const cleanCode = roomCode.trim().toUpperCase()
    const localCat = getRoomCategory(cleanCode) || inferCategoryFromCode(cleanCode)
    if (localCat) {
      setCloudCategory(localCat)
    }

    let isCancelled = false
    void fetchRoomMetadata(cleanCode).then((meta) => {
      if (!isCancelled && meta?.category) {
        setCloudCategory(meta.category)
        saveRoomCategory(cleanCode, meta.category)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [roomCode])

  const { scores: liveRoomScores, playerDetails: livePlayerDetails, isGameStarted, gameMeta, syncMyScore } = useRoomScores(roomCode, activeAddress)

  const hostRoomCategory = getRoomCategory(roomCode)
  const resolvedCategory = cloudCategory || (gameMeta?.category as Category) || hostRoomCategory || (roomCode ? inferCategoryFromCode(roomCode) : null) || category || 'General Knowledge'
  const roomDuration = getRoomDuration(roomCode, 15)

  // Ensure persistent storage of the host-assigned category
  useEffect(() => {
    if (roomCode && resolvedCategory && resolvedCategory !== 'General Knowledge') {
      saveRoomCategory(roomCode, resolvedCategory)
    }
  }, [roomCode, resolvedCategory])

  const savedSession = getActiveGame()
  const isMatchRoom = savedSession?.roomCode === roomCode.trim().toUpperCase()
  const pendingPayoutMatch = getPendingPayoutRooms().find(r => r.roomCode === roomCode.trim().toUpperCase())
  const initialPhase: GamePhase = (isMatchRoom && savedSession?.phase) ? savedSession.phase : (pendingPayoutMatch ? 'finished' : 'lobby')
  const initialScore: number = (isMatchRoom && typeof savedSession?.score === 'number') ? savedSession.score : (pendingPayoutMatch?.score ?? 0)
  const initialQIndex: number = (isMatchRoom && typeof savedSession?.qIndex === 'number' && savedSession.qIndex >= 0) ? savedSession.qIndex : 0

  const [phase, setPhase] = useState<GamePhase>(initialPhase)
  const [questions, setQuestions] = useState<TriviaQuestion[]>(() => {
    if (initialPhase === 'finished' || initialPhase === 'playing') {
      return getQuestions(resolvedCategory, 10, roomCode)
    }
    return []
  })
  const [qIndex, setQIndex] = useState<number>(() => {
    if (initialPhase === 'playing' && initialQIndex >= 10) {
      return 9
    }
    return initialQIndex
  })
  const [timeLeft, setTimeLeft] = useState(roomDuration)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState<number>(initialScore)
  const [lastPts, setLastPts] = useState<number | null>(null)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const answerStartRef = useRef(Date.now())

  const handleCopyLink = () => {
    const joinUrl = buildJoinUrl(roomCode, resolvedCategory)
    void navigator.clipboard.writeText(joinUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
    toast.success('Invite link copied!')
  }

  const handleNativeShare = async () => {
    const joinUrl = buildJoinUrl(roomCode, resolvedCategory)
    const shareData = {
      title: `Trivio Room #${roomCode}`,
      text: `Join my ${resolvedCategory} trivia room #${roomCode} on Trivio and win USDC!`,
      url: joinUrl,
    }
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        toast.success('Invite shared!')
        return
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          handleCopyLink()
        }
        return
      }
    }
    handleCopyLink()
  }

  // Ensure questions are populated if resuming into playing phase
  useEffect(() => {
    if (phase === 'playing' && questions.length === 0) {
      const qs = getQuestions(resolvedCategory, 10, roomCode)
      setQuestions(qs)
    }
  }, [phase, questions.length, resolvedCategory, roomCode])

  // Auto-polls onchain every 1.5s
  const { data: roomInfo } = useRoomInfo(roomCode, 1500)
  const { data: winnersList } = useRoomWinners(roomCode)
  const { data: rawPlayersList } = useRoomPlayers(roomCode, 1500)

  const [
    host,
    _buyIn,
    prizePool,
    maxP,
    playerCount,
    status,
    payoutMode,
  ] = (roomInfo as RoomTuple) ?? []
  const prizeHuman = prizePool !== undefined ? formatUSDCRaw(prizePool) : '0'
  const buyInHuman = _buyIn !== undefined ? formatUSDCRaw(_buyIn) : '0'
  const buyInNum = parseFloat(buyInHuman) || 0
  const maxPlayersNum = maxP || 4
  const currentPrizeNum = parseFloat(prizeHuman) || 0
  const effectivePlayerCount = Math.max(playerCount ?? 0, (rawPlayersList as `0x${string}`[] | undefined)?.length ?? 0)
  const estimatedTotalPrize = buyInNum > 0 ? (buyInNum * Math.max(effectivePlayerCount, maxPlayersNum)).toFixed(2) : prizeHuman
  const savedPrize = getRoomPrize(roomCode)
  const prizeForPayouts = currentPrizeNum > 0
    ? prizeHuman
    : (savedPrize && parseFloat(savedPrize) > 0)
      ? savedPrize
      : buyInNum > 0
        ? (buyInNum * Math.max(effectivePlayerCount, 2)).toFixed(2)
        : (parseFloat(estimatedTotalPrize) > 0 ? estimatedTotalPrize : '5.00')

  const isHost = Boolean(
    activeAddress && host && host.toLowerCase() === activeAddress.toLowerCase()
  )

  const [hostGraceSeconds, setHostGraceSeconds] = useState(30)
  useEffect(() => {
    if (phase !== 'finished' || !isHost) return
    if (hostGraceSeconds <= 0) return
    const timer = setTimeout(() => setHostGraceSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, isHost, hostGraceSeconds])

  const localProfile = activeAddress ? (getUserProfile(activeAddress) || getUserProfile()) : getUserProfile()

  // Keep active game persisted with current phase, score, and question index for smooth resume/rejoin on refresh
  useEffect(() => {
    saveActiveGame(roomCode, resolvedCategory, isHost, phase, score, qIndex)
    if (activeAddress && typeof score === 'number') {
      saveRoomUserScore(roomCode, activeAddress, score, {
        username: localProfile?.username,
        avatarSeed: localProfile?.avatarSeed,
        avatarUrl: localProfile?.avatarUrl,
        qIndex,
        isFinished: phase === 'finished',
      })
    }
    if (prizeForPayouts && Number(prizeForPayouts) > 0) {
      saveRoomPrize(roomCode, prizeForPayouts)
    }
  }, [roomCode, resolvedCategory, isHost, phase, score, qIndex, activeAddress, prizeForPayouts, localProfile])

  const { startGame, isPending: startPending, isConfirming: startConfirming, isSuccess: gameStarted } = useStartGame()
  const { declareWinners, isPending: declarePending, isConfirming: declareConfirming, isSuccess: declared, hash: declareHash } = useDeclareWinners()
  const { cancelRoom, isPending: cancelPending, isConfirming: cancelConfirming, isSuccess: cancelSuccess } = useCancelRoom()

  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID

  useEffect(() => {
    if (cancelSuccess) {
      toast.success('Room cancelled and funds refunded!')
      clearActiveGame()
      onBack()
    }
  }, [cancelSuccess, onBack])

  const handleCancelRoom = () => {
    if (!confirm('Are you sure you want to cancel this room? All joined players and sponsored prize funds will be refunded 100% onchain.')) {
      return
    }
    if (isWrongChain) {
      switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
      return
    }
    cancelRoom(roomCode)
  }

  // When game starts onchain or via cloud broadcast, immediately move all players to playing phase without page refresh
  useEffect(() => {
    const isGameActive = gameStarted || status === 1 || isGameStarted
    if (isGameActive && phase === 'lobby') {
      toast.success('Game started!')
      const activeCategory = (gameMeta?.category as Category) || cloudCategory || resolvedCategory
      const qs = getQuestions(activeCategory, 10, roomCode)
      startTransition(() => {
        setQuestions(qs)
        setQIndex(0)
        setTimeLeft(roomDuration)
        setAnswered(false)
        setSelectedIndex(null)
        setScore(0)
        setPhase('playing')
      })
      answerStartRef.current = Date.now()
      saveActiveGame(roomCode, activeCategory, isHost, 'playing', 0, 0)
    }
  }, [gameStarted, status, isGameStarted, phase, resolvedCategory, cloudCategory, gameMeta?.category, roomCode, roomDuration, isHost])

  // Timer for questions
  useEffect(() => {
    if (phase !== 'playing' || answered) return
    if (timeLeft <= 0) {
      startTransition(() => {
        setAnswered(true)
        setLastCorrect(false)
        setLastPts(null)
      })
      const t = setTimeout(() => advanceQuestion(qIndex, questions), 2500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, phase, answered, qIndex, questions])

  // Winner payout synchronization (for host who triggered payout or guest receiving finished status)
  useEffect(() => {
    const winningAddress = (winnersList && winnersList.length > 0) ? winnersList[0] : null
    const splits = calculatePayoutSplits(prizeForPayouts, getRoomPayout(roomCode, payoutMode).splits)

    if (declared && activeAddress) {
      clearActiveGame()
      const primaryWinner = (winnersList && winnersList.length > 0)
        ? (winnersList[0] as string)
        : (rawPlayersList && rawPlayersList.length > 0)
          ? (rawPlayersList[0] as string)
          : activeAddress

      const allWinners: string[] = (winnersList && winnersList.length > 0)
        ? (winnersList as string[])
        : [primaryWinner]

      for (let i = 0; i < allWinners.length; i++) {
        const wAddr = allWinners[i]
        const splitAmt = splits[i]?.amount || prizeForPayouts
        recordWinnerPayout({
          roomCode,
          winnerAddress: wAddr,
          amount: splitAmt,
          category: resolvedCategory,
          txHash: declareHash,
        })
      }

      if (declareHash) {
        saveRoomTxHash(roomCode, declareHash)
        broadcastRoomTxHash(roomCode, declareHash)
      }

      removePendingPayoutRoom(roomCode)
      clearActiveGame()
      onGameEnd(primaryWinner, prizeForPayouts, declareHash, score)
    } else if (status === 2 && winningAddress && winningAddress !== '0x0000000000000000000000000000000000000000' && phase === 'finished') {
      const syncedTx = getRoomTxHash(roomCode) || declareHash
      removePendingPayoutRoom(roomCode)
      clearActiveGame()
      const allWinners: string[] = (winnersList && winnersList.length > 0)
        ? (winnersList as string[])
        : [winningAddress]

      for (let i = 0; i < allWinners.length; i++) {
        const wAddr = allWinners[i]
        const splitAmt = splits[i]?.amount || prizeForPayouts
        recordWinnerPayout({
          roomCode,
          winnerAddress: wAddr,
          amount: splitAmt,
          category: resolvedCategory,
          txHash: syncedTx,
        })
      }

      onGameEnd(winningAddress, prizeForPayouts, syncedTx, score)
    }
  }, [declared, activeAddress, prizeForPayouts, declareHash, status, winnersList, phase, onGameEnd, rawPlayersList, roomCode, resolvedCategory, score, payoutMode])

  useEffect(() => {
    if (phase === 'finished' && isHost) {
      const allCurrentScores: Record<string, number> = { ...liveRoomScores, ...getRoomAllScores(roomCode) }
      if (activeAddress) allCurrentScores[activeAddress.toLowerCase()] = score
      savePendingPayoutRoom({
        roomCode,
        category: resolvedCategory,
        prize: prizeForPayouts,
        payoutMode,
        finishedAt: Date.now(),
        hostAddress: activeAddress,
        score,
        scores: allCurrentScores,
        playersCount: (rawPlayersList as `0x${string}`[] | undefined)?.length || 1,
      })
    }
  }, [phase, isHost, roomCode, resolvedCategory, prizeForPayouts, payoutMode, activeAddress, score, rawPlayersList, liveRoomScores])

  function advanceQuestion(currentIndex: number, qs: TriviaQuestion[]) {
    const next = currentIndex + 1
    if (next >= qs.length) {
      setPhase('finished')
      saveActiveGame(roomCode, resolvedCategory, isHost, 'finished', score, next)
      if (activeAddress) {
        syncMyScore(score, {
          username: localProfile?.username,
          avatarSeed: localProfile?.avatarSeed,
          avatarUrl: localProfile?.avatarUrl,
          qIndex: next,
          isFinished: true,
        })
      }
      if (isHost) {
        const allCurrentScores: Record<string, number> = { ...liveRoomScores, ...getRoomAllScores(roomCode) }
        if (activeAddress) allCurrentScores[activeAddress.toLowerCase()] = score
        savePendingPayoutRoom({
          roomCode,
          category: resolvedCategory,
          prize: prizeForPayouts,
          payoutMode,
          finishedAt: Date.now(),
          hostAddress: activeAddress,
          score,
          scores: allCurrentScores,
          playersCount: (rawPlayersList as `0x${string}`[] | undefined)?.length || 1,
        })
      }
    } else {
      setQIndex(next)
      setTimeLeft(roomDuration)
      setAnswered(false)
      setSelectedIndex(null)
      setLastCorrect(null)
      setLastPts(null)
      answerStartRef.current = Date.now()
      saveActiveGame(roomCode, resolvedCategory, isHost, 'playing', score, next)
    }
  }

  const handleAnswer = (idx: number) => {
    if (answered) return
    const q = questions[qIndex]
    if (!q) return
    const elapsed = Date.now() - answerStartRef.current
    setSelectedIndex(idx)
    setAnswered(true)

    let newScore = score
    if (idx === q.correctIndex) {
      const pts = Math.max(10, 100 - Math.floor((elapsed / 1000) * 5))
      newScore = score + pts
      setScore(newScore)
      setLastPts(pts)
      setLastCorrect(true)
    } else {
      setLastPts(null)
      setLastCorrect(false)
    }

    saveActiveGame(roomCode, resolvedCategory, isHost, 'playing', newScore, qIndex)
    if (activeAddress) {
      syncMyScore(newScore, {
        username: localProfile?.username,
        avatarSeed: localProfile?.avatarSeed,
        avatarUrl: localProfile?.avatarUrl,
        qIndex,
        isFinished: false,
      })
    }
    setTimeout(() => advanceQuestion(qIndex, questions), 2500)
  }

  const handleStartGame = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    broadcastGameStart(roomCode, resolvedCategory, roomDuration)
    startGame(roomCode)
  }

  const handleDeclareWinner = async () => {
    if (!activeAddress || isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }

    const players = ((rawPlayersList as `0x${string}`[] | undefined) || []).filter(
      (addr) => Boolean(addr) && addr !== '0x0000000000000000000000000000000000000000'
    )

    if (players.length === 0 && !activeAddress) {
      toast.error('No registered onchain players found in this room.')
      return
    }

    const maxSplits = payoutMode === 1 ? 2 : payoutMode === 2 ? 3 : payoutMode === 3 ? 5 : 1
    // Deduplicate and prioritize active winner / players
    const uniquePlayers: `0x${string}`[] = []
    const seen = new Set<string>()

    // Prioritize active address if present in players list or solo room
    if (activeAddress && players.some(p => p.toLowerCase() === activeAddress.toLowerCase())) {
      uniquePlayers.push(activeAddress as `0x${string}`)
      seen.add(activeAddress.toLowerCase())
    }

    for (const p of players) {
      const lower = p.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        uniquePlayers.push(p)
      }
    }

    if (uniquePlayers.length === 0 && activeAddress) {
      uniquePlayers.push(activeAddress as `0x${string}`)
    }

    // Rank registered players by their real gameplay scores descending from cloud + local
    const cloudScores = await fetchAuthoritativeScores(roomCode).catch(() => ({}))
    const roomScores: Record<string, number> = { ...liveRoomScores, ...getRoomAllScores(roomCode) }
    for (const [addr, p] of Object.entries(cloudScores)) {
      if (typeof p.score === 'number') {
        roomScores[addr.toLowerCase()] = p.score
      }
    }
    if (activeAddress && typeof score === 'number') {
      roomScores[activeAddress.toLowerCase()] = score
    }

    uniquePlayers.sort((a, b) => {
      const scoreA = roomScores[a.toLowerCase()] ?? getRoomUserScore(roomCode, a) ?? 0
      const scoreB = roomScores[b.toLowerCase()] ?? getRoomUserScore(roomCode, b) ?? 0
      return scoreB - scoreA
    })

    const snapshotEntries = uniquePlayers.map((addr, idx) => {
      const prof = getUserProfile(addr)
      return {
        address: addr,
        score: roomScores[addr.toLowerCase()] ?? 0,
        rank: idx + 1,
        username: prof?.username,
        avatarUrl: prof?.avatarUrl,
      }
    })
    void submitFinalLeaderboard(roomCode, snapshotEntries)

    const winnersToDeclare = uniquePlayers.slice(0, maxSplits)
    declareWinners(roomCode, winnersToDeclare)
  }

  const currentQ = questions[qIndex]

  // ─── Lobby phase ─────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="relative min-h-screen min-h-[100dvh] w-full overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}>
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '5%', left: '3%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.16) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <div
          className="relative z-10 mx-auto w-full max-w-md px-3.5 pt-4 sm:max-w-xl md:max-w-2xl sm:px-6 sm:py-6"
          style={{ paddingBottom: 'max(6.5rem, calc(env(safe-area-inset-bottom, 20px) + 5rem))' }}
        >
          <div className="mb-5 sm:mb-6 flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 hover:bg-white backdrop-blur-md shadow-xs border border-[var(--border)] transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
              title="Go back"
            >
              <ArrowLeft size={16} className="stroke-[2.25]" style={{ color: 'var(--ink)' }} />
            </button>
            <div>
              <h1 className="display text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                Room <span style={{ color: 'var(--accent)' }}>{roomCode}</span>
              </h1>
              <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--subtle)' }}>
                <span>{CATEGORY_GROUPS.flatMap(g => g.subcategories).find(s => s.id === resolvedCategory)?.emoji ?? '🎮'}</span>
                <span className="font-semibold text-gray-800">{resolvedCategory}</span>
                <span>· {isHost ? 'You are the Host' : 'Waiting for host to start'}</span>
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3">
              <div className="rounded-2xl p-3 text-center relative" style={glass.inner}>
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <Users size={13} style={{ color: 'var(--subtle)' }} />
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>Players</p>
                </div>
                <p className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                  {effectivePlayerCount}<span className="text-base font-medium" style={{ color: 'var(--muted)' }}>/{maxP ?? '—'}</span>
                </p>
              </div>
              <div className="rounded-2xl p-3 text-center" style={glass.inner}>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                  {buyInNum > 0 && currentPrizeNum === 0 ? 'Est. Prize Pool' : 'Prize Pool'}
                </p>
                <div className="flex items-center justify-center gap-1">
                  <TokenUSDC variant="branded" size={16} />
                  <p className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {currentPrizeNum > 0 ? prizeHuman : estimatedTotalPrize}
                  </p>
                </div>
              </div>
            </div>

            {/* Host & Joined Players Section */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl p-3 sm:p-3.5" style={glass.inner}>
              {/* Host Column */}
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Host
                </span>
                {host && host !== '0x0000000000000000000000000000000000000000' ? (
                  <PlayerTag address={host} />
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Pending...</span>
                )}
              </div>

              {/* Joined Players Column */}
              <div className="flex flex-col gap-1 min-w-0 sm:border-l sm:border-slate-200/60 sm:pl-3.5">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Joined Players ({rawPlayersList?.length ?? 0}/{maxP ?? '—'})
                </span>
                {rawPlayersList && rawPlayersList.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                    {(rawPlayersList as `0x${string}`[]).map((pAddr) => (
                      <PlayerTag key={pAddr} address={pAddr} />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 font-medium pt-0.5">
                    Waiting for players to join...
                  </span>
                )}
              </div>
            </div>

            {/* Payout Distribution Banner */}
            <div className="mb-4 rounded-2xl p-3 sm:p-3.5" style={glass.inner}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Trophy size={13} className="text-amber-500 stroke-[2.25]" />
                <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
                  Payout Distribution
                </span>
              </div>

              {(() => {
                const splits = calculatePayoutSplits(prizeForPayouts, getRoomPayout(roomCode, payoutMode).splits)
                if (splits.length === 1) {
                  return (
                    <div className="flex items-center justify-between rounded-xl bg-white/95 px-3.5 py-2.5 border border-slate-200/80 shadow-2xs">
                      <span className="text-xs sm:text-sm font-bold text-slate-800">
                        Winner Takes All
                      </span>
                      <div className="flex items-center gap-1.5">
                        <TokenUSDC variant="branded" size={14} className="shrink-0" />
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 tabular-nums">
                          {splits[0].amount} USDC
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">100%</span>
                      </div>
                    </div>
                  )
                }
                return (
                  <div className={`grid gap-2 ${splits.length === 2 ? 'grid-cols-2' : splits.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {splits.map((s, idx) => {
                      const tierBadges = [
                        { rankText: '🥇 1st', bg: 'bg-amber-50/90 text-amber-800 border-amber-200/90' },
                        { rankText: '🥈 2nd', bg: 'bg-slate-50 text-slate-700 border-slate-200' },
                        { rankText: '🥉 3rd', bg: 'bg-orange-50/90 text-orange-900 border-orange-200/90' },
                        { rankText: '4th', bg: 'bg-slate-50 text-slate-600 border-slate-200' },
                        { rankText: '5th', bg: 'bg-slate-50 text-slate-600 border-slate-200' },
                      ]
                      const badge = tierBadges[idx] ?? { rankText: `${idx + 1}th`, bg: 'bg-slate-50 text-slate-600 border-slate-200' }

                      return (
                        <div
                          key={idx}
                          className="flex flex-col justify-between rounded-xl bg-white/95 p-2.5 border border-slate-200/80 shadow-2xs transition-all hover:bg-white hover:border-slate-300"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className={`inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badge.bg}`}>
                              {badge.rankText}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md tabular-nums">
                              {s.percent}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TokenUSDC variant="branded" size={13} className="shrink-0" />
                            <span className="text-xs font-bold text-slate-900 tabular-nums">
                              {s.amount} USDC
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* ── Modern Invite Friends Box ── */}
            <div
              className="mb-4 overflow-hidden rounded-2xl p-3.5 sm:p-4 transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.95) 100%)',
                border: '1px solid rgba(226,232,240,0.95)',
                boxShadow: '0 4px 16px -2px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,1)',
              }}
            >
              {/* Header row (Clean, uncolored icon) */}
              <div className="mb-2.5 flex items-center gap-1.5">
                <Users size={14} className="text-slate-500 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  Invite Friends
                </span>
              </div>

              {/* Integrated modern input and action bar */}
              <div
                className="flex items-center gap-1.5 rounded-xl p-1.5 pl-3 transition-all"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(226, 232, 240, 1)',
                  boxShadow: '0 2px 6px -2px rgba(15, 23, 42, 0.04), inset 0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                {/* Clean shortened URL display (hiding long query parameters from the view) */}
                <span className="flex-1 min-w-0 truncate font-mono text-xs text-slate-600 select-all">
                  {(typeof window !== 'undefined' ? window.location.host : 'trivio.io') + `/?join=${roomCode}`}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Native Share (if supported) */}
                  {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 border border-slate-200/80 transition-all active:scale-95 cursor-pointer shadow-2xs"
                      title="Share via device (WhatsApp, Telegram, X, Discord)"
                      aria-label="Share via device"
                    >
                      <Share2 size={12} />
                    </button>
                  )}

                  {/* Copy Link Button */}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] active:bg-[#5b21b6] shadow-xs transition-all duration-150 active:scale-95 cursor-pointer select-none"
                    title="Copy full invite link"
                  >
                    {copiedLink ? <Check size={12} className="stroke-[2.5]" /> : <Copy size={12} />}
                    <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Contextual Helper Text */}
              <p className="mt-2 text-[11px] text-slate-400 font-medium">
                Share the link or code with friends to join this lobby.
              </p>
            </div>

            {!TRIVIA_GAME_ADDRESS && (
              <p className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}>
                Contract not deployed — playing in demo mode.
              </p>
            )}

            {isHost && (
              <div className="space-y-2.5">
                {(startPending || startConfirming) && (
                  <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
                    {startPending ? 'Confirm in wallet...' : 'Starting game onchain...'}
                  </p>
                )}
                <button
                  onClick={handleStartGame}
                  disabled={startPending || startConfirming || cancelPending || cancelConfirming}
                  className="w-full rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 shadow-xs cursor-pointer active:scale-98"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {isWrongChain ? 'Switch to Arc' : startPending || startConfirming ? 'Starting...' : 'Start Game'}
                </button>

                <button
                  type="button"
                  onClick={handleCancelRoom}
                  disabled={startPending || startConfirming || cancelPending || cancelConfirming}
                  className="w-full rounded-2xl py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-500 hover:text-rose-600 bg-white/80 hover:bg-rose-50/90 border border-slate-200/80 hover:border-rose-200 transition-all duration-150 disabled:opacity-40 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-2xs group"
                  title="Cancel room and refund escrowed funds"
                >
                  {cancelPending || cancelConfirming ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-rose-600 shrink-0" />
                      <span className="font-bold text-rose-600">Cancelling & Refunding...</span>
                    </>
                  ) : (
                    <span>Cancel Room & Refund</span>
                  )}
                </button>
              </div>
            )}

            {!isHost && (
              <div className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center text-sm" style={{ ...glass.inner, color: 'var(--muted)' }}>
                <Loader2 size={15} className="animate-spin text-purple-600 shrink-0" />
                <span>Waiting for the host to start the game...</span>
              </div>
            )}

            {/* Demo: play locally without contract */}
            {!TRIVIA_GAME_ADDRESS && (
              <button
                onClick={() => {
                  const qs = getQuestions(resolvedCategory, 10, roomCode)
                  setQuestions(qs)
                  setQIndex(0)
                  setTimeLeft(roomDuration)
                  setAnswered(false)
                  setSelectedIndex(null)
                  setScore(0)
                  answerStartRef.current = Date.now()
                  setPhase('playing')
                }}
                className="mt-2 w-full rounded-2xl py-3.5 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              >
                Play Demo (no contract)
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Playing phase ────────────────────────────────────────────────────────────
  if (phase === 'playing' && currentQ) {
    const timeFraction = timeLeft / roomDuration
    return (
      <div className="relative min-h-screen min-h-[100dvh] w-full overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}>
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '3%', right: '3%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-md px-3.5 pb-24 pt-4 sm:max-w-xl md:max-w-2xl sm:px-6 sm:py-6">
          {/* Progress bar */}
          <div className="mb-4 sm:mb-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
                Q{qIndex + 1} of {questions.length} · <span className="font-semibold">{resolvedCategory}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <Clock size={13} style={{ color: timeFraction < 0.3 ? 'var(--danger)' : 'var(--subtle)' }} />
                <span className="tabular-nums text-sm font-bold" style={{ color: timeFraction < 0.3 ? 'var(--danger)' : 'var(--ink)' }}>
                  {timeLeft}s
                </span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(18,45,69,0.08)' }}>
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${timeFraction * 100}%` }}
                transition={{ duration: 0.3, ease: 'linear' }}
                style={{ background: timeFraction < 0.3 ? 'var(--danger)' : 'var(--accent)' }}
              />
            </div>
          </div>

          {/* Score */}
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>Your score</span>
            <span className="display text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{score} pts</span>
          </div>

          {/* Question */}
          <div className="mb-4 sm:mb-5">
            <QuestionCard
              question={currentQ.question}
              category={resolvedCategory}
              qIndex={qIndex}
              totalQuestions={questions.length}
              layoutKey={qIndex}
            />
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {currentQ.options.map((opt, i) => {
              const isSelected = selectedIndex === i
              const isCorrect = i === currentQ.correctIndex
              const isWrong = isSelected && !isCorrect

              let btnStyle = 'bg-white/80 hover:bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-sm cursor-pointer text-slate-800'
              let badgeStyle = 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800'
              let textStyle = 'text-slate-800'

              if (answered) {
                if (isCorrect) {
                  btnStyle = 'bg-emerald-50/95 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500/30 shadow-xs font-semibold cursor-default'
                  badgeStyle = 'bg-emerald-600 text-white'
                  textStyle = 'text-emerald-950 font-bold'
                } else if (isWrong) {
                  btnStyle = 'bg-rose-50/95 border-rose-400 text-rose-950 ring-1 ring-rose-500/30 shadow-xs font-semibold cursor-default'
                  badgeStyle = 'bg-rose-600 text-white'
                  textStyle = 'text-rose-950 font-semibold'
                } else {
                  btnStyle = 'bg-white/30 border border-slate-200/40 text-slate-400 opacity-40 cursor-default'
                  badgeStyle = 'bg-slate-100/60 text-slate-400'
                  textStyle = 'text-slate-400'
                }
              }

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAnswer(i)}
                  disabled={answered}
                  className={`group relative flex items-center gap-3.5 w-full rounded-2xl p-4 text-left text-sm font-medium transition-all duration-150 ${btnStyle}`}
                  style={{
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  }}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold transition-colors ${badgeStyle}`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className={`flex-1 leading-snug break-words text-balance ${textStyle}`}>{opt}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─── Finished phase ───────────────────────────────────────────────────────────
  if (phase === 'finished') {
    return (
      <div className="relative min-h-screen min-h-[100dvh] w-full overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}>
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '5%', left: '3%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.2) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <div
          className="relative z-10 mx-auto w-full max-w-md px-3.5 pt-4 sm:max-w-xl md:max-w-2xl sm:px-6 sm:py-6"
          style={{ paddingBottom: 'max(6.5rem, calc(env(safe-area-inset-bottom, 20px) + 5rem))' }}
        >
          <div className="mb-5 sm:mb-6 flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 hover:bg-white backdrop-blur-md shadow-xs border border-[var(--border)] transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
              title="Go back"
            >
              <ArrowLeft size={16} className="stroke-[2.25]" style={{ color: 'var(--ink)' }} />
            </button>
            <h1 className="display text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>Game Over</h1>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5 rounded-3xl p-8 sm:p-10 text-center relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100/80 bg-white/95 backdrop-blur-md"
          >
            {/* Background subtle glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

            {/* Big, Modern Golden Cup Icon */}
            <div className="relative mx-auto mb-5 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-amber-950 shadow-[0_10px_28px_rgba(245,158,11,0.28)] border-2 border-amber-200/90">
              <Trophy size={46} className="stroke-[2.2] text-amber-950 drop-shadow-xs" />
            </div>

            {/* Label */}
            <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-400 mb-1" style={{ letterSpacing: '0.12em' }}>
              Your Final Score
            </p>

            {/* Big, bold numeric score */}
            <p className="display text-6xl sm:text-7xl font-black text-slate-900 tabular-nums tracking-tight" style={{ letterSpacing: '-0.04em' }}>
              {score}
            </p>

            {/* Subtitle */}
            <p className="mt-2 text-xs sm:text-sm font-medium text-slate-500">
              pts across {questions.length} questions
            </p>
          </motion.div>

          {isHost && (
            <div className="mb-4 rounded-3xl p-4 sm:p-5" style={glass.card}>
              {(() => {
                const onchainPlayerAddrs = ((rawPlayersList as `0x${string}`[] | undefined) || []).filter(
                  (addr) => Boolean(addr) && addr !== '0x0000000000000000000000000000000000000000'
                )
                const otherPlayers = onchainPlayerAddrs.filter(p => p.toLowerCase() !== activeAddress?.toLowerCase())
                const finishedOtherCount = otherPlayers.filter(p => {
                  const details = livePlayerDetails[p.toLowerCase()]
                  return Boolean(details?.isFinished || (details?.qIndex !== undefined && details.qIndex >= 10))
                }).length
                const totalParticipants = otherPlayers.length + 1
                const totalFinished = finishedOtherCount + 1
                const areAllOtherFinished = otherPlayers.length === 0 || finishedOtherCount >= otherPlayers.length

                return (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Users size={15} className="text-purple-600" />
                        <p className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
                          Live Player Standings ({totalFinished}/{totalParticipants} Finished)
                        </p>
                      </div>
                      {!areAllOtherFinished && hostGraceSeconds > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full tabular-nums">
                          ⏳ {hostGraceSeconds}s grace
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Host */}
                      <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/95 border border-slate-200/80 shadow-2xs">
                        <PlayerTag address={activeAddress} isHost={true} />
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 tabular-nums">{score} pts</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2.5 py-0.5 rounded-full">
                            <Check size={12} className="text-emerald-600 stroke-[2.5]" />
                            <span>Finished</span>
                          </span>
                        </div>
                      </div>

                      {/* Other joined players */}
                      {otherPlayers.map((pAddr) => {
                        const lower = pAddr.toLowerCase()
                        const pDetail = livePlayerDetails[lower]
                        const pScore = pDetail?.score ?? liveRoomScores[lower] ?? 0
                        const isFinished = Boolean(pDetail?.isFinished || (pDetail?.qIndex !== undefined && pDetail.qIndex >= 10))
                        const currentQ = (pDetail?.qIndex !== undefined ? Math.min(pDetail.qIndex + 1, 10) : 1)

                        return (
                          <div key={pAddr} className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/95 border border-slate-200/80 shadow-2xs">
                            <PlayerTag address={pAddr} />
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900 tabular-nums">{pScore} pts</span>
                              {isFinished ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2.5 py-0.5 rounded-full">
                                  <Check size={12} className="text-emerald-600 stroke-[2.5]" />
                                  <span>Finished</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/90 px-2.5 py-0.5 rounded-full tabular-nums">
                                  Q{currentQ}/10
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {isHost && TRIVIA_GAME_ADDRESS && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {(() => {
                const onchainPlayerAddrs = ((rawPlayersList as `0x${string}`[] | undefined) || []).filter(
                  (addr) => Boolean(addr) && addr !== '0x0000000000000000000000000000000000000000'
                )
                const otherPlayers = onchainPlayerAddrs.filter(p => p.toLowerCase() !== activeAddress?.toLowerCase())
                const finishedOtherCount = otherPlayers.filter(p => {
                  const details = livePlayerDetails[p.toLowerCase()]
                  return Boolean(details?.isFinished || (details?.qIndex !== undefined && details.qIndex >= 10))
                }).length
                const areAllOtherFinished = otherPlayers.length === 0 || finishedOtherCount >= otherPlayers.length
                const canHostDeclare = areAllOtherFinished || hostGraceSeconds <= 0

                return (
                  <>
                    {(declarePending || declareConfirming) && (
                      <p className="mb-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
                        {declarePending ? 'Confirm in wallet...' : 'Sending USDC payout...'}
                      </p>
                    )}
                    <button
                      onClick={handleDeclareWinner}
                      disabled={declarePending || declareConfirming || !canHostDeclare}
                      className="w-full rounded-2xl py-4 text-sm sm:text-base font-bold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-98 disabled:opacity-40 disabled:scale-100 cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                        boxShadow: '0 8px 24px rgba(124, 58, 237, 0.28)',
                      }}
                    >
                      {isWrongChain
                        ? 'Switch to Arc Testnet'
                        : declarePending || declareConfirming
                          ? 'Sending payout...'
                          : !canHostDeclare
                            ? `Waiting for players to finish (${hostGraceSeconds}s)...`
                            : 'Declare Winner & Pay Out'}
                    </button>
                    {!canHostDeclare && (
                      <button
                        type="button"
                        onClick={handleDeclareWinner}
                        className="mt-2 text-center w-full text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer py-1"
                      >
                        Declare now without waiting
                      </button>
                    )}
                  </>
                )
              })()}
            </motion.div>
          )}

          {!isHost && TRIVIA_GAME_ADDRESS && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 text-center space-y-3" style={glass.inner}>
              <div className="flex items-center justify-center gap-2 text-purple-700">
                <Loader2 size={16} className="animate-spin" />
                <p className="text-sm font-bold">Game Completed!</p>
              </div>
              <p className="text-xs text-slate-500">
                Waiting for host to finalize the game and distribute the prize...
              </p>
              <button
                type="button"
                onClick={onBack}
                className="w-full rounded-xl py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs transition-all active:scale-98 cursor-pointer"
              >
                Return to Lobby
              </button>
            </motion.div>
          )}

          {!TRIVIA_GAME_ADDRESS && (
            <button
              onClick={() => {
                clearActiveGame()
                onGameEnd(activeAddress || '0x0000000000000000000000000000000000000000', prizeForPayouts, undefined, score)
              }}
              className="w-full rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              See Results (Demo)
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
