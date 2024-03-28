import path from 'path'
import {fileURLToPath} from 'url'
import {createWriteStream, unlinkSync, readFileSync} from 'fs'
import {jest, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect} from '@jest/globals'
import retry from 'p-retry'
import dockerCompose from '../src/docker-compose-testkit.js'
import {tailLogsForServices} from '../src/container-logs.js'

jest.setTimeout(30 * 1000)

const fixturesDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')

const tempLog = path.join(fixturesDirectory, 'test.log')

const deleteTempLog = () => {
  try {
    unlinkSync(tempLog)
  } catch {}
}

const delay = (timeout: number) => new Promise((r) => setTimeout(r, timeout))

describe('docker-compose-logs', () => {
  describe('single service', () => {
    const pathToCompose = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'docker-compose-fixture.yml',
    )
    const compose = dockerCompose(pathToCompose, {
      env: {
        FIXTURE: 'logs',
      },
    })

    beforeAll(compose.setup)
    afterAll(compose.teardown)

    beforeEach(deleteTempLog)
    afterEach(deleteTempLog)

    it('should tail the logs of a given service', async () => {
      const stream = createWriteStream(tempLog)
      const kill = tailLogsForServices(compose.projectName, compose.pathToCompose, ['node'], stream)

      await retry(
        async () => {
          let logs: string[]
          try {
            logs = readFileSync(tempLog, {encoding: 'utf-8'}).split('\n')
          } catch {
            throw new Error('force retry')
          }

          expect(logs.length).toBeGreaterThanOrEqual(3)
          expect(logs[2]).toMatch(new RegExp(`node-1  | log message #\d+`))
        },
        {retries: 10, minTimeout: 100, maxTimeout: 200},
      ).finally(kill)
    })

    it('should get the logs of a single service', async () => {
      const logs = (await compose.getLogsForService('node')).split('\n')
      expect(logs.length).toBeGreaterThanOrEqual(3)
      expect(logs[0]).toMatch(new RegExp(`node-1  | log message #\d+`))
    })
  })

  describe('tail to stdout', () => {
    const pathToCompose = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'docker-compose-fixture.yml',
    )
    const compose = dockerCompose(pathToCompose, {
      tailServices: 'node',
      env: {
        FIXTURE: 'logs',
      },
    })

    beforeAll(compose.setup)
    afterAll(compose.teardown)

    beforeEach(deleteTempLog)
    afterEach(deleteTempLog)

    it('should not crash when writing to stdout', async () => {
      await delay(2000)
      expect(true).toBeTruthy()
    })
  })

  describe.skip('multiple services', () => {
    const pathToCompose = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'docker-compose-fixture-multi.yml',
    )
    const compose = dockerCompose(pathToCompose, {
      env: {
        FIXTURE: 'logs',
        FIXTURE_SECOND: 'logs',
      },
    })

    beforeAll(compose.setup)
    afterAll(compose.teardown)

    beforeEach(deleteTempLog)
    afterEach(deleteTempLog)

    it('should tail the logs of all services', async () => {
      const stream = createWriteStream(tempLog)
      const kill = tailLogsForServices(compose.projectName, compose.pathToCompose, [], stream)

      await retry(
        async () => {
          let logs: string[]
          try {
            logs = readFileSync(tempLog, {encoding: 'utf-8'}).split('\n')
          } catch {
            throw new Error('force retry')
          }

          expect(logs.length).toBeGreaterThanOrEqual(3)

          const firstLogs = logs.filter((log) => log.includes('first-1'))
          const secondLogs = logs.filter((log) => log.includes('second-1'))
          expect(firstLogs.length).toBeGreaterThanOrEqual(1)
          expect(secondLogs.length).toBeGreaterThanOrEqual(1)
        },
        {retries: 10, minTimeout: 100, maxTimeout: 200},
      ).finally(kill)
    })
  })
})
