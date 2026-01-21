import { execFile } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import simpleGit from 'simple-git'

const execFileAsync = promisify(execFile)

export type GitFileChangeType = 'added' | 'modified' | 'deleted' | 'untracked'

export type CloneMode = 'overwrite' | 'preserve'

export interface GitFileChange {
  path: string
  type: GitFileChangeType
  additions: number
  deletions: number
  staged: boolean
}

export interface GitStatusSummary {
  modified: number
  staged: number
  untracked: number
  deleted: number
  conflicted: number
  ahead: number
  behind: number
  current: string
}

function isLikelyWindowsDriveRoot(targetPath: string): boolean {
  // Windows에서 드라이브 루트(E:\)에 바로 clone을 시도하면
  // 권한/정책/외장디스크 보호 등으로 EPERM이 자주 발생한다.
  // 또한 루트에 바로 파일이 풀리는 UX도 좋지 않으니 사전에 차단한다.
  const trimmed = targetPath.trim()
  return /^[a-zA-Z]:\\?$/.test(trimmed)
}

async function ensureCloneTargetExists(targetPath: string): Promise<void> {
  const trimmedTargetPath = targetPath.trim()

  if (isLikelyWindowsDriveRoot(trimmedTargetPath)) {
    throw new Error('드라이브 루트(예: E:\\)에는 저장할 수 없습니다. 하위 폴더를 선택해주세요.')
  }

  // 대상 폴더는 존재해야 하므로 먼저 생성해서 권한 문제를 조기에 감지한다.
  try {
    await fs.mkdir(trimmedTargetPath, { recursive: true })
  } catch (err: any) {
    const code = String(err?.code ?? '')
    if (code === 'EPERM' || code === 'EACCES') {
      throw new Error(
        `폴더를 만들 권한이 없습니다: ${trimmedTargetPath}\n` +
          '다른 위치(예: 내 문서/바탕화면)로 경로를 변경하거나, 디스크/보안 정책을 확인해주세요.'
      )
    }

    throw err
  }

  const stat = await fs.stat(trimmedTargetPath)
  if (!stat.isDirectory()) {
    throw new Error('저장 경로가 폴더가 아닙니다')
  }
}

function isCopyFileErrorSkippable(err: any): boolean {
  const code = String(err?.code ?? '')
  return code === 'EEXIST' || code === 'EISDIR'
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath)
    return true
  } catch {
    return false
  }
}

async function isDirectoryPath(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function copyDirectoryRecursive(sourceDir: string, targetDir: string, mode: CloneMode): Promise<void> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === '.git' && mode === 'preserve' && (await pathExists(targetPath))) {
        // 보존 모드에서는 기존 .git을 유지해 충돌/덮어쓰기를 막는다.
        continue
      }

      await fs.mkdir(targetPath, { recursive: true })
      await copyDirectoryRecursive(sourcePath, targetPath, mode)
      continue
    }

    if (entry.isSymbolicLink()) {
      const linkTarget = await fs.readlink(sourcePath)
      try {
        await fs.symlink(linkTarget, targetPath)
      } catch (err: any) {
        if (mode === 'preserve' && isCopyFileErrorSkippable(err)) continue
        if (mode === 'overwrite' && String(err?.code ?? '') === 'EEXIST') {
          await fs.rm(targetPath, { force: true })
          await fs.symlink(linkTarget, targetPath)
          continue
        }
        throw err
      }
      continue
    }

    try {
      if (mode === 'preserve') {
        // 보존 모드는 기존 파일이 있으면 복사를 건너뛴다.
        await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL)
      } else {
        // 덮어쓰기 모드는 대상 파일을 최신 상태로 맞춘다.
        await fs.copyFile(sourcePath, targetPath)
      }
    } catch (err: any) {
      if (mode === 'preserve' && isCopyFileErrorSkippable(err)) continue
      throw err
    }
  }
}

async function cloneRepositoryIntoTemp(repoUrl: string): Promise<string> {
  const tempBase = path.join(os.tmpdir(), 'easy-github-')
  const tempDir = await fs.mkdtemp(tempBase)

  // 임시 폴더 내부는 사용하지 않으므로 안내창 없이 진행되게 한다.
  await runGitCommand(['clone', repoUrl, tempDir])
  return tempDir
}

