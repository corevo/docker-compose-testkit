import {describe, it, expect} from '@jest/globals'
import {
  getProjectName,
  extractTimestampFromName,
  extractContainerIdFromName,
  extractProjectNameFromContainer,
} from '../src/project-name.js'

describe('project-name', () => {
  it('should create a project name', () => {
    expect(getProjectName().project).toMatch(/^testkit__\w+_\w+__\d+$/)
  })

  it('should create a project name from an existing one', () => {
    const project = getProjectName()
    expect(getProjectName(project.project)).toEqual(project)
  })

  it('should extract the timestamp from the container name', () => {
    const {project} = getProjectName()
    const timestamp = extractTimestampFromName('6ac89780843c__' + project + '-db-1')

    expect(Math.floor(Date.now() / 1000)).toEqual(timestamp)
  })

  it('should extract the container id from the container name', () => {
    const {project} = getProjectName()
    const containerId = extractContainerIdFromName('6ac89780843c__' + project + '-db-1')

    expect('6ac89780843c').toEqual(containerId)
  })

  it('should extract the container id from the container name', () => {
    const {project} = getProjectName()
    const projectName = extractProjectNameFromContainer('6ac89780843c__' + project + '-db-1')

    expect(project).toEqual(projectName)
  })
})
