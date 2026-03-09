import { ipcMain, dialog, app, shell } from 'electron'
import { Worker } from 'worker_threads'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { scanFolder, listDateFolders } from './file-scanner'
import type { ThumbnailSize, SessionData, AppSettings } from '../src/types'

const SIZE_MAP: Record<ThumbnailSize, number> = {
  micro: 64,
  preview: 800,
  full: 1920,
}

// ─── Worker Pool ───

const WORKER_COUNT = Math.min(os.cpus().length, 8)
const workerPool: Worker[] = []
let nextTaskId = 0
const pendingTasks = new Map<number, { resolve: (buf: Buffer | null) => void }>()
const taskQueue: Array<{ id: number; filePath: string; width: number; quality: number }> = []
const idleWorkers: Worker[] = []

function getWorkerPath(): string {
  return path.join(__dirname, 'thumbnail-worker.js')
}

function initWorkerPool() {
  const workerPath = getWorkerPath()
  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = new Worker(workerPath)
    worker.on('message', (msg: { id: number; buffer: Uint8Array | null; error: string | null }) => {
      const task = pendingTasks.get(msg.id)
      if (task) {
        pendingTasks.delete(msg.id)
        // Worker経由のBufferはUint8Arrayに変換されるため、Buffer.fromでラップ
        task.resolve(msg.buffer ? Buffer.from(msg.buffer) : null)
      }
      // ワーカーが空いたので次のタスクを割り当て
      dispatchNext(worker)
    })
    worker.on('error', (err) => {
      console.error('[Worker] error:', err)
    })
    workerPool.push(worker)
    idleWorkers.push(worker)
  }
  console.log(`[Worker] pool initialized: ${WORKER_COUNT} workers`)
}

function dispatchNext(worker: Worker) {
  const next = taskQueue.shift()
  if (next) {
    worker.postMessage(next)
  } else {
    idleWorkers.push(worker)
  }
}

function processInWorker(filePath: string, width: number, quality: number): Promise<Buffer | null> {
  return new Promise(resolve => {
    const id = nextTaskId++
    pendingTasks.set(id, { resolve })
    const msg = { id, filePath, width, quality }

    const worker = idleWorkers.pop()
    if (worker) {
      worker.postMessage(msg)
    } else {
      taskQueue.push(msg)
    }
  })
}

// ─── Cache ───

/** 設定ファイルパス */
function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

