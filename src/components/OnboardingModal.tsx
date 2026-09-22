import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  getDiceBearAvatarUrl,
  saveUserProfile,
  getDefaultProfileSuggestions,
  type UserProfile,
} from '@/lib/userProfile'

interface OnboardingModalProps {
  open: boolean
  address?: string
  provider?: string
  onComplete: (profile: UserProfile) => void
}

const STYLES = ['bottts-neutral', 'thumbs', 'fun-emoji', 'shapes', 'adventurer']

export default function OnboardingModal({ open, address, provider, onComplete }: OnboardingModalProps) {
  const suggestions = getDefaultProfileSuggestions(address, provider)

  const [username, setUsername] = useState(suggestions.username)
  const [styleIndex, setStyleIndex] = useState(0)
  const [seed, setSeed] = useState(suggestions.seed)
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentStyle = STYLES[styleIndex % STYLES.length]
  const displayedAvatarUrl = customAvatarUrl || getDiceBearAvatarUrl(currentStyle, seed)

  const handleRandomizeAvatar = () => {
    setCustomAvatarUrl(null)
    setStyleIndex(prev => (prev + 1) % STYLES.length)
    setSeed('p_' + Math.random().toString(36).substring(2, 8))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const size = 180
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (ctx) {
            const minDim = Math.min(img.width, img.height)
            const sx = (img.width - minDim) / 2
            const sy = (img.height - minDim) / 2
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
            const compressed = canvas.toDataURL('image/jpeg', 0.88)
            setCustomAvatarUrl(compressed)
            toast.success('Avatar uploaded!')
          } else {
            setCustomAvatarUrl(dataUrl)
          }
        } catch {
          setCustomAvatarUrl(dataUrl)
        }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const clean = username.trim().replace(/^@/, '') || suggestions.username
    const profile: UserProfile = {
      username: clean,
      avatarUrl: displayedAvatarUrl,
      avatarSeed: seed,
      avatarStyle: customAvatarUrl ? 'custom' : currentStyle,
      createdAt: Date.now(),
    }
    saveUserProfile(profile)
    onComplete(profile)
  }

  const handleSkip = () => {
    const profile: UserProfile = {
      username: suggestions.username,
      avatarUrl: getDiceBearAvatarUrl('bottts-neutral', suggestions.seed),
      avatarSeed: suggestions.seed,
      avatarStyle: 'bottts-neutral',
      createdAt: Date.now(),
    }
    saveUserProfile(profile)
    onComplete(profile)
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        <motion.div
          key="onboarding-card"
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[360px] rounded-2xl bg-white p-6 shadow-2xl border border-gray-100"
          style={{
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={handleSkip}
            className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>

          {/* Header */}
          <div className="mb-5 text-center">
            <h2 className="text-base font-semibold text-gray-900">
              Create your profile
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Set a display name and avatar for games
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar Section */}
            <div className="flex flex-col items-center">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="relative group/avatar flex flex-col items-center">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-20 w-20 cursor-pointer rounded-full bg-gray-50 ring-1 ring-gray-200 hover:ring-purple-400 transition-all p-0.5 active:scale-95"
                >
                  <img
                    src={displayedAvatarUrl}
                    alt="Avatar"
                    className="h-full w-full rounded-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm border border-gray-200 hover:text-purple-600 hover:border-purple-200 transition-colors"
                    aria-label="Upload your own pfp"
                  >
                    <ImageIcon size={11} />
                  </button>
                </div>

                {/* Tooltip on hover */}
                <div className="pointer-events-none absolute -bottom-7 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150 z-20 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white shadow-md">
                  Upload your own pfp
                </div>
              </div>

              {/* Randomize avatar button */}
              <button
                type="button"
                onClick={handleRandomizeAvatar}
                className="mt-2 text-[11px] font-medium text-purple-600 hover:text-purple-700 transition-colors"
              >
                Randomize avatar
              </button>
            </div>

            {/* Username Input */}
            <div className="space-y-1">
              <label htmlFor="trivio-username-input" className="block text-xs font-medium text-gray-700">
                Username
              </label>
              <div className="relative flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors focus-within:border-purple-500">
                <span className="text-xs font-medium text-gray-400 select-none mr-1">@</span>
                <input
                  id="trivio-username-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
                  placeholder="username"
                  maxLength={16}
                  className="w-full bg-transparent text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  required
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 pt-0.5">
                <span>Letters, numbers, underscores</span>
                <span>{username.length}/16</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                className="w-full h-9 flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-xs font-medium text-white transition-all shadow-xs active:scale-[0.99]"
              >
                Continue
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-center text-xs font-medium text-gray-400 hover:text-gray-600 py-1 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}


