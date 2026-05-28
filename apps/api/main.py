import asyncio
import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.keywords import count_it_keywords, match_it_keywords, term_stats
from services.tfidf import TfidfResult, cluster_by_similarity, compute_tfidf

load_dotenv()

NOTION_TOKEN = os.getenv("NOTION_TOKEN", "")
NOTION_VERSION = "2022-06-28"
NOTION_BASE = "https://api.notion.com/v1"

app = FastAPI(title="tech-moongo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- TF-IDF 요청/응답 스키마 ----------

class Document(BaseModel):
    id: str
    title: str
    content: str


class VectorizeRequest(BaseModel):
    documents: list[Document]


class SimilarityResponse(BaseModel):
    doc_ids: list[str]
    similarity_matrix: list[list[float]]
    top_terms: dict[str, list[str]]


class ClusterResponse(BaseModel):
    clusters: list[list[str]]


# ---------- 헬스체크 ----------

@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# ---------- TF-IDF 엔드포인트 ----------

@app.post("/api/tfidf/similarity", response_model=SimilarityResponse)
def get_similarity(body: VectorizeRequest) -> SimilarityResponse:
    if len(body.documents) < 2:
        raise HTTPException(status_code=422, detail="문서가 2개 이상 필요합니다.")

    docs = [d.model_dump() for d in body.documents]
    result: TfidfResult = compute_tfidf(docs)

    return SimilarityResponse(
        doc_ids=result.doc_ids,
        similarity_matrix=result.similarity_matrix,
        top_terms=result.top_terms,
    )


@app.post("/api/tfidf/clusters", response_model=ClusterResponse)
def get_clusters(body: VectorizeRequest, threshold: float = 0.15) -> ClusterResponse:
    if len(body.documents) < 2:
        raise HTTPException(status_code=422, detail="문서가 2개 이상 필요합니다.")

    docs = [d.model_dump() for d in body.documents]
    result: TfidfResult = compute_tfidf(docs)
    clusters = cluster_by_similarity(result, threshold=threshold)

    return ClusterResponse(clusters=clusters)


# ---------- 키워드 디버그 ----------

class KeywordDebugRequest(BaseModel):
    text: str


@app.get("/api/keywords/stats")
def get_keyword_stats() -> dict:
    return term_stats()


@app.post("/api/keywords/debug")
def debug_keywords(body: KeywordDebugRequest) -> dict:
    matched = match_it_keywords(body.text)
    return {"matched_count": len(matched), "matched_terms": matched}


# ---------- Notion 프록시 ----------
# Notion 토큰을 서버 환경변수에서만 읽어 클라이언트에 노출되지 않게 한다.

TEXT_BLOCK_TYPES = {
    "paragraph", "heading_1", "heading_2", "heading_3",
    "bulleted_list_item", "numbered_list_item",
    "quote", "callout", "toggle", "to_do", "code",
}


def _notion_headers() -> dict:
    if not NOTION_TOKEN:
        raise HTTPException(status_code=500, detail="NOTION_TOKEN이 설정되지 않았습니다.")
    return {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


@app.post("/api/notion/databases/{database_id}/query")
async def notion_database_query(database_id: str, request: Request) -> dict:
    body = await request.json()
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{NOTION_BASE}/databases/{database_id}/query",
            headers=_notion_headers(),
            json=body,
        )
    if not res.is_success:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    return res.json()


async def _fetch_page_text(client: httpx.AsyncClient, page_id: str) -> tuple[str, int]:
    """Notion 페이지 블록에서 텍스트와 코드블록 수를 추출한다."""
    text_parts: list[str] = []
    code_count = 0
    cursor: str | None = None

    while True:
        params: dict = {"page_size": "100"}
        if cursor:
            params["start_cursor"] = cursor

        res = await client.get(
            f"{NOTION_BASE}/blocks/{page_id}/children",
            headers=_notion_headers(),
            params=params,
        )
        if not res.is_success:
            break

        data = res.json()
        for block in data.get("results", []):
            btype = block.get("type", "")
            if btype == "code":
                code_count += 1
            if btype in TEXT_BLOCK_TYPES:
                rich_text = block.get(btype, {}).get("rich_text", [])
                text_parts.append("".join(r.get("plain_text", "") for r in rich_text))

        if data.get("has_more") and data.get("next_cursor"):
            cursor = data["next_cursor"]
        else:
            break

    return "".join(text_parts), code_count


class PageContentResponse(BaseModel):
    content_length: int
    code_block_count: int
    keyword_count: int


@app.get("/api/notion/pages/{page_id}/content", response_model=PageContentResponse)
async def notion_page_content(page_id: str) -> PageContentResponse:
    async with httpx.AsyncClient() as client:
        full_text, code_count = await _fetch_page_text(client, page_id)

    return PageContentResponse(
        content_length=len(full_text),
        code_block_count=code_count,
        keyword_count=count_it_keywords(full_text),
    )


# ---------- 책 유사도 분석 ----------
# 여러 Notion 페이지 텍스트를 서버에서 직접 수집 → TF-IDF 벡터화 → 코사인 유사도 + 클러스터 반환

class BookInput(BaseModel):
    id: str    # Notion 페이지 ID (doc_id 겸 컨텐츠 fetch 대상)
    title: str


class AnalyzeBooksRequest(BaseModel):
    books: list[BookInput]


class BookSimilarityResponse(BaseModel):
    doc_ids: list[str]
    similarity_matrix: list[list[float]]
    top_terms: dict[str, list[str]]   # doc_id → 상위 TF-IDF 키워드
    clusters: list[list[str]]         # 유사도 0.15 이상 문서 클러스터


@app.post("/api/tfidf/analyze-books", response_model=BookSimilarityResponse)
async def analyze_books(body: AnalyzeBooksRequest) -> BookSimilarityResponse:
    """
    책(Notion 페이지) 목록을 받아 TF-IDF + 코사인 유사도를 계산한다.
    - 각 페이지의 텍스트를 서버에서 직접 수집하여 Notion 토큰을 클라이언트에 노출하지 않는다.
    - 코사인 유사도: cos(θ) = (A·B)/(|A||B|) → 0(완전 다름) ~ 1(동일 주제)
    """
    if len(body.books) < 2:
        raise HTTPException(status_code=422, detail="문서가 2개 이상 필요합니다.")

    async with httpx.AsyncClient(timeout=30.0) as client:
        results = await asyncio.gather(
            *[_fetch_page_text(client, b.id) for b in body.books],
            return_exceptions=True,
        )

    docs = []
    for book, result in zip(body.books, results):
        text = result[0] if isinstance(result, tuple) else ""
        docs.append({"id": book.id, "title": book.title, "content": text})

    tfidf_result: TfidfResult = compute_tfidf(docs)
    clusters = cluster_by_similarity(tfidf_result, threshold=0.15)

    return BookSimilarityResponse(
        doc_ids=tfidf_result.doc_ids,
        similarity_matrix=tfidf_result.similarity_matrix,
        top_terms=tfidf_result.top_terms,
        clusters=clusters,
    )
