/**
 * Trivio Authoritative Real-Time Room Database
 * 
 * Provides resilient, low-latency cross-browser and cross-device synchronization
 * for room scores, player metadata, game start events, and onchain payout transactions.
 * 
 * Architecture:
 * 1. Primary: Cloud-backed real-time REST + Server-Sent Events (SSE) stream
 * 2. Secondary: Redundant fallback HTTP relay
 * 3. Local: BroadcastChannel (cross-tab) + LocalStorage/SessionStorage (offline/instant)
 */

import {
  saveRoomUserScore,
  getRoomAllPlayerScores,
  saveRoomTxHash,
  saveRoomCategory,
  saveRoomDuration,
} from './roomStorage'
import type { Category } from './questions'

export interface CloudRoomPlayer {
  address: string
  score: number
  username?: string
  avatarSeed?: string
  avatarUrl?: string
  qIndex?: number
  isFinished?: boolean
  updatedAt: number
}

export interface CloudRoomMeta {
  isStarted?: boolean
  status?: 'lobby' | 'playing' | 'finished'
  startedAt?: number
  category?: string
  duration?: number
}

export interface CloudRoomInfo {
  roomCode: string
  category: string
  hostName?: string
  hostAddress?: string
  maxPlayers?: number
  buyIn?: string
  isSponsored?: boolean
  prizePool?: string
  roundDuration?: number
  createdAt?: number
  updatedAt?: number
}

export interface CloudRoomState {
  roomCode: string
  scores: Record<string, CloudRoomPlayer>
  txHash?: string
  meta?: CloudRoomMeta
  info?: CloudRoomInfo
  updatedAt: number
}

// Global in-memory cache
const memoryCache: Record<string, CloudRoomState> = {}

// Primary cloud storage endpoint
const FIREBASE_HOST = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_RTDB_URL) ||
  'https://trivio-app-ffe6e-default-rtdb.firebaseio.com'
).replace(/\/$/, '')

const CLOUD_BASE_URL = `${FIREBASE_HOST}/rooms`
const CLOUD_LIVE_ROOMS_URL = `${FIREBASE_HOST}/liveRooms`
// Secondary fallback relay
const FALLBACK_RELAY_URL = 'https://ntfy.sh'

export interface CloudLeaderboardEntry {
  address: string
  score: number
  rank: number
  username?: string
  avatarUrl?: string
}

export interface CloudFinalLeaderboard {
  roomCode: string
  leaderboard: CloudLeaderboardEntry[]
  txHash?: string
  settledAt: number
}

