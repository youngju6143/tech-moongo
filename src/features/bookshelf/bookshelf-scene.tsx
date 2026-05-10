import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { VisualBook } from './use-bookshelf-books'
import { useBookshelfBooks } from './use-bookshelf-books'

// ── Shelf geometry constants (SW is now dynamic) ──────────────────────────────
const SH = 1.2 // height per shelf unit
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
  canvas.width = 128
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = color
  ctx.fillRect(0, 0, 128, 512)

  ctx.strokeStyle = accent
  ctx.fillStyle = accent

  if (pattern === 'striped') {
    ctx.lineWidth = 5
    for (let y = 36; y < 476; y += 44) {
      ctx.beginPath()
      ctx.moveTo(16, y)
      ctx.lineTo(112, y)
      ctx.stroke()
    }
  } else if (pattern === 'bordered') {
    ctx.lineWidth = 8
    ctx.strokeRect(10, 10, 108, 492)
    ctx.lineWidth = 3
    ctx.strokeRect(18, 18, 92, 476)
  } else if (pattern === 'embossed') {
    ctx.lineWidth = 4
    const diamond = (cx: number, cy: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx + r * 0.65, cy)
      ctx.lineTo(cx, cy + r)
      ctx.lineTo(cx - r * 0.65, cy)
      ctx.closePath()
      ctx.stroke()
    }
    diamond(64, 84, 48)
    diamond(64, 428, 48)
  }

  // Decorative title bar lines
  ctx.fillRect(20, 188, 88, 10)
  ctx.fillRect(28, 212, 72, 7)

  // Title text — rotated to run along spine length
  ctx.save()
  ctx.translate(64, 256)
  ctx.rotate(-Math.PI / 2)
  ctx.font = 'bold 20px sans-serif'
  ctx.fillStyle = accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label.slice(0, 22), 0, 0)
  ctx.restore()

  ctx.fillStyle = accent
  ctx.fillRect(24, 400, 80, 6)

  return new THREE.CanvasTexture(canvas)
}

// ── Single book mesh ──────────────────────────────────────────────────────────
function createBookMesh(book: VisualBook, xPos: number, yBase: number, spineTexture: THREE.Texture): THREE.Mesh {
  const { color } = book.style
  const { thickness, height } = book
  const hexColor = new THREE.Color(color)

  const materials: THREE.Material[] = [
    new THREE.MeshPhongMaterial({ color: hexColor, shininess: 15 }),
    new THREE.MeshPhongMaterial({ color: hexColor, shininess: 15 }),
    new THREE.MeshPhongMaterial({ color: 0x1a1008, shininess: 5 }),
    new THREE.MeshPhongMaterial({ color: 0x1a1008, shininess: 5 }),
    new THREE.MeshPhongMaterial({ map: spineTexture, shininess: 40 }), // spine face
    new THREE.MeshPhongMaterial({ color: hexColor.clone().multiplyScalar(0.6) }),
  ]

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, BOOK_DEPTH), materials)
  mesh.position.set(xPos, yBase + height / 2, -0.04)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = { url: book.url, title: book.title, thumbnail: book.thumbnail, date: book.date }
  return mesh
}

// ── Bookmark tab texture helper ───────────────────────────────────────────────
const FONT_SIZE = 40
const PX_PAD = 40
const PY_PAD = 24
const WORLD_PER_PX = 0.13 / 64 // pixel-density anchor

