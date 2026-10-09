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
  if (!roomCode || !isValidCategory(category)) return
  const code = roomCode.trim().toUpperCase()

  // Guard against overwriting an already-stored specific category with generic fallback
  if (category === 'General Knowledge') {
    try {
      const existing =
        sessionStorage.getItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`) ||
        localStorage.getItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`)
      if (existing && isValidCategory(existing) && existing !== 'General Knowledge') {
        return // don't overwrite a specific category with the generic fallback
      }
    } catch {
      // ignore
    }
  }

  try {
    localStorage.setItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`, category)
    sessionStorage.setItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`, category)
  } catch {
    // ignore
  }
}

/** Smart category inference from room code prefix or keywords */
export function inferCategoryFromCode(code: string): Category | null {
  if (!code) return null
  const clean = code.trim().toUpperCase()

  // 1. Bomb Tag
  if (
    clean.startsWith('BOMB') || clean.includes('BOMB') ||
    clean.startsWith('TAG') || clean.includes('TAG') ||
    clean.startsWith('BOOM') || clean.includes('BOOM') ||
    clean.startsWith('BLAST') || clean.includes('BLAST') ||
    clean.startsWith('ELIM') || clean.includes('ELIM') ||
    clean.startsWith('TNT')
  ) {
    return 'Bomb Tag'
  }

  // 2. Crypto
  if (
    clean.startsWith('CRYP') || clean.includes('CRYP') ||
    clean.startsWith('BTC') || clean.startsWith('ETH') ||
    clean.startsWith('DEFI') || clean.startsWith('WEB3') ||
    clean.startsWith('SOL') || clean.includes('COIN') ||
    clean.includes('TOKEN')
  ) {
    return 'Crypto'
  }

  // 3. Candle Rush
  if (
    clean.startsWith('CANDLE') || clean.includes('CANDLE') ||
    clean.startsWith('CHART') || clean.includes('CHART') ||
    clean.startsWith('RUSH') || clean.includes('RUSH') ||
    clean.startsWith('TRAD') || clean.startsWith('BULL') ||
    clean.startsWith('BEAR') || clean.startsWith('DEX')
  ) {
    return 'Candle Rush'
  }

  // 4. Word Blitz
  if (
    clean.startsWith('BLITZ') || clean.includes('BLITZ') ||
    clean.startsWith('BLTZ') || clean.includes('BLTZ') ||
    clean.startsWith('WORD') || clean.includes('WORD') ||
    clean.startsWith('GRAM') || clean.startsWith('VOCAB') ||
    clean.startsWith('ANAG') || clean.startsWith('LEX')
  ) {
    return 'Word Blitz'
  }

  // 5. Emoji Decoder
  if (
    clean.startsWith('EMOJI') || clean.includes('EMOJI') ||
    clean.startsWith('EMOJ') || clean.startsWith('ICON') ||
    clean.startsWith('EMO')
  ) {
    return 'Emoji Decoder'
  }

  // 6. Logic & Math Arena
  if (
    clean.startsWith('MATH') || clean.includes('MATH') ||
    clean.startsWith('LOGIC') || clean.includes('LOGIC') ||
    clean.startsWith('CALC') || clean.startsWith('NUM') ||
    clean.startsWith('EULER') || clean.startsWith('PUZZLE')
  ) {
    return 'Logic & Math Arena'
  }

  // 7. Sports
  if (
    clean.startsWith('SPORT') || clean.includes('SPORT') ||
    clean.startsWith('BALL') || clean.startsWith('GAME') ||
    clean.startsWith('GOAL') || clean.startsWith('HOOP')
  ) {
    return 'Sports'
  }

  // 8. Pop Culture
  if (
    clean.startsWith('POP') || clean.includes('POP') ||
    clean.startsWith('MEME') || clean.includes('MEME') ||
    clean.startsWith('FILM') || clean.startsWith('STAR') ||
    clean.startsWith('SHOW') || clean.startsWith('CULT')
  ) {
    return 'Pop Culture'
  }

  // 9. Science
  if (
    clean.startsWith('SCI') || clean.includes('SCI') ||
    clean.startsWith('BIO') || clean.startsWith('PHYS') ||
    clean.startsWith('CHEM') || clean.startsWith('COSM') ||
    clean.startsWith('ASTRO')
  ) {
    return 'Science'
  }

  // 10. History
  if (
    clean.startsWith('HIST') || clean.includes('HIST') ||
    clean.startsWith('WAR') || clean.startsWith('LORE') ||
    clean.startsWith('PAST') || clean.startsWith('EMP')
  ) {
    return 'History'
  }

  // 11. General Knowledge
  if (
    clean.startsWith('GEN') || clean.startsWith('KNOW') ||
    clean.startsWith('TRV') || clean.startsWith('TRIV')
  ) {
    return 'General Knowledge'
  }

  return null
}

