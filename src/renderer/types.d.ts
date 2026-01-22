export {}

declare global {
  interface Window {
    easyGithub: {
      app: {
        ping: () => Promise<string>
        openExternal: (url: string) => Promise<void>
        selectDirectory: (defaultPath?: string) => Promise<string | null>

        getAppVersion: () => Promise<string>

        checkForUpdates: () => Promise<{ status: 'disabled' | 'started' }>
        downloadUpdate: () => Promise<{ status: 'disabled' | 'started' }>
        installUpdate: () => Promise<{ status: 'disabled' | 'started' }>

        onUpdateEvent: (listener: (payload: any) => void) => () => void
      }
      auth: {
        setToken: (token: string) => Promise<any>
        logout: () => Promise<void>
        getUser: () => Promise<any | null>
        getTokenStatus: () => Promise<{ authenticated: boolean }>
      }
      github: {
        getMyProfile: () => Promise<any>

        listPullRequests: (owner: string, repo: string) => Promise<any>
        reviewPullRequest: (
          owner: string,
          repo: string,
          pullNumber: number,
          event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
          body?: string
        ) => Promise<any>
        mergePullRequest: (owner: string, repo: string, pullNumber: number) => Promise<any>
        createPullRequest: (owner: string, repo: string, title: string, body: string, head: string, base: string) => Promise<any>

        listIssues: (owner: string, repo: string, state: 'open' | 'closed' | 'all') => Promise<any>
        createIssue: (owner: string, repo: string, title: string, body: string) => Promise<any>
        closeIssue: (owner: string, repo: string, issueNumber: number) => Promise<any>
        commentIssue: (owner: string, repo: string, issueNumber: number, body: string) => Promise<any>
        listRepositories: () => Promise<any>
        createRepository: (name: string, description: string, isPrivate: boolean) => Promise<any>
      }
      git: {
        clone: (repoUrl: string, targetPath: string, mode?: 'overwrite' | 'preserve') => Promise<void>
        status: (repoPath: string) => Promise<any>
        fetch: (repoPath: string) => Promise<void>
        pull: (repoPath: string) => Promise<any>
        push: (repoPath: string) => Promise<any>

        changes: (repoPath: string) => Promise<any>
        stage: (repoPath: string, files: string[]) => Promise<void>
        unstage: (repoPath: string, files: string[]) => Promise<void>
        commit: (repoPath: string, message: string, author?: { name: string; email: string }) => Promise<any>
        log: (repoPath: string, maxCount: number) => Promise<any>
        diff: (repoPath: string, filePath?: string) => Promise<string>

        branches: (repoPath: string) => Promise<any>
        checkoutBranch: (repoPath: string, branchName: string) => Promise<void>
        createBranch: (repoPath: string, branchName: string, baseBranch: string) => Promise<void>
        deleteBranch: (repoPath: string, branchName: string) => Promise<void>
        merge: (repoPath: string, fromBranch: string) => Promise<any>
        originUrl: (repoPath: string) => Promise<string | null>
        checkInstalled: () => Promise<{ installed: boolean; version?: string; error?: string }>
      }
      todos: {
        list: (repoPath: string) => Promise<{
          userName: string | null
          matchKeys: string[]
          todosDirExists: boolean
          docs: { fileName: string; filePath: string; tasks: { checked: boolean; text: string }[] }[]
        }>
        update: (repoPath: string, filePath: string, taskIndex: number, checked: boolean) => Promise<{
          success: boolean
          tasks: { checked: boolean; text: string }[]
        }>
        add: (repoPath: string, filePath: string, text: string) => Promise<{
          success: boolean
          tasks: { checked: boolean; text: string }[]
        }>
      }
      store: {
        getLearningProgress: () => Promise<any>
        updateLearningProgress: (partial: any) => Promise<any>
        getGuideCompleted: () => Promise<boolean>
        setGuideCompleted: (completed: boolean) => Promise<void>
        getProjects: () => Promise<any>
        saveProjects: (projects: any[]) => Promise<void>
      }
    }
  }
}
