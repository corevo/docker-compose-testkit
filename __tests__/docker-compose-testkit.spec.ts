import path from 'path'
import {fileURLToPath} from 'url'
import {jest, describe, it} from '@jest/globals'
import dockerCompose from '../src/docker-compose-testkit.js'

jest.setTimeout(30 * 1000)

describe('service-compose-network', () => {
  const pathToCompose = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'docker-compose.yml',
  )
  const compose = dockerCompose(pathToCompose)

  it('should create and delete a compose network', async () => {
    await compose.setup()
    await compose.teardown()
  })
})

