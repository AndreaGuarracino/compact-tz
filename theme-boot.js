// Apply saved theme before first paint
try {
  const t = localStorage.getItem('ctz:theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  const fs = localStorage.getItem('ctz:fs');
  if (fs) document.documentElement.style.setProperty('--fs', fs + 'px');
} catch (e) { console.error('[ctz] theme boot failed', e); }
