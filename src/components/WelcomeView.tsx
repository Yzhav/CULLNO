import { useState, useEffect, useCallback } from 'react'
import { makeStyles, tokens, Button, Spinner, Text } from '@fluentui/react-components'
import { FolderOpen24Regular, Delete24Regular, Folder24Regular } from '@fluentui/react-icons'
import { useSessionStore } from '../stores/useSessionStore'
import { loadMRU } from '../utils/mru'
import type { MRUEntry } from '../types'

const useStyles = makeStyles({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    userSelect: 'none',
    position: 'relative',
    background: 'radial-gradient(ellipse at 30% 70%, rgba(59, 130, 246, 0.06) 0%, transparent 60%), linear-gradient(145deg, #1a1a2e 0%, #1e1e1e 40%, #1e1e1e 60%, #1a1a2e 100%)',
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
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
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
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    position: 'absolute',
    bottom: '12px',
    right: '12px',
  },
})

export function WelcomeView() {
  const styles = useStyles()
  const [isDragOver, setIsDragOver] = useState(false)
  const [mruEntries, setMruEntries] = useState<MRUEntry[]>([])
  const scanning = useSessionStore(s => s.scanning)

  useEffect(() => {
    setMruEntries(loadMRU())
  }, [])

  const handleSelectFolder = useCallback(async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      useSessionStore.getState().setFolderPath(path)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
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
      {/* ドロップゾーン = 画面全体 */}
      <div
        className={isDragOver ? styles.dropZoneActive : styles.dropZone}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleSelectFolder}
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
            <div className={styles.mruList}>
              {mruEntries.map((entry, i) => (
                <div
                  key={entry.folderPath}
                  className={i === 0 ? styles.mruItemFirst : styles.mruItem}
                  onClick={(e) => handleMruClick(e, entry.folderPath)}
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

      {/* キャッシュクリア（Dev） */}
      <div className={styles.footer}>
        <Button
          appearance="subtle"
          icon={<Delete24Regular />}
          size="small"
          onClick={async (e) => {
            e.stopPropagation()
            await window.electronAPI.clearCache()
            console.log('[Dev] cache cleared')
          }}
        >
          キャッシュクリア
        </Button>
      </div>
    </div>
  )
}
