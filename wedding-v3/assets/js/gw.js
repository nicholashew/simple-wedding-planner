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
      welcomeSub:       'We\'re so glad you\'re here ❤️',
      // QR section (index-v3)
      qrEyebrow:        'Your Seat',
      qrTitle:          'Find Your Seat',
      qrSub:            'Scan your invitation QR code',
      qrScanBtn:        'Scan QR Code',
      qrHint1:          'Use your invitation card, or',
      qrHint2:          'ask reception if you need help',
      // Program section (index-v3)
      programHeaderToday: 'Today\'s program and timing',
      programTitle:     'Program',
      prog1:            'Couple Entrance',
      prog1Desc:        'The couple makes their entrance to begin the celebration.',
      prog2:            'Lunch Starts',
      prog2Desc:        'Guests are served a selection of dishes prepared for the occasion.',
      prog3:            'Yam Seng 🍻',
      prog3Desc:        'Toasts and well-wishes are shared together.',
      // Links group titles (index-v3)
      linksGroupExperience: 'Experience',
      linksGroupMemories:   'Memories',
      linksGroupFun:        'Fun 🎉',
      // Bottom nav short labels
      bnSeat:    'Find Seat',
      bnProgram: 'Program',
      bnMenu:    'Menu',
      bnWishes:  'Wishes',
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
      menuFooterNote:   'Dishes are prepared fresh for this occasion. Menu may be subject to seasonal availability.',
      menuFooterWish:   'Wishing you a wonderful feast.',
      menuPreviewBtn:     'View banquet menu',
      menuPreviewTitle:   'Banquet Menu',
      menuPreviewCaption: 'For illustration only — actual presentation may vary.',
      exploreMore:      'Explore',
      navHome:          'Home',
      navGallery:       'Gallery',
      navVideo:         'Video',
      sendWishes:       'Share your wishes',
      sendWishesSub:    'Leave a heartfelt message for us to treasure long after this day',
      wishPreamble:     "We'd love to hear your blessings — it only takes a minute. Your words mean the world to us.",
      loadingForm:      'Loading form…',
      formErrorTitle:   'Form unavailable',
      formErrorBody:    "We couldn't load the wishes form. Please try again later.",
      formSuccessTitle: 'Thank you!',
      formSuccessBody:  'Your wishes have been received. We truly appreciate your heartfelt message.',
      wishesSentToast:  'Wishes sent! Thank you 🎊',
      cardLinkWishes:   'Send',
      cardCatMessage:   'Message',
      backHome:         'Back',
      // Video page
      videoUnavailable: 'Coming Soon',
      videoLockDefault: 'The love story video will be available during the banquet.',
      availableIn:      'Available in',
      days:             'Days',
      hours:            'Hours',
      mins:             'Mins',
      secs:             'Secs',
      videoInfoText:    'Our love story montage — a journey through the moments that led us here.',
      videoNoRecord:    'Please enjoy the video without screen recording. Thank you for respecting our memories.',
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
      // Game page
      gameNavTitle:     '🐈‍⬛ Midnight Feast',
      gameDiffEasy:     'Easy',
      gameDiffNormal:   'Normal',
      gameDiffHard:     'Hard',
      gameDiffExpert:   'Expert',
      gameMoves:        'moves',
      gameShuffle:      'Shuffle & Restart',
      gameWellFed:      'Well Fed!',
      gameWinSub:       'The midnight cat is satisfied 🐾',
      gameWinMoves:     'Moves',
      gameWinTime:      'Time',
      gameWinPairs:     'Pairs',
      gameFortuneLbl:   '🔮 Your Lucky Fortune',
      gamePlayAgain:    'Play Again',
    },
    zh: {
      coupleNames:      '志宏 ❤️ 美玲',
      welcomeTitle:     '欢迎来到我们的婚宴',
      welcomeSub:       '很高兴您能共襄盛举 ❤️',
      // QR section (index-v3)
      qrEyebrow:        '您的座位',
      qrTitle:          '查询座位',
      qrSub:            '扫描您的邀请函二维码',
      qrScanBtn:        '扫描二维码',
      qrHint1:          '使用您的邀请函',
      qrHint2:          '如需协助请联络接待人员',
      // Program section (index-v3)
      programHeaderToday: '今日活动流程',
      programTitle:     '流程',
      prog1:            '新人入场',
      prog1Desc:        '新郎与新娘入场，宴席正式开始。',
      prog2:            '午宴开始',
      prog2Desc:        '宴席开始，宾客享用精心准备的美食。',
      prog3:            '干杯 🍻',
      prog3Desc:        '干杯共庆，互送祝福。',
      // Links group titles (index-v3)
      linksGroupExperience: '精彩体验',
      linksGroupMemories:   '美好回忆',
      linksGroupFun:        '游戏同乐 🎉',
      // Bottom nav short labels
      bnSeat:    '查座位',
      bnProgram: '流程',
      bnMenu:    '菜单',
      bnWishes:  '祝福',
      heroTagline1:     '与我们一同见证爱与承诺的美好时刻，',
      heroTagline2:     '珍惜与挚爱同在的难忘一天。',
      greetingTitle:    '很高兴有您的莅临',
      greetingText:     '当天所需的所有相关资讯皆整理如下',
      sitemapTitle:     '庆典',
      eventDateLabel:   '婚宴',
      findTable:        '查询座位',
      findTableSub:     '轻松查看您的桌号与座位安排',
      cardLinkSeat:     '前往',
      cardCatSeat:      '座位',
      weddingMenu:      '婚宴菜单',
      weddingMenuSub:   '浏览婚宴菜单，探索为这特别日子精心准备的菜式',
      cardLinkMenu:     '查看',
      cardCatCuisine:   '美食',
      loveStory:        '爱情故事',
      loveStorySub:     '观看我们爱情旅程的精彩回顾，以及我们最珍视的美好回忆',
      cardLinkStory:    '观看',
      cardCatMoments:   '时光',
      photoGallery:     '相册',
      photoGallerySub:  '美好回忆',
      cardCatGallery:   '相册',
      cardTitleGallery: '珍贵回忆',
      cardDescGallery:  '每一帧画面，都诉说着我们走过的足迹与共同编织的爱。',
      cardLinkGallery:  '查看',
      cardCatGame:      '小游戏',
      cardTitleGame:    '午夜盛宴',
      cardDescGame:     '帮助一只饥饿的黑猫在宴席开始前配对所有菜式！',
      cardLinkGame:     '开始',
      menuFooterNote:   '所有菜式均为本次宴席精心准备，部分食材视季节供应而定。',
      menuFooterWish:   '祝各位用餐愉快，宾至如归！',
      menuPreviewBtn:     '查看宴席菜单',
      menuPreviewTitle:   '宴席菜单',
      menuPreviewCaption: '仅供参考，实际呈现或有所不同。',
      exploreMore:      '探索更多',
      navHome:          '主页',
      navGallery:       '相册',
      navVideo:         '影片',
      sendWishes:       '分享祝福',
      sendWishesSub:    '留下您最真挚的祝福，让我们在这美好日子后细细珍藏',
      wishPreamble:     '诚挚期待您的祝福，只需一分钟。您的话语对我们意义深远。',
      loadingForm:      '正在加载表单…',
      formErrorTitle:   '表单暂时无法使用',
      formErrorBody:    '无法加载祝福表单，请稍后再试。',
      formSuccessTitle: '感谢您！',
      formSuccessBody:  '您的祝福已收到，我们衷心感谢您的真情留言。',
      wishesSentToast:  '祝福已送出！感谢您 🎊',
      cardLinkWishes:   '送出',
      cardCatMessage:   '留言',
      backHome:         '返回',
      // Video page
      videoUnavailable: '即将开放',
      videoLockDefault: '爱情故事短片将于婚宴期间开放',
      availableIn:      '倒数时间',
      days:             '天',
      hours:            '时',
      mins:             '分',
      secs:             '秒',
      videoInfoText:    '我们的爱情故事短片 — 记录我们一路走来的美好时光',
      videoNoRecord:    '请勿录影或截屏，感谢您尊重我们的珍贵回忆。',
      // Table page
      uploadTitle:      '从相册选取',
      uploadSub:        '选取邀请函二维码的相片',
      takePhoto:        '拍照',
      scanWithCamera:   '即时相机扫描',
      orDivider:        '或',
      // Table result
      welcome:          '欢迎',
      andParty:         '及家属',
      guestsAt:         '座位宾客',
      leadGuestLabel:   '主宾',
      guestLabel:       '宾客',
      guestsLabel:      '位宾客',
      yourTable:        '您的座位',
      yourTables:       '您的座位（多桌）',
      highlightedSeatBelow: '您的座位已在下方标示',
      highlightedSeatsBelow: '您的座位已在下方标示',
      showSeatingPlan:  '显示座位图',
      hideSeatingPlan:  '隐藏座位图',
      tablePrefix:      '桌号',
      seatLabel:        '座位',
      seatRefLabel:     '参考座位 #',
      dataLoadError:    '未能载入宾客资料，请联络主办人。',
      scanAnother:      '再次扫描二维码',
      seatVisualizationNote: '🪑 座位号码仅供参考 — 当天实际座位先到先坐。',
      // Breadcrumb
      breadcrumbHome:   '主页',
      bcFindTable:      '查询座位',
      bcMenu:           '婚宴菜单',
      bcVideo:          '爱情故事',
      bcGallery:        '相册',
      bcWishes:         '送上祝福',
      // Game page
      gameNavTitle:     '🐈‍⬛ 午夜盛宴',
      gameDiffEasy:     '简单',
      gameDiffNormal:   '普通',
      gameDiffHard:     '困难',
      gameDiffExpert:   '高手',
      gameMoves:        '步',
      gameShuffle:      '洗牌重来',
      gameWellFed:      '猫咪饱了！',
      gameWinSub:       '午夜黑猫心满意足 🐾',
      gameWinMoves:     '步数',
      gameWinTime:      '时间',
      gameWinPairs:     '配对',
      gameFortuneLbl:   '🔮 您的幸运签',
      gamePlayAgain:    '再玩一次',
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

  // ── Shared nav drawer (used by all public pages)
  function initDrawer() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navDrawer    = document.getElementById('navDrawer');
    const navOverlay   = document.getElementById('navOverlay');
    const drawerClose  = document.getElementById('drawerClose');
    if (!hamburgerBtn || !navDrawer) return;
    function openDrawer()  {
      navDrawer.classList.add('open');
      navOverlay && navOverlay.classList.add('open');
      hamburgerBtn.classList.add('open');
    }
    function closeDrawer() {
      navDrawer.classList.remove('open');
      navOverlay && navOverlay.classList.remove('open');
      hamburgerBtn.classList.remove('open');
    }
    hamburgerBtn.addEventListener('click', openDrawer);
    drawerClose  && drawerClose.addEventListener('click', closeDrawer);
    navOverlay   && navOverlay.addEventListener('click', closeDrawer);
    window.addEventListener('pageshow', closeDrawer);
  }

  // ── Common nav/footer population
  function initCommonNav(cfg) {
    const name = (cfg && cfg.projectName) || '';
    ['nav-couple-name', 'drawer-couple-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = name;
    });
    const footerEl = document.getElementById('gw-footer-names');
    if (footerEl) {
      const year = (cfg && cfg.eventDate)
        ? new Date(cfg.eventDate).getFullYear()
        : new Date().getFullYear();
      footerEl.textContent = `© ${year} ${name}`;
    }
  }

  // ── Wire lang buttons on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // ── Service Worker registration (shared for all pages)
    const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && !isDev) {
      navigator.serviceWorker.register('./sw.js');
    } else if (isDev && 'serviceWorker' in navigator) {
      // Unregister any previously cached SW so dev always gets fresh files
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }

    initDrawer();
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
    initDrawer,
    initCommonNav,
  };
})();