async function runGitCommand(args: string[], cwd?: string): Promise<void> {
  await execFileAsync('git', args, { cwd, windowsHide: true })
}

async function ensureDirectoryIsEmpty(targetPath: string): Promise<void> {
  const entries = await fs.readdir(targetPath)
  if (entries.length > 0) {
    throw new Error('저장 경로가 비어있지 않습니다. 빈 폴더를 선택해주세요.')
  }
}

async function cleanupTempDirectory(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true })
  } catch {
    // 임시 폴더 삭제 실패는 치명적이지 않으므로 무시
  }
}

export async function cloneRepository(
  repoUrl: string,
  targetPath: string,
  mode: CloneMode = 'overwrite'
): Promise<void> {
  const trimmedRepoUrl = repoUrl.trim()
  const trimmedTargetPath = targetPath.trim()

  if (!trimmedRepoUrl) throw new Error('저장소 URL을 입력해주세요')
  if (!trimmedTargetPath) throw new Error('저장할 폴더 경로를 입력해주세요')

  await ensureGitInstalledOrThrow()
  await ensureCloneTargetExists(trimmedTargetPath)

  try {
    if (mode === 'overwrite') {
      await ensureDirectoryIsEmpty(trimmedTargetPath)
      const git = simpleGit()
      await git.clone(trimmedRepoUrl, trimmedTargetPath)
      return
    }

    // 유지 모드는 임시 폴더에 clone한 뒤 필요한 파일만 복사한다.
    const tempDir = await cloneRepositoryIntoTemp(trimmedRepoUrl)

    try {
      // 유지 모드는 기존 파일을 보존하고 없는 파일만 추가한다.
      await copyDirectoryRecursive(tempDir, trimmedTargetPath, 'preserve')
    } finally {
      await cleanupTempDirectory(tempDir)
    }
  } catch (err: any) {
    // 사용자들이 자주 겪는 케이스:
    // - Git 미설치(또는 PATH 미설정): spawn git ENOENT
    // - 디스크 권한 문제/보안 정책: EPERM/EACCES
    const code = String(err?.code ?? '')
    const message = String(err?.message ?? '')

    if (code === 'ENOENT' || message.includes('spawn git') || message.toLowerCase().includes('not found')) {
      throw new Error(
        'Git이 설치되어 있지 않거나 PATH에 등록되어 있지 않습니다.\n' +
          'Git 설치 후 앱을 재시작해주세요. (https://git-scm.com/downloads)'
      )
    }

    if (code === 'EPERM' || code === 'EACCES' || message.includes('EPERM') || message.includes('EACCES')) {
      throw new Error(
        `폴더 생성/쓰기 권한 문제로 Clone에 실패했습니다: ${trimmedTargetPath}\n` +
          '다른 위치(예: 내 문서/바탕화면)로 경로를 변경하거나, 디스크 권한/보안(Controlled Folder Access)을 확인해주세요.'
      )
    }

    throw err
  }
}

export interface GitInstallationStatus {
  installed: boolean
  version?: string
  error?: string
}

export async function getGitInstallationStatus(): Promise<GitInstallationStatus> {
  // Node.js child_process 문서: execFile을 promisify 해서 stdout을 받는다.
  // Git이 없으면 ENOENT가 발생한다.
  try {
    const { stdout } = await execFileAsync('git', ['--version'], { windowsHide: true })
    const version = String(stdout ?? '').trim()
    return { installed: true, version }
  } catch (err: any) {
    const code = String(err?.code ?? '')
    const message = String(err?.message ?? '')

    if (code === 'ENOENT') {
      return { installed: false, error: 'Git executable not found (ENOENT)' }
    }

    return { installed: false, error: message || code || 'Unknown error' }
  }
}

async function ensureGitInstalledOrThrow(): Promise<void> {
  // UX: 어떤 Git 명령이든 결국 git 실행 파일이 필요하다.
  // 여기서 한 번 통일된 에러로 바꿔서, 렌더러에 스택/원시 에러가 노출되지 않게 한다.
  const status = await getGitInstallationStatus()
  if (!status.installed) {
    throw new Error(
      'Git이 설치되어 있지 않거나 PATH에 등록되어 있지 않습니다.\n' +
        'Git 설치 후 앱을 재시작해주세요. (https://git-scm.com/downloads)'
    )
  }
}

