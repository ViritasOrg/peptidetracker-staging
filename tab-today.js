// Collapse duplicate injections onto one row per compound+time-of-day slot,
// preferring an already-logged shot. A slot can hold two rows after a dose edit
// (the administered shot is kept and a new planned one was added); the backend now
// prevents new duplicates, this also hides any created before that fix. Mirrors the
// dedup buildSchedule already applies.
// ⚠️ THE KEY MUST INCLUDE THE ORIGIN, OR A REAL DOSE DISAPPEARS.
// This collapses the dose-edit doubling: editing a dose leaves the old row and adds a
// new one for the same compound and slot, so Today showed the compound twice. Keyed on
// compound + slot alone, it ALSO collapsed two genuinely different administrations of
// the same compound in the same slot — and kept only the first.
//
// Reported 2026-09-13: an extra 75 mg Nebido added by hand never appeared in Today. It
// was logged correctly in the backend (cycle_id "manual", source "manual", logged true);
// the protocol's own 100 mg Nebido was already occupying the key "nebido_AM", so the
// manual shot was dropped on the floor. The one place that records what actually went
// into the user silently showed less than they had taken.
//
// cycle_id is the discriminator. Two rows from the SAME protocol for the same compound
// and slot are the doubling this exists to fix, and still collapse. A row from anywhere
// else — a manual entry, a T-Calc plan, a second protocol — is a different
// administration and is never merged away.
// CANONICALISE THE COMPOUND ID IN THE KEY, exactly as the curve does.
// One injection is sometimes stored TWICE — under the Enhanced tier as test_u and under
// TRT as nebido, two rows with different ids. _tcCurveLog has collapsed those since
// 2026-08-15 (counting both doubled the forward curve), but Today keyed on the raw
// compound_id and listed them as two tickable doses. The same day shown as two
// injections on one screen and one on the other is the ONE NUMBER, ONE SOURCE rule
// broken in the pair where it matters most: what the user ticks off, and what the model
// integrates. Only testosterone esters have aliases, so nothing else moves.
//
// Guarded because tab-tcalc.js owns the alias map and script order is not guaranteed;
// the call itself happens at render time, long after every file has loaded.
// ── SCREENSHOT-SAFE NAMES (engine: _safeCompoundName in index.html) ─────────
// Every compound name Today puts on screen goes through here. The setting is off by
// default, in which case this is the identity function. The real name stays on the row
// object — only the pixels change — because _injectionsCache is what gets written back
// to the backend, and a screenshot setting must never reach stored data.
// `id` is what picks the curated joke; the name is only the fallback's input. Pass
// both at every call site — an id-less call silently drops to leetspeak.
function _tdName(n,id){
  return (typeof _safeCompoundName==='function')?_safeCompoundName(n,id):(n==null?'':String(n));
}
function _todayCanonCompId(id){
  return (typeof _tcCanonCompId === 'function') ? _tcCanonCompId(id) : id;
}
// IS THIS ROW A DELIBERATE EXTRA, OR JUST ANOTHER COPY OF THE PLAN?
// That is the only question the key has to answer, and cycle_id answers it wrongly.
// Keyed on cycle_id (2026-09-13, to stop an extra 75 mg Nebido being eaten), TWO
// PROTOCOLS overlapping produced two rows for every shared compound: reported
// 2026-09-14 with protocol_4 and protocol_5 both live, Today listed Glow twice and
// HGH twice in each slot — 8 rows for 5 doses. Two protocols scheduling the same
// compound in the same slot is a TRANSITION, not two injections; the user takes one.
//
// A hand-added dose is the real exception, and it says so in the record: cycle_id
// 'manual', or source 'manual'. Those get their own id in the key, so any number of
// them survive. Everything scheduled by a protocol — whichever protocol, whichever
// version, whichever tier spelling — is one planned dose per compound and slot.
function _todayDoseOrigin(e){
  var manual = (e.cycle_id === 'manual') || (e.source === 'manual');
  return manual ? ('manual:' + (e.id || e.dose || '')) : 'plan';
}
function _dedupInjectionSlots(list){var m={},order=[];(list||[]).forEach(function(e){var k=_todayCanonCompId(e.compound_id)+'_'+(e.time_of_day||'')+'_'+_todayDoseOrigin(e);var c=m[k];if(c===undefined){m[k]=e;order.push(k);}else if(e.logged&&!c.logged){m[k]=e;}});return order.map(function(k){return m[k];});}
// SEVEN DAYS BACK. Briefly 365 (2026-08-17), reverted at Henrik's request on
// 2026-08-19: "Restore the 7 days only carousel." A year of tiles is not how you reach
// an old day — the calendar card at the head of the strip is, and it can go back
// further than a year ever did. Keep this window short.
var WEEK_STRIP_BACK=7,WEEK_STRIP_FWD=6;
function buildWeekStrip(){const strip=document.getElementById('week-strip');strip.innerHTML='';/* The calendar card sits at the far-left end of the strip, where scrolling back runs out: past is to the left, so this is the last card in that direction. With the window back to a week it is the only way to reach an older day. */var _calCard=document.createElement('div');_calCard.className='week-day week-cal';_calCard.style.cursor='pointer';_calCard.onclick=function(){showMonthCalendar();};_calCard.innerHTML='<div class="week-day-name">ALL</div>'+'<div class="week-day-num" style="font-family:inherit;font-size:16px">\u25a6</div>'+'<div class="week-dots"></div>';strip.appendChild(_calCard);const start=new Date(NOW);start.setDate(NOW.getDate()-WEEK_STRIP_BACK);let todayEl=null;const DL=['S','M','T','W','T','F','S'];for(let i=0;i<WEEK_STRIP_BACK+1+WEEK_STRIP_FWD;i++){const d=new Date(start);d.setDate(start.getDate()+i);const dow=d.getDay();const isToday=d.toDateString()===NOW.toDateString();const dk=dateKey(d);var dMid=new Date(d);dMid.setHours(0,0,0,0);var nMid=new Date(NOW);nMid.setHours(0,0,0,0);var isPast=dMid<nMid;var entries=_injectionsCache[dk]||[];var dots=[];var dotsDim=[];if(isPast){var logged=entries.filter(function(e){return e.logged;});if(logged.length){logged.forEach(function(e){dots.push(e.dot);});}else{var _act=entries.filter(function(e){return e.active;});if(_act.length){_act.forEach(function(e){dotsDim.push(e.dot);});}else if(!entries.length){var _pld=getPastDoses(d);if(_pld){var _bSeen={};_pld.forEach(function(di){var bid=di.substring(0,di.lastIndexOf('_'));if(!_bSeen[bid]){_bSeen[bid]=true;var inf=_findWeeklyItemInfo(bid);if(inf&&inf.dot)dots.push(inf.dot);}});}}}}else{entries.filter(function(e){return e.active;}).forEach(function(e){dots.push(e.dot);});}const el=document.createElement('div');el.className='week-day'+(isToday?' today':'');el.style.cursor='pointer';(function(dd,ee){el.onclick=function(){var _tb=document.getElementById('tab-btn-today');if(_tb)switchTab('today',_tb);showDayInline(dd,ee);};})(d,el);var _dotSrc=dots.length?dots:dotsDim;var _dotDim=!dots.length&&dotsDim.length;const dotHtml=[...new Set(_dotSrc)].slice(0,3).map(function(col){return'<div class="week-dot" style="background:'+col+(_dotDim?';opacity:0.3':'')+'"></div>';}).join('');el.innerHTML='<div class="week-day-name">'+DL[dow]+'</div>'+'<div class="week-day-num">'+d.getDate()+'</div>'+'<div class="week-dots">'+dotHtml+'</div>';strip.appendChild(el);if(isToday)todayEl=el;}if(todayEl)strip.scrollLeft=todayEl.offsetLeft-(strip.clientWidth-todayEl.offsetWidth)/2;}
// ── Collapsible Today sections (Henrik, 2026-11-01: "make the sections on Today collapsible,
// keeping meds and supplements minimised as default and injections expanded as default") ──
// The state is for this visit only: every launch opens with injections expanded and the other
// two folded, which is the default asked for.
var _todayOpen={doses:true,meds:false,supps:false};
function todaySecHeader(k,title,dot,done,total){
  return '<div class="card-header" onclick="toggleTodaySec(\''+k+'\')" style="cursor:pointer"><div class="card-title-wrap">'+
    '<span id="today-chev-'+k+'" style="color:var(--muted2);font-size:12px;width:12px;display:inline-block">'+(_todayOpen[k]?'▾':'▸')+'</span>'+
    '<div class="card-dot" style="background:'+dot+'"></div><div class="card-title">'+title+'</div></div>'+
    '<span class="card-badge '+(total&&done===total?'badge-done':'badge-today')+'">'+done+' / '+total+'</span></div>';
}
function todaySecBody(k,inner){return '<div id="today-sec-'+k+'"'+(_todayOpen[k]?'':' style="display:none"')+'>'+inner+'</div>';}
function toggleTodaySec(k){_todayOpen[k]=!_todayOpen[k];var b=document.getElementById('today-sec-'+k);if(b)b.style.display=_todayOpen[k]?'':'none';var c=document.getElementById('today-chev-'+k);if(c)c.textContent=_todayOpen[k]?'▾':'▸';}
function buildToday(){if(typeof buildTodayRings==='function')buildTodayRings();if(typeof buildWhatsNewCard==='function')buildWhatsNewCard();if(typeof renderTodayLogDraw==='function')renderTodayLogDraw();if(typeof renderTodayMeds==='function')renderTodayMeds(NOW);if(typeof renderTodaySupplements==='function')renderTodaySupplements(NOW);const list=document.getElementById('today-checklist');var _tt=document.getElementById('today-title');if(_tt)_tt.textContent="TODAY'S DOSES";const _ci=document.getElementById('today-cycle-info');if(_ci){const _st=_userStacks[_activeStackIndices[0]];const _cs=_st&&_st.cycle_start;/* THE STORED LENGTH, NEVER AN INVENTED ONE. This read `_st.cycle_length||12`, so a protocol with no end date still printed "Week 12 of 12 · Ends <date>" — a cycle nobody had configured, stated as fact. It cost a full misdiagnosis on 2026-08-15: the header was taken as evidence the cycle had ended, and the search went to the wrong protocol entirely. A missing end date is a real state; say it. */const _cl=_st&&_st.cycle_length;if(_cs){const _sd=parseLocalDate(_cs);if(_cl>0){const _ed=new Date(_sd.getTime()+_cl*7*86400000);const _dd=Math.max(0,Math.floor((NOW-_sd)/86400000));const _wk=Math.min(_cl,Math.floor(_dd/7)+1);_ci.textContent='Started '+fmtDate(_sd)+' · Week '+_wk+' of '+_cl+' · Ends '+fmtDate(_ed);}else{const _d2=Math.max(0,Math.floor((NOW-_sd)/86400000));_ci.textContent='Started '+fmtDate(_sd)+' · Week '+(Math.floor(_d2/7)+1)+' · No end date';}}else{_ci.textContent='';}}if(_syncPending||!_injCacheReady){list.innerHTML='<div class="today-spinner"><div class="today-spinner-dot"></div></div>';const _b=document.getElementById('today-badge');if(_b){_b.textContent='...';_b.className='card-badge badge-today';}return;}list.innerHTML='';const alertWrap=document.getElementById('today-alerts');alertWrap.innerHTML='';
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
// TESTOSTERONE NOT SCHEDULED — kept, with the reason rewritten (Phase 5).
// This alert existed because a protocol could hold testosterone that generated nothing:
// the tiers suppressed it and only T-Calc could schedule it. That suppression is gone,
// so the old wording ("scheduled only in T-Calc") would now send the user to a tab that
// no longer schedules anything.
//
// The alert itself stays, because the situation it catches still exists — an ester
// configured with no doses on the calendar, which on 2026-08-15 cost a full day of
// hunting. What changed is the cause: now it means the protocol has not generated yet,
// or its cycle has no start date, and the fix is in Plan ▸ Compounds.
(function(){
  if(!alertWrap)return;
  var _st=_userStacks&&_activeStackIndices&&_activeStackIndices.length?_userStacks[_activeStackIndices[0]]:null;
  if(!_st)return;
  if(typeof _stackTestoComp!=='function'||typeof _stackHasScheduledTrt!=='function')return;
  var _tc=_stackTestoComp(_st);
  if(!_tc)return;                                        // no ester configured — nothing to explain
  var _sid=(typeof _stackCycleId==='function')?_stackCycleId(_st):(_st.id||'');
  if(_stackHasScheduledTrt(_sid))return;                 // it IS scheduled — say nothing
  var _nm=_tdName((_tc.c&&(_tc.c.name||_tc.c.id))||'Testosterone',_tc.c&&_tc.c.id);
  alertWrap.innerHTML='<div onclick="var b=document.getElementById(\'tab-btn-stacks\');if(b)b.click();" style="cursor:pointer;background:rgba(102,136,204,0.08);border:1px solid #6688cc44;border-left:3px solid #6688cc;border-radius:10px;padding:10px 12px;margin-bottom:10px;">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px">'
      +'<div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#6688cc">Testosterone not scheduled</div>'
      +'<div style="font-size:11px;color:#6688cc;flex-shrink:0">Open Plan →</div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--muted2);line-height:1.5">“'+_esc(_nm)+'” is configured in this protocol but has no doses on the calendar. Open it in Plan ▸ Compounds and save to generate them — a protocol with no start date cannot place a schedule on a calendar.</div>'
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
list.innerHTML='<div class="empty"><div class="empty-icon">✓</div>Nothing scheduled today</div>';}}document.getElementById('today-badge').textContent='—';return;}const order=(typeof TIME_RANK!=='undefined')?TIME_RANK:{'AM':0,'null':1,'PM':2};doses.sort(function(a,b){return(order[a.time_of_day]??1)-(order[b.time_of_day]??1);});var done=0;doses.forEach(function(dose){var isChk=dose.logged;if(isChk)done++;var item=document.createElement('div');item.className='check-item'+(isChk?' checked-item':'');var box=document.createElement('div');box.className='check-box'+(isChk?' checked':'');box.innerHTML='<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';var main=document.createElement('div');main.className='check-main';var nameEl=document.createElement('div');nameEl.className='check-name';nameEl.style.color=(dose.tier==='trt'?'#e05050':dose.dot);nameEl.textContent=_tdName(dose.compound_name,dose.compound_id);var detailEl=document.createElement('div');detailEl.className='check-detail';var _ml=_todayDrawMl(dose);detailEl.textContent=dose.dose+(dose.unit?' '+(UNIT_LABELS[dose.unit]||dose.unit):'')+(_ml?(' · '+_ml+' ml'):'');_todayDoseCell(detailEl,dose);main.appendChild(nameEl);main.appendChild(detailEl);item.appendChild(box);item.appendChild(main);_todayTimeCell(item,dose);/* WHERE THE NEEDLE WENT. Oils only — see _injSiteApplies, which returns false for a
   peptide (subcutaneous, no rotation) and for a tablet. Appended before the compound's
   info button so every row reads [dose] [site] [info]. */if(typeof _injSiteButton==='function'){var _sbtn=_injSiteButton(dose);if(_sbtn)item.appendChild(_sbtn);}item.onclick=function(){_todayRowTap(dose);};var cId=dose.compound_id;if(dose.tier==='peptide'){var _pcp=PEPTIDE_CAT.find(function(c){return c.id===cId;});if(_pcp){var _bib=document.createElement('button');_bib.className='info-btn';_bib.textContent='ℹ';(function(_id){_bib.onclick=function(e){e.stopPropagation();showPeptideCard(_id);};}(cId));item.appendChild(_bib);}}else if(dose.tier==='enhanced'){var _ece=(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===cId;});if(_ece){var _bib=document.createElement('button');_bib.className='info-btn';_bib.textContent='ℹ';(function(_id){_bib.onclick=function(e){e.stopPropagation();showEnhancedCard(_id);};}(cId));item.appendChild(_bib);}}else if(dose.tier==='trt'){/* ⚠️ THE THIRD TIER. This branched peptide/enhanced and stopped, so a testosterone row sat between two compounds that had an ℹ and had none itself — the tier-parity break CLAUDE.md names outright. */var _tci=(typeof TRT_GUIDE!=='undefined'&&TRT_GUIDE[cId])||((typeof TRT_CAT!=='undefined')&&TRT_CAT.find(function(c){return c.id===cId;}));if(_tci&&typeof showTrtCard==='function'){var _bib=document.createElement('button');_bib.className='info-btn';_bib.textContent='ℹ';(function(_id){_bib.onclick=function(e){e.stopPropagation();showTrtCard(_id);};}(cId));item.appendChild(_bib);}}list.appendChild(item);});const badge=document.getElementById('today-badge');badge.textContent=done+' / '+doses.length;badge.className='card-badge '+(done===doses.length?'badge-done':'badge-today');}
