import { ipcMain, dialog, app, shell, BrowserWindow } from 'electron'
import type { WebContents } from 'electron'
import { Worker } from 'worker_threads'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { createHash } from 'crypto'
import { scanFolder, resolveFolderPath, listDateFolders } from './file-scanner'
import { startWatching, stopWatching } from './folder-watcher'
import type { ThumbnailSize, SessionData, AppSettings, ExportFormat, ExportResult, KeybindConfig, UpdateCheckResult } from '../src/types'
import { DEFAULT_KEYBINDS, THUMBNAIL_WIDTHS } from '../src/types'

// ─── Worker Pool ───

const WORKER_COUNT = Math.min(os.cpus().length, 8)
const workerPool: Worker[] = []
let nextTaskId = 0
const pendingTasks = new Map<number, {
  resolve: (buf: Buffer | null) => void
  reject: (error: Error) => void
}>()
type WorkerTask = { id: number; mode: 'thumbnail'; filePath: string; width: number; quality: number }
  | { id: number; mode: 'export-png'; filePath: string; outPath: string; format?: ExportFormat; quality?: number }
const taskQueue: WorkerTask[] = []
const idleWorkers: Worker[] = []
const activeTaskIds = new Map<Worker, number>()
let shuttingDown = false
let previewGenerationId = 0
let nextScanRequestId = 0
const latestScanRequests = new WeakMap<WebContents, number>()

function getWorkerPath(): string {
  return path.join(__dirname, 'thumbnail-worker.js')
}

function removeWorker(worker: Worker) {
  const poolIndex = workerPool.indexOf(worker)
  if (poolIndex >= 0) workerPool.splice(poolIndex, 1)
  const idleIndex = idleWorkers.indexOf(worker)
  if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1)
}

function rejectActiveTask(worker: Worker, error: Error) {
  const taskId = activeTaskIds.get(worker)
  if (taskId === undefined) return
  activeTaskIds.delete(worker)
  const task = pendingTasks.get(taskId)
  pendingTasks.delete(taskId)
  task?.reject(error)
}

function createWorker() {
  const worker = new Worker(getWorkerPath())
  worker.on('message', (msg: { id: number; buffer: Uint8Array | null; error: string | null }) => {
    activeTaskIds.delete(worker)
    const task = pendingTasks.get(msg.id)
    if (task) {
      pendingTasks.delete(msg.id)
      if (msg.error) {
        task.reject(new Error(msg.error))
      } else {
        // Worker経由のBufferはUint8Arrayに変換されるため、Buffer.fromでラップ
        task.resolve(msg.buffer ? Buffer.from(msg.buffer) : null)
      }
    }
    dispatchNext(worker)
  })
  worker.on('error', (error) => {
    console.error('[Worker] error:', error)
    rejectActiveTask(worker, error)
  })
  worker.on('exit', (code) => {
    rejectActiveTask(worker, new Error(`Thumbnail worker exited with code ${code}`))
    removeWorker(worker)
    if (!shuttingDown) createWorker()
  })
  workerPool.push(worker)
  dispatchNext(worker)
}

function initWorkerPool() {
  shuttingDown = false
  for (let i = 0; i < WORKER_COUNT; i++) createWorker()
  console.log(`[Worker] pool initialized: ${WORKER_COUNT} workers`)
}

function dispatchNext(worker: Worker) {
  if (shuttingDown || !workerPool.includes(worker)) return
  const next = taskQueue.shift()
  if (next) {
    activeTaskIds.set(worker, next.id)
    try {
      worker.postMessage(next)
    } catch (error) {
      rejectActiveTask(worker, error instanceof Error ? error : new Error(String(error)))
      void worker.terminate()
    }
  } else if (!idleWorkers.includes(worker)) {
    idleWorkers.push(worker)
  }
}

function sendToWorker(msg: Record<string, unknown>): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const id = nextTaskId++
    pendingTasks.set(id, { resolve, reject })
    const task = { ...msg, id } as WorkerTask

    taskQueue.push(task)
    const worker = idleWorkers.pop()
    if (worker) dispatchNext(worker)
  })
}

function processInWorker(filePath: string, width: number, quality: number): Promise<Buffer | null> {
  return sendToWorker({ mode: 'thumbnail', filePath, width, quality })
}

async function exportInWorker(filePath: string, outPath: string, format?: ExportFormat, quality?: number): Promise<void> {
  await sendToWorker({ mode: 'export-png', filePath, outPath, format, quality })
}

// ─── Cache ───

/** 設定ファイルパス */
function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

/** キーバインドファイルパス */
function getKeybindsPath(): string {
  return path.join(app.getPath('userData'), 'keybinds.json')
}

