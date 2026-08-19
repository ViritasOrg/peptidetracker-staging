// Collapse duplicate injections onto one row per compound+time-of-day slot,
// preferring an already-logged shot. A slot can hold two rows after a dose edit
// (the administered shot is kept and a new planned one was added); the backend now
// prevents new duplicates, this also hides any created before that fix. Mirrors the
// dedup buildSchedule already applies.
function _dedupInjectionSlots(list){var m={},order=[];(list||[]).forEach(function(e){var k=e.compound_id+'_'+(e.time_of_day||'');var c=m[k];if(c===undefined){m[k]=e;order.push(k);}else if(e.logged&&!c.logged){m[k]=e;}});return order.map(function(k){return m[k];});}
// A YEAR BACK, NOT A FORTNIGHT. Henrik, 2026-08-17: "Make Today views day selector
// scrollable backwards in time for a year." The strip used to run NOW-7 .. NOW+6, so
// anything older than last week was unreachable from Today — the only way to look at
// an older day was the history tab, which cannot tick a dose. The forward window is
// unchanged: this adds past, it does not add future.
var WEEK_STRIP_BACK=365,WEEK_STRIP_FWD=6;
function buildWeekStrip(){const strip=document.getElementById('week-strip');/* Rebuilt on every tick (toggleInjection), so re-centring on today here would yank the strip back from wherever the user had scrolled and make a year of history unusable. Centre on the first build only; after that hold position. The window is anchored to NOW and fixed in length, so a given scrollLeft means the same days across rebuilds. *//* strip.dataset is always present on a real element; the ||{} is for the test harness, whose element stubs are hand-rolled per block. */var _wsDs=strip.dataset||{};var _keepScroll=(_wsDs.wsCentered==='1')?strip.scrollLeft:null;strip.innerHTML='';/* The calendar card sits at the far-left end of the strip, where scrolling back through the year runs out: past is to the left, so this is the last card in that direction. It is the way in to dates the strip cannot reach. */var _calCard=document.createElement('div');_calCard.className='week-day week-cal';_calCard.style.cursor='pointer';_calCard.onclick=function(){showMonthCalendar();};_calCard.innerHTML='<div class="week-day-name">ALL</div>'+'<div class="week-day-num" style="font-family:inherit;font-size:16px">\u25a6</div>'+'<div class="week-dots"></div>';strip.appendChild(_calCard);const start=new Date(NOW);start.setDate(NOW.getDate()-WEEK_STRIP_BACK);let todayEl=null;const DL=['S','M','T','W','T','F','S'];for(let i=0;i<WEEK_STRIP_BACK+1+WEEK_STRIP_FWD;i++){const d=new Date(start);d.setDate(start.getDate()+i);const dow=d.getDay();const isToday=d.toDateString()===NOW.toDateString();const dk=dateKey(d);var dMid=new Date(d);dMid.setHours(0,0,0,0);var nMid=new Date(NOW);nMid.setHours(0,0,0,0);var isPast=dMid<nMid;var entries=_injectionsCache[dk]||[];var dots=[];var dotsDim=[];if(isPast){var logged=entries.filter(function(e){return e.logged;});if(logged.length){logged.forEach(function(e){dots.push(e.dot);});}else{var _act=entries.filter(function(e){return e.active;});if(_act.length){_act.forEach(function(e){dotsDim.push(e.dot);});}else if(!entries.length){var _pld=getPastDoses(d);if(_pld){var _bSeen={};_pld.forEach(function(di){var bid=di.substring(0,di.lastIndexOf('_'));if(!_bSeen[bid]){_bSeen[bid]=true;var inf=_findWeeklyItemInfo(bid);if(inf&&inf.dot)dots.push(inf.dot);}});}}}}else{entries.filter(function(e){return e.active;}).forEach(function(e){dots.push(e.dot);});}const el=document.createElement('div');el.className='week-day'+(isToday?' today':'');el.style.cursor='pointer';(function(dd,ee){el.onclick=function(){var _tb=document.getElementById('tab-btn-today');if(_tb)switchTab('today',_tb);showDayInline(dd,ee);};})(d,el);var _dotSrc=dots.length?dots:dotsDim;var _dotDim=!dots.length&&dotsDim.length;const dotHtml=[...new Set(_dotSrc)].slice(0,3).map(function(col){return'<div class="week-dot" style="background:'+col+(_dotDim?';opacity:0.3':'')+'"></div>';}).join('');el.innerHTML='<div class="week-day-name">'+DL[dow]+'</div>'+'<div class="week-day-num">'+d.getDate()+'</div>'+'<div class="week-dots">'+dotHtml+'</div>';strip.appendChild(el);if(isToday)todayEl=el;}if(_keepScroll!==null){strip.scrollLeft=_keepScroll;}else if(todayEl){strip.scrollLeft=todayEl.offsetLeft-(strip.clientWidth-todayEl.offsetWidth)/2;/* Only claim the strip is positioned once it actually has layout. init() builds once before the tab is laid out (offsetLeft 0, so centring is a no-op) and again 100ms later; flagging the first would hold that dead position and open the strip a year in the past. */if(todayEl.offsetLeft>0)_wsDs.wsCentered='1';}}
function buildToday(){if(typeof buildTodayRings==='function')buildTodayRings();if(typeof renderTodaySupplements==='function')renderTodaySupplements(NOW);const list=document.getElementById('today-checklist');var _tt=document.getElementById('today-title');if(_tt)_tt.textContent="TODAY'S DOSES";const _ci=document.getElementById('today-cycle-info');if(_ci){const _st=_userStacks[_activeStackIndices[0]];const _cs=_st&&_st.cycle_start;/* THE STORED LENGTH, NEVER AN INVENTED ONE. This read `_st.cycle_length||12`, so a protocol with no end date still printed "Week 12 of 12 · Ends <date>" — a cycle nobody had configured, stated as fact. It cost a full misdiagnosis on 2026-08-15: the header was taken as evidence the cycle had ended, and the search went to the wrong protocol entirely. A missing end date is a real state; say it. */const _cl=_st&&_st.cycle_length;if(_cs){const _sd=parseLocalDate(_cs);if(_cl>0){const _ed=new Date(_sd.getTime()+_cl*7*86400000);const _dd=Math.max(0,Math.floor((NOW-_sd)/86400000));const _wk=Math.min(_cl,Math.floor(_dd/7)+1);_ci.textContent='Started '+fmtDate(_sd)+' · Week '+_wk+' of '+_cl+' · Ends '+fmtDate(_ed);}else{const _d2=Math.max(0,Math.floor((NOW-_sd)/86400000));_ci.textContent='Started '+fmtDate(_sd)+' · Week '+(Math.floor(_d2/7)+1)+' · No end date';}}else{_ci.textContent='';}}if(_syncPending||!_injCacheReady){list.innerHTML='<div class="today-spinner"><div class="today-spinner-dot"></div></div>';const _b=document.getElementById('today-badge');if(_b){_b.textContent='...';_b.className='card-badge badge-today';}return;}list.innerHTML='';const alertWrap=document.getElementById('today-alerts');alertWrap.innerHTML='';
// ── TESTOSTERONE CONFIGURED BUT NOT SCHEDULED ───────────────────────────────
// Since 2026-08-14 T-Calc is the only thing that schedules testosterone: _genInjBatches
// suppresses it in BOTH tiers (_isTestosteroneComp — the whole trt tier, and any
// enhanced compound whose name contains "testosterone", which the catalogue's
// "Testosterone Undecanoate (Nebido)" does). So a protocol can show an ester configured
// and generate nothing at all for it, and until now Today said nothing: the doses were
// not hidden and not counted, because they had never been created. There was nowhere in
// Today to find that out — the explaining banner (_tcalcOwnsTestoNote) lives only inside
// the stack editor's own tier tabs, which is not where you look when a dose is missing.
//
// Reported 2026-08-15: "even though Enhanced has Nebido scheduled there is no injections
// in Today for testosterone." Nothing was broken; the protocol had no T-Calc plan bound,
// so no testosterone existed to render. Say that here, where it was looked for.
(function(){
  if(!alertWrap)return;
  var _st=_userStacks&&_activeStackIndices&&_activeStackIndices.length?_userStacks[_activeStackIndices[0]]:null;
  if(!_st)return;
  if(typeof _stackTestoComp!=='function'||typeof _stackHasScheduledTrt!=='function')return;
  var _tc=_stackTestoComp(_st);
  if(!_tc)return;                                        // no ester configured — nothing to explain
  var _sid=(typeof _stackCycleId==='function')?_stackCycleId(_st):(_st.id||'');
  if(_stackHasScheduledTrt(_sid))return;                 // it IS scheduled — say nothing
  var _nm=(_tc.c&&(_tc.c.name||_tc.c.id))||'Testosterone';
  var _tier=_tc.tier==='trt'?'TRT':'Enhanced';
  alertWrap.innerHTML='<div onclick="var b=document.getElementById(\'tab-btn-tcalc\');if(b)b.click();" style="cursor:pointer;background:rgba(102,136,204,0.08);border:1px solid #6688cc44;border-left:3px solid #6688cc;border-radius:8px;padding:10px 12px;margin-bottom:10px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px">'
      +'<div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#6688cc">Testosterone not scheduled</div>'
      +'<div style="font-size:11px;color:#6688cc;flex-shrink:0">Open T-Calc →</div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--muted2);line-height:1.5">“'+_esc(_nm)+'” is configured in this protocol’s '+_tier+' tier, but testosterone is scheduled only in T-Calc and no plan is saved to “'+_esc(_st.name||'this protocol')+'”. That is why no testosterone dose appears here. Tap to set the ester, dose and cadence, then save it to this protocol.</div>'
  +'</div>';
})();
var dk=dateKey(NOW);var doses=_dedupInjectionSlots((_injectionsCache[dk]||[]).filter(function(e){return e.active;}));if(!doses.length){var _hasActive=_userStacks&&_userStacks.length&&_activeStackIndices&&_activeStackIndices.length&&_userStacks[_activeStackIndices[0]];if(!_hasActive){var _hasT=(typeof _protocolTemplates!=='undefined'&&_protocolTemplates&&_protocolTemplates.length);var _primary=_hasT?'<button onclick="openTemplatePicker()" style="background:var(--accent);color:#000;border:none;border-radius:20px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Start from a template</button>':'<button onclick="createNewStack()" style="background:var(--accent);color:#000;border:none;border-radius:20px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Build your first protocol</button>';var _secondary=_hasT?'<div><button onclick="createNewStack()" style="background:none;border:none;color:var(--muted2);font-size:12px;cursor:pointer;font-family:inherit;margin-top:10px;text-decoration:underline">Build your own instead</button></div>':'';list.innerHTML='<div class="empty"><div class="empty-icon">💉</div><div style="font-weight:600;color:var(--text);margin-bottom:4px">No protocol yet</div><div style="font-size:13px;color:var(--muted2);margin-bottom:16px;line-height:1.5">Set up your first protocol to see your daily doses here.</div>'+_primary+_secondary+'</div>';}else{var _hid=(typeof _injHidden!=='undefined')?_injHidden:null;
// A FINISHED CYCLE IS NOT "DOSES HIDDEN" — SAY WHICH IT IS.
// Every generator stops at `days >= cycle_length*7` (_getDynamicTRTDoses,
// _getDynamicEnhancedDoses, _genInjBatches), so a protocol past its end date
// schedules nothing. That is the whole reason Today is empty, and until this branch
// existed the render fell through to the hidden-doses message below and blamed
// unrelated inactive protocols instead. A real 12-week protocol that ended on 10 Aug
// reported "66 doses hidden — they belong to 'a protocol that no longer exists' and
// 'Enhanced', which are not active" (2026-08-15). Every word of that was true and none
// of it was the reason; it sent the user hunting protocol activation for a cycle that
// had simply run out. The end date is the more specific answer, so it goes first.
//
// This states the situation, it does not change it. Cycles still end exactly when they
// are configured to — nothing here extends one, and nothing generates past the bound.
var _actSt=_userStacks[_activeStackIndices[0]];
var _csEnd=_actSt&&_actSt.cycle_start,_clEnd=_actSt&&_actSt.cycle_length;
var _endedAt=null;
if(_csEnd&&_clEnd>0){
  var _sdEnd=parseLocalDate(_csEnd);
  // Same day arithmetic the generators use, so this can never disagree with them about
  // whether the cycle is over.
  if(_sdEnd&&!isNaN(_sdEnd.getTime())&&Math.floor((NOW-_sdEnd)/86400000)>=_clEnd*7)
    _endedAt=new Date(_sdEnd.getTime()+_clEnd*7*86400000);
}
if(_endedAt){
  list.innerHTML='<div class="empty"><div class="empty-icon">🏁</div>'
    +'<div style="font-weight:600;color:var(--text);margin-bottom:4px">Cycle finished</div>'
    +'<div style="font-size:13px;color:var(--muted2);margin-bottom:16px;line-height:1.5">“'+_esc(_actSt.name||'This protocol')+'” completed its '+_clEnd+'-week cycle on '+fmtDate(_endedAt)+', so nothing is scheduled after that date. Extend it or remove its end date to carry on.</div>'
    +'<button onclick="switchTab(\'stacks\',document.getElementById(\'tab-btn-stacks\'))" style="background:var(--accent);color:#000;border:none;border-radius:20px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Open Plan</button></div>';
}else if(_hid&&_hid.count){
  // Never claim there is nothing scheduled when stored doses exist and were
  // filtered out. Name the protocol and say what to do about it.
  var _names=Object.keys(_hid.stacks||{});
  // Owner first. An ACTIVE protocol now always contributes its cycle id, so a
  // missing start date no longer hides anything — the only reason left is that the
  // owning protocol is switched off. The no-start wording stays as a fallback for a
  // stack whose owner cannot be identified at all.
  var _why=_names.length
    ?'They belong to '+_names.map(function(n){return '“'+_esc(n)+'”';}).join(' and ')+', which '+(_names.length>1?'are':'is')+' not active.'
    :(_hid.noStart&&_hid.noStart.length
      ?'“'+_esc(_hid.noStart[0])+'” has no start date, so its schedule cannot be placed on a calendar.'
      :'They belong to a protocol that is not active.');
  // A DOSE HIDDEN FOR A COMPOUND REASON NEEDS THE COMPOUND REASON.
  // These rows sit under the ACTIVE protocol's own cycle id but name a compound its
  // config does not list — a renamed compound, a rebuilt protocol, a canonicalised id.
  // Saying "the protocol is not active" about them would be plainly false: it is. Until
  // 2026-08-15 they were deleted rather than shown, so this had no wording at all.
  var _orph=Object.keys(_hid.orphans||{});
  if(_orph.length){
    var _oTot=_orph.reduce(function(a,k){return a+_hid.orphans[k];},0);
    _why+=(_names.length?' ':'')+_oTot+' of them '+(_oTot===1?'is':'are')+' for '+
      _orph.slice(0,3).map(function(k){return '“'+_esc(k)+'”';}).join(', ')+
      (_orph.length>3?' and others':'')+', which this protocol no longer lists. '+
      'Nothing has been deleted — add the compound back, or remove the doses yourself.';
  }
  list.innerHTML='<div class="empty"><div class="empty-icon">🔕</div>'
    +'<div style="font-weight:600;color:var(--text);margin-bottom:4px">'+_hid.count+' dose'+(_hid.count===1?'':'s')+' hidden</div>'
    +'<div style="font-size:13px;color:var(--muted2);margin-bottom:16px;line-height:1.5">'+_why+'</div>'
    +'<button onclick="switchTab(\'stacks\',document.getElementById(\'tab-btn-stacks\'))" style="background:var(--accent);color:#000;border:none;border-radius:20px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Open Plan</button></div>';
}else{
list.innerHTML='<div class="empty"><div class="empty-icon">✓</div>Nothing scheduled today</div>';}}document.getElementById('today-badge').textContent='—';return;}const order=(typeof TIME_RANK!=='undefined')?TIME_RANK:{'AM':0,'null':1,'PM':2};doses.sort(function(a,b){return(order[a.time_of_day]??1)-(order[b.time_of_day]??1);});var done=0;doses.forEach(function(dose){var isChk=dose.logged;if(isChk)done++;var item=document.createElement('div');item.className='check-item'+(isChk?' checked-item':'');var box=document.createElement('div');box.className='check-box'+(isChk?' checked':'');box.innerHTML='<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';var main=document.createElement('div');main.className='check-main';var nameEl=document.createElement('div');nameEl.className='check-name';nameEl.style.color=(dose.tier==='trt'?'#e05050':dose.dot);nameEl.textContent=dose.compound_name;var detailEl=document.createElement('div');detailEl.className='check-detail';detailEl.textContent=dose.dose+(dose.unit?' '+(UNIT_LABELS[dose.unit]||dose.unit):'');main.appendChild(nameEl);main.appendChild(detailEl);item.appendChild(box);item.appendChild(main);if(dose.time_of_day){var timeEl=document.createElement('div');timeEl.className='check-time';timeEl.textContent=(typeof _slotLabel==='function')?_slotLabel(dose.time_of_day):dose.time_of_day;item.appendChild(timeEl);}item.onclick=function(){toggleInjection(dose.id,dose.logged);};var cId=dose.compound_id;if(dose.tier==='peptide'){var _pcp=PEPTIDE_CAT.find(function(c){return c.id===cId;});if(_pcp){var _bib=document.createElement('button');_bib.className='info-btn';_bib.textContent='ℹ';(function(_id){_bib.onclick=function(e){e.stopPropagation();showPeptideCard(_id);};}(cId));item.appendChild(_bib);}}else if(dose.tier==='enhanced'){var _ece=(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===cId;});if(_ece){var _bib=document.createElement('button');_bib.className='info-btn';_bib.textContent='ℹ';(function(_id){_bib.onclick=function(e){e.stopPropagation();showEnhancedCard(_id);};}(cId));item.appendChild(_bib);}}list.appendChild(item);});const badge=document.getElementById('today-badge');badge.textContent=done+' / '+doses.length;badge.className='card-badge '+(done===doses.length?'badge-done':'badge-today');}
async function toggleInjection(id,currentLogged){var newLogged=!currentLogged;_trtLogCache={};Object.keys(_injectionsCache).forEach(function(dk){(_injectionsCache[dk]||[]).forEach(function(e){if(e.id===id)e.logged=newLogged;});});if(_viewDate){var activeTile=document.querySelector('.week-day.selected-day');showDayInline(_viewDate,activeTile);}else{buildToday();}buildWeekStrip();try{var r=await fetch(AGENT_URL+'/injections/'+id,{method:'PUT',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({logged:newLogged})});if(!r.ok){_logHttp('toggleInj',r.status,'/injections/'+id);Object.keys(_injectionsCache).forEach(function(dk){(_injectionsCache[dk]||[]).forEach(function(e){if(e.id===id)e.logged=currentLogged;});});if(_viewDate){var activeTile=document.querySelector('.week-day.selected-day');showDayInline(_viewDate,activeTile);}else{buildToday();}}else if(typeof _tcFetchHistory==='function'){/* THE RECORD CHANGED — RE-READ IT, DO NOT GUESS. _tcHistory is fetched once per session: _tcFetchHistory returns early on a warm cache and buildTCalc only calls it while the state is 'idle'. Every other source the curve rests on (_injectionsCache, _tcp.manualLog) is rebuilt from the backend on each refresh, so the moment a logged flag changes here the two disagree for the rest of the session. Ticking moved a dose out of the plan without moving it into the history (_tcProtocolInjections and _tcLoadLogFromStack both skip logged rows) and the curve LOST it; unticking left it in the history after it had left the record and the curve KEPT it. Display-only and cleared on restart, which is what made it hard to place: six unticks left the curve frozen at 31 doses / first 16 Jul / peak 1225 pmol/L against a true 25 / 28 Jul / 1018 (2026-08-15). Forced, because the cache is warm by definition at this point. _tcFetchHistory ends in buildTCalc(), so the redraw comes with it; only the success path needs this — a failed PUT left the record untouched and the rollback below restores the cache. */await _tcFetchHistory(true);}}catch(e){_logErr('toggleInj',e);Object.keys(_injectionsCache).forEach(function(dk){(_injectionsCache[dk]||[]).forEach(function(e){if(e.id===id)e.logged=currentLogged;});});}}
async function syncPeptideLogFromAgent(){try{const r=await fetch(AGENT_URL+'/peptide-log',{headers:authHeaders()});if(!r.ok){_syncPending=false;buildToday();return;}window._peptideLog=await r.json();
  window._peptideLog.forEach(function(entry){
    if(!entry.doses)return;
    localStorage.setItem('proto-chk-'+entry.date,JSON.stringify(entry.doses));
  });
  _syncPending=false;buildWeekStrip();buildToday();if(_viewDate){var _at=document.querySelector('.week-day.selected-day');showDayInline(_viewDate,_at);}buildHistory();detectCycleStart();obInit();}catch(e){_syncPending=false;buildToday();obInit();}}
