import type { FlatItem } from '../stores/useSessionStore'

type FilmSegment =
  | { type: 'thumbs'; items: Array<{ item: FlatItem; idx: number }> }
  | { type: 'burst-group'; items: Array<{ item: FlatItem; idx: number }>; groupId: string }

export function buildFilmSegments(flatItems: FlatItem[]): FilmSegment[] {
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
      while (i < flatItems.length && flatItems[i].type === 'burst-child' && flatItems[i].group?.id === item.group?.id) {
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
}
