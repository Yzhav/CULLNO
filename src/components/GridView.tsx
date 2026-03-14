import { useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { makeStyles, tokens, mergeClasses } from '@fluentui/react-components'
import { useThumbnail } from '../hooks/useThumbnail'
import { useSessionStore, buildFlatItems, type FlatItem } from '../stores/useSessionStore'
import { useSelectionStore } from '../stores/useSelectionStore'
import { getBaseName } from '../utils/fileUtils'
import { cullnoColors } from '../styles/tokens'

const useStyles = makeStyles({
  root: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '2px',
  },
})

const useCellStyles = makeStyles({
  cell: {
    position: 'relative',
    aspectRatio: '5/4',
    overflow: 'visible',
    cursor: 'pointer',
    padding: '6px',
    backgroundColor: tokens.colorNeutralBackground3,
    transitionProperty: 'background-color',
    transitionDuration: '0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    boxShadow: cullnoColors.selectionShadow,
  },
  picked: {
    boxShadow: cullnoColors.pickedShadow,
  },
  selectedPicked: {
    boxShadow: cullnoColors.selectedPickedShadow,
  },
  burstChild: {
    backgroundColor: cullnoColors.burstGroupBg,
  },
  burstLineTop1: {
    position: 'absolute',
    top: '12%',
    left: '20%',
    right: '20%',
    height: '2px',
    backgroundColor: cullnoColors.burstLineBright,
    boxShadow: `0 0 4px ${cullnoColors.burstLineGlow}`,
    borderRadius: '2px',
    zIndex: 2,
  },
  burstLineTop2: {
    position: 'absolute',
    top: '7%',
    left: '35%',
    right: '35%',
    height: '2px',
    backgroundColor: cullnoColors.burstLineSoft,
    borderRadius: '2px',
    zIndex: 2,
  },
  burstLineBottom1: {
    position: 'absolute',
    bottom: '12%',
    left: '20%',
    right: '20%',
    height: '2px',
    backgroundColor: cullnoColors.burstLineBright,
    boxShadow: `0 0 4px ${cullnoColors.burstLineGlow}`,
    borderRadius: '2px',
    zIndex: 2,
  },
  burstLineBottom2: {
    position: 'absolute',
    bottom: '7%',
    left: '35%',
    right: '35%',
    height: '2px',
    backgroundColor: cullnoColors.burstLineSoft,
    borderRadius: '2px',
    zIndex: 2,
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    position: 'relative',
    zIndex: 1,
    margin: 'auto',
    ':hover': {
      filter: 'brightness(1.15)',
    },
  },
  selectedImage: {
    filter: 'brightness(1.0)',
    ':hover': {
      filter: 'brightness(1.0)',
    },
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground4,
  },
})

