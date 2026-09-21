import { useState, useEffect, useRef } from 'react'
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

const STORAGE_SCREEN_KEY = 'trivio_current_screen'
const STORAGE_AUTH_KEY = 'trivio_authenticated'
const STORAGE_PENDING_JOIN_KEY = 'trivio_pending_join'

function hasStoredAuth(): boolean {
  try {
    return (
      localStorage.getItem(STORAGE_AUTH_KEY) === 'true' ||
      Boolean(localStorage.getItem('wagmi.recentConnectorId'))
    )
  } catch {
    return false
  }
}

function getInitialScreen(): Screen {
  const joinCode = getJoinCodeFromUrl()
  const isAuth = hasStoredAuth()

  // If a join code was clicked via invite link:
  if (joinCode) {
    // If not connected / authenticated yet, save pending code and force login on landing page
    if (!isAuth) {
      try {
        sessionStorage.setItem(STORAGE_PENDING_JOIN_KEY, joinCode)
      } catch {
        // ignore
      }
      return { name: 'landing' }
    }
    // If already authenticated, proceed directly to join screen with code
    return { name: 'join', category: 'General Knowledge', prefillCode: joinCode }
  }

  // Restore previous screen on refresh for authenticated users
  if (isAuth) {
    try {
      const raw = sessionStorage.getItem(STORAGE_SCREEN_KEY) || localStorage.getItem(STORAGE_SCREEN_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Screen
        if (saved && typeof saved === 'object' && 'name' in saved && saved.name !== 'landing') {
          return saved
        }
      }
    } catch {
      // fallback
    }
    return { name: 'lobby' }
  }

  return { name: 'landing' }
}

export default function App() {
  const { isConnected, isReconnecting, status, address } = useAccount()
  const [screen, setScreen] = useState<Screen>(getInitialScreen)
  const [reconnectGraceOver, setReconnectGraceOver] = useState(false)
  const wasConnectedRef = useRef(false)

  // Track connected status in localStorage
  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true
      try {
        localStorage.setItem(STORAGE_AUTH_KEY, 'true')
      } catch {
        // ignore
      }
    }
  }, [isConnected])

  // Give wagmi a 1.5s grace period on initial load to restore existing wallet session
  useEffect(() => {
    const timer = setTimeout(() => {
      setReconnectGraceOver(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // If user explicitly disconnects, clear auth state and return to landing
  useEffect(() => {
    if (status === 'disconnected' && reconnectGraceOver && wasConnectedRef.current) {
      try {
        localStorage.removeItem(STORAGE_AUTH_KEY)
        localStorage.removeItem(STORAGE_SCREEN_KEY)
        sessionStorage.removeItem(STORAGE_SCREEN_KEY)
      } catch {
        // ignore
      }
      setScreen({ name: 'landing' })
    }
  }, [status, reconnectGraceOver])

  // Persist screen state so browser refresh stays on the current screen
  useEffect(() => {
    try {
      if (screen.name === 'landing') {
        sessionStorage.removeItem(STORAGE_SCREEN_KEY)
        localStorage.removeItem(STORAGE_SCREEN_KEY)
      } else {
        const json = JSON.stringify(screen)
        sessionStorage.setItem(STORAGE_SCREEN_KEY, json)
        localStorage.setItem(STORAGE_SCREEN_KEY, json)
      }
    } catch {
      // ignore
    }
  }, [screen])

  // Clean ?join= from URL once consumed in JoinRoom
  useEffect(() => {
    if (screen.name === 'join' && 'prefillCode' in screen && screen.prefillCode) {
      const url = new URL(window.location.href)
      if (url.searchParams.has('join')) {
        url.searchParams.delete('join')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [screen])

  // Handler called when user connects wallet or signs in with email on LandingPage
  const handleConnected = () => {
    try {
      localStorage.setItem(STORAGE_AUTH_KEY, 'true')
      const pendingJoin =
        sessionStorage.getItem(STORAGE_PENDING_JOIN_KEY) || getJoinCodeFromUrl()
      if (pendingJoin) {
        sessionStorage.removeItem(STORAGE_PENDING_JOIN_KEY)
        const url = new URL(window.location.href)
        url.searchParams.delete('join')
        window.history.replaceState({}, '', url.toString())
        setScreen({ name: 'join', category: 'General Knowledge', prefillCode: pendingJoin })
        return
      }
    } catch {
      // ignore
    }

    setScreen(prev => (prev.name !== 'landing' ? prev : { name: 'lobby' }))
  }

  // Security check: Unconnected users who are not reconnecting an existing session
  // MUST NOT bypass authentication to access protected screens.
  const isAuthWaiting = !reconnectGraceOver && (isReconnecting || hasStoredAuth())
  const canAccessApp = isConnected || isAuthWaiting

  if (!canAccessApp && screen.name !== 'landing') {
    return <LandingPage onConnected={handleConnected} />
  }

  if (screen.name === 'landing') {
    return <LandingPage onConnected={handleConnected} />
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
