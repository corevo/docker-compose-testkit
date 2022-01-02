import path from 'path'
import url from 'url'

export default {
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  testPathIgnorePatterns: ['/node_modules/'],
  testEnvironment: 'node',
  injectGlobals: false,
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  reporters: ['default'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  resolver: path.join(path.dirname(url.fileURLToPath(import.meta.url)), './config/resolver.cjs'),
}