/** Retrieve the category assigned to a room code */
export function getRoomCategory(roomCode: string | null | undefined): Category | null {
  if (!roomCode) return null
  const code = roomCode.trim().toUpperCase()

  // 1. Check explicitly stored category (from host setting or user saving)
  try {
    const stored =
      sessionStorage.getItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`) ||
      localStorage.getItem(`${STORAGE_ROOM_CAT_PREFIX}${code}`)
    if (stored && isValidCategory(stored)) {
      return stored as Category
    }
  } catch {
    // ignore
  }

  // 2. Actively registered live rooms from hosts
  try {
    const liveRooms = getRegisteredLiveRooms()
    const foundLive = liveRooms.find(r => r.roomCode.toUpperCase() === code)
    if (foundLive && isValidCategory(foundLive.category)) {
      return foundLive.category
    }
  } catch {
    // ignore
  }

  // 4. Active game session
  try {
    const activeGame = getActiveGame()
    if (activeGame && activeGame.roomCode === code && isValidCategory(activeGame.category)) {
      return activeGame.category
    }
  } catch {
    // ignore
  }

  // 5. Pending join state
  try {
    const pending = getPendingJoin()
    if (pending && pending.roomCode === code && isValidCategory(pending.category)) {
      return pending.category
    }
  } catch {
    // ignore
  }

  // 6. Direct session and local storage
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

/** Generate a category-branded 6-character room code (e.g. BOMB88, CRYP42, etc.) */
export function generateCategoryRoomCode(cat?: Category): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let prefix = 'TRIV'
  if (cat === 'Bomb Tag') prefix = 'BOMB'
  else if (cat === 'Crypto') prefix = 'CRYP'
  else if (cat === 'Candle Rush') prefix = 'RUSH'
  else if (cat === 'Word Blitz') prefix = 'BLTZ'
  else if (cat === 'Emoji Decoder') prefix = 'EMOJ'
  else if (cat === 'Logic & Math Arena') prefix = 'MATH'
  else if (cat === 'Sports') prefix = 'SPRT'
  else if (cat === 'Pop Culture') prefix = 'POPC'
  else if (cat === 'Science') prefix = 'SCIE'
  else if (cat === 'History') prefix = 'HIST'
  else if (cat === 'General Knowledge') prefix = 'TRIV'

  const suffix = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${prefix}${suffix}`
}

/** Save the round duration (in seconds) for a room code */
export function saveRoomDuration(roomCode: string, duration: number): void {
  if (!roomCode || typeof duration !== 'number') return
  const code = roomCode.trim().toUpperCase()
  try {
    localStorage.setItem(`${STORAGE_ROOM_DUR_PREFIX}${code}`, String(duration))
    sessionStorage.setItem(`${STORAGE_ROOM_DUR_PREFIX}${code}`, String(duration))
  } catch {
    // ignore
  }
}

/** Retrieve the saved round duration (in seconds) for a room code */
export function getRoomDuration(roomCode: string | null | undefined, defaultDuration = 15): number {
  if (!roomCode) return defaultDuration
  const code = roomCode.trim().toUpperCase()
  try {
    const saved =
      sessionStorage.getItem(`${STORAGE_ROOM_DUR_PREFIX}${code}`) ||
      localStorage.getItem(`${STORAGE_ROOM_DUR_PREFIX}${code}`)
    if (saved !== null) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {
    // ignore
  }
  return defaultDuration
}

/** Save the prize pool amount for a room code */
export function saveRoomPrize(roomCode: string, prize: string): void {
  if (!roomCode || !prize) return
  const code = roomCode.trim().toUpperCase()
  try {
    localStorage.setItem(`trivio_room_prize_${code}`, prize)
    sessionStorage.setItem(`trivio_room_prize_${code}`, prize)
  } catch {
    // ignore
  }
}

/** Retrieve the saved prize pool amount for a room code */
export function getRoomPrize(roomCode: string | null | undefined): string | null {
  if (!roomCode) return null
  const code = roomCode.trim().toUpperCase()
  try {
    return (
      sessionStorage.getItem(`trivio_room_prize_${code}`) ||
      localStorage.getItem(`trivio_room_prize_${code}`)
    )
  } catch {
    return null
  }
}

export const EVENT_ROOM_SCORES_UPDATED = 'trivio_room_scores_updated'
const STORAGE_ROOM_SCORES_PREFIX = 'trivio_room_scores_'

export interface PlayerRoomScore {
  address: string
  score: number
  username?: string
  avatarSeed?: string
  avatarUrl?: string
  qIndex?: number
  isFinished?: boolean
  updatedAt: number
}

// BroadcastChannel for instant cross-tab / cross-window sync in the same browser
let roomSyncChannel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    roomSyncChannel = new BroadcastChannel('trivio_room_sync_channel')
    roomSyncChannel.onmessage = (e) => {
      if (e?.data?.type === 'SCORE_BROADCAST' && e.data.roomCode && e.data.address) {
        const { roomCode, address, score, options } = e.data
        saveRoomUserScoreInternal(roomCode, address, score, options, false)
        window.dispatchEvent(
          new CustomEvent(EVENT_ROOM_SCORES_UPDATED, {
            detail: { roomCode, address, score, options },
          })
        )
      }
    }
  }
} catch {
  // BroadcastChannel unavailable or restricted
}

