import { countKeywords } from '@/shared/lib/scoring'

const TOKEN = import.meta.env.VITE_NOTION_TOKEN as string
const DB_ID = import.meta.env.VITE_NOTION_DATABASE_ID as string

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

// ── Notion Blocks types ───────────────────────────────────────────────────────
interface NotionRichText {
  plain_text: string
}

interface NotionBlockContent {
  rich_text?: NotionRichText[]
}

interface NotionBlock {
  type: string
  [key: string]: unknown
}

interface NotionBlocksResponse {
  results: NotionBlock[]
  has_more: boolean
  next_cursor: string | null
}

// Block types that contain readable text
const TEXT_BLOCK_TYPES = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'quote',
  'callout',
  'toggle',
  'to_do',
  'code',
])

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
  // Content-based fields for scoring
  contentLength: number   // total text char count from page blocks
  codeBlockCount: number  // number of code blocks (proxy for technical depth)
  keywordCount: number    // matched technical keyword count
}

// ── Fetch all public pages (auto-paginates) ───────────────────────────────────
async function fetchPage(startCursor?: string): Promise<NotionQueryResponse> {
  const body: Record<string, unknown> = {
    filter: {
      property: 'status',
      select: { equals: 'Public' },
    },
    sorts: [{ property: 'date', direction: 'ascending' }],
    page_size: 100,
  }
  if (startCursor) body.start_cursor = startCursor

  const res = await fetch(`/notion-api/v1/databases/${DB_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Notion API error ${res.status}: ${err}`)
  }
  return res.json() as Promise<NotionQueryResponse>
}

// ── Fetch page content blocks and extract scoring signals ─────────────────────
async function fetchPageContent(
  pageId: string,
): Promise<{ contentLength: number; codeBlockCount: number; keywordCount: number }> {
  let text = ''
  let codeCount = 0
  let cursor: string | undefined = undefined

  do {
    const params = new URLSearchParams({ page_size: '100' })
    if (cursor) params.set('start_cursor', cursor)

    const res = await fetch(`/notion-api/v1/blocks/${pageId}/children?${params}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
      },
    })
    if (!res.ok) break

    const data = (await res.json()) as NotionBlocksResponse

    for (const block of data.results) {
      if (block.type === 'code') codeCount++
      if (TEXT_BLOCK_TYPES.has(block.type)) {
        const content = block[block.type] as NotionBlockContent | undefined
        if (content?.rich_text) {
          text += content.rich_text.map((r) => r.plain_text).join('')
        }
      }
    }

    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
  } while (cursor)

  return {
    contentLength: text.length,
    codeBlockCount: codeCount,
    keywordCount: countKeywords(text),
  }
}

export async function fetchPublicBooks(): Promise<BookEntry[]> {
  // 1. Fetch all page metadata
  const pages: NotionPage[] = []
  let cursor: string | undefined = undefined

  do {
    const data = await fetchPage(cursor)
    pages.push(...data.results)
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
  } while (cursor)

  // 2. Fetch page content in parallel (allSettled — partial failures don't break all)
  const contentResults = await Promise.allSettled(pages.map((p) => fetchPageContent(p.id)))

  // 3. Merge metadata + content
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
