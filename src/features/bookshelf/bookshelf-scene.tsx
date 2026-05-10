import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { ActivityHeatmap } from '../streak/activity-heatmap'
import type { VisualBook } from './model/use-bookshelf-books'
import { useBookshelfBooks } from './model/use-bookshelf-books'

// ── Shelf geometry constants (SW is now dynamic) ──────────────────────────────
const SH = 1.2 // height per shelf unit
const SD = 0.75 // depth (앞표지 max aspect ~0.67 × max height ~0.95 = 0.64 + 여유)
const PT = 0.06 // panel thickness
const ST = 0.08 // side thickness
const GAP = 0.012 // gap between books

// ── Cover image set (앞표지 / 책등 / 뒷표지 분리) ────────────────────────────
function bookCoverIndex(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 4
}

interface WoodTextures {
  diffuse: THREE.Texture
  normal: THREE.Texture
  roughness: THREE.Texture
  reflection: THREE.Texture
}

interface CoverImages {
  front: HTMLImageElement
  spine: HTMLImageElement
  back: HTMLImageElement
  aspect: number // front.naturalWidth / front.naturalHeight
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(new Image())
    img.src = src
  })
}

async function loadCover(num: number): Promise<CoverImages> {
  const base = `/book-cover/cover${num}/${num}`
  const [front, spine, back] = await Promise.all([
    loadImg(`${base}-front.png`),
    loadImg(`${base}-spine.png`),
    loadImg(`${base}-back.png`),
  ])
  return { front, spine, back, aspect: front.naturalWidth / (front.naturalHeight || 1) }
}

// ── Canvas-composited texture (transparent PNG + category bg) ────────────────
function makeBookFaceTex(
  img: HTMLImageElement,
  bgColor: string,
  canvasW: number,
  canvasH: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvasW, canvasH)
  if (img.naturalWidth > 0) ctx.drawImage(img, 0, 0, canvasW, canvasH)
  return new THREE.CanvasTexture(canvas)
}

// ── Single book mesh ──────────────────────────────────────────────────────────
function createBookMesh(
  book: VisualBook,
  xPos: number,
  yBase: number,
  isLatest: boolean,
  cover: CoverImages
): THREE.Mesh {
  const { color } = book.style
  const { thickness, height } = book

  // 앞표지 이미지 aspect로 책 깊이(표지 너비) 결정
  const bookDepth = cover.aspect > 0 ? cover.aspect * height : 0.65

  // 캔버스 픽셀 크기 = 각 면의 비율에 맞게 설정
  const coverW = 256
  const coverH = Math.round(coverW / cover.aspect)
  const spineW = Math.round(coverH * (thickness / height))
  const spineH = coverH

  const frontTex = makeBookFaceTex(cover.front, color, coverW, coverH)
  const backTex = makeBookFaceTex(cover.back, color, coverW, coverH)
  const spineTex = makeBookFaceTex(cover.spine, color, spineW, spineH)

  const coverMat = (tex: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 })

  const materials: THREE.Material[] = [
    coverMat(frontTex), // +X 앞 표지
    coverMat(backTex), // -X 뒤 표지
    new THREE.MeshPhongMaterial({ color: 0xf0ead8, shininess: 5 }), // +Y 상단 (페이지 단면)
    new THREE.MeshPhongMaterial({ color: 0xe0d4bc, shininess: 5 }), // -Y 하단
    coverMat(spineTex), // +Z 책등
    new THREE.MeshPhongMaterial({ color: 0x0a0805 }), // -Z 뒷면 (책장 안쪽)
  ]

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, bookDepth), materials)
  mesh.position.set(xPos, yBase + height / 2, -0.04)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = { url: book.url, title: book.title, thumbnail: book.thumbnail, date: book.date }

  if (isLatest) {
    const ribbonW = Math.max(thickness * 0.24, 0.028)
    const ribbonH = Math.max(height * 0.42, 0.18)
    const ribbonD = 0.008

    const shape = new THREE.Shape()
    shape.moveTo(-ribbonW / 2, ribbonH / 2)
    shape.lineTo(ribbonW / 2, ribbonH / 2)
    shape.lineTo(ribbonW / 2, -ribbonH / 2)
    shape.lineTo(0.014, -ribbonH / 2)
    shape.lineTo(0, -ribbonH / 2 - 0.02)
    shape.lineTo(-0.014, -ribbonH / 2)
    shape.lineTo(-ribbonW / 2, -ribbonH / 2)
    shape.closePath()

    const ribbonGeo = new THREE.ExtrudeGeometry(shape, {
      depth: ribbonD,
      bevelEnabled: false,
    })
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xc44a4a,
      roughness: 0.6,
      metalness: 0.0,
    })
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat)
    ribbon.position.set(thickness * 0.18, height / 2 + ribbonH * 0.32, bookDepth / 2 + ribbonD / 2)
    ribbon.castShadow = true

    mesh.add(ribbon)
  }
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

