import type { NextFunction, Request, Response } from 'express'
import process from 'node:process'
import pino from 'pino'
import pinoHttp from 'pino-http'

const startTime = Symbol('startTime')
const reqObject = Symbol('reqObject')

// Extend the Response interface to include our custom properties
interface ExtendedResponse extends Response {
  [startTime]: number
  [reqObject]: Request
  err?: Error
}

const { NODE_ENV } = process.env
const isDev = NODE_ENV === 'development'

export const log = pino({
  level: isDev ? 'debug' : 'info',
})

export function httpLogger() {
  if (!isDev) {
    return pinoHttp({
      logger: log,
    })
  }

  const onResFinished = (res: ExtendedResponse, err?: Error) => {
    const req = res[reqObject]

    const elapsedTime = Date.now() - res[startTime]
    const message = `${res.statusCode} ${req.method} ${req.url} - ${elapsedTime}ms`

    if (err || res.err || res.statusCode >= 500) {
      log.error(err || res.err, message)
      return
    }

    if (res.statusCode >= 400) {
      log.warn(message)
      return
    }

    log.info(message)
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const extRes = res as ExtendedResponse

    const onResponseComplete = (err?: Error) => {
      extRes.removeListener('close', onResponseComplete)
      extRes.removeListener('finish', onResponseComplete)
      extRes.removeListener('error', onResponseComplete)
      return onResFinished(extRes, err)
    }

    extRes[startTime] = Date.now()
    extRes[reqObject] = req

    extRes.on('finish', onResponseComplete)
    extRes.on('close', onResponseComplete)
    extRes.on('error', onResponseComplete)

    next()
  }
}
