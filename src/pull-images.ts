import yaml from 'js-yaml'
import {execa, execaCommand} from 'execa'

export async function pullImagesFromComposeFile({
  pathToCompose,
  servicesToStart = [],
  env,
}: {
  pathToCompose: string
  servicesToStart: string[]
  env: Record<string, string>
}) {
  const composeFileContent = (await execaCommand(`envsubst < ${pathToCompose}`, {env, shell: true}))
    .stdout
  const {services} = yaml.load(composeFileContent) as any

  const images = Array.from(
    new Set(
      Object.keys(services)
        .map((service) => {
          if (servicesToStart.length) {
            if (!servicesToStart.includes(service)) {
              return null
            }
          }
          return services[service].image || null
        })
        .filter((image) => image !== null),
    ),
  )

  const results = await Promise.allSettled(images.map((image) => pullImageByName(image)))

  return results.filter((p) => p.status === 'fulfilled').map((p) => (p as any).value)
}

export async function pullImageByName(name: string) {
  await execa('docker', ['pull', name])

  return name
}
