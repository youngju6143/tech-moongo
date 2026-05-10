/**
 * PoC: 전문성 수준별 음각/양각 표현
 *
 * 파이프라인:
 *   1. makeHeightMap()  — 회색조 높이 맵 생성 (흰=돌출, 회=평면, 검=음각)
 *   2. toNormalMap()    — Sobel 필터로 높이 맵 → RGB 법선 맵 변환
 *   3. MeshStandardMaterial.normalMap 에 적용
 *
 * 사용법: <BookNormalMapPoc /> 를 원하는 페이지에 렌더링
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// ─── 타입 ──────────────────────────────────────────────────────────────────

type DepthLevel = 'plain' | 'bordered' | 'striped' | 'embossed'

// ─── 상수 ──────────────────────────────────────────────────────────────────

const LEVELS: DepthLevel[] = ['plain', 'bordered', 'striped', 'embossed']
const LEVEL_LABELS = ['평면 (기본)', '선각 (경계)', '횡줄 양각', '문장 양각']

// 책 컬러 (카테고리 색 역할)
const BOOK_COLORS = ['#6b9fbd', '#b8865a', '#6aab72', '#9468b0']

// 텍스처 해상도: 척 비율(좁고 긺) 에 맞게 1:4
const TW = 128
const TH = 512

// ─── Height Map 헬퍼 ───────────────────────────────────────────────────────

/** ImageData에서 (x, y) 픽셀 밝기를 0–1로 샘플링 (경계 클램프) */
function sampleHeight(data: Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
  const cx = Math.max(0, Math.min(w - 1, x))
  const cy = Math.max(0, Math.min(h - 1, y))
  return data[(cy * w + cx) * 4] / 255
}

/**
 * 깊이 수준별 grayscale 높이 맵 캔버스를 생성합니다.
 * - 흰색(255) = 돌출 (빛을 받음)
 * - 회색(128) = 평면
 * - 검정(0)   = 음각 (그늘짐)
 */
