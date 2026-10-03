/**
 * lobbyData.ts — Type definitions for lobby data structures.
 *
 * All hardcoded seed data has been removed. Rooms, leaderboards, and winner
 * feeds are now sourced exclusively from on-chain events and localStorage
 * registrations made when hosts actually create rooms.
 */
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

export interface RecentWinner {
  id: string
  username: string
  avatarSeed: string
  amount: string
  category: Category
  timeAgo: string
  roomCode: string
}
