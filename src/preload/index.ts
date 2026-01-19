import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@/shared/ipc-channels'

// 보안: ipcRenderer 전체를 노출하지 않고, 필요한 기능만 래핑해서 제공
contextBridge.exposeInMainWorld('easyGithub', {
  app: {
    ping: () => ipcRenderer.invoke(IPC_CHANNELS.APP.PING),
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.APP.OPEN_EXTERNAL, url)
  },
  auth: {
    // 토큰(PAT) 로그인
    setToken: (token: string) => ipcRenderer.invoke(IPC_CHANNELS.AUTH.SET_TOKEN, token),

    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH.LOGOUT),
    getUser: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH.GET_USER),
    getTokenStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH.GET_TOKEN_STATUS)
  },
  github: {
    getMyProfile: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_MY_PROFILE),

    listPullRequests: (owner: string, repo: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GITHUB.LIST_PULLS, owner, repo),
    reviewPullRequest: (
      owner: string,
      repo: string,
      pullNumber: number,
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
      body?: string
    ) => ipcRenderer.invoke(IPC_CHANNELS.GITHUB.REVIEW_PULL, owner, repo, pullNumber, event, body),
    mergePullRequest: (owner: string, repo: string, pullNumber: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.GITHUB.MERGE_PULL, owner, repo, pullNumber),
    createPullRequest: (owner: string, repo: string, title: string, body: string, head: string, base: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CREATE_PULL, owner, repo, title, body, head, base),

    listIssues: (owner: string, repo: string, state: 'open' | 'closed' | 'all') =>
      ipcRenderer.invoke(IPC_CHANNELS.GITHUB.LIST_ISSUES, owner, repo, state),
    createIssue: (owner: string, repo: string, title: string, body: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CREATE_ISSUE, owner, repo, title, body),
    closeIssue: (owner: string, repo: string, issueNumber: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CLOSE_ISSUE, owner, repo, issueNumber),
    commentIssue: (owner: string, repo: string, issueNumber: number, body: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GITHUB.COMMENT_ISSUE, owner, repo, issueNumber, body),
    listRepositories: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB.LIST_REPOS),
    createRepository: (name: string, description: string, isPrivate: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CREATE_REPO, name, description, isPrivate)
  },
  git: {
    clone: (repoUrl: string, targetPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.CLONE, repoUrl, targetPath),
    status: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.STATUS, repoPath),
    fetch: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.FETCH, repoPath),
    pull: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.PULL, repoPath),
    push: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.PUSH, repoPath),

    changes: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.CHANGES, repoPath),
    stage: (repoPath: string, files: string[]) => ipcRenderer.invoke(IPC_CHANNELS.GIT.STAGE, repoPath, files),
    unstage: (repoPath: string, files: string[]) => ipcRenderer.invoke(IPC_CHANNELS.GIT.UNSTAGE, repoPath, files),
    commit: (repoPath: string, message: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.COMMIT, repoPath, message),
    log: (repoPath: string, maxCount: number) => ipcRenderer.invoke(IPC_CHANNELS.GIT.LOG, repoPath, maxCount),
    diff: (repoPath: string, filePath?: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.DIFF, repoPath, filePath),

    branches: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.BRANCH_LIST, repoPath),
    checkoutBranch: (repoPath: string, branchName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.BRANCH_CHECKOUT, repoPath, branchName),
    createBranch: (repoPath: string, branchName: string, baseBranch: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.BRANCH_CREATE, repoPath, branchName, baseBranch),
    deleteBranch: (repoPath: string, branchName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.BRANCH_DELETE, repoPath, branchName),
    merge: (repoPath: string, fromBranch: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.MERGE, repoPath, fromBranch),

    originUrl: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.ORIGIN_URL, repoPath)
  },
  store: {
    getLearningProgress: () => ipcRenderer.invoke(IPC_CHANNELS.STORE.GET_LEARNING_PROGRESS),
    updateLearningProgress: (partial: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.STORE.UPDATE_LEARNING_PROGRESS, partial),
    getGuideCompleted: () => ipcRenderer.invoke(IPC_CHANNELS.STORE.GET_GUIDE_COMPLETED),
    setGuideCompleted: (completed: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.STORE.SET_GUIDE_COMPLETED, completed),
    getProjects: () => ipcRenderer.invoke(IPC_CHANNELS.STORE.GET_PROJECTS),
    saveProjects: (projects: any[]) => ipcRenderer.invoke(IPC_CHANNELS.STORE.SAVE_PROJECTS, projects)
  }
})
