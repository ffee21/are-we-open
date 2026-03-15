# 대한민국 공공 웹사이트 LLM 친화성 평가 프로젝트

> **"문제를 고치는 가장 빠른 방법은 문제를 인식하는 것이다."**

GitHub Pages 기반 정적 웹사이트. 대한민국 정부 웹사이트들이 얼마나 LLM 친화적인지, 또 검색엔진 친화적인지 분석하여 순위를 매기고, 기관별 개선방향을 구체적으로 제시한다.

## 첫 페이지 구성

### 표어

메인 표어와 함께 아래 명언들을 첫 페이지에 순환 또는 나열 표시:

- "문제를 고치는 가장 빠른 방법은 문제를 인식하는 것이다."
- "측정하지 않으면 개선할 수 없다." — 피터 드러커
- "공개된 데이터는 스스로 개선의 압력을 만든다."

### 프로젝트 취지

이 프로젝트는 대한민국 정부가 AI 시대에 맞춰 공공 웹사이트의 접근성을 **점진적으로 개선해 나가기 위한 노력**의 일환이다. 한 번에 모든 것을 바꾸자는 것이 아니라, 현재 상태를 투명하게 파악하고 개선의 방향을 제시하는 데 목적이 있다.

### 제약사항 안내 (첫 페이지 명시)

> 각 기관은 상급기관의 보안 지침 또는 자체 정보보안 정책에 따라 웹사이트 설정이 제한될 수 있습니다. 예를 들어, 국가정보원의 보안 가이드라인, 상위 부처의 일괄 보안 정책, 기관 자체 정보보호 규정 등으로 인해 robots.txt나 크롤링 정책을 기관 단독으로 변경하기 어려운 경우가 있습니다. 본 평가는 이러한 제약을 비난하려는 것이 아니라, 현황을 파악하고 개선 논의의 출발점을 제공하기 위한 것입니다.

### Disclaimer

> ⚠️ 본 웹사이트는 개인 프로젝트로 운영되며, 정부 공식 입장과 무관합니다. 분석 결과는 자동화된 도구와 수작업 검토를 병행하여 생성되나, 정확성을 완전히 보장하지 않습니다. 오류를 발견하신 경우 GitHub Issues를 통해 알려주시면 확인 후 수정하겠습니다.

---

## 0. 프로젝트 관리

### 작업 큐 및 진척 관리

- 전체 기관 목록을 대상으로 하되, **한 번에 10개 기관씩** 분석을 진행
- `queue.csv`: 전체 기관의 분석 진행 상태 관리

```
org_id,org_name,org_type,status,queued_date,started_date,completed_date,analyst_note
GOV-001,보건복지부,중앙부처,completed,2025-01-01,2025-01-02,2025-01-03,
GOV-002,교육부,중앙부처,in_progress,2025-01-01,2025-01-04,,
GOV-003,환경부,중앙부처,queued,2025-01-01,,,,
```

- `status` 값: `queued` → `in_progress` → `completed` → `needs_update`
- 우선순위: 중앙부처 → 청 → 공공기관 → 지자체 → 산하기관 순서로 진행

### 업데이트 이력 페이지

웹사이트에 별도 페이지로 아래 정보를 표시:

- 최근 업데이트 시점 (날짜 + 대상 기관 목록)
- 과거 업데이트 히스토리 (날짜별 변경 내역)
- 평균 업데이트 주기
- 다음 예정 업데이트 대상 기관
- `update_history.csv`로 관리:

```
update_id,date,org_ids,change_type,description
UPD-001,2025-01-03,"GOV-001,GOV-002",full_scan,최초 분석 완료
UPD-002,2025-01-10,"GOV-001",rescan,robots.txt 변경 감지 후 재분석
```

---

## 1. 웹사이트 목록 수집

### 1차 소스 (신뢰 기반)

- 행정안전부 정부조직도 데이터
- 공공데이터포털 공공기관 목록 API
- 알리오(ALIO) 공공기관 경영정보 목록 (교차확인용)

### 2차 소스 (보조)

- 각 기관 웹사이트 하단 패밀리 사이트 링크 크롤링
  - 단, iframe/JS 렌더링으로 되어 있는 경우가 많으므로 보조 수단으로만 활용
- 수동 탐색 및 보완

### 기관 분류 체계

```
org_type:
  - central_ministry    # 중앙부처 (부/처)
  - agency              # 청/위원회
  - public_institution  # 공공기관
  - local_government    # 지자체
  - affiliated          # 산하/소속기관
```

