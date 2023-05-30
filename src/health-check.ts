import net from 'node:net'
import retry, {AbortError} from 'p-retry'
import got from 'got'

export type HealthCheckFunc = (address: string, AbortError: any) => Promise<void>
export type HealthCheck = false | undefined | string | HealthCheckFunc

export async function runHealthCheck({
  address,
  health,
  maxRetries,
  tcpCheckOnly,
  fiveHundedStatusIsOk,
}: {
  address: string
  health: HealthCheck
  maxRetries: number
  tcpCheckOnly: boolean
  fiveHundedStatusIsOk: boolean
}) {
  if (health === false) return
  if (tcpCheckOnly) {
    const [host, port] = address.split(':')
    await retry(
      async () => {
        await new Promise((resolve, reject) => {
          const client = net.createConnection({port: parseInt(port), host, timeout: 1000}, () => {
            client.end(() => {
              resolve(undefined)
            })
          })
          client.on('error', () => {
            reject(new Error('failed to create a connection'))
          })
        })
      },
      {
        retries: maxRetries,
      },
    )
  } else if (health === undefined || typeof health === 'string') {
    try {
      await got(`http://${address}${health || '/'}`, {retry: {limit: maxRetries}})
    } catch (err) {
      const error = err as any
      if (
        error.code === 'ERR_NON_2XX_3XX_RESPONSE' &&
        error.response.statusCode < (fiveHundedStatusIsOk ? 600 : 500)
      ) {
        return
      }

      throw error
    }
  } else {
    await retry(
      async () => {
        await health(address, AbortError)
      },
      {
        retries: maxRetries,
      },
    )
  }
}
