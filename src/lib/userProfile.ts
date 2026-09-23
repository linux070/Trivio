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
}

const STORAGE_PROFILE_KEY = 'trivio_user_profile'

export const DICEBEAR_STYLES = [
  { id: 'bottts-neutral', label: 'Robots' },
  { id: 'adventurer', label: 'Adventurers' },
  { id: 'lorelei', label: 'Portraits' },
  { id: 'avataaars', label: 'Avatars' },
  { id: 'thumbs', label: 'Playful' },
  { id: 'notionists', label: 'Minimalist' },
  { id: 'shapes', label: 'Abstract' },
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
 * Get stored player profile
 */
export function getUserProfile(): UserProfile | null {
  try {
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
export function hasUserProfile(): boolean {
  return getUserProfile() !== null
}

/**
 * Save user profile to storage
 */
export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile))
  } catch (err) {
    console.error('Failed to save user profile:', err)
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
