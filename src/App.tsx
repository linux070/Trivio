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
    if (localStorage.getItem(STORAGE_AUTH_KEY) === 'true') return true
    const wagmiStore = localStorage.getItem('wagmi.store')
    if (wagmiStore) {
      const parsed = JSON.parse(wagmiStore)
      const current = parsed?.state?.current
      const connections = parsed?.state?.connections?.value || parsed?.state?.connections
      if (current && connections) return true
    }
    if (localStorage.getItem('wagmi.recentConnectorId')) return true
    return false
  } catch {
    return false
  }
}

function getSavedCategory(): Category {
  try {
    const raw = sessionStorage.getItem(STORAGE_SCREEN_KEY) || localStorage.getItem(STORAGE_SCREEN_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.category) return parsed.category as Category
    }
  } catch {
    // fallback
  }
  return 'General Knowledge'
}

function getInitialScreen(): Screen {
  const joinCode = getJoinCodeFromUrl()
  const isAuth = hasStoredAuth()

  // 1. If an invite link ?join=CODE was opened:
  if (joinCode) {
    if (!isAuth) {
      // Unauthenticated user: MUST authenticate first on landing page
      try {
        sessionStorage.setItem(STORAGE_PENDING_JOIN_KEY, joinCode)
      } catch {
        // ignore
      }
      return { name: 'landing' }
    }
    // Already authenticated: proceed to join room
    return { name: 'join', category: 'General Knowledge', prefillCode: joinCode }
  }

  // 2. If authenticated, determine screen synchronously from URL hash or storage
  if (isAuth) {
    const hash = window.location.hash

    if (hash.startsWith('#/game/')) {
      const code = hash.replace('#/game/', '').trim().toUpperCase()
      if (code) {
        return { name: 'game', roomCode: code, category: getSavedCategory() }
      }
    }
    if (hash === '#/create') {
      return { name: 'create', category: getSavedCategory() }
    }
    if (hash === '#/join') {
      return { name: 'join', category: getSavedCategory() }
    }
    if (hash === '#/results') {
      try {
        const raw = sessionStorage.getItem(STORAGE_SCREEN_KEY) || localStorage.getItem(STORAGE_SCREEN_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Screen
          if (parsed.name === 'results') return parsed
        }
      } catch {
        // ignore
      }
      return { name: 'lobby' }
    }
    if (hash === '#/lobby') {
      return { name: 'lobby' }
    }

    // Fallback to storage
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

  // 3. Not authenticated -> landing page
  return { name: 'landing' }
}

export default function App() {
  const { isConnected, isReconnecting, status, address } = useAccount()
  const [screen, setScreen] = useState<Screen>(getInitialScreen)
  const wasConnectedRef = useRef(false)

  // Track connected status in localStorage and transition from landing to lobby/join
  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true
      try {
        localStorage.setItem(STORAGE_AUTH_KEY, 'true')
      } catch {
        // ignore
      }
      if (screen.name === 'landing') {
        handleConnected()
      }
    }
  }, [isConnected, screen.name])

  // If user explicitly disconnects in wallet, clear state and return to landing
  useEffect(() => {
    if (status === 'disconnected' && !isReconnecting && wasConnectedRef.current) {
      wasConnectedRef.current = false
      try {
        localStorage.removeItem(STORAGE_AUTH_KEY)
        localStorage.removeItem(STORAGE_SCREEN_KEY)
        sessionStorage.removeItem(STORAGE_SCREEN_KEY)
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname)
        }
      } catch {
        // ignore
      }
      setScreen({ name: 'landing' })
    }
  }, [status, isReconnecting])

  // Synchronize URL hash and storage whenever screen changes
  useEffect(() => {
    try {
      if (screen.name === 'landing') {
        sessionStorage.removeItem(STORAGE_SCREEN_KEY)
        localStorage.removeItem(STORAGE_SCREEN_KEY)
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      } else {
        const json = JSON.stringify(screen)
        sessionStorage.setItem(STORAGE_SCREEN_KEY, json)
        localStorage.setItem(STORAGE_SCREEN_KEY, json)

        let targetHash = '#/lobby'
        if (screen.name === 'create') targetHash = '#/create'
        else if (screen.name === 'join') targetHash = '#/join'
        else if (screen.name === 'game') targetHash = `#/game/${screen.roomCode}`
        else if (screen.name === 'results') targetHash = '#/results'

        if (window.location.hash !== targetHash) {
          window.history.replaceState(null, '', targetHash)
        }
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
        window.history.replaceState({}, '', url.pathname + window.location.hash)
      }
    }
  }, [screen])

  // Synchronize document background color and mobile theme-color with active screen
  useEffect(() => {
    const isLanding = screen.name === 'landing'
    const bg = isLanding ? '#5b21b6' : '#f9f9fc'
    const themeColor = isLanding ? '#6d28d9' : '#ffffff'

    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
    const themeMeta = document.getElementById('theme-color-meta')
    if (themeMeta) {
      themeMeta.setAttribute('content', themeColor)
    }
  }, [screen.name])

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
        window.history.replaceState({}, '', url.pathname + '#/join')
        setScreen({ name: 'join', category: 'General Knowledge', prefillCode: pendingJoin })
        return
      }
    } catch {
      // ignore
    }

    setScreen(prev => (prev.name !== 'landing' ? prev : { name: 'lobby' }))
  }

  // Auth guard: If user is definitely not connected and has no saved session:
  // Strictly prevent accessing protected screens (no bypass).
  const isAuth = isConnected || isReconnecting || hasStoredAuth()

  if (!isAuth && screen.name !== 'landing') {
    return <LandingPage onConnected={handleConnected} />
  }

  if (screen.name === 'landing') {
    if (isConnected) {
      const pendingJoin =
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_PENDING_JOIN_KEY)) ||
        getJoinCodeFromUrl()
      if (pendingJoin) {
        return (
          <JoinRoom
            initialCategory="General Knowledge"
            prefillCode={pendingJoin}
            onBack={() => setScreen({ name: 'lobby' })}
            onJoined={(roomCode, category) => setScreen({ name: 'game', roomCode, category })}
          />
        )
      }
      return (
        <Lobby
          onCreateRoom={(category) => setScreen({ name: 'create', category })}
          onJoinRoom={(category) => setScreen({ name: 'join', category })}
        />
      )
    }
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
