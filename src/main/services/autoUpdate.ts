import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC_CHANNELS } from '@/shared/ipc-channels'

let updaterInitialized = false
let updateWindow: BrowserWindow | null = null

type UpdateEventPayload =
  | { type: 'checking' }
  | { type: 'available'; info: { version: string; releaseNotes?: string } }
  | { type: 'not-available'; info?: { version?: string } }
  | { type: 'progress'; info: { percent: number; transferred: number; total: number; bytesPerSecond: number } }
  | { type: 'downloaded'; info: { version: string } }
  | { type: 'error'; info: { message: string } }

function emitUpdateEvent(payload: UpdateEventPayload): void {
  // 보안/구조:
  // - 업데이트 상태는 main process에서만 알 수 있다.
  // - renderer에는 "상태"만 전달하고(웹 컨텐츠에 권한을 주지 않음) 실제 업데이트 로직은 main에 둔다.
  updateWindow?.webContents.send(IPC_CHANNELS.APP.UPDATE_EVENT, payload)
}

function normalizeReleaseNotes(releaseNotes: unknown): string | undefined {
  // electron-updater의 releaseNotes는 string 또는 object 배열로 올 수 있다.
  // UI에서는 일단 "텍스트"로 보여주는 게 안전/단순해서 string으로 정규화한다.
  if (!releaseNotes) return undefined
  if (typeof releaseNotes === 'string') return releaseNotes

  if (Array.isArray(releaseNotes)) {
    const parts = releaseNotes
      .map((n) => {
        if (!n) return ''
        if (typeof n === 'string') return n
        if (typeof (n as any).note === 'string') return (n as any).note
        return ''
      })
      .filter((s) => s.trim().length > 0)

    return parts.length > 0 ? parts.join('\n\n') : undefined
  }

  return undefined
}

function getGithubFeedConfig(): { provider: 'github'; owner: string; repo: string; private?: boolean } {
  const defaultOwner = 'snowtie'
  const defaultRepo = 'Easy-Github'

  const owner = process.env['EASYGITHUB_UPDATE_GITHUB_OWNER']?.trim() || defaultOwner
  const repo = process.env['EASYGITHUB_UPDATE_GITHUB_REPO']?.trim() || defaultRepo

  const isPrivate = process.env['EASYGITHUB_UPDATE_GITHUB_PRIVATE'] === '1'

  return {
    provider: 'github',
    owner,
    repo,
    private: isPrivate ? true : undefined
  }
}

async function fallbackRestartDialogIfNoUi(): Promise<void> {
  // renderer UI가 없는 상황(비정상/특수 케이스)에서도 사용자가 업데이트 적용을 할 수 있게 안전장치로 둔다.
  const result = await dialog.showMessageBox({
    type: 'info',
    title: '업데이트 준비 완료',
    message: '새 버전이 다운로드되었습니다. 지금 재시작해서 업데이트를 적용할까요?',
    buttons: ['재시작', '나중에'],
    defaultId: 0,
    cancelId: 1
  })

  if (result.response === 0) {
    autoUpdater.quitAndInstall(false, true)
  }
}

export function setupAutoUpdater(mainWindow: BrowserWindow | null): void {
  // electron-updater는 패키징된 앱(app.isPackaged)에서만 정상 동작한다.
  // 개발 환경에서는 업데이트 메타(app-update.yml)가 없을 수 있으므로 비활성화한다.
  if (!app.isPackaged) return

  updateWindow = mainWindow
  if (updaterInitialized) return
  updaterInitialized = true

  try {
    // GitHub Releases에서 업데이트를 읽어온다(별도 업데이트 서버 불필요).
    // 기본값은 이 프로젝트의 origin을 기준으로 하되, 배포 환경에서는 env로 override 가능.
    autoUpdater.setFeedURL(getGithubFeedConfig())

    // 릴리즈 확인 → 업데이트 있으면 "창"으로 안내 → 사용자가 다운로드/설치 선택
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
      emitUpdateEvent({ type: 'checking' })
    })

    autoUpdater.on('update-available', (info: any) => {
      emitUpdateEvent({
        type: 'available',
        info: {
          version: String(info?.version ?? ''),
          releaseNotes: normalizeReleaseNotes(info?.releaseNotes)
        }
      })
    })

    autoUpdater.on('update-not-available', (info: any) => {
      emitUpdateEvent({ type: 'not-available', info: { version: info?.version ? String(info.version) : undefined } })
    })

    autoUpdater.on('download-progress', (p: any) => {
      emitUpdateEvent({
        type: 'progress',
        info: {
          percent: Number(p?.percent ?? 0),
          transferred: Number(p?.transferred ?? 0),
          total: Number(p?.total ?? 0),
          bytesPerSecond: Number(p?.bytesPerSecond ?? 0)
        }
      })
    })

    autoUpdater.on('update-downloaded', (info: any) => {
      emitUpdateEvent({ type: 'downloaded', info: { version: String(info?.version ?? '') } })

      // 업데이트 UI가 없다면 최소한의 안내를 제공
      if (!updateWindow) {
        void fallbackRestartDialogIfNoUi()
      }
    })

    autoUpdater.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      emitUpdateEvent({ type: 'error', info: { message } })
      console.error('[autoUpdater] error', err)
    })

    // 매 실행마다 한 번 확인
    void autoUpdater.checkForUpdates()

    // 장시간 실행되는 앱을 위해 주기적으로 확인(4시간)
    setInterval(() => {
      void autoUpdater.checkForUpdates()
    }, 4 * 60 * 60 * 1000)
  } catch (err) {
    console.error('[autoUpdater] setup failed', err)
  }
}

export async function checkForUpdatesManually(mainWindow: BrowserWindow | null): Promise<{ status: 'disabled' | 'started' }>{
  if (!app.isPackaged) return { status: 'disabled' }

  setupAutoUpdater(mainWindow)
  await autoUpdater.checkForUpdates()

  return { status: 'started' }
}

export async function downloadUpdateManually(mainWindow: BrowserWindow | null): Promise<{ status: 'disabled' | 'started' }>{
  if (!app.isPackaged) return { status: 'disabled' }

  setupAutoUpdater(mainWindow)
  await autoUpdater.downloadUpdate()

  return { status: 'started' }
}

export function installUpdateManually(): { status: 'disabled' | 'started' } {
  if (!app.isPackaged) return { status: 'disabled' }

  autoUpdater.quitAndInstall(false, true)
  return { status: 'started' }
}

export function getAppVersion(): string {
  return app.getVersion()
}
