import { useMemo } from 'react'
import { makeStyles } from '@fluentui/react-components'
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
  const expandedGroupId = useSessionStore(s => s.expandedGroupId)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const extensionFilter = useSessionStore(s => s.extensionFilter)

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupId, filterPickedOnly, extensionFilter),
    [groups, expandedGroupId, filterPickedOnly, extensionFilter],
  )

  const showFilmStrip = useSessionStore(s => s.showFilmStrip)
  const currentItem = flatItems[currentIndex]

  // プレビューモード時のみプリフェッチ
  const neighborPaths = useMemo(() => {
    if (viewMode === 'grid') return []
    const paths: (string | null)[] = []
    for (let d = -3; d <= 5; d++) {
      if (d === 0) continue
      const item = flatItems[currentIndex + d]
      paths.push(item?.image.filePath ?? null)
    }
    return paths
  }, [flatItems, currentIndex, viewMode])
  usePrefetchNeighbors(neighborPaths)

  return (
    <div className={styles.root} role="main">

      {viewMode === 'grid' ? (
        <GridView />
      ) : (
        <>
          <div className={styles.previewArea}>
            <PreviewPane
              filePath={currentItem?.image.filePath ?? null}
              onClickImage={() => useSessionStore.getState().togglePick()}
            />
          </div>
          {showFilmStrip && <FilmStrip />}
        </>
      )}
    </div>
  )
}
