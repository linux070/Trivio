import { useState, useEffect, useMemo } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowLeft, Users, Check, Trophy } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import {
  useRoomInfo,
  useRoomPlayers,
  useIsPlayer,
  useJoinRoom,
  useApproveUsdc,
  useUsdcAllowance,
  useUsdcBalance,
  formatUSDCRaw,
  parseUSDC,
  type RoomTuple,
} from '@/hooks/useTriviaContract'
import { ARC_TESTNET_CHAIN_ID, TRIVIA_GAME_ADDRESS } from '@/config'
import { type Category, CATEGORY_GROUPS } from '@/lib/questions'
import {
  getRoomCategory,
  inferCategoryFromCode,
  saveRoomCategory,
  saveRoomPrize,
  getRoomPayout,
  calculatePayoutSplits,
  setPendingJoin,
  getPendingJoin,
  clearPendingJoin,
  getJoinParamsFromUrl,
  extractRoomCode,
  getRoomDuration,
  saveRoomDuration,
  saveActiveGame,
  saveCachedRoomSnapshot,
  getCachedRoomSnapshot,
} from '@/lib/roomStorage'
import { fetchRoomMetadata, fetchCloudLiveRooms } from '@/lib/roomDb'

const ROOM_STATUS = ['Open', 'In Progress', 'Finished', 'Cancelled']

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.46)',
    border: '1px solid rgba(255,255,255,0.56)',
  } as React.CSSProperties,
}

const STORAGE_JOIN_CODE_KEY = 'trivio_join_room_code'
const STORAGE_SCREEN_KEY = 'trivio_current_screen'

interface JoinRoomProps {
  initialCategory?: Category
  prefillCode?: string
  onBack: () => void
  onJoined: (code: string, category: Category) => void
}

