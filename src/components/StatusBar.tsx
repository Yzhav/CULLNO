import { useMemo, useCallback } from 'react'
import { Text, ProgressBar, Slider, makeStyles, tokens } from '@fluentui/react-components'
import { useSessionStore } from '../stores/useSessionStore'
import { useKeybindStore } from '../stores/useKeybindStore'
import type { ViewMode, KeybindConfig } from '../types'
import { getKeyDisplay } from '../utils/keybindUtils'

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
  slider: {
    width: '100px',
    minWidth: '100px',
  },
  sliderGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  extBreakdown: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground4,
  },
  extItem: {
    cursor: 'pointer',
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: '1px',
    paddingBottom: '1px',
    borderRadius: tokens.borderRadiusSmall,
    transition: 'background-color 0.1s, color 0.1s',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      color: tokens.colorNeutralForeground2,
    },
  },
  extItemActive: {
    cursor: 'pointer',
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: '1px',
    paddingBottom: '1px',
    borderRadius: tokens.borderRadiusSmall,
    color: tokens.colorBrandForeground1,
    fontWeight: 600,
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
  },
  shortcutNav: {
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase100,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '600px',
    opacity: 0.6,
  },
})

function getShortcutHints(viewMode: ViewMode, kb: KeybindConfig): string[] {
  const hints: string[] = []
  const d = (key: string) => getKeyDisplay(key)

  if (viewMode === 'grid') {
    hints.push(`${d(kb.pick)}: ピック`)
    hints.push(`${d(kb.burstToggle)}/右クリック: 連射展開`)
    hints.push(`${d(kb.trash)}: ゴミ箱`)
    hints.push(`${d(kb.modeTransition)}: モード切替`)
  } else if (viewMode === 'preview') {
    hints.push(`${d(kb.pick)}: ピック`)
    hints.push(`${d(kb.burstToggle)}: 連射展開`)
    hints.push(`${d(kb.trash)}: ゴミ箱`)
    hints.push(`${d(kb.modeTransition)}: モード切替`)
  } else if (viewMode === 'compare') {
    hints.push(`${d(kb.pick)}: ピック入替`)
    hints.push(`${d(kb.modeTransition)}: 戻る`)
  }

  return hints
}

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
  const keybinds = useKeybindStore(s => s.keybinds)
  const showShortcutNav = useKeybindStore(s => s.showShortcutNav)

  const gridThumbSize = useSessionStore(s => s.gridThumbSize)
  const extensionFilter = useSessionStore(s => s.extensionFilter)

  const totalCount = images.length
  const pickedCount = useMemo(() => images.filter(i => i.picked).length, [images])

  // フォルダ内の拡張子別枚数を算出
  const extCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const img of images) {
      const ext = img.filePath.split('.').pop()?.toLowerCase() ?? ''
      const key = (ext === 'jpg' || ext === 'jpeg') ? 'jpeg' : ext
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
  }, [images])
  const isMultiExt = extCounts.length > 1
  const shortcutHints = useMemo(() => getShortcutHints(viewMode, keybinds), [viewMode, keybinds])

  const onThumbSizeChange = useCallback((_: unknown, data: { value: number }) => {
    useSessionStore.getState().setGridThumbSize(data.value)
  }, [])

  const progressPct = previewProgress
    ? previewProgress.completed / previewProgress.total
    : null

  return (
    <div className={styles.root} role="status" aria-label="ステータスバー">
      <div className={styles.section}>
        {scanning ? (
          <Text className={styles.label}>スキャン中...</Text>
        ) : (
          <>
            <Text className={styles.label}>
              {totalCount > 0 ? `${currentIndex + 1} / ${totalCount}` : 'フォルダ未選択'}
            </Text>
            {isMultiExt && (
              <span className={styles.extBreakdown}>
                (
                {extCounts.map(([ext, count], i) => (
                  <span key={ext}>
                    {i > 0 && <span style={{ opacity: 0.4 }}> · </span>}
                    <span
                      className={extensionFilter === ext ? styles.extItemActive : styles.extItem}
                      onClick={() => {
                        const next = extensionFilter === ext ? null : ext
                        useSessionStore.getState().setExtensionFilter(next)
                      }}
                      role="button"
                      aria-pressed={extensionFilter === ext}
                    >
                      {ext.toUpperCase()} {count}
                    </span>
                  </span>
                ))}
                )
              </span>
            )}
            {pickedCount > 0 && (
              <Text className={styles.picked}>★ {pickedCount} picked</Text>
            )}
            {previewProgress && previewProgress.completed < previewProgress.total && (
              <div className={styles.progressContainer}>
                <ProgressBar className={styles.progressBar} value={progressPct ?? undefined} />
                <Text className={styles.label}>
                  プレビュー生成 {previewProgress.completed}/{previewProgress.total}
                </Text>
              </div>
            )}
            {showShortcutNav && totalCount > 0 && (
              <Text className={styles.shortcutNav}>
                {shortcutHints.join('  ·  ')}
              </Text>
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
        {viewMode === 'grid' && (
          <div className={styles.sliderGroup}>
            <Slider
              className={styles.slider}
              min={100}
              max={300}
              step={20}
              value={gridThumbSize}
              onChange={onThumbSizeChange}
              size="small"
              aria-label="サムネイルサイズ"
            />
          </div>
        )}
      </div>
    </div>
  )
}
