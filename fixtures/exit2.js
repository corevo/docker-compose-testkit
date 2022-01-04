const [_, __, code, message] = process.argv

if (code != 0) {
  console.error(message)
  process.exit(code)
}

console.log(message)