function sanitizeAddressKey(address: string): string {
  return address.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getCloudUrl(roomCode: string, path = ''): string {
  const code = roomCode.trim().toUpperCase()
  return `${CLOUD_BASE_URL}/${code}${path}.json`
}

function getFallbackTopic(roomCode: string): string {
  return `trivio_room_score_${roomCode.trim().toUpperCase()}`
}

/**
 * Publish created room to cloud database so all online players see it in their Live Rooms list
 */
export async function publishLiveRoomToCloud(room: {
  roomCode: string
  category: string
  hostName: string
  hostAddress: string
  maxPlayers: number
  buyIn: string
  isSponsored: boolean
  prizePool: string
  createdAt: number
  roundDuration?: number
}): Promise<void> {
  if (!room?.roomCode) return
  const code = room.roomCode.trim().toUpperCase()
  const payload = {
    ...room,
    roomCode: code,
    updatedAt: Date.now(),
  }

  // 1. Write to liveRooms collection
  try {
    void fetch(`${CLOUD_LIVE_ROOMS_URL}/${code}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  } catch {
    // ignore
  }

  // 2. Write to room info & meta
  try {
    void fetch(getCloudUrl(code, '/info'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})

    void fetch(getCloudUrl(code, '/meta'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: room.category,
        duration: room.roundDuration || 15,
      }),
    }).catch(() => {})
  } catch {
    // ignore
  }

  // 3. Fallback relay
  void sendFallbackRelay(code, { type: 'LIVE_ROOM_REGISTERED', ...payload })
}

/**
 * Remove room from cloud live rooms when game begins, cancels, or finishes
 */
export async function removeLiveRoomFromCloud(roomCode: string): Promise<void> {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  try {
    void fetch(`${CLOUD_LIVE_ROOMS_URL}/${code}.json`, {
      method: 'DELETE',
    }).catch(() => {})
  } catch {
    // ignore
  }
}

/**
 * Fetch all actively open live rooms from cloud database
 */
export async function fetchCloudLiveRooms(): Promise<Array<{
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
}>> {
  try {
    const res = await fetch(`${CLOUD_LIVE_ROOMS_URL}.json`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object') {
        const results: any[] = []
        const now = Date.now()
        for (const [codeKey, item] of Object.entries(data)) {
          const room = item as any
          if (room && typeof room === 'object' && room.category) {
            const cleanCode = (room.roomCode || codeKey).trim().toUpperCase()
            // Only include rooms created within last 24 hours
            if (now - (room.createdAt || 0) < 24 * 60 * 60 * 1000) {
              const liveItem = {
                roomCode: cleanCode,
                category: room.category as Category,
                hostName: room.hostName || 'Host',
                hostAddress: room.hostAddress || '',
                maxPlayers: Number(room.maxPlayers) || 4,
                buyIn: String(room.buyIn || '0.00'),
                isSponsored: Boolean(room.isSponsored),
                prizePool: String(room.prizePool || '0.00'),
                createdAt: Number(room.createdAt) || now,
                roundDuration: room.roundDuration ? Number(room.roundDuration) : undefined,
              }
              results.push(liveItem)
              // Cache category & duration locally so lookup is instantaneous
              saveRoomCategory(cleanCode, room.category as Category)
              if (room.roundDuration) {
                saveRoomDuration(cleanCode, Number(room.roundDuration))
              }
            }
          }
        }
        return results
      }
    }
  } catch {
    // ignore fetch error
  }
  return []
}

/**
 * Submit category for a room code to cloud database
 */
export async function submitRoomCategory(roomCode: string, category: string, duration?: number): Promise<void> {
  if (!roomCode || !category) return
  const code = roomCode.trim().toUpperCase()
  try {
    void fetch(getCloudUrl(code, '/info'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, roundDuration: duration, updatedAt: Date.now() }),
    }).catch(() => {})

    void fetch(getCloudUrl(code, '/meta'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, duration, updatedAt: Date.now() }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}

/**
 * Fetch authoritative metadata for a specific room code from cloud
 */
export async function fetchRoomMetadata(roomCode: string): Promise<{
  category?: Category
  roundDuration?: number
  hostName?: string
  hostAddress?: string
  prizePool?: string
  isStarted?: boolean
  status?: string
} | null> {
  if (!roomCode) return null
  const code = roomCode.trim().toUpperCase()

  // 1. Try room info endpoint
  try {
    const res = await fetch(getCloudUrl(code, '/info'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data && data.category) {
        saveRoomCategory(code, data.category as Category)
        if (data.roundDuration) saveRoomDuration(code, Number(data.roundDuration))
        return {
          category: data.category as Category,
          roundDuration: data.roundDuration,
          hostName: data.hostName,
          hostAddress: data.hostAddress,
          prizePool: data.prizePool,
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Try liveRooms endpoint
  try {
    const resLive = await fetch(`${CLOUD_LIVE_ROOMS_URL}/${code}.json`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (resLive.ok) {
      const data = await resLive.json()
      if (data && data.category) {
        saveRoomCategory(code, data.category as Category)
        if (data.roundDuration) saveRoomDuration(code, Number(data.roundDuration))
        return {
          category: data.category as Category,
          roundDuration: data.roundDuration,
          hostName: data.hostName,
          hostAddress: data.hostAddress,
          prizePool: data.prizePool,
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Try room meta endpoint
  try {
    const resMeta = await fetch(getCloudUrl(code, '/meta'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (resMeta.ok) {
      const data = await resMeta.json()
      if (data && data.category) {
        saveRoomCategory(code, data.category as Category)
        if (data.duration) saveRoomDuration(code, Number(data.duration))
        return {
          category: data.category as Category,
          roundDuration: data.duration,
          isStarted: data.isStarted,
          status: data.status,
        }
      }
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Submit game start event to cloud database so all joined players start instantly without refreshing
 */
export async function submitGameStart(
  roomCode: string,
  category?: string,
  duration?: number
): Promise<void> {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()
  const now = Date.now()

  const meta: CloudRoomMeta = {
    isStarted: true,
    status: 'playing',
    startedAt: now,
    category,
    duration,
  }

  if (!memoryCache[code]) {
    memoryCache[code] = { roomCode: code, scores: {}, updatedAt: now }
  }
  memoryCache[code].meta = meta
  memoryCache[code].updatedAt = now

  try {
    const url = getCloudUrl(code, '/meta')
    void fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    }).catch(() => {
      void sendFallbackRelay(code, { type: 'GAME_START', ...meta })
    })
  } catch {
    void sendFallbackRelay(code, { type: 'GAME_START', ...meta })
  }
}

/**
 * Submit / sync a player's score to the authoritative cloud database and local state
 */
export async function submitPlayerScore(
  roomCode: string,
  address: string,
  score: number,
  options?: {
    username?: string
    avatarSeed?: string
    avatarUrl?: string
    qIndex?: number
    isFinished?: boolean
  }
): Promise<void> {
  if (!roomCode || !address) return
  const code = roomCode.trim().toUpperCase()
  const lowerAddr = address.toLowerCase()
  const addrKey = sanitizeAddressKey(lowerAddr)
  const now = Date.now()

  const playerData: CloudRoomPlayer = {
    address: lowerAddr,
    score,
    username: options?.username,
    avatarSeed: options?.avatarSeed,
    avatarUrl: options?.avatarUrl,
    qIndex: options?.qIndex,
    isFinished: options?.isFinished,
    updatedAt: now,
  }

  // 1. Instant local persistence & UI update
  saveRoomUserScore(code, lowerAddr, score, options)

  if (!memoryCache[code]) {
    memoryCache[code] = { roomCode: code, scores: {}, updatedAt: now }
  }
  memoryCache[code].scores[lowerAddr] = playerData
  memoryCache[code].updatedAt = now

  // 2. Primary Cloud Write with automatic retry on final score
  const url = getCloudUrl(code, `/scores/${addrKey}`)
  const maxAttempts = options?.isFinished ? 3 : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerData),
      })
      if (res.ok) break
    } catch {
      if (attempt === maxAttempts) {
        void sendFallbackRelay(code, playerData)
      } else {
        await new Promise((r) => setTimeout(r, 200 * attempt))
      }
    }
  }
}

/**
 * Submit authoritative locked final leaderboard snapshot
 */
export async function submitFinalLeaderboard(
  roomCode: string,
  leaderboard: CloudLeaderboardEntry[],
  txHash?: string
): Promise<void> {
  if (!roomCode || !leaderboard || leaderboard.length === 0) return
  const code = roomCode.trim().toUpperCase()
  const payload: CloudFinalLeaderboard = {
    roomCode: code,
    leaderboard,
    txHash,
    settledAt: Date.now(),
  }

  try {
    const url = getCloudUrl(code, '/finalLeaderboard')
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // fallback
  }
}

/**
 * Fetch authoritative locked final leaderboard snapshot
 */
export async function fetchFinalLeaderboard(
  roomCode: string
): Promise<CloudFinalLeaderboard | null> {
  if (!roomCode) return null
  const code = roomCode.trim().toUpperCase()

  try {
    const res = await fetch(getCloudUrl(code, '/finalLeaderboard'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data && Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
        return data as CloudFinalLeaderboard
      }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Secondary relay broadcast for redundancy
 */
async function sendFallbackRelay(roomCode: string, payloadData: any): Promise<void> {
  try {
    const topic = getFallbackTopic(roomCode)
    const payload = JSON.stringify({
      roomCode,
      ...payloadData,
    })
    await fetch(`${FALLBACK_RELAY_URL}/${topic}`, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // ignore
  }
}

/**
 * Fetch all authoritative player scores for a room
 */
export async function fetchAuthoritativeScores(
  roomCode: string
): Promise<Record<string, CloudRoomPlayer>> {
  if (!roomCode) return {}
  const code = roomCode.trim().toUpperCase()

  try {
    const res = await fetch(getCloudUrl(code, '/scores'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object') {
        const result: Record<string, CloudRoomPlayer> = {}
        for (const item of Object.values(data)) {
          const player = item as CloudRoomPlayer
          if (player?.address && typeof player.score === 'number') {
            result[player.address.toLowerCase()] = player
            // Sync into local storage
            saveRoomUserScore(code, player.address, player.score, {
              username: player.username,
              avatarSeed: player.avatarSeed,
              avatarUrl: player.avatarUrl,
              qIndex: player.qIndex,
              isFinished: player.isFinished,
            })
          }
        }
        if (Object.keys(result).length > 0) {
          if (!memoryCache[code]) {
            memoryCache[code] = { roomCode: code, scores: {}, updatedAt: Date.now() }
          }
          memoryCache[code].scores = { ...memoryCache[code].scores, ...result }
          return memoryCache[code].scores
        }
      }
    }
  } catch {
    // Cloud fetch failed, fallback to local & memory cache
  }

  // Fallback to local storage
  const localScores = getRoomAllPlayerScores(code)
  const fallbackResult: Record<string, CloudRoomPlayer> = {}
  for (const [addr, p] of Object.entries(localScores)) {
    fallbackResult[addr.toLowerCase()] = {
      address: addr.toLowerCase(),
      score: p.score,
      username: p.username,
      avatarSeed: p.avatarSeed,
      avatarUrl: p.avatarUrl,
      qIndex: p.qIndex,
      isFinished: p.isFinished,
      updatedAt: p.updatedAt || Date.now(),
    }
  }
  return fallbackResult
}

/**
 * Save authoritative payout transaction hash across all devices
 */
export async function submitAuthoritativeTxHash(
  roomCode: string,
  txHash: string
): Promise<void> {
  if (!roomCode || !txHash) return
  const code = roomCode.trim().toUpperCase()
  saveRoomTxHash(code, txHash)

  try {
    await fetch(getCloudUrl(code, '/txHash'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txHash),
    })
  } catch {
    // fallback
    try {
      const topic = getFallbackTopic(code)
      await fetch(`${FALLBACK_RELAY_URL}/${topic}`, {
        method: 'POST',
        body: JSON.stringify({ type: 'TX_HASH_BROADCAST', roomCode: code, txHash }),
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      // ignore
    }
  }
}

/**
 * Subscribe to live room updates with automated SSE + polling fallback
 */
export function subscribeToRoom(
  roomCode: string,
  onUpdate: (scores: Record<string, CloudRoomPlayer>, txHash?: string, meta?: CloudRoomMeta) => void
): () => void {
  if (!roomCode) return () => {}
  const code = roomCode.trim().toUpperCase()
  let isCleanedUp = false
  let eventSource: EventSource | null = null

  const handleData = (data: any) => {
    if (isCleanedUp || !data) return
    const scores: Record<string, CloudRoomPlayer> = {}
    let txHash: string | undefined
    let meta: CloudRoomMeta | undefined

    if (typeof data.txHash === 'string' && data.txHash) {
      const validTx = data.txHash
      txHash = validTx
      saveRoomTxHash(code, validTx)
    }

    if (data.meta && typeof data.meta === 'object') {
      meta = data.meta as CloudRoomMeta
    } else if (data.isStarted !== undefined || data.status === 'playing') {
      meta = {
        isStarted: Boolean(data.isStarted || data.status === 'playing'),
        status: data.status,
        startedAt: data.startedAt,
        category: data.category,
        duration: data.duration,
      }
    }

    const rawScores = data.scores || (data.address ? { [data.address]: data } : null)
    if (rawScores && typeof rawScores === 'object') {
      for (const item of Object.values(rawScores)) {
        const player = item as CloudRoomPlayer
        if (player?.address && typeof player.score === 'number') {
          const lower = player.address.toLowerCase()
          scores[lower] = player
          saveRoomUserScore(code, lower, player.score, {
            username: player.username,
            avatarSeed: player.avatarSeed,
            avatarUrl: player.avatarUrl,
            qIndex: player.qIndex,
            isFinished: player.isFinished,
          })
        }
      }
    }

    if (Object.keys(scores).length > 0 || txHash || meta?.isStarted) {
      onUpdate(scores, txHash, meta)
    }
  }

  // 1. Initial immediate fetch of scores and meta
  const checkInitial = async () => {
    try {
      const res = await fetch(getCloudUrl(code), { headers: { Accept: 'application/json' } })
      if (res.ok) {
        const fullData = await res.json()
        if (fullData) handleData(fullData)
      }
    } catch {
      void fetchAuthoritativeScores(code).then((scores) => {
        if (!isCleanedUp && Object.keys(scores).length > 0) {
          onUpdate(scores)
        }
      })
    }
  }
  void checkInitial()

  // 2. Real-time SSE Stream (built into all browsers)
  try {
    eventSource = new EventSource(getCloudUrl(code))
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed && typeof parsed === 'object') {
          handleData(parsed.data || parsed)
        }
      } catch {
        // ignore JSON parse error
      }
    }
    eventSource.onerror = () => {
      // EventSource auto-reconnects, polling ensures backup
    }
  } catch {
    // SSE not supported
  }

  // 3. Reliable Polling Backup (every 1.2 seconds)
  const pollInterval = setInterval(() => {
    if (isCleanedUp) return
    void checkInitial()
  }, 1200)

  return () => {
    isCleanedUp = true
    if (eventSource) {
      eventSource.close()
    }
    clearInterval(pollInterval)
  }
}
