import { useOnchainProfile } from '@/hooks/useTrivioProfileRegistry'
import { getUserProfile, getDiceBearAvatarUrl, generateRandomUsername } from '@/lib/userProfile'

interface PlayerTagProps {
  address?: string
  className?: string
}

/**
 * Text-only player identity display with avatar & username (no bulky pill buttons or badge borders)
 */
export function PlayerTag({ address, className = '' }: PlayerTagProps) {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return null
  }

  const normalized = address.toLowerCase()
  const { profile: onchainProfile } = useOnchainProfile(address)
  const localProfile = getUserProfile(normalized)

  const rawUsername =
    localProfile?.username ||
    onchainProfile?.username ||
    generateRandomUsername(address)

  const username = rawUsername.replace(/^@/, '')

  const avatarUrl =
    localProfile?.avatarUrl ||
    onchainProfile?.avatarUrl ||
    getDiceBearAvatarUrl('bottts-neutral', address || username)

  return (
    <div className={`inline-flex items-center gap-2 py-0.5 select-none ${className}`}>
      <img
        src={avatarUrl}
        alt={username}
        className="h-5 w-5 rounded-full border border-slate-200/90 bg-white object-cover shrink-0 shadow-2xs"
        onError={(e) => {
          e.currentTarget.src = getDiceBearAvatarUrl('bottts-neutral', address || username)
        }}
      />
      <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
        @{username}
      </span>
    </div>
  )
}

export const PlayerIdentityText = PlayerTag
