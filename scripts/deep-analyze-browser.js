#!/usr/bin/env node
/**
 * Playwright 기반 심층 분석
 * JS 렌더링 후 실제 보도자료/공지사항/정책소개 링크를 찾고,
 * 해당 경로가 robots.txt에서 차단되는지 확인
 *
 * 사용법:
 *   node scripts/deep-analyze-browser.js --ids M13,M02,M03
 *   node scripts/deep-analyze-browser.js --filter ministry
 *   node scripts/deep-analyze-browser.js --all
 */

const { chromium } = require('playwright');
const { parse, isAllowed } = require('./lib/robots-parser.js');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

async function analyzeWithBrowser(browser, org) {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  const result = {
    org_id: org.org_id,
    name: org.name,
    url: org.url,
    press: { detected: false, urls: [], blocked: false, blocked_paths: [] },
    notice: { detected: false, urls: [], blocked: false, blocked_paths: [] },
    policy: { detected: false, urls: [], blocked: false, blocked_paths: [] }
  };

  try {
    // 1. 메인 페이지 로드 (JS 실행 포함)
    await page.goto(org.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000); // JS 렌더링 대기

    // 2. 렌더링된 DOM에서 보도자료/공지사항/정책소개 링크 추출
    const links = await page.evaluate(() => {
      const press = [], notice = [], policy = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        const text = a.textContent.trim();
        if (!href || !text || href.startsWith('javascript') || href.startsWith('mailto')) return;

        const lt = text.toLowerCase();
        if (lt.includes('보도자료') || lt.includes('보도 자료') || lt === '보도') press.push({ text, href });
        if (lt.includes('공지사항') || lt.includes('공지 사항')) notice.push({ text, href });
        if ((lt.includes('정책') && (lt.includes('소개') || lt.includes('정보') || lt.includes('자료')))
            || lt.includes('주요사업') || lt.includes('주요 사업')) policy.push({ text, href });
      });

      // 중복 제거
      const dedup = arr => {
        const seen = new Set();
        return arr.filter(l => { if (seen.has(l.href)) return false; seen.add(l.href); return true; }).slice(0, 3);
      };
      return { press: dedup(press), notice: dedup(notice), policy: dedup(policy) };
    });

    // 3. robots.txt 로드
    let robotsTxt = null;
    const snapshotDir = path.resolve('data/snapshots/' + org.org_id);
    if (fs.existsSync(snapshotDir)) {
      const files = fs.readdirSync(snapshotDir);
      const rf = files.find(f => f.startsWith('robots_'));
      if (rf) robotsTxt = fs.readFileSync(path.join(snapshotDir, rf), 'utf-8');
    }
    if (!robotsTxt) {
      try {
        const rRes = await page.goto(new URL('/robots.txt', org.url).href, { waitUntil: 'domcontentloaded', timeout: 8000 });
        if (rRes && rRes.ok()) {
          const rText = await page.content();
          const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
          if (bodyText && !bodyText.trim().startsWith('<')) robotsTxt = bodyText;
        }
      } catch {}
    }

    const parsed = robotsTxt ? parse(robotsTxt) : null;

    // 4. 각 링크를 따라가서 최종 URL 확인 + robots.txt 대조
    for (const type of ['press', 'notice', 'policy']) {
      const typeLinks = links[type];
      if (typeLinks.length === 0) continue;
      result[type].detected = true;

      for (const link of typeLinks) {
        try {
          const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const finalUrl = page.url();

          // og:url 확인
          const ogUrl = await page.evaluate(() => {
            const meta = document.querySelector('meta[property="og:url"]');
            return meta ? meta.content : null;
          });

          const effectiveUrl = ogUrl || finalUrl;
          let pathToCheck;
          try { const u = new URL(effectiveUrl); pathToCheck = u.pathname + u.search; }
          catch { pathToCheck = effectiveUrl; }

          result[type].urls.push({
            link_text: link.text,
            original: link.href,
            final: finalUrl,
            canonical: ogUrl,
            path: pathToCheck
          });

          // robots.txt 대조
          if (parsed) {
            const wildCheck = isAllowed(parsed, '*', pathToCheck);
            const gptCheck = isAllowed(parsed, 'GPTBot', pathToCheck);
            if (!wildCheck.allowed || !gptCheck.allowed) {
              result[type].blocked = true;
              result[type].blocked_paths.push({
                path: pathToCheck,
                reason: !gptCheck.allowed ? gptCheck.reason : wildCheck.reason
              });
            }
          }
        } catch (err) {
          result[type].urls.push({ link_text: link.text, original: link.href, error: err.message });
        }
      }
    }

    // 메인 페이지로 돌아가기 (다음 분석을 위해)
    await page.goto('about:blank').catch(() => {});

  } catch (err) {
    result.error = err.message;
  } finally {
    await page.close();
  }

  return result;
}

