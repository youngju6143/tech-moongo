"""
TTA IT 용어 사전 기반 키워드 매처.
data/tta_terms.txt 가 없으면 내장 폴백 목록을 사용한다.
"""
from __future__ import annotations

from pathlib import Path

from kiwipiepy import Kiwi

_DATA_PATH = Path(__file__).parent.parent / "data" / "tta_terms.txt"

_FALLBACK_TERMS = {
    # 프론트엔드
    "리액트", "컴포넌트", "훅", "상태관리", "렌더링", "가상돔", "라우팅",
    "타입스크립트", "자바스크립트", "css", "html", "scss", "웹팩", "번들링",
    # 백엔드 / 인프라
    "api", "rest", "그래프큐엘", "서버", "데이터베이스", "도커", "쿠버네티스",
    "클라우드", "마이크로서비스", "캐시", "메시지큐", "로드밸런싱",
    # CS
    "알고리즘", "자료구조", "시간복잡도", "공간복잡도", "재귀", "동적프로그래밍",
    "정렬", "탐색", "그래프", "트리", "해시", "스택", "큐",
    # 소프트웨어 공학
    "디자인패턴", "리팩토링", "테스트", "ci/cd", "애자일", "객체지향", "함수형",
    "아키텍처", "클린코드", "의존성주입", "인터페이스", "추상화", "캡슐화",
    # 보안 / 네트워크
    "인증", "인가", "oauth", "jwt", "암호화", "https", "cors", "tcp", "http",
    # AI / 데이터
    "머신러닝", "딥러닝", "신경망", "자연어처리", "벡터", "임베딩",
}


def _load_terms() -> set[str]:
    if _DATA_PATH.exists():
        lines = _DATA_PATH.read_text(encoding="utf-8").splitlines()
        return {line.strip().lower() for line in lines if line.strip()}
    return {t.lower() for t in _FALLBACK_TERMS}


_kiwi = Kiwi()
_TERMS: set[str] = _load_terms()


import re


def _extract_lemmas(text: str) -> set[str]:
    tokens = _kiwi.tokenize(text, normalize_coda=True)
    ko = {t.form.lower() for t in tokens if len(t.form) > 1}
    en = {w.lower() for w in re.findall(r"[a-zA-Z]{2,}", text)}
    return ko | en


def count_it_keywords(text: str) -> int:
    return len(_extract_lemmas(text) & _TERMS)


def match_it_keywords(text: str) -> list[str]:
    """매칭된 IT 용어 목록 반환 (디버그용)."""
    return sorted(_extract_lemmas(text) & _TERMS)


def term_stats() -> dict:
    """로드된 용어 사전 현황 반환 (디버그용)."""
    return {
        "source": "tta" if _DATA_PATH.exists() else "fallback",
        "total_terms": len(_TERMS),
        "sample": sorted(_TERMS)[:20],
    }
