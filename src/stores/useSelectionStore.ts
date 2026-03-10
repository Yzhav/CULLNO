import { create } from 'zustand'

interface SelectionState {
  selectedIndices: Record<number, true>
  toggleSelect: (index: number, extend: boolean) => void
  rangeSelect: (fromIndex: number, toIndex: number) => void
  clearSelection: () => void
  getSelectedCount: () => number
  getSelectedKeys: () => number[]
}

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  selectedIndices: {},

  toggleSelect: (index, extend) => {
    const prev = get().selectedIndices
    const next = extend ? { ...prev } : {}
    if (next[index]) {
      delete next[index]
    } else {
      next[index] = true
    }
    set({ selectedIndices: next })
  },

  rangeSelect: (fromIndex, toIndex) => {
    const prev = get().selectedIndices
    const next = { ...prev }
    const from = Math.min(fromIndex, toIndex)
    const to = Math.max(fromIndex, toIndex)
    for (let i = from; i <= to; i++) {
      next[i] = true
    }
    set({ selectedIndices: next })
  },

  clearSelection: () => set({ selectedIndices: {} }),

  getSelectedCount: () => Object.keys(get().selectedIndices).length,
  getSelectedKeys: () => Object.keys(get().selectedIndices).map(Number),
}))