const GridCell = memo(function GridCell({ item, isCurrent, isMultiSelected, onClick, onDoubleClick, onContextMenu }: {
  item: FlatItem
  isCurrent: boolean
  isMultiSelected: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const styles = useCellStyles()
  const dataUrl = useThumbnail(item.image.filePath, 'preview')
  const isBurstRep = item.type === 'burst-rep' && item.burstCount && item.burstCount > 1

  const highlighted = isCurrent || isMultiSelected

  return (
    <div
      className={mergeClasses(
        styles.cell,
        item.type === 'burst-child' ? styles.burstChild : undefined,
        highlighted && item.image.picked ? styles.selectedPicked
          : highlighted ? styles.selected
          : item.image.picked ? styles.picked
          : undefined,
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      role="gridcell"
      aria-selected={highlighted}
      aria-label={getBaseName(item.image.filePath)}
    >
      {isBurstRep && <>
        <div className={styles.burstLineTop2} />
        <div className={styles.burstLineTop1} />
        <div className={styles.burstLineBottom2} />
        <div className={styles.burstLineBottom1} />
      </>}
      {dataUrl ? (
        <img src={dataUrl} className={mergeClasses(
          styles.image,
          highlighted ? styles.selectedImage : undefined,
        )} draggable={false} alt="" />
      ) : (
        <div className={styles.placeholder} />
      )}
    </div>
  )
})

export function GridView() {
  const styles = useStyles()
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ isDragging: false, startY: 0, scrollTop: 0, hasMoved: false, pointerId: 0 })
  const groups = useSessionStore(s => s.groups)
  const expandedGroupIds = useSessionStore(s => s.expandedGroupIds)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const extensionFilter = useSessionStore(s => s.extensionFilter)
  const gridThumbSize = useSessionStore(s => s.gridThumbSize)

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupIds, filterPickedOnly, extensionFilter),
    [groups, expandedGroupIds, filterPickedOnly, extensionFilter],
  )

  // グリッドカラム数を動的算出
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const thumbSize = useSessionStore.getState().gridThumbSize
    const updateCols = () => {
      const containerWidth = el.clientWidth
      const colCount = Math.max(1, Math.floor(containerWidth / (thumbSize + 4)))
      useSessionStore.getState().setGridColumnCount(colCount)
    }
    updateCols()
    const observer = new ResizeObserver(updateCols)
    observer.observe(el)
    return () => observer.disconnect()
  }, [gridThumbSize])

  // Ctrl+ホイールでサムネイルサイズ変更
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const current = useSessionStore.getState().gridThumbSize
      const delta = e.deltaY > 0 ? -20 : 20
      useSessionStore.getState().setGridThumbSize(current + delta)
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // 選択セルを可視範囲に
  useEffect(() => {
    if (dragState.current.isDragging) return
    const el = gridRef.current?.parentElement
    if (!el) return
    const cells = gridRef.current?.querySelectorAll('[role="gridcell"]')
    const selected = cells?.[currentIndex] as HTMLElement | undefined
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [currentIndex])

  // ドラッグスクロール（垂直方向）
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ds = dragState.current

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      ds.isDragging = true
      ds.hasMoved = false
      ds.startY = e.clientY
      ds.scrollTop = el.scrollTop
      ds.pointerId = e.pointerId
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!ds.isDragging) return
      const dy = e.clientY - ds.startY
      if (Math.abs(dy) > 3 && !ds.hasMoved) {
        ds.hasMoved = true
        el.setPointerCapture(ds.pointerId)
        el.style.cursor = 'grabbing'
      }
      if (ds.hasMoved) {
        el.scrollTop = ds.scrollTop - dy
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!ds.isDragging) return
      ds.isDragging = false
      if (ds.hasMoved) {
        el.releasePointerCapture(e.pointerId)
      }
      el.style.cursor = ''
      // clickイベント発火を待ってからhasMovedリセット
      setTimeout(() => { ds.hasMoved = false }, 0)
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  const selectedIndices = useSelectionStore(s => s.selectedIndices)

  const handleClick = useCallback((index: number, e: React.MouseEvent) => {
    if (dragState.current.hasMoved) return
    if (e.shiftKey) {
      const cur = useSessionStore.getState().currentIndex
      useSelectionStore.getState().rangeSelect(cur, index)
    } else if (e.ctrlKey || e.metaKey) {
      const sel = useSelectionStore.getState()
      const cur = useSessionStore.getState().currentIndex
      // 現在のカーソル位置も選択に含める（初回Ctrl+Click対策）
      if (!sel.selectedIndices[cur]) {
        sel.toggleSelect(cur, true)
      }
      sel.toggleSelect(index, true)
      useSessionStore.getState().setCurrentIndex(index)
    } else {
      useSelectionStore.getState().clearSelection()
      useSessionStore.getState().setCurrentIndex(index)
    }
  }, [])

  const handleDoubleClick = useCallback((_item: FlatItem, index: number) => {
    if (dragState.current.hasMoved) return
    useSessionStore.getState().setCurrentIndex(index)
    useSessionStore.getState().setViewMode('preview')
  }, [])

  const handleContextMenu = useCallback((item: FlatItem, _index: number, e: React.MouseEvent) => {
    if (item.type === 'burst-rep' && item.group) {
      e.preventDefault()
      e.stopPropagation()
      useSessionStore.getState().toggleBurstExpand(item.group.id)
    }
    // burst-rep以外はuseKeyBindingsの既存contextmenuハンドラに委譲
  }, [])

  return (
    <div className={styles.root} ref={scrollRef}>
      <div className={styles.grid} ref={gridRef} role="grid" aria-label="画像グリッド" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridThumbSize}px, 1fr))` }}>
        {flatItems.map((item, idx) => (
          <GridCell
            key={item.image.filePath}
            item={item}
            isCurrent={idx === currentIndex}
            isMultiSelected={!!selectedIndices[idx]}
            onClick={(e) => handleClick(idx, e)}
            onDoubleClick={() => handleDoubleClick(item, idx)}
            onContextMenu={(e) => handleContextMenu(item, idx, e)}
          />
        ))}
      </div>
    </div>
  )
}
