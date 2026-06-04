import { useState } from 'react'

import { getDefaultDbId } from '@/shared/services/notion'

import { InsightPanel } from '../insights/insight-panel'
import { ShareButton, SharedBadge } from '../share/share-button'
import { ActivityHeatmap } from '../streak/activity-heatmap'
import { useBookshelfBooks } from './model/use-bookshelf-books'
import { BookTooltip, type TooltipState } from './ui/book-tooltip'
import { ThreeCanvas } from './ui/three-canvas'

interface Props {
  dbId?: string       // /share/:dbId 라우트에서 주입; 없으면 env 기본값 사용
  readOnly?: boolean  // 공유 보기 모드 (공유 버튼 대신 배지 표시)
}

export function BookshelfScene({ dbId, readOnly = false }: Props = {}) {
  const effectiveDbId = dbId ?? getDefaultDbId()
  const { data: books, isLoading, isError } = useBookshelfBooks(effectiveDbId)
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
      {readOnly ? <SharedBadge /> : <ShareButton dbId={effectiveDbId} />}
      <ActivityHeatmap books={books} />
      <InsightPanel books={books} />
    </div>
  )
}
