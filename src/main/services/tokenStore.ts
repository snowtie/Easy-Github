import { safeStorage } from 'electron'
import Store from 'electron-store'

// 토큰은 renderer(localStorage 등)에 저장하지 않는다.
// main process에서만 보관하고, OS 암호화(safeStorage)로 저장한다.
const store = new Store({
  name: 'auth',
  schema: {
    accessToken: {
      type: 'string'
    }
  }
})

const TOKEN_KEY = 'accessToken'

export function canPersistAccessToken(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function saveAccessToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    // 안전한 저장소를 사용할 수 없는 환경에서는 저장하지 않는다.
    // (초보자용 앱이지만 토큰 평문 저장은 위험)
    // 호출자는 이 상황을 사용자에게 안내할 수 있도록 별도로 체크해야 한다.
    store.delete(TOKEN_KEY)
    throw new Error('OS 암호화 저장소를 사용할 수 없어 토큰을 저장할 수 없습니다')
  }

  const encrypted = safeStorage.encryptString(token)
  store.set(TOKEN_KEY, encrypted.toString('base64'))
}

export function loadAccessToken(): string | null {
  const value = store.get(TOKEN_KEY)
  if (typeof value !== 'string' || value.length === 0) return null

  if (!safeStorage.isEncryptionAvailable()) return null

  const buffer = Buffer.from(value, 'base64')
  return safeStorage.decryptString(buffer)
}

export function clearAccessToken(): void {
  store.delete(TOKEN_KEY)
}
