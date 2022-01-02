import {execa} from 'execa'
import {cleanupContainersByEnvironmentName, cleanupOrphanEnvironments} from './cleanup.js'
import {getProjectName} from './project-name.js'
import {pullImagesFromComposeFile} from './pull-images.js'
import {getAddressForService, getInternalIpForService} from './service-compose-network.js'

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
  setup: () => Promise<void>
  teardown: () => Promise<void>
  getAddressForService: (serviceName: string, exposedPort: number) => Promise<string>
  getInternalIpForService: (serviceName: string) => Promise<string>
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

    const onlyTheseServicesMessage = servicesToStart
      ? `, using only these services: ${servicesToStart.join(',')}`
      : ''
    const consoleMessage = `Docker: starting up runtime environment for this run (codenamed: ${displayName})${onlyTheseServicesMessage}... `
    console.log(consoleMessage)

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
    setup,
    teardown,
    getAddressForService: (serviceName, exposedPort) =>
      getAddressForService(project, pathToCompose, serviceName, exposedPort),
    getInternalIpForService: (serviceName) =>
      getInternalIpForService(project, pathToCompose, serviceName),
  }
}

export default compose

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