### 목록 관리

- 기관 목록: 연 1회 갱신 (기관 신설/폐지 반영)
- URL 유효성: 주간 모니터링 주기에 맞춰 체크 (도메인 변경, 리뉴얼 등 수시 발생)
- `organizations.json`에 기관 메타데이터 저장

```json
{
  "org_id": "GOV-001",
  "name": "보건복지부",
  "name_en": "Ministry of Health and Welfare",
  "org_type": "central_ministry",
  "parent_org_id": null,
  "url": "https://www.mohw.go.kr",
  "alt_urls": [],
  "alio_id": "...",
  "added_date": "2025-01-01",
  "last_checked": "2025-01-10"
}
```

---

## 2. 콘텐츠 경로 파악 (데이터 생성 시점에 수행)

분석 시작 전에 각 기관 웹사이트의 주요 콘텐츠 경로를 먼저 파악한다. 이 정보는 이후 LLM 친화성 분석, 스코어링, 개선방향 제시 등 모든 후속 파이프라인에서 활용된다.

### 파악 대상 경로

| 경로 유형 | 설명 | 예시 |
|-----------|------|------|
| `press_releases` | 보도자료 | `/bbs/press/list.do` |
| `policy_pages` | 정책자료/정책소개 | `/policy/overview.do` |
| `notices` | 공지사항 | `/bbs/notice/list.do` |
| `guidelines` | 지침/가이드라인 | `/data/guidelines/` |
| `laws_regulations` | 법령/규정 | `/law/list.do` |
| `data_publications` | 간행물/통계 | `/stat/` |
| `org_info` | 기관소개 | `/about/` |

### 경로 정보 저장 형식

```json
{
  "org_id": "GOV-001",
  "content_paths": {
    "press_releases": {
      "list_url": "https://www.mohw.go.kr/board/press/list",
      "item_url_pattern": "https://www.mohw.go.kr/board/press/{id}",
      "individual_url_accessible": true,
      "rendering_method": "ssr",
      "note": ""
    },
    "policy_pages": {
      "list_url": "...",
      "item_url_pattern": null,
      "individual_url_accessible": false,
      "rendering_method": "csr",
      "note": "정책소개가 단일 SPA 페이지로 구성되어 개별 URL 없음"
    }
  }
}
```

### 파악 방법

- sitemap.xml 분석 → URL 패턴 추출
- 메인 페이지 내비게이션 분석
- 실제 페이지 접근 테스트 (HEAD 요청 수준)
- Claude Code를 통한 반자동 분석

---

## 3. LLM 친화성 분석

### 3-1. robots.txt 분석

- 존재 여부
- 문법 유효성 (파싱 에러 여부)
- 주요 LLM 크롤러별 허용/차단 상태:
  - `GPTBot` (OpenAI)
  - `ClaudeBot` / `anthropic-ai` (Anthropic)
  - `Bytespider` (ByteDance)
  - `Google-Extended` (Google AI)
  - `CCBot` (Common Crawl)
  - `Googlebot` (Google Search — 비교 기준)
- 2번에서 파악된 주요 콘텐츠 경로에 대한 크롤러별 접근 가능 여부
- 스냅샷 캐싱: 분석 시점의 robots.txt 원본을 저장하고, 캐싱 시점을 명시

### 3-2. llms.txt 분석

- 존재 여부
- 문법 유효성 (llms.txt 스펙 준수 여부)
- 내용 충실도 (단순 존재 vs 실질적 정보 포함)

### 3-3. sitemap.xml 분석

- 존재 여부
- 문법 유효성 (XML 파싱 가능 여부)
- 주요 콘텐츠 경로 포함 여부
- lastmod 태그 활용 여부

### 3-4. 메타데이터 및 구조화된 데이터

- `<title>`, `<meta description>` 존재 및 품질
- Open Graph 태그 (`og:title`, `og:description`, `og:image`)
- schema.org 구조화된 데이터 (JSON-LD / Microdata)
- `<html lang="ko">` 언어 속성

### 3-5. 기술적 접근성

- 렌더링 방식: SSR vs CSR (JS 의존도)
  - CSR 전용 사이트는 LLM/크롤러가 콘텐츠를 읽기 어려움
- 주요 페이지 HTTP 상태코드
- 응답 속도 (TTFB)
- HTTPS 적용 여부
- 개별 콘텐츠 URL 접근 가능 여부 (보도자료 등이 고유 URL을 갖는지)

