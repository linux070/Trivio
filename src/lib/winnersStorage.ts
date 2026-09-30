/**
 * Real-time Winner Payouts and Daily Leaderboard Storage & Sync
 * Aggregates onchain payout events with local verified results
 */

import { getUserProfile } from './userProfile'

export interface WinnerPayoutRecord {
  roomId?: string
  roomCode: string
  winnerAddress: string
  username?: string
  avatarSeed?: string
  amount: string // in USDC (e.g. "2.00")
  category: string
  timestamp: number
  txHash?: string
}

export interface LiveLeaderboardEntry {
  rank: number
  username: string
  address: string
  avatarSeed: string
  totalWinnings: string
  winCount: number
}

export interface LatestPayoutInfo {
  username: string
  address: string
  amount: string
  category: string
  timeAgo: string
  timestamp: number
  txHash?: string
}

const STORAGE_PAYOUTS_KEY = 'trivio_live_payouts'
export const EVENT_PAYOUT_UPDATED = 'trivio_payout_recorded'

/**
 * Record a real winner payout to persistent storage
 */
export function recordWinnerPayout(payout: {
  roomCode: string
  winnerAddress: string
  amount: string
  category: string
  txHash?: string
}): void {
  if (!payout.winnerAddress || payout.winnerAddress === '0x0000000000000000000000000000000000000000') return

  try {
    const profile = getUserProfile(payout.winnerAddress)
    const username = profile?.username || `${payout.winnerAddress.slice(0, 6)}...${payout.winnerAddress.slice(-4)}`
    const avatarSeed = profile?.avatarSeed || username

    const record: WinnerPayoutRecord = {
      roomCode: payout.roomCode.toUpperCase(),
      winnerAddress: payout.winnerAddress.toLowerCase(),
      username,
      avatarSeed,
      amount: parseFloat(payout.amount || '0').toFixed(2),
      category: payout.category || 'General Knowledge',
      timestamp: Date.now(),
      txHash: payout.txHash,
    }

    const raw = localStorage.getItem(STORAGE_PAYOUTS_KEY)
    const existing: WinnerPayoutRecord[] = raw ? JSON.parse(raw) : []
    
    // Prevent duplicate recording by txHash or (roomCode + winnerAddress + recent timestamp)
    const isDup = existing.some(
      (e) =>
        (payout.txHash && e.txHash === payout.txHash) ||
        (e.roomCode === record.roomCode &&
          e.winnerAddress.toLowerCase() === record.winnerAddress &&
          Math.abs(e.timestamp - record.timestamp) < 60000)
    )

    if (!isDup) {
      existing.unshift(record)
      // Keep up to 100 recent payouts
      const trimmed = existing.slice(0, 100)
      localStorage.setItem(STORAGE_PAYOUTS_KEY, JSON.stringify(trimmed))
      
      // Dispatch custom event for real-time reactivity in current tab
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_PAYOUT_UPDATED, { detail: record }))
      }
    }
  } catch (err) {
    console.error('Failed to record winner payout:', err)
  }
}

/**
 * Get all stored local winner payout records
 */
export function getStoredPayouts(): WinnerPayoutRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_PAYOUTS_KEY)
    if (raw) {
      return JSON.parse(raw) as WinnerPayoutRecord[]
    }
  } catch {
    // ignore
  }
  return []
}

/** Format relative time */
export function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

/**
 * Calculate dynamic live leaderboard from all recorded payouts
 */
export function computeLeaderboard(
  realPayouts: WinnerPayoutRecord[]
): {
  leaderboard: LiveLeaderboardEntry[]
  totalToday: string
  latestPayout: LatestPayoutInfo | null
  payouts: WinnerPayoutRecord[]
} {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000

  // 1. Calculate today's total payout sum
  let todaySum = 0
  for (const p of realPayouts) {
    if (p.timestamp >= oneDayAgo) {
      todaySum += parseFloat(p.amount) || 0
    }
  }

  // 2. Aggregate real user stats
  const userMap = new Map<
    string,
    {
      username: string
      address: string
      avatarSeed: string
      total: number
      wins: number
    }
  >()

  for (const p of realPayouts) {
    const addr = p.winnerAddress.toLowerCase()
    const current = userMap.get(addr) || {
      username: p.username || `${addr.slice(0, 6)}...${addr.slice(-4)}`,
      address: p.winnerAddress,
      avatarSeed: p.avatarSeed || p.username || addr,
      total: 0,
      wins: 0,
    }
    current.total += parseFloat(p.amount) || 0
    current.wins += 1
    // Update profile if available
    const freshProfile = getUserProfile(p.winnerAddress)
    if (freshProfile?.username) {
      current.username = freshProfile.username
      current.avatarSeed = freshProfile.avatarSeed || freshProfile.username
    }
    userMap.set(addr, current)
  }

  const realLeaderboard: LiveLeaderboardEntry[] = Array.from(userMap.values())
    .sort((a, b) => b.total - a.total || b.wins - a.wins)
    .map((u, idx) => ({
      rank: idx + 1,
      username: u.username,
      address: u.address,
      avatarSeed: u.avatarSeed,
      totalWinnings: u.total.toFixed(2),
      winCount: u.wins,
    }))

  // 3. Determine latest payout
  let latest: LatestPayoutInfo | null = null
  if (realPayouts.length > 0) {
    const mostRecent = realPayouts[0]
    latest = {
      username: mostRecent.username || `${mostRecent.winnerAddress.slice(0, 6)}...${mostRecent.winnerAddress.slice(-4)}`,
      address: mostRecent.winnerAddress,
      amount: mostRecent.amount,
      category: mostRecent.category,
      timeAgo: formatTimeAgo(mostRecent.timestamp),
      timestamp: mostRecent.timestamp,
      txHash: mostRecent.txHash,
    }
  }

  const totalTodayFormatted =
    todaySum > 0
      ? `$${todaySum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Today`
      : '$0.00 Today'

  return {
    leaderboard: realLeaderboard,
    totalToday: totalTodayFormatted,
    latestPayout: latest,
    payouts: realPayouts,
  }
}