export async function fetchRepository(repoPath: string): Promise<void> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)
  await git.fetch(['--all', '--prune'])
}

export async function pullRepository(repoPath: string): Promise<any> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)
  return await git.pull()
}

export async function pushRepository(repoPath: string): Promise<any> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)
  return await git.push()
}

function mapSimpleGitStatusToType(indexStatus: string, workingStatus: string): GitFileChangeType {
  // simple-git status.files의 index/working_dir 값을 기반으로 분류
  // - '?' '?' : untracked
  // - 'A' 또는 'M' 또는 'D' 등
  if (indexStatus === '?' && workingStatus === '?') return 'untracked'

  const combined = `${indexStatus}${workingStatus}`

  if (combined.includes('D')) return 'deleted'
  if (combined.includes('A')) return 'added'

  return 'modified'
}

export async function getGitChanges(repoPath: string): Promise<GitFileChange[]> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)

  const status = await git.status()

  // diffSummary는 --stat 기반으로 insertions/deletions를 제공한다.
  // 초보자 UI에서는 "몇 줄 바뀌었는지" 정도를 보여주면 충분하다.
  const diff = await git.diffSummary()

  const statByFile = new Map<string, { insertions: number; deletions: number }>()
  for (const f of diff.files) {
    // simple-git 타입 정의상 일부 케이스(binary/namestatus)에는 insertions/deletions가 없을 수 있다.
    const insertions = typeof (f as any).insertions === 'number' ? (f as any).insertions : 0
    const deletions = typeof (f as any).deletions === 'number' ? (f as any).deletions : 0
    statByFile.set(f.file, { insertions, deletions })
  }

  // status.files에는 index/working_dir 상태가 포함된다.
  return status.files.map((f) => {
    const type = mapSimpleGitStatusToType(f.index, f.working_dir)
    const staged = f.index !== ' ' && f.index !== '?'
    const stats = statByFile.get(f.path)

    return {
      path: f.path,
      type,
      additions: stats?.insertions ?? 0,
      deletions: stats?.deletions ?? 0,
      staged
    }
  })
}

export async function stageFiles(repoPath: string, files: string[]): Promise<void> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)
  await git.add(files)
}

export async function unstageFiles(repoPath: string, files: string[]): Promise<void> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)
  // git reset -- <files>
  await git.reset(['--', ...files])
}

export interface GitAuthorOverride {
  name: string
  email: string
}

function escapeGitAuthorValue(value: string): string {
  // Git의 `--author` 값은 공백/특수문자가 있을 수 있어서 쌍따옴표로 감싸는 편이 안전하다.
  // 단, 이름에 쌍따옴표가 포함되면 CLI 인자 파싱이 깨질 수 있어 이스케이프 처리한다.
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function buildGitAuthorArg(author: GitAuthorOverride): string {
  const safeName = escapeGitAuthorValue(author.name.trim())
  const safeEmail = escapeGitAuthorValue(author.email.trim())

  // simple-git 문서 예시: { '--author': '"Name <email>"' }
  return `"${safeName} <${safeEmail}>"`
}

export async function gitCommit(repoPath: string, message: string, author?: GitAuthorOverride): Promise<any> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)

  if (author && author.name.trim() && author.email.trim()) {
    return await git.commit(message, undefined as any, {
      '--author': buildGitAuthorArg(author)
    } as any)
  }

  return await git.commit(message)
}

export async function getGitLog(repoPath: string, maxCount: number): Promise<any> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)
  return await git.log({ maxCount })
}

export async function getGitDiff(repoPath: string, filePath?: string): Promise<string> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)
  if (filePath && filePath.trim().length > 0) {
    return await git.diff(['--', filePath])
  }
  return await git.diff()
}

export interface GitBranchInfo {
  name: string
  current: boolean
  // 초보자에게는 "main/develop은 지키자" 규칙을 주는 편이 좋아서 기본 보호 처리
  protected: boolean
}

export async function listLocalBranches(repoPath: string): Promise<{ current: string; all: GitBranchInfo[] }> {
  const git = simpleGit(repoPath)
  const summary = await git.branchLocal()

  const branches = summary.all.map((name) => {
    const isProtected = name === 'main' || name === 'master' || name === 'develop'
    return {
      name,
      current: name === summary.current,
      protected: isProtected
    }
  })

  return { current: summary.current, all: branches }
}