function makeTabTexture(
  label: string,
  bgColor: string
): { texture: THREE.CanvasTexture; worldWidth: number; worldHeight: number } {
  // Measure text width before allocating the real canvas
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = `bold ${FONT_SIZE}px sans-serif`
  const textW = Math.ceil(probe.measureText(label).width)

  const canvasW = textW + 2 * PX_PAD
  const canvasH = FONT_SIZE + 2 * PY_PAD

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvasW, canvasH)
  ctx.font = `bold ${FONT_SIZE}px sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, canvasW / 2, canvasH / 2)

  return {
    texture: new THREE.CanvasTexture(canvas),
    worldWidth: canvasW * WORLD_PER_PX,
    worldHeight: canvasH * WORLD_PER_PX,
  }
}

// ── Bookcase structure ────────────────────────────────────────────────────────
function buildBookcase(
  scene: THREE.Scene,
  numShelves: number,
  sw: number,
  offsetX: number
): number[] {
  const totalHeight = SH * numShelves + PT

  const mainWood = new THREE.MeshPhongMaterial({ color: 0x9c6b3c, shininess: 40 })
  const sideWood = new THREE.MeshPhongMaterial({ color: 0x7a5230, shininess: 25 })
  const shelfWood = new THREE.MeshPhongMaterial({ color: 0xb8864e, shininess: 35 })
  const backWood = new THREE.MeshPhongMaterial({ color: 0x6b4226, shininess: 10 })
  const edgeMat = new THREE.MeshPhongMaterial({ color: 0x5c3d1e, shininess: 50 })

  const group = new THREE.Group()
  group.position.x = offsetX

  const addBox = (geo: THREE.BoxGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
  }

  const halfH = totalHeight / 2

  // Side panels
  addBox(new THREE.BoxGeometry(ST, totalHeight, SD), sideWood, -sw / 2 + ST / 2, 0, 0)
  addBox(new THREE.BoxGeometry(ST, totalHeight, SD), sideWood, sw / 2 - ST / 2, 0, 0)

  // Back panel
  const back = new THREE.Mesh(new THREE.BoxGeometry(sw, totalHeight, 0.04), backWood)
  back.position.set(0, 0, -SD / 2 + 0.02)
  group.add(back)

  // Horizontal panels + neutral edge strips
  const shelfYPositions: number[] = []
  for (let s = 0; s <= numShelves; s++) {
    const y = -halfH + PT / 2 + s * SH
    addBox(
      new THREE.BoxGeometry(sw - 2 * ST, PT, SD),
      s === 0 || s === numShelves ? mainWood : shelfWood,
      0,
      y,
      0
    )
    if (s < numShelves) shelfYPositions.push(y + PT / 2)

    // Neutral base edge strip (category strips layer on top of these)
    const edgeY = y + PT / 2
    const edge = new THREE.Mesh(new THREE.BoxGeometry(sw - 2 * ST, 0.022, 0.022), edgeMat)
    edge.position.set(0, edgeY, SD / 2 - 0.011)
    group.add(edge)
  }

  scene.add(group)
  return shelfYPositions
}

// ── Place one shelf row of books ──────────────────────────────────────────────
function placeShelfBooks(books: VisualBook[], yBase: number, scene: THREE.Scene, offsetX: number, spineTexture: THREE.Texture) {
  const totalW = books.reduce((s, b) => s + b.thickness, 0) + (books.length - 1) * GAP
  let x = -totalW / 2
  books.forEach((book) => {
    x += book.thickness / 2
    scene.add(createBookMesh(book, x + offsetX, yBase, spineTexture))
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

    // Map: bookcaseIndex → (shelfIndexInBookcase → books[])
    const bookcasesMap = new Map<number, Map<number, VisualBook[]>>()
    books.forEach((b) => {
      if (!bookcasesMap.has(b.bookcaseIndex)) bookcasesMap.set(b.bookcaseIndex, new Map())
      const shelves = bookcasesMap.get(b.bookcaseIndex)!
      const arr = shelves.get(b.shelfIndexInBookcase) ?? []
      arr.push(b)
      shelves.set(b.shelfIndexInBookcase, arr)
    })
    const numBookcases = bookcasesMap.size

    // Compute sw globally (max shelf width across ALL shelves in all bookcases)
    let maxShelfBooksWidth = 0
    bookcasesMap.forEach((shelves) => {
      shelves.forEach((shelfBooks) => {
        const w =
          shelfBooks.reduce((s, b) => s + b.thickness, 0) + Math.max(shelfBooks.length - 1, 0) * GAP
        maxShelfBooksWidth = Math.max(maxShelfBooksWidth, w)
      })
    })
    const sw = Math.max(maxShelfBooksWidth + ST * 2 + 0.4, 1.8)

    const bookcaseSpacing = sw + 0.15
    const totalWidth = numBookcases * sw + (numBookcases - 1) * 0.15

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.FogExp2(0xb0d8f0, 0.035)

    // Camera — far enough to see all bookcases
    const actualTotalHeight = SH * 5 + PT
    const aspect = container.clientWidth / container.clientHeight
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 60)
    const cameraZ = Math.max(totalWidth * 1.1, actualTotalHeight * 0.9 + 1.5, 3.5)
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
    controls.minDistance = 1.5
    controls.maxDistance = cameraZ + 8
    controls.maxPolarAngle = Math.PI * 0.62
    controls.update()

    // Lighting
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.85))

    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(4, 7, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -(totalWidth / 2 + 3)
    sun.shadow.camera.right = totalWidth / 2 + 3
    sun.shadow.camera.top = 10
    sun.shadow.camera.bottom = -10
    scene.add(sun)

    const fill = new THREE.DirectionalLight(0xc0d8ff, 0.45)
    fill.position.set(-5, 3, 3)
    scene.add(fill)

    // Spine texture — middle strip of the book cover image (spine portion)
    const spineTexture = new THREE.TextureLoader().load('/book-cover.png')
    spineTexture.wrapS = THREE.RepeatWrapping
    spineTexture.offset.set(0.40, 0)
    spineTexture.repeat.set(0.20, 1)

    // Build bookcases and place books
    bookcasesMap.forEach((shelves, bcIdx) => {
      const numShelvesInCase = shelves.size
      const offsetX = bcIdx * bookcaseSpacing - totalWidth / 2 + sw / 2

      const shelfYBases = buildBookcase(scene, numShelvesInCase, sw, offsetX)

      // Category-colored edge strips
      const shelfColorMap = new Map<number, string>()
      shelves.forEach((shelfBooks, sIdx) => {
        if (shelfBooks[0]) shelfColorMap.set(sIdx, shelfBooks[0].style.color)
      })
      shelfColorMap.forEach((color, sIdx) => {
        if (shelfYBases[sIdx] === undefined) return
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(sw - 2 * ST, 0.03, 0.02),
          new THREE.MeshPhongMaterial({ color: new THREE.Color(color), shininess: 70 })
        )
        strip.position.set(offsetX, shelfYBases[sIdx], SD / 2 - 0.008)
        scene.add(strip)
      })

      // Bookmark tabs — one per shelf on the right side
      shelves.forEach((shelfBooks, sIdx) => {
        if (shelfYBases[sIdx] === undefined || shelfBooks.length === 0) return
        const cat = shelfBooks[0].category
        const color = shelfBooks[0].style.color
        const tabTex = makeTabTexture(cat, color)
        const tabMaterials: THREE.Material[] = [
          new THREE.MeshPhongMaterial({ color: new THREE.Color(color) }),
          new THREE.MeshPhongMaterial({ color: new THREE.Color(color) }),
          new THREE.MeshPhongMaterial({ color: new THREE.Color(color) }),
          new THREE.MeshPhongMaterial({ color: new THREE.Color(color) }),
          new THREE.MeshPhongMaterial({ map: tabTex.texture }), // front face
          new THREE.MeshPhongMaterial({ color: new THREE.Color(color) }),
        ]
        const tab = new THREE.Mesh(
          new THREE.BoxGeometry(tabTex.worldWidth, tabTex.worldHeight, 0.02),
          tabMaterials
        )
        tab.position.set(
          offsetX + sw / 2 - ST - tabTex.worldWidth / 2,
          shelfYBases[sIdx] + tabTex.worldHeight / 2,
          SD / 2 + 0.012
        )
        scene.add(tab)
      })

      // Place books
      shelves.forEach((shelfBooks, sIdx) => {
        if (shelfYBases[sIdx] !== undefined) {
          placeShelfBooks(shelfBooks, shelfYBases[sIdx], scene, offsetX, spineTexture)
        }
      })
    })

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshPhongMaterial({ color: 0xd9cdb8 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -actualTotalHeight / 2
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

    // Render loop
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
