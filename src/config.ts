/**
 * wagmi configuration (Privy-compatible)
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { defineChain } from 'viem'
import { registerChain } from './tracing'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
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
registerChain(arcTestnet.id, 'https://rpc.testnet.arc.io')
registerChain(arcMainnet.id, 'https://rpc.mainnet.arc.io')

export const ARC_TESTNET_CHAIN_ID = arcTestnet.id
export const ARC_MAINNET_CHAIN_ID = arcMainnet.id

// Deployed TriviaGame contract — Arc Testnet
export const TRIVIA_GAME_ADDRESS: `0x${string}` = '0x1b785e38e8ebb334b52a305a10e92b5ef9564624'

// Deployed TrivioProfileRegistry contract — Arc Testnet
export const TRIVIO_PROFILE_REGISTRY_ADDRESS: `0x${string}` = '0xd69522761493ce3fc74fc07ae99d5cbd6de5f480'

export const config = createConfig({
  chains: [arcTestnet, arcMainnet, mainnet], // mainnet needed for ENS resolution
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [arcMainnet.id]: http('https://rpc.mainnet.arc.io'),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})

