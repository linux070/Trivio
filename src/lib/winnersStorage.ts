/**
 * Real-time Winner Payouts and Daily Leaderboard Storage & Sync
 * Aggregates onchain payout events with local verified results
 */

import { getUserProfile, generateRandomUsername } from './userProfile'

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
 * Helper to deduplicate payout records (by compound key: winnerAddress + txHash or winnerAddress + roomCode)
 */
export function deduplicatePayouts(records: WinnerPayoutRecord[]): WinnerPayoutRecord[] {
  const seenKeys = new Set<string>()
  const result: WinnerPayoutRecord[] = []

  for (const r of records) {
    if (!r.winnerAddress || r.winnerAddress === '0x0000000000000000000000000000000000000000') continue
    const addr = r.winnerAddress.toLowerCase()
    const room = r.roomCode ? r.roomCode.trim().toUpperCase() : ''
    const tx = r.txHash ? r.txHash.toLowerCase() : ''

    const keyByTx = tx ? `tx_${tx}_${addr}` : null
    const keyByRoom = room ? `room_${room}_${addr}` : null

    if (keyByTx && seenKeys.has(keyByTx)) {
      continue
    }
    if (keyByRoom && seenKeys.has(keyByRoom)) {
      continue
    }

    if (keyByTx) seenKeys.add(keyByTx)
    if (keyByRoom) seenKeys.add(keyByRoom)
    result.push(r)
  }

  return result
}

/**
 * Record a real winner payout to persistent storage
 */
