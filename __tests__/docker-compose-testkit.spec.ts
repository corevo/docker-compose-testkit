import path from 'path'
import {fileURLToPath} from 'url'
import {jest, describe, it, expect} from '@jest/globals'
import dockerCompose from '../src/docker-compose-testkit.js'

jest.setTimeout(30 * 1000)

describe('docker-compose-testkit', () => {
  it('should create and delete a compose network', async () => {
    const pathToCompose = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'docker-compose.yml',
    )
    const compose = dockerCompose(pathToCompose)

    await compose.setup()
    await compose.teardown()
  })

  it('should not throw when creating an empty compose netowrk', async () => {
    const pathToCompose = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'docker-compose-empty.yml',
    )
    const compose = dockerCompose(pathToCompose)

    await compose.setup()
    await compose.teardown()
  })

  it('should calculate env vars before running the compose network', async () => {
    const pathToCompose = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'docker-compose-env.yml',
    )
    const compose = dockerCompose(pathToCompose, {
      env: {
        STRING: 'hardcoded',
        FUNCTION: () => 'from function',
        PROMISE: () => Promise.resolve('from promise'),
      },
    })

    await compose.setup()

    await compose.waitForServiceToExit('node')
    const logs = await compose.getLogsForService('node')
    const parsedLogLine = JSON.parse(logs.split('\n')[0].substr(logs.indexOf('{')))
    expect(parsedLogLine).toMatchObject({
      STRING: 'hardcoded',
      FUNCTION: 'from function',
      PROMISE: 'from promise',
    })

    await compose.teardown()
  })
})
