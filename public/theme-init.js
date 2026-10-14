// Applique le thème et la direction avant le premier rendu (évite le flash)
try {
  var p = JSON.parse(localStorage.getItem('fh:prefs') || '{}');
  var t = p.theme || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
  if ((localStorage.getItem('fh:lang') || navigator.language || '').slice(0, 2) === 'ar') { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; }
} catch (e) {}
