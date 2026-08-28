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
function parseTgaFilename(filename: string): { timestamp: Date; sortTime: number; burstIndex: number } | null {
  const match = filename.match(TGA_PATTERN)
  if (!match) return null

  const [, date, h, m, s, sub, burst] = match
  const [year, month, day] = date.split('-').map(Number)
  const timestamp = new Date(year, month - 1, day, Number(h), Number(m), Number(s))
  if (
    timestamp.getFullYear() !== year || timestamp.getMonth() !== month - 1 ||
    timestamp.getDate() !== day || timestamp.getHours() !== Number(h) ||
    timestamp.getMinutes() !== Number(m) || timestamp.getSeconds() !== Number(s)
  ) {
    return null
  }
  const sortTime = timestamp.getTime() + Number(`0.${sub}`) * 1000
  return { timestamp, sortTime, burstIndex: Number(burst) }
}

/** フォルダを再帰的にスキャンして対応画像ファイルを収集 */
async function collectImageFiles(
  dirPath: string,
  images: TgaImage[],
  sortTimes: Map<string, number>,
  totalSizeRef: { value: number },
) {
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      const dirLower = entry.name.toLowerCase()
      if (dirLower === 'trash') continue
      await collectImageFiles(fullPath, images, sortTimes, totalSizeRef)
      continue
    }

    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue

    let stat: fs.Stats
    try {
      stat = await fs.promises.stat(fullPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    const parsed = parseTgaFilename(entry.name)

    images.push({
      filePath: fullPath,
      baseName: path.parse(entry.name).name,
      fileSize: stat.size,
      modifiedAt: stat.mtimeMs,
      timestamp: parsed?.timestamp ?? stat.mtime,
      burstIndex: parsed?.burstIndex ?? 0,
      picked: false,
      trashed: false,
    })
    sortTimes.set(fullPath, parsed?.sortTime ?? stat.mtimeMs)
    totalSizeRef.value += stat.size
  }
}

/** フォルダ内のTGAファイルをスキャン（子フォルダを再帰） */
export async function scanFolder(folderPath: string): Promise<ScanResult> {
  folderPath = await resolveFolderPath(folderPath)

  const images: TgaImage[] = []
  const sortTimes = new Map<string, number>()
  const totalSizeRef = { value: 0 }
  await collectImageFiles(folderPath, images, sortTimes, totalSizeRef)
  const totalSize = totalSizeRef.value

  // 撮影時刻（小数秒を含む）+ バーストインデックスでソート
  images.sort((a, b) => {
    const timeDiff = (sortTimes.get(a.filePath) ?? a.modifiedAt) - (sortTimes.get(b.filePath) ?? b.modifiedAt)
    if (timeDiff !== 0) return timeDiff
    return a.burstIndex - b.burstIndex
  })

  const groups = groupByBurst(images)
  return { images, groups, totalSize }
}

/** ファイルパスが渡された場合は親フォルダへ解決 */
export async function resolveFolderPath(folderPath: string): Promise<string> {
  const stat = await fs.promises.stat(folderPath)
  return stat.isDirectory() ? folderPath : path.dirname(folderPath)
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
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
