import { create } from 'zustand'
import type { TgaImage, BurstGroup, ViewMode, ScanResult, SessionData, AppSettings } from '../types'

export interface FlatItem {
  type: 'single' | 'burst-rep' | 'burst-child'
  image: TgaImage
  group?: BurstGroup
  burstCount?: number
  globalIndex: number
}

/** グループを展開状態に応じてフラット化（ピック済みフィルタ対応） */
export function buildFlatItems(
  groups: BurstGroup[],
  expandedGroupId: string | null,
  filterPickedOnly: boolean = false,
): FlatItem[] {
  const items: FlatItem[] = []
  let globalIndex = 0

  for (const group of groups) {
    if (group.isSingle) {
      if (filterPickedOnly && !group.images[0].picked) continue
      items.push({ type: 'single', image: group.images[0], globalIndex })
      globalIndex++
    } else if (group.id === expandedGroupId) {
      for (const img of group.images) {
        if (filterPickedOnly && !img.picked) continue
        items.push({ type: 'burst-child', image: img, group, globalIndex })
        globalIndex++
      }
    } else {
      if (filterPickedOnly && !group.images.some(img => img.picked)) continue
      items.push({
        type: 'burst-rep',
        image: group.representative,
        group,
        burstCount: group.images.length,
        globalIndex,
      })
      globalIndex++
    }
  }
  return items
}

interface SessionState {
  // フォルダ
  folderPath: string | null
  settings: AppSettings

  // 画像データ
  images: TgaImage[]
  groups: BurstGroup[]
  totalSize: number

  // ナビゲーション
  currentIndex: number
  expandedGroupId: string | null
  burstInnerIndex: number

  // 表示モード
  viewMode: ViewMode
  compareLeftIndex: number

  // フィルタ
  filterPickedOnly: boolean

  // グリッド
  gridColumnCount: number
  gridThumbSize: number

  // スキャン状態
  scanning: boolean
  scanError: string | null
  lastFolderPath: string | null

  // プレビュー生成進捗
  previewProgress: { completed: number; total: number } | null

  // アクション
  setFolderPath: (path: string) => void
  setSettings: (settings: AppSettings) => void
  setScanResult: (result: ScanResult) => void
  setScanning: (scanning: boolean) => void
  setScanError: (error: string | null) => void
  setCurrentIndex: (index: number) => void
  navigateBy: (delta: number) => void
  togglePick: (index?: number) => void
  toggleTrash: (index?: number) => void
  togglePickedFilter: () => void
  setViewMode: (mode: ViewMode) => void
  enterCompare: () => void
  exitCompare: () => void
  compareSwapPick: () => void
  toggleBurstExpand: (groupId: string) => void
  collapseBurst: () => void
  navigateBurstBy: (delta: number) => void
  restoreSession: (session: SessionData) => void
  clearSession: () => void
  setPreviewProgress: (progress: { completed: number; total: number } | null) => void
  setGridColumnCount: (count: number) => void
  setGridThumbSize: (size: number) => void
  debouncedSave: () => void
}

