import type { Route } from './+types/provider'
import { href, redirect } from 'react-router'
import { authenticator } from '~/utils/auth/auth.server'
import { ProviderNameSchema } from '~/utils/connections'
import { getInvitationCookieHeader } from '~/utils/invitation-cookie.server'
import { getReferrerRoute } from '~/utils/misc'
import { getRedirectCookieHeader } from '~/utils/redirect-cookie.server'

export async function loader() {
  return redirect(href('/login'))
}

export async function action({ request, params }: Route.ActionArgs) {
  const providerName = ProviderNameSchema.parse(params.provider)

  try {
    return await authenticator.authenticate(providerName, request)
  }
  catch (error: unknown) {
    if (error instanceof Response) {
      const formData = await request.formData()

      // set the redirectTo cookie
      const rawRedirectTo = formData.get('redirectTo')
      const redirectTo = typeof rawRedirectTo === 'string'
        ? rawRedirectTo
        : getReferrerRoute(request)
      const redirectToCookie = getRedirectCookieHeader(redirectTo)
      if (redirectToCookie) {
        error.headers.append('set-cookie', redirectToCookie)
      }

      // set the invitationId cookie
      const rawInvitationId = formData.get('invitationId')
      const invitationId = typeof rawInvitationId === 'string' ? rawInvitationId : ''
      const invitationIdCookie = getInvitationCookieHeader(invitationId)
      if (invitationIdCookie) {
        error.headers.append('set-cookie', invitationIdCookie)
      }
    }
    throw error
  }
}