function getSessionsDir(): string {
  const dir = path.join(app.getPath('userData'), 'sessions')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getSessionDate(folderPath: string): string {
  return folderPath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? 'undated'
}

/** フォルダ単位で一意なセッションファイルパス */
function getSessionPath(folderPath: string): string {
  const folderKey = createHash('sha256')
    .update(path.resolve(folderPath).toLowerCase())
    .digest('hex')
    .slice(0, 16)
  return path.join(getSessionsDir(), `${getSessionDate(folderPath)}-${folderKey}.json`)
}

/** v0.2.0以前の日付だけをキーにしたセッションファイルパス */
function getLegacySessionPath(folderPath: string): string {
  const date = folderPath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)
  return path.join(getSessionsDir(), `${date}.json`)
}

/** キャッシュディレクトリ（ルートスキャンフォルダから生成） */
function getCacheDir(rootFolder: string): string {
  const rootKey = createHash('sha256')
    .update(path.resolve(rootFolder).toLowerCase())
    .digest('hex')
    .slice(0, 24)
  const dir = path.join(app.getPath('userData'), 'thumb-cache', 'v2', rootKey)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** ファイルパスからキャッシュパスを取得（ルートフォルダ基準） */
function getCachePath(filePath: string, size: ThumbnailSize, rootFolder: string): string {
  const cacheDir = getCacheDir(rootFolder)
  const relativePath = path.relative(rootFolder, filePath)
  if (path.isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) {
    throw new Error(`Image path is outside the selected folder: ${filePath}`)
  }
  const fileKey = createHash('sha256')
    .update(relativePath.toLowerCase())
    .digest('hex')
    .slice(0, 24)
  return path.join(cacheDir, `${fileKey}_${size}.jpg`)
}

async function isCacheFresh(cachePath: string, filePath: string): Promise<boolean> {
  try {
    const [cacheStat, sourceStat] = await Promise.all([
      fs.promises.stat(cachePath),
      fs.promises.stat(filePath),
    ])
    return cacheStat.size > 0 && cacheStat.mtimeMs >= sourceStat.mtimeMs
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function writeCache(cachePath: string, buffer: Buffer): Promise<void> {
  try {
    await fs.promises.writeFile(cachePath, buffer)
  } catch (error) {
    console.warn(`[Cache] failed to write ${cachePath}:`, error)
  }
}

function getUniqueOutputPath(
  filePath: string,
  outputDir: string,
  suffix: string,
  extension: string,
  reservedPaths: Set<string>,
): string {
  const safeSuffix = suffix.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
  const baseName = `${path.parse(filePath).name}${safeSuffix}`
  let sequence = 1
  let candidate = path.join(outputDir, `${baseName}${extension}`)
  while (reservedPaths.has(candidate.toLowerCase()) || fs.existsSync(candidate)) {
    sequence++
    candidate = path.join(outputDir, `${baseName}_${sequence}${extension}`)
  }
  reservedPaths.add(candidate.toLowerCase())
  return candidate
}

function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (version: string) => {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
    if (!match) throw new Error(`Invalid release version: ${version}`)
    return match.slice(1).map(Number)
  }
  const candidateParts = parse(candidate)
  const currentParts = parse(current)
  for (let i = 0; i < 3; i++) {
    if (candidateParts[i] !== currentParts[i]) return candidateParts[i] > currentParts[i]
  }
  return false
}

function validateExternalUrl(url: string): string {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`External URL protocol is not allowed: ${parsed.protocol}`)
  }
  return parsed.toString()
}

