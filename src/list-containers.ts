import {execa} from 'execa'

export type State = 'running' | 'exited' | 'unknown'

export interface Publisher {
  URL: string
  TargetPort: number
  PublishedPort: number
  Protocol: 'tcp' | 'udp'
}

export interface Container {
  ID: string
  Name: string
  Command: string
  Project: string | undefined
  Service: string
  State: State
  Health: string
  ExitCode: number
  Publishers: Publisher[] | null
}

export async function listContainers(
  projectName: string,
  pathToCompose: string,
): Promise<Container[]> {
  const {stdout} = await execa('docker', [
    'compose',
    '-p',
    projectName,
    '-f',
    pathToCompose,
    'ps',
    '-a',
    '--format',
    'json',
  ])

  if (stdout.trim()) {
    try {
      const result = JSON.parse(stdout)

      return Array.isArray(result) ? result : [result]
    } catch {
      return stdout.split('\n').map((out) => JSON.parse(out)) as Container[]
    }
  }

  return []
}

export async function containerExists(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
): Promise<boolean> {
  const containers = await listContainers(projectName, pathToCompose)

  return !!containers.find((c) => c.Service === serviceName)
}
