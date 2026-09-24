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
  Radio,
  KeyRound,
} from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import {
  getUserProfile,
  saveUserProfile,
  getDiceBearAvatarUrl,
  DICEBEAR_STYLES,
  type UserProfile,
} from '@/lib/userProfile'
import { useUsdcBalance, formatUSDCRaw } from '@/hooks/useTriviaContract'
import { ARC_TESTNET_CHAIN_ID, ARC_MAINNET_CHAIN_ID } from '@/config'
import {
  type Category,
  CATEGORY_GROUPS,
  type CategoryGroup,
  type SubCategoryInfo,
} from '@/lib/questions'
import { getActiveGame, clearActiveGame, type ActiveGameSession } from '@/lib/roomStorage'
import SoloPracticeModal from '@/components/SoloPracticeModal'
import { INITIAL_PUBLIC_ROOMS, TOP_LEADERBOARD, RECENT_WINNERS_FEED } from '@/lib/lobbyData'

interface LobbyProps {
  initialCategory?: Category | null
  onCreateRoom: (category: Category) => void
  onJoinRoom: (category: Category, prefillCode?: string) => void
  onContinueGame?: (roomCode: string, category: Category) => void
  onDisconnect?: () => void
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

  const [profile, setProfile] = useState<UserProfile | null>(() => getUserProfile())
  const [avatarImgError, setAvatarImgError] = useState(false)
  const privyWalletAddress = user?.wallet?.address as `0x${string}` | undefined
  const activeAddress = wagmiAddress || privyWalletAddress || '0x0000000000000000000000000000000000000000'

  useEffect(() => {
    setAvatarImgError(false)
  }, [profile?.avatarUrl])

  useEffect(() => {
    const p = getUserProfile()
    if (p) {
      if (!p.avatarUrl) {
        const fixed: UserProfile = {
          ...p,
          avatarUrl: getDiceBearAvatarUrl(p.avatarStyle || 'bottts-neutral', p.avatarSeed || p.username),
        }
        saveUserProfile(fixed)
        setProfile(fixed)
      } else {
        setProfile(p)
      }
    }
  }, [activeAddress])

  const activeChainId = selectedNetwork === 'mainnet' ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID
  const { data: rawBalance } = useUsdcBalance(activeAddress as `0x${string}`, activeChainId)
  const balanceHuman = rawBalance !== undefined ? formatUSDCRaw(rawBalance) : '0.00'

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
    if (cleaned.length < 2) {
      toast.error('Username must be at least 2 characters')
      return
    }
    const updated: UserProfile = {
      username: cleaned,
      avatarUrl: profile?.avatarUrl || getDiceBearAvatarUrl('bottts-neutral', cleaned),
      avatarSeed: profile?.avatarSeed || cleaned,
      avatarStyle: profile?.avatarStyle || 'bottts-neutral',
      createdAt: profile?.createdAt || Date.now(),
    }
    saveUserProfile(updated)
    setProfile(updated)
    setIsEditingName(false)
    toast.success('Username updated!')
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

          const currentUsername = profile?.username || 'player'
          const updated: UserProfile = {
            username: currentUsername,
            avatarUrl: compressedDataUrl,
            avatarSeed: 'custom_upload',
            avatarStyle: 'custom',
            createdAt: profile?.createdAt || Date.now(),
          }
          saveUserProfile(updated)
          setProfile(updated)
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