export async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  const git = simpleGit(repoPath)
  await git.checkout(branchName)
}

export async function createBranch(repoPath: string, branchName: string, baseBranch: string): Promise<void> {
  const git = simpleGit(repoPath)

  // 초보자 UX: 생성 후 바로 해당 브랜치로 전환
  // git checkout -b <branchName> <baseBranch>
  await git.checkoutBranch(branchName, baseBranch)
}

export async function deleteBranch(repoPath: string, branchName: string): Promise<void> {
  const git = simpleGit(repoPath)
  await git.deleteLocalBranch(branchName)
}

export async function mergeBranch(repoPath: string, fromBranch: string): Promise<any> {
  const git = simpleGit(repoPath)

  try {
    return await git.merge([fromBranch])
  } catch (err: any) {
    // simple-git은 충돌 시 err.git 에 정보를 담아준다.
    if (err?.git) {
      return err.git
    }
    throw err
  }
}

export async function getOriginUrl(repoPath: string): Promise<string | null> {
  const git = simpleGit(repoPath)

  try {
    // origin이 없는 로컬 저장소도 있을 수 있다.
    const url = await git.remote(['get-url', 'origin'])
    if (typeof url !== 'string') return null
    return url.trim() || null
  } catch {
    return null
  }
}

export async function getGitStatusSummary(repoPath: string): Promise<GitStatusSummary> {
  await ensureGitInstalledOrThrow()
  const git = simpleGit(repoPath)

  const status = await git.status()
  const branchInfo = await git.branch()

  return {
    modified: status.modified.length,
    staged: status.staged.length,
    untracked: status.not_added.length,
    deleted: status.deleted.length,
    conflicted: status.conflicted.length,
    ahead: status.ahead,
    behind: status.behind,
    current: branchInfo.current
  }
}

export interface TodoTask {
  checked: boolean
  text: string
}

export interface TodoUpdateResult {
  success: boolean
  tasks: TodoTask[]
}

export interface TodoDocSummary {
  fileName: string
  filePath: string
  tasks: TodoTask[]
}

export interface UserTodoListResult {
  // git config(user.name)에서 읽어온 값(없을 수 있음)
  userName: string | null
  // 실제로 매칭에 사용한 키 목록(예: git user.name, GitHub login)
  matchKeys: string[]
  todosDirExists: boolean
  docs: TodoDocSummary[]
}

function normalizeTodoKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(' ', '')
    .replaceAll('_', '')
    .replaceAll('-', '')
}

function extractSimpleGitConfigValue(result: any): string | null {
  const raw = result?.value
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (Array.isArray(raw)) {
    const first = raw.find((v) => typeof v === 'string' && v.trim().length > 0)
    return typeof first === 'string' ? first.trim() : null
  }

  return null
}

export async function getPreferredGitUserName(repoPath: string): Promise<string | null> {
  const git = simpleGit(repoPath)

  // 우선순위: local(저장소) 설정 → global(PC 전체)
  // 일부 환경에서는 local 설정이 없고 global만 있는 경우가 많다.
  try {
    const local = await (git as any).getConfig('user.name', 'local')
    const localName = extractSimpleGitConfigValue(local)
    if (localName) return localName
  } catch {
    // getConfig(scope) 지원 여부/권한 문제 등은 무시하고 다음 단계로 진행
  }

  try {
    const global = await (git as any).getConfig('user.name', 'global')
    const globalName = extractSimpleGitConfigValue(global)
    if (globalName) return globalName
  } catch {
    // 마지막 fallback으로 scope 없는 getConfig를 시도
  }

  try {
    const anyScope = await (git as any).getConfig('user.name')
    return extractSimpleGitConfigValue(anyScope)
  } catch {
    return null
  }
}

function extractTodoTasksFromText(text: string): TodoTask[] {
  // Markdown task list 패턴을 단순 파싱한다.
  // 예) - [ ] 할 일, - [x] 완료한 일
  // 완료 표시는 " + 완료"로 끝나면 제거한다.
  const lines = text.split(/\r?\n/)
  const tasks: TodoTask[] = []

  for (const line of lines) {
    const match = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/)
    if (!match) continue

    const checked = match[1].toLowerCase() === 'x'
    const taskText = (match[2] ?? '').replace(/\s*\+\s*완료\s*$/, '').trim()
    if (!taskText) continue

    tasks.push({ checked, text: taskText })
  }

  return tasks
}

