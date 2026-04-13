 const LANG_COLORS = {
    JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
    'C++': '#f34b7d', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
    PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', HTML: '#e34c26', CSS: '#563d7c',
    Shell: '#89e051', Dart: '#00B4AB', Vue: '#41b883', Scala: '#c22d40', R: '#198CE7',
    Jupyter: '#DA5B0B', C: '#555555', Elixir: '#6e4a7e', Haskell: '#5e5086',
    default: '#6366f1'
  };
  const gc = l => LANG_COLORS[l] || LANG_COLORS.default;

  // GitHub API — uses allorigins proxy as fallback for environments with CORS issues
  async function ghFetch(path) {
    // Try direct first (works when served normally / GitHub Pages)
    try {
      const r = await fetch('https://api.github.com' + path, {
        headers: { 'Accept': 'application/vnd.github+json' }
      });
      if (r.ok) return await r.json();
      const err = await r.json();
      throw new Error(err.message === 'Not Found' ? 'User not found on GitHub.' : (err.message || 'GitHub API error.'));
    } catch (e) {
      if (e.message.includes('not found') || e.message.includes('API error')) throw e;
      // Fallback: CORS proxy
      const proxy = 'https://api.allorigins.win/get?url=';
      const r2 = await fetch(proxy + encodeURIComponent('https://api.github.com' + path));
      if (!r2.ok) throw new Error('Network error. Check your connection.');
      const d = await r2.json();
      const parsed = JSON.parse(d.contents);
      if (parsed.message) throw new Error(parsed.message === 'Not Found' ? 'User not found on GitHub.' : parsed.message);
      return parsed;
    }
  }

  async function analyze() {
    const username = document.getElementById('username-input').value.trim();
    if (!username) return;

    setError('');
    document.getElementById('analyze-btn').disabled = true;
    showView('loader');
    setLoader('Fetching profile…');

    try {
      const user = await ghFetch('/users/' + encodeURIComponent(username));
      setLoader('Loading repositories…');
      let repos = [];
      try { repos = await ghFetch('/users/' + encodeURIComponent(username) + '/repos?per_page=100&sort=pushed'); } catch (_) {}
      setLoader('Crunching numbers…');
      renderAll(user, repos);
      showView('results');
    } catch (err) {
      showView('landing');
      setError(err.message || 'Something went wrong. Please try again.');
      document.getElementById('analyze-btn').disabled = false;
    }
  }

  function renderAll(u, repos) {
    renderProfile(u);
    const langMap = buildLangMap(repos);
    renderStats(u, repos, langMap);
    renderLangBars(langMap);
    renderInsights(u, repos, langMap);
    renderRepos(repos);
  }

  function renderProfile(u) {
    document.getElementById('profile-card').innerHTML = `
      <img class="avatar" src="${u.avatar_url}" alt="${u.login}" />
      <div class="profile-info">
        <div class="profile-name">${u.name || u.login}</div>
        <div class="profile-login">@${u.login}</div>
        ${u.bio ? `<div class="profile-bio">${u.bio}</div>` : ''}
        <div class="profile-meta">
          ${u.location ? `<span class="meta-item">📍 <strong>${u.location}</strong></span>` : ''}
          <span class="meta-item">👥 <strong>${u.followers.toLocaleString()}</strong> followers</span>
          <span class="meta-item">👤 <strong>${u.following}</strong> following</span>
          ${u.company ? `<span class="meta-item">🏢 <strong>${u.company}</strong></span>` : ''}
          ${u.blog ? `<span class="meta-item">🔗 <a href="${u.blog.startsWith('http') ? u.blog : 'https://' + u.blog}" target="_blank" rel="noopener" style="color:#a5b4fc;text-decoration:none">${u.blog.replace(/^https?:\/\//, '')}</a></span>` : ''}
        </div>
      </div>
      <a class="gh-link" href="https://github.com/${u.login}" target="_blank" rel="noopener">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        View on GitHub
      </a>`;
  }

  function buildLangMap(repos) {
    const counts = {};
    repos.forEach(r => { if (r.language) counts[r.language] = (counts[r.language] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }

  function renderStats(u, repos, langMap) {
    const stars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const topLang = langMap.length ? langMap[0][0] : 'N/A';
    const forked = repos.filter(r => r.fork).length;
    document.getElementById('stat-grid').innerHTML = `
      <div class="stat-cell"><div class="stat-val">${u.public_repos}</div><div class="stat-lbl">Repositories</div></div>
      <div class="stat-cell"><div class="stat-val">${stars.toLocaleString()}</div><div class="stat-lbl">Total stars</div></div>
      <div class="stat-cell"><div class="stat-val">${u.followers.toLocaleString()}</div><div class="stat-lbl">Followers</div></div>
      <div class="stat-cell"><div class="stat-val" style="font-size:1rem;padding-top:4px">${topLang}</div><div class="stat-lbl">Top language</div></div>`;
  }

  function renderLangBars(langMap) {
    if (!langMap.length) {
      document.getElementById('lang-bars').innerHTML = '<p style="font-size:13px;color:#8892a4">No language data available.</p>';
      return;
    }
    const max = langMap[0][1];
    const total = langMap.reduce((s, l) => s + l[1], 0);
    document.getElementById('lang-bars').innerHTML = langMap.map(([lang, cnt]) => `
      <div class="lang-row">
        <span class="lang-name">${lang}</span>
        <div class="lang-track"><div class="lang-fill" style="width:0%;background:${gc(lang)}" data-w="${Math.round(cnt / max * 100)}"></div></div>
        <span class="lang-pct">${Math.round(cnt / total * 100)}%</span>
      </div>`).join('');
    setTimeout(() => {
      document.querySelectorAll('.lang-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
    }, 100);
  }

  function renderInsights(u, repos, langMap) {
    const insights = [];
    const own = repos.filter(r => !r.fork);
    const stars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const avgStars = own.length ? (stars / own.length).toFixed(1) : 0;
    const recent = repos.filter(r => r.pushed_at && (Date.now() - new Date(r.pushed_at).getTime()) < 90 * 86400000);
    const noDesc = own.filter(r => !r.description);
    const memberSince = u.created_at ? new Date(u.created_at).getFullYear() : null;

    if (langMap.length >= 5)
      insights.push({ i: '🌐', b: 'rgba(99,102,241,0.12)', t: `<strong>Polyglot developer</strong> — Active across ${langMap.length} languages. This breadth signals strong adaptability and curiosity.` });
    else if (langMap.length >= 3)
      insights.push({ i: '🔧', b: 'rgba(99,102,241,0.12)', t: `<strong>Multi-language developer</strong> — Comfortable in ${langMap.length} languages. Consider exploring adjacent ecosystems to broaden impact.` });
    else if (langMap.length === 2)
      insights.push({ i: '🎯', b: 'rgba(99,102,241,0.12)', t: `<strong>Focused stack</strong> — Working primarily in ${langMap.map(l => l[0]).join(' and ')}. Deepening expertise here is a solid strategy.` });
    else if (langMap.length === 1)
      insights.push({ i: '💎', b: 'rgba(99,102,241,0.12)', t: `<strong>Specialist</strong> — Deep expertise in ${langMap[0][0]}. Mastery in one area is powerful — branching out could unlock new opportunities.` });

    if (recent.length >= 8)
      insights.push({ i: '⚡', b: 'rgba(16,185,129,0.08)', t: `<strong>Highly active</strong> — ${recent.length} repos pushed in the last 90 days. Consistent activity makes your profile stand out.` });
    else if (recent.length >= 3)
      insights.push({ i: '📅', b: 'rgba(245,158,11,0.08)', t: `<strong>Moderately active</strong> — ${recent.length} recent pushes detected. Regular contributions boost community visibility significantly.` });
    else
      insights.push({ i: '💤', b: 'rgba(245,158,11,0.08)', t: `<strong>Low recent activity</strong> — No major recent pushes found. Even small commits keep your profile fresh and discoverable.` });

    if (parseFloat(avgStars) > 10)
      insights.push({ i: '⭐', b: 'rgba(251,191,36,0.08)', t: `<strong>${avgStars} avg stars per repo</strong> — Your projects genuinely resonate. Keep building things that solve real problems.` });
    else if (parseFloat(avgStars) > 2)
      insights.push({ i: '✨', b: 'rgba(251,191,36,0.08)', t: `<strong>Growing traction</strong> — Averaging ${avgStars} stars per repo. Promoting your work more actively could accelerate this.` });

    if (own.length > 0 && noDesc.length / own.length > 0.5)
      insights.push({ i: '📝', b: 'rgba(239,68,68,0.08)', t: `<strong>Add repo descriptions</strong> — ${noDesc.length} of your repos have no description. A single sentence dramatically improves discoverability.` });

    if (u.followers > 100)
      insights.push({ i: '🚀', b: 'rgba(16,185,129,0.08)', t: `<strong>Community presence</strong> — ${u.followers.toLocaleString()} followers is impressive. Writing articles or tutorials could multiply this further.` });

    if (memberSince && memberSince <= 2016)
      insights.push({ i: '🏅', b: 'rgba(99,102,241,0.1)', t: `<strong>GitHub veteran</strong> — Member since ${memberSince}. Long-term open source presence is a strong trust signal.` });

    document.getElementById('insights-list').innerHTML = insights.slice(0, 3).map(ins => `
      <div class="insight-row">
        <div class="insight-icon" style="background:${ins.b}">${ins.i}</div>
        <div class="insight-text">${ins.t}</div>
      </div>`).join('');
  }

  function renderRepos(repos) {
    const shown = repos.filter(r => !r.fork).slice(0, 6);
    document.getElementById('repo-list').innerHTML = shown.length
      ? shown.map(r => `
        <li class="repo-item">
          <div style="min-width:0">
            <a class="repo-name" href="${r.html_url}" target="_blank" rel="noopener">${r.name}</a>
            ${r.description ? `<div class="repo-desc">${r.description.slice(0, 90)}${r.description.length > 90 ? '…' : ''}</div>` : ''}
          </div>
          <div class="repo-meta">
            ${r.language ? `<div style="display:flex;align-items:center;gap:5px"><div class="lang-dot" style="background:${gc(r.language)}"></div><span class="lang-txt">${r.language}</span></div>` : ''}
            <div class="repo-stars">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.55"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ${r.stargazers_count.toLocaleString()}
            </div>
          </div>
        </li>`).join('')
      : '<li style="padding:1.2rem 1.6rem;color:#8892a4;font-size:13px">No original repositories found.</li>';
  }

  function showView(name) {
    document.getElementById('landing-view').style.display = name === 'landing' ? 'flex' : 'none';
    document.getElementById('loader-view').style.display = name === 'loader' ? 'flex' : 'none';
    document.getElementById('results-view').style.display = name === 'results' ? 'block' : 'none';
  }

  function setLoader(msg) { document.getElementById('loader-text').textContent = msg; }
  function setError(msg) {
    const el = document.getElementById('error-msg');
    el.style.display = msg ? 'flex' : 'none';
    document.getElementById('error-text').textContent = msg;
  }

  function goBack() {
    showView('landing');
    document.getElementById('analyze-btn').disabled = false;
    document.getElementById('username-input').value = '';
    setError('');
  }

  document.getElementById('username-input').addEventListener('keydown', e => { if (e.key === 'Enter') analyze(); });
