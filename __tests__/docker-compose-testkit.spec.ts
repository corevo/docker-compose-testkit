import * as path from 'path'
import {jest, describe, it, expect, beforeAll, afterAll} from '@jest/globals'
// eslint-disable-next-line
// @ts-ignore
import {dockerComposeTool} from '@corevo/docker-compose-tool'

import {getAddressForService, getInternalIpForService} from '../src/docker-compose-testkit'

jest.setTimeout(30 * 1000)

describe('docker-compose-testkit', () => {
  const composePath = path.join(__dirname, 'docker-compose.yml')
  const envName = dockerComposeTool(beforeAll, afterAll, composePath, {
    shouldPullImages:
      !!process.env.NODE_ENV &&
      process.env.NODE_ENV !== 'development' &&
      process.env.NODE_ENV !== 'test',
    envVars: {},
  })

  it('should get the address of a service', async () => {
    const nginxAddress = await getAddressForService(envName, composePath, 'nginx', 80)
    expect(nginxAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
  })

  it('should get the internal ip of a service', async () => {
    const nginxAddress = await getInternalIpForService(envName, composePath, 'nginx')
    expect(nginxAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
  })
})