function saveRoomUserScoreInternal(
  roomCode: string,
  address?: string,
  score?: number,
  options?: {
    username?: string
    avatarSeed?: string
    avatarUrl?: string
    qIndex?: number
    isFinished?: boolean
  },
  shouldBroadcast: boolean = true
): void {
  if (!roomCode || typeof score !== 'number') return
  const code = roomCode.trim().toUpperCase()
  const addr = address ? address.toLowerCase() : 'active'
  const now = Date.now()

  try {
    localStorage.setItem(`trivio_score_${code}_${addr}`, String(score))
    sessionStorage.setItem(`trivio_score_${code}_${addr}`, String(score))

    // Update the room-wide scores map
    const mapKey = `${STORAGE_ROOM_SCORES_PREFIX}${code}`
    const rawMap = sessionStorage.getItem(mapKey) || localStorage.getItem(mapKey)
    const map: Record<string, PlayerRoomScore> = rawMap ? JSON.parse(rawMap) : {}

    map[addr] = {
      address: addr,
      score,
      username: options?.username || map[addr]?.username,
      avatarSeed: options?.avatarSeed || map[addr]?.avatarSeed,
      avatarUrl: options?.avatarUrl || map[addr]?.avatarUrl,
      qIndex: options?.qIndex ?? map[addr]?.qIndex,
      isFinished: options?.isFinished ?? map[addr]?.isFinished,
      updatedAt: now,
    }

    const json = JSON.stringify(map)
    localStorage.setItem(mapKey, json)
    sessionStorage.setItem(mapKey, json)

    // Also update any matching pending payout room
    const pendingList = getPendingPayoutRooms()
    const targetPending = pendingList.find(p => p.roomCode === code)
    if (targetPending) {
      if (!targetPending.scores) targetPending.scores = {}
      targetPending.scores[addr] = score
      savePendingPayoutRoom(targetPending)
    }

    if (shouldBroadcast) {
      // Broadcast via BroadcastChannel to other tabs/windows
      if (roomSyncChannel) {
        roomSyncChannel.postMessage({
          type: 'SCORE_BROADCAST',
          roomCode: code,
          address: addr,
          score,
          options,
        })
      }

      // Dispatch local event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(EVENT_ROOM_SCORES_UPDATED, {
            detail: { roomCode: code, address: addr, score, options },
          })
        )
      }
    }
  } catch {
    // ignore storage errors
  }
}

