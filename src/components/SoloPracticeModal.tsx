import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Zap, Trophy, CheckCircle2, XCircle } from 'lucide-react'
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
    setTimeout(() => advanceQuestion(qIndex), 1500)
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
      setCorrectCount(c => c + 1)
    }

    setTimeout(() => advanceQuestion(qIndex), 1400)
  }

  const restartPractice = () => {
    const qs = getQuestions(category, TOTAL_QUESTIONS)
    setQuestions(qs)
    setQIndex(0)
    setTimeLeft(PRACTICE_TIME)
    setSelectedIndex(null)
    setAnswered(false)
    setScore(0)
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

              {/* Options */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                {currentQ.options.map((opt, idx) => {
                  let btnStyle = 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800'
                  let icon = null

                  if (answered) {
                    if (idx === currentQ.correctIndex) {
                      btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                      icon = <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    } else if (idx === selectedIndex) {
                      btnStyle = 'bg-rose-50 border-rose-500 text-rose-950 font-bold shadow-xs'
                      icon = <XCircle size={16} className="text-rose-600 shrink-0" />
                    } else {
                      btnStyle = 'opacity-50 border-slate-200 bg-slate-50 text-slate-400'
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={answered}
                      onClick={() => handleAnswer(idx)}
                      className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:cursor-default ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {icon}
                    </button>
                  )
                })}
              </div>

              {/* Score strip */}
              <div className="flex items-center justify-between pt-2 text-xs font-medium text-slate-500 border-t border-slate-100">
                <span>Score: <strong className="text-slate-900 font-mono font-bold">{score} pts</strong></span>
                <span>Accuracy: <strong className="text-slate-900 font-mono font-bold">{correctCount}/{qIndex + (answered ? 1 : 0)}</strong></span>
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
                  You scored <strong className="text-slate-900 font-bold">{score} points</strong> ({correctCount} of {TOTAL_QUESTIONS} correct)
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
