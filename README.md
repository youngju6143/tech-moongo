# 📚 tech-moongo

> **당신의 기술 블로그를 3D 책장으로.**
> Notion에 쌓인 글들을 데이터로 분석해, 한 권 한 권의 **3D 책**으로 빚어내는 인터랙티브 시각화 시스템입니다.

정적인 시간순 리스트로는 보이지 않던 **학습 편향 · 성장 추이 · 활동 밀도**를, 책장을 둘러보며 직관적으로 느낄 수 있습니다. 🪵✨

<br/>

## 🎯 이게 뭔가요?

기술 블로그(Notion DB)의 각 글을 4가지 점수로 분석하고, 그 점수를 **책의 생김새**로 변환합니다.

| 글의 데이터 | → | 책의 모습 |
| --- | --- | --- |
| 📏 글 길이 (`LengthScore`) | → | 책 **두께** |
| 🧠 기술 깊이 (`DepthScore`) | → | 표지 **패턴/질감** |
| 🔥 작성 활동성 (`ActivityScore`) | → | 히트맵 · 스트릭 |
| 🎨 독창성 (`OriginalityScore`) | → | 종합 점수에 반영 |
| 🏷️ 카테고리 | → | 책 **색상** |

> 데이터 → 점수 산출 → 디자인 매핑 파이프라인. 이론적 근거는 [`docs/data_analysis.md`](docs/data_analysis.md), 기획 배경은 [`docs/service_idea.md`](docs/service_idea.md)에 정리되어 있습니다.

<br/>

## ✨ 주요 기능

- 🪵 **3D 책장 (Bookshelf)** — Three.js로 렌더링되는 가상 책장입니다. 글마다 두께·색·패턴이 다른 책으로 꽂힙니다. 호버하면 썸네일 툴팁이 뜹니다.
- 📊 **인사이트 패널 (Insights)** — 카테고리별 편향을 레이더 차트로 시각화합니다. 최근 3개월 학습이 어디로 치우쳤는지 한눈에 볼 수 있습니다.
- 🔥 **활동 히트맵 (Streak)** — GitHub 잔디 스타일의 연간 활동 그래프입니다. 테마·연도를 선택할 수 있습니다.
- 🔗 **공유 (Share)** — `/share/:dbId` 링크로 내 책장을 읽기 전용으로 공유합니다.
- 🧮 **TF-IDF 유사도 분석** — 글들의 주제 유사도를 코사인 유사도로 계산해 비슷한 글끼리 클러스터링합니다.

<br/>

## 🛠️ 기술 스택

**Frontend** (`apps/web`)
- ⚛️ React 19 + TypeScript + Vite
- 🧊 Three.js (3D 렌더링)
- 🎞️ Framer Motion (애니메이션)
- 🔄 TanStack Query (서버 상태)
- 🐻 Zustand (전역 상태)
- 🎨 Tailwind CSS + shadcn/ui

**Backend** (`apps/api`)
- 🚀 FastAPI (Python 3.11)
- 🔐 Notion API 프록시 (토큰을 서버에만 보관 → 클라이언트 비노출)
- 🪶 **kiwipiepy** — 한국어 형태소 분석 (기술 키워드 추출)
- 📐 **scikit-learn** — TF-IDF 벡터화 + 코사인 유사도
- 🔢 NumPy

> 💡 분석에 쓰는 "모델"은 LLM이 아니라 **TF-IDF + 코사인 유사도** 같은 고전 NLP/통계 기법입니다. 기술 키워드는 TTA 표준 용어 사전 기반으로 매칭합니다.

<br/>

## 🚀 빠르게 시작하기

### 1. 사전 준비

