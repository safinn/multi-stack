import process from 'node:process'
import morgan from 'morgan'
import pino from 'pino'
import pinoHttp from 'pino-http'
import colors, { cyan } from 'yoctocolors'

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

  morgan.token('statusColor', (req, res) => {
    const status = res.statusCode

    // get status color
    const statusColor = status >= 500
      ? colors.red
      : status >= 400
        ? colors.yellow
        : status >= 300
          ? colors.magenta
          : status >= 200
            ? colors.green
            : colors.white

    return colors.bold(statusColor(status?.toString()))
  })

  return morgan(`:statusColor ${cyan(`${colors.bold(':method')} :url :res[content-length] - :response-time ms`)}`)
}
