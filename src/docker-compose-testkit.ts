import retry from 'p-retry'
import fetch from 'node-fetch'
import execa from 'execa'
import {getAddressForService as dctGetAddressForService} from '@corevo/docker-compose-mocha'

const serviceAddressCache = new Map()

export async function getAddressForService(
  envName: string,
  composePath: string,
  serviceName: string,
  exposedPort: number,
  {
    customHealthCheck = undefined,
    fiveHundedStatusIsOk = false,
  }: {
    customHealthCheck?: (address: string) => Promise<boolean>
    fiveHundedStatusIsOk?: boolean
  } = {},
  maxRetries = 10,
) {
  const serviceAddressKey = JSON.stringify({envName, composePath, serviceName, exposedPort})
  const possibleAddress = serviceAddressCache.get(serviceAddressKey)
  if (possibleAddress) {
    return possibleAddress
  }

  const address = await retry(
    async () => {
      const address = await dctGetAddressForService(envName, composePath, serviceName, exposedPort)

      if (customHealthCheck) {
        await customHealthCheck(address)
        return address
      }
      const response = await fetch(`http://${address}/`)

      if (response.status >= (fiveHundedStatusIsOk ? 600 : 500)) {
        throw new Error(`Failed to access ${serviceName}. Got status ${response.status}`)
      }
      return address
    },
    {retries: maxRetries, maxTimeout: 1000},
  )

  /*
  if (err) {
    const log = await getLogsForService(envName, composePath, serviceName)
    throw err
  }
  */

  serviceAddressCache.set(serviceAddressKey, address)

  return address
}

export async function getInternalIpForService(
  envName: string,
  composePath: string,
  serviceName: string,
) {
  const {stdout} = await execa('docker-compose', [
    '-p',
    envName,
    '-f',
    `"${composePath}"`,
    'exec',
    '-T',
    serviceName,
    'hostname',
    '-i',
  ])
  return stdout.replace('\n', '')
}
