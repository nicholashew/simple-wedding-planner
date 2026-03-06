// ══════════════════════════════════════════════════════
//  wedding.js — Wedding Banquet Planner logic
// ══════════════════════════════════════════════════════

// ── STATE
let guests=[], tables=[], objects=[];
let gId=1, tId=1, oId=1;
let selColor='#b8923a', bulkColor='#b8923a', egColor='#b8923a';
let egId=null, etId=null, eoId=null;
let activeFilter='all', selEl=null, dragGId=null, moving=null;

// ── CANVAS STATE
let gridVisible=true;

// ── GUEST LIST SORT STATE
// Multi-sort stack: [{col, dir}]  (first = primary sort)
let glSortStack=[{col:'table',dir:1}]; // default: sort by table ASC

// ── MULTI-SELECT STATE (unassigned sidebar)
let multiSelectMode=false;
let selectedGuests=new Set(); // Set of guest IDs

// ── TABLE SEAT MULTI-SELECT STATE
let tableSeatSelectMode=false;   // which tableId is in seat-select mode
let selectedTableSeats=new Set(); // Set of guest IDs from that table's seats

const COLORS=[
  '#b8923a','#c0607a','#5a8f6a','#4a72c4','#8a5abc','#d07830',
  '#3a9aaa','#c04444','#5a8040','#a06090','#d4a020','#2a8080',
  '#e05050','#4060c0','#60a060','#c06020','#8040a0','#20a0a0',
  '#c08040','#6080c0','#a04060','#40a080','#d06080','#8060a0',
];
const CAT={
  'bride-family':{short:'🌸 Bride Family',  cls:'cat-bride-family'},
  'bride-rel':   {short:'🌺 Bride Relative',cls:'cat-bride-rel'},
  'bride-friend':{short:'🪷 Bride Friend',  cls:'cat-bride-friend'},
  'groom-family':{short:'💠 Groom Family',  cls:'cat-groom-family'},
  'groom-rel':   {short:'🔷 Groom Relative',cls:'cat-groom-rel'},
  'groom-friend':{short:'🫐 Groom Friend',  cls:'cat-groom-friend'},
};
const SEAT_COUNT=10, DISC_R=80, SEAT_W=108, TW=500;
const SEAT_GAP=60; // gap between disc edge and seat edge
// Dynamic orbit = DISC_R + SEAT_GAP + half-seat-height (approx 40px)
// TW must fit orbit + seat diagonal padding on all sides
// orbit ≈ 80+60+40 = 180, TW/2 = 250 → plenty of room
const MAX_EXTRA_SEATS=4;
// Per-table seat count helper (base + extra)
function seatCount(t){ return SEAT_COUNT + (t.extraSeats||0); }
const ODEFS={
  stage:     {ico:'🎭',lbl:'Stage',      w:190,h:80},
  door:      {ico:'🚪',lbl:'Door',       w:58, h:100},
  photo:     {ico:'📸',lbl:'Photo Booth',w:100,h:100},
  projector: {ico:'📽',lbl:'Projector',  w:100,h:70},
  washroom:  {ico:'🚻',lbl:'Washroom',   w:90, h:90},
  entrance:  {ico:'🏛',lbl:'Entrance',   w:130,h:60},
};

// ── INIT
function init(){
  initSharedNav({
    key: 'wedding-v1',
    getState: () => ({ v:3, at:new Date().toISOString(), gId, tId, oId, guests, tables, objects }),
    setState: (d) => {
      guests=d.guests||[]; tables=d.tables||[]; objects=d.objects||[];
      objects.forEach(o=>{if(!o.label)o.label=ODEFS[o.type]?.lbl||o.type;});
      guests.forEach(g=>{
        if(!g.cat||g.cat==='bride'||g.cat==='both'||g.cat==='vip')g.cat='bride-family';
        if(g.cat==='groom')g.cat='groom-family';
        if(g.cat==='family')g.cat='bride-family';
        if(g.cat==='friend')g.cat='bride-friend';
        // migrate legacy g.name → firstName
        if(g.name&&!g.firstName&&!g.lastName){ g.firstName=g.name; delete g.name; }
      });
      gId=d.gId||1; tId=d.tId||1; oId=d.oId||1;
    },
    onLoad: () => render(),
  });

  mkC('g-colors',selColor,'setGC');
  applyGrid();
  render();
}

function toggleGrid(){
  gridVisible=!gridVisible;
  const btn=document.getElementById('grid-toggle-btn');
  if(btn) btn.classList.toggle('active', gridVisible);
  applyGrid();
}
function applyGrid(){
  document.getElementById('canvas').classList.toggle('no-grid', !gridVisible);
  const btn=document.getElementById('grid-toggle-btn');
  if(btn) btn.classList.toggle('active', gridVisible);
}

function mutate(fn){
  fn();
  if(typeof markUnsaved==='function') markUnsaved();
}

// ── GUEST NAME HELPERS
function guestDisplayName(g){
  const fn=g.firstName||''; const ln=g.lastName||'';
  if(fn&&ln) return ln+' '+fn;
  return (ln||fn||g.name||'').trim(); // g.name = legacy fallback
}
function guestShortName(g){
  // For chips / tips: prefer nickName, else displayName
  return g.nickName||guestDisplayName(g);
}

// ── COLOR PICKERS
function mkC(cid,cur,fn){
  document.getElementById(cid).innerHTML=COLORS.map(c=>`<div class="color-dot ${c===cur?'selected':''}" style="background:${c}" onclick="${fn}('${c}')"></div>`).join('');
}
function setGC(c){selColor=c;mkC('g-colors',c,'setGC');}
function setBulkC(c){bulkColor=c;mkC('bulk-colors',c,'setBulkC');}
function setEGC(c){egColor=c;mkC('eg-colors',c,'setEGC');}

// ── GUESTS
function addGuest(){
  const firstName=(document.getElementById('g-firstName')?.value||'').trim();
  const lastName=(document.getElementById('g-lastName')?.value||'').trim();
  const nickName=(document.getElementById('g-nickName')?.value||'').trim();
  const subCat=(document.getElementById('g-subCat')?.value||'').trim();
  if(!firstName&&!lastName){toast('Enter at least a first or last name','error');return;}
  const disp=guestDisplayName({firstName,lastName});
  mutate(()=>guests.push({id:gId++,firstName,lastName,nickName,subCat,
    cat:document.getElementById('g-cat').value,color:selColor,tableId:null,seat:null}));
  ['g-firstName','g-lastName','g-nickName','g-subCat'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  render();toast(`"${disp}" added`,'success');
}
function delGuest(id){mutate(()=>guests=guests.filter(g=>g.id!==id));render();}
function openGuestModal(id){
  const g=guests.find(x=>x.id===id);if(!g)return;
  egId=id;egColor=g.color;
  document.getElementById('eg-firstName').value=g.firstName||g.name||'';
  document.getElementById('eg-lastName').value=g.lastName||'';
  document.getElementById('eg-nickName').value=g.nickName||'';
  document.getElementById('eg-subCat').value=g.subCat||'';
  document.getElementById('eg-cat').value=g.cat||'bride-family';
  mkC('eg-colors',g.color,'setEGC');
  openModal('modal-guest');
  setTimeout(()=>document.getElementById('eg-firstName').focus(),50);
}
function saveGuestEdit(){
  const firstName=(document.getElementById('eg-firstName')?.value||'').trim();
  const lastName=(document.getElementById('eg-lastName')?.value||'').trim();
  if(!firstName&&!lastName){toast('Enter at least a first or last name','error');return;}
  const nickName=(document.getElementById('eg-nickName')?.value||'').trim();
  const subCat=(document.getElementById('eg-subCat')?.value||'').trim();
  const g=guests.find(x=>x.id===egId);
  if(g){mutate(()=>{
    g.firstName=firstName; g.lastName=lastName;
    g.nickName=nickName; g.subCat=subCat;
    delete g.name; // remove legacy field
    g.cat=document.getElementById('eg-cat').value; g.color=egColor;
  });}
  closeModal('modal-guest');render();toast('Guest updated','info');
}
function openBulkModal(){
  bulkColor=selColor;mkC('bulk-colors',bulkColor,'setBulkC');
  document.getElementById('bulk-names').value='';
  openModal('modal-bulk');
  setTimeout(()=>document.getElementById('bulk-names').focus(),50);
}
function parseBulkLine(line){
  // Format: {lastName firstName} ({nickName}) [subCat]
  // All parts optional except at least one name token
  let rest=line.trim();
  let nickName='', subCat='';
  // extract [subCat]
  const scMatch=rest.match(/\[([^\]]+)\]/);
  if(scMatch){ subCat=scMatch[1].trim(); rest=rest.replace(scMatch[0],'').trim(); }
  // extract (nickName)
  const nnMatch=rest.match(/\(([^)]+)\)/);
  if(nnMatch){ nickName=nnMatch[1].trim(); rest=rest.replace(nnMatch[0],'').trim(); }
  // remaining tokens = name parts
  const parts=rest.trim().split(/\s+/).filter(Boolean);
  let firstName='',lastName='';
  if(parts.length>=2){ lastName=parts[0]; firstName=parts.slice(1).join(' '); }
  else if(parts.length===1){ firstName=parts[0]; }
  return {firstName,lastName,nickName,subCat};
}
function saveBulkAdd(){
  const lines=document.getElementById('bulk-names').value.split(/\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length){toast('No names entered','error');return;}
  const cat=document.getElementById('bulk-cat').value;
  mutate(()=>lines.forEach(line=>{
    const {firstName,lastName,nickName,subCat}=parseBulkLine(line);
    if(!firstName&&!lastName)return;
    guests.push({id:gId++,firstName,lastName,nickName,subCat,cat,color:bulkColor,tableId:null,seat:null});
  }));
  closeModal('modal-bulk');render();toast(`Added ${lines.length} guest${lines.length>1?'s':''}`,'success');
}

