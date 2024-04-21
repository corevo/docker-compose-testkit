import path from 'path'
import {fileURLToPath} from 'url'
import {jest, describe, it, expect} from '@jest/globals'
import dockerCompose from '../src/docker-compose-testkit.js'

jest.setTimeout(30 * 1000)

describe('docker-compose-testkit', () => {
  it('should pull the images in the compose file', async () => {
    const pathToCompose = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'docker-compose-pull.yml',
    )
    const compose = dockerCompose(pathToCompose, {env: {NGINX_VERSION: 'latest'}})

    expect(await compose.pullImages()).toEqual(['nginx:latest'])
  })
})
