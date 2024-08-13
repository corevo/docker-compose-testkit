import {execa} from 'execa'
import {
  extractTimestampFromName,
  extractContainerIdFromName,
  extractProjectNameFromContainer,
} from './project-name.js'
import {cleanupVolumes, composeDown, composeKill} from './container-lifecycle.js'
import debug, {err, Debugger} from './debug.js'
const log = debug('docker-compose-testkit:debug')

function getUnixTimestampNow() {
  return Math.floor(Date.now() / 1000)
}

function getStaleContainers(
  stdout: string,
  minutesAgoInUnixTimestamp: number,
  containerRetentionInMinutesParam: number,
): string[] {
  return stdout
    .split('\n')
    .filter((o) => o.length > 0 && o.indexOf('testkit__') !== -1)
    .map((o) => o.substring(1, o.length - 2))
    .filter((o) => {
      log(`inspecting container named: ${o} for cleanup`)
      const decision =
        extractTimestampFromName(o) <= minutesAgoInUnixTimestamp ||
        containerRetentionInMinutesParam === 0
      if (decision) {
        log(
          `container named: ${o} is more than ${containerRetentionInMinutesParam} minutes old and will be cleaned up`,
        )
      } else {
        log(`container named: ${o} is fresh and will NOT be cleaned up`)
      }
      return decision
    })
}

export async function cleanupContainersByEnvironmentName(
  projectName: string,
  pathToCompose: string,
  {
    displayName,
    forceKill,
    log,
    env,
  }: {
    displayName: string
    forceKill: boolean
    log: Debugger
    env: Record<string, string>
  },
) {
  const consoleMessage = `${
    forceKill ? 'Killing' : 'Stopping'
  } all containers of environment codenamed: ${displayName}.. `

  log(consoleMessage)

  await (forceKill
    ? composeKill(projectName, pathToCompose, {env}).catch(() =>
        composeDown(projectName, pathToCompose, {env}),
      )
    : composeDown(projectName, pathToCompose, {env}))

  const consoleMessageDispose = `Disposing of ${displayName} environment.. `
  log(consoleMessageDispose)

  await cleanupVolumes(projectName, pathToCompose, {env})
}

export async function cleanupOrphanEnvironments(containerRetentionInMinutesParam: number) {
  const minutesAgoInUnixTimestamp =
    containerRetentionInMinutesParam === 0
      ? getUnixTimestampNow()
      : getUnixTimestampNow() - 60 * containerRetentionInMinutesParam
  const result = await execa('docker', ['ps', '-a', '--format', '"{{.ID}}__{{.Names}}"'])

  const staleContainers = getStaleContainers(
    result.stdout,
    minutesAgoInUnixTimestamp,
    containerRetentionInMinutesParam,
  )

  // Kill stale containers
  await Promise.all(
    staleContainers
      .map((container) => extractContainerIdFromName(container))
      .map((containerId) => killByContainerId(containerId)),
  )

  // Remove stale networks
  await Promise.all(
    Array.from(
      new Set(
        staleContainers.map((container) => extractProjectNameFromContainer(container)),
      ).values(),
    ).map((projectName) => killNetworkByProjectName(projectName)),
  )

  // Clean up old volumes which are not connected to anything
  // Volumes which are in use will not be harmed by this
  await removeStaleVolumes()
}

export async function killByContainerId(containerId: string) {
  await execa('docker', ['rm', '-f', '-v', containerId])
}

export async function killNetworkByProjectName(projectName: string) {
  log(`Removing network for project name: ${projectName}...`)
  await execa(
    'docker',
    [
      'network',
      'ls',
      '|',
      'grep',
      projectName,
      '|',
      'awk',
      "'{print $2}'",
      '|',
      'xargs',
      'docker',
      'network',
      'rm',
    ],
    {shell: true},
  )
}

export async function removeStaleVolumes() {
  log('Removing old unused volumes...')
  try {
    const volumeNamesCmd = await execa('docker volume ls -q', {shell: true})
    const volumeNames = volumeNamesCmd.stdout.split('\n')
    if (volumeNames.length === 0) {
      log('No volumes to remove')
      return
    }
    const volumesInspectCmd = await execa(
      `docker inspect --type volume --format "{{json .}}" ${volumeNames.join(' ')}`,
      {shell: true},
    )
    const volumesInspect = volumesInspectCmd.stdout.split('\n')
    const lastMonth = new Date().getTime() - 1000 * 60 * 60 * 24 * 30
    const volumesToDelete = []
    for (const inspectStdout of volumesInspect) {
      const volumeJson = JSON.parse(inspectStdout)
      if (new Date(volumeJson.CreatedAt).getTime() < lastMonth) {
        volumesToDelete.push(volumeJson.Name)
      }
    }
    if (volumesToDelete.length > 0) {
      log(`Removing volumes: [${volumesToDelete.join(' ')}]`)
      await execa(`docker volume rm ${volumesToDelete.join(' ')}`, {shell: true})
    } else {
      log('No volumes to remove')
    }
  } catch (error: any) {
    if (error?.stderr?.includes('volume is in use')) {
      return
    }
    err('Remove volumes unexpected err:', error)
  }
}
