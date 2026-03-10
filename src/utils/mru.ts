import type { MRUEntry } from '../types'

const MRU_KEY = 'cullno-mru'
const MRU_DEFAULT_MAX = 5

let mruMaxCount = MRU_DEFAULT_MAX

export function setMruMaxCount(count: number): void {
  mruMaxCount = Math.max(1, Math.min(20, count))
}

export function getMruMaxCount(): number {
  return mruMaxCount
}

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
  const filtered = current.filter(e => e.folderPath !== entry.folderPath)
  const updated = [entry, ...filtered].slice(0, mruMaxCount)
  saveMRU(updated)
  return updated
}
