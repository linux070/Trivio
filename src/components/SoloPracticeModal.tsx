import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Zap, Trophy } from 'lucide-react'
import { getQuestions, type Category, type TriviaQuestion, CATEGORY_GROUPS } from '@/lib/questions'

interface SoloPracticeModalProps {
  category: Category
  isOpen: boolean
  onClose: () => void
  onPlayMultiplayer: (category: Category) => void
}

const PRACTICE_TIME = 10
const TOTAL_QUESTIONS = 5

export default function SoloPracticeModal({
  category,
  isOpen,
  onClose,
  onPlayMultiplayer,
}: SoloPracticeModalProps) {
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(PRACTICE_TIME)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [lastPts, setLastPts] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const answerStartRef = useRef(0)

  const subInfo = CATEGORY_GROUPS.flatMap(g => g.subcategories).find(s => s.id === category)

  // Start fresh practice game whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const qs = getQuestions(category, TOTAL_QUESTIONS)
      setQuestions(qs)
      setQIndex(0)
      setTimeLeft(PRACTICE_TIME)
      setSelectedIndex(null)
      setAnswered(false)
      setScore(0)
      setLastPts(null)
      setCorrectCount(0)
      setIsFinished(false)
      answerStartRef.current = Date.now()
    }
  }, [isOpen, category])

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isFinished || answered || questions.length === 0) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleTimeOut()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen, isFinished, answered, qIndex, questions])

  const handleTimeOut = () => {
    setAnswered(true)
    setSelectedIndex(-1)
    setLastPts(null)
    setTimeout(() => advanceQuestion(qIndex), 2500)
  }

  const advanceQuestion = (currentIdx: number) => {
    const next = currentIdx + 1
    if (next >= questions.length) {
      setIsFinished(true)
    } else {
      setQIndex(next)
      setTimeLeft(PRACTICE_TIME)
      setSelectedIndex(null)
      setAnswered(false)
      setLastPts(null)
      answerStartRef.current = Date.now()
    }
  }

  const handleAnswer = (idx: number) => {
    if (answered || isFinished) return
    if (timerRef.current) clearInterval(timerRef.current)

    const q = questions[qIndex]
    const elapsed = Date.now() - answerStartRef.current
    setSelectedIndex(idx)
    setAnswered(true)

    if (idx === q.correctIndex) {
      const pts = Math.max(20, 100 - Math.floor((elapsed / 1000) * 8))
      setScore(s => s + pts)
      setLastPts(pts)
      setCorrectCount(c => c + 1)
    } else {
      setLastPts(null)
    }

    setTimeout(() => advanceQuestion(qIndex), 2500)
  }

  const restartPractice = () => {
    const qs = getQuestions(category, TOTAL_QUESTIONS)
    setQuestions(qs)
    setQIndex(0)
    setTimeLeft(PRACTICE_TIME)
    setSelectedIndex(null)
    setAnswered(false)
    setScore(0)
    setLastPts(null)
    setCorrectCount(0)
    setIsFinished(false)
    answerStartRef.current = Date.now()
  }

  if (!isOpen) return null

  const currentQ = questions[qIndex]
  const timeFraction = timeLeft / PRACTICE_TIME

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200/90 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                <Zap size={20} className="fill-current" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Solo Practice
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {subInfo?.emoji} {subInfo?.name ?? category} · 5 speed questions
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body Content */}
          {!isFinished && currentQ ? (
            <div className="pt-4 space-y-4">
              {/* Progress & Timer bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">
                    Question {qIndex + 1} of {TOTAL_QUESTIONS}
                  </span>
                  <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                    <Clock size={13} className={timeFraction < 0.35 ? 'text-rose-500 animate-pulse' : 'text-slate-400'} />
                    <span className={timeFraction < 0.35 ? 'text-rose-600 font-bold' : ''}>
                      {timeLeft}s
                    </span>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      timeFraction < 0.35 ? 'bg-rose-500' : 'bg-violet-600'
                    }`}
                    animate={{ width: `${timeFraction * 100}%` }}
                    transition={{ duration: 0.3, ease: 'linear' }}
                  />
                </div>
              </div>

              {/* Question Text */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 min-h-[72px] flex items-center">
                <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  {currentQ.question}
                </p>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedIndex === idx
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={answered}
                      onClick={() => handleAnswer(idx)}
                      className={`group relative flex items-center gap-3 w-full p-3 sm:p-3.5 rounded-2xl text-left text-xs sm:text-sm font-medium transition-all duration-150 ${
                        !answered
                          ? 'bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 hover:shadow-xs cursor-pointer text-slate-800'
                          : isSelected
                          ? 'bg-white border-slate-900 ring-1 ring-slate-900/10 shadow-xs text-slate-900 font-semibold cursor-default'
                          : 'bg-slate-50/50 border border-slate-200/40 text-slate-400 opacity-40 cursor-default'
                      }`}
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
                        {String.fromCharCode(65 + idx)}
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
                  className="mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-3 sm:p-3.5 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-2.5">
                    {/* Left: Clear Status Badge & Answer Reveal */}
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {selectedIndex === currentQ.correctIndex ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white tracking-wide shrink-0 shadow-2xs">
                          Correct
                        </span>
                      ) : selectedIndex === -1 ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white tracking-wide shrink-0 shadow-2xs">
                          Time's Up
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white tracking-wide shrink-0 shadow-2xs">
                          Wrong
                        </span>
                      )}

                      {selectedIndex !== currentQ.correctIndex && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                          <span className="text-slate-500 font-medium shrink-0">Correct:</span>
                          <span className="font-bold font-mono text-slate-900 bg-white border border-slate-200/90 px-2 py-0.5 rounded-md shadow-2xs">
                            Option {String.fromCharCode(65 + currentQ.correctIndex)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Exact Points Added */}
                    {selectedIndex === currentQ.correctIndex && lastPts !== null && (
                      <div className="flex items-center gap-1 font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg self-end sm:self-center shrink-0 shadow-2xs">
                        +{lastPts} pts
                      </div>
                    )}
                  </div>

                  {/* Hairline countdown timer */}
                  <div className="mt-2.5 h-0.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-slate-900/40 rounded-full"
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 2.5, ease: 'linear' }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Score strip */}
              <div className="flex items-center justify-between pt-2.5 text-xs font-medium text-slate-500 border-t border-slate-100">
                <span>Score</span>
                <span className="text-slate-900 font-mono font-bold text-sm">{score} pts</span>
              </div>
            </div>
          ) : (
            /* Finished Recap */
            <div className="pt-6 pb-2 text-center space-y-4">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-500 shadow-sm">
                <Trophy size={32} />
              </div>

              <div>
                <h4 className="text-xl font-bold text-slate-900 tracking-tight">Practice Complete!</h4>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  You scored <strong className="text-slate-900 font-bold">{score} points</strong> ({correctCount} out of {TOTAL_QUESTIONS})
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={restartPractice}
                  className="flex items-center justify-center rounded-xl py-3 px-4 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-all active:scale-95 cursor-pointer"
                >
                  <span>Try Again</span>
                </button>

                <button
                  onClick={() => {
                    onClose()
                    onPlayMultiplayer(category)
                  }}
                  className="flex items-center justify-center rounded-xl py-3 px-4 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>Play for USDC</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
