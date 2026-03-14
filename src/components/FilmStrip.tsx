import { useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo } from 'react'
import { makeStyles, tokens, mergeClasses } from '@fluentui/react-components'
import { useThumbnail } from '../hooks/useThumbnail'
import { useSessionStore, buildFlatItems, type FlatItem } from '../stores/useSessionStore'
import { getBaseName } from '../utils/fileUtils'
import { cullnoColors } from '../styles/tokens'

// バースト展開/折畳中にセルのscrollIntoViewを一時抑制するフラグ（モジュールスコープ）
let suppressCellScroll = false

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
    '::-webkit-scrollbar': {
      height: '4px',
    },
    '::-webkit-scrollbar-thumb': {
      backgroundColor: cullnoColors.scrollbarThumb,
      borderRadius: '2px',
    },
  },
  burstGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: `${THUMB_GAP}px`,
    backgroundColor: cullnoColors.burstGroupBg,
    padding: '2px 4px',
    flexShrink: 0,
    marginLeft: '9px',
    marginRight: '9px',
    position: 'relative',
  },
  burstGroupLineLeft1: {
    position: 'absolute',
    left: '-4px',
    top: '20%',
    bottom: '20%',
    width: '2px',
    backgroundColor: cullnoColors.burstLineBright,
    boxShadow: `0 0 4px ${cullnoColors.burstLineGlow}`,
    borderRadius: '2px',
  },
  burstGroupLineLeft2: {
    position: 'absolute',
    left: '-7px',
    top: '35%',
    bottom: '35%',
    width: '2px',
    backgroundColor: cullnoColors.burstLineSoft,
    borderRadius: '2px',
  },
  burstGroupLineRight1: {
    position: 'absolute',
    right: '-4px',
    top: '20%',
    bottom: '20%',
    width: '2px',
    backgroundColor: cullnoColors.burstLineBright,
    boxShadow: `0 0 4px ${cullnoColors.burstLineGlow}`,
    borderRadius: '2px',
  },
  burstGroupLineRight2: {
    position: 'absolute',
    right: '-7px',
    top: '35%',
    bottom: '35%',
    width: '2px',
    backgroundColor: cullnoColors.burstLineSoft,
    borderRadius: '2px',
  },
})

const useThumbStyles = makeStyles({
  wrapper: {
    position: 'relative',
    flexShrink: 0,
    cursor: 'pointer',
    overflow: 'visible',
    padding: '2px',
    backgroundColor: tokens.colorNeutralBackground3,
    transitionProperty: 'box-shadow',
    transitionDuration: '0.1s',
  },
  active: {
    boxShadow: cullnoColors.selectionShadow,
  },
  inactive: {
    ':hover': {
      filter: 'brightness(1.15)',
    },
  },
  picked: {
    boxShadow: cullnoColors.pickedShadow,
  },
  activePicked: {
    boxShadow: cullnoColors.selectedPickedShadow,
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
    marginLeft: '9px',
    marginRight: '9px',
  },
  burstLineLeft1: {
    position: 'absolute',
    left: '-4px',
    top: '20%',
    bottom: '20%',
    width: '2px',
    backgroundColor: cullnoColors.burstLineBright,
    boxShadow: `0 0 4px ${cullnoColors.burstLineGlow}`,
    borderRadius: '2px',
    zIndex: 2,
  },
  burstLineLeft2: {
    position: 'absolute',
    left: '-7px',
    top: '35%',
    bottom: '35%',
    width: '2px',
    backgroundColor: cullnoColors.burstLineSoft,
    borderRadius: '2px',
    zIndex: 2,
  },
  burstLineRight1: {
    position: 'absolute',
    right: '-4px',
    top: '20%',
    bottom: '20%',
    width: '2px',
    backgroundColor: cullnoColors.burstLineBright,
    boxShadow: `0 0 4px ${cullnoColors.burstLineGlow}`,
    borderRadius: '2px',
    zIndex: 2,
  },
  burstLineRight2: {
    position: 'absolute',
    right: '-7px',
    top: '35%',
    bottom: '35%',
    width: '2px',
    backgroundColor: cullnoColors.burstLineSoft,
    borderRadius: '2px',
    zIndex: 2,
  },
})


