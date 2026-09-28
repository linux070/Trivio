import { useState, useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import {
  useCreateRoom,
  useApproveUsdc,
  useUsdcAllowance,
  useUsdcBalance,
  useRoomExists,
  generateRoomCode,
  formatUSDCRaw,
} from '@/hooks/useTriviaContract'
import { ARC_TESTNET_CHAIN_ID, TRIVIA_GAME_ADDRESS } from '@/config'
import { type Category, CATEGORY_GROUPS } from '@/lib/questions'
import { parseUSDC } from '@/hooks/useTriviaContract'
import {
  saveRoomCategory,
  saveRoomDuration,
  saveRoomPayout,
  saveActiveGame,
  PAYOUT_PRESETS,
  calculatePayoutSplits,
  type PayoutPreset,
  type PayoutSplitItem,
  type PayoutStructure,
} from '@/lib/roomStorage'

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

type Mode = 'buyin' | 'sponsored'

interface CreateRoomProps {
  initialCategory?: Category
  onBack: () => void
  onRoomCreated: (code: string, category: Category) => void
}

export default function CreateRoom({ initialCategory = 'General Knowledge', onBack, onRoomCreated }: CreateRoomProps) {
  const { address, chainId } = useAccount()
  const { user } = usePrivy()
  const { switchChain } = useSwitchChain()

  const privyWalletAddress = user?.wallet?.address as `0x${string}` | undefined
  const activeAddress = address || privyWalletAddress || undefined

  const selectedSubInfo = CATEGORY_GROUPS.flatMap(g => g.subcategories).find(s => s.id === initialCategory)

  const [mode, setMode] = useState<Mode>('buyin')
  const [category] = useState<Category>(initialCategory)
  const [roundDuration, setRoundDuration] = useState<number>(() => {
    const parsed = parseInt(selectedSubInfo?.roundDuration ?? '', 10)
    return !isNaN(parsed) && parsed >= 5 ? parsed : 15
  })
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [maxPlayersInput, setMaxPlayersInput] = useState('4')
  const [buyIn, setBuyIn] = useState('1')
  const [sponsoredPrize, setSponsoredPrize] = useState('5')
  const [roomCode, setRoomCode] = useState(generateRoomCode)
  const [copied, setCopied] = useState(false)
  const [codeEdited, setCodeEdited] = useState(false)

  const [payoutPreset, setPayoutPreset] = useState<PayoutPreset>('top1')
  const [customWinnerCount, setCustomWinnerCount] = useState<number>(4)
  const [customSplitStyle, setCustomSplitStyle] = useState<'tiered' | 'even'>('tiered')

  // Helper to generate clean splits without needing sliders
  const generateSplits = (count: number, style: 'tiered' | 'even' = 'tiered'): PayoutSplitItem[] => {
    const n = Math.max(1, Math.min(count, 20))
    const suffixes = ['th', 'st', 'nd', 'rd']
    const getSuffix = (num: number) => {
      const v = num % 100
      return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]
    }

    if (n === 1) {
      return [{ rank: 1, bps: 10000, percent: 100, label: '1st Place' }]
    }

    if (style === 'even') {
      const evenBps = Math.floor(10000 / n)
      const remainder = 10000 - evenBps * n
      return Array.from({ length: n }, (_, i) => {
        const r = i + 1
        const bps = i === 0 ? evenBps + remainder : evenBps
        return {
          rank: r,
          bps,
          percent: Number((bps / 100).toFixed(1)),
          label: `${r}${getSuffix(r)} Place`,
        }
      })
    }

    // Tiered curve
    const rawWeights = Array.from({ length: n }, (_, i) => 1 / Math.pow(i + 1, 0.7))
    const totalWeight = rawWeights.reduce((a, b) => a + b, 0)
    let allocatedBps = 0
    return rawWeights.map((w, i) => {
      const r = i + 1
      let bps = Math.round((w / totalWeight) * 10000)
      if (i === n - 1) {
        bps = 10000 - allocatedBps
      } else {
        allocatedBps += bps
      }
      const clampedBps = Math.max(100, bps)
      return {
        rank: r,
        bps: clampedBps,
        percent: Number((clampedBps / 100).toFixed(1)),
        label: `${r}${getSuffix(r)} Place`,
      }
    })
  }

  const [customSplits, setCustomSplits] = useState<PayoutSplitItem[]>(() => generateSplits(4, 'tiered'))

  const handleCustomCountChange = (newCount: number, style = customSplitStyle) => {
    const clamped = Math.max(1, Math.min(newCount, Math.max(maxPlayers, 20)))
    setCustomWinnerCount(clamped)
    setCustomSplits(generateSplits(clamped, style))
  }

  const handleCustomStyleChange = (style: 'tiered' | 'even') => {
    setCustomSplitStyle(style)
    setCustomSplits(generateSplits(customWinnerCount, style))
  }

  const activePayoutStructure: PayoutStructure =
    payoutPreset === 'custom'
      ? {
          preset: 'custom',
          label: `Custom (${customSplits.length} Winners)`,
          splits: customSplits,
        }
      : PAYOUT_PRESETS[payoutPreset] || PAYOUT_PRESETS.top1

  const totalCustomBps = customSplits.reduce((acc, s) => acc + (s.bps || 0), 0)
  const isCustomBpsValid = totalCustomBps === 10000
  const isPayoutValid = payoutPreset !== 'custom' || isCustomBpsValid

  // Estimated total prize pool calculation for real-time distribution previews
  const estimatedTotalPrize =
    mode === 'buyin'
      ? (parseFloat(buyIn) || 0) * maxPlayers
      : (parseFloat(sponsoredPrize) || 0)

  const previewSplits = calculatePayoutSplits(estimatedTotalPrize, activePayoutStructure.splits)



  const { data: rawBalance } = useUsdcBalance(activeAddress)
  const balanceHuman = rawBalance !== undefined ? formatUSDCRaw(rawBalance) : null

  const amountStr = mode === 'sponsored' ? sponsoredPrize : '0'
  const { data: rawAllowance, refetch: refetchAllowance } = useUsdcAllowance(
    activeAddress,
    TRIVIA_GAME_ADDRESS ?? undefined
  )

  const needsApproval = mode === 'sponsored' && ((rawAllowance as bigint ?? 0n) < parseUSDC(amountStr))

  // Room code validation
  const codeValid = /^[A-Z0-9]{4,8}$/.test(roomCode)
  const { data: codeAlreadyExists } = useRoomExists(roomCode)
  const codeTaken = codeEdited && codeAlreadyExists === true

  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approved } = useApproveUsdc()
  const { createRoom, isPending: createPending, isConfirming: createConfirming, isSuccess: created } = useCreateRoom()

  useEffect(() => {
    if (approved) void refetchAllowance()
  }, [approved, refetchAllowance])

  useEffect(() => {
    if (created) {
      toast.success(`Room ${roomCode} created!`)
      saveRoomCategory(roomCode, category)
      saveRoomDuration(roomCode, roundDuration)
      saveRoomPayout(roomCode, activePayoutStructure)
      saveActiveGame(roomCode, category, true)
      onRoomCreated(roomCode, category)
    }
  }, [created, roomCode, category, roundDuration, activePayoutStructure, onRoomCreated])

  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID

  const handleApprove = () => approve(amountStr)

  const handleCreate = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    if (!isPayoutValid) {
      toast.error('Custom payout split must equal exactly 10,000 basis points (100%)')
      return
    }
    createRoom(
      roomCode,
      mode === 'buyin' ? buyIn : '0',
      mode === 'sponsored' ? sponsoredPrize : '0',
      maxPlayers
    )
  }

  const copyCode = () => {
    void navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const contractReady = Boolean(TRIVIA_GAME_ADDRESS)

  return (
    <div
      className="relative min-h-screen min-h-[100dvh] w-full overflow-x-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '6%', right: '4%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
        <div style={{ position: 'absolute', bottom: '12%', left: '6%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.16) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div
        className="relative z-10 mx-auto w-full max-w-md px-3.5 pt-4 sm:max-w-xl md:max-w-2xl sm:px-6 sm:py-6"
        style={{ paddingBottom: 'max(6.5rem, calc(env(safe-area-inset-bottom, 20px) + 5rem))' }}
      >
        <div className="mb-5 sm:mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 hover:bg-white backdrop-blur-md shadow-xs border border-[var(--border)] transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
              title="Go back"
            >
              <ArrowLeft size={16} className="stroke-[2.25]" style={{ color: 'var(--ink)' }} />
            </button>
            <h1 className="display text-xl sm:text-2xl font-semibold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>create room</h1>
          </div>
        </div>

        {!contractReady && (
          <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.2)', color: 'var(--danger)' }}>
            Contract not yet deployed. Deploy TriviaGame.sol first.
          </div>
        )}

        <div className="space-y-3.5 sm:space-y-4">
          {/* 1. Game Mode / Category Card */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
              Game Mode
            </p>
            <div className="mt-2.5 flex items-center justify-between rounded-2xl px-3.5 py-3" style={glass.inner}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0">{selectedSubInfo?.emoji ?? '🎮'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 tracking-tight">{selectedSubInfo?.name ?? category}</p>
                  <p className="text-[11px] text-gray-500 truncate">{selectedSubInfo?.tagline ?? 'Multiplayer Trivia'}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-800 shrink-0 ml-2 bg-white/95 px-3 py-1 rounded-xl border border-slate-200/90 shadow-2xs">
                {selectedSubInfo?.badge || 'Classic'}
              </span>
            </div>
          </div>

          {/* 2. Room Code */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>Room Code</p>
              <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>{roomCode.length}/8</span>
            </div>
            <div className="flex items-center justify-between gap-2 px-1 py-1.5">
              <input
                type="text"
                value={roomCode}
                maxLength={8}
                spellCheck={false}
                onChange={e => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  setRoomCode(val)
                  setCodeEdited(true)
                }}
                className="min-w-0 flex-1 bg-transparent text-xl sm:text-2xl font-bold tracking-widest outline-none"
                style={{
                  color: codeTaken ? 'var(--danger)' : !codeValid && codeEdited ? 'var(--danger)' : 'var(--ink)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: '0.12em',
                }}
              />
              <button onClick={copyCode} className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70" style={{ background: 'rgba(18,45,69,0.06)', color: 'var(--ink-2)' }}>
                {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {codeTaken && (
              <p className="mt-1.5 text-xs font-medium" style={{ color: 'var(--danger)' }}>This code is already taken — try another.</p>
            )}
            {!codeValid && codeEdited && !codeTaken && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>4–8 characters, letters and numbers only.</p>
            )}
            {!codeEdited && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--subtle)' }}>Auto-generated — edit to customise. Share with players to join.</p>
            )}
            {codeValid && !codeTaken && codeEdited && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--success)' }}>Code is available.</p>
            )}
          </div>

          {/* 3. Prize Mode */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>Prize Mode</p>
            <div className="grid grid-cols-2 gap-2">
              {(['buyin', 'sponsored'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold transition-all"
                  style={{
                    background: mode === m ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
                    color: mode === m ? 'white' : 'var(--muted)',
                    border: mode === m ? '1px solid transparent' : '1px solid var(--border)',
                  }}
                >
                  {m === 'buyin' ? 'Buy-in' : 'Sponsored'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
              {mode === 'buyin'
                ? 'Each player pays an entry fee. The full pot goes to the winner.'
                : 'You fund the prize pool upfront. Players compete for free.'}
            </p>
          </div>

          {/* 4. Buy-in / Amount */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
              {mode === 'buyin' ? 'Buy-in per player' : 'Prize pool'}
            </p>
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={glass.inner}>
              <TokenUSDC variant="branded" size={20} />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={mode === 'buyin' ? buyIn : sponsoredPrize}
                onChange={e => mode === 'buyin' ? setBuyIn(e.target.value) : setSponsoredPrize(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-lg sm:text-xl font-bold outline-none tabular-nums"
                style={{ color: 'var(--ink)', fontFamily: "'Space Grotesk', sans-serif" }}
              />
            </div>
            {balanceHuman !== null && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
                Balance: <span className="font-semibold tabular-nums">{balanceHuman} USDC</span>
              </p>
            )}
          </div>

          {/* 5. Payout Distribution */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <div className="mb-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
                Payout Distribution
              </p>
            </div>

            {/* 3 Preset Pills + Inline Stepper (slot 4) */}
            <div className="grid grid-cols-4 gap-2 mb-3.5 h-10">
              {[
                { id: 'top1', label: 'Top 1' },
                { id: 'top3', label: 'Top 3' },
                { id: 'top5', label: 'Top 5' },
              ].map(p => {
                const isActive = payoutPreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPayoutPreset(p.id as PayoutPreset)}
                    className="h-full rounded-xl flex items-center justify-center text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    style={{
                      background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.7)',
                      color: isActive ? 'white' : 'var(--ink)',
                      border: isActive ? '1px solid transparent' : '1px solid var(--border)',
                      boxShadow: isActive ? '0 2px 8px rgba(124,58,237,0.25)' : 'none',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}

              {/* Slot 4: Custom stepper */}
              {(() => {
                const isActive = payoutPreset === 'custom'
                return (
                  <div
                    className="flex items-center h-full rounded-xl overflow-hidden transition-all duration-200"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                        : 'rgba(255,255,255,0.7)',
                      border: isActive ? '1px solid transparent' : '1px solid var(--border)',
                      boxShadow: isActive
                        ? '0 2px 8px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.15)'
                        : 'none',
                    }}
                  >
                    {/* − button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutPreset('custom')
                        handleCustomCountChange(isActive ? customWinnerCount - 1 : customWinnerCount)
                      }}
                      disabled={isActive && customWinnerCount <= 1}
                      className="w-7 h-full flex items-center justify-center disabled:opacity-20 cursor-pointer transition-all hover:bg-black/5 active:scale-90"
                      style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'var(--subtle)' }}
                      aria-label="Fewer winners"
                    >
                      <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="1.5" rx=".75" fill="currentColor"/></svg>
                    </button>

                    {/* Divider */}
                    <div className="w-px h-4" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--border)' }} />

                    {/* Center: shows "Custom" when inactive, or just the count when active */}
                    <button
                      type="button"
                      onClick={() => { if (!isActive) setPayoutPreset('custom') }}
                      className="flex-1 h-full flex items-center justify-center cursor-pointer px-1"
                    >
                      {isActive ? (
                        <span
                          className="text-sm font-extrabold tabular-nums leading-none"
                          style={{ color: 'white', letterSpacing: '-0.02em' }}
                        >
                          {customWinnerCount}
                        </span>
                      ) : (
                        <span
                          className="text-xs font-bold leading-none"
                          style={{ color: 'var(--ink)' }}
                        >
                          Custom
                        </span>
                      )}
                    </button>

                    {/* Divider */}
                    <div className="w-px h-4" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--border)' }} />

                    {/* + button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutPreset('custom')
                        handleCustomCountChange(isActive ? customWinnerCount + 1 : customWinnerCount)
                      }}
                      disabled={isActive && customWinnerCount >= 20}
                      className="w-7 h-full flex items-center justify-center disabled:opacity-20 cursor-pointer transition-all hover:bg-black/5 active:scale-90"
                      style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'var(--subtle)' }}
                      aria-label="More winners"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <rect x="4.25" y="0" width="1.5" height="10" rx=".75" fill="currentColor"/>
                        <rect y="4.25" width="10" height="1.5" rx=".75" fill="currentColor"/>
                      </svg>
                    </button>
                  </div>
                )
              })()}
            </div>

            {/* Prize Breakdown */}
            <div className="rounded-2xl overflow-hidden border border-slate-200/80">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Prize Breakdown
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 tabular-nums">
                  <TokenUSDC variant="branded" size={13} />
                  <span>~${estimatedTotalPrize.toFixed(2)} Pool</span>
                </div>
              </div>

              {/* Prize list */}
              <div className="p-3 space-y-1.5" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {previewSplits.map((split, idx) => {
                  const isTop3 = idx < 3
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                  const barColor = idx === 0
                    ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                    : idx === 1
                      ? 'linear-gradient(90deg, #cbd5e1, #94a3b8)'
                      : idx === 2
                        ? 'linear-gradient(90deg, #fbbf24, #d97706)'
                        : 'linear-gradient(90deg, #e2e8f0, #cbd5e1)'

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl px-3 transition-colors"
                      style={{
                        padding: isTop3 ? '10px 12px' : '7px 12px',
                        background: isTop3 ? 'rgba(255,255,255,0.9)' : 'transparent',
                        border: isTop3 ? '1px solid rgba(0,0,0,0.04)' : '1px solid transparent',
                      }}
                    >
                      {/* Rank */}
                      <div className="shrink-0 flex items-center justify-center" style={{ width: '24px' }}>
                        {medal ? (
                          <span className="text-base leading-none">{medal}</span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400 tabular-nums">{idx + 1}</span>
                        )}
                      </div>

                      {/* Label + Bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className={`font-bold text-slate-800 ${isTop3 ? 'text-xs' : 'text-[11px]'}`}>
                            {split.label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums ml-2">
                            {split.percent}%
                          </span>
                        </div>
                        {/* Visual bar */}
                        <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(split.percent, 2)}%`,
                              background: barColor,
                            }}
                          />
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="shrink-0 flex items-center gap-1 tabular-nums ml-1">
                        <TokenUSDC variant="branded" size={12} />
                        <span className={`font-bold text-slate-900 ${isTop3 ? 'text-xs' : 'text-[11px]'}`}>
                          ${split.amount}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 6. Round Timer / Duration */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <div className="mb-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
                Round Timer
              </p>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[10, 15, 20, 30].map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setRoundDuration(sec)}
                  className="rounded-xl py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  style={{
                    background: roundDuration === sec ? 'var(--accent)' : 'rgba(255,255,255,0.7)',
                    color: roundDuration === sec ? 'white' : 'var(--ink)',
                    border: roundDuration === sec ? '1px solid transparent' : '1px solid var(--border)',
                    boxShadow: roundDuration === sec ? '0 2px 8px rgba(124,58,237,0.25)' : 'none',
                  }}
                >
                  {sec}s
                </button>
              ))}
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={glass.inner}>
              <button
                type="button"
                onClick={() => setRoundDuration(prev => Math.max(5, prev - 5))}
                disabled={roundDuration <= 5}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-xl font-bold transition-all hover:bg-black/5 disabled:opacity-30 cursor-pointer"
                style={{ color: 'var(--ink)' }}
              >
                −
              </button>
              <div className="text-center">
                <span
                  className="display text-2xl sm:text-3xl font-bold tabular-nums"
                  style={{ color: 'var(--ink)', fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {roundDuration}s
                </span>
                <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>countdown per question</p>
              </div>
              <button
                type="button"
                onClick={() => setRoundDuration(prev => Math.min(60, prev + 5))}
                disabled={roundDuration >= 60}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-xl font-bold transition-all hover:bg-black/5 disabled:opacity-30 cursor-pointer"
                style={{ color: 'var(--ink)' }}
              >
                +
              </button>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
              Set how much time players have to answer each trivia question.
            </p>
          </div>


          {/* Max players */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>Max Players</p>
            <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={glass.inner}>
              <button
                onClick={() => { const n = Math.max(1, maxPlayers - 1); setMaxPlayers(n); setMaxPlayersInput(String(n)) }}
                disabled={maxPlayers <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-xl font-bold transition-all hover:bg-black/5 disabled:opacity-30 cursor-pointer"
                style={{ color: 'var(--ink)' }}
              >
                −
              </button>
              <div className="text-center">
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxPlayersInput}
                  onChange={e => {
                    const gameLimit = selectedSubInfo?.maxPlayers ?? 50
                    const raw = e.target.value.replace(/[^0-9]/g, '')
                    setMaxPlayersInput(raw)
                    const v = parseInt(raw, 10)
                    if (!isNaN(v)) setMaxPlayers(Math.min(gameLimit, Math.max(1, v)))
                  }}
                  onBlur={() => {
                    const gameLimit = selectedSubInfo?.maxPlayers ?? 50
                    const v = parseInt(maxPlayersInput, 10)
                    const clamped = isNaN(v) ? 1 : Math.min(gameLimit, Math.max(1, v))
                    setMaxPlayers(clamped)
                    setMaxPlayersInput(String(clamped))
                  }}
                  className="display w-16 bg-transparent text-center text-3xl font-bold tabular-nums outline-none"
                  style={{ color: 'var(--ink)', fontFamily: "'Space Grotesk', sans-serif" }}
                />
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>players max</p>
              </div>
              <button
                onClick={() => {
                  const gameLimit = selectedSubInfo?.maxPlayers ?? 50
                  const n = Math.min(gameLimit, maxPlayers + 1)
                  setMaxPlayers(n)
                  setMaxPlayersInput(String(n))
                }}
                disabled={maxPlayers >= (selectedSubInfo?.maxPlayers ?? 50)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-xl font-bold transition-all hover:bg-black/5 disabled:opacity-30 cursor-pointer"
                style={{ color: 'var(--ink)' }}
              >
                +
              </button>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
              Min 1 · Max {selectedSubInfo?.maxPlayers ?? 50} players for {selectedSubInfo?.name ?? 'this mode'}
            </p>
          </div>

          {isWrongChain && (
            <p className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.2)', color: 'var(--danger)' }}>
              Switch to Arc to create a room.
            </p>
          )}

          {mode === 'sponsored' && needsApproval && contractReady && !isWrongChain && (
            <>
              {(approvePending || approveConfirming) && (
                <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
                  {approvePending ? 'Confirm USDC approval in wallet...' : 'Approving...'}
                </p>
              )}
              <button
                onClick={handleApprove}
                disabled={approvePending || approveConfirming}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              >
                {approvePending || approveConfirming ? 'Approving...' : `Approve ${sponsoredPrize} USDC`}
              </button>
            </>
          )}

          {(createPending || createConfirming) && (
            <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
              {createPending ? 'Confirm in wallet...' : 'Creating room onchain...'}
            </p>
          )}
          <button
            onClick={isWrongChain ? () => switchChain({ chainId: ARC_TESTNET_CHAIN_ID }) : handleCreate}
            disabled={createPending || createConfirming || !contractReady || !codeValid || codeTaken || !isPayoutValid || (mode === 'sponsored' && needsApproval)}
            className="w-full rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {isWrongChain ? 'Switch to Arc' : createPending || createConfirming ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
