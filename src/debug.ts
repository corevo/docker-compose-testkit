// eslint-disable-next-line
// @ts-ignore
import debug, {inspectOpts} from 'debug'
debug.enable(process.env.DEBUG || 'docker-compose-testkit:info:*')
inspectOpts && (inspectOpts.colors = true)

export default debug
export const log = debug('docker-compose-testkit:debug:internal')
export type {Debugger} from 'debug'
