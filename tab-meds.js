// ── Medication (Plan → Medication, and the middle section of Today) ──────────
// Henrik, 2026-11-01: "add a other medication to the peptide tracker, so between injections
// and supplements ad a medication tab. One takes a photo of med package we use Claude API to
// get name and dose, the user enters dose per day (tablets 1/4, 1/2 1 or n number of tablets
// per day per medication. The checklist on Today page then includes meds as a middle section".
//
// The backend (/medications, /medications/log) is the record; localStorage only mirrors it.
// The package photo is read by /medications/read-package on the user's OWN key (the one saved
// for the food log), and only fills the form: nothing is saved until the user taps Save.

var _meds = [];          // the user's medications (cache mirror of the backend)
var _medLog = {};        // { 'medId|YYYY-MM-DD': true } — ticked days (cache mirror)
var _medViewDate = null; // the day the Today section shows
var _medSheet = {busy:false, err:''};

// Tablets per day: quarters, then whole numbers (matches routers/medications.py tablets_ok).
var MED_TABLETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10];

function _medEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _medDateKey(d){ var x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
function _medLogKey(id, date){ return id+'|'+date; }

// "¼ tablet", "1 tablet", "1½ tablets", "3 tablets"
function _medFmtTablets(n, form){
  n = Number(n)||0;
  var whole = Math.floor(n), frac = Math.round((n-whole)*4);
  var fr = ['', '¼', '½', '¾'][frac] || '';
  var num = (whole ? String(whole) : '') + fr;
  if(!num) num = '0';
  var unit = String(form||'tablet').toLowerCase().indexOf('caps')>=0 ? 'capsule' : 'tablet';
  return num + ' ' + unit + (n > 1 ? 's' : '');
}

function _medActiveOn(m, date){
  if(!m) return false;
  if(!m.start_date) return true;
  var s = parseLocalDate(m.start_date); s.setHours(0,0,0,0);
  var d = new Date(date); d.setHours(0,0,0,0);
  return d >= s;
}
function _medsForDay(date){ return (_meds||[]).filter(function(m){ return _medActiveOn(m, date); }); }

// ── cache + sync ─────────────────────────────────────────────────────────────
function _medLoadCache(){ _meds = getData('pep-meds', []) || []; _medLog = getData('pep-med-log', {}) || {}; }
function _medSaveCache(){ setData('pep-meds', _meds); }
function _medSaveLogCache(){ setData('pep-med-log', _medLog); }

async function syncMedsFromAgent(){
  _medLoadCache();
  try{
    var r = await fetch(AGENT_URL + '/medications', {headers: authHeaders()});
    if(!r.ok){ _logHttp('syncMeds', r.status, '/medications'); return; }
    var data = await r.json();
    if(Array.isArray(data)){
      _meds = data; _medSaveCache();
      renderTodayMeds(_medViewDate||NOW);
      if(_currentTab==='meds') buildMeds();
    }
  }catch(e){ _logErr('syncMeds', e); }
}

async function syncMedLogFromAgent(){
  try{
    var since = new Date(); since.setDate(since.getDate()-60);
    var r = await fetch(AGENT_URL + '/medications/log?since=' + _medDateKey(since), {headers: authHeaders()});
    if(!r.ok){ _logHttp('syncMedLog', r.status, '/medications/log'); return; }
    var data = await r.json();
    if(Array.isArray(data)){
      var m = {};
      data.forEach(function(e){ m[_medLogKey(e.med_id, e.date)] = true; });
      _medLog = m; _medSaveLogCache();
      renderTodayMeds(_medViewDate||NOW);
    }
  }catch(e){ _logErr('syncMedLog', e); }
}

async function toggleMedDose(medId, dstr){
  var key = _medLogKey(medId, dstr), was = !!_medLog[key];
  if(was) delete _medLog[key]; else _medLog[key] = true;
  _medSaveLogCache();
  renderTodayMeds(_medViewDate||NOW);
  if(typeof buildTodayRings==='function') buildTodayRings();
  var ok = false;
  try{
    var r = await fetch(AGENT_URL + '/medications/log', {method:'POST', headers: authHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({med_id: medId, date: dstr, taken: !was})});
    ok = r.ok;
    if(!ok) _logHttp('medLogToggle', r.status, '/medications/log');
  }catch(e){ _logErr('medLogToggle', e); }
  if(!ok){
    if(was) _medLog[key] = true; else delete _medLog[key];
    _medSaveLogCache();
    renderTodayMeds(_medViewDate||NOW);
    if(typeof buildTodayRings==='function') buildTodayRings();
  }
}

// ── Today: the middle section ────────────────────────────────────────────────
function renderTodayMeds(date){
  var wrap = document.getElementById('today-meds');
  if(!wrap) return;
  var theDate = date || NOW;
  _medViewDate = theDate;
  var active = _medsForDay(theDate).slice().sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
  if(!active.length){ wrap.innerHTML = ''; return; }
  var dstr = _medDateKey(theDate), done = 0;
  var rows = active.map(function(m){
    var taken = !!_medLog[_medLogKey(m.id, dstr)];
    if(taken) done++;
    var detail = [m.strength, _medFmtTablets(m.tablets_per_day, m.form)].filter(Boolean).join(' · ');
    return '<div class="check-item'+(taken?' checked-item':'')+'" onclick="toggleMedDose(\''+_medEsc(m.id)+'\',\''+dstr+'\')">' +
      '<div class="check-box'+(taken?' checked':'')+'"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<div class="check-main"><div class="check-name" style="color:var(--text)">' + _medEsc(m.name) + '</div>' +
      '<div class="check-detail">' + _medEsc(detail) + '</div></div></div>';
  }).join('');
  wrap.innerHTML = '<div class="card">' +
    todaySecHeader('meds', 'MEDICATION', 'var(--accent2)', done, active.length) +
    todaySecBody('meds', '<div class="checklist">' + rows + '</div>') + '</div>';
}

// ── Plan → Medication ────────────────────────────────────────────────────────
function buildMeds(){
  var el = document.getElementById('meds-body');
  if(!el) return;
  _medLoadCache();
  var list = (_meds||[]).slice().sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
  var header =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 16px">' +
    '<div style="font-family:var(--font-display);font-size:22px;letter-spacing:1px;color:var(--text)">MEDICATION</div>' +
    '<button onclick="_medOpenSheet()" style="background:var(--accent);color:#000;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">+ Add</button></div>';
  var body = !list.length
    ? '<div class="empty" style="padding:40px 20px"><div class="empty-icon">💊</div>No medication yet.<br>Tap “+ Add” and take a photo of the package.</div>'
    : list.map(function(m){
        return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px">' +
          '<div style="width:9px;height:9px;border-radius:50%;background:var(--accent2);flex-shrink:0"></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600;color:var(--text)">' + _medEsc(m.name) + '</div>' +
          '<div style="font-size:12px;color:var(--muted2);margin-top:3px">' + _medEsc([m.strength, _medFmtTablets(m.tablets_per_day, m.form) + ' a day'].filter(Boolean).join(' · ')) + '</div></div>' +
          '<button onclick="_medOpenSheet(\'' + _medEsc(m.id) + '\')" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Edit</button>' +
          '<button onclick="_medDelete(\'' + _medEsc(m.id) + '\')" aria-label="Delete" style="background:none;border:none;color:var(--muted2);font-size:20px;cursor:pointer;line-height:1;padding:2px 4px">×</button></div>';
      }).join('');
  el.innerHTML = '<div style="padding:16px">' + header + body + '</div>';
}

function _medTabletOptions(sel){
  return MED_TABLETS.map(function(n){ return '<option value="'+n+'"'+(Number(sel)===n?' selected':'')+'>'+_medFmtTablets(n,'tablet')+'</option>'; }).join('');
}

function _medOpenSheet(editId){
  _medCloseSheet();
  _medSheet = {busy:false, err:''};
  var ed = editId ? (_meds||[]).find(function(m){ return m.id===editId; }) : null;
  var iSty = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:11px 13px;color:var(--text);font-size:16px;font-family:inherit;outline:none;width:100%;box-sizing:border-box';
  var lSty = 'font-size:11px;font-weight:700;letter-spacing:0.8px;color:var(--muted,#888);text-transform:uppercase;margin-bottom:8px;display:block';
  var ol = document.createElement('div');
  ol.id = 'med-sheet';
  ol.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  ol.onclick = function(e){ if(e.target===ol) _medCloseSheet(); };
  ol.innerHTML =
    '<div style="background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px 20px 36px;max-height:88vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--text)">' + (ed?'EDIT MEDICATION':'ADD MEDICATION') + '</div>' +
      '<button onclick="_medCloseSheet()" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1">×</button></div>' +
    '<input id="med-photo" type="file" accept="image/'+'*" capture="environment" style="display:none" onchange="_medPhotoPicked(this)">' +
    '<button id="med-photo-btn" onclick="document.getElementById(\'med-photo\').click()" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:6px">📷 Photo of the package</button>' +
    '<div id="med-photo-msg" style="font-size:12px;color:var(--muted);margin-bottom:14px">Name and strength are read from the photo with your own API key (Settings, Food key). Check them before saving.</div>' +
    '<div style="margin-bottom:14px"><label style="'+lSty+'">Name</label><input id="med-name" maxlength="120" value="'+_medEsc(ed?ed.name:'')+'" style="'+iSty+'"></div>' +
    '<div style="margin-bottom:14px"><label style="'+lSty+'">Strength per tablet</label><input id="med-strength" maxlength="60" placeholder="e.g. 10 mg" value="'+_medEsc(ed?ed.strength:'')+'" style="'+iSty+'"></div>' +
    '<input id="med-form" type="hidden" value="'+_medEsc(ed?ed.form:'tablet')+'">' +
    '<div style="margin-bottom:22px"><label style="'+lSty+'">Per day</label><select id="med-tablets" style="'+iSty+'">'+_medTabletOptions(ed?ed.tablets_per_day:1)+'</select></div>' +
    '<button onclick="_medSave(' + (ed?('\''+_medEsc(editId)+'\''):'') + ')" style="width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">' + (ed?'Save':'Add medication') + '</button>' +
    '</div>';
  document.body.appendChild(ol);
}
function _medCloseSheet(){ var ol=document.getElementById('med-sheet'); if(ol) ol.remove(); }

function _medSetPhotoMsg(text, bad){
  var m = document.getElementById('med-photo-msg');
  if(m){ m.textContent = text; m.style.color = bad ? 'var(--danger,#ff3b30)' : 'var(--muted)'; }
  var b = document.getElementById('med-photo-btn');
  if(b){ b.disabled = !!_medSheet.busy; b.textContent = _medSheet.busy ? 'Reading the package…' : '📷 Photo of the package'; }
}

// What read-package answered → the form. Only fields the photo actually gave are filled.
function _medApplyRead(j){
  var n = document.getElementById('med-name'), s = document.getElementById('med-strength'), f = document.getElementById('med-form');
  if(n && j && j.name) n.value = j.name;
  if(s && j && j.strength) s.value = j.strength;
  if(f && j && j.form) f.value = j.form;
}

async function _medPhotoPicked(inp){
  var file = inp && inp.files && inp.files[0];
  if(!file || _medSheet.busy) return;
  _medSheet.busy = true; _medSetPhotoMsg('Reading the package…');
  try{
    var b64 = await _flShrink(file);
    var r = await fetch(AGENT_URL + '/medications/read-package', {method:'POST', headers: authHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({image_b64: b64, media_type: 'image/jpeg'})});
    var j = await r.json().catch(function(){ return {}; });
    _medSheet.busy = false;
    if(!r.ok){ _medSetPhotoMsg((j && typeof j.detail==='string') ? j.detail : ('The server answered '+r.status+'.'), true); return; }
    _medApplyRead(j);
    _medSetPhotoMsg(j.strength ? 'Read from the photo. Check it, pick how many a day, then save.' : 'Name read; no strength was visible. Type it if you know it.');
  }catch(e){
    _medSheet.busy = false;
    _medSetPhotoMsg('Could not read the photo: no connection.', true);
  }
  inp.value = '';
}

async function _medSave(editId){
  var n = document.getElementById('med-name'), s = document.getElementById('med-strength');
  var t = document.getElementById('med-tablets'), f = document.getElementById('med-form');
  var name = n ? String(n.value||'').trim() : '';
  if(!name){ _medSetPhotoMsg('Type the name, or take a photo of the package.', true); return; }
  var ex = editId ? (_meds||[]).find(function(m){ return m.id===editId; }) : null;
  var entry = {id: editId || undefined, name: name, strength: s ? String(s.value||'').trim() : '',
    form: f && f.value ? f.value : 'tablet', tablets_per_day: t ? Number(t.value) : 1,
    start_date: (ex && ex.start_date) ? ex.start_date : _medDateKey(new Date())};
  try{
    var r = await fetch(AGENT_URL + '/medications', {method:'POST', headers: authHeaders({'Content-Type':'application/json'}), body: JSON.stringify(entry)});
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok || !j.entry){ _medSetPhotoMsg('Not saved: ' + ((j && typeof j.detail==='string') ? j.detail : 'the server answered '+r.status+'.'), true); return; }
    var saved = j.entry;
    _meds = editId ? (_meds||[]).map(function(m){ return m.id===editId ? saved : m; }) : (_meds||[]).concat([saved]);
    _medSaveCache();
  }catch(e){ _medSetPhotoMsg('Not saved: could not reach the server.', true); return; }
  _medCloseSheet();
  buildMeds();
  renderTodayMeds(_medViewDate||NOW);
}

async function _medDelete(id){
  if(!id) return;
  if(typeof confirmGlobalDelete==='function' && !confirmGlobalDelete('this medication')) return;
  try{
    var r = await fetch(AGENT_URL + '/medications/' + encodeURIComponent(id), {method:'DELETE', headers: authHeaders()});
    if(!r.ok && r.status!==404){ alert('Not deleted: the server answered ' + r.status + '.'); return; }
  }catch(e){ alert('Not deleted: could not reach the server.'); return; }
  _meds = (_meds||[]).filter(function(m){ return m.id!==id; });
  _medSaveCache();
  buildMeds();
  renderTodayMeds(_medViewDate||NOW);
}
