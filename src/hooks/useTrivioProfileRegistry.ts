import { useState, useEffect, useMemo } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ARC_TESTNET_CHAIN_ID, TRIVIO_PROFILE_REGISTRY_ADDRESS } from '@/config'
import { getUserProfile, saveUserProfile, getDiceBearAvatarUrl, type UserProfile } from '@/lib/userProfile'

export const PROFILE_REGISTRY_ABI = [
  {
    name: 'setProfile',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'username', type: 'string' },
      { name: 'avatarUrl', type: 'string' },
      { name: 'avatarSeed', type: 'string' },
      { name: 'avatarStyle', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'clearProfile',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getProfile',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'username', type: 'string' },
      { name: 'avatarUrl', type: 'string' },
      { name: 'avatarSeed', type: 'string' },
      { name: 'avatarStyle', type: 'string' },
      { name: 'updatedAt', type: 'uint256' },
    ],
  },
  {
    name: 'isUsernameAvailable',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'username', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'resolveUsername',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'username', type: 'string' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'addressToUsername',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const

export interface OnchainProfileData {
  username: string
  avatarUrl: string
  avatarSeed: string
  avatarStyle: string
  updatedAt: bigint
}

/**
 * Read onchain profile for a given wallet address with instant local cache fallback
 */
export function useOnchainProfile(address?: string, chainId: number = ARC_TESTNET_CHAIN_ID) {
  const isValidAddress = Boolean(
    address &&
    address.startsWith('0x') &&
    address.length === 42 &&
    address !== '0x0000000000000000000000000000000000000000'
  )

  const normalized = isValidAddress && address ? address.toLowerCase() : ''
  const [localProfileState, setLocalProfileState] = useState<UserProfile | null>(() =>
    normalized ? getUserProfile(normalized) : getUserProfile()
  )

  // Listen for local profile updates across the entire app
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ address?: string; profile?: UserProfile }>).detail
      if (detail?.profile) {
        if (!normalized || !detail.address || detail.address.toLowerCase() === normalized) {
          setLocalProfileState(detail.profile)
        }
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('trivio_profile_updated', handleUpdate)
      return () => window.removeEventListener('trivio_profile_updated', handleUpdate)
    }
  }, [normalized])

  // Re-sync local state when normalized address changes
  useEffect(() => {
    const p = normalized ? getUserProfile(normalized) : getUserProfile()
    setLocalProfileState(p)
  }, [normalized])

  const cachedLocal = localProfileState || (normalized ? getUserProfile(normalized) : getUserProfile())

  const { data, isLoading, refetch, error } = useReadContract({
    address: TRIVIO_PROFILE_REGISTRY_ADDRESS,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'getProfile',
    args: isValidAddress ? [address as `0x${string}`] : undefined,
    chainId,
    query: {
      enabled: isValidAddress,
      staleTime: 15_000,
    },
  })

  const [username, avatarUrl, avatarSeed, avatarStyle, updatedAt] =
    (data as [string, string, string, string, bigint] | undefined) ?? ['', '', '', '', 0n]

  const hasOnchainData = Boolean(username && username.length > 0)
  const onchainTimeMs = Number(updatedAt) * 1000
  const localTimeMs = cachedLocal ? (cachedLocal.updatedAt || cachedLocal.createdAt || 0) : 0
  const localIsNewer = Boolean(cachedLocal?.username && localTimeMs > onchainTimeMs)

  // Save to persistent storage once contract resolves ONLY if onchain data is strictly newer than local edits
  useEffect(() => {
    if (hasOnchainData && normalized && !localIsNewer) {
      const p: UserProfile = {
        username,
        avatarUrl: avatarUrl || getDiceBearAvatarUrl(avatarStyle || 'bottts-neutral', avatarSeed || username),
        avatarSeed: avatarSeed || username,
        avatarStyle: avatarStyle || 'bottts-neutral',
        createdAt: onchainTimeMs || Date.now(),
        updatedAt: onchainTimeMs || Date.now(),
        isOnchainVerified: true,
      }
      saveUserProfile(p, normalized)
      setLocalProfileState(p)
    }
  }, [hasOnchainData, normalized, localIsNewer, username, avatarUrl, avatarSeed, avatarStyle, onchainTimeMs])

  const effectiveProfile: OnchainProfileData | null = useMemo(() => {
    if (localIsNewer && cachedLocal) {
      return {
        username: cachedLocal.username,
        avatarUrl: cachedLocal.avatarUrl || getDiceBearAvatarUrl(cachedLocal.avatarStyle || 'bottts-neutral', cachedLocal.avatarSeed || cachedLocal.username),
        avatarSeed: cachedLocal.avatarSeed || cachedLocal.username,
        avatarStyle: cachedLocal.avatarStyle || 'bottts-neutral',
        updatedAt: BigInt(Math.floor(localTimeMs / 1000)),
      }
    }
    if (hasOnchainData) {
      return {
        username,
        // If local profile has a chosen avatar, preserve it even when using onchain username
        avatarUrl: cachedLocal?.avatarUrl || avatarUrl || getDiceBearAvatarUrl(avatarStyle || 'bottts-neutral', avatarSeed || username),
        avatarSeed: cachedLocal?.avatarSeed || avatarSeed || username,
        avatarStyle: cachedLocal?.avatarStyle || avatarStyle || 'bottts-neutral',
        updatedAt,
      }
    }
    if (cachedLocal && cachedLocal.username) {
      return {
        username: cachedLocal.username,
        avatarUrl: cachedLocal.avatarUrl || getDiceBearAvatarUrl(cachedLocal.avatarStyle || 'bottts-neutral', cachedLocal.avatarSeed || cachedLocal.username),
        avatarSeed: cachedLocal.avatarSeed || cachedLocal.username,
        avatarStyle: cachedLocal.avatarStyle || 'bottts-neutral',
        updatedAt: BigInt(Math.floor((cachedLocal.updatedAt || cachedLocal.createdAt || Date.now()) / 1000)),
      }
    }
    return null
  }, [localIsNewer, cachedLocal, hasOnchainData, username, avatarUrl, avatarSeed, avatarStyle, updatedAt, localTimeMs])

  const hasProfile = Boolean(effectiveProfile && effectiveProfile.username.length > 0)

  return {
    hasProfile,
    profile: effectiveProfile,
    isLoading: isLoading && !hasProfile,
    refetch,
    error,
  }
}

