import { createOctokit } from './githubClient'
import { loadAccessToken } from './tokenStore'

function requireToken(): string {
  const token = loadAccessToken()
  if (!token) {
    throw new Error('로그인이 필요합니다')
  }
  return token
}

export async function listPullRequests(owner: string, repo: string) {
  const token = requireToken()
  const octokit = createOctokit(token)

  // 초보자 UX: open/closed/merged를 모두 보여줄 수 있도록 all로 가져온다.
  // Octokit 문서: paginate 사용
  return await octokit.paginate('GET /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    state: 'all',
    per_page: 100
  })
}

export async function reviewPullRequest(params: {
  owner: string
  repo: string
  pullNumber: number
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  body?: string
}) {
  const token = requireToken()
  const octokit = createOctokit(token)

  return await octokit.rest.pulls.createReview({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    event: params.event,
    body: params.body
  })
}

export async function createPullRequest(params: {
  owner: string
  repo: string
  title: string
  body: string
  head: string
  base: string
}) {
  const token = requireToken()
  const octokit = createOctokit(token)

  return await octokit.rest.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base
  })
}

export async function mergePullRequest(params: { owner: string; repo: string; pullNumber: number }) {
  const token = requireToken()
  const octokit = createOctokit(token)

  return await octokit.rest.pulls.merge({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber
  })
}

export async function listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all') {
  const token = requireToken()
  const octokit = createOctokit(token)

  const issues = await octokit.paginate('GET /repos/{owner}/{repo}/issues', {
    owner,
    repo,
    state,
    per_page: 100
  })

  // GitHub API는 PR도 Issue로 반환하므로 필터링
  return issues.filter((i: any) => !i.pull_request)
}

export async function listUserRepositories() {
  const token = requireToken()
  const octokit = createOctokit(token)

  return await octokit.paginate('GET /user/repos', {
    per_page: 100,
    sort: 'updated'
  })
}

export async function createRepository(params: { name: string; description: string; isPrivate: boolean }) {
  const token = requireToken()
  const octokit = createOctokit(token)

  return await octokit.rest.repos.createForAuthenticatedUser({
    name: params.name,
    description: params.description,
    private: params.isPrivate
  })
}

export async function createIssue(params: { owner: string; repo: string; title: string; body: string }) {
  const token = requireToken()
  const octokit = createOctokit(token)

  return await octokit.rest.issues.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body
  })
}

export async function closeIssue(params: { owner: string; repo: string; issueNumber: number }) {
  const token = requireToken()
  const octokit = createOctokit(token)

  return await octokit.rest.issues.update({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    state: 'closed'
  })
}

export async function commentIssue(params: { owner: string; repo: string; issueNumber: number; body: string }) {
  const token = requireToken()
  const octokit = createOctokit(token)

  return await octokit.rest.issues.createComment({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    body: params.body
  })
}