---

## 4. 스코어링 모델

### 총점: 100점

| 카테고리 | 배점 | 코드 접두사 |
|---------|------|------------|
| A. robots.txt | 25점 | `RT-` |
| B. 콘텐츠 접근성 | 25점 | `CA-` |
| C. 구조화된 데이터 | 20점 | `SD-` |
| D. 기술적 접근성 | 15점 | `TA-` |
| E. llms.txt | 10점 | `LT-` |
| F. sitemap.xml | 5점 | `SM-` |

### A. robots.txt (25점)

| 코드 | 항목 | 배점 | 판정 기준 |
|------|------|------|----------|
| RT-01 | robots.txt 존재 | 5 | 200 응답 = 만점, 404/기타 = 0점 |
| RT-02 | 문법 유효성 | 3 | 파싱 에러 없음 = 만점, 경고 = 2점, 에러 = 0점 |
| RT-03 | LLM 크롤러 명시적 허용 | 7 | GPTBot/ClaudeBot/Google-Extended 중 허용 수에 비례 |
| RT-04 | LLM 크롤러 전면 차단 아님 | 5 | `User-agent: * Disallow: /` 가 아닌 경우 만점 |
| RT-05 | 콘텐츠 경로 접근 허용 | 5 | 보도자료/정책/공지 경로가 차단되지 않은 비율에 비례 |

### B. 콘텐츠 접근성 (25점)

| 코드 | 항목 | 배점 | 판정 기준 |
|------|------|------|----------|
| CA-01 | 보도자료 개별 URL 존재 | 7 | 고유 URL로 접근 가능 = 만점, 불가 = 0점 |
| CA-02 | 정책자료 개별 URL 존재 | 5 | 위와 동일 |
| CA-03 | 공지사항 개별 URL 존재 | 5 | 위와 동일 |
| CA-04 | URL 패턴 일관성 | 4 | RESTful/예측 가능 패턴 = 만점, 쿼리스트링 기반 = 2점, 불규칙 = 0점 |
| CA-05 | 콘텐츠 페이지 SSR 렌더링 | 4 | HTML 소스에 본문 포함 = 만점, JS 렌더링 필수 = 0점 |

### C. 구조화된 데이터 (20점)

| 코드 | 항목 | 배점 | 판정 기준 |
|------|------|------|----------|
| SD-01 | title 태그 적절성 | 4 | 존재 + 페이지별 고유 = 만점, 존재만 = 2점, 없음 = 0점 |
| SD-02 | meta description | 4 | 존재 + 페이지별 고유 = 만점, 존재만 = 2점, 없음 = 0점 |
| SD-03 | Open Graph 태그 | 4 | og:title + og:description + og:image 모두 = 만점, 부분 = 비례, 없음 = 0점 |
| SD-04 | schema.org 구조화 데이터 | 5 | JSON-LD 존재 + 유효 = 만점, 존재만 = 3점, 없음 = 0점 |
| SD-05 | 언어 속성 | 3 | html lang="ko" 존재 = 만점, 없음 = 0점 |

### D. 기술적 접근성 (15점)

| 코드 | 항목 | 배점 | 판정 기준 |
|------|------|------|----------|
| TA-01 | HTTPS 적용 | 3 | 전체 HTTPS = 만점, 혼합 = 1점, HTTP = 0점 |
| TA-02 | 메인 페이지 응답 속도 | 4 | TTFB 1초 미만 = 만점, 3초 미만 = 2점, 3초 이상 = 0점 |
| TA-03 | 주요 페이지 HTTP 상태 | 4 | 전부 200 = 만점, 일부 에러 = 비례, 다수 에러 = 0점 |
| TA-04 | 모바일 대응 | 4 | viewport 메타 + 반응형 = 만점, viewport만 = 2점, 없음 = 0점 |

### E. llms.txt (10점)

| 코드 | 항목 | 배점 | 판정 기준 |
|------|------|------|----------|
| LT-01 | llms.txt 존재 | 4 | 200 응답 = 만점, 없음 = 0점 |
| LT-02 | 문법 유효성 | 3 | 스펙 준수 = 만점, 부분 준수 = 2점, 미준수 = 0점 |
| LT-03 | 내용 충실도 | 3 | 실질적 기관 설명 + 주요 링크 포함 = 만점, 최소한 = 1점, 빈 내용 = 0점 |

