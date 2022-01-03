// eslint-disable-next-line
// @ts-ignore
import debug, {inspectOpts} from 'debug'
debug.enable('docker-compose-testkit')
inspectOpts.colors = true

export default debug('docker-compose-testkit')
