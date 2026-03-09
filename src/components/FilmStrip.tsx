import { useEffect, useRef, useCallback, useMemo } from 'react'
import { makeStyles, tokens, mergeClasses } from '@fluentui/react-components'
import { useThumbnail } from '../hooks/useThumbnail'
import { useSessionStore, buildFlatItems, type FlatItem } from '../stores/useSessionStore'
import { cullnoColors } from '../styles/tokens'

const THUMB_WIDTH = 120
const THUMB_HEIGHT = 68
const THUMB_GAP = 4

const useStyles = makeStyles({
  root: {
    height: `${THUMB_HEIGHT + 24}px`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
    '::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '20px',
      background: `linear-gradient(to right, ${tokens.colorNeutralBackground3}, transparent)`,
      zIndex: 1,
      pointerEvents: 'none',
    },
    '::after': {
      content: '""',
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: '20px',
      background: `linear-gradient(to left, ${tokens.colorNeutralBackground3}, transparent)`,
      zIndex: 1,
      pointerEvents: 'none',
    },
  },
  scrollContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: `${THUMB_GAP}px`,
    padding: '0 8px',
    overflowX: 'auto',
    overflowY: 'hidden',
    height: '100%',
    scrollBehavior: 'smooth',
    '::-webkit-scrollbar': {
      height: '4px',
    },
    '::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: '2px',
    },
  },
  burstGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: `${THUMB_GAP}px`,
    backgroundColor: cullnoColors.burstGroupBg,
    padding: '2px 8px 2px 4px',
    borderRadius: '2px',
    flexShrink: 0,
    marginLeft: '4px',
    marginRight: '4px',
    borderLeft: `2px solid ${tokens.colorBrandForeground1}`,
  },
  burstGroupLabel: {
    color: tokens.colorNeutralForeground4,
    fontSize: '10px',
    flexShrink: 0,
    padding: '0 2px',
  },
})

const useThumbStyles = makeStyles({
  wrapper: {
    position: 'relative',
    flexShrink: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    padding: '0px',
    backgroundColor: 'transparent',
    transitionProperty: 'padding, background-color',
    transitionDuration: '0.1s',
  },
  active: {
    padding: '2px',
    backgroundColor: tokens.colorBrandForeground1,
    filter: 'drop-shadow(0 0 4px rgba(0, 120, 212, 0.6))',
  },
  inactive: {
    ':hover': {
      outlineWidth: '1px',
      outlineStyle: 'solid',
      outlineColor: 'rgba(255,255,255,0.3)',
      outlineOffset: '-1px',
    },
  },
  picked: {
    padding: '2px',
    backgroundColor: tokens.colorPaletteYellowForeground1,
    filter: 'drop-shadow(0 0 4px rgba(255, 185, 0, 0.5))',
  },
  activePicked: {
    padding: '2px',
    backgroundColor: tokens.colorBrandForeground1,
    filter: 'drop-shadow(0 0 4px rgba(0, 120, 212, 0.6))',
  },
  image: {
    width: `${THUMB_WIDTH}px`,
    height: `${THUMB_HEIGHT}px`,
    objectFit: 'contain',
    display: 'block',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  placeholder: {
    width: `${THUMB_WIDTH}px`,
    height: `${THUMB_HEIGHT}px`,
    backgroundColor: tokens.colorNeutralBackground4,
  },
  burstRep: {
    boxShadow: '3px 3px 0 1px #484848, 6px 6px 0 1px #3e3e3e, 4px 4px 8px 0 rgba(255, 255, 255, 0.08)',
    marginRight: '8px',
  },
  trashedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
  },
})