### F. sitemap.xml (5점)

| 코드 | 항목 | 배점 | 판정 기준 |
|------|------|------|----------|
| SM-01 | sitemap.xml 존재 | 2 | 200 응답 = 만점, 없음 = 0점 |
| SM-02 | 유효성 및 콘텐츠 포함 | 3 | XML 유효 + 주요 콘텐츠 URL 포함 = 만점, 유효만 = 1점, 에러 = 0점 |

### 등급 체계

| 등급 | 점수 범위 | 의미 |
|------|----------|------|
| A+ | 90-100 | LLM 매우 친화적 |
| A  | 80-89  | LLM 친화적 |
| B+ | 70-79  | 양호, 개선 여지 있음 |
| B  | 60-69  | 보통 |
| C  | 40-59  | 미흡, 개선 필요 |
| D  | 20-39  | 매우 미흡 |
| F  | 0-19   | LLM 접근 사실상 불가 |

---

## 5. 문제사항 코드 체계

분석 결과에서 발견되는 문제를 코드화하여 기관별로 기록한다. 한국어로 구체적 설명을 포함하되, 코드 기반으로 통계를 낼 수 있도록 구성한다.

### 문제사항 코드 구조

```
{카테고리 접두사}-{항목번호}-{심각도}
```

심각도: `critical` / `major` / `minor` / `info`

### 전체 문제사항 코드표

| 코드 | 심각도 | 한국어 설명 |
|------|--------|------------|
| **robots.txt 관련** | | |
| RT-01-critical | critical | robots.txt 파일이 존재하지 않습니다. LLM과 검색엔진이 크롤링 정책을 확인할 수 없습니다. |
| RT-02-major | major | robots.txt에 문법 오류가 있습니다. 크롤러가 의도와 다르게 해석할 수 있습니다. |
| RT-02-minor | minor | robots.txt에 비표준 지시어가 포함되어 있습니다. 기능에는 문제없으나 정리가 권장됩니다. |
| RT-03-major | major | 주요 LLM 크롤러(GPTBot, ClaudeBot 등)에 대한 명시적 규칙이 없습니다. 의도적 허용/차단 여부가 불분명합니다. |
| RT-04-critical | critical | `User-agent: * Disallow: /`로 모든 크롤러를 전면 차단하고 있습니다. LLM뿐 아니라 검색엔진 접근도 차단됩니다. |
| RT-05-major | major | 보도자료/정책자료/공지사항 경로가 robots.txt에 의해 차단되어 있습니다. 공공정보 접근이 제한됩니다. |
| **콘텐츠 접근성 관련** | | |
| CA-01-critical | critical | 보도자료에 개별 URL이 없습니다. 특정 보도자료를 직접 링크하거나 인용할 수 없습니다. |
| CA-01-major | major | 보도자료 URL이 세션/쿠키 의존적이어서 외부에서 직접 접근이 불가합니다. |
| CA-02-major | major | 정책자료 페이지에 개별 URL이 없습니다. |
| CA-03-major | major | 공지사항에 개별 URL이 없습니다. |
| CA-04-minor | minor | URL 패턴이 불규칙합니다. 예측 가능한 RESTful 패턴 사용이 권장됩니다. |
| CA-05-critical | critical | 주요 콘텐츠 페이지가 CSR(클라이언트 사이드 렌더링) 전용입니다. JS를 실행하지 않는 LLM/크롤러가 콘텐츠를 읽을 수 없습니다. |
| CA-05-major | major | 일부 콘텐츠 페이지가 CSR 전용입니다. |
| **구조화된 데이터 관련** | | |
| SD-01-major | major | `<title>` 태그가 없거나 모든 페이지에서 동일합니다. |
| SD-02-major | major | `<meta description>`이 없거나 모든 페이지에서 동일합니다. |
| SD-03-minor | minor | Open Graph 태그가 없습니다. SNS 공유 시 미리보기가 제대로 표시되지 않습니다. |
| SD-04-info | info | schema.org 구조화된 데이터가 없습니다. 검색엔진 리치 스니펫 표시가 제한됩니다. |
| SD-05-minor | minor | `<html>` 태그에 `lang` 속성이 없습니다. |
| **기술적 접근성 관련** | | |
| TA-01-major | major | HTTPS가 적용되지 않았습니다. |
| TA-01-minor | minor | HTTP/HTTPS 혼합 콘텐츠가 있습니다. |
| TA-02-minor | minor | 메인 페이지 응답 속도가 느립니다 (TTFB 3초 이상). |
| TA-03-major | major | 주요 페이지에서 HTTP 에러가 발생합니다 (404, 500 등). |
| TA-04-minor | minor | 모바일 viewport 설정이 없습니다. |
| **llms.txt 관련** | | |
| LT-01-info | info | llms.txt 파일이 존재하지 않습니다. 아직 보편화되지 않은 표준이므로 참고 사항입니다. |
| LT-02-minor | minor | llms.txt 문법이 스펙에 맞지 않습니다. |
| LT-03-info | info | llms.txt 내용이 빈약합니다. 기관 설명 및 주요 링크 추가가 권장됩니다. |
| **sitemap.xml 관련** | | |
| SM-01-minor | minor | sitemap.xml이 존재하지 않습니다. |
| SM-02-minor | minor | sitemap.xml에 주요 콘텐츠 URL이 포함되어 있지 않습니다. |