// デバウンス用タイマー（ストア外で管理）
let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useSessionStore = create<SessionState>((set, get) => ({
  folderPath: null,
  settings: { defaultFolder: '', exportFolder: '' },
  images: [],
  groups: [],
  totalSize: 0,
  currentIndex: 0,
  expandedGroupId: null,
  burstInnerIndex: 0,
  viewMode: 'preview',
  compareLeftIndex: 0,
  filterPickedOnly: false,
  gridColumnCount: 4,
  gridThumbSize: 130,
  scanning: false,
  scanError: null,
  lastFolderPath: null,
  previewProgress: null,

  setFolderPath: (path) => set({ folderPath: path }),
  setSettings: (settings) => set({ settings }),
  setScanResult: (result) => set({
    images: result.images,
    groups: result.groups,
    totalSize: result.totalSize,
    currentIndex: 0,
    expandedGroupId: null,
  }),
  setScanning: (scanning) => set({ scanning }),
  setScanError: (error) => set({ scanError: error }),

  setCurrentIndex: (index) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupId, s.filterPickedOnly)
    if (index >= 0 && index < flat.length) {
      set({ currentIndex: index })
      get().debouncedSave()
    }
  },

  navigateBy: (delta) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupId, s.filterPickedOnly)
    const next = s.currentIndex + delta
    if (next >= 0 && next < flat.length) {
      set({ currentIndex: next })
      get().debouncedSave()
    }
  },

  togglePick: (index?: number) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupId, s.filterPickedOnly)
    const idx = index ?? s.currentIndex
    const item = flat[idx]
    if (!item) return
    const filePath = item.image.filePath

    const newImages = s.images.map(img =>
      img.filePath === filePath ? { ...img, picked: !img.picked } : img
    )
    const newGroups = s.groups.map(g => ({
      ...g,
      images: g.images.map(img =>
        img.filePath === filePath ? { ...img, picked: !img.picked } : img
      ),
      representative: g.representative.filePath === filePath
        ? { ...g.representative, picked: !g.representative.picked }
        : g.representative,
    }))
    set({ images: newImages, groups: newGroups })
    get().debouncedSave()
  },

  toggleTrash: (index?: number) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupId, s.filterPickedOnly)
    const idx = index ?? s.currentIndex
    const item = flat[idx]
    if (!item) return
    const filePath = item.image.filePath

    const newImages = s.images.map(img =>
      img.filePath === filePath ? { ...img, trashed: !img.trashed } : img
    )
    const newGroups = s.groups.map(g => ({
      ...g,
      images: g.images.map(img =>
        img.filePath === filePath ? { ...img, trashed: !img.trashed } : img
      ),
      representative: g.representative.filePath === filePath
        ? { ...g.representative, trashed: !g.representative.trashed }
        : g.representative,
    }))
    set({ images: newImages, groups: newGroups })
    get().debouncedSave()
  },

  togglePickedFilter: () => {
    const s = get()
    const newFilter = !s.filterPickedOnly
    const flat = buildFlatItems(s.groups, s.expandedGroupId, newFilter)
    const clampedIndex = flat.length === 0 ? 0 : Math.min(s.currentIndex, flat.length - 1)
    set({ filterPickedOnly: newFilter, currentIndex: clampedIndex })
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  enterCompare: () => {
    set({ viewMode: 'compare', compareLeftIndex: get().currentIndex })
  },

  exitCompare: () => {
    set({ viewMode: 'preview' })
  },

  compareSwapPick: () => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupId, s.filterPickedOnly)
    const leftItem = flat[s.compareLeftIndex]
    const rightItem = flat[s.currentIndex]
    if (!rightItem) return

    if (s.compareLeftIndex === s.currentIndex) {
      get().togglePick()
      return
    }

    const leftPath = leftItem?.image.filePath
    const rightPath = rightItem.image.filePath

    const newImages = s.images.map(img => {
      if (img.filePath === rightPath) return { ...img, picked: true }
      if (img.filePath === leftPath && img.picked) return { ...img, picked: false }
      return img
    })
    const newGroups = s.groups.map(g => ({
      ...g,
      images: g.images.map(img => {
        if (img.filePath === rightPath) return { ...img, picked: true }
        if (img.filePath === leftPath && img.picked) return { ...img, picked: false }
        return img
      }),
      representative: (() => {
        if (g.representative.filePath === rightPath) return { ...g.representative, picked: true }
        if (g.representative.filePath === leftPath && g.representative.picked) return { ...g.representative, picked: false }
        return g.representative
      })(),
    }))

    set({ images: newImages, groups: newGroups, compareLeftIndex: s.currentIndex })
    get().debouncedSave()
  },

  toggleBurstExpand: (groupId) => {
    const s = get()
    if (s.expandedGroupId === groupId) {
      set({ expandedGroupId: null })
    } else {
      set({ expandedGroupId: groupId, burstInnerIndex: 0 })
    }
  },

  collapseBurst: () => {
    set({ expandedGroupId: null })
  },

  navigateBurstBy: (delta) => {
    const s = get()
    if (!s.expandedGroupId) return
    const group = s.groups.find(g => g.id === s.expandedGroupId)
    if (!group) return
    const next = s.burstInnerIndex + delta
    if (next >= 0 && next < group.images.length) {
      set({ burstInnerIndex: next })
    }
  },

  restoreSession: (session) => {
    const s = get()
    const pickedSet = new Set(session.pickedFiles)
    const trashedSet = new Set(session.trashedFiles)

    const newImages = s.images.map(img => ({
      ...img,
      picked: pickedSet.has(img.filePath),
      trashed: trashedSet.has(img.filePath),
    }))
    const newGroups = s.groups.map(g => ({
      ...g,
      images: g.images.map(img => ({
        ...img,
        picked: pickedSet.has(img.filePath),
        trashed: trashedSet.has(img.filePath),
      })),
      representative: {
        ...g.representative,
        picked: pickedSet.has(g.representative.filePath),
        trashed: trashedSet.has(g.representative.filePath),
      },
    }))

    // viewMode の後方互換: 'normal' → 'preview', 'burst' → 'preview'
    let viewMode: ViewMode = 'preview'
    if (session.viewMode === 'grid' || session.viewMode === 'preview' || session.viewMode === 'compare') {
      viewMode = session.viewMode
    }

    set({
      images: newImages,
      groups: newGroups,
      currentIndex: Math.min(session.currentIndex, newImages.length - 1),
      expandedGroupId: null,
      viewMode,
    })
  },

  clearSession: () => {
    const currentFolder = get().folderPath
    set({
      folderPath: null,
      images: [],
      groups: [],
      totalSize: 0,
      currentIndex: 0,
      expandedGroupId: null,
      viewMode: 'preview',
      compareLeftIndex: 0,
      filterPickedOnly: false,
      scanning: false,
      scanError: null,
      lastFolderPath: currentFolder,
    })
  },

  setPreviewProgress: (progress) => set({ previewProgress: progress }),

  setGridColumnCount: (count) => set({ gridColumnCount: count }),

  setGridThumbSize: (size) => set({ gridThumbSize: Math.max(100, Math.min(300, size)) }),

  debouncedSave: () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const s = get()
      if (!s.folderPath) return
      const data: SessionData = {
        folderPath: s.folderPath,
        pickedFiles: s.images.filter(i => i.picked).map(i => i.filePath),
        trashedFiles: s.images.filter(i => i.trashed).map(i => i.filePath),
        currentIndex: s.currentIndex,
        expandedGroups: s.expandedGroupId ? [s.expandedGroupId] : [],
        viewMode: s.viewMode,
        savedAt: new Date().toISOString(),
      }
      window.electronAPI.saveSession(data)
    }, 500)
  },
}))