export default function JoinRoom({ initialCategory = 'General Knowledge', prefillCode, onBack, onJoined }: JoinRoomProps) {
  const { address, chainId } = useAccount()
  const { user } = usePrivy()
  const { switchChain } = useSwitchChain()

  const privyWalletAddress = user?.wallet?.address as `0x${string}` | undefined
  const activeAddress = address || privyWalletAddress || undefined

  const resolveInitialCode = (): string => {
    // 1. Explicit prop from caller
    if (prefillCode && prefillCode.trim()) {
      const extracted = extractRoomCode(prefillCode.trim())
      if (extracted?.roomCode) {
        if (extracted.category) saveRoomCategory(extracted.roomCode, extracted.category)
        return extracted.roomCode
      }
      return prefillCode.trim().toUpperCase()
    }

    // 2. URL search parameters or URL hash (e.g. ?join=XYZ, ?code=XYZ, #/join/XYZ)
    const fromUrl = getJoinParamsFromUrl()
    if (fromUrl?.roomCode) {
      if (fromUrl.category) saveRoomCategory(fromUrl.roomCode, fromUrl.category)
      return fromUrl.roomCode
    }

    // 3. Direct window.location.hash check for #/join/ROOMCODE
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#/join/')) {
      const afterHash = window.location.hash.slice(7).split('?')[0]
      const extracted = extractRoomCode(afterHash)
      if (extracted?.roomCode) {
        if (extracted.category) saveRoomCategory(extracted.roomCode, extracted.category)
        return extracted.roomCode
      }
    }

    // 4. Stored pending join
    const pending = getPendingJoin()
    if (pending?.roomCode) {
      const extracted = extractRoomCode(pending.roomCode)
      const code = extracted ? extracted.roomCode : pending.roomCode.trim().toUpperCase()
      const cat = extracted?.category || pending.category
      if (cat) saveRoomCategory(code, cat)
      return code
    }

    // 5. Active join code stored in sessionStorage / localStorage
    try {
      const stored =
        sessionStorage.getItem(STORAGE_JOIN_CODE_KEY) ||
        localStorage.getItem(STORAGE_JOIN_CODE_KEY)
      if (stored) {
        const extracted = extractRoomCode(stored)
        if (extracted?.roomCode) {
          return extracted.roomCode
        }
      }
    } catch {
      // ignore
    }

    // 6. Stored screen prefillCode
    try {
      const rawScreen = sessionStorage.getItem(STORAGE_SCREEN_KEY) || localStorage.getItem(STORAGE_SCREEN_KEY)
      if (rawScreen) {
        const parsed = JSON.parse(rawScreen)
        if (parsed?.name === 'join' && parsed?.prefillCode) {
          return parsed.prefillCode
        }
      }
    } catch {
      // ignore
    }

    return ''
  }

  const initialCode = resolveInitialCode()
  const [input, setInput] = useState(initialCode)
  const [checkedCode, setCheckedCode] = useState<string | null>(initialCode || null)
  const [hostCategory, setHostCategory] = useState<Category | null>(() => {
    return initialCode ? (getRoomCategory(initialCode) || inferCategoryFromCode(initialCode)) : null
  })
  const [hostDuration, setHostDuration] = useState<number | null>(() => {
    return initialCode ? getRoomDuration(initialCode) : null
  })
  const [isResolvingCategory, setIsResolvingCategory] = useState(false)

  // Keep input and checkedCode synchronized whenever prefillCode prop updates or pending join exists
  useEffect(() => {
    if (prefillCode && prefillCode.trim()) {
      const extracted = extractRoomCode(prefillCode.trim())
      const code = extracted ? extracted.roomCode : prefillCode.trim().toUpperCase()
      if (extracted?.category) {
        setHostCategory(extracted.category)
        saveRoomCategory(code, extracted.category)
      }
      setInput(code)
      setCheckedCode(code)
      try {
        sessionStorage.setItem(STORAGE_JOIN_CODE_KEY, code)
        localStorage.setItem(STORAGE_JOIN_CODE_KEY, code)
      } catch {}
      setPendingJoin(code, extracted?.category || hostCategory || undefined)
    } else {
      const pending = getPendingJoin()
      if (pending?.roomCode) {
        const extracted = extractRoomCode(pending.roomCode)
        const code = extracted ? extracted.roomCode : pending.roomCode.trim().toUpperCase()
        const cat = extracted?.category || pending.category
        if (cat) {
          setHostCategory(cat)
          saveRoomCategory(code, cat)
        }
        setInput(code)
        setCheckedCode(code)
        try {
          sessionStorage.setItem(STORAGE_JOIN_CODE_KEY, code)
          localStorage.setItem(STORAGE_JOIN_CODE_KEY, code)
        } catch {}
      }
    }
  }, [prefillCode])

  // Fetch authoritative cloud metadata & host game mode whenever checkedCode changes
  useEffect(() => {
    if (!checkedCode) {
      setHostCategory(null)
      setHostDuration(null)
      setIsResolvingCategory(false)
      return
    }
    const cleanCode = checkedCode.trim().toUpperCase()
    const cachedCat = getRoomCategory(cleanCode) || inferCategoryFromCode(cleanCode)
    const cachedDur = getRoomDuration(cleanCode)
    if (cachedCat) setHostCategory(cachedCat)
    if (cachedDur) setHostDuration(cachedDur)

    // Sync to storage & URL hash
    try {
      sessionStorage.setItem(STORAGE_JOIN_CODE_KEY, cleanCode)
      localStorage.setItem(STORAGE_JOIN_CODE_KEY, cleanCode)
    } catch {}
    setPendingJoin(cleanCode, cachedCat || hostCategory || undefined)
    if (typeof window !== 'undefined' && window.location.hash !== `#/join/${cleanCode}`) {
      window.history.replaceState(null, '', `#/join/${cleanCode}`)
    }

    setIsResolvingCategory(true)
    let isCancelled = false

    void fetchRoomMetadata(cleanCode).then(async (meta) => {
      if (isCancelled) return
      if (meta?.category) {
        setHostCategory(meta.category)
        saveRoomCategory(cleanCode, meta.category)
        setPendingJoin(cleanCode, meta.category)
        if (meta.roundDuration) {
          setHostDuration(meta.roundDuration)
          saveRoomDuration(cleanCode, meta.roundDuration)
        }
        setIsResolvingCategory(false)
        return
      }

      // Secondary check: live rooms cloud registry
      try {
        const liveRooms = await fetchCloudLiveRooms()
        if (isCancelled) return
        const match = liveRooms.find((r) => r.roomCode.toUpperCase() === cleanCode)
        if (match?.category) {
          setHostCategory(match.category)
          saveRoomCategory(cleanCode, match.category)
          setPendingJoin(cleanCode, match.category)
          const matchedDuration = (match as any)?.roundDuration
          if (matchedDuration) {
            setHostDuration(Number(matchedDuration))
            saveRoomDuration(cleanCode, Number(matchedDuration))
          }
        }
      } catch {
        // ignore
      }
      if (!isCancelled) setIsResolvingCategory(false)
    })

    return () => {
      isCancelled = true
    }
  }, [checkedCode])

  // Resolving game mode: strictly prioritize host category over player's local lobby selection
  const resolvedCategory: Category =
    hostCategory ||
    (checkedCode ? getRoomCategory(checkedCode) : null) ||
    (checkedCode ? inferCategoryFromCode(checkedCode) : null) ||
    'General Knowledge'

  const cachedSnapshot = useMemo(() => {
    return checkedCode ? getCachedRoomSnapshot(checkedCode) : null
  }, [checkedCode])

  const { data: roomInfo, isLoading: roomLoading, error: roomError } = useRoomInfo(checkedCode, 1000)
  const { data: rawPlayersList } = useRoomPlayers(checkedCode, 1000)
  const { data: isPlayerOnchain } = useIsPlayer(checkedCode, activeAddress)

  // Cache onchain room data into local storage whenever received
  useEffect(() => {
    if (roomInfo && checkedCode) {
      const [h, bi, pp, mp, pc, st, pm] = roomInfo as RoomTuple
      saveCachedRoomSnapshot(checkedCode, {
        host: h,
        buyInHex: (bi ?? 0n).toString(),
        prizePoolHex: (pp ?? 0n).toString(),
        maxPlayers: mp,
        playerCount: pc,
        status: st,
        payoutMode: pm,
      })
    }
  }, [roomInfo, checkedCode])

  // Cache player list whenever received
  useEffect(() => {
    if (rawPlayersList && rawPlayersList.length > 0 && checkedCode) {
      saveCachedRoomSnapshot(checkedCode, {
        players: rawPlayersList as `0x${string}`[],
      })
    }
  }, [rawPlayersList, checkedCode])

  const [onchainHost, onchainBuyIn, onchainPrizePool, onchainMaxPlayers, onchainPlayerCount, onchainStatus, onchainPayoutMode] =
    (roomInfo as RoomTuple) ?? []

  const host = onchainHost ?? cachedSnapshot?.host
  const buyIn = onchainBuyIn !== undefined ? onchainBuyIn : (cachedSnapshot?.buyInHex !== undefined ? BigInt(cachedSnapshot.buyInHex) : undefined)
  const prizePool = onchainPrizePool !== undefined ? onchainPrizePool : (cachedSnapshot?.prizePoolHex !== undefined ? BigInt(cachedSnapshot.prizePoolHex) : undefined)
  const maxPlayers = onchainMaxPlayers ?? cachedSnapshot?.maxPlayers ?? 4
  const playerCount = onchainPlayerCount ?? cachedSnapshot?.playerCount ?? (rawPlayersList?.length || cachedSnapshot?.players?.length || 0)
  const status = onchainStatus !== undefined ? onchainStatus : (cachedSnapshot?.status ?? 0)
  const payoutMode = onchainPayoutMode !== undefined ? onchainPayoutMode : (cachedSnapshot?.payoutMode ?? 0)

  const effectivePlayersList = (rawPlayersList as `0x${string}`[] | undefined) || cachedSnapshot?.players || []
  const hasRoomData = Boolean(roomInfo || (cachedSnapshot && cachedSnapshot.host && cachedSnapshot.host !== '0x0000000000000000000000000000000000000000'))

  const isHost = Boolean(
    host && activeAddress && host.toLowerCase() === activeAddress.toLowerCase()
  )
  const isPlayerInList = Boolean(
    activeAddress && effectivePlayersList.some(p => p.toLowerCase() === activeAddress.toLowerCase())
  )
  const isAlreadyJoined = Boolean(isPlayerOnchain || isPlayerInList || isHost)

  const buyInHuman = buyIn !== undefined ? formatUSDCRaw(buyIn) : null
  const prizePoolHuman = prizePool !== undefined ? formatUSDCRaw(prizePool) : null
  const buyInNum = parseFloat(buyInHuman ?? '0') || 0
  const maxPlayersNum = maxPlayers || 4
  const currentPrizeNum = parseFloat(prizePoolHuman ?? '0') || 0
  const estimatedPrize = buyInNum > 0 ? (buyInNum * maxPlayersNum).toFixed(2) : (prizePoolHuman ?? '0')
  const prizeForPayouts = currentPrizeNum > 0 ? (prizePoolHuman ?? '0') : estimatedPrize

  const { data: rawBalance } = useUsdcBalance(activeAddress)
  const balanceHuman = rawBalance !== undefined ? formatUSDCRaw(rawBalance) : null

  const { data: rawAllowance, refetch: refetchAllowance } = useUsdcAllowance(
    activeAddress,
    TRIVIA_GAME_ADDRESS ?? undefined
  )

  const requiresApproval =
    !isAlreadyJoined &&
    buyIn !== undefined &&
    buyIn > 0n &&
    ((rawAllowance as bigint ?? 0n) < buyIn)

  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approved } = useApproveUsdc()
  const { joinRoom, isPending: joinPending, isConfirming: joinConfirming, isSuccess: joined } = useJoinRoom()

  useEffect(() => {
    if (approved) void refetchAllowance()
  }, [approved, refetchAllowance])

  useEffect(() => {
    if (joined && checkedCode) {
      toast.success(`Joined room ${checkedCode}!`)
      const finalCat = hostCategory || getRoomCategory(checkedCode) || resolvedCategory
      saveRoomCategory(checkedCode, finalCat)
      if (prizeForPayouts && Number(prizeForPayouts) > 0) {
        saveRoomPrize(checkedCode, prizeForPayouts)
      }
      try {
        sessionStorage.removeItem(STORAGE_JOIN_CODE_KEY)
        localStorage.removeItem(STORAGE_JOIN_CODE_KEY)
      } catch {}
      clearPendingJoin()
      onJoined(checkedCode, finalCat)
    }
  }, [joined, checkedCode, hostCategory, resolvedCategory, prizeForPayouts, onJoined])

  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID
  const isRoomOpen = status === 0
  const contractReady = Boolean(TRIVIA_GAME_ADDRESS)

  const handleInputChange = (raw: string) => {
    const clean = raw.toUpperCase()
    setInput(clean)
    if (clean.trim().length === 0) {
      setCheckedCode(null)
      try {
        sessionStorage.removeItem(STORAGE_JOIN_CODE_KEY)
        localStorage.removeItem(STORAGE_JOIN_CODE_KEY)
      } catch {}
      clearPendingJoin()
      if (typeof window !== 'undefined' && window.location.hash !== '#/join') {
        window.history.replaceState(null, '', '#/join')
      }
    }
  }

  const handleLookupOrJoin = async () => {
    const extracted = extractRoomCode(input)
    const code = extracted ? extracted.roomCode : input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    if (code.length < 4) return

    if (extracted?.category) {
      setHostCategory(extracted.category)
      saveRoomCategory(code, extracted.category)
    }

    try {
      sessionStorage.setItem(STORAGE_JOIN_CODE_KEY, code)
      localStorage.setItem(STORAGE_JOIN_CODE_KEY, code)
    } catch {}
    setPendingJoin(code, extracted?.category || hostCategory || undefined)

    if (checkedCode !== code) {
      setCheckedCode(code)
      if (typeof window !== 'undefined' && window.location.hash !== `#/join/${code}`) {
        window.history.replaceState(null, '', `#/join/${code}`)
      }
      return
    }

    if (hasRoomData) {
      if (isWrongChain) {
        switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
        return
      }
      if (isAlreadyJoined) {
        try {
          sessionStorage.removeItem(STORAGE_JOIN_CODE_KEY)
          localStorage.removeItem(STORAGE_JOIN_CODE_KEY)
        } catch {}
        clearPendingJoin()
        let catToUse = hostCategory || getRoomCategory(checkedCode)
        if (!catToUse) {
          const meta = await fetchRoomMetadata(checkedCode)
          if (meta?.category) {
            catToUse = meta.category
            setHostCategory(meta.category)
            saveRoomCategory(checkedCode, meta.category)
          }
        }
        const finalCat = catToUse || (checkedCode ? inferCategoryFromCode(checkedCode) : null) || 'General Knowledge'
        onJoined(checkedCode, finalCat)
        return
      }
      if (requiresApproval && !approved) {
        handleApprove()
        return
      }
      if (isRoomOpen) {
        void handleJoin()
        return
      }
    } else {
      setCheckedCode(code)
    }
  }

  const handleApprove = () => {
    if (!buyIn) return
    approve(parseUSDC(buyInHuman ?? '0') === buyIn ? (buyInHuman ?? '0') : formatUSDCRaw(buyIn))
  }

  const handleJoin = async () => {
    const targetCode = (checkedCode || input || '').trim().toUpperCase()
    if (!targetCode) return

    let catToUse = hostCategory || getRoomCategory(targetCode)
    if (!catToUse) {
      const meta = await fetchRoomMetadata(targetCode)
      if (meta?.category) {
        catToUse = meta.category
        setHostCategory(meta.category)
        saveRoomCategory(targetCode, meta.category)
      }
    }
    const finalCat = catToUse || (targetCode ? inferCategoryFromCode(targetCode) : null) || 'General Knowledge'
    saveRoomCategory(targetCode, finalCat)

    if (isAlreadyJoined) {
      try {
        sessionStorage.removeItem(STORAGE_JOIN_CODE_KEY)
        localStorage.removeItem(STORAGE_JOIN_CODE_KEY)
      } catch {}
      clearPendingJoin()
      saveActiveGame(targetCode, finalCat, isHost)
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#/game/${targetCode}`)
      }
      onJoined(targetCode, finalCat)
      return
    }

    if (isWrongChain && switchChain) {
      switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
      return
    }

    joinRoom(targetCode)
  }

  const handleBack = () => {
    try {
      sessionStorage.removeItem(STORAGE_JOIN_CODE_KEY)
      localStorage.removeItem(STORAGE_JOIN_CODE_KEY)
      sessionStorage.removeItem(STORAGE_SCREEN_KEY)
      localStorage.removeItem(STORAGE_SCREEN_KEY)
    } catch {}
    clearPendingJoin()
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#/lobby')
    }
    onBack()
  }

  return (
    <div
      className="relative min-h-screen min-h-[100dvh] w-full overflow-x-hidden overscroll-none"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '8%', left: '4%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '6%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.16) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div
        className="relative z-10 mx-auto w-full max-w-md px-3.5 pt-3 sm:max-w-xl md:max-w-2xl sm:px-6 sm:py-6"
        style={{ paddingBottom: 'max(6.5rem, calc(env(safe-area-inset-bottom, 20px) + 5rem))' }}
      >
        <div className="mb-4 sm:mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/90 hover:bg-white active:bg-slate-100 backdrop-blur-md shadow-xs border border-[var(--border)] transition-all duration-150 hover:scale-105 active:scale-90 cursor-pointer touch-manipulation"
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft size={18} className="stroke-[2.5]" style={{ color: 'var(--ink)' }} />
          </button>
          <h1 className="display text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>join room</h1>
        </div>

        {!contractReady && (
          <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.2)', color: 'var(--danger)' }}>
            Contract not yet deployed.
          </div>
        )}

        <div className="space-y-3.5 sm:space-y-4">
          {/* Room Code input card: shown when no room data is loaded or room was not found */}
          {(!hasRoomData || Boolean(roomError)) && (
            <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-300 ease-out modal-smooth-in" style={glass.card}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600" style={{ letterSpacing: '0.08em' }}>
                Room Code
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. TRV001"
                  maxLength={8}
                  value={input}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLookupOrJoin()}
                  className="min-w-0 flex-1 rounded-2xl px-3.5 sm:px-4 py-3 text-base font-bold outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.7)',
                    border: '1px solid var(--border)',
                    color: 'var(--ink)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '0.1em',
                  }}
                />
                <button
                  type="button"
                  onClick={handleLookupOrJoin}
                  disabled={input.trim().length < 4 || joinPending || joinConfirming}
                  className="shrink-0 rounded-2xl px-4 sm:px-5 py-3 text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-40 cursor-pointer shadow-xs touch-manipulation"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {joinPending || joinConfirming ? 'Joining...' : 'Join'}
                </button>
              </div>
            </div>
          )}

          {checkedCode && (
            <>
              {roomError && (
                <p className="rounded-2xl px-4 py-3 text-sm modal-smooth-in" style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.2)', color: 'var(--danger)' }}>
                  Room not found. Check the code and try again.
                </p>
              )}
              {hasRoomData && (
                <div className="rounded-3xl p-5 sm:p-6 transition-all duration-300 ease-out modal-smooth-in" style={glass.card}>
                  <div className="mb-4 text-center">
                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-700" style={{ letterSpacing: '0.14em', opacity: 0.88 }}>
                      room details
                    </h2>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={glass.inner}>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Game Mode</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 border border-slate-200/90 shadow-2xs">
                        <span>{CATEGORY_GROUPS.flatMap(g => g.subcategories).find(s => s.id === resolvedCategory)?.emoji ?? '🎮'}</span>
                        <span>{resolvedCategory}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={glass.inner}>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Status</span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          background: isRoomOpen ? 'rgba(26,128,71,0.1)' : 'rgba(186,43,76,0.08)',
                          color: isRoomOpen ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {ROOM_STATUS[status] ?? 'Unknown'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={glass.inner}>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Players</span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                        <Users size={13} style={{ color: 'var(--subtle)' }} />
                        {playerCount ?? 0} / {maxPlayers ?? 4}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={glass.inner}>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {buyIn !== undefined && buyIn > 0n ? 'Buy-in' : 'Entry Fee'}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                        <TokenUSDC variant="branded" size={13} />
                        {buyIn !== undefined && buyIn > 0n ? `${buyInHuman} USDC` : '0 USDC (+ gas)'}
                      </span>
                    </div>

                    {/* Payout Structure Row */}
                    <div className="flex flex-col gap-2 rounded-2xl p-3 sm:p-3.5" style={glass.inner}>
                      <div className="flex items-center gap-1.5">
                        <Trophy size={13} className="text-amber-500 stroke-[2.25]" />
                        <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
                          Payout Distribution
                        </span>
                      </div>

                      {(() => {
                        const splits = calculatePayoutSplits(prizeForPayouts, getRoomPayout(checkedCode, payoutMode).splits)
                        if (splits.length === 1) {
                          return (
                            <div className="flex items-center justify-between rounded-xl bg-white/95 px-3.5 py-2.5 border border-slate-200/80 shadow-2xs">
                              <span className="text-xs sm:text-sm font-bold text-slate-800">
                                Winner Takes All
                              </span>
                              <div className="flex items-center gap-1.5">
                                <TokenUSDC variant="branded" size={14} className="shrink-0" />
                                <span className="text-xs sm:text-sm font-extrabold text-slate-900 tabular-nums">
                                  {splits[0].amount} USDC
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">100%</span>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div className={`grid gap-2 ${splits.length === 2 ? 'grid-cols-2' : splits.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                            {splits.map((s, idx) => {
                              const tierBadges = [
                                { rankText: '🥇 1st', bg: 'bg-amber-50/90 text-amber-800 border-amber-200/90' },
                                { rankText: '🥈 2nd', bg: 'bg-slate-50 text-slate-700 border-slate-200' },
                                { rankText: '🥉 3rd', bg: 'bg-orange-50/90 text-orange-900 border-orange-200/90' },
                                { rankText: '4th', bg: 'bg-slate-50 text-slate-600 border-slate-200' },
                                { rankText: '5th', bg: 'bg-slate-50 text-slate-600 border-slate-200' },
                              ]
                              const badge = tierBadges[idx] ?? { rankText: `${idx + 1}th`, bg: 'bg-slate-50 text-slate-600 border-slate-200' }

                              return (
                                <div
                                  key={idx}
                                  className="flex flex-col justify-between rounded-xl bg-white/95 p-2.5 border border-slate-200/80 shadow-2xs transition-all hover:bg-white hover:border-slate-300"
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1.5">
                                    <span className={`inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badge.bg}`}>
                                      {badge.rankText}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md tabular-nums">
                                      {s.percent}%
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <TokenUSDC variant="branded" size={13} className="shrink-0" />
                                    <span className="text-xs font-bold text-slate-900 tabular-nums">
                                      {s.amount} USDC
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {balanceHuman !== null && !isAlreadyJoined && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
                      Your balance: <span className="font-semibold tabular-nums">{balanceHuman} USDC</span>
                    </p>
                  )}

                  {/* If user is already in the room */}
                  {isAlreadyJoined && (
                    <div className="mt-3.5 flex items-center justify-between rounded-2xl px-4 py-3 bg-gray-50/80 border border-gray-200/80 shadow-2xs">
                      <div className="min-w-0 pr-3">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">
                          {isHost ? 'You are hosting this room' : 'You have joined this room'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500 font-medium truncate">
                          {isHost ? 'Resume anytime to manage your game' : 'Game in progress · Return anytime to continue'}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white border border-gray-200/90 px-2.5 py-0.5 text-[10px] font-semibold text-gray-700 shadow-2xs">
                        {isHost ? 'Host' : 'Player'}
                      </span>
                    </div>
                  )}

                  {!isRoomOpen && !isAlreadyJoined && (
                    <p className="mt-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}>
                      {status === 3 ? 'This room has been cancelled by the host.' : 'This room is no longer accepting new players.'}
                    </p>
                  )}

                  {isWrongChain && (isRoomOpen || isAlreadyJoined) && (
                    <p className="mt-3 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}>
                      Switch to Arc to continue.
                    </p>
                  )}

                  {/* Rejoin / Continue Button for players already joined */}
                  {isAlreadyJoined && (
                    <button
                      type="button"
                      onClick={handleJoin}
                      className="mt-3.5 flex w-full items-center justify-center rounded-2xl py-4 text-sm font-semibold shadow-md transition-all hover:brightness-105 active:scale-[0.99] cursor-pointer touch-manipulation"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      Continue to Game
                    </button>
                  )}

                  {/* Approval and Join buttons for new participants */}
                  {!isAlreadyJoined && isRoomOpen && !isWrongChain && requiresApproval && (
                    <button
                      onClick={handleApprove}
                      disabled={approvePending || approveConfirming}
                      className="mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                    >
                      {approvePending || approveConfirming ? 'Approving...' : `Approve ${buyInHuman} USDC`}
                    </button>
                  )}

                  {!isAlreadyJoined && (joinPending || joinConfirming) && (
                    <p className="mt-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
                      {joinPending ? 'Confirm in wallet...' : 'Joining...'}
                    </p>
                  )}

                  {!isAlreadyJoined && isRoomOpen && (
                    <>
                      <button
                        onClick={isWrongChain ? () => switchChain({ chainId: ARC_TESTNET_CHAIN_ID }) : handleJoin}
                        disabled={joinPending || joinConfirming || (requiresApproval && !approved)}
                        className="mt-3 w-full rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{ background: 'var(--accent)', color: 'white' }}
                      >
                        {isWrongChain ? 'Switch to Arc' : joinPending || joinConfirming ? 'Joining...' : `Join Room${buyIn !== undefined && buyIn > 0n ? ` · ${buyInHuman} USDC` : ''}`}
                      </button>
                      <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
                        {buyIn !== undefined && buyIn > 0n
                          ? `${buyInHuman} USDC entry, gas fee required`
                          : '0 USDC entry, gas fee required'}
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
