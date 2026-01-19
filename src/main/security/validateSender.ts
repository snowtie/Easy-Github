import { app, type IpcMainInvokeEvent } from 'electron'

// Electron 보안 가이드에 따라 IPC 호출자의 출처를 검증한다.
// - 개발 환경: Vite dev server (localhost) 허용
// - 패키징(배포) 환경: file:// 로드만 허용
export function validateIpcSender(event: IpcMainInvokeEvent): boolean {
  try {
    const frameUrl = event.senderFrame?.url
    if (!frameUrl) return false

    const url = new URL(frameUrl)

    // 패키징 환경에서는 file:// 로드만 허용
    if (app.isPackaged) {
      return url.protocol === 'file:'
    }

    // 개발 환경에서는 localhost/127.0.0.1 허용
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const host = url.hostname
      return host === 'localhost' || host === '127.0.0.1'
    }

    // 개발 환경에서도 file:// 를 통해 로드할 수 있으므로 허용
    return url.protocol === 'file:'
  } catch {
    return false
  }
}
