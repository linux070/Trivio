import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import type { Category } from '@/lib/questions'
import { hasUserProfile } from '@/lib/userProfile'
import LandingPage from '@/components/LandingPage'
import Lobby from '@/components/Lobby'
import CreateRoom from '@/components/CreateRoom'
import JoinRoom from '@/components/JoinRoom'
import GameRoom from '@/components/GameRoom'
import Results from '@/components/Results'
import OnboardingModal from '@/components/OnboardingModal'

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
    return localStorage.getItem(STORAGE_AUTH_KEY) === 'true'
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
  // Always start on landing page until Privy authenticates the session
  const joinCode = getJoinCodeFromUrl()
  if (joinCode) {
    try {
      sessionStorage.setItem(STORAGE_PENDING_JOIN_KEY, joinCode)
    } catch {
      // ignore
    }
  }
  return { name: 'landing' }
}

export default function App() {
  const { address } = useAccount()
  const { authenticated, ready, user, logout } = usePrivy()
  const [screen, setScreen] = useState<Screen>(getInitialScreen)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const wasConnectedRef = useRef(false)

  // Derive active wallet address from Privy user or wagmi
  const privyWalletAddress = user?.wallet?.address as `0x${string}` | undefined
  const activeAddress = address || privyWalletAddress || ''

  // Determine auth provider for display purposes
  const provider = (() => {
    if (!user) return 'wallet' as const
    const linkedAccounts = user.linkedAccounts || []
    if ((user as any).google || linkedAccounts.some((a: any) => a.type === 'google_oauth' || a.type === 'google')) return 'google' as const
    if ((user as any).passkey || linkedAccounts.some((a: any) => a.type === 'passkey')) return 'passkey' as const
    if ((user as any).email || linkedAccounts.some((a: any) => a.type === 'email')) return 'email' as const
    return 'wallet' as const
  })()

  // Helper to resolve and navigate to target game screen upon authenticated session
  const restoreGameScreen = () => {
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

    const hash = window.location.hash
    if (hash.startsWith('#/game/')) {
      const code = hash.replace('#/game/', '').trim().toUpperCase()
      if (code) {
        setScreen({ name: 'game', roomCode: code, category: getSavedCategory() })
        return
      }
    }
    if (hash === '#/create') {
      setScreen({ name: 'create', category: getSavedCategory() })
      return
    }
    if (hash === '#/join') {
      setScreen({ name: 'join', category: getSavedCategory() })
      return
    }
    if (hash === '#/results') {
      try {
        const raw = sessionStorage.getItem(STORAGE_SCREEN_KEY) || localStorage.getItem(STORAGE_SCREEN_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Screen
          if (parsed.name === 'results') {
            setScreen(parsed)
            return
          }
        }
      } catch {
        // ignore
      }
    }

    setScreen({ name: 'lobby' })
  }

  // Strictly sync screen state when Privy authentication completes
  useEffect(() => {
    if (ready && authenticated) {
      wasConnectedRef.current = true
      try {
        localStorage.setItem(STORAGE_AUTH_KEY, 'true')
      } catch {
        // ignore
      }
      if (!hasUserProfile()) {
        setShowOnboarding(true)
      } else if (screen.name === 'landing') {
        restoreGameScreen()
      }
    } else if (ready && !authenticated) {
      if (wasConnectedRef.current) {
        wasConnectedRef.current = false
        try {
          localStorage.removeItem(STORAGE_AUTH_KEY)
          localStorage.removeItem(STORAGE_SCREEN_KEY)
          sessionStorage.removeItem(STORAGE_SCREEN_KEY)
          sessionStorage.removeItem(STORAGE_PENDING_JOIN_KEY)
          localStorage.removeItem('wagmi.recentConnectorId')
          localStorage.removeItem('wagmi.store')
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname)
          }
        } catch {
          // ignore
        }
        setScreen({ name: 'landing' })
      }
    }
  }, [ready, authenticated, screen.name])

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
    const bg = isLanding ? '#5b21b6' : '#fafafa'
    const themeColor = isLanding ? '#6d28d9' : '#ffffff'

    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
    const themeMeta = document.getElementById('theme-color-meta')
    if (themeMeta) {
      themeMeta.setAttribute('content', themeColor)
    }
  }, [screen.name])

  // Handler called when user connects wallet or signs in via Privy
  const handleConnected = () => {
    try {
      localStorage.setItem(STORAGE_AUTH_KEY, 'true')
    } catch {
      // ignore
    }
    if (!hasUserProfile()) {
      setShowOnboarding(true)
      return
    }
    restoreGameScreen()
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    restoreGameScreen()
  }

  const handleDisconnect = async () => {
    wasConnectedRef.current = false
    try {
      await logout()
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(STORAGE_AUTH_KEY)
      localStorage.removeItem(STORAGE_SCREEN_KEY)
      sessionStorage.removeItem(STORAGE_SCREEN_KEY)
      sessionStorage.removeItem(STORAGE_PENDING_JOIN_KEY)
      localStorage.removeItem('wagmi.recentConnectorId')
      localStorage.removeItem('wagmi.store')
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    } catch {
      // ignore
    }
    setScreen({ name: 'landing' })
  }

  // Auth & Onboarding guard:
  // If not authenticated via Privy (or Privy is still initializing), or currently on landing screen, or user has not completed profile onboarding:
  // Render LandingPage in the background and present OnboardingModal.
  // The game Lobby is never rendered until sign in with wallet is 100% verified and profile setup is complete.
  if (!ready || !authenticated || screen.name === 'landing' || !hasUserProfile()) {
    return (
      <>
        <LandingPage onConnected={handleConnected} />
        <OnboardingModal
          open={showOnboarding && authenticated}
          address={activeAddress}
          provider={provider}
          onComplete={handleOnboardingComplete}
        />
      </>
    )
  }

  if (screen.name === 'lobby') {
    return (
      <Lobby
        onCreateRoom={(category) => setScreen({ name: 'create', category })}
        onJoinRoom={(category) => setScreen({ name: 'join', category })}
        onDisconnect={handleDisconnect}
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
        myAddress={activeAddress}
        onPlayAgain={() => setScreen({ name: 'lobby' })}
      />
    )
  }

  return null
}
