/* ══════════════════════════════════════════════
   git-manager.js — نظام Git احترافي
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.GitManager = (function () {

  const STORE_KEY = 'galaoum_git_v1';
  let _repo = null; /* { name, branch, commits[], remoteUrl, token } */

  function _load() {
    try { _repo = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { _repo = null; }
  }

  function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(_repo)); } catch {}
  }

  /* ── تهيئة مستودع محلي ── */
  function init_repo(name) {
    _repo = {
      name: name || 'my-project',
      branch: 'main',
      commits: [],
      staged: [],
      remoteUrl: null,
      token: null
    };
    _save();
    _log(`git init: تم إنشاء مستودع "${_repo.name}"`);
    return _repo;
  }

  /* ── Commit ── */
  function commit(message, files) {
    if (!_repo) init_repo('project');
    const c = {
      id:      _shortId(),
      message: message || 'تحديث',
      files:   files || [],
      date:    new Date().toISOString(),
      branch:  _repo.branch
    };
    _repo.commits.unshift(c);
    _repo.staged = [];
    _save();
    _log(`git commit: ${c.id} "${message}"`);
    return c;
  }

  /* ── Branch ── */
  function createBranch(name) {
    if (!_repo) init_repo('project');
    _log(`git branch: إنشاء "${name}" من "${_repo.branch}"`);
    return name;
  }

  function checkout(branch) {
    if (!_repo) return;
    _repo.branch = branch;
    _save();
    _log(`git checkout: انتقل إلى "${branch}"`);
  }

  /* ── تاريخ ── */
  function log(n) {
    if (!_repo) return [];
    return (_repo.commits || []).slice(0, n || 10);
  }

  /* ── Diff نصي ── */
  function diff(fileA, fileB) {
    if (!fileA || !fileB) return '(لا توجد تعديلات)';
    const linesA = fileA.split('\n');
    const linesB = fileB.split('\n');
    const result = [];
    const maxL = Math.max(linesA.length, linesB.length);
    for (let i = 0; i < maxL; i++) {
      const a = linesA[i] ?? '';
      const b = linesB[i] ?? '';
      if (a !== b) {
        if (a) result.push(`- ${a}`);
        if (b) result.push(`+ ${b}`);
      }
    }
    return result.length ? result.join('\n') : '(لا توجد فروق)';
  }

  /* ── GitHub API — Clone (جلب ملفات) ── */
  async function clone(repoUrl, ghToken) {
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) throw new Error('رابط GitHub غير صحيح');
    const [, owner, repo] = match;

    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (ghToken) headers['Authorization'] = `token ${ghToken}`;

    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
    if (!r.ok) throw new Error(`GitHub API: ${r.status}`);

    const items = await r.json();
    init_repo(repo);
    if (ghToken) {
      _repo.token = ghToken;
      if (typeof Security !== 'undefined') Security.storeKey('github_token', ghToken);
    }
    _repo.remoteUrl = repoUrl;
    _repo.owner = owner;
    _repo.repoName = repo;
    _save();
    _log(`git clone: ${owner}/${repo} — ${items.length} ملف`);
    return items;
  }

  /* ── GitHub API — Pull (جلب محتوى ملف) ── */
  async function pull(filePath) {
    if (!_repo?.owner) throw new Error('لا يوجد مستودع بُعيد');
    const token = _repo.token || (typeof Security !== 'undefined' ? Security.getKey('github_token') : null);
    const headers = { 'Accept': 'application/vnd.github.v3.raw' };
    if (token) headers['Authorization'] = `token ${token}`;
    const r = await fetch(
      `https://api.github.com/repos/${_repo.owner}/${_repo.repoName}/contents/${filePath}`,
      { headers }
    );
    if (!r.ok) throw new Error(`Pull فشل: ${r.status}`);
    const data = await r.json();
    return atob(data.content || '');
  }

  /* ── GitHub API — Push (تحديث ملف) ── */
  async function push(filePath, content, message) {
    if (!_repo?.owner) throw new Error('لا يوجد مستودع بُعيد');
    const token = _repo.token || (typeof Security !== 'undefined' ? Security.getKey('github_token') : null);
    if (!token) throw new Error('مطلوب GitHub token للـ push');

    const headers = { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' };

    /* الحصول على SHA الملف الحالي */
    let sha = null;
    try {
      const r = await fetch(
        `https://api.github.com/repos/${_repo.owner}/${_repo.repoName}/contents/${filePath}`,
        { headers }
      );
      if (r.ok) { const d = await r.json(); sha = d.sha; }
    } catch {}

    const body = {
      message: message || `تحديث ${filePath}`,
      content: btoa(unescape(encodeURIComponent(content))),
      branch:  _repo.branch || 'main'
    };
    if (sha) body.sha = sha;

    const r2 = await fetch(
      `https://api.github.com/repos/${_repo.owner}/${_repo.repoName}/contents/${filePath}`,
      { method: 'PUT', headers, body: JSON.stringify(body) }
    );
    if (!r2.ok) throw new Error(`Push فشل: ${r2.status}`);
    commit(message, [filePath]);
    _log(`git push: ${filePath} → ${_repo.owner}/${_repo.repoName}`);
    return true;
  }

  /* ── تشغيل أمر نصي (من Terminal) ── */
  function runCommand(args) {
    const sub = args[0];
    const rest = args.slice(1);
    switch (sub) {
      case 'init':    init_repo(rest[0]); return `✅ تهيئة مستودع: ${_repo?.name}`;
      case 'status':  return _statusText();
      case 'log':     return _logText();
      case 'branch':  return _branchText(rest[0]);
      case 'checkout':checkout(rest[0]); return `✅ انتقل إلى: ${rest[0]}`;
      case 'commit':  const msg = rest.join(' ').replace(/^-m\s?/, ''); commit(msg, []); return `✅ Commit: "${msg}"`;
      case 'diff':    return diff(rest[0], rest[1]);
      case 'restore': return `♻️ Restore ${rest[0] || '.'} (وضع المحاكاة)`;
      default:        return `git ${args.join(' ')}\n(وضع المحاكاة)`;
    }
  }

  function _statusText() {
    if (!_repo) return 'لم يتم تهيئة مستودع';
    return `🔵 الفرع: ${_repo.branch}\nآخر commit: ${_repo.commits[0]?.message || 'لا يوجد'}\nعدد الـ Commits: ${_repo.commits.length}`;
  }

  function _logText() {
    if (!_repo || !_repo.commits.length) return 'لا توجد commits';
    return _repo.commits.slice(0, 5).map(c =>
      `${c.id}  ${c.date?.slice(0,10)}  ${c.message}`
    ).join('\n');
  }

  function _branchText(newBranch) {
    if (!_repo) return 'لم يتم تهيئة مستودع';
    if (newBranch) { createBranch(newBranch); return `✅ إنشاء فرع: ${newBranch}`; }
    return `* ${_repo.branch}\n  main\n  develop`;
  }

  function _shortId() {
    return Math.random().toString(36).slice(2, 9);
  }

  function _log(msg) {
    if (typeof Logger !== 'undefined') Logger.info('GIT', msg);
  }

  /* ── فتح لوحة Git ── */
  function openPanel() {
    const p = document.getElementById('git-panel');
    if (p) { p.style.display = 'flex'; _renderPanel(); }
  }

  function closePanel() {
    const p = document.getElementById('git-panel');
    if (p) p.style.display = 'none';
  }

  function _renderPanel() {
    const info = document.getElementById('git-info');
    if (!info) return;
    if (!_repo) { info.innerHTML = '<div style="color:#64748b;padding:12px">لم يُهيَّأ مستودع بعد. اكتب اسم المستودع وانقر "تهيئة".</div>'; return; }
    info.innerHTML = `
      <div class="git-stat-row"><span>📁 المستودع</span><strong>${_repo.name}</strong></div>
      <div class="git-stat-row"><span>🌿 الفرع</span><strong>${_repo.branch}</strong></div>
      <div class="git-stat-row"><span>📝 Commits</span><strong>${_repo.commits.length}</strong></div>
      <div class="git-stat-row"><span>🔗 Remote</span><strong style="font-size:10px">${_repo.remoteUrl || 'غير مضبوط'}</strong></div>
      <div style="margin-top:10px;font-size:11px;color:#94a3b8">سجل الـ Commits:</div>
      <div style="font-family:monospace;font-size:10px;color:#64748b;margin-top:4px">
        ${_repo.commits.slice(0,5).map(c=>`<div>${c.id} — ${c.message}</div>`).join('') || '<div>لا يوجد</div>'}
      </div>
    `;
  }

  /* ── التهيئة ── */
  function init() {
    _load();
    if (typeof Logger !== 'undefined') Logger.info('GIT', '🔀 Git Manager جاهز');
  }

  return { init, init_repo, commit, createBranch, checkout, log, diff, clone, pull, push, runCommand, openPanel, closePanel };

})();
