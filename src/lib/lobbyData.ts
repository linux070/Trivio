import type { Category } from '@/lib/questions'

export interface PublicRoom {
  roomCode: string
  category: Category
  hostName: string
  hostAddress: string
  playerCount: number
  maxPlayers: number
  buyIn: string
  isSponsored: boolean
  prizePool: string
}

export interface LeaderboardEntry {
  rank: number
  username: string
  address: string
  avatarSeed: string
  totalWinnings: string
  winCount: number
  winStreak: number
}

export const INITIAL_PUBLIC_ROOMS: PublicRoom[] = [
  {
    roomCode: 'CRYP99',
    category: 'Crypto',
    hostName: 'SatoshiFan',
    hostAddress: '0x1a2b...3c4d',
    playerCount: 6,
    maxPlayers: 50,
    buyIn: '1.00',
    isSponsored: false,
    prizePool: '6.00',
  },
  {
    roomCode: 'BLITZ4',
    category: 'Word Blitz',
    hostName: 'LexiMaster',
    hostAddress: '0x8f9e...2a1b',
    playerCount: 4,
    maxPlayers: 16,
    buyIn: '2.00',
    isSponsored: false,
    prizePool: '8.00',
  },
  {
    roomCode: 'EMOJI8',
    category: 'Emoji Decoder',
    hostName: 'MemeLord',
    hostAddress: '0x7c4d...9e2f',
    playerCount: 5,
    maxPlayers: 20,
    buyIn: '0.00',
    isSponsored: true,
    prizePool: '10.00',
  },
  {
    roomCode: 'BOMB01',
    category: 'Bomb Tag',
    hostName: 'DegenSpeed',
    hostAddress: '0x3b5c...8e9a',
    playerCount: 3,
    maxPlayers: 8,
    buyIn: '5.00',
    isSponsored: false,
    prizePool: '15.00',
  },
  {
    roomCode: 'MATH12',
    category: 'Logic & Math Arena',
    hostName: 'Euler99',
    hostAddress: '0x4d6e...1f3a',
    playerCount: 2,
    maxPlayers: 12,
    buyIn: '1.00',
    isSponsored: false,
    prizePool: '2.00',
  },
]

export const TOP_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    username: 'satoshix',
    address: '0x3a4b...8f91',
    avatarSeed: 'satoshix',
    totalWinnings: '520.00',
    winCount: 14,
    winStreak: 4,
  },
  {
    rank: 2,
    username: 'degen_queen',
    address: '0x9f1a...4c2d',
    avatarSeed: 'degen_queen',
    totalWinnings: '310.00',
    winCount: 9,
    winStreak: 2,
  },
  {
    rank: 3,
    username: 'arc_master',
    address: '0x2e8d...7b1a',
    avatarSeed: 'arc_master',
    totalWinnings: '195.00',
    winCount: 6,
    winStreak: 3,
  },
  {
    rank: 4,
    username: 'cryptokid',
    address: '0x5b3c...1e9f',
    avatarSeed: 'cryptokid',
    totalWinnings: '120.00',
    winCount: 4,
    winStreak: 1,
  },
  {
    rank: 5,
    username: 'speedy_brain',
    address: '0x7a2e...4d8c',
    avatarSeed: 'speedy_brain',
    totalWinnings: '85.00',
    winCount: 3,
    winStreak: 1,
  },
]

export interface RecentWinner {
  id: string
  username: string
  avatarSeed: string
  amount: string
  category: Category
  timeAgo: string
  roomCode: string
}

export const RECENT_WINNERS_FEED: RecentWinner[] = [
  {
    id: 'w1',
    username: 'satoshix',
    avatarSeed: 'satoshix',
    amount: '48.00',
    category: 'Crypto',
    timeAgo: '1m ago',
    roomCode: 'CRYP99',
  },
  {
    id: 'w2',
    username: 'degen_queen',
    avatarSeed: 'degen_queen',
    amount: '24.00',
    category: 'Word Blitz',
    timeAgo: '3m ago',
    roomCode: 'BLITZ4',
  },
  {
    id: 'w3',
    username: 'arc_master',
    avatarSeed: 'arc_master',
    amount: '15.00',
    category: 'Bomb Tag',
    timeAgo: '6m ago',
    roomCode: 'BOMB01',
  },
  {
    id: 'w4',
    username: 'vitalik_fan',
    avatarSeed: 'vitalik_fan',
    amount: '32.00',
    category: 'DeFi & Trading',
    timeAgo: '8m ago',
    roomCode: 'DEFI08',
  },
  {
    id: 'w5',
    username: 'speedy_brain',
    avatarSeed: 'speedy_brain',
    amount: '10.00',
    category: 'Emoji Decoder',
    timeAgo: '11m ago',
    roomCode: 'EMOJI8',
  },
  {
    id: 'w6',
    username: 'cryptokid',
    avatarSeed: 'cryptokid',
    amount: '60.00',
    category: 'Web3 & AI',
    timeAgo: '14m ago',
    roomCode: 'WEB399',
  },
  {
    id: 'w7',
    username: 'zk_wizard',
    avatarSeed: 'zk_wizard',
    amount: '18.00',
    category: 'Logic & Math Arena',
    timeAgo: '18m ago',
    roomCode: 'MATH12',
  },
  {
    id: 'w8',
    username: 'alpha_hunter',
    avatarSeed: 'alpha_hunter',
    amount: '28.00',
    category: 'Pop Culture & Meme Lore',
    timeAgo: '22m ago',
    roomCode: 'MEME42',
  },
]
