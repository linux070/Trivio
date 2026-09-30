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

/** Resolve payout structure directly from onchain PayoutMode enum (0=Single, 1=Top2, 2=Top3, 3=Top5) */
export function resolvePayoutFromMode(payoutMode: number | undefined | null): PayoutStructure {
  if (payoutMode === 1) return PAYOUT_PRESETS.top2
  if (payoutMode === 2) return PAYOUT_PRESETS.top3
  if (payoutMode === 3) return PAYOUT_PRESETS.top5
  return PAYOUT_PRESETS.single
}

/** Retrieve host-configured payout structure for a room code (supported by onchain PayoutMode) */
export function getRoomPayout(
  roomCode: string | null | undefined,
  onchainPayoutMode?: number
): PayoutStructure {
  // 1. If onchain payoutMode is passed and > 0, prioritize onchain truth
  if (typeof onchainPayoutMode === 'number' && onchainPayoutMode > 0) {
    return resolvePayoutFromMode(onchainPayoutMode)
  }

  // 2. Check local/session storage if available
  if (roomCode) {
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
  }

  // 3. Fallback to onchain payoutMode (including 0=single)
  if (typeof onchainPayoutMode === 'number') {
    return resolvePayoutFromMode(onchainPayoutMode)
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
  phase?: 'lobby' | 'playing' | 'finished'
  score?: number
  qIndex?: number
  savedAt: number
}

/** Save an active game session so the user can easily continue / rejoin from the lobby */
export function saveActiveGame(
  roomCode: string,
  category: Category,
  isHost?: boolean,
  phase?: 'lobby' | 'playing' | 'finished',
  score?: number,
  qIndex?: number
): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  saveRoomCategory(code, category)
  const existing = getActiveGame()
  const resolvedPhase = phase ?? (existing?.roomCode === code ? existing.phase : undefined)
  const resolvedScore = score ?? (existing?.roomCode === code ? existing.score : undefined)
  const resolvedQIndex = qIndex ?? (existing?.roomCode === code ? existing.qIndex : undefined)
  const session: ActiveGameSession = {
    roomCode: code,
    category,
    isHost,
    phase: resolvedPhase,
    score: resolvedScore,
    qIndex: resolvedQIndex,
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
    const json = JSON.stringify(data)
    sessionStorage.setItem(STORAGE_PENDING_JOIN_KEY, json)
    localStorage.setItem(STORAGE_PENDING_JOIN_KEY, json)
  } catch {
    // ignore
  }
}

/**
 * Smart extractor for room codes from raw input or full invite URLs
 * Handles:
 * - "CRYP99" -> { roomCode: "CRYP99" }
 * - "https://trivio.io/?join=CRYP99&cat=Crypto" -> { roomCode: "CRYP99", category: "Crypto" }
 * - "trivio.io/?join=BLITZ4" -> { roomCode: "BLITZ4" }
 * - "#/join?code=BOMB01" or "#BOMB01" -> { roomCode: "BOMB01" }
 */
export function extractRoomCode(input: string): { roomCode: string; category?: Category } | null {
  if (!input) return null
  const text = input.trim()

  // 1. If it looks like a URL or query string containing 'join=' or 'code='
  if (text.includes('join=') || text.includes('code=') || text.includes('?')) {
    try {
      const fullUrl = text.startsWith('http://') || text.startsWith('https://') ? text : `https://${text}`
      const url = new URL(fullUrl)
      const code = url.searchParams.get('join') || url.searchParams.get('code')
      if (code) {
        const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
        const rawCat = url.searchParams.get('cat') || url.searchParams.get('category')
        const category = isValidCategory(rawCat) ? rawCat : undefined
        if (cleanCode.length >= 4) {
          return { roomCode: cleanCode, category }
        }
      }
    } catch {
      // fallback to regex extraction
    }
    const match = text.match(/(?:join|code)=([A-Za-z0-9]{4,8})/i)
    if (match && match[1]) {
      return { roomCode: match[1].toUpperCase() }
    }
  }

  // 2. Direct code extraction (stripping #, spaces, punctuation)
  const clean = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
  if (clean.length >= 4 && clean.length <= 8) {
    const category = getRoomCategory(clean) || undefined
    return { roomCode: clean, category }
  }

  return null
}

/** Retrieve and consume pending join details */
export function consumePendingJoin(): { roomCode: string; category?: Category } | null {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_PENDING_JOIN_KEY) ||
      localStorage.getItem(STORAGE_PENDING_JOIN_KEY)
    if (raw) {
      sessionStorage.removeItem(STORAGE_PENDING_JOIN_KEY)
      localStorage.removeItem(STORAGE_PENDING_JOIN_KEY)
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

export const STORAGE_LIVE_ROOMS_KEY = 'trivio_registered_live_rooms'
export const EVENT_LIVE_ROOMS_UPDATED = 'trivio_live_rooms_updated'

export interface RegisteredLiveRoom {
  roomCode: string
  category: Category
  hostName: string
  hostAddress: string
  maxPlayers: number
  buyIn: string
  isSponsored: boolean
  prizePool: string
  createdAt: number
}

/** Save an actual created room so it displays dynamically in the Live Rooms list */
export function registerLiveRoom(room: RegisteredLiveRoom): void {
  try {
    const existing = getRegisteredLiveRooms()
    const code = room.roomCode.trim().toUpperCase()
    const filtered = existing.filter(r => r.roomCode.toUpperCase() !== code)
    const updated = [{ ...room, roomCode: code }, ...filtered].slice(0, 50)
    const json = JSON.stringify(updated)
    localStorage.setItem(STORAGE_LIVE_ROOMS_KEY, json)
    sessionStorage.setItem(STORAGE_LIVE_ROOMS_KEY, json)

    // Dispatch custom event for real-time reactivity in current tab & cross-component sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_LIVE_ROOMS_UPDATED, { detail: { room, action: 'registered' } }))
    }
  } catch {
    // ignore
  }
}

/** Retrieve all actively registered live rooms */
export function getRegisteredLiveRooms(): RegisteredLiveRoom[] {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_LIVE_ROOMS_KEY) ||
      localStorage.getItem(STORAGE_LIVE_ROOMS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as RegisteredLiveRoom[]
      if (Array.isArray(parsed)) {
        // Keep rooms created within the last 24 hours
        return parsed.filter(
          r => r?.roomCode && Date.now() - (r.createdAt || 0) < 24 * 60 * 60 * 1000
        )
      }
    }
  } catch {
    // ignore
  }
  return []
}

/** Remove a live room once completed, cancelled, or closed */
export function removeLiveRoom(roomCode: string): void {
  try {
    const existing = getRegisteredLiveRooms()
    const code = roomCode.trim().toUpperCase()
    const filtered = existing.filter(r => r.roomCode.toUpperCase() !== code)
    const json = JSON.stringify(filtered)
    localStorage.setItem(STORAGE_LIVE_ROOMS_KEY, json)
    sessionStorage.setItem(STORAGE_LIVE_ROOMS_KEY, json)

    // Dispatch custom event for real-time reactivity in current tab & cross-component sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_LIVE_ROOMS_UPDATED, { detail: { roomCode: code, action: 'removed' } }))
    }
  } catch {
    // ignore
  }
}
