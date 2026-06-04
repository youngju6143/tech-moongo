---
title: Tech Moongo API
emoji: 📚
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 8000
pinned: false
---

# tech-moongo API

FastAPI 백엔드 — Notion 프록시, TTA IT 키워드 매칭, TF-IDF 유사도 분석.

## 환경변수
- `NOTION_TOKEN` (필수): Notion integration secret
- `ALLOWED_ORIGINS` (선택): 콤마 구분된 CORS 허용 도메인. 미지정 시 `http://localhost:5173`만 허용.

## 엔드포인트
- `GET /api/health`
- `POST /api/notion/databases/{dbId}/query`
- `GET /api/notion/pages/{pageId}/content`
- `POST /api/tfidf/analyze-books`
- `POST /api/keywords/debug`
- `GET /api/keywords/stats`
