import * as fs from 'fs'
import * as path from 'path'
import type { TgaImage, BurstGroup, ScanResult } from '../src/types'

/** 対応画像拡張子 */
export const SUPPORTED_EXTENSIONS = new Set(['.tga', '.png', '.jpg', '.jpeg'])

/**
 * ファイル名パターン: YYYY-MM-DD_HH-MM-SS.nnnnnnn_N.tga
 * _N がバースト連番。_0 が新しいシャッター押下の開始。
 */
const TGA_PATTERN = /^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d+)_(\d+)\.tga$/i

/** ファイル名からタイムスタンプとバースト番号をパース */
function parseTgaFilename(filename: string): { timestamp: Date; burstIndex: number } | null {
  const match = filename.match(TGA_PATTERN)
  if (!match) return null

  const [, date, h, m, s, _sub, burst] = match
  const [year, month, day] = date.split('-').map(Number)
  const timestamp = new Date(year, month - 1, day, Number(h), Number(m), Number(s))
  return { timestamp, burstIndex: Number(burst) }
}

/** フォルダを再帰的にスキャンして対応画像ファイルを収集 */
async function collectImageFiles(dirPath: string, images: TgaImage[], totalSizeRef: { value: number }) {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      const dirLower = entry.name.toLowerCase()
      if (dirLower === 'trash') continue
      await collectImageFiles(fullPath, images, totalSizeRef)
      continue
    }

    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue

    const stat = await fs.promises.stat(fullPath)
    const parsed = parseTgaFilename(entry.name)

    images.push({
      filePath: fullPath,
      baseName: path.parse(entry.name).name,
      fileSize: stat.size,
      timestamp: parsed?.timestamp ?? stat.mtime,
      burstIndex: parsed?.burstIndex ?? 0,
      picked: false,
      trashed: false,
    })
    totalSizeRef.value += stat.size
  }
}

/** フォルダ内のTGAファイルをスキャン（子フォルダを再帰） */
export async function scanFolder(folderPath: string): Promise<ScanResult> {
  // ファイルパスが渡された場合、親フォルダに解決
  const stat = await fs.promises.stat(folderPath)
  if (!stat.isDirectory()) {
    folderPath = path.dirname(folderPath)
  }

  const images: TgaImage[] = []
  const totalSizeRef = { value: 0 }
  await collectImageFiles(folderPath, images, totalSizeRef)
  const totalSize = totalSizeRef.value

  // タイムスタンプ + バーストインデックスでソート
  images.sort((a, b) => {
    const timeDiff = a.timestamp.getTime() - b.timestamp.getTime()
    if (timeDiff !== 0) return timeDiff
    return a.burstIndex - b.burstIndex
  })

  const groups = groupByBurst(images)
  return { images, groups, totalSize }
}

/** _0 区切りでバーストグルーピング */
function groupByBurst(images: TgaImage[]): BurstGroup[] {
  const groups: BurstGroup[] = []
  let currentGroup: TgaImage[] = []

  for (const img of images) {
    if (img.burstIndex === 0) {
      // 前のグループを確定
      if (currentGroup.length > 0) {
        groups.push(createGroup(currentGroup))
      }
      currentGroup = [img]
    } else {
      currentGroup.push(img)
    }
  }

  // 最後のグループ
  if (currentGroup.length > 0) {
    groups.push(createGroup(currentGroup))
  }

  return groups
}

function createGroup(images: TgaImage[]): BurstGroup {
  return {
    id: images[0].baseName,
    images,
    representative: images[0],
    isSingle: images.length === 1,
  }
}

/** 日付フォルダ一覧を取得 */
export async function listDateFolders(basePath: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(basePath, { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse()
  } catch {
    return []
  }
}
