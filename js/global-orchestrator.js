/* ══════════════════════════════════════════════════════════════
   global-orchestrator.js — المنسّق العام (Global Orchestrator)
   العقل الرئيسي: يدير كل الأنظمة، ينسّق الوكلاء، ويتخذ القرار النهائي
   Galaoum AI Engine v5.0 — إضافة جديدة (يجمع كل الأنظمة الجديدة)
   ══════════════════════════════════════════════════════════════ */

window.GlobalOrchestrator = (function () {

  /* ── تنفيذ مهمة كاملة عبر جميع الأنظمة الجديدة بشكل متناسق ──
     task: { type, prompt }, agentCallFns: { providerName: fn } */
  async function orchestrate(task, agentCallFns = {}) {
    const snapshotId = (typeof RollbackEngine !== 'undefined')
      ? RollbackEngine.checkpoint('قبل تنفيذ: ' + (task.type || 'مهمة'))
      : null;

    try {
      /* 1) اختيار أفضل مزود/نموذج معروف للمهمة */
      let preferredModel = null;
      if (typeof CapabilityRegistry !== 'undefined') {
        const best = CapabilityRegistry.bestFor(task.type);
        preferredModel = best ? best.modelId : null;
      }

      /* 2) تسجيل/تحديث المزودين في البوابة الموحّدة (تحديث دائم لضمان
            استخدام أحدث سياق محادثة عند كل استدعاء، لا نسخة قديمة مخزّنة) */
      if (typeof ProviderGateway !== 'undefined') {
        for (const [name, fn] of Object.entries(agentCallFns)) {
          ProviderGateway.registerProvider(name, fn);
        }
      }

      /* 3) [FIX] لا نستبدل سؤال المستخدم بأي صيغة "محفوظة" —
            PromptOptimizer.bestPrompt كانت تُرجع أول سؤال محفوظ لنفس
            نوع المهمة (مثلاً 'chat') بدل السؤال الحالي، فكل الأسئلة
            كانت تحصل على نفس الجواب. نستخدم سؤال المستخدم كما هو دائماً. */
      let prompt = task.prompt;

      /* 4) الاستدعاء الفعلي عبر البوابة الموحّدة (مع تفضيل الأفضل معرفياً) */
      const providerOrder = preferredModel
        ? [preferredModel, ...Object.keys(agentCallFns).filter(n => n !== preferredModel)]
        : Object.keys(agentCallFns);

      const gatewayResult = (typeof ProviderGateway !== 'undefined')
        ? await ProviderGateway.call(prompt, { providers: providerOrder, taskType: task.type })
        : { ok: false, errors: ['ProviderGateway غير متوفر'] };

      if (!gatewayResult.ok) {
        throw new Error('فشل جميع المزودين: ' + JSON.stringify(gatewayResult.errors));
      }

      /* 5) فحص الجودة عبر QualityGate الأصلي إن وُجد */
      let qualityOk = true;
      if (typeof QualityGate !== 'undefined' && QualityGate.check) {
        const q = QualityGate.check(gatewayResult.output, task);
        qualityOk = q ? q.passed !== false : true;
      }

      /* 6) تسجيل نتيجة التعلّم */
      if (typeof AILearningEngine !== 'undefined') {
        AILearningEngine.recordDecision(task.type, gatewayResult.provider, qualityOk, qualityOk ? 80 : 30);
      }

      return {
        ok: qualityOk,
        provider: gatewayResult.provider,
        output: gatewayResult.output,
        latencyMs: gatewayResult.latencyMs,
        snapshotId
      };
    } catch (err) {
      /* 7) تراجع تلقائي عند فشل حرج إن رغبنا بذلك */
      return { ok: false, error: String(err), snapshotId };
    }
  }

  /* ── تنسيق عدة وكلاء عبر LiveCollaboration ثم تقييم النتائج بالإجماع ── */
  async function orchestrateCollaborative(task, agents) {
    if (typeof LiveCollaboration === 'undefined') {
      throw new Error('LiveCollaboration غير متوفر');
    }
    const { results, merged } = await LiveCollaboration.collaborate(task.prompt, agents);
    return { results, merged };
  }

  return { orchestrate, orchestrateCollaborative };
})();
