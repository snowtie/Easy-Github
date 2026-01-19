import { app, BrowserWindow, Menu, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc/registerIpc'

const appDir = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // 보안 기본값: renderer에서 Node API 접근 금지
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(appDir, '../preload/index.cjs')
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return

    // 패키지에서 흰 화면이 뜰 때 가장 흔한 원인은 파일 경로/정적자산 로드 실패다.
    dialog.showErrorBox('화면 로드 실패', `${errorDescription} (${errorCode})\nURL: ${validatedURL}`)
  })

  // 개발: Vite dev server URL
  // 배포: 빌드된 renderer html
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(path.join(appDir, '../renderer/index.html'))
  }

  // 초보자 UX: 처음에는 devtools를 자동으로 열지 않는다.
}

app.whenReady().then(() => {
  registerIpcHandlers()
  Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
