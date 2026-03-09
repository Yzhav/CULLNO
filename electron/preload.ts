import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ThumbnailSize, SessionData, AppSettings, ScanResult, ExportProgress } from '../src/types'

const api = {
  // フォルダ操作
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath: string): Promise<ScanResult> =>
    ipcRenderer.invoke('scan-folder', folderPath),
  listDateFolders: (basePath: string): Promise<string[]> =>
    ipcRenderer.invoke('list-date-folders', basePath),

  // サムネイル
  getThumbnail: (filePath: string, size: ThumbnailSize, rootFolder: string): Promise<string | null> =>
    ipcRenderer.invoke('get-thumbnail', filePath, size, rootFolder),

  // セッション
  saveSession: (data: SessionData): Promise<void> =>
    ipcRenderer.invoke('save-session', data),
  loadSession: (folderPath: string): Promise<SessionData | null> =>
    ipcRenderer.invoke('load-session', folderPath),

  // 設定
  loadSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('load-settings'),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('save-settings', settings),

  // ファイル操作
  moveToTrash: (filePaths: string[]): Promise<{ path: string; success: boolean }[]> =>
    ipcRenderer.invoke('move-to-trash', filePaths),
  exportPng: (filePaths: string[], outputDir: string): Promise<{ success: boolean; count: number }> =>
    ipcRenderer.invoke('export-png', filePaths, outputDir),
  onExportProgress: (callback: (progress: ExportProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ExportProgress) => callback(progress)
    ipcRenderer.on('export-progress', handler)
    return () => ipcRenderer.removeListener('export-progress', handler)
  },

  // 一括プレビュー生成
  generateAllPreviews: (filePaths: string[], rootFolder: string): Promise<{ completed: number; total: number }> =>
    ipcRenderer.invoke('generate-all-previews', filePaths, rootFolder),
  onPreviewProgress: (callback: (progress: { completed: number; total: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { completed: number; total: number }) => callback(progress)
    ipcRenderer.on('preview-progress', handler)
    return () => ipcRenderer.removeListener('preview-progress', handler)
  },

  // フォルダ内のTGAファイル数を取得
  countTgaFiles: (folderPath: string): Promise<number> =>
    ipcRenderer.invoke('count-tga-files', folderPath),

  // キャッシュクリア（開発用）
  clearCache: (): Promise<boolean> =>
    ipcRenderer.invoke('clear-cache'),

  // エクスプローラ
  openInExplorer: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('open-in-explorer', folderPath),

  // D&D: renderer側でdropイベント取得 → Fileオブジェクトをここに渡す → パス解決
  getFilePathAndResolve: (file: File): Promise<string | null> => {
    try {
      const filePath = webUtils.getPathForFile(file)
      console.log('[D&D preload] getPathForFile:', filePath)
      if (!filePath) return Promise.resolve(null)
      return ipcRenderer.invoke('resolve-drop-path', filePath) as Promise<string | null>
    } catch (err) {
      console.error('[D&D preload] getPathForFile failed:', err)
      return Promise.resolve(null)
    }
  },

  // ウィンドウ
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('electronAPI', api)