function isNotFoundError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function isSameFolder(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

async function loadSessionFile(sessionPath: string): Promise<SessionData> {
  const data = await fs.promises.readFile(sessionPath, 'utf-8')
  return JSON.parse(data) as SessionData
}

async function migrateLegacySession(folderPath: string, sessionPath: string): Promise<SessionData | null> {
  const legacyPath = getLegacySessionPath(folderPath)
  try {
    const session = await loadSessionFile(legacyPath)
    if (!isSameFolder(session.folderPath, folderPath)) return null

    await fs.promises.writeFile(sessionPath, JSON.stringify(session, null, 2))
    try {
      await fs.promises.rename(legacyPath, `${legacyPath}.migrated`)
    } catch (error) {
      console.warn(`[Session] migrated but could not archive legacy file ${legacyPath}:`, error)
    }
    console.info(`[Session] migrated legacy session for ${folderPath}`)
    return session
  } catch (error) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

// ─── IPC Handlers ───

export function registerIpcHandlers() {
  initWorkerPool()

  // フォルダ選択ダイアログ
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '画像フォルダを選択',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // 画像ファイル選択ダイアログ
  ipcMain.handle('select-image-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: '背景画像を選択',
      filters: [
        { name: '画像ファイル', extensions: ['png', 'jpg', 'jpeg', 'tga', 'bmp', 'webp'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // TGAスキャン
  ipcMain.handle('scan-folder', async (event, folderPath: string) => {
    const requestId = ++nextScanRequestId
    latestScanRequests.set(event.sender, requestId)
    const resolvedFolderPath = await resolveFolderPath(folderPath)
    const result = await scanFolder(resolvedFolderPath)
    // スキャン成功後にフォルダ監視を開始
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && latestScanRequests.get(event.sender) === requestId) {
      await startWatching(resolvedFolderPath, win)
    }
    return result
  })

  // 日付フォルダ一覧
  ipcMain.handle('list-date-folders', async (_event, basePath: string) => {
    return await listDateFolders(basePath)
  })

  // サムネイル生成（Workerプール経由）
  ipcMain.handle('get-thumbnail', async (_event, filePath: string, size: ThumbnailSize, rootFolder: string) => {
    const width = THUMBNAIL_WIDTHS[size]
    if (!Object.prototype.hasOwnProperty.call(THUMBNAIL_WIDTHS, size)) throw new Error(`Unknown thumbnail size: ${size}`)

    // キャッシュチェック
    const cachePath = getCachePath(filePath, size, rootFolder)
    if (await isCacheFresh(cachePath, filePath)) {
      const buf = await fs.promises.readFile(cachePath)
      return `data:image/jpeg;base64,${buf.toString('base64')}`
    }

    // Workerで処理
    const quality = size === 'micro' ? 60 : 85
    const buffer = await processInWorker(filePath, width, quality)
    if (!buffer) return null

    const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`

    await writeCache(cachePath, buffer)

    return dataUrl
  })

  // 一括プレビュー生成（進捗通知付き、Workerプール経由）
  ipcMain.handle('generate-all-previews', async (event, filePaths: string[], rootFolder: string) => {
    const generationId = ++previewGenerationId
    const total = filePaths.length
    let completed = 0
    const failedFiles: string[] = []
    const notifyProgress = () => {
      if (generationId === previewGenerationId && !event.sender.isDestroyed()) {
        event.sender.send('preview-progress', { completed, total })
      }
    }

    // キャッシュ済みを先にカウント
    const uncached: string[] = []
    for (const fp of filePaths) {
      if (generationId !== previewGenerationId) return { completed, total }
      const cachePath = getCachePath(fp, 'preview', rootFolder)
      if (await isCacheFresh(cachePath, fp)) {
        completed++
        continue
      }
      uncached.push(fp)
    }

    // 初回進捗送信
    notifyProgress()

    // キューを一括で埋めず、表示中サムネイル要求が割り込める幅で処理する
    let nextIndex = 0
    const runWorker = async () => {
      while (generationId === previewGenerationId) {
        const index = nextIndex++
        if (index >= uncached.length) return
        const fp = uncached[index]
        try {
          const buffer = await processInWorker(fp, THUMBNAIL_WIDTHS.preview, 85)
          if (buffer) {
            const cachePath = getCachePath(fp, 'preview', rootFolder)
            await writeCache(cachePath, buffer)
          }
        } catch (error) {
          failedFiles.push(fp)
          console.warn(`[Preview] failed to generate ${fp}:`, error)
        } finally {
          completed++
          notifyProgress()
        }
      }
    }

    const concurrency = Math.min(WORKER_COUNT, uncached.length)
    await Promise.all(Array.from({ length: concurrency }, () => runWorker()))

    if (generationId === previewGenerationId && failedFiles.length > 0) {
      throw new Error(`Failed to generate ${failedFiles.length} of ${total} previews`)
    }

    return { completed, total }
  })

  // セッション保存
  ipcMain.handle('save-session', async (_event, data: SessionData) => {
    const sessionPath = getSessionPath(data.folderPath)
    await fs.promises.writeFile(sessionPath, JSON.stringify(data, null, 2))
  })

  // セッション読み込み
  ipcMain.handle('load-session', async (_event, folderPath: string) => {
    const sessionPath = getSessionPath(folderPath)
    try {
      return await loadSessionFile(sessionPath)
    } catch (error) {
      if (isNotFoundError(error)) {
        try {
          return await migrateLegacySession(folderPath, sessionPath)
        } catch (migrationError) {
          throw new Error(`Failed to migrate session: ${String(migrationError)}`)
        }
      }
      throw new Error(`Failed to load session: ${String(error)}`)
    }
  })

  // 設定読み込み
  ipcMain.handle('load-settings', async () => {
    try {
      const data = await fs.promises.readFile(getSettingsPath(), 'utf-8')
      return JSON.parse(data) as AppSettings
    } catch (error) {
      if (isNotFoundError(error)) return { defaultFolder: '', exportFolder: '' } as AppSettings
      throw new Error(`Failed to load settings: ${String(error)}`)
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
      } catch (error) {
        console.error(`[Trash] failed to move ${filePath}:`, error)
        results.push({ path: filePath, success: false })
      }
    }
    return results
  })

  // 画像エクスポート（ワーカープール並列処理）
  ipcMain.handle('export-png', async (
    event,
    filePaths: string[],
    outputDir: string,
    suffix = '',
    format: ExportFormat = 'png',
    quality?: number,
  ): Promise<ExportResult> => {
    if (format !== 'png' && format !== 'jpeg') throw new Error(`Unsupported export format: ${format}`)
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    const ext = format === 'jpeg' ? '.jpg' : '.png'
    const normalizedQuality = quality === undefined ? undefined : Math.max(1, Math.min(100, quality))
    let completed = 0
    const total = filePaths.length
    const failedFiles: string[] = []
    const reservedPaths = new Set<string>()

    const tasks = filePaths.map(async (filePath) => {
      const outPath = getUniqueOutputPath(filePath, outputDir, suffix, ext, reservedPaths)
      try {
        await exportInWorker(filePath, outPath, format, normalizedQuality)
      } catch (error) {
        console.error(`[Export] failed: ${filePath}`, error)
        failedFiles.push(filePath)
      } finally {
        completed++
        if (!event.sender.isDestroyed()) {
          event.sender.send('export-progress', {
            current: completed,
            total,
            currentFile: path.basename(filePath),
          })
        }
      }
    })

    await Promise.all(tasks)
    return {
      success: failedFiles.length === 0,
      count: total - failedFiles.length,
      failedFiles,
    }
  })

  // フォルダ内の対応画像ファイル数を取得
  ipcMain.handle('count-tga-files', async (_event, folderPath: string) => {
    try {
      return (await scanFolder(folderPath)).images.length
    } catch (error) {
      if (isNotFoundError(error)) return 0
      throw error
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
    const error = await shell.openPath(folderPath)
    if (error) throw new Error(error)
  })

  // ファイルをエクスプローラーで選択状態で開く
  ipcMain.handle('show-item-in-folder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  // キーバインド読み込み
  ipcMain.handle('get-keybinds', async (): Promise<KeybindConfig> => {
    try {
      const data = await fs.promises.readFile(getKeybindsPath(), 'utf-8')
      return { ...DEFAULT_KEYBINDS, ...JSON.parse(data) } as KeybindConfig
    } catch (error) {
      if (isNotFoundError(error)) return DEFAULT_KEYBINDS
      throw new Error(`Failed to load keybinds: ${String(error)}`)
    }
  })

  // キーバインド保存
  ipcMain.handle('save-keybinds', async (_event, config: KeybindConfig) => {
    await fs.promises.writeFile(getKeybindsPath(), JSON.stringify(config, null, 2))
  })

  // バージョン
  ipcMain.handle('get-app-version', () => app.getVersion())

  // アップデート確認
  ipcMain.handle('check-for-updates', async (): Promise<UpdateCheckResult> => {
    const currentVersion = app.getVersion()
    try {
      const res = await fetch('https://api.github.com/repos/Yzhav/CULLNO/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) {
        return { hasUpdate: false, currentVersion, error: `GitHub API: ${res.status}` }
      }
      const data = await res.json() as { tag_name: string; html_url: string }
      const latestVersion = data.tag_name.replace(/^v/, '')
      const hasUpdate = isNewerVersion(latestVersion, currentVersion)
      return { hasUpdate, currentVersion, latestVersion, releaseUrl: validateExternalUrl(data.html_url) }
    } catch (err) {
      return { hasUpdate: false, currentVersion, error: String(err) }
    }
  })

  // 外部URLを開く
  ipcMain.handle('open-external', async (_event, url: string) => {
    await shell.openExternal(validateExternalUrl(url))
  })

  // ウィンドウ操作
  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })
  ipcMain.on('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })
}

export function cleanupWorkers() {
  shuttingDown = true
  previewGenerationId++
  void stopWatching().catch(error => console.error('[FolderWatcher] failed to stop:', error))
  const error = new Error('Application is shutting down')
  for (const task of pendingTasks.values()) task.reject(error)
  pendingTasks.clear()
  taskQueue.length = 0
  activeTaskIds.clear()
  for (const worker of workerPool) {
    void worker.terminate()
  }
  workerPool.length = 0
  idleWorkers.length = 0
  console.log('[Worker] pool terminated')
}
