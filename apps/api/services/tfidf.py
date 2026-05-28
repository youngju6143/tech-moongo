from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np
from kiwipiepy import Kiwi
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

_kiwi = Kiwi()

# 의미 있는 품사만 남김: 일반명사, 고유명사, 동사, 형용사, 외국어(영문)
_KEEP_POS = {"NNG", "NNP", "VV", "VA", "SL"}


def _tokenize_ko(text: str) -> str:
    """한국어 형태소 분석 + 영문 토큰화 → 공백 구분 문자열 반환."""
    tokens = _kiwi.tokenize(text, normalize_coda=True)
    ko_tokens = [t.form for t in tokens if t.tag in _KEEP_POS and len(t.form) > 1]

    # 영문 단어 별도 추출 (Kiwi SL 태그가 못 잡는 경우 보완)
    en_tokens = [w.lower() for w in re.findall(r"[a-zA-Z]{2,}", text)]

    return " ".join(ko_tokens + en_tokens)


@dataclass
class TfidfResult:
    doc_ids: list[str]
    similarity_matrix: list[list[float]]
    top_terms: dict[str, list[str]]  # doc_id → 상위 TF-IDF 키워드


def compute_tfidf(documents: list[dict]) -> TfidfResult:
    """
    documents: [{"id": str, "title": str, "content": str}, ...]

    각 문서를 TF-IDF 벡터로 변환 후 코사인 유사도 행렬을 계산한다.
    코사인 유사도: cos(θ) = (A·B) / (|A|×|B|)
      - 문서 길이와 무관하게 주제(방향)의 유사성만 측정
      - 0(완전히 다름) ~ 1(동일한 방향)
    """
    doc_ids = [d["id"] for d in documents]
    raw_texts = [d.get("title", "") + " " + d.get("content", "") for d in documents]

    tokenized = [_tokenize_ko(text) for text in raw_texts]

    vectorizer = TfidfVectorizer(min_df=1, max_features=500)
    tfidf_matrix = vectorizer.fit_transform(tokenized)

    # 코사인 유사도 행렬: shape (n_docs, n_docs)
    sim_matrix = cosine_similarity(tfidf_matrix).tolist()

    feature_names = vectorizer.get_feature_names_out()
    top_terms: dict[str, list[str]] = {}
    for i, doc_id in enumerate(doc_ids):
        scores = tfidf_matrix[i].toarray()[0]
        top_indices = np.argsort(scores)[::-1][:5]
        top_terms[doc_id] = [feature_names[j] for j in top_indices if scores[j] > 0]

    return TfidfResult(
        doc_ids=doc_ids,
        similarity_matrix=sim_matrix,
        top_terms=top_terms,
    )


def cluster_by_similarity(
    result: TfidfResult, threshold: float = 0.15
) -> list[list[str]]:
    """
    유사도 threshold 이상인 문서끼리 그룹화 (Union-Find).
    반환: 클러스터 리스트 (각 클러스터 = doc_id 목록)
    """
    n = len(result.doc_ids)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: int, y: int) -> None:
        parent[find(x)] = find(y)

    for i in range(n):
        for j in range(i + 1, n):
            if result.similarity_matrix[i][j] >= threshold:
                union(i, j)

    groups: dict[int, list[str]] = {}
    for i, doc_id in enumerate(result.doc_ids):
        root = find(i)
        groups.setdefault(root, []).append(doc_id)

    return list(groups.values())
