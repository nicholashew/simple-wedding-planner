// admin-find-table.js — Search logic for Find Table admin page
/* global QRCode */
// Auth guard
if (!document.cookie.includes('gw_admin=1')) {
  window.location.replace('login.html');
}
// Initialize search panel visibility on load
document.addEventListener('DOMContentLoaded', () => {
  showSearchScreen('cat'); initDragSelect();
});
// ═══════════════════════════════
// State
// ═══════════════════════════════
let allGuests = [], categories = [], filteredByAlpha = [];
let selectedCat = null, selectedAlpha = null;
let selectedGuests = new Set(); // multi-select: set of guest IDs
let viewMode = 'search'; // 'search' | 'tables'
let currentTableGuests = []; // guests shown in current table result
let tableSortMode = 'seat'; // 'seat' | 'relation'
let tableFilterCat = '', tableFilterSubCat = '', tableFilterName = '';
let qrMode = 'ids';    // 'ids' | 'group'
let qrLeadId = null;   // native id of lead guest
let choicesInstance = null;

// ── QR Payload encoding ──────────────────────────────────────────────────────
// Known category keys → compact numeric index (both sides must share this map)
const QR_CAT_MAP = {
  'bride-family': 0, 'bride-rel': 1, 'bride-friend': 2, 'bride-colleague': 3,
  'groom-family': 4, 'groom-rel': 5, 'groom-friend': 6, 'groom-colleague': 7,
  'others': 8
};
const QR_CAT_RMAP = Object.fromEntries(Object.entries(QR_CAT_MAP).map(([k,v]) => [v, k]));

function jsonMinify(obj) {
  return JSON.stringify(obj, (_k, v) => (v === null || v === undefined) ? undefined : v);
}
function toBase64(obj) {
  const bytes = new TextEncoder().encode(jsonMinify(obj));
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}
function toBase32(obj) {
  const bytes = new TextEncoder().encode(jsonMinify(obj));
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += alpha[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += alpha[(value << (5 - bits)) & 31];
  return out;
}
function b64DecodeJson(str) {
  try { const bin = atob(str); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0)); return JSON.parse(new TextDecoder().decode(bytes)); } catch {}
  try { return JSON.parse(atob(str)); } catch {}
  return null;
}

// Build compact payload object from current QR selection
function buildQrData() {
  if (qrLeadId === null) return null;
  const guests = resolveQrGuests();
  if (!guests.length) return null;
  if (qrMode === 'ids') {
    const others = guests.map(g => g.id).filter(id => String(id) !== String(qrLeadId));
    const obj = { v: 1, l: qrLeadId };
    if (others.length) obj.i = others;
    return obj;
  }
  const groups = getSelectedGroups();
  if (groups.length === 1) {
    const { cat, subCat } = groups[0];
    const obj = { v: 2, c: QR_CAT_MAP[cat] ?? cat, l: qrLeadId };
    if (subCat) obj.s = subCat;
    return obj;
  }
  return {
    v: 3,
    g: groups.map(({ cat, subCat }) => subCat ? { c: QR_CAT_MAP[cat] ?? cat, s: subCat } : { c: QR_CAT_MAP[cat] ?? cat }),
    l: qrLeadId
  };
}
function getSelectedGroups() {
  if (choicesInstance) {
    // Read from Choices.js internal store — always in sync when event fires
    const vals = choicesInstance.getValue(true);
    const arr = Array.isArray(vals) ? vals : (vals ? [vals] : []);
    return arr.filter(Boolean).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
  }
  // Fallback: read from underlying select element
  const sel = document.getElementById('qr-scope-select');
  if (!sel) return [];
  return [...sel.selectedOptions].map(opt => { try { return JSON.parse(opt.value); } catch { return null; } }).filter(Boolean);
}

const ALPHA_GROUPS = ['AB','CD','EF','GH','IJ','KL','MN','OP','QR','ST','UV','WX','YZ'];

// All known categories (ensures new cats work even if guests.json was exported before they were added)
const KNOWN_CATS = [
  { key: 'bride-family',    label: '🌸 Bride Family' },
  { key: 'bride-rel',       label: '🌺 Bride Relative' },
  { key: 'bride-friend',    label: '🪷 Bride Friend' },
  { key: 'bride-colleague', label: '🌹 Bride Colleague' },
  { key: 'groom-family',    label: '💠 Groom Family' },
  { key: 'groom-rel',       label: '🔷 Groom Relative' },
  { key: 'groom-friend',    label: '🫐 Groom Friend' },
  { key: 'groom-colleague', label: '🔵 Groom Colleague' },
  { key: 'others',          label: '✨ Others' },
];

// ═══════════════════════════════
// Table color palette
// ═══════════════════════════════
const TABLE_PALETTE = [
  '#c0392b','#8e44ad','#2471a3','#1a8a4a','#d4850a',
  '#16a085','#a04000','#2e4057','#b7950b','#6c3483',
  '#1a5276','#7b241c','#1d8348','#6e2f8d','#935116',
];
let tableColorMap = {};
function initTableColors() {
  const seqs = [];
  const seen = {};
  allGuests.forEach(g => {
    const key = g.tableName || g.tableSeq;
    if (key && !seen[key]) { seen[key] = true; seqs.push({ key, seq: g.tableSeq || 0 }); }
  });
  seqs.sort((a, b) => a.seq - b.seq);
  seqs.forEach((s, i) => { tableColorMap[s.key] = TABLE_PALETTE[i % TABLE_PALETTE.length]; });
}
function getTableColor(tableName) {
  return tableName ? (tableColorMap[tableName] || TABLE_PALETTE[0]) : 'var(--muted)';
}

function encodeIds(ids) { return btoa(JSON.stringify(ids)); }
function decodeIds(str) { try { return JSON.parse(atob(str)); } catch { return []; } }
function decodeQrPayload(encoded) {
  const decoded = b64DecodeJson(encoded);
  if (!decoded) return null;
  // v1: {v:1, l:lead, i:[others]}
  if (decoded.v === 1) {
    const lead = decoded.l;
    const others = decoded.i || [];
    return { type: 'ids', ids: [lead, ...others], leadId: lead };
  }
  // Legacy: bare id array
  if (Array.isArray(decoded) && decoded.length)
    return { type: 'ids', ids: decoded };
  // New v2: {v:2, c:numCode, s:subCat, l:lead}
  if (decoded.v === 2 && decoded.c !== undefined)
    return { type: 'group', groups: [{ cat: QR_CAT_RMAP[decoded.c] ?? String(decoded.c), subCat: decoded.s || null }], leadId: decoded.l ?? null };
  // Legacy v2: {v:2, cat:string, subCat:..., lead:...}
  if (decoded.v === 2 && decoded.cat)
    return { type: 'group', groups: [{ cat: decoded.cat, subCat: decoded.subCat || null }], leadId: decoded.lead || null };
  // New v3: {v:3, g:[{c:0,s:...},...], l:lead}
  if (decoded.v === 3 && Array.isArray(decoded.g) && decoded.g.length)
    return { type: 'group', groups: decoded.g.map(sg => ({ cat: QR_CAT_RMAP[sg.c] ?? String(sg.c), subCat: sg.s || null })), leadId: decoded.l ?? null };
  // Legacy v3: {v:3, groups:[...], lead:...}
  if (decoded.v === 3 && Array.isArray(decoded.groups) && decoded.groups.length)
    return { type: 'group', groups: decoded.groups, leadId: decoded.lead || null };
  return null;
}

