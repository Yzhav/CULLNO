import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { registerIpcHandlers, cleanupWorkers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    // 標準ウィンドウフレーム（確実にドラッグ・最小化・最大化が動作する）
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      navigateOnDragDrop: true,  // DOMにdragover/dropイベントを届かせる（will-navigateで実ナビゲーションは防止）
    },
  })

  // ファイルドロップによるナビゲーションのみ防止（http://はdev server用に許可）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      event.preventDefault()
    }
  })

  // 開発モード判定
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// シングルインスタンス
if (app.isPackaged) {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })
  }
}

app.whenReady().then(() => {
  // 起動時キャッシュ診断
  const cacheRoot = join(app.getPath('userData'), 'thumb-cache')
  console.log('[Startup] userData:', app.getPath('userData'))
  console.log('[Startup] cacheRoot exists?', fs.existsSync(cacheRoot))
  if (fs.existsSync(cacheRoot)) {
    const subDirs = fs.readdirSync(cacheRoot)
    console.log('[Startup] cache subdirs:', subDirs)
    for (const sub of subDirs) {
      const files = fs.readdirSync(join(cacheRoot, sub))
      console.log(`[Startup] ${sub}: ${files.length} files`)
    }
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  cleanupWorkers()
  app.quit()
})
