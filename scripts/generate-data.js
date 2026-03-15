#!/usr/bin/env node
/**
 * 정부조직법 기반 조직 데이터 + 샘플 점수 생성 스크립트
 * 법률 제21065호 (2025.10.1 개정, 시행 2026.1.2)
 */

// === 조직 정의 (정부조직법 기준) ===
const orgs = [
  // 19개 행정각부 (제29조)
  { id:'M01', name:'재정경제부',       en:'Ministry of Economy and Finance',         type:'ministry', parent:null, url:'https://www.moef.go.kr',   law:'제30조' },
  { id:'M02', name:'과학기술정보통신부', en:'Ministry of Science and ICT',              type:'ministry', parent:null, url:'https://www.msit.go.kr',   law:'제31조' },
  { id:'M03', name:'교육부',           en:'Ministry of Education',                   type:'ministry', parent:null, url:'https://www.moe.go.kr',    law:'제32조' },
  { id:'M04', name:'외교부',           en:'Ministry of Foreign Affairs',             type:'ministry', parent:null, url:'https://www.mofa.go.kr',   law:'제33조' },
  { id:'M05', name:'통일부',           en:'Ministry of Unification',                 type:'ministry', parent:null, url:'https://www.unikorea.go.kr', law:'제34조' },
  { id:'M06', name:'법무부',           en:'Ministry of Justice',                     type:'ministry', parent:null, url:'https://www.moj.go.kr',    law:'제35조' },
  { id:'M07', name:'국방부',           en:'Ministry of National Defense',            type:'ministry', parent:null, url:'https://www.mnd.go.kr',    law:'제36조' },
  { id:'M08', name:'행정안전부',       en:'Ministry of the Interior and Safety',     type:'ministry', parent:null, url:'https://www.mois.go.kr',   law:'제37조' },
  { id:'M09', name:'국가보훈부',       en:'Ministry of Patriots and Veterans Affairs',type:'ministry', parent:null, url:'https://www.mpva.go.kr',   law:'제38조' },
  { id:'M10', name:'문화체육관광부',   en:'Ministry of Culture, Sports and Tourism', type:'ministry', parent:null, url:'https://www.mcst.go.kr',   law:'제39조' },
  { id:'M11', name:'농림축산식품부',   en:'Ministry of Agriculture, Food and Rural Affairs', type:'ministry', parent:null, url:'https://www.mafra.go.kr', law:'제40조' },
  { id:'M12', name:'산업통상부',       en:'Ministry of Trade, Industry',             type:'ministry', parent:null, url:'https://www.motie.go.kr',  law:'제41조' },
  { id:'M13', name:'보건복지부',       en:'Ministry of Health and Welfare',          type:'ministry', parent:null, url:'https://www.mohw.go.kr',   law:'제42조' },
  { id:'M14', name:'기후에너지환경부', en:'Ministry of Climate, Energy and Environment', type:'ministry', parent:null, url:'https://www.me.go.kr', law:'제43조' },
  { id:'M15', name:'고용노동부',       en:'Ministry of Employment and Labor',        type:'ministry', parent:null, url:'https://www.moel.go.kr',   law:'제44조' },
  { id:'M16', name:'성평등가족부',     en:'Ministry of Gender Equality and Family',  type:'ministry', parent:null, url:'https://www.mogef.go.kr',  law:'제45조' },
  { id:'M17', name:'국토교통부',       en:'Ministry of Land, Infrastructure and Transport', type:'ministry', parent:null, url:'https://www.molit.go.kr', law:'제46조' },
  { id:'M18', name:'해양수산부',       en:'Ministry of Oceans and Fisheries',        type:'ministry', parent:null, url:'https://www.mof.go.kr',    law:'제47조' },
  { id:'M19', name:'중소벤처기업부',   en:'Ministry of SMEs and Startups',           type:'ministry', parent:null, url:'https://www.mss.go.kr',    law:'제48조' },

  // 국무총리 소속 처 (제23~28조)
  { id:'P01', name:'기획예산처',       en:'Office of Budget Planning',               type:'pm_office', parent:null, url:'https://www.opb.go.kr',   law:'제23조' },
  { id:'P02', name:'인사혁신처',       en:'Ministry of Personnel Management',        type:'pm_office', parent:null, url:'https://www.mpm.go.kr',   law:'제24조' },
  { id:'P03', name:'법제처',           en:'Ministry of Government Legislation',      type:'pm_office', parent:null, url:'https://www.moleg.go.kr', law:'제25조' },
  { id:'P04', name:'식품의약품안전처', en:'Ministry of Food and Drug Safety',         type:'pm_office', parent:null, url:'https://www.mfds.go.kr',  law:'제26조' },
  { id:'P05', name:'국가데이터처',     en:'National Data Agency',                    type:'pm_office', parent:null, url:'https://kostat.go.kr',    law:'제27조' },
  { id:'P06', name:'지식재산처',       en:'Intellectual Property Office',             type:'pm_office', parent:null, url:'https://www.kipo.go.kr',  law:'제28조' },

  // 부 산하 청
  { id:'A01', name:'국세청',           en:'National Tax Service',                    type:'agency', parent:'M01', url:'https://www.nts.go.kr',    law:'제30조③' },
  { id:'A02', name:'관세청',           en:'Korea Customs Service',                   type:'agency', parent:'M01', url:'https://www.customs.go.kr', law:'제30조⑤' },
  { id:'A03', name:'조달청',           en:'Public Procurement Service',              type:'agency', parent:'M01', url:'https://www.pps.go.kr',    law:'제30조⑦' },
  { id:'A04', name:'재외동포청',       en:'Overseas Koreans Agency',                 type:'agency', parent:'M04', url:'https://www.oka.go.kr',    law:'제33조③' },
  { id:'A05', name:'검찰청',           en:'Supreme Prosecutors\' Office',            type:'agency', parent:'M06', url:'https://www.spo.go.kr',    law:'제35조' },
  { id:'A06', name:'병무청',           en:'Military Manpower Administration',        type:'agency', parent:'M07', url:'https://www.mma.go.kr',    law:'제36조③' },
  { id:'A07', name:'방위사업청',       en:'Defense Acquisition Program Administration', type:'agency', parent:'M07', url:'https://www.dapa.go.kr', law:'제36조⑤' },
  { id:'A08', name:'경찰청',           en:'Korean National Police Agency',           type:'agency', parent:'M08', url:'https://www.police.go.kr', law:'제37조⑤' },
  { id:'A09', name:'소방청',           en:'National Fire Agency',                    type:'agency', parent:'M08', url:'https://www.nfa.go.kr',    law:'제37조⑦' },
  { id:'A10', name:'국가유산청',       en:'Korea Heritage Service',                  type:'agency', parent:'M10', url:'https://www.khs.go.kr',    law:'제39조③' },
  { id:'A11', name:'농촌진흥청',       en:'Rural Development Administration',        type:'agency', parent:'M11', url:'https://www.rda.go.kr',    law:'제40조③' },
  { id:'A12', name:'산림청',           en:'Korea Forest Service',                    type:'agency', parent:'M11', url:'https://www.forest.go.kr', law:'제40조⑤' },
  { id:'A13', name:'질병관리청',       en:'Korea Disease Control and Prevention Agency', type:'agency', parent:'M13', url:'https://www.kdca.go.kr', law:'제42조②' },
  { id:'A14', name:'기상청',           en:'Korea Meteorological Administration',     type:'agency', parent:'M14', url:'https://www.kma.go.kr',    law:'제43조②' },
  { id:'A15', name:'해양경찰청',       en:'Korea Coast Guard',                       type:'agency', parent:'M18', url:'https://www.kcg.go.kr',    law:'제47조②' },
];

