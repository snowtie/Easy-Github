import { canPersistAccessToken, clearAccessToken, loadAccessToken, saveAccessToken } from './tokenStore'
import { createOctokit } from './githubClient'

export interface AuthStatus {
  authenticated: boolean
}

export class AuthService {
  getStatus(): AuthStatus {
    return { authenticated: loadAccessToken() !== null }
  }

  async logout(): Promise<void> {
    clearAccessToken()
  }

  async getUser(): Promise<any | null> {
    const token = loadAccessToken()
    if (!token) return null

    const octokit = createOctokit(token)
    const { data } = await octokit.request('/user')
    return data
  }

  async setToken(token: string): Promise<any> {
    // 보안/UX: 토큰은 절대 로그로 남기지 않는다.
    // 사용자가 실수로 앞뒤 공백을 포함해 붙여넣는 경우가 많아서 trim 처리한다.
    const trimmed = token.trim()
    if (!trimmed) {
      throw new Error('토큰이 비어있습니다. GitHub Personal Access Token을 입력해주세요.')
    }

    // 안전한 저장이 불가능한 환경에서는 애초에 로그인 성공으로 처리하지 않는다.
    // (저장 실패인데도 UI에서 "로그인 완료"로 보이면 사용자가 혼란을 겪는다.)
    if (!canPersistAccessToken()) {
      throw new Error('현재 PC에서 토큰을 안전하게 저장할 수 없습니다. OS 암호화 저장소 사용 가능 여부를 확인해주세요.')
    }

    // 토큰 검증: 저장 전에 /user 호출로 유효성 확인
    // (GitHub API는 인증 실패 시 401을 반환한다)
    const octokit = createOctokit(trimmed)

    try {
      const { data } = await octokit.request('/user')

      // 검증이 끝난 뒤에만 저장한다.
      saveAccessToken(trimmed)

      return data
    } catch (err: any) {
      // 여기서 err를 그대로 노출하면 내부 정보가 섞일 수 있어, 사용자용 메시지로 변환한다.
      const status = err?.status
      if (status === 401) {
        throw new Error('토큰 인증에 실패했습니다. 토큰이 유효한지 확인해주세요.')
      }

      // tokenStore에서 던진 에러는 사용자에게 그대로 안내해도 무방하다.
      const message = typeof err?.message === 'string' ? err.message : ''
      if (message.includes('토큰을 저장할 수 없습니다')) {
        throw new Error(message)
      }

      throw new Error('토큰 검증 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.')
    }
  }

}
