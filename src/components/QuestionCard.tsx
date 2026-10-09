import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export interface QuestionCardProps {
  question: string
  category?: string
  qIndex?: number
  totalQuestions?: number
  className?: string
  layoutKey?: string | number
}

/**
 * Strips raw AI-style prefixes like "🔥 HOT POTATO: " or "⚡ SPEED: " so question text is clean and natural.
 */
export function cleanQuestionText(rawQuestion: string) {
  if (!rawQuestion) return ''
  const trimmed = rawQuestion.trim()
  return trimmed.replace(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}\s]*[A-Za-z0-9\s_-]{2,25}):\s*/u, '').trim() || trimmed
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  className = '',
  layoutKey,
}) => {
  const cleanQuestion = cleanQuestionText(question)

  const handleCopyAttempt = (e: React.SyntheticEvent) => {
    e.preventDefault()
    toast.info('📋 Text copying disabled', {
      description: 'Questions cannot be copied to ensure fair play.',
      duration: 2500,
    })
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={layoutKey ?? cleanQuestion}
        initial={{ opacity: 0, y: 6, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.99 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onContextMenu={(e) => e.preventDefault()}
        onCopy={handleCopyAttempt}
        onCut={handleCopyAttempt}
        onDragStart={(e) => e.preventDefault()}
        className={`relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white/95 p-4 sm:p-5 md:p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] backdrop-blur-xl ring-1 ring-slate-900/[0.02] select-none ${className}`}
        style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
      >
        {/* Clean Responsive Question Statement */}
        <div className="min-h-[44px] sm:min-h-[56px] flex items-center select-none pointer-events-auto">
          <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 leading-snug sm:leading-relaxed text-balance break-words hyphens-auto w-full select-none">
            {cleanQuestion}
          </h2>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
