/* ══════════════════════════════════════════════
   terminal-engine.js — Terminal احترافي
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.TerminalEngine = (function () {

  const HISTORY_KEY = 'galaoum_terminal_history_v1';
  let _history = [];
  let _histIdx = -1;
  let _cwd = '/project';

  /* ── أوامر مدعومة بمحاكاة ── */
  const SUPPORTED = ['npm','pnpm','yarn','node','python','pip','flutter','java','gradle','git','ls','pwd','mkdir','cat','echo','clear','help'];

  /* ── محاكاة تنفيذ الأوامر ── */
  async function _simulate(cmd, args) {
    /* تنفيذ كود JavaScript/Python عبر Wandbox إذا كان متاحاً */
    const codeApis = {
      node:   (code) => _runWandbox('JavaScript', code),
      python: (code) => _runWandbox('Python 3.12.0', code)
    };

    switch (cmd) {
      case 'help':
        return `أوامر مدعومة:\n${SUPPORTED.join('  ')}\n\nالمحطة تعمل في وضع المحاكاة — الكود الفعلي يُشغَّل عبر Wandbox API`;

      case 'pwd':   return _cwd;
      case 'clear': return '__CLEAR__';

      case 'ls':
        return _getFSEntries();

      case 'mkdir':
        if (!args[0]) return 'mkdir: مطلوب اسم المجلد';
        if (typeof VirtualFS !== 'undefined') VirtualFS.mkdir(args[0]);
        return `تم إنشاء: ${args[0]}`;

      case 'cat':
        if (!args[0]) return 'cat: مطلوب اسم الملف';
        if (typeof VirtualFS !== 'undefined') {
          const f = VirtualFS.read(args[0]);
          return f !== null ? f : `cat: ${args[0]}: لا يوجد`;
        }
        return `cat: ${args[0]}: لا يوجد`;

      case 'echo':
        return args.join(' ');

      case 'npm':
      case 'pnpm':
      case 'yarn': {
        const sub = args[0];
        if (sub === 'install' || sub === 'i') return _fakeInstall(args.slice(1), cmd);
        if (sub === 'run') return `▶️ تشغيل سكريبت: ${args[1] || '(بدون اسم)'}\n(وضع المحاكاة — تنفيذ فعلي يتطلب backend)`;
        if (sub === 'init') return `✅ أنشأ ${cmd} ملف package.json\n{ "name": "project", "version": "1.0.0" }`;
        if (sub === 'list' || sub === 'ls') return _listPackages();
        return `${cmd} ${args.join(' ')}\n(وضع المحاكاة)`;
      }

      case 'git':
        return _handleGit(args);

      case 'node': {
        if (!args[0]) return 'node: مطلوب ملف أو -e "كود"';
        if (args[0] === '-e') {
          const code = args.slice(1).join(' ');
          return await codeApis.node(code);
        }
        return `▶️ تشغيل ${args[0]}...\n(وضع المحاكاة)`;
      }

      case 'python': {
        if (!args[0]) return 'python: مطلوب ملف أو -c "كود"';
        if (args[0] === '-c') {
          const code = args.slice(1).join(' ');
          return await codeApis.python(code);
        }
        return `▶️ تشغيل ${args[0]}...\n(وضع المحاكاة)`;
      }

      case 'pip':
        return `pip ${args.join(' ')}\n✅ (محاكاة) تم تثبيت ${args[1] || 'الحزمة'}`;

      case 'flutter':
        return `Flutter ${args[0] || ''}\n(وضع المحاكاة — يتطلب Flutter SDK)`;

      case 'java':
      case 'gradle':
        return `${cmd} ${args.join(' ')}\n(وضع المحاكاة — يتطلب JDK)`;

      default:
        return `${cmd}: command not found\nاكتب 'help' لعرض الأوامر المدعومة`;
    }
  }

  function _getFSEntries() {
    if (typeof VirtualFS !== 'undefined') return VirtualFS.ls(_cwd).join('\n');
    return 'index.html\ncss/\njs/\nnetlify/\nnetlify.toml';
  }

  function _fakeInstall(pkgs, pm) {
    if (pkgs.length === 0) return `${pm} install\n✅ الحزم محدّثة (وضع المحاكاة)`;
    return pkgs.map(p => `+ ${p}@latest`).join('\n') + `\n✅ تم تثبيت ${pkgs.length} حزمة`;
  }

  function _listPackages() {
    return 'الحزم المثبتة (وضع المحاكاة):\n├── express@5.0.0\n├── react@18.0.0\n└── typescript@5.0.0';
  }

  function _handleGit(args) {
    const sub = args[0];
    const map = {
      status:   '🔵 On branch main\nنظيف — لا يوجد تعديلات غير محفوظة',
      log:      '📜 a1b2c3d (HEAD -> main) آخر commit\nb2c3d4e الـ commit السابق',
      branch:   '* main\n  develop\n  feature/new',
      diff:     '(لا توجد تعديلات)',
      init:     '✅ تهيئة مستودع Git جديد في ' + _cwd,
      pull:     '✅ Already up to date.',
      stash:    '✅ تم حفظ التعديلات في stash',
      fetch:    '✅ تم جلب آخر التحديثات'
    };
    if (typeof GitManager !== 'undefined') {
      return GitManager.runCommand(args);
    }
    return map[sub] || `git ${args.join(' ')}\n(وضع المحاكاة — استخدم Git Manager للعمليات الكاملة)`;
  }

  /* ── Wandbox API لتشغيل الكود الفعلي ── */
  async function _runWandbox(lang, code) {
    try {
      const r = await fetch('https://wandbox.org/api/compile.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compiler: lang === 'JavaScript' ? 'nodejs-20.8.0' : 'cpython-3.12.0', code, save: false })
      });
      const data = await r.json();
      return (data.program_output || '') + (data.compiler_error || '') || '(لا مخرجات)';
    } catch {
      return '⚠️ تعذّر الاتصال بـ Wandbox API';
    }
  }

  /* ── تنفيذ أمر نصي ── */
  async function execute(cmdLine) {
    const trimmed = cmdLine.trim();
    if (!trimmed) return '';

    _history.push(trimmed);
    _histIdx = _history.length;
    _saveHistory();

    if (typeof Logger !== 'undefined') Logger.info('TERMINAL', `$ ${trimmed}`);

    const [cmd, ...args] = trimmed.split(/\s+/);
    const lc = cmd.toLowerCase();

    if (!SUPPORTED.includes(lc)) {
      return `${cmd}: command not found\nاكتب 'help' لعرض الأوامر المدعومة`;
    }

    try {
      const out = await _simulate(lc, args);
      return out;
    } catch (e) {
      return `خطأ: ${e.message}`;
    }
  }

  /* ── تاريخ الأوامر ── */
  function historyPrev() {
    if (_histIdx > 0) _histIdx--;
    return _history[_histIdx] || '';
  }

  function historyNext() {
    if (_histIdx < _history.length - 1) _histIdx++;
    else { _histIdx = _history.length; return ''; }
    return _history[_histIdx] || '';
  }

  function _saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(_history.slice(-200))); } catch {}
  }

  function _loadHistory() {
    try { _history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); _histIdx = _history.length; } catch {}
  }

  /* ── فتح/إغلاق اللوحة ── */
  function openPanel() {
    const p = document.getElementById('terminal-panel');
    if (p) { p.style.display = 'flex'; _focusInput(); }
  }

  function closePanel() {
    const p = document.getElementById('terminal-panel');
    if (p) p.style.display = 'none';
  }

  function _focusInput() {
    setTimeout(() => {
      const inp = document.getElementById('terminal-input');
      if (inp) inp.focus();
    }, 100);
  }

  /* ── طباعة في الشاشة ── */
  function _print(text, cls = '') {
    const out = document.getElementById('terminal-output');
    if (!out) return;
    if (text === '__CLEAR__') { out.innerHTML = ''; return; }
    const div = document.createElement('div');
    div.className = 'term-line ' + cls;
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  /* ── معالج الإدخال ── */
  async function handleInput(e) {
    if (e.key === 'Enter') {
      const inp = document.getElementById('terminal-input');
      if (!inp) return;
      const cmd = inp.value;
      inp.value = '';
      _print(`$ ${cmd}`, 'term-cmd');
      const out = await execute(cmd);
      if (out) _print(out, 'term-out');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const inp = document.getElementById('terminal-input');
      if (inp) inp.value = historyPrev();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const inp = document.getElementById('terminal-input');
      if (inp) inp.value = historyNext();
    }
  }

  function init() {
    _loadHistory();
    if (typeof Logger !== 'undefined') Logger.info('TERMINAL', '💻 Terminal Engine جاهز');
  }

  return { init, execute, openPanel, closePanel, handleInput, historyPrev, historyNext };

})();
