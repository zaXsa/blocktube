// Pre-paint theme bootstrap for the options page.
//
// options.html loads CodeMirror, tables, and options.js (which reads the
// theme from chrome.storage.local asynchronously) before it can set
// `data-theme`. Until then the CSS variables are undefined and Chrome paints
// a white viewport for a frame — the F5 white flash on dark theme.
//
// This file runs synchronously from <head>, before the stylesheets, so the
// correct `data-theme` is already present when style.css first applies. The
// stored preference cannot be read synchronously (chrome.storage is async),
// so detectColorScheme() in options.js caches the resolved theme in
// localStorage on every apply; here that cache wins, otherwise the OS
// preference is used. options.js still reconciles with chrome.storage after
// load, so a stale cache self-corrects within the same paint sequence.
//
// MV3 extension pages block inline scripts, hence this separate file.
(function () {
  var theme = null;
  try {
    theme = window.localStorage.getItem('blocktube-theme');
  } catch (e) {
    theme = null;
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
  // Belt-and-braces for the gap before style.css loads: paint the viewport
  // directly so even a pre-CSS frame uses the theme background.
  document.documentElement.style.backgroundColor = theme === 'dark' ? 'rgb(15, 15, 15)' : '#ffffff';
  document.documentElement.style.colorScheme = theme;
})();
