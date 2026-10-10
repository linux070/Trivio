import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import {
  Plus,
  LogIn,
  LogOut,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pencil,
  ShieldCheck,
  Camera,
  Sparkles,
  Dices,
  X,
  Play,
  Clock,
  Users,
  Layers,
  Zap,
  Trophy,
  Flame,
  Activity,
  KeyRound,
  AlertCircle,
  AlertTriangle,
  Loader2,
  HelpCircle,
} from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import {
  getUserProfile,
  saveUserProfile,
  getDiceBearAvatarUrl,
  generateRandomUsername,
  DICEBEAR_STYLES,
  isReservedUsername,
  validateUsername,
  type UserProfile,
} from '@/lib/userProfile'
import { useUsdcBalance, formatUSDCRaw } from '@/hooks/useTriviaContract'
import { useOnchainProfile, useSetOnchainProfile, useCheckUsernameAvailable } from '@/hooks/useTrivioProfileRegistry'
import { ARC_TESTNET_CHAIN_ID, ARC_MAINNET_CHAIN_ID } from '@/config'
import {
  type Category,
  CATEGORY_GROUPS,
  type CategoryGroup,
  type SubCategoryInfo,
  prefetchCategoryQuestions,
} from '@/lib/questions'
import {
  getActiveGame,
  clearActiveGame,
  getPendingJoin,
  getRoomCategory,
  saveRoomCategory,
  saveActiveGame,
  getPendingPayoutRooms,
  getPendingRefundRooms,
  removePendingRefundRoom,
  saveRoomCancelledState,
  type ActiveGameSession,
  type PendingPayoutRoom,
  type PendingRefundRoom,
} from '@/lib/roomStorage'
import { useLiveRooms } from '@/hooks/useLiveRooms'
import { useLiveWinners } from '@/hooks/useLiveWinners'
import { type LiveLeaderboardEntry, type LatestPayoutInfo, formatTimeAgo } from '@/lib/winnersStorage'
import SoloPracticeModal from '@/components/SoloPracticeModal'
import HowToPlayModal from '@/components/HowToPlayModal'

interface LobbyProps {
  initialCategory?: Category | null
  onCreateRoom: (category: Category) => void
  onJoinRoom: (category: Category, prefillCode?: string) => void
  onContinueGame?: (roomCode: string, category: Category) => void
  onDisconnect?: () => void
}

const RANK_BADGE_STYLES = [
  'bg-amber-400 text-white', // 1st Place
  'bg-slate-400 text-white', // 2nd Place
  'bg-amber-600 text-white', // 3rd Place
  'bg-slate-200 text-slate-600', // 4th Place
  'bg-slate-200 text-slate-600', // 5th Place
]

function LeaderboardListItem({
  winner,
  rankIndex,
}: {
  winner: LiveLeaderboardEntry
  rankIndex: number
}) {
  const { profile: onchainProfile } = useOnchainProfile(winner.address)
  const localProfile = winner.address ? getUserProfile(winner.address.toLowerCase()) : null

  const rawUsername =
    onchainProfile?.username ||
    localProfile?.username ||
    (winner.username && !winner.username.startsWith('0x')
      ? winner.username
      : generateRandomUsername(winner.address))

  const formattedUsername = rawUsername.startsWith('@')
    ? rawUsername
    : `@${rawUsername}`

  const resolvedAvatar =
    onchainProfile?.avatarUrl ||
    localProfile?.avatarUrl ||
    (winner.avatarSeed
      ? getDiceBearAvatarUrl(onchainProfile?.avatarStyle || localProfile?.avatarStyle || 'bottts-neutral', winner.avatarSeed)
      : getDiceBearAvatarUrl(onchainProfile?.avatarStyle || localProfile?.avatarStyle || 'bottts-neutral', winner.address || rawUsername))

  const rankBg = RANK_BADGE_STYLES[rankIndex] || RANK_BADGE_STYLES[3]

  return (
    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-200/75 bg-slate-50/50 hover:bg-slate-50/80 transition-colors shadow-2xs">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Rank Badge (Exact match to Game Concluded modal) */}
        <span
          className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-extrabold shrink-0 shadow-2xs ${rankBg}`}
        >
          {winner.rank}
        </span>

        {/* Avatar */}
        <img
          src={resolvedAvatar}
          alt={rawUsername}
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-slate-200/90 bg-white object-cover p-0.5 shrink-0 ring-1 ring-slate-100 shadow-2xs"
          onError={(e) => {
            e.currentTarget.src = getDiceBearAvatarUrl('bottts-neutral', winner.address || rawUsername)
          }}
        />

        {/* Username & Win count */}
        <div className="min-w-0">
          <p className="text-xs sm:text-[13px] font-semibold text-slate-900 truncate tracking-tight">
            {formattedUsername}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
            {winner.winCount} {winner.winCount === 1 ? 'match won' : 'matches won'}
          </p>
        </div>
      </div>

      {/* USDC Total */}
      <div className="flex items-center gap-1.5 shrink-0 pl-2">
        <TokenUSDC variant="branded" size={17} className="shrink-0" />
        <span className="text-xs sm:text-sm font-extrabold text-slate-900 tabular-nums tracking-tight">
          ${winner.totalWinnings}
        </span>
      </div>
    </div>
  )
}

function LatestPayoutTicker({
  recentPayouts,
  latestPayout,
}: {
  recentPayouts?: LatestPayoutInfo[]
  latestPayout: LatestPayoutInfo | null
}) {
  const payoutsList =
    recentPayouts && recentPayouts.length > 0
      ? recentPayouts
      : latestPayout
      ? [latestPayout]
      : []

  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (payoutsList.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % payoutsList.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [payoutsList.length])

  if (payoutsList.length === 0) {
    return (
      <span className="text-slate-400 italic text-[11px] truncate">
        No payouts yet · Win a room to appear here live!
      </span>
    )
  }

  const currentPayout = payoutsList[currentIndex % payoutsList.length]

  return (
    <div className="min-w-0 overflow-hidden relative h-5.5 flex items-center justify-end flex-1">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPayout.address + currentPayout.timestamp + currentIndex}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex items-center gap-1.5 text-slate-600 text-[11px] truncate"
        >
          <LatestPayoutItem latestPayout={currentPayout} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function LatestPayoutItem({ latestPayout }: { latestPayout: LatestPayoutInfo }) {
  const { profile: onchainProfile } = useOnchainProfile(latestPayout.address)
  const localProfile = latestPayout.address ? getUserProfile(latestPayout.address.toLowerCase()) : null

  const rawUsername =
    onchainProfile?.username ||
    localProfile?.username ||
    (latestPayout.username && !latestPayout.username.startsWith('0x')
      ? latestPayout.username
      : generateRandomUsername(latestPayout.address))

  const formattedUsername = rawUsername.startsWith('@')
    ? rawUsername
    : `@${rawUsername}`

  const resolvedAvatar =
    onchainProfile?.avatarUrl ||
    localProfile?.avatarUrl ||
    getDiceBearAvatarUrl('bottts-neutral', latestPayout.address || rawUsername)

  const timeDisplay = formatTimeAgo(latestPayout.timestamp)

  return (
    <div className="inline-flex items-center gap-1.5 text-slate-700 truncate">
      <img
        src={resolvedAvatar}
        alt={rawUsername}
        className="h-4 w-4 rounded-full border border-slate-200 bg-white object-cover inline-block shrink-0"
        onError={(e) => {
          e.currentTarget.src = getDiceBearAvatarUrl('bottts-neutral', latestPayout.address || rawUsername)
        }}
      />
      <span className="font-bold text-slate-900 truncate max-w-[110px] sm:max-w-[140px]">
        {formattedUsername}
      </span>
      <span className="text-slate-500 font-medium">won</span>
      <span className="text-emerald-700 font-extrabold shrink-0">${latestPayout.amount} USDC</span>
      <span className="text-slate-500 truncate hidden sm:inline">in {latestPayout.category}</span>
      <span className="text-slate-400 font-medium shrink-0">({timeDisplay})</span>
      {latestPayout.txHash && (
        <a
          href={`https://explorer.testnet.arc.io/tx/${latestPayout.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View on Arc Explorer"
          className="text-slate-400 hover:text-slate-700 transition-colors shrink-0 ml-0.5"
        >
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  )
}

