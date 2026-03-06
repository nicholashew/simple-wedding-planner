// ══════════════════════════════════════════════════════
//  homestay.js — Homestay Planner logic
// ══════════════════════════════════════════════════════

// ── STATE
let persons = [], rooms = [];
let dragPersonId = null;
let selectedColor = '#60c0f0';
let bulkColor     = '#60c0f0';
let personIdCounter = 1, roomIdCounter = 1;
let editingPersonId = null, editingRoomId = null, editingPersonColor = '#60c0f0';
let currentSort = 'default';
let searchQuery = '';

// Undo (single-level)
let undoStack = null;
let undoTimer = null;

const COLORS = ['#60c0f0','#f0c060','#60f0a0','#f06060','#c060f0','#f0a060','#60f0e0','#f060c0','#a0f060','#6080f0'];

// ── INIT
function init() {
  // Shared nav initialises localStorage for us
  initSharedNav({
    key: 'homestay-v1',
    getState: () => ({ version: 1, personIdCounter, roomIdCounter, persons, rooms }),
    setState: (data) => {
      if (!Array.isArray(data.persons) || !Array.isArray(data.rooms)) return;
      persons         = data.persons;
      rooms           = data.rooms;
      rooms.forEach(r => { if (r.description === undefined) r.description = ''; });
      personIdCounter = data.personIdCounter || (Math.max(0, ...persons.map(p => p.id), 0) + 1);
      roomIdCounter   = data.roomIdCounter   || (Math.max(0, ...rooms.map(r => r.id),   0) + 1);
    },
    onLoad: () => render(),
  });

  render();
}

// Hook all state mutations to markUnsaved
function mutate(fn) {
  fn();
  if (typeof markUnsaved === 'function') markUnsaved();
}

// ── COLOR PICKERS
function mkColors(containerId, current, onSelect) {
  document.getElementById(containerId).innerHTML = COLORS.map(c =>
    `<div class="color-dot ${c===current?'selected':''}" style="background:${c}" onclick="${onSelect}('${c}')"></div>`
  ).join('');
}
function renderAddPersonColors() { mkColors('person-colors', selectedColor, 'selectAddColor'); }
function selectAddColor(c)       { selectedColor = c; renderAddPersonColors(); }
function renderModalPersonColors(){ mkColors('ep-colors', editingPersonColor, 'selectModalColor'); }
function selectModalColor(c)     { editingPersonColor = c; renderModalPersonColors(); }
function renderBulkColors()      { mkColors('bulk-colors', bulkColor, 'selectBulkColor'); }
function selectBulkColor(c)      { bulkColor = c; renderBulkColors(); }

// ── SEARCH
function onSearch() {
  searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
  document.getElementById('search-clear').classList.toggle('visible', searchQuery.length > 0);
  applySearch();
}
function clearSearch() {
  document.getElementById('search-input').value = '';
  searchQuery = '';
  document.getElementById('search-clear').classList.remove('visible');
  applySearch();
}
function applySearch() {
  const cards = document.querySelectorAll('.person-card');
  let matchCount = 0;
  cards.forEach(el => {
    const name = el.querySelector('.card-name')?.textContent?.toLowerCase() || '';
    const matches = !searchQuery || name.includes(searchQuery);
    el.classList.toggle('filtered-out', !matches);
    if (matches) matchCount++;
  });
  const status = document.getElementById('search-status');
  if (searchQuery) {
    status.textContent = `${matchCount} match${matchCount!==1?'es':''}`;
  } else {
    status.textContent = '';
  }
}

// ── SORT
function setSort(s) {
  currentSort = s;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort===s));
  renderRooms();
}
function sortedRooms() {
  const copy = [...rooms];
  const occ  = r => persons.filter(p=>p.roomId===r.id).length;
  const avail = r => r.capacity - occ(r);
  if (currentSort==='name')  return copy.sort((a,b)=>a.name.localeCompare(b.name));
  if (currentSort==='fill')  return copy.sort((a,b)=>occ(b)-occ(a));
  if (currentSort==='avail') return copy.sort((a,b)=>avail(b)-avail(a));
  return copy;
}

