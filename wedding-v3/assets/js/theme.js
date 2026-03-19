/**
 * theme.js — Wedding page colour themes
 *
 * Usage: set THEME below, then include this script before gw.css in <head>.
 * The chosen theme's CSS variables are injected into :root at runtime.
 *
 * Available themes: 'gold' | 'burgundy'
 */

(function () {
  const THEME = 'gold'; // ← change to 'gold' to restore original palette

  const THEMES = {
    gold: {
      '--accent':        '#b8923a',
      '--accent-dk':     '#8f6e27',
      '--accent-lt':     'rgba(184, 146, 58, 0.10)',
      '--accent-shadow': 'rgba(184, 146, 58, 0.35)',
    },
    burgundy: {
      '--accent':        '#8C1C13',
      '--accent-dk':     '#6E1510',
      '--accent-lt':     'rgba(140, 28, 19, 0.08)',
      '--accent-shadow': 'rgba(140, 28, 19, 0.30)',
    },
  };

  const palette = THEMES[THEME] || THEMES.burgundy;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(palette)) {
    root.style.setProperty(key, val);
  }
})();