// ── PBR wood material factory ─────────────────────────────────────────────────
function makeWoodMat(
  texs: WoodTextures,
  repeatU: number,
  repeatV: number,
  roughnessMult = 1,
  rotate = false
): THREE.MeshStandardMaterial {
  const c = (t: THREE.Texture): THREE.Texture => {
    const cl = t.clone()
    cl.wrapS = cl.wrapT = THREE.RepeatWrapping
    cl.repeat.set(repeatU, repeatV)
    if (rotate) {
      cl.rotation = Math.PI / 2
      cl.center.set(0.5, 0.5)
    }
    cl.needsUpdate = true
    return cl
  }
  return new THREE.MeshStandardMaterial({
    map: c(texs.diffuse),
    normalMap: c(texs.normal),
    roughnessMap: c(texs.roughness),
    metalnessMap: c(texs.reflection),
    roughness: roughnessMult,
    metalness: 0.05,
  })
}

// ── Bookcase structure ────────────────────────────────────────────────────────
function buildBookcase(
  scene: THREE.Scene,
  numShelves: number,
  sw: number,
  offsetX: number,
  woodTexs: WoodTextures,
  floorY: number
): number[] {
  const totalHeight = SH * numShelves + PT
  const yOffset = floorY + totalHeight / 2

  const repV = Math.max(1, Math.round(totalHeight * 1.5))
  const repH = Math.max(1, Math.round(sw * 2))

  const mainWood = makeWoodMat(woodTexs, repH, 1, 0.9, true)
  const sideWood = makeWoodMat(woodTexs, 1, repV, 1.0)
  const shelfWood = makeWoodMat(woodTexs, repH, 1, 0.85, true)
  const backWood = makeWoodMat(woodTexs, 1, repV, 1.1)
  const edgeMat = makeWoodMat(woodTexs, 1, repV, 0.8)

  const group = new THREE.Group()
  group.position.x = offsetX
  group.position.y = yOffset

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
    if (s < numShelves) shelfYPositions.push(y + PT / 2 + yOffset)

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
function placeShelfBooks(
  books: VisualBook[],
  yBase: number,
  scene: THREE.Scene,
  offsetX: number,
  latestBookId: string,
  allCovers: CoverImages[]
) {
  const totalW = books.reduce((s, b) => s + b.thickness, 0) + (books.length - 1) * GAP
  let x = -totalW / 2
  books.forEach((book) => {
    x += book.thickness / 2
    const coverIdx = bookCoverIndex(book.id)
    scene.add(
      createBookMesh(book, x + offsetX, yBase, book.id === latestBookId, allCovers[coverIdx])
    )
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

// 모듈 로드 시 4세트(cover1~4) 이미지를 미리 로드
const allCoversPromise = Promise.all([1, 2, 3, 4].map(loadCover))

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


    // Camera — far enough to see all bookcases
    let maxShelves = 0
    bookcasesMap.forEach((shelves) => {
      maxShelves = Math.max(maxShelves, shelves.size)
    })
    const actualTotalHeight = SH * maxShelves + PT
    const floorY = -actualTotalHeight / 2
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

    // Controls — 회전만 허용, 줌·패닝 비활성화
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.target.set(0, 0, 0)
    controls.enableZoom = false
    controls.enablePan = false
    controls.maxPolarAngle = Math.PI * 0.62
    controls.update()

    // Lighting
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.25))

    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(6, 4.5, 5)
    sun.castShadow = false
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -(totalWidth / 2 + 3)
    sun.shadow.camera.right = totalWidth / 2 + 3
    sun.shadow.camera.top = 10
    sun.shadow.camera.bottom = -10
    scene.add(sun)

    const fill = new THREE.DirectionalLight(0xc0d8ff, 0.15)
    fill.position.set(-5, 3, 3)
    scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffffff, 0.25)
    rim.position.set(-6, 2.5, -4)
    scene.add(rim)

    const latestBookId = [...books].sort((a, b) => b.date.localeCompare(a.date))[0]?.id ?? ''

    // 책장 PBR 텍스처 로드
    const tloader = new THREE.TextureLoader()
    const bsBase = '/texture/bookshelf/737-Bois-de-Sienne-Siena-Wood-001-'
    const woodTexs: WoodTextures = {
      diffuse: tloader.load(`${bsBase}DIFFUSE-4K.png`),
      normal: tloader.load(`${bsBase}NORMALS8_OPENGL-4K.png`),
      roughness: tloader.load(`${bsBase}ROUGHNESS-4K.png`),
      reflection: tloader.load(`${bsBase}REFLECTION-4K.png`),
    }

    // 책갈피 PBR 텍스처 로드 (벨벳)
    const bmBase = '/texture/bookmark/1K-velvet_2_'
    const bmTexs = {
      map:          tloader.load(`${bmBase}basecolor.png`),
      normalMap:    tloader.load(`${bmBase}normal.png`),
      roughnessMap: tloader.load(`${bmBase}roughness.png`),
      metalnessMap: tloader.load(`${bmBase}metallic.png`),
      aoMap:        tloader.load(`${bmBase}ambientocclusion.png`),
    }
    Object.values(bmTexs).forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping })

    const makeBookmarkMat = (color: string) =>
      new THREE.MeshStandardMaterial({
        ...bmTexs,
        color: new THREE.Color(color),
        roughness: 1,
        metalness: 0,
      })

    // Pass 1 (sync): 책장 구조 빌드 + shelfYBases 저장
    const bookcaseShelfData = new Map<number, { offsetX: number; shelfYBases: number[] }>()

    bookcasesMap.forEach((shelves, bcIdx) => {
      const numShelvesInCase = shelves.size
      const offsetX = bcIdx * bookcaseSpacing - totalWidth / 2 + sw / 2
      const shelfYBases = buildBookcase(scene, numShelvesInCase, sw, offsetX, woodTexs, floorY)
      bookcaseShelfData.set(bcIdx, { offsetX, shelfYBases })

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
          makeBookmarkMat(color),
          makeBookmarkMat(color),
          makeBookmarkMat(color),
          makeBookmarkMat(color),
          new THREE.MeshPhongMaterial({ map: tabTex.texture }), // front face (텍스트)
          makeBookmarkMat(color),
        ]
        const tabGeo = new THREE.BoxGeometry(tabTex.worldWidth, tabTex.worldHeight, 0.02)
        tabGeo.setAttribute('uv2', tabGeo.attributes.uv)
        const tab = new THREE.Mesh(tabGeo, tabMaterials)
        tab.position.set(
          offsetX + sw / 2 - ST - tabTex.worldWidth / 2,
          shelfYBases[sIdx] + tabTex.worldHeight / 2,
          SD / 2 + 0.012
        )
        scene.add(tab)
      })
    })

    // Pass 2 (async): 이미지 로드 후 책 배치
    let destroyed = false
    void allCoversPromise.then((allCovers) => {
      if (destroyed) return
      bookcasesMap.forEach((shelves, bcIdx) => {
        const { offsetX, shelfYBases } = bookcaseShelfData.get(bcIdx)!
        shelves.forEach((shelfBooks, sIdx) => {
          if (shelfYBases[sIdx] !== undefined) {
            placeShelfBooks(shelfBooks, shelfYBases[sIdx], scene, offsetX, latestBookId, allCovers)
          }
        })
      })
    })

    // Floor — PBR ground textures
    const tl = new THREE.TextureLoader()
    const groundBase = '/texture/ground/Poliigon_ConcretePaversSquare_7100_'
    const applyRepeat = (t: THREE.Texture) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(8, 8)
      return t
    }
    const floorMat = new THREE.MeshStandardMaterial({
      map: applyRepeat(tl.load(`${groundBase}BaseColor.jpg`)),
      aoMap: applyRepeat(tl.load(`${groundBase}AmbientOcclusion.jpg`)),
      normalMap: applyRepeat(tl.load(`${groundBase}Normal.png`)),
      roughnessMap: applyRepeat(tl.load(`${groundBase}Roughness.jpg`)),
      metalnessMap: applyRepeat(tl.load(`${groundBase}Metallic.jpg`)),
      roughness: 1,
      metalness: 1,
    })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50, 1, 1), floorMat)
    floor.geometry.setAttribute('uv2', floor.geometry.attributes.uv)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = floorY
    floor.receiveShadow = true
    scene.add(floor)

    // Wall — background.png 벽지 타일링
    const wallTex = new THREE.TextureLoader().load('/background.png')
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
    wallTex.repeat.set(12, 7)
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 120),
      new THREE.MeshBasicMaterial({ map: wallTex })
    )
    wall.position.set(0, floorY + actualTotalHeight / 2, -SD / 2 - 0.01)
    scene.add(wall)

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
      destroyed = true
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
      <ActivityHeatmap books={books} />
    </div>
  )
}
