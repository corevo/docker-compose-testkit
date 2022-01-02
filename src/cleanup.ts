// @flow
/* eslint no-console: 0 */

import {execa} from 'execa'
import {
  extractTimestampFromName,
  extractContainerIdFromName,
  extractProjectNameFromContainer,
} from './project-name.js'

function getUnixTimestampNow() {
  return Math.floor(Date.now() / 1000)
}

/**
 * This method filters stale containers from the docker ps command
 * e.g - here's an example of a docker ps output
 *
 * 74934f702e5b cicontainerdenisekochanovitchzzdivzz1483974116_dct_s1_1
 * 490cd2f7f23e cicontainerdenisekochanovitchzzdivzz1483974116_dct_s2_1
 * 0a0d54af82ae cicontainerdenisekochanovitchzzdivzz1483974116_db_1
 *
 * The first value being the container Id and the second one is the container name.
 *
 * @param stdout
 * @param minutesAgoInUnixTimestamp
 * @param containerRetentionInMinutesParam
 * @returns {Array.<String>}
 */
function getStaleContainers(
  stdout: string,
  minutesAgoInUnixTimestamp: number,
  containerRetentionInMinutesParam: number,
): string[] {
  return stdout
    .split('\n')
    .filter((o) => o.length > 0 && o.indexOf('testkit__') !== -1)
    .filter((o) => {
      console.log(`inspecting container named: ${o} for cleanup`)
      const decision =
        extractTimestampFromName(o) <= minutesAgoInUnixTimestamp ||
        containerRetentionInMinutesParam === 0
      if (decision) {
        console.log(
          `container named: ${o} is more than ${containerRetentionInMinutesParam} minutes old and will be cleaned up`,
        )
      } else {
        console.log(
          `container named: ${o} is fresh and will NOT be cleaned up`,
          decision,
          containerRetentionInMinutesParam,
        )
      }
      return decision
    })
}

export async function cleanupContainersByEnvironmentName(
  projectName: string,
  pathToCompose: string,
  displayName: string,
  forceKill: boolean,
) {
  const consoleMessage = `${
    forceKill ? 'Killing' : 'Stopping'
  } all containers of environment codenamed: ${displayName}.. `

  console.log(consoleMessage)

  await execa('docker', [
    'compose',
    '-p',
    projectName,
    '-f',
    pathToCompose,
    forceKill ? 'kill' : 'down',
  ])

  const consoleMessageDispose = `Disposing of ${displayName} environment.. `
  console.log(consoleMessageDispose)

  await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'down', '-v'])
}

export async function cleanupOrphanEnvironments(containerRetentionInMinutesParam: number) {
  const minutesAgoInUnixTimestamp =
    containerRetentionInMinutesParam === 0
      ? getUnixTimestampNow()
      : getUnixTimestampNow() - 60 * containerRetentionInMinutesParam
  const result = await execa('docker', ['ps', '--format', '"{{.ID}}__{{.Names}}"'])

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
  console.log(`Removing network for project name: ${projectName}...`)
  await execa('docker', [
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
  ])
}

export async function removeStaleVolumes() {
  console.log("Removing volumes which we don't need..")
  try {
    // http://stackoverflow.com/questions/17402345/ignore-empty-results-for-xargs-in-mac-os-x
    await execa('(docker volume ls -q || echo :)', ['|', 'xargs', 'docker', 'volume', 'rm'])
  } catch (err) {
    console.log("No volumes require removal.. we're good to go")
  }
}