// ── The time column, in one place ────────────────────────────────────────────
// Today and the day-inline view build the same checklist from the same rows and
// used to carry their own copy of this cell. They render it from here now, so the
// two cannot drift — a dose must not show its time on one screen and its slot on
// the other.
//
// An untaken dose shows the plan's slot (AM/MID/PM), exactly as before: it has no
// administration time, because it has not been administered. A taken one shows the
// clock time it went in once there is one, and is tappable to set or correct it.
function _injClockLabel(stamp){
  var m=/T(\d{2}):(\d{2})/.exec(String(stamp||''));
  return m?(m[1]+':'+m[2]):'';
}
// ── WHAT TO DRAW, NOT JUST WHAT TO GIVE ─────────────────────────────────────
// Henrik, 2026-09-17: "Also add ml to draw and inject after the mg in the today view."
//
// A milligram figure is the prescription; a millilitre figure is the instruction. The
// row said "125 mg" and left the arithmetic — at which strength? — to be done at the
// fridge, every time, on the one screen that exists to be followed rather than read.
//
// ⚠️ ONLY WHERE THE CONCENTRATION IS KNOWN, NEVER GUESSED. TRT_CAT's `conc` array is
// the list of strengths a compound is SOLD in, so deriving a volume from it would be a
// number that looks exact and is not — the worst kind on a dosing screen. The TRT tier
// reads the vial the solve was applied at, stored on the compound; the enhanced tier
// reads pack.conc_mg_ml, which is real data about a real vial. Anything else — a
// peptide already dosed in ml or IU, a tablet, a compound whose strength nobody has
// told us — shows nothing, which is the honest output.
function _todayDrawMl(dose){
  if(!dose||String(dose.unit||'')!=='mg')return null;
  var id=dose.compound_id, conc=0;
  if(dose.tier==='trt'){
    // The vial this compound's plan was solved at, from whichever active stack holds it.
    (typeof _activeStackIndices!=='undefined'?(_activeStackIndices||[]):[]).forEach(function(si){
      var st=(typeof _userStacks!=='undefined')?_userStacks[si]:null;
      if(!st||!st.trt||conc)return;
      var f=(st.trt.compounds||[]).find(function(c){return c.id===id;});
      if(f&&parseDec(f.conc_mg_ml)>0)conc=parseDec(f.conc_mg_ml);
    });
    // Nothing stored — this compound's plan predates the vial being remembered, or the
    // dose was typed by hand. _trtDefaultConc is not a coin toss: it is the very figure
    // the solver panel opens at, so it is the strength these milligrams were worked out
    // AT for anything the app planned. The info card names it, so the assumption is
    // readable rather than buried in a division.
    if(!conc&&typeof _trtDefaultConc==='function')conc=_trtDefaultConc(id)||0;
  }else if(dose.tier==='enhanced'){
    if(typeof _enhConcMgPerMl==='function')conc=_enhConcMgPerMl(id)||0;
  }
  if(!(conc>0))return null;
  var mg=parseDec(dose.dose);
  if(!(mg>0))return null;
  return Math.round((mg/conc)*100)/100;
}
function _todayTimeCell(item, dose){
  var clock=dose.logged?_injClockLabel(dose.logged_at):'';
  if(!clock && !dose.time_of_day) return;
  var timeEl=document.createElement('div');
  timeEl.className='check-time';
  timeEl.textContent=clock||((typeof _slotLabel==='function')?_slotLabel(dose.time_of_day):dose.time_of_day);
  // Editable only for a taken dose that is a real stored row. The fallback rows
  // showDayInline builds from the legacy peptide log carry synthetic ids and no
  // cycle_id — there is no record row behind them to PUT to, and offering an edit
  // that silently 404s is worse than offering none.
  if(dose.logged && dose.id && dose.cycle_id){
    timeEl.className='check-time check-time-set';
    timeEl.title = clock ? 'Edit the time this dose was taken'
                         : 'Set the time this dose was taken';
    timeEl.onclick=function(ev){ ev.stopPropagation(); openInjectionTimeEditor(dose.id); };
  }
  item.appendChild(timeEl);
}

