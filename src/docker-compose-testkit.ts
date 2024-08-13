import {execa, Result as ExecaResult} from 'execa'
import {cleanupContainersByEnvironmentName, cleanupOrphanEnvironments} from './cleanup.js'
import {getProjectName} from './project-name.js'
import {pullImagesFromComposeFile} from './pull-images.js'
import {
  getAddressesForServices,
  getAddressForService,
  GetAddressForServiceParams,
  getInternalIpForService,
  ServiceComposeDefinition,
  ServiceAddresses,
} from './service-compose-network.js'
import {listContainers, containerExists, Container} from './list-containers.js'
import {getLogsForService, tailLogsForServices} from './container-logs.js'
import {
  startService,
  stopService,
  pauseService,
  unpauseService,
  runService,
  execInService,
  waitForServiceToExit,
  ExitOptions,
} from './container-lifecycle.js'
import debug from './debug.js'
import {existsSync} from 'node:fs'

type EnvFunc = () => string | number
type EnvAsyncFunc = () => Promise<string | number>
type Env = Record<string, string | Promise<string> | EnvFunc | EnvAsyncFunc>

type ExecaCommandResult = ExecaResult<{all: false; stdio: 'pipe'}>

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
  defaultServicePort?: number
}

export interface Compose {
  projectName: string
  pathToCompose: string
  pullImages: () => Promise<string[]>
  setup: () => Promise<void>
  teardown: () => Promise<void>
  getAddressForService: (...options: GetAddressForServiceParams) => Promise<string>
  getAddressesForServices: <const ServiceDefinitions extends ServiceComposeDefinition[]>(
    ...options: ServiceDefinitions
  ) => Promise<ServiceAddresses<ServiceDefinitions>>
  getInternalIpForService: (serviceName: string) => Promise<string>
  listContainers: () => Promise<Container[]>
  containerExists: (serviceName: string) => Promise<boolean>
  getLogsForService: (serviceName: string) => Promise<string>
  waitForServiceToExit: (serviceName: string, options?: ExitOptions) => Promise<void>
  runService: (serviceName: string, commandWithArgs: string[]) => Promise<ExecaCommandResult>
  execInService: (serviceName: string, commandWithArgs: string[]) => Promise<ExecaCommandResult>
  startService: (serviceName: string) => Promise<void>
  stopService: (serviceName: string) => Promise<void>
  pauseService: (serviceName: string) => Promise<void>
  unpauseService: (serviceName: string) => Promise<void>
}

export function compose(pathToCompose: string, options?: ComposeOptions): Compose {
  if (!existsSync(pathToCompose)) {
    throw new Error(`docker-compose file not found at ${pathToCompose}`)
  }
  const {
    servicesToStart,
    tailServices,
    projectName,
    env,
    orphanCleanup,
    cleanup,
    pullImages: pullImagesConfig,
    forceKill,
    containerRetentionInMinutes,
    defaultServicePort,
  } = {
    servicesToStart: [],
    env: {},
    orphanCleanup: true,
    cleanup: true,
    pullImages: false,
    forceKill: true,
    containerRetentionInMinutes: 5,
    defaultServicePort: 80,
    ...options,
  }
  const {project, displayName} = getProjectName(projectName)
  const log = debug(`docker-compose-testkit:info:${displayName}`)
  let killTailProcess: any = undefined
  const finalEnv: Record<string, string> = {path: process.env.PATH as string}
  let finalEnvAssembled = false

  async function assembleFinalEnv() {
    if (!finalEnvAssembled) {
      // Keep the pointer to finalEnv to not break the bind for runService
      Object.entries(await replaceFunctionsWithTheirValues(env)).forEach(([k, v]) => {
        finalEnv[k] = v
      })
    }

    finalEnvAssembled = true
  }

  async function pullImages() {
    await assembleFinalEnv()

    return pullImagesFromComposeFile({
      pathToCompose,
      servicesToStart,
      env: finalEnv,
    })
  }

  async function setup() {
    if (orphanCleanup) {
      await cleanupOrphanEnvironments(containerRetentionInMinutes)
    }

    const onlyTheseServicesMessage = servicesToStart.length
      ? `, using only these services: ${servicesToStart.join(',')}`
      : ''
    const consoleMessage = `starting up runtime environment for this run (codenamed: ${displayName})${onlyTheseServicesMessage}... `
    log(consoleMessage)

    await assembleFinalEnv()

    if (pullImagesConfig) {
      await pullImagesFromComposeFile({
        pathToCompose,
        servicesToStart,
        env: finalEnv,
      })
    }

    try {
      await execa(
        'docker',
        ['compose', '-p', project, '-f', pathToCompose, 'up', '-d', ...servicesToStart],
        {env: finalEnv},
      )
    } catch (err) {
      const error = err as any
      if (
        !error.stderr.includes('no service selected') &&
        !error.stderr.includes('empty compose file')
      ) {
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
        env: finalEnv,
      })
    }
  }
  return {
    projectName: project,
    pathToCompose,
    pullImages,
    setup,
    teardown,
    getAddressForService: getAddressForService.bind(undefined, project, pathToCompose),
    getAddressesForServices: getAddressesForServices.bind(
      undefined,
      project,
      pathToCompose,
      defaultServicePort,
    ),
    getInternalIpForService: getInternalIpForService.bind(undefined, project, pathToCompose),
    listContainers: listContainers.bind(undefined, project, pathToCompose),
    containerExists: containerExists.bind(undefined, project, pathToCompose),
    getLogsForService: getLogsForService.bind(undefined, project, pathToCompose),
    waitForServiceToExit: waitForServiceToExit.bind(undefined, project, pathToCompose),
    runService: runService.bind(undefined, project, pathToCompose, finalEnv),
    execInService: execInService.bind(undefined, project, pathToCompose, finalEnv),
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
      Object.entries(env).map(([k, v]) => {
        if (typeof v === 'function') {
          return Promise.resolve(v()).then((f) => [k, f.toString()])
        } else if (typeof (v as any)?.then === 'function') {
          return (v as any).then((f: any) => [k, f.toString()])
        } else {
          return [k, v]
        }
      }),
    )
  ).reduce(
    (finalEnv, [key, value]) => {
      finalEnv[key] = value

      return finalEnv
    },
    {} as Record<string, string>,
  )
}