// ── TABLES
function nextTableSeq(){
  if(!tables.length) return 1;
  return Math.max(...tables.map(t=>t.seq||0))+1;
}
function addTable(){
  const inp=document.getElementById('t-name');
  const name=inp.value.trim()||`Table ${tId}`;
  const desc=document.getElementById('t-desc')?.value.trim()||'';
  const seqInp=document.getElementById('t-seq');
  const seq=seqInp&&seqInp.value.trim()!==''?parseInt(seqInp.value):nextTableSeq();
  const col=(tId-1)%4;
  const row=Math.floor((tId-1)/4);
  const x=60+col*(TW+50);
  const y=60+row*(TW+50);
  mutate(()=>tables.push({id:tId++,seq,name,desc,extraSeats:0,x,y}));
  inp.value='';
  if(seqInp) seqInp.value='';
  if(document.getElementById('t-desc'))document.getElementById('t-desc').value='';
  render();toast(`"${name}" added`,'success');
  const cw=document.querySelector('.canvas-wrap');
  setTimeout(()=>{cw.scrollTo({left:Math.max(0,x-40),top:Math.max(0,y-40),behavior:'smooth'});},50);
}
function delTable(id){
  mutate(()=>{
    guests.forEach(g=>{if(g.tableId===id){g.tableId=null;g.seat=null;}});
    tables=tables.filter(t=>t.id!==id);
  });
  if(selEl?.id===id)selEl=null;render();
}
function openTableModal(id){
  const t=tables.find(x=>x.id===id);if(!t)return;
  etId=id;
  document.getElementById('et-seq').value=t.seq||nextTableSeq();
  document.getElementById('et-name').value=t.name;
  document.getElementById('et-desc').value=t.desc||'';
  const extra=t.extraSeats||0;
  document.getElementById('et-extra').value=extra;
  document.getElementById('et-extra-val').textContent=extra;
  openModal('modal-table');setTimeout(()=>document.getElementById('et-seq').focus(),50);
}
function saveTableEdit(){
  const name=document.getElementById('et-name').value.trim();
  if(!name){toast('Name cannot be empty','error');return;}
  const desc=document.getElementById('et-desc').value.trim();
  const extra=parseInt(document.getElementById('et-extra').value)||0;
  const t=tables.find(x=>x.id===etId);
  if(t){
    const seq=parseInt(document.getElementById('et-seq').value)||nextTableSeq();
    mutate(()=>{
      t.seq=seq; t.name=name; t.desc=desc; t.extraSeats=extra;
      // unassign guests in seats that no longer exist after reducing extra seats
      const cap=SEAT_COUNT+extra;
      guests.forEach(g=>{if(g.tableId===t.id&&g.seat>=cap){g.tableId=null;g.seat=null;}});
    });
  }
  closeModal('modal-table');render();
}


// ── BULK ADD TABLES
function openBulkTableModal(){
  document.getElementById('bulk-table-names').value='';
  document.getElementById('bulk-table-desc').value='';
  openModal('modal-bulk-table');
  setTimeout(()=>document.getElementById('bulk-table-names').focus(),50);
}
function saveBulkTable(){
  const names=document.getElementById('bulk-table-names').value.split(/[\n]+/).map(s=>s.trim()).filter(Boolean);
  if(!names.length){toast('No table names entered','error');return;}
  const desc=document.getElementById('bulk-table-desc').value.trim();
  let seq=nextTableSeq();
  mutate(()=>{
    names.forEach(name=>{
      const col=(tId-1)%4,row=Math.floor((tId-1)/4);
      tables.push({id:tId++,seq:seq++,name,desc,extraSeats:0,x:60+col*(TW+50),y:60+row*(TW+50)});
    });
  });
  closeModal('modal-bulk-table');render();toast(`Added ${names.length} table${names.length>1?'s':''}`, 'success');
}


// ── OBJECTS
function addObj(type){
  const d=ODEFS[type];
  const x=60+Math.random()*700;
  const y=60+Math.random()*400;
  mutate(()=>objects.push({id:oId++,type,label:d.lbl,x,y,w:d.w,h:d.h}));
  render();toast(`${d.lbl} added`,'info');
  const cw=document.querySelector('.canvas-wrap');
  setTimeout(()=>{cw.scrollTo({left:Math.max(0,x-40),top:Math.max(0,y-40),behavior:'smooth'});},50);
}
function delObj(id){
  mutate(()=>objects=objects.filter(o=>o.id!==id));
  if(selEl?.type==='obj'&&selEl.id===id)selEl=null;render();
}
function openObjModal(id){
  const o=objects.find(x=>x.id===id);if(!o)return;
  eoId=id;
  document.getElementById('eo-name').value=o.label;
  document.getElementById('eo-icon').value=o.ico||ODEFS[o.type]?.ico||'';
  document.getElementById('eo-w').value=o.w;
  document.getElementById('eo-h').value=o.h;
  openModal('modal-obj');setTimeout(()=>document.getElementById('eo-name').select(),50);
}
function saveObjEdit(){
  const label=document.getElementById('eo-name').value.trim();
  if(!label){toast('Label cannot be empty','error');return;}
  const ico=document.getElementById('eo-icon').value.trim();
  const w=Math.max(40,parseInt(document.getElementById('eo-w').value)||100);
  const h=Math.max(40,parseInt(document.getElementById('eo-h').value)||80);
  const o=objects.find(x=>x.id===eoId);
  if(o){mutate(()=>{o.label=label;if(ico)o.ico=ico;o.w=w;o.h=h;});}
  closeModal('modal-obj');render();
}

// ── MODAL HELPERS
function openModal(id){document.getElementById(id).classList.remove('hidden');}
function closeModal(id){document.getElementById(id).classList.add('hidden');}
['modal-guest','modal-table','modal-obj','modal-bulk','modal-bulk-table','modal-assign','modal-swap','modal-multi-confirm','modal-guest-list'].forEach(id=>{
  document.getElementById(id).addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal(id);});
});

// ── SEAT ASSIGNMENT
let pendingSwap=null;
let pendingAssign=null;

function seatGuest(guestId,tableId,seatIdx){
  const g=guests.find(x=>x.id===guestId);if(!g)return;
  const occupant=guests.find(x=>x.tableId===tableId&&x.seat===seatIdx&&x.id!==guestId);
  if(occupant){
    if(g.tableId!==null){
      pendingSwap={guestIdA:guestId,tableIdB:tableId,seatIdxB:seatIdx,guestIdB:occupant.id};
      document.getElementById('swap-guest-a').textContent=guestDisplayName(g);
      document.getElementById('swap-guest-b').textContent=guestDisplayName(occupant)+' ('+tables.find(t=>t.id===occupant.tableId)?.name+', Seat '+(occupant.seat+1)+')';
      openModal('modal-swap');
    } else {
      toast('Cannot move unassigned guest to an occupied seat','error');
    }
    return;
  }
  mutate(()=>{g.tableId=tableId;g.seat=seatIdx;});render();
}

function confirmSwap(){
  if(!pendingSwap)return;
  const {guestIdA,tableIdB,seatIdxB,guestIdB}=pendingSwap;
  const gA=guests.find(x=>x.id===guestIdA);
  const gB=guests.find(x=>x.id===guestIdB);
  if(gA&&gB){
    const oldTableA=gA.tableId,oldSeatA=gA.seat;
    mutate(()=>{
      gA.tableId=tableIdB;gA.seat=seatIdxB;
      gB.tableId=oldTableA;gB.seat=oldSeatA;
    });
  }
  pendingSwap=null;
  closeModal('modal-swap');render();toast('Seats swapped','success');
}

function unseatGuest(guestId){
  const g=guests.find(x=>x.id===guestId);if(!g)return;
  mutate(()=>{g.tableId=null;g.seat=null;});render();
}