// ── Correcting when a dose was taken ─────────────────────────────────────────
// The tick stamps the moment you tick, which is the right default and the wrong
// record for a dose ticked the next morning, or for one entered days later. So the
// stamp is editable, and a row logged before the app kept one can be given a time.
//
// Only the TIME moves. The date stays the plan's: changing that would be moving the
// dose to another day rather than annotating it — a different operation, with
// consequences for the schedule, the curve and the overlap rules that an edit field
// tucked into a checklist row has no business having.
//
// No _tcFetchHistory re-read here, deliberately, and not by omission. That forced
// re-read exists because ticking moves a dose between the plan and the history (see
// the note in toggleInjection); `logged` does not change here, so nothing the curve
// reads changes, and the curve bins by day regardless.
var _injTimeEditId=null;
var _injDoseEditId=null;
function _findCachedInjection(id){
  var found=null;
  Object.keys(_injectionsCache).forEach(function(dk){
    (_injectionsCache[dk]||[]).forEach(function(e){ if(e.id===id) found=e; });
  });
  return found;
}
function _closeInjectionTimeEditor(){
  var o=document.getElementById('inj-time-modal');
  if(o) o.remove();
  _injTimeEditId=null;
}
function openInjectionTimeEditor(id){
  var row=_findCachedInjection(id);
  if(!row || !row.logged) return;
  _injTimeEditId=id;
  var clock=_injClockLabel(row.logged_at);
  var name=_tdName(row.compound_name||row.compound_id,row.compound_id)||'This dose';
  var amount=(row.dose||'')+(row.unit?' '+((typeof UNIT_LABELS!=='undefined'&&UNIT_LABELS[row.unit])||row.unit):'');
  var btn='display:block;width:100%;padding:12px 14px;border-radius:10px;border:none;font-size:13px;font-weight:800;letter-spacing:0.4px;cursor:pointer;margin-bottom:10px;text-align:center;font-family:inherit;';
  var o=document.createElement('div');
  o.id='inj-time-modal';
  o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px 16px 40px;';
  o.innerHTML='<div style="max-width:420px;margin:20px auto 0;background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden">'
    +'<div style="padding:16px 18px;border-bottom:1px solid var(--border)">'
    +'<div style="font-size:16px;font-weight:800;color:var(--text)">Time taken</div>'
    +'<div style="font-size:12px;color:var(--muted2);margin-top:3px">'+_esc(name)
      +(amount?' &middot; '+_esc(amount):'')+' &middot; '+_esc(row.date||'')+'</div>'
    +'</div>'
    +'<div style="padding:16px 18px">'
    +'<div style="font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:12px">'
    +(clock?'This is when you ticked the dose. Change it to when the injection actually went in.'
           :'No time was recorded for this dose &mdash; it was ticked before the app kept one. Set it if you remember.')
    +'</div>'
    +'<input id="inj-time-input" type="time" value="'+_esc(clock)+'" '
    +'style="width:100%;box-sizing:border-box;background:var(--surface2);color:var(--text);'
    +'border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-size:18px;'
    +'font-family:var(--font-mono);margin-bottom:14px">'
    +'<button onclick="saveInjectionTime()" style="'+btn+'background:var(--accent);color:#000">SAVE</button>'
    +(clock?'<button onclick="clearInjectionTime()" style="'+btn+'background:var(--surface2);color:var(--muted2);border:1px solid var(--border)">CLEAR TIME</button>':'')
    +'<button onclick="_closeInjectionTimeEditor()" style="'+btn+'background:var(--surface2);color:var(--text);border:1px solid var(--border)">CANCEL</button>'
    +'</div></div>';
  document.body.appendChild(o);
}
// Read the field BEFORE closing — the close removes the input from the document.
async function saveInjectionTime(){
  var id=_injTimeEditId;
  var inp=document.getElementById('inj-time-input');
  var v=inp?String(inp.value||''):'';
  _closeInjectionTimeEditor();
  if(id) await _setInjectionTime(id, v);
}
// iOS gives no way to empty a native time wheel, so clearing needs its own button.
async function clearInjectionTime(){
  var id=_injTimeEditId;
  _closeInjectionTimeEditor();
  if(id) await _setInjectionTime(id, '');
}
async function _setInjectionTime(id, hhmm){
  var row=_findCachedInjection(id);
  if(!row) return;
  var stamp=null;
  if(hhmm){
    var t=String(hhmm).split(':'), d=String(row.date||'').split('-');
    if(d.length===3){
      // Built on the DOSE's date, not today's, so _injLoggedStamp reads the UTC
      // offset that was in force on that day rather than the one in force now.
      stamp=_injLoggedStamp(new Date(+d[0], +d[1]-1, +d[2],
                                     parseInt(t[0],10)||0, parseInt(t[1],10)||0, 0));
    }
  }
  var prev=(row.logged_at===undefined)?null:row.logged_at;
  var redraw=function(){
    if(_viewDate){ showDayInline(_viewDate, document.querySelector('.week-day.selected-day')); }
    else { buildToday(); }
  };
  row.logged_at=stamp;
  redraw();
  try{
    var r=await fetch(AGENT_URL+'/injections/'+id,{method:'PUT',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({logged_at:stamp})});
    if(!r.ok){
      _logHttp('injTime', r.status, '/injections/'+id);
      row.logged_at=prev; redraw();
    }
  }catch(e){
    _logErr('injTime', e);
    row.logged_at=prev; redraw();
  }
}
// ── TAPPING AN OIL ROW ASKS WHERE IT WENT ────────────────────────────────────
// Henrik, 2026-10-10: "when I click "Big Earn" (or any oil injection) instead of
// checking the box, bring up the injection location view and have the user click
// where he injected, then close the view and check the box. Ie clicking the
// injection site is what checks off that injection."
// So on an UNLOGGED oil row the tap opens the picker in log mode, and the site tap
// is what ticks it. Closing the picker without a site logs nothing. Unticking a
// logged row stays one tap — it records nothing new, so there is nothing to ask.
// Everything else (peptides, tablets) toggles exactly as before.
function _todayRowTap(dose){
  if(!dose.logged&&typeof _injSiteApplies==='function'&&_injSiteApplies(dose)
     &&typeof openInjSitePicker==='function'&&openInjSitePicker(dose.id,{logOnPick:true})) return;
  toggleInjection(dose.id,dose.logged);
}
// ── WHERE THE NEEDLE WENT ────────────────────────────────────────────────────
// The picker UI lives in inj-site.js; the WRITE lives here, with the tick, the
// time and the dose. One module owns every injection write (docs/unified-plan-
// rewrite.md §3.2) and Today's PUT is the documented exception to it, because it
// records an event that already happened rather than planning one. A site is that
// same kind of record, so it goes through the same door rather than opening a new.
// ⚠️ OPTIMISTIC, WITH A REAL ROLLBACK, exactly like _setInjectionTime. The row is
// updated and redrawn first so the tap feels instant; if the PUT fails the previous
// value goes back and the list redraws, rather than the screen claiming a site the
// backend never stored.
async function _setInjectionSite(id, site){
  var row=_findCachedInjection(id);
  if(!row) return;
  var prev=(row.site===undefined)?null:row.site;
  var redraw=function(){
    if(_viewDate){ showDayInline(_viewDate, document.querySelector('.week-day.selected-day')); }
    else { buildToday(); }
  };
  row.site=site;
  redraw();
  try{
    var r=await fetch(AGENT_URL+'/injections/'+id,{method:'PUT',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({site:site})});
    if(!r.ok){
      _logHttp('injSite', r.status, '/injections/'+id);
      row.site=prev; redraw();
    }
  }catch(e){
    _logErr('injSite', e);
    row.site=prev; redraw();
  }
}
// ── When a dose was actually administered ────────────────────────────────────
// `date` is a local calendar day and `time_of_day` is a slot — AM/MID/PM — so
// until now the record said WHICH DAY a dose was taken and never WHEN. The
// backend has carried a `logged_at` field since the schema was written
// (routers/injections.py, InjectionEntry and PatchPayload) and nothing has ever
// populated it: of the 57 logged rows in the first half of September 2026, 0 had
// a timestamp. A field the writer never fills is not a record, it is a promise.
//
// The tick writes one now. Local time with the offset spelled out, not UTC: the
// day a dose belongs to is the LOCAL day, and a bare UTC instant read back from
// another timezone or the other side of a DST change disagrees with the `date`
// sitting next to it.
//
// ⚠️ THE CURVE STILL WORKS IN WHOLE DAYS. T-Calc bins every dose by `date` and
// nothing here changes that. At the ester half-lives this app models — Nebido
// ~56 d, enanthate ~4.5 d — a few hours is far inside the uncertainty of the
// anchor blood draw, so consuming this field in the PK model would imply a
// precision the inputs do not have. It is a record for the user, and for
// compounds where timing genuinely matters (a short propionate, a GH schedule),
// not a model input. If the curve is ever given sub-day resolution that must be
// a deliberate change with its own justification — not a silent consequence of
// the field finally having values in it.
// ⚠️ A BACK-FILLED DOSE IS STAMPED ON ITS OWN DAY, NOT ON THE DAY IT WAS TICKED.
// Henrik, 2026-09-16: "Back filling doses must work, suggest using the AM/PM setting to
// just fabricate a time and still allow edit if needed (uncommon)."
//
// The first cut of logged_at called _injLoggedStamp() with no argument — the wall clock
// at the moment of the tick. For today's doses that is exactly right and it is what this
// still does. For a dose ticked days later it is wrong in the worst way available: the
// stamp's DATE half then disagrees with the row's own `date`, so the record says a dose
// dated the 14th was administered on the 16th. Two fields, one event, contradicting each
// other — which is the thing the whole `logged_at` note in this file is about.
//
// So a dose ticked on any other day is stamped on ITS date, at the hour its slot stands
// for. That is a fabricated clock time and it is not pretending otherwise: it is
// accurate to the slot the user planned it in, which is the only timing information that
// exists for a dose nobody wrote a time down for, and it is editable afterwards
// (openInjectionTimeEditor) for the uncommon case where the real time is known and
// matters. A whole-hour stamp is the tell — real ticks land on arbitrary seconds.
//
// A slot-less dose gets midday: it says "this day, time unknown" without claiming a
// morning or an evening the record cannot support.
var _INJ_SLOT_HOUR = {AM: 8, MID: 13, PM: 20};
function _injStampFor(entry){
  var today = (typeof dateKey === 'function' && typeof NOW !== 'undefined') ? dateKey(NOW) : '';
  if(!entry || !entry.date || entry.date === today) return _injLoggedStamp();
  var p = String(entry.date).split('-');
  if(p.length !== 3) return _injLoggedStamp();
  var h = _INJ_SLOT_HOUR[entry.time_of_day];
  return _injLoggedStamp(new Date(+p[0], (+p[1]) - 1, +p[2], (h == null ? 12 : h), 0, 0));
}
function _injLoggedStamp(d){
  var t=d||new Date();
  function p(n){return (n<10?'0':'')+n;}
  var off=-t.getTimezoneOffset(), sign=(off<0?'-':'+'), a=Math.abs(off);
  return t.getFullYear()+'-'+p(t.getMonth()+1)+'-'+p(t.getDate())
    +'T'+p(t.getHours())+':'+p(t.getMinutes())+':'+p(t.getSeconds())
    +sign+p(Math.floor(a/60))+':'+p(a%60);
}
async function toggleInjection(id,currentLogged){var newLogged=!currentLogged;var _row=null;Object.keys(_injectionsCache).forEach(function(dk){(_injectionsCache[dk]||[]).forEach(function(e){if(e.id===id)_row=e;});});var _prevAt,_stamp=newLogged?_injStampFor(_row):null;var _wrote=false;Object.keys(_injectionsCache).forEach(function(dk){(_injectionsCache[dk]||[]).forEach(function(e){if(e.id===id){if(_prevAt===undefined)_prevAt=(e.logged_at||null);e.logged=newLogged;e.logged_at=_stamp;}});});if(typeof _tlNoteInjection==='function')_tlNoteInjection(id,newLogged);if(_viewDate){var activeTile=document.querySelector('.week-day.selected-day');showDayInline(_viewDate,activeTile);}else{buildToday();}buildWeekStrip();try{var r=await fetch(AGENT_URL+'/injections/'+id,{method:'PUT',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({logged:newLogged,logged_at:_stamp})});if(r&&r.ok)_wrote=true;if(!r.ok){_logHttp('toggleInj',r.status,'/injections/'+id);Object.keys(_injectionsCache).forEach(function(dk){(_injectionsCache[dk]||[]).forEach(function(e){if(e.id===id){e.logged=currentLogged;e.logged_at=(_prevAt===undefined?null:_prevAt);}});});if(typeof _tlNoteInjection==='function')_tlNoteInjection(id,currentLogged);if(_viewDate){var activeTile=document.querySelector('.week-day.selected-day');showDayInline(_viewDate,activeTile);}else{buildToday();}}else if(typeof _tcFetchHistory==='function'){/* THE RECORD CHANGED — RE-READ IT, DO NOT GUESS. _tcHistory is fetched once per session: _tcFetchHistory returns early on a warm cache and buildTCalc only calls it while the state is 'idle'. Every other source the curve rests on (_injectionsCache, _tcp.manualLog) is rebuilt from the backend on each refresh, so the moment a logged flag changes here the two disagree for the rest of the session. Ticking moved a dose out of the plan without moving it into the history (_tcProtocolInjections and _tcLoadLogFromStack both skip logged rows) and the curve LOST it; unticking left it in the history after it had left the record and the curve KEPT it. Display-only and cleared on restart, which is what made it hard to place: six unticks left the curve frozen at 31 doses / first 16 Jul / peak 1225 pmol/L against a true 25 / 28 Jul / 1018 (2026-08-15). Forced, because the cache is warm by definition at this point. _tcFetchHistory ends in buildTCalc(), so the redraw comes with it; only the success path needs this — a failed PUT left the record untouched and the rollback below restores the cache. */await _tcFetchHistory(true);}}catch(e){_logErr('toggleInj',e);/* ⚠️ ONLY UNDO A WRITE THAT DID NOT LAND. The PUT is awaited, but so is the _tcFetchHistory re-read that follows it on the success path — and that runs the whole curve rebuild. A throw ANYWHERE in there used to land here and roll the tick back, so a dose that was saved correctly appeared to un-tick itself: tap, blink, gone, with the server holding the opposite of what the screen showed until the next reload. Reported 2026-09-16 as "they just blink". The rollback exists for a failed write, and a failed re-read is not one. */if(!_wrote){Object.keys(_injectionsCache).forEach(function(dk){(_injectionsCache[dk]||[]).forEach(function(e){if(e.id===id){e.logged=currentLogged;e.logged_at=(_prevAt===undefined?null:_prevAt);}});});if(typeof _tlNoteInjection==='function')_tlNoteInjection(id,currentLogged);}if(_viewDate){var _rt=document.querySelector('.week-day.selected-day');showDayInline(_viewDate,_rt);}else{buildToday();}}}
async function syncPeptideLogFromAgent(){try{const r=await fetch(AGENT_URL+'/peptide-log',{headers:authHeaders()});if(!r.ok){_syncPending=false;buildToday();return;}window._peptideLog=await r.json();
  window._peptideLog.forEach(function(entry){
    if(!entry.doses)return;
    localStorage.setItem('proto-chk-'+entry.date,JSON.stringify(entry.doses));
  });
  _syncPending=false;buildWeekStrip();buildToday();if(_viewDate){var _at=document.querySelector('.week-day.selected-day');showDayInline(_viewDate,_at);}buildHistory();detectCycleStart();obInit();}catch(e){_syncPending=false;buildToday();obInit();}}
