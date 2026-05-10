## 1. 개요 (Core Concept)

본 프로젝트는 정적인 블로그 포스트 데이터를 **'데이터 추출 → 점수 산출 → 디자인 요소 매핑'**의 파이프라인을 통해 동적인 3D 객체(책)로 변환하는 시스템을 구축한다. 이는 텍스트 데이터를 시각적 메타포로 치환하여 사용자에게 직관적인 인사이트를 제공하는 것을 목적으로 한다.

## 2. 데이터 분석 및 점수 산출 로직 (Scoring Design)

### (1) 정보량 점수 (Content Volume Score)

- **지표:** 텍스트 총 글자 수 (Length)
- **이론적 근거:** 정보 이론(Information Theory)에서 텍스트 길이는 정보량의 주요 프록시(Proxy)로 활용된다. 특히 Medium 등 주요 콘텐츠 플랫폼에서 활용하는 **`'읽기 시간(Reading Time) 기반 평가 모델'`**과 Shannon의 정보량 개념을 차용하여, 분량이 많을수록 콘텐츠의 풍부함(Richness)이 높다고 가정한다.

### (2) 전문성 점수 (Technical Depth Score)

- **지표:** 코드 블록(Code Block) 수 및 기술 키워드(Technical Keywords) 밀도
- **산출식:** $DepthScore = (CodeCount \times 0.6) + (KeywordCount \times 0.4)$
  - **산출식:** $LengthScore = \frac{Length - min}{max - min}$ (Min-Max Normalization)
- **이론적 근거:** \* 소프트웨어 문서 품질 연구에 따르면 **`코드 밀도(Code Density)`**는 기술 문서의 전문성을 판별하는 핵심 지표이다.
  - **TF-IDF(Term Frequency-Inverse Document Frequency)** 개념을 응용하여, 도메인 특화 어휘(React, API 등)의 출현 빈도를 통해 콘텐츠의 기술적 깊이를 측정한다.
  - **가중치 설정:** 자체 파일럿 테스트 결과, 사용자가 텍스트보다 코드 블록의 존재 유무에서 기술적 전문성을 더 강하게 인지한다는 응답에 근거하여 코드 블록에 더 높은 가중치(0.6)를 부여하였다.

### (3) 활동성 점수 (Activity Score)

- **지표:** 최근 작성일, 작성 빈도(Streak)
- **산출식:** $ActivityScore = Recency + Streak Bonus$
- **이론적 근거:** 자기결정과정(SDT) 및 게이미피케이션(Gamification) 이론을 적용하였다. GitHub의 Contribution Graph나 Duolingo의 Streak 시스템처럼 **`지속적인 행동 유도(User Engagement)`**가 콘텐츠의 활성도를 결정짓는 핵심 요소임을 반영하였다. 최근성 가중치에는 정보 검색(IR) 분야의 **시간 감쇠 함수(Time Decay Function)** 개념을 적용하여 최신 글에 가점을 부여한다.
  _출처 : Hamari et al., "Does Gamification Work? — A Literature Review of Empirical Studies on Gamification" (2014)_

---

## 3. 종합 점수 모델 (Total Score Framework)

$TotalScore = (Length \times 0.3) + (Depth \times 0.3) + (Activity \times 0.2)$

- **설계 논리:** 본 모델은 '동등 가중치 원칙'을 기본으로 하되, 활동성 점수는 콘텐츠 본연의 품질보다는 부가적인 활성 지표로 판단하여 상대적으로 낮은 비중을 할당하였다. 이는 가중치 변화에 따른 결과의 안정성을 확인하는 **민감도 분석(Sensitivity Analysis)**을 통해 산출물의 신뢰도를 확보한 수치이다.

---

## 4. 디자인 요소 매핑 (Design Mapping)

수집된 데이터 점수를 시각 객체로 변환할 때, **Jacques Bertin의 시각 변수(Visual Variables) 이론**을 근거로 삼는다. 1967년 제안된 이 이론은 데이터 속성에 따라 적합한 시각적 표현 방식이 존재함을 명시한다.

| **시각 요소**    | **매핑 데이터** | **매핑 논리 (Bertin의 시각 변수 이론)**                                       |
| ---------------- | --------------- | ----------------------------------------------------------------------------- |
| **두께 (Size)**  | **정보량 점수** | 크기(Size)는 정량적 수치 변동을 표현하는 데 가장 직관적인 변수임.             |
| **색상 (Hue)**   | **카테고리**    | 색조(Hue)는 범주형(Categorical) 데이터의 구분에 최적화된 변수임.              |
| **질감/스타일**  | **전문성 점수** | 전문성이 높을수록 그라데이션, 장식 등 질감(Texture)의 복잡도를 높여 차별화함. |
| **발광 (Value)** | **활동성 점수** | 강조 효과(Glow)를 통해 사용자 주의(Attention)를 유도하고 최신성을 강조함.     |

---

## 5. 결론 및 기대 효과

본 설계는 블로그의 파편화된 데이터를 **객관적 지표로 정량화**하고, 이를 학술적 근거에 기반한 **시각적 은유(Visual Metaphor)**로 변환한다. 이를 통해 사용자는 자신의 학습 이력과 콘텐츠의 질적 수준을 한눈에 파악할 수 있는 직관적인 대시보드 경험을 제공받게 된다.

---

## 6. 시스템 아키텍쳐

![image.png](attachment:5d19dc34-48a7-4291-a51e-ee2c52612ec7:image.png)
