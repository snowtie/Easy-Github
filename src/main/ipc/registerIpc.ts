import { BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { IPC_CHANNELS } from '@/shared/ipc-channels'
import { validateIpcSender } from '../security/validateSender'
import { AuthService } from '../services/authService'
import { loadAccessToken } from '../services/tokenStore'
import { checkForUpdatesManually, downloadUpdateManually, getAppVersion, installUpdateManually } from '../services/autoUpdate'
import { createOctokit } from '../services/githubClient'
import {
  closeIssue,
  commentIssue,
  createIssue,
  createPullRequest,
  createRepository,
  listIssues,
  listPullRequests,
  listUserRepositories,
  mergePullRequest,
  reviewPullRequest
} from '../services/githubService'
import { getGuideCompleted, getLearningProgress, setGuideCompleted, updateLearningProgress } from '../services/learningStore'
import { getProjects, saveProjects } from '../services/projectStore'
import {
  cloneRepository,
  fetchRepository,
  getGitChanges,
  getGitDiff,
  getGitInstallationStatus,
  getGitLog,
  getGitStatusSummary,
  gitCommit,
  pullRepository,
  pushRepository,
  stageFiles,
  unstageFiles,
  listLocalBranches,
  checkoutBranch,
  createBranch,
  deleteBranch,
  mergeBranch,
  getOriginUrl,
  listUserTodos,
  updateTodoTaskInFile
} from '../services/gitService'

export function registerIpcHandlers() {
  const authService = new AuthService()

  ipcMain.handle(IPC_CHANNELS.APP.PING, (event) => {
    if (!validateIpcSender(event)) return 'blocked'
    return 'pong'
  })

  ipcMain.handle(IPC_CHANNELS.APP.OPEN_EXTERNAL, async (event, url: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    // Electron 보안 가이드: shell.openExternal에 untrusted input을 그대로 넣지 않는다.
    // 여기서는 URL 파싱 + 프로토콜 + 호스트 allowlist로 2차 방어를 한다.
    const parsed = new URL(url)

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('지원하지 않는 링크 형식입니다')
    }

    // GitHub 관련 링크만 열 수 있도록 제한한다.
    // (렌더러가 오염되었을 때 임의 사이트로 유도되는 것을 막기 위함)
    const allowedHosts = new Set([
      'github.com',
      'www.github.com',
      'docs.github.com',
      'gist.github.com',
      'raw.githubusercontent.com',
      'avatars.githubusercontent.com',
      'user-images.githubusercontent.com'
    ])

    const host = parsed.hostname
    const isAllowed = allowedHosts.has(host) || host.endsWith('.github.com') || host.endsWith('.githubusercontent.com')
    if (!isAllowed) {
      throw new Error('보안상 허용되지 않는 링크입니다')
    }

    const { shell } = await import('electron')
    await shell.openExternal(parsed.toString())
  })

  ipcMain.handle(IPC_CHANNELS.APP.SELECT_DIRECTORY, async (event, defaultPath?: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    const { dialog } = await import('electron')

    // 보안/UX:
    // - Renderer가 파일 시스템에 직접 접근하지 않도록 main process에서만 네이티브 다이얼로그를 띄운다.
    // - Git Clone 대상은 "폴더"가 자연스러우므로 openDirectory만 허용한다.
    const result = await dialog.showOpenDialog({
      title: '폴더 선택',
      defaultPath: typeof defaultPath === 'string' && defaultPath.trim().length > 0 ? defaultPath : undefined,
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(IPC_CHANNELS.APP.CHECK_FOR_UPDATES, async (event) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    // UX: 버튼 클릭 시 즉시 실행되도록 현재 포커스 창을 부모로 사용한다.
    const focused = BrowserWindow.getFocusedWindow()
    return await checkForUpdatesManually(focused ?? null)
  })

  ipcMain.handle(IPC_CHANNELS.APP.DOWNLOAD_UPDATE, async (event) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    const focused = BrowserWindow.getFocusedWindow()
    return await downloadUpdateManually(focused ?? null)
  })

  ipcMain.handle(IPC_CHANNELS.APP.INSTALL_UPDATE, (event) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    return installUpdateManually()
  })

  ipcMain.handle(IPC_CHANNELS.APP.GET_APP_VERSION, (event) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    return getAppVersion()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH.SET_TOKEN, async (event, token: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    // 렌더러에서 입력한 토큰(PAT)을 main process에서만 안전하게 저장한다.
    return await authService.setToken(token)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH.LOGOUT, async (event) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    await authService.logout()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH.GET_TOKEN_STATUS, (event) => {
    if (!validateIpcSender(event)) return { authenticated: false }
    return authService.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH.GET_USER, async (event) => {
    if (!validateIpcSender(event)) return null
    return await authService.getUser()
  })

  ipcMain.handle(IPC_CHANNELS.GITHUB.GET_MY_PROFILE, async (event) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    const token = loadAccessToken()
    if (!token) throw new Error('로그인이 필요합니다')

    const octokit = createOctokit(token)
    const { data } = await octokit.request('/user')
    return data
  })

  ipcMain.handle(IPC_CHANNELS.GITHUB.LIST_PULLS, async (event, owner: string, repo: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await listPullRequests(owner, repo)
  })

  ipcMain.handle(
    IPC_CHANNELS.GITHUB.REVIEW_PULL,
    async (
      event,
      owner: string,
      repo: string,
      pullNumber: number,
      reviewEvent: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
      body?: string
    ) => {
      if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
      return await reviewPullRequest({ owner, repo, pullNumber, event: reviewEvent, body })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GITHUB.CREATE_PULL,
    async (event, owner: string, repo: string, title: string, body: string, head: string, base: string) => {
      if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
      return await createPullRequest({ owner, repo, title, body, head, base })
    }
  )

  ipcMain.handle(IPC_CHANNELS.GITHUB.MERGE_PULL, async (event, owner: string, repo: string, pullNumber: number) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await mergePullRequest({ owner, repo, pullNumber })
  })

  ipcMain.handle(IPC_CHANNELS.GITHUB.LIST_ISSUES, async (event, owner: string, repo: string, state: 'open' | 'closed' | 'all') => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await listIssues(owner, repo, state)
  })

  ipcMain.handle(IPC_CHANNELS.GITHUB.CREATE_ISSUE, async (event, owner: string, repo: string, title: string, body: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await createIssue({ owner, repo, title, body })
  })

  ipcMain.handle(IPC_CHANNELS.GITHUB.CLOSE_ISSUE, async (event, owner: string, repo: string, issueNumber: number) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await closeIssue({ owner, repo, issueNumber })
  })

  ipcMain.handle(
    IPC_CHANNELS.GITHUB.COMMENT_ISSUE,
    async (event, owner: string, repo: string, issueNumber: number, body: string) => {
      if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
      return await commentIssue({ owner, repo, issueNumber, body })
    }
  )

  ipcMain.handle(IPC_CHANNELS.GITHUB.LIST_REPOS, async (event) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await listUserRepositories()
  })

  ipcMain.handle(
    IPC_CHANNELS.GITHUB.CREATE_REPO,
    async (event, name: string, description: string, isPrivate: boolean) => {
      if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
      return await createRepository({ name, description, isPrivate })
    }
  )

  ipcMain.handle(IPC_CHANNELS.STORE.GET_LEARNING_PROGRESS, (event) => {
    if (!validateIpcSender(event)) return null
    return getLearningProgress()
  })

  ipcMain.handle(IPC_CHANNELS.STORE.UPDATE_LEARNING_PROGRESS, (event, partial: any) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return updateLearningProgress(partial)
  })

  ipcMain.handle(IPC_CHANNELS.STORE.GET_GUIDE_COMPLETED, (event) => {
    if (!validateIpcSender(event)) return false
    return getGuideCompleted()
  })

  ipcMain.handle(IPC_CHANNELS.STORE.SET_GUIDE_COMPLETED, (event, completed: boolean) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    setGuideCompleted(completed)
  })

  ipcMain.handle(IPC_CHANNELS.STORE.GET_PROJECTS, (event) => {
    if (!validateIpcSender(event)) return []
    return getProjects()
  })

  ipcMain.handle(IPC_CHANNELS.STORE.SAVE_PROJECTS, (event, projects: any[]) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    saveProjects(projects)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.CLONE, async (event, repoUrl: string, targetPath: string, mode?: 'overwrite' | 'preserve') => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    await cloneRepository(repoUrl, targetPath, mode ?? 'overwrite')
  })

  ipcMain.handle(IPC_CHANNELS.GIT.STATUS, async (event, repoPath: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await getGitStatusSummary(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.FETCH, async (event, repoPath: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    await fetchRepository(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.PULL, async (event, repoPath: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await pullRepository(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.PUSH, async (event, repoPath: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await pushRepository(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.CHANGES, async (event, repoPath: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await getGitChanges(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.STAGE, async (event, repoPath: string, files: string[]) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    await stageFiles(repoPath, files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.UNSTAGE, async (event, repoPath: string, files: string[]) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    await unstageFiles(repoPath, files)
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT.COMMIT,
    async (event, repoPath: string, message: string, author?: { name: string; email: string }) => {
      if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
      return await gitCommit(repoPath, message, author)
    }
  )

  ipcMain.handle(IPC_CHANNELS.GIT.LOG, async (event, repoPath: string, maxCount: number) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await getGitLog(repoPath, maxCount)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.DIFF, async (event, repoPath: string, filePath?: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await getGitDiff(repoPath, filePath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.BRANCH_LIST, async (event, repoPath: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await listLocalBranches(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.BRANCH_CHECKOUT, async (event, repoPath: string, branchName: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    await checkoutBranch(repoPath, branchName)
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT.BRANCH_CREATE,
    async (event, repoPath: string, branchName: string, baseBranch: string) => {
      if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
      await createBranch(repoPath, branchName, baseBranch)
    }
  )

  ipcMain.handle(IPC_CHANNELS.GIT.BRANCH_DELETE, async (event, repoPath: string, branchName: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    await deleteBranch(repoPath, branchName)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.MERGE, async (event, repoPath: string, fromBranch: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await mergeBranch(repoPath, fromBranch)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.ORIGIN_URL, async (event, repoPath: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await getOriginUrl(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT.CHECK_INSTALLED, async (event) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')
    return await getGitInstallationStatus()
  })

  ipcMain.handle(IPC_CHANNELS.TODOS.LIST, async (event, repoPath: string) => {
    if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

    let githubLogin: string | null = null
    try {
      const user = await authService.getUser()
      githubLogin = typeof user?.login === 'string' ? user.login : null
    } catch {
      githubLogin = null
    }

    const fallbacks = githubLogin ? [githubLogin] : []
    return await listUserTodos(repoPath, fallbacks)
  })

  ipcMain.handle(
    IPC_CHANNELS.TODOS.UPDATE,
    async (event, repoPath: string, filePath: string, taskIndex: number, checked: boolean) => {
      if (!validateIpcSender(event)) throw new Error('IPC sender not allowed')

      // 보안: repoPath/todos 내부 파일만 수정하도록 제한한다.
      const resolvedTodosDir = path.join(repoPath, 'todos')
      const resolvedFilePath = path.resolve(filePath)
      const normalizedTodosDir = path.resolve(resolvedTodosDir)

      if (!resolvedFilePath.startsWith(normalizedTodosDir + path.sep)) {
        throw new Error('TODO 파일 경로가 올바르지 않습니다')
      }

      return await updateTodoTaskInFile(resolvedFilePath, taskIndex, checked)
    }
  )
}
