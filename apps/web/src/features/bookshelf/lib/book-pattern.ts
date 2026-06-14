export type BookPattern = 'plain' | 'bordered' | 'striped' | 'embossed'

// pattern → 금속성 (전문성 높을수록 광택)
// 환경맵이 없는 씬에서 metalness가 높으면 반사 대상이 없어 책이 어둡게 보이므로 0.15 이하로 제한
// (표면 거칠기(roughness)는 독창성 점수가 별도로 결정 — scoring.ts originalityToRoughness)
export const PATTERN_MAT: Record<BookPattern, { metalness: number }> = {
  plain:    { metalness: 0.02 },
  bordered: { metalness: 0.06 },
  striped:  { metalness: 0.10 },
  embossed: { metalness: 0.15 },
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// 베이스 컬러보다 밝은 금빛 계열 억센트
function accentColor(baseHex: string): string {
  const [r, g, b] = hexToRgb(baseHex)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness < 100 ? 'rgba(220,190,120,0.72)' : 'rgba(255,215,100,0.6)'
}

// 독창성 점수 → canvas 표면 그레인 (0: 매끄러움, 1: 거친 크로스해칭)
// 독창성 점수 → 표면 거칠기 (score 0~1, 높을수록 촘촘한 크로스해칭)
// 랜덤 노이즈 대신 규칙적 사선 패턴 사용 — 텍스처 다운스케일에도 선명하게 유지
function drawGrain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  originalityScore: number,
): void {
  // score 0.05 미만은 '매끄러움' 표현 — 아무것도 그리지 않음
  if (originalityScore < 0.05) return

  // gap: 40(듬성) → 8(촘촘), alpha: 0.25 → 0.55
  const gap   = Math.round(40 - originalityScore * 32) // 40 ~ 8
  const alpha = 0.25 + originalityScore * 0.3          // 0.25 ~ 0.55
  const lineW = 1.5 + originalityScore * 2             // 1.5 ~ 3.5

  ctx.save()
  ctx.strokeStyle = `rgba(0,0,0,${alpha})`
  ctx.lineWidth = lineW

  // 45° 사선 (항상)
  ctx.beginPath()
  for (let i = -h; i < w + h; i += gap) {
    ctx.moveTo(i, 0)
    ctx.lineTo(i + h, h)
  }
  ctx.stroke()

  // score 0.5 이상: 역방향(-45°) 추가 → 격자 크로스해칭
  if (originalityScore >= 0.5) {
    ctx.beginPath()
    for (let i = -h; i < w + h; i += gap) {
      ctx.moveTo(i + h, 0)
      ctx.lineTo(i, h)
    }
    ctx.stroke()
  }

  ctx.restore()
}

export function drawPatternOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pattern: BookPattern,
  baseColor: string,
  originalityScore = 0,
): void {
  drawGrain(ctx, w, h, originalityScore)
  if (pattern === 'plain') return

  const accent = accentColor(baseColor)
  const pad = Math.min(w, h) * 0.06

  if (pattern === 'bordered') {
    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.025)
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)
  }

  if (pattern === 'striped') {
    // 금테두리 + 코너 대각 장식선
    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.025)
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)

    const c = Math.min(w, h) * 0.12
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.018)
    for (const [ox, oy, dx, dy] of [
      [pad, pad, c, 0], [pad, pad, 0, c],
      [w - pad, pad, -c, 0], [w - pad, pad, 0, c],
      [pad, h - pad, c, 0], [pad, h - pad, 0, -c],
      [w - pad, h - pad, -c, 0], [w - pad, h - pad, 0, -c],
    ] as [number, number, number, number][]) {
      ctx.beginPath()
      ctx.moveTo(ox, oy)
      ctx.lineTo(ox + dx, oy + dy)
      ctx.stroke()
    }
  }

  if (pattern === 'embossed') {
    // 이중 프레임 + 코너 원형/다이아몬드 장식
    const outer = pad
    const inner = pad * 2.2

    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(2.5, Math.min(w, h) * 0.03)
    ctx.strokeRect(outer, outer, w - outer * 2, h - outer * 2)

    ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.016)
    ctx.strokeRect(inner, inner, w - inner * 2, h - inner * 2)

    const r = Math.min(w, h) * 0.045
    for (const [cx, cy] of [
      [inner, inner],
      [w - inner, inner],
      [inner, h - inner],
      [w - inner, h - inner],
    ] as [number, number][]) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    const d = r * 0.7
    for (const [cx, cy] of [
      [w / 2, inner],
      [w / 2, h - inner],
      [inner, h / 2],
      [w - inner, h / 2],
    ] as [number, number][]) {
      ctx.beginPath()
      ctx.moveTo(cx, cy - d)
      ctx.lineTo(cx + d, cy)
      ctx.lineTo(cx, cy + d)
      ctx.lineTo(cx - d, cy)
      ctx.closePath()
      ctx.stroke()
    }
  }
}
