import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Image as ImageIcon, Camera, AlertCircle, Check, Loader2, Dices, Sparkles, ShieldCheck, Copy, ExternalLink } from 'lucide-react'
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

type OnboardingStep = 'form' | 'submitting' | 'success' | 'error'

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
  const [step, setStep] = useState<OnboardingStep>('form')
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [copied, setCopied] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoRedirectTimerRef = useRef<NodeJS.Timeout | null>(null)

  const {
    setProfile: setOnchainProfile,
    isPending: isOnchainPending,
    isConfirming: isOnchainConfirming,
    isSuccess: isOnchainSuccess,
    error: onchainError,
    reset: resetOnchainTx,
  } = useSetOnchainProfile()

  const cleanUsername = username.trim().replace(/^@/, '')
  const isReserved = isReservedUsername(cleanUsername)
  const { data: isAvailableOnchain, isLoading: isCheckingOnchain } = useCheckUsernameAvailable(cleanUsername)

  // Re-sync with fresh suggestions or initialProfile whenever modal opens or active account changes
  useEffect(() => {
    if (open) {
      setStep('form')
      setPendingProfile(null)
      if (initialProfile) {
        setUsername(initialProfile.username)
        setSeed(initialProfile.avatarSeed || suggestions.seed)
        setCustomAvatarUrl(initialProfile.avatarStyle === 'custom' ? initialProfile.avatarUrl : null)
      } else {
        const fresh = getDefaultProfileSuggestions(address, provider)
        setUsername(fresh.username)
        setSeed(fresh.seed)
        setStyleIndex(0)
        setCustomAvatarUrl(null)
      }
    }
  }, [open, address, initialProfile, provider])

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (autoRedirectTimerRef.current) {
        clearTimeout(autoRedirectTimerRef.current)
      }
    }
  }, [])

  // Watch onchain success state
  useEffect(() => {
    if (step === 'submitting' && isOnchainSuccess && pendingProfile) {
      setStep('success')
      toast.success('Username claimed on Arc Testnet!')
    }
  }, [step, isOnchainSuccess, pendingProfile])

  // Watch onchain error / rejection state
  useEffect(() => {
    if (step === 'submitting' && onchainError) {
      console.warn('Onchain profile error:', onchainError)
      setStep('error')
    }
  }, [step, onchainError])

  const currentStyle = STYLES[styleIndex % STYLES.length]
  const displayedAvatarUrl = customAvatarUrl || getDiceBearAvatarUrl(currentStyle, seed)

  const handleCopyAddress = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    toast.success('Wallet address copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRandomizeAvatar = () => {
    setIsRolling(true)
    setTimeout(() => setIsRolling(false), 400)
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
      toast.error('Username is already taken.')
      return
    }

    const profile: UserProfile = {
      username: clean,
      avatarUrl: displayedAvatarUrl,
      avatarSeed: seed,
      avatarStyle: customAvatarUrl ? 'custom' : currentStyle,
      createdAt: Date.now(),
    }

    // Save profile to local storage immediately
    saveUserProfile(profile, address)

    // Frictionless entry to the lobby for all users (claim onchain can be done anytime from the lobby)
    toast.success(`Welcome to Trivio, @${profile.username}!`)
    onComplete(profile)
  }

  const handleFinishSuccess = () => {
    const profile = pendingProfile || {
      username: cleanUsername || suggestions.username,
      avatarUrl: displayedAvatarUrl,
      avatarSeed: seed,
      avatarStyle: customAvatarUrl ? 'custom' : currentStyle,
      createdAt: Date.now(),
    }
    // Commit profile to local storage now that onboarding is complete
    saveUserProfile(profile, address)
    onComplete(profile)
  }

  const handleRetryRegistration = () => {
    resetOnchainTx?.()
    setStep('form')
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5 overflow-y-auto"
          style={{
            background: 'rgba(15, 10, 30, 0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            key="onboarding-card"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[360px] sm:max-w-[420px] rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-purple-100/80 my-auto text-left"
            style={{
              boxShadow: '0 25px 60px -15px rgba(88, 28, 135, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Close button (only when editing) */}
            {isEditing && step === 'form' && (
              <button
                type="button"
                onClick={() => onClose?.()}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            )}

            <AnimatePresence mode="wait">
              {/* ── STEP 1: FORM ─────────────────────────────────────────── */}
              {step === 'form' && (
                <motion.div
                  key="step-form"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Header */}
                  <div className="mb-6 text-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                      {isEditing ? 'Edit Profile' : 'Claim Your Profile'}
                    </h2>
                    <p className="mt-1.5 text-xs sm:text-sm text-gray-500 font-normal leading-relaxed max-w-[300px] mx-auto">
                      {isEditing
                        ? 'Update your display name and avatar'
                        : 'Pick your unique onchain handle & avatar to play'}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      {/* Avatar preview with floating upload badge */}
                      <div className="relative">
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="relative h-20 w-20 sm:h-24 sm:w-24 cursor-pointer rounded-full bg-purple-50 ring-4 ring-purple-100 hover:ring-purple-300 transition-all p-0.5 active:scale-95 shadow-sm overflow-hidden"
                          title="Click to upload custom photo"
                        >
                          <img
                            src={displayedAvatarUrl}
                            alt="Avatar"
                            className="h-full w-full rounded-full object-cover"
                          />
                        </div>

                        {/* Floating Camera Upload Button Badge */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-md border border-gray-200 hover:text-purple-600 hover:border-purple-300 hover:scale-110 active:scale-95 transition-all cursor-pointer z-10"
                          aria-label="Upload photo"
                          title="Upload custom photo"
                        >
                          <Camera size={13} className="text-gray-700 hover:text-purple-600 sm:w-3.5 sm:h-3.5" />
                        </button>
                      </div>

                      {/* Randomize Pill Button */}
                      <button
                        type="button"
                        onClick={handleRandomizeAvatar}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium transition-all active:scale-95 cursor-pointer"
                      >
                        <Dices size={13} className={isRolling ? 'rotate-180 transition-transform duration-300' : ''} />
                        <span>Shuffle</span>
                      </button>
                    </div>

                    {/* Username Input */}
                    <div className="space-y-1.5 pt-1">
                      <label htmlFor="trivio-username-input" className="block text-xs font-semibold text-gray-700">
                        Username
                      </label>
                      <div
                        className={`relative flex items-center rounded-2xl border bg-gray-50/60 px-3.5 py-2.5 sm:py-3 transition-all focus-within:bg-white ${isReserved
                          ? 'border-amber-400 bg-amber-50/30 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-400/20'
                          : cleanUsername.length >= 2 && isAvailableOnchain === false
                            ? 'border-red-300 bg-red-50/30 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-400/20'
                            : 'border-gray-200 focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-500/15'
                          }`}
                      >
                        <span className="text-sm font-bold text-purple-600 select-none mr-1.5">@</span>
                        <input
                          id="trivio-username-input"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
                          placeholder="your_handle"
                          maxLength={16}
                          className="w-full bg-transparent text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none"
                          required
                        />
                        {isCheckingOnchain && cleanUsername.length >= 2 && !isReserved && (
                          <Loader2 size={14} className="animate-spin text-purple-600 shrink-0 ml-1.5" />
                        )}
                      </div>

                      {/* Reserved Name Warning */}
                      {isReserved && (
                        <motion.div
                          initial={{ opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/90 px-3 py-2 text-xs font-medium text-amber-800"
                        >
                          <AlertCircle size={14} className="shrink-0 text-amber-600" />
                          <span>Username contains a reserved word.</span>
                        </motion.div>
                      )}

                      {/* Already Taken Onchain Warning */}
                      {!isReserved && cleanUsername.length >= 2 && isAvailableOnchain === false && (
                        <motion.div
                          initial={{ opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200/90 px-3 py-2 text-xs font-medium text-red-700"
                        >
                          <AlertCircle size={14} className="shrink-0 text-red-500" />
                          <span>Username already taken.</span>
                        </motion.div>
                      )}

                      {/* Available Onchain Badge */}
                      {!isReserved && cleanUsername.length >= 2 && isAvailableOnchain === true && (
                        <motion.div
                          initial={{ opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 text-xs font-medium text-emerald-700"
                        >
                          <Check size={13} className="shrink-0 text-emerald-600 stroke-[2.5]" />
                          <span>Username is available</span>
                        </motion.div>
                      )}

                      <div className="flex justify-between text-[11px] text-gray-400 px-1 pt-0.5">
                        <span>Letters, numbers, underscores</span>
                        <span className="font-medium text-gray-500">{username.length}/16</span>
                      </div>
                    </div>

                    {/* Primary Actions */}
                    <div className="pt-2 space-y-2">
                      <button
                        type="submit"
                        disabled={isReserved || (cleanUsername.length >= 2 && isAvailableOnchain === false)}
                        className="w-full h-11 sm:h-12 flex items-center justify-center rounded-2xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:pointer-events-none text-sm font-semibold text-white transition-all shadow-md shadow-purple-500/20 active:scale-[0.99] cursor-pointer"
                      >
                        {isEditing ? 'Save Changes' : 'Enter Lobby'}
                      </button>

                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => onClose?.()}
                          className="w-full text-center text-xs font-medium text-gray-400 hover:text-gray-600 py-1 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ── STEP 2: SUBMITTING / CREATING CREDENTIALS ─────────────── */}
              {step === 'submitting' && (
                <motion.div
                  key="step-submitting"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center text-center py-3 space-y-4"
                >
                  {/* Avatar Preview */}
                  <div className="relative flex items-center justify-center my-1">
                    <div className="relative h-20 w-20 rounded-full ring-4 ring-purple-100 p-0.5 bg-white shadow-xs">
                      <img
                        src={displayedAvatarUrl}
                        alt="Avatar"
                        className="h-full w-full rounded-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 px-2">
                    <span className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200/80 px-3 py-1 text-xs font-bold text-purple-700">
                      @{cleanUsername}
                    </span>

                    <h3 className="text-base font-bold text-gray-900 pt-1">
                      {isOnchainPending ? 'Confirm in your wallet' : 'Registering on Arc...'}
                    </h3>

                    <p className="text-xs sm:text-sm text-gray-500 max-w-[270px] mx-auto leading-relaxed">
                      {isOnchainPending
                        ? 'Please approve the transaction prompt in your wallet to claim this handle onchain.'
                        : 'Submitting handle registration to the Arc Testnet smart contract.'}
                    </p>
                  </div>

                  {/* Clean text indicator */}
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-purple-50/70 border border-purple-100 px-4 py-2 text-xs font-medium text-purple-700">
                    <Loader2 size={14} className="animate-spin text-purple-600 shrink-0" />
                    <span>{isOnchainPending ? 'Waiting for signature...' : 'Confirming onchain...'}</span>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: SUCCESS CHECKMARK MODAL ───────────────────────── */}
              {step === 'success' && (
                <motion.div
                  key="step-success"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center text-center py-2 space-y-4"
                >
                  {/* Animated Modern Success Checkmark Badge */}
                  <div className="relative flex items-center justify-center mt-1">
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 ring-4 ring-emerald-100"
                    >
                      <Check size={32} className="stroke-[3]" />
                    </motion.div>
                  </div>

                  {/* Congratulatory Text */}
                  <div className="space-y-1.5 px-2">
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                      Profile Ready!
                    </h3>

                    <p className="text-xs sm:text-sm text-gray-500 max-w-[260px] mx-auto leading-relaxed">
                      Your onchain handle has been verified. Welcome to Trivio!
                    </p>
                  </div>

                  {/* Profile Preview Card */}
                  <div className="w-full rounded-2xl bg-purple-50/60 border border-purple-100/80 p-3 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full ring-2 ring-white p-0.5 bg-white shadow-xs overflow-hidden shrink-0">
                      <img
                        src={pendingProfile?.avatarUrl || displayedAvatarUrl}
                        alt="Avatar"
                        className="h-full w-full rounded-full object-cover"
                      />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Registered Handle</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        @{pendingProfile?.username || cleanUsername}
                      </p>
                    </div>
                    <ShieldCheck size={18} className="text-purple-600 shrink-0 mr-1" />
                  </div>

                  {/* Action Button */}
                  <div className="w-full pt-1">
                    <button
                      type="button"
                      onClick={handleFinishSuccess}
                      className="w-full h-11 flex items-center justify-center rounded-2xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-sm font-semibold text-white transition-all shadow-md shadow-purple-500/20 active:scale-[0.99] cursor-pointer"
                    >
                      Enter Lobby
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 4: ERROR / CANCELLED / INSUFFICIENT GAS FALLBACK ─── */}
              {step === 'error' && (
                <motion.div
                  key="step-error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center text-center py-2 space-y-4"
                >
                  {/* Sleek Modern Warning Badge */}
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-4 ring-amber-100/80">
                    <AlertCircle size={28} className="stroke-[2.2]" />
                  </div>

                  <div className="space-y-1.5 px-2">
                    <h3 className="text-base font-bold text-gray-900">
                      Registration Incomplete
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                      Your wallet needs Arc Testnet gas to claim this handle onchain.
                    </p>
                  </div>

                  {/* Copyable Wallet Address Card */}
                  {address && (
                    <div className="w-full rounded-2xl bg-purple-50/60 border border-purple-100/90 p-3 space-y-2 text-left">
                      <div className="flex items-center justify-between text-xs text-gray-600 font-medium">
                        <span>Your Connected Address</span>
                        <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Arc Testnet</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-white border border-purple-100 px-3 py-2 shadow-2xs">
                        <span className="font-mono text-xs font-semibold text-gray-800 truncate">
                          {address.slice(0, 8)}...{address.slice(-6)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyAddress}
                          className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-900 px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer shrink-0"
                          title="Copy full address"
                        >
                          {copied ? (
                            <>
                              <Check size={12} className="text-emerald-600 stroke-[2.5]" />
                              <span className="text-emerald-700 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <a
                        href="https://faucet.testnet.arc.io"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center justify-center gap-1.5 w-full pt-0.5 text-xs font-semibold text-purple-700 hover:text-purple-800 hover:underline transition-all cursor-pointer"
                      >
                        <span>Get free gas from Arc Faucet</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}

                  <div className="w-full pt-1 space-y-2">
                    <button
                      type="button"
                      onClick={handleFinishSuccess}
                      className="w-full h-11 flex items-center justify-center rounded-2xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-sm font-semibold text-white transition-all shadow-md shadow-purple-500/15 active:scale-[0.99] cursor-pointer"
                    >
                      Enter Lobby & Play
                    </button>

                    <button
                      type="button"
                      onClick={handleRetryRegistration}
                      className="w-full text-center text-xs font-medium text-gray-500 hover:text-gray-700 py-1 transition-colors cursor-pointer"
                    >
                      Try Again
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
