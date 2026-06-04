import { useEffect } from 'react'

import type { VisualBook } from './use-bookshelf-books'

/**
 * 책 데이터 로드 직후 모든 썸네일을 백그라운드에서 fetch하여 브라우저 캐시에 적재.
 * 호버 시 툴팁이 즉시 표시되도록 함. (Notion signed URL은 ~1시간 유효)
 */
export function usePreloadThumbnails(books: VisualBook[] | undefined): void {
  useEffect(() => {
    if (!books) return
    const imgs: HTMLImageElement[] = []
    for (const b of books) {
      if (!b.thumbnail) continue
      const img = new Image()
      img.src = b.thumbnail
      imgs.push(img)
    }
    return () => {
      // 진행 중인 요청 취소 (브라우저가 src 초기화 시 fetch 중단)
      for (const img of imgs) img.src = ''
    }
  }, [books])
}