### 기관별 문제사항 기록 형식

```json
{
  "org_id": "GOV-001",
  "scan_date": "2025-01-03",
  "issues": [
    {
      "code": "RT-03-major",
      "severity": "major",
      "description": "주요 LLM 크롤러(GPTBot, ClaudeBot 등)에 대한 명시적 규칙이 없습니다. 의도적 허용/차단 여부가 불분명합니다.",
      "detail": "GPTBot, ClaudeBot, Google-Extended에 대한 User-agent 규칙이 robots.txt에 없음",
      "affected_paths": [],
      "recommendation_code": "REC-RT-03"
    },
    {
      "code": "CA-01-critical",
      "severity": "critical",
      "description": "보도자료에 개별 URL이 없습니다. 특정 보도자료를 직접 링크하거나 인용할 수 없습니다.",
      "detail": "보도자료가 /bbs/press/list.do 단일 페이지에서 JS 동적 로딩으로 표시됨. 개별 보도자료의 고유 URL 없음.",
      "affected_paths": ["press_releases"],
      "recommendation_code": "REC-CA-01"
    }
  ]
}
```

---

## 6. 데이터 파일 구성

### JSON 파일 (기관별 상세 데이터)

```
data/
├── organizations.json          # 전체 기관 목록 및 메타데이터
├── orgs/
│   ├── GOV-001.json            # 기관별 분석 결과 (스코어 + 문제사항 + 경로 정보)
│   ├── GOV-002.json
│   └── ...
├── snapshots/
│   ├── GOV-001/
│   │   ├── robots_2025-01-03.txt     # robots.txt 스냅샷
│   │   ├── llms_2025-01-03.txt       # llms.txt 스냅샷
│   │   └── sitemap_2025-01-03.xml    # sitemap.xml 스냅샷
│   └── ...
└── recommendations/
    └── templates.json          # 권고문 템플릿
```

### 기관별 JSON 파일 구조 (예: `GOV-001.json`)

```json
{
  "org_id": "GOV-001",
  "name": "보건복지부",
  "url": "https://www.mohw.go.kr",
  "scan_date": "2025-01-03",
  "scan_version": "v1",

  "scores": {
    "total": 62,
    "grade": "B",
    "categories": {
      "robots_txt": { "score": 18, "max": 25 },
      "content_accessibility": { "score": 15, "max": 25 },
      "structured_data": { "score": 12, "max": 20 },
      "technical_accessibility": { "score": 11, "max": 15 },
      "llms_txt": { "score": 0, "max": 10 },
      "sitemap_xml": { "score": 3, "max": 5 }
    },
    "item_scores": {
      "RT-01": 5,
      "RT-02": 3,
      "RT-03": 2,
      "RT-04": 5,
      "RT-05": 3,
      "CA-01": 7,
      "...": "..."
    }
  },

  "content_paths": { "...": "2번 섹션 참조" },

  "issues": [ "...5번 섹션 참조" ],

  "robots_txt": {
    "exists": true,
    "snapshot_path": "snapshots/GOV-001/robots_2025-01-03.txt",
    "snapshot_date": "2025-01-03T09:00:00+09:00",
    "syntax_valid": true,
    "crawler_rules": {
      "GPTBot": "not_mentioned",
      "ClaudeBot": "not_mentioned",
      "Google-Extended": "not_mentioned",
      "Googlebot": "allowed",
      "Bytespider": "not_mentioned",
      "CCBot": "not_mentioned",
      "*": "partial_allow"
    }
  },

  "llms_txt": {
    "exists": false,
    "snapshot_path": null,
    "snapshot_date": null
  },

  "sitemap_xml": {
    "exists": true,
    "valid": true,
    "contains_content_urls": false
  },

  "metadata": {
    "has_title": true,
    "title_unique_per_page": true,
    "has_meta_description": true,
    "meta_description_unique": false,
    "has_og_tags": false,
    "has_schema_org": false,
    "has_lang_attribute": true
  },

  "technical": {
    "https": true,
    "ttfb_ms": 850,
    "main_page_status": 200,
    "mobile_viewport": true,
    "primary_rendering": "ssr"
  }
}
```

