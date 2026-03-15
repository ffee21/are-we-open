#!/usr/bin/env node
/**
 * 심층 분석 스크립트
 *
 * 단순 스크립트 분석의 한계를 보완:
 * 1. 메인 페이지에서 보도자료/공지사항/정책소개 링크를 찾음
 * 2. 해당 링크를 실제로 따라가서 최종 URL을 확인 (리다이렉트 추적)
 * 3. 최종 URL의 og:url/canonical URL에서 실제 경로 확인
 * 4. 실제 경로가 robots.txt에서 차단되는지 확인
 *
 * 사용법:
 *   node scripts/deep-analyze.js --url https://www.mohw.go.kr --id M13
 *   node scripts/deep-analyze.js --batch 10
 *   node scripts/deep-analyze.js --all
 *
 * 이 스크립트는 자동 분석의 보조 도구이며,
 * 최종 판단은 Claude(Opus)가 결과를 검토하여 수행합니다.
 */

const { parse, isAllowed } = require('./lib/robots-parser.js');
const fs = require('fs');
const path = require('path');

async function fetchSafe(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeoutMs || 8000);
  try {
    var res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AreWeOpen-DeepAnalyzer/1.0' },
      redirect: 'follow'
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

// 리다이렉트를 따라가되 최종 URL + og:url 확인
async function resolveUrl(url) {
  var res = await fetchSafe(url, 8000);
  if (!res) return { requested: url, final: url, canonical: null, status: 0 };

  var html = await res.text();
  var ogMatch = html.match(/property\s*=\s*["']og:url["'][^>]+content\s*=\s*["']([^"']+)["']/i)
    || html.match(/content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:url["']/i);

  return {
    requested: url,
    final: res.url,
    canonical: ogMatch ? ogMatch[1] : null,
    status: res.status
  };
}

// 메인 페이지에서 핵심 콘텐츠 링크 탐지
async function detectContentLinks(baseUrl) {
  var res = await fetchSafe(baseUrl, 15000);
  if (!res) return { press: [], notice: [], policy: [] };

  var html;
  try { html = await res.text(); } catch { return { press: [], notice: [], policy: [] }; }
  var links = { press: [], notice: [], policy: [] };

  var anchorPattern = /<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([^<]*(?:<(?!\/a)[^>]*>[^<]*)*)<\/a>/gi;
  var match;
  while ((match = anchorPattern.exec(html)) !== null) {
    var href = match[1];
    var text = match[2].replace(/<[^>]+>/g, '').trim();
    if (!href || href.startsWith('javascript') || href.startsWith('mailto') || !text) continue;
    if (!href.startsWith('http')) {
      try { href = new URL(href, baseUrl).href; } catch { continue; }
    }

    var lt = text.toLowerCase();
    if (lt.includes('보도자료') || lt.includes('보도 자료')) links.press.push({ text: text, href: href });
    if (lt.includes('공지사항') || lt.includes('공지 사항')) links.notice.push({ text: text, href: href });
    if (lt.includes('정책') && (lt.includes('소개') || lt.includes('정보') || lt.includes('자료'))) links.policy.push({ text: text, href: href });
    if (links.press.length === 0 && (lt === '보도' || lt.includes('press'))) links.press.push({ text: text, href: href });
    if (links.policy.length === 0 && lt.includes('주요사업')) links.policy.push({ text: text, href: href });
  }

  // 중복 제거
  for (var key of Object.keys(links)) {
    var seen = new Set();
    links[key] = links[key].filter(function(l) {
      if (seen.has(l.href)) return false;
      seen.add(l.href);
      return true;
    }).slice(0, 3);
  }
  return links;
}

// 특정 URL의 최종 경로가 robots.txt에서 차단되는지 확인
async function checkUrlAccess(url, robotsTxtContent) {
  var resolved = await resolveUrl(url);
  var effectiveUrl = resolved.canonical || resolved.final;
  var pathToCheck;
  try { var u = new URL(effectiveUrl); pathToCheck = u.pathname + u.search; }
  catch { pathToCheck = effectiveUrl; }

  var blocked = false;
  var reason = 'no robots.txt';
  if (robotsTxtContent) {
    var parsed = parse(robotsTxtContent);
    var gptResult = isAllowed(parsed, 'GPTBot', pathToCheck);
    var wildResult = isAllowed(parsed, '*', pathToCheck);
    blocked = !gptResult.allowed || !wildResult.allowed;
    reason = blocked ? (gptResult.allowed ? wildResult.reason : gptResult.reason) : 'allowed';
  }

  return {
    original_url: url,
    final_url: resolved.final,
    canonical_url: resolved.canonical,
    path_checked: pathToCheck,
    blocked: blocked,
    reason: reason,
    status: resolved.status
  };
}

// 단일 기관 심층 분석
async function deepAnalyze(orgId, baseUrl, orgName) {
  console.error('[' + orgId + '] ' + orgName + ' 심층 분석 중...');

  // robots.txt 로드
  var robotsTxt = null;
  try {
    var snapshotPath = path.resolve('data/snapshots/' + orgId);
    if (fs.existsSync(snapshotPath)) {
      var files = fs.readdirSync(snapshotPath);
      var robotsFile = files.find(function(f) { return f.startsWith('robots_'); });
      if (robotsFile) robotsTxt = fs.readFileSync(path.join(snapshotPath, robotsFile), 'utf-8');
    }
  } catch {}

  if (!robotsTxt) {
    var rRes = await fetchSafe(new URL('/robots.txt', baseUrl).href, 8000);
    if (rRes && rRes.ok) {
      var rText = await rRes.text();
      if (!rText.trim().startsWith('<')) robotsTxt = rText;
    }
  }

  // 메인 페이지에서 콘텐츠 링크 탐지
  var links = await detectContentLinks(baseUrl);

  // 각 링크의 실제 접근성 확인
  var results = { press: [], notice: [], policy: [] };
  for (var type of ['press', 'notice', 'policy']) {
    for (var link of links[type]) {
      var access = await checkUrlAccess(link.href, robotsTxt);
      results[type].push(Object.assign({ link_text: link.text }, access));
    }
  }

  // 종합 판정
  var summary = {};
  for (var t of ['press', 'notice', 'policy']) {
    if (results[t].length === 0) {
      summary[t] = { status: 'not_detected', blocked: false };
    } else {
      var anyBlocked = results[t].some(function(r) { return r.blocked; });
      summary[t] = {
        status: anyBlocked ? 'blocked' : 'accessible',
        blocked: anyBlocked,
        paths: results[t].map(function(r) { return { path: r.path_checked, blocked: r.blocked, reason: r.reason }; })
      };
    }
  }

  console.error('[' + orgId + '] 보도자료: ' + summary.press.status + ', 공지: ' + summary.notice.status + ', 정책: ' + summary.policy.status);
  return { org_id: orgId, name: orgName, url: baseUrl, robots_txt_exists: !!robotsTxt, detected_links: links, access_results: results, summary: summary };
}

// CLI
async function main() {
  var args = process.argv.slice(2);
  var getArg = function(name) { var i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  var url = getArg('--url');
  var id = getArg('--id') || 'TEST';
  var name = getArg('--name') || id;
  var batch = getArg('--batch');
  var all = args.includes('--all');

  if (url) {
    var result = await deepAnalyze(id, url, name);
    console.log(JSON.stringify(result, null, 2));
  } else if (batch || all) {
    var resultsData = JSON.parse(fs.readFileSync(path.resolve('data/results.json'), 'utf-8'));
    var orgs = resultsData.organizations;
    if (batch) orgs = orgs.slice(0, parseInt(batch));

    var deepResults = [];
    for (var org of orgs) {
      try {
        var r = await deepAnalyze(org.org_id, org.url, org.name);
        deepResults.push(r);
      } catch (err) {
        console.error('[' + org.org_id + '] error: ' + err.message);
      }
    }

    fs.writeFileSync(path.resolve('data/deep-analysis.json'), JSON.stringify(deepResults, null, 2));
    console.error('\n심층 분석 완료: ' + deepResults.length + '개 기관');

    var pressBlocked = 0, noticeBlocked = 0, policyBlocked = 0;
    var pressDetected = 0, noticeDetected = 0, policyDetected = 0;
    deepResults.forEach(function(r) {
      if (r.summary.press.status !== 'not_detected') { pressDetected++; if (r.summary.press.blocked) pressBlocked++; }
      if (r.summary.notice.status !== 'not_detected') { noticeDetected++; if (r.summary.notice.blocked) noticeBlocked++; }
      if (r.summary.policy.status !== 'not_detected') { policyDetected++; if (r.summary.policy.blocked) policyBlocked++; }
    });
    console.error('보도자료: ' + pressDetected + '개 탐지, ' + pressBlocked + '개 차단');
    console.error('공지사항: ' + noticeDetected + '개 탐지, ' + noticeBlocked + '개 차단');
    console.error('정책소개: ' + policyDetected + '개 탐지, ' + policyBlocked + '개 차단');
  } else {
    console.error('Usage:');
    console.error('  node scripts/deep-analyze.js --url <URL> --id <ID>');
    console.error('  node scripts/deep-analyze.js --batch 10');
    console.error('  node scripts/deep-analyze.js --all');
  }
}

main().catch(function(err) { console.error('Fatal:', err); process.exit(1); });
