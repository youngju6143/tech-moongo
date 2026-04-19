# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**tech-moongo** is a graduation project (졸업프로젝트). The tech stack and architecture have not been established yet — this repository is in its initial state.

## Getting Started

No build system, package manager, or framework has been configured. When the project stack is decided, update this file with:

- How to install dependencies
- How to run the development server
- How to build for production
- How to run tests (and a single test)
- How to lint/format

## 기술 스택

- React
- Vite
- TypeScript
- pnpm
- tanstack-query
- tailwind CSS
- shadcn/ui
- zustand
- three.js

## 프로젝트 레이아웃(도메인 계층)

- `app/`: 레이아웃, 라우트 세그먼트, 전역 메타데이터, 모달 슬롯, 프로바이더 배선.
- `components/`: 재사용 가능한 UI 프리미티브 및 복합 컴포넌트(shadcn 기반 공용 컴포넌트).
- `features/`: 엔티티 + 공용 UI를 조합한 제품 기능 단위(예: 관리 탭, 인증 플로우, 대시보드).
- `shared/`: 다수 도메인에서 쓰는 유틸, 상수, 서비스, 범용 UI.
- `types/`: 전역 TypeScript 타입/enum.
- `hooks/`, `context/`, `providers/`, `services/`: 전역/횡단 관심사(React Query, 모달/토스트, 컨텍스트, 웹소켓 등).
- `public/`: 정적 자산; `lib/`: 클라이언트 유틸(axios 래퍼, 포매터, 내비게이션 헬퍼 등).
- FSD(Feature-Sliced Design) 준수: 의존 방향은 상위 → 하위만 허용 (app → features → entities → shared → lib/types). 상위 레이어는 하위의 구현 세부에 결합하지 않도록 유지.

## Imports

- Prettier import 순서 준수:
  1. React, Next
  2. 서드파티 모듈
  3. types/env/config/redux/lib/hooks/entities/features/shared/styles/app 별칭
  4. 상대 경로(`./`, `../`)
- 깊은 상대 경로 대신 `@/...` 절대 경로 선호.

## 네이밍

- React 컴포넌트는 PascalCase(예: `DataTableToolbar.tsx`, `YearMonthSelector`).
- 파일명은 kebab-case(예: `business-form.tsx`, `tabs-list.tsx` )
- 훅은 `use` 접두어 + camelCase(예: `useYearMonth`, `useReactQuery`).
- 함수/변수는 camelCase, 불린은 `is/has/can` 접두어.
- 타입/인터페이스/enum은 PascalCase, 매핑 객체는 필요시 `Map` 접미어.
- 이벤트 핸들러는 `handleX`, props는 `onX`로 전달하며 의미 있는 이름 유지.
