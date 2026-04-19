import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { VisualBook } from './use-bookshelf-books'
import { useBookshelfBooks } from './use-bookshelf-books'

// ── Shelf geometry constants ──────────────────────────────────────────────────
const SW = 5.4 // total width
const SH = 1.6 // height per shelf unit (will stack per shelf count)
const SD = 0.55 // depth
const PT = 0.06 // panel thickness
const ST = 0.08 // side thickness
const BOOK_DEPTH = 0.3
const GAP = 0.012 // gap between books

// ── Spine canvas texture ──────────────────────────────────────────────────────
function makeSpineTexture(
  color: string,
  accent: string,
  pattern: string,
  label: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = color
  ctx.fillRect(0, 0, 64, 256)

  ctx.strokeStyle = accent
  ctx.fillStyle = accent

  if (pattern === 'striped') {
    ctx.lineWidth = 2.5
    for (let y = 18; y < 238; y += 22) {
      ctx.beginPath()
      ctx.moveTo(8, y)
      ctx.lineTo(56, y)
      ctx.stroke()
    }
  } else if (pattern === 'bordered') {
    ctx.lineWidth = 4
    ctx.strokeRect(5, 5, 54, 246)
    ctx.lineWidth = 1.5
    ctx.strokeRect(9, 9, 46, 238)
  } else if (pattern === 'embossed') {
    ctx.lineWidth = 2
    const diamond = (cx: number, cy: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx + r * 0.65, cy)
      ctx.lineTo(cx, cy + r)
      ctx.lineTo(cx - r * 0.65, cy)
      ctx.closePath()
      ctx.stroke()
    }
    diamond(32, 42, 24)
    diamond(32, 214, 24)
  }

  // Title lines
  ctx.fillRect(10, 94, 44, 5)
  ctx.fillRect(14, 106, 36, 3.5)

  // Label text (category initial, readable as decoration)
  ctx.save()
  ctx.translate(32, 128)
  ctx.rotate(-Math.PI / 2)
  ctx.font = 'bold 10px sans-serif'
  ctx.fillStyle = accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label.slice(0, 18), 0, 0)
  ctx.restore()

  ctx.fillStyle = accent
  ctx.fillRect(12, 200, 40, 3)

  return new THREE.CanvasTexture(canvas)
}

// ── Single book mesh ──────────────────────────────────────────────────────────
function createBookMesh(book: VisualBook, xPos: number, yBase: number): THREE.Mesh {
  const { color, accent, pattern } = book.style
  const { thickness, height, title } = book

  const spineTexture = makeSpineTexture(color, accent, pattern, title)
  const hexColor = new THREE.Color(color)

  const materials: THREE.Material[] = [
    new THREE.MeshPhongMaterial({ color: hexColor, shininess: 15 }),
    new THREE.MeshPhongMaterial({ color: hexColor, shininess: 15 }),
    new THREE.MeshPhongMaterial({ color: 0xf5f0e8, shininess: 5 }), // pages top
    new THREE.MeshPhongMaterial({ color: 0xe0d8c8, shininess: 5 }),
    new THREE.MeshPhongMaterial({ map: spineTexture, shininess: 20 }), // spine
    new THREE.MeshPhongMaterial({ color: hexColor.clone().multiplyScalar(0.75) }),
  ]

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, BOOK_DEPTH), materials)
  mesh.position.set(xPos, yBase + height / 2, -0.04)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = { url: book.url, title: book.title, thumbnail: book.thumbnail, date: book.date }
  return mesh
}

// ── Bookcase structure ────────────────────────────────────────────────────────
function buildBookcase(scene: THREE.Scene, numShelves: number) {
  const totalHeight = SH * numShelves + PT // approx full height

  const mainWood = new THREE.MeshPhongMaterial({ color: 0x9c6b3c, shininess: 40 })
  const sideWood = new THREE.MeshPhongMaterial({ color: 0x7a5230, shininess: 25 })
  const shelfWood = new THREE.MeshPhongMaterial({ color: 0xb8864e, shininess: 35 })
  const backWood = new THREE.MeshPhongMaterial({ color: 0x6b4226, shininess: 10 })
  const edgeMat = new THREE.MeshPhongMaterial({ color: 0x5c3d1e, shininess: 50 })

  const group = new THREE.Group()
  const addBox = (geo: THREE.BoxGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
  }

  const halfH = totalHeight / 2

  // Left / right side panels
  addBox(new THREE.BoxGeometry(ST, totalHeight, SD), sideWood, -SW / 2 + ST / 2, 0, 0)
  addBox(new THREE.BoxGeometry(ST, totalHeight, SD), sideWood, SW / 2 - ST / 2, 0, 0)

  // Back panel
  const back = new THREE.Mesh(new THREE.BoxGeometry(SW, totalHeight, 0.04), backWood)
  back.position.set(0, 0, -SD / 2 + 0.02)
  group.add(back)

  // Horizontal panels: bottom + one per shelf + top
  const shelfYPositions: number[] = []
  for (let s = 0; s <= numShelves; s++) {
    const y = -halfH + PT / 2 + s * SH
    addBox(
      new THREE.BoxGeometry(SW - 2 * ST, PT, SD),
      s === 0 || s === numShelves ? mainWood : shelfWood,
      0,
      y,
      0
    )
    if (s < numShelves) shelfYPositions.push(y + PT / 2) // top surface of panel

    // Decorative front edge strip
    const edgeY = y + PT / 2
    const edge = new THREE.Mesh(new THREE.BoxGeometry(SW - 2 * ST, 0.022, 0.022), edgeMat)
    edge.position.set(0, edgeY, SD / 2 - 0.011)
    group.add(edge)
  }

  scene.add(group)
  return shelfYPositions // y = base Y for books on each shelf
}