function updateTodoLine(line: string, checked: boolean): string {
  const prefixMatch = line.match(/^(\s*[-*]\s+\[)([ xX])(\]\s+.*)$/)
  if (!prefixMatch) return line

  // 완료 토글 시 체크 표시와 " + 완료" 라벨을 동시에 정리한다.
  const marker = checked ? 'x' : ' '
  const statusLabel = checked ? ' + 완료' : ''
  const baseText = prefixMatch[3].replace(/\s*\+\s*완료\s*$/, '')
  return `${prefixMatch[1]}${marker}${baseText}${statusLabel}`
}

export async function updateTodoTaskInFile(
  filePath: string,
  taskIndex: number,
  checked: boolean
): Promise<TodoUpdateResult> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split(/\r?\n/)
  const taskLineIndexes: number[] = []

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*[-*]\s+\[[ xX]\]\s+.*$/.test(lines[index])) {
      taskLineIndexes.push(index)
    }
  }

  if (taskIndex < 0 || taskIndex >= taskLineIndexes.length) {
    return { success: false, tasks: extractTodoTasksFromText(content) }
  }

  const lineIndex = taskLineIndexes[taskIndex]
  lines[lineIndex] = updateTodoLine(lines[lineIndex], checked)

  const nextContent = lines.join('\n')
  await fs.writeFile(filePath, nextContent, 'utf-8')
  return { success: true, tasks: extractTodoTasksFromText(nextContent) }
}

export async function listUserTodos(repoPath: string, fallbackUserNames: string[] = []): Promise<UserTodoListResult> {
  // TODO 목록도 git config(user.name)에 의존하므로 Git 미설치를 먼저 안내한다.
  await ensureGitInstalledOrThrow()

  if (!(await isDirectoryPath(repoPath))) {
    return { userName: null, matchKeys: [], todosDirExists: false, docs: [] }
  }

  const userName = await getPreferredGitUserName(repoPath)
  const todosDir = path.join(repoPath, 'todos')

  try {
    const stat = await fs.stat(todosDir)
    if (!stat.isDirectory()) {
      return { userName, matchKeys: [], todosDirExists: false, docs: [] }
    }
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return { userName, matchKeys: [], todosDirExists: false, docs: [] }
    }
    throw err
  }

  // 매칭 우선순위:
  // 1) 저장소/PC의 Git 설정 user.name
  // 2) GitHub 로그인 아이디(login)
  // 둘 중 하나가 안 맞으면 다른 쪽도 탐색한다.
  const rawKeys = [userName ?? '', ...fallbackUserNames]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0)

  const keyByNormalized = new Map<string, string>()
  for (const key of rawKeys) {
    const normalized = normalizeTodoKey(key)
    if (!normalized) continue
    if (!keyByNormalized.has(normalized)) {
      keyByNormalized.set(normalized, key)
    }
  }

  const matchKeys = Array.from(keyByNormalized.values())
  if (matchKeys.length === 0) {
    // 둘 다 알 수 없는 경우(예: git 설정 없음 + GitHub 로그인 안 함)
    return { userName: userName ?? null, matchKeys: [], todosDirExists: true, docs: [] }
  }

  const entries = await fs.readdir(todosDir, { withFileTypes: true })
  const candidates = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => {
      const ext = path.extname(name).toLowerCase()
      return ext === '.md' || ext === '.markdown' || ext === '.txt'
    })
    .filter((name) => {
      const base = path.parse(name).name
      const normalizedBase = normalizeTodoKey(base)
      return keyByNormalized.has(normalizedBase)
    })

  const docs: TodoDocSummary[] = []
  const maxBytes = 1_000_000

  for (const fileName of candidates) {
    const filePath = path.join(todosDir, fileName)

    try {
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) continue

      // 너무 큰 파일은 UI/성능상 부담이라 스킵한다.
      if (stat.size > maxBytes) {
        docs.push({ fileName, filePath, tasks: [] })
        continue
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const tasks = extractTodoTasksFromText(content)
      docs.push({ fileName, filePath, tasks })
    } catch {
      // 일부 파일이 읽기 실패해도 전체 UX를 깨지 않도록 무시
    }
  }

  return { userName, matchKeys, todosDirExists: true, docs }
}
