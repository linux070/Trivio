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
 * Get stored player profile (address-scoped if address provided)
 */
export function getUserProfile(address?: string): UserProfile | null {
  try {
    if (address && address.startsWith('0x') && address.length === 42) {
      const scoped = localStorage.getItem(`trivio_profile_${address.toLowerCase()}`)
      if (scoped) return JSON.parse(scoped) as UserProfile
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
 */
export function saveUserProfile(profile: UserProfile, address?: string): void {
  try {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile))
    if (address && address.startsWith('0x') && address.length === 42) {
      localStorage.setItem(`trivio_profile_${address.toLowerCase()}`, JSON.stringify(profile))
    }
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
