// eslint-disable-next-line
module.exports = function (request, options) {
  if (!options.basedir.includes('/node_modules/') && request.startsWith('.')) {
    if (request.endsWith('.js')) {
      return options.defaultResolver(request.replace(/\.js$/, '.ts'), {...options, extensions: []})
    }

    throw new Error(`Could not resolve ${request}, .js extension is required`)
  }

  return options.defaultResolver(request, options)
}
