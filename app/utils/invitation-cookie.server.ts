import * as cookie from 'cookie'

const key = 'invitationId'
export const destroyInvitationIdHeader = cookie.serialize(key, '', { maxAge: -1 })

export function getInvitationCookieHeader(invitationId?: string) {
  return invitationId
    ? cookie.serialize(key, invitationId, { maxAge: 60 * 10 })
    : null
}

export function getInvitationCookieValue(request: Request) {
  const rawCookie = request.headers.get('cookie')
  const parsedCookies = rawCookie ? cookie.parse(rawCookie) : {}
  const invitationId = parsedCookies[key]
  return invitationId || null
}