/**
 * Check if a username is available onchain
 */
export function useCheckUsernameAvailable(username: string, chainId: number = ARC_TESTNET_CHAIN_ID) {
  const clean = username.trim()
  const isValid = clean.length >= 2 && clean.length <= 24

  return useReadContract({
    address: TRIVIO_PROFILE_REGISTRY_ADDRESS,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'isUsernameAvailable',
    args: isValid ? [clean] : undefined,
    chainId,
    query: {
      enabled: isValid,
      staleTime: 5_000,
    },
  })
}

/**
 * Write/Update onchain profile
 */
export function useSetOnchainProfile() {
  const { writeContract, writeContractAsync, data: hash, isPending, error, reset } = useWriteContract()

  const { isLoading: isConfirming, isSuccess, isError: isReceiptError } = useWaitForTransactionReceipt({
    hash,
  })

  const setProfile = (
    username: string,
    avatarUrl: string,
    avatarSeed: string,
    avatarStyle: string,
    chainId: number = ARC_TESTNET_CHAIN_ID
  ) => {
    writeContract({
      address: TRIVIO_PROFILE_REGISTRY_ADDRESS,
      abi: PROFILE_REGISTRY_ABI,
      functionName: 'setProfile',
      args: [username, avatarUrl, avatarSeed, avatarStyle],
      chainId,
    })
  }

  const setProfileAsync = (
    username: string,
    avatarUrl: string,
    avatarSeed: string,
    avatarStyle: string,
    chainId: number = ARC_TESTNET_CHAIN_ID
  ) => {
    return writeContractAsync({
      address: TRIVIO_PROFILE_REGISTRY_ADDRESS,
      abi: PROFILE_REGISTRY_ABI,
      functionName: 'setProfile',
      args: [username, avatarUrl, avatarSeed, avatarStyle],
      chainId,
    })
  }

  return {
    setProfile,
    setProfileAsync,
    isPending,
    isConfirming,
    isSuccess,
    isReceiptError,
    hash,
    error,
    reset,
  }
}

