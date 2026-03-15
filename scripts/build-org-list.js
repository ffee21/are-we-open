#!/usr/bin/env node
/**
 * 전체 분석 대상 기관 목록 통합 생성 스크립트
 *
 * 소스:
 *   1. 정부조직법 — 19개 행정각부 + 6개 국무총리 소속 처 + 15개 소속청
 *   2. 지방자치단체 행정구역 현황 — 17개 광역 지자체
 *   3. ALIO 공공기관 목록 — 344개 공공기관
 *
 * 출력: data/organizations.json
 */

const fs = require('fs');
const path = require('path');

// === 1. 정부조직법 기반 중앙행정기관 (기존) ===
const centralOrgs = JSON.parse(
  fs.readFileSync(path.resolve('data/organizations.json'), 'utf-8')
).organizations;

// === 2. 17개 광역 지자체 ===
const localGovs = [
  { id: 'L01', name: '서울특별시',       name_en: 'Seoul Metropolitan Government',          type: 'local_metro', parent_id: null, url: 'https://www.seoul.go.kr' },
  { id: 'L02', name: '부산광역시',       name_en: 'Busan Metropolitan City',                type: 'local_metro', parent_id: null, url: 'https://www.busan.go.kr' },
  { id: 'L03', name: '대구광역시',       name_en: 'Daegu Metropolitan City',                type: 'local_metro', parent_id: null, url: 'https://www.daegu.go.kr' },
  { id: 'L04', name: '인천광역시',       name_en: 'Incheon Metropolitan City',              type: 'local_metro', parent_id: null, url: 'https://www.incheon.go.kr' },
  { id: 'L05', name: '광주광역시',       name_en: 'Gwangju Metropolitan City',              type: 'local_metro', parent_id: null, url: 'https://www.gwangju.go.kr' },
  { id: 'L06', name: '대전광역시',       name_en: 'Daejeon Metropolitan City',              type: 'local_metro', parent_id: null, url: 'https://www.daejeon.go.kr' },
  { id: 'L07', name: '울산광역시',       name_en: 'Ulsan Metropolitan City',                type: 'local_metro', parent_id: null, url: 'https://www.ulsan.go.kr' },
  { id: 'L08', name: '세종특별자치시',   name_en: 'Sejong Special Autonomous City',         type: 'local_metro', parent_id: null, url: 'https://www.sejong.go.kr' },
  { id: 'L09', name: '경기도',           name_en: 'Gyeonggi Province',                     type: 'local_province', parent_id: null, url: 'https://www.gg.go.kr' },
  { id: 'L10', name: '강원특별자치도',   name_en: 'Gangwon Special Autonomous Province',    type: 'local_province', parent_id: null, url: 'https://www.provin.gangwon.kr' },
  { id: 'L11', name: '충청북도',         name_en: 'Chungcheongbuk-do',                     type: 'local_province', parent_id: null, url: 'https://www.chungbuk.go.kr' },
  { id: 'L12', name: '충청남도',         name_en: 'Chungcheongnam-do',                     type: 'local_province', parent_id: null, url: 'https://www.chungnam.go.kr' },
  { id: 'L13', name: '전북특별자치도',   name_en: 'Jeonbuk Special Autonomous Province',    type: 'local_province', parent_id: null, url: 'https://www.jeonbuk.go.kr' },
  { id: 'L14', name: '전라남도',         name_en: 'Jeollanam-do',                          type: 'local_province', parent_id: null, url: 'https://www.jeonnam.go.kr' },
  { id: 'L15', name: '경상북도',         name_en: 'Gyeongsangbuk-do',                      type: 'local_province', parent_id: null, url: 'https://www.gb.go.kr' },
  { id: 'L16', name: '경상남도',         name_en: 'Gyeongsangnam-do',                      type: 'local_province', parent_id: null, url: 'https://www.gyeongnam.go.kr' },
  { id: 'L17', name: '제주특별자치도',   name_en: 'Jeju Special Autonomous Province',       type: 'local_province', parent_id: null, url: 'https://www.jeju.go.kr' },
];

// === 3. ALIO 공공기관 (CSV 파싱) ===
const alioCsv = fs.readFileSync(path.resolve('data/alio_agencies.csv'), 'utf-8');
const alioLines = alioCsv.trim().split('\n').slice(1); // 헤더 제거

const alioOrgs = [];
let alioIdx = 0;
for (const line of alioLines) {
  // CSV 파싱 (quoted fields)
  const fields = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { fields.push(current); current = ''; }
    else { current += c; }
  }
  fields.push(current);

  const [name, type, ministry, homepage, parentName] = fields;
  if (!name) continue;

  alioIdx++;
  let url = homepage || '';
  if (url && !url.startsWith('http')) url = 'https://' + url;

  alioOrgs.push({
    id: `K${String(alioIdx).padStart(3, '0')}`,
    name,
    name_en: '',
    type: 'public_institution',
    subtype: type,         // 공기업(시장형), 준정부기관 등
    parent_id: null,
    ministry,              // 주무부처
    parent_org_name: parentName || null,
    url
  });
}

// === 통합 ===
const output = {
  generated: new Date().toISOString().split('T')[0],
  sources: [
    '정부조직법 [법률 제21065호, 2025.10.1 개정]',
    '지방자치단체 행정구역 및 인구 현황 (행정안전부, 2024.12.31 기준)',
    'ALIO 공공기관 경영정보 공개시스템 (2025년 기준)'
  ],
  summary: {
    central_government: centralOrgs.length,
    local_government: localGovs.length,
    public_institutions: alioOrgs.length,
    total: centralOrgs.length + localGovs.length + alioOrgs.length
  },
  organizations: [
    ...centralOrgs,
    ...localGovs,
    ...alioOrgs
  ]
};

fs.writeFileSync(
  path.resolve('data/organizations.json'),
  JSON.stringify(output, null, 2)
);

console.log(`=== 기관 목록 생성 완료 ===`);
console.log(`중앙행정기관: ${centralOrgs.length}개`);
console.log(`광역 지자체:  ${localGovs.length}개`);
console.log(`공공기관:     ${alioOrgs.length}개`);
console.log(`합계:         ${output.summary.total}개`);
console.log(`저장: data/organizations.json`);