// ⚠️ THIS IS ONBOARDING ARCHAEOLOGY. IT MAY FILL A BLANK; IT MAY NEVER OVERRULE THE USER.
// Reported 2026-09-14, twice in prod: "Start date for protocols change to 18th of May by
// itself????" Protocol 5 was created to run from 15 Sep and its Plan card read
// 18 May 2026 while its own injections began 14 Sep.
//
// This function exists to date a protocol carried over from the legacy peptide log, where
// the only evidence of when something started is the doses themselves. It ran on every
// peptide-log sync, and its last step moved cycle_start backwards to the earliest peptide
// dose it could find — explicitly "even if already set".
//
// So any NEW protocol containing a peptide the user has taken before was back-dated to
// the first time they ever took it — Glow and Retatrutide going back to May — and
// saveStacksToBackend() then persisted it. A start date is a user decision. Nothing
// inferred from a log may move one that has been set.
//
// Both halves are fixed: cycle_start is only ever FILLED, never moved, and a peptide's
// start_date is only backfilled from a dose that falls inside the protocol's own window.
// A dose from before the protocol began is not this protocol's dose.
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
    if(earliest){
      var _pp=earliest.split('-');
      var _norm=_pp[0]+'-'+(_pp[1]||'1').padStart(2,'0')+'-'+(_pp[2]||'1').padStart(2,'0');
      // A dose taken before this protocol started belongs to whatever came before it.
      if(active.cycle_start&&_norm<active.cycle_start)return;
      p.start_date=_norm;changed=true;
    }
  });
  // FILL ONLY. The line here used to move an existing cycle_start backwards whenever an
  // earlier peptide dose turned up — see the note on this function. It is the reported bug.
  if(!active.cycle_start){
    var pdates=(active.peptides||[]).map(function(p){return p.start_date;}).filter(Boolean);
    if(pdates.length){
      pdates.sort();
      var _dp=pdates[0].split('-');
      active.cycle_start=_dp[0]+'-'+(_dp[1]||'1').padStart(2,'0')+'-'+(_dp[2]||'1').padStart(2,'0');
      changed=true;
    }
  }
  if(!active.cycle_start){
    // Fallback: direct Reta scan
    var rd=window._peptideLog.filter(function(e){return e.doses&&e.doses.some(function(d){return d.startsWith('reta-')||d.startsWith('retatrutide_');});}).map(function(e){return e.date;});
    if(rd.length){rd.sort();var _rp=rd[0].split('-');active.cycle_start=_rp[0]+'-'+(_rp[1]||'1').padStart(2,'0')+'-'+(_rp[2]||'1').padStart(2,'0');changed=true;}
  }
  if(changed){saveStacksToBackend();buildTimeline();}
}
function getPastDoses(d){if(!window._peptideLog)return null;const dk=dateKey(d);const entry=window._peptideLog.find(e=>_normDt(e.date)===dk);return entry?entry.doses.map(_normDoseId):null;}
function buildHistory(){const tab=document.getElementById('tab-history');if(!tab)return;const log=window._peptideLog||[];if(!log.length){tab.innerHTML='<div class="content"><div class="empty"><div class="empty-icon">💊</div>No history yet</div></div>';return;}const days=[...log].reverse();tab.innerHTML='<div class="content">'+days.map(entry=>{const d=new Date(entry.date.replace(/-/g,'/'));const label=d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});const count=entry.doses.length;return'<div class="card" style="margin-bottom:10px"><div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--accent3)"></div><div class="card-title">'+label.toUpperCase()+'</div></div><span class="card-badge badge-done">'+count+' doses</span></div><div class="checklist">'+entry.doses.map(id=>{const name=id.replace(/_\d{4}-\d+-\d+$/,'').replace('glow-1','GLOW Stack').replace('glow-2','GLOW 2nd dose').replace('glow','GLOW Stack').replace('reta-sun','Retatrutide').replace('reta-wed','Retatrutide').replace('retatrutide','Retatrutide').replace('cjc-ipa-am','CJC/IPA AM').replace('cjc-ipa-pm','CJC/IPA PM').replace('cjc-am','CJC/IPA AM').replace('cjc-pm','CJC/IPA PM').replace(/^testo_\d+$/,'Testoviron');return'<div class="check-item checked-item"><div class="check-box checked"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="check-main"><div class="check-name" style="color:var(--accent3)">'+name+'</div></div></div>';}).join('')+'</div></div>';}).join('')+'</div>';}
function resetToday(){Object.keys(_injectionsCache).forEach(function(dk){if(dk===dateKey(NOW)){(_injectionsCache[dk]||[]).forEach(function(e){e.logged=false;e.logged_at=null;if(typeof _tlNoteInjection==='function')_tlNoteInjection(e.id,false);});}});buildToday();var todayKey=dateKey(NOW);(_injectionsCache[todayKey]||[]).filter(function(e){return e.active;}).forEach(function(e){fetch(AGENT_URL+'/injections/'+e.id,{method:'PUT',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({logged:false,logged_at:null})}).catch(function(err){_logErr('resetToday',err);});});}
// Surface an available update where the user goes to look for one: the Version row
// in Settings. Same target and same action as the Check button next to it, so a
// version found on load and a version found by pressing Check land identically.
function _markUpdateAvailable(version){
  var btn=document.getElementById('s-update-btn');
  if(!btn)return;
  btn.textContent='Update to v'+version;
  btn.style.background='var(--accent4)';btn.style.color='#000';
  btn.style.border='none';btn.style.borderRadius='20px';btn.disabled=false;
  btn.onclick=function(){window.location.href=location.pathname+'?t='+Date.now();};
}
async function checkAppVersion(){try{const r=await fetch((IS_STAGING?'https://viritasorg.github.io/peptidetracker-staging':'https://viritasorg.github.io/peptidetracker')+'/version.json?t='+Date.now());if(!r.ok){_logHttp('checkAppVersion',r.status,'/version.json');return;}const {version}=await r.json();const current=VERSION;if(version!==current){/* NO BOTTOM BANNER. Henrik, 2026-08-19: "Remove the bottom of screen banners, they block navigation menu in apps. Also stuff like this should already live in Settings" — a fixed bar at bottom:0 sits on top of .navbar, which is also at bottom:0 and a lower z-index, so the app's own navigation was unreachable behind it. Settings already carries the version row and its Check button; a detected update marks THAT, and nothing covers the navbar. */_markUpdateAvailable(version);}}catch(e){_logErr('checkAppVersion',e);}}
async function checkForUpdate(){const btn=document.getElementById('s-update-btn');if(btn){btn.textContent='Checking…';btn.disabled=true;btn.style.borderColor='var(--border)';btn.style.color='var(--muted2)';}try{const r=await fetch((IS_STAGING?'https://viritasorg.github.io/peptidetracker-staging':'https://viritasorg.github.io/peptidetracker')+'/version.json?t='+Date.now());if(!r.ok)throw new Error('HTTP '+r.status);const {version}=await r.json();if(version===VERSION){if(btn){btn.textContent='Up to date ✓';btn.style.color='var(--accent3)';btn.style.borderColor='var(--accent3)';setTimeout(()=>{btn.textContent='Check';btn.style.color='var(--muted2)';btn.style.borderColor='var(--border)';btn.disabled=false;},2500);}}else{if(btn){btn.textContent='Update to v'+version;btn.style.background='var(--accent4)';btn.style.color='#000';btn.style.border='none';btn.style.borderRadius='20px';btn.disabled=false;btn.onclick=()=>{window.location.href=location.pathname+'?t='+Date.now()};}}}catch(e){if(btn){btn.textContent='Failed';btn.disabled=false;setTimeout(()=>{btn.textContent='Check';},2000);}}}
function showDayInline(date,tileEl){const d=new Date(date);const isToday=d.toDateString()===NOW.toDateString();if(isToday){_viewDate=null;document.querySelectorAll('.week-day').forEach(e=>e.classList.remove('selected-day'));buildToday();return;}if(typeof renderTodaySupplements==='function')renderTodaySupplements(d);const dk=dateKey(d);var doses=_dedupInjectionSlots((_injectionsCache[dk]||[]).filter(function(e){return e.active;}));if(!doses.length){var _pld=getPastDoses(d);if(_pld&&_pld.length){doses=_pld.map(function(doseId){var bid=doseId.substring(0,doseId.lastIndexOf('_'));var inf=_findWeeklyItemInfo(bid);return{id:doseId,compound_id:bid,compound_name:inf?inf.name:bid,dose:'',unit:'',dot:inf?inf.dot:'#888',time_of_day:inf?inf.time:null,logged:true,active:true,tier:'peptide'};});}}const list=document.getElementById('today-checklist');const badge=document.getElementById('today-badge');const label=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase();if(!doses.length){list.innerHTML='<div class="empty"><div class="empty-icon">✓</div>Nothing scheduled</div>';badge.textContent=label;return;}_viewDate=d;if(_syncPending){list.innerHTML='<div class="today-spinner"><div class="today-spinner-dot"></div></div>';badge.textContent=label;badge.className='card-badge badge-today';document.querySelectorAll('.week-day').forEach(function(e){e.classList.remove('selected-day');});if(tileEl)tileEl.classList.add('selected-day');return;}const order=(typeof TIME_RANK!=='undefined')?TIME_RANK:{'AM':0,'null':1,'PM':2};doses.sort(function(a,b){return(order[a.time_of_day]??1)-(order[b.time_of_day]??1);});list.innerHTML='';doses.forEach(function(dose){var isChk=dose.logged;var item=document.createElement('div');item.className='check-item'+(isChk?' checked-item':'');item.onclick=function(){_todayRowTap(dose);};var box=document.createElement('div');box.className='check-box'+(isChk?' checked':'');box.innerHTML='<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';var main=document.createElement('div');main.className='check-main';var nameEl=document.createElement('div');nameEl.className='check-name';nameEl.style.color=(dose.tier==='trt'?'#e05050':dose.dot);nameEl.textContent=_tdName(dose.compound_name,dose.compound_id);var detailEl=document.createElement('div');detailEl.className='check-detail';var _ml=_todayDrawMl(dose);detailEl.textContent=dose.dose+(dose.unit?' '+(UNIT_LABELS[dose.unit]||dose.unit):'')+(_ml?(' · '+_ml+' ml'):'');_todayDoseCell(detailEl,dose);main.appendChild(nameEl);main.appendChild(detailEl);item.appendChild(box);item.appendChild(main);_todayTimeCell(item,dose);/* WHERE THE NEEDLE WENT. Oils only — see _injSiteApplies, which returns false for a
   peptide (subcutaneous, no rotation) and for a tablet. Appended before the compound's
   info button so every row reads [dose] [site] [info]. */if(typeof _injSiteButton==='function'){var _sbtn=_injSiteButton(dose);if(_sbtn)item.appendChild(_sbtn);}var cId=dose.compound_id;if(dose.tier==='peptide'){var _pc=PEPTIDE_CAT.find(function(c){return c.id===cId;});if(_pc){var _b=document.createElement('button');_b.className='info-btn';_b.textContent='ℹ';(function(_id){_b.onclick=function(e){e.stopPropagation();showPeptideCard(_id);};}(cId));item.appendChild(_b);}}else if(dose.tier==='enhanced'){var _ec=(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===cId;});if(_ec){var _b=document.createElement('button');_b.className='info-btn';_b.textContent='ℹ';(function(_id){_b.onclick=function(e){e.stopPropagation();showEnhancedCard(_id);};}(cId));item.appendChild(_b);}}else if(dose.tier==='trt'){/* Same third tier as buildToday — a past day shows the same rows and must offer the same button. */var _tc=(typeof TRT_GUIDE!=='undefined'&&TRT_GUIDE[cId])||((typeof TRT_CAT!=='undefined')&&TRT_CAT.find(function(c){return c.id===cId;}));if(_tc&&typeof showTrtCard==='function'){var _b=document.createElement('button');_b.className='info-btn';_b.textContent='ℹ';(function(_id){_b.onclick=function(e){e.stopPropagation();showTrtCard(_id);};}(cId));item.appendChild(_b);}}list.appendChild(item);});badge.textContent=label;badge.className='card-badge badge-upcoming';var titleEl=document.getElementById('today-title');if(titleEl)titleEl.textContent=d.getDate()+'/'+(d.getMonth()+1);document.querySelectorAll('.week-day').forEach(e=>e.classList.remove('selected-day'));if(tileEl)tileEl.classList.add('selected-day');}
