import path from 'path'
import {fileURLToPath} from 'url'
import {jest, describe, it, expect, beforeAll, afterAll} from '@jest/globals'
import dockerCompose from '../src/docker-compose-testkit.js'

jest.setTimeout(30 * 1000)

describe('docker-compose-testkit', () => {
  const pathToCompose = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'docker-compose.yml',
  )
  const compose = dockerCompose(pathToCompose)

  beforeAll(compose.setup)
  afterAll(compose.teardown)

  it('should get the address of a service', async () => {
    const nginxAddress = await compose.getAddressForService('nginx', 80)
    expect(nginxAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
  })

  it('should get the internal ip of a service', async () => {
    const nginxAddress = await compose.getInternalIpForService('nginx')
    expect(nginxAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
  })
})
