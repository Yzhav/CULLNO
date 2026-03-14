import { watch, type FSWatcher } from 'chokidar'
import type { BrowserWindow } from 'electron'

let watcher: FSWatcher | null = null
let debounceTimer: NodeJS.Timeout | null = null

const WATCHED_EXTENSIONS = /\.(tga|png|jpe?g)$/i

export function startWatching(folderPath: string, win: BrowserWindow) {
  stopWatching()

  watcher = watch(folderPath, {
    ignored: (path) => {
      // trashフォルダを除外
      if (/[/\\]trash([/\\]|$)/i.test(path)) return true
      // フォルダ自体は監視対象（中のファイルを検出するため）
      // ファイルは対応拡張子のみ通す
      if (/\.[^/\\]+$/.test(path) && !WATCHED_EXTENSIONS.test(path)) return true
      return false
    },
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
    depth: 0,
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

  watcher.on('add', notify)
  watcher.on('unlink', notify)
  watcher.on('change', notify)

  console.log('[FolderWatcher] started:', folderPath)
}

export function stopWatching() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (watcher) {
    watcher.close()
    watcher = null
    console.log('[FolderWatcher] stopped')
  }
}