// === 샘플 점수 생성 ===
// 점수 분포: 다양한 등급이 나오도록 설계
const scoreMap = {
  M01:62, M02:77, M03:47, M04:58, M05:45, M06:28, M07:14, M08:70,
  M09:52, M10:65, M11:55, M12:60, M13:52, M14:41, M15:58, M16:50,
  M17:35, M18:48, M19:63,
  P01:55, P02:50, P03:68, P04:60, P05:72, P06:58,
  A01:64, A02:56, A03:53, A04:42, A05:30, A06:22, A07:33,
  A08:42, A09:48, A10:57, A11:61, A12:55, A13:65, A14:55, A15:38,
};

function gradeFromScore(s) {
  if(s>=90) return 'A+'; if(s>=80) return 'A'; if(s>=70) return 'B+';
  if(s>=60) return 'B'; if(s>=40) return 'C'; if(s>=20) return 'D'; return 'F';
}

// 점수를 카테고리별로 분배 (총합이 total과 일치하도록)
function distributeScore(total) {
  const ratio = total / 100;
  const rt = Math.round(25 * (ratio + (Math.random()-0.5)*0.3));
  const ca = Math.round(25 * (ratio + (Math.random()-0.5)*0.3));
  const sd = Math.round(20 * (ratio + (Math.random()-0.5)*0.3));
  const ta = Math.round(15 * (ratio + (Math.random()-0.5)*0.2));
  const lt = total > 70 ? Math.round(10 * Math.random() * 0.3) : 0;
  const sm = Math.round(5 * (ratio + (Math.random()-0.5)*0.2));

  const clamp = (v,max) => Math.max(0, Math.min(max, v));
  const cats = {
    rt: clamp(rt,25), ca: clamp(ca,25), sd: clamp(sd,20),
    ta: clamp(ta,15), lt: clamp(lt,10), sm: clamp(sm,5)
  };

  // 조정해서 합이 total이 되도록
  let sum = cats.rt + cats.ca + cats.sd + cats.ta + cats.lt + cats.sm;
  let diff = total - sum;
  // ca에 차이를 반영 (핵심 지표)
  cats.ca = clamp(cats.ca + diff, 25);
  sum = cats.rt + cats.ca + cats.sd + cats.ta + cats.lt + cats.sm;
  diff = total - sum;
  if (diff !== 0) cats.rt = clamp(cats.rt + diff, 25);

  return cats;
}

