import {execa, ExecaReturnValue} from 'execa'
import {cleanupContainersByEnvironmentName, cleanupOrphanEnvironments} from './cleanup.js'
import {getProjectName} from './project-name.js'
import {pullImagesFromComposeFile} from './pull-images.js'
import {
  AddressOptions,
  getAddressForService,
  getInternalIpForService,
} from './service-compose-network.js'
import {listContainers, containerExists, Container} from './list-containers.js'
import {getLogsForService, tailLogsForServices} from './container-logs.js'
import {
  startService,
  stopService,
  pauseService,
  unpauseService,
  runService,
  waitForServiceToExit,
  ExitOptions,
} from './container-lifecycle.js'
import debug from './debug.js'

type EnvFunc = () => string | number
type EnvAsyncFunc = () => Promise<string | number>
type Env = Record<string, string | EnvFunc | EnvAsyncFunc>

export interface ComposeOptions {
  servicesToStart?: string[]
  tailServices?: string
  projectName?: string
  env?: Env
  orphanCleanup?: boolean
  cleanup?: boolean
  pullImages?: boolean
  forceKill?: boolean
  containerRetentionInMinutes?: number
}

export interface Compose {
  projectName: string
  pathToCompose: string
  setup: () => Promise<void>
  teardown: () => Promise<void>
  getAddressForService: (
    serviceName: string,
    exposedPort: number,
    options?: AddressOptions,
  ) => Promise<string>
  getInternalIpForService: (serviceName: string) => Promise<string>
  listContainers: () => Promise<Container[]>
  containerExists: (serviceName: string) => Promise<boolean>
  getLogsForService: (serviceName: string) => Promise<string>
  waitForServiceToExit: (serviceName: string, options?: ExitOptions) => Promise<void>
  runService: (serviceName: string, commandWithArgs: string[]) => Promise<ExecaReturnValue<string>>
  startService: (serviceName: string) => Promise<void>
  stopService: (serviceName: string) => Promise<void>
  pauseService: (serviceName: string) => Promise<void>
  unpauseService: (serviceName: string) => Promise<void>
}

export function compose(pathToCompose: string, options?: ComposeOptions): Compose {
  const {
    servicesToStart,
    tailServices,
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
    forceKill: true,
    containerRetentionInMinutes: 5,
    ...options,
  }
  const {project, displayName} = getProjectName(projectName)
  const log = debug(`docker-compose-testkit:info:${displayName}`)
  let killTailProcess: any = undefined
  const finalEnv: Record<string, string> = {}

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
    log(consoleMessage)

    // Keep the pointer to finalEnv to not break the bind for runService
    Object.entries(await replaceFunctionsWithTheirValues(env)).forEach(([k, v]) => {
      finalEnv[k] = v
    })

    try {
      await execa(
        'docker',
        ['compose', '-p', project, '-f', pathToCompose, 'up', '-d', ...servicesToStart],
        {env: {path: process.env.PATH, ...finalEnv}},
      )
    } catch (err) {
      const error = err as any
      if (error.stderr !== 'no service selected') {
        throw error
      }
      log(error.stderr)
    }

    //if (tailServices === true || (Array.isArray(tailServices) && tailServices.length)) {
    if (tailServices) {
      killTailProcess = tailLogsForServices(project, pathToCompose, [tailServices], process.stdout)
    }
  }

  async function teardown() {
    if (killTailProcess) {
      await killTailProcess()
    }

    if (cleanup) {
      await cleanupContainersByEnvironmentName(project, pathToCompose, {
        displayName,
        forceKill,
        log,
      })
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
    runService: runService.bind(undefined, project, pathToCompose, finalEnv),
    startService: startService.bind(undefined, project, pathToCompose),
    stopService: stopService.bind(undefined, project, pathToCompose),
    pauseService: pauseService.bind(undefined, project, pathToCompose),
    unpauseService: unpauseService.bind(undefined, project, pathToCompose),
  }
}

export default compose
export type {Container, Publisher, State} from './list-containers.js'

async function replaceFunctionsWithTheirValues(env: Env): Promise<Record<string, string>> {
  return (
    await Promise.all(
      Object.entries(env).map(([k, v]) =>
        typeof v === 'function' ? Promise.resolve(v()).then((f) => [k, f.toString()]) : [k, v],
      ),
    )
  ).reduce((finalEnv, [key, value]) => {
    finalEnv[key] = value

    return finalEnv
  }, {} as Record<string, string>)
}
