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
    const response = await got(`http://${address}${health || '/'}`, {retry: {limit: maxRetries}})

    if (response.statusCode >= (fiveHundedStatusIsOk ? 600 : 500)) {
      throw new Error(`Got status ${response.statusCode}`)
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
