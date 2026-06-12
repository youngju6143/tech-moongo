import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { GAP, PT, SD, SH, ST } from '../config/constants'
import {
  addCategoryEdgeStrip,
  addCategoryTab,
  buildBookcase,
  loadBookmarkTextures,
  placeShelfBooks,
} from '../lib/bookcase-builder'
import { allCoversPromise } from '../lib/cover-loader'
import { setMaxAnisotropy, withQuality } from '../lib/texture-quality'
import { loadWoodTextures } from '../lib/wood-material'
import type { VisualBook } from '../model/use-bookshelf-books'

import type { TooltipState } from './book-tooltip'

interface Props {
  books: VisualBook[]
  onTooltip: (state: TooltipState | null) => void
}

interface BookshelfLayout {
  bookcases: Map<number, Map<number, VisualBook[]>>
  sw: number
  totalWidth: number
  maxShelves: number
  bookcaseSpacing: number
}

function computeLayout(books: VisualBook[]): BookshelfLayout {
  // bookcaseIndex → (shelfIndexInBookcase → books[])
  const bookcases = new Map<number, Map<number, VisualBook[]>>()
  for (const b of books) {
    if (!bookcases.has(b.bookcaseIndex)) bookcases.set(b.bookcaseIndex, new Map())
    const shelves = bookcases.get(b.bookcaseIndex)!
    const arr = shelves.get(b.shelfIndexInBookcase) ?? []
    arr.push(b)
    shelves.set(b.shelfIndexInBookcase, arr)
  }

  // sw = max shelf width across ALL shelves in all bookcases
  let maxShelfBooksWidth = 0
  bookcases.forEach((shelves) => {
    shelves.forEach((shelfBooks) => {
      const w =
        shelfBooks.reduce((s, b) => s + b.thickness, 0) + Math.max(shelfBooks.length - 1, 0) * GAP
      maxShelfBooksWidth = Math.max(maxShelfBooksWidth, w)
    })
  })
  const sw = Math.max(maxShelfBooksWidth + ST * 2 + 0.4, 1.8)
  const bookcaseSpacing = sw + 0.15
  const totalWidth = bookcases.size * sw + (bookcases.size - 1) * 0.15

  let maxShelves = 0
  bookcases.forEach((shelves) => {
    maxShelves = Math.max(maxShelves, shelves.size)
  })

  return { bookcases, sw, totalWidth, maxShelves, bookcaseSpacing }
}

function setupLights(scene: THREE.Scene, totalWidth: number) {
  scene.add(new THREE.AmbientLight(0xfff5e0, 0.25))

  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(6, 4.5, 5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -(totalWidth / 2 + 3)
  sun.shadow.camera.right = totalWidth / 2 + 3
  sun.shadow.camera.top = 10
  sun.shadow.camera.bottom = -10
  scene.add(sun)

  scene.add(makeDirLight(0xc0d8ff, 0.15, -5, 3, 3))
  scene.add(makeDirLight(0xffffff, 0.25, -6, 2.5, -4))
}

function makeDirLight(color: number, intensity: number, x: number, y: number, z: number) {
  const light = new THREE.DirectionalLight(color, intensity)
  light.position.set(x, y, z)
  return light
}

function setupFloor(scene: THREE.Scene, loader: THREE.TextureLoader, floorY: number) {
  const base = '/texture/ground/Poliigon_ConcretePaversSquare_7100_'
  const applyRepeat = (t: THREE.Texture) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(8, 8)
    return withQuality(t)
  }
  const floorMat = new THREE.MeshStandardMaterial({
    map: applyRepeat(loader.load(`${base}BaseColor.jpg`)),
    aoMap: applyRepeat(loader.load(`${base}AmbientOcclusion.jpg`)),
    normalMap: applyRepeat(loader.load(`${base}Normal.png`)),
    roughnessMap: applyRepeat(loader.load(`${base}Roughness.jpg`)),
    metalnessMap: applyRepeat(loader.load(`${base}Metallic.jpg`)),
    roughness: 1,
    metalness: 1,
  })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50, 1, 1), floorMat)
  floor.geometry.setAttribute('uv2', floor.geometry.attributes.uv)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = floorY
  floor.receiveShadow = true
  scene.add(floor)
}

function setupWall(scene: THREE.Scene, loader: THREE.TextureLoader, centerY: number) {
  const tex = withQuality(loader.load('/background.png'))
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(12, 7)
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 120),
    new THREE.MeshBasicMaterial({ map: tex }),
  )
  wall.position.set(0, centerY, -SD / 2 - 0.01)
  scene.add(wall)
}