function detectCycleStart(){
  if(!window._peptideLog||!_userStacks.length)return;
  var active=_userStacks[_activeStackIndices[0]];
  if(!active)return;
  var allSet=active.cycle_start&&(active.peptides||[]).every(function(p){return !!p.start_date;});
  if(allSet)return;
  var changed=false;
  // Auto-detect per-peptide start date from log (only for unset peptides)
  (active.peptides||[]).forEach(function(p){
    if(p.start_date)return;
    var pid=p.id;
    var earliest=null;
    window._peptideLog.forEach(function(entry){
      if(!entry.doses)return;
      // Match canonical and legacy ID formats
      var hit=entry.doses.some(function(d){
        if(d.startsWith(pid+'_')||d.startsWith(pid+'-am_')||d.startsWith(pid+'-pm_')||d.startsWith(pid+'-1_')||d.startsWith(pid+'-2_'))return true;
        // retatrutide legacy: reta-sun_, reta-wed_, reta-
        if(pid==='retatrutide'&&(d.startsWith('reta-')))return true;
        // cjc-ipa legacy: cjc-am_, cjc-pm_
        if(pid==='cjc-ipa'&&(d.startsWith('cjc-am_')||d.startsWith('cjc-pm_')||d.startsWith('cjc_')))return true;
        return false;
      });
      if(hit&&(!earliest||entry.date<earliest))earliest=entry.date;
    });
    if(earliest){var _pp=earliest.split('-');p.start_date=_pp[0]+'-'+(_pp[1]||'1').padStart(2,'0')+'-'+(_pp[2]||'1').padStart(2,'0');changed=true;}
  });
  // Update cycle_start to earliest detected peptide start_date (even if already set, if earlier found)
  var pdates=(active.peptides||[]).map(function(p){return p.start_date;}).filter(Boolean);
  if(pdates.length){
    pdates.sort();
    var _dp=pdates[0].split('-');
    var _earliest=_dp[0]+'-'+(_dp[1]||'1').padStart(2,'0')+'-'+(_dp[2]||'1').padStart(2,'0');
    if(!active.cycle_start||_earliest<active.cycle_start){active.cycle_start=_earliest;changed=true;}
  } else if(!active.cycle_start){
    // Fallback: direct Reta scan
    var rd=window._peptideLog.filter(function(e){return e.doses&&e.doses.some(function(d){return d.startsWith('reta-')||d.startsWith('retatrutide_');});}).map(function(e){return e.date;});
    if(rd.length){rd.sort();var _rp=rd[0].split('-');active.cycle_start=_rp[0]+'-'+(_rp[1]||'1').padStart(2,'0')+'-'+(_rp[2]||'1').padStart(2,'0');changed=true;}
  }
  if(changed){saveStacksToBackend();buildTimeline();}
}
function getPastDoses(d){if(!window._peptideLog)return null;const dk=dateKey(d);const entry=window._peptideLog.find(e=>_normDt(e.date)===dk);return entry?entry.doses.map(_normDoseId):null;}
function buildHistory(){const tab=document.getElementById('tab-history');if(!tab)return;const log=window._peptideLog||[];if(!log.length){tab.innerHTML='<div class="content"><div class="empty"><div class="empty-icon">💊</div>No history yet</div></div>';return;}const days=[...log].reverse();tab.innerHTML='<div class="content">'+days.map(entry=>{const d=new Date(entry.date.replace(/-/g,'/'));const label=d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});const count=entry.doses.length;return'<div class="card" style="margin-bottom:10px"><div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--accent3)"></div><div class="card-title">'+label.toUpperCase()+'</div></div><span class="card-badge badge-done">'+count+' doses</span></div><div class="checklist">'+entry.doses.map(id=>{const name=id.replace(/_\d{4}-\d+-\d+$/,'').replace('glow-1','GLOW Stack').replace('glow-2','GLOW 2nd dose').replace('glow','GLOW Stack').replace('reta-sun','Retatrutide').replace('reta-wed','Retatrutide').replace('retatrutide','Retatrutide').replace('cjc-ipa-am','CJC/IPA AM').replace('cjc-ipa-pm','CJC/IPA PM').replace('cjc-am','CJC/IPA AM').replace('cjc-pm','CJC/IPA PM').replace(/^testo_\d+$/,'Testoviron');return'<div class="check-item checked-item"><div class="check-box checked"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="check-main"><div class="check-name" style="color:var(--accent3)">'+name+'</div></div></div>';}).join('')+'</div></div>';}).join('')+'</div>';}
function resetToday(){Object.keys(_injectionsCache).forEach(function(dk){if(dk===dateKey(NOW)){(_injectionsCache[dk]||[]).forEach(function(e){e.logged=false;});}});buildToday();var todayKey=dateKey(NOW);(_injectionsCache[todayKey]||[]).filter(function(e){return e.active;}).forEach(function(e){fetch(AGENT_URL+'/injections/'+e.id,{method:'PUT',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({logged:false})}).catch(function(err){_logErr('resetToday',err);});});}
async function checkAppVersion(){try{const r=await fetch((IS_STAGING?'https://viritasorg.github.io/peptidetracker-staging':'https://viritasorg.github.io/peptidetracker')+'/version.json?t='+Date.now());if(!r.ok){_logHttp('checkAppVersion',r.status,'/version.json');return;}const {version}=await r.json();const current=VERSION;if(version!==current){const b=document.createElement('div');b.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#1c1c1c;border-top:1px solid var(--accent4);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:400;font-size:13px;';b.innerHTML='<span style="color:var(--text)">New version <strong style="color:var(--accent4)">v'+version+'</strong> available</span><button onclick="window.location.href=location.pathname+&quot;?t=&quot;+Date.now()" style="background:var(--accent4);color:#000;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-ui)">Update</button>';document.body.appendChild(b);}}catch(e){_logErr('checkAppVersion',e);}}
async function checkForUpdate(){const btn=document.getElementById('s-update-btn');if(btn){btn.textContent='Checking…';btn.disabled=true;btn.style.borderColor='var(--border)';btn.style.color='var(--muted2)';}try{const r=await fetch((IS_STAGING?'https://viritasorg.github.io/peptidetracker-staging':'https://viritasorg.github.io/peptidetracker')+'/version.json?t='+Date.now());if(!r.ok)throw new Error('HTTP '+r.status);const {version}=await r.json();if(version===VERSION){if(btn){btn.textContent='Up to date ✓';btn.style.color='var(--accent3)';btn.style.borderColor='var(--accent3)';setTimeout(()=>{btn.textContent='Check';btn.style.color='var(--muted2)';btn.style.borderColor='var(--border)';btn.disabled=false;},2500);}}else{if(btn){btn.textContent='Update to v'+version;btn.style.background='var(--accent4)';btn.style.color='#000';btn.style.border='none';btn.style.borderRadius='20px';btn.disabled=false;btn.onclick=()=>{window.location.href=location.pathname+'?t='+Date.now()};}}}catch(e){if(btn){btn.textContent='Failed';btn.disabled=false;setTimeout(()=>{btn.textContent='Check';},2000);}}}
function showDayInline(date,tileEl){const d=new Date(date);const isToday=d.toDateString()===NOW.toDateString();if(isToday){_viewDate=null;document.querySelectorAll('.week-day').forEach(e=>e.classList.remove('selected-day'));buildToday();return;}if(typeof renderTodaySupplements==='function')renderTodaySupplements(d);const dk=dateKey(d);var doses=_dedupInjectionSlots((_injectionsCache[dk]||[]).filter(function(e){return e.active;}));if(!doses.length){var _pld=getPastDoses(d);if(_pld&&_pld.length){doses=_pld.map(function(doseId){var bid=doseId.substring(0,doseId.lastIndexOf('_'));var inf=_findWeeklyItemInfo(bid);return{id:doseId,compound_id:bid,compound_name:inf?inf.name:bid,dose:'',unit:'',dot:inf?inf.dot:'#888',time_of_day:inf?inf.time:null,logged:true,active:true,tier:'peptide'};});}}const list=document.getElementById('today-checklist');const badge=document.getElementById('today-badge');const label=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase();if(!doses.length){list.innerHTML='<div class="empty"><div class="empty-icon">✓</div>Nothing scheduled</div>';badge.textContent=label;return;}_viewDate=d;if(_syncPending){list.innerHTML='<div class="today-spinner"><div class="today-spinner-dot"></div></div>';badge.textContent=label;badge.className='card-badge badge-today';document.querySelectorAll('.week-day').forEach(function(e){e.classList.remove('selected-day');});if(tileEl)tileEl.classList.add('selected-day');return;}const order=(typeof TIME_RANK!=='undefined')?TIME_RANK:{'AM':0,'null':1,'PM':2};doses.sort(function(a,b){return(order[a.time_of_day]??1)-(order[b.time_of_day]??1);});list.innerHTML='';doses.forEach(function(dose){var isChk=dose.logged;var item=document.createElement('div');item.className='check-item'+(isChk?' checked-item':'');item.onclick=function(){toggleInjection(dose.id,dose.logged);};var box=document.createElement('div');box.className='check-box'+(isChk?' checked':'');box.innerHTML='<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';var main=document.createElement('div');main.className='check-main';var nameEl=document.createElement('div');nameEl.className='check-name';nameEl.style.color=(dose.tier==='trt'?'#e05050':dose.dot);nameEl.textContent=dose.compound_name;var detailEl=document.createElement('div');detailEl.className='check-detail';detailEl.textContent=dose.dose+(dose.unit?' '+(UNIT_LABELS[dose.unit]||dose.unit):'');main.appendChild(nameEl);main.appendChild(detailEl);item.appendChild(box);item.appendChild(main);if(dose.time_of_day){var timeEl=document.createElement('div');timeEl.className='check-time';timeEl.textContent=(typeof _slotLabel==='function')?_slotLabel(dose.time_of_day):dose.time_of_day;item.appendChild(timeEl);}var cId=dose.compound_id;if(dose.tier==='peptide'){var _pc=PEPTIDE_CAT.find(function(c){return c.id===cId;});if(_pc){var _b=document.createElement('button');_b.className='info-btn';_b.textContent='ℹ';(function(_id){_b.onclick=function(e){e.stopPropagation();showPeptideCard(_id);};}(cId));item.appendChild(_b);}}else if(dose.tier==='enhanced'){var _ec=(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===cId;});if(_ec){var _b=document.createElement('button');_b.className='info-btn';_b.textContent='ℹ';(function(_id){_b.onclick=function(e){e.stopPropagation();showEnhancedCard(_id);};}(cId));item.appendChild(_b);}}list.appendChild(item);});badge.textContent=label;badge.className='card-badge badge-upcoming';var titleEl=document.getElementById('today-title');if(titleEl)titleEl.textContent=d.getDate()+'/'+(d.getMonth()+1);document.querySelectorAll('.week-day').forEach(e=>e.classList.remove('selected-day'));if(tileEl)tileEl.classList.add('selected-day');}
function showDayModal(date){const d=new Date(date);const dk=dateKey(d);var doses=_dedupInjectionSlots((_injectionsCache[dk]||[]).filter(function(e){return e.active;}));const order=(typeof TIME_RANK!=='undefined')?TIME_RANK:{'AM':0,'null':1,'PM':2};doses.sort(function(a,b){return(order[a.time_of_day]??1)-(order[b.time_of_day]??1);});const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;';overlay.onclick=e=>{if(e.target===overlay)document.body.removeChild(overlay);};const sheet=document.createElement('div');sheet.style.cssText='background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:80vh;overflow-y:auto;';const rows=doses.length?doses.map(function(dose){return'<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:'+(dose.tier==='trt'?'#e05050':dose.dot)+';flex-shrink:0"></div><div style="flex:1"><div style="font-size:14px;font-weight:500;color:var(--text)">'+dose.compound_name+'</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">'+dose.dose+(dose.unit?' '+(UNIT_LABELS[dose.unit]||dose.unit):'')+'</div></div>'+(dose.time_of_day?'<div style="font-family:var(--font-display);font-size:14px;color:var(--muted2)">'+((typeof _slotLabel==='function')?_slotLabel(dose.time_of_day):dose.time_of_day)+'</div>':'')+'</div>';}).join(''):'<div style="color:var(--muted2);font-size:13px;text-align:center;padding:20px">Nothing scheduled</div>';sheet.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--accent)">'+d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()+'</div><button onclick="document.body.removeChild(this.closest(chr91+chr39+chr115+chr116+chr121+chr108+chr101+chr42+chr61+chr102+chr105+chr120+chr101+chr100+chr39+chr93))" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1">×</button></div>'+rows;overlay.appendChild(sheet);document.body.appendChild(overlay);}

// ── PLASMA Today hero: adherence rings + streak ───────────────────────────────
// Rings measure completion of the plan AS WRITTEN — a dose logged on time closes
// the ring exactly like any other; nothing here can be moved by dosing more.
// refDate params exist for tests (NOW is a const and not reachable from the harness).
function _ringStats(refDate){
  var now=refDate||NOW;var dk=dateKey(now);
  var doses=_dedupInjectionSlots((_injectionsCache[dk]||[]).filter(function(e){return e.active;}));
  var dTot=doses.length,dDone=doses.filter(function(e){return e.logged;}).length;
  var sTot=0,sDone=0;
  if(typeof _supplementsForDay==='function'&&typeof _suppSlots==='function'&&typeof _suppIsTaken==='function'){
    var dstr=_suppDateKey(now);
    _supplementsForDay(now).forEach(function(s){_suppSlots(s.timing).forEach(function(slot){sTot++;if(_suppIsTaken(s.supp_id,dstr,slot))sDone++;});});
  }
  var wTot=0,wDone=0;
  for(var i=0;i<7;i++){var day=new Date(now);day.setDate(day.getDate()-i);var wd=_dedupInjectionSlots((_injectionsCache[dateKey(day)]||[]).filter(function(e){return e.active;}));wTot+=wd.length;wDone+=wd.filter(function(e){return e.logged;}).length;}
  return{dDone:dDone,dTot:dTot,sDone:sDone,sTot:sTot,wDone:wDone,wTot:wTot};
}
// Consecutive fully-logged days. A day with scheduled doses counts when ALL are
// logged and breaks the streak otherwise; an incomplete today is skipped (the day
// is not over yet). Days with nothing scheduled and nothing logged do not break the
// chain (EOD/weekly protocols), but 3 such days in a row end the walk (edge of history).
function _calcDoseStreak(refDate){
  var now=refDate||NOW;var streak=0,gap=0;
  var today=_dedupInjectionSlots((_injectionsCache[dateKey(now)]||[]).filter(function(e){return e.active;}));
  if(today.length&&today.every(function(e){return e.logged;}))streak++;
  for(var i=1;i<=365;i++){
    var day=new Date(now);day.setDate(day.getDate()-i);var dk=dateKey(day);
    var doses=_dedupInjectionSlots((_injectionsCache[dk]||[]).filter(function(e){return e.active;}));
    if(doses.length){
      if(doses.every(function(e){return e.logged;})){streak++;gap=0;}
      else break;
    }else{
      var entry=(window._peptideLog||[]).find(function(en){return _normDt(en.date)===dk&&en.doses&&en.doses.length;});
      if(entry){streak++;gap=0;}
      else{gap++;if(gap>=3)break;}
    }
  }
  return streak;
}
function _ringCircle(r,frac,color){
  var c=2*Math.PI*r;var off=c*(1-Math.max(0,Math.min(1,frac)));
  return '<circle cx="60" cy="60" r="'+r+'" fill="none" style="stroke:var(--surface2)" stroke-width="9"/>'+
         '<circle cx="60" cy="60" r="'+r+'" fill="none" style="stroke:'+color+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/>';
}
function buildTodayRings(){
  var el=document.getElementById('today-rings');if(!el)return;
  if(_syncPending||!_injCacheReady){el.innerHTML='';return;}
  var st=_ringStats();
  if(st.dTot+st.sTot===0){el.innerHTML='';return;}
  var pct=Math.round(100*(st.dDone+st.sDone)/(st.dTot+st.sTot));
  var streak=_calcDoseStreak();
  var svg='<svg width="120" height="120" viewBox="0 0 120 120" style="flex-shrink:0"><g transform="rotate(-90 60 60)">'+
    _ringCircle(50,st.dTot?st.dDone/st.dTot:0,'var(--accent)')+
    _ringCircle(38,st.sTot?st.sDone/st.sTot:0,'var(--teal)')+
    _ringCircle(26,st.wTot?st.wDone/st.wTot:0,'var(--accent4)')+
    '</g><text x="60" y="66" text-anchor="middle" style="fill:var(--text);font-family:var(--font-mono);font-size:17px">'+pct+'%</text></svg>';
  function row(color,label,val){return '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted2);margin-bottom:6px"><span style="width:7px;height:7px;border-radius:50%;background:'+color+';flex-shrink:0"></span>'+label+' <span style="font-family:var(--font-mono);color:var(--text)">'+val+'</span></div>';}
  var leg=row('var(--accent)','Doses',st.dDone+'/'+st.dTot);
  if(st.sTot)leg+=row('var(--teal)','Supplements',st.sDone+'/'+st.sTot);
  if(st.wTot)leg+=row('var(--accent4)','7-day',Math.round(100*st.wDone/st.wTot)+'%');
  var chip=streak>=2?'<div style="margin-top:10px"><span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:20px;color:var(--accent);border:1px solid rgba(232,255,60,0.4);background:rgba(232,255,60,0.08)">\u26a1 '+streak+'-day streak</span></div>':'';
  el.innerHTML='<div class="card"><div class="card-body" style="padding:16px"><div style="display:flex;align-items:center;gap:18px">'+svg+'<div style="flex:1;min-width:0">'+leg+chip+'</div></div></div></div>';
}

// ── Month calendar ───────────────────────────────────────────────────────────
// Henrik, 2026-08-19: "add a card last (to the left in the carousel) that opens a
// new view with a traditional month/day table view. To access historic injections"
//
// The week strip reaches a year back but is still one line — a month grid is how
// you look a date up rather than scroll to it. This view NAVIGATES only: tapping a
// day hands off to showDayInline, which is the one place a dose is rendered and
// ticked. It never renders or edits a dose itself, so there is no second copy of
// that logic to drift.
var _calMonth = null;   // 1st of the month currently shown

// Same dot rules the strip uses: logged doses win, else scheduled-but-unticked
// shown dim, else the legacy peptide log for days the injection cache never held.
function _calDots(d){
  var out = {dots:[], dim:false, logged:false};
  var entries = _injectionsCache[dateKey(d)] || [];
  var dMid = new Date(d); dMid.setHours(0,0,0,0);
  var nMid = new Date(NOW); nMid.setHours(0,0,0,0);
  if(dMid < nMid){
    var logged = entries.filter(function(e){return e.logged;});
    if(logged.length){ out.logged = true; logged.forEach(function(e){out.dots.push(e.dot);}); return out; }
    var act = entries.filter(function(e){return e.active;});
    if(act.length){ out.dim = true; act.forEach(function(e){out.dots.push(e.dot);}); return out; }
    if(!entries.length && typeof getPastDoses === 'function'){
      var pld = getPastDoses(d);
      if(pld){
        var seen = {};
        pld.forEach(function(di){
          var bid = di.substring(0, di.lastIndexOf('_'));
          if(seen[bid]) return;
          seen[bid] = true;
          var inf = (typeof _findWeeklyItemInfo === 'function') ? _findWeeklyItemInfo(bid) : null;
          if(inf && inf.dot) out.dots.push(inf.dot);
        });
        out.logged = out.dots.length > 0;
      }
    }
    return out;
  }
  entries.filter(function(e){return e.active;}).forEach(function(e){out.dots.push(e.dot);});
  return out;
}

function showMonthCalendar(){
  var anchor = _viewDate ? new Date(_viewDate) : new Date(NOW);
  _calMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  var overlay = document.createElement('div');
  overlay.className = 'cal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;';
  overlay.onclick = function(e){ if(e.target === overlay) _calClose(overlay); };
  var sheet = document.createElement('div');
  sheet.className = 'cal-sheet';
  sheet.style.cssText = 'background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto;';
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  _calRender(sheet, overlay);
}

function _calClose(overlay){ if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }

function _calStep(n, sheet, overlay){
  _calMonth = new Date(_calMonth.getFullYear(), _calMonth.getMonth() + n, 1);
  _calRender(sheet, overlay);
}

function _calRender(sheet, overlay){
  sheet.innerHTML = '';
  var y = _calMonth.getFullYear(), m = _calMonth.getMonth();

  var head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px';
  var prev = document.createElement('button');
  prev.textContent = '‹';
  prev.className = 'cal-nav';
  prev.style.cssText = 'background:none;border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:18px;line-height:1;padding:4px 12px;cursor:pointer;font-family:inherit';
  prev.onclick = function(){ _calStep(-1, sheet, overlay); };
  var title = document.createElement('div');
  title.className = 'cal-title';
  title.style.cssText = 'flex:1;text-align:center;font-family:var(--font-display);font-size:18px;letter-spacing:1px;color:var(--accent)';
  title.textContent = _calMonth.toLocaleDateString('en-GB', {month:'long', year:'numeric'}).toUpperCase();
  var next = document.createElement('button');
  next.textContent = '›';
  next.className = 'cal-nav';
  next.style.cssText = prev.style.cssText;
  next.onclick = function(){ _calStep(1, sheet, overlay); };
  var close = document.createElement('button');
  close.textContent = '×';
  close.style.cssText = 'background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1;font-family:inherit';
  close.onclick = function(){ _calClose(overlay); };
  head.appendChild(prev); head.appendChild(title); head.appendChild(next); head.appendChild(close);
  sheet.appendChild(head);

  // Monday-first, per CLAUDE.md — DAYS_ORDER is the iteration order everywhere else.
  var order = (typeof DAYS_ORDER !== 'undefined') ? DAYS_ORDER : [1,2,3,4,5,6,0];
  var names = (typeof DAYS_SHORT !== 'undefined') ? DAYS_SHORT : ['S','M','T','W','T','F','S'];
  var grid = document.createElement('div');
  grid.className = 'cal-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px';
  order.forEach(function(dow){
    var h = document.createElement('div');
    h.className = 'cal-dow';
    h.style.cssText = 'text-align:center;font-size:11px;letter-spacing:1px;color:var(--muted2);padding-bottom:4px';
    h.textContent = names[dow];
    grid.appendChild(h);
  });

  var first = new Date(y, m, 1);
  var lead = order.indexOf(first.getDay());          // blanks before the 1st
  for(var b = 0; b < lead; b++){
    var pad = document.createElement('div');
    pad.className = 'cal-pad';
    grid.appendChild(pad);
  }
  var days = new Date(y, m + 1, 0).getDate();
  var nMid = new Date(NOW); nMid.setHours(0,0,0,0);
  for(var day = 1; day <= days; day++){
    (function(dayNum){
      var d = new Date(y, m, dayNum);
      var info = _calDots(d);
      var isToday = d.toDateString() === NOW.toDateString();
      var cell = document.createElement('div');
      cell.className = 'cal-day' + (isToday ? ' cal-today' : '') + (info.dots.length ? ' cal-has' : '');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;border-radius:8px;cursor:pointer;' +
        'background:var(--surface2);border:1px solid ' + (isToday ? 'var(--accent)' : 'transparent');
      var num = document.createElement('div');
      num.style.cssText = 'font-family:var(--font-mono);font-size:14px;line-height:1;color:' + (isToday ? 'var(--accent)' : 'var(--text)');
      num.textContent = String(dayNum);
      cell.appendChild(num);
      var dots = document.createElement('div');
      dots.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap;justify-content:center;min-height:5px';
      [...new Set(info.dots)].slice(0,3).forEach(function(col){
        var dot = document.createElement('div');
        dot.className = 'cal-dot';
        dot.style.cssText = 'width:4px;height:4px;border-radius:50%;background:' + col + (info.dim ? ';opacity:0.3' : '');
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
      // Hand off to the Today view — it owns rendering and ticking a day's doses.
      cell.onclick = function(){
        _calClose(overlay);
        var btn = document.getElementById('tab-btn-today');
        if(btn && typeof switchTab === 'function') switchTab('today', btn);
        showDayInline(d, null);
      };
      grid.appendChild(cell);
    })(day);
  }
  sheet.appendChild(grid);

  var hint = document.createElement('div');
  hint.className = 'cal-hint';
  hint.style.cssText = 'margin-top:14px;font-size:12px;color:var(--muted2);text-align:center;line-height:1.5';
  hint.textContent = 'Tap a day to open it. Filled dots are logged doses, faded ones were scheduled and not ticked.';
  sheet.appendChild(hint);
}
