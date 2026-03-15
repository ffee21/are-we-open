#!/usr/bin/env node
/**
 * 교육청, 입법부, 사법부, 검찰, 경찰, 독립기구를 organizations.json에 추가
 */
const fs = require('fs');
const path = require('path');

const orgsFile = path.resolve('data/organizations.json');
const data = JSON.parse(fs.readFileSync(orgsFile, 'utf-8'));
const existing = new Set(data.organizations.map(o => o.name));

function add(id, name, type, parentId, url) {
  if (existing.has(name)) return;
  data.organizations.push({ id, name, name_en: '', type, parent_id: parentId, url });
  existing.add(name);
}

let idx = 0;
const nextId = (prefix) => prefix + String(++idx).padStart(3, '0');

// === 교육청 17개 ===
idx = 0;
const eduOrgs = [
  ['서울특별시교육청', 'https://www.sen.go.kr'],
  ['부산광역시교육청', 'https://www.pen.go.kr'],
  ['대구광역시교육청', 'https://www.dge.go.kr'],
  ['인천광역시교육청', 'https://www.ice.go.kr'],
  ['광주광역시교육청', 'https://www.gen.go.kr'],
  ['대전광역시교육청', 'https://www.dje.go.kr'],
  ['울산광역시교육청', 'https://use.go.kr'],
  ['세종특별자치시교육청', 'https://www.sje.go.kr'],
  ['경기도교육청', 'https://www.goe.go.kr'],
  ['강원특별자치도교육청', 'https://www.gwe.go.kr'],
  ['충청북도교육청', 'https://www.cbe.go.kr'],
  ['충청남도교육청', 'https://www.cne.go.kr'],
  ['전북특별자치도교육청', 'https://jbe.go.kr'],
  ['전라남도교육청', 'https://www.jne.go.kr'],
  ['경상북도교육청', 'https://www.gbe.kr'],
  ['경상남도교육청', 'https://www.gne.go.kr'],
  ['제주특별자치도교육청', 'https://www.jje.go.kr'],
];
eduOrgs.forEach(([name, url]) => add(nextId('E'), name, 'education', null, url));

// === 입법부 ===
idx = 0;
add(nextId('N'), '대한민국 국회', 'legislature', null, 'https://www.assembly.go.kr');
const councils = [
  ['서울특별시의회', 'https://www.smc.seoul.kr'],
  ['부산광역시의회', 'https://council.busan.go.kr'],
  ['대구광역시의회', 'https://council.daegu.go.kr'],
  ['인천광역시의회', 'https://www.icouncil.go.kr'],
  ['광주광역시의회', 'https://council.gwangju.go.kr'],
  ['대전광역시의회', 'https://council.daejeon.go.kr'],
  ['울산광역시의회', 'https://www.council.ulsan.kr'],
  ['세종특별자치시의회', 'https://council.sejong.go.kr'],
  ['경기도의회', 'https://www.ggc.go.kr'],
  ['강원특별자치도의회', 'https://council.gangwon.kr'],
  ['충청북도의회', 'https://council.chungbuk.kr'],
  ['충청남도의회', 'https://council.chungnam.go.kr'],
  ['전북특별자치도의회', 'https://www.jbstatecouncil.jeonbuk.kr'],
  ['전라남도의회', 'https://www.jnassembly.go.kr'],
  ['경상북도의회', 'https://council.gb.go.kr'],
  ['경상남도의회', 'https://council.gyeongnam.go.kr'],
  ['제주특별자치도의회', 'https://www.council.jeju.kr'],
];
councils.forEach(([name, url]) => add(nextId('N'), name, 'local_council', null, url));

// === 사법부 ===
idx = 0;
add(nextId('J'), '대법원', 'judiciary', null, 'https://www.scourt.go.kr');
add(nextId('J'), '헌법재판소', 'constitutional', null, 'https://www.ccourt.go.kr');
const courts = [
  ['서울고등법원', 'https://slgodung.scourt.go.kr'],
  ['대전고등법원', 'https://djgodung.scourt.go.kr'],
  ['대구고등법원', 'https://dggodung.scourt.go.kr'],
  ['부산고등법원', 'https://bsgodung.scourt.go.kr'],
  ['광주고등법원', 'https://gjgodung.scourt.go.kr'],
  ['수원고등법원', 'https://swgodung.scourt.go.kr'],
  ['서울중앙지방법원', 'https://seoul.scourt.go.kr'],
  ['서울동부지방법원', 'https://sldongbu.scourt.go.kr'],
  ['서울서부지방법원', 'https://slseobu.scourt.go.kr'],
  ['서울남부지방법원', 'https://slnambu.scourt.go.kr'],
  ['서울북부지방법원', 'https://slbukbu.scourt.go.kr'],
  ['의정부지방법원', 'https://uijeongbu.scourt.go.kr'],
  ['인천지방법원', 'https://incheon.scourt.go.kr'],
  ['수원지방법원', 'https://suwon.scourt.go.kr'],
  ['춘천지방법원', 'https://chuncheon.scourt.go.kr'],
  ['대전지방법원', 'https://daejeon.scourt.go.kr'],
  ['청주지방법원', 'https://cheongju.scourt.go.kr'],
  ['대구지방법원', 'https://daegu.scourt.go.kr'],
  ['부산지방법원', 'https://busan.scourt.go.kr'],
  ['울산지방법원', 'https://ulsan.scourt.go.kr'],
  ['창원지방법원', 'https://changwon.scourt.go.kr'],
  ['광주지방법원', 'https://gwangju.scourt.go.kr'],
  ['전주지방법원', 'https://jeonju.scourt.go.kr'],
  ['제주지방법원', 'https://jeju.scourt.go.kr'],
];
courts.forEach(([name, url]) => add(nextId('J'), name, 'judiciary', null, url));

