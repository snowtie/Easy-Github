import fs from 'node:fs/promises'
import path from 'node:path'

import simpleGit from 'simple-git'

export type GitFileChangeType = 'added' | 'modified' | 'deleted' | 'untracked'

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

async function ensureCloneTargetIsEmpty(targetPath: string): Promise<void> {
  try {
    const stat = await fs.stat(targetPath)
    if (!stat.isDirectory()) {
      throw new Error('저장 경로가 폴더가 아닙니다')
    }

    const entries = await fs.readdir(targetPath)
    if (entries.length > 0) {
      throw new Error('저장 경로가 비어있지 않습니다. 빈 폴더를 선택해주세요.')
    }
  } catch (err: any) {
    // 폴더가 없으면 OK(클론 과정에서 생성됨)
    if (err?.code === 'ENOENT') return
    throw err
  }
}

export async function cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
  if (!repoUrl.trim()) throw new Error('저장소 URL을 입력해주세요')
  if (!targetPath.trim()) throw new Error('저장할 폴더 경로를 입력해주세요')

  // 초보자 실수 방지: 이미 파일이 있는 폴더에 clone하면 섞여버릴 수 있음
  await ensureCloneTargetIsEmpty(targetPath)

  const parentDir = path.dirname(targetPath)
  await fs.mkdir(parentDir, { recursive: true })

  // simple-git은 내부적으로 git CLI를 호출한다.
  // 즉, 사용자의 PC에 Git이 설치되어 있어야 정상 동작한다.
  const git = simpleGit()
  await git.clone(repoUrl, targetPath)
}

export async function fetchRepository(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath)
  await git.fetch(['--all', '--prune'])
}

export async function pullRepository(repoPath: string): Promise<any> {
  const git = simpleGit(repoPath)
  return await git.pull()
}

export async function pushRepository(repoPath: string): Promise<any> {
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
  const git = simpleGit(repoPath)

  const status = await git.status()

  // diffSummary는 --stat 기반으로 insertions/deletions를 제공한다.
  // 초보자 UI에서는 "몇 줄 바뀌었는지" 정도를 보여주면 충분하다.
  const diff = await git.diffSummary()

  const statByFile = new Map<string, { insertions: number; deletions: number }>()
  for (const f of diff.files) {
    statByFile.set(f.file, { insertions: f.insertions, deletions: f.deletions })
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
  const git = simpleGit(repoPath)
  await git.add(files)
}

export async function unstageFiles(repoPath: string, files: string[]): Promise<void> {
  const git = simpleGit(repoPath)
  // git reset -- <files>
  await git.reset(['--', ...files])
}

export async function gitCommit(repoPath: string, message: string): Promise<any> {
  const git = simpleGit(repoPath)
  return await git.commit(message)
}

export async function getGitLog(repoPath: string, maxCount: number): Promise<any> {
  const git = simpleGit(repoPath)
  return await git.log({ maxCount })
}

export async function getGitDiff(repoPath: string, filePath?: string): Promise<string> {
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
    return url.trim() || null
  } catch {
    return null
  }
}

export async function getGitStatusSummary(repoPath: string): Promise<GitStatusSummary> {
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
