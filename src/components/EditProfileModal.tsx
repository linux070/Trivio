import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Upload, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  getDiceBearAvatarUrl,
  saveUserProfile,
  getDefaultProfileSuggestions,
  DICEBEAR_STYLES,
  isReservedUsername,
  validateUsername,
  type UserProfile,
} from '@/lib/userProfile'
import { useCheckUsernameAvailable } from '@/hooks/useTrivioProfileRegistry'

interface EditProfileModalProps {
  open: boolean
  initialProfile: UserProfile | null
  onClose: () => void
  onComplete: (profile: UserProfile) => void
}

export default function EditProfileModal({
  open,
  initialProfile,
  onClose,
  onComplete,
}: EditProfileModalProps) {
  const defaults = getDefaultProfileSuggestions()
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarSeed, setAvatarSeed] = useState('')
  const [avatarStyle, setAvatarStyle] = useState('bottts-neutral')
  const [isCustom, setIsCustom] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cleanUsername = username.trim().replace(/^@/, '')
  const isReserved = isReservedUsername(cleanUsername)
  const { data: isAvailableOnchain } = useCheckUsernameAvailable(cleanUsername)
  const isTaken = Boolean(
    !isReserved &&
    cleanUsername.length >= 2 &&
    cleanUsername.toLowerCase() !== initialProfile?.username?.toLowerCase() &&
    isAvailableOnchain === false
  )

  useEffect(() => {
    if (open) {
      if (initialProfile) {
        setUsername(initialProfile.username || '')
        setAvatarUrl(initialProfile.avatarUrl || '')
        setAvatarSeed(initialProfile.avatarSeed || 'trivio')
        setAvatarStyle(initialProfile.avatarStyle || 'bottts-neutral')
        setIsCustom(initialProfile.avatarStyle === 'custom')
      } else {
        setUsername(defaults.username)
        setAvatarUrl(getDiceBearAvatarUrl(defaults.style, defaults.seed))
        setAvatarSeed(defaults.seed)
        setAvatarStyle(defaults.style)
        setIsCustom(false)
      }
    }
  }, [open, initialProfile])

  const handleRandomize = () => {
    const randomStyle = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)].id
    const newSeed = 'p_' + Math.random().toString(36).substring(2, 9)
    const newUrl = getDiceBearAvatarUrl(randomStyle, newSeed)
    setAvatarStyle(randomStyle)
    setAvatarSeed(newSeed)
    setAvatarUrl(newUrl)
    setIsCustom(false)
  }

  const handleSelectStyle = (styleId: string) => {
    const newUrl = getDiceBearAvatarUrl(styleId, avatarSeed || 'trivio')
    setAvatarStyle(styleId)
    setAvatarUrl(newUrl)
    setIsCustom(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (!dataUrl) return

      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const size = 120
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (ctx) {
            const minDim = Math.min(img.width, img.height)
            const sx = (img.width - minDim) / 2
            const sy = (img.height - minDim) / 2
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
            const compressed = canvas.toDataURL('image/jpeg', 0.82)
            setAvatarUrl(compressed)
            setIsCustom(true)
            toast.success('Avatar uploaded!')
          } else {
            setAvatarUrl(dataUrl)
            setIsCustom(true)
          }
        } catch {
          setAvatarUrl(dataUrl)
          setIsCustom(true)
        }
      }
      img.onerror = () => {
        toast.error('Failed to load image')
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanUsername = username.trim().replace(/^@/, '') || initialProfile?.username || defaults.username
    const validation = validateUsername(cleanUsername)

    if (!validation.valid) {
      toast.error(validation.error || 'Invalid username')
      return
    }

    if (isTaken) {
      toast.error('Username already taken.')
      return
    }

    const updated: UserProfile = {
      username: cleanUsername,
      avatarUrl: avatarUrl || initialProfile?.avatarUrl || getDiceBearAvatarUrl('bottts-neutral', 'trivio'),
      avatarSeed: avatarSeed || 'trivio',
      avatarStyle: isCustom ? 'custom' : avatarStyle,
      createdAt: initialProfile?.createdAt || Date.now(),
    }

    try {
      saveUserProfile(updated)
      toast.success('Profile updated!')
      onComplete(updated)
    } catch {
      toast.error('Could not save profile')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="edit-profile-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <motion.div
            key="edit-profile-modal"
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 shadow-2xl border border-gray-100"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <X size={15} />
            </button>

            <div className="mb-4 text-center">
              <h3 className="text-base font-bold text-gray-900 tracking-tight">Edit Profile</h3>
              <p className="text-xs text-gray-500 mt-0.5">Customize your username and avatar</p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Avatar Preview & Controls */}
              <div className="flex flex-col items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="relative mb-2.5">
                  <div className="h-20 w-20 rounded-2xl bg-purple-50 ring-2 ring-purple-100 p-0.5 shadow-sm overflow-hidden flex items-center justify-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="h-full w-full rounded-[14px] object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-purple-600">
                        {username ? username.slice(0, 1).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Avatar Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRandomize}
                    className="flex items-center gap-1.5 rounded-full bg-purple-50 hover:bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 transition-colors active:scale-95"
                  >
                    <Sparkles size={12} />
                    <span>Randomize</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors active:scale-95"
                  >
                    <Upload size={12} />
                    <span>Upload</span>
                  </button>
                </div>

                {/* Preset Style Selector */}
                <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
                  {DICEBEAR_STYLES.map((st) => {
                    const previewUrl = getDiceBearAvatarUrl(st.id, avatarSeed || 'trivio')
                    const isActive = !isCustom && avatarStyle === st.id
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleSelectStyle(st.id)}
                        className={`relative h-7 w-7 rounded-lg overflow-hidden border transition-all ${
                          isActive
                            ? 'border-purple-600 ring-2 ring-purple-500/20 scale-105'
                            : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-400'
                        }`}
                        title={st.label}
                      >
                        <img src={previewUrl} alt={st.label} className="h-full w-full object-cover" />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Username Input */}
              <div className="space-y-1">
                <label htmlFor="edit-username-input" className="block text-xs font-semibold text-gray-700">
                  Username
                </label>
                <div
                  className={`flex items-center rounded-xl border px-3 py-2 transition-all ${
                    isReservedUsername(username)
                      ? 'border-amber-400 bg-amber-50/30 focus-within:border-amber-500'
                      : 'border-gray-200 bg-gray-50/70 focus-within:border-purple-600 focus-within:bg-white'
                  }`}
                >
                  <span className="text-xs font-medium text-gray-400 mr-1 select-none">@</span>
                  <input
                    id="edit-username-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
                    placeholder="username"
                    maxLength={16}
                    className="w-full bg-transparent text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    required
                  />
                </div>

                {isReserved && (
                  <span className="text-[10px] font-medium text-amber-600 block leading-tight">
                    Username contains a reserved word.
                  </span>
                )}

                {isTaken && (
                  <span className="text-[10px] font-medium text-red-600 block leading-tight">
                    Username already taken.
                  </span>
                )}

                <div className="flex justify-between text-[10px] text-gray-400 pt-0.5 px-1">
                  <span>Letters, numbers, underscores</span>
                  <span>{username.length}/16</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-gray-100 hover:bg-gray-200 py-2.5 text-xs font-semibold text-gray-700 transition-colors active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReserved || isTaken}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:pointer-events-none text-xs font-bold text-white py-2.5 shadow-sm transition-all active:scale-98 cursor-pointer"
                >
                  <Check size={14} />
                  <span>Save</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
