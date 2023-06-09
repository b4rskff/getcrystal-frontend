import { ProviderRpcClient } from 'everscale-inpage-provider'
import { EverscaleStandaloneClient } from 'everscale-standalone-client'
import { VenomConnect } from 'venom-connect'

export const initVenomConnect = async () => {
  return new VenomConnect({
    theme: 'dark',
    checkNetworkId: 1002,
    providersOptions: {
      venomwallet: {
        walletWaysToConnect: [
          {
            package: ProviderRpcClient,
            packageOptions: {
              fallback: VenomConnect.getPromise('venomwallet', 'extension') || (() => Promise.reject()),
              forceUseFallback: true
            },
            packageOptionsStandalone: {
              fallback: () => 
                EverscaleStandaloneClient.create({
                  connection: {
                    id: 1002,
                    group: 'venom_devnet',
                    type: 'jrpc',
                    data: {
                      endpoint: 'https://jrpc-devnet.venom.foundation/',
                    },
                  },
                }),
                forceIseFallback: true,
            },
            id: 'extension',
            type: 'extension'
          }
        ],
        defaultWalletWaysToConnect: [
          'mobile',
          'ios',
          'android'
        ]
      }
    }
  })
}