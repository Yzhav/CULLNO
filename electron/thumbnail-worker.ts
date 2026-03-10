import { parentPort } from 'worker_threads'
import * as path from 'path'
import sharp from 'sharp'
import { decodeTga } from './tga-decoder'

interface ThumbnailRequest {
  id: number
  mode: 'thumbnail'
  filePath: string
  width: number
  quality: number
}

interface ExportPngRequest {
  id: number
  mode: 'export-png'
  filePath: string
  outPath: string
  format?: 'png' | 'jpeg'
  quality?: number
}

type WorkerRequest = ThumbnailRequest | ExportPngRequest

interface WorkerResponse {
  id: number
  buffer: Buffer | null
  error: string | null
}

/** TGA/PNG/JPG → sharp pipeline を取得 */
function createPipeline(filePath: string): Promise<sharp.Sharp> {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.tga') {
    return decodeTga(filePath).then(tga =>
      sharp(tga.pixels, {
        raw: { width: tga.width, height: tga.height, channels: tga.channels },
      })
    )
  }
  return Promise.resolve(sharp(filePath))
}

parentPort?.on('message', async (req: WorkerRequest) => {
  try {
    if (req.mode === 'export-png') {
      // エクスポート: 指定形式でファイルに書き出し
      const pipeline = await createPipeline(req.filePath)
      if (req.format === 'jpeg') {
        await pipeline.jpeg({ quality: req.quality ?? 90 }).toFile(req.outPath)
      } else {
        await pipeline.png().toFile(req.outPath)
      }
      parentPort?.postMessage({ id: req.id, buffer: null, error: null } as WorkerResponse)
    } else {
      // サムネイル: JEPGバッファを返却
      const pipeline = await createPipeline(req.filePath)
      const buffer = await pipeline
        .resize(req.width, undefined, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: req.quality })
        .toBuffer()
      parentPort?.postMessage({ id: req.id, buffer, error: null } as WorkerResponse)
    }
  } catch (err) {
    parentPort?.postMessage({ id: req.id, buffer: null, error: String(err) } as WorkerResponse)
  }
})
