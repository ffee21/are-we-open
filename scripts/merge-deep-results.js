#!/usr/bin/env node
/**
 * 병렬 심층 분석 배치 결과를 합치고 점수에 반영
 *
 * 사용법:
 *   node scripts/merge-deep-results.js
 *
 * data/deep-batch-*.json 파일들을 읽어서:
 * 1. data/deep-analysis.json으로 병합
 * 2. data/results.json 점수 업데이트
 * 3. data/results-lite.json 재생성
 * 4. 배치 파일 정리
 */
const fs = require('fs');
const path = require('path');
const { parse, isAllowed } = require('./lib/robots-parser.js');

const dataDir = path.resolve('data');
const batchFiles = fs.readdirSync(dataDir).filter(f => f.startsWith('deep-batch-') && f.endsWith('.json'));

if (batchFiles.length === 0) {
  console.error('병합할 배치 파일이 없습니다.');
  process.exit(0);
}

console.error('배치 파일 ' + batchFiles.length + '개 발견');

// 1. 모든 배치 결과 합치기
const allResults = {};

// 기존 deep-analysis.json 로드
try {
  const existing = JSON.parse(fs.readFileSync(path.join(dataDir, 'deep-analysis.json'), 'utf-8'));
  existing.forEach(function(r) { allResults[r.org_id] = r; });
} catch {}

// 배치 파일 병합
var newCount = 0;
batchFiles.forEach(function(f) {
  try {
    var batch = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8'));
    batch.forEach(function(r) { allResults[r.org_id] = r; newCount++; });
  } catch (err) {
    console.error('파일 읽기 실패: ' + f + ' — ' + err.message);
  }
});

var merged = Object.values(allResults);
fs.writeFileSync(path.join(dataDir, 'deep-analysis.json'), JSON.stringify(merged, null, 2));
console.error('deep-analysis.json 병합 완료: ' + merged.length + '개 기관 (신규 ' + newCount + '개)');

// 2. 점수 업데이트
var results = JSON.parse(fs.readFileSync(path.join(dataDir, 'results.json'), 'utf-8'));
var blocked = {};
merged.forEach(function(d) { blocked[d.org_id] = d; });

var updated = 0;
results.organizations.forEach(function(org) {
  var b = blocked[org.org_id];
  if (!b) return;
  org.deep_analysis = {
    press: b.press.blocked, notice: b.notice.blocked, policy: b.policy.blocked,
    press_detected: b.press.detected, notice_detected: b.notice.detected, policy_detected: b.policy.detected
  };
  var changed = false;
  if (b.press.blocked && b.press.detected) { org.scores.items['CA-01'] = 0; changed = true; }
  if (b.notice.blocked && b.notice.detected) { org.scores.items['CA-03'] = 0; changed = true; }
  if (b.policy.blocked && b.policy.detected) { org.scores.items['CA-02'] = 0; changed = true; }
  if (changed) {
    var items = org.scores.items;
    org.scores.categories.content_accessibility.score = items['CA-01']+items['CA-02']+items['CA-03']+items['CA-04']+items['CA-05'];
    var total = Object.values(org.scores.categories).reduce(function(s,c){return s+c.score;},0);
    var llmBlocked = (org.robots_txt.llm_crawlers_blocked||[]).length;
    if (org.robots_txt.full_block) total = Math.min(total, 25);
    else if (llmBlocked >= 3) total = Math.min(total, 40);
    else if (llmBlocked >= 1) total = Math.min(total, 59);
    var old = org.scores.total;
    org.scores.total = total;
    org.scores.grade = total >= 90 ? 'A+' : total >= 80 ? 'A' : total >= 70 ? 'B+' : total >= 60 ? 'B' : total >= 40 ? 'C' : total >= 20 ? 'D' : 'F';
    if (old !== total) updated++;
  }
});

fs.writeFileSync(path.join(dataDir, 'results.json'), JSON.stringify(results, null, 2));
console.error('점수 업데이트: ' + updated + '개 기관');

// 3. lite 재생성
var lite = { meta: results.meta, organizations: results.organizations.map(function(o) { return {
  org_id:o.org_id,name:o.name,name_en:o.name_en||'',org_type:o.org_type,url:o.url,
  parent_org_id:o.parent_org_id,scan_date:o.scan_date,scores:o.scores,issues:o.issues,
  robots_txt:o.robots_txt?{exists:o.robots_txt.exists,syntax_valid:o.robots_txt.syntax_valid,
    full_block:o.robots_txt.full_block,llm_crawlers_blocked:o.robots_txt.llm_crawlers_blocked,
    crawler_rules:o.robots_txt.crawler_rules}:null,
  llms_txt:o.llms_txt?{exists:o.llms_txt.exists,content_length:o.llms_txt.content_length}:null,
  sitemap_xml:o.sitemap_xml,metadata:o.metadata,technical:o.technical,deep_analysis:o.deep_analysis||null
};})};
fs.writeFileSync(path.join(dataDir, 'results-lite.json'), JSON.stringify(lite));

// 4. 배치 파일 정리
batchFiles.forEach(function(f) { fs.unlinkSync(path.join(dataDir, f)); });
console.error('배치 파일 ' + batchFiles.length + '개 정리 완료');

// 요약
var grades = {};
results.organizations.forEach(function(o) { grades[o.scores.grade] = (grades[o.scores.grade]||0)+1; });
var avg = results.organizations.reduce(function(s,o){return s+o.scores.total;},0)/results.organizations.length;
console.error('\n=== 최종 결과 ===');
console.error('평균: ' + avg.toFixed(1) + '점');
console.error('등급: ' + JSON.stringify(grades));