/** Save a user's score for a specific room and notify all room subscribers */
export function saveRoomUserScore(
  roomCode: string,
  address?: string,
  score?: number,
  options?: {
    username?: string
    avatarSeed?: string
    avatarUrl?: string
    qIndex?: number
    isFinished?: boolean
  }
): void {
  saveRoomUserScoreInternal(roomCode, address, score, options, true)
}

/** Retrieve all scores recorded for a room as a simple map of { [address]: score } */
export function getRoomAllScores(roomCode: string | null | undefined): Record<string, number> {
  if (!roomCode) return {}
  const code = roomCode.trim().toUpperCase()
  const result: Record<string, number> = {}

  try {
    const mapKey = `${STORAGE_ROOM_SCORES_PREFIX}${code}`
    const rawMap = sessionStorage.getItem(mapKey) || localStorage.getItem(mapKey)
    if (rawMap) {
      const map: Record<string, PlayerRoomScore> = JSON.parse(rawMap)
      for (const [addr, entry] of Object.entries(map)) {
        if (typeof entry?.score === 'number') {
          result[addr.toLowerCase()] = entry.score
        }
      }
    }
  } catch {
    // ignore
  }

  // Also merge scores from pending payout rooms if available
  try {
    const pending = getPendingPayoutRooms().find(p => p.roomCode === code)
    if (pending?.scores) {
      for (const [addr, sc] of Object.entries(pending.scores)) {
        if (typeof sc === 'number' && !(addr.toLowerCase() in result)) {
          result[addr.toLowerCase()] = sc
        }
      }
    }
  } catch {
    // ignore
  }

  return result
}

/** Retrieve all player details (score, progress, username, avatar) for a room */
export function getRoomAllPlayerScores(
  roomCode: string | null | undefined
): Record<string, PlayerRoomScore> {
  if (!roomCode) return {}
  const code = roomCode.trim().toUpperCase()
  try {
    const mapKey = `${STORAGE_ROOM_SCORES_PREFIX}${code}`
    const rawMap = sessionStorage.getItem(mapKey) || localStorage.getItem(mapKey)
    if (rawMap) {
      return JSON.parse(rawMap)
    }
  } catch {
    // ignore
  }
  return {}
}