    const randomStyle = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)].id
    const randomSeed = `p_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    const newAvatarUrl = getDiceBearAvatarUrl(randomStyle, randomSeed)

    const updated: UserProfile = {
      username: profile?.username || (displayName.replace(/^@/, '') || 'player'),
      avatarUrl: newAvatarUrl,
      avatarSeed: randomSeed,
      avatarStyle: randomStyle,
      createdAt: profile?.createdAt || Date.now(),
    }
    saveUserProfile(updated)
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
  const displayName = profile?.username ? `@${profile.username}` : (shortAddr || 'player')

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Chip Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="group flex items-center gap-2 sm:gap-2.5 rounded-full border border-gray-200/90 bg-white/90 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3.5 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-gray-900 shadow-xs backdrop-blur-md transition-all hover:border-gray-300 hover:bg-white hover:shadow-sm active:scale-95 cursor-pointer"
        style={{ letterSpacing: '-0.01em' }}
      >
        <div className="relative flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 overflow-hidden ring-1 ring-black/5">
          {profile?.avatarUrl && !avatarImgError ? (
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              className="h-full w-full object-cover"
              onError={() => setAvatarImgError(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-purple-100 text-purple-700 font-bold text-[10px] sm:text-xs">
              {displayName.replace(/^@/, '').slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <span className="font-semibold text-[11px] sm:text-sm text-gray-900 max-w-[120px] sm:max-w-[160px] truncate tracking-tight">
          {displayName}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 transition-transform duration-200 ease-out group-hover:text-gray-600 ${open ? 'rotate-180 text-gray-700' : ''}`}
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
                          src={profile.avatarUrl}
                          alt=""
                          className="h-full w-full rounded-[14px] object-cover bg-gray-50 transition-transform duration-300 group-hover/avatar:scale-105"
                          onError={() => setAvatarImgError(true)}
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
                      onClick={handleRandomizeAvatar}
                      title="Roll random avatar"
                      className="absolute -bottom-1 -right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-700 hover:text-purple-600 hover:bg-purple-50 shadow-sm border border-gray-200/90 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                    >
                      <Dices
                        size={12}
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
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleSaveName()
                      }}
                      className="flex items-center gap-1 pb-0.5 border-b border-purple-300/80 focus-within:border-purple-500/70 transition-colors"
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
                          title="Save (Enter)"
                          className="flex h-5 w-5 items-center justify-center rounded text-purple-600 hover:text-purple-800 hover:bg-purple-50 active:scale-90 transition-all cursor-pointer"
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
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartEditName}
                      className="group/name flex items-center gap-1.5 text-left cursor-pointer rounded-lg -ml-1 px-1 py-0.5"
                      title="Click to edit username"
                    >
                      <h3 className="text-sm font-medium text-gray-800">
                        {profile?.username ? `@${profile.username}` : 'Anonymous Player'}
                      </h3>
                      <ShieldCheck size={13} className="text-purple-600 shrink-0" />
                      <Pencil size={10} className="text-gray-300 group-hover/name:text-gray-500 transition-colors ml-0.5" />
                    </button>
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
                      className="rounded-full bg-purple-100/90 hover:bg-purple-200 px-3 py-1 text-[11px] font-bold text-purple-700 transition-colors shadow-2xs"
                      title="Get free Circle USDC"
                    >
                      Faucet
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
  }, [])

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

        <div className="flex items-center gap-2">
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
          {/* ── Active Session Recovery Banner ── */}
          {activeSession && onContinueGame && (
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
                    {activeSession.isHost
                      ? 'Waiting for players · Return to manage your game'
                      : 'Game in progress · Return anytime to continue'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2.5">
                <button
                  onClick={() => onContinueGame(activeSession.roomCode, activeSession.category)}
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
                <span className="whitespace-nowrap">10–50 Players</span>
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
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 sm:px-3 text-xs transition-all duration-150 cursor-pointer select-none text-center ${
                      isGroupActive
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
                        className={`group w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl text-left transition-all duration-150 cursor-pointer active:scale-[0.99] ${
                          isSubSelected
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
              onClick={() => onJoinRoom(selected || 'General Knowledge')}
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
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100/80">
                  <Radio size={16} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                      Live Rooms
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200/60 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                      {INITIAL_PUBLIC_ROOMS.length} Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Open lobbies ready to play · Join directly with 1-click
                  </p>
                </div>
              </div>
            </div>

            {/* Room List */}
            <div className="space-y-2 pt-1">
              {INITIAL_PUBLIC_ROOMS.map((room) => {
                const emoji = getCategoryEmoji(room.category)
                const isFull = room.playerCount >= room.maxPlayers

                return (
                  <div
                    key={room.roomCode}
                    className="group relative flex items-center justify-between p-2.5 sm:p-3.5 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-violet-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-150 gap-2 sm:gap-4"
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
                          {room.buyIn === '0.00' ? (
                            <span className="text-emerald-600 font-bold">Free</span>
                          ) : (
                            <span>{room.buyIn} USDC</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Stats & Join Button */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                      {/* Player count pill (hidden on very narrow screens, visible on sm) */}
                      <div className="hidden xs:flex sm:flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-xl bg-white border border-slate-200/70 text-[10px] font-bold text-slate-700 shadow-2xs">
                        <Users size={11} className="text-slate-500" />
                        <span>{room.playerCount}/{room.maxPlayers}</span>
                      </div>

                      {/* Prize Pool pill */}
                      <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-violet-50 border border-violet-200/70 text-[10px] font-black text-violet-900 shadow-2xs">
                        <TokenUSDC variant="branded" size={11} />
                        <span>${room.prizePool}</span>
                      </div>

                      {/* Join Action */}
                      <button
                        type="button"
                        disabled={isFull}
                        onClick={() => onJoinRoom(room.category, room.roomCode)}
                        className="inline-flex items-center justify-center rounded-xl px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 active:scale-95 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        <span>Join</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Feature: 🏆 Top Daily Winners ── */}
          <section className="rounded-3xl bg-white p-3.5 sm:p-5 border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.05)] space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70">
                  <Trophy size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                      Top Daily Winners
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <Flame size={11} className="text-amber-600 fill-amber-500" />
                      $1,230 Today
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Leaderboard champions earning USDC on Arc Testnet
                  </p>
                </div>
              </div>
            </div>

            {/* Podium (Top 3) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {TOP_LEADERBOARD.slice(0, 3).map((winner, idx) => {
                const podiumColors = [
                  {
                    border: 'border-amber-300',
                    bg: 'bg-gradient-to-b from-amber-500/10 via-amber-50/50 to-white',
                    badge: 'bg-amber-400 text-amber-950',
                    medal: '🥇',
                  },
                  {
                    border: 'border-slate-300',
                    bg: 'bg-gradient-to-b from-slate-200/40 via-slate-50/50 to-white',
                    badge: 'bg-slate-300 text-slate-900',
                    medal: '🥈',
                  },
                  {
                    border: 'border-amber-700/30',
                    bg: 'bg-gradient-to-b from-amber-700/10 via-amber-50/30 to-white',
                    badge: 'bg-amber-700/30 text-amber-950',
                    medal: '🥉',
                  },
                ]
                const style = podiumColors[idx]
                const avatar = getDiceBearAvatarUrl('bottts-neutral', winner.avatarSeed)

                return (
                  <div
                    key={winner.username}
                    className={`relative flex flex-col items-center text-center p-3 rounded-2xl border ${style.border} ${style.bg} shadow-xs transition-all hover:scale-[1.02]`}
                  >
                    {/* Rank Badge */}
                    <div className="absolute -top-2.5 flex items-center justify-center">
                      <span className={`text-[10px] font-black px-2 py-0.2 rounded-full shadow-2xs ${style.badge}`}>
                        #{winner.rank}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div className="mt-1 relative">
                      <img
                        src={avatar}
                        alt={winner.username}
                        className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white border border-slate-200/80 shadow-xs object-cover p-0.5"
                      />
                      <span className="absolute -bottom-1 -right-1 text-xs">
                        {style.medal}
                      </span>
                    </div>

                    {/* Username */}
                    <span className="text-xs font-bold text-slate-900 tracking-tight mt-1.5 truncate max-w-[90%]">
                      {winner.username}
                    </span>

                    {/* USDC Won */}
                    <div className="flex items-center gap-1 mt-0.5">
                      <TokenUSDC variant="branded" size={11} />
                      <span className="text-xs sm:text-sm font-black text-slate-950 tabular-nums">
                        ${winner.totalWinnings}
                      </span>
                    </div>

                    {/* Streak / Wins */}
                    <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      {winner.winCount} wins · {winner.winStreak}🔥
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Runners Up (Ranks 4 & 5) */}
            <div className="space-y-1.5 pt-1">
              {TOP_LEADERBOARD.slice(3, 5).map((entry) => {
                const avatar = getDiceBearAvatarUrl('bottts-neutral', entry.avatarSeed)
                return (
                  <div
                    key={entry.username}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-black text-slate-400 w-4 text-center">
                        #{entry.rank}
                      </span>
                      <img
                        src={avatar}
                        alt={entry.username}
                        className="h-7 w-7 rounded-full bg-white border border-slate-200 shadow-2xs object-cover p-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {entry.username}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {entry.winCount} wins · {entry.winStreak} streak
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <TokenUSDC variant="branded" size={11} />
                      <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                        ${entry.totalWinnings}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Recent Winners Live Stream Ticker */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
                <Sparkles size={12} className="text-violet-600" />
                Latest Payout:
              </span>
              <span className="text-slate-600 truncate ml-2 text-right">
                <strong className="text-slate-900">{RECENT_WINNERS_FEED[0]?.username}</strong> won{' '}
                <strong className="text-emerald-700 font-bold">${RECENT_WINNERS_FEED[0]?.amount} USDC</strong> in {RECENT_WINNERS_FEED[0]?.category} ({RECENT_WINNERS_FEED[0]?.timeAgo})
              </span>
            </div>
          </section>

          {/* ── Footer onchain info badge ── */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-center text-[11px] sm:text-xs font-semibold text-gray-500 pt-1 px-2">
            <TokenUSDC variant="branded" size={13} />
            <span>Prizes paid in USDC on Arc Testnet · instant, zero gas fee</span>
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
    </div>
  )
}
