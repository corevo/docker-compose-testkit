# docker-compose-testkit

A library designed for TDD while leveraging docker compose.  

`docker-compose-testkit` helps writing tests by automating the creation and deletions of docker compose environments via test code.
Each test suite (or test!), may create it's own isolated compose network to test against, helping create stronger tests.

## Installation

The library can work with any test runner, or just via code, the only requirement is docker compose v2 installed on the machine.

```sh
$ npm i --save-dev docker-compose-testkit
```

Or alternatively

```sh
$ yarn add -D docker-compose-testkit
```

## Usage

Given the following `docker-compose.yml` file
```yaml
version: '3'
services:
  nginx:
    image: nginx:latest
    ports:
      - 80
```

The following test will up the network before all the tests, and tear it down once the tests finish
```ts
import path from 'path'
import {fileURLToPath} from 'url'
import dockerCompose from 'docker-compose-testkit'

describe('testing using docker compose', () => {
  const pathToCompose = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'docker-compose.yml',
  )
  const compose = dockerCompose(pathToCompose)

  beforeAll(compose.setup)
  afterAll(compose.teardown)

  it('should send a request to nginx', async () => {
    // translates the internal address (i.e. nginx:80) to host's (e.g. 0.0.0.0:23424)
    const nginxAddress = await compose.getAddressForService('nginx', 80)
    expect((await fetch(`http://${nginxAddress}/`)).ok).to.be.true()
  })
})
```

## API

### dockerCompose(pathToCompose, options?)
Creates the compose object that will manage the network, once it is set up.

#### [options](src/docker-compose-testkit.ts#L26)

Specific options to set for the network and containers

`servicesToStart: string[]` - A list of cherry-picked services to start with the network (default: everything).

`tailServices: string` - Name of a service to start tailing its logs immediately, logs will be printed to stdout regardless of the original file descriptor.

`projectName: string` - Can be used to reconnect to an existing network from a previous run.

`env: object` - Key value object that will set the environment variables for the compose commands, by default containers will not have access to the host's env vars.

`orphanCleanup: boolean` - Wether or not to perform cleanup for containers that might have been left by a previous run (default `true`).

`cleanup: boolean` - Wether or not to perform a cleanup of the network after the test complete (disables the teardown) (default: `true`).

`pullImages: boolean` - Attempt to pull the images prior to `docker compose up` (default: `false`).

`forceKill: boolean` - Send a `SIGKILL` to all containers before running `docker compose down`, this can speed up the teardown significantly (default: `true`).

`containerRetentionInMinutes: number` - How long to keep this network from being picked up by the orphan cleanup, use alongside with `cleanup: false` to retain a network for debugging purposes (default: 5 minutes).

Returns [`Promise<Compose>`](src/docker-compose-testkit.ts#L38).

### compose.projectName

A string representing the generated docker compose project name, pass it again to `dockerCompose(pathToCompose, {projectName})` to reconnect to an existing network.

### compose.pathToCompose

The path to the compose file as given to the `dockerCompose(pathToCompose)`

### compose.setup()

Runs cleanup for orphaned containers, networks and volumes. And then starts up the new network.

Returns `Promise`.

### compose.teardown()

Tears down the current network.

Returns `Promise`.

### compose.getAddressForService(serviceName: string, options?)

Translates the internal address of a given service to the exposed one on the host's machine. For example `nginx:80` to `0.0.0.0:52736`.

The function will attempt to contact the service (similarly to Kubernetes liveness probe), to gauge wether the service is ready to accept connections.

Returns `Promise<string>`

#### options

`healthCheck: undefined | false | string | (address, AbortError) => Promise<void>` - A custom health check function that will be retried to gauge when the service is ready to be used.

- `undefined` is the default, will attempt to send a GET request to `/`.
- `false` disables the health check, the function will return with the address as normal.
- `string` changes the path of the GET request, can be used for `/healthz`.
- `function` a custom function that defines the health check, it will be retried automatically, unless an `AbortError` is sent. Functions arguments:
  - address: string - the addres of the service to test
  - AbortError: (message: string) => AbortError - functions that creates an error that will stop the retries immediately

`fiveHundedStatusIsOk: boolean` - Wether to consider `>500` status codes as healthy (default: `false`).

`maxRetries: number` - How many times to retry the health check, the retries have exponential backoff (default: `10`).

### compose.getInernalIpForService

Translates the inernal hostname (i.e. `nginx`) to the internal network IP, for example `172.17.0.1`.

Returns `Promise<string>`.

### compose.listContainers()

Gets a list of the containers in the network.

Returns `Promise<Container[]>`.

### compose.containerExists(serviceName: string)

Checks if a container exists for a specific service.

Returns `Promise<boolean>`.

### compose.getLogsForService(serviceName: string)

Returns all the logs by a given service name, `stdout` and `stderr` will be interleaved.

Returns `Promise<string>`

### compose.waitForServiceToExit(serviceName: string, options)

Waits for a running service to finish and exit.

Returns `Promise`

#### options

`anyExitCode: boolean` - Wether to throw if the exit code is not `0` (default: `false`).

`timeout: number` - Total timeout to wait for in milliseconds (default: 5 minutes).

### compose.runService(serviceName: string, commandWithArgs: string[])

Runs a one-off command in a service (e.g. `docker compose run`).

`commandWithArgs` - An array of the command and arguments for it.

Returns [`Promise<ExecaReturnValue>`](https://github.com/sindresorhus/execa#execafile-arguments-options)

### compose.startService(serviceName: string)

Starts a service in the network (e.g. `docker compose start`).

Returns `Promise`.

### compose.stopService(serviceName: string)

Stops a service in the network (e.g. `docker compose stop`).

Returns `Promise`.

### compose.pauseService(serviceName: string)

Pauses a service in the network (e.g. `docker compose pause`).

Returns `Promise`.

### compose.unpauseService(serviceName: string)

Unpauses a service in the network (e.g. `docker compose unpause`).

Returns `Promise`.
