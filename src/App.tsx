import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import type { Category } from '@/lib/questions'
import LandingPage from '@/components/LandingPage'
import Lobby from '@/components/Lobby'
import CreateRoom from '@/components/CreateRoom'
import JoinRoom from '@/components/JoinRoom'
import GameRoom from '@/components/GameRoom'
import Results from '@/components/Results'

type Screen =
  | { name: 'landing' }
  | { name: 'lobby' }
  | { name: 'create'; category: Category }
  | { name: 'join'; category: Category; prefillCode?: string }
  | { name: 'game'; roomCode: string; category: Category }
  | { name: 'results'; winnerAddress: string; prizeAmount: string; txHash?: string }

/** Read ?join=CODE from the URL once on mount */
function getJoinCodeFromUrl(): string | null {
  try {
    const p = new URLSearchParams(window.location.search)
    const code = p.get('join')
    return code ? code.trim().toUpperCase() : null
  } catch {
    return null
  }
}

/** Build a shareable join URL for a room code */
export function buildJoinUrl(code: string): string {
  const base = window.location.origin + window.location.pathname
  return `${base}?join=${encodeURIComponent(code.toUpperCase())}`
}

export default function App() {
  const { isConnected, address } = useAccount()
  const [screen, setScreen] = useState<Screen>(() => {
    // On initial load, check for a deep-link join param
    const joinCode = getJoinCodeFromUrl()
    if (joinCode) return { name: 'join', category: 'General Knowledge', prefillCode: joinCode }
    return { name: 'landing' }
  })

  // Remove ?join= from the URL bar once we've consumed it (keeps URL clean)
  useEffect(() => {
    if (screen.name === 'join' && 'prefillCode' in screen && screen.prefillCode) {
      const url = new URL(window.location.href)
      url.searchParams.delete('join')
      window.history.replaceState({}, '', url.toString())
    }
  }, [screen])

  if (!isConnected && screen.name !== 'landing') {
    const joinCode = screen.name === 'join' && 'prefillCode' in screen ? screen.prefillCode : undefined
    return (
      <LandingPage
        onConnected={() =>
          joinCode
            ? setScreen({ name: 'join', category: 'General Knowledge', prefillCode: joinCode })
            : setScreen({ name: 'lobby' })
        }
      />
    )
  }

  if (screen.name === 'landing') {
    return <LandingPage onConnected={() => setScreen({ name: 'lobby' })} />
  }

  if (screen.name === 'lobby') {
    return (
      <Lobby
        onCreateRoom={(category) => setScreen({ name: 'create', category })}
        onJoinRoom={(category) => setScreen({ name: 'join', category })}
      />
    )
  }

  if (screen.name === 'create') {
    return (
      <CreateRoom
        initialCategory={screen.category}
        onBack={() => setScreen({ name: 'lobby' })}
        onRoomCreated={(code, category) =>
          setScreen({ name: 'game', roomCode: code, category })
        }
      />
    )
  }

  if (screen.name === 'join') {
    return (
      <JoinRoom
        initialCategory={screen.category}
        prefillCode={screen.prefillCode}
        onBack={() => setScreen({ name: 'lobby' })}
        onJoined={(code, category) =>
          setScreen({ name: 'game', roomCode: code, category })
        }
      />
    )
  }

  if (screen.name === 'game') {
    return (
      <GameRoom
        roomCode={screen.roomCode}
        category={screen.category}
        onBack={() => setScreen({ name: 'lobby' })}
        onGameEnd={(winnerAddress, prizeAmount, txHash) =>
          setScreen({ name: 'results', winnerAddress, prizeAmount, txHash })
        }
      />
    )
  }

  if (screen.name === 'results') {
    return (
      <Results
        winnerAddress={screen.winnerAddress}
        prizeAmount={screen.prizeAmount}
        txHash={screen.txHash}
        myAddress={address}
        onPlayAgain={() => setScreen({ name: 'lobby' })}
      />
    )
  }

  return null
}
