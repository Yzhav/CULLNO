import { useState, useEffect, useCallback } from 'react'
import { makeStyles, FluentProvider } from '@fluentui/react-components'
import { cullnoTheme } from './styles/tokens'
import { MainView } from './components/MainView'
import { CompareView } from './components/CompareView'
import { WelcomeView } from './components/WelcomeView'
import { ExportDialog } from './components/ExportDialog'
import { DeleteConfirmDialog } from './components/TrashDialog'
import { StatusBar } from './components/StatusBar'
import { CullnoToolbar } from './components/Toolbar'
import { useKeyBindings } from './hooks/useKeyBindings'
import { useSessionStore } from './stores/useSessionStore'
import { useKeybindStore } from './stores/useKeybindStore'
import { addToMRU, setMruMaxCount } from './utils/mru'

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
  const [uiScale, setUiScale] = useState(100)
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

  // 起動時にキーバインド設定を読み込み
  useEffect(() => {
    useKeybindStore.getState().loadKeybinds()
  }, [])

  // 起動時に設定を読み込み
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.loadSettings().then(settings => {
      setSettings(settings)
      if (settings.gridThumbSize) {
        useSessionStore.getState().setGridThumbSize(settings.gridThumbSize)
      }
      if (settings.showFilmStrip === false) {
        useSessionStore.getState().setShowFilmStrip(false)
      }
      if (settings.mruMaxCount) {
        setMruMaxCount(settings.mruMaxCount)
      }
      if (settings.uiScale) {
        setUiScale(settings.uiScale)
      }
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

  // フォルダ監視: ファイル追加/削除時のリフレッシュ
  const refreshFolder = useCallback(async () => {
    const currentPath = useSessionStore.getState().folderPath
    if (!currentPath) return
    try {
      const result = await window.electronAPI.scanFolder(currentPath)
      const state = useSessionStore.getState()
      // ピック状態をファイルパスベースでマージ
      const pickedSet = new Set(
        state.images.filter(img => img.picked).map(img => img.filePath)
      )
      const mergedImages = result.images.map(img => ({
        ...img,
        picked: pickedSet.has(img.filePath),
      }))
      const mergedGroups = result.groups.map(g => ({
        ...g,
        images: g.images.map(img => ({
          ...img,
          picked: pickedSet.has(img.filePath),
        })),
        representative: {
          ...g.representative,
          picked: pickedSet.has(g.representative.filePath),
        },
      }))
      // currentIndex をクランプ
      const flatCount = mergedImages.length
      const clampedIndex = Math.min(state.currentIndex, Math.max(0, flatCount - 1))
      useSessionStore.setState({
        images: mergedImages,
        groups: mergedGroups,
        totalSize: result.totalSize,
        currentIndex: clampedIndex,
      })
      // 新規画像のプレビュー生成
      if (mergedImages.length > 0) {
        const filePaths = mergedImages.map(img => img.filePath)
        window.electronAPI.generateAllPreviews(filePaths, currentPath).then(() => {
          useSessionStore.getState().setPreviewProgress(null)
        })
      }
    } catch (err) {
      console.error('[FolderWatcher] refresh failed:', err)
    }
  }, [])

  // onFolderChanged リスナー
  useEffect(() => {
    if (!window.electronAPI?.onFolderChanged) return
    const cleanup = window.electronAPI.onFolderChanged(() => {
      refreshFolder()
    })
    return () => { cleanup() }
  }, [refreshFolder])

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

      // 連射自動展開
      if (settings.autoExpandBurst) {
        useSessionStore.setState({ expandedGroupIds: ['__all__'] })
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

  // UIスケール変更イベント
  useEffect(() => {
    const handleScaleChange = (e: Event) => {
      const newScale = (e as CustomEvent).detail as number
      setUiScale(newScale)
    }
    window.addEventListener('cullno:scale-change', handleScaleChange)
    return () => {
      window.removeEventListener('cullno:scale-change', handleScaleChange)
    }
  }, [])

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
      if (target.closest('[role="dialog"]')) return

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
    <FluentProvider theme={cullnoTheme} style={{ height: '100%', zoom: uiScale !== 100 ? `${uiScale}%` : undefined }}>
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
        <DeleteConfirmDialog />
      </div>
    </FluentProvider>
  )
}
