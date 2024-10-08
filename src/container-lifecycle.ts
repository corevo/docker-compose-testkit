import retry, {AbortError} from 'p-retry'
import {execa} from 'execa'
import {listContainers} from './list-containers.js'
import {getLogsForService} from './container-logs.js'
import {removeServiceAddressFromCache} from './service-compose-network.js'
import {log} from './debug.js'

export async function composeDown(
  projectName: string,
  pathToCompose: string,
  {env = {}}: {env?: Record<string, string>},
) {
  try {
    await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'down'], {
      env: {path: process.env.PATH, ...env},
    })
  } catch (err) {
    const error = err as any
    if (
      !error.stderr.includes('no service selected') &&
      !error.stderr.includes('empty compose file')
    ) {
      throw error
    }
  }
}

export async function composeKill(
  projectName: string,
  pathToCompose: string,
  {env = {}}: {env?: Record<string, string>},
) {
  try {
    await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'kill'], {
      env: {path: process.env.PATH, ...env},
    })
  } catch (err) {
    const error = err as any
    if (
      !error.stderr.includes('no service selected') &&
      !error.stderr.includes('empty compose file')
    ) {
      throw error
    }
  }
}

export async function cleanupVolumes(
  projectName: string,
  pathToCompose: string,
  {env = {}}: {env?: Record<string, string>},
) {
  try {
    await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'down', '-v'], {
      env: {path: process.env.PATH, ...env},
    })
  } catch (err) {
    const error = err as any
    if (
      !error.stderr.includes('no service selected') &&
      !error.stderr.includes('empty compose file')
    ) {
      throw error
    }
  }
}

export async function startService(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
) {
  await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'start', serviceName])
}

export async function stopService(projectName: string, pathToCompose: string, serviceName: string) {
  removeServiceAddressFromCache({projectName, pathToCompose, serviceName})
  await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'stop', serviceName])
}

export async function pauseService(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
) {
  await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'pause', serviceName])
}

export async function unpauseService(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
) {
  await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'unpause', serviceName])
}

export async function runService(
  projectName: string,
  pathToCompose: string,
  env: Record<string, string>,
  serviceName: string,
  commandWithArgs: string[],
) {
  return await execa(
    'docker',
    ['compose', '-p', projectName, '-f', pathToCompose, 'run', serviceName, ...commandWithArgs],
    {env: {PATH: process.env.PATH, ...env}},
  )
}

export async function execInService(
  projectName: string,
  pathToCompose: string,
  env: Record<string, string>,
  serviceName: string,
  commandWithArgs: string[],
) {
  return await execa(
    'docker',
    ['compose', '-p', projectName, '-f', pathToCompose, 'exec', serviceName, ...commandWithArgs],
    {env: {PATH: process.env.PATH, ...env}},
  )
}

export interface ExitOptions {
  anyExitCode?: boolean
  timeout?: number
}

export async function waitForServiceToExit(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
  {anyExitCode = false, timeout = 5 * 60 * 1000}: ExitOptions = {},
) {
  await retry(
    async () => {
      const container = (await listContainers(projectName, pathToCompose)).find(
        (c) => c.Service === serviceName,
      )

      log(JSON.stringify(container, undefined, 2))

      if (container && container.State === 'running') {
        throw new Error('Service is still running')
      } else if (!container || container.State !== 'exited') {
        throw new Error('Service does not exist or did not exit')
      } else if (!anyExitCode && container.ExitCode !== 0) {
        const errorMessage = `Service exited with exit code ${
          container.ExitCode
        }:\n${await getLogsForService(projectName, pathToCompose, serviceName)}`
        log(errorMessage)
        throw new AbortError(errorMessage)
      } else {
        return
      }
    },
    {maxRetryTime: timeout, minTimeout: 100, maxTimeout: 1000, retries: timeout / 1000},
  ).catch((err) => {
    const error = err as any
    // workaround for jest not displaying the error message
    throw new Error(error.message)
  })
}
