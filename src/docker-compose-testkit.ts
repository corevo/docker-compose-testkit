import {execa, ExecaReturnValue} from 'execa'
import {cleanupContainersByEnvironmentName, cleanupOrphanEnvironments} from './cleanup.js'
import {getProjectName} from './project-name.js'
import {pullImagesFromComposeFile} from './pull-images.js'
import {getAddressForService, getInternalIpForService} from './service-compose-network.js'
import {listContainers, containerExists, Container} from './list-containers.js'
import {getLogsForService} from './container-logs.js'
import {
  startService,
  stopService,
  pauseService,
  unpauseService,
  runService,
  waitForServiceToExit,
} from './container-lifecycle.js'
import debug from './debug.js'

type EnvFunc = () => string
type Env = Record<string, string | EnvFunc>

export interface ComposeOptions {
  servicesToStart: string[]
  projectName: string
  env: Env
  orphanCleanup: boolean
  cleanup: boolean
  pullImages: boolean
  forceKill: boolean
  containerRetentionInMinutes: number
}

export interface Compose {
  projectName: string
  pathToCompose: string
  setup: () => Promise<void>
  teardown: () => Promise<void>
  getAddressForService: (serviceName: string, exposedPort: number) => Promise<string>
  getInternalIpForService: (serviceName: string) => Promise<string>
  listContainers: () => Promise<Container[]>
  containerExists: (serviceName: string) => Promise<boolean>
  getLogsForService: (serviceName: string) => Promise<string>
  waitForServiceToExit: (serviceName: string) => Promise<void>
  runService: (serviceName: string, commandWithArgs: string[]) => Promise<ExecaReturnValue<string>>
  startService: (serviceName: string) => Promise<void>
  stopService: (serviceName: string) => Promise<void>
  pauseService: (serviceName: string) => Promise<void>
  unpauseService: (serviceName: string) => Promise<void>
}

export function compose(pathToCompose: string, options?: ComposeOptions): Compose {
  const {
    servicesToStart,
    projectName,
    env,
    orphanCleanup,
    cleanup,
    pullImages,
    forceKill,
    containerRetentionInMinutes,
  } = {
    servicesToStart: [],
    env: {},
    orphanCleanup: true,
    cleanup: true,
    pullImages: false,
    forceKill: false,
    containerRetentionInMinutes: 5,
    ...options,
  }
  const {project, displayName} = getProjectName(projectName)

  async function setup() {
    if (pullImages) {
      await pullImagesFromComposeFile(pathToCompose, servicesToStart)
    }

    if (orphanCleanup) {
      await cleanupOrphanEnvironments(containerRetentionInMinutes)
    }

    const onlyTheseServicesMessage = servicesToStart.length
      ? `, using only these services: ${servicesToStart.join(',')}`
      : ''
    const consoleMessage = `starting up runtime environment for this run (codenamed: ${displayName})${onlyTheseServicesMessage}... `
    debug(consoleMessage)

    const finalEnv = replaceFunctionsWithTheirValues(env)

    await execa(
      'docker',
      ['compose', '-p', project, '-f', pathToCompose, 'up', '-d', ...servicesToStart],
      {env: {path: process.env.PATH, ...finalEnv}},
    )
  }

  async function teardown() {
    if (cleanup) {
      await cleanupContainersByEnvironmentName(project, pathToCompose, displayName, forceKill)
    }
  }

  return {
    projectName: project,
    pathToCompose,
    setup,
    teardown,
    getAddressForService: getAddressForService.bind(undefined, project, pathToCompose),
    getInternalIpForService: getInternalIpForService.bind(undefined, project, pathToCompose),
    listContainers: listContainers.bind(undefined, project, pathToCompose),
    containerExists: containerExists.bind(undefined, project, pathToCompose),
    getLogsForService: getLogsForService.bind(undefined, project, pathToCompose),
    waitForServiceToExit: waitForServiceToExit.bind(undefined, project, pathToCompose),
    runService: runService.bind(undefined, project, pathToCompose),
    startService: startService.bind(undefined, project, pathToCompose),
    stopService: stopService.bind(undefined, project, pathToCompose),
    pauseService: pauseService.bind(undefined, project, pathToCompose),
    unpauseService: unpauseService.bind(undefined, project, pathToCompose),
  }
}

export default compose
export type {Container, Publisher, State} from './list-containers.js'

function replaceFunctionsWithTheirValues(env: Env): Record<string, string> {
  return Object.entries(env).reduce((finalEnv, [key, value]) => {
    if (typeof value === 'function') {
      env[key] = value()
    } else {
      env[key] = value
    }

    return finalEnv
  }, {})
}