// ── ASSIGN TO TABLE (from unassigned context menu)
function openAssignModal(guestId){
  pendingAssign={guestId};
  const g=guests.find(x=>x.id===guestId);if(!g)return;
  document.getElementById('assign-guest-name').textContent=guestDisplayName(g);
  const tSel=document.getElementById('assign-table-sel');
  tSel.innerHTML=tables.map(t=>{
    const occ=guests.filter(x=>x.tableId===t.id).length;
    const sc=seatCount(t);
    return `<option value="${t.id}">${esc(t.name)} (${occ}/${sc})</option>`;
  }).join('');
  if(!tables.length){toast('Add a table first','error');return;}
  populateAssignSeats();
  tSel.onchange=populateAssignSeats;
  openModal('modal-assign');
}
function populateAssignSeats(){
  const tid=parseInt(document.getElementById('assign-table-sel').value);
  const sSel=document.getElementById('assign-seat-sel');
  sSel.innerHTML='';
  const tObj=tables.find(x=>x.id===tid);
  const sc=seatCount(tObj||{});
  for(let s=0;s<sc;s++){
    const taken=guests.find(x=>x.tableId===tid&&x.seat===s);
    if(!taken) sSel.innerHTML+=`<option value="${s}">Seat ${s+1}${s>=SEAT_COUNT?' ★':''}</option>`;
  }
  if(!sSel.options.length) sSel.innerHTML='<option value="" disabled>No empty seats</option>';
}
function confirmAssign(){
  if(!pendingAssign)return;
  const tid=parseInt(document.getElementById('assign-table-sel').value);
  if(pendingAssign.multi){
    closeModal('modal-assign');
    multiAssignToTableFrom(tid, 0);
    pendingAssign=null;
    return;
  }
  const si=parseInt(document.getElementById('assign-seat-sel').value);
  if(isNaN(si)){toast('No empty seats at this table','error');return;}
  const g=guests.find(x=>x.id===pendingAssign.guestId);
  if(g){mutate(()=>{g.tableId=tid;g.seat=si;});}
  pendingAssign=null;
  closeModal('modal-assign');render();toast('Guest assigned','success');
}

// Central executor for multi-confirm modal actions
function execMultiConfirm(){
  closeModal('modal-multi-confirm');
  if(window._mcAction==='multiAssign' && pendingMultiAssign){
    execMultiAssign(pendingMultiAssign);
    pendingMultiAssign=null;
  } else if(window._mcAction==='multiDelete'){
    const toDelete=[...selectedGuests].map(id=>guests.find(g=>g.id===id)).filter(Boolean);
    mutate(()=>{ guests=guests.filter(g=>!selectedGuests.has(g.id)); });
    selectedGuests.clear();
    render();
    toast(`${toDelete.length} guest${toDelete.length!==1?'s':''} deleted`,'success');
  } else if(window._mcAction==='tableMultiUnassign'){
    mutate(()=>{ selectedTableSeats.forEach(id=>{ const g=guests.find(x=>x.id===id); if(g){g.tableId=null;g.seat=null;} }); });
    clearTableSelection(); render(); toast('Guests unassigned','success');
  } else if(window._mcAction==='tableMultiDelete'){
    mutate(()=>{ guests=guests.filter(g=>!selectedTableSeats.has(g.id)); });
    clearTableSelection(); render(); toast('Guests deleted','success');
  } else if(window._mcAction==='delGuest'){
    delGuest(window._mcTarget);
  } else if(window._mcAction==='delTable'){
    delTable(window._mcTarget);
  } else if(window._mcAction==='delObj'){
    delObj(window._mcTarget);
  }
  document.getElementById('mc-confirm-btn').style.background='';
  window._mcAction=null; window._mcTarget=null;
}

// ── DRAG & DROP
function onDragStart(e,id){
  // In multi-select mode, dragging any chip drags all selected ones.
  // If the dragged chip isn't selected, auto-select it.
  if(multiSelectMode){
    if(!selectedGuests.has(id)){ selectedGuests.clear(); selectedGuests.add(id); }
    dragGId=id;
    e.dataTransfer.effectAllowed='move';
    setTimeout(()=>{
      document.querySelectorAll('.guest-chip').forEach(el=>{
        el.classList.toggle('dragging', selectedGuests.has(Number(el.dataset.gid)));
      });
    },0);
  } else {
    dragGId=id;e.dataTransfer.effectAllowed='move';
    setTimeout(()=>document.querySelectorAll(`.guest-chip[data-gid="${id}"]`).forEach(el=>el.classList.add('dragging')),0);
  }
}
function onDragEnd(){
  dragGId=null;
  document.querySelectorAll('.guest-chip').forEach(el=>el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
}
function onSeatOver(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function onSeatLeave(e){e.currentTarget.classList.remove('drag-over');}
function onSeatDrop(e,tid,si){
  e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('drag-over');
  if(dragGId===null)return;
  if(multiSelectMode && selectedGuests.size>1){
    multiAssignToTableFrom(tid, si);
  } else {
    seatGuest(dragGId,tid,si);
  }
}
function onDragOverU(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function onDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function onDropU(e){e.preventDefault();e.currentTarget.classList.remove('drag-over');if(dragGId!==null)unseatGuest(dragGId);}

// ── MOVE CANVAS ITEMS (with snap guides)
let resizing=null;
const SNAP_THRESH=12;

function getSnapTargets(excludeId,excludeType){
  const targets=[];
  tables.forEach(t=>{
    if(excludeType==='table'&&t.id===excludeId)return;
    targets.push({cx:t.x+TW/2, cy:t.y+TW/2, l:t.x, r:t.x+TW, t:t.y, b:t.y+TW});
  });
  objects.forEach(o=>{
    if(excludeType==='obj'&&o.id===excludeId)return;
    targets.push({cx:o.x+o.w/2, cy:o.y+o.h/2, l:o.x, r:o.x+o.w, t:o.y, b:o.y+o.h});
  });
  return targets;
}

function showSnapGuides(hY,vX){
  const gh=document.getElementById('snap-h'),gv=document.getElementById('snap-v');
  const cw=document.querySelector('.canvas-wrap');
  const cwRect=cw.getBoundingClientRect();
  if(hY!=null){
    gh.style.display='block';
    gh.style.top=(hY-cw.scrollTop)+'px';
  } else gh.style.display='none';
  if(vX!=null){
    gv.style.display='block';
    gv.style.left=(vX-cw.scrollLeft)+'px';
  } else gv.style.display='none';
}
function hideSnapGuides(){
  document.getElementById('snap-h').style.display='none';
  document.getElementById('snap-v').style.display='none';
}

function snapPosition(x,y,w,h,targets){
  let snapX=null,snapY=null,snapVX=null,snapHY=null;
  const cx=x+w/2, cy=y+h/2;
  for(const t of targets){
    // horizontal centre align
    if(Math.abs(cy-t.cy)<SNAP_THRESH){snapY=t.cy-h/2;snapHY=t.cy;}
    // top align
    if(Math.abs(y-t.t)<SNAP_THRESH){snapY=t.t;snapHY=t.t;}
    // bottom align
    if(Math.abs(y+h-t.b)<SNAP_THRESH){snapY=t.b-h;snapHY=t.b;}
    // vertical centre align
    if(Math.abs(cx-t.cx)<SNAP_THRESH){snapX=t.cx-w/2;snapVX=t.cx;}
    // left align
    if(Math.abs(x-t.l)<SNAP_THRESH){snapX=t.l;snapVX=t.l;}
    // right align
    if(Math.abs(x+w-t.r)<SNAP_THRESH){snapX=t.r-w;snapVX=t.r;}
  }
  return {x:snapX??x, y:snapY??y, snapVX, snapHY};
}

function startMove(e,type,id){
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();
  const item=type==='table'?tables.find(t=>t.id===id):objects.find(o=>o.id===id);if(!item)return;
  selEl={type,id};moving={type,id,sx:e.clientX,sy:e.clientY,ox:item.x,oy:item.y};
  renderSel();
  document.addEventListener('mousemove',onMM);document.addEventListener('mouseup',onMU);
}
function onMM(e){
  if(!moving)return;
  const dx=e.clientX-moving.sx,dy=e.clientY-moving.sy;
  const item=moving.type==='table'?tables.find(t=>t.id===moving.id):objects.find(o=>o.id===moving.id);if(!item)return;
  const w=moving.type==='table'?TW:item.w;
  const h=moving.type==='table'?TW:item.h;
  const rawX=moving.ox+dx, rawY=moving.oy+dy;
  const targets=getSnapTargets(moving.id,moving.type);
  const {x,y,snapVX,snapHY}=snapPosition(rawX,rawY,w,h,targets);
  item.x=x; item.y=y;
  const el=moving.type==='table'?document.querySelector(`.table-wrap[data-id="${moving.id}"]`):document.querySelector(`.room-obj[data-id="${moving.id}"]`);
  if(el){el.style.left=item.x+'px';el.style.top=item.y+'px';}
  showSnapGuides(snapHY,snapVX);
  if(typeof markUnsaved==='function') markUnsaved();
}
function onMU(){
  moving=null;hideSnapGuides();
  document.removeEventListener('mousemove',onMM);document.removeEventListener('mouseup',onMU);
}

// ── RESIZE OBJECTS
function startResize(e,id){
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();
  const o=objects.find(x=>x.id===id);if(!o)return;
  resizing={id,sx:e.clientX,sy:e.clientY,ow:o.w,oh:o.h};
  document.addEventListener('mousemove',onRM);document.addEventListener('mouseup',onRU);
}
function onRM(e){
  if(!resizing)return;
  const o=objects.find(x=>x.id===resizing.id);if(!o)return;
  o.w=Math.max(40,resizing.ow+(e.clientX-resizing.sx));
  o.h=Math.max(40,resizing.oh+(e.clientY-resizing.sy));
  const el=document.querySelector(`.room-obj[data-id="${resizing.id}"]`);
  if(el){el.style.width=o.w+'px';el.style.height=o.h+'px';}
  if(typeof markUnsaved==='function') markUnsaved();
}
function onRU(){
  resizing=null;
  document.removeEventListener('mousemove',onRM);document.removeEventListener('mouseup',onRU);
  render(); // re-render to sync state
}
function onCanvasClick(e){
  if(!e.target.closest('.table-wrap')&&!e.target.closest('.room-obj')){selEl=null;renderSel();}
}
function renderSel(){
  document.querySelectorAll('.table-wrap,.room-obj').forEach(el=>el.classList.remove('selected'));
  if(!selEl)return;
  const el=selEl.type==='table'?document.querySelector(`.table-wrap[data-id="${selEl.id}"]`):document.querySelector(`.room-obj[data-id="${selEl.id}"]`);
  if(el)el.classList.add('selected');
}

// ── CONTEXT MENUS
function showSeatCtx(e,guestId){
  e.preventDefault();e.stopPropagation();
  const menu=document.getElementById('ctx-menu');
  menu.innerHTML=`
    <div class="ctx-item" onclick="openGuestModal(${guestId});hideCtx()">✏ Edit Guest</div>
    <div class="ctx-item" onclick="unseatGuest(${guestId});hideCtx()">↩ Move to Unassigned</div>
    <div class="ctx-item danger" onclick="hideCtx();confirmDelGuest(${guestId})">🗑 Remove Guest</div>`;
  showCtxAt(e.clientX,e.clientY);
}
function showGuestCtx(e,guestId){
  e.preventDefault();e.stopPropagation();
  const menu=document.getElementById('ctx-menu');
  menu.innerHTML=`
    <div class="ctx-item" onclick="openGuestModal(${guestId});hideCtx()">✏ Edit Guest</div>
    <div class="ctx-item" onclick="openAssignModal(${guestId});hideCtx()">📋 Assign to Table…</div>
    <div class="ctx-item danger" onclick="hideCtx();confirmDelGuest(${guestId})">🗑 Remove Guest</div>`;
  showCtxAt(e.clientX,e.clientY);
}
function showCtxAt(x,y){
  const menu=document.getElementById('ctx-menu');
  menu.style.left=x+'px';menu.style.top=y+'px';
  menu.classList.remove('hidden');
}
function hideCtx(){document.getElementById('ctx-menu').classList.add('hidden');}
document.addEventListener('click',hideCtx);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){hideCtx();['modal-guest','modal-table','modal-obj','modal-bulk','modal-assign','modal-swap'].forEach(closeModal);}
});