// ═══════════════════════════════
// Pinyin support
// ═══════════════════════════════
const PINYIN = (function() {
  return {
    // Top 100 Chinese surnames
    '\u674e':'li','\u738b':'wang','\u5f20':'zhang','\u5218':'liu','\u9648':'chen',
    '\u6768':'yang','\u9ec4':'huang','\u8d75':'zhao','\u5434':'wu','\u5468':'zhou',
    '\u5f90':'xu','\u5b59':'sun','\u9a6c':'ma','\u80e1':'hu','\u6797':'lin',
    '\u90ed':'guo','\u4f55':'he','\u9ad8':'gao','\u7f57':'luo','\u90d1':'zheng',
    '\u8881':'yuan','\u9093':'deng','\u8c22':'xie','\u97e9':'han','\u66f9':'cao',
    '\u8bb8':'xu2','\u6c88':'shen','\u5f6d':'peng','\u8521':'cai','\u6643':'zeng',
    '\u5415':'lv','\u4e01':'ding','\u9b4f':'wei','\u59dc':'jiang','\u51af':'kai',
    '\u6d2a':'hong','\u6b27':'ou','\u4efb':'ren','\u843d':'luo','\u5510':'tang',
    '\u9676':'tao','\u5c39':'yin','\u8499':'meng','\u5b8b':'song',
    // More common surnames
    '\u6731':'zhu','\u79e6':'qin','\u5c24':'you','\u8bb8':'xu','\u5434':'wu',
    '\u9a6c':'ma','\u53f8':'si','\u5f20':'zhang','\u8d3e':'jia','\u9ad8':'gao',
    '\u8ffd':'zhui','\u5510':'tang','\u5434':'wu','\u8521':'cai','\u5510':'tang',
    '\u9f99':'long','\u77f3':'shi','\u621f':'mao','\u6c57':'han','\u5c45':'ju',
    '\u5ed6':'liao','\u6c5f':'jiang','\u5218':'liu','\u90b5':'shao','\u767d':'bai',
    '\u6587':'wen','\u5362':'lu','\u8d39':'fei','\u5c71':'shan','\u539f':'yuan',
    '\u5c45':'ju','\u82cf':'su','\u5085':'fu','\u53f6':'ye','\u4efb':'ren',
    '\u5c55':'zhan','\u5c71':'shan','\u5b8b':'song','\u5510':'tang','\u8463':'dong',
    '\u65b9':'fang','\u88ab':'bei','\u8d3e':'jia','\u6bb5':'duan','\u4e01':'ding',
    '\u7530':'tian','\u4efb':'ren','\u53f2':'shi','\u97e6':'wei','\u8303':'fan',
    '\u859b':'xue','\u5c39':'yin','\u4e07':'wan','\u5173':'guan','\u5ed6':'liao',
    '\u90b5':'shao','\u4eff':'fang','\u8563':'xiao','\u51cc':'ling','\u76db':'sheng',
    '\u6613':'yi','\u9c81':'lu','\u675c':'du','\u9f50':'qi','\u5411':'xiang',
    '\u90b9':'zou','\u96f7':'lei','\u5c39':'yin','\u64cd':'cao','\u5f6d':'peng',
    '\u817e':'teng','\u5c4c':'wu','\u5eb3':'an','\u5c39':'yin','\u5218':'liu',
    '\u5d14':'cui','\u9f9a':'long','\u624d':'cai','\u5c45':'ju','\u7a0b':'cheng',
    '\u6f58':'pan','\u4e8e':'yu','\u8463':'dong','\u5eb7':'kang','\u9f9f':'gui',
    '\u5c24':'you','\u5b63':'ji','\u5218':'liu','\u66f9':'cao','\u5434':'wu',
    '\u59da':'yao','\u9990':'tan','\u716e':'peng','\u71d5':'yan','\u8463':'dong',
    '\u5c45':'ju','\u5c71':'shan','\u90e8':'bu','\u90d3':'chen','\u59dc':'jiang',
    '\u5bff':'shou','\u5c24':'you','\u5c39':'yin','\u5609':'jia','\u5c75':'an',
    '\u9f99':'long','\u96c6':'ji','\u53f8':'si','\u8521':'cai','\u98df':'shi',
    '\u5bb9':'rong','\u5c71':'shan','\u9999':'xiang',
    // Additional common characters
    '\u82f9':'ping','\u5c49':'wei','\u6de4':'tan','\u961a':'min','\u7199':'kang',
    '\u4faf':'hou','\u9f9c':'gui','\u9f94':'mo','\u7fc1':'weng','\u725b':'niu',
    '\u5b81':'ning','\u5e9e':'pang','\u718a':'xiong','\u5c40':'ju','\u909d':'xie',
    '\u840d':'ping','\u84dd':'lan','\u5c40':'ju','\u4e18':'qiu','\u590f':'xia',
    '\u4ed8':'fu','\u5e38':'chang','\u51cc':'ling','\u5308':'xu','\u9f9f':'gui',
    '\u5bab':'gong','\u8439':'peng','\u5c40':'ju','\u77e3':'chi','\u5c71':'shan',
    // Numbers (for mixed names)
    '\u4e00':'yi','\u4e8c':'er','\u4e09':'san','\u56db':'si','\u4e94':'wu',
    '\u516d':'liu','\u4e03':'qi','\u516b':'ba','\u4e5d':'jiu','\u5341':'shi',
    // Common given name characters
    '\u5927':'da','\u5c0f':'xiao','\u660e':'ming','\u534e':'hua','\u5609':'jia',
    '\u5973':'nv','\u7537':'nan','\u5f3a':'qiang','\u4e3d':'li','\u8292':'mang',
    '\u96ea':'xue','\u8389':'li','\u5170':'lan','\u8292':'mang','\u6885':'mei',
    '\u83b2':'lian','\u6d77':'hai','\u5929':'tian','\u5fc3':'xin','\u5c71':'shan',
    '\u706b':'huo','\u6c34':'shui','\u6728':'mu','\u91d1':'jin','\u571f':'tu',
    '\u4eac':'jing','\u73a9':'wan','\u4eba':'ren','\u5bf9':'dui','\u5c31':'jiu',
    '\u5fd7':'zhi','\u8fdc':'yuan','\u8fd1':'jin','\u9ad8':'gao','\u5149':'guang',
    '\u521a':'gang','\u67d4':'rou','\u59c6':'mu','\u5a47':'jun','\u590f':'xia',
    '\u51ac':'dong','\u79cb':'qiu','\u6625':'chun',
  };
})();
function toPinyin(s) {
  return (s || '').split('').map(c => PINYIN[c] || c).join('');
}
function toPinyinInitials(s) {
  return (s || '').split('').map(c => (PINYIN[c] || c)[0]).join('');
}
function matchGuest(g, q) {
  if (!q) return true;
  const ql = q.toLowerCase();
  const full = `${g.lastName} ${g.firstName} ${g.nickName || ''}`.toLowerCase();
  if (full.includes(ql)) return true;
  const py = toPinyin(`${g.lastName}${g.firstName}${g.nickName || ''}`).toLowerCase();
  if (py.includes(ql)) return true;
  const pyI = toPinyinInitials(`${g.lastName}${g.firstName}${g.nickName || ''}`).toLowerCase();
  if (pyI.includes(ql)) return true;
  return false;
}
// Tokenized search: split query by spaces, ALL tokens must match (AND logic)
// Each token is checked individually via matchGuest (supports pinyin, substring)
function matchGuestTokenized(g, query) {
  if (!query || !query.trim()) return true;
  return query.trim().split(/\s+/).every(token => matchGuest(g, token));
}

