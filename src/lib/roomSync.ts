import { useState, useEffect, useCallback, useRef } from 'react'
import {
  saveRoomUserScore,
  getRoomAllScores,
  getRoomAllPlayerScores,
  getRoomUserScore,
  saveRoomTxHash,
  EVENT_ROOM_SCORES_UPDATED,
  type PlayerRoomScore,
} from './roomStorage'
import {
  submitPlayerScore,
  subscribeToRoom,
  submitAuthoritativeTxHash,
  submitGameStart,
  submitGameCancel,
  type CloudRoomPlayer,
  type CloudRoomMeta,
} from './roomDb'

export interface RoomScoreSyncMessage {
  type:
    | 'SCORE_BROADCAST'
    | 'REQUEST_ROOM_SCORES'
    | 'SYNC_HEARTBEAT'
    | 'TX_HASH_BROADCAST'
    | 'GAME_START_BROADCAST'
    | 'GAME_CANCEL_BROADCAST'
  roomCode: string
  address?: string
  score?: number
  txHash?: string
  options?: {
    username?: string
    avatarSeed?: string
    avatarUrl?: string
    qIndex?: number
    isFinished?: boolean
    category?: string
    duration?: number
    reason?: string
  }
  timestamp: number
}

// Global broadcast channel for cross-tab sync in the same browser
let globalChannel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    globalChannel = new BroadcastChannel('trivio_room_sync_channel')
  }
} catch {
  // BroadcastChannel unavailable
}

/**
 * Hook to track and sync all players' real scores and room status in real-time.
 * Synchronizes across:
 * 1. Same-tab state
 * 2. Cross-tab BroadcastChannel
 * 3. Authoritative Cloud Database & SSE Stream (works across distinct devices/browsers)
 */
