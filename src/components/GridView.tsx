import { useEffect, useRef, useMemo, useCallback } from 'react'
import { makeStyles, tokens, mergeClasses } from '@fluentui/react-components'
import { useThumbnail } from '../hooks/useThumbnail'
import { useSessionStore, buildFlatItems, type FlatItem } from '../stores/useSessionStore'
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
    gap: '6px',
  },
})

const useCellStyles = makeStyles({
  cell: {
    position: 'relative',
    aspectRatio: '16/9',
    overflow: 'hidden',
    cursor: 'pointer',
    padding: '0px',
    backgroundColor: 'transparent',
    transitionProperty: 'background-color',
    transitionDuration: '0.1s',
    ':hover': {
      outlineWidth: '1px',
      outlineStyle: 'solid',
      outlineColor: 'rgba(255,255,255,0.3)',
      outlineOffset: '-1px',
    },
  },
  selected: {
    padding: '2px',
    backgroundColor: tokens.colorBrandForeground1,
    filter: 'drop-shadow(0 0 4px rgba(0, 120, 212, 0.6))',
  },
  picked: {
    padding: '2px',
    backgroundColor: tokens.colorPaletteYellowForeground1,
    filter: 'drop-shadow(0 0 4px rgba(255, 185, 0, 0.5))',
  },
  selectedPicked: {
    padding: '2px',
    backgroundColor: tokens.colorBrandForeground1,
    filter: 'drop-shadow(0 0 4px rgba(0, 120, 212, 0.6))',
  },
  burstChild: {
    backgroundColor: cullnoColors.burstGroupBg,
  },
  burstRep: {
    boxShadow: '3px 3px 0 1px #484848, 6px 6px 0 1px #3e3e3e, 4px 4px 8px 0 rgba(255, 255, 255, 0.08)',
    padding: '2px 8px 8px 2px',
  },
  burstChildFirst: {
    marginLeft: '4px',
  },
  burstChildLast: {
    marginRight: '4px',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground4,
  },
  trashedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
    pointerEvents: 'none',
  },
})

function GridCell({ item, isSelected, onClick, onDoubleClick, isFirstBurstChild, isLastBurstChild }: {
  item: FlatItem
  isSelected: boolean
  onClick: () => void
  onDoubleClick: () => void
  isFirstBurstChild?: boolean
  isLastBurstChild?: boolean
}) {
  const styles = useCellStyles()
  const dataUrl = useThumbnail(item.image.filePath, 'preview')
  const isBurstRep = item.type === 'burst-rep' && item.burstCount && item.burstCount > 1

  return (
    <div
      className={mergeClasses(
        styles.cell,
        isSelected && item.image.picked ? styles.selectedPicked
          : isSelected ? styles.selected
          : item.image.picked ? styles.picked
          : item.type === 'burst-child' ? styles.burstChild
          : undefined,
        isBurstRep ? styles.burstRep : undefined,
        isFirstBurstChild ? styles.burstChildFirst : undefined,
        isLastBurstChild ? styles.burstChildLast : undefined,
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role="gridcell"
      aria-selected={isSelected}
    >
      {dataUrl ? (
        <img src={dataUrl} className={styles.image} draggable={false} />
      ) : (
        <div className={styles.placeholder} />
      )}
      {item.image.trashed && <div className={styles.trashedOverlay} />}
    </div>
  )
}

export function GridView() {
  const styles = useStyles()
  const gridRef = useRef<HTMLDivElement>(null)
  const groups = useSessionStore(s => s.groups)
  const expandedGroupId = useSessionStore(s => s.expandedGroupId)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const gridThumbSize = useSessionStore(s => s.gridThumbSize)

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupId, filterPickedOnly),
    [groups, expandedGroupId, filterPickedOnly],
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
    const el = gridRef.current?.parentElement
    if (!el) return
    const cells = gridRef.current?.querySelectorAll('[role="gridcell"]')
    const selected = cells?.[currentIndex] as HTMLElement | undefined
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [currentIndex])

  const handleClick = useCallback((index: number) => {
    useSessionStore.getState().setCurrentIndex(index)
  }, [])

  const handleDoubleClick = useCallback((item: FlatItem, index: number) => {
    useSessionStore.getState().setCurrentIndex(index)
    if (item.type === 'burst-rep' && item.group) {
      useSessionStore.getState().toggleBurstExpand(item.group.id)
    } else {
      useSessionStore.getState().setViewMode('preview')
    }
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.grid} ref={gridRef} role="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridThumbSize}px, 1fr))` }}>
        {flatItems.map((item, idx) => {
          const isFirstBurstChild = item.type === 'burst-child' && (idx === 0 || flatItems[idx - 1].type !== 'burst-child')
          const isLastBurstChild = item.type === 'burst-child' && (idx === flatItems.length - 1 || flatItems[idx + 1].type !== 'burst-child')
          return (
            <GridCell
              key={item.image.filePath}
              item={item}
              isSelected={idx === currentIndex}
              onClick={() => handleClick(idx)}
              onDoubleClick={() => handleDoubleClick(item, idx)}
              isFirstBurstChild={isFirstBurstChild}
              isLastBurstChild={isLastBurstChild}
            />
          )
        })}
      </div>
    </div>
  )
}