/** Retrieve a user's score for a specific room */
export function getRoomUserScore(roomCode: string | null | undefined, address?: string): number | null {
  if (!roomCode) return null
  const code = roomCode.trim().toUpperCase()
  const addr = address ? address.toLowerCase() : 'active'

  try {
    // 1. Direct score key check
    const saved =
      sessionStorage.getItem(`trivio_score_${code}_${addr}`) ||
      localStorage.getItem(`trivio_score_${code}_${addr}`)
    if (saved !== null) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed)) return parsed
    }

    // 2. Room scores map check
    const mapKey = `${STORAGE_ROOM_SCORES_PREFIX}${code}`
    const rawMap = sessionStorage.getItem(mapKey) || localStorage.getItem(mapKey)
    if (rawMap) {
      const map: Record<string, PlayerRoomScore> = JSON.parse(rawMap)
      if (typeof map[addr]?.score === 'number') {
        return map[addr].score
      }
    }

    // 3. Check active player fallback if address was not passed
    if (!address || address === 'active') {
      const activeSaved =
        sessionStorage.getItem(`trivio_score_${code}_active`) ||
        localStorage.getItem(`trivio_score_${code}_active`)
      if (activeSaved !== null) {
        const parsed = parseInt(activeSaved, 10)
        if (!isNaN(parsed)) return parsed
      }
    }

    // 4. Check pending payout rooms
    const pending = getPendingPayoutRooms().find(p => p.roomCode === code)
    if (pending?.scores && typeof pending.scores[addr] === 'number') {
      return pending.scores[addr]
    }
    if (pending && (!address || (pending.hostAddress && pending.hostAddress.toLowerCase() === addr))) {
      if (typeof pending.score === 'number') return pending.score
    }
  } catch {
    // ignore
  }
  return null
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

const STORAGE_PENDING_PAYOUT_ROOMS_KEY = 'trivio_pending_payout_rooms'

export interface PendingPayoutRoom {
  roomCode: string
  category: Category
  prize?: string
  payoutMode?: number
  finishedAt: number
  hostAddress?: string
  score?: number
  scores?: Record<string, number>
  playersCount?: number
}

/** Save a completed host game that is awaiting winner declaration and payout */
export function savePendingPayoutRoom(room: PendingPayoutRoom): void {
  if (!room?.roomCode) return
  const code = room.roomCode.trim().toUpperCase()
  try {
    const list = getPendingPayoutRooms()
    const filtered = list.filter(r => r.roomCode !== code)
    filtered.unshift({ ...room, roomCode: code })
    const sliced = filtered.slice(0, 10)
    localStorage.setItem(STORAGE_PENDING_PAYOUT_ROOMS_KEY, JSON.stringify(sliced))
    sessionStorage.setItem(STORAGE_PENDING_PAYOUT_ROOMS_KEY, JSON.stringify(sliced))
  } catch {
    // ignore
  }
}

/** Remove a room from pending payouts once declareWinner transaction is confirmed or dismissed */
export function removePendingPayoutRoom(roomCode: string): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  try {
    const list = getPendingPayoutRooms()
    const filtered = list.filter(r => r.roomCode !== code)
    localStorage.setItem(STORAGE_PENDING_PAYOUT_ROOMS_KEY, JSON.stringify(filtered))
    sessionStorage.setItem(STORAGE_PENDING_PAYOUT_ROOMS_KEY, JSON.stringify(filtered))
  } catch {
    // ignore
  }
}

/** Get list of pending payout rooms for a host (persisted across sessions and new room creations) */
export function getPendingPayoutRooms(hostAddress?: string): PendingPayoutRoom[] {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_PENDING_PAYOUT_ROOMS_KEY) ||
      localStorage.getItem(STORAGE_PENDING_PAYOUT_ROOMS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as PendingPayoutRoom[]
    if (!Array.isArray(list)) return []
    const valid = list.filter(r => {
      if (!r.roomCode || !isValidCategory(r.category)) return false
      // Expire after 7 days
      if (Date.now() - (r.finishedAt || 0) > 7 * 24 * 60 * 60 * 1000) return false
      if (hostAddress && r.hostAddress && r.hostAddress !== '0x0000000000000000000000000000000000000000' && hostAddress !== '0x0000000000000000000000000000000000000000') {
        if (r.hostAddress.toLowerCase() !== hostAddress.toLowerCase()) {
          return false
        }
      }
      return true
    })
    return valid
  } catch {
    return []
  }
}

const STORAGE_PENDING_REFUND_ROOMS_KEY = 'trivio_pending_refund_rooms'

