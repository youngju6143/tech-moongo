export interface CoverImages {
  front: HTMLImageElement
  spine: HTMLImageElement
  back: HTMLImageElement
  aspect: number // front.naturalWidth / front.naturalHeight
}

export function bookCoverIndex(id: string, total = COVER_COUNT): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % total
}

const COVER_COUNT = 4

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

// 모듈 로드 시 한 번만 fetch (이후 모든 BookshelfScene 인스턴스에서 공유)
export const allCoversPromise = Promise.all(
  Array.from({ length: COVER_COUNT }, (_, i) => loadCover(i + 1)),
)
