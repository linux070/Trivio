import { useState, useEffect, useRef, startTransition } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Clock, Trophy, Copy, Check, Link2, Users, Loader2, Zap } from 'lucide-react'
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
      const t = setTimeout(() => advanceQuestion(qIndex, questions), 2500)
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

    setTimeout(() => advanceQuestion(qIndex, questions), 2500)
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
                  {isWrongChain ? 'Switch to Arc' : startPending || startConfirming ? 'Starting...' : 'Start Game'}
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

          {/* Options Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {currentQ.options.map((opt, i) => {
              const isSelected = selectedIndex === i
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAnswer(i)}
                  disabled={answered}
                  className={`group relative flex items-center gap-3.5 w-full rounded-2xl p-4 text-left text-sm font-medium transition-all duration-150 ${
                    !answered
                      ? 'bg-white/80 hover:bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-sm cursor-pointer'
                      : isSelected
                      ? 'bg-white border-slate-900 ring-1 ring-slate-900/10 shadow-sm text-slate-900 font-semibold cursor-default'
                      : 'bg-white/30 border border-slate-200/40 text-slate-400 opacity-40 cursor-default'
                  }`}
                  style={{
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  }}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold transition-colors ${
                      !answered
                        ? 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800'
                        : isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100/60 text-slate-400'
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 leading-snug truncate">{opt}</span>
                </button>
              )
            })}
          </div>

          {/* Ultra-Clean Modern Resolution Strip */}
          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-3 sm:p-3.5 backdrop-blur-xl shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                {/* Left: Clear Status Badge & Answer Reveal */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
                  {lastCorrect ? (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white tracking-wide shrink-0 shadow-2xs">
                      Correct
                    </span>
                  ) : selectedIndex === null ? (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white tracking-wide shrink-0 shadow-2xs">
                      Time's Up
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white tracking-wide shrink-0 shadow-2xs">
                      Wrong
                    </span>
                  )}

                  {!lastCorrect && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                      <span className="text-slate-500 font-medium shrink-0">Correct:</span>
                      <span className="font-bold font-mono text-slate-900 bg-white border border-slate-200/90 px-2 py-0.5 rounded-md shadow-2xs">
                        Option {String.fromCharCode(65 + currentQ.correctIndex)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Score Delta (Matches exact added score) */}
                {lastCorrect && lastPts !== null && (
                  <div className="flex items-center gap-1 font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg self-end sm:self-center shrink-0 shadow-2xs">
                    +{lastPts} pts
                  </div>
                )}
              </div>

              {/* Hairline countdown timer */}
              <div className="mt-3 h-0.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-slate-900/40 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 2.5, ease: 'linear' }}
                />
              </div>
            </motion.div>
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
