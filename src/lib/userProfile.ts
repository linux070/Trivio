/**
 * User Profile & DiceBear Avatar Management for Trivio
 * Web3 Gold Standard Avatars via DiceBear API
 */

export interface UserProfile {
  username: string
  avatarUrl: string
  avatarSeed: string
  avatarStyle: string
  createdAt: number
  updatedAt?: number
  isOnchainVerified?: boolean
}

const STORAGE_PROFILE_KEY = 'trivio_user_profile'

// Cloud profile storage endpoint (Firebase Realtime Database)
const FIREBASE_HOST = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_RTDB_URL) ||
  'https://trivio-app-ffe6e-default-rtdb.firebaseio.com'
).replace(/\/$/, '')

const CLOUD_PROFILES_URL = `${FIREBASE_HOST}/profiles`

function sanitizeAddressKey(address: string): string {
  return address.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Fetch authoritative user profile and latest avatar from cloud storage
 */
export async function fetchCloudProfile(address: string): Promise<UserProfile | null> {
  if (!address || !address.startsWith('0x') || address.length !== 42 || address === '0x0000000000000000000000000000000000000000') {
    return null
  }
  const key = sanitizeAddressKey(address)
  try {
    const res = await fetch(`${CLOUD_PROFILES_URL}/${key}.json`)
    if (!res.ok) return null
    const data = await res.json()
    if (data && (data.avatarUrl || data.avatarSeed || data.username)) {
      return {
        username: data.username || '',
        avatarUrl: data.avatarUrl || getDiceBearAvatarUrl(data.avatarStyle || 'bottts-neutral', data.avatarSeed || 'trivio'),
        avatarSeed: data.avatarSeed || 'trivio',
        avatarStyle: data.avatarStyle || 'bottts-neutral',
        createdAt: data.createdAt || data.updatedAt || Date.now(),
        updatedAt: data.updatedAt || Date.now(),
        isOnchainVerified: data.isOnchainVerified,
      }
    }
  } catch (err) {
    console.warn('[userProfile] Failed to fetch cloud profile for', address, err)
  }
  return null
}

/**
 * Synchronize user profile & latest avatar to cloud storage
 */
export async function syncProfileToCloud(profile: UserProfile, address: string): Promise<void> {
  if (!address || !address.startsWith('0x') || address.length !== 42 || address === '0x0000000000000000000000000000000000000000') {
    return
  }
  const key = sanitizeAddressKey(address)
  const payload = {
    username: profile.username || '',
    avatarUrl: profile.avatarUrl || '',
    avatarSeed: profile.avatarSeed || '',
    avatarStyle: profile.avatarStyle || 'bottts-neutral',
    createdAt: profile.createdAt || Date.now(),
    updatedAt: profile.updatedAt || Date.now(),
    isOnchainVerified: profile.isOnchainVerified ?? false,
  }
  try {
    await fetch(`${CLOUD_PROFILES_URL}/${key}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.warn('[userProfile] Failed to sync profile to cloud for', address, err)
  }
}

export const DICEBEAR_STYLES = [
  { id: 'bottts-neutral', label: 'Robots' },
  { id: 'adventurer', label: 'Adventurers' },
  { id: 'lorelei', label: 'Portraits' },
  { id: 'avataaars', label: 'Avatars' },
  { id: 'thumbs', label: 'Playful' },
  { id: 'notionists', label: 'Minimalist' },
  { id: 'shapes', label: 'Abstract' },
  { id: 'pixel-art', label: 'Pixel Art' },
  { id: 'fun-emoji', label: 'Fun Emoji' },
] as const

export const DEFAULT_AVATAR_SEEDS = [
  'trivio_apex',
  'trivio_spark',
  'trivio_cyber',
  'trivio_nova',
  'trivio_quantum',
  'trivio_stellar',
  'trivio_cosmos',
  'trivio_vortex',
]

/**
 * Generate a modern, aesthetic DiceBear SVG URL
 */
export function getDiceBearAvatarUrl(style: string = 'bottts-neutral', seed: string = 'trivio'): string {
  const cleanSeed = encodeURIComponent(seed.trim().toLowerCase())
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${cleanSeed}`
}

/**
 * Get stored player profile (address-scoped if address provided)
 */
export function getUserProfile(address?: string): UserProfile | null {
  try {
    if (address && address.startsWith('0x') && address.length === 42 && address !== '0x0000000000000000000000000000000000000000') {
      const lower = address.toLowerCase()
      const scoped = localStorage.getItem(`trivio_profile_${lower}`)
      if (scoped) {
        try {
          return JSON.parse(scoped) as UserProfile
        } catch {
          // parse failed
        }
      }
      // If scoped profile is not yet stored but global active profile exists, migrate it
      const globalRaw = localStorage.getItem(STORAGE_PROFILE_KEY)
      if (globalRaw) {
        try {
          const parsed = JSON.parse(globalRaw) as UserProfile
          if (parsed && parsed.username) {
            localStorage.setItem(`trivio_profile_${lower}`, globalRaw)
            return parsed
          }
        } catch {
          // ignore
        }
      }
      return null
    }
    const raw = localStorage.getItem(STORAGE_PROFILE_KEY)
    if (raw) return JSON.parse(raw) as UserProfile
    return null
  } catch {
    return null
  }
}

/**
 * Check if player has completed onboarding profile setup
 */
export function hasUserProfile(address?: string): boolean {
  return getUserProfile(address) !== null
}

/**
 * Save user profile to storage (address-scoped if address provided)
 * and asynchronously persist to off-chain cloud so it survives cache clearing.
 */
export function saveUserProfile(profile: UserProfile, address?: string): void {
  try {
    const stamped: UserProfile = {
      ...profile,
      updatedAt: profile.updatedAt || Date.now(),
    }
    const serialized = JSON.stringify(stamped)
    localStorage.setItem(STORAGE_PROFILE_KEY, serialized)
    const validAddr = address && address.startsWith('0x') && address.length === 42 && address !== '0x0000000000000000000000000000000000000000'
    if (validAddr && address) {
      localStorage.setItem(`trivio_profile_${address.toLowerCase()}`, serialized)
      // Fire-and-forget off-chain cloud sync
      void syncProfileToCloud(stamped, address).catch(() => {})
    }
    // Broadcast event across same-window components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('trivio_profile_updated', {
          detail: { address: address?.toLowerCase(), profile: stamped },
        })
      )
    }
  } catch (err) {
    console.error('Failed to save user profile:', err)
  }
}

