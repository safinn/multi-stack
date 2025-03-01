import type { Strategy } from 'remix-auth/strategy'

// Define a user type for cleaner typing
export interface ProviderUser {
  id: string | number
  email: string
  username?: string
  name?: string
  imageUrl?: string
}

export interface AuthProvider {
  getAuthStrategy: () => Strategy<ProviderUser, any>
  resolveConnectionData: (
    providerId: string,
  ) => Promise<{
    displayName: string
    link?: string | null
  }>
}

export const normalizeEmail = (s: string) => s.toLowerCase()

export function normalizeUsername(s: string) {
  return s.replace(/\W/g, '_').toLowerCase()
}
