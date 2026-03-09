import { useMemo } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import { PreviewPane } from './PreviewPane'
import { useSessionStore, buildFlatItems } from '../stores/useSessionStore'

const useStyles = makeStyles({
  root: {
    flex: 1,
    display: 'flex',
    gap: '2px',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  pane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    textAlign: 'center',
    padding: '4px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  activeLabel: {
    color: tokens.colorBrandForeground1,
  },
})

export function CompareView() {
  const styles = useStyles()
  const compareLeftIndex = useSessionStore(s => s.compareLeftIndex)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const groups = useSessionStore(s => s.groups)
  const expandedGroupId = useSessionStore(s => s.expandedGroupId)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupId, filterPickedOnly),
    [groups, expandedGroupId, filterPickedOnly],
  )

  const leftItem = flatItems[compareLeftIndex]
  const rightItem = flatItems[currentIndex]

  return (
    <div className={styles.root}>
      <div className={styles.pane}>
        <div className={styles.label}>
          固定 — {leftItem?.image.filePath.split(/[/\\]/).pop()?.replace('.tga', '') ?? ''}
        </div>
        <PreviewPane
          filePath={leftItem?.image.filePath ?? null}
          trashed={leftItem?.image.trashed}
        />
      </div>
      <div className={styles.pane}>
        <div className={`${styles.label} ${styles.activeLabel}`}>
          ← → で送る — {rightItem?.image.filePath.split(/[/\\]/).pop()?.replace('.tga', '') ?? ''}
        </div>
        <PreviewPane
          filePath={rightItem?.image.filePath ?? null}
          trashed={rightItem?.image.trashed}
          onClickImage={() => useSessionStore.getState().compareSwapPick()}
        />
      </div>
    </div>
  )
}
