import {execa} from 'execa'
import {runHealthCheck, HealthCheck} from './health-check.js'
import {getLogsForService} from './container-logs.js'

const serviceAddressCache = new Map()

export function clearServiceAddressCache() {
  serviceAddressCache.clear()
}

export type GetAddressForServiceParams = [
  serviceName: string,
  exposedPort: number,
  options?: AddressOptions,
]

export interface AddressOptions {
  healthCheck?: HealthCheck
  tcpCheckOnly?: boolean
  fiveHundedStatusIsOk?: boolean
  maxRetries?: number
}

export async function getAddressForService(
  projectName: string,
  pathToCompose: string,
  ...[
    serviceName,
    exposedPort,
    {
      healthCheck = undefined,
      tcpCheckOnly = false,
      fiveHundedStatusIsOk = false,
      maxRetries = 10,
    } = {},
  ]: GetAddressForServiceParams
) {
  const serviceAddressKey = JSON.stringify({projectName, pathToCompose, serviceName, exposedPort})
  const possibleAddress = serviceAddressCache.get(serviceAddressKey)
  if (possibleAddress) {
    return possibleAddress
  }

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

  try {
    await runHealthCheck({
      address,
      health: healthCheck,
      maxRetries,
      tcpCheckOnly,
      fiveHundedStatusIsOk,
    })
  } catch (err) {
    const logs = await getLogsForService(projectName, pathToCompose, serviceName)
    const error = err as any

    throw new Error(`Failed to access ${serviceName}. ${error.message}\n${logs}`)
  }

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

export type ServiceComposeDefinition = string | [serviceName: string] | GetAddressForServiceParams
type ToServiceKey<T extends ServiceComposeDefinition> = T extends string ? T : T[0]
export type ServiceAddresses<T extends ServiceComposeDefinition[]> = {
  [K in T[number] as ToServiceKey<K>]: string
}

export async function getAddressesForServices<
  const ServiceDefinitions extends ServiceComposeDefinition[],
>(
  projectName: string,
  pathToCompose: string,
  defaultPort: number,
  ...services: ServiceDefinitions
): Promise<ServiceAddresses<ServiceDefinitions>> {
  const addresses = {} as any

  await Promise.all(
    services.map(async (def) => {
      const options =
        typeof def === 'string'
          ? ([def, defaultPort] as GetAddressForServiceParams)
          : def.length === 1
            ? ([def[0], defaultPort] as GetAddressForServiceParams)
            : def
      addresses[options[0]] = await getAddressForService(projectName, pathToCompose, ...options)
    }),
  )
  return addresses
}
