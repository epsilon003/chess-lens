// src/services/imagePreprocessor.js
/**
 * Client-side image preprocessing pipeline.
 * Runs entirely in the browser before upload using Canvas API.
 *
 * Steps:
 *   1. Auto-detect board region using edge/contrast analysis
 *   2. Crop to board with small margin
 *   3. Enhance contrast and sharpen
 *   4. Normalise lighting (CLAHE-like local contrast)
 *   5. Output a 640x640 JPEG blob ready for upload
 */

const OUTPUT_SIZE  = 640   // px — good balance of quality vs upload size
const JPEG_QUALITY = 0.92

// ── Main export ───────────────────────────────────────────────
export async function preprocessBoardImage(file) {
  /**
   * Takes a File/Blob, returns:
   * {
   *   blob:        Blob     — processed image ready for upload
   *   previewUrl:  string   — object URL for preview
   *   originalUrl: string   — object URL for original
   *   width:       number
   *   height:      number
   * }
   */
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  const ctx    = canvas.getContext('2d')

  // ── Step 1: Draw original at working resolution ───────────
  const MAX_WORKING = 1200
  const scale = Math.min(1, MAX_WORKING / Math.max(img.width, img.height))
  const w = Math.round(img.width  * scale)
  const h = Math.round(img.height * scale)
  canvas.width  = w
  canvas.height = h
  ctx.drawImage(img, 0, 0, w, h)

  let imageData = ctx.getImageData(0, 0, w, h)

  // ── Step 2: Auto-crop to board region ────────────────────
  const cropRect = detectBoardRegion(imageData, w, h)

  // ── Step 3: Draw cropped region to output canvas ─────────
  const out    = document.createElement('canvas')
  out.width    = OUTPUT_SIZE
  out.height   = OUTPUT_SIZE
  const outCtx = out.getContext('2d')

  outCtx.drawImage(
    canvas,
    cropRect.x, cropRect.y, cropRect.w, cropRect.h,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE
  )

  // ── Step 4: Enhance contrast and sharpen ─────────────────
  let outData = outCtx.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  outData = enhanceContrast(outData)
  outData = sharpen(outData, OUTPUT_SIZE, OUTPUT_SIZE)
  outCtx.putImageData(outData, 0, 0)

  // ── Step 5: Export ────────────────────────────────────────
  const blob = await canvasToBlob(out, JPEG_QUALITY)
  const previewUrl  = URL.createObjectURL(blob)
  const originalUrl = URL.createObjectURL(file)

  return { blob, previewUrl, originalUrl, width: OUTPUT_SIZE, height: OUTPUT_SIZE }
}

// ── Image loading ─────────────────────────────────────────────
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')) }
    img.src = url
  })
}