const FilmStripThumb = memo(function FilmStripThumb({ item, isActive, onClick, onDoubleClick, onContextMenu }: {
  item: FlatItem
  isActive: boolean
  onClick: () => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const styles = useThumbStyles()
  const dataUrl = useThumbnail(item.image.filePath, 'preview')
  const ref = useRef<HTMLDivElement>(null)
  const isBurstRep = item.type === 'burst-rep' && item.burstCount && item.burstCount > 1

  useEffect(() => {
    if (isActive && ref.current && !suppressCellScroll) {
      ref.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' })
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
      role="listitem"
      aria-current={isActive ? 'true' : undefined}
      aria-label={getBaseName(item.image.filePath)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {isBurstRep && <>
        <div className={styles.burstLineLeft2} />
        <div className={styles.burstLineLeft1} />
        <div className={styles.burstLineRight2} />
        <div className={styles.burstLineRight1} />
      </>}
      {dataUrl ? (
        <img src={dataUrl} className={styles.image} draggable={false} alt="" />
      ) : (
        <div className={styles.placeholder} />
      )}
    </div>
  )
})

type FilmSegment =
  | { type: 'thumbs'; items: Array<{ item: FlatItem; idx: number }> }
  | { type: 'burst-group'; items: Array<{ item: FlatItem; idx: number }>; groupId: string }

export function FilmStrip() {
  const styles = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const groups = useSessionStore(s => s.groups)
  const expandedGroupIds = useSessionStore(s => s.expandedGroupIds)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const extensionFilter = useSessionStore(s => s.extensionFilter)
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0, hasMoved: false, pointerId: 0 })

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupIds, filterPickedOnly, extensionFilter),
    [groups, expandedGroupIds, filterPickedOnly, extensionFilter],
  )

  // ── バースト展開/折畳時のスクロール位置補正 ──
  const prevExpandedRef = useRef(expandedGroupIds)
  const scrollAnchorRef = useRef<{ scrollLeft: number; cellViewportLeft: number } | null>(null)

  // レンダー中（DOM未更新）: expandedGroupIdsが変わったら旧DOMからアクティブセルの位置をキャプチャ
  if (prevExpandedRef.current !== expandedGroupIds && scrollRef.current) {
    const activeCell = scrollRef.current.querySelector('[aria-current="true"]') as HTMLElement | null
    if (activeCell) {
      const containerRect = scrollRef.current.getBoundingClientRect()
      const cellRect = activeCell.getBoundingClientRect()
      scrollAnchorRef.current = {
        scrollLeft: scrollRef.current.scrollLeft,
        cellViewportLeft: cellRect.left - containerRect.left,
      }
    }
  }

  // DOM更新後: 新しいアクティブセルの位置を取得し、スクロールを補正
  useLayoutEffect(() => {
    if (prevExpandedRef.current !== expandedGroupIds) {
      suppressCellScroll = true
      const anchor = scrollAnchorRef.current
      const el = scrollRef.current
      if (anchor && el) {
        const activeCell = el.querySelector('[aria-current="true"]') as HTMLElement | null
        if (activeCell) {
          const containerRect = el.getBoundingClientRect()
          const cellRect = activeCell.getBoundingClientRect()
          const newViewportLeft = cellRect.left - containerRect.left
          const shift = newViewportLeft - anchor.cellViewportLeft
          el.scrollLeft += shift
        }
      }
      scrollAnchorRef.current = null
      prevExpandedRef.current = expandedGroupIds
      requestAnimationFrame(() => { suppressCellScroll = false })
    }
  }, [expandedGroupIds])

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

  const handleDoubleClick = useCallback((_item: FlatItem) => {
    // ダブルクリックは常にプレビューモードへ（GridViewと統一）
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
    <div className={styles.root} data-filmstrip role="list" aria-label="フィルムストリップ">
      <div className={styles.scrollContainer} ref={scrollRef}>
        {segments.map((seg) => {
          if (seg.type === 'thumbs') {
            return seg.items.map(({ item, idx }) => (
              <FilmStripThumb
                key={item.image.filePath}
                item={item}
                isActive={idx === currentIndex}
                onClick={() => handleClick(item, idx)}
                onDoubleClick={() => handleDoubleClick(item)}
                onContextMenu={(e) => handleContextMenu(item, idx, e)}
              />
            ))
          } else {
            return (
              <div key={`burst-${seg.groupId}`} className={styles.burstGroup}>
                <div className={styles.burstGroupLineLeft2} />
                <div className={styles.burstGroupLineLeft1} />
                <div className={styles.burstGroupLineRight2} />
                <div className={styles.burstGroupLineRight1} />
                {seg.items.map(({ item, idx }) => (
                  <FilmStripThumb
                    key={item.image.filePath}
                    item={item}
                    isActive={idx === currentIndex}
                    onClick={() => handleClick(item, idx)}
                    onDoubleClick={() => handleDoubleClick(item)}
                    onContextMenu={(e) => handleContextMenu(item, idx, e)}
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
