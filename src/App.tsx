import { useState, useEffect, useCallback, useRef } from 'react'
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
import { useSessionStore, buildFlatItems } from './stores/useSessionStore'
import { useKeybindStore } from './stores/useKeybindStore'
import { addToMRU, setMruMaxCount } from './utils/mru'
import { updateSettings } from './utils/settingsUtils'

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
  const scanRequestRef = useRef(0)
  const refreshRequestRef = useRef(0)
  const previewRequestRef = useRef(0)

  useKeyBindings()

  // 起動時にキーバインド設定を読み込み
  useEffect(() => {
    useKeybindStore.getState().loadKeybinds().catch(error => {
      console.error('[Keybinds] failed to load:', error)
    })
  }, [])

  // 起動時に設定を読み込み
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.loadSettings().then(settings => {
      setSettings(settings)
      if (settings.gridThumbSize) {
        useSessionStore.setState({
          gridThumbSize: Math.max(100, Math.min(300, settings.gridThumbSize)),
        })
      }
      if (settings.showFilmStrip === false) {
        useSessionStore.setState({ showFilmStrip: false })
      }
      if (settings.mruMaxCount) {
        setMruMaxCount(settings.mruMaxCount)
      }
      if (settings.uiScale) {
        setUiScale(Math.max(80, Math.min(150, settings.uiScale)))
      }
      if (settings.defaultFolder) {
        setFolderPath(settings.defaultFolder)
      }
    }).catch(error => {
      console.error('[Settings] failed to load:', error)
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

  const generatePreviews = useCallback((filePaths: string[], rootFolder: string) => {
    const requestId = ++previewRequestRef.current
    void window.electronAPI.generateAllPreviews(filePaths, rootFolder).catch(error => {
      console.error('[Preview] batch generation failed:', error)
    }).finally(() => {
      if (requestId === previewRequestRef.current) {
        useSessionStore.getState().setPreviewProgress(null)
      }
    })
  }, [])

  // フォルダ監視: ファイル追加/削除時のリフレッシュ
  const refreshFolder = useCallback(async () => {
    const currentPath = useSessionStore.getState().folderPath
    if (!currentPath) return
    const requestId = ++refreshRequestRef.current
    try {
      const result = await window.electronAPI.scanFolder(currentPath)
      if (requestId !== refreshRequestRef.current || useSessionStore.getState().folderPath !== currentPath) return
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
      // 表示中のファイルを維持し、フィルタ・展開状態を含むフラット配列でクランプ
      const previousFlat = buildFlatItems(state.groups, state.expandedGroupIds, state.filterPickedOnly, state.extensionFilter)
      const currentFilePath = previousFlat[state.currentIndex]?.image.filePath
      const nextFlat = buildFlatItems(mergedGroups, state.expandedGroupIds, state.filterPickedOnly, state.extensionFilter)
      const matchedIndex = currentFilePath
        ? nextFlat.findIndex(item => item.image.filePath === currentFilePath)
        : -1
      const clampedIndex = matchedIndex >= 0
        ? matchedIndex
        : Math.min(state.currentIndex, Math.max(0, nextFlat.length - 1))
      useSessionStore.setState({
        images: mergedImages,
        groups: mergedGroups,
        totalSize: result.totalSize,
        currentIndex: clampedIndex,
      })
      // 新規画像のプレビュー生成
      if (mergedImages.length > 0) {
        const filePaths = mergedImages.map(img => img.filePath)
        generatePreviews(filePaths, currentPath)
      }
    } catch (err) {
      console.error('[FolderWatcher] refresh failed:', err)
    }
  }, [generatePreviews])

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
    const requestId = ++scanRequestRef.current
    setScanning(true)
    setScanError(null)
    useSessionStore.getState().setPreviewProgress(null)
    try {
      const result = await window.electronAPI.scanFolder(path)
      if (requestId !== scanRequestRef.current || useSessionStore.getState().folderPath !== path) return
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
      if (requestId !== scanRequestRef.current || useSessionStore.getState().folderPath !== path) return
      if (session) {
        restoreSession(session)
      }

      const settings = await window.electronAPI.loadSettings()
      if (settings.defaultFolder !== path) {
        await updateSettings({ defaultFolder: path })
      }

      // 連射自動展開
      if (settings.autoExpandBurst) {
        useSessionStore.setState({ expandedGroupIds: ['__all__'] })
      }

      if (result.images.length > 0) {
        const filePaths = result.images.map(img => img.filePath)
        generatePreviews(filePaths, path)
      }
    } catch (err) {
      if (requestId === scanRequestRef.current) setScanError(String(err))
    } finally {
      if (requestId === scanRequestRef.current) setScanning(false)
    }
  }, [setScanResult, setScanning, setScanError, restoreSession, generatePreviews])

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
        document.exitFullscreen().catch(error => console.error('[Fullscreen] exit failed:', error))
      } else {
        document.documentElement.requestFullscreen().catch(error => console.error('[Fullscreen] request failed:', error))
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
