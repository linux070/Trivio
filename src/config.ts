/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected, coinbaseWallet, metaMask } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

export const ARC_TESTNET_CHAIN_ID = arcTestnet.id

// Deployed TriviaGame contract — Arc Testnet
export const TRIVIA_GAME_ADDRESS: `0x${string}` = '0x11b30d080135bdb746adf2bdfb9754605fb9b171'

export const config = createConfig({
  chains: [arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({ appName: 'TRIVIO' }),
  ],
  transports: {
    [arcTestnet.id]: http(),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
