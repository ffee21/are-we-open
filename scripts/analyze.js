#!/usr/bin/env node
/**
 * 단일 기관 웹사이트 분석 스크립트
 *
 * 사용법:
 *   node scripts/analyze.js --url https://www.msit.go.kr --id M02
 *   node scripts/analyze.js --org-file data/organizations.json --id M02
 *
 * 분석 항목:
 *   1. robots.txt — LLM 크롤러 차단 여부 (핵심)
 *   2. llms.txt — 존재 및 내용
 *   3. sitemap.xml — 존재 및 유효성
 *   4. 메인 페이지 — 메타데이터, 기술적 접근성
 */

const { parse, isAllowed, analyzeCrawlerAccess } = require('./lib/robots-parser.js');
const path = require('path');
const fs = require('fs');

// === HTTP 요청 유틸 (재시도 포함) ===
async function fetchOnce(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AreWeOpenBot/1.0)',
        'Accept': 'text/html,text/plain,application/xml,*/*'
      },
      redirect: 'follow'
    });
    const ttfb = Date.now() - start;
    const text = await res.text();
    return { status: res.status, text, ttfb, url: res.url, ok: res.ok };
  } catch (err) {
    return { status: 0, text: '', ttfb: Date.now() - start, url, ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithTimeout(url, timeoutMs = 10000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetchOnce(url, timeoutMs);
    if (res.ok || res.status === 404) return res;
    if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
  return await fetchOnce(url, timeoutMs);
}

// HTML 에러 페이지 감지 — 많은 정부 사이트가 없는 페이지에 200 + HTML을 반환
function looksLikeHtml(text) {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.startsWith('<') || /<!doctype/i.test(trimmed.substring(0, 100));
}

function looksLikeXml(text) {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.startsWith('<?xml') || trimmed.startsWith('<urlset') || trimmed.startsWith('<sitemapindex');
}

// === robots.txt 분석 ===
async function analyzeRobotsTxt(baseUrl) {
  const url = new URL('/robots.txt', baseUrl).href;
  const res = await fetchWithTimeout(url);

  const result = {
    exists: res.ok && res.status === 200 && !looksLikeHtml(res.text),
    status_code: res.status,
    fetch_error: res.error || null,
    raw: null,
    syntax_valid: false,
    parse_errors: [],
    crawler_rules: {},
    full_block: false,           // User-agent: * Disallow: / 여부
    llm_crawlers_blocked: [],    // 차단된 LLM 크롤러 목록
    llm_crawlers_allowed: [],    // 허용된 LLM 크롤러 목록
    content_paths_blocked: [],   // 차단된 콘텐츠 경로
    sitemaps: []
  };

  if (!result.exists) return result;

  result.raw = res.text;
  const parsed = parse(res.text);
  result.syntax_valid = parsed.valid;
  result.parse_errors = parsed.errors;
  result.sitemaps = parsed.sitemaps;

  // 콘텐츠 경로 — 일반적인 한국 정부 웹사이트 패턴
  const contentPaths = [
    '/', '/bbs/', '/board/', '/news/', '/press/',
    '/policy/', '/notice/', '/ntt/', '/cop/',
    '/cmm/', '/usr/', '/user/'
  ];

  const crawlerAccess = analyzeCrawlerAccess(parsed, contentPaths);
  result.crawler_rules = {};

  for (const [ua, info] of Object.entries(crawlerAccess)) {
    result.crawler_rules[ua] = {
      status: info.status,
      mentioned: info.mentioned
    };
  }

  // 전면 차단 확인
  const wildcard = crawlerAccess['*'];
  if (wildcard && wildcard.paths['/'] && !wildcard.paths['/'].allowed) {
    result.full_block = true;
  }

  // LLM 크롤러별 차단 상태
  const llmBots = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai', 'Google-Extended'];
  for (const bot of llmBots) {
    const access = crawlerAccess[bot];
    if (access && access.status === 'blocked') {
      result.llm_crawlers_blocked.push(bot);
    } else {
      result.llm_crawlers_allowed.push(bot);
    }
  }

  return result;
}

// === llms.txt 분석 ===
// llms.txt는 반드시 '#'으로 시작해야 함 (llms.txt 스펙)
function looksLikeLlmsTxt(text) {
  if (!text) return false;
  const trimmed = text.trim();
  // llms.txt 스펙: '#'으로 시작하는 마크다운 형식
  if (!trimmed.startsWith('#')) return false;
  // 에러 메시지나 HTML이 아닌지 확인
  if (looksLikeHtml(text)) return false;
  // 한국어 에러 메시지 패턴 감지
  const errorPatterns = /장애|오류|에러|error|not found|서비스.*중단|점검|unavailable/i;
  if (errorPatterns.test(trimmed) && trimmed.length < 200) return false;
  return true;
}

async function analyzeLlmsTxt(baseUrl) {
  const url = new URL('/llms.txt', baseUrl).href;
  const res = await fetchWithTimeout(url);

  const result = {
    exists: res.ok && res.status === 200 && looksLikeLlmsTxt(res.text),
    status_code: res.status,
    content_length: 0,
    has_description: false,
    has_links: false,
    raw: null
  };

  if (!result.exists) return result;

  result.raw = res.text;
  result.content_length = res.text.length;
  result.has_description = res.text.length > 50;
  result.has_links = /https?:\/\//.test(res.text);

  return result;
}

// === sitemap.xml 분석 ===
async function analyzeSitemap(baseUrl) {
  const url = new URL('/sitemap.xml', baseUrl).href;
  const res = await fetchWithTimeout(url);

  // sitemap은 XML이어야 함. HTML 에러 페이지가 반환되면 없는 것으로 판정
  const isValidResponse = res.ok && res.status === 200 && (looksLikeXml(res.text) || !looksLikeHtml(res.text));
  const result = {
    exists: isValidResponse,
    status_code: res.status,
    valid_xml: false,
    url_count: 0
  };

  if (!result.exists) return result;

  // 간단한 XML 유효성 검사
  result.valid_xml = res.text.includes('<urlset') || res.text.includes('<sitemapindex');
  const urlMatches = res.text.match(/<loc>/g);
  result.url_count = urlMatches ? urlMatches.length : 0;

  return result;
}

// === JavaScript 리다이렉트 감지 및 추적 ===
function detectJsRedirect(html, baseUrl) {
  if (!html || html.length > 2000) return null; // 짧은 페이지에서만 감지
  // location.href = "/path" 또는 location.replace("/path") 등
  const patterns = [
    /location\.href\s*=\s*["']([^"']+)["']/i,
    /location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
    /window\.location\s*=\s*["']([^"']+)["']/i,
    /document\.location\.href\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]+content\s*=\s*["']\d+;\s*url=([^"']+)["']/i
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      try { return new URL(m[1], baseUrl).href; }
      catch { return null; }
    }
  }
  return null;
}