async function main() {
  const resultsData = JSON.parse(fs.readFileSync(path.resolve('data/results.json'), 'utf-8'));
  let orgs = resultsData.organizations;

  // 필터링
  const filterType = getArg('--filter');
  const filterIds = getArg('--ids');

  if (filterType) {
    if (filterType === 'central') {
      orgs = orgs.filter(o => o.org_type === 'ministry' || o.org_type === 'pm_office' || o.org_type === 'agency');
    } else {
      orgs = orgs.filter(o => o.org_type === filterType);
    }
  }
  if (filterIds) {
    const ids = new Set(filterIds.split(','));
    orgs = orgs.filter(o => ids.has(o.org_id));
  }
  if (!args.includes('--all') && !filterType && !filterIds) {
    console.error('Usage: node scripts/deep-analyze-browser.js --filter central|ministry|... | --ids M13,M02 | --all');
    process.exit(1);
  }

  console.error('=== Playwright 심층 분석 ===');
  console.error('대상: ' + orgs.length + '개 기관\n');

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const org of orgs) {
    process.stderr.write('[' + org.org_id + '] ' + org.name + '... ');
    try {
      const r = await analyzeWithBrowser(browser, org);
      const status = [];
      status.push('보도' + (r.press.blocked ? '(X차단)' : r.press.detected ? '(O)' : '(-)'));
      status.push('공지' + (r.notice.blocked ? '(X차단)' : r.notice.detected ? '(O)' : '(-)'));
      status.push('정책' + (r.policy.blocked ? '(X차단)' : r.policy.detected ? '(O)' : '(-)'));
      process.stderr.write(status.join(' ') + '\n');
      results.push(r);
    } catch (err) {
      process.stderr.write('ERROR: ' + err.message + '\n');
    }
  }

  await browser.close();

  // 저장 — 배치별 별도 파일로 저장 (동시성 안전)
  const crypto = require('crypto');
  const batchId = getArg('--batch-id') || crypto.randomUUID();
  const batchFile = path.resolve('data/deep-batch-' + batchId + '.json');
  fs.writeFileSync(batchFile, JSON.stringify(results, null, 2));
  console.error('배치 결과 저장: ' + batchFile);

  // 요약
  console.error('\n=== 요약 ===');
  const pressBlocked = results.filter(r => r.press.blocked);
  const noticeBlocked = results.filter(r => r.notice.blocked);
  const policyBlocked = results.filter(r => r.policy.blocked);
  const pressDetected = results.filter(r => r.press.detected);
  const noticeDetected = results.filter(r => r.notice.detected);

  console.error('보도자료: ' + pressDetected.length + '개 탐지, ' + pressBlocked.length + '개 차단');
  console.error('공지사항: ' + noticeDetected.length + '개 탐지, ' + noticeBlocked.length + '개 차단');
  console.error('정책소개: ' + results.filter(r => r.policy.detected).length + '개 탐지, ' + policyBlocked.length + '개 차단');

  if (pressBlocked.length > 0) {
    console.error('\n차단된 보도자료:');
    pressBlocked.forEach(r => {
      r.press.blocked_paths.forEach(p => console.error('  ' + r.name + ': ' + p.path + ' (' + p.reason + ')'));
    });
  }
  if (noticeBlocked.length > 0) {
    console.error('\n차단된 공지사항:');
    noticeBlocked.forEach(r => {
      r.notice.blocked_paths.forEach(p => console.error('  ' + r.name + ': ' + p.path + ' (' + p.reason + ')'));
    });
  }

  const notDetected = results.filter(r => !r.press.detected && !r.notice.detected);
  if (notDetected.length > 0) {
    console.error('\n보도자료+공지 모두 미탐지: ' + notDetected.length + '개');
    notDetected.forEach(r => console.error('  ' + r.name + ' (' + r.org_id + ')'));
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