- [Node.js](https://nodejs.org) + [pnpm](https://pnpm.io)
- Python 3.11+
- [ **Notion Integration**](https://www.notion.so/my-integrations)에서 시크릿 발급 후, 분석할 데이터베이스에 통합을 연결합니다

### 2. 설치

```bash
git clone <this-repo>
cd tech-moongo
pnpm install
```

### 3. 환경변수 설정 🔑

**`apps/api/.env`** (백엔드 — Notion 토큰은 여기에만 둡니다)

```bash
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # Notion 통합 시크릿
ALLOWED_ORIGINS={배포한 도메인}            # 콤마로 여러 도메인 가능
```

**`apps/web/.env`** (프론트엔드)

```bash
VITE_NOTION_DATABASE_ID=여기에_Notion_DB_ID  # Notion DB URL에서 추출
VITE_API_BASE_URL=                                # 비워두면 로컬 dev 프록시 사용
```

> ⚠️ **`NOTION_TOKEN`은 절대 프론트엔드나 git에 올리지 마십시오.** 모든 Notion 호출은 백엔드 프록시를 거쳐 토큰이 클라이언트에 노출되지 않습니다. `.env` 파일들은 `.gitignore`에 등록되어 있습니다.

### 4. Notion DB 스키마

분석 대상 데이터베이스에는 다음 속성이 필요합니다.

| 속성명 | 타입 | 설명 |
| --- | --- | --- |
| `title` | Title | 글 제목 |
| `category` | Select | 책 색상 결정 |
| `date` | Date | 활동성/히트맵 |
| `status` | Select | `Public`인 글만 표시 |
| `tags` | Multi-select | 태그 |
| `thumbnail` | Files | 호버 썸네일 |

### 5. 실행

```bash
# API venv 준비 (최초 1회)
cd apps/api && python -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..

# 프론트 + API 동시 실행
pnpm dev:all
```

- 웹: http://localhost:5173
- API: http://localhost:8000 (`/api/health` 로 헬스체크)

개별 실행: `pnpm dev` (웹만) / `pnpm api` (API만)

<br/>

## 📦 배포 (오픈소스 셀프 호스팅)

프론트와 백엔드를 분리 배포하는 구조입니다.

### 🌐 Frontend → Vercel

1. Vercel에 레포 임포트 (Root Directory: `apps/web`)
2. 환경변수 추가:
   - `VITE_NOTION_DATABASE_ID` = 내 Notion DB ID
   - `VITE_API_BASE_URL` = `https://your-api.onrender.com` (배포된 API 주소)
3. SPA 라우팅은 [`apps/web/vercel.json`](apps/web/vercel.json) 의 rewrite로 처리됩니다.

### ⚙️ Backend → Render (Docker)

[`apps/api/render.yaml`](apps/api/render.yaml) 블루프린트가 포함되어 있습니다.

1. [Render Blueprints](https://dashboard.render.com/blueprints) → New Blueprint Instance → 이 레포 선택
2. 대시보드에서 환경변수 입력:
   - `NOTION_TOKEN` = Notion 통합 시크릿
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app`

### 🤗 Backend → Hugging Face Spaces (대안)

Docker SDK 메타데이터가 [`apps/api/README.md`](apps/api/README.md) 헤더에 포함되어 있어, Space로도 바로 배포할 수 있습니다. Space Settings에서 `NOTION_TOKEN`, `ALLOWED_ORIGINS`를 Secret으로 등록하면 됩니다.

<br/>

## 🗂️ 프로젝트 구조

```
tech-moongo/
├── apps/
│   ├── web/          # React + Three.js 프론트엔드
│   │   └── src/
│   │       ├── features/   # bookshelf · insights · streak · share
│   │       └── shared/     # 점수 산출 로직 · Notion 서비스 · UI
│   └── api/          # FastAPI 백엔드 (Notion 프록시 · TF-IDF · 키워드)
└── docs/             # 연구 배경 · 점수 산출 설계 문서
```

> FSD(Feature-Sliced Design)를 따릅니다 — 의존 방향은 상위 → 하위만 허용합니다.

<br/>

## 📐 점수 모델 한눈에 보기

```
TotalScore = Length×0.3 + Depth×0.3 + Activity×0.2 + Originality×0.2
```

- **Length** — 글자 수 Min-Max 정규화
- **Depth** — `코드블록×0.4 + 키워드×0.6` (설문 n=49 기반 가중치)
- **Activity** — 시간 감쇠 최근성 + 스트릭 보너스
- **Originality** — 이미지·콜아웃·토글·인용 블록 분포

자세한 이론적 근거는 [`docs/data_analysis.md`](docs/data_analysis.md) 참고.

<br/>

## 📄 라이선스

졸업 프로젝트(graduation project)로 제작되었습니다. 🎓
