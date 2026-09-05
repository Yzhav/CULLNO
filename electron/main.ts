import { app, BrowserWindow, Menu, nativeTheme } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { mkdirSync } from 'fs'
import { registerIpcHandlers, cleanupWorkers } from './ipc-handlers'

// 開発起動では業務用の選別状態・設定を書き換えない。
if (!app.isPackaged) {
  const devData = join(app.getAppPath(), '.local', 'dev-data')
  mkdirSync(devData, { recursive: true })
  app.setPath('userData', devData)
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const rendererPath = join(__dirname, '../dist/index.html')
  const rendererUrl = app.isPackaged
    ? pathToFileURL(rendererPath).href
    : 'http://localhost:5173/'

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1e1e1e',
    icon: join(__dirname, '../build/icon.png'),
    frame: true,
    autoHideMenuBar: true,
    darkTheme: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      navigateOnDragDrop: true,  // DOMにdragover/dropイベントを届かせる（will-navigateで実ナビゲーションは防止）
    },
  })

  // renderer以外への遷移を拒否し、preload APIを外部ページへ公開しない
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isAllowed = app.isPackaged
      ? url === rendererUrl
      : new URL(url).origin === new URL(rendererUrl).origin
    if (!isAllowed) {
      event.preventDefault()
    }
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // 開発モード判定
  if (!app.isPackaged) {
    mainWindow.loadURL(rendererUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(rendererPath)
  }

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow?.show()
  })

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

// Electronデフォルトメニューを完全削除
Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  // Windows環境でもタイトルバーをダークに強制
  nativeTheme.themeSource = 'dark'

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
