import faker from 'faker'

export function getProjectName(projectName?: string, minutesBackward = 0) {
  if (projectName) {
    const name = projectName.split('__')[1]

    return {
      displayName: name.replace('_', ' '),
      project: projectName,
    }
  }

  const adjective = 'adjective'
  const noun = faker.animal.type()

  return {
    displayName: `${adjective} ${noun}`,
    project: `testkit__${adjective}_${noun}__${
      Math.floor(Date.now() / 1000) - 60 * minutesBackward
    }`,
  }
}

export function extractTimestampFromName(containerName: string) {
  return parseInt(containerName.split('__')[3].split('-')[0])
}

export function extractContainerIdFromName(containerName: string) {
  return containerName.split('__')[0]
}

export function extractProjectNameFromContainer(containerName: string) {
  const [_, ...fragments] = containerName.split('__')
  return fragments.join('__').split('-')[0]
}
