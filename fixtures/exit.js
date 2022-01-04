console.log('exit code is set to: ' + process.env.EXIT_CODE)
console.log('stdout')
console.error('stderr')
process.exit(parseInt(process.env.EXIT_CODE))
