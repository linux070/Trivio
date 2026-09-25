import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Image as ImageIcon, AlertCircle, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getDiceBearAvatarUrl,
  saveUserProfile,
  getDefaultProfileSuggestions,
  isReservedUsername,
  validateUsername,
  type UserProfile,
} from '@/lib/userProfile'
import { useSetOnchainProfile, useCheckUsernameAvailable } from '@/hooks/useTrivioProfileRegistry'

interface OnboardingModalProps {
  open: boolean
  address?: string
  provider?: string
  initialProfile?: UserProfile | null
  isEditing?: boolean
  onClose?: () => void
  onComplete: (profile: UserProfile) => void
}

const STYLES = ['bottts-neutral', 'thumbs', 'fun-emoji', 'shapes', 'adventurer']

export default function OnboardingModal({
  open,
  address,
  provider,
  initialProfile,
  isEditing = false,
  onClose,
  onComplete,
}: OnboardingModalProps) {
  const suggestions = getDefaultProfileSuggestions(address, provider)

  const [username, setUsername] = useState(initialProfile?.username || suggestions.username)
  const [styleIndex, setStyleIndex] = useState(0)
  const [seed, setSeed] = useState(initialProfile?.avatarSeed || suggestions.seed)
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(
    initialProfile?.avatarStyle === 'custom' ? initialProfile.avatarUrl : null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { setProfile: setOnchainProfile } = useSetOnchainProfile()

  const cleanUsername = username.trim().replace(/^@/, '')
  const isReserved = isReservedUsername(cleanUsername)
  const { data: isAvailableOnchain, isLoading: isCheckingOnchain } = useCheckUsernameAvailable(cleanUsername)

  // Re-sync with initialProfile if opened
  const lastOpenRef = useRef(open)
  if (open && !lastOpenRef.current) {
    if (initialProfile) {
      setUsername(initialProfile.username)
      setSeed(initialProfile.avatarSeed || suggestions.seed)
      setCustomAvatarUrl(initialProfile.avatarStyle === 'custom' ? initialProfile.avatarUrl : null)
    }
  }
  lastOpenRef.current = open

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
    const validation = validateUsername(clean)

    if (!validation.valid) {
      toast.error(validation.error || 'Invalid username')
      return
    }

    if (isAvailableOnchain === false) {
      toast.error('Username already taken.')
      return
    }

    const profile: UserProfile = {
      username: clean,
      avatarUrl: displayedAvatarUrl,
      avatarSeed: seed,
      avatarStyle: customAvatarUrl ? 'custom' : currentStyle,
      createdAt: Date.now(),
    }

    saveUserProfile(profile, address)

    // Trigger onchain username registration on Arc
    if (address && address.startsWith('0x') && address.length === 42 && address !== '0x0000000000000000000000000000000000000000') {
      try {
        setOnchainProfile(profile.username, profile.avatarUrl, profile.avatarSeed, profile.avatarStyle)
        toast.info('Claiming username on Arc blockchain...')
      } catch (err) {
        console.warn('Onboarding onchain profile submission:', err)
      }
    }

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

    saveUserProfile(profile, address)

    if (address && address.startsWith('0x') && address.length === 42 && address !== '0x0000000000000000000000000000000000000000') {
      try {
        setOnchainProfile(profile.username, profile.avatarUrl, profile.avatarSeed, profile.avatarStyle)
      } catch (err) {
        console.warn('Onboarding skip onchain registration:', err)
      }
    }

    onComplete(profile)
  }

  return (
    <AnimatePresence>
      {open && (
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
              onClick={() => (onClose ? onClose() : handleSkip())}
              className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X size={15} />
            </button>

            {/* Header */}
            <div className="mb-5 text-center">
              <h2 className="text-base font-semibold text-gray-900">
                {isEditing ? 'Edit profile' : 'Create your profile'}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {isEditing ? 'Update your display name and avatar' : 'Set a display name and avatar for games'}
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
                <div
                  className={`relative flex items-center rounded-xl border bg-white px-3 py-2 transition-colors ${
                    isReserved
                      ? 'border-amber-400 focus-within:border-amber-500 bg-amber-50/20'
                      : cleanUsername.length >= 2 && isAvailableOnchain === false
                      ? 'border-red-300 focus-within:border-red-500 bg-red-50/20'
                      : 'border-gray-200 focus-within:border-purple-500'
                  }`}
                >
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
                  {isCheckingOnchain && cleanUsername.length >= 2 && !isReserved && (
                    <Loader2 size={13} className="animate-spin text-gray-400 shrink-0 ml-1" />
                  )}
                </div>

                {/* Reserved Name Warning */}
                {isReserved && (
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200/90 px-2.5 py-1.5 text-[11px] text-amber-800 leading-tight"
                  >
                    <AlertCircle size={13} className="shrink-0 text-amber-600 mt-0.5" />
                    <span>Username contains a reserved word.</span>
                  </motion.div>
                )}

                {/* Already Taken Onchain Warning */}
                {!isReserved && cleanUsername.length >= 2 && isAvailableOnchain === false && (
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-200/90 px-2.5 py-1.5 text-[11px] text-red-700 leading-tight"
                  >
                    <AlertCircle size={13} className="shrink-0 text-red-500 mt-0.5" />
                    <span>Username already taken.</span>
                  </motion.div>
                )}

                {/* Available Onchain Badge */}
                {!isReserved && cleanUsername.length >= 2 && isAvailableOnchain === true && (
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 text-[11px] text-emerald-700"
                  >
                    <Check size={12} className="shrink-0 text-emerald-600 stroke-[2.5]" />
                    <span>Username available onchain</span>
                  </motion.div>
                )}

                <div className="flex justify-between text-[11px] text-gray-400 pt-0.5">
                  <span>Letters, numbers, underscores</span>
                  <span>{username.length}/16</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isReserved || (cleanUsername.length >= 2 && isAvailableOnchain === false)}
                  className="w-full h-9 flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:pointer-events-none text-xs font-medium text-white transition-all shadow-xs active:scale-[0.99] cursor-pointer"
                >
                  {isEditing ? 'Save changes' : 'Continue & Register'}
                </button>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="w-full text-center text-xs font-medium text-gray-400 hover:text-gray-600 py-1 transition-colors cursor-pointer"
                  >
                    Skip for now
                  </button>
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => (onClose ? onClose() : handleSkip())}
                    className="w-full text-center text-xs font-medium text-gray-400 hover:text-gray-600 py-1 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