### CSV 파일 (통계 및 관리용)

#### `summary_scores.csv` — 기관별 통계 (웹사이트 표시 및 다운로드용)

```
org_id,name,org_type,total_score,grade,robots_txt,content_accessibility,structured_data,technical_accessibility,llms_txt,sitemap_xml,scan_date,issues_critical,issues_major,issues_minor,issues_info
GOV-001,보건복지부,central_ministry,62,B,18,15,12,11,0,3,2025-01-03,1,3,2,1
GOV-002,교육부,central_ministry,45,C,10,8,10,12,0,5,2025-01-04,2,4,1,0
```

#### `issue_stats.csv` — 문제사항 코드별 통계

```
issue_code,severity,count,percentage,description
RT-04-critical,critical,15,12.5,전체 크롤러 전면 차단
CA-01-critical,critical,42,35.0,보도자료 개별 URL 없음
CA-05-critical,critical,28,23.3,CSR 전용 콘텐츠 페이지
RT-03-major,major,87,72.5,LLM 크롤러 명시적 규칙 없음
```

#### `queue.csv` — 작업 큐

위 0번 섹션 참조.

#### `update_history.csv` — 업데이트 이력

위 0번 섹션 참조.

---

## 7. 개선방향 제시

### 자동 생성 권고문

스코어링 항목별 통과/미통과를 기반으로, 기관별 맞춤 권고문을 자동 생성한다.

#### 권고 코드 체계

| 권고 코드 | 대상 문제 코드 | 권고 내용 요약 |
|-----------|--------------|--------------|
| REC-RT-01 | RT-01-critical | robots.txt 파일 생성 필요 |
| REC-RT-03 | RT-03-major | LLM 크롤러별 명시적 허용 규칙 추가 권고 |
| REC-RT-04 | RT-04-critical | 전면 차단 해제, 선별적 차단으로 전환 권고 |
| REC-RT-05 | RT-05-major | 공공 콘텐츠 경로 크롤링 허용 권고 |
| REC-CA-01 | CA-01-critical | 보도자료 개별 URL(퍼마링크) 생성 필요 |
| REC-CA-05 | CA-05-critical | 주요 콘텐츠 SSR 전환 또는 프리렌더링 도입 권고 |
| REC-SD-04 | SD-04-info | schema.org JSON-LD 구조화 데이터 추가 권고 |
| REC-LT-01 | LT-01-info | llms.txt 파일 생성 권고 |
| REC-SM-01 | SM-01-minor | sitemap.xml 생성 권고 |

### 개선된 설정 파일 제안

각 기관별 분석 결과를 기반으로 개선된 robots.txt와 llms.txt를 생성하여 웹사이트에 표시한다.

- 2번에서 파악된 콘텐츠 경로 정보를 활용하여 실제 경로에 맞는 robots.txt를 생성
- "복사하기" 버튼 제공 → 클립보드에 바로 복사
- 기관 담당자가 바로 적용할 수 있는 수준의 구체적 파일 제공

#### robots.txt 제안 예시 (보건복지부)

```
# 검색엔진 크롤러 허용
User-agent: Googlebot
Allow: /

# LLM 크롤러 허용 (공공정보 접근)
User-agent: GPTBot
Allow: /board/press/
Allow: /board/notice/
Allow: /policy/
Disallow: /admin/
Disallow: /login/

User-agent: ClaudeBot
Allow: /board/press/
Allow: /board/notice/
Allow: /policy/
Disallow: /admin/
Disallow: /login/

User-agent: Google-Extended
Allow: /board/press/
Allow: /board/notice/
Allow: /policy/
Disallow: /admin/
Disallow: /login/

# 기본 정책
User-agent: *
Disallow: /admin/
Disallow: /login/
Disallow: /search/

Sitemap: https://www.mohw.go.kr/sitemap.xml
```

