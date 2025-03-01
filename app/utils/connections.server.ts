import type { ProviderName } from './connections'
import type { AuthProvider } from './providers/provider'
import { GoogleProvider } from './providers/google.server.js'

export const providers: Record<ProviderName, AuthProvider> = {
  google: new GoogleProvider(),
}

export function resolveConnectionData(
  providerName: ProviderName,
  providerId: string,
) {
  return providers[providerName].resolveConnectionData(providerId)
}
