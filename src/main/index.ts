import { app, BrowserWindow, Menu, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc/registerIpc'
import { setupAutoUpdater } from './services/autoUpdate'

const appDir = path.dirname(fileURLToPath(import.meta.url))
const stableUserDataPath = path.join(app.getPath('appData'), 'EasyGithub')

let mainWindow: BrowserWindow | null = null
let logStream: fs.WriteStream | null = null
let logFilePath: string | null = null


function configureUserDataPath(): void {
  // 업데이트 후에도 프로젝트 경로/로그인 정보가 유지되도록 userData 경로를 고정한다.
  // app.setPath는 디렉터리가 없으면 예외가 나므로 먼저 생성한다.
  if (!fs.existsSync(stableUserDataPath)) {
    fs.mkdirSync(stableUserDataPath, { recursive: true })
  }
  app.setPath('userData', stableUserDataPath)
}

function initAppLogging(): void {
  const logsDir = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  logFilePath = path.join(logsDir, 'app.log')
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' })

  const originalConsoleLog = console.log
  const originalConsoleError = console.error
  const originalConsoleWarn = console.warn

  console.log = (...args: any[]) => {
    originalConsoleLog(...args)
    writeLog('INFO', args)
  }

  console.warn = (...args: any[]) => {
    originalConsoleWarn(...args)
    writeLog('WARN', args)
  }

  console.error = (...args: any[]) => {
    originalConsoleError(...args)
    writeLog('ERROR', args)
  }
}

function writeLog(level: 'INFO' | 'WARN' | 'ERROR', args: any[]): void {
  if (!logStream) return
  const timestamp = new Date().toISOString()
  const payload = args
    .map((value) => {
      if (value instanceof Error) {
        return value.stack || value.message
      }
      if (typeof value === 'string') return value
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    })
    .join(' ')

  logStream.write(`[${timestamp}] [${level}] ${payload}\n`)
}


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
    console.error('Renderer load failed', { errorCode, errorDescription, validatedURL })
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
  configureUserDataPath()
  initAppLogging()
  registerIpcHandlers()
  Menu.setApplicationMenu(null)
  createWindow()
  setupAutoUpdater(mainWindow)


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception', error)
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showErrorBox('치명적 오류', error.stack || error.message)
  }
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection', reason)
})

process.on('exit', () => {
  logStream?.end()
})

