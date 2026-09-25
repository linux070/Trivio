import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ARC_TESTNET_CHAIN_ID, TRIVIO_PROFILE_REGISTRY_ADDRESS } from '@/config'

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
 * Read onchain profile for a given wallet address
 */
export function useOnchainProfile(address?: string, chainId: number = ARC_TESTNET_CHAIN_ID) {
  const isValidAddress = Boolean(
    address &&
    address.startsWith('0x') &&
    address.length === 42 &&
    address !== '0x0000000000000000000000000000000000000000'
  )

  const { data, isLoading, refetch, error } = useReadContract({
    address: TRIVIO_PROFILE_REGISTRY_ADDRESS,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'getProfile',
    args: isValidAddress ? [address as `0x${string}`] : undefined,
    chainId,
    query: {
      enabled: isValidAddress,
      staleTime: 10_000,
    },
  })

  const [username, avatarUrl, avatarSeed, avatarStyle, updatedAt] =
    (data as [string, string, string, string, bigint] | undefined) ?? ['', '', '', '', 0n]

  const hasProfile = Boolean(username && username.length > 0)

  return {
    hasProfile,
    profile: hasProfile
      ? {
          username,
          avatarUrl,
          avatarSeed,
          avatarStyle,
          updatedAt,
        }
      : null,
    isLoading,
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
  const { writeContract, data: hash, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
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

  return {
    setProfile,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  }
}
