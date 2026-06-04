import { apiUrl } from '@/shared/lib/api'

const DEFAULT_DB_ID = import.meta.env.VITE_NOTION_DATABASE_ID as string

export function getDefaultDbId(): string {
  return DEFAULT_DB_ID
}

// ── Raw Notion API types (minimal subset we use) ──────────────────────────────
interface NotionSelectProp {
  select: { name: string } | null
}
interface NotionDateProp {
  date: { start: string } | null
}
interface NotionTitleProp {
  title: Array<{ plain_text: string }>
}
interface NotionMSelectProp {
  multi_select: Array<{ name: string }>
}

interface NotionFileProp {
  files: Array<
    { type: 'external'; external: { url: string } } | { type: 'file'; file: { url: string } }
  >
}

interface NotionPageProperties {
  [key: string]: unknown
  title: NotionTitleProp
  category: NotionSelectProp
  date: NotionDateProp
  status: NotionSelectProp
  tags: NotionMSelectProp
  thumbnail: NotionFileProp
}

interface NotionPage {
  id: string
  url: string
  properties: NotionPageProperties
}

interface NotionQueryResponse {
  results: NotionPage[]
  has_more: boolean
  next_cursor: string | null
}


// ── Parsed book data ──────────────────────────────────────────────────────────
export interface BookEntry {
  id: string
  url: string
  title: string
  category: string
  date: string
  tags: string[]
  thumbnail: string | null
  titleLen: number
  tagCount: number
  contentLength: number
  codeBlockCount: number
  keywordCount: number
}

// ── Fetch all public pages via backend proxy (auto-paginates) ─────────────────
async function fetchPage(dbId: string, startCursor?: string): Promise<NotionQueryResponse> {
  const body: Record<string, unknown> = {
    filter: {
      property: 'status',
      select: { equals: 'Public' },
    },
    sorts: [{ property: 'date', direction: 'ascending' }],
    page_size: 100,
  }
  if (startCursor) body.start_cursor = startCursor

  const res = await fetch(apiUrl(`/api/notion/databases/${dbId}/query`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Notion proxy error ${res.status}: ${err}`)
  }
  return res.json() as Promise<NotionQueryResponse>
}

// ── Fetch page content signals via backend (parsing + TTA keyword count) ─────
async function fetchPageContent(
  pageId: string,
): Promise<{ contentLength: number; codeBlockCount: number; keywordCount: number }> {
  const res = await fetch(apiUrl(`/api/notion/pages/${pageId}/content`))
  if (!res.ok) return { contentLength: 0, codeBlockCount: 0, keywordCount: 0 }

  const data = await res.json()
  return {
    contentLength: data.content_length,
    codeBlockCount: data.code_block_count,
    keywordCount: data.keyword_count,
  }
}

// ── TF-IDF 기반 유사도 분석 결과 ─────────────────────────────────────────────
export interface SimilarityData {
  docIds: string[]
  similarityMatrix: number[][]
  topTerms: Record<string, string[]>  // doc_id → 상위 TF-IDF 키워드 (최대 5개)
  clusters: string[][]                 // 유사도 0.15 이상 문서 클러스터
}

export async function fetchBookSimilarity(
  books: Array<{ id: string; title: string }>,
): Promise<SimilarityData | null> {
  if (books.length < 2) return null
  try {
    const res = await fetch(apiUrl('/api/tfidf/analyze-books'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ books }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      docIds: data.doc_ids,
      similarityMatrix: data.similarity_matrix,
      topTerms: data.top_terms,
      clusters: data.clusters,
    }
  } catch {
    return null
  }
}

export async function fetchPublicBooks(dbId: string = DEFAULT_DB_ID): Promise<BookEntry[]> {
  if (!dbId) throw new Error('Notion database ID가 없습니다.')

  const pages: NotionPage[] = []
  let cursor: string | undefined = undefined

  do {
    const data = await fetchPage(dbId, cursor)
    pages.push(...data.results)
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
  } while (cursor)

  const contentResults = await Promise.allSettled(pages.map((p) => fetchPageContent(p.id)))

  return pages.map<BookEntry>((p, i) => {
    const props = p.properties
    const title = props.title.title.map((t) => t.plain_text).join('')
    const category = props.category?.select?.name ?? 'Default'
    const date = props.date?.date?.start ?? '2000-01-01'
    const tags = props.tags?.multi_select?.map((t) => t.name) ?? []

    const thumbFile = props.thumbnail?.files?.[0]
    const thumbnail = thumbFile
      ? thumbFile.type === 'external'
        ? thumbFile.external.url
        : thumbFile.file.url
      : null

    const content =
      contentResults[i].status === 'fulfilled'
        ? contentResults[i].value
        : { contentLength: 0, codeBlockCount: 0, keywordCount: 0 }

    return {
      id: p.id,
      url: p.url,
      title,
      category,
      date,
      tags,
      thumbnail,
      titleLen: title.length,
      tagCount: tags.length,
      contentLength: content.contentLength,
      codeBlockCount: content.codeBlockCount,
      keywordCount: content.keywordCount,
    }
  })
}