// ── UNDO
function snapshot(msg) {
  undoStack = {
    msg,
    persons: JSON.parse(JSON.stringify(persons)),
    rooms:   JSON.parse(JSON.stringify(rooms)),
    personIdCounter, roomIdCounter
  };
  showUndoBar(msg);
}
function showUndoBar(msg) {
  clearTimeout(undoTimer);
  document.getElementById('undo-msg').textContent = msg;
  document.getElementById('undo-bar').classList.remove('hidden');
  undoTimer = setTimeout(dismissUndo, 6000);
}
function dismissUndo() {
  document.getElementById('undo-bar').classList.add('hidden');
  clearTimeout(undoTimer);
}
function doUndo() {
  if (!undoStack) return;
  persons         = undoStack.persons;
  rooms           = undoStack.rooms;
  personIdCounter = undoStack.personIdCounter;
  roomIdCounter   = undoStack.roomIdCounter;
  undoStack = null;
  dismissUndo();
  render();
  if (typeof markUnsaved === 'function') markUnsaved();
  toast('Undone!', 'info');
}

// ── CRUD — PERSONS
function addPerson() {
  const inp = document.getElementById('person-name');
  const name = inp.value.trim();
  if (!name) { toast('Enter a name!', 'error'); return; }
  mutate(() => persons.push({ id: personIdCounter++, name, color: selectedColor, roomId: null }));
  inp.value = '';
  render();
  toast(`"${name}" added!`, 'success');
}

function deletePerson(id) {
  const p = persons.find(x=>x.id===id);
  snapshot(`Deleted "${p?.name}"`);
  mutate(() => { persons = persons.filter(x=>x.id!==id); });
  render();
}

