/**
 * shared-nav.js — Navigation, theme toggle, localStorage save/load, autosave
 *
 * Each page calls: initSharedNav({ key, getState, setState, onSave, onLoad })
 */

(function () {

  // ── Detect Express (path-based) vs static file hosting
  function resolveHref(name) {
    const isFileBased = window.location.pathname.endsWith('.html') || window.location.protocol === 'file:';
    return isFileBased ? name + '.html' : '/' + name;
  }

  // ── Highlight active nav link
  function highlightNav() {
    const path = window.location.pathname.replace(/\/$/, '').replace(/\.html$/, '');
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href').replace(/\/$/, '').replace(/\.html$/, '');
      link.classList.toggle('active',
        path === href || path.endsWith('/' + href.split('/').pop())
      );
    });
  }

  // ══════════════════════════════════════════
  // THEME TOGGLE
  // ══════════════════════════════════════════
  // Each page sets its default via data-theme on <html>.
  // The toggle flips between dark and light and persists per-page.

  function getThemeKey() {
    // unique key per page so homestay/wedding remember independently
    const page = window.location.pathname.split('/').pop().replace('.html','') || 'index';
    return 'theme:' + page;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    const icon = btn.querySelector('.toggle-icon');
    if (theme === 'dark') {
      icon.textContent = '☀️';
      btn.title = 'Switch to light mode';
    } else {
      icon.textContent = '🌙';
      btn.title = 'Switch to dark mode';
    }
  }

  function initTheme() {
    const defaultTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const saved = localStorage.getItem(getThemeKey());
    applyTheme(saved || defaultTheme);
  }

  // ══════════════════════════════════════════
  // COLLAPSIBLE SIDEBAR SECTIONS
  // ══════════════════════════════════════════
  // Finds every .sb-section.collapsible, wraps children (after title)
  // in .sb-section-body, and wires click to toggle .open

  function initCollapsibles() {
    document.querySelectorAll('.sb-section.collapsible').forEach(section => {
      const title = section.querySelector('.sb-title');
      if (!title) return;

      // Add arrow indicator
      const arrow = document.createElement('span');
      arrow.className = 'collapse-arrow';
      arrow.textContent = '▼';
      title.appendChild(arrow);

      // Wrap all sibling content after title into .sb-section-body
      const body = document.createElement('div');
      body.className = 'sb-section-body';
      // Move all children except the title into the body
      Array.from(section.children).forEach(child => {
        if (child !== title) body.appendChild(child);
      });
      section.appendChild(body);

      // Restore open/closed state from localStorage
      const stateKey = 'collapse:' + (section.dataset.collapseKey || title.textContent.trim().slice(0,20));
      const isOpen = localStorage.getItem(stateKey) !== 'closed';
      if (isOpen) section.classList.add('open');

      title.addEventListener('click', () => {
        const opening = !section.classList.contains('open');
        section.classList.toggle('open', opening);
        localStorage.setItem(stateKey, opening ? 'open' : 'closed');
      });
    });
  }

  // ══════════════════════════════════════════
  // BUILD NAV
  // ══════════════════════════════════════════
  function buildNav() {
    const nav = document.createElement('nav');
    nav.className = 'app-nav';
    nav.innerHTML = `
      <a class="nav-brand" href="${resolveHref('../index')}">🏠💒 Planners</a>
      <div class="nav-links">
        <a class="nav-link" href="${resolveHref('homestay')}">🏠 Homestay</a>
        <a class="nav-link" href="${resolveHref('wedding')}">💒 Wedding</a>
        <a class="nav-link" href="${resolveHref('seat-finder')}" target="_blank">🔗 Seat Finder</a>
      </div>
      <div class="nav-save-status">
        <button class="theme-toggle" id="theme-toggle-btn" title="Toggle theme">
          <span class="toggle-icon">☀️</span>
          <span id="theme-label">Theme</span>
        </button>
        <button class="autosave-toggle" id="autosave-btn" title="Toggle auto-save every 30s">
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
          <span id="autosave-label">Auto-save</span>
        </button>
        <span class="save-dot" id="save-dot"></span>
        <span id="save-label">Not saved</span>
        <button
          style="margin-left:4px;background:none;border:1px solid #2a3448;border-radius:6px;color:#6b7a99;cursor:pointer;padding:3px 9px;font-size:11px;font-family:inherit;transition:all .15s"
          id="manual-save-btn"
          onmouseover="this.style.borderColor='#f0c060';this.style.color='#f0c060'"
          onmouseout="this.style.borderColor='#2a3448';this.style.color='#6b7a99'"
        >💾 Save</button>
        <button
          style="background:none;border:1px solid #2a3448;border-radius:6px;color:#6b7a99;cursor:pointer;padding:3px 9px;font-size:11px;font-family:inherit;transition:all .15s"
          id="clear-storage-btn"
          title="Clear saved data"
          onmouseover="this.style.borderColor='#f06060';this.style.color='#f06060'"
          onmouseout="this.style.borderColor='#2a3448';this.style.color='#6b7a99'"
        >🗑 Clear</button>
      </div>
    `;
    document.body.insertBefore(nav, document.body.firstChild);
    highlightNav();

    // Wire theme toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(getThemeKey(), next);
    });
  }

  // ── Status helpers
  function setStatus(dot, label, dotClass, text) {
    dot.className = 'save-dot ' + dotClass;
    label.textContent = text;
  }

  // ══════════════════════════════════════════
  // PUBLIC INIT
  // ══════════════════════════════════════════
  window.initSharedNav = function (cfg) {
    const { key, getState, setState, onSave, onLoad } = cfg;

    buildNav();
    initTheme();
    initCollapsibles();

    const dot       = document.getElementById('save-dot');
    const label     = document.getElementById('save-label');
    const autoBtn   = document.getElementById('autosave-btn');
    const autoLabel = document.getElementById('autosave-label');
    const saveBtn   = document.getElementById('manual-save-btn');
    const clearBtn  = document.getElementById('clear-storage-btn');

    let autoSaveEnabled = (localStorage.getItem(key + ':autosave') !== 'false');
    let autoSaveTimer   = null;

    function applyAutoSaveUI() {
      autoBtn.classList.toggle('on', autoSaveEnabled);
      autoLabel.textContent = autoSaveEnabled ? 'Auto-save ON' : 'Auto-save OFF';
      if (autoSaveEnabled) scheduleAutoSave();
      else clearInterval(autoSaveTimer);
    }

    function scheduleAutoSave() {
      clearInterval(autoSaveTimer);
      if (autoSaveEnabled) autoSaveTimer = setInterval(saveToStorage, 30_000);
    }

    function saveToStorage() {
      try {
        localStorage.setItem(key, JSON.stringify(getState()));
        localStorage.setItem(key + ':savedAt', new Date().toISOString());
        const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setStatus(dot, label, 'saved', `Saved ${t}`);
        if (onSave) onSave();
      } catch (e) {
        setStatus(dot, label, 'error', 'Save failed!');
        console.error('localStorage save error:', e);
      }
    }

    function loadFromStorage() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) { setStatus(dot, label, '', 'No saved data'); return false; }
        setState(JSON.parse(raw));
        const savedAt = localStorage.getItem(key + ':savedAt');
        const t = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?';
        setStatus(dot, label, 'saved', `Restored ${t}`);
        if (onLoad) onLoad();
        return true;
      } catch (e) {
        setStatus(dot, label, 'error', 'Load error');
        console.error('localStorage load error:', e);
        return false;
      }
    }

    window.markUnsaved = function () {
      setStatus(dot, label, 'unsaved', 'Unsaved changes');
      if (autoSaveEnabled) scheduleAutoSave();
    };

    autoBtn.addEventListener('click', () => {
      autoSaveEnabled = !autoSaveEnabled;
      localStorage.setItem(key + ':autosave', String(autoSaveEnabled));
      applyAutoSaveUI();
    });

    saveBtn.addEventListener('click', saveToStorage);

    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all saved data for this planner? This cannot be undone.')) {
        localStorage.removeItem(key);
        localStorage.removeItem(key + ':savedAt');
        setStatus(dot, label, '', 'Cleared');
      }
    });

    applyAutoSaveUI();
    loadFromStorage();
  };

})();