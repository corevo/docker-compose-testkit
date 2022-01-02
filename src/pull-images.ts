import fs from 'fs/promises'
import yaml from 'js-yaml'
import {execa} from 'execa'

export async function pullImagesFromComposeFile(
  pathToCompose: string,
  servicesToStart: string[] = [],
) {
  const composeFileContent = await fs.readFile(pathToCompose, 'utf8')
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

  await Promise.all(images.map((image) => pullImageByName(image)))
}

export async function pullImageByName(name: string) {
  await execa('docker', ['pull', name])
}
