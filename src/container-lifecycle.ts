import retry, {AbortError} from 'p-retry'
import {execa} from 'execa'
import {listContainers} from './list-containers.js'
import {getLogsForService} from './container-logs.js'
import {log} from './debug.js'

export async function composeDown(projectName: string, pathToCompose: string) {
  await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'down'])
}

export async function composeKill(projectName: string, pathToCompose: string) {
  await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'kill'])
}

export async function startService(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
) {
  await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'start', serviceName])
}

export async function stopService(projectName: string, pathToCompose: string, serviceName: string) {
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
  serviceName: string,
  commandWithArgs: string[],
) {
  return await execa(
    'docker',
    ['compose', '-p', projectName, '-f', pathToCompose, 'run', serviceName, ...commandWithArgs],
    {env: {PATH: process.env.PATH}},
  )
}

export interface ExitOptions {
  anyExitCode: boolean
  timeout: number
}

export async function waitForServiceToExit(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
  {anyExitCode, timeout}: ExitOptions = {anyExitCode: false, timeout: 5 * 60 * 1000},
) {
  await retry(
    async () => {
      const container = (await listContainers(projectName, pathToCompose)).find(
        (c) => c.Service === serviceName,
      )

      log(JSON.stringify(container, undefined, 2))

      if (!container || container.State !== 'exited') {
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
    {maxRetryTime: timeout, minTimeout: 100, maxTimeout: 1000},
  ).catch((err) => {
    const error = err as any
    // workaround for jest not displaying the error message
    throw new Error(error.message)
  })
}
