/* ==========================================================================
   Are We Open? — Shared Application Logic
   All data rendered by this app comes from our own trusted data/results.json.
   Dynamic text values are escaped via escapeHtml() before insertion.
   ========================================================================== */

const App = (() => {
  // Cache
  let _data = null;

  // Grade config
  const GRADES = {
    'A+': { min: 90, color: 'var(--grade-aplus)', cls: 'grade-aplus', label: '매우 개방적' },
    'A':  { min: 80, color: 'var(--grade-a)',     cls: 'grade-a',     label: '개방적' },
    'B+': { min: 70, color: 'var(--grade-bplus)',  cls: 'grade-bplus', label: '양호' },
    'B':  { min: 60, color: 'var(--grade-b)',      cls: 'grade-b',     label: '보통' },
    'C':  { min: 40, color: 'var(--grade-c)',      cls: 'grade-c',     label: '미흡' },
    'D':  { min: 20, color: 'var(--grade-d)',      cls: 'grade-d',     label: '매우 미흡' },
    'F':  { min: 0,  color: 'var(--grade-f)',       cls: 'grade-f',     label: '사실상 폐쇄' }
  };

  const CATEGORIES = {
    robots_txt:              { name: 'robots.txt',      max: 25, code: 'RT' },
    content_accessibility:   { name: '콘텐츠 접근성',    max: 25, code: 'CA' },
    structured_data:         { name: '구조화된 데이터',   max: 20, code: 'SD' },
    technical_accessibility: { name: '기술적 접근성',     max: 15, code: 'TA' },
    llms_txt:                { name: 'llms.txt',        max: 10, code: 'LT' },
    sitemap_xml:             { name: 'sitemap.xml',     max: 5,  code: 'SM' }
  };

  const ORG_TYPES = {
    // 중앙행정기관 (정부조직법)
    ministry:           '부',
    pm_office:          '처',
    agency:             '청',
    // 입법부
    legislature:        '입법기관',
    local_council:      '지방의회',
    // 사법부
    judiciary:          '법원',
    constitutional:     '헌법기관',
    // 독립기관
    independent:        '독립기관',
    // 치안·검찰
    prosecution:        '검찰',
    police:             '경찰',
    // 교육
    education:          '교육청',
    // 지방자치단체
    local_metro:        '특별·광역시',
    local_province:     '도',
    local_basic:        '시·군·구',
    // 공공기관
    public_institution: '공공기관'
  };

  const SEVERITY_LABELS = {
    critical: 'Critical',
    major: 'Major',
    minor: 'Minor',
    info: 'Info'
  };

  const ITEM_DESCRIPTIONS = {
    'RT-01': { name: 'robots.txt 존재', max: 5, desc: 'robots.txt가 존재하여 크롤링 정책을 명시하고 있는지' },
    'RT-02': { name: '문법 유효성', max: 3, desc: 'robots.txt 파싱 에러 없이 크롤러가 올바르게 해석 가능한지' },
    'RT-03': { name: 'LLM 크롤러 차단 없음', max: 7, desc: 'GPTBot, ClaudeBot 등 LLM 크롤러가 차단되지 않았는지 (핵심)' },
    'RT-04': { name: '전면 차단 아님', max: 5, desc: 'Disallow: / 로 모든 접근을 막고 있지 않은지 (핵심)' },
    'RT-05': { name: '핵심 콘텐츠 경로 비차단', max: 5, desc: '보도자료·정책소개·공지사항 경로가 robots.txt로 차단되지 않았는지 (핵심)' },
    'CA-01': { name: '보도자료 LLM 접근', max: 7, desc: '보도자료 경로에 LLM이 차단 없이 접근할 수 있는지 (핵심)' },
    'CA-02': { name: '정책소개 LLM 접근', max: 5, desc: '정책소개 경로에 LLM이 차단 없이 접근할 수 있는지 (핵심)' },
    'CA-03': { name: '공지사항 LLM 접근', max: 5, desc: '공지사항 경로에 LLM이 차단 없이 접근할 수 있는지 (핵심)' },
    'CA-04': { name: '콘텐츠 경로 명확성', max: 4, desc: '크롤러가 콘텐츠를 탐색할 수 있는 구조인지' },
    'CA-05': { name: 'SSR 렌더링', max: 4, desc: 'JS 없이도 LLM이 콘텐츠를 읽을 수 있는지 (SSR 여부)' },
    'SD-01': { name: 'title 태그', max: 4, desc: '페이지별 고유한 title로 LLM이 내용을 식별 가능한지' },
    'SD-02': { name: 'meta description', max: 4, desc: 'LLM이 페이지 요약을 파악할 수 있는지' },
    'SD-03': { name: 'Open Graph 태그', max: 4, desc: 'og:title, og:description 등 구조화된 메타 정보' },
    'SD-04': { name: 'schema.org 데이터', max: 5, desc: 'JSON-LD 등 구조화된 데이터로 LLM 이해도 향상' },
    'SD-05': { name: '언어 속성', max: 3, desc: 'html lang="ko" — LLM이 언어를 정확히 인식' },
    'TA-01': { name: 'HTTPS 적용', max: 3, desc: '보안 연결로 접근 가능한지' },
    'TA-02': { name: '응답 속도 (TTFB)', max: 4, desc: '크롤러가 타임아웃 없이 응답을 받을 수 있는지' },
    'TA-03': { name: 'HTTP 상태코드', max: 4, desc: '주요 페이지가 정상(200) 응답하는지' },
    'TA-04': { name: '모바일 대응', max: 4, desc: 'viewport 설정 및 반응형 여부' },
    'LT-01': { name: 'llms.txt 존재', max: 4, desc: 'LLM 전용 안내 파일이 존재하는지' },
    'LT-02': { name: 'llms.txt 문법', max: 3, desc: 'llms.txt 스펙을 준수하는지' },
    'LT-03': { name: 'llms.txt 충실도', max: 3, desc: '기관 설명 + 핵심 콘텐츠 경로를 안내하는지' },
    'SM-01': { name: 'sitemap.xml 존재', max: 2, desc: 'LLM이 콘텐츠를 발견할 수 있도록 sitemap이 있는지' },
    'SM-02': { name: 'sitemap 콘텐츠 포함', max: 3, desc: '보도자료·정책·공지 URL이 sitemap에 포함되어 있는지' }
  };

  // Data loading
  let _history = null;
  async function loadHistory() {
    if (_history) return _history;
    try {
      const res = await fetch('data/history.json');
      if (!res.ok) return null;
      _history = await res.json();
      return _history;
    } catch (err) { return null; }
  }
  async function loadData() {
    if (_data) return _data;
    try {
      const res = await fetch('data/results.json');
      if (!res.ok) throw new Error('Failed to load data');
      _data = await res.json();
      return _data;
    } catch (err) {
      console.error('Data load error:', err);
      return null;
    }
  }

  // Grade helpers
  function getGradeInfo(grade) {
    return GRADES[grade] || GRADES['F'];
  }

  function gradeFromScore(score) {
    for (const [grade, info] of Object.entries(GRADES)) {
      if (score >= info.min) return grade;
    }
    return 'F';
  }

  function getGradeColor(grade) {
    return getGradeInfo(grade).color;
  }

  function getGradeClass(grade) {
    return getGradeInfo(grade).cls;
  }

  // HTML escaping — used for all dynamic text content
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Safe DOM helpers ---

  function createElement(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') el.className = v;
        else if (k === 'textContent') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      }
    }
    if (typeof children === 'string') {
      el.textContent = children;
    } else if (Array.isArray(children)) {
      children.forEach(c => { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    } else if (children instanceof Node) {
      el.appendChild(children);
    }
    return el;
  }

  // --- Template rendering (trusted data only) ---
  // These functions build HTML strings from our own JSON data.
  // All text values are escaped before interpolation.

  function gradeBadgeHtml(grade, sizeClass) {
    const info = getGradeInfo(grade);
    const sc = sizeClass ? ' ' + sizeClass : '';
    return '<span class="grade-badge' + sc + ' ' + info.cls + '">' + escapeHtml(grade) + '</span>';
  }

  function severityBadgeHtml(severity) {
    const label = SEVERITY_LABELS[severity] || escapeHtml(severity);
    return '<span class="severity-badge severity-' + escapeHtml(severity) + '">' + escapeHtml(label) + '</span>';
  }

  function miniBarHtml(score, max, grade) {
    const pct = Math.round((score / max) * 100);
    const g = grade || gradeFromScore(pct);
    return '<div class="mini-bar"><div class="mini-bar-fill" style="width:' + pct + '%;background:' + getGradeColor(g) + '"></div></div>';
  }

  function issueChipsHtml(org) {
    const counts = { critical: 0, major: 0, minor: 0, info: 0 };
    (org.issues || []).forEach(i => { counts[i.severity] = (counts[i.severity] || 0) + 1; });
    let html = '<div class="issue-chips">';
    if (counts.critical) html += '<span class="issue-chip severity-critical">' + counts.critical + '</span>';
    if (counts.major) html += '<span class="issue-chip severity-major">' + counts.major + '</span>';
    if (counts.minor) html += '<span class="issue-chip severity-minor">' + counts.minor + '</span>';
    if (counts.info) html += '<span class="issue-chip severity-info">' + counts.info + '</span>';
    html += '</div>';
    return html;
  }

  // Org type label
  function orgTypeLabel(type) {
    return ORG_TYPES[type] || escapeHtml(type);
  }

  // Crawler status
  function crawlerStatusDot(status) {
    const map = { allowed: 'allowed', partial_allow: 'partial', blocked: 'blocked', not_mentioned: 'unknown' };
    return map[status] || 'unknown';
  }

  function crawlerStatusLabel(status) {
    const map = { allowed: '허용', partial_allow: '부분 허용', blocked: '차단', not_mentioned: '미언급' };
    return map[status] || escapeHtml(status);
  }

  // Stats calculations
  function calcStats(orgs) {
    if (!orgs || !orgs.length) return {};
    const scores = orgs.map(o => o.scores.total);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const grades = {};
    orgs.forEach(o => {
      const g = o.scores.grade;
      grades[g] = (grades[g] || 0) + 1;
    });
    const totalIssues = orgs.reduce((sum, o) => sum + (o.issues || []).length, 0);
    const criticals = orgs.reduce((sum, o) =>
      sum + (o.issues || []).filter(i => i.severity === 'critical').length, 0);
    return { avg: Math.round(avg * 10) / 10, grades, totalIssues, criticals, count: orgs.length };
  }

  // Ministry grouping: aggregate orgs by parent ministry
  // 중앙행정기관은 parent_org_id로, 공공기관은 ministry 필드로 그룹핑
  function groupByMinistry(orgs) {
    const groups = {};
    const orgById = {};
    orgs.forEach(o => { orgById[o.org_id] = o; });

    // 먼저 부/처 (최상위 기관)를 등록
    orgs.forEach(o => {
      if (o.org_type === 'ministry' || o.org_type === 'pm_office') {
        if (!groups[o.org_id]) {
          groups[o.org_id] = {
            ministry_id: o.org_id,
            name: o.name,
            name_en: o.name_en || '',
            children: [],
            totalScore: 0
          };
        }
      }
    });

    // 각 기관을 그룹에 배치
    orgs.forEach(o => {
      let groupKey = null;

      // 1. parent_org_id가 있으면 그것 사용 (청 등)
      if (o.parent_org_id && groups[o.parent_org_id]) {
        groupKey = o.parent_org_id;
      }
      // 2. 본인이 최상위 기관이면 자기 자신
      else if (groups[o.org_id]) {
        groupKey = o.org_id;
      }
      // 3. 공공기관: ministry 필드로 매칭 시도
      else if (o.ministry) {
        for (const [id, g] of Object.entries(groups)) {
          if (g.name === o.ministry) { groupKey = id; break; }
        }
        // 매칭 안 되면 ministry 이름으로 새 그룹
        if (!groupKey) {
          groupKey = 'ext_' + o.ministry;
          if (!groups[groupKey]) {
            groups[groupKey] = {
              ministry_id: groupKey,
              name: o.ministry,
              name_en: '',
              children: [],
              totalScore: 0
            };
          }
        }
      }
      // 4. 지자체 등은 자기 자신
      else {
        groupKey = o.org_id;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            ministry_id: groupKey,
            name: o.name,
            name_en: o.name_en || '',
            children: [],
            totalScore: 0
          };
        }
      }

      if (groupKey && groups[groupKey]) {
        groups[groupKey].children.push(o);
        groups[groupKey].totalScore += o.scores.total;
      }
    });

    // 빈 그룹 제거 + 평균 계산
    const result = Object.values(groups).filter(m => m.children.length > 0);
    result.forEach(m => {
      m.avgScore = Math.round(m.totalScore / m.children.length * 10) / 10;
      m.grade = gradeFromScore(m.avgScore);
    });
    return result.sort((a, b) => b.avgScore - a.avgScore);
  }

  // Build navigation DOM
  function buildNav(activePage) {
    const pages = [
      { id: 'index', label: '홈', href: 'index.html' },
      { id: 'ranking', label: '순위표', href: 'ranking.html' },
      { id: 'stats', label: '통계', href: 'stats.html' },
      { id: 'updates', label: '업데이트', href: 'updates.html' },
      { id: 'about', label: '소개', href: 'about.html' },
      { id: 'meta', label: 'robots.txt', href: 'robots.txt' },
      { id: 'meta2', label: 'llms.txt', href: 'llms.txt' }
    ];

    const nav = createElement('nav', { className: 'nav' });
    const inner = createElement('div', { className: 'nav-inner' });

    const logo = createElement('a', { href: 'index.html', className: 'nav-logo' });
    const seal = createElement('span', { className: 'seal' });
    seal.textContent = 'AWO?';
    logo.appendChild(seal);
    logo.appendChild(document.createTextNode(' Are We Open?'));

    const ul = createElement('ul', { className: 'nav-links', id: 'navLinks' });
    pages.forEach(p => {
      const li = createElement('li');
      const a = createElement('a', { href: p.href, className: p.id === activePage ? 'active' : '' }, p.label);
      li.appendChild(a);
      ul.appendChild(li);
    });

    const toggle = createElement('button', {
      className: 'nav-toggle',
      'aria-label': '메뉴',
      onClick: () => document.getElementById('navLinks').classList.toggle('open')
    });
    for (let i = 0; i < 3; i++) toggle.appendChild(createElement('span'));

    inner.appendChild(logo);
    inner.appendChild(ul);
    inner.appendChild(toggle);
    nav.appendChild(inner);
    return nav;
  }

  // Build footer - static content, safe to use template string
  function getFooterHtml() {
    return '<footer class="footer"><div class="footer-inner"><div>'
      + '<div class="footer-brand">Are We Open?</div>'
      + '<p class="footer-desc">대한민국 공공 웹사이트의 데이터 개방 수준을 평가합니다. 보도자료·정책소개·공지사항이 누구에게나 열려 있는지 측정합니다.</p>'
      + '</div><div><h4>페이지</h4><ul class="footer-links">'
      + '<li><a href="index.html">홈</a></li>'
      + '<li><a href="ranking.html">순위표</a></li>'
      + '<li><a href="stats.html">통계</a></li>'
      + '<li><a href="updates.html">업데이트 이력</a></li>'
      + '<li><a href="about.html">소개</a></li>'
      + '</ul></div><div><h4>데이터</h4><ul class="footer-links">'
      + '<li><a href="data/results.json">결과 JSON</a></li>'
      + '<li><a href="data/summary_scores.csv">점수 CSV</a></li>'
      + '<li><a href="robots.txt">robots.txt</a></li>'
      + '<li><a href="llms.txt">llms.txt</a></li>'
      + '<li><a href="https://github.com/ffee21/are-we-open" target="_blank" rel="noopener">GitHub</a></li>'
      + '</ul></div><div class="footer-bottom">'
      + '<span>본 웹사이트는 개인 프로젝트로 운영되며, 정부 공식 입장과 무관합니다.</span>'
      + '<span>2025 Are We Open?</span>'
      + '</div></div></footer>';
  }

  // Copy to clipboard
  function copyToClipboard(text, btnEl) {
    navigator.clipboard.writeText(text).then(() => {
      btnEl.classList.add('copied');
      btnEl.textContent = '\u2713 복사 완료';
      setTimeout(() => {
        btnEl.classList.remove('copied');
        btnEl.textContent = '\u2398 복사하기';
      }, 2000);
    });
  }

  // URL params
  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  // Init page
  function initPage(activePage, callback) {
    document.addEventListener('DOMContentLoaded', async () => {
      // Insert nav
      const navPlaceholder = document.getElementById('nav');
      if (navPlaceholder) {
        navPlaceholder.replaceWith(buildNav(activePage));
      }

      // Insert footer (static content only)
      const footerPlaceholder = document.getElementById('footer');
      if (footerPlaceholder) {
        const temp = document.createElement('div');
        temp.innerHTML = getFooterHtml(); // Safe: contains only hardcoded HTML
        footerPlaceholder.replaceWith(temp.firstElementChild);
      }

      // Load data and run callback
      const data = await loadData();
      if (data && callback) callback(data);
    });
  }

  return {
    loadData, loadHistory, getGradeInfo, gradeFromScore, getGradeColor, getGradeClass,
    gradeBadgeHtml, severityBadgeHtml, miniBarHtml, issueChipsHtml, orgTypeLabel,
    crawlerStatusDot, crawlerStatusLabel, calcStats, groupByMinistry,
    escapeHtml, copyToClipboard, getParam, initPage, createElement,
    GRADES, CATEGORIES, ORG_TYPES, SEVERITY_LABELS, ITEM_DESCRIPTIONS
  };
})();