// ═══════════════════════════════
// Load data
// ═══════════════════════════════
(async () => {
  try {
    const [cfgRes, gstRes] = await Promise.all([
      fetch('../assets/data/config.json'),
      fetch('../assets/data/guests.json'),
    ]);
    const config  = await cfgRes.json();
    const gstData = await gstRes.json();
    allGuests  = Array.isArray(gstData) ? gstData : (gstData.guests || []);
    const loadedCats = (Array.isArray(gstData) ? [] : gstData.categories) || config._categories || [];
    // Merge: start with KNOWN_CATS order, fill in any extra cats from loaded data
    const knownKeys  = new Set(KNOWN_CATS.map(c => c.key));
    const merged = [...KNOWN_CATS, ...loadedCats.filter(c => !knownKeys.has(c.key))];
    // Only show categories that have at least 1 guest
    categories = merged.filter(c => allGuests.some(g => g.cat === c.key));
    initTableColors();
    buildCatGrid();
    // Data freshness badge
    const badge = document.getElementById('data-freshness');
    if (badge) {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      badge.textContent = `${allGuests.length} guests · ${time}`;
      badge.style.display = '';
    }
  } catch (e) {
    document.getElementById('cat-grid').innerHTML =
      '<div class="empty-state">Could not load guest data.</div>';
  }
})();

// ═══════════════════════════════
// SEARCH — Category
// ═══════════════════════════════
function buildCatGrid() {
  const grid = document.getElementById('cat-grid');
  if (!categories.length) {
    grid.innerHTML = '<div class="empty-state">No categories found.</div>';
    return;
  }
  const brideCats = categories.filter(c => c.key.startsWith('bride-'));
  const groomCats = categories.filter(c => c.key.startsWith('groom-'));
  const otherCats = categories.filter(c => !c.key.startsWith('bride-') && !c.key.startsWith('groom-'));
  function renderCards(cats) {
    return cats.map(cat => `
      <button class="cat-card" onclick="selectCat('${cat.key}')">
        <span class="cat-emoji">${cat.label.match(/\p{Emoji}/u)?.[0] || '👥'}</span>
        <span class="cat-name">${cat.label.replace(/^\p{Emoji}\s*/u, '')}</span>
        <span class="cat-sub">${allGuests.filter(g => g.cat === cat.key).length} guests</span>
        <span role="button" class="cat-qr-btn" title="QR for ${cat.label.replace(/^\p{Emoji}\s*/u, '')}" onclick="event.stopPropagation();openQrForCat('${cat.key}')"><i class="fa-solid fa-qrcode"></i></span>
      </button>`).join('');
  }
  function renderGroup(label, cats, groupCls) {
    if (!cats.length) return '';
    return `<div class="cat-group ${groupCls || ''}">
      <div class="cat-group-label">${label}</div>
      <div class="cat-group-grid">${renderCards(cats)}</div>
    </div>`;
  }
  grid.innerHTML =
    renderGroup('👰 Bride Side', brideCats, 'cat-group-bride') +
    renderGroup('🤵 Groom Side', groomCats, 'cat-group-groom') +
    (otherCats.length ? renderGroup('🏷️ Others', otherCats, 'cat-group-others') : '') +
    `<div class="cat-group cat-group-others">
      <div class="cat-group-label">🔎 Others</div>
      <div class="cat-group-grid">
        <button class="cat-card" onclick="selectCat(null)">
          <span class="cat-emoji">🔍</span>
          <span class="cat-name">All Guests</span>
          <span class="cat-sub">${allGuests.length} total</span>
        </button>
        <button class="cat-card cat-card-tables" onclick="selectViewAllTables()">
          <span class="cat-emoji">🪑</span>
          <span class="cat-name">View All Tables</span>
          <span class="cat-sub">Browse guests by table assignment</span>
        </button>
      </div>
    </div>`;
}

function getSideClass(catKey) {
  if (!catKey) return '';
  if (catKey.startsWith('bride-')) return 'bc-bride';
  if (catKey.startsWith('groom-')) return 'bc-groom';
  return 'bc-others';
}

function selectCat(catKey) {
  selectedCat = catKey;
  clearGuestSelection(); // clear selection when switching category
  buildAlphaGrid(catKey);
  showSearchScreen('alpha');
  const cat = categories.find(c => c.key === catKey);
  const sideClass = getSideClass(catKey);
  ['bc-alpha', 'bc-name'].forEach(id => {
    const el = document.getElementById(id);
    el.className = 'breadcrumb' + (sideClass ? ' ' + sideClass : '');
  });
  document.getElementById('bc-alpha').innerHTML =
    `<span class="bc-item" onclick="showSearchScreen('cat')">Groups</span>
     <span class="bc-sep">›</span>
     <span>${cat ? cat.label : 'All Guests'}</span>`;
}

// ─── Alphabet (paired: AB, CD, … + ALL)
function buildAlphaGrid(catKey) {
  const pool = catKey ? allGuests.filter(g => g.cat === catKey) : allGuests;
  const groupCounts = {};
  ALPHA_GROUPS.forEach(grp => {
    groupCounts[grp] = pool.filter(g => {
      const ch = (g.lastName || '').toUpperCase()[0] || '';
      return grp.includes(ch);
    }).length;
  });
  const grid = document.getElementById('alpha-grid');
  grid.innerHTML = ALPHA_GROUPS.map(grp => `
    <button class="alpha-card${groupCounts[grp] === 0 ? ' dimmed' : ''}" onclick="selectAlpha('${grp}')">
      ${grp}<span class="alpha-count">${groupCounts[grp] || ''}</span>
    </button>`).join('') +
    `<button class="alpha-card alpha-all" onclick="selectAlpha('ALL')" style="grid-column:span 2;">
      ALL<span class="alpha-count">${pool.length}</span>
    </button>`;
}

