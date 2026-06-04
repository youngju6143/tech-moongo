import * as THREE from 'three'

import { GAP, PT, SD, SH, ST } from '../config/constants'
import type { VisualBook } from '../model/use-bookshelf-books'

import { createBookMesh } from './book-mesh'
import { bookCoverIndex, type CoverImages } from './cover-loader'
import { withQuality } from './texture-quality'
import { makeWoodMat, type WoodTextures } from './wood-material'

// 폰트/패딩을 키워 화질 향상, WORLD_PER_PX는 비례 축소해 화면 크기 동일 유지
const FONT_SIZE = 80
const PX_PAD = 80
const PY_PAD = 48
const WORLD_PER_PX = 0.13 / 128

interface TabTexture {
  texture: THREE.CanvasTexture
  worldWidth: number
  worldHeight: number
}

function makeTabTexture(label: string, bgColor: string): TabTexture {
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
    texture: withQuality(new THREE.CanvasTexture(canvas)),
    worldWidth: canvasW * WORLD_PER_PX,
    worldHeight: canvasH * WORLD_PER_PX,
  }
}

export function loadBookmarkTextures(loader: THREE.TextureLoader): {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
  metalnessMap: THREE.Texture
  aoMap: THREE.Texture
} {
  const base = '/texture/bookmark/1K-velvet_2_'
  const texs = {
    map: loader.load(`${base}basecolor.png`),
    normalMap: loader.load(`${base}normal.png`),
    roughnessMap: loader.load(`${base}roughness.png`),
    metalnessMap: loader.load(`${base}metallic.png`),
    aoMap: loader.load(`${base}ambientocclusion.png`),
  }
  Object.values(texs).forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    withQuality(t)
  })
  return texs
}

function makeBookmarkMat(
  bmTexs: ReturnType<typeof loadBookmarkTextures>,
  color: string,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    ...bmTexs,
    color: new THREE.Color(color),
    roughness: 1,
    metalness: 0,
  })
}

export function buildBookcase(
  scene: THREE.Scene,
  numShelves: number,
  sw: number,
  offsetX: number,
  woodTexs: WoodTextures,
  floorY: number,
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
      0,
    )
    if (s < numShelves) shelfYPositions.push(y + PT / 2 + yOffset)

    // Neutral base edge strip (category strips layer on top)
    const edgeY = y + PT / 2
    const edge = new THREE.Mesh(new THREE.BoxGeometry(sw - 2 * ST, 0.022, 0.022), edgeMat)
    edge.position.set(0, edgeY, SD / 2 - 0.011)
    group.add(edge)
  }

  scene.add(group)
  return shelfYPositions
}

export function placeShelfBooks(
  books: VisualBook[],
  yBase: number,
  scene: THREE.Scene,
  offsetX: number,
  latestBookId: string,
  allCovers: CoverImages[],
) {
  const totalW = books.reduce((s, b) => s + b.thickness, 0) + (books.length - 1) * GAP
  let x = -totalW / 2
  books.forEach((book) => {
    x += book.thickness / 2
    const cover = allCovers[bookCoverIndex(book.id, allCovers.length)]
    scene.add(createBookMesh(book, x + offsetX, yBase, book.id === latestBookId, cover))
    x += book.thickness / 2 + GAP
  })
}

export function addCategoryEdgeStrip(
  scene: THREE.Scene,
  offsetX: number,
  yBase: number,
  sw: number,
  color: string,
) {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(sw - 2 * ST, 0.03, 0.02),
    new THREE.MeshPhongMaterial({ color: new THREE.Color(color), shininess: 70 }),
  )
  strip.position.set(offsetX, yBase, SD / 2 - 0.008)
  scene.add(strip)
}

export function addCategoryTab(
  scene: THREE.Scene,
  bmTexs: ReturnType<typeof loadBookmarkTextures>,
  offsetX: number,
  yBase: number,
  sw: number,
  category: string,
  color: string,
) {
  const tabTex = makeTabTexture(category, color)
  const mat = makeBookmarkMat(bmTexs, color)
  const tabMaterials: THREE.Material[] = [
    mat,
    mat,
    mat,
    mat,
    new THREE.MeshPhongMaterial({ map: tabTex.texture }), // front face (텍스트)
    mat,
  ]
  const tabGeo = new THREE.BoxGeometry(tabTex.worldWidth, tabTex.worldHeight, 0.02)
  tabGeo.setAttribute('uv2', tabGeo.attributes.uv)
  const tab = new THREE.Mesh(tabGeo, tabMaterials)
  tab.position.set(
    offsetX + sw / 2 - ST - tabTex.worldWidth / 2,
    yBase + tabTex.worldHeight / 2,
    SD / 2 + 0.012,
  )
  scene.add(tab)
}
