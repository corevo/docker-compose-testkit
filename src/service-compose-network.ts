import {execa} from 'execa'
import {runHealthCheck, HealthCheck} from './health-check.js'
import {getLogsForService} from './container-logs.js'

const serviceAddressCache = new Map()

export function clearServiceAddressCache() {
  serviceAddressCache.clear()
}

export interface AddressOptions {
  healthCheck?: HealthCheck
  fiveHundedStatusIsOk?: boolean
  maxRetries?: number
}

export async function getAddressForService(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
  exposedPort: number,
  {healthCheck = undefined, fiveHundedStatusIsOk = false, maxRetries = 10}: AddressOptions = {},
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