// === 검찰 ===
idx = 0;
const prosec = [
  ['서울중앙지방검찰청', 'https://www.spo.go.kr/seoul/'],
  ['서울동부지방검찰청', 'https://www.spo.go.kr/eastseoul/'],
  ['서울남부지방검찰청', 'https://www.spo.go.kr/southseoul/'],
  ['서울북부지방검찰청', 'https://www.spo.go.kr/northseoul/'],
  ['서울서부지방검찰청', 'https://www.spo.go.kr/site/westseoul/main.do'],
  ['인천지방검찰청', 'https://www.spo.go.kr/incheon/'],
  ['수원지방검찰청', 'https://www.spo.go.kr/suwon/'],
  ['대전지방검찰청', 'https://www.spo.go.kr/site/daejeon/main.do'],
  ['대구지방검찰청', 'https://www.spo.go.kr/daegu/'],
  ['부산지방검찰청', 'https://www.spo.go.kr/busan/'],
  ['광주지방검찰청', 'https://www.spo.go.kr/site/gwangju/main.do'],
  ['전주지방검찰청', 'https://www.spo.go.kr/jeonju/'],
  ['청주지방검찰청', 'https://www.spo.go.kr/cheongju/'],
  ['춘천지방검찰청', 'https://www.spo.go.kr/chuncheon/'],
  ['창원지방검찰청', 'https://www.spo.go.kr/site/changwon/main.do'],
  ['울산지방검찰청', 'https://www.spo.go.kr/ulsan/'],
  ['제주지방검찰청', 'https://www.spo.go.kr/jeju/'],
];
prosec.forEach(([name, url]) => add(nextId('D'), name, 'prosecution', null, url));

// === 시도경찰청 ===
idx = 0;
const policeOrgs = [
  ['서울특별시경찰청', 'https://www.smpa.go.kr'],
  ['부산광역시경찰청', 'https://www.bspolice.go.kr'],
  ['대구광역시경찰청', 'https://www.dgpolice.go.kr'],
  ['인천광역시경찰청', 'https://www.icpolice.go.kr'],
  ['광주광역시경찰청', 'https://www.gjpolice.go.kr'],
  ['대전광역시경찰청', 'https://www.djpolice.go.kr'],
  ['울산광역시경찰청', 'https://www.uspolice.go.kr'],
  ['세종특별자치시경찰청', 'https://www.sjpolice.go.kr'],
  ['경기남부경찰청', 'https://www.ggpolice.go.kr'],
  ['경기북부경찰청', 'https://www.ggbpolice.go.kr'],
  ['강원특별자치도경찰청', 'https://www.gwpolice.go.kr'],
  ['충청북도경찰청', 'https://www.cbpolice.go.kr'],
  ['충청남도경찰청', 'https://cnpolice.go.kr'],
  ['전북특별자치도경찰청', 'https://www.jbpolice.go.kr'],
  ['전라남도경찰청', 'https://www.jnpolice.go.kr'],
  ['경상북도경찰청', 'https://gbpolice.go.kr'],
  ['경상남도경찰청', 'https://www.gnpolice.go.kr'],
  ['제주특별자치도경찰청', 'https://www.jjpolice.go.kr'],
];
policeOrgs.forEach(([name, url]) => add(nextId('R'), name, 'police', null, url));

// === 독립·헌법기관 ===
idx = 0;
const independents = [
  ['감사원', 'https://www.bai.go.kr'],
  ['중앙선거관리위원회', 'https://www.nec.go.kr'],
  ['국가인권위원회', 'https://www.humanrights.go.kr'],
  ['국민권익위원회', 'https://www.acrc.go.kr'],
  ['개인정보보호위원회', 'https://www.pipc.go.kr'],
  ['공정거래위원회', 'https://www.ftc.go.kr'],
  ['금융위원회', 'https://www.fsc.go.kr'],
  ['원자력안전위원회', 'https://www.nssc.go.kr'],
  ['방송미디어통신위원회', 'https://www.kmcc.go.kr'],
  ['한국은행', 'https://www.bok.or.kr'],
];
independents.forEach(([name, url]) => add(nextId('I'), name, 'independent', null, url));

// Update summary
const typeCounts = {};
data.organizations.forEach(o => { typeCounts[o.type] = (typeCounts[o.type] || 0) + 1; });
data.summary = { ...typeCounts, total: data.organizations.length };

fs.writeFileSync(orgsFile, JSON.stringify(data, null, 2));

console.log('=== 기관 추가 완료 ===');
Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
console.log(`  총: ${data.organizations.length}`);
