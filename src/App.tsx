import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import type { Category } from '@/lib/questions'
import { ALL_CATEGORIES } from '@/lib/questions'
import { hasUserProfile } from '@/lib/userProfile'
import {
  saveRoomCategory,
  getRoomCategory,
  saveActiveGame,
  clearActiveGame,
  setPendingJoin,
  consumePendingJoin,
  isValidCategory,
} from '@/lib/roomStorage'
import LandingPage from '@/components/LandingPage'
import Lobby from '@/components/Lobby'
import CreateRoom from '@/components/CreateRoom'
import JoinRoom from '@/components/JoinRoom'
import GameRoom from '@/components/GameRoom'
import Results from '@/components/Results'
import OnboardingModal from '@/components/OnboardingModal'

type Screen =
  | { name: 'landing' }
  | { name: 'lobby'; initialCategory?: Category | null }
  | { name: 'create'; category: Category }
  | { name: 'join'; category: Category; prefillCode?: string }
  | { name: 'game'; roomCode: string; category: Category }
  | { name: 'results'; winnerAddress: string; prizeAmount: string; txHash?: string }

/** Read ?join=CODE and ?cat=CATEGORY from the URL */
export function getJoinParamsFromUrl(): { roomCode: string; category?: Category } | null {
  try {
    const p = new URLSearchParams(window.location.search)
    const code = p.get('join')?.trim().toUpperCase()
    if (!code) return null
    const rawCat = p.get('cat') || p.get('category')
    const category = isValidCategory(rawCat) ? rawCat : undefined
    return { roomCode: code, category }
  } catch {
    return null
  }
}

/** Build a shareable join URL for a room code with its host-assigned category */
export function buildJoinUrl(code: string, category?: Category): string {
  const base = window.location.origin + window.location.pathname
  const p = new URLSearchParams()
  p.set('join', code.trim().toUpperCase())
  const resolvedCat = category || getRoomCategory(code)
  if (resolvedCat) {
    p.set('cat', resolvedCat)
  }
  return `${base}?${p.toString()}`
}

const STORAGE_SCREEN_KEY = 'trivio_current_screen'
const STORAGE_AUTH_KEY = 'trivio_authenticated'

function getSavedCategory(): Category {
  try {
    const raw = sessionStorage.getItem(STORAGE_SCREEN_KEY) || localStorage.getItem(STORAGE_SCREEN_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isValidCategory(parsed?.category)) return parsed.category
    }
  } catch {
    // fallback
  }
  return 'General Knowledge'
}

