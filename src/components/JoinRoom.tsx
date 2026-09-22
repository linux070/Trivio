import { useState, useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { motion } from 'framer-motion'
import { ArrowLeft, Users } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import {
  useRoomInfo,
  useJoinRoom,
  useApproveUsdc,
  useUsdcAllowance,
  useUsdcBalance,
  formatUSDCRaw,
  parseUSDC,
} from '@/hooks/useTriviaContract'
import { ARC_TESTNET_CHAIN_ID, TRIVIA_GAME_ADDRESS } from '@/config'
import type { Category } from '@/lib/questions'

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

interface JoinRoomProps {
  initialCategory?: Category
  prefillCode?: string
  onBack: () => void
  onJoined: (code: string, category: Category) => void
}

export default function JoinRoom({ initialCategory = 'General Knowledge', prefillCode, onBack, onJoined }: JoinRoomProps) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const [input, setInput] = useState(prefillCode ?? '')
  const [checkedCode, setCheckedCode] = useState<string | null>(prefillCode ?? null)

  const { data: roomInfo, isLoading: roomLoading, error: roomError } = useRoomInfo(checkedCode)

  type RoomTuple = readonly [`0x${string}`, bigint, bigint, number, number, number, `0x${string}`]
  const [_host, buyIn, prizePool, maxPlayers, playerCount, status] = (roomInfo as RoomTuple) ?? []

  const buyInHuman = buyIn !== undefined ? formatUSDCRaw(buyIn) : null
  const prizePoolHuman = prizePool !== undefined ? formatUSDCRaw(prizePool) : null

  const { data: rawBalance } = useUsdcBalance(address)
  const balanceHuman = rawBalance !== undefined ? formatUSDCRaw(rawBalance) : null

  const { data: rawAllowance, refetch: refetchAllowance } = useUsdcAllowance(
    address,
    TRIVIA_GAME_ADDRESS ?? undefined
  )

  const requiresApproval = buyIn !== undefined && buyIn > 0n && ((rawAllowance as bigint ?? 0n) < buyIn)

  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approved } = useApproveUsdc()
  const { joinRoom, isPending: joinPending, isConfirming: joinConfirming, isSuccess: joined } = useJoinRoom()

  useEffect(() => {
    if (approved) void refetchAllowance()
  }, [approved, refetchAllowance])

  useEffect(() => {
    if (joined && checkedCode) {
      toast.success(`Joined room ${checkedCode}!`)
      onJoined(checkedCode, initialCategory)
    }
  }, [joined, checkedCode, initialCategory, onJoined])

  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID
  const isRoomOpen = status === 0
  const contractReady = Boolean(TRIVIA_GAME_ADDRESS)

  const handleLookup = () => {
    const code = input.trim().toUpperCase()
    if (code.length >= 4) setCheckedCode(code)
  }

  const handleApprove = () => {
    if (!buyIn) return
    approve(parseUSDC(buyInHuman ?? '0') === buyIn ? (buyInHuman ?? '0') : formatUSDCRaw(buyIn))
  }

  const handleJoin = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    if (!checkedCode) return
    joinRoom(checkedCode)
  }

  return (
    <div
      className="relative min-h-screen min-h-[100dvh] w-full overflow-x-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '8%', left: '4%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(65px)' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '6%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.16) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-3.5 pb-8 pt-4 sm:max-w-lg sm:px-6 sm:py-6">
        <div className="mb-5 sm:mb-6 flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-70" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)' }}>
            <ArrowLeft size={16} style={{ color: 'var(--ink)' }} />
          </button>
          <h1 className="display text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>Join a Room</h1>
        </div>

        {!contractReady && (
          <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.2)', color: 'var(--danger)' }}>
            Contract not yet deployed.
          </div>
        )}

        <div className="space-y-3.5 sm:space-y-4">
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" style={glass.card}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>Room Code</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. TRV001"
                maxLength={8}
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
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
                onClick={handleLookup}
                disabled={input.trim().length < 4}
                className="shrink-0 rounded-2xl px-4 sm:px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                Look up
              </button>
            </div>
          </div>

          {checkedCode && (
            <>
              {roomLoading && <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>Looking up room...</p>}
              {roomError && (
                <p className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.2)', color: 'var(--danger)' }}>
                  Room not found. Check the code and try again.
                </p>
              )}
              {roomInfo && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl p-5" style={glass.card}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>Room Details</p>

                  <div className="space-y-2">
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
                        {playerCount} / {maxPlayers}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={glass.inner}>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {buyIn !== undefined && buyIn > 0n ? 'Buy-in' : 'Prize pool'}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                        <TokenUSDC variant="branded" size={13} />
                        {buyIn !== undefined && buyIn > 0n ? buyInHuman : prizePoolHuman} USDC
                      </span>
                    </div>
                  </div>

                  {balanceHuman !== null && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
                      Your balance: <span className="font-semibold tabular-nums">{balanceHuman} USDC</span>
                    </p>
                  )}

                  {!isRoomOpen && (
                    <p className="mt-3 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}>
                      This room is no longer accepting players.
                    </p>
                  )}

                  {isWrongChain && isRoomOpen && (
                    <p className="mt-3 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}>
                      Switch to Arc Testnet to join.
                    </p>
                  )}

                  {isRoomOpen && !isWrongChain && requiresApproval && (
                    <button
                      onClick={handleApprove}
                      disabled={approvePending || approveConfirming}
                      className="mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                    >
                      {approvePending || approveConfirming ? 'Approving...' : `Approve ${buyInHuman} USDC`}
                    </button>
                  )}

                  {(joinPending || joinConfirming) && (
                    <p className="mt-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
                      {joinPending ? 'Confirm in wallet...' : 'Joining...'}
                    </p>
                  )}

                  {isRoomOpen && (
                    <button
                      onClick={isWrongChain ? () => switchChain({ chainId: ARC_TESTNET_CHAIN_ID }) : handleJoin}
                      disabled={joinPending || joinConfirming || (requiresApproval && !approved)}
                      className="mt-3 w-full rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      {isWrongChain ? 'Switch to Arc Testnet' : joinPending || joinConfirming ? 'Joining...' : `Join Room${buyIn !== undefined && buyIn > 0n ? ` · ${buyInHuman} USDC` : ''}`}
                    </button>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
