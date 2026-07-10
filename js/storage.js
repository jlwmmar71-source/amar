/* ══════════════════════════════════════════════
   storage.js — إدارة التخزين المحلي
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

/* ── مفاتيح التخزين ── */
const CONVS_KEY  = 'galaoum_convs_v3';
const ACTIVE_KEY = 'galaoum_active_v3';
const MEMORY_KEY = 'galaoum_memory_v2';
const FACTS_KEY  = 'galaoum_facts_v2';

/* ── إدارة المحادثات ── */
function genId() {
  return 'c' + Date.now() + Math.random().toString(36).slice(2, 6);
}

function getConvs() {
  try { return JSON.parse(localStorage.getItem(CONVS_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveConvs(c) {
  try { localStorage.setItem(CONVS_KEY, JSON.stringify(c)); }
  catch (e) {}
}

function getActiveId() {
  return localStorage.getItem(ACTIVE_KEY) || '';
}

function setActiveId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

/* ── إدارة الذاكرة (سياق المحادثة) ── */
function loadMemory() {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveMemory(userMsg, botReply) {
  try {
    const mem = loadMemory();
    mem.push({ role: 'user',      content: String(userMsg).substring(0, 2000) });
    mem.push({ role: 'assistant', content: String(botReply).substring(0, 3000) });
    /* احتفظ بآخر 100 رسالة (50 تبادلاً) */
    localStorage.setItem(MEMORY_KEY, JSON.stringify(mem.slice(-100)));
  } catch (e) {}
}

function clearMemory() {
  try {
    localStorage.removeItem(MEMORY_KEY);
    localStorage.removeItem(FACTS_KEY);
  } catch (e) {}
}
