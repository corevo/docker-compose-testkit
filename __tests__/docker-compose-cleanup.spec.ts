import path from 'path'
import {fileURLToPath} from 'url'
import {jest, describe, it, expect} from '@jest/globals'
import dockerCompose from '../src/docker-compose-testkit.js'

jest.setTimeout(30 * 1000)

describe('docker-compose-cleanup', () => {
  describe('multiple services', () => {
    it('should force kill the remaining services', async () => {
      const pathToCompose = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'docker-compose-fixture-exit.yml',
      )
      const compose = dockerCompose(pathToCompose, {
        forceKill: true,
        env: {
          FIXTURE: 'logs',
          FIXTURE_SECOND: 'exit',
          EXIT_CODE: '0',
        },
      })

      await compose.setup()
      await compose.waitForServiceToExit('second')
      await compose.teardown()
      expect(await compose.listContainers()).toHaveLength(0)
    })

    it('should force kill the remaining services even if one service crashed', async () => {
      const pathToCompose = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'docker-compose-fixture-exit.yml',
      )
      const compose = dockerCompose(pathToCompose, {
        forceKill: true,
        env: {
          FIXTURE: 'logs',
          FIXTURE_SECOND: 'exit',
          EXIT_CODE: '1',
        },
      })

      await compose.setup()
      await compose.waitForServiceToExit('second').catch(() => {
        return undefined
      })
      await compose.teardown()
      expect(await compose.listContainers()).toHaveLength(0)
    })
  })
})