function WalletProfile({ onDisconnect }: { onDisconnect?: () => void }) {
  const { address: wagmiAddress, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, switchChainAsync } = useSwitchChain()
  const { user, logout, exportWallet } = usePrivy()
  const { wallets } = useWallets()

  const hasEmbeddedWallet = Boolean(
    user?.wallet?.walletClientType === 'privy' ||
    wallets?.some((w) => w.walletClientType === 'privy')
  )

  const handleExportWallet = async () => {
    try {
      await exportWallet()
    } catch (err) {
      console.warn('Export wallet error:', err)
    }
  }

  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [isRollingAvatar, setIsRollingAvatar] = useState(false)
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<'testnet' | 'mainnet'>(() => {
    return chainId === ARC_MAINNET_CHAIN_ID ? 'mainnet' : 'testnet'
  })

  const dropdownRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const privyWalletAddress = user?.wallet?.address as `0x${string}` | undefined
  const activeAddress = wagmiAddress || privyWalletAddress || '0x0000000000000000000000000000000000000000'
  const [profile, setProfile] = useState<UserProfile | null>(() => getUserProfile(activeAddress) || getUserProfile())
  const [avatarImgError, setAvatarImgError] = useState(false)

  // Listen to profile updates broadcasted across the entire application
  useEffect(() => {
    const handleProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ address?: string; profile?: UserProfile }>).detail
      if (detail?.profile) {
        if (!activeAddress || !detail.address || detail.address.toLowerCase() === activeAddress.toLowerCase()) {
          setProfile(detail.profile)
          setAvatarImgError(false)
        }
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('trivio_profile_updated', handleProfileUpdated)
      return () => window.removeEventListener('trivio_profile_updated', handleProfileUpdated)
    }
  }, [activeAddress])

  useEffect(() => {
    if (activeAddress && activeAddress !== '0x0000000000000000000000000000000000000000') {
      const p = getUserProfile(activeAddress) || getUserProfile()
      if (p) {
        if (!p.avatarUrl) {
          const fixed: UserProfile = {
            ...p,
            avatarUrl: getDiceBearAvatarUrl(p.avatarStyle || 'bottts-neutral', p.avatarSeed || p.username),
          }
          saveUserProfile(fixed, activeAddress)
          setProfile(fixed)
        } else {
          setProfile(p)
        }
      }
    }
  }, [activeAddress])

  const activeChainId = selectedNetwork === 'mainnet' ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID
  const { data: rawBalance } = useUsdcBalance(activeAddress as `0x${string}`, activeChainId)
  const balanceHuman = rawBalance !== undefined ? formatUSDCRaw(rawBalance) : '0.00'

  const {
    profile: onchainProfile,
    hasProfile: hasOnchainProfile,
    isLoading: isOnchainLoading,
    refetch: refetchOnchainProfile,
  } = useOnchainProfile(activeAddress, activeChainId)

  const isProfileVerified = Boolean(hasOnchainProfile || profile?.isOnchainVerified)

  const {
    setProfile: setOnchainProfile,
    isPending: isSettingOnchain,
    isConfirming: isConfirmingOnchain,
    isSuccess: isOnchainSuccess,
    hash: onchainTxHash,
  } = useSetOnchainProfile()

  const cleanNameInput = nameInput.trim().replace(/^@/, '')
  const isNameInputReserved = isReservedUsername(cleanNameInput)
  const { data: isNameInputAvailable } = useCheckUsernameAvailable(cleanNameInput, activeChainId)
  const isNameInputTaken = Boolean(
    !isNameInputReserved &&
    cleanNameInput.length >= 2 &&
    cleanNameInput.toLowerCase() !== profile?.username?.toLowerCase() &&
    isNameInputAvailable === false
  )

  useEffect(() => {
    if (hasOnchainProfile && onchainProfile) {
      const existingLocal = getUserProfile(activeAddress)
      const onchainTime = Number(onchainProfile.updatedAt) * 1000
      const localTime = existingLocal ? (existingLocal.updatedAt || existingLocal.createdAt || 0) : 0
      const localIsNewer = Boolean(existingLocal?.username && localTime > onchainTime)

      if (localIsNewer && existingLocal) {
        // Keep the user's fresh local modifications without letting stale onchain data overwrite it
        setProfile((prev) => (prev?.username === existingLocal.username && prev?.avatarUrl === existingLocal.avatarUrl ? prev : existingLocal))
      } else {
        const p: UserProfile = {
          username: onchainProfile.username || existingLocal?.username || 'player',
          // Preserve locally chosen/rolled avatar if present
          avatarUrl: existingLocal?.avatarUrl || onchainProfile.avatarUrl || getDiceBearAvatarUrl(onchainProfile.avatarStyle || 'bottts-neutral', onchainProfile.avatarSeed || onchainProfile.username),
          avatarSeed: existingLocal?.avatarSeed || onchainProfile.avatarSeed || onchainProfile.username,
          avatarStyle: existingLocal?.avatarStyle || onchainProfile.avatarStyle || 'bottts-neutral',
          createdAt: onchainTime || existingLocal?.createdAt || Date.now(),
          updatedAt: onchainTime || Date.now(),
          isOnchainVerified: true,
        }
        saveUserProfile(p, activeAddress)
        setProfile((prev) => (
          prev?.username === p.username &&
          prev?.avatarUrl === p.avatarUrl &&
          prev?.avatarSeed === p.avatarSeed &&
          prev?.isOnchainVerified === p.isOnchainVerified
            ? prev
            : p
        ))
      }
    } else {
      const local = getUserProfile(activeAddress)
      if (local) {
        setProfile((prev) => (
          prev?.username === local.username &&
          prev?.avatarUrl === local.avatarUrl &&
          prev?.avatarSeed === local.avatarSeed
            ? prev
            : local
        ))
      }
    }
  }, [hasOnchainProfile, onchainProfile, activeAddress])

  useEffect(() => {
    if (isOnchainSuccess) {
      refetchOnchainProfile()
      if (profile) {
        const updated = { ...profile, isOnchainVerified: true }
        saveUserProfile(updated, activeAddress)
        setProfile(updated)
      }
      toast.success('Profile registered on Arc Testnet!', {
        description: onchainTxHash ? `Tx: ${onchainTxHash.slice(0, 10)}...` : undefined,
      })
    }
  }, [isOnchainSuccess, onchainTxHash, refetchOnchainProfile, activeAddress])

  useEffect(() => {
    if (chainId === ARC_MAINNET_CHAIN_ID) {
      setSelectedNetwork('mainnet')
    } else if (chainId === ARC_TESTNET_CHAIN_ID) {
      setSelectedNetwork('testnet')
    }
  }, [chainId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setNetworkDropdownOpen(false)
        setIsEditingName(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopy = () => {
    if (!activeAddress) return
    navigator.clipboard.writeText(activeAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnectClick = async () => {
    setOpen(false)
    try {
      localStorage.removeItem('trivio_authenticated')
      localStorage.removeItem('trivio_current_screen')
      sessionStorage.removeItem('trivio_current_screen')
      localStorage.removeItem('wagmi.recentConnectorId')
      localStorage.removeItem('wagmi.store')
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    } catch {
      // ignore
    }
    try {
      disconnect()
    } catch {
      // ignore
    }
    try {
      await logout()
    } catch {
      // ignore
    }
    if (onDisconnect) {
      onDisconnect()
    }
  }

  const handleStartEditName = () => {
    setNameInput(profile?.username || '')
    setIsEditingName(true)
    setTimeout(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }, 60)
  }

  const handleSaveName = () => {
    const cleaned = nameInput.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '')
    if (!cleaned) {
      setIsEditingName(false)
      return
    }
    const validation = validateUsername(cleaned)
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid username')
      return
    }
    if (isNameInputTaken) {
      toast.error('Username already taken.')
      return
    }
    const now = Date.now()
    const updated: UserProfile = {
      username: cleaned,
      avatarUrl: profile?.avatarUrl || getDiceBearAvatarUrl(profile?.avatarStyle || 'bottts-neutral', profile?.avatarSeed || cleaned),
      avatarSeed: profile?.avatarSeed || cleaned,
      avatarStyle: profile?.avatarStyle || 'bottts-neutral',
      createdAt: profile?.createdAt || now,
      updatedAt: now,
      isOnchainVerified: false,
    }
    saveUserProfile(updated, activeAddress)
    setProfile(updated)
    setIsEditingName(false)
    toast.success(`Username updated to @${cleaned}!`)

    if (activeAddress && activeAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        setOnchainProfile(
          updated.username,
          updated.avatarUrl,
          updated.avatarSeed,
          updated.avatarStyle,
          activeChainId
        )
      } catch (err) {
        console.warn('Failed to submit onchain profile:', err)
      }
    }
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
  }

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (!result) return

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 128
        canvas.height = 128
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, 128, 128)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)

          const now = Date.now()
          const currentUsername = profile?.username || 'player'
          const updated: UserProfile = {
            username: currentUsername,
            avatarUrl: compressedDataUrl,
            avatarSeed: 'custom_upload',
            avatarStyle: 'custom',
            createdAt: profile?.createdAt || now,
            updatedAt: now,
            isOnchainVerified: false,
          }
          saveUserProfile(updated, activeAddress)
          setProfile(updated)
          setAvatarImgError(false)
          toast.success('Avatar updated!')
        }
      }
      img.src = result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleRandomizeAvatar = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsRollingAvatar(true)
    setTimeout(() => setIsRollingAvatar(false), 500)

    // Select a style (pick a different one than current style if possible for maximum visual difference)
    const currentStyle = profile?.avatarStyle || 'bottts-neutral'
    const otherStyles = DICEBEAR_STYLES.filter(s => s.id !== currentStyle)
    const chosenStyle = (otherStyles.length > 0
      ? otherStyles[Math.floor(Math.random() * otherStyles.length)]
      : DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)]).id

    const randomSeed = `p_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    const newAvatarUrl = getDiceBearAvatarUrl(chosenStyle, randomSeed)

    // Preload image
    const img = new Image()
    img.src = newAvatarUrl

    const now = Date.now()
    const updated: UserProfile = {
      username: profile?.username || (displayName.replace(/^@/, '') || 'player'),
      avatarUrl: newAvatarUrl,
      avatarSeed: randomSeed,
      avatarStyle: chosenStyle,
      createdAt: profile?.createdAt || now,
      updatedAt: now,
      isOnchainVerified: false,
    }
    saveUserProfile(updated, activeAddress)
    setProfile(updated)
    setAvatarImgError(false)
    toast.success('Avatar rolled!')
  }

  const handleNetworkChange = async (network: 'testnet' | 'mainnet') => {
    setSelectedNetwork(network)
    setNetworkDropdownOpen(false)
    const targetChainId = network === 'mainnet' ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID

    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: targetChainId })
      } else if (switchChain) {
        switchChain({ chainId: targetChainId })
      }
    } catch (err) {
      console.warn('Wagmi switchChain error:', err)
    }

    try {
      const activeWallet = wallets?.find(w => w.address?.toLowerCase() === activeAddress?.toLowerCase()) || wallets?.[0]
      if (activeWallet && activeWallet.switchChain) {
        await activeWallet.switchChain(targetChainId)
      }
    } catch (err) {
      console.warn('Privy switchChain error:', err)
    }

    if (network === 'mainnet') {
      toast.info('Switched to Mainnet')
    } else {
      toast.success('Switched to Testnet')
    }
  }

  const shortAddr = activeAddress && activeAddress !== '0x0000000000000000000000000000000000000000'
    ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`
    : ''
  const localStoredProfile = getUserProfile(activeAddress)
  const effectiveProfile: { username?: string; avatarUrl?: string; avatarStyle?: string; avatarSeed?: string } | null =
    profile ||
    localStoredProfile ||
    (activeAddress ? getUserProfile(activeAddress) : getUserProfile()) ||
    (onchainProfile
      ? {
          username: onchainProfile.username,
          avatarUrl: onchainProfile.avatarUrl,
          avatarSeed: onchainProfile.avatarSeed,
          avatarStyle: onchainProfile.avatarStyle,
        }
      : null)
  const displayName = effectiveProfile?.username ? `@${effectiveProfile.username.replace(/^@/, '')}` : (shortAddr || 'player')
  const effectiveAvatar =
    effectiveProfile?.avatarUrl ||
    profile?.avatarUrl ||
    localStoredProfile?.avatarUrl ||
    (effectiveProfile?.username
      ? getDiceBearAvatarUrl(
          effectiveProfile.avatarStyle || 'bottts-neutral',
          effectiveProfile.avatarSeed || effectiveProfile.username
        )
      : '')

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Chip Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="group flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/95 pl-1.5 pr-3 py-1 text-xs sm:text-sm font-semibold text-gray-900 shadow-2xs backdrop-blur-md transition-all hover:border-purple-200 hover:bg-white hover:shadow-xs active:scale-95 cursor-pointer"
        style={{ letterSpacing: '-0.01em' }}
        title={isProfileVerified ? 'Onchain Verified Handle' : 'Handle Unclaimed Onchain - Click to claim'}
      >
        <div className="relative flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-purple-50 ring-1 ring-black/5">
          {effectiveAvatar && !avatarImgError ? (
            <img
              key={effectiveAvatar}
              src={effectiveAvatar}
              alt={effectiveProfile?.username || 'Profile'}
              className="h-full w-full rounded-full object-cover"
              onError={() => setAvatarImgError(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-purple-100 text-purple-700 font-bold text-[10px] sm:text-xs rounded-full">
              {displayName.replace(/^@/, '').slice(0, 1).toUpperCase()}
            </span>
          )}

          {/* Micro status indicator */}
          {!isProfileVerified && !isOnchainLoading && profile?.username && (
            <span
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
              title="Handle not yet claimed onchain"
            />
          )}
        </div>

        <span className="font-semibold text-[11px] sm:text-sm text-gray-900 max-w-[110px] sm:max-w-[150px] truncate tracking-tight">
          {displayName}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ease-out group-hover:text-gray-700 ${open ? 'rotate-180 text-gray-900' : ''}`}
        />
      </button>

      {/* Profile Popover / Mobile Bottom Drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                setOpen(false)
                setNetworkDropdownOpen(false)
                setIsEditingName(false)
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[90] sm:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 bottom-0 z-[100] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border-t sm:border border-gray-100 overflow-hidden max-h-[92dvh] overflow-y-auto pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] sm:static sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[330px] sm:max-w-[330px] sm:shadow-2xl sm:max-h-none sm:pb-0"
              style={{
                boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Mobile top handle bar */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              <div className="relative h-20 bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-700 rounded-none sm:rounded-t-3xl" />

              <div className="relative px-4 pt-0 pb-3.5">
                <div className="flex items-end justify-between -mt-8 mb-2.5">
                  <div className="relative group/avatar">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Click to upload custom photo"
                      className="relative h-[68px] w-[68px] rounded-2xl bg-white p-0.5 shadow-md ring-2 ring-white/90 overflow-hidden transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-left block"
                    >
                      {profile?.avatarUrl && !avatarImgError ? (
                        <img
                          key={profile.avatarUrl}
                          src={profile.avatarUrl}
                          alt="Avatar"
                          className="h-full w-full rounded-[14px] object-cover bg-purple-50 transition-transform duration-300 group-hover/avatar:scale-105"
                          onError={(e) => {
                            const fallback = getDiceBearAvatarUrl('bottts-neutral', activeAddress || profile?.avatarSeed || 'player')
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback
                            } else {
                              setAvatarImgError(true)
                            }
                          }}
                        />
                      ) : (
                        <div className="h-full w-full rounded-[14px] bg-purple-100 flex items-center justify-center font-bold text-xl text-purple-700">
                          {displayName.replace(/^@/, '').slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-[14px] flex flex-col items-center justify-center text-white gap-0.5 pointer-events-none">
                        <Camera size={14} className="stroke-[2.5]" />
                        <span className="text-[9px] font-bold tracking-tight">Upload</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRandomizeAvatar(e)
                      }}
                      title="Roll random avatar"
                      aria-label="Roll random avatar"
                      className="absolute -bottom-1 -right-1 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-700 hover:text-purple-600 hover:bg-purple-50 shadow-md border border-gray-200 hover:border-purple-300 transition-all hover:scale-110 active:scale-90 cursor-pointer pointer-events-auto"
                    >
                      <Dices
                        size={14}
                        className={`transition-transform duration-500 ease-out ${isRollingAvatar ? 'rotate-180 text-purple-600' : 'group-hover/avatar:rotate-45'}`}
                      />
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    onChange={handleAvatarFileUpload}
                    className="hidden"
                  />

                  <div className="relative mb-1" ref={networkRef}>
                    <button
                      type="button"
                      onClick={() => setNetworkDropdownOpen(prev => !prev)}
                      className="group/net inline-flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-gray-50/90 hover:bg-white hover:border-gray-300 pl-3 pr-2.5 py-1 text-xs font-semibold text-gray-800 shadow-2xs backdrop-blur-md transition-all active:scale-95"
                    >
                      <span>{selectedNetwork === 'testnet' ? 'Testnet' : 'Mainnet'}</span>
                      <ChevronDown
                        size={12}
                        className={`text-gray-400 transition-transform duration-200 group-hover/net:text-gray-700 ${networkDropdownOpen ? 'rotate-180 text-gray-900' : ''}`}
                      />
                    </button>

                    <AnimatePresence>
                      {networkDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 4 }}
                          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute right-0 top-full mt-1.5 w-28 rounded-xl bg-white p-1 shadow-xl border border-gray-100 z-50 overflow-hidden"
                          style={{
                            boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.04)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleNetworkChange('testnet')}
                            className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${selectedNetwork === 'testnet'
                              ? 'bg-purple-50 text-purple-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                          >
                            <span>Testnet</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleNetworkChange('mainnet')}
                            className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all mt-0.5 ${selectedNetwork === 'mainnet'
                              ? 'bg-purple-50 text-purple-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                          >
                            <span>Mainnet</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mt-1">
                  {isEditingName ? (
                    <div className="space-y-1">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleSaveName()
                        }}
                        className={`flex items-center gap-1 pb-0.5 border-b ${isReservedUsername(nameInput)
                          ? 'border-amber-400 focus-within:border-amber-500'
                          : 'border-purple-300/80 focus-within:border-purple-500/70'
                          } transition-colors`}
                      >
                        <span className="text-gray-400 font-medium text-sm select-none">@</span>
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') handleCancelEditName()
                          }}
                          placeholder="username"
                          maxLength={20}
                          className="w-full min-w-0 bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400 p-0"
                        />
                        <div className="flex items-center gap-0.5 shrink-0 ml-1">
                          <button
                            type="submit"
                            disabled={isNameInputReserved || isNameInputTaken}
                            title="Save (Enter)"
                            className="flex h-5 w-5 items-center justify-center rounded text-purple-600 hover:text-purple-800 hover:bg-purple-50 disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-all cursor-pointer"
                          >
                            <Check size={14} className="stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditName}
                            title="Cancel (Esc)"
                            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
                          >
                            <X size={14} className="stroke-[2]" />
                          </button>
                        </div>
                      </form>
                      {isNameInputReserved && (
                        <span className="text-[10px] font-medium text-amber-600 block leading-tight">
                          Username contains a reserved word.
                        </span>
                      )}
                      {isNameInputTaken && (
                        <span className="text-[10px] font-medium text-red-600 block leading-tight">
                          Username already taken.
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={handleStartEditName}
                        className="group/name flex items-center gap-1.5 text-left cursor-pointer rounded-lg -ml-1 px-1 py-0.5 truncate"
                        title="Click to edit username"
                      >
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {profile?.username ? `@${profile.username}` : 'Anonymous Player'}
                        </h3>
                        {isProfileVerified && (
                          <span title="Verified on Arc Testnet" className="inline-flex items-center">
                            <ShieldCheck size={13} className="text-purple-600 shrink-0" />
                          </span>
                        )}
                        <Pencil size={10} className="text-gray-300 group-hover/name:text-gray-500 transition-colors ml-0.5 shrink-0" />
                      </button>

                      {!isProfileVerified && !isOnchainLoading && (
                        <button
                          type="button"
                          disabled={isSettingOnchain || isConfirmingOnchain}
                          onClick={() => {
                            if (activeAddress && profile?.username) {
                              toast.info('Claiming username on Arc...')
                              setOnchainProfile(
                                profile.username,
                                profile.avatarUrl,
                                profile.avatarSeed,
                                profile.avatarStyle,
                                activeChainId
                              )
                            }
                          }}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 bg-gray-100/90 hover:bg-gray-200/80 px-2.5 py-0.5 rounded-full border border-gray-200/60 shrink-0 transition-all cursor-pointer active:scale-95 disabled:opacity-75 disabled:pointer-events-none"
                          title="Click to claim username onchain"
                        >
                          {isSettingOnchain || isConfirmingOnchain ? (
                            <>
                              <Loader2 size={11} className="animate-spin text-purple-600" />
                              <span>Claiming...</span>
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              <span>Unclaimed</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-1 flex items-center">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="group/addr inline-flex items-center gap-1.5 rounded-full bg-gray-100/80 hover:bg-gray-200/70 px-2.5 py-1 text-[11px] font-mono font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                    title="Click to copy address"
                  >
                    <span>{shortAddr || '0x0000...0000'}</span>
                    {copied ? (
                      <Check size={11} className="text-emerald-600 stroke-[2.5]" />
                    ) : (
                      <Copy size={11} className="text-gray-400 group-hover/addr:text-gray-700" />
                    )}
                  </button>
                </div>

                <div className="mt-3 rounded-2xl bg-gradient-to-br from-purple-500/[0.04] via-violet-500/[0.06] to-indigo-500/[0.03] p-3.5 border border-purple-100/80 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                        <TokenUSDC variant="branded" size={13} />
                      </div>
                      <span className="text-xs font-semibold text-gray-500">USDC Balance</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-extrabold text-gray-950 tracking-tight tabular-nums">
                        ${balanceHuman}
                      </span>
                      <span className="text-xs font-bold text-gray-400">USDC</span>
                    </div>
                  </div>

                  {selectedNetwork === 'testnet' && (
                    <a
                      href="https://faucet.circle.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-purple-100/90 hover:bg-purple-200 px-3 py-1 text-xs font-bold text-purple-700 hover:text-purple-900 transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title="Get free Circle USDC"
                    >
                      <span>Faucet</span>
                    </a>
                  )}
                </div>

                <div className={`mt-3.5 ${hasEmbeddedWallet ? 'grid grid-cols-2 gap-2.5' : ''}`}>
                  {hasEmbeddedWallet && (
                    <button
                      type="button"
                      onClick={handleExportWallet}
                      title="Export Private Key"
                      className="group/exp flex items-center justify-center gap-1.5 rounded-2xl bg-gray-50/90 hover:bg-gray-100 text-gray-600 hover:text-gray-900 py-2.5 px-3 text-xs font-semibold transition-all active:scale-[0.98] border border-gray-200/75 hover:border-gray-300 shadow-2xs cursor-pointer"
                    >
                      <KeyRound size={13} className="text-gray-400 group-hover/exp:text-gray-700 transition-colors shrink-0" />
                      <span className="truncate">Export Key</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDisconnectClick}
                    title="Disconnect Wallet"
                    className="group/dc flex items-center justify-center gap-1.5 rounded-2xl bg-gray-50/90 hover:bg-gray-100 text-gray-600 hover:text-gray-900 py-2.5 px-3 text-xs font-semibold transition-all active:scale-[0.98] border border-gray-200/75 hover:border-gray-300 shadow-2xs cursor-pointer"
                  >
                    <LogOut size={13} className="text-gray-400 group-hover/dc:text-gray-700 transition-colors shrink-0" />
                    <span className="truncate">Disconnect</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Lobby({ initialCategory, onCreateRoom, onJoinRoom, onContinueGame, onDisconnect }: LobbyProps) {
  const [selected, setSelected] = useState<Category | null>(() => initialCategory ?? 'General Knowledge')
  const [activeSession, setActiveSession] = useState<ActiveGameSession | null>(() => getActiveGame())
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [howToPlayOpen, setHowToPlayOpen] = useState(false)
  const { liveRooms, totalCount } = useLiveRooms(1500)
  const {
    dailyLeaderboard,
    allTimeLeaderboard,
    totalToday,
    totalAllTime,
    latestPayout,
    recentPayouts,
  } = useLiveWinners()
  const [winnerTimeframe, setWinnerTimeframe] = useState<'daily' | 'all-time'>('daily')
  const activeLeaderboard = winnerTimeframe === 'daily' ? dailyLeaderboard : allTimeLeaderboard
  const activeTotal = winnerTimeframe === 'daily' ? totalToday : totalAllTime

  const { user } = usePrivy()
  const { address: wagmiAddress } = useAccount()
  const activeAddress = wagmiAddress || user?.wallet?.address || ''

  const [pendingPayouts, setPendingPayouts] = useState<PendingPayoutRoom[]>(() => getPendingPayoutRooms(activeAddress))
  const [pendingRefunds, setPendingRefunds] = useState<PendingRefundRoom[]>(() => getPendingRefundRooms(activeAddress))

  useEffect(() => {
    setPendingPayouts(getPendingPayoutRooms(activeAddress))
    setPendingRefunds(getPendingRefundRooms(activeAddress))
  }, [activeAddress, activeSession])

  // Find the group that contains the initial/selected category
  const [activeGroupId, setActiveGroupId] = useState<string>(() => {
    if (initialCategory) {
      const match = CATEGORY_GROUPS.find(g => g.subcategories.some(s => s.id === initialCategory))
      if (match) return match.id
    }
    return 'crypto_markets'
  })

  useEffect(() => {
    setActiveSession(getActiveGame())
    if (selected) prefetchCategoryQuestions(selected)
  }, [selected])

  const handleSelectGroup = (groupId: string) => {
    setActiveGroupId(groupId)
    const group = CATEGORY_GROUPS.find(g => g.id === groupId)
    if (group && group.subcategories.length > 0) {
      // If current selected category is not in this group, select the first one
      const hasCurrent = group.subcategories.some(s => s.id === selected)
      if (!hasCurrent) {
        handleSelectCategory(group.subcategories[0].id)
      }
    }
  }

  const handleSelectCategory = (cat: Category) => {
    setSelected(cat)
    prefetchCategoryQuestions(cat)
    try {
      const stored = { name: 'lobby', initialCategory: cat }
      sessionStorage.setItem('trivio_current_screen', JSON.stringify(stored))
      localStorage.setItem('trivio_current_screen', JSON.stringify(stored))
    } catch {
      // ignore
    }
  }

  const currentGroup = CATEGORY_GROUPS.find(g => g.id === activeGroupId) ?? CATEGORY_GROUPS[0]
  const currentSubInfo = CATEGORY_GROUPS.flatMap(g => g.subcategories).find(s => s.id === selected)

  const getCategoryEmoji = (category: string) => {
    for (const group of CATEGORY_GROUPS) {
      const sub = group.subcategories.find((s) => s.id === category)
      if (sub) return sub.emoji
    }
    return '⚡'
  }

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] w-full flex-col overflow-x-hidden bg-[#fafafa]">
      {/* Subtle light background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '-10%', left: '-8%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: '-5%', right: '-6%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)', filter: 'blur(65px)' }} />
      </div>

      {/* ── Top Navbar ── */}
      <header className="sticky top-0 z-40 w-full bg-transparent px-3.5 sm:px-6 md:px-8 py-3.5 sm:py-4 flex items-center justify-between">
        <div className="flex items-center">
          <img
            src="/trivio-logo.png"
            alt="trivio"
            className="h-[105px] sm:h-[125px] w-auto select-none object-contain mix-blend-multiply -my-8 sm:-my-10 -ml-3 sm:-ml-4 cursor-pointer hover:opacity-90 transition-opacity"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setHowToPlayOpen(true)}
            title="How to Play"
            aria-label="How to Play"
            className="flex items-center justify-center gap-1.5 h-8 w-8 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 active:bg-slate-200/80 transition-all cursor-pointer active:scale-95"
          >
            <HelpCircle size={16} className="text-slate-500 shrink-0" />
            <span className="hidden sm:inline text-xs font-semibold text-slate-600">
              How to Play
            </span>
          </button>
          <WalletProfile onDisconnect={onDisconnect} />
        </div>
      </header>

      {/* ── Main Game Hub Content ── */}
      <main
        className="relative z-10 flex flex-1 flex-col items-center justify-start px-3.5 sm:px-6 pt-2 w-full max-w-lg sm:max-w-2xl md:max-w-3xl mx-auto"
        style={{
          paddingBottom: 'max(6.5rem, calc(env(safe-area-inset-bottom, 20px) + 5rem))',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full space-y-4"
        >
          {/* ── Player Pending Refund Reminder Banner ── */}
          {pendingRefunds.length > 0 && onContinueGame && (
            <div className="space-y-2">
              {pendingRefunds.map((pending) => (
                <motion.div
                  key={`pending-refund-${pending.roomCode}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-rose-500/15 via-rose-500/8 to-amber-500/10 p-3.5 sm:p-4 border border-rose-200/90 shadow-xs transition-all"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-amber-950 shadow-xs">
                      <AlertTriangle size={20} className="stroke-[2.2]" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                          {pending.roomCode}
                        </span>
                        <span className="inline-flex items-center text-[10px] sm:text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200/80">
                          REFUND AVAILABLE
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-600 truncate mt-0.5 font-medium">
                        {pending.buyIn ? `$${pending.buyIn} USDC entry fee · ` : ''}Room was cancelled. Claim your 100% refund!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        saveRoomCancelledState(pending.roomCode, true)
                        onContinueGame(pending.roomCode, pending.category)
                      }}
                      className="inline-flex items-center justify-center rounded-xl px-3.5 sm:px-4 py-2 text-xs font-bold text-white shadow-xs transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600"
                    >
                      <span>Claim Refund</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Host Pending Payouts Fallback Reminder ── */}
          {pendingPayouts.length > 0 && onContinueGame && (
            <div className="space-y-2">
              {pendingPayouts.map((pending) => (
                <motion.div
                  key={`pending-payout-${pending.roomCode}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/8 to-purple-500/10 p-3.5 sm:p-4 border border-amber-300/80 shadow-xs transition-all"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-amber-950 shadow-xs">
                      <Trophy size={20} className="stroke-[2.2]" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                          {pending.roomCode}
                        </span>
                        <span className="inline-flex items-center text-[10px] sm:text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/40 text-amber-950 border border-amber-400/60">
                          PAYOUT PENDING
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-600 truncate mt-0.5 font-medium">
                        {pending.prize ? `$${pending.prize} USDC prize · ` : ''}Game finished. Finalize winner payout now!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        saveActiveGame(pending.roomCode, pending.category, true, 'finished', pending.score)
                        onContinueGame(pending.roomCode, pending.category)
                      }}
                      className="inline-flex items-center justify-center rounded-xl px-3.5 sm:px-4 py-2 text-xs font-bold text-white shadow-xs transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                      }}
                    >
                      <span>Pay Out Winners</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Active Session Recovery Banner (if not already in pending payouts) ── */}
          {activeSession && onContinueGame && !pendingPayouts.some(p => p.roomCode === activeSession.roomCode) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex items-center justify-between rounded-2xl bg-white p-3 sm:p-4 border border-gray-200/80 shadow-xs transition-all"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100/80">
                  <Dices size={17} className="text-purple-600" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                      {activeSession.roomCode}
                    </span>
                    <span className="text-[11px] sm:text-xs font-medium text-gray-500 truncate">
                      · {activeSession.category}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">
                    {activeSession.phase === 'finished'
                      ? (activeSession.isHost ? 'Game completed · Return to pay out winners' : 'Game completed · View final results')
                      : activeSession.isHost
                        ? 'Waiting for players · Return to manage your game'
                        : 'Game in progress · Return anytime to continue'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2.5">
                <button
                  onClick={() => {
                    const hostCat = getRoomCategory(activeSession.roomCode)
                    onContinueGame(activeSession.roomCode, hostCat || activeSession.category)
                  }}
                  className="rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-white transition-all shadow-xs active:scale-95 cursor-pointer hover:brightness-105"
                  style={{ background: 'var(--accent)' }}
                >
                  Resume
                </button>
                <button
                  onClick={() => {
                    clearActiveGame()
                    setActiveSession(null)
                  }}
                  className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Modern 2-Tier Game Mode Selector (Web3 Native UI) ── */}
          <section className="rounded-3xl bg-white p-3.5 sm:p-5 border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.05)] space-y-3.5">
            {/* Section Header */}
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="min-w-0">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Game Mode
                </h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Choose a genre, then select your game arena
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-slate-100 text-slate-900 border border-slate-200/70 whitespace-nowrap shrink-0">
                <Users size={12} className="text-slate-800 shrink-0" />
                <span className="whitespace-nowrap">2–30 Players</span>
              </span>
            </div>

            {/* ── Tier 1: Modern Segmented Track (Full titles, responsive) ── */}
            <div className="p-1 bg-slate-100/90 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-1 border border-slate-200/60">
              {CATEGORY_GROUPS.map((group) => {
                const isGroupActive = activeGroupId === group.id
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleSelectGroup(group.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 sm:px-3 text-xs transition-all duration-150 cursor-pointer select-none text-center ${isGroupActive
                      ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/60 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 font-semibold'
                      }`}
                  >
                    <span className="text-sm shrink-0 leading-none">{group.emoji}</span>
                    <span className="tracking-tight leading-tight text-[11px] sm:text-xs whitespace-normal sm:whitespace-nowrap">
                      {group.name}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* ── Tier 2: Tactile Sub-Game Mode Cards (No Checkmarks) ── */}
            <div className="space-y-2 pt-0.5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentGroup.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-2"
                >
                  {currentGroup.subcategories.map((sub) => {
                    const isSubSelected = selected === sub.id

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSelectCategory(sub.id)}
                        className={`group w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl text-left transition-all duration-150 cursor-pointer active:scale-[0.99] ${isSubSelected
                          ? 'bg-violet-50/40 border-[1.5px] border-violet-600 shadow-[0_2px_8px_-2px_rgba(124,58,237,0.12)]'
                          : 'bg-slate-50/60 hover:bg-white border border-slate-200/75 hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                          }`}
                      >
                        {/* Mode Info */}
                        <div className="flex items-start gap-3 min-w-0 pr-2">
                          <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white border border-slate-200/80 text-lg shadow-[0_1px_2px_rgba(0,0,0,0.04)] shrink-0 mt-0.5">
                            {sub.emoji}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs sm:text-sm tracking-tight ${isSubSelected ? 'font-extrabold text-violet-950' : 'font-bold text-slate-900'}`}>
                                {sub.name}
                              </span>
                              {sub.badge && (
                                <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200/70 px-1.5 py-0.2 rounded-md">
                                  {sub.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-1">
                              {sub.tagline}
                            </p>
                          </div>
                        </div>

                        {/* Right Specs: Player Capacity */}
                        <div className="flex items-center text-[11px] font-medium font-mono shrink-0 ml-2">
                          <span className="text-slate-700 font-semibold px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200/60">
                            {sub.playerCapacity}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {/* ── Feature 3: ⚡ Solo Practice Mode Banner ── */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-3xl bg-gradient-to-r from-amber-500/10 via-violet-500/5 to-slate-50 border border-amber-200/80 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                <Zap size={20} className="fill-current" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">Solo Practice</span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5 truncate">
                  5 rapid questions · Test timer & answer speed risk-free
                </p>
              </div>
            </div>

            <button
              onClick={() => setPracticeOpen(true)}
              className="shrink-0 ml-3 inline-flex items-center justify-center rounded-xl px-3.5 sm:px-4 py-2 text-xs font-extrabold text-slate-900 bg-white hover:bg-slate-50 border border-slate-300/80 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span>Practice</span>
            </button>
          </div>

          {/* ── Action cards (Create & Join) ── */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
            {/* Create Room */}
            <button
              onClick={() => {
                if (!selected) {
                  toast.error('Please select a category first')
                  return
                }
                onCreateRoom(selected)
              }}
              className="group flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-3xl p-3.5 sm:py-5 text-center transition-all duration-200 hover:brightness-105 active:scale-95 shadow-md cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                boxShadow: '0 8px 24px -4px rgba(124, 58, 237, 0.28)',
              }}
            >
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-white/20 text-white backdrop-blur-md transition-transform duration-200 group-hover:scale-110">
                <Plus size={18} className="stroke-[2.5]" />
              </div>
              <div>
                <p className="text-xs sm:text-base font-extrabold text-white tracking-tight">Create Room</p>
                <p className="text-[10px] sm:text-[11px] text-white/80 font-medium">Host a game</p>
              </div>
            </button>

            {/* Join Room */}
            <button
              onClick={() => {
                const pending = getPendingJoin()
                const pendingCat = pending?.roomCode ? getRoomCategory(pending.roomCode) || pending.category : undefined
                onJoinRoom(pendingCat || selected || 'General Knowledge', pending?.roomCode)
              }}
              className="group flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-3xl p-3.5 sm:py-5 text-center transition-all duration-200 bg-white hover:bg-violet-50/50 active:scale-95 border-2 border-purple-100 hover:border-purple-300 shadow-sm cursor-pointer"
            >
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-purple-50 text-purple-700 transition-transform duration-200 group-hover:scale-110">
                <LogIn size={18} className="stroke-[2.5]" />
              </div>
              <div>
                <p className="text-xs sm:text-base font-extrabold text-gray-900 tracking-tight">Join Room</p>
                <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">Enter a code</p>
              </div>
            </button>
          </div>

          {/* ── Feature: 🔴 Live Rooms ── */}
          <section className="rounded-3xl bg-white p-3.5 sm:p-5 border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.05)] space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100/80">
                  <Activity size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                      Live Rooms
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      <span className={`h-1.5 w-1.5 rounded-full ${totalCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {totalCount} Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Open lobbies ready to play · Join directly with 1-click
                  </p>
                </div>
              </div>
            </div>

            {/* Room List or Empty State */}
            {liveRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 text-center rounded-2xl bg-slate-50/70 border border-slate-200/80">
                <p className="text-xs font-bold text-slate-800">No active rooms open right now</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                  Create a room to start playing with others, or enter a room code directly to join a private match.
                </p>
                <button
                  type="button"
                  onClick={() => onCreateRoom(selected || 'General Knowledge')}
                  className="mt-3.5 inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Create Live Room
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {liveRooms.map((room) => {
                  const emoji = getCategoryEmoji(room.category)
                  const isFull = room.playerCount >= room.maxPlayers

                  return (
                    <div
                      key={room.roomCode}
                      className="group relative flex items-center justify-between p-2.5 sm:p-3.5 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-150 gap-2 sm:gap-4"
                    >
                      {/* Left: Info */}
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200/80 text-lg sm:text-xl shadow-xs">
                          {emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight truncate">
                              {room.category}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(room.roomCode)
                                toast.success(`Copied room code ${room.roomCode}`)
                              }}
                              className="font-mono text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 cursor-pointer shadow-2xs transition-colors shrink-0"
                              title="Click to copy room code"
                            >
                              #{room.roomCode}
                            </button>
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate mt-0.5">
                            Host: <span className="text-slate-700 font-semibold">{room.hostName}</span>
                            <span className="mx-1 text-slate-300">·</span>
                            {room.buyIn === '0.00' || room.isSponsored ? (
                              <span>0 USDC (+ gas)</span>
                            ) : (
                              <span>{room.buyIn} USDC</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right: Stats & Join Button */}
                      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        {/* Player count pill */}
                        <div className="hidden xs:flex sm:flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-xl bg-white border border-slate-200/70 text-[10px] font-bold text-slate-700 shadow-2xs">
                          <Users size={11} className="text-slate-500" />
                          <span>{room.playerCount}/{room.maxPlayers}</span>
                        </div>

                        {/* Prize Pool pill */}
                        <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-white border border-slate-200/70 text-[10px] font-bold text-slate-700 shadow-2xs">
                          <TokenUSDC variant="branded" size={11} />
                          <span>${room.prizePool}</span>
                        </div>

                        {/* Join Action */}
                        <button
                          type="button"
                          disabled={isFull}
                          onClick={() => {
                            saveRoomCategory(room.roomCode, room.category)
                            onJoinRoom(room.category, room.roomCode)
                          }}
                          className="inline-flex items-center justify-center rounded-xl px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold text-gray-900 bg-white active:scale-95 border-2 border-purple-100 shadow-xs transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 hover:border-purple-300 hover:bg-purple-50/50"
                        >
                          <span>Join</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Feature: 🏆 Top Winners (Modern List Style & Live Payout Stream) ── */}
          <section className="rounded-3xl bg-white p-3.5 sm:p-5 border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.05)] space-y-3.5">
            {/* Header with Segmented Timeframe Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-0.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 shrink-0">
                  <Trophy size={16} />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                    {winnerTimeframe === 'daily' ? 'Top Daily Winners' : 'All-Time Champions'}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {winnerTimeframe === 'daily'
                      ? 'Live 24h leaderboard earning USDC on Arc'
                      : 'Lifetime champions earning USDC on Arc'}
                  </p>
                </div>
              </div>

              {/* Segmented Timeframe Switcher */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/60 self-start sm:self-auto shadow-2xs">
                <button
                  type="button"
                  onClick={() => setWinnerTimeframe('daily')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    winnerTimeframe === 'daily'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Today (24h)
                </button>
                <button
                  type="button"
                  onClick={() => setWinnerTimeframe('all-time')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    winnerTimeframe === 'all-time'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All-Time
                </button>
              </div>
            </div>

            {/* Leaderboard content: empty state or modern list layout */}
            {activeLeaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-7 px-4 text-center rounded-2xl bg-slate-50/70 border border-slate-200/80">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-2 shadow-2xs">
                  <Trophy size={20} />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {winnerTimeframe === 'daily'
                    ? 'No daily winners yet in the last 24h'
                    : 'No winners recorded yet'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                  Join or create a live trivia match and win USDC to claim your spot on the leaderboard!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {activeLeaderboard.slice(0, 5).map((winner, idx) => (
                  <LeaderboardListItem
                    key={winner.address + idx}
                    winner={winner}
                    rankIndex={idx}
                  />
                ))}
              </div>
            )}

            {/* Live Payout Stream Ticker (Clean & No Emojis) */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold text-slate-800 tracking-tight">Latest Payout:</span>
              </span>
              <LatestPayoutTicker recentPayouts={recentPayouts} latestPayout={latestPayout} />
            </div>
          </section>

          {/* ── Footer onchain info badge ── */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-center text-[11px] sm:text-xs font-semibold text-gray-500 pt-1 px-2">
            <TokenUSDC variant="branded" size={14} />
            <span>All prizes paid in USDC on Arc — instant onchain payouts straight to your wallet.</span>
          </div>
        </motion.div>
      </main>

      {/* ── Solo Practice Modal ── */}
      <SoloPracticeModal
        isOpen={practiceOpen}
        category={selected || 'General Knowledge'}
        onClose={() => setPracticeOpen(false)}
        onPlayMultiplayer={(cat) => {
          setPracticeOpen(false)
          onCreateRoom(cat)
        }}
      />

      {/* ── How to Play Guide Modal ── */}
      <HowToPlayModal
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  )
}