// ── FILTER
function setFilter(cat){
  activeFilter=cat;renderFilterBar();renderUnassigned();
}
function renderFilterBar(){
  const bar=document.getElementById('filter-bar');
  bar.innerHTML=['all',...Object.keys(CAT)].map(c=>{
    const label=c==='all'?'✦ All':CAT[c].short;
    return `<div class="filter-chip ${activeFilter===c?'active':''}" onclick="setFilter('${c}')">${label}</div>`;
  }).join('');
}

// ── RENDER
function render(){renderFilterBar();renderUnassigned();renderCanvas();renderStats();}

function renderUnassigned(){
  const unassigned=guests.filter(g=>g.tableId===null);
  const filtered=activeFilter==='all'?unassigned:unassigned.filter(g=>g.cat===activeFilter);
  document.getElementById('u-count').textContent=unassigned.length;
  const zone=document.getElementById('uzone'),empty=document.getElementById('u-empty');
  zone.querySelectorAll('.guest-chip').forEach(el=>el.remove());
  if(filtered.length===0){
    empty.style.display='';
    empty.textContent=unassigned.length===0?'🎉 All guests are seated!':'No guests in this category.';
  } else {
    empty.style.display='none';
    filtered.forEach(g=>zone.appendChild(mkChip(g)));
  }
}

function mkChip(g){
  const div=document.createElement('div');
  div.className='guest-chip';div.dataset.gid=g.id;
  if(selectedGuests.has(g.id)) div.classList.add('ms-selected');
  div.draggable=true;
  div.ondragstart=e=>onDragStart(e,g.id);
  div.ondragend=onDragEnd;
  div.oncontextmenu=e=>{if(!multiSelectMode)showGuestCtx(e,g.id);};
  div.onclick=e=>{
    if(!multiSelectMode){return;}
    e.stopPropagation();
    if(selectedGuests.has(g.id)){selectedGuests.delete(g.id);div.classList.remove('ms-selected');}
    else{selectedGuests.add(g.id);div.classList.add('ms-selected');}
    updateMultiBar();
  };
  const cat=CAT[g.cat]||CAT['bride-family'];
  const dispName=guestDisplayName(g);
  const nick=g.nickName?`<span class="g-nick">${esc(g.nickName)}</span>`:'';
  const sc=g.subCat?`<span class="g-subcat">${esc(g.subCat)}</span>`:'';
  div.innerHTML=`
    <div class="g-colorbar" style="background:${g.color}"></div>
    <div class="g-info">
      <div class="g-name-row">
        <span class="g-name">${esc(dispName)}</span>
        <span class="cat-badge ${cat.cls}">${cat.short}</span>
      </div>
      ${nick||sc?`<div class="g-meta">${nick}${sc}</div>`:''}
    </div>
    <div class="g-acts ms-hide">
      <button class="g-abtn edit" onclick="event.stopPropagation();openGuestModal(${g.id})">✏</button>
      <button class="g-abtn del"  onclick="event.stopPropagation();confirmDelGuest(${g.id})">✕</button>
    </div>`;
  return div;
}

function renderCanvas(){
  const cv=document.getElementById('canvas');
  cv.querySelectorAll('.table-wrap,.room-obj').forEach(el=>el.remove());
  objects.forEach(o=>renderObj(o,cv));
  tables.forEach(t=>renderTable(t,cv));
  renderSel();
}

function renderObj(o,cv){
  const def=ODEFS[o.type];
  const ico=o.ico||def.ico;
  const div=document.createElement('div');
  div.className=`room-obj ${o.type}`;div.dataset.id=o.id;
  div.style.cssText=`left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;`;
  div.innerHTML=`
    <span class="obj-ico">${ico}</span>
    <span class="obj-lbl-text">${esc(o.label)}</span>
    <div class="obj-acts">
      <button class="obj-mbtn edit" onclick="event.stopPropagation();openObjModal(${o.id})">✏</button>
      <button class="obj-mbtn del" onclick="event.stopPropagation();confirmDelObj(${o.id})">✕</button>
    </div>
    <div class="resize-handle" data-oid="${o.id}"></div>`;
  div.addEventListener('mousedown',e=>{
    if(e.target.closest('button'))return;
    if(e.target.classList.contains('resize-handle')){startResize(e,o.id);return;}
    startMove(e,'obj',o.id);
  });
  cv.appendChild(div);
}