export interface PendingRefundRoom {
  roomCode: string
  category: Category
  buyIn: string
  cancelledAt: number
  playerAddress: string
}

/** Save a cancelled buy-in room awaiting player refund */
export function savePendingRefundRoom(room: PendingRefundRoom): void {
  if (!room?.roomCode) return
  const code = room.roomCode.trim().toUpperCase()
  try {
    const list = getPendingRefundRooms()
    const filtered = list.filter(r => r.roomCode !== code || (room.playerAddress && r.playerAddress?.toLowerCase() !== room.playerAddress.toLowerCase()))
    filtered.unshift({ ...room, roomCode: code })
    const sliced = filtered.slice(0, 10)
    localStorage.setItem(STORAGE_PENDING_REFUND_ROOMS_KEY, JSON.stringify(sliced))
    sessionStorage.setItem(STORAGE_PENDING_REFUND_ROOMS_KEY, JSON.stringify(sliced))
  } catch {
    // ignore
  }
}

/** Remove a room from pending refunds once claimed */
export function removePendingRefundRoom(roomCode: string, playerAddress?: string): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  try {
    const list = getPendingRefundRooms()
    const filtered = list.filter(r => {
      if (r.roomCode !== code) return true
      if (playerAddress && r.playerAddress && r.playerAddress.toLowerCase() !== playerAddress.toLowerCase()) return true
      return false
    })
    localStorage.setItem(STORAGE_PENDING_REFUND_ROOMS_KEY, JSON.stringify(filtered))
    sessionStorage.setItem(STORAGE_PENDING_REFUND_ROOMS_KEY, JSON.stringify(filtered))
  } catch {
    // ignore
  }
}

/** Get list of pending refund rooms for a player */
export function getPendingRefundRooms(playerAddress?: string): PendingRefundRoom[] {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_PENDING_REFUND_ROOMS_KEY) ||
      localStorage.getItem(STORAGE_PENDING_REFUND_ROOMS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as PendingRefundRoom[]
    if (!Array.isArray(list)) return []
    const valid = list.filter(r => {
      if (!r.roomCode) return false
      // Expire after 7 days
      if (Date.now() - (r.cancelledAt || 0) > 7 * 24 * 60 * 60 * 1000) return false
      if (playerAddress && r.playerAddress && playerAddress !== '0x0000000000000000000000000000000000000000') {
        if (r.playerAddress.toLowerCase() !== playerAddress.toLowerCase()) {
          return false
        }
      }
      return true
    })
    return valid
  } catch {
    return []
  }
}

export function saveRoomCancelledState(roomCode: string, isCancelled: boolean = true): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  try {
    if (isCancelled) {
      sessionStorage.setItem(`trivio_room_cancelled_${code}`, 'true')
      localStorage.setItem(`trivio_room_cancelled_${code}`, 'true')
    } else {
      sessionStorage.removeItem(`trivio_room_cancelled_${code}`)
      localStorage.removeItem(`trivio_room_cancelled_${code}`)
    }
  } catch {
    // ignore
  }
}

