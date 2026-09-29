import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { erc20Abi, keccak256, toBytes } from 'viem'
import { getUsdc } from '@/onchain-facts'
import { ARC_TESTNET_CHAIN_ID, TRIVIA_GAME_ADDRESS } from '@/config'

// ── USDC address ───────────────────────────────────────────────────────────────
const usdcFact = getUsdc(ARC_TESTNET_CHAIN_ID)
const USDC_ADDRESS = usdcFact?.address as `0x${string}` | undefined

export enum PayoutMode {
  SingleWinner = 0,
  Top2Split = 1,
  Top3Podium = 2,
  Top5Split = 3,
}

export type RoomTuple = readonly [
  `0x${string}`, // host
  bigint,        // usdcBuyIn
  bigint,        // prizePool
  number,        // maxPlayers
  number,        // playerCount
  number,        // status: 0=Open, 1=InProgress, 2=Finished, 3=Cancelled
  number,        // payoutMode: 0=SingleWinner, 1=Top2, 2=Top3, 3=Top5
  `0x${string}`, // questionSeedHash
  bigint,        // createdAt
  bigint         // startedAt
]

export interface PlayerScoreProof {
  player: `0x${string}`
  score: number
  timestamp: number
  signature: `0x${string}`
}

// ── TriviaGame ABI ────────────────────────────────────────────────────────────
export const TRIVIA_ABI = [
  {
    name: 'createRoom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'usdcBuyIn', type: 'uint256' },
      { name: 'sponsoredPrize', type: 'uint256' },
      { name: 'maxPlayers', type: 'uint8' },
      { name: 'payoutMode', type: 'uint8' },
      { name: 'questionSeedHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'joinRoom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'startGame',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'declareWinners',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'winners', type: 'address[]' },
      {
        name: 'proofs',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'score', type: 'uint32' },
          { name: 'timestamp', type: 'uint32' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: 'cancelRoom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'emergencyCancel',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'claimRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getRoom',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [
      { name: 'host', type: 'address' },
      { name: 'usdcBuyIn', type: 'uint256' },
      { name: 'prizePool', type: 'uint256' },
      { name: 'maxPlayers', type: 'uint8' },
      { name: 'playerCount', type: 'uint8' },
      { name: 'status', type: 'uint8' },
      { name: 'payoutMode', type: 'uint8' },
      { name: 'questionSeedHash', type: 'bytes32' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'startedAt', type: 'uint256' },
    ],
  },
  {
    name: 'getRoomSplits',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint16[]' }],
  },
  {
    name: 'getRoomWinners',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getRoomPlayers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'roomExists',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isPlayer',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// ── Helper: room code → bytes32 ───────────────────────────────────────────────
export function roomCodeToBytes32(code: string): `0x${string}` {
  return keccak256(toBytes(code.trim().toUpperCase()))
}

/** Generate a random 6-character alphanumeric room code */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export function useRoomInfo(code: string | null, pollInterval: number = 1500) {
  const roomId = code ? roomCodeToBytes32(code) : undefined
  return useReadContract({
    address: TRIVIA_GAME_ADDRESS ?? undefined,
    abi: TRIVIA_ABI,
    functionName: 'getRoom',
    args: roomId ? [roomId] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: {
      enabled: Boolean(TRIVIA_GAME_ADDRESS) && Boolean(roomId),
      refetchInterval: pollInterval,
    },
  })
}

export function useIsPlayer(code: string | null, playerAddress: `0x${string}` | undefined) {
  const roomId = code && code.trim().length >= 4 ? roomCodeToBytes32(code) : undefined
  return useReadContract({
    address: TRIVIA_GAME_ADDRESS ?? undefined,
    abi: TRIVIA_ABI,
    functionName: 'isPlayer',
    args: roomId && playerAddress ? [roomId, playerAddress] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: {
      enabled: Boolean(TRIVIA_GAME_ADDRESS) && Boolean(roomId) && Boolean(playerAddress),
    },
  })
}

export function useRoomExists(code: string) {
  const roomId = code.trim().length >= 4 ? roomCodeToBytes32(code) : undefined
  return useReadContract({
    address: TRIVIA_GAME_ADDRESS ?? undefined,
    abi: TRIVIA_ABI,
    functionName: 'roomExists',
    args: roomId ? [roomId] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: Boolean(TRIVIA_GAME_ADDRESS) && Boolean(roomId) },
  })
}

export function useRoomSplits(code: string | null) {
  const roomId = code ? roomCodeToBytes32(code) : undefined
  return useReadContract({
    address: TRIVIA_GAME_ADDRESS ?? undefined,
    abi: TRIVIA_ABI,
    functionName: 'getRoomSplits',
    args: roomId ? [roomId] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: Boolean(TRIVIA_GAME_ADDRESS) && Boolean(roomId) },
  })
}

export function useRoomWinners(code: string | null) {
  const roomId = code ? roomCodeToBytes32(code) : undefined
  return useReadContract({
    address: TRIVIA_GAME_ADDRESS ?? undefined,
    abi: TRIVIA_ABI,
    functionName: 'getRoomWinners',
    args: roomId ? [roomId] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: Boolean(TRIVIA_GAME_ADDRESS) && Boolean(roomId) },
  })
}

