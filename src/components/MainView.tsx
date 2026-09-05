import { useMemo } from 'react'
import { Button, makeStyles, tokens } from '@fluentui/react-components'
import { ChevronLeft24Regular, ChevronRight24Regular } from '@fluentui/react-icons'
import { PreviewPane } from './PreviewPane'
import { FilmStrip } from './FilmStrip'
import { GridView } from './GridView'

import { usePrefetchNeighbors } from '../hooks/useThumbnail'
import { useSessionStore, buildFlatItems } from '../stores/useSessionStore'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  navigation: {
    minWidth: '56px', width: '56px', height: '100%', flexShrink: 0,
    borderRadius: 0, color: tokens.colorNeutralForeground3, touchAction: 'manipulation',
  },
  previewArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
})

export function MainView() {
  const styles = useStyles()
  const viewMode = useSessionStore(s => s.viewMode)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const groups = useSessionStore(s => s.groups)
  const expandedGroupIds = useSessionStore(s => s.expandedGroupIds)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const extensionFilter = useSessionStore(s => s.extensionFilter)

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupIds, filterPickedOnly, extensionFilter),
    [groups, expandedGroupIds, filterPickedOnly, extensionFilter],
  )

  const showFilmStrip = useSessionStore(s => s.showFilmStrip)
  const currentItem = flatItems[currentIndex]

  // プレビューモード時のみプリフェッチ
  const neighborImages = useMemo(() => {
    if (viewMode === 'grid') return []
    const neighborItems = []
    for (let d = -3; d <= 5; d++) {
      if (d === 0) continue
      const item = flatItems[currentIndex + d]
      neighborItems.push(item?.image ?? null)
    }
    return neighborItems
  }, [flatItems, currentIndex, viewMode])
  usePrefetchNeighbors(neighborImages)

  return (
    <div className={styles.root} role="main">

      {viewMode === 'grid' ? (
        <GridView />
      ) : (
        <>
          <div className={styles.previewArea}>
            <Button className={styles.navigation} appearance="subtle"
              icon={<ChevronLeft24Regular />} aria-label="前の写真"
              disabled={!currentItem || currentIndex === 0}
              onClick={() => useSessionStore.getState().navigateBy(-1)} />
            <PreviewPane
              filePath={currentItem?.image.filePath ?? null}
              modifiedAt={currentItem?.image.modifiedAt}
              onClickImage={() => useSessionStore.getState().togglePick()}
            />
            <Button className={styles.navigation} appearance="subtle"
              icon={<ChevronRight24Regular />} aria-label="次の写真"
              disabled={!currentItem || currentIndex >= flatItems.length - 1}
              onClick={() => useSessionStore.getState().navigateBy(1)} />
          </div>
          {showFilmStrip && <FilmStrip />}
        </>
      )}
    </div>
  )
}
