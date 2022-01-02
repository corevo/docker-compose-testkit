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
  Project: string
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
  return JSON.parse(
    (
      await execa('docker', [
        'compsoe',
        '-p',
        projectName,
        '-f',
        pathToCompose,
        'ps',
        '--format',
        'json',
      ])
    ).stdout,
  )
}
