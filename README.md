# Are We Open?

**대한민국 공공 웹사이트는 AI에게 열려 있는가?**

https://ffee21.github.io/are-we-open/

---

## 프로젝트 소개

"고용노동부 실업급여 신청 방법 알려줘"라고 ChatGPT에 물어보면, AI는 해당 부처의 웹사이트에서 최신 정보를 읽어와야 정확한 답변을 할 수 있습니다. 하지만 많은 정부 웹사이트가 `robots.txt`를 통해 AI 크롤러의 접근을 차단하고 있어, AI는 오래된 정보나 부정확한 답변을 할 수밖에 없습니다.

이 프로젝트는 **대한민국의 734개 공공기관 웹사이트**가 AI에게 얼마나 열려 있는지를 측정하고, 그 결과를 투명하게 공개합니다.

### 핵심 질문

각 공공기관의 **보도자료, 정책소개, 공지사항** — 국민에게 전달되어야 할 핵심 공공 콘텐츠에 AI가 접근할 수 있는가?

## 분석 대상

| 구분 | 기관 수 | 출처 |
|------|--------|------|
| 행정각부 (부) | 19 | 정부조직법 제29조 |
| 국무총리 소속 (처) | 6 | 정부조직법 제23~28조 |
| 소속청 | 15 | 정부조직법 각 조항 |
| 독립/헌법기관 | 11 | 감사원, 선관위, 헌법재판소 등 |
| 사법부 | 25 | 대법원 + 고등/지방법원 |
| 검찰 | 17 | 지방검찰청 |
| 경찰 | 18 | 시도경찰청 |
| 입법부 | 18 | 국회 + 17개 시도의회 |
| 교육청 | 17 | 시도교육청 |
| 광역 지자체 | 17 | 특별/광역시 + 도 |
| 기초 지자체 | 227 | 시/군/구 |
| 공공기관 | 344 | ALIO 공공기관 목록 |
| **합계** | **734** | |

## 평가 방법

### 1단계: 자동 분석 (`scripts/analyze.js`)

각 기관 웹사이트에 대해 자동으로 수집/분석합니다:

- **robots.txt**: 존재 여부, LLM 크롤러(GPTBot, ClaudeBot 등) 차단 여부, 전면 차단 여부
- **llms.txt**: 존재 여부, 내용 충실도
- **sitemap.xml**: 존재 여부, 유효성
- **메인 페이지**: 메타데이터(title, description, OG tags, schema.org), 기술 접근성(HTTPS, 응답속도, SSR)

### 2단계: 심층 분석 (`scripts/deep-analyze-browser.js`)

Playwright 브라우저를 사용하여 JS 렌더링 후 실제 콘텐츠 경로를 추적합니다:

1. 메인 페이지를 브라우저에서 렌더링 (CSR 사이트 대응)
2. "보도자료", "공지사항", "정책소개" 링크를 DOM에서 탐지
3. 해당 링크를 실제로 따라가서 최종 URL 확인 (리다이렉트 추적, og:url 확인)
4. 최종 URL이 robots.txt에서 차단되는지 판정

**예시 — 보건복지부:**
- 메인 페이지의 "보도자료" 링크: `/menu.es?mid=a10503010000`
- 리다이렉트 추적: `/menu.es` → `/board.es?mid=a10503010100&bid=0027`
- robots.txt: `Disallow: /board.es`
- **판정: 보도자료 차단됨**

### 3단계: 스코어링

100점 만점으로 6개 카테고리를 평가합니다:

| 카테고리 | 배점 | 핵심 평가 항목 |
|---------|------|-------------|
| robots.txt | 25점 | LLM 크롤러 차단 여부, 전면 차단 여부 |
| 콘텐츠 접근성 | 25점 | 보도자료/정책/공지 경로의 실제 접근 가능 여부 |
| 구조화된 데이터 | 20점 | title, meta, OG tags, schema.org |
| 기술적 접근성 | 15점 | HTTPS, 응답 속도, SSR |
| llms.txt | 10점 | 파일 존재 및 내용 |
| sitemap.xml | 5점 | 존재 및 콘텐츠 URL 포함 |

**핵심 규칙:**
- `User-agent: * Disallow: /` (전면 차단): **최대 25점 (D등급)**
- LLM 크롤러 3개 이상 명시적 차단: **최대 40점 (C등급)**
- LLM 크롤러 1~2개 차단: **최대 59점 (C등급)**
- 심층 분석에서 보도자료/공지 경로 차단 확인: **해당 항목 0점**

