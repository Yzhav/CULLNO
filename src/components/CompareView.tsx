import { useMemo, useState, useEffect } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import { PreviewPane } from './PreviewPane'
import { FilmStrip } from './FilmStrip'
import { useSessionStore, buildFlatItems } from '../stores/useSessionStore'
import { getBaseName } from '../utils/fileUtils'
import { cullnoColors } from '../styles/tokens'

const useStyles = makeStyles({
  outer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  root: {
    flex: 1,
    display: 'flex',
    gap: '2px',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
  },
  pane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  label: {
    textAlign: 'center',
    padding: '4px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  pickFlash: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 10,
    boxShadow: cullnoColors.pickFlashShadow,
    opacity: 0,
    animationName: {
      '0%': { opacity: 1 },
      '100%': { opacity: 0 },
    },
    animationDuration: '0.6s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'forwards',
  },
})

export function CompareView() {
  const styles = useStyles()
  const compareLeftIndex = useSessionStore(s => s.compareLeftIndex)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const groups = useSessionStore(s => s.groups)
  const expandedGroupIds = useSessionStore(s => s.expandedGroupIds)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const extensionFilter = useSessionStore(s => s.extensionFilter)
  const showFilmStrip = useSessionStore(s => s.showFilmStrip)
  const [flashKey, setFlashKey] = useState(0)

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupIds, filterPickedOnly, extensionFilter),
    [groups, expandedGroupIds, filterPickedOnly, extensionFilter],
  )

  const leftItem = flatItems[compareLeftIndex]
  const rightItem = flatItems[currentIndex]

  // ピックアクションのイベントを受けてフラッシュ
  useEffect(() => {
    const handler = () => setFlashKey(k => k + 1)
    window.addEventListener('cullno:compare-picked', handler)
    return () => window.removeEventListener('cullno:compare-picked', handler)
  }, [])

  return (
    <div className={styles.outer}>
      <div className={styles.root}>
        <div className={styles.pane} role="region" aria-label="比較: 左（固定）">
          <div className={styles.label}>
            {leftItem ? getBaseName(leftItem.image.filePath) : ''}
          </div>
          <PreviewPane
            filePath={leftItem?.image.filePath ?? null}
          />
        </div>
        <div className={styles.pane} role="region" aria-label="比較: 右（送り）">
          <div className={styles.label}>
            {rightItem ? getBaseName(rightItem.image.filePath) : ''}
          </div>
          <PreviewPane
            filePath={rightItem?.image.filePath ?? null}
            onClickImage={() => useSessionStore.getState().compareSwapPick()}
          />
          {flashKey > 0 && <div key={flashKey} className={styles.pickFlash} />}
        </div>
      </div>
      {showFilmStrip && <FilmStrip />}
    </div>
  )
}
