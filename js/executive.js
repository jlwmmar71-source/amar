/* ══════════════════════════════════════════════════════════════
   executive.js — المدير الرئيسي للنظام (Executive Controller)
   يستقبل جميع الطلبات ويوجّهها عبر الأنظمة المناسبة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.Executive = (function () {
  /* ── سجل العمليات الجارية ── */
  const _activeOps   = new Map();   // opId → operationState
  const _history     = [];          // آخر 100 عملية
  let   _opCounter   = 0;

  /* ── إنشاء معرّف فريد للعملية ── */
  function _newId() {
    return `op_${Date.now()}_${++_opCounter}`;
  }

  /* ── تسجيل بداية عملية ── */
  function _startOp(task, meta = {}) {
    const id = _newId();
    const op = {
      id,
      task,
      meta,
      status:    'pending',   // pending | running | done | failed
      startTime: Date.now(),
      endTime:   null,
      steps:     [],
      result:    null,
      error:     null,
      retries:   0
    };
    _activeOps.set(id, op);
    Logger.info('EXEC', `▶ بدء العملية ${id}: "${String(task).substring(0, 60)}"`);
    _updateStatusBar(op);
    return op;
  }

  /* ── تحديث حالة العملية ── */
  function _updateOp(op, patch) {
    Object.assign(op, patch);
    _updateStatusBar(op);
  }

  /* ── إنهاء العملية ── */
  function _endOp(op, result, error = null) {
    op.endTime = Date.now();
    op.status  = error ? 'failed' : 'done';
    op.result  = result;
    op.error   = error;
    _activeOps.delete(op.id);
    _history.unshift({ ...op });
    if (_history.length > 100) _history.pop();
    _updateStatusBar(null);

    const elapsed = op.endTime - op.startTime;
    if (error) {
      Logger.error('EXEC', `✗ فشلت العملية ${op.id} بعد ${elapsed}ms: ${error}`);
    } else {
      Logger.info('EXEC', `✓ انتهت العملية ${op.id} في ${elapsed}ms`);
    }
  }

  /* ── تحديث شريط الحالة في الواجهة ── */
  function _updateStatusBar(op) {
    const bar  = document.getElementById('agent-status-bar');
    const text = document.getElementById('agent-status-text');
    if (!bar || !text) return;

    if (!op) {
      bar.style.opacity = '0';
      return;
    }
    bar.style.opacity = '1';
    const stateLabels = {
      pending:  '⏳ جاري التحليل...',
      running:  '⚡ جاري التنفيذ...',
      done:     '✅ اكتمل',
      failed:   '❌ فشل'
    };
    text.textContent = stateLabels[op.status] || op.status;
  }

  /* ═══════════════════════════════════════════════════════
     النقطة الرئيسية: معالجة أي طلب وارد
     ═══════════════════════════════════════════════════════ */
  async function process(userMessage, options = {}) {
    const op = _startOp(userMessage, options);
    _updateOp(op, { status: 'running' });

    try {
      /* 1. قرار أولي بواسطة Decision Engine */
      const decision = typeof DecisionEngine !== 'undefined'
        ? DecisionEngine.decide(userMessage)
        : { model: 'default', tools: [], needsSearch: false };

      op.steps.push({ name: 'decision', result: decision, time: Date.now() });
      Logger.info('EXEC', `🎯 القرار: نموذج=${decision.model}, أدوات=${decision.tools.join(',')}`);

      /* 2. تنفيذ Workflow */
      let workflowResult;
      if (typeof WorkflowEngine !== 'undefined') {
        workflowResult = await WorkflowEngine.run(userMessage, decision, op);
      } else {
        workflowResult = { output: null, stages: [] };
      }
      op.steps.push({ name: 'workflow', result: workflowResult, time: Date.now() });

      /* 3. Quality Gate */
      let gatePass = true;
      if (typeof QualityGate !== 'undefined' && workflowResult.output) {
        gatePass = QualityGate.check(workflowResult.output, userMessage);
      }
      op.steps.push({ name: 'quality_gate', result: gatePass, time: Date.now() });

      /* 4. توثيق تلقائي */
      if (typeof DocsGenerator !== 'undefined') {
        DocsGenerator.recordChange({
          task:    userMessage,
          opId:    op.id,
          stages:  workflowResult.stages || [],
          success: gatePass
        });
      }

      /* 5. تقرير نهائي */
      const report = _buildReport(op, workflowResult, gatePass, decision);
      _endOp(op, report);
      return report;

    } catch (err) {
      /* إعادة المحاولة حتى مرتين */
      if (op.retries < 2) {
        op.retries++;
        Logger.warn('EXEC', `⟳ إعادة المحاولة ${op.retries}/2 للعملية ${op.id}`);
        _updateOp(op, { status: 'pending' });
        return process(userMessage, { ...options, _retry: op.retries });
      }
      _endOp(op, null, String(err));
      if (typeof SelfHealingEngine !== 'undefined') {
        SelfHealingEngine.analyze(String(err), userMessage);
      }
      return { success: false, error: String(err), opId: op.id };
    }
  }

  /* ── بناء التقرير النهائي ── */
  function _buildReport(op, workflowResult, gatePass, decision) {
    return {
      success:    true,
      opId:       op.id,
      task:       op.task,
      decision,
      stages:     workflowResult.stages || [],
      output:     workflowResult.output,
      gatePass,
      retries:    op.retries,
      elapsed:    op.endTime ? op.endTime - op.startTime : 0,
      timestamp:  new Date().toISOString()
    };
  }

  /* ── واجهة المدير العام ── */
  return {
    process,

    /* إحصاءات العمليات */
    stats() {
      return {
        active:  _activeOps.size,
        history: _history.length,
        last:    _history[0] || null
      };
    },

    /* آخر N عمليات */
    getHistory(n = 10) {
      return _history.slice(0, n);
    },

    /* إلغاء جميع العمليات الجارية */
    cancelAll() {
      _activeOps.forEach(op => {
        op.status = 'failed';
        op.error  = 'تم الإلغاء يدوياً';
      });
      _activeOps.clear();
      _updateStatusBar(null);
      Logger.warn('EXEC', '⚠️ تم إلغاء جميع العمليات الجارية');
    }
  };
})();