function openEditPerson(id) {
  const p = persons.find(x=>x.id===id); if (!p) return;
  editingPersonId = id; editingPersonColor = p.color;
  document.getElementById('ep-name').value = p.name;
  renderModalPersonColors();
  document.getElementById('edit-person-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('ep-name').select(), 50);
}
function closePersonModal() {
  document.getElementById('edit-person-modal').classList.add('hidden');
  editingPersonId = null;
}
function savePersonEdit() {
  const name = document.getElementById('ep-name').value.trim();
  if (!name) { toast('Name cannot be empty!','error'); return; }
  const p = persons.find(x=>x.id===editingPersonId);
  if (p) { mutate(() => { p.name = name; p.color = editingPersonColor; }); }
  closePersonModal(); render();
  toast(`Updated to "${name}"`, 'info');
}

function openBulkModal() {
  document.getElementById('bulk-names').value = '';
  bulkColor = selectedColor;
  renderBulkColors();
  document.getElementById('bulk-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('bulk-names').focus(), 50);
}
function closeBulkModal() {
  document.getElementById('bulk-modal').classList.add('hidden');
}
function saveBulkAdd() {
  const raw = document.getElementById('bulk-names').value;
  const names = raw.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
  if (!names.length) { toast('No names entered!','error'); return; }
  mutate(() => {
    names.forEach(name => {
      persons.push({ id: personIdCounter++, name, color: bulkColor, roomId: null });
    });
  });
  closeBulkModal(); render();
  toast(`Added ${names.length} person${names.length!==1?'s':''}!`, 'success');
}

// ── CRUD — ROOMS
function addRoom() {
  const ni = document.getElementById('room-name');
  const ci = document.getElementById('room-cap');
  const di = document.getElementById('room-desc');
  const name = ni.value.trim() || `Room ${roomIdCounter}`;
  const cap  = Math.max(1, parseInt(ci.value)||4);
  const desc = di.value.trim();
  mutate(() => rooms.push({ id: roomIdCounter++, name, capacity: cap, description: desc }));
  ni.value = ''; di.value = '';
  render();
  toast(`"${name}" created!`, 'success');
}

function deleteRoom(id) {
  const r = rooms.find(x=>x.id===id);
  snapshot(`Deleted room "${r?.name}"`);
  mutate(() => {
    persons.forEach(p=>{ if(p.roomId===id) p.roomId=null; });
    rooms = rooms.filter(x=>x.id!==id);
  });
  render();
}

function openEditRoom(id) {
  const r = rooms.find(x=>x.id===id); if (!r) return;
  editingRoomId = id;
  document.getElementById('er-name').value = r.name;
  document.getElementById('er-cap').value  = r.capacity;
  document.getElementById('er-desc').value = r.description || '';
  document.getElementById('edit-room-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('er-name').select(), 50);
}
function closeRoomModal() {
  document.getElementById('edit-room-modal').classList.add('hidden');
  editingRoomId = null;
}
function saveRoomEdit() {
  const name = document.getElementById('er-name').value.trim();
  const cap  = Math.max(1, parseInt(document.getElementById('er-cap').value)||1);
  const desc = document.getElementById('er-desc').value.trim();
  if (!name) { toast('Room name cannot be empty!','error'); return; }
  const r = rooms.find(x=>x.id===editingRoomId);
  if (r) { mutate(() => { r.name = name; r.capacity = cap; r.description = desc; }); }
  closeRoomModal(); render();
  toast(`Room updated: "${name}"`, 'info');
}

// ── Close modals on backdrop click
document.getElementById('edit-person-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closePersonModal();});
document.getElementById('edit-room-modal'  ).addEventListener('click',e=>{if(e.target===e.currentTarget)closeRoomModal();});
document.getElementById('bulk-modal'       ).addEventListener('click',e=>{if(e.target===e.currentTarget)closeBulkModal();});

// ── SAVE / LOAD JSON  (export / import file)
function saveJSON() {
  const data = { version:1, savedAt:new Date().toISOString(), personIdCounter, roomIdCounter, persons, rooms };
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `homestay-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`Exported — ${rooms.length} rooms, ${persons.length} persons`, 'success');
}
function loadJSON() { document.getElementById('file-input').click(); }
function onFileLoad(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.persons)||!Array.isArray(data.rooms)) throw new Error();
      mutate(() => {
        persons         = data.persons;
        rooms           = data.rooms;
        rooms.forEach(r=>{ if(r.description===undefined) r.description=''; });
        personIdCounter = data.personIdCounter||(Math.max(0,...persons.map(p=>p.id),0)+1);
        roomIdCounter   = data.roomIdCounter  ||(Math.max(0,...rooms.map(r=>r.id),0)+1);
      });
      render();
      toast(`Loaded: ${rooms.length} rooms, ${persons.length} persons`, 'success');
    } catch(_) { toast('Invalid or corrupted JSON file!','error'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── DRAG & DROP
function onDragStart(e, personId) {
  dragPersonId = personId;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(()=>{
    document.querySelectorAll(`.person-card[data-id="${personId}"]`).forEach(el=>el.classList.add('dragging'));
  },0);
}
function onDragEnd() {
  document.querySelectorAll('.person-card').forEach(el=>el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over' ).forEach(el=>el.classList.remove('drag-over'));
  dragPersonId = null;
}
function onDragOver(e, roomId) {
  e.preventDefault(); e.dataTransfer.dropEffect='move';
  const t = roomId===null
    ? document.getElementById('unassigned-zone')
    : document.querySelector(`.room-card[data-id="${roomId}"]`);
  if (t) t.classList.add('drag-over');
}
function onDragLeave(e) {
  const t = e.currentTarget;
  if (!t.contains(e.relatedTarget)) t.classList.remove('drag-over');
}
function onDrop(e, roomId) {
  e.preventDefault();
  document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
  if (dragPersonId===null) return;
  const person = persons.find(p=>p.id===dragPersonId); if (!person) return;
  if (roomId!==null) {
    const room = rooms.find(r=>r.id===roomId);
    const occ  = persons.filter(p=>p.roomId===roomId).length;
    if (occ>=room.capacity && person.roomId!==roomId) {
      toast(`"${room.name}" is full!`, 'error'); return;
    }
  }
  mutate(() => { person.roomId = roomId; });
  render();
}

// ── RENDER
function render() {
  renderAddPersonColors();
  renderUnassigned();
  renderRooms();
  renderStats();
  setTimeout(applySearch, 0);
}

function renderUnassigned() {
  const unassigned = persons.filter(p=>p.roomId===null);
  const zone  = document.getElementById('unassigned-zone');
  const empty = document.getElementById('unassigned-empty');
  document.getElementById('unassigned-count').textContent = unassigned.length;
  zone.querySelectorAll('.person-card').forEach(el=>el.remove());
  if (unassigned.length===0) { empty.style.display=''; }
  else { empty.style.display='none'; unassigned.forEach(p=>zone.appendChild(createPersonCard(p))); }
}

function renderRooms() {
  const grid = document.getElementById('rooms-grid');
  const es   = document.getElementById('empty-state');
  es.style.display = rooms.length?'none':'';
  grid.querySelectorAll('.room-card').forEach(el=>el.remove());

  sortedRooms().forEach(room => {
    const occupants = persons.filter(p=>p.roomId===room.id);
    const occ       = occupants.length;
    const cap       = room.capacity;
    const isFull    = occ >= cap;
    const capClass  = isFull?'full':(occ>0?'ok':'');
    const pct   = cap>0 ? Math.min(100, Math.round(occ/cap*100)) : 0;
    const pFill = isFull ? 'full' : (pct>=60?'warn':'');
    const tipNames = occupants.map(p=>p.name).join(', ') || 'Empty';

    const card = document.createElement('div');
    card.className  = 'room-card';
    card.dataset.id = room.id;
    card.ondragover  = e=>onDragOver(e,room.id);
    card.ondragleave = onDragLeave;
    card.ondrop      = e=>onDrop(e,room.id);

    card.innerHTML = `
      <div class="room-header">
        <span class="room-icon">🛏️</span>
        <span class="room-name-label" title="${escHtml(room.name)}">${escHtml(room.name)}</span>
        <span class="room-capacity ${capClass}" title="${escHtml(tipNames)}">${occ}/${cap}</span>
        <button class="icon-btn edit" onclick="openEditRoom(${room.id})" title="Edit room">✏️</button>
        <button class="icon-btn del"  onclick="confirmDeleteRoom(${room.id})"   title="Delete room">🗑️</button>
      </div>
      <div class="room-progress">
        <div class="room-progress-fill ${pFill}" style="width:${pct}%"></div>
      </div>
      ${room.description?`<div class="room-desc">${escHtml(room.description)}</div>`:''}
      <div class="room-body" id="rb-${room.id}">
        ${occ===0?'<div class="room-empty">Drop person here</div>':''}
      </div>`;

    grid.appendChild(card);
    const body = document.getElementById(`rb-${room.id}`);
    occupants.forEach(p=>body.appendChild(createPersonCard(p)));
  });
}

function createPersonCard(person) {
  const div = document.createElement('div');
  div.className   = 'person-card';
  div.dataset.id  = person.id;
  div.draggable   = true;
  div.ondragstart = e=>onDragStart(e,person.id);
  div.ondragend   = onDragEnd;
  const initials = person.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  div.innerHTML = `
    <div class="avatar" style="background:${person.color}22;color:${person.color};border:1.5px solid ${person.color}">
      ${escHtml(initials)}
    </div>
    <span class="card-name" title="${escHtml(person.name)}">${escHtml(person.name)}</span>
    <button class="icon-btn edit" onclick="openEditPerson(${person.id})" title="Edit">✏️</button>
    <button class="icon-btn del"  onclick="confirmDeletePerson(${person.id})"   title="Remove">🗑️</button>`;
  return div;
}

function renderStats() {
  const assigned = persons.filter(p=>p.roomId!==null).length;
  const totalCap = rooms.reduce((s,r)=>s+r.capacity,0);
  document.getElementById('stat-persons').textContent  = persons.length;
  document.getElementById('stat-assigned').textContent = assigned;
  document.getElementById('stat-rooms').textContent    = rooms.length;
  document.getElementById('stat-capacity').textContent = totalCap;
}

// ── UTILITIES
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _toastTimer;
function toast(msg, type='') {
  document.querySelectorAll('.toast').forEach(el=>el.remove());
  const t = document.createElement('div');
  t.className = 'toast '+type; t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>t.remove(), 2500);
}

// ── Keyboard shortcuts
document.getElementById('person-name').addEventListener('keydown',e=>{ if(e.key==='Enter') addPerson(); });
document.getElementById('room-name'  ).addEventListener('keydown',e=>{ if(e.key==='Enter') addRoom(); });
document.getElementById('ep-name'    ).addEventListener('keydown',e=>{ if(e.key==='Enter') savePersonEdit(); if(e.key==='Escape') closePersonModal(); });
document.getElementById('er-name'    ).addEventListener('keydown',e=>{ if(e.key==='Enter') saveRoomEdit();   if(e.key==='Escape') closeRoomModal(); });
document.getElementById('er-cap'     ).addEventListener('keydown',e=>{ if(e.key==='Enter') saveRoomEdit();   if(e.key==='Escape') closeRoomModal(); });
document.addEventListener('keydown', e=>{
  if (e.key==='Escape') { closePersonModal(); closeRoomModal(); closeBulkModal(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='z') { doUndo(); e.preventDefault(); }
});

init();

// ── DELETE CONFIRMATIONS
function _hcOpen(title, bodyHtml, btnLabel, action, target){
  document.getElementById('hc-title').textContent = title;
  document.getElementById('hc-body').innerHTML = bodyHtml;
  const btn = document.getElementById('hc-confirm-btn');
  btn.textContent = btnLabel;
  btn.style.background = 'var(--danger)';
  btn.style.color = '#fff';
  window._hcAction = action; window._hcTarget = target;
  document.getElementById('modal-confirm').classList.remove('hidden');
}
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }

function execConfirm(){
  closeModal('modal-confirm');
  document.getElementById('hc-confirm-btn').style.background = '';
  document.getElementById('hc-confirm-btn').style.color = '';
  if(window._hcAction === 'deletePerson') deletePerson(window._hcTarget);
  else if(window._hcAction === 'deleteRoom')   deleteRoom(window._hcTarget);
  window._hcAction = null; window._hcTarget = null;
}

function confirmDeletePerson(id){
  const p = persons.find(x => x.id === id); if(!p) return;
  _hcOpen(
    'Remove Person?',
    `<div style="padding:4px 0">Remove <b>${p.name}</b> from the planner?`+
    (p.roomId ? ` They are currently assigned to a room.` : '')+`</div>`,
    'Remove', 'deletePerson', id
  );
}
function confirmDeleteRoom(id){
  const r = rooms.find(x => x.id === id); if(!r) return;
  const count = persons.filter(p => p.roomId === id).length;
  _hcOpen(
    'Delete Room?',
    `<div style="padding:4px 0">Delete <b>${r.name}</b>?`+
    (count ? ` <span style="color:var(--danger)">${count} person${count!==1?'s':''} will be unassigned.</span>` : '')+`</div>`,
    'Delete Room', 'deleteRoom', id
  );
}

// close confirm modal on backdrop click
document.getElementById('modal-confirm').addEventListener('click', e => {
  if(e.target === e.currentTarget) closeModal('modal-confirm');
});