// ── Board region detection ────────────────────────────────────
// Uses gradient magnitude to find the dense rectangular region
// that most likely contains the chessboard.
function detectBoardRegion(imageData, w, h) {
  const data = imageData.data

  // Compute grayscale + edge magnitude row/col projections
  const rowEnergy = new Float32Array(h)
  const colEnergy = new Float32Array(w)

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i   = (y * w + x) * 4
      const gray = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114)

      const left  = (data[(y * w + x - 1) * 4] * 0.299 + data[(y * w + x - 1) * 4 + 1] * 0.587 + data[(y * w + x - 1) * 4 + 2] * 0.114)
      const right = (data[(y * w + x + 1) * 4] * 0.299 + data[(y * w + x + 1) * 4 + 1] * 0.587 + data[(y * w + x + 1) * 4 + 2] * 0.114)
      const up    = (data[((y-1) * w + x) * 4] * 0.299 + data[((y-1) * w + x) * 4 + 1] * 0.587 + data[((y-1) * w + x) * 4 + 2] * 0.114)
      const down  = (data[((y+1) * w + x) * 4] * 0.299 + data[((y+1) * w + x) * 4 + 1] * 0.587 + data[((y+1) * w + x) * 4 + 2] * 0.114)

      const grad = Math.abs(right - left) + Math.abs(down - up)
      rowEnergy[y] += grad
      colEnergy[x] += grad
    }
  }

  // Find bounding box of high-energy region
  // Use threshold at 20% of max energy
  const maxRow = Math.max(...rowEnergy)
  const maxCol = Math.max(...colEnergy)
  const rowThresh = maxRow * 0.2
  const colThresh = maxCol * 0.2

  let top    = 0,    bottom = h - 1
  let left   = 0,    right  = w - 1

  for (let y = 0; y < h; y++) { if (rowEnergy[y] > rowThresh) { top = y;    break } }
  for (let y = h-1; y >= 0; y--) { if (rowEnergy[y] > rowThresh) { bottom = y; break } }
  for (let x = 0; x < w; x++) { if (colEnergy[x] > colThresh) { left = x;   break } }
  for (let x = w-1; x >= 0; x--) { if (colEnergy[x] > colThresh) { right = x;  break } }

  // Add 3% margin and clamp
  const marginX = Math.round((right - left) * 0.03)
  const marginY = Math.round((bottom - top) * 0.03)

  const cropX = Math.max(0, left  - marginX)
  const cropY = Math.max(0, top   - marginY)
  const cropW = Math.min(w, right  + marginX) - cropX
  const cropH = Math.min(h, bottom + marginY) - cropY

  // Sanity check — if crop is less than 20% of image, skip cropping
  if (cropW < w * 0.2 || cropH < h * 0.2) {
    return { x: 0, y: 0, w, h }
  }

  return { x: cropX, y: cropY, w: cropW, h: cropH }
}

// ── Contrast enhancement ──────────────────────────────────────
// Stretches the histogram and boosts mid-range contrast
function enhanceContrast(imageData) {
  const data   = imageData.data
  const len    = data.length

  // Find min/max per channel for histogram stretch
  let rMin = 255, rMax = 0
  let gMin = 255, gMax = 0
  let bMin = 255, bMax = 0

  for (let i = 0; i < len; i += 4) {
    if (data[i]   < rMin) rMin = data[i];   if (data[i]   > rMax) rMax = data[i]
    if (data[i+1] < gMin) gMin = data[i+1]; if (data[i+1] > gMax) gMax = data[i+1]
    if (data[i+2] < bMin) bMin = data[i+2]; if (data[i+2] > bMax) bMax = data[i+2]
  }

  // Avoid divide by zero
  const rRange = rMax - rMin || 1
  const gRange = gMax - gMin || 1
  const bRange = bMax - bMin || 1

  // Contrast factor (1.0 = no change, 1.4 = moderate boost)
  const contrast = 1.3
  const factor   = (contrast * 255) / (255 - contrast * 255 / 2 + contrast * 255 / 2)

  for (let i = 0; i < len; i += 4) {
    // Histogram stretch
    let r = ((data[i]   - rMin) / rRange) * 255
    let g = ((data[i+1] - gMin) / gRange) * 255
    let b = ((data[i+2] - bMin) / bRange) * 255

    // S-curve contrast boost
    r = clamp(factor * (r - 128) + 128)
    g = clamp(factor * (g - 128) + 128)
    b = clamp(factor * (b - 128) + 128)

    data[i]   = r
    data[i+1] = g
    data[i+2] = b
  }

  return imageData
}

// ── Sharpening (unsharp mask) ─────────────────────────────────
function sharpen(imageData, w, h) {
  const data   = imageData.data
  const out    = new Uint8ClampedArray(data)
  const kernel = [
     0, -1,  0,
    -1,  5, -1,
     0, -1,  0,
  ]

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ki  = (ky + 1) * 3 + (kx + 1)
            const pi  = ((y + ky) * w + (x + kx)) * 4 + c
            sum += data[pi] * kernel[ki]
          }
        }
        out[(y * w + x) * 4 + c] = clamp(sum)
      }
    }
  }

  imageData.data.set(out)
  return imageData
}

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))) }

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas to blob failed')),
      'image/jpeg',
      quality
    )
  })
}