function renderTable(t,cv){
  const sc=seatCount(t); // base + extra seats
  const here=guests.filter(g=>g.tableId===t.id);
  const occ=here.length,isFull=occ>=sc;
  const discCls=isFull?'full':(occ>0?'ok':'empty');
  const hw=TW/2,hh=TW/2;

  const wrap=document.createElement('div');
  wrap.className='table-wrap';wrap.dataset.id=t.id;
  wrap.style.cssText=`left:${t.x}px;top:${t.y}px;width:${TW}px;height:${TW}px;`;

  const acts=document.createElement('div');
  acts.className='table-actions';
  acts.innerHTML=`
    <button class="ta-btn" onclick="event.stopPropagation();openTableModal(${t.id})">✏ Edit</button>
    <button class="ta-btn${tableSeatSelectMode===t.id?' active':''}" onclick="event.stopPropagation();toggleTableSeatSelect(${t.id})">${tableSeatSelectMode===t.id?'✕ Done':'☑ Select'}</button>
    <button class="ta-btn del" onclick="event.stopPropagation();confirmDelTable(${t.id})">🗑 Delete</button>
    <button class="ta-btn" onclick="event.stopPropagation();selEl=null;renderSel()">✕</button>`;
  wrap.appendChild(acts);

  const disc=document.createElement('div');
  disc.className=`table-disc ${discCls}`;
  disc.style.cssText=`left:${hw-DISC_R}px;top:${hh-DISC_R}px;width:${DISC_R*2}px;height:${DISC_R*2}px;`;
  // Display name as-is; use desc field for subtitle
  const desc=t.desc||'';
  const extraSeats=t.extraSeats||0;
  disc.innerHTML=`<div class="table-num" style="font-size:${t.name.length>6?'18px':'30px'}">${esc(t.name)}</div>${desc?`<div class="table-sublabel">${esc(desc)}</div>`:''}<div class="table-count">${occ}/${sc}</div>${extraSeats>0?`<div class="table-extra-label">+${extraSeats} extra seat${extraSeats>1?'s':''}</div>`:''}`;
  wrap.appendChild(disc);

  for(let s=0;s<sc;s++){
    const angle=(s/sc)*Math.PI*2-Math.PI/2;
    const g=guests.find(x=>x.tableId===t.id&&x.seat===s);
    const isSeatSelected = g && tableSeatSelectMode===t.id && selectedTableSeats.has(g.id);
    const cat=g?(CAT[g.cat]||CAT['bride-family']):null;

    const seat=document.createElement('div');
    seat.className='seat '+(g?'occupied':'empty-seat')+(isSeatSelected?' seat-selected':'');
    seat.style.width=SEAT_W+'px';
    if(g) seat.style.borderColor=isSeatSelected?'var(--accent)':g.color;

    // ── BADGE (top, always rendered)
    const badge=document.createElement('div');
    badge.className='seat-cat-badge'+(g&&!isSeatSelected?` ${cat.cls}`:'');
    if(g){
      badge.textContent=cat.short;
      if(isSeatSelected){ badge.style.background='var(--accent)'; badge.style.color='var(--bg)'; }
    } else {
      badge.innerHTML='&nbsp;'; // reserve height
    }
    seat.appendChild(badge);

    // ── BODY
    const body=document.createElement('div');
    body.className='seat-body';

    // name row: color dot + 2-line name
    const nameEl=document.createElement('div');
    nameEl.className='seat-guest-name';
    if(g){
      const dn=guestDisplayName(g);
      // color dot prepended
      const dot=`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${isSeatSelected?'var(--accent)':g.color};margin-right:4px;flex-shrink:0;vertical-align:middle;"></span>`;
      nameEl.innerHTML=dot+esc(dn);
      if(isSeatSelected) nameEl.style.color='var(--accent)';
    } else {
      nameEl.textContent=`Seat ${s+1}${s>=SEAT_COUNT?' ★':''}`;
      nameEl.style.color='var(--muted)';
      nameEl.style.fontWeight='400';
      nameEl.style.fontSize='9px';
    }
    body.appendChild(nameEl);

    // nick — always reserve space
    const nickEl=document.createElement('div');
    nickEl.className='seat-guest-nick';
    nickEl.textContent=(g&&g.nickName)||'';
    body.appendChild(nickEl);

    // subcat — always reserve space
    const subEl=document.createElement('div');
    subEl.className='seat-sub-cat';
    subEl.textContent=(g&&g.subCat)||'';
    body.appendChild(subEl);

    seat.appendChild(body);

    // tooltip — richer hover card
    if(g){
      const dn=guestDisplayName(g);
      const tip=document.createElement('div');
      tip.className='seat-tip';
      tip.innerHTML=`<b>${esc(dn)}</b>${g.nickName?` <span style="opacity:.75;font-style:italic;">(${esc(g.nickName)})</span>`:''}<br>`+
        `<span style="opacity:.8">${esc(cat.short)}</span>${g.subCat?` · <span style="opacity:.7">${esc(g.subCat)}</span>`:''}`+
        `<span style="opacity:.5;margin-left:6px;">S${s+1}</span>`;
      seat.appendChild(tip);
    }

    // position: dynamic orbit based on actual rendered height
    // We append first, measure, then position
    wrap.appendChild(seat);
    const sh=seat.offsetHeight||72; // fallback if not yet painted
    const orbit=DISC_R+SEAT_GAP+sh/2;
    const cx=hw+Math.cos(angle)*orbit;
    const cy=hh+Math.sin(angle)*orbit;
    seat.style.left=(cx-SEAT_W/2)+'px';
    seat.style.top=(cy-sh/2)+'px';

    if(g){
      if(tableSeatSelectMode===t.id){
        seat.onclick=e=>{e.stopPropagation();toggleSeatSelection(g.id);};
      } else {
        seat.draggable=true;
        seat.ondragstart=e=>{e.stopPropagation();onDragStart(e,g.id);};
        seat.ondragend=onDragEnd;
        seat.oncontextmenu=e=>showSeatCtx(e,g.id);
      }
    }
    if(tableSeatSelectMode!==t.id){
      seat.ondragover=e=>{e.stopPropagation();onSeatOver(e);};
      seat.ondragleave=e=>{e.stopPropagation();onSeatLeave(e);};
      seat.ondrop=e=>{e.stopPropagation();onSeatDrop(e,t.id,s);};
    }
  }

  wrap.addEventListener('mousedown',e=>{
    if(e.target.closest('button')||e.target.closest('.seat')||e.target.closest('.table-actions'))return;
    startMove(e,'table',t.id);
  });
  wrap.addEventListener('click',e=>{
    if(e.target.closest('button')||e.target.closest('.seat'))return;
    selEl={type:'table',id:t.id};renderSel();
  });
  cv.appendChild(wrap);
}


// ══════════════════════════════════════════════════════
//  MULTI-SELECT
// ══════════════════════════════════════════════════════

function toggleMultiSelect(){
  multiSelectMode=!multiSelectMode;
  if(!multiSelectMode){ selectedGuests.clear(); }
  const btn=document.getElementById('ms-toggle-btn');
  if(btn){
    btn.classList.toggle('active', multiSelectMode);
    btn.textContent=multiSelectMode?'✕ Cancel':'☑ Select';
  }
  // toggle ms-mode on the unassigned zone's parent to hide edit/del buttons via CSS
  const zone=document.getElementById('uzone');
  if(zone) zone.classList.toggle('ms-mode', multiSelectMode);
  updateMultiBar();
  renderUnassigned();
}

function updateMultiBar(){
  const bar=document.getElementById('multi-action-bar');
  if(!bar) return;
  if(multiSelectMode){
    bar.style.display='flex';
    const cnt=document.getElementById('ms-count');
    if(cnt) cnt.textContent=selectedGuests.size
      ? selectedGuests.size+' selected'
      : '0 selected — tap guests to select';
  } else {
    bar.style.display='none';
  }
}

// Assign all selected guests to consecutive empty seats at a table
// Shows confirmation modal when there are more guests than empty seats
let pendingMultiAssign=null;

function multiAssignToTableFrom(tableId, startSeat){
  const table=tables.find(t=>t.id===tableId);if(!table)return;
  const toAssign=[...selectedGuests]
    .map(id=>guests.find(g=>g.id===id&&g.tableId===null))
    .filter(Boolean);
  if(!toAssign.length){toast('No unassigned guests selected','error');return;}

  const sc=seatCount(table);
  const emptySeats=[];
  for(let s=0;s<sc;s++){
    const idx=(startSeat+s)%sc;
    if(!guests.find(g=>g.tableId===tableId&&g.seat===idx)) emptySeats.push(idx);
  }

  const willSeat=toAssign.slice(0,emptySeats.length);
  const willSkip=toAssign.slice(emptySeats.length);

  if(willSkip.length>0){
    // Show confirmation with breakdown
    pendingMultiAssign={tableId, startSeat, willSeat, willSkip, emptySeats};
    document.getElementById('mc-title').textContent=`Assign to ${table.name}?`;
    let html=`<div style="margin-bottom:8px;color:var(--text);">
      <b>${willSeat.length}</b> guest${willSeat.length!==1?'s':''} will be seated,
      <b style="color:var(--danger)">${willSkip.length}</b> will stay unassigned (table full).
    </div>`;
    if(willSeat.length){
      html+=`<div style="margin-bottom:6px;font-weight:600;color:var(--green);">✓ Will be seated:</div>`;
      html+=willSeat.map(g=>`<div style="padding:2px 0 2px 10px;">• ${esc(guestDisplayName(g))}</div>`).join('');
    }
    if(willSkip.length){
      html+=`<div style="margin:6px 0;font-weight:600;color:var(--danger);">↩ Will remain unassigned:</div>`;
      html+=willSkip.map(g=>`<div style="padding:2px 0 2px 10px;">• ${esc(guestDisplayName(g))}</div>`).join('');
    }
    document.getElementById('mc-body').innerHTML=html;
    document.getElementById('mc-confirm-btn').textContent=`Seat ${willSeat.length}`;
    window._mcAction='multiAssign';
    openModal('modal-multi-confirm');
  } else {
    execMultiAssign({tableId, emptySeats, willSeat, willSkip});
  }
}

function execMultiAssign({tableId, emptySeats, willSeat}){
  mutate(()=>{
    willSeat.forEach((g,i)=>{ g.tableId=tableId; g.seat=emptySeats[i]; });
  });
  selectedGuests.clear();
  render();
  toast(`${willSeat.length} guest${willSeat.length!==1?'s':''} seated`,'success');
}

// Multi-assign via modal (Select All → Assign to Table button)
function openMultiAssignModal(){
  if(!selectedGuests.size){toast('Select at least one guest','error');return;}
  const toAssign=[...selectedGuests]
    .map(id=>guests.find(g=>g.id===id&&g.tableId===null))
    .filter(Boolean);
  if(!toAssign.length){toast('Selected guests are already seated','error');return;}
  document.getElementById('assign-guest-name').textContent=
    toAssign.length===1 ? guestDisplayName(toAssign[0]) : `${toAssign.length} guests`;
  const tSel=document.getElementById('assign-table-sel');
  tSel.innerHTML=tables.map(t=>{
    const occ=guests.filter(x=>x.tableId===t.id).length;
    const avail=seatCount(t)-occ;
    return `<option value="${t.id}">${esc(t.name)} (${avail} empty)</option>`;
  }).join('');
  if(!tables.length){toast('Add a table first','error');return;}
  populateAssignSeats();
  tSel.onchange=populateAssignSeats;
  pendingAssign={multi:true, ids:[...selectedGuests]};
  openModal('modal-assign');
}

