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

// ── Parsed book data ──────────────────────────────────────────────────────────
export interface BookEntry {
  id: string
  url: string
  title: string
  category: string
  date: string // ISO date string
  tags: string[]
  thumbnail: string | null // signed URL from Notion (expires in ~1h)
  titleLen: number // proxy for content length → drives book height
  tagCount: number // proxy for richness → drives book thickness
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

export async function fetchPublicBooks(): Promise<BookEntry[]> {
  const pages: NotionPage[] = []
  let cursor: string | undefined = undefined

  do {
    const data = await fetchPage(cursor)
    pages.push(...data.results)
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
  } while (cursor)

  return pages.map<BookEntry>((p) => {
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
    }
  })
}
