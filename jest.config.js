module.exports = {
  testPathIgnorePatterns: ['/node_modules/'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  reporters: ['default'],
  moduleFileExtensions: ['js', 'ts', 'tsx', 'json', 'jsx', 'node'],
}
