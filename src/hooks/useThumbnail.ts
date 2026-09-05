import { useState, useEffect, useRef } from 'react'
import type { TgaImage, ThumbnailSize } from '../types'
import { useSessionStore } from '../stores/useSessionStore'

// --- グローバルメモリキャッシュ（コンポーネントのライフサイクルに依存しない） ---
const MAX_CACHE_BYTES = 64 * 1024 * 1024
const memCache = new Map<string, { dataUrl: string; bytes: number }>()
const inFlight = new Map<string, Promise<string | null>>()
let memCacheBytes = 0

function cacheKey(filePath: string, size: ThumbnailSize, modifiedAt: number) {
  return `${filePath}|${size}|${modifiedAt}`
}

function getCached(filePath: string, size: ThumbnailSize, modifiedAt: number): string | null {
  const key = cacheKey(filePath, size, modifiedAt)
  const entry = memCache.get(key)
  if (!entry) return null
  // Mapの末尾へ移動してLRU順を更新
  memCache.delete(key)
  memCache.set(key, entry)
  return entry.dataUrl
}

function setCached(key: string, dataUrl: string) {
  const bytes = dataUrl.length * 2
  if (bytes > MAX_CACHE_BYTES) return
  const existing = memCache.get(key)
  if (existing) memCacheBytes -= existing.bytes
  memCache.delete(key)
  memCache.set(key, { dataUrl, bytes })
  memCacheBytes += bytes

  while (memCacheBytes > MAX_CACHE_BYTES) {
    const oldest = memCache.entries().next().value as [string, { dataUrl: string; bytes: number }] | undefined
    if (!oldest) break
    memCache.delete(oldest[0])
    memCacheBytes -= oldest[1].bytes
  }
}

async function fetchAndCache(filePath: string, size: ThumbnailSize, modifiedAt: number): Promise<string | null> {
  const key = cacheKey(filePath, size, modifiedAt)
  const cached = getCached(filePath, size, modifiedAt)
  if (cached) return cached
  const pending = inFlight.get(key)
  if (pending) return pending

  const request = (async () => {
    const rootFolder = useSessionStore.getState().folderPath ?? ''
    const url = await window.electronAPI.getThumbnail(filePath, size, rootFolder)
    if (url) setCached(key, url)
    return url
  })().finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, request)
  return request
}

/** サムネイル取得フック（メモリキャッシュ付き） */
export function useThumbnail(filePath: string | null, size: ThumbnailSize, modifiedAt = 0): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(
    filePath ? getCached(filePath, size, modifiedAt) : null
  )

  useEffect(() => {
    let cancelled = false

    if (!filePath || !window.electronAPI) {
      setDataUrl(null)
      return
    }

    // キャッシュヒットなら即表示
    const cached = getCached(filePath, size, modifiedAt)
    if (cached) {
      setDataUrl(cached)
      return
    }

    setDataUrl(null)
    fetchAndCache(filePath, size, modifiedAt)
      .then(url => { if (!cancelled) setDataUrl(url) })
      .catch(error => {
        if (!cancelled) setDataUrl(null)
        console.error(`[Thumbnail] failed: ${filePath}`, error)
      })

    return () => { cancelled = true }
  }, [filePath, size, modifiedAt])

  return dataUrl
}

/**
 * プレビュー用: preview → full の2段階ロード
 * キャッシュがあればスキップして即表示
 */
export function useProgressiveThumbnail(filePath: string | null, modifiedAt = 0): {
  dataUrl: string | null
  stage: ThumbnailSize | null
  loading: boolean
} {
  const fullSize = useSessionStore(s => s.settings.previewResolution ?? 'full')
  // 初期値でキャッシュから最良の画像を探す
  const initialUrl = filePath
    ? (getCached(filePath, fullSize, modifiedAt) ?? getCached(filePath, 'preview', modifiedAt))
    : null
  const initialStage: ThumbnailSize | null = filePath
    ? (getCached(filePath, fullSize, modifiedAt) ? fullSize : getCached(filePath, 'preview', modifiedAt) ? 'preview' : null)
    : null

  const [dataUrl, setDataUrl] = useState<string | null>(initialUrl)
  const [stage, setStage] = useState<ThumbnailSize | null>(initialStage)
  const [loading, setLoading] = useState(!initialUrl && !!filePath)

  useEffect(() => {
    let cancelled = false

    if (!filePath || !window.electronAPI) {
      setDataUrl(null)
      setStage(null)
      setLoading(false)
      return
    }

    // fullがキャッシュ済みなら完了
    const cachedFull = getCached(filePath, fullSize, modifiedAt)
    if (cachedFull) {
      setDataUrl(cachedFull)
      setStage(fullSize)
      setLoading(false)
      return
    }

    // previewがキャッシュ済みなら即表示してfullだけ取得
    const cachedPreview = getCached(filePath, 'preview', modifiedAt)
    if (cachedPreview) {
      setDataUrl(cachedPreview)
      setStage('preview')
      setLoading(false)
    } else {
      setDataUrl(null)
      setStage(null)
      setLoading(true)
    }

    const load = async () => {
      try {
        // Stage 1: preview
        if (!cachedPreview) {
          const preview = await fetchAndCache(filePath, 'preview', modifiedAt)
          if (cancelled) return
          if (preview) {
            setDataUrl(preview)
            setStage('preview')
            setLoading(false)
          }
        }

        // Stage 2: full
        const full = await fetchAndCache(filePath, fullSize, modifiedAt)
        if (cancelled) return
        if (full) {
          setDataUrl(full)
          setStage(fullSize)
        }
      } catch (error) {
        console.error(`[Thumbnail] failed: ${filePath}`, error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => { cancelled = true }
  }, [filePath, modifiedAt, fullSize])

  return { dataUrl, stage, loading }
}

/**
 * 隣接画像のサムネイルをプリフェッチ（UIには反映しない）
 * preview サイズをバックグラウンドで生成→キャッシュに乗せる
 */
export function usePrefetchNeighbors(neighbors: (Pick<TgaImage, 'filePath' | 'modifiedAt'> | null)[]) {
  const prevRef = useRef<string[]>([])

  useEffect(() => {
    if (!window.electronAPI) return
    const sources = neighbors.filter((source): source is Pick<TgaImage, 'filePath' | 'modifiedAt'> => source !== null)
    const keys = sources.map(source => `${source.filePath}|${source.modifiedAt}`)
    const key = keys.join('|')
    if (prevRef.current.join('|') === key) return
    prevRef.current = keys

    for (const source of sources) {
      fetchAndCache(source.filePath, 'preview', source.modifiedAt).catch(error => {
        console.warn(`[Thumbnail] prefetch failed: ${source.filePath}`, error)
      })
    }
  }, [neighbors])
}
