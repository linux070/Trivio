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
import { saveRoomCategory, saveActiveGame } from '@/lib/roomStorage'

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

  const [mode, setMode] = useState<Mode>('buyin')
  const [category] = useState<Category>(initialCategory)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [maxPlayersInput, setMaxPlayersInput] = useState('4')
  const [buyIn, setBuyIn] = useState('1')
  const [sponsoredPrize, setSponsoredPrize] = useState('5')
  const [roomCode, setRoomCode] = useState(generateRoomCode)
  const [copied, setCopied] = useState(false)
  const [codeEdited, setCodeEdited] = useState(false)

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
      saveActiveGame(roomCode, category, true)
      onRoomCreated(roomCode, category)
    }
  }, [created, roomCode, category, onRoomCreated])

  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID

  const handleApprove = () => approve(amountStr)

  const handleCreate = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
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
  const selectedSubInfo = CATEGORY_GROUPS.flatMap(g => g.subcategories).find(s => s.id === category)

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
          {/* Game Mode / Category Card */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
                Game Mode
              </p>
              {selectedSubInfo?.badge && (
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-full">
                  {selectedSubInfo.badge}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-center justify-between rounded-2xl px-3.5 py-3" style={glass.inner}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0">{selectedSubInfo?.emoji ?? '🎮'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 tracking-tight">{selectedSubInfo?.name ?? category}</p>
                  <p className="text-[11px] text-gray-500 truncate">{selectedSubInfo?.tagline ?? 'Multiplayer Trivia'}</p>
                </div>
              </div>
              {selectedSubInfo?.roundDuration && (
                <span className="text-[11px] font-medium text-gray-500 shrink-0 ml-2 bg-white/70 px-2 py-1 rounded-lg border border-gray-200/50">
                  {selectedSubInfo.roundDuration}
                </span>
              )}
            </div>
          </div>

          {/* Room code */}
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

          {/* Mode */}
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

          {/* Amount */}
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
              <span className="shrink-0 text-sm font-medium" style={{ color: 'var(--muted)' }}>USDC</span>
            </div>
            {balanceHuman !== null && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
                Balance: <span className="font-semibold tabular-nums">{balanceHuman} USDC</span>
              </p>
            )}
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
              Switch to Arc Testnet to create a room.
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
            disabled={createPending || createConfirming || !contractReady || !codeValid || codeTaken || (mode === 'sponsored' && needsApproval)}
            className="w-full rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {isWrongChain ? 'Switch to Arc Testnet' : createPending || createConfirming ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