export function useUsdcBalance(
  address: `0x${string}` | undefined,
  chainId: number = ARC_TESTNET_CHAIN_ID
) {
  const usdcAddr = (getUsdc(chainId)?.address ?? '0x3600000000000000000000000000000000000000') as `0x${string}`
  return useReadContract({
    address: usdcAddr,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: chainId,
    query: { enabled: Boolean(usdcAddr) && Boolean(address) },
  })
}

export function useUsdcAllowance(
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined
) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: Boolean(USDC_ADDRESS) && Boolean(owner) && Boolean(spender) },
  })
}

// ── USDC helpers ──────────────────────────────────────────────────────────────

/** Parse a human-readable USDC string (e.g. "1.5") → raw bigint (6 decimals) */
export function parseUSDC(amount: string): bigint {
  const n = parseFloat(amount)
  if (isNaN(n) || n < 0) return 0n
  return BigInt(Math.round(n * 1_000_000))
}

/** Format raw USDC bigint → human string e.g. "1.50" or "865,034,306.42" */
export function formatUSDCRaw(raw: bigint): string {
  try {
    const num = Number(raw) / 1_000_000
    if (isNaN(num)) return '0.00'
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return '0.00'
  }
}

// ── Writes ────────────────────────────────────────────────────────────────────

export function useApproveUsdc() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = (amount: string) => {
    if (!USDC_ADDRESS || !TRIVIA_GAME_ADDRESS) return
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [TRIVIA_GAME_ADDRESS, parseUSDC(amount)],
    })
  }

  return { approve, isPending, isConfirming, isSuccess, error, hash }
}

export function useCreateRoom() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const createRoom = (
    code: string,
    buyIn: string,
    sponsoredPrize: string,
    maxPlayers: number,
    payoutMode: PayoutMode = PayoutMode.SingleWinner,
    seedHash?: `0x${string}`
  ) => {
    if (!TRIVIA_GAME_ADDRESS) return
    const defaultSeed = seedHash ?? keccak256(toBytes(code + Date.now().toString()))
    writeContract({
      address: TRIVIA_GAME_ADDRESS,
      abi: TRIVIA_ABI,
      functionName: 'createRoom',
      args: [
        roomCodeToBytes32(code),
        parseUSDC(buyIn),
        parseUSDC(sponsoredPrize),
        maxPlayers,
        payoutMode,
        defaultSeed,
      ],
    })
  }

  return { createRoom, isPending, isConfirming, isSuccess, error, hash }
}

export function useJoinRoom() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const joinRoom = (code: string) => {
    if (!TRIVIA_GAME_ADDRESS) return
    writeContract({
      address: TRIVIA_GAME_ADDRESS,
      abi: TRIVIA_ABI,
      functionName: 'joinRoom',
      args: [roomCodeToBytes32(code)],
    })
  }

  return { joinRoom, isPending, isConfirming, isSuccess, error, hash }
}

export function useStartGame() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const startGame = (code: string) => {
    if (!TRIVIA_GAME_ADDRESS) return
    writeContract({
      address: TRIVIA_GAME_ADDRESS,
      abi: TRIVIA_ABI,
      functionName: 'startGame',
      args: [roomCodeToBytes32(code)],
    })
  }

  return { startGame, isPending, isConfirming, isSuccess, error, hash }
}

export function useDeclareWinners() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const declareWinners = (
    code: string,
    winners: `0x${string}`[],
    proofs: PlayerScoreProof[] = []
  ) => {
    if (!TRIVIA_GAME_ADDRESS) return
    writeContract({
      address: TRIVIA_GAME_ADDRESS,
      abi: TRIVIA_ABI,
      functionName: 'declareWinners',
      args: [roomCodeToBytes32(code), winners, proofs],
    })
  }

  return { declareWinners, isPending, isConfirming, isSuccess, error, hash }
}

export function useDeclareWinner() {
  const { declareWinners, isPending, isConfirming, isSuccess, error, hash } = useDeclareWinners()

  const declareWinner = (code: string, winner: `0x${string}`) => {
    declareWinners(code, [winner], [])
  }

  return { declareWinner, isPending, isConfirming, isSuccess, error, hash }
}

export function useCancelRoom() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const cancelRoom = (code: string) => {
    if (!TRIVIA_GAME_ADDRESS) return
    writeContract({
      address: TRIVIA_GAME_ADDRESS,
      abi: TRIVIA_ABI,
      functionName: 'cancelRoom',
      args: [roomCodeToBytes32(code)],
    })
  }

  return { cancelRoom, isPending, isConfirming, isSuccess, error, hash }
}

export function useEmergencyCancel() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const emergencyCancel = (code: string) => {
    if (!TRIVIA_GAME_ADDRESS) return
    writeContract({
      address: TRIVIA_GAME_ADDRESS,
      abi: TRIVIA_ABI,
      functionName: 'emergencyCancel',
      args: [roomCodeToBytes32(code)],
    })
  }

  return { emergencyCancel, isPending, isConfirming, isSuccess, error, hash }
}

export function useClaimRefund() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const claimRefund = (code: string) => {
    if (!TRIVIA_GAME_ADDRESS) return
    writeContract({
      address: TRIVIA_GAME_ADDRESS,
      abi: TRIVIA_ABI,
      functionName: 'claimRefund',
      args: [roomCodeToBytes32(code)],
    })
  }

  return { claimRefund, isPending, isConfirming, isSuccess, error, hash }
}