function makeHeightMap(level: DepthLevel): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = TW
  c.height = TH
  const ctx = c.getContext('2d')!

  // 기본: 중간 회색 (평면)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, TW, TH)

  if (level === 'plain') {
    // 미세 종이/천 grain — 법선 맵이 거의 평면이지만 재질감이 생김
    const id = ctx.getImageData(0, 0, TW, TH)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.max(0, Math.min(255, 128 + (Math.random() - 0.5) * 14))
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v
      id.data[i + 3] = 255
    }
    ctx.putImageData(id, 0, 0)
  }

  if (level === 'bordered') {
    // 이중 인셋 홈(groove) 프레임 — 선각(線刻)
    const grooves: Array<{ inset: number; lineW: number; v: number }> = [
      { inset: 8,  lineW: 3, v: 45  }, // 바깥 홈 (어두움 = 음각)
      { inset: 12, lineW: 1, v: 195 }, // 하이라이트 엣지
      { inset: 16, lineW: 3, v: 45  }, // 안쪽 홈
      { inset: 20, lineW: 1, v: 195 }, // 하이라이트 엣지
    ]
    for (const { inset, lineW, v } of grooves) {
      ctx.strokeStyle = `rgb(${v},${v},${v})`
      ctx.lineWidth = lineW
      ctx.strokeRect(inset, inset, TW - inset * 2, TH - inset * 2)
    }
    // 상하 장식 횡선
    for (const y of [44, 48, TH - 48, TH - 44]) {
      ctx.strokeStyle = '#606060'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(24, y)
      ctx.lineTo(TW - 24, y)
      ctx.stroke()
    }
  }

  if (level === 'striped') {
    // 수평 양각 릴리프 — 책 등 가로결 표현
    const spacing = 30
    const ridgeH = 5
    for (let y = 20; y < TH - 20; y += spacing) {
      // 볼록 능선: 중심이 밝고 양 끝이 어두움
      const grad = ctx.createLinearGradient(0, y - ridgeH, 0, y + ridgeH)
      grad.addColorStop(0,   '#686868')
      grad.addColorStop(0.3, '#c8c8c8')
      grad.addColorStop(0.5, '#e8e8e8')
      grad.addColorStop(0.7, '#c8c8c8')
      grad.addColorStop(1,   '#686868')
      ctx.fillStyle = grad
      ctx.fillRect(8, y - ridgeH, TW - 16, ridgeH * 2)
    }
    // 릴리프 사이 음각 홈
    for (let y = 20 + spacing / 2; y < TH - 20; y += spacing) {
      ctx.strokeStyle = '#585858'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(8, y)
      ctx.lineTo(TW - 8, y)
      ctx.stroke()
    }
  }

  if (level === 'embossed') {
    // 문장(紋章) 양각 — 중앙 메달리온 + 다이아몬드 장식 + 코너 플뢰롱
    const mx = TW / 2
    const my = TH / 2

    // 외곽 이중 프레임 (bordered 기반)
    ctx.strokeStyle = '#505050'
    ctx.lineWidth = 3
    ctx.strokeRect(8, 8, TW - 16, TH - 16)
    ctx.strokeStyle = '#b8b8b8'
    ctx.lineWidth = 1
    ctx.strokeRect(12, 12, TW - 24, TH - 24)

    // 메달리온 외곽 홈 (음각 링)
    ctx.strokeStyle = '#484848'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(mx, my, 46, 0, Math.PI * 2)
    ctx.stroke()

    // 메달리온 디스크 (볼록, 구면 방향 라이팅)
    const disc = ctx.createRadialGradient(mx - 8, my - 8, 5, mx, my, 40)
    disc.addColorStop(0,   '#eeeeee')
    disc.addColorStop(0.5, '#cccccc')
    disc.addColorStop(1,   '#888888')
    ctx.fillStyle = disc
    ctx.beginPath()
    ctx.arc(mx, my, 40, 0, Math.PI * 2)
    ctx.fill()

    // 8줄 방사 음각 선
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.strokeStyle = '#b0b0b0'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(mx + Math.cos(a) * 14, my + Math.sin(a) * 14)
      ctx.lineTo(mx + Math.cos(a) * 33, my + Math.sin(a) * 33)
      ctx.stroke()
    }

    // 중심 볼록 원형 캡
    const cap = ctx.createRadialGradient(mx - 3, my - 3, 2, mx, my, 13)
    cap.addColorStop(0, '#ffffff')
    cap.addColorStop(1, '#999999')
    ctx.fillStyle = cap
    ctx.beginPath()
    ctx.arc(mx, my, 13, 0, Math.PI * 2)
    ctx.fill()

    // 상·하 다이아몬드 장식
    for (const oy of [TH * 0.21, TH * 0.79]) {
      // 외곽 다이아몬드
      ctx.fillStyle = '#c0c0c0'
      ctx.strokeStyle = '#505050'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(mx,      oy - 16)
      ctx.lineTo(mx + 10, oy)
      ctx.lineTo(mx,      oy + 16)
      ctx.lineTo(mx - 10, oy)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      // 내부 소형 다이아몬드
      ctx.fillStyle = '#e8e8e8'
      ctx.beginPath()
      ctx.moveTo(mx,     oy - 7)
      ctx.lineTo(mx + 5, oy)
      ctx.lineTo(mx,     oy + 7)
      ctx.lineTo(mx - 5, oy)
      ctx.closePath()
      ctx.fill()
    }

    // 코너 플뢰롱 (꽃잎형 장식)
    const corners: [number, number][] = [
      [22, 26], [TW - 22, 26], [22, TH - 26], [TW - 22, TH - 26],
    ]
    for (const [cx2, cy2] of corners) {
      ctx.strokeStyle = '#b8b8b8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cx2, cy2, 7, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx2 - 11, cy2)
      ctx.lineTo(cx2 + 11, cy2)
      ctx.moveTo(cx2, cy2 - 11)
      ctx.lineTo(cx2, cy2 + 11)
      ctx.stroke()
    }

    // 메달리온↔다이아몬드 사이 이중 횡선
    for (const [y1, y2] of [[TH * 0.33, TH * 0.355], [TH * 0.645, TH * 0.67]]) {
      for (const y of [y1, y2]) {
        ctx.strokeStyle = '#909090'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(22, y)
        ctx.lineTo(TW - 22, y)
        ctx.stroke()
      }
    }
  }

  return c
}

// ─── Sobel 필터: Height Map → Normal Map ──────────────────────────────────

/**
 * 높이 맵의 기울기를 Sobel 커널로 계산해 RGB 법선 맵으로 변환합니다.
 * - R: 수평 기울기 → 좌우 음양각
 * - G: 수직 기울기 → 상하 음양각
 * - B: Z 법선 (항상 앞 방향)
 * strength 값이 클수록 깊이감이 강해집니다.
 */
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
      // 3×3 이웃 픽셀 샘플링
      const tl = sampleHeight(src, w, h, x - 1, y - 1)
      const t  = sampleHeight(src, w, h, x,     y - 1)
      const tr = sampleHeight(src, w, h, x + 1, y - 1)
      const l  = sampleHeight(src, w, h, x - 1, y    )
      const r  = sampleHeight(src, w, h, x + 1, y    )
      const bl = sampleHeight(src, w, h, x - 1, y + 1)
      const b  = sampleHeight(src, w, h, x,     y + 1)
      const br = sampleHeight(src, w, h, x + 1, y + 1)

      // Sobel 커널으로 수평·수직 기울기
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl)
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr)

      // 기울기 → 법선 벡터 (정규화)
      const nx = -dx * strength
      const ny = -dy * strength
      const nz = 1.0
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

      // [-1, 1] → [0, 255] 인코딩
      const i = (y * w + x) * 4
      out.data[i]     = Math.round((nx / len * 0.5 + 0.5) * 255)
      out.data[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255)
      out.data[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255)
      out.data[i + 3] = 255
    }
  }

  dstCtx.putImageData(out, 0, 0)
  return new THREE.CanvasTexture(dst)
}

// ─── 척 색상 텍스처 ─────────────────────────────────────────────────────────