export function recordWinnerPayout(payout: {
  roomCode: string
  winnerAddress: string
  amount: string
  category: string
  txHash?: string
  timestamp?: number
}): void {
  if (!payout.winnerAddress || payout.winnerAddress === '0x0000000000000000000000000000000000000000') return

  try {
    const profile = getUserProfile(payout.winnerAddress)
    const username = profile?.username || generateRandomUsername(payout.winnerAddress)
    const avatarSeed = profile?.avatarSeed || username

    const record: WinnerPayoutRecord = {
      roomCode: payout.roomCode.toUpperCase(),
      winnerAddress: payout.winnerAddress.toLowerCase(),
      username,
      avatarSeed,
      amount: parseFloat(payout.amount || '0').toFixed(2),
      category: payout.category || 'General Knowledge',
      timestamp: payout.timestamp || Date.now(),
      txHash: payout.txHash,
    }

    const raw = localStorage.getItem(STORAGE_PAYOUTS_KEY)
    const existing: WinnerPayoutRecord[] = raw ? JSON.parse(raw) : []

    // Look for existing matching record to update in-place or detect duplicate
    const existingIdx = existing.findIndex((e) => {
      const sameWinner = e.winnerAddress.toLowerCase() === record.winnerAddress
      const sameTx = Boolean(payout.txHash && e.txHash && e.txHash.toLowerCase() === payout.txHash.toLowerCase())
      const sameRoom = Boolean(e.roomCode && record.roomCode && e.roomCode === record.roomCode)
      return sameWinner && (sameTx || sameRoom)
    })

    let updated = false
    if (existingIdx >= 0) {
      // Update missing txHash or higher prize amount if newly confirmed
      if (payout.txHash && !existing[existingIdx].txHash) {
        existing[existingIdx].txHash = payout.txHash
        updated = true
      }
      if (parseFloat(record.amount) > parseFloat(existing[existingIdx].amount || '0')) {
        existing[existingIdx].amount = record.amount
        updated = true
      }
      // Update with exact onchain block timestamp if available
      if (payout.timestamp && Math.abs(existing[existingIdx].timestamp - payout.timestamp) > 30000) {
        existing[existingIdx].timestamp = payout.timestamp
        updated = true
      }
    } else {
      existing.unshift(record)
      updated = true
    }

    if (updated) {
      const deduped = deduplicatePayouts(existing).slice(0, 100)
      localStorage.setItem(STORAGE_PAYOUTS_KEY, JSON.stringify(deduped))

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
      const parsed = JSON.parse(raw) as WinnerPayoutRecord[]
      if (Array.isArray(parsed)) {
        const deduped = deduplicatePayouts(parsed)
        if (deduped.length !== parsed.length) {
          localStorage.setItem(STORAGE_PAYOUTS_KEY, JSON.stringify(deduped))
        }
        return deduped
      }
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
 * Computes both Daily (24h rolling window) and All-Time leaderboards
 */
export function computeLeaderboard(
  rawPayouts: WinnerPayoutRecord[],
  timeframe: 'daily' | 'all-time' = 'daily'
): {
  leaderboard: LiveLeaderboardEntry[]
  dailyLeaderboard: LiveLeaderboardEntry[]
  allTimeLeaderboard: LiveLeaderboardEntry[]
  totalToday: string
  totalAllTime: string
  latestPayout: LatestPayoutInfo | null
  recentPayouts: LatestPayoutInfo[]
  payouts: WinnerPayoutRecord[]
} {
  const realPayouts = deduplicatePayouts(rawPayouts)
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000

  // 1. Calculate sums
  let todaySum = 0
  let allTimeSum = 0

  for (const p of realPayouts) {
    const val = parseFloat(p.amount) || 0
    allTimeSum += val
    if (p.timestamp >= oneDayAgo) {
      todaySum += val
    }
  }

  // 2. Helper to aggregate users for a filtered set of payouts
  const aggregateUsers = (payoutsSubset: WinnerPayoutRecord[]): LiveLeaderboardEntry[] => {
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

    for (const p of payoutsSubset) {
      const addr = p.winnerAddress.toLowerCase()
      const freshProfile = getUserProfile(p.winnerAddress)
      const current = userMap.get(addr) || {
        username:
          freshProfile?.username ||
          (p.username && !p.username.startsWith('0x') ? p.username : generateRandomUsername(p.winnerAddress)),
        address: p.winnerAddress,
        avatarSeed: freshProfile?.avatarSeed || p.avatarSeed || p.username || addr,
        total: 0,
        wins: 0,
      }
      current.total += parseFloat(p.amount) || 0
      current.wins += 1
      if (freshProfile?.username) {
        current.username = freshProfile.username
        current.avatarSeed = freshProfile.avatarSeed || freshProfile.username
      }
      userMap.set(addr, current)
    }

    return Array.from(userMap.values())
      .sort((a, b) => b.total - a.total || b.wins - a.wins)
      .map((u, idx) => ({
        rank: idx + 1,
        username: u.username,
        address: u.address,
        avatarSeed: u.avatarSeed,
        totalWinnings: u.total.toFixed(2),
        winCount: u.wins,
      }))
  }

  const dailySubset = realPayouts.filter((p) => p.timestamp >= oneDayAgo)
  const dailyLeaderboard = aggregateUsers(dailySubset)
  const allTimeLeaderboard = aggregateUsers(realPayouts)

  // 3. Determine recent payouts stream (up to 10 latest)
  const recentPayouts: LatestPayoutInfo[] = realPayouts.slice(0, 10).map((p) => {
    const freshProfile = getUserProfile(p.winnerAddress)
    const resolvedUsername =
      freshProfile?.username ||
      (p.username && !p.username.startsWith('0x')
        ? p.username
        : generateRandomUsername(p.winnerAddress))

    return {
      username: resolvedUsername,
      address: p.winnerAddress,
      amount: p.amount,
      category: p.category || 'General Knowledge',
      timeAgo: formatTimeAgo(p.timestamp),
      timestamp: p.timestamp,
      txHash: p.txHash,
    }
  })

  const latest = recentPayouts.length > 0 ? recentPayouts[0] : null

  const totalTodayFormatted =
    todaySum > 0
      ? `$${todaySum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Today`
      : '$0.00 Today'

  const totalAllTimeFormatted =
    allTimeSum > 0
      ? `$${allTimeSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} All-Time`
      : '$0.00 All-Time'

  const activeLeaderboard = timeframe === 'daily' ? dailyLeaderboard : allTimeLeaderboard

  return {
    leaderboard: activeLeaderboard,
    dailyLeaderboard,
    allTimeLeaderboard,
    totalToday: totalTodayFormatted,
    totalAllTime: totalAllTimeFormatted,
    latestPayout: latest,
    recentPayouts,
    payouts: realPayouts,
  }
}
