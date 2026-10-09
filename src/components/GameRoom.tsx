import { useState, useEffect, useRef, startTransition, useMemo } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Clock, Trophy, Copy, Check, Link2, Users, Loader2, Share2, Ban, AlertTriangle, X, ArrowUpRight } from 'lucide-react'
import { buildJoinUrl } from '@/App'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import {
  useStartGame,
  useDeclareWinners,
  useCancelRoom,
  useClaimRefund,
  usePendingRefund,
  markRoomRefunded,
  getRoomRefundedStatus,
  useRoomInfo,
  useRoomPlayers,
  useRoomWinners,
  formatUSDCRaw,
  type RoomTuple,
} from '@/hooks/useTriviaContract'
import { getQuestions, verifyAnswerHash, resolveRevealedCorrectIndex, type Category, type TriviaQuestion, CATEGORY_GROUPS } from '@/lib/questions'
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
  savePendingRefundRoom,
  removePendingRefundRoom,
  saveRoomCancelledState,
  isSavedRoomCancelled,
  saveRoomBuyIn,
  getRoomBuyIn,
} from '@/lib/roomStorage'
import { useRoomScores, broadcastRoomTxHash, broadcastGameStart, broadcastGameCancel } from '@/lib/roomSync'
import { fetchAuthoritativeScores, fetchRoomMetadata, submitFinalLeaderboard, submitGameCancel } from '@/lib/roomDb'
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

  const { scores: liveRoomScores, playerDetails: livePlayerDetails, isGameStarted, isGameCancelled, cancelReason, gameMeta, syncMyScore } = useRoomScores(roomCode, activeAddress)

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

  // Anti-Cheat: Restore exact remaining time from saved questionStartTime on refresh
  let initialTimeLeft = roomDuration
  let initialAnswered = isMatchRoom && initialPhase === 'playing' ? Boolean(savedSession?.answered) : false
  let initialSelectedIndex: number | null = isMatchRoom && initialPhase === 'playing' ? (savedSession?.selectedIndex ?? null) : null
  const initialQuestionStartTime = isMatchRoom && initialPhase === 'playing' && savedSession?.questionStartTime ? savedSession.questionStartTime : Date.now()

  if (isMatchRoom && initialPhase === 'playing' && savedSession?.questionStartTime) {
    const elapsedSeconds = Math.floor((Date.now() - savedSession.questionStartTime) / 1000)
    if (!initialAnswered) {
      if (elapsedSeconds >= roomDuration) {
        initialTimeLeft = 0
        initialAnswered = true
        initialSelectedIndex = -1
      } else {
        initialTimeLeft = Math.max(0, roomDuration - elapsedSeconds)
      }
    }
  }

  const [phase, setPhase] = useState<GamePhase>(initialPhase)
  const [questions, setQuestions] = useState<TriviaQuestion[]>(() => {
    if (initialPhase === 'finished' || initialPhase === 'playing') {
      return getQuestions(resolvedCategory, 10, roomCode, activeAddress)
    }
    return []
  })
  const [qIndex, setQIndex] = useState<number>(() => {
    if (initialPhase === 'playing' && initialQIndex >= 10) {
      return 9
    }
    return initialQIndex
  })
  const [timeLeft, setTimeLeft] = useState<number>(initialTimeLeft)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialSelectedIndex)
  const [answered, setAnswered] = useState<boolean>(initialAnswered)
  const [score, setScore] = useState<number>(initialScore)
  const [lastPts, setLastPts] = useState<number | null>(null)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [tabWarnings, setTabWarnings] = useState<number>(() => isMatchRoom ? (savedSession?.tabWarnings ?? 0) : 0)
  const [lostFocusThisQuestion, setLostFocusThisQuestion] = useState<boolean>(false)
  const answerStartRef = useRef<number>(initialQuestionStartTime)

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
      const qs = getQuestions(resolvedCategory, 10, roomCode, activeAddress)
      setQuestions(qs)
    }
  }, [phase, questions.length, resolvedCategory, roomCode, activeAddress])

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
  const savedBuyIn = getRoomBuyIn(roomCode)
  const buyInHuman = _buyIn !== undefined ? formatUSDCRaw(_buyIn) : (savedBuyIn || '0')
  const buyInNum = parseFloat(buyInHuman) || 0

  useEffect(() => {
    if (roomCode && _buyIn !== undefined) {
      saveRoomBuyIn(roomCode, formatUSDCRaw(_buyIn))
    }
  }, [roomCode, _buyIn])
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

  const rawProfile = activeAddress ? (getUserProfile(activeAddress) || getUserProfile()) : getUserProfile()
  // Memoize the profile so it doesn't trigger the useEffect infinite loop since it returns a new object via JSON.parse each time
  const localProfile = useMemo(() => rawProfile, [JSON.stringify(rawProfile)])

  // Keep active game persisted with current phase, score, question index, chosen answer, and round timing for anti-cheat resume
  useEffect(() => {
    saveActiveGame(roomCode, resolvedCategory, isHost, phase, score, qIndex, answered, selectedIndex, answerStartRef.current, tabWarnings)
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
  }, [roomCode, resolvedCategory, isHost, phase, score, qIndex, activeAddress, prizeForPayouts, localProfile, answered, selectedIndex, tabWarnings])

  const { startGame, isPending: startPending, isConfirming: startConfirming, isSuccess: gameStarted } = useStartGame()
  const { declareWinners, isPending: declarePending, isConfirming: declareConfirming, isSuccess: declared, hash: declareHash } = useDeclareWinners()
  const { cancelRoom, cancelRoomAsync, isPending: cancelPending, isConfirming: cancelConfirming, isSuccess: cancelSuccess, error: cancelError } = useCancelRoom()
  const { claimRefund, claimRefundAsync, isPending: refundPending, isConfirming: refundConfirming, isSuccess: refundSuccess, error: refundError, hash: refundHash } = useClaimRefund()
  const { refundAmount } = usePendingRefund(roomCode, activeAddress as `0x${string}` | undefined)

  const cachedRefund = useMemo(() => getRoomRefundedStatus(roomCode, activeAddress), [roomCode, activeAddress])
  const isAlreadyRefunded = refundSuccess || cachedRefund.isRefunded || (Boolean(status === 3 && !isHost && refundAmount !== undefined && refundAmount === 0n && cachedRefund.isRefunded))
  const effectiveRefundTxHash = refundHash || cachedRefund.txHash

  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID
  const isRoomCancelled = (status === 3 || isGameCancelled || isSavedRoomCancelled(roomCode) || cachedRefund.isRefunded) && !isHost
  const hasNotifiedCancelRef = useRef(false)

  // Persist cancelled state in storage so subsequent refreshes never glitch
  useEffect(() => {
    if (status === 3 || isGameCancelled) {
      saveRoomCancelledState(roomCode, true)
    }
  }, [status, isGameCancelled, roomCode])

  // Remove room from pending refunds once refund is claimed
  useEffect(() => {
    if (refundSuccess || isAlreadyRefunded) {
      removePendingRefundRoom(roomCode, activeAddress)
    }
  }, [refundSuccess, isAlreadyRefunded, roomCode, activeAddress])

  useEffect(() => {
    if (cancelSuccess) {
      toast.success('Room cancelled and funds refunded!')
      void submitGameCancel(roomCode, 'Cancelled by host')
      broadcastGameCancel(roomCode, 'Cancelled by host')
      clearActiveGame()
      removePendingPayoutRoom(roomCode)
      setShowCancelModal(false)
      onBack()
    }
  }, [cancelSuccess, onBack, roomCode])

  useEffect(() => {
    if (cancelError) {
      const errStr = cancelError.message || ''
      if (errStr.includes('User rejected') || errStr.includes('User denied') || errStr.includes('rejected transaction')) {
        toast.error('Transaction rejected in wallet')
      } else {
        toast.error(errStr.slice(0, 90) || 'Failed to cancel room onchain')
      }
    }
  }, [cancelError])

  useEffect(() => {
    if (refundError) {
      const errStr = refundError.message || ''
      if (errStr.includes('User rejected') || errStr.includes('User denied') || errStr.includes('rejected transaction')) {
        toast.error('Transaction rejected in wallet')
      } else {
        toast.error(errStr.slice(0, 90) || 'Failed to claim refund onchain')
      }
    }
  }, [refundError])

  useEffect(() => {
    if (refundSuccess) {
      toast.success('USDC refund claimed successfully!')
      if (activeAddress) {
        markRoomRefunded(roomCode, activeAddress, refundHash)
      }
    }
  }, [refundSuccess, roomCode, activeAddress, refundHash])

  const handleClaimRefund = async () => {
    if (isWrongChain) {
      switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
      return
    }

    try {
      if (claimRefundAsync) {
        await claimRefundAsync(roomCode)
      } else {
        claimRefund(roomCode)
      }
    } catch (err: any) {
      const errStr = String(err?.message || err)
      if (errStr.includes('User rejected') || errStr.includes('User denied') || errStr.includes('rejected transaction')) {
        toast.error('Transaction rejected in wallet')
      } else {
        toast.error(errStr.slice(0, 90) || 'Failed to claim refund')
      }
    }
  }

  useEffect(() => {
    if (isRoomCancelled && !hasNotifiedCancelRef.current) {
      hasNotifiedCancelRef.current = true
      toast.error('The host has cancelled this room', {
        description: buyInNum > 0 ? 'Your entry fee is available for 100% refund.' : 'You can return to the lobby to join another room.',
        duration: 8000,
      })
      clearActiveGame()
      removePendingPayoutRoom(roomCode)
    }
  }, [isRoomCancelled, buyInNum, roomCode])

  const [showCancelModal, setShowCancelModal] = useState(false)

  const handleConfirmCancel = async () => {
    if (isWrongChain) {
      switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
      return
    }

    if (!TRIVIA_GAME_ADDRESS || !activeAddress) {
      toast.success('Room cancelled!')
      void submitGameCancel(roomCode, 'Cancelled by host')
      broadcastGameCancel(roomCode, 'Cancelled by host')
      clearActiveGame()
      removePendingPayoutRoom(roomCode)
      setShowCancelModal(false)
      onBack()
      return
    }

    try {
      if (cancelRoomAsync) {
        await cancelRoomAsync(roomCode)
      } else {
        cancelRoom(roomCode)
      }
    } catch (err: any) {
      const errStr = String(err?.message || err)
      if (errStr.includes('User rejected') || errStr.includes('User denied') || errStr.includes('rejected transaction')) {
        toast.error('Transaction rejected in wallet')
      } else if (errStr.includes('RoomCannotBeCancelled') || errStr.includes('RoomDoesNotExist')) {
        toast.warning('Room already closed or finished onchain.')
        void submitGameCancel(roomCode, 'Cancelled by host')
        broadcastGameCancel(roomCode, 'Cancelled by host')
        clearActiveGame()
        removePendingPayoutRoom(roomCode)
        setShowCancelModal(false)
        onBack()
      } else {
        toast.error(errStr.slice(0, 90) || 'Failed to cancel room')
      }
    }
  }

  // When game starts onchain or via cloud broadcast, immediately move all players to playing phase without page refresh
  useEffect(() => {
    const isGameActive = gameStarted || status === 1 || isGameStarted
    if (isGameActive && phase === 'lobby') {
      const activeCategory = (gameMeta?.category as Category) || cloudCategory || resolvedCategory
      const qs = getQuestions(activeCategory, 10, roomCode, activeAddress)
      const existing = getActiveGame()
      const isCurrentSession = existing?.roomCode === roomCode.trim().toUpperCase()
      const resumeScore = isCurrentSession && typeof existing?.score === 'number' ? existing.score : 0
      const resumeQIndex = isCurrentSession && typeof existing?.qIndex === 'number' ? existing.qIndex : 0
      const now = Date.now()

      if (resumeQIndex === 0 && resumeScore === 0) {
        toast.success('🚀 Game Starting Now!', {
          description: `${activeCategory} · 10 Questions · Good luck!`,
          duration: 4000,
        })
      }

      startTransition(() => {
        setQuestions(qs)
        setQIndex(resumeQIndex)
        setTimeLeft(roomDuration)
        setAnswered(false)
        setSelectedIndex(null)
        setScore(resumeScore)
        setLostFocusThisQuestion(false)
        setPhase('playing')
      })
      answerStartRef.current = now
      saveActiveGame(roomCode, activeCategory, isHost, 'playing', resumeScore, resumeQIndex, false, null, now, tabWarnings)
    }
  }, [gameStarted, status, isGameStarted, phase, resolvedCategory, cloudCategory, gameMeta?.category, roomCode, roomDuration, isHost, tabWarnings])

  // Anti-Cheat: Tab Switch & Window Blur Detection (Anti-Googling)
  useEffect(() => {
    if (phase !== 'playing' || answered) return

    const handleDefocus = () => {
      if (phase !== 'playing' || answered) return
      setLostFocusThisQuestion(true)
      setTabWarnings((prev) => {
        const nextCount = prev + 1
        saveActiveGame(roomCode, resolvedCategory, isHost, 'playing', score, qIndex, answered, selectedIndex, answerStartRef.current, nextCount)
        return nextCount
      })
      toast.warning('⚠️ Tab switch detected!', {
        description: 'Speed bonus capped for this question to ensure fair play.',
        duration: 3500,
      })
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleDefocus()
      }
    }

    window.addEventListener('blur', handleDefocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', handleDefocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [phase, answered, roomCode, resolvedCategory, isHost, score, qIndex, selectedIndex])

  // Countdown timer for questions (ticks while !answered)
  useEffect(() => {
    if (phase !== 'playing' || answered) return

    if (timeLeft <= 0) {
      setAnswered(true)
      setSelectedIndex(-1)
      setLastCorrect(false)
      setLastPts(null)
      saveActiveGame(roomCode, resolvedCategory, isHost, 'playing', score, qIndex, true, -1, answerStartRef.current, tabWarnings)
      if (activeAddress) {
        syncMyScore(score, {
          username: localProfile?.username,
          avatarSeed: localProfile?.avatarSeed,
          avatarUrl: localProfile?.avatarUrl,
          qIndex,
          isFinished: false,
        })
      }
      return
    }

    const t = setInterval(() => {
      setTimeLeft(s => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [phase, answered, timeLeft, roomCode, resolvedCategory, isHost, score, qIndex, activeAddress, localProfile, syncMyScore, tabWarnings])

  // Automatically advance to next question once answered (after showing correct answer feedback)
  useEffect(() => {
    if (phase !== 'playing' || !answered) return
    const timer = setTimeout(() => {
      advanceQuestion(qIndex, questions)
    }, 1600)
    return () => clearTimeout(timer)
  }, [phase, answered, qIndex, questions])

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
      saveActiveGame(roomCode, resolvedCategory, isHost, 'finished', score, next, true, selectedIndex, answerStartRef.current, tabWarnings)
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
      setLostFocusThisQuestion(false)
      const now = Date.now()
      answerStartRef.current = now
      saveActiveGame(roomCode, resolvedCategory, isHost, 'playing', score, next, false, null, now, tabWarnings)
      if (activeAddress) {
        syncMyScore(score, {
          username: localProfile?.username,
          avatarSeed: localProfile?.avatarSeed,
          avatarUrl: localProfile?.avatarUrl,
          qIndex: next,
          isFinished: false,
        })
      }
    }
  }

  const handleAnswer = (idx: number) => {
    if (answered || phase !== 'playing') return
    const q = questions[qIndex]
    if (!q) return
    const elapsed = Date.now() - answerStartRef.current
    setSelectedIndex(idx)
    setAnswered(true)

    // Anti-Cheat: Minimum human visual perception & motor response threshold (~250ms)
    const isBotSpeed = elapsed < 250
    if (isBotSpeed) {
      toast.warning('⚡ Instant reaction flagged', {
        description: 'Submission under 250ms was capped to baseline points to protect fair play.',
        duration: 3500,
      })
    }

    let newScore = score
    const isCorrect = verifyAnswerHash(q, idx)
    if (isCorrect) {
      const basePts = isBotSpeed ? 10 : Math.max(10, 100 - Math.floor((elapsed / 1000) * 5))
      // Anti-Cheat: If player switched tabs during this question, cap speed bonus at 25 pts
      const pts = lostFocusThisQuestion ? Math.min(25, basePts) : basePts
      newScore = score + pts
      setScore(newScore)
      setLastPts(pts)
      setLastCorrect(true)
    } else {
      setLastPts(null)
      setLastCorrect(false)
    }

    saveActiveGame(roomCode, resolvedCategory, isHost, 'playing', newScore, qIndex, true, idx, answerStartRef.current, tabWarnings)
    if (activeAddress) {
      syncMyScore(newScore, {
        username: localProfile?.username,
        avatarSeed: localProfile?.avatarSeed,
        avatarUrl: localProfile?.avatarUrl,
        qIndex,
        isFinished: false,
      })
    }
  }

  const handleStartGame = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    broadcastGameStart(roomCode, resolvedCategory, roomDuration)
    startGame(roomCode)
  }

  // Once the host's start transaction is confirmed onchain, guarantee redundant broadcast to all players
  useEffect(() => {
    if (gameStarted && isHost) {
      broadcastGameStart(roomCode, resolvedCategory, roomDuration)
    }
  }, [gameStarted, isHost, roomCode, resolvedCategory, roomDuration])

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

  // ─── Room Cancelled View for Non-Hosts ─────────────────────────────────────────
  if (isRoomCancelled) {
    return (
      <div className="relative min-h-screen min-h-[100dvh] w-full flex items-center justify-center p-3.5 sm:p-4 md:p-6 overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-md rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200/90 p-6 sm:p-7 text-center"
        >
          {/* Centered Static Cancelled Icon */}
          <div className="flex items-center justify-center mx-auto mb-3.5 mt-1">
            <svg
              width="56"
              height="56"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-xs"
            >
              {/* Solid Red Circle */}
              <circle cx="24" cy="24" r="23" fill="#E11D48" />
              {/* Bold White Rounded Cross */}
              <path
                d="M16.5 16.5L31.5 31.5M31.5 16.5L16.5 31.5"
                stroke="white"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Title & Subtitle */}
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Room Cancelled
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Host has closed this trivia game
          </p>

          {/* Body */}
          <div className="pt-4 space-y-3.5 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
            <p className="text-center text-slate-500 max-w-xs sm:max-w-sm mx-auto">
              {buyInNum > 0
                ? `The host cancelled this room. Your entry fee of ${buyInHuman} USDC is safe and eligible for a 100% onchain refund.`
                : 'The host has cancelled this trivia room. No entry fee was charged.'}
            </p>

            {buyInNum > 0 && (
              <div className="rounded-xl sm:rounded-2xl p-3.5 sm:p-4 bg-slate-50/90 border border-slate-200/80 flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Refund Available
                  </span>
                  <div className="flex items-center gap-1.5">
                    <TokenUSDC variant="branded" size={18} className="shrink-0" />
                    <span className="text-sm sm:text-base font-black text-slate-900 tabular-nums">{buyInHuman} USDC</span>
                  </div>
                </div>

                {isAlreadyRefunded ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-2xs">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black leading-none shrink-0 shadow-2xs">
                        ✓
                      </span>
                      <span>Refunded</span>
                    </span>

                    {effectiveRefundTxHash && (
                      <a
                        href={`https://explorer.testnet.arc.io/tx/${effectiveRefundTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-slate-100 hover:bg-purple-50 text-slate-500 hover:text-purple-600 border border-slate-200/90 hover:border-purple-300 transition-all duration-150 shadow-2xs group cursor-pointer"
                        title={`View Transaction on Arc Explorer: ${effectiveRefundTxHash}`}
                      >
                        <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-slate-500 group-hover:text-purple-600" />
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleClaimRefund}
                    disabled={refundPending || refundConfirming}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)' }}
                  >
                    {refundPending || refundConfirming ? (
                      <>
                        <Loader2 size={13} className="animate-spin shrink-0 text-white" />
                        <span>Claiming...</span>
                      </>
                    ) : (
                      <span>Claim Refund</span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action */}
          <div className="mt-5 pt-3.5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (buyInNum > 0 && !isAlreadyRefunded && activeAddress) {
                  savePendingRefundRoom({
                    roomCode,
                    category: resolvedCategory,
                    buyIn: buyInHuman,
                    cancelledAt: Date.now(),
                    playerAddress: activeAddress,
                  })
                } else {
                  removePendingRefundRoom(roomCode, activeAddress)
                }
                clearActiveGame()
                removePendingPayoutRoom(roomCode)
                onBack()
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs transition-all hover:brightness-105 active:scale-[0.99] cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}
            >
              <span>Return to Lobby</span>
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

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
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3.5 rounded-2xl p-3 sm:p-3.5" style={glass.inner}>
              {/* Host Column */}
              <div className="flex flex-col gap-1 min-w-0 pr-1 sm:pr-0">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Host
                </span>
                <div className="min-w-0 truncate pt-0.5">
                  {host && host !== '0x0000000000000000000000000000000000000000' ? (
                    <PlayerTag address={host} />
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Pending...</span>
                  )}
                </div>
              </div>

              {/* Joined Players Column */}
              <div className="flex flex-col gap-1 min-w-0 border-l border-slate-200/70 pl-2.5 sm:pl-3.5">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                  Joined Players ({rawPlayersList?.length ?? 0}/{maxP ?? '—'})
                </span>
                {rawPlayersList && rawPlayersList.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1 pt-0.5 min-w-0">
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
                  onClick={() => setShowCancelModal(true)}
                  disabled={startPending || startConfirming || cancelPending || cancelConfirming}
                  className="w-full rounded-2xl py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-500 hover:text-rose-600 bg-white/80 hover:bg-rose-50/90 border border-slate-200/80 hover:border-rose-200 transition-all duration-150 disabled:opacity-40 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-2xs group"
                  title="Cancel room and refund escrowed funds"
                >
                  {cancelPending || cancelConfirming ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-rose-600 shrink-0" />
                      <span className="font-bold text-rose-600">Cancelling...</span>
                    </>
                  ) : (
                    <span>Cancel</span>
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

        {/* ── Authentic Trivio Host Cancellation Confirmation Modal ── */}
        <AnimatePresence>
          {showCancelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 md:p-6 overflow-hidden">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer transform-gpu"
                onClick={() => {
                  if (!cancelPending && !cancelConfirming) setShowCancelModal(false)
                }}
              />

              {/* Dialog Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md flex flex-col rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200/90 z-10 p-6 sm:p-7 my-auto text-center transform-gpu"
              >
                {/* Close Button Top Right */}
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelPending || cancelConfirming}
                  className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40 z-20"
                  title="Close dialog"
                >
                  <X size={18} />
                </button>

                {/* Centered Static Caution Icon */}
                <div className="flex items-center justify-center mx-auto mb-3 mt-1">
                  <svg
                    width="56"
                    height="56"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-sm"
                  >
                    {/* Outer Yellow Glow / Rounded Triangle Base */}
                    <path
                      d="M20.536 6.536C22.074 3.872 25.926 3.872 27.464 6.536L44.785 36.536C46.324 39.2 44.398 42.533 41.321 42.533H6.679C3.602 42.533 1.676 39.2 3.215 36.536L20.536 6.536Z"
                      fill="#FFC700"
                    />
                    {/* Inner Black Border Triangle */}
                    <path
                      d="M20.536 6.536C22.074 3.872 25.926 3.872 27.464 6.536L44.785 36.536C46.324 39.2 44.398 42.533 41.321 42.533H6.679C3.602 42.533 1.676 39.2 3.215 36.536L20.536 6.536Z"
                      stroke="#18181B"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {/* Inner Yellow Fill Triangle */}
                    <path
                      d="M21.402 8.036C22.556 6.038 25.444 6.038 26.598 8.036L43.919 38.036C45.073 40.034 43.629 42.533 41.321 42.533H6.679C4.371 42.533 2.927 40.034 4.081 38.036L21.402 8.036Z"
                      fill="#FFC700"
                    />
                    {/* Black Exclamation Mark Bar */}
                    <path
                      d="M24 16V27"
                      stroke="#18181B"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {/* Black Exclamation Mark Dot */}
                    <circle cx="24" cy="34" r="2.25" fill="#18181B" />
                  </svg>
                </div>

                {/* Title & Subtitle */}
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Cancel Room
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  Refund escrowed funds & close lobby
                </p>

                {/* Body Content */}
                <div className="pt-4 space-y-3.5 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  <p className="text-slate-500 max-w-xs sm:max-w-sm mx-auto">
                    Are you sure you want to cancel this room? All joined players and sponsored funds will be refunded <strong className="text-slate-900 font-bold">100% onchain</strong> immediately.
                  </p>

                  {/* Escrow & Players Stats Card */}
                  <div className="rounded-xl sm:rounded-2xl p-3.5 sm:p-4 bg-slate-50/90 border border-slate-200/80 grid grid-cols-2 divide-x divide-slate-200/80">
                    <div className="flex flex-col items-center justify-center text-center px-2 min-w-0">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Pool to Refund
                      </span>
                      <div className="flex items-center justify-center gap-1.5 min-w-0">
                        <TokenUSDC variant="branded" size={17} className="shrink-0" />
                        <span className="text-sm sm:text-base font-black text-slate-900 tabular-nums truncate">
                          {currentPrizeNum > 0 ? prizeHuman : (savedPrize && parseFloat(savedPrize) > 0 ? savedPrize : (parseFloat(estimatedTotalPrize) > 0 ? estimatedTotalPrize : (buyInNum > 0 ? (buyInNum * Math.max(effectivePlayerCount, 1)).toFixed(2) : '0.00')))} USDC
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center px-2 min-w-0">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Joined Players
                      </span>
                      <div className="flex items-center justify-center gap-1.5 min-w-0">
                        <Users size={16} className="text-slate-500 shrink-0" />
                        <span className="text-sm sm:text-base font-black text-slate-900 tabular-nums">
                          {rawPlayersList && rawPlayersList.length > 0 ? rawPlayersList.length : effectivePlayerCount} <span className="text-xs font-semibold text-slate-500">/ {maxP ?? '—'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    disabled={cancelPending || cancelConfirming}
                    className="w-full sm:w-1/2 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-4 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 text-center"
                  >
                    Keep Room Open
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={cancelPending || cancelConfirming}
                    className="w-full sm:w-1/2 inline-flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs transition-all hover:brightness-105 active:scale-[0.99] cursor-pointer disabled:opacity-60 text-center"
                    style={{ background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)' }}
                  >
                    {cancelPending || cancelConfirming ? (
                      <>
                        <Loader2 size={14} className="animate-spin shrink-0" />
                        <span>Confirming...</span>
                      </>
                    ) : (
                      <span>Yes, Cancel & Refund</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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

          {/* Score & Anti-Cheat Status */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>Your score</span>
              {lostFocusThisQuestion && !answered && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                  <AlertTriangle size={10} className="text-amber-600" />
                  <span>Tab switch: Bonus capped</span>
                </span>
              )}
            </div>
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
              const revealedCorrectIdx = answered ? resolveRevealedCorrectIndex(currentQ) : -1
              const isCorrect = answered && i === revealedCorrectIdx
              const isWrong = answered && isSelected && !isCorrect

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
                  onContextMenu={(e) => e.preventDefault()}
                  className={`group relative flex items-center gap-3.5 w-full rounded-2xl p-4 text-left text-sm font-medium transition-all duration-150 select-none ${btnStyle}`}
                  style={{
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold transition-colors select-none ${badgeStyle}`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className={`flex-1 leading-snug break-words text-balance select-none ${textStyle}`}>{opt}</span>
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
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-xl shadow-2xs">
                            <span className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] sm:text-[10px] font-black leading-none shrink-0 shadow-2xs">
                              ✓
                            </span>
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
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-xl shadow-2xs">
                                  <span className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] sm:text-[10px] font-black leading-none shrink-0 shadow-2xs">
                                    ✓
                                  </span>
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