function makeColorTexture(color: string, level: DepthLevel): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = TW
  c.height = TH
  const ctx = c.getContext('2d')!

  const base = new THREE.Color(color)
  const dark = `#${base.clone().multiplyScalar(0.55).getHexString()}`
  const light = `#${base.clone().multiplyScalar(1.25).getHexString()}`

  // 기본 색상
  ctx.fillStyle = color
  ctx.fillRect(0, 0, TW, TH)

  // 상단 다크 타이틀 바
  ctx.fillStyle = dark
  ctx.fillRect(0, 0, TW, 72)

  // 하단 액센트 바
  ctx.fillStyle = dark
  ctx.fillRect(0, TH - 28, TW, 28)

  // 레벨 인디케이터 도트 (상단 바 내)
  const dotCount = LEVELS.indexOf(level) + 1
  for (let i = 0; i < dotCount; i++) {
    ctx.fillStyle = light
    ctx.beginPath()
    ctx.arc(TW / 2 - (dotCount - 1) * 7 + i * 14, 28, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // 척 제목 텍스트 (세로)
  ctx.save()
  ctx.translate(TW / 2, TH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(level.toUpperCase(), 0, 0)
  ctx.restore()

  return new THREE.CanvasTexture(c)
}

// ─── 책 메시 생성 ─────────────────────────────────────────────────────────

function createBook(level: DepthLevel, color: string, normalStrength: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.15, 0.8, 0.3)

  const heightMap  = makeHeightMap(level)
  const normalMap  = toNormalMap(heightMap, normalStrength)
  const colorTex   = makeColorTexture(color, level)

  const col = new THREE.Color(color)

  // 척(spine) — 법선 맵 적용
  const spineMat = new THREE.MeshStandardMaterial({
    map: colorTex,
    normalMap,
    normalScale: new THREE.Vector2(1.8, 1.8),
    roughness: 0.72,
    metalness: 0.04,
  })

  // 측면·뒷면
  const sideMat = new THREE.MeshStandardMaterial({
    color: col.clone().multiplyScalar(0.7),
    roughness: 0.85,
  })

  // 상·하단 (페이지 단면)
  const topMat    = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.92 })
  const bottomMat = new THREE.MeshStandardMaterial({ color: 0xddd5c5, roughness: 0.92 })

  // BoxGeometry 면 순서: +X, -X, +Y, -Y, +Z(척/앞), -Z(뒤)
  const mesh = new THREE.Mesh(geo, [sideMat, sideMat, topMat, bottomMat, spineMat, sideMat])
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// ─── React 컴포넌트 ───────────────────────────────────────────────────────

export function BookNormalMapPoc() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const W = 900
    const H = 500

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1c1c28)
    scene.fog = new THREE.Fog(0x1c1c28, 8, 18)

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 50)
    camera.position.set(0, 0.5, 4.2)

    // ── 조명: 비스듬히 쏴야 normal map 음영이 보임 ──
    const ambient = new THREE.AmbientLight(0xfff0e0, 0.35)
    scene.add(ambient)

    // 주 광원 — 왼쪽 상단 앞에서
    const sun = new THREE.DirectionalLight(0xfff5e8, 3.0)
    sun.position.set(-3.5, 5, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    scene.add(sun)

    // 보조 광원 — 오른쪽 하단 (반대 면 살리기)
    const fill = new THREE.DirectionalLight(0xb0c8ff, 0.6)
    fill.position.set(4, -1, 3)
    scene.add(fill)

    // ── 책 4권 배치 ──
    LEVELS.forEach((level, i) => {
      const book = createBook(level, BOOK_COLORS[i], 4.5)
      book.position.x = (i - 1.5) * 0.52
      scene.add(book)
    })

    // ── 바닥 ──
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ color: 0x141420, roughness: 0.98 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.42
    floor.receiveShadow = true
    scene.add(floor)

    // ── OrbitControls ──
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.target.set(0, 0, 0)
    controls.minDistance = 1.5
    controls.maxDistance = 9

    let animId: number
    const tick = () => {
      animId = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(animId)
      controls.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#1c1c28] p-8">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-white">Normal Map PoC — 전문성별 음각/양각</h1>
        <p className="mt-1 text-xs text-stone-400">드래그로 회전해서 조명 각도에 따른 깊이감 확인</p>
      </div>

      <canvas ref={canvasRef} className="rounded-xl" />

      {/* 레전드 */}
      <div className="flex gap-10">
        {LEVELS.map((level, i) => (
          <div key={level} className="flex flex-col items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: BOOK_COLORS[i] }} />
            <span className="text-xs font-medium text-stone-200">{LEVEL_LABELS[i]}</span>
            <span className="text-[10px] text-stone-500">depth {i + 1}/4</span>
          </div>
        ))}
      </div>

      {/* 파이프라인 설명 */}
      <div className="flex items-center gap-2 rounded-lg border border-stone-700 bg-stone-900/60 px-5 py-3 text-[11px] text-stone-400">
        <span>Height Map</span>
        <span className="text-stone-600">→</span>
        <span>Sobel Filter</span>
        <span className="text-stone-600">→</span>
        <span>Normal Map</span>
        <span className="text-stone-600">→</span>
        <span>MeshStandardMaterial</span>
      </div>
    </div>
  )
}
