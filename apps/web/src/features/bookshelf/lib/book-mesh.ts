import * as THREE from 'three'

import { originalityToRoughness } from '@/shared/lib/scoring'

import type { VisualBook } from '../model/use-bookshelf-books'

import { PATTERN_MAT, drawPatternOverlay, type BookPattern } from './book-pattern'
import type { CoverImages } from './cover-loader'
import { withQuality } from './texture-quality'

// 텍스트 합성 캔버스 텍스처 (투명 PNG 위에 카테고리 배경 + 깊이 패턴 오버레이)
function makeBookFaceTex(
  img: HTMLImageElement,
  bgColor: string,
  canvasW: number,
  canvasH: number,
  pattern: BookPattern,
  originalityScore: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvasW, canvasH)
  if (img.naturalWidth > 0) ctx.drawImage(img, 0, 0, canvasW, canvasH)
  drawPatternOverlay(ctx, canvasW, canvasH, pattern, bgColor, originalityScore)
  return withQuality(new THREE.CanvasTexture(canvas))
}

function makeRibbon(thickness: number, height: number, bookDepth: number): THREE.Mesh {
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

  const ribbonGeo = new THREE.ExtrudeGeometry(shape, { depth: ribbonD, bevelEnabled: false })
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xc44a4a,
    roughness: 0.6,
    metalness: 0.0,
  })
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat)
  ribbon.position.set(thickness * 0.18, height / 2 + ribbonH * 0.32, bookDepth / 2 + ribbonD / 2)
  ribbon.castShadow = true
  return ribbon
}

export function createBookMesh(
  book: VisualBook,
  xPos: number,
  yBase: number,
  isLatest: boolean,
  cover: CoverImages,
): THREE.Mesh {
  const { color, pattern } = book.style
  const { thickness, height } = book

  // 앞표지 이미지 aspect로 책 깊이(표지 너비) 결정
  const bookDepth = cover.aspect > 0 ? cover.aspect * height : 0.65

  // 캔버스 픽셀 크기 = 각 면의 비율에 맞게 (해상도 ↑ → 가까이 봐도 표지 디테일 유지)
  const coverW = 512
  const coverH = Math.round(coverW / cover.aspect)
  const spineW = Math.round(coverH * (thickness / height))
  const spineH = coverH

  const { originalityScore } = book
  const frontTex = makeBookFaceTex(cover.front, color, coverW, coverH, pattern, originalityScore)
  const backTex = makeBookFaceTex(cover.back, color, coverW, coverH, pattern, originalityScore)
  const spineTex = makeBookFaceTex(cover.spine, color, spineW, spineH, pattern, originalityScore)

  // 표면 거칠기 ← 독창성 점수 (높을수록 거친 엠보싱 질감), 금속성 ← 전문성 패턴
  const { metalness } = PATTERN_MAT[pattern]
  const roughness = originalityToRoughness(book.originalityScore)
  // 발광 ← 활동성 점수: 최근·연속 작성 글일수록 책 고유색으로 은은하게 빛남 (Bertin 'attention' 신호)
  const emissive = new THREE.Color(color)
  const emissiveIntensity = book.activityScore * 0.3
  const coverMat = (tex: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ map: tex, roughness, metalness, emissive, emissiveIntensity })

  const materials: THREE.Material[] = [
    coverMat(frontTex), // +X 앞 표지
    coverMat(backTex),  // -X 뒤 표지
    new THREE.MeshPhongMaterial({ color: 0xf0ead8, shininess: 5 }), // +Y 상단 페이지
    new THREE.MeshPhongMaterial({ color: 0xe0d4bc, shininess: 5 }), // -Y 하단 페이지
    coverMat(spineTex), // +Z 책등
    new THREE.MeshPhongMaterial({ color: 0x0a0805 }), // -Z 뒷면 (책장 안쪽)
  ]

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, bookDepth), materials)
  mesh.position.set(xPos, yBase + height / 2, -0.04)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = {
    url: book.url,
    title: book.title,
    thumbnail: book.thumbnail,
    date: book.date,
    category: book.category,
    categoryColor: color,
    totalScore: book.totalScore,
    topTerms: book.topTerms,
    similarBooks: book.similarBooks,
  }

  if (isLatest) mesh.add(makeRibbon(thickness, height, bookDepth))

  return mesh
}
