/* ══════════════════════════════════════════════════════════════
   auto-refactor.js — محرك إعادة الهيكلة التلقائية (Auto Refactor)
   تنظيف + تحديث + اكتشاف تكرار + اقتراحات هيكلة + تحسين أداء
   يعمل على الكود النصي (بدون AST خارجي) — آمن: لا يغيّر المنطق
   Galaoum AI Engine v5.0 — نسخة محسّنة
   ══════════════════════════════════════════════════════════════ */

window.AutoRefactor = (function () {

  /* ══════════════════════════════════════════════
     1. تنظيف آمن للكود (لا يغيّر المنطق)
     ══════════════════════════════════════════════ */
  function cleanCode(code) {
    if (!code || typeof code !== 'string') return code || '';
    let out = code;
    out = out.replace(/[ \t]+$/gm,    '');       /* فراغات نهاية السطر */
    out = out.replace(/\n{3,}/g,      '\n\n');   /* أسطر فارغة زائدة */
    out = out.replace(/;;+/g,         ';');       /* فاصلة منقوطة مكررة */
    out = out.replace(/\s+$/,         '');        /* فراغات نهاية الملف */
    out = out + '\n';                             /* سطر فارغ في النهاية */
    return out;
  }

  /* ══════════════════════════════════════════════
     2. تحديث الكود إلى ES Modern
     ══════════════════════════════════════════════ */
  function modernize(code) {
    if (!code) return { code, changes: [] };
    let out = code;
    const changes = [];

    /* var → const/let — آمن فقط في التعريفات البسيطة */
    const varCount = (out.match(/\bvar\s+\w+\s*=/g) || []).length;
    if (varCount > 0) {
      out = out.replace(/\bvar\s+(\w+)\s*=\s*([^;]+);/g, (m, name, val) => {
        /* إذا كان القيمة قابلة للتغيير (المصفوفات والكائنات) — استخدم const */
        const isConst = /^\[|^\{|^'|^"|^`|^\d|^true|^false|^null/.test(val.trim());
        return `${isConst ? 'const' : 'let'} ${name} = ${val};`;
      });
      changes.push({ type: 'var_to_const_let', detail: `تحويل ${varCount} تعريف var → const/let` });
    }

    /* دمج النصوص بـ + → Template Literals (حالات بسيطة) */
    const concatCount = (out.match(/['"][^'"]*['"]\s*\+\s*\w+\s*\+\s*['"][^'"]*['"]/g) || []).length;
    if (concatCount > 0) {
      out = out.replace(/'([^']*)'\s*\+\s*(\w+(?:\.\w+)*)\s*\+\s*'([^']*)'/g, '`$1${$2}$3`');
      out = out.replace(/"([^"]*)"\s*\+\s*(\w+(?:\.\w+)*)\s*\+\s*"([^"]*)"/g, '`$1${$2}$3`');
      changes.push({ type: 'template_literals', detail: `تحويل ${concatCount} دمج نصوص → Template Literals` });
    }

    /* Object.assign({}, obj) → Spread */
    const assignCount = (out.match(/Object\.assign\s*\(\s*\{\s*\}/g) || []).length;
    if (assignCount > 0) {
      out = out.replace(/Object\.assign\s*\(\s*\{\s*\}\s*,\s*(\w+)\s*\)/g, '{ ...$1 }');
      changes.push({ type: 'object_spread', detail: `تحويل ${assignCount} Object.assign({}) → Spread` });
    }

    /* .indexOf() >= 0 → .includes() */
    const indexOfCount = (out.match(/\.indexOf\([^)]+\)\s*(?:!==|>=)\s*(?:-1|0)/g) || []).length;
    if (indexOfCount > 0) {
      out = out.replace(/\.indexOf\(([^)]+)\)\s*!==\s*-1/g, '.includes($1)');
      out = out.replace(/\.indexOf\(([^)]+)\)\s*>=\s*0/g,   '.includes($1)');
      changes.push({ type: 'includes', detail: `تحويل ${indexOfCount} indexOf → includes` });
    }

    /* for..in على المصفوفات → for..of */
    const forInCount = (out.match(/for\s*\(\s*(?:var|let|const)\s+\w+\s+in\s+\w+\s*\)/g) || []).length;
    if (forInCount > 0) {
      changes.push({ type: 'for_of_suggestion', detail: `${forInCount} حلقة for..in — تحقّق إن كانت مصفوفات فاستخدم for..of` });
    }

    /* parseInt بدون radix → parseInt(x, 10) */
    const parseIntCount = (out.match(/\bparseInt\s*\([^,)]+\)/g) || []).length;
    if (parseIntCount > 0) {
      out = out.replace(/\bparseInt\s*\(([^,)]+)\)/g, 'parseInt($1, 10)');
      changes.push({ type: 'parseint_radix', detail: `إضافة radix 10 لـ ${parseIntCount} استدعاء parseInt` });
    }

    /* == → === (حذر: غير مناسب لجميع الحالات) */
    const looseEqCount = (out.match(/[^=!<>]==[^=]/g) || []).length;
    if (looseEqCount > 0) {
      changes.push({ type: 'strict_equality', detail: `${looseEqCount} مقارنة == — فكّر في تحويلها إلى ===` });
      /* لا نطبّق التحويل تلقائياً — قد يغيّر المنطق */
    }

    /* .then() chains → async/await اقتراح فقط */
    const thenChains = (out.match(/\.then\([^)]*\)\.then/g) || []).length;
    if (thenChains > 0) {
      changes.push({ type: 'async_await_suggestion', detail: `${thenChains} سلسلة then — فكّر في async/await` });
    }

    /* إزالة console.log من الإنتاج (اختياري) */
    const consoleLogs = (out.match(/console\.log\s*\([^)]*\);?\n?/g) || []).length;
    if (consoleLogs > 0) {
      changes.push({ type: 'console_log_removal', detail: `${consoleLogs} console.log — يُنصح بإزالتها من الإنتاج`, suggestion: true });
    }

    return { code: out, changes };
  }

  /* ══════════════════════════════════════════════
     3. اكتشاف تكرار كتل الكود
     ══════════════════════════════════════════════ */
  function findDuplicateBlocks(code, minLines = 4) {
    if (!code) return [];
    const lines      = code.split('\n');
    const blocks     = {};
    const duplicates = [];

    for (let i = 0; i <= lines.length - minLines; i++) {
      const block = lines.slice(i, i + minLines).join('\n').trim();
      if (!block || block.length < 40) continue;
      /* تجاهل الكتل التي هي مجرد فراغات أو تعليقات */
      if (/^[\s\/\*]+$/.test(block)) continue;
      if (blocks[block] !== undefined) {
        duplicates.push({ firstAt: blocks[block] + 1, duplicateAt: i + 1, lines: minLines, preview: block.substring(0, 60) + '...' });
      } else {
        blocks[block] = i;
      }
    }
    return duplicates;
  }

  /* ══════════════════════════════════════════════
     4. اقتراحات تحسين الأداء
     ══════════════════════════════════════════════ */
  function suggestPerformanceFixes(code) {
    if (!code) return [];
    const suggestions = [];

    if (/document\.querySelectorAll\([^)]*\)\.forEach/.test(code))
      suggestions.push({ type: 'cache_query', detail: 'خزّن querySelectorAll في متغيّر إن استُخدم أكثر من مرة' });
    if (/for\s*\([^;]*;[^;]*\.length[^;]*;/.test(code))
      suggestions.push({ type: 'cache_length', detail: 'خزّن .length خارج حلقة for لتجنب إعادة الحساب' });
    if (/console\.log/.test(code))
      suggestions.push({ type: 'remove_console', detail: 'أزل console.log من كود الإنتاج' });
    if (/new\s+RegExp\s*\(/.test(code))
      suggestions.push({ type: 'static_regex', detail: 'إن كان RegExp ثابتاً فعرّفه خارج الدالة لتجنب إعادة الترجمة' });
    if (/\.innerHTML\s*\+=/.test(code))
      suggestions.push({ type: 'innerHTML_append', detail: 'إضافة innerHTML داخل حلقة بطيئة — استخدم DocumentFragment أو join()' });
    if (/setInterval\s*\([\s\S]{1,100},\s*\d+\s*\)/.test(code))
      suggestions.push({ type: 'setinterval_check', detail: 'تأكد من تنظيف setInterval عند إزالة العنصر (clearInterval)' });
    if (/JSON\.parse\s*\(JSON\.stringify/.test(code))
      suggestions.push({ type: 'deep_clone', detail: 'JSON.parse(JSON.stringify()) بطيء — استخدم structuredClone()' });
    if (/await\s+\w+.*\n\s*await\s+\w+/.test(code))
      suggestions.push({ type: 'parallel_awaits', detail: 'awaits متتالية مستقلة — استخدم Promise.all() للتوازي' });

    return suggestions;
  }

  /* ══════════════════════════════════════════════
     5. اقتراح استخراج الدوال المتكررة
     ══════════════════════════════════════════════ */
  function suggestExtractFunctions(code) {
    if (!code) return [];
    const suggestions = [];
    const lines = code.split('\n');

    /* أسطر طويلة جداً (> 150 حرف) قد تستحق التقسيم */
    const longLines = lines.filter((l, i) => l.length > 150).length;
    if (longLines > 3) {
      suggestions.push({ type: 'split_long_lines', detail: `${longLines} سطر تتجاوز 150 حرفاً — فكّر في تقسيمها لدوال` });
    }

    /* كتل if-else متشعبة (> 5 مستويات) */
    const maxIndent = Math.max(...lines.map(l => (l.match(/^(\s*)/)?.[1]?.length || 0)));
    if (maxIndent > 20) {
      suggestions.push({ type: 'reduce_nesting', detail: `تداخل عميق (${maxIndent} مسافة) — استخدم Early Return لتبسيط المنطق` });
    }

    /* دوال كبيرة (تقدير: أكثر من 50 سطر بين { و }) */
    const bigFnMatch = code.match(/function\s+\w+[^{]*\{[\s\S]{2000,}?\}/g);
    if (bigFnMatch) {
      suggestions.push({ type: 'large_function', detail: `${bigFnMatch.length} دالة كبيرة — فكّر في تقسيمها لدوال أصغر` });
    }

    return suggestions;
  }

  /* ══════════════════════════════════════════════
     6. اكتشاف الاستيرادات غير المستخدمة
     ══════════════════════════════════════════════ */
  function findUnusedImports(code) {
    if (!code) return [];
    const unused = [];
    /* البحث عن import/require */
    const importRe = /(?:import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from|const\s+({[^}]+}|\w+)\s*=\s*require)\s*\(['"](.*?)['"]\)/g;
    let m;
    while ((m = importRe.exec(code)) !== null) {
      const names = (m[1] || m[2] || m[3] || m[4] || '').split(',').map(s => s.trim().replace(/^\w+\s+as\s+/, '')).filter(Boolean);
      for (const name of names) {
        const clean = name.replace(/[{}]/g, '').trim();
        if (!clean || clean.length < 2) continue;
        const uses = (code.match(new RegExp(`\\b${clean}\\b`, 'g')) || []).length;
        if (uses <= 1) unused.push({ name: clean, source: m[5] || '' });
      }
    }
    return unused;
  }

  /* ══════════════════════════════════════════════
     7. تنفيذ كل التحسينات دفعة واحدة
     ══════════════════════════════════════════════ */
  function refactor(code) {
    const cleaned       = cleanCode(code);
    const modernResult  = modernize(cleaned);
    const duplicates    = findDuplicateBlocks(modernResult.code);
    const perfSuggests  = suggestPerformanceFixes(modernResult.code);
    const extractSuggs  = suggestExtractFunctions(modernResult.code);
    const unusedImports = findUnusedImports(modernResult.code);

    const totalChanges = modernResult.changes.length;
    const totalIssues  = duplicates.length + perfSuggests.length + extractSuggs.length + unusedImports.length;

    return {
      cleaned:        modernResult.code,
      changes:        modernResult.changes,
      duplicates,
      perfSuggests,
      extractSuggs,
      unusedImports,
      totalChanges,
      totalIssues,
      summary: `${totalChanges} تحويل مُطبَّق + ${totalIssues} اقتراح تحسين`
    };
  }

  /* ══════════════════════════════════════════════
     8. تقرير HTML قابل للعرض
     ══════════════════════════════════════════════ */
  function buildReport(result) {
    return `
      <div style="font-size:13px;color:#e2e8f0">
        <div style="font-weight:700;margin-bottom:10px">📊 ${result.summary}</div>

        ${result.changes.length > 0 ? `
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:#4ade80;font-weight:700;margin-bottom:6px">✅ التحويلات المُطبَّقة (${result.changes.length})</div>
            ${result.changes.map(c => `
              <div style="padding:5px 8px;background:rgba(74,222,128,0.08);border-right:2px solid #4ade80;border-radius:4px;margin-bottom:4px;font-size:11px;color:#94a3b8">
                ${c.detail}
              </div>`).join('')}
          </div>` : ''}

        ${result.duplicates.length > 0 ? `
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:#eab308;font-weight:700;margin-bottom:6px">🔁 كتل مكررة (${result.duplicates.length})</div>
            ${result.duplicates.slice(0,5).map(d => `
              <div style="padding:5px 8px;background:rgba(234,179,8,0.08);border-right:2px solid #eab308;border-radius:4px;margin-bottom:4px;font-size:11px;color:#94a3b8">
                سطر ${d.firstAt} و ${d.duplicateAt} — <code>${d.preview}</code>
              </div>`).join('')}
          </div>` : ''}

        ${result.perfSuggests.length > 0 ? `
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:#60a5fa;font-weight:700;margin-bottom:6px">⚡ اقتراحات الأداء (${result.perfSuggests.length})</div>
            ${result.perfSuggests.map(s => `
              <div style="padding:5px 8px;background:rgba(96,165,250,0.08);border-right:2px solid #60a5fa;border-radius:4px;margin-bottom:4px;font-size:11px;color:#94a3b8">
                ${s.detail}
              </div>`).join('')}
          </div>` : ''}

        ${result.unusedImports.length > 0 ? `
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:#f97316;font-weight:700;margin-bottom:6px">📦 استيرادات غير مستخدمة (${result.unusedImports.length})</div>
            ${result.unusedImports.map(u => `
              <div style="padding:5px 8px;background:rgba(249,115,22,0.08);border-right:2px solid #f97316;border-radius:4px;margin-bottom:4px;font-size:11px;color:#94a3b8">
                <code>${u.name}</code> من <code>${u.source}</code>
              </div>`).join('')}
          </div>` : ''}

        ${result.extractSuggs.length > 0 ? `
          <div>
            <div style="font-size:11px;color:#c4b5fd;font-weight:700;margin-bottom:6px">🔨 اقتراحات الهيكلة (${result.extractSuggs.length})</div>
            ${result.extractSuggs.map(s => `
              <div style="padding:5px 8px;background:rgba(196,181,253,0.08);border-right:2px solid #c4b5fd;border-radius:4px;margin-bottom:4px;font-size:11px;color:#94a3b8">
                ${s.detail}
              </div>`).join('')}
          </div>` : ''}
      </div>`;
  }

  /* ══════════════════════════════════════════════
     9. لوحة UI
     ══════════════════════════════════════════════ */
  function openPanel(code, filename) {
    let panel = document.getElementById('refactor-panel');
    if (!panel) { panel = _createPanel(); document.body.appendChild(panel); }
    panel.style.display = 'flex';
    if (code) runRefactor(code, filename);
  }

  function closePanel() {
    const el = document.getElementById('refactor-panel');
    if (el) el.style.display = 'none';
  }

  function runRefactor(code, filename) {
    const result = refactor(code);
    const body   = document.getElementById('refactor-body');
    if (body) body.innerHTML = buildReport(result);
    const out    = document.getElementById('refactor-output');
    if (out) out.value = result.cleaned;
    return result;
  }

  function _createPanel() {
    const el = document.createElement('div');
    el.id = 'refactor-panel';
    el.className = 'g-panel';
    el.onclick = e => { if (e.target === el) closePanel(); };
    el.innerHTML = `
      <div class="g-panel-box" style="max-width:780px">
        <div class="g-panel-header">
          <div class="g-panel-title">🔨 إعادة الهيكلة التلقائية</div>
          <button class="g-panel-close" onclick="AutoRefactor.closePanel()">✕</button>
        </div>
        <div class="g-panel-body" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div class="g-label" style="margin-bottom:6px">الكود المُدخَل</div>
            <textarea id="refactor-input" class="g-input" rows="12" placeholder="الصق كودك هنا..." style="width:100%;font-family:monospace;font-size:11px;resize:vertical" dir="ltr"></textarea>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="g-btn g-btn-green" style="flex:1"
                onclick="AutoRefactor.runRefactor(document.getElementById('refactor-input').value,'input.js')">
                🔨 تحليل وتحسين
              </button>
              <button class="g-btn"
                onclick="navigator.clipboard.writeText(document.getElementById('refactor-output').value)">
                📋 نسخ النتيجة
              </button>
            </div>
          </div>
          <div>
            <div class="g-label" style="margin-bottom:6px">الكود المُحسَّن</div>
            <textarea id="refactor-output" class="g-input" rows="12" style="width:100%;font-family:monospace;font-size:11px;resize:vertical;color:#4ade80" dir="ltr" readonly></textarea>
          </div>
          <div id="refactor-body" style="grid-column:1/-1;background:rgba(0,0,0,0.2);border-radius:8px;padding:12px;min-height:60px;color:#475569">
            أدخل كوداً وانقر "تحليل وتحسين"
          </div>
        </div>
      </div>`;
    return el;
  }

  return {
    cleanCode, modernize, findDuplicateBlocks,
    suggestPerformanceFixes, suggestExtractFunctions,
    findUnusedImports, refactor, buildReport,
    openPanel, closePanel, runRefactor
  };

})();
