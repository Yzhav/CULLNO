import { parentPort } from 'worker_threads'
import sharp from 'sharp'
import { decodeTga } from './tga-decoder'

interface WorkerRequest {
  id: number
  filePath: string
  width: number
  quality: number
}

interface WorkerResponse {
  id: number
  buffer: Buffer | null
  error: string | null
}

parentPort?.on('message', async (req: WorkerRequest) => {
  try {
    const tga = await decodeTga(req.filePath)
    const buffer = await sharp(tga.pixels, {
      raw: { width: tga.width, height: tga.height, channels: tga.channels },
    })
      .resize(req.width, undefined, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: req.quality })
      .toBuffer()

    parentPort?.postMessage({ id: req.id, buffer, error: null } as WorkerResponse)
  } catch (err) {
    parentPort?.postMessage({ id: req.id, buffer: null, error: String(err) } as WorkerResponse)
  }
})
