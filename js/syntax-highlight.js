/* ══════════════════════════════════════════════
   syntax-highlight.js — تلوين الكود + زر النسخ
   Galaoum AI Engine v6.0 — by عمار جلعوم
   ══════════════════════════════════════════════ */

window.SyntaxHighlight = (function () {

  /* ─── خريطة الألوان البسيطة لكل لغة ─── */
  const KEYWORDS = {
    js:     /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|typeof|null|undefined|true|false|throw|try|catch|finally)\b/g,
    py:     /\b(def|class|import|from|return|if|elif|else|for|while|with|as|try|except|finally|True|False|None|and|or|not|in|is|lambda|pass|break|continue|raise|yield)\b/g,
    html:   null,
    css:    null,
    generic:/\b(function|return|if|else|for|while|class|import|export|const|let|var|def|true|false|null|undefined)\b/g
  };

  function _detectLang(code, hint) {
    if (hint) {
      if (/^(js|javascript|typescript|ts|jsx|tsx|node)$/i.test(hint)) return 'js';
      if (/^(py|python)$/i.test(hint))   return 'py';
      if (/^(html?)$/i.test(hint))       return 'html';
      if (/^css$/i.test(hint))           return 'css';
      if (/^(sql)$/i.test(hint))         return 'sql';
    }
    if (/^(def |import |from |print\(|class )/.test(code)) return 'py';
    if (/^(<!DOCTYPE|<html|<head|<body)/i.test(code))       return 'html';
    if (/(function|const |let |var |=>|require\()/.test(code)) return 'js';
    if (/\{[^}]*:[^}]*;/.test(code))                       return 'css';
    return 'generic';
  }

  function _escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _highlight(code, lang) {
    let escaped = _escHtml(code);

    /* ─ strings ─ */
    escaped = escaped.replace(/(&#34;|&quot;)(.*?)(&#34;|&quot;)/g,
      '<span style="color:#86efac">$1$2$3</span>');
    escaped = escaped.replace(/(&#39;|')(.*?)(&#39;|')/g,
      '<span style="color:#86efac">$1$2$3</span>');
    escaped = escaped.replace(/(`[^`]*`)/g,
      '<span style="color:#86efac">$1</span>');

    /* ─ comments ─ */
    escaped = escaped.replace(/(\/\/[^\n]*)/g,
      '<span style="color:#6b7280;font-style:italic">$1</span>');
    escaped = escaped.replace(/(#[^\n]*)/g,
      '<span style="color:#6b7280;font-style:italic">$1</span>');

    /* ─ numbers ─ */
    escaped = escaped.replace(/\b(\d+(\.\d+)?)\b/g,
      '<span style="color:#fbbf24">$1</span>');

    /* ─ keywords ─ */
    const kwPat = KEYWORDS[lang] || KEYWORDS.generic;
    if (kwPat) {
      escaped = escaped.replace(kwPat,
        '<span style="color:#a78bfa;font-weight:600">$1</span>');
    }

    /* ─ HTML tags ─ */
    if (lang === 'html') {
      escaped = escaped.replace(/(&lt;\/?[\w-]+([\s][^&gt;]*)?&gt;)/g,
        '<span style="color:#60a5fa">$1</span>');
    }

    /* ─ CSS properties ─ */
    if (lang === 'css') {
      escaped = escaped.replace(/([\w-]+)(\s*:)/g,
        '<span style="color:#67e8f9">$1</span>$2');
    }

    return escaped;
  }

  /* ─── معالجة كتلة كود واحدة ─── */
  function _processBlock(pre) {
    if (pre.dataset.highlighted) return;
    pre.dataset.highlighted = '1';

    const code    = pre.querySelector('code');
    const content = code ? code.textContent : pre.textContent;
    const hint    = code?.className?.replace('language-','') || '';
    const lang    = _detectLang(content, hint);

    /* إنشاء الـ wrapper */
    const wrapper = document.createElement('div');
    wrapper.className = 'sh-wrapper';
    wrapper.style.cssText = 'position:relative;margin:10px 0;border-radius:10px;overflow:hidden;border:1px solid rgba(124,58,237,.2);';

    /* شريط العنوان */
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(0,0,0,.4);border-bottom:1px solid rgba(255,255,255,.06);';
    bar.innerHTML = `
      <span style="font-size:11px;color:#475569;font-family:monospace">${lang.toUpperCase() || 'CODE'}</span>
      <button class="sh-copy-btn" title="نسخ الكود" onclick="SyntaxHighlight.copyCode(this)" style="
        display:flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;
        background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);
        color:#a78bfa;font-size:11px;cursor:pointer;font-family:inherit;transition:all .2s;
      " onmouseover="this.style.background='rgba(124,58,237,.3)'" onmouseout="this.style.background='rgba(124,58,237,.15)'">
        📋 نسخ
      </button>`;

    /* محتوى الكود */
    const highlighted = _highlight(content, lang);
    const codeEl      = document.createElement('pre');
    codeEl.style.cssText = 'margin:0;padding:14px;overflow-x:auto;font-size:12px;line-height:1.7;font-family:"Fira Code",Consolas,monospace;background:rgba(0,0,0,.35);color:#e2e8f0;white-space:pre;';
    codeEl.innerHTML = highlighted;
    codeEl.dataset.raw = content; // للنسخ

    wrapper.appendChild(bar);
    wrapper.appendChild(codeEl);

    pre.replaceWith(wrapper);
  }

  /* ─── نسخ الكود ─── */
  function copyCode(btn) {
    const pre = btn.closest('.sh-wrapper')?.querySelector('pre');
    if (!pre) return;
    const text = pre.dataset.raw || pre.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const old = btn.innerHTML;
      btn.innerHTML = '✅ تم النسخ';
      btn.style.color = '#4ade80';
      setTimeout(() => { btn.innerHTML = old; btn.style.color = '#a78bfa'; }, 1500);
    }).catch(() => {
      /* fallback */
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      btn.innerHTML = '✅ نُسخ'; setTimeout(() => btn.innerHTML = '📋 نسخ', 1500);
    });
  }

  /* ─── مراقبة رسائل جديدة ─── */
  function _observe() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          node.querySelectorAll('pre:not([data-highlighted])').forEach(_processBlock);
        }
      }
      /* معالجة أي pre موجودة لم تُعالَج */
      chatBox.querySelectorAll('pre:not([data-highlighted])').forEach(_processBlock);
    });

    obs.observe(chatBox, { childList: true, subtree: true });

    /* معالجة ما هو موجود مسبقاً */
    chatBox.querySelectorAll('pre').forEach(_processBlock);
  }

  function init() { _observe(); }

  return { init, copyCode };
})();
