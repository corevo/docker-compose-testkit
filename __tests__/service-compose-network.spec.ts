import {jest, describe, it, expect, beforeAll, afterAll, beforeEach} from '@jest/globals'
import path from 'path'
import {fileURLToPath} from 'url'
import dockerCompose from '../src/docker-compose-testkit.js'
import {clearServiceAddressCache} from '../src/service-compose-network.js'

jest.setTimeout(30 * 1000)

describe('service-compose-network', () => {
  const pathToCompose = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'docker-compose.yml',
  )
  const compose = dockerCompose(pathToCompose)

  beforeAll(compose.setup)
  afterAll(compose.teardown)
  beforeEach(clearServiceAddressCache)

  beforeEach(async () => {
    await compose.startService('netcat')
  })
  describe('getAddressForService', () => {
    it('should get the address of a service', async () => {
      const nginxAddress = await compose.getAddressForService('nginx', 80)
      expect(nginxAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
    })

    it('should get the address of a service from the cache after the first time called', async () => {
      let start = Date.now()
      const firstCall = await compose.getAddressForService('nginx', 80)
      const firstCallTime = Date.now() - start
      expect(firstCallTime).toBeGreaterThanOrEqual(20)

      for (let i = 0; i < 10; i++) {
        start = Date.now()
        const anotherCall = await compose.getAddressForService('nginx', 80)
        const anotherCallTime = Date.now() - start
        expect(anotherCall).toBe(firstCall)
        expect(anotherCallTime).toBeLessThan(firstCallTime)
        expect(anotherCallTime).toBeLessThan(5)
      }
    })

    it('should clear the address of a service from cache when service is stopped', async () => {
      let start = Date.now()
      try {
        const firstCall = await compose.getAddressForService('nginx', 80)
        const firstCallTime = Date.now() - start
        expect(firstCallTime).toBeGreaterThanOrEqual(20)

        await compose.stopService('nginx')

        const callThatWillFail = await compose.getAddressForService('nginx', 80).catch((e) => {
          return e
        })
        expect(callThatWillFail?.stderr).toBeDefined()
        expect(callThatWillFail?.stderr).toBe('service "nginx" is not running')

        await compose.startService('nginx')
        start = Date.now()
        const anotherCall = await compose.getAddressForService('nginx', 80)
        const anotherCallTime = Date.now() - start
        expect(anotherCall).not.toBe(firstCall)
        expect(anotherCallTime).toBeGreaterThanOrEqual(20)
      } finally {
        await compose.startService('nginx')
      }
    })

    it('should not fail to get the address if a service returns 404', async () => {
      const nginxAddress = await compose.getAddressForService('nginx', 80, {healthCheck: '/404'})
      expect(nginxAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
    })

    it('should fail to get the address of a service that responds with 500', async () => {
      try {
        await compose.getAddressForService('nginx', 80, {healthCheck: '/500', maxRetries: 1})
      } catch (err) {
        const error = err as any
        expect(
          error.message.startsWith(
            'Failed to access nginx. Response code 500 (Internal Server Error)',
          ),
        ).toBeTruthy()
      }

      expect.assertions(1)
    })

    it('should succeed to get the address of a service that responds with 500 if it is configured to be ok', async () => {
      const nginxAddress = await compose.getAddressForService('nginx', 80, {
        healthCheck: '/500',
        fiveHundedStatusIsOk: true,
        maxRetries: 1,
      })
      expect(nginxAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
    })

    it('should succeed to get the address of a TCP service', async () => {
      const netcatAddress = await compose.getAddressForService('netcat', 80, {
        tcpCheckOnly: true,
        maxRetries: 1,
      })
      expect(netcatAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
    })
  })

  describe('getInternalIpForService', () => {
    it('should get the internal ip of a service', async () => {
      const nginxAddress = await compose.getInternalIpForService('nginx')
      expect(nginxAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
    })
  })

  describe('getAddresses', () => {
    beforeEach(async () => {
      await compose.startService('netcat')
    })
    it('should get multiple services', async () => {
      const serviceAddresses = await compose.getAddressesForServices('nginx', [
        'netcat',
        80,
        {tcpCheckOnly: true, maxRetries: 1},
      ])
      expect(serviceAddresses.nginx).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
      expect(serviceAddresses.netcat).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
    })

    it('should be able to handle custom attributes for each definition', async () => {
      const serviceAddresses = await compose.getAddressesForServices(
        ['nginx', 80, {healthCheck: '/404'}],
        ['netcat', 80, {tcpCheckOnly: true, maxRetries: 1}],
      )
      expect(serviceAddresses.nginx).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
      expect(serviceAddresses.netcat).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)
    })
  })
})
