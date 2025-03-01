import type { Route } from './+types/registration'
import { Buffer } from 'node:buffer'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { db } from '~/data/db'
import { PasskeyRepository } from '~/data/repositories/passkeys'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { getDomainUrl, getErrorMessage } from '~/utils/misc'
import { getWebAuthnConfig, passkeyCookie, PasskeyCookieSchema, RegistrationResponseSchema } from './utils.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const passkeys = await new PasskeyRepository(db).findByUserId(user.id)

  const config = getWebAuthnConfig(request)
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: user.username,
    userID: new TextEncoder().encode(user.id),
    userDisplayName: user.username ?? user.email,
    attestationType: 'none',
    excludeCredentials: passkeys?.map(passkey => ({ id: passkey.id })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  return Response.json(
    { options },
    {
      headers: {
        'Set-Cookie': await passkeyCookie.serialize(
          PasskeyCookieSchema.parse({
            challenge: options.challenge,
            userId: options.user.id,
          }),
        ),
      },
    },
  )
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const { user } = await requireUserInOrganization(request, params.organizationId)
    const body = await request.json()
    const result = RegistrationResponseSchema.safeParse(body)
    if (!result.success) {
      throw new Error('Invalid registration response')
    }

    const data = result.data

    // Get challenge from cookie
    const passkeyCookieData = await passkeyCookie.parse(
      request.headers.get('Cookie'),
    )

    const parsedPasskeyCookieData = PasskeyCookieSchema.safeParse(passkeyCookieData)
    if (!parsedPasskeyCookieData.success) {
      throw new Error('No challenge found')
    }
    const { challenge, userId: webauthnUserId } = parsedPasskeyCookieData.data

    const domain = new URL(getDomainUrl(request)).hostname
    const rpID = domain
    const origin = getDomainUrl(request)

    const verification = await verifyRegistrationResponse({
      response: data,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })

    const { verified, registrationInfo } = verification
    if (!verified || !registrationInfo) {
      throw new Error('Registration verification failed')
    }
    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = registrationInfo

    const existingPasskey = await new PasskeyRepository(db).findById(credential.id)
    if (existingPasskey) {
      throw new Error('This passkey has already been registered')
    }

    // Create new passkey in database
    await new PasskeyRepository(db).create({
      id: credential.id,
      aaguid,
      publicKey: Buffer.from(credential.publicKey),
      userId: user.id,
      webauthnUserId,
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports?.join(','),
    })

    return Response.json({ status: 'success' } as const, {
      headers: {
        'Set-Cookie': await passkeyCookie.serialize('', { maxAge: 0 }),
      },
    })
  }
  catch (error) {
    if (error instanceof Response)
      throw error

    return Response.json(
      { status: 'error', error: getErrorMessage(error) },
      { status: 400 },
    )
  }
}
