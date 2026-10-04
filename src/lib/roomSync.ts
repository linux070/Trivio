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

export interface RoomScoreSyncMessage {
  type: 'SCORE_BROADCAST' | 'REQUEST_ROOM_SCORES' | 'SYNC_HEARTBEAT' | 'TX_HASH_BROADCAST'
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
 * Public zero-config relay endpoint for cross-browser / cross-device score broadcasting
 */
function getRelayTopic(code: string): string {
  return `trivio_room_score_${code.trim().toUpperCase()}`
}

/**
 * Hook to track and sync all players' real scores in a specific trivia room in real-time.
 * Synchronizes across:
 * 1. Same-tab state
 * 2. Cross-tab BroadcastChannel
 * 3. Cross-device / cross-browser WebSocket relay (via public lightweight pub/sub)
 */
export function useRoomScores(roomCode: string | null | undefined, myAddress?: string) {
  const code = roomCode ? roomCode.trim().toUpperCase() : null
  const [scores, setScores] = useState<Record<string, number>>(() => (code ? getRoomAllScores(code) : {}))
  const [playerDetails, setPlayerDetails] = useState<Record<string, PlayerRoomScore>>(() => (code ? getRoomAllPlayerScores(code) : {}))
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

  // Initial load + event listeners + WebSocket relay
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
      }
    }

    window.addEventListener(EVENT_ROOM_SCORES_UPDATED, handleCustomUpdate)
    window.addEventListener('storage', handleStorageUpdate)
    if (globalChannel) {
      globalChannel.addEventListener('message', handleBroadcastMessage)
    }

    // 2. Real-time Cross-Device WebSocket Relay connection
    let ws: WebSocket | null = null
    try {
      const topic = getRelayTopic(code)
      ws = new WebSocket(`wss://ntfy.sh/${topic}/ws`)
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed?.event === 'message' && parsed?.message) {
            const payload = JSON.parse(parsed.message)
            if (payload?.roomCode === code && payload?.address && typeof payload?.score === 'number') {
              saveRoomUserScore(code, payload.address, payload.score, payload.options)
              refreshScores()
            } else if (payload?.roomCode === code && payload?.type === 'TX_HASH_BROADCAST' && payload?.txHash) {
              saveRoomTxHash(code, payload.txHash)
            }
          }
        } catch {
          // ignore parsing error
        }
      }
    } catch {
      // WebSocket relay fallback gracefully
    }

    // Fast polling interval (750ms) to ensure instant synchronization
    const interval = setInterval(refreshScores, 750)

    return () => {
      window.removeEventListener(EVENT_ROOM_SCORES_UPDATED, handleCustomUpdate)
      window.removeEventListener('storage', handleStorageUpdate)
      if (globalChannel) {
        globalChannel.removeEventListener('message', handleBroadcastMessage)
      }
      if (ws) {
        ws.close()
      }
      clearInterval(interval)
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

      // 2. Relay via public HTTP endpoint to cross-device peers
      try {
        const topic = getRelayTopic(code)
        const payload = JSON.stringify({
          roomCode: code,
          address: myAddress.toLowerCase(),
          score,
          options,
          timestamp: Date.now(),
        })
        void fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {
          // relay fallback
        })
      } catch {
        // ignore
      }
    },
    [code, myAddress, refreshScores]
  )

  return {
    scores,
    playerDetails,
    refreshScores,
    syncMyScore,
  }
}

/**
 * Broadcast onchain payout transaction hash to all players in the room across tabs and devices
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

  try {
    const topic = getRelayTopic(code)
    void fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'TX_HASH_BROADCAST',
        roomCode: code,
        txHash,
        timestamp: Date.now(),
      }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // ignore
    })
  } catch {
    // ignore
  }
}