// ── Place one shelf row of books ──────────────────────────────────────────────
function placeShelfBooks(books: VisualBook[], yBase: number, scene: THREE.Scene) {
  const totalW = books.reduce((s, b) => s + b.thickness, 0) + (books.length - 1) * GAP
  let x = -totalW / 2
  books.forEach((book) => {
    x += book.thickness / 2
    scene.add(createBookMesh(book, x, yBase))
    x += book.thickness / 2 + GAP
  })
}

// ── Tooltip types ─────────────────────────────────────────────────────────────
interface TooltipInfo {
  title: string
  thumbnail: string | null
  date: string
}

interface TooltipState {
  info: TooltipInfo
  x: number
  y: number
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

function BookTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { info, x, y } = tooltip
  const TOOLTIP_W = 224
  const safeX = x + 20 + TOOLTIP_W > window.innerWidth ? x - TOOLTIP_W - 12 : x + 16

  return (
    <div
      style={{ left: safeX, top: y - 12 }}
      className="pointer-events-none fixed z-50 w-56 overflow-hidden rounded-2xl border border-stone-200/60 bg-white/95 shadow-2xl backdrop-blur-md"
    >
      {info.thumbnail ? (
        <img src={info.thumbnail} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-20 w-full items-center justify-center bg-stone-100">
          <span className="text-3xl">📚</span>
        </div>
      )}
      <div className="px-3 py-2.5">
        <p className="text-sm leading-snug font-semibold text-stone-800">{info.title}</p>
        <p className="mt-1 text-xs text-stone-400">{formatDate(info.date)}</p>
      </div>
    </div>
  )
}

// ── Three.js canvas component ─────────────────────────────────────────────────
interface Props {
  books: VisualBook[]
  onTooltip: (state: TooltipState | null) => void
}

function ThreeCanvas({ books, onTooltip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || books.length === 0) return

    // Group by shelf index
    const shelvesMap = new Map<number, VisualBook[]>()
    books.forEach((b) => {
      const arr = shelvesMap.get(b.shelfIndex) ?? []
      arr.push(b)
      shelvesMap.set(b.shelfIndex, arr)
    })
    const numShelves = Math.max(...shelvesMap.keys()) + 1

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.FogExp2(0xb0d8f0, 0.035)

    // Camera
    const aspect = container.clientWidth / container.clientHeight
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 60)
    const cameraZ = 5 + numShelves * 0.8
    camera.position.set(0, 0, cameraZ)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.target.set(0, 0, 0)
    controls.minDistance = 2
    controls.maxDistance = 16
    controls.maxPolarAngle = Math.PI * 0.62
    controls.update()

    // Lighting
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.85))

    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(4, 7, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -10
    sun.shadow.camera.right = 10
    sun.shadow.camera.top = 10
    sun.shadow.camera.bottom = -10
    scene.add(sun)

    const fill = new THREE.DirectionalLight(0xc0d8ff, 0.45)
    fill.position.set(-5, 3, 3)
    scene.add(fill)

    // Build bookcase and get per-shelf y bases
    const shelfYBases = buildBookcase(scene, numShelves)

    // Place books per shelf
    shelvesMap.forEach((shelfBooks, idx) => {
      if (shelfYBases[idx] !== undefined) {
        placeShelfBooks(shelfBooks, shelfYBases[idx], scene)
      }
    })

    // Floor
    const totalHeight = SH * numShelves + PT
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshPhongMaterial({ color: 0xd9cdb8 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -totalHeight / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Click → open Notion page
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hit = raycaster.intersectObjects(scene.children, true)[0]
      if (hit?.object.userData?.url) window.open(hit.object.userData.url, '_blank')
    }
    renderer.domElement.addEventListener('click', onClick)

    // Hover → tooltip
    const onMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hit = raycaster.intersectObjects(scene.children, true)[0]
      const ud = hit?.object.userData
      if (ud?.url) {
        renderer.domElement.style.cursor = 'pointer'
        onTooltip({
          info: { title: ud.title, thumbnail: ud.thumbnail, date: ud.date },
          x: e.clientX,
          y: e.clientY,
        })
      } else {
        renderer.domElement.style.cursor = 'default'
        onTooltip(null)
      }
    }
    const onLeave = () => onTooltip(null)
    renderer.domElement.addEventListener('mousemove', onMove)
    renderer.domElement.addEventListener('mouseleave', onLeave)

    // Loop
    let rafId: number
    const animate = () => {
      rafId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('click', onClick)
      renderer.domElement.removeEventListener('mousemove', onMove)
      renderer.domElement.removeEventListener('mouseleave', onLeave)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [books])

  return <div ref={containerRef} className="h-full w-full" />
}

// ── Public component (handles loading / error state) ─────────────────────────
export function BookshelfScene() {
  const { data: books, isLoading, isError } = useBookshelfBooks()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-sky-200">
        <p className="animate-pulse text-lg font-medium text-stone-600">
          당신의 글을 책으로 불러오고 있어요...
        </p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-sky-100">
        <p className="text-lg font-semibold text-red-600">데이터 로딩 실패</p>
        <p className="text-xs text-stone-400">NOTION_TOKEN / DATABASE_ID를 확인해주세요.</p>
      </div>
    )
  }

  if (!books || books.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-sky-200">
        <p className="text-stone-500">공개된 게시글이 없어요.</p>
      </div>
    )
  }

  return (
    <div className="h-screen w-full">
      <ThreeCanvas books={books} onTooltip={setTooltip} />
      {tooltip && <BookTooltip tooltip={tooltip} />}
    </div>
  )
}
