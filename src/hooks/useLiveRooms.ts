import { useState, useEffect, useMemo, useCallback } from 'react'
import { useReadContracts } from 'wagmi'
import { ARC_TESTNET_CHAIN_ID, TRIVIA_GAME_ADDRESS } from '@/config'
import { TRIVIA_ABI, roomCodeToBytes32, formatUSDCRaw, type RoomTuple } from '@/hooks/useTriviaContract'
import { getRegisteredLiveRooms, removeLiveRoom, EVENT_LIVE_ROOMS_UPDATED, type RegisteredLiveRoom } from '@/lib/roomStorage'
import type { Category } from '@/lib/questions'

export interface LiveRoomItem {
  roomCode: string
  category: Category
  hostName: string
  hostAddress: string
  playerCount: number
  maxPlayers: number
  buyIn: string
  isSponsored: boolean
  prizePool: string
  isOpen: boolean
  createdAt: number
}

export function useLiveRooms(pollInterval: number = 1500) {
  const [registered, setRegistered] = useState<RegisteredLiveRoom[]>(() => getRegisteredLiveRooms())

  const syncRegistered = useCallback(() => {
    setRegistered(getRegisteredLiveRooms())
  }, [])

  // Keep registered rooms list refreshed with real-time events + fast interval
  useEffect(() => {
    syncRegistered()
    const interval = setInterval(syncRegistered, pollInterval)

    const handleRealtimeUpdate = () => {
      syncRegistered()
    }

    window.addEventListener(EVENT_LIVE_ROOMS_UPDATED, handleRealtimeUpdate)
    window.addEventListener('storage', handleRealtimeUpdate)
    window.addEventListener('focus', handleRealtimeUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener(EVENT_LIVE_ROOMS_UPDATED, handleRealtimeUpdate)
      window.removeEventListener('storage', handleRealtimeUpdate)
      window.removeEventListener('focus', handleRealtimeUpdate)
    }
  }, [pollInterval, syncRegistered])

  // Build batch contracts query for all registered rooms
  const contracts = useMemo(() => {
    if (!TRIVIA_GAME_ADDRESS || registered.length === 0) return []
    return registered.map((r) => ({
      address: TRIVIA_GAME_ADDRESS,
      abi: TRIVIA_ABI,
      functionName: 'getRoom' as const,
      args: [roomCodeToBytes32(r.roomCode)],
      chainId: ARC_TESTNET_CHAIN_ID,
    }))
  }, [registered])

  const { data: onchainData, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: Boolean(TRIVIA_GAME_ADDRESS && registered.length > 0),
      refetchInterval: pollInterval,
    },
  })

  // Combine registered metadata with verified real-time onchain room status
  const liveRooms = useMemo<LiveRoomItem[]>(() => {
    if (registered.length === 0) return []

    const results: LiveRoomItem[] = []

    registered.forEach((r, idx) => {
      const roomResult = onchainData?.[idx]?.result as RoomTuple | undefined
      if (roomResult) {
        const [
          host,
          _buyIn,
          prizePool,
          maxP,
          playerCount,
          status,
        ] = roomResult

        // Status 0 = Open (Waiting for players)
        // If status !== 0 (started, finished, cancelled), room is not available as open lobby
        if (status === 0) {
          const onchainBuyInHuman = _buyIn !== undefined ? formatUSDCRaw(_buyIn) : r.buyIn
          const buyInNum = parseFloat(onchainBuyInHuman) || 0
          const maxPNum = Number(maxP) || r.maxPlayers || 4
          const currentPrizeNum = parseFloat(prizePool !== undefined ? formatUSDCRaw(prizePool) : '0') || 0
          const isSponsored = buyInNum === 0

          // In buy-in mode, compute total potential prize pool (buyIn * maxPlayers) if collected prize is currently 0
          const estimatedTotalPrize = buyInNum > 0
            ? (buyInNum * maxPNum).toFixed(2)
            : (prizePool !== undefined ? formatUSDCRaw(prizePool) : r.prizePool)
          const finalPrizePool = currentPrizeNum > 0 ? formatUSDCRaw(prizePool) : estimatedTotalPrize

          const isFull = maxPNum > 0 && Number(playerCount) >= maxPNum
          if (!isFull) {
            results.push({
              roomCode: r.roomCode,
              category: r.category,
              hostName: r.hostName,
              hostAddress: host || r.hostAddress,
              playerCount: typeof playerCount !== 'undefined' ? Number(playerCount) : 0,
              maxPlayers: maxPNum,
              buyIn: onchainBuyInHuman,
              isSponsored,
              prizePool: finalPrizePool,
              isOpen: true,
              createdAt: r.createdAt,
            })
          }
        }
      } else {
        // If contract query has not resolved yet or contract is in demo, display registered room
        results.push({
          roomCode: r.roomCode,
          category: r.category,
          hostName: r.hostName,
          hostAddress: r.hostAddress,
          playerCount: 0,
          maxPlayers: r.maxPlayers,
          buyIn: r.buyIn,
          isSponsored: r.isSponsored,
          prizePool: r.prizePool,
          isOpen: true,
          createdAt: r.createdAt,
        })
      }
    })

    return results
  }, [registered, onchainData])

  return {
    liveRooms,
    refetch,
    totalCount: liveRooms.length,
  }
}