export function useRoomScores(roomCode: string | null | undefined, myAddress?: string) {
  const code = roomCode ? roomCode.trim().toUpperCase() : null
  const [scores, setScores] = useState<Record<string, number>>(() => (code ? getRoomAllScores(code) : {}))
  const [playerDetails, setPlayerDetails] = useState<Record<string, PlayerRoomScore>>(() => (code ? getRoomAllPlayerScores(code) : {}))
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [isGameCancelled, setIsGameCancelled] = useState(false)
  const [cancelReason, setCancelReason] = useState<string | undefined>(undefined)
  const [gameMeta, setGameMeta] = useState<{ startedAt?: number; category?: string; duration?: number } | null>(null)

  const myAddressRef = useRef(myAddress)
  myAddressRef.current = myAddress

  const refreshScores = useCallback(() => {
    if (!code) return
    const all = getRoomAllScores(code)
    const details = getRoomAllPlayerScores(code)

    // Ensure my own score is present if known
    if (myAddressRef.current) {
      const myAddr = myAddressRef.current.toLowerCase()
      const mySaved = getRoomUserScore(code, myAddr)
      if (typeof mySaved === 'number' && (!(myAddr in all) || all[myAddr] < mySaved)) {
        all[myAddr] = mySaved
      }
    }

    setScores(all)
    setPlayerDetails(details)
  }, [code])

  // Initial load + event listeners + Authoritative Cloud Stream
  useEffect(() => {
    if (!code) return

    refreshScores()

    // 1. BroadcastChannel: Request scores from any other open tabs/windows
    if (globalChannel) {
      try {
        globalChannel.postMessage({
          type: 'REQUEST_ROOM_SCORES',
          roomCode: code,
          timestamp: Date.now(),
        })
      } catch {
        // ignore
      }
    }

    const handleCustomUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail
      if (!detail?.roomCode || detail.roomCode.toUpperCase() === code) {
        refreshScores()
      }
    }

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key?.includes(code) || e.key?.includes('trivio_room_scores') || e.key?.includes('trivio_score')) {
        refreshScores()
      }
    }

    const handleBroadcastMessage = (e: MessageEvent) => {
      const data = e.data as RoomScoreSyncMessage | undefined
      if (!data) return

      if (data.type === 'REQUEST_ROOM_SCORES' && data.roomCode === code && myAddressRef.current) {
        const myAddr = myAddressRef.current.toLowerCase()
        const myScore = getRoomUserScore(code, myAddr)
        if (typeof myScore === 'number' && globalChannel) {
          try {
            globalChannel.postMessage({
              type: 'SCORE_BROADCAST',
              roomCode: code,
              address: myAddr,
              score: myScore,
              timestamp: Date.now(),
            })
          } catch {
            // ignore
          }
        }
      } else if (data.type === 'SCORE_BROADCAST' && data.roomCode === code) {
        refreshScores()
      } else if (data.type === 'TX_HASH_BROADCAST' && data.roomCode === code && data.txHash) {
        saveRoomTxHash(code, data.txHash)
      } else if (data.type === 'GAME_START_BROADCAST' && data.roomCode === code) {
        setIsGameStarted(true)
        setGameMeta({
          startedAt: data.timestamp,
          category: data.options?.category,
          duration: data.options?.duration,
        })
      } else if (data.type === 'GAME_CANCEL_BROADCAST' && data.roomCode === code) {
        setIsGameCancelled(true)
        setCancelReason(data.options?.reason || 'Cancelled by host')
      }
    }

    window.addEventListener(EVENT_ROOM_SCORES_UPDATED, handleCustomUpdate)
    window.addEventListener('storage', handleStorageUpdate)
    if (globalChannel) {
      globalChannel.addEventListener('message', handleBroadcastMessage)
    }

    // 2. Authoritative Cloud Database Real-time Subscription (Cross-Device & Cross-Browser)
    const unsubscribe = subscribeToRoom(
      code,
      (_cloudScores: Record<string, CloudRoomPlayer>, txHash?: string, meta?: CloudRoomMeta) => {
        if (txHash) {
          saveRoomTxHash(code, txHash)
        }
        if (meta?.isCancelled || meta?.status === 'cancelled') {
          setIsGameCancelled(true)
          setCancelReason(meta.reason || 'Cancelled by host')
        } else if (meta?.isStarted || meta?.status === 'playing') {
          setIsGameStarted(true)
          setGameMeta({
            startedAt: meta.startedAt,
            category: meta.category,
            duration: meta.duration,
          })
        }
        refreshScores()
      }
    )

    return () => {
      window.removeEventListener(EVENT_ROOM_SCORES_UPDATED, handleCustomUpdate)
      window.removeEventListener('storage', handleStorageUpdate)
      if (globalChannel) {
        globalChannel.removeEventListener('message', handleBroadcastMessage)
      }
      unsubscribe()
    }
  }, [code, refreshScores])

  const syncMyScore = useCallback(
    (
      score: number,
      options?: {
        username?: string
        avatarSeed?: string
        avatarUrl?: string
        qIndex?: number
        isFinished?: boolean
      }
    ) => {
      if (!code || !myAddress) return

      // 1. Save locally and dispatch custom event + BroadcastChannel
      saveRoomUserScore(code, myAddress, score, options)
      refreshScores()

      if (globalChannel) {
        try {
          globalChannel.postMessage({
            type: 'SCORE_BROADCAST',
            roomCode: code,
            address: myAddress.toLowerCase(),
            score,
            options,
            timestamp: Date.now(),
          })
        } catch {
          // ignore
        }
      }

      // 2. Submit to Authoritative Cloud DB
      void submitPlayerScore(code, myAddress, score, options)
    },
    [code, myAddress, refreshScores]
  )

  return {
    scores,
    playerDetails,
    isGameStarted,
    isGameCancelled,
    cancelReason,
    gameMeta,
    refreshScores,
    syncMyScore,
  }
}

/**
 * Broadcast game cancellation event across all devices, tabs, and browsers
 */
export function broadcastGameCancel(roomCode: string, reason: string = 'Cancelled by host'): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()

  if (globalChannel) {
    try {
      globalChannel.postMessage({
        type: 'GAME_CANCEL_BROADCAST',
        roomCode: code,
        options: { reason },
        timestamp: Date.now(),
      })
    } catch {
      // ignore
    }
  }

  void submitGameCancel(code, reason)
}

/**
 * Broadcast game start event across all devices, tabs, and browsers
 */
export function broadcastGameStart(roomCode: string, category?: string, duration?: number): void {
  if (!roomCode) return
  const code = roomCode.trim().toUpperCase()

  if (globalChannel) {
    try {
      globalChannel.postMessage({
        type: 'GAME_START_BROADCAST',
        roomCode: code,
        options: { category, duration },
        timestamp: Date.now(),
      })
    } catch {
      // ignore
    }
  }

  void submitGameStart(code, category, duration)
}

/**
 * Broadcast onchain payout transaction hash to all players in the room across tabs, browsers and devices
 */
export function broadcastRoomTxHash(roomCode: string, txHash: string): void {
  if (!roomCode || !txHash) return
  const code = roomCode.trim().toUpperCase()
  saveRoomTxHash(code, txHash)

  if (globalChannel) {
    try {
      globalChannel.postMessage({
        type: 'TX_HASH_BROADCAST',
        roomCode: code,
        txHash,
        timestamp: Date.now(),
      })
    } catch {
      // ignore
    }
  }

  void submitAuthoritativeTxHash(code, txHash)
}
