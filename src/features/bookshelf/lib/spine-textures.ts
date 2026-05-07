import * as THREE from 'three'

const SPINE_TW = 128
const SPINE_TH = 512

function sampleHeight(data: Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
  const cx = Math.max(0, Math.min(w - 1, x))
  const cy = Math.max(0, Math.min(h - 1, y))
  return data[(cy * w + cx) * 4] / 255
}

function makeSpineHeightMap(pattern: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = SPINE_TW
  c.height = SPINE_TH
  const ctx = c.getContext('2d')!

  // Base: mid gray (flat)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, SPINE_TW, SPINE_TH)

  if (pattern === 'plain') {
    const id = ctx.getImageData(0, 0, SPINE_TW, SPINE_TH)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.max(0, Math.min(255, 128 + (Math.random() - 0.5) * 10))
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v
      id.data[i + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
  }

  if (pattern === 'bordered') {
    const grooves: Array<{ inset: number; lineW: number; v: number }> = [
      { inset: 10, lineW: 2.5, v: 60 },
      { inset: 14, lineW: 1, v: 185 },
      { inset: 18, lineW: 2.5, v: 60 },
      { inset: 22, lineW: 1, v: 185 },
    ]
    for (const { inset, lineW, v } of grooves) {
      ctx.strokeStyle = `rgb(${v},${v},${v})`
      ctx.lineWidth = lineW
      ctx.strokeRect(inset, inset, SPINE_TW - inset * 2, SPINE_TH - inset * 2)
    }
  }

  if (pattern === 'striped') {
    // Delicate filigree: vertical micro-engraving + tiny diamonds (no horizontal lines)
    const grooves: Array<{ inset: number; lineW: number; v: number }> = [
      { inset: 12, lineW: 1.2, v: 80 },
      { inset: 16, lineW: 1, v: 170 },
    ]
    for (const { inset, lineW, v } of grooves) {
      ctx.strokeStyle = `rgb(${v},${v},${v})`
      ctx.lineWidth = lineW
      ctx.strokeRect(inset, inset, SPINE_TW - inset * 2, SPINE_TH - inset * 2)
    }

    for (let x = 26; x < SPINE_TW - 26; x += 14) {
      ctx.strokeStyle = '#9a9a9a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 86)
      ctx.lineTo(x, SPINE_TH - 86)
      ctx.stroke()
    }

    const mx = SPINE_TW / 2
    for (let y = 94; y < SPINE_TH - 94; y += 58) {
      ctx.fillStyle = '#c4c4c4'
      ctx.strokeStyle = '#6f6f6f'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(mx, y - 7)
      ctx.lineTo(mx + 6, y)
      ctx.lineTo(mx, y + 7)
      ctx.lineTo(mx - 6, y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  if (pattern === 'embossed') {
    const mx = SPINE_TW / 2
    const my = SPINE_TH / 2

    // Outer + inner frame
    ctx.strokeStyle = '#505050'
    ctx.lineWidth = 3
    ctx.strokeRect(8, 8, SPINE_TW - 16, SPINE_TH - 16)
    ctx.strokeStyle = '#b8b8b8'
    ctx.lineWidth = 1
    ctx.strokeRect(12, 12, SPINE_TW - 24, SPINE_TH - 24)

    // Corner ornaments
    const corners: Array<[number, number, number]> = [
      [18, 20, 7],
      [SPINE_TW - 18, 20, 7],
      [18, SPINE_TH - 20, 7],
      [SPINE_TW - 18, SPINE_TH - 20, 7],
    ]
    corners.forEach(([cx, cy, r]) => {
      ctx.strokeStyle = '#b8b8b8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - 9, cy)
      ctx.lineTo(cx + 9, cy)
      ctx.moveTo(cx, cy - 9)
      ctx.lineTo(cx, cy + 9)
      ctx.stroke()
    })

    // Top/bottom diamonds
    const diamond = (cy: number) => {
      ctx.fillStyle = '#cfcfcf'
      ctx.strokeStyle = '#6b6b6b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(mx, cy - 12)
      ctx.lineTo(mx + 8, cy)
      ctx.lineTo(mx, cy + 12)
      ctx.lineTo(mx - 8, cy)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    diamond(94)
    diamond(SPINE_TH - 94)

    // Medallion ring + disc
    ctx.strokeStyle = '#484848'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(mx, my, 46, 0, Math.PI * 2)
    ctx.stroke()

    const disc = ctx.createRadialGradient(mx - 10, my - 10, 6, mx, my, 42)
    disc.addColorStop(0, '#f4f4f4')
    disc.addColorStop(0.55, '#d0d0d0')
    disc.addColorStop(1, '#8c8c8c')
    ctx.fillStyle = disc
    ctx.beginPath()
    ctx.arc(mx, my, 40, 0, Math.PI * 2)
    ctx.fill()

    // Radial spokes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.strokeStyle = '#b0b0b0'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(mx + Math.cos(a) * 14, my + Math.sin(a) * 14)
      ctx.lineTo(mx + Math.cos(a) * 32, my + Math.sin(a) * 32)
      ctx.stroke()
    }

    // Center cap
    const cap = ctx.createRadialGradient(mx - 3, my - 3, 2, mx, my, 12)
    cap.addColorStop(0, '#ffffff')
    cap.addColorStop(1, '#9a9a9a')
    ctx.fillStyle = cap
    ctx.beginPath()
    ctx.arc(mx, my, 12, 0, Math.PI * 2)
    ctx.fill()
  }

  return c
}

function toNormalMap(hm: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
  const { width: w, height: h } = hm
  const src = hm.getContext('2d')!.getImageData(0, 0, w, h).data

  const dst = document.createElement('canvas')
  dst.width = w
  dst.height = h
  const dstCtx = dst.getContext('2d')!
  const out = dstCtx.createImageData(w, h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sampleHeight(src, w, h, x - 1, y - 1)
      const t = sampleHeight(src, w, h, x, y - 1)
      const tr = sampleHeight(src, w, h, x + 1, y - 1)
      const l = sampleHeight(src, w, h, x - 1, y)
      const r = sampleHeight(src, w, h, x + 1, y)
      const bl = sampleHeight(src, w, h, x - 1, y + 1)
      const b = sampleHeight(src, w, h, x, y + 1)
      const br = sampleHeight(src, w, h, x + 1, y + 1)

      const dx = tr + 2 * r + br - (tl + 2 * l + bl)
      const dy = bl + 2 * b + br - (tl + 2 * t + tr)

      const nx = -dx * strength
      const ny = -dy * strength
      const nz = 1.0
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

      const i = (y * w + x) * 4
      out.data[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
      out.data[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
      out.data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255)
      out.data[i + 3] = 255
    }
  }

  dstCtx.putImageData(out, 0, 0)
  return new THREE.CanvasTexture(dst)
}

const spineNormalCache = new Map<string, THREE.CanvasTexture>()

function normalStrengthFor(pattern: string): number {
  if (pattern === 'embossed') return 10.0
  if (pattern === 'bordered') return 7.2
  if (pattern === 'striped') return 5.4
  return 3.6
}

export function getSpineNormalMap(pattern: string): THREE.CanvasTexture {
  const cached = spineNormalCache.get(pattern)
  if (cached) return cached
  const heightMap = makeSpineHeightMap(pattern)
  const normalMap = toNormalMap(heightMap, normalStrengthFor(pattern))
  spineNormalCache.set(pattern, normalMap)
  return normalMap
}

export function makeSpineTexture(
  color: string,
  accent: string,
  pattern: string,
  label: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SPINE_TW
  canvas.height = SPINE_TH
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = color
  ctx.fillRect(0, 0, SPINE_TW, SPINE_TH)

  ctx.strokeStyle = accent
  ctx.fillStyle = accent

  if (pattern === 'striped') {
    ctx.lineWidth = 1.5
    for (let x = 26; x < SPINE_TW - 26; x += 14) {
      ctx.beginPath()
      ctx.moveTo(x, 80)
      ctx.lineTo(x, SPINE_TH - 80)
      ctx.stroke()
    }
    for (let y = 98; y < SPINE_TH - 98; y += 58) {
      ctx.beginPath()
      ctx.moveTo(SPINE_TW / 2, y - 6)
      ctx.lineTo(SPINE_TW / 2 + 6, y)
      ctx.lineTo(SPINE_TW / 2, y + 6)
      ctx.lineTo(SPINE_TW / 2 - 6, y)
      ctx.closePath()
      ctx.stroke()
    }
  } else if (pattern === 'bordered') {
    ctx.lineWidth = 8
    ctx.strokeRect(10, 10, 108, 492)
    ctx.lineWidth = 3
    ctx.strokeRect(18, 18, 92, 476)
  } else if (pattern === 'embossed') {
    ctx.lineWidth = 2
    ctx.strokeStyle = accent
    const diamond = (cx: number, cy: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx + r * 0.7, cy)
      ctx.lineTo(cx, cy + r)
      ctx.lineTo(cx - r * 0.7, cy)
      ctx.closePath()
      ctx.stroke()
    }
    diamond(SPINE_TW / 2, 94, 26)
    diamond(SPINE_TW / 2, SPINE_TH - 94, 26)

    // Medallion outline on color map
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(SPINE_TW / 2, SPINE_TH / 2, 34, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Vertical ornament (no horizontal bands)
  ctx.globalAlpha = 0.85
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(SPINE_TW / 2, 120)
  ctx.lineTo(SPINE_TW / 2, SPINE_TH - 120)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.arc(SPINE_TW / 2, 110, 3, 0, Math.PI * 2)
  ctx.arc(SPINE_TW / 2, SPINE_TH - 110, 3, 0, Math.PI * 2)
  ctx.fill()

  // Title text — horizontal, larger, ellipsis if too long
  const maxChars = 16
  const text = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label
  const fontSize = 32
  const base = new THREE.Color(color)
  const luminance = 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b
  const titleColor = luminance < 0.55 ? '#ffffff' : '#111111'
  ctx.save()
  ctx.translate(SPINE_TW / 2, SPINE_TH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.fillStyle = titleColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  ctx.restore()

  return new THREE.CanvasTexture(canvas)
}