function selectAlpha(group) {
  if (group !== selectedAlpha) clearGuestSelection(); // clear only when switching to a different letter
  selectedAlpha = group;
  const pool = selectedCat ? allGuests.filter(g => g.cat === selectedCat) : allGuests;
  if (group === 'ALL') {
    filteredByAlpha = pool;
  } else {
    filteredByAlpha = pool.filter(g => {
      const ch = (g.lastName || '').toUpperCase()[0] || '';
      return group.includes(ch);
    });
  }
  renderGuestList(filteredByAlpha);
  showSearchScreen('name');
  const cat = categories.find(c => c.key === selectedCat);
  document.getElementById('bc-name').innerHTML =
    `<span class="bc-item" onclick="showSearchScreen('cat')">Groups</span>
     <span class="bc-sep">›</span>
     <span class="bc-item" onclick="showSearchScreen('alpha')">${cat ? cat.label : 'All Guests'}</span>
     <span class="bc-sep">›</span>
     <span>${group}</span>`;
  document.getElementById('name-search').value = '';
}

// ─── Tables overview flow
function selectViewAllTables() {
  viewMode = 'tables';
  clearGuestSelection();
  buildTableList();
  showSearchScreen('tables');
}

function buildTableList() {
  const tableMap = {};
  allGuests.forEach(g => {
    const k = g.tableName || '—';
    if (!tableMap[k]) tableMap[k] = { name: k, seq: g.tableSeq || 0, count: 0 };
    tableMap[k].count++;
  });
  const tables = Object.values(tableMap).sort((a, b) => a.seq - b.seq);
  const totalAssigned = allGuests.filter(g => g.tableName).length;
  document.getElementById('table-list-wrap').innerHTML = `<div class="table-list">
    <div class="table-item" onclick="selectTableResult(null)">
      <div class="table-item-strip" style="background:var(--accent)"></div>
      <div class="table-item-name">ALL — View All Tables</div>
      <div class="table-item-count">${tables.length} tables &middot; ${totalAssigned} guests</div>
    </div>
    ${tables.map(t => {
      const color = getTableColor(t.name === '—' ? null : t.name);
      return `<div class="table-item" data-tbl="${esc(t.name)}" onclick="selectTableResult(this.dataset.tbl)">
        <div class="table-item-strip" style="background:${color}"></div>
        <div class="table-item-name">${esc(t.name)}</div>
        <div class="table-item-count">${t.count} guest${t.count !== 1 ? 's' : ''}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function selectTableResult(tableName) {
  // null = all tables, string = specific table name
  currentTableGuests = tableName === null
    ? allGuests.filter(g => g.tableName)
    : allGuests.filter(g => (g.tableName || '—') === tableName);
  tableSortMode = 'seat';
  // Reset filters
  tableFilterCat = ''; tableFilterSubCat = ''; tableFilterName = '';
  document.getElementById('filter-name').value = '';
  updateFilterDropdowns();
  renderTableResult();
  // Show sort + filter bars
  document.getElementById('table-sort-bar').style.display = 'flex';
  document.getElementById('table-filter-bar').style.display = 'flex';
  document.getElementById('sort-btn-seat').classList.add('active');
  document.getElementById('sort-btn-relation').classList.remove('active');
  // Show QR button only for a specific table (not "all tables" view)
  const qrBtn = document.getElementById('table-qr-btn');
  if (qrBtn) qrBtn.style.display = tableName !== null ? '' : 'none';
  showSearchScreen('result');
}

function sortTableResult(mode) {
  tableSortMode = mode;
  renderTableResult();
  document.getElementById('sort-btn-seat').classList.toggle('active', mode === 'seat');
  document.getElementById('sort-btn-relation').classList.toggle('active', mode === 'relation');
}

// Apply current filters to currentTableGuests and return the subset
function filterTableGuests() {
  return currentTableGuests.filter(g => {
    if (tableFilterCat    && g.cat              !== tableFilterCat)    return false;
    if (tableFilterSubCat && (g.subCat || '')   !== tableFilterSubCat) return false;
    if (tableFilterName   && !matchGuestTokenized(g, tableFilterName)) return false;
    return true;
  });
}

// Rebuild dropdown options with cross-dependency awareness
function updateFilterDropdowns() {
  const passName = g => !tableFilterName || matchGuestTokenized(g, tableFilterName);

  // Cat options = guests that pass subcat + name filters
  const forCat = currentTableGuests.filter(g =>
    (!tableFilterSubCat || (g.subCat || '') === tableFilterSubCat) && passName(g)
  );
  const availCats = [...new Set(forCat.map(g => g.cat).filter(Boolean))];

  // SubCat options = guests that pass cat + name filters
  const forSub = currentTableGuests.filter(g =>
    (!tableFilterCat || g.cat === tableFilterCat) && passName(g)
  );
  const availSubCats = [...new Set(forSub.map(g => g.subCat || '').filter(Boolean))].sort();

  const catSel = document.getElementById('filter-cat');
  catSel.innerHTML = '<option value="">All Relationships</option>' +
    availCats.map(k => {
      const cat = categories.find(c => c.key === k);
      return `<option value="${esc(k)}"${k === tableFilterCat ? ' selected' : ''}>${esc(cat ? cat.label : k)}</option>`;
    }).join('');

  const subSel = document.getElementById('filter-subcat');
  subSel.innerHTML = '<option value="">All Sub Categories</option>' +
    availSubCats.map(s =>
      `<option value="${esc(s)}"${s === tableFilterSubCat ? ' selected' : ''}>${esc(s)}</option>`
    ).join('');
}

function applyTableFilters() {
  tableFilterCat    = document.getElementById('filter-cat').value;
  tableFilterSubCat = document.getElementById('filter-subcat').value;
  tableFilterName   = document.getElementById('filter-name').value;
  updateFilterDropdowns();
  renderTableResult();
}

function clearTableNameFilter() {
  document.getElementById('filter-name').value = '';
  tableFilterName = '';
  updateFilterDropdowns();
  renderTableResult();
}

function renderTableResult() {
  document.getElementById('result-detail').innerHTML = buildResultHtml(filterTableGuests(), tableSortMode);
}

// ═══════════════════════════════
// QR GENERATOR
// ═══════════════════════════════

// Quick-launch QR for a category card (from cat grid)
function openQrForCat(catKey) {
  // Temporarily set context so openQrModal pre-selects this cat in Group mode
  const prevCat   = selectedCat;
  const prevAlpha = selectedAlpha;
  selectedCat   = catKey;
  selectedAlpha = 'ALL';   // force ALL so Group tab is visible
  openQrModal();
  // Restore state so navigating back still works
  selectedCat   = prevCat;
  selectedAlpha = prevAlpha;
}

// QR for the current table result (ID-array of currentTableGuests)
function openQrForTable() {
  if (!currentTableGuests.length) return;
  clearGuestSelection();
  currentTableGuests.forEach(g => selectedGuests.add(g.id));
  openQrModal();
}

async function copyQrImage() {
  const canvas = document.querySelector('#qr-canvas-div canvas');
  if (!canvas) return;
  try {
    await new Promise(resolve => canvas.toBlob(async blob => {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      resolve();
    }, 'image/png'));
    const btn = document.getElementById('qr-copy-img-btn');
    if (btn) { const orig = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!'; setTimeout(() => btn.innerHTML = orig, 1800); }
  } catch (err) {
    alert('Could not copy image: ' + err.message);
  }
}

function openQrModal() {
  // Alphabet sub-view (not ALL) → Group mode not applicable; only ID-array available
  const alphaIsAll = !selectedAlpha || selectedAlpha === 'ALL';
  const groupTabBtn = document.getElementById('qr-mode-btn-group');
  groupTabBtn.style.display = alphaIsAll ? '' : 'none';

  if (selectedGuests.size > 0) {
    qrMode = 'ids';
  } else if (alphaIsAll) {
    qrMode = 'group';
  } else {
    qrMode = 'ids';
  }
  qrLeadId = null;

  document.getElementById('qr-mode-btn-ids').classList.toggle('active', qrMode === 'ids');
  groupTabBtn.classList.toggle('active', qrMode === 'group');

  // Build options scoped to current category context
  buildGroupSelect(selectedCat);
  initChoices();
  updateScopeDisabledStates(); // disable subCat options whose parent ALL is pre-selected

  document.getElementById('qr-scope-wrap').style.display = qrMode === 'group' ? 'block' : 'none';
  document.getElementById('qr-group-note').style.display = qrMode === 'group' ? 'block' : 'none';
  updateQrModal();
  document.getElementById('qr-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeQrModal() {
  document.getElementById('qr-modal').style.display = 'none';
  document.body.style.overflow = '';
}
function setQrMode(mode) {
  qrMode = mode; qrLeadId = null;
  document.getElementById('qr-mode-btn-ids').classList.toggle('active', mode === 'ids');
  document.getElementById('qr-mode-btn-group').classList.toggle('active', mode === 'group');
  document.getElementById('qr-scope-wrap').style.display = mode === 'group' ? 'block' : 'none';
  document.getElementById('qr-group-note').style.display = mode === 'group' ? 'block' : 'none';
  updateQrModal();
}
// contextCat: the currently viewed category key, or null for All Guests
function buildGroupSelect(contextCat) {
  const sel = document.getElementById('qr-scope-select');
  sel.innerHTML = '';
  // When a specific cat is selected → show only that cat's options
  // When null (All Guests) → show all cats
  const catsToShow = contextCat
    ? categories.filter(c => c.key === contextCat)
    : categories;
  catsToShow.forEach(cat => {
    const catGuests = allGuests.filter(g => g.cat === cat.key);
    if (!catGuests.length) return;
    const grp = document.createElement('optgroup');
    grp.label = cat.label;
    const allOpt = document.createElement('option');
    allOpt.value = JSON.stringify({ cat: cat.key, subCat: null });
    allOpt.textContent = `${cat.label} — ALL (${catGuests.length})`;
    allOpt.selected = false;
    grp.appendChild(allOpt);
    const subCats = [...new Set(catGuests.map(g => g.subCat || '').filter(Boolean))].sort();
    subCats.forEach(sc => {
      const cnt = catGuests.filter(g => (g.subCat || '') === sc).length;
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ cat: cat.key, subCat: sc });
      opt.textContent = `${cat.label} - ${sc} (${cnt})`;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
}
function showScopeInfo(msg) {
  const el = document.getElementById('scope-info-msg');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 5000);
}
function updateScopeDisabledStates() {
  if (!choicesInstance) return;
  const sel = document.getElementById('qr-scope-select');
  const selectedVals = choicesInstance.getValue(true);
  const selectedParsed = selectedVals.map(v => { try { return JSON.parse(v); } catch(e) { return null; } }).filter(Boolean);
  const allSelectedCats = new Set(selectedParsed.filter(g => g.subCat === null).map(g => g.cat));
  Array.from(sel.options).forEach(opt => {
    if (!opt.value) return;
    try { const p = JSON.parse(opt.value); if (p.subCat !== null) opt.disabled = allSelectedCats.has(p.cat); } catch(e) {}
  });
  choicesInstance.refresh();
}
function initChoices() {
  if (choicesInstance) { choicesInstance.destroy(); choicesInstance = null; }
  choicesInstance = new Choices('#qr-scope-select', {
    removeItemButton: true,
    searchEnabled: false,
    itemSelectText: '',
    shouldSort: false,
    allowHTML: false,
    classNames: { containerOuter: ['choices', 'qr-choices'] },
  });
  const selEl = document.getElementById('qr-scope-select');
  selEl.addEventListener('addItem', (e) => {
    const val = e.detail.value;
    let parsed; try { parsed = JSON.parse(val); } catch(err) { return; }
    setTimeout(() => {
      const selectedVals = choicesInstance.getValue(true);
      if (parsed.subCat === null) {
        // ALL selected → auto-remove any already-selected subCats for this cat
        const toRemove = selectedVals.filter(v => {
          try { const p = JSON.parse(v); return p.cat === parsed.cat && p.subCat !== null; } catch(err) { return false; }
        });
        if (toRemove.length > 0) {
          toRemove.forEach(v => choicesInstance.removeActiveItemsByValue(v));
          const catLabel = (categories.find(c => c.key === parsed.cat) || {}).label || parsed.cat;
          showScopeInfo(`Sub-categories for "${catLabel.replace(/^\p{Emoji}\s*/u, '')}" were removed — "ALL" already covers them.`);
          qrLeadId = null; updateQrModal();
        }
      } else {
        // SubCat selected → if parent ALL is already selected, deselect this subCat
        const allIsSelected = selectedVals.some(v => {
          try { const p = JSON.parse(v); return p.cat === parsed.cat && p.subCat === null; } catch(err) { return false; }
        });
        if (allIsSelected) {
          choicesInstance.removeActiveItemsByValue(val);
          const catLabel = (categories.find(c => c.key === parsed.cat) || {}).label || parsed.cat;
          showScopeInfo(`"${parsed.subCat}" is already covered by "${catLabel.replace(/^\p{Emoji}\s*/u, '')} — ALL". Deselected.`);
          qrLeadId = null; updateQrModal();
          return;
        }
      }
      updateScopeDisabledStates();
      qrLeadId = null; updateQrModal();
    }, 0);
  });
  selEl.addEventListener('removeItem', () => {
    setTimeout(() => { updateScopeDisabledStates(); qrLeadId = null; updateQrModal(); }, 0);
  });
}
function resolveQrGuests() {
  if (qrMode === 'ids')
    return [...selectedGuests].map(id => allGuests.find(g => g.id === id)).filter(Boolean);
  const groups = getSelectedGroups();
  return allGuests.filter(g =>
    groups.some(sg => g.cat === sg.cat && (sg.subCat === null || (g.subCat || '') === sg.subCat))
  );
}
function updateQrModal() {
  const guests = resolveQrGuests();
  document.getElementById('qr-guest-count').textContent =
    guests.length ? `${guests.length} guest${guests.length !== 1 ? 's' : ''} in scope` : 'No guests in scope';
  renderQrLeadList(guests);
  if (guests.length === 1) selectQrLead(guests[0].id);
  else renderQrCanvas();
}
function renderQrLeadList(guests) {
  const wrap = document.getElementById('qr-lead-list');
  if (!guests.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:14px 16px;font-size:13px;">No guests in scope.</div>';
    return;
  }
  const sorted = guests.slice().sort((a, b) => {
    const ln = (a.lastName || '').localeCompare(b.lastName || '', undefined, { sensitivity: 'base' });
    return ln !== 0 ? ln : (a.firstName || '').localeCompare(b.firstName || '', undefined, { sensitivity: 'base' });
  });
  wrap.innerHTML = sorted.map(g => {
    const isLead = String(g.id) === String(qrLeadId);
    const tc = getTableColor(g.tableName);
    const catObj = categories.find(c => c.key === g.cat);
    const catLabel = catObj ? catObj.label.replace(/^\p{Emoji}\s*/u, '') : (g.cat || '');
    const catLabelWithEmoji = catObj ? catObj.label : (g.cat || '');
    const groupInfo = g.subCat ? `${catLabel} · ${g.subCat}` : catLabel;
    const groupInfoWithEmoji = g.subCat ? `${catLabelWithEmoji} · ${g.subCat}` : catLabelWithEmoji;
    return `<div class="qr-lead-item${isLead ? ' selected' : ''}" data-id="${g.id}" onclick="selectQrLead(this.dataset.id)">
      <div class="qr-lead-radio"></div>
      <div style="flex:1;min-width:0;">
        <div class="qr-lead-name">${esc(g.lastName)} ${esc(g.firstName)}${g.nickName ? ` <span style="font-size:11px;color:var(--muted)">(${esc(g.nickName)})</span>` : ''}</div>
        <div class="qr-lead-sub">
          <span> - Group: ${esc(groupInfoWithEmoji)}</span>
          <br/>
          <span> - ID: ${g.id}</span>
        </div>
      </div>
      ${g.tableName ? `<span style="font-size:11px;font-weight:700;color:${tc};white-space:nowrap;">Table: ${esc(g.tableName)}</span>` : ''}
    </div>`;
  }).join('');
}
function selectQrLead(idRaw) {
  const guest = allGuests.find(g => String(g.id) === String(idRaw));
  if (!guest) return;
  qrLeadId = guest.id;
  document.querySelectorAll('.qr-lead-item').forEach(el =>
    el.classList.toggle('selected', String(el.dataset.id) === String(qrLeadId))
  );
  renderQrCanvas();
}
// Store current payload for copy/share/download
let _qrPayload = null, _qrEncoding = null;

function generateQrPayload() {
  const data = buildQrData();
  return data ? toBase64(data) : null;
}
function buildQrUrl() {
  const p = _qrPayload || generateQrPayload();
  if (!p) return null;
  return new URL('../table.html', location.href).href + `?qr=${encodeURIComponent(p)}`;
}
function renderQrCanvas() {
  const wrap       = document.getElementById('qr-canvas-wrap');
  const urlEl      = document.getElementById('qr-url-text');
  const decodeEl   = document.getElementById('qr-decode-info');
  const dlBtn      = document.getElementById('qr-dl-btn');
  const copyBtn    = document.getElementById('qr-copy-btn');
  const shareBtn   = document.getElementById('qr-share-btn');
  const copyImgBtn = document.getElementById('qr-copy-img-btn');
  const divEl      = document.getElementById('qr-canvas-div');

  _qrPayload = null; _qrEncoding = null;

  const data = buildQrData();
  if (!data) {
    wrap.style.display = urlEl.style.display = decodeEl.style.display = 'none';
    dlBtn.disabled = copyBtn.disabled = shareBtn.disabled = true;
    if (copyImgBtn) copyImgBtn.disabled = true;
    return;
  }

  const compactJson = jsonMinify(data);
  const payload64   = toBase64(data);
  const payload32   = toBase32(data);
  const QR_OPTS     = { width: 560, height: 560, colorDark: '#1a2030', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M };
  let qrErr = false;

  divEl.innerHTML = '';
  try {
    new QRCode(divEl, { ...QR_OPTS, text: payload64 });
    _qrPayload = payload64; _qrEncoding = 'base64';
  } catch (_) {
    divEl.innerHTML = '';
    try {
      new QRCode(divEl, { ...QR_OPTS, text: payload32 });
      _qrPayload = payload32; _qrEncoding = 'base32';
    } catch (_2) { qrErr = true; }
  }

  wrap.style.display = decodeEl.style.display = 'block';

  if (qrErr) {
    divEl.innerHTML = '<div class="qr-overflow-error"><i class="fa-solid fa-circle-exclamation"></i> QR overflow — too many guests or groups. Please reduce your selection.</div>';
    urlEl.style.display = 'none';
    dlBtn.disabled = copyBtn.disabled = shareBtn.disabled = true;
    if (copyImgBtn) copyImgBtn.disabled = true;
    decodeEl.innerHTML = buildDecodeInfoHtml(data, compactJson, null, null);
    return;
  }

  const url = new URL('../table.html', location.href).href + `?qr=${encodeURIComponent(_qrPayload)}`;
  urlEl.style.display = 'block';
  urlEl.textContent = url;
  dlBtn.disabled = copyBtn.disabled = shareBtn.disabled = false;
  if (copyImgBtn) copyImgBtn.disabled = !navigator.clipboard?.write;
  decodeEl.innerHTML = buildDecodeInfoHtml(data, compactJson, _qrPayload, _qrEncoding);
}
function catLabelFromCode(c) {
  const key = typeof c === 'number' ? (QR_CAT_RMAP[c] || String(c)) : c;
  const catObj = categories.find(cat => cat.key === key);
  return catObj ? catObj.label.replace(/^\p{Emoji}\s*/u, '') : key;
}
function leadNameFromId(id) {
  if (id == null) return '—';
  const g = allGuests.find(g => String(g.id) === String(id));
  return g ? `${g.lastName} ${g.firstName}` : String(id);
}
function buildDecodeInfoHtml(data, compactJson, payload, encoding) {
  if (!data) return '<div class="qdi-mode">⚠ Could not build payload</div>';
  let modeHtml = '', bodyHtml = '';

  if (data.v === 1) {
    const others = data.i || [];
    const total = 1 + others.length;
    modeHtml = `<div class="qdi-mode"><i class="fa-solid fa-lock"></i> ID-list — v1 (${total} guest${total !== 1 ? 's' : ''})</div>`;
    bodyHtml = `lead: ${esc(leadNameFromId(data.l))} [id=${esc(String(data.l))}]\nids:  [${[data.l, ...others].map(id => esc(String(id))).join(', ')}]`;
  } else if (data.v === 2) {
    modeHtml = `<div class="qdi-mode"><i class="fa-solid fa-users"></i> Group — v2 (single group)</div>`;
    bodyHtml = `cat:    ${esc(catLabelFromCode(data.c))}\nsubCat: ${data.s != null ? esc(data.s) : 'ALL'}\nlead:   ${esc(leadNameFromId(data.l))}`;
  } else if (data.v === 3) {
    const n = data.g.length;
    modeHtml = `<div class="qdi-mode"><i class="fa-solid fa-users"></i> Group — v3 (${n} group${n !== 1 ? 's' : ''})</div>`;
    const groupLines = data.g.map(sg => `  ${esc(catLabelFromCode(sg.c))} / ${sg.s != null ? esc(sg.s) : 'ALL'}`).join('\n');
    bodyHtml = `groups:\n${groupLines}\nlead: ${esc(leadNameFromId(data.l))}`;
  } else {
    modeHtml = `<div class="qdi-mode"><i class="fa-solid fa-lock"></i> Unknown format</div>`;
    bodyHtml = esc(compactJson);
  }

  const payloadHtml = payload
    ? `<div class="qdi-payload">
        <div class="qdi-payload-label">Encoding: ${esc(encoding)} · ${payload.length} chars</div>
        <div class="qdi-payload-label">Payload:</div><pre>${esc(payload)}</pre>
        <div class="qdi-payload-label" style="margin-top:4px">Minified JSON:</div><pre>${esc(compactJson)}</pre>
      </div>`
    : `<div class="qdi-payload">
        <div class="qdi-payload-label" style="color:#c0392b">QR generation failed — payload too large</div>
        <div class="qdi-payload-label" style="margin-top:4px">Minified JSON:</div><pre>${esc(compactJson)}</pre>
      </div>`;

  return modeHtml + `<pre>${bodyHtml}</pre>` + payloadHtml;
}
function downloadQr() {
  const lead = qrLeadId !== null ? allGuests.find(g => String(g.id) === String(qrLeadId)) : null;
  const groups = getSelectedGroups();
  let filename;
  if (qrMode === 'ids') {
    const guests = resolveQrGuests();
    const leadName = lead ? lead.lastName + lead.firstName : 'invite';
    filename = guests.length === 1
      ? `qr-guest-${leadName}.png`
      : `qr-guests-${leadName}.png`;
  } else {
    if (groups.length === 1) {
      const { cat, subCat } = groups[0];
      filename = `qr-group-${subCat || cat}.png`;
    } else {
      const firstLabel = groups[0].subCat || groups[0].cat;
      filename = `qr-groups-${firstLabel}+${groups.length - 1}.png`;
    }
  }
  const a = document.createElement('a');
  a.download = filename;
  a.href = document.querySelector('#qr-canvas-div canvas').toDataURL('image/png');
  a.click();
}
async function copyQrLink() {
  const url = buildQrUrl(); if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById('qr-copy-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1800);
  } catch {}
}
async function shareQr() {
  const url = buildQrUrl(); if (!url) return;
  if (navigator.share) {
    try {
      const lead = qrLeadId !== null ? allGuests.find(g => g.id === qrLeadId) : null;
      await navigator.share({ title: `Wedding — ${lead ? lead.lastName + ' ' + lead.firstName : 'Guest'}`, url });
    } catch (e) { if (e.name !== 'AbortError') copyQrLink(); }
  } else { copyQrLink(); }
}

// ─── Name search (with pinyin support)
function filterGuests(query) {
  if (!query.trim()) { renderGuestList(filteredByAlpha); return; }
  const filtered = filteredByAlpha.filter(g => matchGuestTokenized(g, query));
  renderGuestList(filtered);
}
function clearSearch() {
  document.getElementById('name-search').value = '';
  renderGuestList(filteredByAlpha);
}

// ─── Render guest list (multi-select, table colors, subcat + seat)
function renderGuestList(guests) {
  const wrap = document.getElementById('guest-list-wrap');
  if (!guests.length) {
    wrap.innerHTML = '<div class="empty-state">No guests found.</div>';
    return;
  }
  const sorted = guests.slice().sort((a, b) => {
    const ln = (a.lastName || '').localeCompare(b.lastName || '', undefined, { sensitivity: 'base' });
    return ln !== 0 ? ln : (a.firstName || '').localeCompare(b.firstName || '', undefined, { sensitivity: 'base' });
  });
  wrap.innerHTML = `<div class="guest-list">${sorted.map(g => {
    const tableColor = getTableColor(g.tableName);
    const isSelected = selectedGuests.has(g.id);
    const nickHtml = g.nickName ? ` <span class="g-nick">(${esc(g.nickName)})</span>` : '';
    const subHtml  = g.subCat   ? `<div class="g-sub">${esc(g.subCat)}</div>` : '';
    const badgeHtml = g.tableName
      ? `<div class="g-badge" style="background:${tableColor}">Table: ${esc(g.tableName)}</div>` : '';
    const seatHtml  = g.seat != null
      ? `<div class="g-seat-num">Seat ${g.seat}</div>` : '';
    return `
      <div class="guest-item${isSelected ? ' selected' : ''}" data-id="${g.id}">
        <div class="g-strip" style="background:${tableColor}"></div>
        <div class="g-sel-box"></div>
        <div class="g-info">
          <div class="g-name">${esc(g.lastName)} ${esc(g.firstName)}${nickHtml}</div>
          ${subHtml}
          <div class="g-sub" style="font-family:monospace;font-size:10px;">ID: ${g.id}</div>
        </div>
        <div class="g-table-col">${badgeHtml}${seatHtml}</div>
      </div>`;
  }).join('')}</div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Multi-select
function toggleGuestSelect(id) {
  if (selectedGuests.has(id)) selectedGuests.delete(id);
  else selectedGuests.add(id);
  const item = document.querySelector(`.guest-item[data-id="${id}"]`);
  if (item) item.classList.toggle('selected', selectedGuests.has(id));
  updateSelectionBar();
}

function clearGuestSelection() {
  selectedGuests.clear();
  document.querySelectorAll('.guest-item.selected').forEach(el => el.classList.remove('selected'));
  updateSelectionBar();
}

function updateSelectionBar() {
  const count = selectedGuests.size;
  const info     = document.getElementById('name-action-info');
  const clearBtn = document.getElementById('name-clear-btn');
  const viewBtn  = document.getElementById('name-view-btn');
  if (info)     info.textContent = count > 0 ? `${count} guest${count > 1 ? 's' : ''} selected` : '';
  if (clearBtn) clearBtn.disabled = count === 0;
  if (viewBtn)  viewBtn.disabled  = count === 0;
}

// ─── Drag-to-select (touch + mouse)
function initDragSelect() {
  const wrap = document.getElementById('guest-list-wrap');
  let dragging = false, dragMode = true, startId = null, lastId = null, moved = false, suppressClick = false;

  function applyTo(id) {
    const el = wrap.querySelector(`.guest-item[data-id="${id}"]`);
    if (!el) return;
    if (dragMode && !selectedGuests.has(id)) {
      selectedGuests.add(id); el.classList.add('selected'); updateSelectionBar();
    } else if (!dragMode && selectedGuests.has(id)) {
      selectedGuests.delete(id); el.classList.remove('selected'); updateSelectionBar();
    }
  }
  function activate(id) {
    moved = true; suppressClick = true;
    const el = wrap.querySelector(`.guest-item[data-id="${id}"]`);
    if (!el) return;
    if (selectedGuests.has(id)) {
      selectedGuests.delete(id); el.classList.remove('selected'); dragMode = false;
    } else {
      selectedGuests.add(id); el.classList.add('selected'); dragMode = true;
    }
    updateSelectionBar();
  }
  function reset() { dragging = false; moved = false; startId = null; lastId = null; }

  // Single-tap via delegated click (fires after touchend on mobile)
  wrap.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; return; }
    const item = e.target.closest('.guest-item');
    if (item) toggleGuestSelect(parseInt(item.dataset.id));
  });

  // Touch
  wrap.addEventListener('touchstart', e => {
    const item = e.target.closest('.guest-item');
    if (!item) return;
    startId = parseInt(item.dataset.id); lastId = startId; dragging = true; moved = false;
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (!dragging) return;
    const t = e.touches[0];
    const item = document.elementFromPoint(t.clientX, t.clientY)?.closest('.guest-item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    if (!moved && id !== startId) { e.preventDefault(); activate(startId); }
    if (moved) { e.preventDefault(); if (id !== lastId) { lastId = id; applyTo(id); } }
  }, { passive: false });

  wrap.addEventListener('touchend',   reset, { passive: true });
  wrap.addEventListener('touchcancel', reset, { passive: true });

  // Mouse (desktop drag-select)
  wrap.addEventListener('mousedown', e => {
    const item = e.target.closest('.guest-item');
    if (!item) return;
    e.preventDefault(); // prevent text selection during drag
    startId = parseInt(item.dataset.id); lastId = startId; dragging = true; moved = false;
  });
  wrap.addEventListener('mousemove', e => {
    if (!dragging || !(e.buttons & 1)) { if (dragging) reset(); return; }
    const item = e.target.closest('.guest-item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    if (!moved && id !== startId) activate(startId);
    if (moved && id !== lastId) { lastId = id; applyTo(id); }
  });
  wrap.addEventListener('mouseup', reset);
}

function showSelectedResult() {
  const guests = allGuests.filter(g => selectedGuests.has(g.id));
  if (!guests.length) return;
  document.getElementById('result-detail').innerHTML = buildResultHtml(guests, 'seat');
  document.getElementById('table-sort-bar').style.display = 'none';
  document.getElementById('table-filter-bar').style.display = 'none';
  showSearchScreen('result');
}

function backToSearch() {
  if (viewMode === 'tables') {
    showSearchScreen('tables');
  } else {
    showSearchScreen(filteredByAlpha.length ? 'name' : 'alpha');
  }
}

// ─── Screen navigation (single-column, one screen at a time)
function showSearchScreen(name) {
  if (name === 'cat') viewMode = 'search';
  const navEl  = document.querySelector('.search-nav');
  const mainEl = document.querySelector('.search-main');
  const navScreens  = ['cat', 'alpha', 'tables'];
  const mainScreens = ['placeholder', 'name', 'result'];

  navEl.classList.toggle('panel-active', navScreens.includes(name));
  mainEl.classList.toggle('panel-active', mainScreens.includes(name));

  navScreens.forEach(s  => document.getElementById('screen-' + s).classList.toggle('active', s === name));
  mainScreens.forEach(s => document.getElementById('screen-' + s).classList.toggle('active', s === name));

  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateSelectionBar();
}

// ─── Build result HTML (table colors, multi-table support, tabular layout)
function buildResultHtml(highlightGuests, sortMode = 'seat') {
  // Group highlighted guests by table
  const tableMap = {};
  highlightGuests.forEach(g => {
    const k = g.tableName || '—';
    if (!tableMap[k]) tableMap[k] = { name: k, seq: g.tableSeq || 0, guests: [] };
    tableMap[k].guests.push(g);
  });

  // Cat order for relation sort
  const catOrder = {};
  KNOWN_CATS.forEach((c, i) => { catOrder[c.key] = i; });

  let html = '';
  Object.values(tableMap).sort((a, b) => a.seq - b.seq).forEach(table => {
    const tableColor = getTableColor(table.name === '—' ? null : table.name);
    const sortedGuests = sortMode === 'relation'
      ? table.guests.slice().sort((a, b) => {
          const co = (catOrder[a.cat] ?? 99) - (catOrder[b.cat] ?? 99);
          if (co !== 0) return co;
          const ln = (a.lastName || '').localeCompare(b.lastName || '', undefined, { sensitivity: 'base' });
          return ln !== 0 ? ln : (a.firstName || '').localeCompare(b.firstName || '', undefined, { sensitivity: 'base' });
        })
      : table.guests.slice().sort((a, b) => (a.seat ?? 999) - (b.seat ?? 999));
    html += `<div class="result-card" style="border-color:${tableColor};border-top-color:${tableColor}">
      <div class="result-table-name" style="color:${tableColor}">Table: ${esc(table.name)}</div>
      <table class="result-guest-table">
        <thead>
          <tr>
            <th style="width:48px;text-align:center;">Seat</th>
            <th>Name</th>
            <th>Relationship</th>
            <th>Sub Category</th>
            <th style="width:52px;text-align:center;">ID</th>
          </tr>
        </thead>
        <tbody>
          ${sortedGuests.map(g => {
            const cat = categories.find(c => c.key === g.cat);
            const catLabel = cat ? cat.label : (g.cat || '—');
            const seatNum = g.seat != null ? g.seat : '—';
            const nickHtml = g.nickName ? ` <span class="result-nick">(${esc(g.nickName)})</span>` : '';
            return `<tr>
              <td class="result-seat-cell" style="color:${tableColor}">${seatNum}</td>
              <td class="result-name-cell">${esc(g.lastName)} ${esc(g.firstName)}${nickHtml}</td>
              <td style="color:var(--text2)">${esc(catLabel)}</td>
              <td style="color:var(--text2)">${esc(g.subCat || '')}</td>
              <td style="text-align:center;font-family:monospace;font-size:11px;color:var(--muted)">${g.id}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  });
  return html || '<div class="empty-state">No table assigned.</div>';
}