// 카테고리 점수를 항목별로 분배
function distributeItems(cats) {
  const r = (max, catScore, catMax, jitter=0.2) => {
    const base = max * (catScore / catMax);
    return Math.max(0, Math.min(max, Math.round(base + (Math.random()-0.5)*max*jitter)));
  };
  const items = {};
  // RT
  items['RT-01'] = cats.rt >= 5 ? 5 : (cats.rt >= 3 ? 3 : 0);
  items['RT-02'] = r(3, cats.rt, 25);
  items['RT-03'] = r(7, cats.rt, 25);
  items['RT-04'] = cats.rt >= 10 ? 5 : 0;
  let rtSum = items['RT-01']+items['RT-02']+items['RT-03']+items['RT-04'];
  items['RT-05'] = Math.max(0, Math.min(5, cats.rt - rtSum));

  // CA — 핵심: 보도자료, 정책소개, 공지사항
  items['CA-01'] = r(7, cats.ca, 25);
  items['CA-02'] = r(5, cats.ca, 25);
  items['CA-03'] = r(5, cats.ca, 25);
  items['CA-04'] = r(4, cats.ca, 25);
  let caSum = items['CA-01']+items['CA-02']+items['CA-03']+items['CA-04'];
  items['CA-05'] = Math.max(0, Math.min(4, cats.ca - caSum));

  // SD
  items['SD-01'] = r(4, cats.sd, 20);
  items['SD-02'] = r(4, cats.sd, 20);
  items['SD-03'] = r(4, cats.sd, 20);
  items['SD-04'] = cats.sd > 15 ? r(5, cats.sd, 20) : 0;
  let sdSum = items['SD-01']+items['SD-02']+items['SD-03']+items['SD-04'];
  items['SD-05'] = Math.max(0, Math.min(3, cats.sd - sdSum));

  // TA
  items['TA-01'] = cats.ta >= 3 ? 3 : 0;
  items['TA-02'] = r(4, cats.ta, 15);
  items['TA-03'] = r(4, cats.ta, 15);
  let taSum = items['TA-01']+items['TA-02']+items['TA-03'];
  items['TA-04'] = Math.max(0, Math.min(4, cats.ta - taSum));

  // LT
  items['LT-01'] = cats.lt >= 4 ? 4 : 0;
  items['LT-02'] = cats.lt >= 4 ? Math.min(3, cats.lt - 4) : 0;
  items['LT-03'] = Math.max(0, cats.lt - items['LT-01'] - items['LT-02']);

  // SM
  items['SM-01'] = cats.sm >= 2 ? 2 : 0;
  items['SM-02'] = Math.max(0, Math.min(3, cats.sm - items['SM-01']));

  return items;
}

