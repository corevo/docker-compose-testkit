import {execa} from 'execa'

export async function getLogsForService(
  projectName: string,
  pathToCompose: string,
  serviceName: string,
): Promise<string> {
  return (
    await execa('docker', ['compose', '-p', projectName, '-f', pathToCompose, 'logs', serviceName])
  ).stdout
}
