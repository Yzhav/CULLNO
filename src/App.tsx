import { useEffect, useCallback } from 'react'
import { makeStyles } from '@fluentui/react-components'
import { MainView } from './components/MainView'
import { CompareView } from './components/CompareView'
import { WelcomeView } from './components/WelcomeView'
import { ExportDialog } from './components/ExportDialog'
import { TrashDialog } from './components/TrashDialog'
import { StatusBar } from './components/StatusBar'
import { CullnoToolbar } from './components/Toolbar'
import { useKeyBindings } from './hooks/useKeyBindings'
import { useSessionStore } from './stores/useSessionStore'
import { addToMRU } from './utils/mru'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
})

export function App() {
  const styles = useStyles()
  const viewMode = useSessionStore(s => s.viewMode)
  const folderPath = useSessionStore(s => s.folderPath)
  const images = useSessionStore(s => s.images)
  const hasImages = images.length > 0
  const setFolderPath = useSessionStore(s => s.setFolderPath)
  const setScanResult = useSessionStore(s => s.setScanResult)
  const setScanning = useSessionStore(s => s.setScanning)
  const setScanError = useSessionStore(s => s.setScanError)
  const setSettings = useSessionStore(s => s.setSettings)
  const restoreSession = useSessionStore(s => s.restoreSession)

  useKeyBindings()

  // 起動時に設定を読み込み
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.loadSettings().then(settings => {
      setSettings(settings)
      if (settings.defaultFolder) {
        setFolderPath(settings.defaultFolder)
      }
    })
  }, [])

  // プレビュー一括生成の進捗リスナー
  useEffect(() => {
    if (!window.electronAPI?.onPreviewProgress) return
    const cleanup = window.electronAPI.onPreviewProgress((progress) => {
      useSessionStore.getState().setPreviewProgress(progress)
    })
    return () => { cleanup() }
  }, [])

  // フォルダ変更時にスキャン
  const scanAndLoad = useCallback(async (path: string) => {
    setScanning(true)
    setScanError(null)
    useSessionStore.getState().setPreviewProgress(null)
    try {
      const result = await window.electronAPI.scanFolder(path)
      setScanResult(result)

      // MRU更新
      const folderName = path.split(/[/\\]/).pop() ?? path
      addToMRU({
        folderPath: path,
        folderName,
        tgaCount: result.images.length,
        lastOpened: new Date().toISOString(),
      })

      const session = await window.electronAPI.loadSession(path)
      if (session) {
        restoreSession(session)
      }

      const settings = await window.electronAPI.loadSettings()
      if (settings.defaultFolder !== path) {
        await window.electronAPI.saveSettings({ ...settings, defaultFolder: path })
      }

      if (result.images.length > 0) {
        const filePaths = result.images.map(img => img.filePath)
        window.electronAPI.generateAllPreviews(filePaths, path).then(() => {
          useSessionStore.getState().setPreviewProgress(null)
        })
      }
    } catch (err) {
      setScanError(String(err))
    } finally {
      setScanning(false)
    }
  }, [setScanResult, setScanning, setScanError, restoreSession])

  useEffect(() => {
    if (folderPath) {
      scanAndLoad(folderPath)
    }
  }, [folderPath, scanAndLoad])

  // フルスクリーン切替
  useEffect(() => {
    const handler = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
    }
    window.addEventListener('cullno:fullscreen', handler)
    return () => window.removeEventListener('cullno:fullscreen', handler)
  }, [])

  // D&D対応
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const file = e.dataTransfer?.files[0]
      if (!file) return
      try {
        const folderPath = await window.electronAPI.getFilePathAndResolve(file)
        if (folderPath) {
          useSessionStore.getState().setFolderPath(folderPath)
        }
      } catch (err) {
        console.error('[D&D] error:', err)
      }
    }

    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  // マウスホイールでナビゲーション（グリッドモード以外）
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const s = useSessionStore.getState()
      if (s.viewMode === 'grid') return

      const target = e.target as HTMLElement
      if (target.closest('[data-filmstrip]')) return

      if (e.deltaY > 0) {
        s.navigateBy(1)
      } else if (e.deltaY < 0) {
        s.navigateBy(-1)
      }
    }
    window.addEventListener('wheel', handler, { passive: true })
    return () => window.removeEventListener('wheel', handler)
  }, [])

  return (
    <div className={styles.root}>
      {hasImages && <CullnoToolbar />}
      {!hasImages ? (
        <WelcomeView />
      ) : viewMode === 'compare' ? (
        <CompareView />
      ) : (
        <MainView />
      )}
      {hasImages && <StatusBar />}
      <ExportDialog />
      <TrashDialog />
    </div>
  )
}
