import retry, {AbortError} from 'p-retry'
import got from 'got'

export type HealthCheckFunc = (address: string, AbortError: any) => Promise<void>
export type HealthCheck = false | undefined | string | HealthCheckFunc

export async function runHealthCheck({
  address,
  health,
  maxRetries,
  fiveHundedStatusIsOk,
}: {
  address: string
  health: HealthCheck
  maxRetries: number
  fiveHundedStatusIsOk: boolean
}) {
  if (health === false) return
  if (health === undefined || typeof health === 'string') {
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
