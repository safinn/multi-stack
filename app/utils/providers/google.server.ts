import type { AuthProvider, ProviderUser } from './provider'
import process from 'node:process'
import { GoogleStrategy } from '@coji/remix-auth-google'
import { repositoryFactory } from '~/data/factory'

export class GoogleProvider implements AuthProvider {
  getAuthStrategy() {
    return new GoogleStrategy<ProviderUser>(
      {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectURI: process.env.GOOGLE_REDIRECT_URI!,
      },
      async ({ tokens }) => {
        const profile = await GoogleStrategy.userProfile(tokens)

        return {
          id: profile.id,
          email: profile.emails[0].value,
          name: `${profile.name.givenName} ${profile.name.familyName}`,
          username: profile.displayName,
          imageUrl: profile.photos[0].value,
        }
      },
    )
  }

  async resolveConnectionData(providerId: string) {
    const connection = await repositoryFactory.getConnectionRepository().findByProviderNameAndId('google', providerId)
    return {
      displayName: connection?.providerDisplayName ?? 'Unknown',
      link: null,
    } as const
  }
}