// Bulk delete selected unassigned guests
function confirmMultiDelete(){
  if(!selectedGuests.size){toast('No guests selected','error');return;}
  const toDelete=[...selectedGuests]
    .map(id=>guests.find(g=>g.id===id))
    .filter(Boolean);
  if(!toDelete.length)return;
  pendingMultiAssign=null;
  document.getElementById('mc-title').textContent=`Delete ${toDelete.length} guest${toDelete.length!==1?'s':''}?`;
  let html=`<div style="margin-bottom:8px;color:var(--danger);font-weight:600;">This cannot be undone.</div>`;
  html+=toDelete.map(g=>`<div style="padding:2px 0 2px 10px;">• ${esc(guestDisplayName(g))}${g.tableId!==null?' <span style=\"color:var(--muted)\">(seated)</span>':''}</div>`).join('');
  document.getElementById('mc-body').innerHTML=html;
  document.getElementById('mc-confirm-btn').textContent=`Delete ${toDelete.length}`;
  document.getElementById('mc-confirm-btn').style.background='var(--danger)';
  window._mcAction='multiDelete';
  openModal('modal-multi-confirm');
}


// ══════════════════════════════════════════════════════
//  TABLE SEAT MULTI-SELECT
// ══════════════════════════════════════════════════════

function toggleTableSeatSelect(tableId){
  if(tableSeatSelectMode===tableId){
    clearTableSelection();
  } else {
    tableSeatSelectMode=tableId;
    selectedTableSeats.clear();
  }
  render();
  updateTableSeatBar();
}

function toggleSeatSelection(guestId){
  if(selectedTableSeats.has(guestId)) selectedTableSeats.delete(guestId);
  else selectedTableSeats.add(guestId);
  // update visual without full re-render
  const seatEl=document.querySelector(`.seat[data-gid="${guestId}"]`);
  if(!seatEl){render();} // fallback
  updateTableSeatBar();
  render(); // re-render to reflect selection colours
}

function updateTableSeatBar(){
  const bar=document.getElementById('table-ms-bar');
  if(!bar)return;
  if(tableSeatSelectMode && selectedTableSeats.size>0){
    bar.style.display='flex';
    const cnt=document.getElementById('table-ms-count');
    if(cnt) cnt.textContent=selectedTableSeats.size+' seat'+(selectedTableSeats.size!==1?'s':'')+' selected';
  } else {
    bar.style.display='none';
  }
}

function clearTableSelection(){
  tableSeatSelectMode=false;
  selectedTableSeats.clear();
  updateTableSeatBar();
  render();
}

function multiUnassignSeats(){
  if(!selectedTableSeats.size)return;
  const names=[...selectedTableSeats].map(id=>{ const g=guests.find(x=>x.id===id); return g?guestDisplayName(g):null; }).filter(Boolean);
  document.getElementById('mc-title').textContent=`Unassign ${names.length} guest${names.length!==1?'s':''}?`;
  let html=`<div style="margin-bottom:8px;color:var(--text2);">They will be moved back to the unassigned pool.</div>`;
  html+=names.map(n=>`<div style="padding:2px 0 2px 10px;">• ${esc(n)}</div>`).join('');
  document.getElementById('mc-body').innerHTML=html;
  document.getElementById('mc-confirm-btn').textContent='Unassign';
  document.getElementById('mc-confirm-btn').style.background='';
  window._mcAction='tableMultiUnassign';
  openModal('modal-multi-confirm');
}

function multiDeleteSeats(){
  if(!selectedTableSeats.size)return;
  const names=[...selectedTableSeats].map(id=>{ const g=guests.find(x=>x.id===id); return g?guestDisplayName(g):null; }).filter(Boolean);
  document.getElementById('mc-title').textContent=`Delete ${names.length} guest${names.length!==1?'s':''}?`;
  let html=`<div style="margin-bottom:8px;color:var(--danger);font-weight:600;">This cannot be undone.</div>`;
  html+=names.map(n=>`<div style="padding:2px 0 2px 10px;">• ${esc(n)}</div>`).join('');
  document.getElementById('mc-body').innerHTML=html;
  document.getElementById('mc-confirm-btn').textContent=`Delete ${names.length}`;
  document.getElementById('mc-confirm-btn').style.background='var(--danger)';
  window._mcAction='tableMultiDelete';
  openModal('modal-multi-confirm');
}


// ── SINGLE-ITEM DELETE CONFIRMATIONS
function confirmDelGuest(id){
  const g=guests.find(x=>x.id===id);if(!g)return;
  document.getElementById('mc-title').textContent='Remove Guest?';
  document.getElementById('mc-body').innerHTML=
    `<div style="padding:4px 0;">Remove <b>${esc(guestDisplayName(g))}</b> from the guest list?`+
    (g.tableId!==null?` They are currently seated.`:'')+`</div>`;
  document.getElementById('mc-confirm-btn').textContent='Remove';
  document.getElementById('mc-confirm-btn').style.background='var(--danger)';
  window._mcAction='delGuest';window._mcTarget=id;
  openModal('modal-multi-confirm');
}
function confirmDelTable(id){
  const t=tables.find(x=>x.id===id);if(!t)return;
  const seated=guests.filter(g=>g.tableId===id).length;
  document.getElementById('mc-title').textContent='Delete Table?';
  document.getElementById('mc-body').innerHTML=
    `<div style="padding:4px 0;">Delete <b>${esc(t.name)}</b>?`+
    (seated?` <span style="color:var(--danger)">${seated} seated guest${seated!==1?'s':''} will be unassigned.</span>`:'')+`</div>`;
  document.getElementById('mc-confirm-btn').textContent='Delete Table';
  document.getElementById('mc-confirm-btn').style.background='var(--danger)';
  window._mcAction='delTable';window._mcTarget=id;
  openModal('modal-multi-confirm');
}
function confirmDelObj(id){
  const o=objects.find(x=>x.id===id);if(!o)return;
  document.getElementById('mc-title').textContent='Remove Object?';
  document.getElementById('mc-body').innerHTML=
    `<div style="padding:4px 0;">Remove <b>${esc(o.label)}</b> from the layout?</div>`;
  document.getElementById('mc-confirm-btn').textContent='Remove';
  document.getElementById('mc-confirm-btn').style.background='var(--danger)';
  window._mcAction='delObj';window._mcTarget=id;
  openModal('modal-multi-confirm');
}


// ══════════════════════════════════════════════════════
//  GUEST ATTENDANCE LIST
// ══════════════════════════════════════════════════════

const CAT_FULL = {
  'bride-family': '🌸 Bride Family',
  'bride-rel':    '🌺 Bride Relative',
  'bride-friend': '🪷 Bride Friend',
  'groom-family': '💠 Groom Family',
  'groom-rel':    '🔷 Groom Relative',
  'groom-friend': '🫐 Groom Friend',
};

// Column definitions — id, label, always-shown toggle
const GL_COLS = [
  {id:'seq',      label:'Seq',          always:true},
  {id:'table',    label:'Table',        always:true},
  {id:'seat',     label:'Seat',         always:true},
  {id:'cat',      label:'Relationship', always:false},
  {id:'subCat',   label:'Sub-Cat',      always:false},
  {id:'lastName', label:'Last Name',    always:false},
  {id:'firstName',label:'First Name',   always:false},
  {id:'nickName', label:'Nick Name',    always:false},
  {id:'attended', label:'Attended',     always:true},
];
// Default visible cols
let glVisibleCols = new Set(['seq','table','seat','cat','subCat','lastName','firstName','nickName','attended']);

function openGuestListModal(){
  const tSel = document.getElementById('gl-filter-table');
  tSel.innerHTML = '<option value="all">All Tables</option>' +
    tables.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  const cSel = document.getElementById('gl-filter-cat');
  cSel.innerHTML = '<option value="all">All Categories</option>' +
    Object.entries(CAT_FULL).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
  renderGLColToggles();
  renderGuestList();
  openModal('modal-guest-list');
}

function renderGLColToggles(){ /* col toggles removed */ }
function glToggleCol(id, visible){
  if(visible) glVisibleCols.add(id); else glVisibleCols.delete(id);
  renderGuestList();
}

// Header click: toggle dir in-place, never reorder
function glSetSort(col){
  const existing = glSortStack.findIndex(s=>s.col===col);
  if(existing>=0){
    glSortStack[existing].dir *= -1;
  } else {
    glSortStack.push({col,dir:1});
    if(glSortStack.length>6) glSortStack.pop();
  }
  renderGuestList();
}

const GL_DEFAULT_SORT = ()=>[
  {col:'cat',dir:1},{col:'subCat',dir:1},{col:'lastName',dir:1},{col:'firstName',dir:1}
];
const GL_CLEAR_SORT = ()=>[ {col:'table',dir:1} ];

function glClearSort(){
  glSortStack = GL_CLEAR_SORT(); // clear → sort by table ASC
  renderGuestList();
}
function glResetSort(){
  glSortStack = GL_DEFAULT_SORT(); // reset → default 4-level sort
  renderGuestList();
}

function glRemoveSort(col){
  glSortStack = glSortStack.filter(s=>s.col!==col);
  if(!glSortStack.length) glSortStack = GL_CLEAR_SORT();
  renderGuestList();
}

// ── ADVANCED SORT MODAL
let glSortDraft = [];

