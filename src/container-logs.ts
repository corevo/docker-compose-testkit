import {Writable} from 'stream'
import {execa} from 'execa'
import retry from 'p-retry'

export async function getLogsForService(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
): Promise<string> {
  return (
    await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'logs', serviceName])
  ).stdout
}

export function tailLogsForServices(
  projectName: string,
  pathToCompose: string,
  services: string[],
  stream: Writable,
) {
  const child = execa(
    'docker',
    ['compose', '-p', projectName, '-f', pathToCompose, 'logs', '-f', services.join(' ')],
    {all: true},
  )

  child.catch((error) => {
    if ((error as any).signal !== 'SIGKILL') {
      throw error
    }
  })

  if (child.all) {
    child.all.pipe(stream)
  }

  return async () => {
    child.kill(9)
    await retry(() => {
      if (!child.killed) {
        throw new Error('not killed yet')
      }
    })
  }
}
