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
  ExternalLink,
  Pencil,
  ShieldCheck,
  Camera,
  Sparkles,
  Dices,
  X,
  Play,
  ArrowRight,
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
import type { Category } from '@/lib/questions'
import { getActiveGame, clearActiveGame, type ActiveGameSession } from '@/lib/roomStorage'

const CATEGORIES: { label: Category; emoji: string }[] = [
  { label: 'General Knowledge', emoji: '🧠' },
  { label: 'Crypto', emoji: '⚡' },
  { label: 'Sports', emoji: '🏆' },
  { label: 'Pop Culture', emoji: '🎬' },
  { label: 'Science', emoji: '🔬' },
  { label: 'History', emoji: '📜' },
]

interface LobbyProps {
  initialCategory?: Category | null
  onCreateRoom: (category: Category) => void
  onJoinRoom: (category: Category) => void
  onContinueGame?: (roomCode: string, category: Category) => void
  onDisconnect?: () => void
}

function WalletProfile({ onDisconnect }: { onDisconnect?: () => void }) {
  const { address: wagmiAddress, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, switchChainAsync } = useSwitchChain()
  const { user, logout } = usePrivy()
  const { wallets } = useWallets()

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

                <div className="mt-3.5">
                  <button
                    type="button"
                    onClick={handleDisconnectClick}
                    className="group/dc w-full flex items-center justify-center gap-2 rounded-2xl bg-gray-50/90 hover:bg-gray-100 text-gray-600 hover:text-gray-900 py-2.5 text-xs font-semibold transition-all active:scale-[0.98] border border-gray-200/75 hover:border-gray-300 shadow-2xs cursor-pointer"
                  >
                    <LogOut size={13} className="text-gray-400 group-hover/dc:text-gray-700 transition-colors" />
                    <span>Disconnect</span>
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
  const [selected, setSelected] = useState<Category | null>(() => initialCategory ?? null)
  const [activeSession, setActiveSession] = useState<ActiveGameSession | null>(() => getActiveGame())

  useEffect(() => {
    setActiveSession(getActiveGame())
  }, [])

  const handleToggleCategory = (cat: Category) => {
    setSelected(prev => {
      const next = prev === cat ? null : cat
      try {
        const stored = { name: 'lobby', initialCategory: next }
        sessionStorage.setItem('trivio_current_screen', JSON.stringify(stored))
        localStorage.setItem('trivio_current_screen', JSON.stringify(stored))
      } catch {
        // ignore
      }
      return next
    })
  }

  const effectiveCategory = selected || 'General Knowledge'

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
      <main className="relative z-10 flex flex-1 flex-col items-center justify-start px-3.5 sm:px-6 pt-2 pb-8 sm:pt-6 sm:pb-10 w-full max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full space-y-3.5 sm:space-y-4"
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

          {/* ── Category Pill Selector ── */}
          <section className="rounded-2xl sm:rounded-3xl bg-white p-3.5 sm:p-5 border border-gray-200/80 shadow-xs space-y-2 sm:space-y-2.5">
            <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 pl-0.5">
              Categories
            </h2>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {CATEGORIES.map(({ label, emoji }) => {
                const active = selected === label
                return (
                  <button
                    key={label}
                    onClick={() => handleToggleCategory(label)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs active:scale-95 cursor-pointer select-none ${active
                        ? 'text-white font-semibold shadow-xs border border-transparent'
                        : 'bg-gray-100 hover:bg-gray-200/80 text-gray-800 border border-gray-200/60 font-medium'
                      }`}
                    style={active ? { background: 'var(--accent)' } : undefined}
                  >
                    <span className="text-sm leading-none">{emoji}</span>
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </section>

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
              className="group flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-3xl p-3.5 sm:py-5 text-center transition-all duration-200 hover:brightness-105 active:scale-95 shadow-md"
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
              className="group flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-3xl p-3.5 sm:py-5 text-center transition-all duration-200 bg-white hover:bg-violet-50/50 active:scale-95 border-2 border-purple-100 hover:border-purple-300 shadow-sm"
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

          {/* ── Footer onchain info badge ── */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-center text-[11px] sm:text-xs font-medium text-gray-500 pt-1 px-2">
            <TokenUSDC variant="branded" size={13} />
            <span>Prizes paid in USDC on Arc Testnet · instant, zero gas fee</span>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
