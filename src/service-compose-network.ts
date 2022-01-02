import retry from 'p-retry'
import got from 'got'
import {execa} from 'execa'

const serviceAddressCache = new Map()

export async function getAddressForService(
  projectName: string,
  pathToCompose: string,
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
  const serviceAddressKey = JSON.stringify({projectName, pathToCompose, serviceName, exposedPort})
  const possibleAddress = serviceAddressCache.get(serviceAddressKey)
  if (possibleAddress) {
    return possibleAddress
  }

  const address = await retry(
    async () => {
      const result = await execa('docker', [
        'compose',
        '-p',
        projectName,
        '-f',
        pathToCompose,
        'port',
        serviceName,
        exposedPort.toString(),
      ])
      const address = result.stdout.replace('\n', '')

      if (customHealthCheck) {
        await customHealthCheck(address)
        return address
      }
      const response = await got(`http://${address}/`)

      if (response.statusCode >= (fiveHundedStatusIsOk ? 600 : 500)) {
        throw new Error(`Failed to access ${serviceName}. Got status ${response.statusCode}`)
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
  projectName: string,
  pathToCompose: string,
  serviceName: string,
) {
  const {stdout} = await execa('docker', [
    'compose',
    '-p',
    projectName,
    '-f',
    pathToCompose,
    'exec',
    '-T',
    serviceName,
    'hostname',
    '-i',
  ])
  return stdout.replace('\n', '')
}