function getInitialScreen(): Screen {
  const joinParams = getJoinParamsFromUrl()
  if (joinParams) {
    setPendingJoin(joinParams.roomCode, joinParams.category)
    if (joinParams.category) {
      saveRoomCategory(joinParams.roomCode, joinParams.category)
    }
  }

  // Check if we have an authenticated user with a profile
  const isAuth = typeof window !== 'undefined' && localStorage.getItem(STORAGE_AUTH_KEY) === 'true'
  const hasProfile = typeof window !== 'undefined' && hasUserProfile()

  if (typeof window !== 'undefined') {
    const isLanding = !(isAuth && hasProfile)
    const bg = isLanding ? '#5b21b6' : '#fafafa'
    document.documentElement.style.backgroundColor = bg
    if (document.body) document.body.style.backgroundColor = bg
    const themeMeta = document.getElementById('theme-color-meta')
    if (themeMeta) themeMeta.setAttribute('content', isLanding ? '#6d28d9' : '#ffffff')
  }

  if (isAuth && hasProfile) {
    if (joinParams) {
      const cat = joinParams.category || getRoomCategory(joinParams.roomCode) || 'General Knowledge'
      return { name: 'join', category: cat, prefillCode: joinParams.roomCode }
    }

    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (hash.startsWith('#/game/')) {
      const code = hash.replace('#/game/', '').trim().toUpperCase()
      if (code) {
        const cat = getRoomCategory(code) || getSavedCategory()
        return { name: 'game', roomCode: code, category: cat }
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
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_SCREEN_KEY) || localStorage.getItem(STORAGE_SCREEN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Screen
        if (parsed?.name && parsed.name !== 'landing') {
          return parsed
        }
      }
    } catch {
      // ignore
    }

    return { name: 'lobby', initialCategory: getSavedCategory() }
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
    const pendingJoin = consumePendingJoin() || getJoinParamsFromUrl()
    if (pendingJoin) {
      const cat = pendingJoin.category || getRoomCategory(pendingJoin.roomCode) || 'General Knowledge'
      saveRoomCategory(pendingJoin.roomCode, cat)
      const url = new URL(window.location.href)
      url.searchParams.delete('join')
      url.searchParams.delete('cat')
      url.searchParams.delete('category')
      window.history.replaceState({}, '', url.pathname + '#/join')
      setScreen({ name: 'join', category: cat, prefillCode: pendingJoin.roomCode })
      return
    }

    const hash = window.location.hash
    if (hash.startsWith('#/game/')) {
      const code = hash.replace('#/game/', '').trim().toUpperCase()
      if (code) {
        const cat = getRoomCategory(code) || getSavedCategory()
        setScreen({ name: 'game', roomCode: code, category: cat })
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

    try {
      const raw = sessionStorage.getItem(STORAGE_SCREEN_KEY) || localStorage.getItem(STORAGE_SCREEN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Screen
        if (parsed?.name && parsed.name !== 'landing') {
          setScreen(parsed)
          return
        }
      }
    } catch {
      // ignore
    }

    setScreen({ name: 'lobby', initialCategory: getSavedCategory() })
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

  // Watch for inbound join links while session is already active
  useEffect(() => {
    if (ready && authenticated && hasUserProfile() && screen.name !== 'landing') {
      const joinParams = getJoinParamsFromUrl()
      if (joinParams) {
        const cat = joinParams.category || getRoomCategory(joinParams.roomCode) || 'General Knowledge'
        saveRoomCategory(joinParams.roomCode, cat)
        const url = new URL(window.location.href)
        url.searchParams.delete('join')
        url.searchParams.delete('cat')
        url.searchParams.delete('category')
        window.history.replaceState({}, '', url.pathname + '#/join')
        setScreen({ name: 'join', category: cat, prefillCode: joinParams.roomCode })
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

  // Clean ?join= and ?cat= from URL once consumed in JoinRoom
  useEffect(() => {
    if (screen.name === 'join' && 'prefillCode' in screen && screen.prefillCode) {
      const url = new URL(window.location.href)
      if (url.searchParams.has('join') || url.searchParams.has('cat') || url.searchParams.has('category')) {
        url.searchParams.delete('join')
        url.searchParams.delete('cat')
        url.searchParams.delete('category')
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
      clearActiveGame()
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

  // Check if we have an active stored user session
  const isStoredAuth = typeof window !== 'undefined' && localStorage.getItem(STORAGE_AUTH_KEY) === 'true' && hasUserProfile()

  // Auth & Onboarding guard:
  // If the user has a stored authenticated session and a valid screen (e.g. lobby/create/join/game),
  // do NOT flash LandingPage while Privy is asynchronously initializing (!ready).
  if (screen.name === 'landing' || (!isStoredAuth && (!ready || !authenticated || !hasUserProfile()))) {
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
        initialCategory={screen.initialCategory}
        onCreateRoom={(category) => setScreen({ name: 'create', category })}
        onJoinRoom={(category, prefillCode) => setScreen({ name: 'join', category, prefillCode })}
        onContinueGame={(roomCode, category) => {
          saveActiveGame(roomCode, category)
          setScreen({ name: 'game', roomCode, category })
        }}
        onDisconnect={handleDisconnect}
      />
    )
  }

  if (screen.name === 'create') {
    return (
      <CreateRoom
        initialCategory={screen.category}
        onBack={() => setScreen({ name: 'lobby', initialCategory: screen.category })}
        onRoomCreated={(code, category) => {
          saveActiveGame(code, category, true)
          setScreen({ name: 'game', roomCode: code, category })
        }}
      />
    )
  }

  if (screen.name === 'join') {
    return (
      <JoinRoom
        initialCategory={screen.category}
        prefillCode={screen.prefillCode}
        onBack={() => setScreen({ name: 'lobby', initialCategory: screen.category })}
        onJoined={(code, category) => {
          saveActiveGame(code, category, false)
          setScreen({ name: 'game', roomCode: code, category })
        }}
      />
    )
  }

  if (screen.name === 'game') {
    return (
      <GameRoom
        roomCode={screen.roomCode}
        category={screen.category}
        onBack={() => setScreen({ name: 'lobby' })}
        onGameEnd={(winnerAddress, prizeAmount, txHash) => {
          clearActiveGame()
          setScreen({ name: 'results', winnerAddress, prizeAmount, txHash })
        }}
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
        onPlayAgain={() => {
          clearActiveGame()
          setScreen({ name: 'lobby' })
        }}
      />
    )
  }

  return null
}