#### llms.txt 제안 예시

```
# 보건복지부 (Ministry of Health and Welfare)
> 대한민국 보건복지부 공식 웹사이트입니다.

## 주요 콘텐츠
- [보도자료](https://www.mohw.go.kr/board/press/)
- [공지사항](https://www.mohw.go.kr/board/notice/)
- [정책소개](https://www.mohw.go.kr/policy/)

## 관련 기관
- [질병관리청](https://www.kdca.go.kr)
- [건강보험심사평가원](https://www.hira.or.kr)
```

---

## 8. 웹사이트 제작

### 기술 스택

- GitHub Pages (정적 호스팅)
- 클라이언트 사이드 JS로 필터/검색/정렬 구현
- JSON 데이터를 fetch로 로드하여 렌더링
- 기관 수가 수백~수천일 경우에도 JSON 전체 로드로 충분 (수 MB 이내 예상)

### 페이지 구성

| 페이지 | 내용 |
|--------|------|
| 메인 (index) | 표어, 프로젝트 취지, 제약사항 안내, Disclaimer, 전체 통계 요약, 등급 분포 |
| 순위표 | 전체 기관 순위 (필터: 기관유형별, 등급별 / 검색: 기관명 / 정렬: 총점, 카테고리별) |
| 기관 상세 | 기관별 점수 상세, 문제사항 목록, 권고문, 개선된 robots.txt/llms.txt (복사 버튼) |
| 통계 | 정부 전체 점수 (100점 만점), 기관유형별 평균/표준편차, 문제사항 코드별 빈도, 카테고리별 점수 분포 |
| 업데이트 이력 | 최근 업데이트 시점, 과거 히스토리, 평균 갱신 주기, 다음 예정 대상 |
| About | 프로젝트 소개, 스코어링 기준 설명, 기여 방법, Disclaimer 상세 |

### 통계 산출

- **정부 전체**: 전 기관 평균 점수 (100점 만점), 등급 분포
- **기관유형별**: 중앙부처 / 청 / 공공기관 / 지자체 / 산하기관별 평균, 표준편차
- **카테고리별**: robots.txt, 콘텐츠 접근성 등 6개 카테고리 각각의 전체 평균
- **문제사항 빈도**: "가장 흔한 문제 TOP 10" 등

---

## 9. 분석 수행 방법

### Claude Code를 통한 반자동 분석

웹사이트 파싱 및 분석은 복잡한 작업이므로, GitHub Actions 같은 경직적 CI/CD가 아니라 **Claude Code를 통해 반자동으로 수행**한다.

#### 작업 흐름

1. `queue.csv`에서 다음 분석 대상 10개 기관 확인
2. Claude Code로 각 기관에 대해:
   - robots.txt, llms.txt, sitemap.xml 수집 및 스냅샷 저장
   - 콘텐츠 경로 파악 (사이트 구조 분석)
   - 메타데이터 및 구조화된 데이터 확인
   - 기술적 접근성 테스트
   - 스코어링 및 문제사항 코드 생성
   - 기관별 JSON 파일 생성
3. 결과 검토 후 커밋
4. `queue.csv`, `update_history.csv` 업데이트
5. `summary_scores.csv`, `issue_stats.csv` 재생성

#### GitHub Actions (퍼블리싱 자동화만)

- JSON/CSV 데이터가 커밋되면 자동으로 GitHub Pages 빌드 및 배포
- 데이터 변경 감지 → 웹사이트 재빌드

---

## 10. 이 웹사이트 자체를 LLM 친화적으로 만들기

"LLM 친화성 평가 웹사이트"가 스스로 LLM 친화적이어야 한다.

- robots.txt 설정: 모든 크롤러 허용
- llms.txt 작성: 프로젝트 설명, 데이터 구조, API(JSON) 경로 안내
- sitemap.xml 생성
- 페이지별 고유 title, meta description
- Open Graph 태그
- schema.org JSON-LD (Dataset 타입)
- 퍼마링크: 기관별 상세 페이지에 안정적 URL 부여 (`/org/GOV-001` 등)
- 시맨틱 HTML
- 검색엔진 최적화 (Google Search Console 등록)
- 데이터 파일 직접 접근 가능하도록 경로 안내 (`/data/orgs/GOV-001.json` 등)