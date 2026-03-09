import type { MRUEntry } from '../types'

const MRU_KEY = 'cullno-mru'
const MRU_MAX = 5

export function loadMRU(): MRUEntry[] {
  try {
    const raw = localStorage.getItem(MRU_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveMRU(entries: MRUEntry[]): void {
  localStorage.setItem(MRU_KEY, JSON.stringify(entries))
}

export function addToMRU(entry: MRUEntry): MRUEntry[] {
  const current = loadMRU()
  // 同じパスがあれば除去
  const filtered = current.filter(e => e.folderPath !== entry.folderPath)
  // 先頭に追加、最大数を超えたら末尾を削除
  const updated = [entry, ...filtered].slice(0, MRU_MAX)
  saveMRU(updated)
  return updated
}
