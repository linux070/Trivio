/**
 * wagmi configuration (Privy-compatible)
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig, fallback } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { defineChain } from 'viem'
import { registerChain } from './tracing'

export const ARC_TESTNET_RPCS = [
  'https://rpc.testnet.arc.io',
  'https://rpc.testnet.arc.network',
  'https://rpc.quicknode.testnet.arc.io',
  'https://rpc.quicknode.testnet.arc.network',
  'https://rpc.drpc.testnet.arc.io',
  'https://rpc.drpc.testnet.arc.network',
  'https://rpc.blockdaemon.testnet.arc.io',
  'https://rpc.blockdaemon.testnet.arc.network',
] as const

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: [...ARC_TESTNET_RPCS] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' },
  },
  testnet: true,
})

export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
})

// Pre-register chain RPC URLs so trace events show correct chain names immediately
ARC_TESTNET_RPCS.forEach((rpc) => registerChain(arcTestnet.id, rpc))
registerChain(arcMainnet.id, 'https://rpc.mainnet.arc.io')

export const ARC_TESTNET_CHAIN_ID = arcTestnet.id
export const ARC_MAINNET_CHAIN_ID = arcMainnet.id

// 🧪 Deployed Contracts — Arc Testnet (Chain ID: 5042002)
export const TRIVIA_GAME_ADDRESS: `0x${string}` = '0x1b785e38e8ebb334b52a305a10e92b5ef9564624'
export const TRIVIO_PROFILE_REGISTRY_ADDRESS: `0x${string}` = '0xd69522761493ce3fc74fc07ae99d5cbd6de5f480'

// 🚀 Deployed Contracts — Arc Mainnet (Chain ID: 5042)
// Replace these with your live Arc Mainnet deployed contract addresses
export const TRIVIA_GAME_MAINNET_ADDRESS: `0x${string}` = '0x0000000000000000000000000000000000000000'
export const TRIVIO_PROFILE_REGISTRY_MAINNET_ADDRESS: `0x${string}` = '0x0000000000000000000000000000000000000000'

// Multi-Chain Contract Registry Map
export const CONTRACT_ADDRESSES: Record<number, {
  triviaGame: `0x${string}`
  profileRegistry: `0x${string}`
}> = {
  [ARC_TESTNET_CHAIN_ID]: {
    triviaGame: TRIVIA_GAME_ADDRESS,
    profileRegistry: TRIVIO_PROFILE_REGISTRY_ADDRESS,
  },
  [ARC_MAINNET_CHAIN_ID]: {
    triviaGame: TRIVIA_GAME_MAINNET_ADDRESS,
    profileRegistry: TRIVIO_PROFILE_REGISTRY_MAINNET_ADDRESS,
  },
}

/**
 * Returns the TriviaGame contract address for the active chain (defaults to Arc Testnet)
 */
export function getTriviaGameAddress(chainId?: number): `0x${string}` {
  if (chainId === ARC_MAINNET_CHAIN_ID && TRIVIA_GAME_MAINNET_ADDRESS !== '0x0000000000000000000000000000000000000000') {
    return TRIVIA_GAME_MAINNET_ADDRESS
  }
  return TRIVIA_GAME_ADDRESS
}

/**
 * Returns the TrivioProfileRegistry contract address for the active chain (defaults to Arc Testnet)
 */
export function getProfileRegistryAddress(chainId?: number): `0x${string}` {
  if (chainId === ARC_MAINNET_CHAIN_ID && TRIVIO_PROFILE_REGISTRY_MAINNET_ADDRESS !== '0x0000000000000000000000000000000000000000') {
    return TRIVIO_PROFILE_REGISTRY_MAINNET_ADDRESS
  }
  return TRIVIO_PROFILE_REGISTRY_ADDRESS
}

export const arcTestnetTransport = fallback(
  ARC_TESTNET_RPCS.map((url) => http(url, { retryCount: 2, timeout: 8_000 })),
  { rank: false }
)

export const config = createConfig({
  chains: [arcTestnet, arcMainnet, mainnet], // mainnet needed for ENS resolution
  transports: {
    [arcTestnet.id]: arcTestnetTransport,
    [arcMainnet.id]: http('https://rpc.mainnet.arc.io'),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})

