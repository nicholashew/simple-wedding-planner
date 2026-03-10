/**
 * gw.js — Shared utilities for all public-facing wedding pages
 *
 * Exposes globals:
 *   GW.config   — loaded config.json
 *   GW.guests   — loaded guests.json guest array
 *   GW.lang     — current language ('en' | 'zh')
 *   GW.setLang(lang)
 *   GW.t(key)   — get translation string
 *   GW.loadData() — Promise that resolves after config + guests loaded
 *   GW.getCatColor(catKey) — color for a guest category
 *   GW.encodeGuestIds(ids) — encode guest id array for QR
 *   GW.decodeGuestIds(str) — decode QR string to id array
 */

(function () {
  const DATA_BASE = '/assets/data/';

  // ── Category colours (matches wedding planner palette)
  const CAT_COLORS = [
    '#e07070', '#e09050', '#c8a84a', '#70b870',
    '#60a8e0', '#9070c8', '#e07090', '#60c8b8',
  ];

  function getCatColor(catKey, categories) {
    if (!categories) return '#9a9590';
    const idx = categories.findIndex(c => c.key === catKey);
    return idx >= 0 ? CAT_COLORS[idx % CAT_COLORS.length] : '#9a9590';
  }

  // ── QR encoding/decoding
  // Format: base64(JSON.stringify([id1,id2,...]))
  function encodeGuestIds(ids) {
    return btoa(JSON.stringify(ids));
  }
  function decodeGuestIds(str) {
    try { return JSON.parse(atob(str)); } catch { return []; }
  }

  // ── Language
  let currentLang = localStorage.getItem('gw:lang') || 'en';

  // i18n strings — extend as needed
  const STRINGS = {
    en: {
      coupleNames:      'Daniel ❤️ Michelle',
      welcomeTitle:     'Welcome to Our Wedding',
      eventDateLabel:   'Wedding Banquet',
      findTable:        'Find My Table',
      findTableSub:     'Upload your invitation QR code',
      weddingMenu:      'Wedding Menu',
      weddingMenuSub:   'Tonight\'s banquet courses',
      loveStory:        'Love Story Video',
      loveStorySub:     'Our journey together',
      photoGallery:     'Photo Gallery',
      photoGallerySub:  'Memories',
      sendWishes:       'Send Wishes',
      sendWishesSub:    'Leave a message for us',
      backHome:         'Back',
      // Video page
      videoUnavailable: 'Video Unavailable',
      videoLockDefault: 'The love story video will be available during the banquet.',
      availableIn:      'Available in',
      days:             'Days',
      hours:            'Hours',
      mins:             'Mins',
      secs:             'Secs',
      videoInfoText:    'Our love story montage — a journey through the moments that led us here.',
      captureWarn:      'Please enjoy the video without recording',
      // Table page
      uploadTitle:      'Tap to upload QR code',
      uploadSub:        'JPG or PNG image of your invitation QR code',
      scanWithCamera:   'Scan with Camera',
      orDivider:        'or',
      // Breadcrumb
      breadcrumbHome:   'Home',
      bcFindTable:      'Find My Table',
      bcMenu:           'Wedding Menu',
      bcVideo:          'Love Story Video',
      bcGallery:        'Photo Gallery',
      bcWishes:         'Send Wishes',
    },
    zh: {
      coupleNames:      '志宏 ❤️ 美玲',
      welcomeTitle:     '歡迎來到我們的婚宴',
      eventDateLabel:   '婚宴',
      findTable:        '查詢座位',
      findTableSub:     '上傳您的邀請二維碼',
      weddingMenu:      '婚宴菜單',
      weddingMenuSub:   '今晚的婚宴菜式',
      loveStory:        '愛情故事',
      loveStorySub:     '我們的旅程',
      photoGallery:     '相册',
      photoGallerySub:  '美好回憶',
      sendWishes:       '送上祝福',
      sendWishesSub:    '留下您的祝福',
      backHome:         '返回',
      // Video page
      videoUnavailable: '影片暫未開放',
      videoLockDefault: '愛情故事短片將於婚宴期間開放',
      availableIn:      '倒數時間',
      days:             '天',
      hours:            '時',
      mins:             '分',
      secs:             '秒',
      videoInfoText:    '我們的愛情故事短片 — 記錄我們一路走來的美好時光',
      captureWarn:      '請勿錄影，感謝配合',
      // Table page
      uploadTitle:      '點擊上傳二維碼',
      uploadSub:        '請上傳邀請函二維碼的 JPG 或 PNG 圖片',
      scanWithCamera:   '使用相機掃描',
      orDivider:        '或',
      // Breadcrumb
      breadcrumbHome:   '主頁',
      bcFindTable:      '查詢座位',
      bcMenu:           '婚宴菜單',
      bcVideo:          '愛情故事',
      bcGallery:        '相册',
      bcWishes:         '送上祝福',
    },
  };

  function t(key) {
    return (STRINGS[currentLang] || STRINGS.en)[key] || key;
  }

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('gw:lang', lang);
    // Update toggle buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    // Re-render i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = t(key);
    });
    if (typeof onLangChange === 'function') onLangChange(lang);
  }

  // ── Data loading
  let config = null;
  let guests = null;

  async function loadData() {
    if (config && guests !== null) return { config, guests };
    const [cfgRes, gstRes] = await Promise.all([
      fetch(DATA_BASE + 'config.json'),
      fetch(DATA_BASE + 'guests.json'),
    ]);
    config = await cfgRes.json();
    const gstData = await gstRes.json();
    // guests.json may be the full export (with .guests array) or a plain array
    guests = Array.isArray(gstData) ? gstData : (gstData.guests || []);
    // Attach category list from guests.json if present
    if (!Array.isArray(gstData) && gstData.categories) {
      config._categories = gstData.categories;
    }
    return { config, guests };
  }

  // ── Apply couple names & event date from config
  function applyConfig() {
    if (!config) return;
    const nameEl = document.getElementById('gw-couple-names');
    if (nameEl) nameEl.textContent = config.projectName || t('coupleNames');
    const dateEl = document.getElementById('gw-event-date');
    if (dateEl && config.eventDate) {
      const d = new Date(config.eventDate);
      dateEl.textContent = d.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    }
  }

  // ── Wire lang buttons on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
    // Apply stored lang on load
    setLang(currentLang);
  });

  // ── Expose as global GW namespace
  window.GW = {
    get config() { return config; },
    get guests() { return guests; },
    get lang()   { return currentLang; },
    setLang,
    t,
    loadData,
    applyConfig,
    getCatColor: (catKey) => getCatColor(catKey, config && config._categories),
    encodeGuestIds,
    decodeGuestIds,
  };
})();