function openAdvancedSort(){
  glSortDraft = glSortStack.map(s=>({...s}));
  renderAdvSortRows();
  document.getElementById('modal-adv-sort').classList.remove('hidden');
}
function closeAdvancedSort(){
  document.getElementById('modal-adv-sort').classList.add('hidden');
}
function applyAdvancedSort(){
  glSortStack = glSortDraft.filter(s=>s.col).map(s=>({...s}));
  if(!glSortStack.length) glSortStack = GL_DEFAULT_SORT();
  closeAdvancedSort();
  renderGuestList();
}
function resetAdvancedSort(){
  glSortDraft = GL_DEFAULT_SORT();
  renderAdvSortRows();
}
function clearAdvancedSort(){
  glSortDraft = GL_CLEAR_SORT();
  renderAdvSortRows();
}
function advSortAddRow(){
  const used = glSortDraft.map(s=>s.col);
  const next = GL_COLS.filter(c=>c.id!=='attended'&&!used.includes(c.id))[0];
  glSortDraft.push({col: next?next.id:'lastName', dir:1});
  renderAdvSortRows();
}
function advSortRemoveRow(i){
  glSortDraft.splice(i,1);
  renderAdvSortRows();
}
function advSortSetCol(i,val){ glSortDraft[i].col=val; }
function advSortSetDir(i,val){ glSortDraft[i].dir=parseInt(val); }
function renderAdvSortRows(){
  const sortableCols = GL_COLS.filter(c=>c.id!=='attended');
  const container = document.getElementById('adv-sort-rows');
  if(!container) return;
  container.innerHTML = glSortDraft.map((s,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:11px;color:var(--muted);min-width:54px;font-family:monospace;">${i===0?'Sort by':'then by'}</span>
      <select onchange="advSortSetCol(${i},this.value)"
        style="padding:5px 10px;border:1.5px solid var(--border2);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;cursor:pointer;min-width:140px;">
        ${sortableCols.map(c=>`<option value="${c.id}"${s.col===c.id?' selected':''}>${c.label}</option>`).join('')}
      </select>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;white-space:nowrap;">
        <input type="radio" name="advdir-${i}" value="1"${s.dir===1?' checked':''} onchange="advSortSetDir(${i},1)"
          style="accent-color:var(--accent);width:15px;height:15px;cursor:pointer;"> A to Z
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;white-space:nowrap;">
        <input type="radio" name="advdir-${i}" value="-1"${s.dir===-1?' checked':''} onchange="advSortSetDir(${i},-1)"
          style="accent-color:var(--accent);width:15px;height:15px;cursor:pointer;"> Z to A
      </label>
      ${i>0?`<button onclick="advSortRemoveRow(${i})"
        style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;padding:2px 6px;line-height:1;" title="Remove">🗑</button>`
       :'<div style="margin-left:auto;"></div>'}
    </div>`).join('');
}

// ── SORT CHIP DRAG-AND-DROP
let _glDragIdx = null;
function glChipDragStart(e, i){
  _glDragIdx = i;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.4';
}
function glChipDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.style.transform = 'scale(1.08)';
}
function glChipDrop(e, toIdx){
  e.preventDefault();
  if(_glDragIdx === null || _glDragIdx === toIdx) return;
  const moved = glSortStack.splice(_glDragIdx, 1)[0];
  glSortStack.splice(toIdx, 0, moved);
  renderGuestList();
}
function glChipDragEnd(e){
  _glDragIdx = null;
  e.currentTarget.style.opacity = '';
  e.currentTarget.style.transform = '';
}

function getFilteredGuestRows(){
  const tFilter = document.getElementById('gl-filter-table').value;
  const cFilter = document.getElementById('gl-filter-cat').value;

  const getVal = (g, col) => {
    const t = tables.find(x => x.id === g.tableId);
    switch(col){
      case 'seq':       return t?.seq ?? 9999;
      case 'table':     return t?.name||'';
      case 'seat':      return g.seat ?? 999;
      case 'lastName':  return (g.lastName||'').toLowerCase();
      case 'firstName': return (g.firstName||g.name||'').toLowerCase();
      case 'nickName':  return (g.nickName||'').toLowerCase();
      case 'cat':       return g.cat||'';
      case 'subCat':    return (g.subCat||'').toLowerCase();
      default: return '';
    }
  };

  const seated = guests
    .filter(g => g.tableId !== null)
    .filter(g => tFilter === 'all' || g.tableId === parseInt(tFilter))
    .filter(g => cFilter === 'all' || g.cat === cFilter)
    .sort((a,b) => {
      for(const {col,dir} of glSortStack){
        const av=getVal(a,col), bv=getVal(b,col);
        if(av<bv) return -dir;
        if(av>bv) return  dir;
      }
      return 0;
    });

  const unassigned = guests
    .filter(g => g.tableId === null)
    .filter(g => cFilter === 'all' || g.cat === cFilter);

  return { seated, unassigned };
}

function renderGuestList(){
  const { seated, unassigned } = getFilteredGuestRows();
  const tFilter = document.getElementById('gl-filter-table').value;
  const TH = `padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px;cursor:pointer;user-select:none;white-space:nowrap;`;
  const sortIdx = (col) => glSortStack.findIndex(s=>s.col===col);
  const sortIco = (col) => {
    const i=sortIdx(col); if(i<0) return '';
    const dir=glSortStack[i].dir===1?'↑':'↓';
    return glSortStack.length>1 ? ` <sup style="font-size:8px;opacity:.7">${i+1}</sup>${dir}` : ` ${dir}`;
  };
  const thActive = (col) => sortIdx(col)===0 ? 'color:var(--accent-dk);font-weight:800;' :
                            sortIdx(col)>0  ? 'color:var(--accent);' : 'color:var(--muted);';

  document.getElementById('gl-summary').textContent =
    `${seated.length} seated · ${unassigned.length} unassigned`;

  // Sort chips: draggable to reorder, click ↑/↓ to toggle dir, ✕ to remove
  const sortBar = document.getElementById('gl-sort-bar');
  if(sortBar){
    sortBar.innerHTML = glSortStack.map((s,i)=>`
      <span draggable="true" data-sort-idx="${i}"
        ondragstart="glChipDragStart(event,${i})"
        ondragover="glChipDragOver(event)"
        ondrop="glChipDrop(event,${i})"
        ondragend="glChipDragEnd(event)"
        style="display:inline-flex;align-items:center;gap:2px;background:var(--accent-lt);
        border:1px solid var(--accent);border-radius:10px;padding:2px 4px 2px 7px;font-size:9px;
        color:var(--accent-dk);font-family:monospace;white-space:nowrap;user-select:none;cursor:grab;
        transition:opacity .15s,transform .15s;">
        <span style="opacity:.35;font-size:9px;margin-right:1px;">⠿</span>
        <b style="opacity:.65">${i+1}</b>&thinsp;${GL_COLS.find(c=>c.id===s.col)?.label||s.col}&thinsp;<span
          onclick="glSetSort('${s.col}')" title="Toggle direction"
          style="cursor:pointer;font-size:11px;padding:0 2px;">${s.dir===1?'↑':'↓'}</span><span
          onclick="glRemoveSort('${s.col}')" title="Remove"
          style="cursor:pointer;padding:0 3px 0 1px;opacity:.6;font-size:10px;">✕</span>
      </span>`).join('');
  }

  // Build visible cols list in order
  const visCols = GL_COLS.filter(c => c.always || glVisibleCols.has(c.id));

  const thHtml = visCols.map(col => {
    const sortable = col.id !== 'attended';
    const align = col.id==='attended' ? 'text-align:center;' : '';
    return `<th style="${TH}${thActive(col.id)}${align}width:${col.id==='seq'?'32px':col.id==='seat'?'40px':col.id==='attended'?'64px':''}"
      ${sortable?`onclick="glSetSort('${col.id}')"`:''}>${col.label}${sortIco(col.id)}</th>`;
  }).join('');
  document.getElementById('gl-thead').innerHTML =
    `<tr style="background:var(--surface2);border-bottom:2px solid var(--border);">${thHtml}</tr>`;

  let lastTableId = null, rowNum = 0;
  const tbody = document.getElementById('gl-tbody');
  tbody.innerHTML = '';

  seated.forEach(g => {
    const t = tables.find(x => x.id === g.tableId);
    rowNum++;
    const isNewTable = g.tableId !== lastTableId;
    lastTableId = g.tableId;
    const dn = guestDisplayName(g);

    const tr = document.createElement('tr');
    tr.style.cssText = `border-bottom:1px solid var(--border);${isNewTable && rowNum > 1 ? 'border-top:2px solid var(--border2);' : ''}`;
    tr.innerHTML = visCols.map(col => {
      const td = (content, style='') => `<td style="padding:7px 10px;${style}">${content}</td>`;
      switch(col.id){
        case 'seq':
          return td(`${t?.seq??'—'}`, 'color:var(--muted);font-size:11px;font-family:var(--font-mono);');
        case 'table':
          return td(esc(t?.name||'—'), 'font-weight:500;color:var(--accent-dk);');
        case 'seat':
          return td(g.seat!=null?g.seat+1:'—', 'color:var(--muted);font-size:11px;');
        case 'lastName':
          return td(`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${g.color};margin-right:6px;flex-shrink:0;vertical-align:middle;"></span>${esc(g.lastName||'')}`, 'font-weight:500;');
        case 'firstName':
          return td(esc(g.firstName||g.name||''), 'font-weight:500;');
        case 'nickName':
          return td(esc(g.nickName||''), 'color:var(--text2);font-style:italic;');
        case 'cat':
          return td(esc(CAT_FULL[g.cat]||g.cat), 'color:var(--text2);');
        case 'subCat':
          return td(esc(g.subCat||''), 'color:var(--text2);');
        case 'attended':
          return td('<input type="checkbox" style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;">', 'text-align:center;');
        default: return td('');
      }
    }).join('');
    tbody.appendChild(tr);
  });

  const uDiv = document.getElementById('gl-unassigned');
  if(unassigned.length && tFilter === 'all'){
    let html = `<div style="margin-bottom:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);">Unassigned (${unassigned.length})</div>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead>`;
    html += `<tr style="background:var(--surface2);border-bottom:2px solid var(--border);">${thHtml}</tr></thead><tbody>`;
    unassigned.forEach((g, i) => {
      const dn = guestDisplayName(g);
      html += `<tr style="border-bottom:1px solid var(--border);">` +
        visCols.map(col => {
          const td = (content, style='') => `<td style="padding:7px 10px;${style}">${content}</td>`;
          switch(col.id){
            case 'seq': return td(rowNum+i+1, 'color:var(--muted);font-size:11px;font-family:var(--font-mono);');
            case 'table': return td('—', 'color:var(--muted);');
            case 'seat': return td('—', 'color:var(--muted);');
            case 'lastName': return td(`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${g.color};margin-right:6px;vertical-align:middle;"></span>${esc(g.lastName||'')}`, 'font-weight:500;');
            case 'firstName': return td(esc(g.firstName||g.name||''), 'font-weight:500;');
            case 'nickName': return td(esc(g.nickName||''), 'color:var(--text2);font-style:italic;');
            case 'cat': return td(esc(CAT_FULL[g.cat]||g.cat), 'color:var(--text2);');
            case 'subCat': return td(esc(g.subCat||''), 'color:var(--text2);');
            case 'attended': return td('<input type="checkbox" style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;">', 'text-align:center;');
            default: return td('');
          }
        }).join('') + `</tr>`;
    });
    html += `</tbody></table>`;
    uDiv.innerHTML = html;
  } else {
    uDiv.innerHTML = '';
  }
}

