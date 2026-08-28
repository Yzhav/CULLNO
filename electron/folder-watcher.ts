import { watch, type FSWatcher } from 'chokidar'
import type { BrowserWindow } from 'electron'
import * as path from 'node:path'

let watcher: FSWatcher | null = null
let watchedFolder: string | null = null
let debounceTimer: NodeJS.Timeout | null = null
let watcherUpdateQueue: Promise<void> = Promise.resolve()

const WATCHED_EXTENSIONS = /\.(tga|png|jpe?g)$/i

function queueWatcherUpdate(update: () => Promise<void>): Promise<void> {
  const result = watcherUpdateQueue.then(update)
  watcherUpdateQueue = result.catch(() => undefined)
  return result
}

async function closeCurrentWatcher() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const closingWatcher = watcher
  watcher = null
  watchedFolder = null
  if (closingWatcher) {
    await closingWatcher.close()
    console.log('[FolderWatcher] stopped')
  }
}

export function startWatching(folderPath: string, win: BrowserWindow): Promise<void> {
  const normalizedFolder = path.resolve(folderPath).toLowerCase()
  return queueWatcherUpdate(async () => {
    if (watcher && watchedFolder === normalizedFolder) return
    await closeCurrentWatcher()

    watcher = watch(folderPath, {
      ignored: (path) => {
        // trashフォルダを除外
        return /[/\\]trash([/\\]|$)/i.test(path)
      },
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300 },
    })

    const notify = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        if (!win.isDestroyed()) {
          win.webContents.send('folder-changed')
        }
      }, 500)
    }

    const notifyImage = (changedPath: string) => {
      if (WATCHED_EXTENSIONS.test(changedPath)) notify()
    }
    watcher.on('add', notifyImage)
    watcher.on('unlink', notifyImage)
    watcher.on('change', notifyImage)
    watcher.on('addDir', notify)
    watcher.on('unlinkDir', notify)
    watcher.on('error', error => console.error('[FolderWatcher] error:', error))
    watchedFolder = normalizedFolder

    console.log('[FolderWatcher] started:', folderPath)
  })
}

export function stopWatching(): Promise<void> {
  return queueWatcherUpdate(closeCurrentWatcher)
}
