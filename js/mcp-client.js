/* ══════════════════════════════════════════════
   mcp-client.js — Model Context Protocol Client
   ربط أدوات وخدمات خارجية بالنماذج
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const MCPClient = (() => {

  /* ── سجل الأدوات المسجّلة ── */
  const _tools = new Map();

  /* ── الأدوات المدمجة افتراضياً ── */
  const BUILT_IN_TOOLS = [
    {
      name: 'web_search',
      description: 'البحث في الإنترنت والحصول على معلومات حديثة',
      inputSchema: { query: { type: 'string', description: 'نص البحث' } },
      icon: '🌐',
      handler: async ({ query }) => {
        if (typeof searchWeb === 'function') return await searchWeb(query);
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
        const d = await res.json();
        return d.AbstractText || d.Answer || 'لم أجد نتيجة واضحة.';
      }
    },
    {
      name: 'read_url',
      description: 'قراءة محتوى أي رابط ويب',
      inputSchema: { url: { type: 'string', description: 'الرابط المطلوب قراءته' } },
      icon: '📄',
      handler: async ({ url }) => {
        if (typeof readURL === 'function') return await readURL(url);
        const res = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' } });
        return res.ok ? (await res.text()).substring(0, 3000) : 'تعذّر قراءة الرابط';
      }
    },
    {
      name: 'run_code',
      description: 'تشغيل كود برمجي وإرجاع الناتج',
      inputSchema: {
        language: { type: 'string', description: 'اللغة: python, javascript, cpp, go, rust' },
        code: { type: 'string', description: 'الكود المراد تشغيله' }
      },
      icon: '💻',
      handler: async ({ language, code }) => {
        if (typeof executeCode === 'function') return await executeCode(language, code);
        return 'محرك تشغيل الكود غير متاح';
      }
    },
    {
      name: 'current_time',
      description: 'الحصول على التاريخ والوقت الحالي',
      inputSchema: {},
      icon: '🕐',
      handler: async () => {
        const now = new Date();
        return `التاريخ: ${now.toLocaleDateString('ar-SA')} | الوقت: ${now.toLocaleTimeString('ar-SA')}`;
      }
    },
    {
      name: 'memory_read',
      description: 'قراءة ذاكرة المحادثة السابقة',
      inputSchema: { limit: { type: 'number', description: 'عدد الرسائل (افتراضي: 10)' } },
      icon: '🧠',
      handler: async ({ limit = 10 }) => {
        if (typeof loadMemory !== 'function') return 'لا توجد ذاكرة';
        const mem = loadMemory().slice(-(limit * 2));
        return mem.map(m => `[${m.role}]: ${m.content.substring(0, 200)}`).join('\n');
      }
    },
    {
      name: 'generate_image',
      description: 'توليد صورة من نص',
      inputSchema: { prompt: { type: 'string', description: 'وصف الصورة المطلوبة' } },
      icon: '🎨',
      handler: async ({ prompt }) => {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
        return `![صورة مولّدة](${url})`;
      }
    },
    {
      name: 'calculator',
      description: 'حساب عمليات رياضية',
      inputSchema: { expression: { type: 'string', description: 'العبارة الرياضية' } },
      icon: '🔢',
      handler: async ({ expression }) => {
        try {
          const safe = expression.replace(/[^0-9+\-*/().,\s%^]/g, '');
          const result = Function('"use strict"; return (' + safe + ')')();
          return `النتيجة: ${result}`;
        } catch { return 'خطأ في العبارة الرياضية'; }
      }
    }
  ];

  /* ── تسجيل أدوات مدمجة عند البدء ── */
  BUILT_IN_TOOLS.forEach(t => _tools.set(t.name, t));

  /* ── تسجيل أداة جديدة ── */
  function register(tool) {
    if (!tool.name || !tool.handler) throw new Error('الأداة تحتاج name و handler');
    _tools.set(tool.name, tool);
    _log(`✅ تم تسجيل أداة: ${tool.name}`);
    _renderPanel();
  }

  /* ── إلغاء تسجيل أداة ── */
  function unregister(name) {
    _tools.delete(name);
    _renderPanel();
  }

  /* ── استدعاء أداة ── */
  async function call(name, args = {}) {
    const tool = _tools.get(name);
    if (!tool) throw new Error(`أداة غير موجودة: ${name}`);
    _log(`📞 استدعاء: ${name}(${JSON.stringify(args).substring(0, 80)})`);
    try {
      const result = await tool.handler(args);
      _log(`✅ نتيجة ${name}: ${String(result).substring(0, 100)}`);
      return result;
    } catch (e) {
      _log(`❌ فشل ${name}: ${e.message}`);
      throw e;
    }
  }

  /* ── توليد system prompt مع قائمة الأدوات ── */
  function getToolsSystemPrompt() {
    const toolsList = [..._tools.values()].map(t =>
      `- ${t.name}: ${t.description}`
    ).join('\n');

    return `\n\n═══ الأدوات المتاحة (MCP) ═══
عندما تحتاج أداة، استخدم هذا الشكل بالضبط:
[TOOL: tool_name] {"param": "value"} [/TOOL]

الأدوات المتاحة:
${toolsList}

بعد الحصول على نتيجة الأداة، تابع الإجابة مباشرةً بدون تكرار استدعاء الأداة.
═════════════════════════`;
  }

  /* ── معالجة رد النموذج وتنفيذ الأدوات المطلوبة ── */
  async function processResponse(text, maxRounds = 3) {
    let current = text;
    let round = 0;

    while (round < maxRounds) {
      const match = current.match(/\[TOOL:\s*(\w+)\]\s*(\{.*?\})\s*\[\/TOOL\]/s);
      if (!match) break;

      const [full, toolName, argsStr] = match;
      let args = {};
      try { args = JSON.parse(argsStr); } catch {}

      const toolResult = await call(toolName, args).catch(e => `خطأ: ${e.message}`);
      current = current.replace(full, `[نتيجة ${toolName}]: ${toolResult}`);
      round++;
    }

    return current;
  }

  /* ── فحص وجود أدوات مطلوبة في الطلب ── */
  function detectNeededTools(prompt) {
    const needed = [];
    const p = prompt.toLowerCase();
    if (/ابحث|search|بحث في الويب/.test(p)) needed.push('web_search');
    if (/افتح رابط|اقرأ الرابط|visit|read url/.test(p)) needed.push('read_url');
    if (/شغّل|run|اختبر كود/.test(p)) needed.push('run_code');
    if (/الوقت|الآن|تاريخ اليوم/.test(p)) needed.push('current_time');
    if (/احسب|calculate|ناتج/.test(p)) needed.push('calculator');
    if (/صورة|generate image|ولّد صورة/.test(p)) needed.push('generate_image');
    return needed;
  }

  /* ── قائمة كل الأدوات ── */
  function list() { return [..._tools.values()]; }

  /* ══ الواجهة المرئية ══ */
  function openPanel() {
    _ensurePanel();
    document.getElementById('mcp-panel').style.display = 'flex';
    _renderPanel();
  }

  function closePanel() {
    const p = document.getElementById('mcp-panel');
    if (p) p.style.display = 'none';
  }

  function _renderPanel() {
    const grid = document.getElementById('mcp-tools-grid');
    if (!grid) return;
    const tools = list();
    grid.innerHTML = tools.map(t => `
      <div style="
        background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
        border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">${t.icon || '🔧'}</span>
            <span style="font-size:12px;font-weight:700;color:#f1f5f9">${t.name}</span>
          </div>
          ${BUILT_IN_TOOLS.find(b => b.name === t.name) ? '' : `
            <button onclick="MCPClient.unregister('${t.name}')" style="
              background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);
              color:#ef4444;border-radius:6px;padding:2px 6px;cursor:pointer;font-size:10px;
            ">حذف</button>
          `}
        </div>
        <div style="font-size:11px;color:#64748b">${t.description}</div>
        <button onclick="MCPClient._testTool('${t.name}')" style="
          padding:5px;border-radius:8px;font-size:10px;cursor:pointer;font-family:inherit;
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
          color:#475569;transition:all 0.2s;
        " onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#475569'">
          🧪 اختبار
        </button>
      </div>
    `).join('');
  }

  async function _testTool(name) {
    const tool = _tools.get(name);
    if (!tool) return;
    const defaults = { web_search: { query: 'ذكاء اصطناعي' }, read_url: { url: 'https://example.com' }, run_code: { language: 'python', code: 'print("مرحبا!")' }, current_time: {}, calculator: { expression: '2+2*3' }, memory_read: { limit: 3 }, generate_image: { prompt: 'قطة جميلة' } };
    const args = defaults[name] || {};
    try {
      const result = await call(name, args);
      alert(`✅ نتيجة ${name}:\n${String(result).substring(0, 300)}`);
    } catch (e) {
      alert(`❌ فشل ${name}: ${e.message}`);
    }
  }

  function _ensurePanel() {
    if (document.getElementById('mcp-panel')) return;
    const el = document.createElement('div');
    el.id = 'mcp-panel';
    el.style.cssText = `
      display:none;position:fixed;inset:0;z-index:9100;
      background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
      align-items:center;justify-content:center;padding:20px;font-family:inherit;
    `;
    el.onclick = e => { if (e.target === el) closePanel(); };
    el.innerHTML = `
      <div style="width:100%;max-width:700px;max-height:85vh;
        background:linear-gradient(160deg,#0d1425,#0a0f1e);
        border:1px solid rgba(59,130,246,0.2);border-radius:20px;overflow:hidden;
        display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,0.8);">

        <div style="padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
          <div>
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">🔌 MCP — ربط الأدوات والخدمات</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">Model Context Protocol — ${_tools.size} أداة مسجّلة</div>
          </div>
          <button onclick="MCPClient.closePanel()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px">×</button>
        </div>

        <!-- إضافة أداة مخصصة -->
        <div style="padding:16px 22px;border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0">
          <div style="font-size:12px;color:#64748b;margin-bottom:8px">إضافة أداة جديدة (MCP URL):</div>
          <div style="display:flex;gap:8px">
            <input id="mcp-new-url" placeholder="https://your-mcp-server.com/endpoint"
              style="flex:1;padding:9px 12px;border-radius:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;font-size:12px;outline:none"/>
            <button onclick="MCPClient._addFromURL()" style="
              padding:9px 16px;border-radius:10px;font-size:12px;cursor:pointer;font-family:inherit;
              background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);
              color:#93c5fd;transition:all 0.2s;
            ">ربط</button>
          </div>
        </div>

        <!-- الأدوات -->
        <div id="mcp-tools-grid" style="
          padding:16px 22px 22px;overflow-y:auto;flex:1;
          display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;
        "></div>
      </div>
    `;
    document.body.appendChild(el);
  }

  async function _addFromURL() {
    const url = document.getElementById('mcp-new-url')?.value?.trim();
    if (!url) return;
    try {
      const res = await fetch(url + '/tools/list', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const tools = data.tools || [];
      tools.forEach(t => {
        register({
          name: t.name,
          description: t.description || '',
          icon: '🔌',
          inputSchema: t.inputSchema || {},
          handler: async (args) => {
            const r = await fetch(url + '/tools/call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: t.name, arguments: args })
            });
            const d = await r.json();
            return d.content?.[0]?.text || JSON.stringify(d);
          }
        });
      });
      alert(`✅ تم ربط ${tools.length} أداة من ${url}`);
    } catch (e) {
      alert('❌ فشل الربط: ' + e.message);
    }
  }

  function _log(msg) {
    if (typeof Logger !== 'undefined') Logger.info('MCP', msg);
  }

  /* ── تفعيل ── */
  let _enabled = true;
  function isEnabled() { return _enabled; }
  function setEnabled(v) { _enabled = v; }

  return { register, unregister, call, list, processResponse, detectNeededTools, getToolsSystemPrompt, openPanel, closePanel, isEnabled, setEnabled, _testTool, _addFromURL };
})();