// 이슈 생성
function generateIssues(items, total) {
  const issues = [];
  const add = (code, sev, desc, detail, rec) => issues.push({code,severity:sev,description:desc,detail:detail||'',recommendation_code:rec});

  if (items['RT-04'] === 0) add('RT-04-critical','critical','User-agent: * Disallow: /로 모든 크롤러를 전면 차단하고 있습니다.','공공정보 접근이 원천 차단됨.','REC-RT-04');
  if (items['RT-03'] <= 2) add('RT-03-major','major','주요 크롤러가 공공 콘텐츠에 접근하지 못하고 있습니다.','보도자료, 정책소개, 공지사항 경로가 크롤러에 의해 접근 불가.','REC-RT-03');
  if (items['CA-01'] <= 2) add('CA-01-critical','critical','보도자료에 개별 URL이 없어 직접 접근할 수 없습니다.','보도자료가 동적 로딩 또는 세션 기반으로만 접근 가능.','REC-CA-01');
  if (items['CA-02'] === 0) add('CA-02-major','major','정책소개 페이지에 개별 URL이 없습니다.','','REC-CA-02');
  if (items['CA-05'] === 0) add('CA-05-critical','critical','주요 콘텐츠가 JS 렌더링 전용이라 크롤러가 읽을 수 없습니다.','','REC-CA-05');
  if (items['SD-04'] === 0 && total > 40) add('SD-04-info','info','schema.org 구조화된 데이터가 없습니다.','','REC-SD-04');
  if (items['LT-01'] === 0) add('LT-01-info','info','llms.txt 파일이 존재하지 않습니다.','','REC-LT-01');
  if (items['SM-01'] === 0) add('SM-01-minor','minor','sitemap.xml이 존재하지 않습니다.','','REC-SM-01');
  if (items['RT-05'] <= 1 && items['RT-04'] > 0) add('RT-05-major','major','보도자료·정책·공지 경로의 크롤링이 차단되어 있습니다.','','REC-RT-05');

  return issues;
}

// 크롤러 룰 생성
function generateCrawlerRules(total) {
  if (total < 20) return { GPTBot:'not_mentioned',ClaudeBot:'not_mentioned','Google-Extended':'not_mentioned',Googlebot:'not_mentioned',Bytespider:'not_mentioned',CCBot:'not_mentioned','*':'blocked' };
  if (total < 40) return { GPTBot:'not_mentioned',ClaudeBot:'not_mentioned','Google-Extended':'not_mentioned',Googlebot:'partial_allow',Bytespider:'not_mentioned',CCBot:'not_mentioned','*':'partial_allow' };
  if (total < 70) return { GPTBot:'not_mentioned',ClaudeBot:'not_mentioned','Google-Extended':'not_mentioned',Googlebot:'allowed',Bytespider:'not_mentioned',CCBot:'not_mentioned','*':'partial_allow' };
  return { GPTBot:'partial_allow',ClaudeBot:'not_mentioned','Google-Extended':'not_mentioned',Googlebot:'allowed',Bytespider:'not_mentioned',CCBot:'not_mentioned','*':'partial_allow' };
}

// === 전체 데이터 생성 ===
const results = {
  meta: {
    last_updated: '2025-01-15T09:00:00+09:00',
    total_organizations: orgs.length,
    scan_version: 'v1',
    law_reference: '정부조직법 [법률 제21065호, 2025. 10. 1., 일부개정]',
    note: '본 데이터는 프로젝트 시연을 위한 샘플 데이터입니다. 실제 분석 결과와 다를 수 있습니다.',
    evaluation_focus: '보도자료, 정책소개, 공지사항 — 이 세 가지 핵심 공공 콘텐츠의 개방 여부를 중심으로 평가합니다.'
  },
  organizations: []
};

// seed random for reproducibility
let seed = 42;
const origRandom = Math.random;
Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