function FilmStripThumb({ item, isActive, onClick, onDoubleClick }: {
  item: FlatItem
  isActive: boolean
  onClick: () => void
  onDoubleClick: () => void
}) {
  const styles = useThumbStyles()
  const dataUrl = useThumbnail(item.image.filePath, 'micro')
  const ref = useRef<HTMLDivElement>(null)
  const isBurstRep = item.type === 'burst-rep' && item.burstCount && item.burstCount > 1

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [isActive])

  return (
    <div
      ref={ref}
      className={mergeClasses(
        styles.wrapper,
        isActive && item.image.picked ? styles.activePicked
          : isActive ? styles.active
          : item.image.picked ? styles.picked
          : styles.inactive,
        isBurstRep ? styles.burstRep : undefined,
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {dataUrl ? (
        <img src={dataUrl} className={styles.image} draggable={false} />
      ) : (
        <div className={styles.placeholder} />
      )}
      {item.image.trashed && (
        <div className={styles.trashedOverlay} />
      )}
    </div>
  )
}

type FilmSegment =
  | { type: 'thumbs'; items: Array<{ item: FlatItem; idx: number }> }
  | { type: 'burst-group'; items: Array<{ item: FlatItem; idx: number }>; groupId: string }

export function FilmStrip() {
  const styles = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const groups = useSessionStore(s => s.groups)
  const expandedGroupId = useSessionStore(s => s.expandedGroupId)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0, hasMoved: false, pointerId: 0 })

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupId, filterPickedOnly),
    [groups, expandedGroupId, filterPickedOnly],
  )

  const segments = useMemo(() => {
    const result: FilmSegment[] = []
    let currentThumbs: Array<{ item: FlatItem; idx: number }> = []

    for (let i = 0; i < flatItems.length; i++) {
      const item = flatItems[i]
      if (item.type === 'burst-child') {
        if (currentThumbs.length > 0) {
          result.push({ type: 'thumbs', items: currentThumbs })
          currentThumbs = []
        }
        const burstItems: Array<{ item: FlatItem; idx: number }> = []
        while (i < flatItems.length && flatItems[i].type === 'burst-child') {
          burstItems.push({ item: flatItems[i], idx: i })
          i++
        }
        i--
        result.push({ type: 'burst-group', items: burstItems, groupId: burstItems[0].item.group!.id })
      } else {
        currentThumbs.push({ item, idx: i })
      }
    }
    if (currentThumbs.length > 0) {
      result.push({ type: 'thumbs', items: currentThumbs })
    }
    return result
  }, [flatItems])

  // ネイティブリスナーで登録（passive: false でpreventDefaultを有効化）
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY > 0) {
        useSessionStore.getState().navigateBy(1)
      } else if (e.deltaY < 0) {
        useSessionStore.getState().navigateBy(-1)
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ドラッグスクロール
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ds = dragState.current

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      ds.isDragging = true
      ds.hasMoved = false
      ds.startX = e.clientX
      ds.scrollLeft = el.scrollLeft
      // setPointerCapture は遅延（ドラッグ開始時に呼ぶ）
      ds.pointerId = e.pointerId
      el.style.scrollBehavior = 'auto'
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!ds.isDragging) return
      const dx = e.clientX - ds.startX
      if (Math.abs(dx) > 3 && !ds.hasMoved) {
        ds.hasMoved = true
        el.setPointerCapture(ds.pointerId)
        el.style.cursor = 'grabbing'
      }
      if (ds.hasMoved) {
        el.scrollLeft = ds.scrollLeft - dx
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!ds.isDragging) return
      ds.isDragging = false
      if (ds.hasMoved) {
        el.releasePointerCapture(e.pointerId)
      }
      el.style.cursor = ''
      el.style.scrollBehavior = 'smooth'
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

  const handleClick = useCallback((_item: FlatItem, index: number) => {
    if (dragState.current.hasMoved) return
    useSessionStore.getState().setCurrentIndex(index)
  }, [])

  const handleDoubleClick = useCallback((item: FlatItem) => {
    if (item.type === 'burst-rep' && item.group) {
      useSessionStore.getState().toggleBurstExpand(item.group.id)
    } else if (item.type === 'burst-child' && item.group) {
      // burst-child ダブルクリックで折り畳み（トグル）
      useSessionStore.getState().toggleBurstExpand(item.group.id)
    }
  }, [])

  return (
    <div className={styles.root} data-filmstrip>
      <div className={styles.scrollContainer} ref={scrollRef}>
        {segments.map((seg, segIdx) => {
          if (seg.type === 'thumbs') {
            return seg.items.map(({ item, idx }) => (
              <FilmStripThumb
                key={item.image.filePath}
                item={item}
                isActive={idx === currentIndex}
                onClick={() => handleClick(item, idx)}
                onDoubleClick={() => handleDoubleClick(item)}
              />
            ))
          } else {
            return (
              <div key={`burst-${seg.groupId}`} className={styles.burstGroup}>
                <span className={styles.burstGroupLabel}>×{seg.items.length}</span>
                {seg.items.map(({ item, idx }) => (
                  <FilmStripThumb
                    key={item.image.filePath}
                    item={item}
                    isActive={idx === currentIndex}
                    onClick={() => handleClick(item, idx)}
                    onDoubleClick={() => handleDoubleClick(item)}
                  />
                ))}
              </div>
            )
          }
        })}
      </div>
    </div>
  )
}
