// eslint-disable-next-line
// @ts-ignore
import debug, {inspectOpts} from 'debug'
debug.enable('docker-compose-testkit:info:*')
inspectOpts.colors = true

export default debug
export type {Debugger} from 'debug'