## 주요 발견

### 보도자료/공지사항이 robots.txt로 차단된 주요 기관

| 기관 | 차단 콘텐츠 | 차단 경로 | robots.txt 규칙 |
|------|-----------|---------|----------------|
| 보건복지부 | 보도자료, 공지사항 | `/board.es` | `Disallow: /board.es` |
| 과학기술정보통신부 | 보도자료, 공지사항 | `/bbs/view.do` | `Disallow: /bbs` |
| 감사원 | 보도자료, 공지, 정책 | 전면 차단 | `Disallow: /` |

### 전면 차단 기관 (94개)

`User-agent: * Disallow: /`로 모든 AI 크롤러를 차단하는 기관이 94개입니다. 한국은행, 감사원, 대전광역시 등이 포함됩니다.

## 데이터 다운로드

| 파일 | 설명 |
|------|------|
| [results.json](data/results.json) | 전체 분석 결과 (상세) |
| [results-lite.json](data/results-lite.json) | 웹사이트 렌더링용 경량 버전 |
| [summary_scores.csv](data/summary_scores.csv) | 기관별 점수 요약 (Excel 호환 UTF-8 BOM) |
| [organizations.json](data/organizations.json) | 전체 기관 목록 |
| [deep-analysis.json](data/deep-analysis.json) | Playwright 심층 분석 결과 |

## 프로젝트 구조

```
are-we-open/
├── index.html              # 메인 페이지
├── ranking.html            # 순위표
├── org.html                # 기관 상세 페이지
├── stats.html              # 통계
├── about.html              # 프로젝트 소개
├── updates.html            # 업데이트 이력
├── robots.txt              # 이 사이트의 robots.txt (모든 크롤러 허용)
├── llms.txt                # 이 사이트의 llms.txt
├── css/style.css           # 스타일시트
├── js/app.js               # 공통 로직
├── scripts/
│   ├── analyze.js           # 1단계: 자동 분석
│   ├── crawl-all.js         # 전체 일괄 분석
│   ├── deep-analyze-browser.js  # 2단계: Playwright 심층 분석
│   ├── build-org-list.js    # 기관 목록 통합 생성
│   └── lib/
│       └── robots-parser.js # robots.txt 파서
├── data/
│   ├── results.json         # 분석 결과
│   ├── results-lite.json    # 경량 버전
│   ├── organizations.json   # 기관 목록
│   ├── summary_scores.csv   # 점수 CSV
│   ├── deep-analysis.json   # 심층 분석 결과
│   ├── alio_agencies.csv    # ALIO 공공기관 344개
│   ├── alioplus_agencies.csv # 알리오플러스 지역별 4,014개
│   └── snapshots/           # robots.txt/llms.txt 스냅샷
└── docs/
    ├── DATA-UPDATE-PROCEDURE.md  # 데이터 업데이트 절차
    └── 정부조직법.pdf              # 정부조직법 원문
```

## 데이터 업데이트

정기 업데이트 시 Claude에게 다음과 같이 요청합니다:

> "전체 데이터를 재분석해줘. `docs/DATA-UPDATE-PROCEDURE.md` 절차를 따라서 크롤링하고, 점수 악화 기관을 검증하고, 히스토리를 업데이트하고, 하드코딩된 숫자를 수정한 뒤 커밋해줘."

상세 절차는 [DATA-UPDATE-PROCEDURE.md](docs/DATA-UPDATE-PROCEDURE.md)를 참조하세요.

## 기술 스택

- **프론트엔드**: 순수 HTML/CSS/JS (프레임워크 없음), GitHub Pages 호스팅
- **분석 엔진**: Node.js + Playwright
- **데이터 수집**: 정부조직법, ALIO, 알리오플러스, 행정안전부 내고장알리미, 정부24
- **AI 활용**: Claude (Opus)를 통한 맥락적 분석 및 데이터 검증

## 라이선스

이 프로젝트의 분석 결과 데이터는 누구나 자유롭게 활용할 수 있습니다.

## 기여

- 오류 제보: [GitHub Issues](https://github.com/ffee21/are-we-open/issues)
- 기관 추가/수정 제안 환영