for (const org of orgs) {
  const total = scoreMap[org.id];
  const cats = distributeScore(total);
  const items = distributeItems(cats);
  const issues = generateIssues(items, total);
  const ttfb = Math.round(400 + (100 - total) * 30 + Math.random() * 500);
  const isSSR = total > 45;

  const entry = {
    org_id: org.id,
    name: org.name,
    name_en: org.en,
    org_type: org.type,
    url: org.url,
    parent_org_id: org.parent,
    law_reference: org.law,
    scan_date: '2025-01-15',
    scan_version: 'v1',
    scores: {
      total,
      grade: gradeFromScore(total),
      categories: {
        robots_txt: { score: cats.rt, max: 25 },
        content_accessibility: { score: cats.ca, max: 25 },
        structured_data: { score: cats.sd, max: 20 },
        technical_accessibility: { score: cats.ta, max: 15 },
        llms_txt: { score: cats.lt, max: 10 },
        sitemap_xml: { score: cats.sm, max: 5 }
      },
      items
    },
    issues,
    robots_txt: {
      exists: total > 10,
      syntax_valid: total > 30,
      crawler_rules: generateCrawlerRules(total)
    },
    llms_txt: { exists: false },
    sitemap_xml: { exists: total > 30, valid: total > 40, contains_content_urls: total > 60 },
    metadata: {
      has_title: true,
      title_unique_per_page: total > 50,
      has_meta_description: total > 35,
      meta_description_unique: total > 60,
      has_og_tags: total > 65,
      has_schema_org: false,
      has_lang_attribute: total > 25
    },
    technical: {
      https: true,
      ttfb_ms: ttfb,
      main_page_status: 200,
      mobile_viewport: total > 30,
      primary_rendering: isSSR ? 'ssr' : 'csr'
    },
    content_paths: {
      press_releases: { list_url: org.url + '/bbs/press', individual_url_accessible: total > 40, rendering_method: isSSR ? 'ssr' : 'csr' },
      policy_pages: { list_url: org.url + '/policy', individual_url_accessible: total > 50, rendering_method: isSSR ? 'ssr' : 'csr' },
      notices: { list_url: org.url + '/bbs/notice', individual_url_accessible: total > 35, rendering_method: isSSR ? 'ssr' : 'csr' }
    },
    suggested_robots_txt: `User-agent: *\nAllow: /bbs/\nAllow: /policy/\nAllow: /board/\nDisallow: /admin/\nDisallow: /login/\n\nSitemap: ${org.url}/sitemap.xml`,
    suggested_llms_txt: `# ${org.name} (${org.en})\n> ${org.name} 공식 웹사이트입니다.\n\n## 핵심 공공 콘텐츠\n- [보도자료](${org.url}/bbs/press)\n- [정책소개](${org.url}/policy)\n- [공지사항](${org.url}/bbs/notice)`
  };
  results.organizations.push(entry);
}

Math.random = origRandom;

// === history.json 생성 ===
const history = {
  description: '기관별 점수 변화 이력 (시연용 샘플 데이터)',
  scans: [
    { date: '2024-07-15', label: '1차 예비 분석', scores: {} },
    { date: '2024-10-15', label: '2차 중간 분석', scores: {} },
    { date: '2025-01-15', label: '3차 정식 분석', scores: {} }
  ]
};
for (const org of orgs) {
  const curr = scoreMap[org.id];
  const delta1 = Math.round(5 + Math.random() * 15);
  const delta2 = Math.round(2 + Math.random() * 8);
  history.scans[0].scores[org.id] = Math.max(5, curr - delta1 - delta2);
  history.scans[1].scores[org.id] = Math.max(5, curr - delta2);
  history.scans[2].scores[org.id] = curr;
}

// === CSV 생성 ===
let csv = 'org_id,name,org_type,parent_org_id,total_score,grade,robots_txt,content_accessibility,structured_data,technical_accessibility,llms_txt,sitemap_xml,scan_date,issues_critical,issues_major,issues_minor,issues_info\n';
for (const o of results.organizations) {
  const ic = o.issues.filter(i=>i.severity==='critical').length;
  const im = o.issues.filter(i=>i.severity==='major').length;
  const imn = o.issues.filter(i=>i.severity==='minor').length;
  const ii = o.issues.filter(i=>i.severity==='info').length;
  const c = o.scores.categories;
  csv += `${o.org_id},${o.name},${o.org_type},${o.parent_org_id||''},${o.scores.total},${o.scores.grade},${c.robots_txt.score},${c.content_accessibility.score},${c.structured_data.score},${c.technical_accessibility.score},${c.llms_txt.score},${c.sitemap_xml.score},${o.scan_date},${ic},${im},${imn},${ii}\n`;
}

// Output
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '..', 'data');
fs.writeFileSync(path.join(dataDir, 'results.json'), JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(dataDir, 'history.json'), JSON.stringify(history, null, 2));
fs.writeFileSync(path.join(dataDir, 'summary_scores.csv'), csv);
console.log(`Generated ${results.organizations.length} organizations`);
console.log('Files: data/results.json, data/history.json, data/summary_scores.csv');
