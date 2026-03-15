# 데이터 업데이트 프로시저

> 정기적으로 전체 기관의 데이터 개방 수준을 재점검하는 절차입니다.
> Claude Code (Opus)로 실행합니다.

## 1단계: 사전 준비

```bash
# 현재 데이터 백업
cp data/results.json data/results_backup_$(date +%Y%m%d).json

# 기관 목록 최신화 확인
node -e "const d=require('./data/organizations.json'); console.log('총 기관:', d.summary.total);"
```

필요 시 기관 목록 업데이트:
- ALIO 공공기관: `https://www.alio.go.kr/guide/publicAgencyList.do`
- 지자체: `https://www.laiis.go.kr/lips/mlo/lcl/representationList.do`
- 알리오플러스: `https://www.alioplus.go.kr/organization/organByRegionList.do`

## 2단계: 전체 크롤링

```bash
# 전체 재분석 (동시 15개)
node scripts/crawl-all.js --concurrency 15

# 또는 카테고리별로 나눠서 실행
node scripts/crawl-all.js --filter ministry --concurrency 10
node scripts/crawl-all.js --filter agency --concurrency 10
node scripts/crawl-all.js --filter local_basic --concurrency 10
node scripts/crawl-all.js --filter public_institution --concurrency 10
# ... 기타 카테고리
```

## 3단계: 점수 변동 검증 (핵심)

**점수가 악화된 기관은 높은 확률로 파싱 오류입니다.** Claude가 직접 검증해야 합니다.

```bash
# 이전 결과와 비교하여 점수 변동 확인
node -e "
const fs = require('fs');
const prev = JSON.parse(fs.readFileSync('data/results_backup_YYYYMMDD.json','utf-8'));
const curr = JSON.parse(fs.readFileSync('data/results.json','utf-8'));

const prevMap = {};
prev.organizations.forEach(o => { prevMap[o.org_id] = o; });

const degraded = [];
curr.organizations.forEach(o => {
  const p = prevMap[o.org_id];
  if (p && o.scores.total < p.scores.total) {
    degraded.push({
      id: o.org_id,
      name: o.name,
      prev: p.scores.total,
      curr: o.scores.total,
      diff: o.scores.total - p.scores.total
    });
  }
});

degraded.sort((a,b) => a.diff - b.diff);
console.log('=== 점수 악화 기관 (' + degraded.length + '개) ===');
degraded.forEach(d => console.log(d.diff + '점\t' + d.name + '\t(' + d.prev + ' → ' + d.curr + ')'));
"
```

### 점수 악화 기관 검증 체크리스트

각 악화 기관에 대해 Claude가 확인해야 할 사항:

1. **robots.txt 스냅샷 비교**: `data/snapshots/{org_id}/` 디렉토리에서 이전/현재 스냅샷 비교
2. **HTML 에러 페이지 오판**: robots.txt/llms.txt/sitemap.xml 요청에 HTML 에러 페이지가 반환되지 않았는지
3. **네트워크 오류**: 타임아웃이나 접속 오류로 인한 일시적 점수 하락인지
4. **실제 변경**: 기관이 robots.txt를 실제로 변경했는지 (스냅샷 diff로 확인)

```bash
# 특정 기관 재분석 (개별 확인)
node scripts/analyze.js --url https://www.example.go.kr --id XXXX --name "기관명"
```

## 4단계: 히스토리 업데이트

```bash
# history.json에 이번 스캔 결과 추가
node -e "
const fs = require('fs');
const results = JSON.parse(fs.readFileSync('data/results.json','utf-8'));
const history = JSON.parse(fs.readFileSync('data/history.json','utf-8'));

const scores = {};
results.organizations.forEach(o => { scores[o.org_id] = o.scores.total; });

history.scans.push({
  date: new Date().toISOString().split('T')[0],
  label: '정기 분석',
  scores: scores
});

fs.writeFileSync('data/history.json', JSON.stringify(history, null, 2));
console.log('히스토리 추가 완료. 총 ' + history.scans.length + '회 스캔');
"
```

## 5단계: 통계 일관성 점검

```bash
# 데이터 일관성 체크
node -e "
const fs = require('fs');
const results = JSON.parse(fs.readFileSync('data/results.json','utf-8'));
const orgs = JSON.parse(fs.readFileSync('data/organizations.json','utf-8'));
const csv = fs.readFileSync('data/summary_scores.csv','utf-8').trim().split('\n');

console.log('results.json organizations:', results.organizations.length);
console.log('results.json meta.total:', results.meta.total_organizations);
console.log('organizations.json total:', orgs.summary.total);
console.log('summary_scores.csv rows:', csv.length - 1);

// 타입별 카운트
const types = {};
results.organizations.forEach(o => { types[o.org_type] = (types[o.org_type]||0)+1; });
Object.entries(types).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));

// 등급 분포
const grades = {};
results.organizations.forEach(o => { grades[o.scores.grade] = (grades[o.scores.grade]||0)+1; });
console.log('등급:', JSON.stringify(grades));
console.log('평균:', (results.organizations.reduce((s,o) => s+o.scores.total, 0) / results.organizations.length).toFixed(1));
"
```

## 6단계: 하드코딩된 숫자 업데이트

아래 파일에서 기관 수 등 하드코딩된 숫자를 확인하고 업데이트:

| 파일 | 확인 항목 |
|------|---------|
| `index.html` | og:description, hero subtitle의 기관 수 |
| `about.html` | 기관 수, 시·군·구 수 |
| `updates.html` | 타임라인 내용 |
| `llms.txt` | 기관 수, 분석 대상 목록 |
| `sitemap.xml` | lastmod 날짜 |

## 7단계: 커밋 & 배포

```bash
git add -A
git commit -m "정기 데이터 업데이트: $(date +%Y-%m-%d)

분석 기관: XXX개
평균 점수: XX.X점
등급 분포: A+ X | A X | B+ X | B X | C X | D X | F X

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

git push origin main
```

## 요약: 한 줄 실행 가이드

정기 업데이트 시 Claude에게 다음과 같이 요청:

> "전체 데이터를 재분석해줘. docs/DATA-UPDATE-PROCEDURE.md 절차를 따라서 크롤링하고, 점수 악화 기관을 검증하고, 히스토리를 업데이트하고, 하드코딩된 숫자를 수정한 뒤 커밋해줘."
