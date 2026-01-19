import Store from 'electron-store'

export interface LearningProgress {
  completedTopics: string[]
  practicedCommands: string[]
  completedPracticeSteps: string[]
  lastActiveTab: string
  totalLearningMinutes: number
}

const defaultProgress: LearningProgress = {
  completedTopics: [],
  practicedCommands: [],
  completedPracticeSteps: [],
  lastActiveTab: 'learn',
  totalLearningMinutes: 0
}

const store = new Store({
  name: 'learning',
  schema: {
    progress: {
      type: 'object',
      properties: {
        completedTopics: { type: 'array', items: { type: 'string' } },
        practicedCommands: { type: 'array', items: { type: 'string' } },
        completedPracticeSteps: { type: 'array', items: { type: 'string' } },
        lastActiveTab: { type: 'string' },
        totalLearningMinutes: { type: 'number' }
      }
    },
    guideCompleted: { type: 'boolean' }
  }
})

export function getLearningProgress(): LearningProgress {
  return (store.get('progress') as LearningProgress) ?? defaultProgress
}

export function updateLearningProgress(partial: Partial<LearningProgress>): LearningProgress {
  // 기존 진행도에 변경된 값만 덮어써서 안전하게 업데이트
  const current = getLearningProgress()
  const next = { ...current, ...partial }
  store.set('progress', next)
  return next
}

export function getGuideCompleted(): boolean {
  return Boolean(store.get('guideCompleted', false))
}

export function setGuideCompleted(completed: boolean): void {
  store.set('guideCompleted', completed)
}
