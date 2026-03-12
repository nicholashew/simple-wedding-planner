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
  // Derive base URL from this script's own src so the site works when hosted
  // in any subdirectory (e.g. S3 bucket at /wedding/ instead of /).
  // gw.js lives at {root}/assets/js/gw.js → strip that suffix to get root.
  const _src = (typeof document !== 'undefined' && document.currentScript)
    ? document.currentScript.src : '';
  const DATA_BASE = _src
    ? _src.replace(/assets\/js\/gw\.js[\s\S]*$/, '') + 'assets/data/'
    : '/assets/data/';

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
      heroTagline1:     'Join us as we celebrate love and commitment.',
      heroTagline2:     'A day to remember with those we hold dear.',
      greetingTitle:    'We are glad you are here',
      greetingText:     'Everything you need for the day is just below.',
      sitemapTitle:     'Celebration',
      eventDateLabel:   'Wedding Banquet',
      findTable:        'Find my seat',
      findTableSub:     'Locate your table assignment and seating arrangement with ease',
      cardLinkSeat:     'Go',
      cardCatSeat:      'Seat',
      weddingMenu:      'See banquet menu',
      weddingMenuSub:   'Browse the banquet menu and discover the dishes prepared for this special day',
      cardLinkMenu:     'View',
      cardCatCuisine:   'Cuisine',
      loveStory:        'Our love story',
      loveStorySub:     'Watch a montage of our journey together and the memories we cherish most',
      cardLinkStory:    'Watch',
      cardCatMoments:   'Moments',
      photoGallery:     'Photo Gallery',
      photoGallerySub:  'Memories',
      cardCatGallery:   'Gallery',
      cardTitleGallery: 'Captured Memories',
      cardDescGallery:  "Every frame tells a story of where we've been and the love we've built.",
      cardLinkGallery:  'View',
      cardCatGame:      'Mini Game',
      cardTitleGame:    'Midnight Feast',
      cardDescGame:     'Help a hungry black cat match the banquet dishes before the feast begins!',
      cardLinkGame:     'Play',
      sendWishes:       'Share your wishes',
      sendWishesSub:    'Leave a heartfelt message for us to treasure long after this day',
      cardLinkWishes:   'Send',
      cardCatMessage:   'Message',
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
      uploadTitle:      'Choose from Gallery',
      uploadSub:        'Select a photo of your invitation QR code',
      takePhoto:        'Take Photo',
      scanWithCamera:   'Scan Live with Camera',
      orDivider:        'or',
      // Table result
      welcome:          'Welcome',
      andParty:         '& party',
      guestsAt:         'Guests at',
      leadGuestLabel:   'Lead Guest',
      guestLabel:       'Guest',
      guestsLabel:      'guests',
      yourTable:        'Your Table',
      yourTables:       'Your Tables',
      highlightedSeatBelow: 'Your highlighted seat is shown below.',
      highlightedSeatsBelow: 'Your highlighted seats are shown below.',
      showSeatingPlan:  'Show Seating Plan',
      hideSeatingPlan:  'Hide Seating Plan',
      tablePrefix:      'Table',
      seatLabel:        'Seat',
      seatRefLabel:     'Ref. #',
      dataLoadError:    'Could not load guest data. Please contact the organiser.',
      scanAnother:      'Scan another QR code',
      seatVisualizationNote: '🪑 Seat numbers are for reference only — actual seats are first come, first served on the day.',
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
      heroTagline1:     '與我們一同見證愛與承諾的美好時刻，',
      heroTagline2:     '珍惜與摯愛同在的難忘一天。',
      greetingTitle:    '很高興有您的蒞臨',
      greetingText:     '當天所需的所有相關資訊皆整理如下',
      sitemapTitle:     '慶典',
      eventDateLabel:   '婚宴',
      findTable:        '查詢座位',
      findTableSub:     '輕鬆查看您的桌號與座位安排',
      cardLinkSeat:     '前往',
      cardCatSeat:      '座位',
      weddingMenu:      '婚宴菜單',
      weddingMenuSub:   '瀏覽婚宴菜單，探索為這特別日子精心準備的菜式',
      cardLinkMenu:     '查看',
      cardCatCuisine:   '美食',
      loveStory:        '愛情故事',
      loveStorySub:     '觀看我們愛情旅程的精彩回顧，以及我們最珍視的美好回憶',
      cardLinkStory:    '觀看',
      cardCatMoments:   '時光',
      photoGallery:     '相册',
      photoGallerySub:  '美好回憶',
      cardCatGallery:   '相册',
      cardTitleGallery: '珍貴回憶',
      cardDescGallery:  '每一幀畫面，都訴說著我們走過的足跡與共同編織的愛。',
      cardLinkGallery:  '查看',
      cardCatGame:      '小遊戲',
      cardTitleGame:    '午夜盛宴',
      cardDescGame:     '幫助一隻飢餓的黑貓在宴席開始前配對所有菜式！',
      cardLinkGame:     '開始',
      sendWishes:       '分享祝福',
      sendWishesSub:    '留下您最真摯的祝福，讓我們在這美好日子後細細珍藏',
      cardLinkWishes:   '送出',
      cardCatMessage:   '留言',
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
      uploadTitle:      '從相簿選取',
      uploadSub:        '選取邀請函二維碼的相片',
      takePhoto:        '拍照',
      scanWithCamera:   '即時相機掃描',
      orDivider:        '或',
      // Table result
      welcome:          '歡迎',
      andParty:         '及家屬',
      guestsAt:         '座位賓客',
      leadGuestLabel:   '主賓',
      guestLabel:       '賓客',
      guestsLabel:      '位賓客',
      yourTable:        '您的座位',
      yourTables:       '您的座位（多桌）',
      highlightedSeatBelow: '您的座位已在下方標示',
      highlightedSeatsBelow: '您的座位已在下方標示',
      showSeatingPlan:  '顯示座位圖',
      hideSeatingPlan:  '隱藏座位圖',
      tablePrefix:      '桌号',
      seatLabel:        '座位',
      seatRefLabel:     '參考座位 #',
      dataLoadError:    '未能載入賓客資料，請聯絡主辦人。',
      scanAnother:      '再次掃描二維碼',
      seatVisualizationNote: '🪑 座位號碼僅供參考 — 當天實際座位先到先坐。',
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
    const v = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const [cfgRes, gstRes] = await Promise.all([
      fetch(DATA_BASE + 'config.json?v=' + v),
      fetch(DATA_BASE + 'guests.json?v=' + v),
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

    // ── Toast notification (auto-injected on all pages)
    const toastEl = document.createElement('div');
    toastEl.className = 'gw-toast';
    document.body.appendChild(toastEl);
    let _toastTimer = null;
    window.GW.toast = function(msg, duration = 2500) {
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(_toastTimer);
      _toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
    };

    // ── Scroll-to-top button (auto-injected on all pages)
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scroll-top-btn';
    scrollBtn.setAttribute('aria-label', 'Back to top');
    scrollBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    document.body.appendChild(scrollBtn);
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
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
