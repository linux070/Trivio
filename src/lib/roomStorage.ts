import type { Category } from './questions'
import { ALL_CATEGORIES } from './questions'

const STORAGE_ROOM_CAT_PREFIX = 'trivio_room_cat_'
const STORAGE_ROOM_DUR_PREFIX = 'trivio_room_dur_'
const STORAGE_ROOM_PAYOUT_PREFIX = 'trivio_room_payout_'
const STORAGE_ACTIVE_GAME_KEY = 'trivio_active_game'
const STORAGE_PENDING_JOIN_KEY = 'trivio_pending_join'

export type PayoutPreset = 'top1' | 'top3' | 'top5' | 'top10' | 'custom' | 'single' | 'top2' | 'podium'

export interface PayoutSplitItem {
  rank: number
  bps: number // Basis points (10000 = 100%)
  percent: number // Percentage (e.g. 70)
  label: string // e.g. "1st Place"
}

export interface PayoutStructure {
  preset: PayoutPreset
  label: string
  splits: PayoutSplitItem[]
}

export const PAYOUT_PRESETS: Record<string, PayoutStructure> = {
  top1: {
    preset: 'top1',
    label: 'Top 1 (100%)',
    splits: [
      { rank: 1, bps: 10000, percent: 100, label: '1st Place' },
    ],
  },
  top3: {
    preset: 'top3',
    label: 'Top 3 (50 / 30 / 20)',
    splits: [
      { rank: 1, bps: 5000, percent: 50, label: '1st Place' },
      { rank: 2, bps: 3000, percent: 30, label: '2nd Place' },
      { rank: 3, bps: 2000, percent: 20, label: '3rd Place' },
    ],
  },
  top5: {
    preset: 'top5',
    label: 'Top 5 (40 / 25 / 15 / 10 / 10)',
    splits: [
      { rank: 1, bps: 4000, percent: 40, label: '1st Place' },
      { rank: 2, bps: 2500, percent: 25, label: '2nd Place' },
      { rank: 3, bps: 1500, percent: 15, label: '3rd Place' },
      { rank: 4, bps: 1000, percent: 10, label: '4th Place' },
      { rank: 5, bps: 1000, percent: 10, label: '5th Place' },
    ],
  },
  top10: {
    preset: 'top10',
    label: 'Top 10',
    splits: [
      { rank: 1, bps: 3000, percent: 30, label: '1st Place' },
      { rank: 2, bps: 2000, percent: 20, label: '2nd Place' },
      { rank: 3, bps: 1500, percent: 15, label: '3rd Place' },
      { rank: 4, bps: 1000, percent: 10, label: '4th Place' },
      { rank: 5, bps: 700, percent: 7, label: '5th Place' },
      { rank: 6, bps: 600, percent: 6, label: '6th Place' },
      { rank: 7, bps: 400, percent: 4, label: '7th Place' },
      { rank: 8, bps: 300, percent: 3, label: '8th Place' },
      { rank: 9, bps: 300, percent: 3, label: '9th Place' },
      { rank: 10, bps: 200, percent: 2, label: '10th Place' },
    ],
  },
  // Legacy mappings for backward compatibility
  single: {
    preset: 'top1',
    label: 'Top 1 (100%)',
    splits: [
      { rank: 1, bps: 10000, percent: 100, label: '1st Place' },
    ],
  },
  top2: {
    preset: 'custom',
    label: 'Top 2 (70 / 30)',
    splits: [
      { rank: 1, bps: 7000, percent: 70, label: '1st Place' },
      { rank: 2, bps: 3000, percent: 30, label: '2nd Place' },
    ],
  },
  podium: {
    preset: 'top3',
    label: 'Top 3 (50 / 30 / 20)',
    splits: [
      { rank: 1, bps: 5000, percent: 50, label: '1st Place' },
      { rank: 2, bps: 3000, percent: 30, label: '2nd Place' },
      { rank: 3, bps: 2000, percent: 20, label: '3rd Place' },
    ],
  },
}

/** Save host-configured payout structure for a room code */
export function saveRoomPayout(roomCode: string, payout: PayoutStructure): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  try {
    const json = JSON.stringify(payout)
    localStorage.setItem(`${STORAGE_ROOM_PAYOUT_PREFIX}${code}`, json)
    sessionStorage.setItem(`${STORAGE_ROOM_PAYOUT_PREFIX}${code}`, json)
  } catch {
    // ignore
  }
}

