import { useState, useEffect, useMemo } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ARC_TESTNET_CHAIN_ID, TRIVIO_PROFILE_REGISTRY_ADDRESS } from '@/config'
import { getUserProfile, saveUserProfile, getDiceBearAvatarUrl, fetchCloudProfile, type UserProfile } from '@/lib/userProfile'

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
 * Read profile for a given wallet address (address verified onchain, avatar stored off-chain)
 * with instant local cache + off-chain cloud persistence across cache clears.
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
  const [cloudProfileState, setCloudProfileState] = useState<UserProfile | null>(null)

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

  // Asynchronously query cloud storage to restore latest avatar if local storage was cleared
  useEffect(() => {
    if (!normalized) return
    let isMounted = true
    fetchCloudProfile(normalized).then((cloud) => {
      if (!isMounted || !cloud) return
      setCloudProfileState(cloud)
      const current = getUserProfile(normalized)
      // If no local profile exists (cache cleared) or cloud has newer avatar, restore it
      if (!current || (cloud.updatedAt && (!current.updatedAt || cloud.updatedAt > current.updatedAt))) {
        const merged: UserProfile = {
          username: current?.username || cloud.username || '',
          avatarUrl: cloud.avatarUrl || current?.avatarUrl || getDiceBearAvatarUrl(cloud.avatarStyle || 'bottts-neutral', cloud.avatarSeed || 'trivio'),
          avatarSeed: cloud.avatarSeed || current?.avatarSeed || 'trivio',
          avatarStyle: cloud.avatarStyle || current?.avatarStyle || 'bottts-neutral',
          createdAt: cloud.createdAt || Date.now(),
          updatedAt: cloud.updatedAt || Date.now(),
          isOnchainVerified: current?.isOnchainVerified ?? cloud.isOnchainVerified,
        }
        saveUserProfile(merged, normalized)
        setLocalProfileState(merged)
      }
    })
    return () => {
      isMounted = false
    }
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

  const [username, onchainAvatarUrl, onchainAvatarSeed, onchainAvatarStyle, updatedAt] =
    (data as [string, string, string, string, bigint] | undefined) ?? ['', '', '', '', 0n]

  const hasOnchainData = Boolean(username && username.length > 0)
  const onchainTimeMs = Number(updatedAt) * 1000
  const localTimeMs = cachedLocal ? (cachedLocal.updatedAt || cachedLocal.createdAt || 0) : 0
  const localIsNewer = Boolean(cachedLocal?.username && localTimeMs > onchainTimeMs)

  // Sync onchain username identity with off-chain avatar state
  useEffect(() => {
    if (hasOnchainData && normalized) {
      const activeLocal = getUserProfile(normalized)
      const latestAvatarUrl = activeLocal?.avatarUrl || cloudProfileState?.avatarUrl || onchainAvatarUrl || getDiceBearAvatarUrl(activeLocal?.avatarStyle || 'bottts-neutral', activeLocal?.avatarSeed || username)
      const latestAvatarSeed = activeLocal?.avatarSeed || cloudProfileState?.avatarSeed || onchainAvatarSeed || username
      const latestAvatarStyle = activeLocal?.avatarStyle || cloudProfileState?.avatarStyle || onchainAvatarStyle || 'bottts-neutral'

      const p: UserProfile = {
        username,
        avatarUrl: latestAvatarUrl,
        avatarSeed: latestAvatarSeed,
        avatarStyle: latestAvatarStyle,
        createdAt: onchainTimeMs || activeLocal?.createdAt || Date.now(),
        updatedAt: Math.max(onchainTimeMs, activeLocal?.updatedAt || 0, cloudProfileState?.updatedAt || 0, Date.now()),
        isOnchainVerified: true,
      }
      saveUserProfile(p, normalized)
      setLocalProfileState(p)
    }
  }, [hasOnchainData, normalized, username, onchainAvatarUrl, onchainAvatarSeed, onchainAvatarStyle, onchainTimeMs, cloudProfileState])

  const effectiveProfile: OnchainProfileData | null = useMemo(() => {
    const avatarUrl = cachedLocal?.avatarUrl || cloudProfileState?.avatarUrl || onchainAvatarUrl || getDiceBearAvatarUrl(cachedLocal?.avatarStyle || 'bottts-neutral', cachedLocal?.avatarSeed || username || 'trivio')
    const avatarSeed = cachedLocal?.avatarSeed || cloudProfileState?.avatarSeed || onchainAvatarSeed || username || 'trivio'
    const avatarStyle = cachedLocal?.avatarStyle || cloudProfileState?.avatarStyle || onchainAvatarStyle || 'bottts-neutral'

    if (localIsNewer && cachedLocal) {
      return {
        username: cachedLocal.username,
        avatarUrl,
        avatarSeed,
        avatarStyle,
        updatedAt: BigInt(Math.floor(localTimeMs / 1000)),
      }
    }
    if (hasOnchainData) {
      return {
        username,
        avatarUrl,
        avatarSeed,
        avatarStyle,
        updatedAt,
      }
    }
    if (cachedLocal && cachedLocal.username) {
      return {
        username: cachedLocal.username,
        avatarUrl,
        avatarSeed,
        avatarStyle,
        updatedAt: BigInt(Math.floor((cachedLocal.updatedAt || cachedLocal.createdAt || Date.now()) / 1000)),
      }
    }
    if (cloudProfileState && cloudProfileState.username) {
      return {
        username: cloudProfileState.username,
        avatarUrl,
        avatarSeed,
        avatarStyle,
        updatedAt: BigInt(Math.floor((cloudProfileState.updatedAt || Date.now()) / 1000)),
      }
    }
    return null
  }, [localIsNewer, cachedLocal, cloudProfileState, hasOnchainData, username, onchainAvatarUrl, onchainAvatarSeed, onchainAvatarStyle, updatedAt, localTimeMs])

  const hasProfile = Boolean(effectiveProfile && effectiveProfile.username.length > 0)

  return {
    hasProfile,
    profile: effectiveProfile,
    isLoading: isLoading && !hasProfile,
    refetch,
    error,
  }
}

const usernameAvailabilityCache = new Map<string, boolean>()

/**
 * Fast, debounced, and cached check if a username is available onchain
 */
export function useCheckUsernameAvailable(username: string, chainId: number = ARC_TESTNET_CHAIN_ID) {
  const clean = username.trim().toLowerCase().replace(/^@/, '')
  const [debouncedName, setDebouncedName] = useState(clean)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const [safetyTimedOut, setSafetyTimedOut] = useState(false)

  // 120ms ultra-fast debounce
  useEffect(() => {
    if (!clean || clean.length < 2) {
      setDebouncedName(clean)
      setIsDebouncing(false)
      return
    }
    if (usernameAvailabilityCache.has(clean)) {
      setDebouncedName(clean)
      setIsDebouncing(false)
      return
    }
    setIsDebouncing(true)
    setSafetyTimedOut(false)
    const timer = setTimeout(() => {
      setDebouncedName(clean)
      setIsDebouncing(false)
    }, 120)
    return () => clearTimeout(timer)
  }, [clean])

  const isValid = debouncedName.length >= 2 && debouncedName.length <= 24

  const { data, isLoading, isFetching } = useReadContract({
    address: TRIVIO_PROFILE_REGISTRY_ADDRESS,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'isUsernameAvailable',
    args: isValid ? [debouncedName] : undefined,
    chainId,
    query: {
      enabled: isValid,
      staleTime: 60_000,
      gcTime: 300_000,
      retry: 0,
    },
  })

  // Safety timer to guarantee spinner never spins indefinitely
  useEffect(() => {
    if (isDebouncing || isLoading || isFetching) {
      const timer = setTimeout(() => {
        setSafetyTimedOut(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isDebouncing, isLoading, isFetching, debouncedName])

  useEffect(() => {
    if (data !== undefined && isValid) {
      usernameAvailabilityCache.set(debouncedName, Boolean(data))
    }
  }, [data, debouncedName, isValid])

  const isCached = usernameAvailabilityCache.has(clean)
  const cachedVal = isCached ? usernameAvailabilityCache.get(clean) : undefined

  const result = clean.length < 2
    ? undefined
    : isCached
      ? cachedVal
      : data !== undefined && debouncedName === clean
        ? Boolean(data)
        : undefined

  const checking = clean.length >= 2 && !isCached && !safetyTimedOut && (isDebouncing || isLoading || isFetching)

  return {
    data: result,
    isLoading: checking,
  }
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

