import { Octokit } from '@octokit/rest'

export function createOctokit(accessToken: string): Octokit {
  // Octokit 공식 문서: new Octokit({ auth: "token" })
  return new Octokit({ auth: accessToken })
}
