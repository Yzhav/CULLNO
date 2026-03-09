import { useMemo } from 'react'
import { Text, ProgressBar, makeStyles, tokens } from '@fluentui/react-components'
import { useSessionStore } from '../stores/useSessionStore'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '28px',
    paddingLeft: '12px',
    paddingRight: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    flexShrink: 0,
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  label: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  picked: {
    color: tokens.colorPaletteYellowForeground1,
    fontSize: tokens.fontSizeBase200,
    fontWeight: 600,
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  progressBar: {
    width: '120px',
  },
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function StatusBar() {
  const styles = useStyles()
  const images = useSessionStore(s => s.images)
  const totalSize = useSessionStore(s => s.totalSize)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const folderPath = useSessionStore(s => s.folderPath)
  const scanning = useSessionStore(s => s.scanning)
  const viewMode = useSessionStore(s => s.viewMode)
  const previewProgress = useSessionStore(s => s.previewProgress)

  const totalCount = images.length
  const pickedCount = useMemo(() => images.filter(i => i.picked).length, [images])

  const modeLabel = viewMode === 'compare' ? '比較モード' : ''
  const progressPct = previewProgress
    ? previewProgress.completed / previewProgress.total
    : null

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        {scanning ? (
          <Text className={styles.label}>スキャン中...</Text>
        ) : (
          <>
            <Text className={styles.label}>
              {totalCount > 0 ? `${currentIndex + 1} / ${totalCount}` : 'フォルダ未選択'}
            </Text>
            {pickedCount > 0 && (
              <Text className={styles.picked}>★ {pickedCount} picked</Text>
            )}
            {modeLabel && <Text className={styles.label}>[{modeLabel}]</Text>}
            {previewProgress && progressPct !== null && progressPct < 1 && (
              <div className={styles.progressContainer}>
                <ProgressBar className={styles.progressBar} value={progressPct} />
                <Text className={styles.label}>
                  プレビュー生成 {previewProgress.completed}/{previewProgress.total}
                </Text>
              </div>
            )}
          </>
        )}
      </div>
      <div className={styles.section}>
        {totalSize > 0 && (
          <Text className={styles.label}>{formatBytes(totalSize)}</Text>
        )}
        {folderPath && (
          <Text className={styles.label} title={folderPath}>
            {folderPath.length > 50 ? '...' + folderPath.slice(-47) : folderPath}
          </Text>
        )}
      </div>
    </div>
  )
}
