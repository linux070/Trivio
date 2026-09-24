import type { Category } from './questions'
import { ALL_CATEGORIES } from './questions'

const STORAGE_ROOM_CAT_PREFIX = 'trivio_room_cat_'
const STORAGE_ROOM_DUR_PREFIX = 'trivio_room_dur_'
const STORAGE_ACTIVE_GAME_KEY = 'trivio_active_game'
const STORAGE_PENDING_JOIN_KEY = 'trivio_pending_join'

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