function showDayModal(date){const d=new Date(date);const dk=dateKey(d);var doses=_dedupInjectionSlots((_injectionsCache[dk]||[]).filter(function(e){return e.active;}));const order=(typeof TIME_RANK!=='undefined')?TIME_RANK:{'AM':0,'null':1,'PM':2};doses.sort(function(a,b){return(order[a.time_of_day]??1)-(order[b.time_of_day]??1);});const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;';overlay.onclick=e=>{if(e.target===overlay)document.body.removeChild(overlay);};const sheet=document.createElement('div');sheet.style.cssText='background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:80vh;overflow-y:auto;';const rows=doses.length?doses.map(function(dose){return'<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:'+(dose.tier==='trt'?'#e05050':dose.dot)+';flex-shrink:0"></div><div style="flex:1"><div style="font-size:14px;font-weight:500;color:var(--text)">'+_esc(_tdName(dose.compound_name,dose.compound_id))+'</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">'+dose.dose+(dose.unit?' '+(UNIT_LABELS[dose.unit]||dose.unit):'')+'</div></div>'+(dose.time_of_day?'<div style="font-family:var(--font-display);font-size:14px;color:var(--muted2)">'+((typeof _slotLabel==='function')?_slotLabel(dose.time_of_day):dose.time_of_day)+'</div>':'')+'</div>';}).join(''):'<div style="color:var(--muted2);font-size:13px;text-align:center;padding:20px">Nothing scheduled</div>';sheet.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--accent)">'+d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()+'</div><button onclick="document.body.removeChild(this.closest(chr91+chr39+chr115+chr116+chr121+chr108+chr101+chr42+chr61+chr102+chr105+chr120+chr101+chr100+chr39+chr93))" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1">×</button></div>'+rows;overlay.appendChild(sheet);document.body.appendChild(overlay);}

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
  // Medication (2026-11-01: "the rings dont include meds tracking"): one tick per medication a day.
  var mTot=0,mDone=0;
  if(typeof _medsForDay==='function'&&typeof _medDateKey==='function'){
    var mstr=_medDateKey(now);
    _medsForDay(now).forEach(function(m){mTot++;if(_medLog[_medLogKey(m.id,mstr)])mDone++;});
  }
  var wTot=0,wDone=0;
  for(var i=0;i<7;i++){var day=new Date(now);day.setDate(day.getDate()-i);var wd=_dedupInjectionSlots((_injectionsCache[dateKey(day)]||[]).filter(function(e){return e.active;}));wTot+=wd.length;wDone+=wd.filter(function(e){return e.logged;}).length;}
  return{dDone:dDone,dTot:dTot,mDone:mDone,mTot:mTot,sDone:sDone,sTot:sTot,wDone:wDone,wTot:wTot};
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
function _ringCircle(r,frac,color,w){
  w=w||9;var c=2*Math.PI*r;var off=c*(1-Math.max(0,Math.min(1,frac)));
  return '<circle cx="60" cy="60" r="'+r+'" fill="none" style="stroke:var(--surface2)" stroke-width="'+w+'"/>'+
         '<circle cx="60" cy="60" r="'+r+'" fill="none" style="stroke:'+color+'" stroke-width="'+w+'" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/>';
}
function buildTodayRings(){
  var el=document.getElementById('today-rings');if(!el)return;
  if(_syncPending||!_injCacheReady){el.innerHTML='';return;}
  var st=_ringStats();
  if(st.dTot+st.mTot+st.sTot===0){el.innerHTML='';return;}
  var pct=Math.round(100*(st.dDone+st.mDone+st.sDone)/(st.dTot+st.mTot+st.sTot));
  var streak=_calcDoseStreak();
  // With medication there are four rings, so they are a little thinner and closer; without it the
  // card is exactly as before.
  var rings=st.mTot
    ? _ringCircle(52,st.dTot?st.dDone/st.dTot:0,'var(--accent)',8)+
      _ringCircle(42,st.mDone/st.mTot,'var(--accent2)',8)+
      _ringCircle(32,st.sTot?st.sDone/st.sTot:0,'var(--teal)',8)+
      _ringCircle(22,st.wTot?st.wDone/st.wTot:0,'var(--accent4)',8)
    : _ringCircle(50,st.dTot?st.dDone/st.dTot:0,'var(--accent)')+
      _ringCircle(38,st.sTot?st.sDone/st.sTot:0,'var(--teal)')+
      _ringCircle(26,st.wTot?st.wDone/st.wTot:0,'var(--accent4)');
  var svg='<svg width="120" height="120" viewBox="0 0 120 120" style="flex-shrink:0"><g transform="rotate(-90 60 60)">'+rings+
    '</g><text x="60" y="'+(st.mTot?65:66)+'" text-anchor="middle" style="fill:var(--text);font-family:var(--font-mono);font-size:'+(st.mTot?14:17)+'px">'+pct+'%</text></svg>';
  function row(color,label,val){return '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted2);margin-bottom:6px"><span style="width:7px;height:7px;border-radius:50%;background:'+color+';flex-shrink:0"></span>'+label+' <span style="font-family:var(--font-mono);color:var(--text)">'+val+'</span></div>';}
  var leg=row('var(--accent)','Doses',st.dDone+'/'+st.dTot);
  if(st.mTot)leg+=row('var(--accent2)','Medication',st.mDone+'/'+st.mTot);
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

// ── CHANGING WHAT ACTUALLY WENT IN, FOR ONE DAY ──────────────────────────────
// Henrik, 2026-09-18: "Add ability to change a dose in Today, IF I either run low on a
// compound or want to over ride schedule."
//
// Both of those are the same statement about one injection: the number the protocol
// planned is not the number that went into the syringe. Until now the only way to say it
// was to edit the protocol — which rewrites every future dose to answer a question about
// one past one — or to say nothing, and let the curve keep modelling a dose that was
// never given.
//
// So this edits the ROW and never the plan. The compound's dose, its phases and its
// cadence are untouched; the next dose comes back at whatever the protocol says.
//
// ⚠️ AND AN UNLOGGED FUTURE ROW IS NOT A SAFE PLACE TO KEEP AN OVERRIDE. injWriteBatch
// prunes this compound's unlogged rows from a date and rewrites them, so a change to a
// dose further out is replaced the next time a schedule is generated. Logged rows
// survive that prune — the backend preserves them — so a dose you have already taken
// keeps what you say it was. The sheet says this rather than leaving it to be
// discovered.
function _todayDoseCell(detailEl,dose){
  if(!detailEl||!dose||!dose.id)return;
  // ⚠️ ONLY A REAL ROW GETS THE AFFORDANCE. A past day with no injection rows falls
  // back to reconstructing doses from the peptide log (showDayInline), and those are
  // display objects with fabricated ids that no PUT can address. Offering a tappable
  // dose there is a control that looks live and does nothing — exactly the inert-control
  // failure the plan switch was rebuilt to kill.
  if(!_findCachedInjection(dose.id))return;
  // Same affordance the time cell uses: tappable, and visibly so. A number that can be
  // changed and gives no sign of it is a number nobody tries to change.
  detailEl.style.cursor='pointer';
  detailEl.style.borderBottom='1px dashed var(--border-strong)';
  detailEl.style.display='inline-block';
  detailEl.onclick=function(e){e.stopPropagation();openInjectionDoseEditor(dose.id);};
}
function _closeInjectionDoseEditor(){
  var o=document.getElementById('inj-dose-modal');
  if(o) o.remove();
  _injDoseEditId=null;
}
// Live draw volume as the number is typed — "ran low" is a question about what is left
// in the vial, and millilitres are what the vial is measured in.
function _injDosePreview(){
  var inp=document.getElementById('inj-dose-input');
  var out=document.getElementById('inj-dose-ml');
  if(!inp||!out)return;
  var row=_findCachedInjection(_injDoseEditId);
  if(!row){out.textContent='';return;}
  var v=parseDec(inp.value);
  if(!(v>0)){out.textContent='';return;}
  var ml=_todayDrawMl(Object.assign({},row,{dose:String(v)}));
  out.textContent=ml?('Draw '+ml+' ml'):'';
}
function openInjectionDoseEditor(id){
  var row=_findCachedInjection(id);
  if(!row)return;
  _injDoseEditId=id;
  var unit=(row.unit?((typeof UNIT_LABELS!=='undefined'&&UNIT_LABELS[row.unit])||row.unit):'');
  var name=_tdName(row.compound_name||row.compound_id,row.compound_id)||'This dose';
  var ml=_todayDrawMl(row);
  var btn='display:block;width:100%;padding:12px 14px;border-radius:10px;border:none;font-size:13px;font-weight:800;letter-spacing:0.4px;cursor:pointer;margin-bottom:10px;text-align:center;font-family:inherit;';
  var o=document.createElement('div');
  o.id='inj-dose-modal';
  o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px 16px 40px;';
  o.innerHTML='<div style="max-width:420px;margin:20px auto 0;background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden">'
    +'<div style="padding:16px 18px;border-bottom:1px solid var(--border)">'
    +'<div style="font-size:16px;font-weight:800;color:var(--text)">Dose for this day</div>'
    +'<div style="font-size:12px;color:var(--muted2);margin-top:3px">'+_esc(name)
      +' &middot; '+_esc(row.date||'')+'</div>'
    +'</div>'
    +'<div style="padding:16px 18px">'
    +'<div style="font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:12px">'
    +'Changes this one injection only. The protocol keeps its dose, and the next one '
    +'comes back at whatever it says.</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
    +'<input id="inj-dose-input" type="text" inputmode="decimal" value="'+_esc(String(row.dose||''))+'" '
    +'oninput="_injDosePreview()" '
    +'style="flex:1;min-width:0;background:var(--surface2);color:var(--text);'
    +'border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-size:18px;'
    +'font-family:var(--font-mono)">'
    +(unit?'<span style="font-size:14px;color:var(--muted2);white-space:nowrap">'+_esc(unit)+'</span>':'')
    +'</div>'
    +'<div id="inj-dose-ml" style="font-size:11px;color:var(--muted2);min-height:15px;margin-bottom:12px">'
    +(ml?('Draw '+ml+' ml'):'')+'</div>'
    // ⚠️ SAID HERE, NOT DISCOVERED LATER. A future row is a plan row, and generating a
    // schedule rewrites this compound's unlogged future. A dose already taken is kept.
    +(row.logged?''
      :'<div style="font-size:11px;color:#f59e0b;line-height:1.5;margin-bottom:12px">'
       +'This dose is not ticked yet. Generating a schedule for this compound replaces '
       +'its unlogged doses, including this change.</div>')
    +'<button onclick="saveInjectionDose()" style="'+btn+'background:var(--accent);color:#000">SAVE</button>'
    +'<button onclick="_closeInjectionDoseEditor()" style="'+btn+'background:var(--surface2);color:var(--text);border:1px solid var(--border)">CANCEL</button>'
    +'<div id="inj-dose-err" style="font-size:11px;color:var(--danger);min-height:14px;text-align:center"></div>'
    +'</div></div>';
  document.body.appendChild(o);
}
// Read the field BEFORE closing — the close removes the input from the document. Same
// ordering trap saveInjectionTime carries.
async function saveInjectionDose(){
  var id=_injDoseEditId;
  var inp=document.getElementById('inj-dose-input');
  var v=parseDec(inp?inp.value:'');
  var err=document.getElementById('inj-dose-err');
  // ⚠️ A ZERO IS NOT AN OVERRIDE, IT IS A SKIP, and skipping has its own control
  // (`active`). Writing dose:0 would leave a row that reads as an injection and models
  // as nothing — the silent-mismatch shape this app keeps getting bitten by.
  if(!(v>0)){ if(err)err.textContent='Enter a dose above 0.'; return; }
  _closeInjectionDoseEditor();
  if(id) await _setInjectionDose(id, v);
}
async function _setInjectionDose(id, val){
  var row=_findCachedInjection(id);
  if(!row) return;
  var next=String(Math.round(val*1000)/1000);
  var prev=row.dose;
  var redraw=function(){
    if(_viewDate){ showDayInline(_viewDate, document.querySelector('.week-day.selected-day')); }
    else { buildToday(); }
  };
  row.dose=next;
  redraw();
  var r=await injSetDose(id, next, 'todayDoseOverride');
  if(!r||!r.ok){ row.dose=prev; redraw(); return; }
  // THE RECORD CHANGED — RE-READ IT, DO NOT GUESS. The same rule the tick follows:
  // _tcHistory is fetched once per session, so a dose changed here and not re-read
  // leaves the curve modelling the old milligrams for the rest of the session. Forced,
  // because the cache is warm by definition at this point.
  if(row.logged && typeof _tcFetchHistory==='function'){
    try{ await _tcFetchHistory(true); }
    catch(e){ _logErr('todayDoseOverride', e); }
  }
}