export function isSavedRoomCancelled(roomCode: string): boolean {
  if (!roomCode) return false
  const code = roomCode.trim().toUpperCase()
  try {
    return (
      sessionStorage.getItem(`trivio_room_cancelled_${code}`) === 'true' ||
      localStorage.getItem(`trivio_room_cancelled_${code}`) === 'true'
    )
  } catch {
    return false
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
          if (category) {
            saveRoomCategory(cleanCode, category)
          }
          const finalCat = category || getRoomCategory(cleanCode) || undefined
          return { roomCode: cleanCode, category: finalCat }
        }
      }
    } catch {
      // fallback to regex extraction
    }
    const match = text.match(/(?:join|code)=([A-Za-z0-9]{4,8})/i)
    if (match && match[1]) {
      const code = match[1].toUpperCase()
      const category = getRoomCategory(code) || undefined
      return { roomCode: code, category }
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

/** Read ?join=CODE or ?code=CODE and ?cat=CATEGORY from URL search parameters or hash */
export function getJoinParamsFromUrl(): { roomCode: string; category?: Category } | null {
  try {
    if (typeof window === 'undefined') return null
    const p = new URLSearchParams(window.location.search)
    let rawCode = p.get('join') || p.get('code')
    let rawCat = p.get('cat') || p.get('category')

    if (!rawCode && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.slice(window.location.hash.indexOf('?'))
      const hp = new URLSearchParams(hashQuery)
      rawCode = hp.get('join') || hp.get('code')
      if (!rawCat) rawCat = hp.get('cat') || hp.get('category')
    }

    if (rawCode) {
      const extracted = extractRoomCode(rawCode)
      const code = extracted ? extracted.roomCode : rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
      const category = (isValidCategory(rawCat) ? rawCat : undefined) || extracted?.category || getRoomCategory(code) || undefined
      if (code && code.length >= 4) {
        if (category) saveRoomCategory(code, category)
        return { roomCode: code, category }
      }
    }
    return null
  } catch {
    return null
  }
}

/** Peek at pending join details without consuming */
export function getPendingJoin(): { roomCode: string; category?: Category } | null {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_PENDING_JOIN_KEY) ||
      localStorage.getItem(STORAGE_PENDING_JOIN_KEY)
    if (raw) {
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

/** Clear pending join details manually */
export function clearPendingJoin(): void {
  try {
    sessionStorage.removeItem(STORAGE_PENDING_JOIN_KEY)
    localStorage.removeItem(STORAGE_PENDING_JOIN_KEY)
  } catch {
    // ignore
  }
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
  roundDuration?: number
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
  // Legacy hardcoded seed room codes to filter out from any cached storage
  const LEGACY_SEED_CODES = new Set(['CRYP99', 'BLITZ4', 'EMOJI8', 'BOMB01', 'MATH12'])

  try {
    const raw =
      sessionStorage.getItem(STORAGE_LIVE_ROOMS_KEY) ||
      localStorage.getItem(STORAGE_LIVE_ROOMS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as RegisteredLiveRoom[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Keep rooms created within the last 24 hours, excluding legacy seed rooms
        const valid = parsed.filter(
          r => r?.roomCode &&
            !LEGACY_SEED_CODES.has(r.roomCode) &&
            Date.now() - (r.createdAt || 0) < 24 * 60 * 60 * 1000
        )
        if (valid.length > 0) return valid
      }
    }
  } catch {
    // ignore
  }

  // No rooms registered — return empty so the lobby shows the real empty state
  return []
}

/** Remove a live room once completed, cancelled, or closed */
export function removeLiveRoom(roomCode: string): void {
  const code = roomCode.trim().toUpperCase()
  try {
    const existing = getRegisteredLiveRooms()
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

const STORAGE_ROOM_TX_PREFIX = 'trivio_room_tx_'

/** Save payout transaction hash for a room */
export function saveRoomTxHash(roomCode: string, txHash: string): void {
  if (!roomCode || !txHash) return
  const code = roomCode.trim().toUpperCase()
  try {
    sessionStorage.setItem(`${STORAGE_ROOM_TX_PREFIX}${code}`, txHash)
    localStorage.setItem(`${STORAGE_ROOM_TX_PREFIX}${code}`, txHash)
  } catch {
    // ignore
  }
}

/** Retrieve saved payout transaction hash for a room */
export function getRoomTxHash(roomCode?: string | null): string | undefined {
  if (!roomCode) return undefined
  const code = roomCode.trim().toUpperCase()
  try {
    return (
      sessionStorage.getItem(`${STORAGE_ROOM_TX_PREFIX}${code}`) ||
      localStorage.getItem(`${STORAGE_ROOM_TX_PREFIX}${code}`) ||
      undefined
    )
  } catch {
    return undefined
  }
}

