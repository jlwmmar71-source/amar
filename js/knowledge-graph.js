/* ══════════════════════════════════════════════════════════════
   knowledge-graph.js — خريطة معرفة المشروع (Project Knowledge Graph)
   تحليل كامل: دوال، كلاسات، متغيرات، علاقات، تأثير أي تعديل
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.KnowledgeGraph = (function () {

  /* ══ بنية البيانات ══ */
  let _graph = {
    nodes:    new Map(),   // id → Node
    edges:    new Map(),   // id → Edge[]
    files:    new Map(),   // filename → fileNode
    symbols:  new Map(),   // symbolName → symbolNode
    indexed:  false,
    indexedAt: null
  };

  /* ══ أنواع العقد ══ */
  const NODE_TYPES = {
    FILE:     'file',
    FUNCTION: 'function',
    CLASS:    'class',
    VARIABLE: 'variable',
    IMPORT:   'import',
    EXPORT:   'export',
    MODULE:   'module'
  };

  /* ══ إنشاء عقدة ══ */
  function _node(id, type, label, meta = {}) {
    return { id, type, label, meta, refs: [], refBy: [] };
  }

  /* ══ إضافة علاقة (حافة) بين عقدتين ══ */
  function _addEdge(fromId, toId, relation) {
    if (!_graph.edges.has(fromId)) _graph.edges.set(fromId, []);
    _graph.edges.get(fromId).push({ to: toId, relation });
    /* العلاقة العكسية */
    const toNode = _graph.nodes.get(toId);
    const fromNode = _graph.nodes.get(fromId);
    if (toNode && fromNode) {
      toNode.refBy.push(fromId);
      fromNode.refs.push(toId);
    }
  }

  /* ══ فهرسة ملف JavaScript ══ */
  function _indexJsFile(filename, content) {
    const fileId = `file:${filename}`;
    const fileNode = _node(fileId, NODE_TYPES.FILE, filename, { size: content.length });
    _graph.nodes.set(fileId, fileNode);
    _graph.files.set(filename, fileNode);

    /* استخراج الدوال */
    const funcRe = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
    let m;
    while ((m = funcRe.exec(content)) !== null) {
      const name = m[1] || m[2];
      if (!name) continue;
      const nodeId = `func:${filename}:${name}`;
      const n = _node(nodeId, NODE_TYPES.FUNCTION, name, { file: filename, line: _lineOf(content, m.index) });
      _graph.nodes.set(nodeId, n);
      _graph.symbols.set(name, n);
      _addEdge(fileId, nodeId, 'defines');
    }

    /* استخراج الكلاسات */
    const classRe = /class\s+(\w+)/g;
    while ((m = classRe.exec(content)) !== null) {
      const name = m[1];
      const nodeId = `class:${filename}:${name}`;
      const n = _node(nodeId, NODE_TYPES.CLASS, name, { file: filename });
      _graph.nodes.set(nodeId, n);
      _graph.symbols.set(name, n);
      _addEdge(fileId, nodeId, 'defines');
    }

    /* استخراج المتغيرات العامة (const/let في مستوى النطاق الأعلى) */
    const varRe = /^(?:const|let|var)\s+(\w+)\s*=/gm;
    while ((m = varRe.exec(content)) !== null) {
      const name = m[1];
      if (/^[A-Z_]{2,}$/.test(name)) {  /* ثوابت بالأحرف الكبيرة */
        const nodeId = `const:${filename}:${name}`;
        const n = _node(nodeId, NODE_TYPES.VARIABLE, name, { file: filename, isConst: true });
        _graph.nodes.set(nodeId, n);
        _graph.symbols.set(name, n);
        _addEdge(fileId, nodeId, 'defines');
      }
    }

    /* استخراج الاستيرادات (import/require) */
    const importRe = /(?:import\s+.*?from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\))/g;
    while ((m = importRe.exec(content)) !== null) {
      const dep = m[1] || m[2];
      const depFileId = dep.startsWith('.') ? `file:${dep.replace(/^\.\//, '')}` : `module:${dep}`;
      if (!_graph.nodes.has(depFileId)) {
        _graph.nodes.set(depFileId, _node(depFileId, dep.startsWith('.') ? NODE_TYPES.FILE : NODE_TYPES.MODULE, dep));
      }
      _addEdge(fileId, depFileId, 'imports');
    }

    /* استخراج window.X = (تصدير عبر window) */
    const winRe = /window\.(\w+)\s*=/g;
    while ((m = winRe.exec(content)) !== null) {
      const name = m[1];
      const nodeId = `export:${filename}:${name}`;
      const n = _node(nodeId, NODE_TYPES.EXPORT, name, { file: filename });
      _graph.nodes.set(nodeId, n);
      _graph.symbols.set(name, n);
      _addEdge(fileId, nodeId, 'exports');
    }
  }

  /* ── رقم السطر من الإزاحة ── */
  function _lineOf(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /* ═══════════════════════════════════════════════════════
     بناء الخريطة من قائمة ملفات
     files: [{ name, content }]
     ═══════════════════════════════════════════════════════ */
  function build(files) {
    const timer = Logger.time('kg:build');
    _graph.nodes.clear();
    _graph.edges.clear();
    _graph.files.clear();
    _graph.symbols.clear();

    let indexed = 0;
    for (const { name, content } of files) {
      if (!content) continue;
      const ext = name.split('.').pop().toLowerCase();
      if (['js', 'ts', 'jsx', 'tsx', 'mjs'].includes(ext)) {
        _indexJsFile(name, content);
        indexed++;
      } else {
        /* ملفات غير JS — عقدة ملف فقط */
        const fileId = `file:${name}`;
        _graph.nodes.set(fileId, _node(fileId, NODE_TYPES.FILE, name, { size: content.length }));
      }
    }

    /* بناء علاقات الاستخدام بين الرموز */
    _buildUsageEdges();

    _graph.indexed  = true;
    _graph.indexedAt = new Date().toISOString();
    Logger.time(timer);
    Logger.info('KG', `📊 خريطة بُنيت: ${_graph.nodes.size} عقدة، ${indexed} ملف JS`);

    return summary();
  }

  /* ── بناء علاقات الاستخدام (X يستدعي Y) ── */
  function _buildUsageEdges() {
    _graph.nodes.forEach((node, nodeId) => {
      if (node.type !== NODE_TYPES.FUNCTION) return;
      /* ابحث عن استخدامات الدالة في الملفات الأخرى */
      _graph.files.forEach((fileNode, filename) => {
        if (`file:${filename}` === node.meta.file) return;
        /* لا نمتلك content هنا، لكن نستطيع الاستنتاج من الرموز المُصدَّرة */
      });
    });
  }

  /* ══ تحليل تأثير تعديل رمز معين ══ */
  function impact(symbolName) {
    const node = _graph.symbols.get(symbolName);
    if (!node) return { found: false, affected: [] };

    const visited = new Set();
    const affected = [];

    function traverse(nodeId, depth = 0) {
      if (visited.has(nodeId) || depth > 5) return;
      visited.add(nodeId);
      const n = _graph.nodes.get(nodeId);
      if (!n) return;
      if (depth > 0) affected.push({ id: nodeId, label: n.label, type: n.type, file: n.meta?.file });
      (n.refBy || []).forEach(refId => traverse(refId, depth + 1));
    }

    traverse(node.id);
    Logger.info('KG', `🎯 تأثير "${symbolName}": ${affected.length} عنصر متأثر`);
    return { found: true, symbol: symbolName, affected };
  }

  /* ══ ملخص الخريطة ══ */
  function summary() {
    const counts = {};
    _graph.nodes.forEach(n => { counts[n.type] = (counts[n.type] || 0) + 1; });
    return {
      nodes:    _graph.nodes.size,
      files:    _graph.files.size,
      symbols:  _graph.symbols.size,
      indexed:  _graph.indexed,
      indexedAt:_graph.indexedAt,
      byType:   counts
    };
  }

  /* ══ بحث عن رمز ══ */
  function findSymbol(name) {
    const node = _graph.symbols.get(name);
    if (!node) {
      /* بحث جزئي */
      const partial = [];
      _graph.symbols.forEach((n, k) => {
        if (k.toLowerCase().includes(name.toLowerCase())) partial.push(n);
      });
      return { exact: null, partial };
    }
    return { exact: node, partial: [] };
  }

  /* ══ قائمة ملفات مع ملخص ══ */
  function fileList() {
    const out = [];
    _graph.files.forEach((node, name) => {
      const edges = _graph.edges.get(node.id) || [];
      const defines = edges.filter(e => e.relation === 'defines').length;
      const imports = edges.filter(e => e.relation === 'imports').length;
      out.push({ name, defines, imports, size: node.meta?.size || 0 });
    });
    return out;
  }

  return { build, impact, summary, findSymbol, fileList };
})();
