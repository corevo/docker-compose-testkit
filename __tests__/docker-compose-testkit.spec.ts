import path from 'path'
import {fileURLToPath} from 'url'
import {jest, describe, it} from '@jest/globals'
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
})
