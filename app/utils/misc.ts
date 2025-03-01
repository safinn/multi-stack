import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { customAlphabet } from 'nanoid'
import { useState } from 'react'
import { useFormAction, useNavigation } from 'react-router'
import { twMerge } from 'tailwind-merge'

export function getDomainUrl(request: Request) {
  const host = request.headers.get('X-Forwarded-Host')
    ?? request.headers.get('host')
    ?? new URL(request.url).host
  const protocol = request.headers.get('X-Forwarded-Proto') ?? 'http'
  return `${protocol}://${host}`
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns true if the current navigation is submitting the current route's
 * form. Defaults to the current route's form action and method POST.
 *
 * Defaults state to 'non-idle'
 *
 * NOTE: the default formAction will include query params, but the
 * navigation.formAction will not, so don't use the default formAction if you
 * want to know if a form is submitting without specific query params.
 */
export function useIsPending({
  formAction,
  formMethod = 'POST',
  state = 'non-idle',
}: {
  formAction?: string
  formMethod?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'
  state?: 'submitting' | 'loading' | 'non-idle'
} = {}) {
  const contextualFormAction = useFormAction()
  const navigation = useNavigation()
  const isPendingState
    = state === 'non-idle'
      ? navigation.state !== 'idle'
      : navigation.state === state
  return (
    isPendingState
    && navigation.formAction === (formAction ?? contextualFormAction)
    && navigation.formMethod === formMethod
  )
}

export function combineHeaders(
  ...headers: Array<ResponseInit['headers'] | null | undefined>
) {
  const combined = new Headers()
  for (const header of headers) {
    if (!header)
      continue
    for (const [key, value] of new Headers(header).entries()) {
      combined.append(key, value)
    }
  }
  return combined
}

/**
 * Combine multiple response init objects into one (uses combineHeaders)
 */
export function combineResponseInits(
  ...responseInits: Array<ResponseInit | null | undefined>
) {
  let combined: ResponseInit = {}
  for (const responseInit of responseInits) {
    combined = {
      ...responseInit,
      headers: combineHeaders(combined.headers, responseInit?.headers),
    }
  }
  return combined
}

export function getReferrerRoute(request: Request) {
  // spelling errors and whatever makes this annoyingly inconsistent
  // in my own testing, `referer` returned the right value, but 🤷‍♂️
  const referrer = request.headers.get('referer')
    ?? request.headers.get('referrer')
    ?? request.referrer
  const domain = getDomainUrl(request)
  if (referrer?.startsWith(domain)) {
    return referrer.slice(domain.length)
  }
  else {
    return '/'
  }
}

function callAll<Args extends Array<unknown>>(
  ...fns: Array<((...args: Args) => unknown) | undefined>
) {
  return (...args: Args) => fns.forEach(fn => fn?.(...args))
}

/**
 * Use this hook with a button and it will make it so the first click sets a
 * `doubleCheck` state to true, and the second click will actually trigger the
 * `onClick` handler. This allows you to have a button that can be like a
 * "are you sure?" experience for the user before doing destructive operations.
 */
export function useDoubleCheck() {
  const [doubleCheck, setDoubleCheck] = useState(false)

  function getButtonProps(
    props?: React.ButtonHTMLAttributes<HTMLButtonElement>,
  ) {
    const onBlur: React.ButtonHTMLAttributes<HTMLButtonElement>['onBlur']
    = () => setDoubleCheck(false)

    const onClick: React.ButtonHTMLAttributes<HTMLButtonElement>['onClick']
    = doubleCheck
      ? undefined
      : (e) => {
          e.preventDefault()
          setDoubleCheck(true)
        }

    const onKeyUp: React.ButtonHTMLAttributes<HTMLButtonElement>['onKeyUp'] = (
      e,
    ) => {
      if (e.key === 'Escape') {
        setDoubleCheck(false)
      }
    }

    return {
      ...props,
      onBlur: callAll(onBlur, props?.onBlur),
      onClick: callAll(onClick, props?.onClick),
      onKeyUp: callAll(onKeyUp, props?.onKeyUp),
    }
  }

  return { doubleCheck, getButtonProps }
}

export function shortId(size: number) {
  const nid = customAlphabet('useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict')
  return nid(size)
}

export function getErrorMessage(error: unknown) {
  if (typeof error === 'string')
    return error
  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    return error.message
  }
  console.error('Unable to get error message for error', error)
  return 'Unknown Error'
}