function exportGuestListCSV(){
  const { seated, unassigned } = getFilteredGuestRows();
  const expCols = GL_COLS.filter(c => c.id !== 'attended');
  const rows = [expCols.map(c=>c.label)];
  const buildRow = (g, isUnassigned) => {
    const t = tables.find(x => x.id === g.tableId);
    return expCols.map(col => {
      switch(col.id){
        case 'seq':       return t?.seq??'';
        case 'table':     return isUnassigned?'(Unassigned)':(t?.name||'');
        case 'seat':      return g.seat!=null?g.seat+1:'';
        case 'lastName':  return g.lastName||'';
        case 'firstName': return g.firstName||g.name||'';
        case 'nickName':  return g.nickName||'';
        case 'cat':       return CAT_FULL[g.cat]||g.cat;
        case 'subCat':    return g.subCat||'';
        default: return '';
      }
    });
  };
  seated.forEach(g=>rows.push(buildRow(g,false)));
  unassigned.forEach(g=>rows.push(buildRow(g,true)));
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='guest-list.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Guest list exported as CSV','success');
}
function printGuestList(){
  const { seated, unassigned } = getFilteredGuestRows();
  const visCols = GL_COLS; // print all columns
  let rowNum=0, lastTableId=null;
  const eventName = document.querySelector('.page-subtitle')?.textContent || 'Wedding Banquet';
  const dateStr = new Date().toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric'});

  const thRow = visCols.map(c=>`<th>${c.label}</th>`).join('');

  const buildTd = (g, isUnassigned) => {
    const t = tables.find(x => x.id === g.tableId);
    return visCols.map(col => {
      switch(col.id){
        case 'seq':       return `<td class="num">${t?.seq??'—'}</td>`;
        case 'table':     return `<td class="tname">${isUnassigned?'(Unassigned)':esc(t?.name||'—')}</td>`;
        case 'seat':      return `<td class="seat">${g.seat!=null?g.seat+1:'—'}</td>`;
        case 'lastName':  return `<td class="name"><span class="dot" style="background:${g.color}"></span>${esc(g.lastName||'')}</td>`;
        case 'firstName': return `<td>${esc(g.firstName||g.name||'')}</td>`;
        case 'nickName':  return `<td class="nick">${esc(g.nickName||'')}</td>`;
        case 'cat':       return `<td class="rel">${esc(CAT_FULL[g.cat]||g.cat)}</td>`;
        case 'subCat':    return `<td class="sub">${esc(g.subCat||'')}</td>`;
        case 'attended':  return `<td class="cb"><span class="box"></span></td>`;
        default: return '<td></td>';
      }
    }).join('');
  };

  let rows = '';
  seated.forEach(g => {
    const isNewTable = g.tableId !== lastTableId; lastTableId = g.tableId; rowNum++;
    rows += `<tr class="${isNewTable && rowNum>1?'new-table':''}">${buildTd(g,false)}</tr>`;
  });
  if(unassigned.length){
    const span = visCols.length;
    rows += `<tr class="unassigned-header"><td colspan="${span}">Unassigned (${unassigned.length})</td></tr>`;
    unassigned.forEach(g => { rowNum++; rows += `<tr>${buildTd(g,true)}</tr>`; });
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Guest List — ${eventName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#111;padding:15mm}
    h1{font-size:16pt;margin-bottom:2px} .sub{font-size:9pt;color:#666;margin-bottom:12px}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#f0f0f0;border-bottom:2px solid #ccc}
    th{padding:6px 8px;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.5px;color:#555}
    td{padding:5px 8px;border-bottom:1px solid #e8e8e8;vertical-align:middle}
    tr.new-table td{border-top:2px solid #bbb}
    td.num{color:#999;font-size:8pt;width:28px}
    td.tname{font-weight:600;color:#333}
    td.seat{color:#888;width:36px}
    td.name{font-weight:500}
    td.nick{color:#666;font-style:italic}
    td.rel{color:#555}
    td.sub{color:#777;font-size:9pt}
    td.cb{width:50px;text-align:center}
    .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}
    .box{display:inline-block;width:13px;height:13px;border:1.5px solid #999;border-radius:2px}
    tr.unassigned-header td{background:#f8f8f8;font-weight:700;font-size:8pt;color:#666;text-transform:uppercase;padding:7px 8px;border-top:2px solid #ccc}
    @media print{body{padding:8mm}}
  </style>
  </head><body>
    <h1>Guest Attendance List</h1>
    <div class="sub">${eventName} &nbsp;·&nbsp; ${dateStr} &nbsp;·&nbsp; ${seated.length+unassigned.length} guests</div>
    <table><thead><tr>${thRow}</tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;

  // Use hidden iframe to avoid popup blockers
  const frame = document.getElementById('print-guest-list');
  frame.innerHTML = `<iframe id="gl-print-frame" style="position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;"></iframe>`;
  const iframe = document.getElementById('gl-print-frame');
  iframe.onload = () => { iframe.contentWindow.focus(); iframe.contentWindow.print(); };
  iframe.srcdoc = html;
}

function renderStats(){
  const seated=guests.filter(g=>g.tableId!==null).length;
  document.getElementById('st-guests').textContent=guests.length;
  document.getElementById('st-seated').textContent=seated;
  document.getElementById('st-tables').textContent=tables.length;
  document.getElementById('st-cap').textContent=tables.reduce((a,t)=>a+seatCount(t),0);
}

// ── EXPORT / IMPORT JSON
function exportJSON(){
  const data={v:3,at:new Date().toISOString(),gId,tId,oId,guests,tables,objects};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download=`banquet-${new Date().toISOString().slice(0,10)}.json`;a.click();
  toast('Layout exported!','success');
}
function onFileLoad(ev){
  const file=ev.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);
      mutate(()=>{
        guests=d.guests||[];tables=d.tables||[];objects=d.objects||[];
        objects.forEach(o=>{if(!o.label)o.label=ODEFS[o.type]?.lbl||o.type;});
        guests.forEach(g=>{
          if(!g.cat||g.cat==='bride'||g.cat==='both'||g.cat==='vip')g.cat='bride-family';
          if(g.cat==='groom')g.cat='groom-family';
          if(g.cat==='family')g.cat='bride-family';
          if(g.cat==='friend')g.cat='bride-friend';
        });
        gId=d.gId||1;tId=d.tId||1;oId=d.oId||1;
      });
      render();toast('Layout imported!','success');
    }catch{toast('Invalid file','error');}
  };
  reader.readAsText(file);ev.target.value='';
}

// ── UTILS
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
let _tt;
function toast(msg,type=''){
  document.querySelectorAll('.toast').forEach(el=>el.remove());
  const t=document.createElement('div');
  t.className='toast '+type;t.textContent=msg;document.body.appendChild(t);
  clearTimeout(_tt);_tt=setTimeout(()=>t.remove(),2600);
}

// keyboard
document.getElementById('g-firstName').addEventListener('keydown',e=>{if(e.key==='Enter')addGuest();});
document.getElementById('t-name').addEventListener('keydown',e=>{if(e.key==='Enter')addTable();});
document.getElementById('et-name').addEventListener('keydown',e=>{if(e.key==='Enter')saveTableEdit();});
document.getElementById('eg-firstName').addEventListener('keydown',e=>{if(e.key==='Enter')saveGuestEdit();});
document.getElementById('eo-name').addEventListener('keydown',e=>{if(e.key==='Enter')saveObjEdit();});

init();