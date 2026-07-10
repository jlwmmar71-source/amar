/* ══════════════════════════════════════════════
   upload.js — رفع وتحليل الملفات
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const IMG_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tiff'];

function isImageFile(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return IMG_EXTS.includes(ext);
}

/* ── قراءة صورة كـ Data URL (Base64) ── */
async function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = () => rej(new Error('فشل قراءة الصورة'));
    r.readAsDataURL(file);
  });
}

/* ── استخراج محتويات الملف (صورة / ZIP / نص) ── */
async function extractFiles(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  /* صورة: اقرأها كـ Base64 DataURL */
  if (IMG_EXTS.includes(ext)) {
    try {
      const dataUrl = await readAsDataURL(file);
      return [{ name: file.name, content: '', binary: false, isImage: true, dataUrl, mimeType: file.type || 'image/jpeg' }];
    } catch (e) {
      return [{ name: file.name, content: '', binary: true }];
    }
  }

  /* ZIP: فك الضغط وقراءة جميع الملفات */
  if (ext === 'zip') {
    if (typeof JSZip === 'undefined') throw new Error('مكتبة JSZip لم تُحمَّل، أعد تحميل الصفحة');
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    const results = [];

    for (const name in contents.files) {
      const entry = contents.files[name];
      if (!entry.dir) {
        if (isImageFile(name)) {
          try {
            const ab   = await entry.async('arraybuffer');
            const b64  = btoa(String.fromCharCode(...new Uint8Array(ab)));
            const mime = name.endsWith('.png') ? 'image/png' : name.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
            results.push({ name, content: '', binary: false, isImage: true, dataUrl: `data:${mime};base64,${b64}`, mimeType: mime });
          } catch { results.push({ name, content: '', binary: true }); }
        } else {
          try {
            const content = await entry.async('text');
            results.push({ name, content, binary: false });
          } catch { results.push({ name, content: '', binary: true }); }
        }
      }
    }
    return results;
  }

  /* نص عادي */
  try {
    const content = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = () => rej();
      r.readAsText(file, 'utf-8');
    });
    return [{ name: file.name, content, binary: false }];
  } catch {
    return [{ name: file.name, content: '', binary: true }];
  }
}

/* ── استخراج الملفات من رد الذكاء الاصطناعي ([FILE: name] ...content) ── */
function parseFilesFromReply(reply) {
  const blocks = reply.split(/\[FILE:\s*/);
  const files  = [];
  if (blocks.length > 1) {
    for (let i = 1; i < blocks.length; i++) {
      const b   = blocks[i];
      const end = b.indexOf(']');
      if (end !== -1) {
        const name    = b.substring(0, end).trim();
        let   content = b.substring(end + 1).trim();
        content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
        files.push({ name, content });
      }
    }
  }
  return files;
}
