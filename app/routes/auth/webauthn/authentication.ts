import type { Route } from './+types/authentication'
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import { uuidv7 } from 'uuidv7'
import { db } from '~/data/db'
import { repositoryFactory } from '~/data/factory'
import { PasskeyRepository } from '~/data/repositories/passkeys'
import { getSessionExpirationDate } from '~/utils/auth/auth.server'
import { handleNewSession } from '~/utils/auth/login.server'
import { getWebAuthnConfig, passkeyCookie, PasskeyLoginBodySchema } from './utils.server'

export async function loader({ request }: Route.LoaderArgs) {
  const config = getWebAuthnConfig(request)
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: 'preferred',
  })

  const cookieHeader = await passkeyCookie.serialize({
    challenge: options.challenge,
  })

  return Response.json({ options }, { headers: { 'Set-Cookie': cookieHeader } })
}

export async function action({ request }: Route.ActionArgs) {
  const cookieHeader = request.headers.get('Cookie')
  const cookie = await passkeyCookie.parse(cookieHeader)
  const deletePasskeyCookie = await passkeyCookie.serialize('', { maxAge: 0 })
  try {
    if (!cookie?.challenge) {
      throw new Error('Authentication challenge not found')
    }

    const body = await request.json()
    const result = PasskeyLoginBodySchema.safeParse(body)
    if (!result.success) {
      throw new Error('Invalid authentication response')
    }
    const { authResponse, remember, redirectTo } = result.data

    const passkeyRepository = new PasskeyRepository(db)

    const passkey = await passkeyRepository.findById(authResponse.id)
    if (!passkey) {
      throw new Error('Passkey not found')
    }

    const config = getWebAuthnConfig(request)

    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: cookie.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      credential: {
        id: authResponse.id,
        publicKey: passkey.publicKey,
        counter: Number(passkey.counter),
      },
    })

    if (!verification.verified) {
      throw new Error('Authentication verification failed')
    }

    // Update the authenticator's counter in the DB to the newest count
    await passkeyRepository.patch(passkey.id, {
      counter: BigInt(verification.authenticationInfo.newCounter),
    })

    const session = await repositoryFactory.getSessionRepository().create({
      id: uuidv7(),
      expirationDate: getSessionExpirationDate(),
      userId: passkey.userId,
    })

    if (!session) {
      throw new Error('Failed to create session')
    }

    const response = await handleNewSession(
      {
        request,
        session,
        remember,
        redirectTo: redirectTo ?? undefined,
      },
      { headers: { 'Set-Cookie': deletePasskeyCookie } },
    )

    return Response.json(
      {
        status: 'success',
        location: response.headers.get('Location'),
      },
      { headers: response.headers },
    )
  }
  catch (error) {
    if (error instanceof Response)
      throw error

    return Response.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Verification failed',
      } as const,
      { status: 400, headers: { 'Set-Cookie': deletePasskeyCookie } },
    )
  }
}
