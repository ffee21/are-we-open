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
    'A+': { min: 90, color: 'var(--grade-aplus)', cls: 'grade-aplus', label: 'LLM 매우 친화적' },
    'A':  { min: 80, color: 'var(--grade-a)',     cls: 'grade-a',     label: 'LLM 친화적' },
    'B+': { min: 70, color: 'var(--grade-bplus)',  cls: 'grade-bplus', label: '양호' },
    'B':  { min: 60, color: 'var(--grade-b)',      cls: 'grade-b',     label: '보통' },
    'C':  { min: 40, color: 'var(--grade-c)',      cls: 'grade-c',     label: '미흡' },
    'D':  { min: 20, color: 'var(--grade-d)',      cls: 'grade-d',     label: '매우 미흡' },
    'F':  { min: 0,  color: 'var(--grade-f)',       cls: 'grade-f',     label: 'LLM 접근 불가' }
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
    central_ministry:   '중앙부처',
    agency:             '청/위원회',
    public_institution: '공공기관',
    local_government:   '지자체',
    affiliated:         '산하기관'
  };

  const SEVERITY_LABELS = {
    critical: 'Critical',
    major: 'Major',
    minor: 'Minor',
    info: 'Info'
  };

  // Data loading
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

  // Build navigation DOM
  function buildNav(activePage) {
    const pages = [
      { id: 'index', label: '홈', href: 'index.html' },
      { id: 'ranking', label: '순위표', href: 'ranking.html' },
      { id: 'stats', label: '통계', href: 'stats.html' },
      { id: 'updates', label: '업데이트', href: 'updates.html' },
      { id: 'about', label: '소개', href: 'about.html' }
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
      + '<p class="footer-desc">대한민국 공공 웹사이트의 LLM 친화성을 평가하고, AI 시대에 맞는 공공정보 접근성 개선을 위한 프로젝트입니다.</p>'
      + '</div><div><h4>페이지</h4><ul class="footer-links">'
      + '<li><a href="index.html">홈</a></li>'
      + '<li><a href="ranking.html">순위표</a></li>'
      + '<li><a href="stats.html">통계</a></li>'
      + '<li><a href="updates.html">업데이트 이력</a></li>'
      + '<li><a href="about.html">소개</a></li>'
      + '</ul></div><div><h4>데이터</h4><ul class="footer-links">'
      + '<li><a href="data/results.json">결과 JSON</a></li>'
      + '<li><a href="data/summary_scores.csv">점수 CSV</a></li>'
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
    loadData, getGradeInfo, gradeFromScore, getGradeColor, getGradeClass,
    gradeBadgeHtml, severityBadgeHtml, miniBarHtml, issueChipsHtml, orgTypeLabel,
    crawlerStatusDot, crawlerStatusLabel, calcStats,
    escapeHtml, copyToClipboard, getParam, initPage, createElement,
    GRADES, CATEGORIES, ORG_TYPES, SEVERITY_LABELS
  };
})();