function pickLatestBookId(books: VisualBook[]): string {
  return [...books].sort((a, b) => b.date.localeCompare(a.date))[0]?.id ?? ''
}

export function ThreeCanvas({ books, onTooltip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || books.length === 0) return

    const layout = computeLayout(books)
    const { bookcases, sw, totalWidth, maxShelves, bookcaseSpacing } = layout

    const actualTotalHeight = SH * maxShelves + PT
    const floorY = -actualTotalHeight / 2

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)

    const aspect = container.clientWidth / container.clientHeight
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 60)
    const cameraZ = Math.max(totalWidth * 1.1, actualTotalHeight * 0.9 + 1.5, 3.5)
    camera.position.set(0, 0, cameraZ)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // 모든 텍스처에 GPU 최대 anisotropy 적용 (비스듬한 각도에서 흐림 방지)
    setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy())

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.target.set(0, 0, 0)
    controls.enableZoom = false
    controls.enablePan = false
    controls.maxPolarAngle = Math.PI * 0.62
    controls.update()

    setupLights(scene, totalWidth)

    const latestBookId = pickLatestBookId(books)
    const tloader = new THREE.TextureLoader()
    const woodTexs = loadWoodTextures(tloader)
    const bmTexs = loadBookmarkTextures(tloader)

    // Pass 1 (sync): 책장 구조 + edge strip + bookmark tab
    const bookcaseShelfData = new Map<number, { offsetX: number; shelfYBases: number[] }>()

    bookcases.forEach((shelves, bcIdx) => {
      const offsetX = bcIdx * bookcaseSpacing - totalWidth / 2 + sw / 2
      const shelfYBases = buildBookcase(scene, shelves.size, sw, offsetX, woodTexs, floorY)
      bookcaseShelfData.set(bcIdx, { offsetX, shelfYBases })

      shelves.forEach((shelfBooks, sIdx) => {
        const yBase = shelfYBases[sIdx]
        if (yBase === undefined || shelfBooks.length === 0) return

        const first = shelfBooks[0]
        addCategoryEdgeStrip(scene, offsetX, yBase, sw, first.style.color)
        addCategoryTab(scene, bmTexs, offsetX, yBase, sw, first.category, first.style.color)
      })
    })

    // Pass 2 (async): 표지 이미지 로드 후 책 배치
    let destroyed = false
    void allCoversPromise.then((allCovers) => {
      if (destroyed) return
      bookcases.forEach((shelves, bcIdx) => {
        const { offsetX, shelfYBases } = bookcaseShelfData.get(bcIdx)!
        shelves.forEach((shelfBooks, sIdx) => {
          if (shelfYBases[sIdx] !== undefined) {
            placeShelfBooks(shelfBooks, shelfYBases[sIdx], scene, offsetX, latestBookId, allCovers)
          }
        })
      })
    })

    setupFloor(scene, tloader, floorY)
    setupWall(scene, tloader, floorY + actualTotalHeight / 2)

    // Click → open Notion page
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const updateMouse = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    const pickBook = () => {
      raycaster.setFromCamera(mouse, camera)
      return raycaster.intersectObjects(scene.children, true)[0]
    }

    const onClick = (e: MouseEvent) => {
      updateMouse(e)
      const hit = pickBook()
      if (hit?.object.userData?.url) window.open(hit.object.userData.url, '_blank')
    }
    const onMove = (e: MouseEvent) => {
      updateMouse(e)
      const ud = pickBook()?.object.userData
      if (ud?.url) {
        renderer.domElement.style.cursor = 'pointer'
        onTooltip({
          info: {
            title: ud.title,
            thumbnail: ud.thumbnail,
            date: ud.date,
            category: ud.category ?? '',
            categoryColor: ud.categoryColor ?? '#888888',
            totalScore: ud.totalScore ?? 0,
            topTerms: ud.topTerms ?? [],
            similarBooks: ud.similarBooks ?? [],
          },
          x: e.clientX,
          y: e.clientY,
        })
      } else {
        renderer.domElement.style.cursor = 'default'
        onTooltip(null)
      }
    }
    const onLeave = () => onTooltip(null)

    renderer.domElement.addEventListener('click', onClick)
    renderer.domElement.addEventListener('mousemove', onMove)
    renderer.domElement.addEventListener('mouseleave', onLeave)

    let rafId: number
    const animate = () => {
      rafId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

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
  }, [books, onTooltip])

  return <div ref={containerRef} className="h-full w-full" />
}