// === 메인 페이지 분석 ===
async function analyzeMainPage(baseUrl) {
  let res = await fetchWithTimeout(baseUrl);

  // JavaScript 리다이렉트 감지 → 실제 페이지로 재요청
  if (res.ok && res.text) {
    const jsRedirectUrl = detectJsRedirect(res.text, res.url || baseUrl);
    if (jsRedirectUrl) {
      const res2 = await fetchWithTimeout(jsRedirectUrl);
      if (res2.ok) {
        res = res2;
        res.redirected_from_js = true;
      }
    }
  }

  const result = {
    status_code: res.status,
    ttfb_ms: res.ttfb,
    https: baseUrl.startsWith('https'),
    final_url: res.url,
    redirected: res.url !== baseUrl || !!res.redirected_from_js,
    // 메타데이터
    has_title: false,
    title: null,
    has_meta_description: false,
    has_og_tags: false,
    has_schema_org: false,
    has_lang_attribute: false,
    has_viewport: false,
    // SSR 판별
    is_ssr: false,
    html_length: 0
  };

  if (!res.ok) return result;

  const html = res.text;
  result.html_length = html.length;

  // title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.has_title = true;
    result.title = titleMatch[1].trim();
  }

  // meta description
  result.has_meta_description = /<meta[^>]+name\s*=\s*["']description["'][^>]*>/i.test(html);

  // OG tags
  result.has_og_tags = /<meta[^>]+property\s*=\s*["']og:/i.test(html);

  // schema.org
  result.has_schema_org = /application\/ld\+json/i.test(html) || /itemtype\s*=\s*["']https?:\/\/schema\.org/i.test(html);

  // lang
  result.has_lang_attribute = /<html[^>]+lang\s*=/i.test(html);

  // viewport
  result.has_viewport = /<meta[^>]+name\s*=\s*["']viewport["']/i.test(html);

  // SSR 판별: body 내 텍스트가 충분히 있는지
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    const bodyText = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '')
                                  .replace(/<style[\s\S]*?<\/style>/gi, '')
                                  .replace(/<[^>]+>/g, '')
                                  .replace(/\s+/g, ' ')
                                  .trim();
    result.is_ssr = bodyText.length > 200;
  }

  // 핵심 콘텐츠 경로 탐색: 메인 페이지에서 보도자료/공지사항/정책소개 링크 찾기
  result.detected_paths = { press: [], notice: [], policy: [] };

  // 안전한 정규식으로 a 태그의 href와 텍스트 추출
  const anchors = html.match(/<a[^>]+href\s*=\s*["'][^"'#][^"']*["'][^>]*>[^<]*(?:<(?!\/a)[^>]*>[^<]*)*<\/a>/gi) || [];
  for (const anchor of anchors) {
    const hrefMatch = anchor.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href.startsWith('javascript') || href.startsWith('mailto')) continue;

    const innerText = anchor.replace(/<[^>]+>/g, '').trim();
    const lt = innerText.toLowerCase();
    const lh = href.toLowerCase();

    if (lt.includes('보도자료') || lt.includes('보도 자료') || lh.includes('press') || lh.includes('bodo')) {
      result.detected_paths.press.push(href);
    }
    if (lt.includes('공지사항') || lt.includes('공지 사항') || lh.includes('notice') || lh.includes('gongji')) {
      result.detected_paths.notice.push(href);
    }
    if (lt.includes('정책') || lt.includes('주요사업') || lh.includes('policy') || lh.includes('polcy')) {
      result.detected_paths.policy.push(href);
    }
  }

  return result;
}

// === 실제 콘텐츠 경로의 robots.txt 차단 여부 확인 ===
function checkContentPathAccess(robotsResult, pageResult) {
  const result = { press: null, notice: null, policy: null };
  if (!robotsResult.exists || !robotsResult.raw) return result;

  const parsed = parse(robotsResult.raw);
  const detected = pageResult.detected_paths || { press: [], notice: [], policy: [] };

  // 각 콘텐츠 유형에 대해, 탐지된 경로가 LLM 크롤러에게 차단되는지 확인
  for (const type of ['press', 'notice', 'policy']) {
    const paths = detected[type];
    if (!paths || paths.length === 0) {
      result[type] = { detected: false, paths: [], blocked: false };
      continue;
    }

    // URL에서 경로만 추출
    const pathsToCheck = paths.map(p => {
      try { return new URL(p, 'https://example.com').pathname; }
      catch { return p; }
    }).slice(0, 5); // 최대 5개만 확인

    // GPTBot과 * 기준으로 차단 여부 확인
    let anyBlocked = false;
    for (const path of pathsToCheck) {
      const gptCheck = isAllowed(parsed, 'GPTBot', path);
      const wildCheck = isAllowed(parsed, '*', path);
      if (!gptCheck.allowed || !wildCheck.allowed) {
        anyBlocked = true;
        break;
      }
    }

    result[type] = { detected: true, paths: pathsToCheck, blocked: anyBlocked };
  }

  return result;
}

// === 스코어링 ===
function score(robotsResult, llmsResult, sitemapResult, pageResult) {
  const items = {};

  // RT-01: robots.txt 존재 (5점)
  items['RT-01'] = robotsResult.exists ? 5 : 0;

  // RT-02: 문법 유효성 (3점)
  items['RT-02'] = !robotsResult.exists ? 0 :
    robotsResult.syntax_valid ? 3 :
    robotsResult.parse_errors.length <= 2 ? 2 : 0;

  // RT-03: LLM 크롤러 차단 없음 (7점) — 핵심
  const llmBlockedCount = robotsResult.llm_crawlers_blocked.length;
  items['RT-03'] = robotsResult.full_block ? 0 :
    llmBlockedCount === 0 ? 7 :
    llmBlockedCount <= 2 ? 4 :
    llmBlockedCount <= 4 ? 2 : 0;

  // RT-04: 전면 차단 아님 (5점) — 핵심
  items['RT-04'] = robotsResult.full_block ? 0 : 5;

  // RT-05: 핵심 콘텐츠 경로 비차단 (5점) — 핵심
  items['RT-05'] = robotsResult.full_block ? 0 :
    robotsResult.content_paths_blocked.length === 0 ? 5 :
    robotsResult.content_paths_blocked.length <= 2 ? 3 : 0;

  // CA-01~03: 보도자료/정책소개/공지사항 LLM 접근 (7+5+5=17점)
  // 실제 콘텐츠 경로를 robots.txt와 대조하여 판정
  const contentAccess = checkContentPathAccess(robotsResult, pageResult);

  // CA-01: 보도자료 (7점)
  if (robotsResult.full_block) {
    items['CA-01'] = 0; // 전면 차단
  } else if (contentAccess.press && contentAccess.press.detected) {
    items['CA-01'] = contentAccess.press.blocked ? 0 : 7; // 실제 경로 확인됨
  } else {
    // 경로를 못 찾았으면, LLM 차단 없으면 기본 허용으로 간주 (단 감점)
    items['CA-01'] = llmBlockedCount === 0 ? 5 : 3;
  }

  // CA-02: 정책소개 (5점)
  if (robotsResult.full_block) {
    items['CA-02'] = 0;
  } else if (contentAccess.policy && contentAccess.policy.detected) {
    items['CA-02'] = contentAccess.policy.blocked ? 0 : 5;
  } else {
    items['CA-02'] = llmBlockedCount === 0 ? 3 : 2;
  }

  // CA-03: 공지사항 (5점)
  if (robotsResult.full_block) {
    items['CA-03'] = 0;
  } else if (contentAccess.notice && contentAccess.notice.detected) {
    items['CA-03'] = contentAccess.notice.blocked ? 0 : 5;
  } else {
    items['CA-03'] = llmBlockedCount === 0 ? 3 : 2;
  }

  // CA-04: 콘텐츠 경로 명확성 (4점)
  items['CA-04'] = sitemapResult.exists && sitemapResult.url_count > 10 ? 4 :
    sitemapResult.exists ? 2 : 0;

  // CA-05: SSR 렌더링 (4점)
  items['CA-05'] = pageResult.is_ssr ? 4 : 0;

  // SD-01~05: 구조화된 데이터 (20점)
  items['SD-01'] = pageResult.has_title ? 4 : 0;
  items['SD-02'] = pageResult.has_meta_description ? 4 : 0;
  items['SD-03'] = pageResult.has_og_tags ? 4 : 0;
  items['SD-04'] = pageResult.has_schema_org ? 5 : 0;
  items['SD-05'] = pageResult.has_lang_attribute ? 3 : 0;

  // TA-01~04: 기술적 접근성 (15점)
  items['TA-01'] = pageResult.https ? 3 : 0;
  items['TA-02'] = pageResult.ttfb_ms < 1000 ? 4 :
    pageResult.ttfb_ms < 3000 ? 2 : 0;
  items['TA-03'] = pageResult.status_code === 200 ? 4 : 0;
  items['TA-04'] = pageResult.has_viewport ? 4 : 0;

  // LT-01~03: llms.txt (10점)
  items['LT-01'] = llmsResult.exists ? 4 : 0;
  items['LT-02'] = !llmsResult.exists ? 0 :
    llmsResult.content_length > 100 ? 3 : 1;
  items['LT-03'] = !llmsResult.exists ? 0 :
    (llmsResult.has_description && llmsResult.has_links) ? 3 :
    llmsResult.has_description ? 1 : 0;

  // SM-01~02: sitemap.xml (5점)
  items['SM-01'] = sitemapResult.exists ? 2 : 0;
  items['SM-02'] = !sitemapResult.exists ? 0 :
    (sitemapResult.valid_xml && sitemapResult.url_count > 5) ? 3 :
    sitemapResult.valid_xml ? 1 : 0;

  // 카테고리별 합산
  const categories = {
    robots_txt:              { score: items['RT-01']+items['RT-02']+items['RT-03']+items['RT-04']+items['RT-05'], max: 25 },
    content_accessibility:   { score: items['CA-01']+items['CA-02']+items['CA-03']+items['CA-04']+items['CA-05'], max: 25 },
    structured_data:         { score: items['SD-01']+items['SD-02']+items['SD-03']+items['SD-04']+items['SD-05'], max: 20 },
    technical_accessibility: { score: items['TA-01']+items['TA-02']+items['TA-03']+items['TA-04'], max: 15 },
    llms_txt:                { score: items['LT-01']+items['LT-02']+items['LT-03'], max: 10 },
    sitemap_xml:             { score: items['SM-01']+items['SM-02'], max: 5 }
  };

  let total = Object.values(categories).reduce((s, c) => s + c.score, 0);

  // === 핵심: LLM 접근 차단 시 점수 상한 적용 ===
  // 전면 차단(Disallow: /): 최대 25점 (F~D)
  // LLM 크롤러를 명시적으로 차단: 차단 수에 비례하여 상한 적용
  if (robotsResult.full_block) {
    total = Math.min(total, 25);
  } else if (llmBlockedCount >= 3) {
    total = Math.min(total, 40);  // 최대 C
  } else if (llmBlockedCount >= 1) {
    total = Math.min(total, 59);  // 최대 C (B 미만)
  }

  const grade = total >= 90 ? 'A+' : total >= 80 ? 'A' : total >= 70 ? 'B+' :
    total >= 60 ? 'B' : total >= 40 ? 'C' : total >= 20 ? 'D' : 'F';

  return { total, grade, categories, items };
}

// === 이슈 생성 ===
function generateIssues(robotsResult, llmsResult, sitemapResult, pageResult, scores) {
  const issues = [];
  const add = (code, severity, desc, detail) =>
    issues.push({ code, severity, description: desc, detail: detail || '' });

  if (robotsResult.full_block)
    add('RT-04-critical', 'critical', 'User-agent: * Disallow: / 로 모든 크롤러가 전면 차단됨', 'LLM을 포함한 모든 크롤러가 웹사이트에 접근할 수 없습니다.');
  if (robotsResult.llm_crawlers_blocked.length > 0)
    add('RT-03-major', 'major', `LLM 크롤러 ${robotsResult.llm_crawlers_blocked.length}개가 차단됨`, `차단된 크롤러: ${robotsResult.llm_crawlers_blocked.join(', ')}`);
  if (!robotsResult.exists)
    add('RT-01-critical', 'critical', 'robots.txt가 존재하지 않음', 'LLM과 검색엔진이 크롤링 정책을 확인할 수 없습니다.');
  if (!robotsResult.syntax_valid && robotsResult.exists)
    add('RT-02-major', 'major', 'robots.txt에 문법 오류가 있음', robotsResult.parse_errors.slice(0, 3).join('; '));

  if (!pageResult.is_ssr)
    add('CA-05-major', 'major', '메인 페이지가 CSR 방식으로 LLM이 콘텐츠를 읽기 어려움', '');

  if (!llmsResult.exists)
    add('LT-01-info', 'info', 'llms.txt 파일이 존재하지 않음', '');
  if (!sitemapResult.exists)
    add('SM-01-minor', 'minor', 'sitemap.xml이 존재하지 않음', '');

  if (!pageResult.has_meta_description)
    add('SD-02-minor', 'minor', 'meta description이 없음', '');
  if (!pageResult.has_lang_attribute)
    add('SD-05-minor', 'minor', 'html lang 속성이 없음', '');

  return issues;
}

// === 메인 실행 ===
async function analyzeOrg(orgId, orgUrl, orgName) {
  const startTime = Date.now();
  console.error(`[${orgId}] ${orgName} — ${orgUrl} 분석 중...`);

  const [robotsResult, llmsResult, sitemapResult, pageResult] = await Promise.all([
    analyzeRobotsTxt(orgUrl),
    analyzeLlmsTxt(orgUrl),
    analyzeSitemap(orgUrl),
    analyzeMainPage(orgUrl)
  ]);

  const scores = score(robotsResult, llmsResult, sitemapResult, pageResult);
  const issues = generateIssues(robotsResult, llmsResult, sitemapResult, pageResult, scores);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`[${orgId}] 완료 (${elapsed}초) — ${scores.total}점 ${scores.grade}`);

  return {
    org_id: orgId,
    scan_date: new Date().toISOString().split('T')[0],
    scan_version: 'v1',
    scores,
    issues,
    robots_txt: {
      exists: robotsResult.exists,
      syntax_valid: robotsResult.syntax_valid,
      full_block: robotsResult.full_block,
      llm_crawlers_blocked: robotsResult.llm_crawlers_blocked,
      llm_crawlers_allowed: robotsResult.llm_crawlers_allowed,
      crawler_rules: robotsResult.crawler_rules,
      sitemaps: robotsResult.sitemaps,
      snapshot: robotsResult.raw
    },
    llms_txt: {
      exists: llmsResult.exists,
      content_length: llmsResult.content_length,
      has_description: llmsResult.has_description,
      snapshot: llmsResult.raw
    },
    sitemap_xml: {
      exists: sitemapResult.exists,
      valid: sitemapResult.valid_xml,
      url_count: sitemapResult.url_count
    },
    metadata: {
      has_title: pageResult.has_title,
      title: pageResult.title,
      has_meta_description: pageResult.has_meta_description,
      has_og_tags: pageResult.has_og_tags,
      has_schema_org: pageResult.has_schema_org,
      has_lang_attribute: pageResult.has_lang_attribute
    },
    technical: {
      https: pageResult.https,
      ttfb_ms: pageResult.ttfb_ms,
      main_page_status: pageResult.status_code,
      mobile_viewport: pageResult.has_viewport,
      primary_rendering: pageResult.is_ssr ? 'ssr' : 'csr',
      html_length: pageResult.html_length
    },
    content_paths: {
      press: pageResult.detected_paths ? pageResult.detected_paths.press.slice(0, 3) : [],
      notice: pageResult.detected_paths ? pageResult.detected_paths.notice.slice(0, 3) : [],
      policy: pageResult.detected_paths ? pageResult.detected_paths.policy.slice(0, 3) : [],
      press_blocked: scores.items['CA-01'] === 0 && !robotsResult.full_block,
      notice_blocked: scores.items['CA-03'] === 0 && !robotsResult.full_block,
      policy_blocked: scores.items['CA-02'] === 0 && !robotsResult.full_block
    }
  };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  const url = getArg('--url');
  const id = getArg('--id') || 'TEST';
  const name = getArg('--name') || id;

  if (!url) {
    console.error('Usage: node scripts/analyze.js --url <URL> [--id <ID>] [--name <NAME>]');
    process.exit(1);
  }

  analyzeOrg(id, url, name).then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { analyzeOrg };
