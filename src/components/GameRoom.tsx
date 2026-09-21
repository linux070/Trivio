import { useState, useEffect, useRef, startTransition } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Clock, Trophy, Copy, Check, Link2 } from 'lucide-react'
import { buildJoinUrl } from '@/App'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import { useStartGame, useDeclareWinner, useRoomInfo, formatUSDCRaw } from '@/hooks/useTriviaContract'
import { getQuestions, type Category, type TriviaQuestion } from '@/lib/questions'
import { ARC_TESTNET_CHAIN_ID, TRIVIA_GAME_ADDRESS } from '@/config'

const QUESTION_TIME = 15

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
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [lastPts, setLastPts] = useState<number | null>(null)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const answerStartRef = useRef(0)

  const { data: roomInfo } = useRoomInfo(roomCode)
  type RoomTuple = readonly [`0x${string}`, bigint, bigint, number, number, number, `0x${string}`]
  const [_host, _buyIn, prizePool, _maxP, playerCount] = (roomInfo as RoomTuple) ?? []
  const prizeHuman = prizePool !== undefined ? formatUSDCRaw(prizePool) : '0'
  const isHost = address && roomInfo && (roomInfo)[0]?.toLowerCase() === address.toLowerCase()

  const { startGame, isPending: startPending, isConfirming: startConfirming, isSuccess: gameStarted } = useStartGame()
  const { declareWinner, isPending: declarePending, isConfirming: declareConfirming, isSuccess: declared, hash: declareHash } = useDeclareWinner()

  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID

  // When game starts onchain, move to playing phase
  useEffect(() => {
    if (!gameStarted) return
    toast.success('Game started!')
    const qs = getQuestions(category, 10)
    startTransition(() => {
      setQuestions(qs)
      setQIndex(0)
      setTimeLeft(QUESTION_TIME)
      setAnswered(false)
      setSelectedIndex(null)
      setScore(0)
      setPhase('playing')
    })
    answerStartRef.current = Date.now()
  }, [gameStarted, category])

  // Timer
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

  // Winner payout effect
  useEffect(() => {
    if (!declared || !address) return
    onGameEnd(address, prizeHuman, declareHash)
  }, [declared, address, prizeHuman, declareHash, onGameEnd])

  function advanceQuestion(currentIndex: number, qs: TriviaQuestion[]) {
    const next = currentIndex + 1
    if (next >= qs.length) {
      setPhase('finished')
    } else {
      setQIndex(next)
      setTimeLeft(QUESTION_TIME)
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
    if (!address || isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    declareWinner(roomCode, address)
  }

  const currentQ = questions[qIndex]

  // ─── Lobby phase ─────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="relative min-h-dvh overflow-hidden" style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}>
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '5%', left: '3%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.16) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-md px-3.5 pb-12 pt-5 sm:max-w-lg sm:px-6 sm:pt-6">
          <div className="mb-5 sm:mb-6 flex items-center gap-3">
            <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-70" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)' }}>
              <ArrowLeft size={16} style={{ color: 'var(--ink)' }} />
            </button>
            <div>
              <h1 className="display text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                Room <span style={{ color: 'var(--accent)' }}>{roomCode}</span>
              </h1>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>{category} · Waiting for host to start</p>
            </div>
          </div>

          <div className="mb-4 rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3">
              <div className="rounded-2xl p-3 text-center" style={glass.inner}>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>Players</p>
                <p className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                  {playerCount ?? '—'}<span className="text-base font-medium" style={{ color: 'var(--muted)' }}>/{_maxP ?? '—'}</span>
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

            {/* ── Modern Invite Players Box (Clean Slate Grey Theme) ── */}
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
                <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold">
                  <span className="text-slate-400 font-medium">ROOM</span>
                  <span className="font-mono font-bold tracking-wider text-slate-800">{roomCode}</span>
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
                <span className="flex-1 truncate font-mono text-xs text-slate-600 select-all">
                  {buildJoinUrl(roomCode)}
                </span>

                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(buildJoinUrl(roomCode))
                    setCopiedLink(true)
                    setTimeout(() => setCopiedLink(false), 2000)
                    toast.success('Invite link copied!')
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 active:scale-95 ${
                    copiedLink
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-[#122d45] hover:bg-slate-600 active:bg-slate-800'
                  }`}
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
              <p className="rounded-2xl px-4 py-3 text-center text-sm" style={{ ...glass.inner, color: 'var(--muted)' }}>
                Waiting for the host to start the game...
              </p>
            )}

            {/* Demo: play locally without contract */}
            {!TRIVIA_GAME_ADDRESS && (
              <button
                onClick={() => {
                  const qs = getQuestions(category, 10)
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
    const timeFraction = timeLeft / QUESTION_TIME
    return (
      <div className="relative min-h-dvh overflow-hidden" style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}>
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '3%', right: '3%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-md px-3.5 pb-12 pt-5 sm:max-w-lg sm:px-6 sm:pt-6">
          {/* Progress bar */}
          <div className="mb-4 sm:mb-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
                Q{qIndex + 1} of {questions.length} · <span className="font-semibold">{category}</span>
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
      <div className="relative min-h-dvh overflow-hidden" style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}>
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '5%', left: '3%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.2) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-md px-3.5 pb-12 pt-5 sm:max-w-lg sm:px-6 sm:pt-6">
          <div className="mb-5 sm:mb-6 flex items-center gap-3">
            <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-70" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)' }}>
              <ArrowLeft size={16} style={{ color: 'var(--ink)' }} />
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

          {!TRIVIA_GAME_ADDRESS && (
            <button
              onClick={() => onGameEnd(address ?? '0x0000000000000000000000000000000000000000', prizeHuman)}
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
