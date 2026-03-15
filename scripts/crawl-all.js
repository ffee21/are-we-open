#!/usr/bin/env node
/**
 * 전체 기관 일괄 분석 스크립트
 *
 * 사용법:
 *   node scripts/crawl-all.js                        # 전체 분석
 *   node scripts/crawl-all.js --dry-run               # 대상 목록만 확인
 *   node scripts/crawl-all.js --concurrency 3         # 동시 요청 수 (기본 5)
 *   node scripts/crawl-all.js --filter ministry       # 특정 유형만
 *   node scripts/crawl-all.js --ids M01,M02,A01       # 특정 기관만
 *   node scripts/crawl-all.js --output data/results.json
 */

const fs = require('fs');
const path = require('path');
const { analyzeOrg } = require('./analyze.js');

// === CLI 인자 파싱 ===
const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : defaultVal;
};
const hasFlag = (name) => args.includes(name);

const DRY_RUN = hasFlag('--dry-run');
const CONCURRENCY = parseInt(getArg('--concurrency', '5'));
const FILTER_TYPE = getArg('--filter', null);
const FILTER_IDS = getArg('--ids', null);
const OUTPUT = getArg('--output', 'data/results.json');
const ORG_FILE = getArg('--org-file', 'data/organizations.json');

// === 기관 목록 로드 ===
function loadOrganizations() {
  const raw = fs.readFileSync(path.resolve(ORG_FILE), 'utf-8');
  let orgs = JSON.parse(raw).organizations;

  // URL이 없는 기관은 제외
  orgs = orgs.filter(o => o.url && o.url.startsWith('http'));

  if (FILTER_TYPE) {
    orgs = orgs.filter(o => o.type === FILTER_TYPE || o.subtype === FILTER_TYPE);
  }
  if (FILTER_IDS) {
    const ids = new Set(FILTER_IDS.split(','));
    orgs = orgs.filter(o => ids.has(o.id));
  }

  return orgs;
}

// === 동시성 제한 실행 ===
async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        console.error(`Task ${i} failed:`, err.message);
        results[i] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

// === 메인 ===
async function main() {
  const orgs = loadOrganizations();

  console.error(`\n=== Are We Open? — 공공 웹사이트 데이터 개방 분석 ===`);
  console.error(`대상: ${orgs.length}개 기관`);
  console.error(`동시 요청: ${CONCURRENCY}`);
  console.error(`출력: ${OUTPUT}\n`);

  if (DRY_RUN) {
    console.error('--- 분석 대상 목록 (dry-run) ---');
    orgs.forEach(o => console.error(`  ${o.id}\t${o.name}\t${o.url}`));
    console.error(`\n총 ${orgs.length}개 기관. --dry-run 플래그를 제거하면 실제 분석이 시작됩니다.`);
    return;
  }

  // 분석 실행
  const tasks = orgs.map(org => () => analyzeOrg(org.id, org.url, org.name));
  const analysisResults = await runWithConcurrency(tasks, CONCURRENCY);

  // 기존 결과 로드 (있으면)
  let existing = { meta: {}, organizations: [] };
  try {
    existing = JSON.parse(fs.readFileSync(path.resolve(OUTPUT), 'utf-8'));
  } catch {}

  // 결과 병합 (새 결과로 기존 결과 업데이트)
  const resultMap = {};
  for (const o of existing.organizations || []) {
    resultMap[o.org_id] = o;
  }
  for (let i = 0; i < orgs.length; i++) {
    if (analysisResults[i]) {
      const org = orgs[i];
      const analysis = analysisResults[i];
      resultMap[org.id] = {
        org_id: org.id,
        name: org.name,
        name_en: org.name_en,
        org_type: org.type,
        url: org.url,
        parent_org_id: org.parent_id || null,
        law_reference: org.law || null,
        ...analysis
      };
    }
  }

  // 결과 저장
  const output = {
    meta: {
      last_updated: new Date().toISOString(),
      total_organizations: Object.keys(resultMap).length,
      scan_version: 'v1',
      law_reference: '정부조직법 [법률 제21065호, 2025. 10. 1., 일부개정]',
      evaluation_focus: '보도자료, 정책소개, 공지사항 — LLM이 robots.txt 등에 의해 차단당하지 않고 접근할 수 있는지 평가'
    },
    organizations: Object.values(resultMap).sort((a, b) => {
      if (a.scores && b.scores) return b.scores.total - a.scores.total;
      return 0;
    })
  };

  fs.writeFileSync(path.resolve(OUTPUT), JSON.stringify(output, null, 2));

  // summary_scores.csv 생성
  let csv = 'org_id,name,org_type,parent_org_id,total_score,grade,robots_txt,content_accessibility,structured_data,technical_accessibility,llms_txt,sitemap_xml,scan_date\n';
  for (const o of output.organizations) {
    if (!o.scores) continue;
    const c = o.scores.categories;
    csv += `${o.org_id},${o.name},${o.org_type},${o.parent_org_id || ''},${o.scores.total},${o.scores.grade},${c.robots_txt.score},${c.content_accessibility.score},${c.structured_data.score},${c.technical_accessibility.score},${c.llms_txt.score},${c.sitemap_xml.score},${o.scan_date}\n`;
  }
  fs.writeFileSync(path.resolve('data/summary_scores.csv'), csv);

  // 개별 스냅샷 저장
  for (const o of output.organizations) {
    if (o.robots_txt && o.robots_txt.snapshot) {
      const dir = path.resolve(`data/snapshots/${o.org_id}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `robots_${o.scan_date}.txt`), o.robots_txt.snapshot);
    }
    if (o.llms_txt && o.llms_txt.snapshot) {
      const dir = path.resolve(`data/snapshots/${o.org_id}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `llms_${o.scan_date}.txt`), o.llms_txt.snapshot);
    }
  }

  // 요약 출력
  console.error('\n=== 분석 완료 ===');
  const successful = output.organizations.filter(o => o.scores);
  const grades = {};
  successful.forEach(o => { grades[o.scores.grade] = (grades[o.scores.grade] || 0) + 1; });
  const avgScore = successful.reduce((s, o) => s + o.scores.total, 0) / (successful.length || 1);

  console.error(`분석 성공: ${successful.length}/${orgs.length}`);
  console.error(`평균 점수: ${avgScore.toFixed(1)}/100`);
  console.error(`등급 분포: ${JSON.stringify(grades)}`);
  console.error(`결과 저장: ${OUTPUT}`);
  console.error(`CSV 저장: data/summary_scores.csv`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
