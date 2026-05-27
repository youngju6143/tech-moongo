from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.tfidf import TfidfResult, cluster_by_similarity, compute_tfidf

app = FastAPI(title="tech-moongo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- 요청/응답 스키마 ----------

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


# ---------- 엔드포인트 ----------

@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


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
