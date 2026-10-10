import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { arcTestnet, TRIVIA_GAME_ADDRESS } from '@/config'
import {
  getStoredPayouts,
  recordWinnerPayout,
  computeLeaderboard,
  EVENT_PAYOUT_UPDATED,
  type LiveLeaderboardEntry,
  type LatestPayoutInfo,
} from '@/lib/winnersStorage'

const WINNERS_DECLARED_EVENT = parseAbiItem(
  'event WinnersDeclared(bytes32 indexed roomId, address[] winners, uint256[] amounts)'
)

export function useLiveWinners() {
  const [data, setData] = useState(() => computeLeaderboard(getStoredPayouts()))

  const syncStats = useCallback(() => {
    const stored = getStoredPayouts()
    const computed = computeLeaderboard(stored)
    setData(computed)
  }, [])

  // Listen for real-time local payout events
  useEffect(() => {
    const handleUpdate = () => {
      syncStats()
    }
    window.addEventListener(EVENT_PAYOUT_UPDATED, handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener(EVENT_PAYOUT_UPDATED, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [syncStats])

  // Poll onchain WinnersDeclared event logs from Arc Testnet
  useEffect(() => {
    if (!TRIVIA_GAME_ADDRESS) return

    const client = createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.io'),
    })

    let isSubscribed = true

    const fetchOnchainWinners = async () => {
      try {
        const latestBlock = await client.getBlockNumber()
        // Query recent 2,000 blocks to stay within RPC limit safely
        const fromBlock = latestBlock > 2000n ? latestBlock - 2000n : 0n

        const logs = await client.getLogs({
          address: TRIVIA_GAME_ADDRESS,
          event: WINNERS_DECLARED_EVENT,
          fromBlock,
          toBlock: 'latest',
        })

        if (!isSubscribed) return

        const blockCache = new Map<bigint, number>()

        for (const log of logs) {
          const { winners, amounts } = log.args
          let blockTimestampMs: number | undefined

          if (log.blockNumber) {
            if (blockCache.has(log.blockNumber)) {
              blockTimestampMs = blockCache.get(log.blockNumber)
            } else {
              try {
                const block = await client.getBlock({ blockNumber: log.blockNumber })
                blockTimestampMs = Number(block.timestamp) * 1000
                blockCache.set(log.blockNumber, blockTimestampMs)
              } catch {
                // fallback
              }
            }
          }

          if (winners && amounts && winners.length > 0) {
            for (let i = 0; i < winners.length; i++) {
              const winnerAddr = winners[i]
              const rawAmount = amounts[i] ?? 0n
              const usdcAmount = (Number(rawAmount) / 1e6).toFixed(2)
              if (Number(usdcAmount) > 0) {
                recordWinnerPayout({
                  roomCode: log.transactionHash.slice(2, 8).toUpperCase(),
                  winnerAddress: winnerAddr,
                  amount: usdcAmount,
                  category: 'Crypto',
                  txHash: log.transactionHash,
                  timestamp: blockTimestampMs,
                })
              }
            }
          }
        }

        // Also verify and correct timestamps for any stored payouts that have a txHash
        const stored = getStoredPayouts()
        for (const p of stored.slice(0, 10)) {
          if (p.txHash && p.txHash.startsWith('0x')) {
            try {
              const tx = await client.getTransaction({ hash: p.txHash as `0x${string}` })
              if (tx && tx.blockNumber) {
                let blockTimeMs = blockCache.get(tx.blockNumber)
                if (!blockTimeMs) {
                  const block = await client.getBlock({ blockNumber: tx.blockNumber })
                  blockTimeMs = Number(block.timestamp) * 1000
                  blockCache.set(tx.blockNumber, blockTimeMs)
                }
                if (blockTimeMs && Math.abs(p.timestamp - blockTimeMs) > 10000) {
                  recordWinnerPayout({
                    roomCode: p.roomCode,
                    winnerAddress: p.winnerAddress,
                    amount: p.amount,
                    category: p.category,
                    txHash: p.txHash,
                    timestamp: blockTimeMs,
                  })
                }
              }
            } catch {
              // ignore
            }
          }
        }

        syncStats()
      } catch (err) {
        syncStats()
      }
    }

    fetchOnchainWinners()
    const interval = setInterval(fetchOnchainWinners, 10000)

    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [syncStats])

  return data
}