/** セッションファイルパス */
function getSessionPath(date: string): string {
  const dir = path.join(app.getPath('userData'), 'sessions')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${date}.json`)
}

/** キャッシュディレクトリ（ルートスキャンフォルダから生成） */
function getCacheDir(rootFolder: string): string {
  const folderName = path.basename(rootFolder)
  const subDir = /^\d{4}-\d{2}-\d{2}$/.test(folderName)
    ? folderName
    : Buffer.from(rootFolder).toString('base64url').slice(0, 32)
  const dir = path.join(app.getPath('userData'), 'thumb-cache', subDir)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** ファイルパスからキャッシュパスを取得（ルートフォルダ基準） */
function getCachePath(filePath: string, size: ThumbnailSize, rootFolder: string): string {
  const cacheDir = getCacheDir(rootFolder)
  const rel = path.relative(rootFolder, filePath).replace(/[\\/]/g, '_')
  const name = rel.replace(/\.tga$/i, '')
  return path.join(cacheDir, `${name}_${size}.jpg`)
}

// ─── IPC Handlers ───

export function registerIpcHandlers() {
  initWorkerPool()

  // フォルダ選択ダイアログ
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'TGAフォルダを選択',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // TGAスキャン
  ipcMain.handle('scan-folder', async (_event, folderPath: string) => {
    return await scanFolder(folderPath)
  })

  // 日付フォルダ一覧
  ipcMain.handle('list-date-folders', async (_event, basePath: string) => {
    return await listDateFolders(basePath)
  })

  // サムネイル生成（Workerプール経由）
  ipcMain.handle('get-thumbnail', async (_event, filePath: string, size: ThumbnailSize, rootFolder: string) => {
    // キャッシュチェック
    const cachePath = getCachePath(filePath, size, rootFolder)
    if (fs.existsSync(cachePath)) {
      const buf = await fs.promises.readFile(cachePath)
      return `data:image/jpeg;base64,${buf.toString('base64')}`
    }

    // Workerで処理
    const width = SIZE_MAP[size]
    const quality = size === 'micro' ? 60 : 85
    const buffer = await processInWorker(filePath, width, quality)
    if (!buffer) return null

    const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`

    // キャッシュ保存（非同期、失敗しても無視）
    fs.promises.writeFile(cachePath, buffer).catch(() => {})

    return dataUrl
  })

  // 一括プレビュー生成（進捗通知付き、Workerプール経由）
  ipcMain.handle('generate-all-previews', async (event, filePaths: string[], rootFolder: string) => {
    const total = filePaths.length
    let completed = 0

    // キャッシュ済みを先にカウント
    const uncached: string[] = []
    for (const fp of filePaths) {
      const cachePath = getCachePath(fp, 'preview', rootFolder)
      if (fs.existsSync(cachePath)) {
        completed++
        continue
      }
      uncached.push(fp)
    }

    console.log(`[Preview] total: ${total}, cached: ${completed}, uncached: ${uncached.length}`)
    console.log('[Preview] rootFolder:', rootFolder)
    console.log('[Preview] cacheDir:', getCacheDir(rootFolder))
    if (uncached.length > 0) {
      const expectedCache = getCachePath(uncached[0], 'preview', rootFolder)
      console.log('[Preview] first uncached path:', uncached[0])
      console.log('[Preview] expected cache:', expectedCache)
      console.log('[Preview] cache exists?', fs.existsSync(expectedCache))
      try {
        const cacheDir = getCacheDir(rootFolder)
        const files = fs.readdirSync(cacheDir)
        console.log('[Preview] cache dir file count:', files.length)
      } catch (e) {
        console.log('[Preview] cache dir read error:', e)
      }
    }

    // 初回進捗送信
    event.sender.send('preview-progress', { completed, total })

    // 未キャッシュ分をWorkerプールで並列生成
    // Workerプールが自動的に同時実行数を制限するため、全タスクを一度に投入してOK
    const promises = uncached.map(async (fp) => {
      const buffer = await processInWorker(fp, 800, 85)
      if (buffer) {
        const cachePath = getCachePath(fp, 'preview', rootFolder)
        await fs.promises.writeFile(cachePath, buffer).catch(() => {})
      }
      completed++
      event.sender.send('preview-progress', { completed, total })
    })

    await Promise.all(promises)

    // 生成完了後のキャッシュ確認
    try {
      const cacheDir = getCacheDir(rootFolder)
      const files = fs.readdirSync(cacheDir)
      console.log('[Preview] DONE - cache dir:', cacheDir)
      console.log('[Preview] DONE - files written:', files.length)
    } catch (e) {
      console.log('[Preview] DONE - readdir error:', e)
    }

    return { completed, total }
  })

  // セッション保存
  ipcMain.handle('save-session', async (_event, data: SessionData) => {
    const date = data.folderPath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)
    const sessionPath = getSessionPath(date)
    await fs.promises.writeFile(sessionPath, JSON.stringify(data, null, 2))
  })

  // セッション読み込み
  ipcMain.handle('load-session', async (_event, folderPath: string) => {
    const date = folderPath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)
    const sessionPath = getSessionPath(date)
    try {
      const data = await fs.promises.readFile(sessionPath, 'utf-8')
      return JSON.parse(data) as SessionData
    } catch {
      return null
    }
  })

  // 設定読み込み
  ipcMain.handle('load-settings', async () => {
    try {
      const data = await fs.promises.readFile(getSettingsPath(), 'utf-8')
      return JSON.parse(data) as AppSettings
    } catch {
      return { defaultFolder: '', exportFolder: '' } as AppSettings
    }
  })

  // 設定保存
  ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
    await fs.promises.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2))
  })

  // キャッシュクリア（開発用）
  ipcMain.handle('clear-cache', async () => {
    const cacheRoot = path.join(app.getPath('userData'), 'thumb-cache')
    if (fs.existsSync(cacheRoot)) {
      await fs.promises.rm(cacheRoot, { recursive: true, force: true })
      console.log('[Cache] cleared:', cacheRoot)
    }
    return true
  })

  // ゴミ箱移動
  ipcMain.handle('move-to-trash', async (_event, filePaths: string[]) => {
    const results: { path: string; success: boolean }[] = []
    for (const filePath of filePaths) {
      try {
        const dir = path.dirname(filePath)
        const trashDir = path.join(dir, 'trash')
        if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true })
        const dest = path.join(trashDir, path.basename(filePath))
        await fs.promises.rename(filePath, dest)
        results.push({ path: filePath, success: true })
      } catch {
        results.push({ path: filePath, success: false })
      }
    }
    return results
  })

  // PNG変換エクスポート（これもWorkerプール経由にできるが、頻度が低いのでメインで処理）
  ipcMain.handle('export-png', async (event, filePaths: string[], outputDir: string) => {
    // export-pngは sharp.png() が必要でWorkerの JPEG専用とは異なるため、
    // 動的importでメインプロセスで処理
    const { decodeTga } = await import('./tga-decoder')
    const sharp = (await import('sharp')).default
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]
      const outName = path.parse(filePath).name + '.png'
      const outPath = path.join(outputDir, outName)
      const tga = await decodeTga(filePath)
      await sharp(tga.pixels, {
        raw: { width: tga.width, height: tga.height, channels: tga.channels },
      }).png().toFile(outPath)
      event.sender.send('export-progress', {
        current: i + 1,
        total: filePaths.length,
        currentFile: path.basename(filePath),
      })
    }
    return { success: true, count: filePaths.length }
  })

  // フォルダ内のTGAファイル数を取得
  ipcMain.handle('count-tga-files', async (_event, folderPath: string) => {
    try {
      const files = await fs.promises.readdir(folderPath)
      const tgaCount = files.filter(f => f.toLowerCase().endsWith('.tga')).length
      return tgaCount
    } catch {
      return 0
    }
  })

  // D&D: ドロップされたパスを解決（ファイルなら親フォルダに変換）
  ipcMain.handle('resolve-drop-path', async (_event, filePath: string) => {
    try {
      const stat = await fs.promises.stat(filePath)
      const folderPath = stat.isDirectory() ? filePath : path.dirname(filePath)
      console.log('[D&D main] resolved:', folderPath)
      return folderPath
    } catch (err) {
      console.error('[D&D] resolve-drop-path failed:', err)
      return null
    }
  })

  // エクスプローラで開く
  ipcMain.handle('open-in-explorer', async (_event, folderPath: string) => {
    shell.openPath(folderPath)
  })

  // ウィンドウ操作
  ipcMain.on('minimize-window', (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })
  ipcMain.on('maximize-window', (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('close-window', (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })
}

export function cleanupWorkers() {
  for (const worker of workerPool) {
    worker.terminate()
  }
  workerPool.length = 0
  idleWorkers.length = 0
  console.log('[Worker] pool terminated')
}
