import { useState, useEffect, useRef, startTransition } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Clock, Trophy, Copy, Check, Link2, Users, Loader2 } from 'lucide-react'
import { buildJoinUrl } from '@/App'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import { useStartGame, useDeclareWinner, useRoomInfo, formatUSDCRaw } from '@/hooks/useTriviaContract'
import { getQuestions, type Category, type TriviaQuestion, CATEGORY_GROUPS } from '@/lib/questions'
import { getRoomCategory, getRoomDuration, saveActiveGame, clearActiveGame } from '@/lib/roomStorage'
import { ARC_TESTNET_CHAIN_ID, TRIVIA_GAME_ADDRESS } from '@/config'

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
  onGameEnd: (winnerAddress: string, prizeAmount: string, txHash?: string) => void
}

type GamePhase = 'lobby' | 'playing' | 'finished'

export default function GameRoom({ roomCode, category, onBack, onGameEnd }: GameRoomProps) {
  const { address: wagmiAddress, chainId } = useAccount()
  const { user } = usePrivy()
  const { switchChain } = useSwitchChain()

  const privyWalletAddress = user?.wallet?.address as `0x${string}` | undefined
  const activeAddress = wagmiAddress || privyWalletAddress || ''

  const resolvedCategory = category || getRoomCategory(roomCode) || 'General Knowledge'
  const roomDuration = getRoomDuration(roomCode, 15)

  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(roomDuration)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [lastPts, setLastPts] = useState<number | null>(null)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const answerStartRef = useRef(0)

  // Auto-polls onchain every 1.5s
  const { data: roomInfo, refetch: refetchRoomInfo } = useRoomInfo(roomCode, 1500)
  type RoomTuple = readonly [`0x${string}`, bigint, bigint, number, number, number, `0x${string}`]
  const [host, _buyIn, prizePool, maxP, playerCount, status, winner] = (roomInfo as RoomTuple) ?? []
  const prizeHuman = prizePool !== undefined ? formatUSDCRaw(prizePool) : '0'

  const isHost = Boolean(
    activeAddress && host && host.toLowerCase() === activeAddress.toLowerCase()
  )

  // Keep active game persisted for smooth resume/rejoin
  useEffect(() => {
    saveActiveGame(roomCode, resolvedCategory, isHost)
  }, [roomCode, resolvedCategory, isHost])

  const { startGame, isPending: startPending, isConfirming: startConfirming, isSuccess: gameStarted } = useStartGame()
  const { declareWinner, isPending: declarePending, isConfirming: declareConfirming, isSuccess: declared, hash: declareHash } = useDeclareWinner()

  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID

  // When game starts onchain (either via host tx confirmation OR polled status === 1), move all players to playing phase
  useEffect(() => {
    const isGameActive = gameStarted || status === 1
    if (isGameActive && phase === 'lobby') {
      toast.success('Game started!')
      const qs = getQuestions(resolvedCategory, 10, roomCode)
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
    }
  }, [gameStarted, status, phase, resolvedCategory, roomCode, roomDuration])

  // Timer for questions
  useEffect(() => {
    if (phase !== 'playing' || answered) return
    if (timeLeft <= 0) {
      startTransition(() => {
        setAnswered(true)
        setLastCorrect(false)
        setLastPts(null)
      })
      const t = setTimeout(() => advanceQuestion(qIndex, questions), 2000)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, phase, answered, qIndex, questions])

  // Winner payout synchronization (for host who triggered payout or guest receiving finished status)
  useEffect(() => {
    if (declared && activeAddress) {
      clearActiveGame()
      onGameEnd(activeAddress, prizeHuman, declareHash)
    } else if (status === 2 && winner && winner !== '0x0000000000000000000000000000000000000000' && phase === 'finished') {
      clearActiveGame()
      onGameEnd(winner, prizeHuman)
    }
  }, [declared, activeAddress, prizeHuman, declareHash, status, winner, phase, onGameEnd])

  function advanceQuestion(currentIndex: number, qs: TriviaQuestion[]) {
    const next = currentIndex + 1
    if (next >= qs.length) {
      setPhase('finished')
    } else {
      setQIndex(next)
      setTimeLeft(roomDuration)
      setAnswered(false)
      setSelectedIndex(null)
      setLastCorrect(null)
      setLastPts(null)
      answerStartRef.current = Date.now()
    }
  }

  const handleAnswer = (idx: number) => {
    if (answered) return
    const q = questions[qIndex]
    const elapsed = Date.now() - answerStartRef.current
    setSelectedIndex(idx)
    setAnswered(true)

    if (idx === q.correctIndex) {
      const pts = Math.max(10, 100 - Math.floor((elapsed / 1000) * 5))
      setScore(s => s + pts)
      setLastPts(pts)
      setLastCorrect(true)
    } else {
      setLastPts(null)
      setLastCorrect(false)
    }

    setTimeout(() => advanceQuestion(qIndex, questions), 1800)
  }

  const handleStartGame = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    startGame(roomCode)
  }

  const handleDeclareWinner = () => {
    if (!activeAddress || isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    declareWinner(roomCode, activeAddress as `0x${string}`)
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
                  {playerCount ?? '—'}<span className="text-base font-medium" style={{ color: 'var(--muted)' }}>/{maxP ?? '—'}</span>
                </p>
              </div>
              <div className="rounded-2xl p-3 text-center" style={glass.inner}>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>Prize Pool</p>
                <div className="flex items-center justify-center gap-1">
                  <TokenUSDC variant="branded" size={16} />
                  <p className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{prizeHuman}</p>
                </div>
              </div>
            </div>

            {/* ── Modern Invite Players Box (Slim, Clean Theme) ── */}
            <div
              className="mb-4 overflow-hidden rounded-2xl p-3.5 transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.95) 100%)',
                border: '1px solid rgba(226,232,240,0.95)',
                boxShadow: '0 4px 16px -2px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,1)',
              }}
            >
              {/* Header row */}
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-200 text-slate-700">
                    <Link2 size={12} />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Invite Players
                  </span>
                </div>
              </div>

              {/* Integrated modern input container */}
              <div
                className="flex items-center gap-2 rounded-xl p-1.5 pl-3 transition-all"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(226, 232, 240, 1)',
                  boxShadow: '0 2px 6px -2px rgba(15, 23, 42, 0.04), inset 0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <span className="flex-1 min-w-0 truncate font-mono text-xs text-slate-600 select-all">
                  {buildJoinUrl(roomCode, resolvedCategory)}
                </span>

                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(buildJoinUrl(roomCode, resolvedCategory))
                    setCopiedLink(true)
                    setTimeout(() => setCopiedLink(false), 2000)
                    toast.success('Invite link copied!')
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-all duration-150 active:scale-95 bg-[#7c3aed] hover:bg-[#6d28d9] active:bg-[#5b21b6]"
                >
                  {copiedLink ? <Check size={13} className="stroke-[2.5]" /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {!TRIVIA_GAME_ADDRESS && (
              <p className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}>
                Contract not deployed — playing in demo mode.
              </p>
            )}

            {isHost && (
              <>
                {(startPending || startConfirming) && (
                  <p className="mb-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
                    {startPending ? 'Confirm in wallet...' : 'Starting game onchain...'}
                  </p>
                )}
                <button
                  onClick={handleStartGame}
                  disabled={startPending || startConfirming}
                  className="w-full rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {isWrongChain ? 'Switch to Arc Testnet' : startPending || startConfirming ? 'Starting...' : 'Start Game'}
                </button>
              </>
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
                  setTimeLeft(QUESTION_TIME)
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
          <AnimatePresence mode="wait">
            <motion.div
              key={qIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="mb-4 sm:mb-5 rounded-2xl sm:rounded-3xl p-4 sm:p-6"
              style={glass.card}
            >
              <p className="text-sm sm:text-base font-semibold leading-relaxed text-balance" style={{ color: 'var(--ink)' }}>
                {currentQ.question}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Options */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {currentQ.options.map((opt, i) => {
              const isSelected = selectedIndex === i
              const isAnswerCorrect = i === currentQ.correctIndex
              let bg = 'rgba(255,255,255,0.64)'
              let border = '1px solid rgba(255,255,255,0.68)'
              let textColor = 'var(--ink)'
              if (answered) {
                if (isAnswerCorrect) { bg = 'rgba(26,128,71,0.12)'; border = '1px solid rgba(26,128,71,0.35)'; textColor = 'var(--success)' }
                else if (isSelected) { bg = 'rgba(186,43,76,0.1)'; border = '1px solid rgba(186,43,76,0.3)'; textColor = 'var(--danger)' }
              }
              return (
                <motion.button
                  key={i}
                  whileTap={!answered ? { scale: 0.98 } : {}}
                  onClick={() => handleAnswer(i)}
                  disabled={answered}
                  className="w-full rounded-2xl px-5 py-4 text-left text-sm font-semibold transition-all hover:shadow-md disabled:cursor-default"
                  style={{
                    background: bg,
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border,
                    boxShadow: '0 2px 12px rgba(18,45,69,0.06)',
                    color: textColor,
                  }}
                >
                  <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'rgba(18,45,69,0.07)', color: 'var(--muted)' }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </motion.button>
              )
            })}
          </div>

          {answered && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center text-sm font-semibold"
              style={{ color: lastCorrect ? 'var(--success)' : 'var(--danger)' }}
            >
              {lastCorrect
                ? `+${lastPts ?? 0} pts — Correct!`
                : selectedIndex === null
                  ? 'Time is up!'
                  : `Wrong — ${currentQ.options[currentQ.correctIndex]}`}
            </motion.p>
          )}
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

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-4 rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-center" style={glass.card}>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.1em' }}>Your Score</p>
            <p className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>{score}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>pts across {questions.length} questions</p>

            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl py-3" style={glass.inner}>
              <TokenUSDC variant="branded" size={18} />
              <span className="text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{prizeHuman}</span>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>USDC prize pool</span>
            </div>
          </motion.div>

          {isHost && TRIVIA_GAME_ADDRESS && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {(declarePending || declareConfirming) && (
                <p className="mb-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  {declarePending ? 'Confirm in wallet...' : 'Sending USDC payout...'}
                </p>
              )}
              <button
                onClick={handleDeclareWinner}
                disabled={declarePending || declareConfirming}
                className="w-full rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {isWrongChain ? 'Switch to Arc Testnet' : declarePending || declareConfirming ? 'Sending payout...' : 'Declare Winner & Pay Out'}
              </button>
            </motion.div>
          )}

          {!isHost && TRIVIA_GAME_ADDRESS && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 text-center" style={glass.inner}>
              <div className="flex items-center justify-center gap-2 mb-1 text-purple-700">
                <Loader2 size={16} className="animate-spin" />
                <p className="text-sm font-bold">Game Completed!</p>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Waiting for host to finalize the game and distribute the prize...
              </p>
            </motion.div>
          )}

          {!TRIVIA_GAME_ADDRESS && (
            <button
              onClick={() => {
                clearActiveGame()
                onGameEnd(activeAddress || '0x0000000000000000000000000000000000000000', prizeHuman)
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
