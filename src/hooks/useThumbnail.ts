import { useState, useEffect, useRef } from 'react'
import type { ThumbnailSize } from '../types'
import { useSessionStore } from '../stores/useSessionStore'

// --- グローバルメモリキャッシュ（コンポーネントのライフサイクルに依存しない） ---
const memCache = new Map<string, string>()
function cacheKey(filePath: string, size: ThumbnailSize) { return `${filePath}|${size}` }

function getCached(filePath: string, size: ThumbnailSize): string | null {
  return memCache.get(cacheKey(filePath, size)) ?? null
}

async function fetchAndCache(filePath: string, size: ThumbnailSize): Promise<string | null> {
  const key = cacheKey(filePath, size)
  const cached = memCache.get(key)
  if (cached) return cached

  const rootFolder = useSessionStore.getState().folderPath ?? ''
  const url = await window.electronAPI.getThumbnail(filePath, size, rootFolder)
  if (url) memCache.set(key, url)
  return url
}

/** サムネイル取得フック（メモリキャッシュ付き） */
export function useThumbnail(filePath: string | null, size: ThumbnailSize): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(
    filePath ? getCached(filePath, size) : null
  )
  const abortRef = useRef(false)

  useEffect(() => {
    abortRef.current = false

    if (!filePath || !window.electronAPI) {
      setDataUrl(null)
      return
    }

    // キャッシュヒットなら即表示
    const cached = getCached(filePath, size)
    if (cached) {
      setDataUrl(cached)
      return
    }

    fetchAndCache(filePath, size).then(url => {
      if (!abortRef.current) setDataUrl(url)
    })

    return () => { abortRef.current = true }
  }, [filePath, size])

  return dataUrl
}

/**
 * プレビュー用: preview → full の2段階ロード
 * キャッシュがあればスキップして即表示
 */
export function useProgressiveThumbnail(filePath: string | null): {
  dataUrl: string | null
  stage: ThumbnailSize | null
  loading: boolean
} {
  // 初期値でキャッシュから最良の画像を探す
  const initialUrl = filePath
    ? (getCached(filePath, 'full') ?? getCached(filePath, 'preview'))
    : null
  const initialStage: ThumbnailSize | null = filePath
    ? (getCached(filePath, 'full') ? 'full' : getCached(filePath, 'preview') ? 'preview' : null)
    : null

  const [dataUrl, setDataUrl] = useState<string | null>(initialUrl)
  const [stage, setStage] = useState<ThumbnailSize | null>(initialStage)
  const [loading, setLoading] = useState(!initialUrl && !!filePath)
  const abortRef = useRef(false)
  const fileRef = useRef(filePath)

  useEffect(() => {
    abortRef.current = false
    fileRef.current = filePath

    if (!filePath || !window.electronAPI) {
      setDataUrl(null)
      setStage(null)
      setLoading(false)
      return
    }

    // fullがキャッシュ済みなら完了
    const cachedFull = getCached(filePath, 'full')
    if (cachedFull) {
      setDataUrl(cachedFull)
      setStage('full')
      setLoading(false)
      return
    }

    // previewがキャッシュ済みなら即表示してfullだけ取得
    const cachedPreview = getCached(filePath, 'preview')
    if (cachedPreview) {
      setDataUrl(cachedPreview)
      setStage('preview')
      setLoading(false)
    } else {
      setLoading(true)
    }

    const load = async () => {
      // Stage 1: preview
      if (!cachedPreview) {
        const preview = await fetchAndCache(filePath, 'preview')
        if (abortRef.current || fileRef.current !== filePath) return
        if (preview) {
          setDataUrl(preview)
          setStage('preview')
          setLoading(false)
        }
      }

      // Stage 2: full
      const full = await fetchAndCache(filePath, 'full')
      if (abortRef.current || fileRef.current !== filePath) return
      if (full) {
        setDataUrl(full)
        setStage('full')
        setLoading(false)
      }
    }

    load()

    return () => { abortRef.current = true }
  }, [filePath])

  return { dataUrl, stage, loading }
}

/**
 * 隣接画像のサムネイルをプリフェッチ（UIには反映しない）
 * preview サイズをバックグラウンドで生成→キャッシュに乗せる
 */
export function usePrefetchNeighbors(neighborPaths: (string | null)[]) {
  const prevRef = useRef<string[]>([])

  useEffect(() => {
    if (!window.electronAPI) return
    const paths = neighborPaths.filter((p): p is string => p !== null)
    const key = paths.join('|')
    if (prevRef.current.join('|') === key) return
    prevRef.current = paths

    for (const path of paths) {
      fetchAndCache(path, 'preview').catch(() => {})
    }
  }, [neighborPaths])
}
