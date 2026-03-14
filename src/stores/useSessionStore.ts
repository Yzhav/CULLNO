import { create } from 'zustand'
import { temporal } from 'zundo'
import type { TgaImage, BurstGroup, ViewMode, ScanResult, SessionData, AppSettings } from '../types'

/** 指定パスの画像のpicked状態を一括更新する */
function updatePickedByPaths(
  images: TgaImage[],
  groups: BurstGroup[],
  paths: Set<string>,
  picked: boolean,
): { images: TgaImage[]; groups: BurstGroup[] } {
  const updater = (img: TgaImage) =>
    paths.has(img.filePath) ? { ...img, picked } : img
  return {
    images: images.map(updater),
    groups: groups.map(g => ({
      ...g,
      images: g.images.map(updater),
      representative: paths.has(g.representative.filePath)
        ? { ...g.representative, picked }
        : g.representative,
    })),
  }
}

export interface FlatItem {
  type: 'single' | 'burst-rep' | 'burst-child'
  image: TgaImage
  group?: BurstGroup
  burstCount?: number
  globalIndex: number
}

/** 画像が拡張子フィルタに一致するか */
function matchesExtFilter(img: TgaImage, extFilter: string | null): boolean {
  if (!extFilter) return true
  const ext = img.filePath.split('.').pop()?.toLowerCase() ?? ''
  if (extFilter === 'jpeg') return ext === 'jpg' || ext === 'jpeg'
  return ext === extFilter
}

