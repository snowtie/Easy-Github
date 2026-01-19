import Store from 'electron-store'

export interface StoredProject {
  id: string
  name: string
  path: string
  currentBranch: string
  lastCommit: string
  uncommittedChanges: number
  ahead: number
  behind: number
  stars: number
  collaborators: number
  url: string
}

const store = new Store({
  name: 'projects',
  schema: {
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          path: { type: 'string' },
          currentBranch: { type: 'string' },
          lastCommit: { type: 'string' },
          uncommittedChanges: { type: 'number' },
          ahead: { type: 'number' },
          behind: { type: 'number' },
          stars: { type: 'number' },
          collaborators: { type: 'number' },
          url: { type: 'string' }
        }
      }
    }
  }
})

export function getProjects(): StoredProject[] {
  return (store.get('projects') as StoredProject[]) ?? []
}

export function saveProjects(projects: StoredProject[]): void {
  // 기존 목록 전체를 덮어써서 동기화
  store.set('projects', projects)
}
