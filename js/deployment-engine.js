/* ══════════════════════════════════════════════
   deployment-engine.js — محرك النشر الاحترافي
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.DeploymentEngine = (function () {

  const STORAGE_KEY = 'galaoum_deployments_v1';
  let _deployments = [];

  /* ── تحميل السجل من localStorage ── */
  function _load() {
    try { _deployments = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { _deployments = []; }
  }

  function _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_deployments.slice(-50))); }
    catch {}
  }

  /* ── اكتشاف نوع المشروع ── */
  function detectProjectType(files) {
    const names = Object.keys(files || {});
    if (names.includes('package.json')) {
      const pkg = JSON.parse(files['package.json'] || '{}');
      if (pkg.dependencies?.react || pkg.devDependencies?.react) return 'react';
      if (pkg.dependencies?.vue   || pkg.devDependencies?.vue)   return 'vue';
      if (pkg.dependencies?.next  || pkg.devDependencies?.next)  return 'nextjs';
      return 'node';
    }
    if (names.some(n => n.endsWith('.py')))     return 'python';
    if (names.some(n => n.endsWith('.dart')))   return 'flutter';
    if (names.includes('index.html'))           return 'static';
    return 'unknown';
  }

  /* ── تحليل المشروع قبل النشر ── */
  async function analyzeBeforeDeploy(files) {
    const type = detectProjectType(files);
    const fileList = Object.keys(files || {});
    const issues = [];

    if (fileList.length === 0) issues.push({ level: 'error', msg: 'لا توجد ملفات للنشر' });
    if (type === 'unknown') issues.push({ level: 'warn', msg: 'نوع المشروع غير معروف' });

    const hasIndex = fileList.some(f => f === 'index.html' || f.endsWith('/index.html'));
    if (type === 'static' && !hasIndex) issues.push({ level: 'error', msg: 'ملف index.html مفقود' });

    /* فحص أمني */
    for (const [name, content] of Object.entries(files || {})) {
      if (typeof content === 'string' && /sk-[a-zA-Z0-9]{20,}/.test(content)) {
        issues.push({ level: 'warn', msg: `مفتاح API مكشوف في: ${name}` });
      }
    }

    return { type, fileCount: fileList.length, issues };
  }

  /* ── نشر على Netlify ── */
  async function deployToNetlify(files, deployName) {
    const token   = typeof Security !== 'undefined' ? Security.getKey('netlify_token') : null;
    const siteId  = typeof Security !== 'undefined' ? Security.getKey('netlify_site')  : null;

    if (!token || !siteId) throw new Error('مفاتيح Netlify غير مضبوطة');

    /* بناء قائمة الملفات */
    const fileDigests = {};
    const fileContents = {};

    for (const [path, content] of Object.entries(files || {})) {
      if (typeof content !== 'string') continue;
      const hash = await _sha1(content);
      fileDigests['/' + path.replace(/^\//, '')] = hash;
      fileContents[hash] = content;
    }

    /* طلب نشر جديد */
    const deployResp = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ files: fileDigests, title: deployName || 'Galaoum Deploy' })
      }
    );

    if (!deployResp.ok) {
      const err = await deployResp.json().catch(() => ({}));
      throw new Error(err.message || `Netlify error ${deployResp.status}`);
    }

    const deploy = await deployResp.json();

    /* رفع الملفات المطلوبة */
    const required = deploy.required || [];
    for (const hash of required) {
      const content = fileContents[hash];
      if (!content) continue;
      await fetch(
        `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${hash}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Authorization': `Bearer ${token}`
          },
          body: content
        }
      );
    }

    return {
      id:      deploy.id,
      url:     deploy.deploy_ssl_url || deploy.deploy_url || '',
      state:   deploy.state,
      created: new Date().toISOString()
    };
  }

  /* ── الحصول على قائمة النشر الحالية ── */
  async function listDeployments() {
    const token  = typeof Security !== 'undefined' ? Security.getKey('netlify_token') : null;
    const siteId = typeof Security !== 'undefined' ? Security.getKey('netlify_site')  : null;
    if (!token || !siteId) return _deployments;

    try {
      const r = await fetch(
        `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=10`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!r.ok) return _deployments;
      const list = await r.json();
      return list.map(d => ({
        id:      d.id,
        url:     d.deploy_ssl_url || d.deploy_url,
        state:   d.state,
        title:   d.title || 'بدون عنوان',
        created: d.created_at
      }));
    } catch {
      return _deployments;
    }
  }

  /* ── حذف نشر ── */
  async function deleteDeployment(deployId) {
    const token = typeof Security !== 'undefined' ? Security.getKey('netlify_token') : null;
    if (!token) throw new Error('مفتاح Netlify غير مضبوط');
    const r = await fetch(
      `https://api.netlify.com/api/v1/deploys/${deployId}`,
      { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!r.ok) throw new Error(`فشل الحذف: ${r.status}`);
    _deployments = _deployments.filter(d => d.id !== deployId);
    _save();
    return true;
  }

  /* ── إعادة النشر ── */
  async function redeployLast() {
    const last = _deployments[_deployments.length - 1];
    if (!last) throw new Error('لا يوجد نشر سابق');
    return deployWithFiles(last._files || {}, last.title + ' (إعادة نشر)');
  }

  /* ── النشر الكامل مع التحليل والتسجيل ── */
  async function deployWithFiles(files, title) {
    if (typeof Logger !== 'undefined') Logger.info('DEPLOY', `🚀 بدء النشر: ${title}`);

    const analysis = await analyzeBeforeDeploy(files);
    const errors = analysis.issues.filter(i => i.level === 'error');
    if (errors.length > 0) throw new Error(errors.map(e => e.msg).join('، '));

    const result = await deployToNetlify(files, title);

    const entry = { ...result, title, analysis, _files: files };
    _deployments.push(entry);
    _save();

    if (typeof Logger !== 'undefined') Logger.info('DEPLOY', `✅ نشر ناجح: ${result.url}`);
    if (typeof JobQueue !== 'undefined') {
      JobQueue.log(`نشر مكتمل: ${title} → ${result.url}`);
    }

    return entry;
  }

  /* ── sha1 بسيط (للـ digest) ── */
  async function _sha1(str) {
    const buf  = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ── فتح لوحة النشر ── */
  function openPanel() {
    const panel = document.getElementById('deploy-panel');
    if (panel) panel.style.display = 'flex';
    _refreshPanel();
  }

  function closePanel() {
    const panel = document.getElementById('deploy-panel');
    if (panel) panel.style.display = 'none';
  }

  async function _refreshPanel() {
    const list = document.getElementById('deploy-list');
    if (!list) return;
    list.innerHTML = '<div style="color:#64748b;padding:12px">جارٍ التحميل...</div>';
    try {
      const deploys = await listDeployments();
      if (deploys.length === 0) {
        list.innerHTML = '<div style="color:#475569;padding:12px;text-align:center">لا توجد نشرات بعد</div>';
        return;
      }
      list.innerHTML = deploys.map(d => `
        <div class="deploy-item">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="deploy-state deploy-state-${d.state}">${_stateIcon(d.state)} ${d.state}</span>
            <span style="font-size:10px;color:#475569">${_fmt(d.created)}</span>
          </div>
          <a href="${d.url}" target="_blank" style="color:#fca5a5;font-size:11px;word-break:break-all">${d.url || '—'}</a>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button onclick="DeploymentEngine.deleteDeployment('${d.id}').then(()=>DeploymentEngine.openPanel()).catch(e=>Toast.error(e.message))"
              style="font-size:10px;padding:3px 8px;border-radius:6px;background:rgba(220,38,38,.2);border:1px solid rgba(220,38,38,.3);color:#fca5a5;cursor:pointer">🗑️ حذف</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = `<div style="color:#f87171;padding:12px">${e.message}</div>`;
    }
  }

  function _stateIcon(s) {
    return { ready: '✅', building: '🔄', error: '❌', enqueued: '⏳' }[s] || '❓';
  }

  function _fmt(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('ar'); } catch { return iso; }
  }

  /* ── التهيئة ── */
  function init() {
    _load();
    if (typeof Logger !== 'undefined') Logger.info('DEPLOY', '🚀 Deployment Engine جاهز');
  }

  return { init, openPanel, closePanel, analyzeBeforeDeploy, deployWithFiles, listDeployments, deleteDeployment, redeployLast, detectProjectType };

})();
