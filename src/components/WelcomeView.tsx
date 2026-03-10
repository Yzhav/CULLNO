import { useState, useEffect, useCallback } from 'react'
import { makeStyles, tokens, Spinner, Text } from '@fluentui/react-components'
import { FolderOpen24Regular, Folder24Regular } from '@fluentui/react-icons'
import { useSessionStore } from '../stores/useSessionStore'
import { loadMRU } from '../utils/mru'
import { cullnoColors } from '../styles/tokens'
import type { MRUEntry } from '../types'
import { folderDialogGuard, withDialogGuard } from '../utils/dialogGuard'

export { folderDialogGuard }

const useStyles = makeStyles({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    userSelect: 'none',
    position: 'relative',
    overflow: 'hidden',
    background: `radial-gradient(ellipse at 30% 70%, ${cullnoColors.welcomeAccent} 0%, transparent 60%), linear-gradient(145deg, ${cullnoColors.welcomeBgDark} 0%, ${tokens.colorNeutralBackground1} 40%, ${tokens.colorNeutralBackground1} 60%, ${cullnoColors.welcomeBgDark} 100%)`,
  },
  backgroundImage: {
    position: 'absolute',
    inset: 0,
    objectFit: 'cover' as const,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  backgroundOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
  },
  dropZone: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    margin: '24px',
    borderRadius: tokens.borderRadiusXLarge,
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
    position: 'relative',
    zIndex: 2,
  },
  dropZoneActive: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    margin: '24px',
    borderRadius: tokens.borderRadiusXLarge,
    border: `2px dashed ${tokens.colorBrandForeground1}`,
    backgroundColor: cullnoColors.dropzoneActiveBg,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
    position: 'relative',
    zIndex: 2,
  },
  dropContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  dropIcon: {
    color: tokens.colorNeutralForeground3,
  },
  dropTitle: {
    fontSize: tokens.fontSizeBase500,
    color: tokens.colorNeutralForeground2,
  },
  dropHint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground4,
  },
  mruSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
    maxWidth: '480px',
    marginTop: '24px',
  },
  mruHeader: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    paddingLeft: '4px',
  },
  mruList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  mruItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    paddingLeft: '12px',
    paddingRight: '12px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    ':hover': {
      backgroundColor: cullnoColors.surfaceHover,
    },
  },
  mruItemFirst: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    paddingLeft: '12px',
    paddingRight: '12px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    backgroundColor: cullnoColors.surfaceSubtle,
    ':hover': {
      backgroundColor: cullnoColors.surfaceSubtleHover,
    },
  },
  mruIcon: {
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  mruInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  mruName: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mruMeta: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground4,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '16px',
    paddingRight: '12px',
    paddingBottom: '8px',
    flexShrink: 0,
    position: 'relative',
    zIndex: 2,
  },
  version: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground4,
  },
})

export function WelcomeView() {
  const styles = useStyles()
  const [isDragOver, setIsDragOver] = useState(false)
  const [mruEntries, setMruEntries] = useState<MRUEntry[]>([])
  const [appVersion, setAppVersion] = useState('')
  const [homeBackground, setHomeBackground] = useState<string | null>(null)
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null)
  const scanning = useSessionStore(s => s.scanning)

  useEffect(() => {
    setMruEntries(loadMRU())
    window.electronAPI.getAppVersion().then(v => setAppVersion(v))
    window.electronAPI.loadSettings().then(settings => {
      if (settings.homeBackground) setHomeBackground(settings.homeBackground)
    })
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      setHomeBackground((e as CustomEvent).detail as string | null)
    }
    window.addEventListener('cullno:home-bg-change', handler)
    return () => window.removeEventListener('cullno:home-bg-change', handler)
  }, [])

  useEffect(() => {
    if (!homeBackground) { setBgDataUrl(null); return }
    // rootFolder に親ディレクトリを渡してキャッシュパスを一意にする
    const parentDir = homeBackground.replace(/[/\\][^/\\]+$/, '')
    window.electronAPI.getThumbnail(homeBackground, 'full', parentDir).then(url => {
      if (url) setBgDataUrl(url)
    })
  }, [homeBackground])

  const handleSelectFolder = useCallback(() => {
    withDialogGuard(folderDialogGuard, async () => {
      const path = await window.electronAPI.selectFolder()
      if (path) useSessionStore.getState().setFolderPath(path)
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer?.files[0]
    if (!file) return
    try {
      const folderPath = await window.electronAPI.getFilePathAndResolve(file)
      if (folderPath) {
        useSessionStore.getState().setFolderPath(folderPath)
      }
    } catch (err) {
      console.error('[D&D WelcomeView] error:', err)
    }
  }, [])

  const handleMruClick = useCallback((e: React.MouseEvent, folderPath: string) => {
    e.stopPropagation()
    useSessionStore.getState().setFolderPath(folderPath)
  }, [])

  if (scanning) {
    return (
      <div className={styles.root}>
        <div className={styles.dropZone} style={{ cursor: 'default' }}>
          <Spinner size="large" label="スキャン中..." />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {/* 背景画像 */}
      {bgDataUrl && (
        <>
          <img
            className={styles.backgroundImage}
            src={bgDataUrl}
            alt=""
            draggable={false}
          />
          <div
            className={styles.backgroundOverlay}
            style={{ backgroundColor: 'var(--cullno-home-bg-overlay)' }}
          />
        </>
      )}

      {/* ドロップゾーン = 画面全体 */}
      <div
        className={isDragOver ? styles.dropZoneActive : styles.dropZone}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleSelectFolder}
        role="button"
        aria-label="フォルダを開く - ドラッグ＆ドロップまたはクリック"
        tabIndex={0}
      >
        {/* アイコン + テキスト */}
        <div className={styles.dropContent}>
          <FolderOpen24Regular className={styles.dropIcon} style={{ fontSize: '48px', width: '48px', height: '48px' }} />
          <Text className={styles.dropTitle} style={{ fontWeight: 600 }}>フォルダを開く</Text>
          <div className={styles.dropHint}>ドラッグ＆ドロップ またはクリックで選択</div>
        </div>

        {/* MRUリスト（ゾーン内下部） */}
        {mruEntries.length > 0 && (
          <div className={styles.mruSection}>
            <div className={styles.mruHeader}>最近開いたフォルダ</div>
            <div className={styles.mruList} role="list" aria-label="最近開いたフォルダ">
              {mruEntries.map((entry, i) => (
                <div
                  key={entry.folderPath}
                  className={i === 0 ? styles.mruItemFirst : styles.mruItem}
                  onClick={(e) => handleMruClick(e, entry.folderPath)}
                  role="listitem"
                >
                  <Folder24Regular className={styles.mruIcon} />
                  <div className={styles.mruInfo}>
                    <div className={styles.mruName}>{entry.folderName}</div>
                    <div className={styles.mruMeta}>{entry.tgaCount}枚</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className={styles.footer}>
        {appVersion && <Text className={styles.version}>Cullno v{appVersion}</Text>}
      </div>
    </div>
  )
}
