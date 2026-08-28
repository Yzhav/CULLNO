import * as fs from 'fs'

export interface TgaData {
  width: number
  height: number
  channels: 3 | 4
  /** RGB or RGBA pixel data (top-to-bottom, left-to-right) */
  pixels: Buffer
}

/**
 * TGAファイルをデコードして生ピクセルデータを返す
 * VRChat等の撮影TGA（非圧縮/RLE、24bit/32bit）対応
 */
export async function decodeTga(filePath: string): Promise<TgaData> {
  const buf = await fs.promises.readFile(filePath)
  return decodeTgaBuffer(buf)
}

export function decodeTgaBuffer(buf: Buffer): TgaData {
  // Header (18 bytes)
  if (buf.length < 18) {
    throw new Error('Invalid TGA: header is truncated')
  }
  const idLength = buf[0]
  const colorMapType = buf[1]
  const imageType = buf[2]
  const width = buf.readUInt16LE(12)
  const height = buf.readUInt16LE(14)
  const bpp = buf[16] // bits per pixel
  const descriptor = buf[17]

  if (colorMapType !== 0) {
    throw new Error('Color-mapped TGA is not supported')
  }
  if (imageType !== 2 && imageType !== 10) {
    throw new Error(`Unsupported TGA image type: ${imageType}`)
  }
  if (bpp !== 24 && bpp !== 32) {
    throw new Error(`Unsupported TGA bit depth: ${bpp}`)
  }
  if (width === 0 || height === 0) {
    throw new Error('Invalid TGA: width and height must be greater than zero')
  }
  if ((descriptor & 0xC0) !== 0) {
    throw new Error('Interleaved TGA images are not supported')
  }

  const channels = (bpp / 8) as 3 | 4
  const byteLength = width * height * channels
  if (!Number.isSafeInteger(byteLength) || byteLength > 512 * 1024 * 1024) {
    throw new Error('Invalid TGA: decoded image is too large')
  }
  const topToBottom = (descriptor & 0x20) !== 0
  const rightToLeft = (descriptor & 0x10) !== 0
  const dataOffset = 18 + idLength
  if (dataOffset > buf.length) {
    throw new Error('Invalid TGA: image ID is truncated')
  }

  let rawPixels: Buffer
  if (imageType === 2) {
    // 非圧縮
    if (buf.length - dataOffset < byteLength) {
      throw new Error('Invalid TGA: pixel data is truncated')
    }
    rawPixels = buf.subarray(dataOffset, dataOffset + byteLength)
  } else {
    // RLE圧縮
    rawPixels = decodeRle(buf, dataOffset, width * height, channels)
  }

  // BGR(A) → RGB(A) に変換 + 上下反転
  const pixels = Buffer.allocUnsafe(byteLength)
  const rowBytes = width * channels

  for (let y = 0; y < height; y++) {
    const srcY = topToBottom ? y : (height - 1 - y)
    const srcOffset = srcY * rowBytes
    const dstOffset = y * rowBytes

    for (let x = 0; x < width; x++) {
      const srcX = rightToLeft ? width - 1 - x : x
      const si = srcOffset + srcX * channels
      const di = dstOffset + x * channels
      // BGR → RGB swap
      pixels[di] = rawPixels[si + 2]     // R
      pixels[di + 1] = rawPixels[si + 1] // G
      pixels[di + 2] = rawPixels[si]     // B
      if (channels === 4) {
        pixels[di + 3] = rawPixels[si + 3] // A
      }
    }
  }

  return { width, height, channels, pixels }
}

function decodeRle(buf: Buffer, offset: number, pixelCount: number, channels: number): Buffer {
  const output = Buffer.alloc(pixelCount * channels)
  let pos = offset
  let pixelIndex = 0

  while (pixelIndex < pixelCount) {
    if (pos >= buf.length) {
      throw new Error('Invalid TGA: RLE packet header is truncated')
    }
    const header = buf[pos++]
    const count = (header & 0x7F) + 1
    if (count > pixelCount - pixelIndex) {
      throw new Error('Invalid TGA: RLE packet exceeds the declared pixel count')
    }

    if (header & 0x80) {
      // RLE packet: 1 pixel repeated
      if (buf.length - pos < channels) {
        throw new Error('Invalid TGA: RLE pixel is truncated')
      }
      const pixel = buf.subarray(pos, pos + channels)
      pos += channels
      for (let i = 0; i < count; i++) {
        pixel.copy(output, pixelIndex * channels)
        pixelIndex++
      }
    } else {
      // Raw packet: sequential pixels
      const bytes = count * channels
      if (buf.length - pos < bytes) {
        throw new Error('Invalid TGA: raw RLE packet is truncated')
      }
      buf.copy(output, pixelIndex * channels, pos, pos + bytes)
      pos += bytes
      pixelIndex += count
    }
  }

  return output
}