/**
 * Clear global active user profile from storage on logout
 */
export function clearActiveUserProfile(): void {
  try {
    localStorage.removeItem(STORAGE_PROFILE_KEY)
  } catch (err) {
    console.error('Failed to clear active user profile:', err)
  }
}

const ADJECTIVES = ['cyber', 'pixel', 'swift', 'arc', 'crypto', 'turbo', 'zen', 'stellar', 'neon', 'hyper', 'sonic', 'smart', 'lucky', 'cosmic']
const NOUNS = ['wiz', 'champ', 'hero', 'gamer', 'trivia', 'master', 'mind', 'runner', 'player', 'brain', 'spark', 'ace', 'vibe', 'scout']

export function generateRandomUsername(address?: string): string {
  if (address && address.length >= 8) {
    const short = address.slice(2, 6).toLowerCase()
    return `player_${short}`
  }
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(10 + Math.random() * 90)
  return `${adj}_${noun}${num}`
}

export const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'trivio',
  'official',
  'support',
  'arc',
  'system',
  'mod',
  'moderator',
] as const

export function isReservedUsername(username: string): boolean {
  const clean = username.trim().toLowerCase().replace(/^@/, '')
  return RESERVED_USERNAMES.includes(clean as any)
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const clean = username.trim().replace(/^@/, '')

  if (clean.length < 2) {
    return { valid: false, error: 'Username must be at least 2 characters' }
  }
  if (clean.length > 24) {
    return { valid: false, error: 'Username cannot exceed 24 characters' }
  }
  if (isReservedUsername(clean)) {
    return { valid: false, error: 'Username contains a reserved word.' }
  }

  // Boundary hygiene: first and last characters must be alphanumeric
  const first = clean[0]
  const last = clean[clean.length - 1]
  if (!/^[a-zA-Z0-9]$/.test(first) || !/^[a-zA-Z0-9]$/.test(last)) {
    return { valid: false, error: 'Username must start and end with a letter or number' }
  }

  // Allowed characters: letters, numbers, underscore, hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and dashes' }
  }

  return { valid: true }
}

/**
 * Generate a smart default username and avatar from address or email
 */
export function getDefaultProfileSuggestions(address?: string, provider?: string): { username: string; seed: string; style: string } {
  const username = generateRandomUsername(address)
  const seed = address ? address.toLowerCase() : username

  return {
    username,
    seed,
    style: 'bottts-neutral',
  }
}