/** Retrieve host-configured payout structure for a room code (defaults to Single Winner 100%) */
export function getRoomPayout(roomCode: string | null | undefined): PayoutStructure {
  if (!roomCode) return PAYOUT_PRESETS.single
  const code = roomCode.trim().toUpperCase()
  try {
    const saved =
      sessionStorage.getItem(`${STORAGE_ROOM_PAYOUT_PREFIX}${code}`) ||
      localStorage.getItem(`${STORAGE_ROOM_PAYOUT_PREFIX}${code}`)
    if (saved) {
      const parsed = JSON.parse(saved) as PayoutStructure
      if (parsed?.splits && Array.isArray(parsed.splits) && parsed.splits.length > 0) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return PAYOUT_PRESETS.single
}

/** Compute exact monetary USDC payouts for each winning tier */
export function calculatePayoutSplits(
  totalPrize: number | string,
  splits: PayoutSplitItem[]
): { rank: number; label: string; bps: number; percent: number; amount: string }[] {
  const numericTotal = typeof totalPrize === 'string' ? parseFloat(totalPrize) || 0 : totalPrize
  return splits.map((s) => {
    const splitAmount = (numericTotal * s.bps) / 10000
    // Format to 2 decimal places, removing trailing zeroes if integer
    const formatted = (Math.round(splitAmount * 100) / 100).toFixed(2)
    return {
      rank: s.rank,
      label: s.label,
      bps: s.bps,
      percent: s.percent,
      amount: formatted,
    }
  })
}

/** Validate if a string matches one of the valid Category names */
export function isValidCategory(cat: string | null | undefined): cat is Category {
  if (!cat) return false
  return ALL_CATEGORIES.includes(cat as Category)
}

/** Save the host-assigned category for a room code */
export function saveRoomCategory(roomCode: string, category: Category): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  try {
    localStorage.setItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`, category)
    sessionStorage.setItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`, category)
  } catch {
    // ignore
  }
}

/** Retrieve the category assigned to a room code */
export function getRoomCategory(roomCode: string | null | undefined): Category | null {
  if (!roomCode) return null
  const code = roomCode.trim().toUpperCase()
  try {
    const saved =
      sessionStorage.getItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`) ||
      localStorage.getItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`)
    if (isValidCategory(saved)) return saved
  } catch {
    // ignore
  }
  return null
}

/** Save the host-assigned round duration (in seconds) for a room code */
export function saveRoomDuration(roomCode: string, durationSeconds: number): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  try {
    localStorage.setItem(`${STORAGE_ROOM_DUR_PREFIX}${code}`, String(durationSeconds))
    sessionStorage.setItem(`${STORAGE_ROOM_DUR_PREFIX}${code}`, String(durationSeconds))
  } catch {
    // ignore
  }
}

/** Retrieve the round duration (in seconds) for a room code */
export function getRoomDuration(roomCode: string | null | undefined, defaultDuration = 15): number {
  if (!roomCode) return defaultDuration
  const code = roomCode.trim().toUpperCase()
  try {
    const saved =
      sessionStorage.getItem(`${STORAGE_ROOM_DUR_PREFIX}${code}`) ||
      localStorage.getItem(`${STORAGE_ROOM_DUR_PREFIX}${code}`)
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= 5 && parsed <= 120) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return defaultDuration
}

export interface ActiveGameSession {
  roomCode: string
  category: Category
  isHost?: boolean
  savedAt: number
}

/** Save an active game session so the user can easily continue / rejoin from the lobby */
export function saveActiveGame(roomCode: string, category: Category, isHost?: boolean): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  saveRoomCategory(code, category)
  const session: ActiveGameSession = {
    roomCode: code,
    category,
    isHost,
    savedAt: Date.now(),
  }
  try {
    const json = JSON.stringify(session)
    localStorage.setItem(STORAGE_ACTIVE_GAME_KEY, json)
    sessionStorage.setItem(STORAGE_ACTIVE_GAME_KEY, json)
  } catch {
    // ignore
  }
}

/** Get the currently saved active game session if any (valid within 2 hours) */
export function getActiveGame(): ActiveGameSession | null {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_ACTIVE_GAME_KEY) ||
      localStorage.getItem(STORAGE_ACTIVE_GAME_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveGameSession
      if (parsed?.roomCode && isValidCategory(parsed?.category)) {
        // Expire session after 2 hours
        if (Date.now() - (parsed.savedAt || 0) < 2 * 60 * 60 * 1000) {
          return parsed
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

/** Clear active game session upon game completion or explicit exit */
export function clearActiveGame(): void {
  try {
    localStorage.removeItem(STORAGE_ACTIVE_GAME_KEY)
    sessionStorage.removeItem(STORAGE_ACTIVE_GAME_KEY)
  } catch {
    // ignore
  }
}

/** Store pending join details across auth/onboarding transitions */
export function setPendingJoin(roomCode: string, category?: Category): void {
  try {
    const data = { roomCode: roomCode.trim().toUpperCase(), category }
    sessionStorage.setItem(STORAGE_PENDING_JOIN_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

/** Retrieve and consume pending join details */
export function consumePendingJoin(): { roomCode: string; category?: Category } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PENDING_JOIN_KEY)
    if (raw) {
      sessionStorage.removeItem(STORAGE_PENDING_JOIN_KEY)
      // Check if it's JSON or legacy raw string
      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw)
        if (parsed?.roomCode) {
          return {
            roomCode: parsed.roomCode.trim().toUpperCase(),
            category: isValidCategory(parsed.category) ? parsed.category : undefined,
          }
        }
      } else {
        return { roomCode: raw.trim().toUpperCase() }
      }
    }
  } catch {
    // ignore
  }
  return null
}