/** グループを展開状態に応じてフラット化（ピック済みフィルタ・拡張子フィルタ対応） */
export function buildFlatItems(
  groups: BurstGroup[],
  expandedGroupIds: string[],
  filterPickedOnly: boolean = false,
  extensionFilter: string | null = null,
): FlatItem[] {
  const items: FlatItem[] = []
  let globalIndex = 0
  const expandedSet = new Set(expandedGroupIds)

  for (const group of groups) {
    if (group.isSingle) {
      if (filterPickedOnly && !group.images[0].picked) continue
      if (!matchesExtFilter(group.images[0], extensionFilter)) continue
      items.push({ type: 'single', image: group.images[0], globalIndex })
      globalIndex++
    } else if (expandedSet.has('__all__') || expandedSet.has(group.id)) {
      for (const img of group.images) {
        if (filterPickedOnly && !img.picked) continue
        if (!matchesExtFilter(img, extensionFilter)) continue
        items.push({ type: 'burst-child', image: img, group, globalIndex })
        globalIndex++
      }
    } else {
      const filtered = group.images.filter(img =>
        (!filterPickedOnly || img.picked) && matchesExtFilter(img, extensionFilter)
      )
      if (filtered.length === 0) continue
      items.push({
        type: 'burst-rep',
        image: group.representative,
        group,
        burstCount: filtered.length,
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
  expandedGroupIds: string[]
  burstInnerIndex: number

  // 表示モード
  viewMode: ViewMode
  compareLeftIndex: number
  previousViewMode: ViewMode

  // フィルタ
  filterPickedOnly: boolean
  extensionFilter: string | null  // null = 全表示, 'tga', 'png', 'jpeg'

  // グリッド
  gridColumnCount: number
  gridThumbSize: number

  // 表示設定
  showFilmStrip: boolean



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
  pickAll: () => void
  unpickAll: () => void
  pendingDeletePaths: string[] | null
  requestDelete: (selectedIndices?: number[]) => void
  confirmDelete: () => Promise<void>
  cancelDelete: () => void
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
  setShowFilmStrip: (show: boolean) => void
  setExtensionFilter: (ext: string | null) => void
  pickSelected: (indices: number[]) => void
  unpickSelected: (indices: number[]) => void
  debouncedSave: () => void
}

// デバウンス用タイマー（ストア外で管理）
let saveTimer: ReturnType<typeof setTimeout> | null = null
let thumbSaveTimer: ReturnType<typeof setTimeout> | null = null

export const useSessionStore = create<SessionState>()(temporal((set, get) => ({
  folderPath: null,
  settings: { defaultFolder: '', exportFolder: '' },
  images: [],
  groups: [],
  totalSize: 0,
  currentIndex: 0,
  expandedGroupIds: [],
  burstInnerIndex: 0,
  viewMode: 'preview',
  compareLeftIndex: 0,
  previousViewMode: 'preview' as ViewMode,
  filterPickedOnly: false,
  extensionFilter: null,
  gridColumnCount: 4,
  gridThumbSize: 130,
  showFilmStrip: true,
  scanning: false,
  scanError: null,
  lastFolderPath: null,
  previewProgress: null,
  pendingDeletePaths: null,

  setFolderPath: (path) => set({ folderPath: path }),
  setSettings: (settings) => set({ settings }),
  setScanResult: (result) => set({
    images: result.images,
    groups: result.groups,
    totalSize: result.totalSize,
    currentIndex: 0,
    expandedGroupIds: [],
  }),
  setScanning: (scanning) => set({ scanning }),
  setScanError: (error) => set({ scanError: error }),

  setCurrentIndex: (index) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
    if (index >= 0 && index < flat.length) {
      set({ currentIndex: index })
      get().debouncedSave()
    }
  },

  navigateBy: (delta) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
    const next = s.currentIndex + delta
    if (next >= 0 && next < flat.length) {
      set({ currentIndex: next })
      get().debouncedSave()
    }
  },

  togglePick: (index?: number) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
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

  pickAll: () => {
    const s = get()
    const newImages = s.images.map(img => ({ ...img, picked: true }))
    const newGroups = s.groups.map(g => ({
      ...g,
      images: g.images.map(img => ({ ...img, picked: true })),
      representative: { ...g.representative, picked: true },
    }))
    set({ images: newImages, groups: newGroups })
    get().debouncedSave()
  },

  unpickAll: () => {
    const s = get()
    const newImages = s.images.map(img => ({ ...img, picked: false }))
    const newGroups = s.groups.map(g => ({
      ...g,
      images: g.images.map(img => ({ ...img, picked: false })),
      representative: { ...g.representative, picked: false },
    }))
    set({ images: newImages, groups: newGroups })
    get().debouncedSave()
  },

  requestDelete: (selectedIndices?: number[]) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
    let paths: string[]
    if (selectedIndices && selectedIndices.length > 0) {
      paths = selectedIndices.map(i => flat[i]?.image.filePath).filter(Boolean) as string[]
    } else {
      const item = flat[s.currentIndex]
      paths = item ? [item.image.filePath] : []
    }
    if (paths.length > 0) set({ pendingDeletePaths: paths })
  },

  confirmDelete: async () => {
    const s = get()
    const paths = s.pendingDeletePaths
    if (!paths || paths.length === 0) return

    await window.electronAPI.moveToTrash(paths)

    const pathSet = new Set(paths)
    const newImages = s.images.filter(img => !pathSet.has(img.filePath))
    const newGroups = s.groups.map(g => {
      const filtered = g.images.filter(img => !pathSet.has(img.filePath))
      if (filtered.length === 0) return null
      const rep = pathSet.has(g.representative.filePath) ? filtered[0] : g.representative
      return {
        ...g,
        images: filtered,
        representative: rep,
        isSingle: filtered.length === 1,
      }
    }).filter(Boolean) as BurstGroup[]

    // 拡張子フィルタの整合性チェック: フィルタ対象が0件になったらリセット
    let extFilter = s.extensionFilter
    if (extFilter) {
      const hasMatch = newImages.some(img => matchesExtFilter(img, extFilter))
      if (!hasMatch) extFilter = null
    }

    const flat = buildFlatItems(newGroups, s.expandedGroupIds, s.filterPickedOnly, extFilter)
    const clampedIndex = flat.length === 0 ? 0 : Math.min(s.currentIndex, flat.length - 1)

    set({
      images: newImages,
      groups: newGroups,
      currentIndex: clampedIndex,
      extensionFilter: extFilter,
      pendingDeletePaths: null,
    })
    get().debouncedSave()
  },

  cancelDelete: () => set({ pendingDeletePaths: null }),

  togglePickedFilter: () => {
    const s = get()
    const newFilter = !s.filterPickedOnly
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, newFilter, s.extensionFilter)
    const clampedIndex = flat.length === 0 ? 0 : Math.min(s.currentIndex, flat.length - 1)
    set({ filterPickedOnly: newFilter, currentIndex: clampedIndex })
  },

  setExtensionFilter: (ext) => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, ext)
    const clampedIndex = flat.length === 0 ? 0 : Math.min(s.currentIndex, flat.length - 1)
    set({ extensionFilter: ext, currentIndex: clampedIndex })
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  enterCompare: () => {
    const s = get()
    set({ viewMode: 'compare', compareLeftIndex: s.currentIndex, previousViewMode: s.viewMode })
  },

  exitCompare: () => {
    set({ viewMode: get().previousViewMode })
  },

  compareSwapPick: () => {
    const s = get()
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
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
    window.dispatchEvent(new CustomEvent('cullno:compare-picked'))
    get().debouncedSave()
  },

  toggleBurstExpand: (groupId) => {
    const s = get()
    // グループのトグル: 含まれていれば除去、なければ追加
    const isExpanded = s.expandedGroupIds.includes(groupId)
    const newExpandedIds = isExpanded
      ? s.expandedGroupIds.filter(id => id !== groupId)
      : [...s.expandedGroupIds, groupId]

    // currentIndex を維持（同じ画像パスベース）
    const oldFlat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
    const currentFilePath = oldFlat[s.currentIndex]?.image.filePath
    const newFlat = buildFlatItems(s.groups, newExpandedIds, s.filterPickedOnly, s.extensionFilter)

    let newIndex = s.currentIndex
    if (currentFilePath) {
      const found = newFlat.findIndex(item => item.image.filePath === currentFilePath)
      if (found >= 0) {
        newIndex = found
      } else {
        const repIndex = newFlat.findIndex(item => item.type === 'burst-rep' && item.group?.id === groupId)
        if (repIndex >= 0) newIndex = repIndex
      }
    }
    newIndex = Math.min(newIndex, Math.max(0, newFlat.length - 1))

    set({ expandedGroupIds: newExpandedIds, burstInnerIndex: 0, currentIndex: newIndex })
  },

  collapseBurst: () => {
    const s = get()
    if (s.expandedGroupIds.length === 0) return
    // 現在の画像が属するグループを特定して折り畳む
    const oldFlat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
    const currentItem = oldFlat[s.currentIndex]
    const currentGroupId = currentItem?.group?.id
    const newExpandedIds = currentGroupId
      ? s.expandedGroupIds.filter(id => id !== currentGroupId)
      : []

    const currentFilePath = currentItem?.image.filePath
    const newFlat = buildFlatItems(s.groups, newExpandedIds, s.filterPickedOnly, s.extensionFilter)
    let newIndex = s.currentIndex
    if (currentFilePath) {
      const found = newFlat.findIndex(item => item.image.filePath === currentFilePath)
      if (found >= 0) {
        newIndex = found
      } else {
        const repIndex = newFlat.findIndex(item => item.type === 'burst-rep' && item.group?.id === currentGroupId)
        if (repIndex >= 0) newIndex = repIndex
      }
    }
    newIndex = Math.min(newIndex, Math.max(0, newFlat.length - 1))
    set({ expandedGroupIds: newExpandedIds, currentIndex: newIndex })
  },

  navigateBurstBy: (delta) => {
    const s = get()
    if (s.expandedGroupIds.length === 0) return
    // 現在のアイテムが属するグループで移動
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
    const currentItem = flat[s.currentIndex]
    const group = currentItem?.group ? s.groups.find(g => g.id === currentItem.group!.id) : null
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
      expandedGroupIds: [],
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
      expandedGroupIds: [],
      viewMode: 'preview',
      compareLeftIndex: 0,
      filterPickedOnly: false,
      extensionFilter: null,
      scanning: false,
      scanError: null,
      lastFolderPath: currentFolder,
      pendingDeletePaths: null,
    })
  },

  setPreviewProgress: (progress) => set({ previewProgress: progress }),

  setGridColumnCount: (count) => set({ gridColumnCount: count }),

  setShowFilmStrip: (show) => {
    set({ showFilmStrip: show })
    // 設定に保存
    if (!window.electronAPI) return
    window.electronAPI.loadSettings().then(settings => {
      window.electronAPI.saveSettings({ ...settings, showFilmStrip: show })
    })
  },

  setGridThumbSize: (size) => {
    const clamped = Math.max(100, Math.min(300, size))
    set({ gridThumbSize: clamped })
    // デバウンスで設定に保存
    if (thumbSaveTimer) clearTimeout(thumbSaveTimer)
    thumbSaveTimer = setTimeout(async () => {
      if (!window.electronAPI) return
      const settings = await window.electronAPI.loadSettings()
      await window.electronAPI.saveSettings({ ...settings, gridThumbSize: clamped })
    }, 1000)
  },

  // 複数選択→一括ピック
  pickSelected: (indices) => {
    const s = get()
    if (indices.length === 0) return
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
    const paths = new Set<string>()
    for (const idx of indices) {
      const item = flat[idx]
      if (item) paths.add(item.image.filePath)
    }
    set(updatePickedByPaths(s.images, s.groups, paths, true))
    get().debouncedSave()
  },

  unpickSelected: (indices) => {
    const s = get()
    if (indices.length === 0) return
    const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
    const paths = new Set<string>()
    for (const idx of indices) {
      const item = flat[idx]
      if (item) paths.add(item.image.filePath)
    }
    set(updatePickedByPaths(s.images, s.groups, paths, false))
    get().debouncedSave()
  },

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
        expandedGroups: s.expandedGroupIds,
        viewMode: s.viewMode,
        savedAt: new Date().toISOString(),
      }
      window.electronAPI.saveSession(data)
    }, 500)
  },
}),
{
  partialize: (state) => ({
    images: state.images,
    groups: state.groups,
  }),
  limit: 50,
}))
