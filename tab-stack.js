// ── Cycle length suggestions ───────────────────────────────────────────────
var CYCLE_WEEKS=(function(){var a=[];for(var i=4;i<=240;i+=4)a.push(i);return a;})();
// ── Updated wizard init with cycle_length ──────────────────────────────────
// Default name for a new protocol: the next "Protocol N" — one past the highest
// existing "Protocol N" (or the count), so new protocols bump 1 → 2 → 3 → 4
// instead of all defaulting to "Protocol 1".
function _nextStackName(){
  var stacks=(typeof _userStacks!=='undefined'&&_userStacks)?_userStacks:[];
  var maxN=0;
  stacks.forEach(function(s){var m=/^Protocol (\d+)$/.exec((s&&s.name)||'');if(m){var n=parseInt(m[1],10);if(n>maxN)maxN=n;}});
  return 'Protocol '+(Math.max(maxN,stacks.length)+1);
}
function initWizard(){
  _wiz={step:0,goals:[],peptides:[],trt:{enabled:false,compounds:[]},enhanced:{enabled:false,compounds:[]},editMode:false,stackIndex:-1,stackName:_nextStackName(),cycle_length:12};
}
function editStackWithCycle(idx){
  if(idx<0||idx>=_userStacks.length)return;
  var st=_userStacks[idx];
  _wiz={
    step:0,
    goals:(function(){var g=st.peptides?st.peptides.map(function(p){var cat=PEPTIDE_CAT.find(function(c){return c.id===p.id;});return cat?cat.goals:[]}).flat().filter(function(v,i,a){return a.indexOf(v)===i;}):[];if(_wizTier()>=3&&st.enhanced&&st.enhanced.compounds&&st.enhanced.compounds.length&&g.indexOf('enhanced')===-1)g.push('enhanced');return g;})(),
    peptides:st.peptides?st.peptides.map(function(p){return JSON.parse(JSON.stringify(p))}):[],
    trt:(_wizTier()>=2&&st.trt)?JSON.parse(JSON.stringify(st.trt)):{enabled:false,compounds:[]},
    enhanced:(_wizTier()>=3&&st.enhanced)?JSON.parse(JSON.stringify(st.enhanced)):{enabled:false,compounds:[]},
    editMode:true,
    stackIndex:idx,
    stackName:st.name||'Protocol '+(idx+1),
    cycle_length:st.cycle_length||12
  };
  showWizard(true);
}
function wizSetCycleLength(val){var n=parseInt(val);_wiz.cycle_length=(val==='0'||n===0)?0:(n||12);}
// ── Wizard step 1: Cycle length ────────────────────────────────────────────
var _CYCLE_SELECT_STYLE='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:14px;font-family:inherit;outline:none;width:100%;box-sizing:border-box;margin-bottom:16px;';
function wizStep1(body,footer){
  var html='<div class="wiz-section">Cycle Length</div>';
  html+='<select onchange="wizSetCycleLength(this.value)" style="'+_CYCLE_SELECT_STYLE+'">';
  html+='<option value="0"'+(_wiz.cycle_length===0?' selected':'')+'>No end date</option>';
  CYCLE_WEEKS.forEach(function(w){var mo=w/4;html+='<option value="'+w+'"'+(_wiz.cycle_length===w?' selected':'')+'>'+(mo===1?'1 month':mo+' months')+'</option>';});
  html+='</select>';
  html+='<div style="font-size:11px;color:var(--muted2);">Cycle length helps track when to rotate peptides and manage tapering.</div>';
  body.innerHTML=html;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
}
// ── Five independent wizard flows ─────────────────────────────────────────────
// 1. Peps only:          CYCLE GOALS PEPTIDES CHECK CONFIGURE REVIEW
// 2. Peps + TRT:         CYCLE GOALS PEPTIDES CHECK CONFIGURE TRT VALIDATE REVIEW
// 3. TRT only:           CYCLE GOALS TRT REVIEW
// 4. TRT + Enhanced:     CYCLE GOALS TRT ENHANCED VALIDATE REVIEW
// 5. Peps + TRT + Enh:   CYCLE GOALS PEPTIDES CHECK CONFIGURE TRT ENHANCED VALIDATE REVIEW
function _wizTier(){return Math.min(3,Math.max(1,(_userTier||1)));}
function _wizFlow(){
  var g=(_wiz&&_wiz.goals)||[];
  var hasTRT=!!(_wiz&&_wiz.trt&&_wiz.trt.enabled);
  var hasEnhanced=g.includes('enhanced');
  var pepGoals=g.filter(function(x){return x!=='trt'&&x!=='enhanced';});
  // hasPeps: any peptide-goal chip selected, OR nothing at all selected (show-all default)
  var hasPeps=pepGoals.length>0||(!hasTRT&&!hasEnhanced);
  var steps=['cycle','goals'];
  if(hasPeps){steps.push('peptides');steps.push('check');steps.push('configure');}
  if(hasTRT)steps.push('trt');
  // Testosterone base is chosen first — every enhanced cycle runs on one, and which
  // ester it is changes injection frequency for the whole cycle. Then 'advise' (guided
  // recommendation), then the raw Enhanced compound list.
  // 'base' picks the testosterone an enhanced cycle runs on. With the single Compounds
  // toggle both flags are set together, so the 'trt' step above has ALREADY asked for
  // the ester, dose and cadence — pushing 'base' as well would ask for testosterone
  // twice in one run and let the two answers disagree. It stays for the path that has
  // enhanced without TRT, which is how an older draft can still arrive here.
  // ⚠️ THE GUIDANCE STEP IS REACHED, THEN ASKS.
  // Henrik, 2026-08-29: "In load of this screen I want an overlay asking if user wants
  // to add advanced compounds to the protocol or not... Clicking No takes user past
  // this part of the wizard."
  //
  // So a TRT run reaches 'advise' even without the enhanced goal ticked, and the
  // overlay there decides. Answering No sets advSkipped, which drops these steps again
  // — the flow is derived, so removing them is how "past this part" is expressed.
  var wantsAdv=hasEnhanced||(hasTRT&&!(_wiz&&_wiz.advSkipped));
  if(wantsAdv){
    if(!hasTRT)steps.push('base');
    steps.push('advise');steps.push('enhanced');
  }
  // VALIDATE when combining 2+ tiers so cross-tier conflicts are caught
  var tierCount=[hasPeps,hasTRT,wantsAdv].filter(Boolean).length;
  if(tierCount>=2)steps.push('validate');
  steps.push('nutrition');
  steps.push('review');
  return steps;
}
var _WIZ_STEP_LABELS={base:'TEST BASE',advise:'GUIDANCE',nutrition:'MACROS'};
var _WIZ_RENDERERS={cycle:function(b,f){wizStep1(b,f);},goals:wizStepGoals,base:function(b,f){wizStepBase(b,f);},peptides:wizStepPeptides,check:wizStepCheck,configure:wizStepConfig,trt:wizStepTRTHandoff,advise:wizStepAdvise,enhanced:wizStepEnhanced,validate:wizStepValidate,nutrition:wizStepNutrition,review:wizStepReview};
function wizRender(){
  var flow=_wizFlow();
  var idx=Math.min(_wiz.step,flow.length-1);
  _wiz.step=idx;
  var prog='';
  for(var i=0;i<flow.length;i++){
    var cls=i<idx?'done':i===idx?'active':'';
    prog+='<div class="wiz-dot '+cls+'"></div>';
  }
  document.getElementById('wiz-progress').innerHTML=prog;
  document.getElementById('wiz-title').textContent=(_wiz.editMode?'EDIT ':'BUILD ')+((_WIZ_STEP_LABELS&&_WIZ_STEP_LABELS[flow[idx]])||flow[idx].toUpperCase());
  var body=document.getElementById('wiz-body');
  var footer=document.getElementById('wiz-footer');
  body.scrollTop=0;

  // ── A STEP THAT IS NOT READY YET MUST SAY SO ──────────────────────────────
  // Henrik, 2026-08-20: "The wizard needs a loading spinner between screens, I am
  // having slow internet and you are sometimes presented with an empty screen for a
  // while."
  //
  // wizRender used to hand `body` straight to the renderer without clearing it. A step
  // that needs backend data — the compound catalogue, a recommendation — returns early
  // and fills the body later, so on a slow connection the user sat looking at whatever
  // happened to be there: the previous step, or nothing.
  //
  // Painting the spinner FIRST costs nothing when the step is ready. This is one
  // synchronous tick: a renderer that writes immediately replaces the spinner before
  // the browser paints, so there is no flash. Only a renderer that returns without
  // writing leaves it up — which is exactly when it should be up.
  //
  // The footer goes disabled with it, so Next cannot be pressed through a half-loaded
  // step. Whatever the renderer writes replaces both.
  body.innerHTML=_WIZ_LOADING_HTML;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1;opacity:0.5" disabled>Next →</button>';
  try{
    (_WIZ_RENDERERS[flow[idx]]||wizStepReview)(body,footer);
  }catch(err){
    // A throwing renderer must not strand the user on a spinner that never resolves.
    if(typeof _logErr==='function')_logErr('wizRender:'+flow[idx],err);
    body.innerHTML='<div style="padding:40px 20px;text-align:center;">'
      +'<div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:8px;">This step could not be drawn</div>'
      +'<div style="font-size:12px;color:var(--muted2);line-height:1.55;margin-bottom:18px;">'+_esc(String((err&&err.message)||err))+'</div>'
      +'<button class="btn btn-primary" onclick="wizRender()">Try again</button></div>';
    footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
  }
  body.scrollTop=0;
}
// Uses the app's existing spinner (css/main.css: .today-spinner/.today-spinner-dot),
// so the wizard looks like the rest of the app while it waits.
var _WIZ_LOADING_HTML='<div class="today-spinner"><div class="today-spinner-dot"></div></div>'
  +'<div style="text-align:center;font-size:12.5px;color:var(--muted2);margin-top:-24px">Loading…</div>';
// ── Updated save to include cycle_length ────────────────────────────────────
async function wizSave(){
  var btn=document.querySelector('.wiz-footer .btn.btn-primary');
  if(btn){btn.disabled=true;btn.textContent='Saving...';}
  // The target-free-T step asks for a first injection; that is the protocol's start.
  if(_wiz.trtPlan&&_wiz.trtPlan.startDate&&!_wiz.cycle_start)_wiz.cycle_start=_wiz.trtPlan.startDate;
  var proto={name:_wiz.stackName,cycle_length:_wiz.cycle_length,cycle_start:_wiz.cycle_start||undefined,peptides:_wiz.peptides,trt:(_wiz.trt&&_wiz.trt.enabled)?_wiz.trt:{},enhanced:((_wiz.goals||[]).includes('enhanced')&&_wiz.enhanced&&_wiz.enhanced.compounds&&_wiz.enhanced.compounds.length)?_wiz.enhanced:{}};
  // Preserve the stable id when editing (proto is rebuilt from the wizard state);
  // assign one for a brand-new stack. Keeps this stack's injections linked.
  if(_wiz.stackIndex>=0&&_wiz.stackIndex<_userStacks.length&&_userStacks[_wiz.stackIndex]&&_userStacks[_wiz.stackIndex].id)proto.id=_userStacks[_wiz.stackIndex].id;
  _ensureStackId(proto);
  if(_wiz.stackIndex>=0&&_wiz.stackIndex<_userStacks.length){
    _userStacks[_wiz.stackIndex]=proto;
  } else {
    _userStacks.push(proto);
    _wiz.stackIndex=_userStacks.length-1; // prevent double-push on retry
    // ⚠️ EVERY NEW PROTOCOL NEEDS A START DATE, NOT JUST THE FIRST ONE.
    // generateAndPushInjections below is gated on _savedStack.cycle_start, and this only
    // set one when the protocol was the user's FIRST. With any existing protocol the new
    // one saved with no start date, generated no injections, and rendered no curve —
    // "the wizard still never copy the injections to the saved protocol".
    // _nextFreeStartDate puts it the day after the current protocol ends.
    if(typeof _ensureCycleStart==='function')_ensureCycleStart(_wiz.stackIndex);
    // Activate it only when nothing else is running. Switching a live protocol off
    // because a new one was drafted is not something the user asked for — and the new
    // one usually starts after the current one ends, so it would leave a gap.
    if(!(_activeStackIndices&&_activeStackIndices.length))_activeStackIndices=[_wiz.stackIndex];
  }
  _userStacks=_userStacks.slice(0,4);
  // ── THE WIZARD'S TESTOSTERONE STEP WRITES INTO THE PROTOCOL ───────────────
  // It used to write into T-Calc's simple planner and then hand the user over to
  // that tab. Phase 6 deleted the planner, and this hand-off was left behind: the
  // dose and cadence went into `_tcp.simplePlan`, a field the profile now keeps
  // only so old saves are not rewritten and which NOTHING reads. So a user who
  // filled in all four fields — compound, dose, cadence, first injection — got
  // their schedule silently discarded and was dropped on a tab with no planner on
  // it. Nothing was scheduled, and nothing said so.
  //
  // The protocol is the only scheduler now, so the plan folds into the protocol's
  // own TRT compound before the save, where generateAndPushInjections() below can
  // see it. Same shape the classic multi-compound step produces, so there is one
  // representation of a scheduled compound and not two.
  //
  // Only when the classic step did NOT configure testosterone inline: that path
  // already wrote real compounds, and overwriting them with a half-filled planner
  // is what `_trtInline` has always guarded against.
  _wizFoldTrtPlanIntoProto(proto);
  // The single-source guard that stood here is gone with _reconcileStackTestoSource
  // (Phase 8): a protocol can no longer hold testosterone from two sources, so there
  // is nothing left to reconcile.
  var res=await saveStacksToBackend();
  updateWEEKLY();
  var _savedStack=_wiz.stackIndex>=0?_userStacks[_wiz.stackIndex]:null;
  if(_savedStack&&_savedStack.cycle_start&&confirmSavePrune(_savedStack)){var _today0=new Date(NOW);_today0.setHours(0,0,0,0);await generateAndPushInjections(_savedStack,_today0);await refreshInjectionsCache();}
  buildWeekStrip();
  buildToday();
  buildSchedule();
  buildStackStore();
  closeWizard();
  // WHERE THE USER LANDS after building a protocol.
  //
  // This used to hand off to T-Calc whenever the protocol carried testosterone,
  // because T-Calc was where the schedule got built. It is not any more — Plan ▸
  // Compounds is — and sending someone to a tab that can only draw a curve, right
  // after they had just described a dose and a cadence, is what made the silent
  // loss of that schedule invisible. They saw a testosterone tab open and assumed
  // it had taken the plan.
  //
  // Everyone now lands on the protocol they just built, where the compound they
  // configured is visible and editable.
  switchTab('stacks',document.getElementById('tab-btn-stacks'));
  if(res.synced===false){
    // Data saved locally; backend sync failed — show a brief banner
    var nb=document.createElement('div');
    nb.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#aaa;font-size:11px;padding:6px 14px;border-radius:20px;z-index:9999;pointer-events:none;';
    nb.textContent='Saved locally (backend sync pending)';
    document.body.appendChild(nb);
    setTimeout(function(){if(nb.parentNode)nb.parentNode.removeChild(nb);},3500);
  }
}
// ── Updated buildStackStore to show cycle length ────────────────────────────
function createNewStack(){initWizard();showWizard(false);}
// ── Protocol templates (curated starter stacks served from the backend) ────────
function openTemplatePicker(preferGoals){
  var tpl=(typeof _protocolTemplates!=='undefined'&&_protocolTemplates)?_protocolTemplates:[];
  if(!tpl.length){createNewStack();return;}
  var pref=Array.isArray(preferGoals)?preferGoals:[];
  var _tplMatches=function(t){return pref.length&&(t.goals||[]).some(function(g){return pref.indexOf(g)>=0;});};
  if(pref.length)tpl=tpl.slice().sort(function(a,b){return (_tplMatches(b)?1:0)-(_tplMatches(a)?1:0);}); // goal matches first
  var ov=document.createElement('div');ov.id='tpl-picker-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:500;display:flex;align-items:flex-end;justify-content:center';
  ov.onclick=function(e){if(e.target===ov)_closeTemplatePicker();};
  var cards=tpl.map(function(t){
    var comps=[].concat((t.peptides||[]).map(function(p){var _u=_slotFirstUnit(p);return {name:p.name,dot:p.dot,dose:_slotFirstDose(p)+(_u?' '+_u:'')};}),
      ((t.trt&&t.trt.compounds)||[]).map(function(c){return {name:c.name,dot:c.dot,dose:(c.dose||'')+(c.unit?' '+c.unit:'')};}),
      ((t.enhanced&&t.enhanced.compounds)||[]).map(function(c){return {name:c.name,dot:c.dot,dose:(c.dose||'')+(c.unit?' '+c.unit:'')};}));
    var rows=comps.map(function(c){return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><span style="width:7px;height:7px;border-radius:50%;background:'+(c.dot||'#888')+';flex-shrink:0"></span><span style="font-size:13px;color:var(--text);flex:1">'+_esc(c.name)+'</span><span style="font-size:12px;color:var(--muted2);font-family:var(--font-mono)">'+_esc(c.dose)+'</span></div>';}).join('');
    var _sug=_tplMatches(t)?'<span style="font-size:9px;font-weight:800;letter-spacing:0.4px;color:#000;background:var(--accent);border-radius:5px;padding:2px 6px;margin-left:8px;vertical-align:middle">SUGGESTED</span>':'';
    return '<div style="border:1px solid '+(_tplMatches(t)?'var(--accent)':'var(--border)')+';border-radius:12px;padding:14px;margin-bottom:12px;background:var(--surface2)">'+
      '<div style="font-family:var(--font-display);font-size:19px;color:var(--text)">'+_esc(t.name)+_sug+'</div>'+
      (t.tagline?'<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);margin-top:2px">'+_esc(t.tagline)+'</div>':'')+
      (t.description?'<div style="font-size:12px;color:var(--muted2);line-height:1.5;margin:8px 0 10px">'+_esc(t.description)+'</div>':'')+
      rows+
      '<button onclick="useTemplate(\''+_esc(t.id)+'\')" style="margin-top:12px;width:100%;background:var(--accent);color:#000;border:none;border-radius:20px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Use this plan</button>'+
    '</div>';
  }).join('');
  var sheet=document.createElement('div');
  sheet.style.cssText='background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:18px 18px 28px;max-height:85vh;overflow-y:auto';
  sheet.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div style="font-family:var(--font-display);font-size:22px;color:var(--accent)">Starter protocols</div><button onclick="_closeTemplatePicker()" style="background:none;border:none;color:var(--muted2);font-size:24px;cursor:pointer;line-height:1">&times;</button></div>'+
    '<div style="font-size:12px;color:var(--muted2);line-height:1.5;margin-bottom:14px">Vetted starting points. You can edit doses, timing and the start date any time.</div>'+
    cards+
    '<button onclick="_closeTemplatePicker();createNewStack()" style="width:100%;background:var(--surface2);color:var(--muted2);border:1px solid var(--border);border-radius:20px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:4px">Start from scratch instead</button>';
  ov.appendChild(sheet);document.body.appendChild(ov);
}
function _closeTemplatePicker(){var ov=document.getElementById('tpl-picker-overlay');if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);}
// Instantiate a stack from a template: starts today (so doses schedule immediately),
// activates it, persists to the backend and regenerates injections. Fully editable after.
async function useTemplate(tid){
  var t=((typeof _protocolTemplates!=='undefined'&&_protocolTemplates)||[]).find(function(x){return x.id===tid;});
  if(!t)return;
  if(!Array.isArray(_userStacks))_userStacks=[];
  if(_userStacks.length>=4){alert('You already have 4 protocols — remove one first.');return;}
  var _t0=new Date(NOW);_t0.setHours(0,0,0,0);
  var proto={name:t.name,cycle_length:t.cycle_length||12,cycle_start:dateKey(_t0),
    peptides:(t.peptides||[]).map(function(p){var _e={id:p.id,name:p.name,dot:p.dot,times:(p.times||['AM']).slice(),days:(p.days||[0,1,2,3,4,5,6]).slice(),active:true};TIME_SLOTS.forEach(function(tm){var k=_slotKey(tm);_e['dose_'+k]=p['dose_'+k]||'';_e['unit_'+k]=p['unit_'+k]||'';});return _e;}),
    trt:(t.trt&&t.trt.compounds&&t.trt.compounds.length)?{enabled:true,compounds:t.trt.compounds.map(function(c){return {id:c.id,name:c.name,dot:c.dot,dose:c.dose,unit:c.unit,freqVal:c.freqVal,freqUnit:c.freqUnit,days:(c.days||[1]).slice()};})}:{},
    enhanced:(t.enhanced&&t.enhanced.compounds&&t.enhanced.compounds.length)?{enabled:true,compounds:t.enhanced.compounds.map(function(c){return {id:c.id,name:c.name,dot:c.dot,dose:c.dose,unit:c.unit,days:(c.days||[0,1,2,3,4,5,6]).slice()};})}:{}
  };
  if(typeof _ensureStackId==='function')_ensureStackId(proto);
  _userStacks.push(proto);_userStacks=_userStacks.slice(0,4);
  var _idx=_userStacks.length-1;
  // Only one protocol may be active — starting one from a template makes it THE
  // active one rather than adding it alongside whatever was already running.
  _activeStackIndices=[_idx];
  if(typeof _ensureCycleStart==='function')_ensureCycleStart(_idx);
  _closeTemplatePicker();
  await saveStacksToBackend();
  if(typeof updateWEEKLY==='function')updateWEEKLY();
  await generateAndPushInjections(proto,_t0);
  if(typeof refreshInjectionsCache==='function')await refreshInjectionsCache();
  if(typeof buildWeekStrip==='function')buildWeekStrip();
  if(typeof buildToday==='function')buildToday();
  if(typeof buildSchedule==='function')buildSchedule();
  if(typeof buildStackStore==='function')buildStackStore();
  if(typeof switchPrimary==='function')switchPrimary('today');
}

function viewStack(idx){_editReadOnly=true;showStackEditor(idx);}
function editStack(idx){_editReadOnly=false;showStackEditor(idx);}
// ── Inline Stack Editor ──────────────────────────────────────────────────────
var _editBuf=null;var _editIdx=-1;var _editReadOnly=false;
function _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// One spelling per molecule (Phase 1 chose the PK ids). Delegates rather than
// duplicating: _tcCanonCompId and _isEnhTestosterone are what the PK model and the
// curve already key on, and a second opinion about what counts as testosterone is
// exactly how this app grew two of everything.
function _canonCompoundId(id){
  return (typeof _tcCanonCompId==='function')?_tcCanonCompId(id):id;
}
function _isTestoCompoundId(id){
  if(typeof _isEnhTestosterone==='function'&&_isEnhTestosterone({id:id}))return true;
  var cid=_canonCompoundId(id);
  return (typeof TRT_CAT!=='undefined')&&TRT_CAT.some(function(c){return c.id===cid;});
}

// ONE TIER FOR TESTOSTERONE. Phase 4 of the unified Plan rewrite: TRT and Enhanced
// merge into a single Compounds tier. A protocol written before the merge can hold the
// same molecule in either block — Protocol 2 held `enhanced/test_u` while T-Calc wrote
// `trt/nebido`, and that split is what let one protocol carry 26 rows of one stream
// beside 6 of another for the same testosterone.
//
// Folding happens in the EDIT BUFFER, so nothing is rewritten until the user saves.
// Ids are canonicalised to the PK spelling (Henrik's choice, 2026-08-19) so the
// compound lands on the card the merged editor actually renders.
function _editFoldTestosterone(buf){
  if(!buf||!buf.enhanced||!Array.isArray(buf.enhanced.compounds))return 0;
  var moved=0;
  var keep=[];
  buf.enhanced.compounds.forEach(function(c){
    if(!_isTestoCompoundId(c.id)){keep.push(c);return;}
    if(!buf.trt)buf.trt={};
    if(!Array.isArray(buf.trt.compounds))buf.trt.compounds=[];
    var cid=_canonCompoundId(c.id);
    // Already configured on the TRT side: the TRT entry wins, because that is the one
    // T-Calc has been scheduling from. Dropping the duplicate is the whole point.
    var dup=buf.trt.compounds.some(function(t){return _canonCompoundId(t.id)===cid;});
    if(!dup){
      var moved_c=JSON.parse(JSON.stringify(c));
      moved_c.id=cid;
      // A RATE BECOMES AN AMOUNT ON THE WAY IN. The Enhanced block stores a rate
      // ("350 mg/week"); this block stores what goes in the syringe. Carrying the rate
      // across is what produced a dose the editor could not display (2026-08-19), so
      // convert here, where the cadence that defines the conversion is still attached.
      if(String(moved_c.unit||'').indexOf('/')>=0&&typeof _enhDosePerInjection==='function'){
        var _pd=_enhDosePerInjection(moved_c);
        moved_c.dose=_pd.dose; moved_c.unit=_pd.unit;
      }
      buf.trt.compounds.push(moved_c);
    }
    moved++;
  });
  if(moved){
    buf.enhanced.compounds=keep;
    buf.enhanced.enabled=keep.length>0;
    if(buf.trt.compounds.length)buf.trt.enabled=true;
  }
  return moved;
}

// ── Migrating a stored protocol to the merged tier ───────────────────────────
// Henrik, 2026-08-19: "any pre existing protocol needs to be merged into the new
// format" and then "Ok just migrate" — i.e. do it to the stored protocols rather
// than waiting for each one to be opened and saved.
//
// The same fold the editor applies, run over every protocol and written back. It
// moves testosterone into the one tier under its canonical id; nothing else moves,
// no protocol is merged into another, and no injection row is touched. The
// generator still suppresses testosterone until Phase 5, so this changes what the
// protocol SAYS, not what it schedules — which is what makes it safe to run first.
// Takes the list it operates on, defaulting to the app's. A migration that can only
// read a global cannot be exercised without mutating one.
function _migrateProtocolsReport(stacks){
  var moves=[];
  (stacks||_userStacks||[]).forEach(function(st,i){
    var copy=JSON.parse(JSON.stringify(st));
    var before=((copy.enhanced&&copy.enhanced.compounds)||[]).filter(function(c){
      return _isTestoCompoundId(c.id);
    });
    if(!before.length)return;
    var hadTrt=(((copy.trt&&copy.trt.compounds)||[]).map(function(c){return _canonCompoundId(c.id);}));
    _editFoldTestosterone(copy);
    before.forEach(function(c){
      var cid=_canonCompoundId(c.id);
      moves.push({idx:i, stack:st.name||st.id||('#'+i), from:c.id, to:cid,
                  dose:c.dose, unit:c.unit,
                  dropped:hadTrt.indexOf(cid)>=0});
    });
  });
  return moves;
}

async function migrateProtocolsToCompounds(stacks){
  var list=stacks||_userStacks||[];
  var moves=_migrateProtocolsReport(list);
  if(!moves.length){
    alert('Nothing to migrate — every protocol already keeps its testosterone in one tier.');
    return;
  }
  var lines=moves.map(function(m){
    return '· ' + m.stack + ': ' + m.from + ' → ' + m.to +
           (m.dose ? ' (' + m.dose + (m.unit ? ' ' + m.unit : '') + ')' : '') +
           (m.dropped ? ' — duplicate, the existing entry is kept' : '');
  }).join('\n');
  if(!confirm('Merge ' + moves.length + ' compound' + (moves.length===1?'':'s') +
              ' into the Compounds tier?\n\n' + lines +
              '\n\nProtocols stay separate and no injection is added, changed or ' +
              'deleted. This rewrites the protocol config in the backend.')) return;
  var n=0;
  list.forEach(function(st){ n+=_editFoldTestosterone(st); });
  try{
    if(typeof saveStacksToBackend==='function')await saveStacksToBackend();
  }catch(e){ _logErr('migrateProtocols', e); alert('Save failed — nothing was migrated.'); return; }
  if(typeof buildStackStore==='function')buildStackStore();
  if(typeof buildToday==='function')buildToday();
  alert('Migrated ' + n + ' compound' + (n===1?'':'s') + ' into the Compounds tier.');
}

function showStackEditor(idx){
  if(idx<0||idx>=_userStacks.length)return;
  _editIdx=idx;_editBuf=JSON.parse(JSON.stringify(_userStacks[idx]));
  if(_editBuf.cycle_length==null)_editBuf.cycle_length=12;
  if(!_editBuf.peptides)_editBuf.peptides=[];
  _editFoldTestosterone(_editBuf);
  _stackViewTab='peptides';_editInnerTab='peptides';
  renderStackEditor();
}
function _collectEditInputs(){
  if(!_editBuf)return;
  var nameEl=document.getElementById('edit-stack-name');
  if(nameEl)_editBuf.name=nameEl.value;
  var csEl=document.getElementById('edit-cycle-start');if(csEl){if(csEl.value)_editBuf.cycle_start=csEl.value;else delete _editBuf.cycle_start;}
  // READ the end date, do not DELETE it. This line was `delete _editBuf.end_date;` —
  // correct while the editor had no end-date field and the months dropdown was the only
  // way to set a length, and a live landmine the moment one existed: _collectEditInputs
  // runs on every save and on every compound toggle, so the date would have survived
  // being typed and then vanished on the next interaction.
  var ceEl=document.getElementById('edit-cycle-end');
  if(ceEl){
    if(ceEl.value)_editBuf.end_date=ceEl.value; else delete _editBuf.end_date;
    _editBuf.cycle_length=_cycleWeeksBetween(_editBuf.cycle_start,_editBuf.end_date);
  }
  (_editBuf.peptides||[]).forEach(function(p,pi){
    var el;
    TIME_SLOTS.forEach(function(t){
      var k=_slotKey(t);
      if((el=document.getElementById('ed-d'+k+'-'+pi)))p['dose_'+k]=el.value;
      if((el=document.getElementById('ed-u'+k+'-'+pi)))p['unit_'+k]=el.value;
    });
    if((el=document.getElementById('ed-note-'+pi)))p.note=el.value;
    if((el=document.getElementById('ed-sd-'+pi))){if(el.value)p.start_date=el.value;else delete p.start_date;}
  });
}
function _deriveEarliestStartDate(peptides){
  var dates=(peptides||[]).map(function(p){return p.start_date;}).filter(Boolean);
  if(!dates.length)return null;
  dates.sort();
  return dates[0];
}
// ── EDITING A PROTOCOL SETS DATES, NOT A NUMBER OF MONTHS ───────────────────
// Henrik, 2026-08-20: "Edit Protocol needs to be able to set start and end date. The
// no of months is to course. It makes sense in the wizard when u create a protocol but
// not when you edit it."
//
// Creating is a choice about LENGTH — "a 12-week run" — and a months dropdown says that
// well. Editing is a correction to a run already under way, where the thing you know is
// the date it actually ends. Rounding that to the nearest month is the wrong instrument.
//
// end_date becomes authoritative in the editor. cycle_length is kept in step with it
// rather than replaced, because the week counters, the shopping list and the injection
// generator all read cycle_length and rewriting every consumer in one change is how
// regressions become impossible to attribute.
//
// Weeks are rounded UP: a 100-day protocol is 15 weeks, not 14, so nothing derived from
// the length stops short of the end date the user set.
function _cycleWeeksBetween(startStr, endStr){
  if(!startStr || !endStr) return 0;
  var a=parseLocalDate(startStr), b=parseLocalDate(endStr);
  if(!(b > a)) return 0;
  return Math.ceil((b - a) / (7 * 86400000));
}
// The end date a protocol currently implies, whichever way it was set.
function _cycleEndDateStr(st){
  if(!st) return '';
  if(st.end_date) return st.end_date;
  if(st.cycle_start && st.cycle_length > 0){
    var d=parseLocalDate(st.cycle_start);
    d.setDate(d.getDate() + st.cycle_length * 7);
    return dateKey(d);
  }
  return '';
}
function editSetCycleStart(v){
  _collectEditInputs();
  if(v) _editBuf.cycle_start=v; else delete _editBuf.cycle_start;
  // Moving the start past the end would invert the protocol; carry the end with it.
  if(_editBuf.end_date && _editBuf.cycle_start &&
     parseLocalDate(_editBuf.end_date) <= parseLocalDate(_editBuf.cycle_start)){
    delete _editBuf.end_date;
    _editBuf.cycle_length=0;
  }else if(_editBuf.end_date){
    _editBuf.cycle_length=_cycleWeeksBetween(_editBuf.cycle_start,_editBuf.end_date);
  }
  renderStackEditor();
}
function editSetCycleEnd(v){
  _collectEditInputs();
  if(!v){
    // Cleared = runs until stopped. Both fields say so, so nothing can disagree.
    delete _editBuf.end_date;
    _editBuf.cycle_length=0;
    renderStackEditor();
    return;
  }
  if(_editBuf.cycle_start && parseLocalDate(v) <= parseLocalDate(_editBuf.cycle_start)){
    // Refused rather than silently corrected: an end on or before the start is a typo,
    // and quietly moving it would hide which of the two dates the user got wrong.
    _editBuf._cycleErr='The end date must be after the start date.';
    renderStackEditor();
    return;
  }
  delete _editBuf._cycleErr;
  _editBuf.end_date=v;
  _editBuf.cycle_length=_cycleWeeksBetween(_editBuf.cycle_start,v);
  renderStackEditor();
}

function renderStackEditor(){
  var body=document.getElementById('stack-body');if(!body)return;
  var st=_editBuf;var _noEnd=(st.cycle_length===0);var cycle=_noEnd?0:(st.cycle_length||12);
  var isActive=_isActiveStack(_editIdx);
  var _effCs=(function(){var _sc=st.cycle_start||'';if(_sc){var _csp=_sc.split('-');_sc=_csp[0]+'-'+(_csp[1]||'1').padStart(2,'0')+'-'+(_csp[2]||'1').padStart(2,'0');}return _sc;})();
  var html='';

  if(_editReadOnly){
    html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">';
    html+='<button onclick="buildStackStore()" style="background:none;border:none;color:var(--muted2);font-size:24px;cursor:pointer;padding:0;line-height:1;">←</button>';
    html+='<div style="flex:1;font-size:17px;font-weight:700;color:var(--text);">'+_esc(st.name||'Protocol '+(_editIdx+1))+'</div>';
    if(isActive)html+='<span style="background:var(--accent);color:#000;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;">ACTIVE</span>';
    html+='</div>';
    // ⚠️ ACTIONS STAY ON SCREEN.
    // Henrik, 2026-08-28: "the buttons for edit/delete/close should be on one row and
    // always on top of the Plan view. Especially in Edit mode the buttons gets hidden
    // on bottom of screen."
    //
    // They sat at the END of the document, so on a long protocol — and every protocol in
    // edit mode is long — you had to scroll past every compound to reach Close or Save.
    // Sticky at the top costs one row and is reachable from anywhere in the view.
    //
    // Deactivate is gone from here: it is already on the protocol list a level up, and
    // duplicating a state-changing control next to Delete is how the wrong one gets hit.
    html+='<div style="position:sticky;top:0;z-index:30;display:flex;gap:8px;background:var(--bg);border-bottom:1px solid var(--border);padding:8px 0 10px;margin:0 0 16px;">';
    html+='<button onclick="buildStackStore()" style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--muted2);border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Close</button>';
    html+='<button onclick="_editReadOnly=false;_editInnerTab=_compTabId(_stackViewTab);renderStackEditor()" style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Edit</button>';
    html+='<button onclick="deleteStack('+_editIdx+')" style="flex:1;background:none;border:1px solid var(--danger);color:var(--danger);border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Delete</button>';
    html+='</div>';
    html+='<div class="wiz-section">Cycle</div>';
    if(_effCs){
      var _sd2=parseLocalDate(_effCs);
      var _dDone2=Math.max(0,Math.floor((NOW-_sd2)/86400000));
      if(_noEnd){
        var _wk2o=Math.floor(_dDone2/7)+1;
        html+='<div style="font-size:13px;color:var(--text);margin-bottom:2px;">'+fmtDate(_sd2)+' → ongoing</div>';
        html+='<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;">Week '+_wk2o+' · No end date</div>';
      }else{
        var _ed2=new Date(_sd2.getTime()+cycle*7*86400000);
        var _wk2=Math.min(cycle,Math.floor(_dDone2/7)+1);
        html+='<div style="font-size:13px;color:var(--text);margin-bottom:2px;">'+fmtDate(_sd2)+' → '+fmtDate(_ed2)+'</div>';
        html+='<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;">Week '+_wk2+' of '+cycle+' · '+cycle+' wk cycle</div>';
      }
    }else{
      html+='<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;">'+(_noEnd?'No end date':''+cycle+' wk cycle')+' · No start date</div>';
    }
    html+=_stackTabBar(_stackViewTab,'setStackViewTab');
    if(_stackViewTab==='compounds'){
      // Same composition as the editor, read-only: testosterone first, then by class.
      html+=_renderTRTViewTab(st);
      html+=((_userTier||1)>=3?_renderEnhancedViewTab(st):_renderEnhancedUpgradeCTA());
    }else{
      html+='<div class="wiz-section">Peptides</div>';
      if(!st.peptides||!st.peptides.length){
        html+='<div style="color:var(--muted2);font-size:13px;padding:8px 0;">No peptides added.</div>';
      }else{
        st.peptides.forEach(function(p){
          var dot=p.dot||'#888';
          var dayLabels=['S','M','T','W','T','F','S'];
          var sortedDays=(p.days||[]).slice().sort(function(a,b){return(a+6)%7-(b+6)%7;});
          var daysStr=sortedDays.map(function(d){return dayLabels[d];}).join(' ');
          html+='<div class="cfg-block" style="margin-bottom:8px;">';
          html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
          html+='<div style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0;"></div>';
          html+='<div style="flex:1;font-size:13px;font-weight:600;color:var(--text);">'+_esc(p.name)+'</div>';
          html+='<button class="info-btn" onclick="showPeptideCard(\''+p.id+'\')">ℹ</button>';
          html+='</div>';
          var doseStr='';
          TIME_SLOTS.forEach(function(t){
            var k=_slotKey(t);
            if(!p['dose_'+k])return;
            doseStr+=(doseStr?' · ':'')+_slotLabel(t)+': '+_esc(_doseLabel(p.id,p['dose_'+k],p['unit_'+k]||'µg'));
          });
          if(doseStr)html+='<div style="font-size:12px;color:var(--muted2);padding-left:16px;">'+doseStr+'</div>';
          if(daysStr)html+='<div style="font-size:12px;color:var(--muted2);padding-left:16px;">'+_esc(daysStr)+'</div>';
          if(p.start_date)html+='<div style="font-size:12px;color:var(--muted2);padding-left:16px;">Start: '+_esc(p.start_date)+'</div>';
          html+='</div>';
        });
      }
    }
    html+='<div style="padding-bottom:24px;"></div>';
    body.innerHTML=html;
    if(_stackViewTab==='compounds'&&(_userTier||1)>=3)_ensurePctPanel(st);
    return;
  }

  html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">';
  html+='<button onclick="buildStackStore()" style="background:none;border:none;color:var(--muted2);font-size:24px;cursor:pointer;padding:0;line-height:1;">←</button>';
  html+='<input id="edit-stack-name" type="text" value="'+_esc(st.name||'')+'" oninput="_editBuf.name=this.value" style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-size:15px;font-weight:600;font-family:inherit;outline:none;">';
  html+='</div>';
  // Same reasoning as the read-only view, and this is the case that prompted it: an
  // edit view is long, so Save and Cancel sat below every compound on the page.
  html+='<div style="position:sticky;top:0;z-index:30;display:flex;gap:8px;background:var(--bg);border-bottom:1px solid var(--border);padding:8px 0 10px;margin:0 0 16px;">';
  html+='<button onclick="buildStackStore()" style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--muted2);border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>';
  html+='<button onclick="saveEditBuf()" style="flex:2;background:var(--accent);border:none;color:#000;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Save Protocol</button>';
  html+='</div>';
  html+='<div class="wiz-section">Runs</div>';
  var _dateInputStyle='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-size:14px;font-family:inherit;outline:none;width:100%;box-sizing:border-box;';
  var _clearBtnStyle='background:none;border:none;color:var(--muted2);font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;padding:4px 0;flex-shrink:0;';
  var _lblStyle='font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;display:block;';
  var _effEnd=_cycleEndDateStr(st);
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px;">';
  html+='<div><label style="'+_lblStyle+'">From</label>'
     +  '<input type="date" id="edit-cycle-start" value="'+_esc(_effCs)+'" onchange="editSetCycleStart(this.value)" style="'+_dateInputStyle+'"></div>';
  html+='<div><label style="'+_lblStyle+'">To</label>'
     +  '<input type="date" id="edit-cycle-end" value="'+_esc(_effEnd)+'"'+(_effCs?(' min="'+_esc(_effCs)+'"'):'')+' onchange="editSetCycleEnd(this.value)" style="'+_dateInputStyle+'"></div>';
  html+='</div>';
  if(st._cycleErr){
    html+='<div style="font-size:12px;color:#e05050;margin-bottom:6px;">'+_esc(st._cycleErr)+'</div>';
  }
  html+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">';
  if(_effEnd)html+='<button onclick="editSetCycleEnd(\'\')" style="'+_clearBtnStyle+'">No end date</button>';
  if(_effCs)html+='<button onclick="_collectEditInputs();delete _editBuf.cycle_start;delete _editBuf.end_date;_editBuf.cycle_length=0;renderStackEditor();" style="'+_clearBtnStyle+'">Clear dates</button>';
  html+='</div>';
  if(_effCs&&!_noEnd&&cycle){var _sd=parseLocalDate(_effCs);var _dDone=Math.max(0,Math.floor((NOW-_sd)/86400000));var _wk=Math.min(cycle,Math.floor(_dDone/7)+1);html+='<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;">Week '+_wk+' of '+cycle+'</div>';}else if(_effCs&&_noEnd){var _sd=parseLocalDate(_effCs);var _dDone=Math.max(0,Math.floor((NOW-_sd)/86400000));html+='<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;">Week '+(Math.floor(_dDone/7)+1)+' · ongoing</div>';}else{html+='<div style="margin-bottom:16px;"></div>';}
  // The months dropdown is gone from the EDITOR — dates are finer and are what you
  // know when correcting a run already going. It stays in the wizard, where the choice
  // really is "how long shall this be". The derived length is shown, not chosen, so the
  // number the rest of the app uses is visible rather than hidden.
  if(_effCs&&_effEnd){
    var _wks=_cycleWeeksBetween(_effCs,_effEnd);
    var _days=Math.max(0,Math.round((parseLocalDate(_effEnd)-parseLocalDate(_effCs))/86400000));
    html+='<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;">'
       +  _days+' days · '+_wks+' week'+(_wks===1?'':'s')+'</div>';
  }else if(_effCs){
    html+='<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;">No end date — runs until you stop it.</div>';
  }else{
    html+='<div style="margin-bottom:16px;"></div>';
  }
  html+=_stackTabBar(_editInnerTab,'setEditInnerTab');
  if(_editInnerTab==='compounds'){
    html+=_renderEditCompounds(st);
  }else{
    html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
    html+='<div class="wiz-section" style="margin:0;">Peptides</div>';
    html+='<button onclick="_collectEditInputs();editAddPeptide();" style="background:none;border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">+ Add</button>';
    html+='</div>';
    if(!st.peptides||!st.peptides.length){
      html+='<div style="color:var(--muted2);font-size:13px;padding:16px 0;text-align:center;">No peptides — tap + Add to get started.</div>';
    }else{st.peptides.forEach(function(p,pi){html+=_renderEditPep(p,pi);});}
  }
  html+='<div style="padding-bottom:24px;"></div>';
  body.innerHTML=html;
}
function _renderEditPep(p,pi){
  var eff=_effectiveDose(p,_editBuf.cycle_start);
  var dot=p.dot||'#888';
  var html='<div class="cfg-block" style="margin-bottom:8px;">';
  html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
  html+='<div style="width:9px;height:9px;border-radius:50%;background:'+dot+';flex-shrink:0;"></div>';
  html+='<div style="flex:1;font-size:13px;font-weight:600;color:var(--text);">'+_esc(p.name)+'</div>';
  html+='<button class="info-btn" onclick="showPeptideCard(\''+p.id+'\')">ℹ</button>';
  html+='<button onclick="_collectEditInputs();editRemovePeptide('+pi+')" style="background:none;border:none;color:var(--muted2);font-size:20px;cursor:pointer;padding:0;line-height:1;">×</button>';
  html+='</div>';
  html+='<div class="cfg-row"><div class="cfg-lbl">Timing</div><div class="time-chips">';
  TIME_SLOTS.forEach(function(t){html+='<div class="time-chip'+(p.times&&p.times.includes(t)?' sel':'')+'" onclick="editToggleTime('+pi+',\''+t+'\')">'+_slotLabel(t)+'</div>';});
  html+='</div></div>';
  TIME_SLOTS.forEach(function(t){
    if(!(p.times&&p.times.includes(t)))return;
    var k=_slotKey(t);
    var dispDose=eff?String(eff.dose):(p['dose_'+k]||'');
    var dispUnit=_canonUnit(eff?eff.unit:(p['unit_'+k]||_slotFirstUnit(p)||'mg'));
    html+='<div class="cfg-row"><div class="cfg-lbl">'+_slotLabel(t)+' Dose</div><div class="dose-row">';
    html+='<input id="ed-d'+k+'-'+pi+'" class="dose-in" type="text" inputmode="decimal" value="'+_esc(dispDose)+'" oninput="_editBuf.peptides['+pi+'].dose_'+k+'=this.value" placeholder="0">';
    html+='<select id="ed-u'+k+'-'+pi+'" class="unit-sel" onchange="_editBuf.peptides['+pi+'].unit_'+k+'=this.value">'+UNITS.map(function(u){return'<option value="'+u+'"'+(u===dispUnit?' selected':'')+'>'+(UNIT_LABELS[u]||u)+'</option>';}).join('')+'</select>';
    html+='</div></div>';
  });
  html+=_renderSlotTimingHint(p.id,p.times);
  html+=_renderPepCadence(pi,p,'edit');
  html+='<div class="cfg-row"><div class="cfg-lbl">Note</div>';
  html+='<input id="ed-note-'+pi+'" class="note-in" type="text" value="'+_esc(String(p.note||''))+'" oninput="_editBuf.peptides['+pi+'].note=this.value" placeholder="e.g. fasted, pre-sleep...">';
  html+='</div>';
  var _sdVal=p.start_date||'';if(_sdVal){var _sdp=_sdVal.split('-');_sdVal=_sdp[0]+'-'+(_sdp[1]||'1').padStart(2,'0')+'-'+(_sdp[2]||'1').padStart(2,'0');}
  html+='<div class="cfg-row"><div class="cfg-lbl">Start</div>';
  html+='<input id="ed-sd-'+pi+'" type="date" value="'+_esc(_sdVal)+'" oninput="_collectEditInputs()" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--text);font-size:12px;font-family:inherit;outline:none;flex:1;">';
  html+='</div></div>';
  return html;
}
function editToggleTime(pi,t){
  _collectEditInputs();
  var p=_editBuf.peptides[pi];if(!p)return;
  if(!p.times)p.times=[];
  var i=p.times.indexOf(t);
  if(i===-1)p.times.push(t);else if(p.times.length>1)p.times.splice(i,1);
  renderStackEditor();
}
function editRemovePeptide(pi){_editBuf.peptides.splice(pi,1);renderStackEditor();}
// Same defence in depth as editToggleEnhancedCompound: the locked cards do not call
// these, but rendering is presentation and these are what change the protocol. Turning
// the tier ON is refused below tier 2; turning it OFF is not, so a protocol carrying
// testosterone after a downgrade is not frozen that way.
function editToggleTRT(){
  if((_userTier||1)<2 && !(_editBuf.trt&&_editBuf.trt.enabled)){ showCompoundUpgrade('testosterone'); return; }
  if(!_editBuf.trt)_editBuf.trt={};if(!_editBuf.trt.compounds)_editBuf.trt.compounds=[];_editBuf.trt.enabled=!_editBuf.trt.enabled;_collectEditInputs();renderStackEditor();}
function editToggleTRTCompound(id){
  var _has=((_editBuf.trt&&_editBuf.trt.compounds)||[]).some(function(c){return c&&c.id===id;});
  if((_userTier||1)<2 && !_has){ showCompoundUpgrade(id); return; }
  if(!_editBuf.trt)_editBuf.trt={enabled:true,compounds:[]};if(!_editBuf.trt.compounds)_editBuf.trt.compounds=[];var idx=_editBuf.trt.compounds.findIndex(function(c){return c.id===id;});if(idx!==-1){_editBuf.trt.compounds.splice(idx,1);}else{var cat=TRT_CAT.find(function(c){return c.id===id;});if(cat)_editBuf.trt.compounds.push({id:id,name:cat.name,dose:'',unit:cat.unit||'mg',freqVal:cat.freqVal||1,freqUnit:cat.freqUnit||'weeks',days:cat.id==='nebido'?undefined:(cat.defaultDays?cat.defaultDays.slice():[1])});}_collectEditInputs();renderStackEditor();}
// A SELECT MUST NEVER DISPLAY A UNIT IT IS NOT HOLDING.
// Reported 2026-08-19: "Choosing 100mg every 2 day generates a 28mg dose instead of the
// planned 100mg." The entry stored unit "mg/week" — carried in from the Enhanced block
// by the tier migration — but this dropdown offered only mg/ml/IU/%. A <select> whose
// options do not contain its value renders the FIRST option, so the screen said "100 mg"
// while storage said "100 mg/week", and the generator's rate conversion then divided it:
// 100 / 7 * 2 = 28.6 mg. Every part of that chain was doing its job with a value the
// user had never been shown.
//
// The list therefore covers the rate units too, and any unit actually stored is appended
// if it is still not in the list. A wrong unit the user can SEE is a wrong unit the user
// can fix; a wrong unit the UI hides is a dose error.
// SCOPE, because the wizard and the editor render TRT compounds through two parallel
// code paths (_wiz.trt vs _editBuf.trt, wizSetTRT* vs the inline editor handlers).
// Duplicating the transition panel into both is how they drift apart; one renderer that
// emits the right handler names for its scope is how they cannot.
function _trtComps(scope){
  var box=(scope==='wiz')?(typeof _wiz!=='undefined'&&_wiz&&_wiz.trt)
                         :(typeof _editBuf!=='undefined'&&_editBuf&&_editBuf.trt);
  return (box&&box.compounds)||[];
}
function _trtComp(scope,id){
  return _trtComps(scope).find(function(c){return c&&c.id===id;});
}
// The protocol's own start, for whichever surface is being edited.
function _scopeCycleStart(scope){
  var box=(scope==='wiz')?(typeof _wiz!=='undefined'&&_wiz)
                         :(typeof _editBuf!=='undefined'&&_editBuf);
  return (box&&box.cycle_start)||'';
}
// Re-render whichever surface asked. The editor also has to re-collect its DOM inputs
// first or an in-progress dose edit is lost by the redraw.
function _trtRerender(scope){
  if(scope==='wiz'){
    // ⚠️ THE HANDOFF, NOT THE CLASSIC STEP.
    // This called wizStepTRT — the multi-compound step — so any re-render from the
    // wizard replaced the planner's body AND footer with the classic view, taking the
    // button that triggered it with it. Written when the classic step was the only
    // wizard TRT step; reachable the moment the planner started running a solve, where
    // it read as "clicking Generate does nothing". wizStepTRTHandoff renders whichever
    // step is actually current, and still honours _wizTrtClassic.
    var _fn=(typeof wizStepTRTHandoff==='function')?wizStepTRTHandoff
           :((typeof wizStepTRT==='function')?wizStepTRT:null);
    if(_fn)_fn(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
    return;
  }
  if(typeof _collectEditInputs==='function')_collectEditInputs();
  if(typeof renderStackEditor==='function')renderStackEditor();
}
// Schedule-pattern handlers. Switching mode keeps BOTH representations on the
// compound, so a user comparing weekday against interval and switching back loses
// nothing — only which one the generator reads changes.
// TRT's schedule control. Same markup as every other tier, with the scope baked into
// the handler names and TRT's legacy default ('interval' when a saved compound carries
// no weekdays) so nothing on disk reschedules itself on upgrade.
function _renderTRTCadence(id,selData,scope){
  return _renderCadenceControl(id,selData,{
    pre:"'"+scope+"',",
    setMode:'trtSetCadence', setVal:'trtSetFreqVal',
    setUnit:'trtSetFreqUnit', setDay:'trtSetDay'
  },'interval',_trtCadenceOf(selData));
}
// Peptides are addressed by INDEX, not id — the only structural difference between
// the tiers here — so these take the index the shared control passes through.
function _pepComp(scope,pi){
  var list=(scope==='wiz')?(typeof _wiz!=='undefined'&&_wiz&&_wiz.peptides)
                          :(typeof _editBuf!=='undefined'&&_editBuf&&_editBuf.peptides);
  return (list||[])[parseInt(pi,10)];
}
function _pepRerender(scope){
  if(scope==='wiz'){
    if(typeof wizStepConfig==='function')
      wizStepConfig(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
    return;
  }
  if(typeof _collectEditInputs==='function')_collectEditInputs();
  if(typeof renderStackEditor==='function')renderStackEditor();
}
function pepSetCadence(scope,pi,mode){
  var p=_pepComp(scope,pi); if(!p)return;
  _cadenceSetMode(p,mode);
  _pepRerender(scope);
}
function pepSetFreqVal(scope,pi,v){
  var p=_pepComp(scope,pi); if(p)p.freqVal=Math.max(1,parseInt(v,10)||1);
}
function pepSetFreqUnit(scope,pi,v){
  var p=_pepComp(scope,pi); if(!p)return;
  p.freqUnit=(v==='weeks')?'weeks':'days';
  _pepRerender(scope);
}
function pepSetDay(scope,pi,di){
  var p=_pepComp(scope,pi); if(!p)return;
  if(!p.days)p.days=[];
  var i=p.days.indexOf(di);
  if(i===-1)p.days.push(di); else if(p.days.length>1)p.days.splice(i,1);
  _pepRerender(scope);
}
function _renderPepCadence(pi,p,scope){
  return _renderCadenceControl(pi,p,{
    pre:"'"+scope+"',",
    setMode:'pepSetCadence', setVal:'pepSetFreqVal',
    setUnit:'pepSetFreqUnit', setDay:'pepSetDay'
  },'days');
}
function trtSetCadence(scope,id,mode){
  var c=_trtComp(scope,id); if(!c)return;
  _cadenceSetMode(c,mode);
  _trtRerender(scope);
}
function trtSetFreqVal(scope,id,v){
  var c=_trtComp(scope,id); if(!c)return;
  c.freqVal=Math.max(1,parseInt(v,10)||1);
  if(typeof _refreshTRTGuide==='function')_refreshTRTGuide(id,c.freqVal,c.freqUnit,c.dose);
}
function trtSetFreqUnit(scope,id,v){
  var c=_trtComp(scope,id); if(!c)return;
  c.freqUnit=(v==='weeks')?'weeks':'days';
  _trtRerender(scope);
}
function trtSetDay(scope,id,di){
  var c=_trtComp(scope,id); if(!c)return;
  if(!c.days)c.days=[];
  var i=c.days.indexOf(di);
  // Never leave zero days selected — that schedules nothing, silently.
  if(i===-1)c.days.push(di); else if(c.days.length>1)c.days.splice(i,1);
  _trtRerender(scope);
}
function trtSetDate(scope,id,which,val){
  var c=_trtComp(scope,id);if(!c)return;
  if(val)c[which]=val;else delete c[which];
  _trtRerender(scope);
}
function trtToggleRamp(scope,id){
  var c=_trtComp(scope,id);if(!c)return;
  if(c.dose_phases&&c.dose_phases.length){
    delete c.dose_phases;
  }else{
    // Seed week 0 from the flat dose so turning the ramp ON never changes what is
    // scheduled until a phase is actually edited. A ramp that silently rewrites week 0
    // is a dose change the user did not ask for.
    c.dose_phases=[{w:0,d:String(c.dose||''),u:c.unit||'mg'}];
  }
  _trtRerender(scope);
}
function trtAddPhase(scope,id){
  var c=_trtComp(scope,id);if(!c)return;
  if(!c.dose_phases)c.dose_phases=[];
  var lastW=c.dose_phases.length?Math.max.apply(null,c.dose_phases.map(function(ph){return ph.w||0;})):0;
  var lastU=c.dose_phases.length?c.dose_phases[c.dose_phases.length-1].u:(c.unit||'mg');
  c.dose_phases.push({w:lastW+2,d:'',u:lastU});
  _trtRerender(scope);
}
function trtRemovePhase(scope,id,phi){
  var c=_trtComp(scope,id);if(!c||!c.dose_phases)return;
  c.dose_phases.splice(phi,1);
  if(!c.dose_phases.length)delete c.dose_phases;
  _trtRerender(scope);
}
function trtSetPhase(scope,id,phi,field,val){
  var c=_trtComp(scope,id);if(!c||!c.dose_phases||!c.dose_phases[phi])return;
  c.dose_phases[phi][field]=val;
}
// Editor-scoped aliases — the editor's existing handlers are all edit*-named, and the
// inline onclick attributes elsewhere in that block follow that convention.
function _editTrtComp(id){return _trtComp('edit',id);}
function editSetTRTDate(id,which,val){trtSetDate('edit',id,which,val);}
function editToggleTRTRamp(id){trtToggleRamp('edit',id);}
function editAddTRTPhase(id){trtAddPhase('edit',id);}
function editRemoveTRTPhase(id,phi){trtRemovePhase('edit',id,phi);}
function editSetTRTPhase(id,phi,field,val){trtSetPhase('edit',id,phi,field,val);}

// ── BUILD A SCHEDULE FROM A TARGET FREE-T LEVEL ─────────────────────────────
// Henrik, 2026-08-28: "Calling this feature a on-ramp is wrong, it is just a new way
// of creating a TRT/Test protocol with a targeted free T."
//
// He is right, and the old name misdescribed the scope. "On-ramp" implies a temporary
// run-up to something else, which is only one of the cases this covers — it is equally
// the way you set up a plain TRT protocol by naming the level you want instead of
// guessing a milligram figure. Any outgoing ester still clearing is an INPUT to that,
// not the point of it.
// "Both cadence and dose (in 0.1 ml steps) needs to be created by the app" — doing
// this by hand means inverting a calibrated PK model against a decaying tail, week
// by week, then rounding to what a syringe can actually draw. That is not a manual
// task.
//
// The solve lives in tab-tcalc.js because T-Calc owns the model (doc 13, SETTLED).
// This is only the form and the result table: it collects the target and the vial,
// hands them to tcSolveTransition, and writes the answer into the same dose_phases /
// days / freqVal fields the generator already reads. Nothing here knows any
// pharmacology and it must stay that way — a second model would be free to disagree
// with the curve on screen.
var _trtSolveState={};
// ⚠️ THE SOLVE HORIZON MUST FOLLOW THE PROTOCOL, NOT A CONSTANT.
// This defaulted to 16 weeks with nothing connecting it to the protocol's own length,
// while the wizard defaults a protocol to 12. Anyone taking both defaults lost the top
// of their ramp: the generator stops at the protocol's end, so the last phases never
// schedule — and those are the steepest ones, where the outgoing ester is clearing
// fastest and the incoming dose should be climbing hardest. Measured on a real 12-week
// protocol solved over 16: phases w13=138 mg/wk and w14=150 mg/wk simply vanished.
function _trtSolveWeeksDefault(scope){
  var cl=0;
  var box=(scope==='wiz')?(typeof _wiz!=='undefined'&&_wiz)
                         :(typeof _editBuf!=='undefined'&&_editBuf);
  if(box&&box.cycle_length>0)cl=parseInt(box.cycle_length,10)||0;
  if(!(cl>0))return 16;                 // open-ended protocol — no length to follow
  return Math.max(4,Math.min(52,cl));
}
function _trtSolveSt(id,scope){
  if(!_trtSolveState[id])_trtSolveState[id]={target:'',conc:'',
    weeks:_trtSolveWeeksDefault(scope),step:'0.05',maxInj:'',minMl:'0.1',running:false,result:null,error:''};
  return _trtSolveState[id];
}
// ⚠️ NEVER RE-RENDER FROM A TEXT INPUT'S oninput HANDLER.
// This redrew the whole panel on every keystroke, which tears out the <input> being
// typed into and takes focus — and therefore the iOS keyboard — with it. The target
// field dismissed the keypad after every single digit.
//
// wizSetDose already carries this lesson ("a full re-render on every keystroke would
// tear out the input being typed into and take the caret with it") and refreshes only
// its dependent element in place. Same treatment: the typed value is stored, and any
// stale result is cleared by emptying its own container rather than by redrawing the
// form around the caret.
//
// The two SELECTs still re-render — they change the "= N mg per step" line, and a
// select has already dismissed the keyboard by the time it fires.
function trtSolveSet(scope,id,field,val){
  var st=_trtSolveSt(id); st[field]=val; st.error='';
  var typed=(field==='target'||field==='weeks');
  if(st.result){
    st.result=null;
    var node=(typeof document!=='undefined')?document.getElementById('trt-solve-res-'+id):null;
    if(node)node.innerHTML='';
    else if(typed)return;            // nothing to clear in place; do not steal focus
  }
  if(!typed)_trtRerender(scope);
}
// ⚠️ A TESTOSTERONE ARRIVES WITH NO DOSE. THIS IS DELIBERATE.
// Henrik, 2026-08-28: "Why Dafuk would there be a default dose to start with?"
//
// It was quick-add convenience: pick a compound and it arrives ready to save, seeded
// from the catalogue's Standard-TRT tier. For a dosing app that is the wrong trade.
// The dose IS the clinical decision, and a pre-filled one is indistinguishable from a
// chosen one — it immediately generates real injections, drives the plasma curve, and
// appears in Today as doses to tick. A user who asked only for a 1400 pmol/L target
// still had 125 mg every Monday scheduled on their behalf, and the curve ran to 2349.
//
// The CADENCE default stays. A schedule shape is a starting point the user can see and
// change; a milligram figure the app invented is a decision made for them.
// TRT_CAT.defaultDose is still read by the AAS sheet and the enhanced tier, which is
// why it remains in the catalogue.

// What this compound actually schedules as things stand, in the user's own terms.
function _trtCurrentScheduleLabel(c){
  if(!c)return '';
  // ⚠️ AN UNSET DOSE IS NOT A DOSE.
  // Since a testosterone arrives with no dose, c.dose is '' until the user sets one or
  // applies a plan — and this built the label by concatenation, so it rendered as
  // "still scheduling mg, every week". Worse than ugly: it claimed something was being
  // scheduled when nothing is.
  var hasRamp=!!(c.dose_phases&&c.dose_phases.length);
  var hasDose=parseDec(c.dose)>0;
  if(!hasRamp&&!hasDose)return 'NONE';
  var dose=hasRamp
    ? 'a ramp of '+c.dose_phases.length+' steps'
    : (String(c.dose)+' '+(c.unit||'mg')).trim();
  var cad=(typeof _trtCadenceLabel==='function')?_trtCadenceLabel(c):'';
  if(!cad)return dose;
  // "125 mg M" is accurate and unreadable. A weekday label needs joining words; an
  // interval label ("Every 2 days") already reads as one.
  return /^Every /.test(cad)
    ? (dose+', '+cad.charAt(0).toLowerCase()+cad.slice(1))
    : (dose+' on '+cad);
}
function _trtDefaultConc(id){
  var cat=(typeof TRT_CAT!=='undefined')?TRT_CAT.find(function(c){return c.id===id;}):null;
  return (cat&&cat.conc&&cat.conc.length)?cat.conc[0]:250;
}
async function trtSolveRun(scope,id){
  var st=_trtSolveSt(id,scope);
  var comp=_trtComp(scope,id);
  if(!comp){st.error='Compound not found.';_trtRerender(scope);return;}
  st.running=true; st.error=''; st.result=null; _trtRerender(scope);
  try{
    // The tail must come from LOGGED injections, not from the plan. The question is
    // where the outgoing ester actually leaves you, and a plan is not a record.
    if(typeof _tcFetchHistory==='function'&&(typeof _tcHistory==='undefined'||!_tcHistory))
      await _tcFetchHistory(true);
    var hist=(typeof _tcHistory!=='undefined'&&_tcHistory)?_tcHistory.slice():[];
    // YIELD BEFORE THE SOLVE. tcSolveTransition is synchronous and runs the PK model
    // ~40 times — seconds on a phone, with the main thread blocked throughout. When the
    // history is already cached there is no await above this point, so the 'Solving…'
    // state never gets a frame to paint in and the button just appears dead. One turn
    // of the event loop is enough for the render to land first.
    await new Promise(function(r){setTimeout(r,0);});
    var start=comp.start_date||(typeof dateKey==='function'?dateKey(new Date(NOW.getTime()+86400000)):'');
    var _inc=(typeof _canonCompoundId==='function')?_canonCompoundId(id):id;
    // ── AND WHAT IS STILL SCHEDULED OF THE OUTGOING ESTER ────────────────────
    // The tail above is the logged past. It is not the whole picture: if the protocol
    // still has the outgoing ester booked in — "more Nebido to come" — that drug is
    // going in whatever the solve says, and the ramp has to be sized on top of it.
    // Without this the solver sized Test E for a gap the continuing Nebido never left
    // open, and the plotted curve ran to 2326 pmol/L against a 1400 target.
    //
    // Everything EXCEPT the compound being solved for: its own currently-scheduled rows
    // are the plan this solve is about to replace, so counting them would have the ramp
    // stack on top of itself. Same source the plasma curve reads, so the solve and the
    // chart it is checked against finally see the same future.
    var sched=[];
    if(typeof _tcProtocolInjections==='function'){
      (_tcProtocolInjections()||[]).forEach(function(e){
        if(!e||!e.date||!(parseDec(e.doseMg)>0))return;
        var eid=(typeof _tcCanonCompId==='function')?_tcCanonCompId(e.compId):e.compId;
        if(eid===_inc)return;
        sched.push({compId:eid,doseMg:String(e.doseMg),date:e.date});
      });
    }
    var res=(typeof tcSolveTransition==='function')?tcSolveTransition({
      history:hist, scheduled:sched, incomingId:_inc,
      startDate:start, targetPmol:st.target,
      concMgPerMl:parseDec(st.conc)||_trtDefaultConc(id),
      stepMl:parseDec(st.step)||0.05, weeks:parseInt(st.weeks,10)||16,
      // '' means no cap — the solver then ranks on the standing per-injection price
      // alone, which is the default and the behaviour everyone had before.
      maxInjPerWeek:parseDec(st.maxInj)||0,
      // '' is an explicit "no floor", distinct from unset — parseDec('')||0 gives 0,
      // which the solver reads as no constraint.
      minMl:(st.minMl===''?0:(parseDec(st.minMl)||0))
    }):null;
    if(!res)st.error='Could not solve — check the target, the start date, and that you have logged injections to model the tail from.';
    st.result=res;
  }catch(e){
    st.error='Solve failed: '+String(e&&e.message||e);
    if(typeof _logErr==='function')_logErr('trtSolveRun',e);
  }
  st.running=false; _trtRerender(scope);
}
// Write the solved answer in. CADENCE AND DOSE TOGETHER — a ramp without its cadence
// is half an instruction, because the same mg on a different interval is a different
// curve.
// Apply ANY of the solved options, not only the auto-pick. "Cadence and draw are both
// variables you need to use" — so the alternatives are shown with their numbers and each
// one is applicable, rather than the app silently choosing and hiding the trade-off.
// The trade-off is real and has no single right answer: shorter intervals cut the
// within-week swing, longer ones give finer control of the WEEKLY milligrams (one
// syringe step is spread over fewer injections), which is what tracks a decaying tail.
function trtSolveApply(scope,id,which){
  var st=_trtSolveSt(id), comp=_trtComp(scope,id);
  if(!st.result||!comp)return;
  var pick=st.result.best;
  if(which!=null&&which!=='best'){
    var alt=(st.result.alternatives||[])[parseInt(which,10)];
    if(alt)pick=alt;
  }
  var cad=pick.cadence;
  st._applied=pick;
  // Set the MODE explicitly, not just the fields. Inference would read a solved
  // weekday answer on a Nebido row as interval (the legacy rule) and schedule
  // something the solver never proposed.
  if(cad.dithered){
    comp.cadence='interval'; comp.freqVal=1; comp.freqUnit='days';
  }
  else if(cad.variable){
    // A variable-interval answer has no single cadence — each phase carries its own
    // `iv`. The compound still needs a base cadence for any date the phases do not
    // cover (and for the summary line), so it takes the first phase's interval.
    comp.cadence='interval';
    comp.freqVal=(pick.phases&&pick.phases[0]&&pick.phases[0].iv)||2;
    comp.freqUnit='days';
  }
  else if(cad.days){ comp.cadence='days'; comp.days=cad.days.slice(); }
  else { comp.cadence='interval'; comp.freqVal=cad.freqVal; comp.freqUnit=cad.freqUnit; }
  var phases=(pick===st.result.best)?st.result.dose_phases
            :pick.phases.map(function(p){
                var e={w:p.w,d:String(Math.round(p.mg*10)/10),u:'mg'};
                if(p.iv>0)e.iv=p.iv;
                if(p.pattern&&p.pattern.length)e.pattern=p.pattern.slice();
                return e;
              });
  // ⚠️ TRANSLATE THE RAMP INTO THE PROTOCOL'S WEEK NUMBERING.
  // dose_phases are read by the generator as weeks from the PROTOCOL's cycle_start —
  // that is the established contract and what the ramp editor's copy tells the user.
  // The solver numbers its phases from the ESTER's own start date, because that is the
  // only origin the transition means anything in. For a compound added partway through
  // a running protocol those differ, and the ramp lands at the wrong offset.
  //
  // Measured on the reported transition — protocol running since 26 Jun, Test E starting
  // 28 Aug, a nine-week gap:
  //   intended  188 188 188 188 188 200 225 225 238 250 263 275 275 275 288 288
  //   actual    250 263 275 275 275 288 288 288 288 288 288 288 288 288 288 288
  // The ramp was spent in five weeks and then pinned at its maximum, so it opened above
  // target and had nothing left to rise with when the outgoing ester cleared — the level
  // decayed for the rest of the plan instead of holding.
  var _csRaw=_scopeCycleStart(scope);
  var _offW=0;
  if(_csRaw&&comp.start_date){
    var _cs=parseLocalDate(_csRaw), _sd=parseLocalDate(comp.start_date);
    if(_cs&&_sd&&!isNaN(_cs.getTime())&&!isNaN(_sd.getTime()))
      _offW=Math.round((_sd-_cs)/604800000);
    if(!(_offW>0))_offW=0;
  }
  var _mapped=phases.map(function(p){
    var e={w:(p.w||0)+_offW,d:p.d,u:p.u};
    if(p.iv>0)e.iv=p.iv;      // per-phase interval survives the round trip
    if(p.pattern&&p.pattern.length)e.pattern=p.pattern.slice();   // and the day pattern
    return e;
  });
  // ── A CONSTANT DOSE IS NOT A RAMP ────────────────────────────────────────────
  // Reported 2026-09-10 (prod v1.318): "Protocol 5 has Test E at 100mg e2d. If I drop it
  // to 50mg e2d the curve doesn't change at all" — and then, decisively: "It's on but I
  // never flipped it on."
  //
  // He did not. The phase builder in _tcSolveSchedule emits a phase wherever the dose
  // CHANGES, and its loop always pushes week 0 (prev===null). A plain maintenance solve
  // with no outgoing ester tail never changes dose, so it yields EXACTLY ONE phase — and
  // this wrote it to dose_phases regardless. That single phase carries no ramp
  // information at all: it is the flat dose under another name. What it does carry is
  // consequences — the Dose ramp toggle reads as ON (hasRamp is length-based), and the
  // generator resolves through _effectiveDoseAt, so the Dose field goes permanently
  // inert. Editing 100 -> 50 then changes nothing, and survives a restart because the
  // written injections genuinely still hold the old mg.
  //
  // So: one phase means set the flat dose and leave the ramp OFF. Multi-phase output is
  // untouched — a real ester transition is what the ramp is for, and clearing that would
  // break the feature the solver exists to provide.
  //
  // A per-phase interval or day pattern is the exception. Those are CADENCE, not dose,
  // and the compound has nowhere else to keep them, so a lone phase carrying either must
  // stay a ramp or the solved schedule silently loses its cadence.
  var _lone=_mapped.length===1&&!(_mapped[0].iv>0)&&!(_mapped[0].pattern&&_mapped[0].pattern.length);
  if(_lone)delete comp.dose_phases;   // also clears a stale ramp from an earlier solve
  else comp.dose_phases=_mapped;
  // ── THE LOADING DOSE COMES WITH THE PLAN IT WAS SIZED FOR ────────────────
  // A front-load is computed against the maintenance rate of ONE schedule — the depot
  // it has to fill is that schedule's depot. Applying a different option must therefore
  // not carry the winner's loading dose across, and must clear any left over from an
  // earlier solve, or the protocol keeps a front-load sized for a plan it no longer runs.
  var _load=(pick===st.result.best)?st.result.loading:null;
  if(_load&&_load.mg>0) comp.load_mg=String(_load.mg);
  else delete comp.load_mg;
  // ⚠️ THE CAP TRAVELS WITH THE PLAN, or the generator cannot honour it.
  // The solver trims its candidate days so the cap counts doses already taken
  // (_injCapTrim); the generator has to trim the SAME days or the rows written would
  // not be the rows scored. Stored per compound because the cap is per compound.
  var _cap=parseDec(st.maxInj)||0;
  if(_cap>0) comp.max_inj_week=String(_cap);
  else delete comp.max_inj_week;
  comp.unit='mg';
  // Keep the flat dose in step with the maintenance dose, so turning the ramp OFF
  // later lands on the held dose rather than whatever was in the box beforehand.
  var lastPh=phases[phases.length-1];
  if(lastPh)comp.dose=String(lastPh.d);
  // ⚠️ THE SOLVE MUST OUTLIVE THE SESSION.
  // st._applied is in-memory, so reopening the app left the debug dump reporting
  // "none run this session" — and the predicted-vs-plotted pairing, which is the one
  // comparison a screenshot can never give and the thing that found two bugs today,
  // is exactly what goes missing. The ramp itself survives in dose_phases; what does
  // not is what the solver PREDICTED it would do, which is the half you need to tell
  // "the plan is wrong" from "the plan is right and the model of it is wrong".
  _trtSaveSolveRecord(id,st,pick);
  st.result=null;
  _trtRerender(scope);
}
// Small, and deliberately not part of the protocol document — this is diagnostic
// history, not plan data, and it must never travel to prod through the promotion of a
// saved protocol.
var _TRT_SOLVE_LOG_KEY='proto-trt-solve-log';
function _trtSaveSolveRecord(id,st,pick){
  if(typeof localStorage==='undefined'||!pick)return;
  try{
    var rec={id:id, at:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),
      target:st.target, conc:st.conc, step:st.step, weeks:st.weeks,
      label:(pick.cadence&&pick.cadence.label)||'',
      worst:pick.worst, worstSettled:pick.worstSettled, ripple:pick.ripple,
      drift:pick.drift, settleWeeks:pick.settleWeeks,
      phases:(pick.phases||[]).map(function(x){return {w:x.w,perWeek:x.perWeek};}),
      weekly:(pick.weekly||[]).map(function(x){return Math.round(x.mean);})};
    var all={};
    try{all=JSON.parse(localStorage.getItem(_TRT_SOLVE_LOG_KEY)||'{}')||{};}catch(e){}
    all[id]=rec;
    localStorage.setItem(_TRT_SOLVE_LOG_KEY,JSON.stringify(all));
  }catch(e){}
}
// Read side, kept here rather than in the dump so the dump itself touches no storage.
function _trtLastSolveRecords(){
  if(typeof localStorage==='undefined')return {};
  try{return JSON.parse(localStorage.getItem(_TRT_SOLVE_LOG_KEY)||'{}')||{};}catch(e){return {};}
}
// ⚠️ IN THE WIZARD, "NEXT" GENERATES.
// Henrik, 2026-08-28: "Clicking Next after picking free T target should just generate
// doses, the generate button is a unnecessary step and its also hidden."
//
// Both true: it sat below the inputs, where the footer's own Next button already lives —
// so the primary action was duplicated and the copy that mattered was the one you could
// not see. hideRun drops it wherever the footer drives the solve instead.
function _renderTRTSolve(c,selData,scope,hideRun){
  var id=c.id, st=_trtSolveSt(id,scope);
  var conc=st.conc||String(_trtDefaultConc(id));
  var cat=(typeof TRT_CAT!=='undefined')?TRT_CAT.find(function(x){return x.id===id;}):null;
  var concs=(cat&&cat.conc&&cat.conc.length)?cat.conc:[250,100];
  var q=function(fn,extra){return fn+"('"+scope+"','"+id+"'"+(extra||'')+")";};
  var h='<div class="cfg-row" style="display:block;border-top:1px solid var(--border);padding-top:10px;margin-top:4px">'
    +'<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--accent);text-transform:uppercase;margin-bottom:6px">Target free T</div>'
    +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:8px">Name the free-T level you want and the app works out the injection schedule that holds it — how often, and how much to draw each time. Anything still clearing from a previous ester is taken into account, read from your LOGGED injections, so untick anything you did not actually take.</div>'
    +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
      +'<span style="font-size:11px;color:var(--muted2);min-width:56px">Target</span>'
      +'<input class="dose-in" type="text" inputmode="decimal" value="'+_esc(String(st.target||''))+'" placeholder="pmol/L" oninput="'+q('trtSolveSet',",'target',this.value")+'" style="width:80px">'
      +'<span style="font-size:11px;color:var(--muted2)">pmol/L</span></div>'
    +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
      +'<span style="font-size:11px;color:var(--muted2);min-width:56px">Vial</span>'
      +'<select class="unit-sel" onchange="'+q('trtSolveSet',",'conc',this.value")+'">'
      +concs.map(function(cc){return '<option value="'+cc+'"'+(String(cc)===String(conc)?' selected':'')+'>'+cc+' mg/ml</option>';}).join('')
      +'</select>'
      +'<span style="font-size:11px;color:var(--muted2);margin-left:6px">Weeks</span>'
      +'<input class="dose-in" type="number" inputmode="numeric" min="4" max="52" value="'+String(st.weeks||16)+'" oninput="'+q('trtSolveSet',",'weeks',this.value")+'" style="width:52px;text-align:center"></div>'
    // A horizon past the protocol's end is not an error — the user may be about to
    // extend it — but the phases beyond that end will not schedule, and saying nothing
    // is how the top of the ramp disappeared silently.
    +(function(){
        var cl=_trtSolveWeeksDefault(scope), wv=parseInt(st.weeks,10)||0;
        var box=(scope==='wiz')?(typeof _wiz!=='undefined'&&_wiz)
                               :(typeof _editBuf!=='undefined'&&_editBuf);
        if(!box||!(box.cycle_length>0)||wv<=cl)return '';
        return '<div style="font-size:11px;color:#f59e0b;line-height:1.5;margin:-2px 0 8px">'
          +'This protocol runs '+box.cycle_length+' weeks. Anything past week '+cl
          +' will not be scheduled — shorten the solve, or lengthen the protocol.</div>';
      })()
    // THE STEP IS THE LEVER THAT MATTERS, so it is a control rather than a constant.
    // At 250 mg/ml — the standard vial — 0.1 ml steps are 25 mg, which is too coarse
    // to track a decaying tail and is what makes the level sag between steps.
    //
    // ⚠️ THIS IS ROUNDING, NOT A DOSE. "Draw to 0.025 ml" was read as "inject 0.025 ml"
    // — reported 2026-09-16, sitting one row above the 0.1 ml floor and appearing to
    // contradict it. It does not: a 0.025 ml step with a 0.1 ml floor yields 0.100,
    // 0.125, 0.150 … every one of them at or above the floor, and the finer grid is what
    // lets the weekly load land where the solve wants it (measured: 0.1 → 0.05 → 0.01 ml
    // steps take one solve from 13% drift to 10% to 4%). The two controls do different
    // jobs and now say which.
    +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
      +'<span style="font-size:11px;color:var(--muted2);min-width:70px">Round to</span>'
      +'<select class="unit-sel" onchange="'+q('trtSolveSet',",'step',this.value")+'">'
      +[['0.1','0.1 ml'],['0.05','0.05 ml'],['0.025','0.025 ml']].map(function(o){
          return '<option value="'+o[0]+'"'+(String(st.step||'0.05')===o[0]?' selected':'')+'>'+o[1]+'</option>';
        }).join('')
      +'</select>'
      +'<span style="font-size:11px;color:var(--muted2)">steps of '
      +(Math.round((parseDec(conc)||250)*(parseDec(st.step)||0.05)*10)/10)+' mg</span></div>'
    +'<div style="font-size:10px;color:var(--muted2);opacity:0.8;margin:0 0 10px 76px;line-height:1.45">'
      +'How finely a dose can be sized \u2014 not how much you inject. The floor below '
      +'sets the smallest injection.</div>'
    // ── HOW OFTEN YOU ARE WILLING TO INJECT IS AN INPUT, NOT AN OUTPUT ───────
    // Henrik, 2026-09-16, on a plan that asked for a 25 mg jab every day: "I do loose
    // oil since the syringe and needle head still contains some oil that gets wasted.
    // Also cost of syringes and needles becomes wasteful."
    //
    // The solver prices injections now, so a frequent plan has to earn its smoothness.
    // This is the hard override on top of that price, for when the answer is simply
    // "not daily, whatever the model says". Left empty it does nothing.
    +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'
      +'<span style="font-size:11px;color:var(--muted2);min-width:56px">At most</span>'
      +'<select class="unit-sel" onchange="'+q('trtSolveSet',",'maxInj',this.value")+'">'
      +[['','no limit'],['7','1 a day'],['4','4 a week'],['3','3 a week'],
        ['2','2 a week'],['1','1 a week']].map(function(o){
          return '<option value="'+o[0]+'"'+(String(st.maxInj||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';
        }).join('')
      +'</select>'
      +'<span style="font-size:11px;color:var(--muted2)">injections</span></div>'
    // ── THE SMALLEST DRAW WORTH SCHEDULING ──────────────────────────────────
    // Henrik, 2026-09-16: "Also set min injection to 0,1ml." Below about a tenth of a
    // millilitre the syringe stops being the instrument the plan assumes: dead space is
    // ~0.07-0.10 ml, so the hub keeps more than the muscle gets, and a 1 ml barrel
    // cannot be read to a fraction of it. The solver meets this by injecting less often
    // and more at a time, never by rounding a dose up.
    +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
      +'<span style="font-size:11px;color:var(--muted2);min-width:70px">Never inject less than</span>'
      +'<select class="unit-sel" onchange="'+q('trtSolveSet',",'minMl',this.value")+'">'
      +[['0.1','0.1 ml'],['0.05','0.05 ml'],['0.15','0.15 ml'],['0.2','0.2 ml'],['','no floor']]
        .map(function(o){
          return '<option value="'+o[0]+'"'+(String(st.minMl===''?'':(st.minMl||'0.1'))===o[0]?' selected':'')+'>'+o[1]+'</option>';
        }).join('')
      +'</select>'
      +'<span style="font-size:11px;color:var(--muted2)">at a time ('
      +(Math.round((parseDec(conc)||250)*(parseDec(st.minMl)||0)*10)/10)+' mg)</span></div>'
    +'<div style="font-size:10px;color:var(--muted2);opacity:0.8;margin:0 0 10px 76px;line-height:1.45">'
      +'The smallest single injection the plan may ask for. Met by injecting less often, '
      +'never by rounding a dose up.</div>'
    +'<button onclick="'+q('trtSolveRun')+'"'+(st.running?' disabled':'')
      +' style="width:100%;background:var(--accent);color:#0a0a0a;border:none;border-radius:8px;padding:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:0.5px;'+(st.running?'opacity:0.6;':'')+'">'
      +(st.running?'Solving…':'Generate schedule')+'</button>';
  if(hideRun)h=h.replace(/<button onclick="trtSolveRun\([^"]*"[^>]*>[^<]*<\/button>/,'');
  if(st.error)h+='<div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:6px;padding:8px 10px;margin-top:8px;font-size:11px;color:#f59e0b;line-height:1.5">'+_esc(st.error)+'</div>';
  // Everything the solve produces lives in one node, so a keystroke can drop a stale
  // result without redrawing the input the user is typing into.
  h+='<div id="trt-solve-res-'+_esc(id)+'">';
  if(st.result&&st.result.degenerate&&!st.result.best){
    h+='<div style="margin-top:10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.5);border-radius:8px;padding:10px 12px;font-size:11px;color:#f59e0b;line-height:1.55">'
      +(st.result.notes||[]).map(_esc).join('<br><br>')+'</div>';
  }
  else if(st.result&&st.result.best){
    var r=st.result, b=r.best;
    // ⚠️ THE ACTION SITS ABOVE THE THING IT ACTS ON.
    // Henrik, 2026-08-28: "The Apply Cadence button needs to be presented in an overlay
    // instead invisible down under the generated schedule."
    //
    // It was the last element of the result card, below the full ramp, every weekly
    // chip, the notes and the vial advice — so on a twelve-week plan the button you must
    // press to make any of it real was off-screen, and the wizard's own fixed "Next"
    // footer sat where a reader expects the primary action. Sticking it to the top of
    // the results keeps it in reach for the whole scroll without competing with Next.
    h+='<div style="position:sticky;top:0;z-index:25;background:var(--bg);padding:10px 0 8px;margin-top:10px">';
    h+=(function(){
          var cur=_trtCurrentScheduleLabel(c);
          if(!cur)return '';
          if(st._applied){
            return '<div style="background:rgba(90,209,176,0.10);border:1px solid rgba(90,209,176,0.4);'
              +'border-radius:8px;padding:8px 10px;font-size:11px;color:#5ad1b0;line-height:1.5;margin-bottom:8px">'
              +'Applied. This protocol now schedules <b>'+_esc(cur)+'</b>.</div>';
          }
          var body=(cur==='NONE')
            ? 'Not applied yet. This compound has no dose set, so <b>nothing is being '
              +'scheduled</b>. Apply to use this plan.'
            : ('Not applied yet. This protocol is still scheduling <b>'+_esc(cur)+'</b>'
               +(c.dose_phases&&c.dose_phases.length?'':' — not this plan')+'. Apply to replace it.');
          return '<div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.45);'
            +'border-radius:8px;padding:8px 10px;font-size:11px;color:#f59e0b;line-height:1.5;margin-bottom:8px">'
            +body+'</div>';
        })();
    h+='<button onclick="'+q('trtSolveApply',",'best'")+'" style="width:100%;background:var(--accent);color:#0a0a0a;border:none;border-radius:8px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Apply cadence + ramp</button>';
    h+='</div>';
    // ── THE LOADING DOSE IS A DIFFERENT INSTRUCTION AND GETS ITS OWN BOX ─────
    // Every other number on this card is "do this repeatedly". This one is "do this
    // once, first", and folding it into the ramp table is how it would be missed or —
    // far worse — repeated. It sits above the schedule because it happens before it.
    h+=(function(){
      var L=r.loading;
      if(!L||!(L.mg>0))return '';
      return '<div style="background:rgba(90,209,176,0.10);border:1px solid rgba(90,209,176,0.45);'
        +'border-radius:8px;padding:10px 12px;margin-bottom:8px">'
        +'<div style="font-size:12px;font-weight:700;color:#5ad1b0;margin-bottom:3px">'
        +'Loading dose &mdash; once, on '+_esc(L.date)+'</div>'
        +'<div style="font-size:11px;color:var(--muted2);line-height:1.55">'
        +'Make that first injection <b>'+L.firstDoseMg+' mg</b> ('+L.ml+' ml more than the '
        +L.maintenanceMg+' mg the schedule calls for), then carry on as below. '
        +'It fills the depot to the level this plan maintains instead of waiting for it '
        +'to fill at the maintenance rate, so you reach target in '
        +(L.weeksWith?('about week '+L.weeksWith):'the first week')+' rather than '
        +(L.weeksWithout?('week '+L.weeksWithout):'not at all inside this plan')+'.'
        +'<br><b>One bigger injection, not an extra one.</b> Applying this plan writes it '
        +'into the first dose for you.</div></div>';
    })();
    h+='<div style="background:var(--surface2);border:1px solid var(--accent);border-radius:8px;padding:10px 12px">'
      +'<div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:2px">'+_esc(b.cadence.label)+'</div>'
      +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:8px">'
        +'Holds '+Math.round(b.lowPmol)+'–'+Math.round(b.highPmol)+' pmol/L across the plan'
        +' · within-week swing '+Math.round(b.ripple*100)+'%</div>'
      // A schedule that cannot hold the target is said so up front, not left for the
      // reader to work out from a table of week numbers. The previous headline quoted
      // the settled tail only, which read as 5% while the plan actually spanned 26%.
      +((b.drift>0.12||b.meanErr>r.target*0.08)
        ? ('<div style="font-size:11px;color:#f59e0b;line-height:1.5;margin-bottom:8px;font-weight:600">'
           +'⚠ This does not hold '+Math.round(r.target)+' steadily — the level moves about '
           +Math.round(b.drift*100)+'% of target across the plan'
           +(b.stepPmol>r.target*0.08?', because one syringe step is bigger than the correction needed. See the vial note below.':'.')
           +'</div>')
        : '')
      +'<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:4px">Ramp</div>'
      +(function(){
        // WEEKLY MILLIGRAMS IS THE NUMBER THE USER REASONS IN. Per-injection mg alone
        // hides that the same dose means a different weekly load at a different cadence,
        // which is exactly the pair of variables being traded off here.
        var ivd=(typeof _cadenceIntervalDays==='function')
          ? _cadenceIntervalDays(b.cadence.days?{cadence:'days',days:b.cadence.days}
                                                :{cadence:'interval',freqVal:b.cadence.freqVal,freqUnit:b.cadence.freqUnit})
          : 1;
        return b.phases.map(function(ph){
          // A phase may carry its OWN interval now, so the row has to state it — the
          // card's cadence line is only the default when a phase does not override it.
          var iv=ph.iv>0?ph.iv:ivd;
          var perWk=iv>0?(ph.mg*7/iv):0;
          // A dithered phase has no single per-injection dose — it is a repeating week
          // of two adjacent syringe steps, and showing only the average would hide what
          // to actually draw on each day.
          if(ph.pattern&&ph.pattern.length){
            var conc=parseDec(st.conc)||_trtDefaultConc(id);
            return '<div style="font-size:11px;color:var(--text);line-height:1.6;margin-bottom:5px">'
              +'<div style="display:flex;gap:8px;flex-wrap:wrap"><span style="color:var(--muted2);min-width:44px">Wk '+ph.w+'</span>'
              +'<span style="color:var(--accent2,#8ab4f8);min-width:40px">daily</span>'
              +'<span style="color:var(--muted2)">'+ph.perWeek+' mg/wk</span></div>'
              +'<div style="display:flex;gap:4px;flex-wrap:wrap;margin:3px 0 0 52px">'
              +ph.pattern.map(function(mgv){
                  return '<span style="font-size:10px;font-weight:700;color:var(--accent);border:1px solid var(--border);border-radius:4px;padding:1px 5px">'
                    +(Math.round(mgv*10)/10)+'<span style="color:var(--muted2);font-weight:400"> · '
                    +(conc>0?(mgv/conc).toFixed(2):'?')+'ml</span></span>';
                }).join('')
              +'</div></div>';
          }
          return '<div style="display:flex;gap:8px;font-size:11px;color:var(--text);line-height:1.7;flex-wrap:wrap">'
            +'<span style="color:var(--muted2);min-width:44px">Wk '+ph.w+'</span>'
            +(ph.iv>0?('<span style="color:var(--accent2,#8ab4f8);min-width:40px">'+(ph.iv===1?'daily':'E'+ph.iv+'D')+'</span>'):'')
            +'<span style="font-weight:700;color:var(--accent);min-width:56px">'+(Math.round(ph.mg*10)/10)+' mg</span>'
            +'<span style="color:var(--muted2);min-width:52px">'+ph.ml.toFixed(2)+' ml</span>'
            +'<span style="color:var(--muted2)">'+Math.round(perWk)+' mg/wk</span></div>';
        }).join('');
      })()
      +'<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:8px 0 4px">Predicted free T</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:3px">'
      +b.weekly.map(function(w){
        var off=r.target>0?Math.abs(w.mean-r.target)/r.target:0;
        var col=off<0.08?'#4ade80':(off<0.18?'#f59e0b':'#ef4444');
        return '<div style="font-size:9px;color:'+col+';border:1px solid '+col+';border-radius:4px;padding:1px 4px">w'+w.week+' '+Math.round(w.mean)+'</div>';
      }).join('')+'</div>'
      +(r.notes||[]).map(function(n){
        return '<div style="font-size:10px;color:var(--muted2);line-height:1.5;margin-top:6px">ℹ '+_esc(n)+'</div>';
      }).join('')
      // ⚠️ SAY WHAT IS ACTUALLY SCHEDULED RIGHT NOW.
      // Henrik, 2026-08-28: "Where does the flat 125mg come from? I haven't entered a
      // single value more than the 1400pmol target."
      //
      // He had not. Adding a testosterone seeds the catalogue's defaultDose — 125 mg
      // once weekly for enanthate — and that is a REAL, SCHEDULED plan from the moment
      // the compound exists. So the panel could show a solved ramp holding 1400 while
      // the protocol quietly injected a dose the user never chose, and the curve climbed
      // to 2349. Solving is not applying, and nothing here said so: the proposal read as
      // the plan.
      //
      // This does not auto-apply. The choice stays the user's — it just stops being an
      // invisible one.
      +'</div>';
    // THE TRADE-OFF IS THE USER'S TO MAKE. A shorter interval cuts the within-week
    // swing; a longer one gives finer control of the weekly milligrams, because one
    // syringe step is spread over fewer injections — and that is what tracks a decaying
    // tail. There is no single right answer, so the others are shown with their numbers
    // and each is applicable rather than hidden behind the auto-pick.
    if((r.alternatives||[]).length){
      h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:12px 0 4px">Other cadences</div>'
        +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:6px">Shorter interval = steadier within the week. Longer interval = finer weekly-mg control, which tracks the outgoing ester better.</div>'
        +r.alternatives.map(function(a,i){
          return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin-bottom:6px">'
            +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
            +'<span style="font-size:12px;font-weight:700;color:var(--text)">'+_esc(a.cadence.label)+'</span>'
            +'<span style="font-size:10px;color:var(--muted2)">worst '+Math.round(a.worst*100)+'% off · swing '+Math.round(a.ripple*100)+'%</span>'
            +'</div>'
            +'<div style="font-size:10px;color:var(--muted2);margin-top:3px">holds '+Math.round(a.lowPmol)+'–'+Math.round(a.highPmol)+' pmol/L</div>'
            +'<button onclick="'+q('trtSolveApply',","+i)+'" style="margin-top:6px;background:none;border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Use this instead</button>'
            +'</div>';
        }).join('');
    }
  }
  h+='</div>';   // close the result container
  h+='</div>';
  return h;
}
// ── ESTER TRANSITIONS: per-compound window + dose ramp ──────────────────────
// Switching esters (Nebido → Test E) means running both for a while: the outgoing
// ester's tail is still decaying when the incoming one starts, so the incoming dose
// starts low and steps up as the tail clears. Two esters were already selectable (the
// cap is 2) and _genInjBatches already honoured per-compound start_date/end_date — but
// nothing wrote them, and dose ramps did not apply to TRT at all.
//
// NO CROSSOVER IS COMPUTED. There is no published undecanoate→enanthate transition
// protocol to anchor one to, so the app does not propose a date or a taper: it lets the
// user express one and shows the summed curve. T-Calc already sums mixed esters with
// each one's own half-life, tmax and testosterone fraction (undecanoate 0.6315 vs
// enanthate 0.7199 — a 14% error if it were ignored), so the combined free-T line is
// the real answer to "does this hold steady", on a model the user can see.
function _renderTRTTransition(c,selData,scope){
  scope=(scope==='wiz')?'wiz':'edit';
  var id=c.id, q=function(fn,args){return fn+'(\''+scope+'\',\''+id+'\''+(args||'')+')';};
  var sd=String(selData.start_date||''),ed=String(selData.end_date||'');
  var hasRamp=!!(selData.dose_phases&&selData.dose_phases.length);
  var h='<div class="cfg-row" style="display:block;border-top:1px solid var(--border);padding-top:10px;margin-top:4px">'
    +'<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px">Transition window</div>'
    +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:8px">Leave blank to run for the whole protocol. Set these to overlap two esters — the outgoing one gets an end date, the incoming one a start date.</div>'
    +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
    +'<span style="font-size:11px;color:var(--muted2);min-width:38px">Start</span>'
    +'<input class="note-in" type="date" value="'+_esc(sd)+'" onchange="'+q('trtSetDate',',\'start_date\',this.value')+'" style="flex:1">'
    +(sd?('<button onclick="'+q('trtSetDate',',\'start_date\',\'\'')+'" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;padding:0 4px;line-height:1">×</button>'):'')
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
    +'<span style="font-size:11px;color:var(--muted2);min-width:38px">End</span>'
    +'<input class="note-in" type="date" value="'+_esc(ed)+'" onchange="'+q('trtSetDate',',\'end_date\',this.value')+'" style="flex:1">'
    +(ed?('<button onclick="'+q('trtSetDate',',\'end_date\',\'\'')+'" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;padding:0 4px;line-height:1">×</button>'):'')
    +'</div>';
  // An inverted window generates NOTHING, silently. Say so rather than letting the user
  // save a compound that will never appear in the schedule.
  if(sd&&ed&&ed<sd){
    h+='<div style="font-size:11px;color:#f59e0b;line-height:1.5;margin-top:6px;font-weight:600">⚠ End is before start — this compound would generate no injections.</div>';
  }
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;margin-bottom:'+(hasRamp?'8px':'0')+'">'
    +'<span style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase">Dose ramp</span>'
    +'<div onclick="'+q('trtToggleRamp')+'" style="cursor:pointer"><div class="toggle-sw'+(hasRamp?' on':'')+'"></div></div></div>';
  if(hasRamp){
    var phases=(selData.dose_phases||[]).slice().sort(function(a,b){return (a.w||0)-(b.w||0);});
    // THE DOSE FIELD ABOVE IS OVERRIDDEN while a ramp is on — the generator reads the
    // phases, not the flat dose. Editing Dose and seeing nothing change is exactly the
    // silent mismatch this app keeps getting bitten by, so it is stated rather than
    // discovered. (The peptide editor cancels the ramp instead; here the ramp is the
    // point of the feature, so deleting it on a stray keystroke would be worse.)
    h+='<div style="font-size:11px;color:var(--muted2);margin-bottom:8px;line-height:1.5">Week counts from the PROTOCOL start, not this compound\'s start date. While the ramp is on it overrides the Dose field above.</div>';
    h+=phases.map(function(ph,phi){
      var uOpts=_trtUnitOptions(ph.u||selData.unit||'mg');
      return '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">'
        +'<span style="font-size:11px;color:var(--muted2);white-space:nowrap;min-width:30px">Wk</span>'
        +'<input class="dose-in" type="number" inputmode="numeric" min="0" value="'+String(ph.w||0)+'" oninput="'+q('trtSetPhase',','+phi+',\'w\',+this.value')+'" style="width:44px;text-align:center;">'
        +'<input class="dose-in" type="text" inputmode="decimal" value="'+_esc(String(ph.d||''))+'" oninput="'+q('trtSetPhase',','+phi+',\'d\',this.value')+'" placeholder="dose" style="width:60px;">'
        +'<select class="unit-sel" onchange="'+q('trtSetPhase',','+phi+',\'u\',this.value')+'">'+uOpts+'</select>'
        +'<button onclick="'+q('trtRemovePhase',','+phi)+'" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;padding:0 4px;line-height:1">×</button>'
        +'</div>';
    }).join('');
    h+='<button onclick="'+q('trtAddPhase')+'" style="font-size:11px;color:var(--accent);background:none;border:1px solid var(--accent);border-radius:6px;padding:3px 10px;cursor:pointer;font-family:inherit;margin-top:2px">+ Add phase</button>';
  }
  h+=_renderTRTSolve(c,selData,scope);
  h+='</div>';
  return h;
}
var TRT_UNITS=['mg','ml','IU','%','mg/week','mg/day','mg/EOD'];
function _trtUnitOptions(sel){
  var cur=String(sel||'mg');
  var list=TRT_UNITS.slice();
  if(list.indexOf(cur)<0)list.push(cur);
  return list.map(function(u){
    return '<option'+(u===cur?' selected':'')+'>'+u+'</option>';
  }).join('');
}

// ── Half-life on every compound card ─────────────────────────────────────────
// Henrik, 2026-08-19: "For all compounds can we list half time? Instead of the
// 'short ester' etc."
//
// "Short ester", "Long-acting depot" and the class label are ways of saying a number
// without saying it. The number is what decides injection frequency, how fast a change
// shows up, and how long a side effect persists after stopping — so it goes on the card,
// where compounds are compared.
//
// The data is already in the catalogues, from the backend: peptides carry `halfLife`,
// enhanced compounds carry `cadence.halfLife`, and the testosterone esters carry theirs
// in TRT_GUIDE and (authoritatively) in the PK catalogue the curve keys on. Nothing is
// invented here: a compound with no published half-life keeps whatever its card said
// before rather than being given a number.
// The vial spec ("Testosterone Undecanoate 1000mg/4ml") is concrete data, not a vague
// descriptor, so it survives — behind the half-life rather than instead of it.
function _metaWithHalfLife(entry,fallback){
  var hl=_halfLifeLabel(entry);
  if(!hl)return fallback||'';
  return fallback?(hl+' · '+fallback):hl;
}

function _halfLifeOf(entry){
  if(!entry)return '';
  var id=entry.id;
  // THE MERGED CATALOGUE FIRST. /compounds/catalog joins each compound to its PK entry,
  // so `pk.halfLife` is the figure the plasma curve integrates — no client-side
  // reconciliation, which is the whole point of having merged them in the backend.
  if(entry.pk&&entry.pk.halfLife)return String(entry.pk.halfLife);
  if(typeof _COMPOUND_CATALOG!=='undefined'&&_COMPOUND_CATALOG&&_COMPOUND_CATALOG.length){
    var m=_COMPOUND_CATALOG.find(function(e){return e.id===id||e.id===_canonCompoundId(id);});
    if(m&&m.pk&&m.pk.halfLife)return String(m.pk.halfLife);
    if(m&&m.cadence&&m.cadence.halfLife&&!entry.halfLife)return String(m.cadence.halfLife);
  }
  // Below: the pre-merge sources. They stay as the fallback for a backend that predates
  // /compounds/catalog, and for the bundled offline constants. The two DO disagree about
  // the same molecule — enanthate is "~7 days" in the enhanced list and "~4.5 days" in
  // the PK list — so the PK figure still wins here, for the same reason.
  if(typeof _tcExtraCatalog!=='undefined'&&_tcExtraCatalog){
    var x=_tcExtraCatalog.find(function(e){return e.id===id||e.id===_canonCompoundId(id);});
    if(x&&x.halfLife)return String(x.halfLife);
  }
  if(typeof TRT_GUIDE!=='undefined'&&TRT_GUIDE){
    var g=TRT_GUIDE[id]||TRT_GUIDE[_canonCompoundId(id)];
    if(g&&g.halfLife)return String(g.halfLife);
  }
  // Everything the PK model does not carry — nandrolone, orals, GH, peptides.
  if(entry.halfLife)return String(entry.halfLife);
  if(entry.cadence&&entry.cadence.halfLife)return String(entry.cadence.halfLife);
  return '';
}

// The stored strings are written for a detail panel — "~56 days plateau-equivalent
// (37-75 d individual range)" does not belong on a 44px-wide card. Keep the leading
// figure, drop the qualification, and let the info sheet carry the rest.
function _halfLifeLabel(entry){
  var raw=_halfLifeOf(entry);
  if(!raw)return '';
  // Keep the first clause that actually states a duration. Splitting blindly on the
  // first separator turned Sustanon's "blended esters (~1–15 days); effective ~4–5 days"
  // into "t½ blended esters", which is the vague phrasing this change exists to remove.
  // Not on '·': a blend states both components that way ('GHRH ~30 min · IPA ~2 h')
  // and keeping only the first would hide half the answer.
  var parts=String(raw).split(/[;]|\s—\s/);
  var head='';
  for(var i=0;i<parts.length;i++){
    var t=parts[i].trim();
    if(/\d/.test(t)){head=t;break;}
  }
  if(!head)head=parts[0].trim();
  // Drop a parenthetical only when the figure survives without it.
  var noParen=head.replace(/\s*\([^)]*\)\s*/g,' ').trim();
  if(/\d/.test(noParen))head=noParen;
  head=head.replace(/[,.]$/,'');
  return head?('t½ '+head):'';
}

function _renderEditTRT(trt){if(!trt)trt={};
  // ── TIER 1 SEES TESTOSTERONE TOO, LOCKED (2026-08-20) ─────────────────────
  // Henrik: "Tier 1 & 2 should see everything but greyed out if not included in
  // their tier." Tier 1 is the peptide tier and has no testosterone access, so this
  // group renders in full and locked rather than being hidden — the same treatment
  // the enhancement classes get one tier up. Whole catalogue at every tier; what the
  // tier decides is what you can switch ON.
  //
  // Locked here rather than through _renderEditEnhanced because testosterone lives in
  // the TRT block, keyed on TRT_CAT and the PK ids. Same lock, same overlay.
  if((_userTier||1)<2){
    var lockedHtml='<div class="wiz-section" style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;"><span>Testosterone</span><span style="font-size:13px;color:var(--muted2)">🔒</span></div>';
    (typeof TRT_CAT!=='undefined'?TRT_CAT:[]).forEach(function(c){
      lockedHtml+='<div class="pep-card" onclick="showCompoundUpgrade(\''+_esc(String(c.id))+'\')" style="margin-bottom:6px;opacity:0.45;cursor:pointer">'
        +'<div class="pep-dot-sm" style="background:'+c.dot+'"></div>'
        +'<div class="pep-info"><div class="pep-name">'+_esc(c.name)+'</div>'
        +'<div class="pep-meta">'+_metaWithHalfLife(c,c.sub)+'</div></div>'
        +'<div class="pep-chk" style="font-size:13px;color:var(--muted2)">🔒</div></div>';
    });
    return lockedHtml;
  }
  var enabled=!!trt.enabled;var selIds=(trt.compounds||[]).map(function(c){return c.id;});var html='<div class="wiz-section" style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;"><span>Testosterone</span><div onclick="editToggleTRT()" style="cursor:pointer;"><div class="toggle-sw'+(enabled?' on':'')+'"></div></div></div>';html+=(typeof _renderTcalcTrtCard==='function'?_renderTcalcTrtCard():'');if(enabled)html+=_tcalcOwnsTestoNote('Testosterone');html+=(typeof _bfReadinessCard==='function'?_bfReadinessCard('trt'):'');if(enabled){TRT_CAT.forEach(function(c){var isSel=selIds.includes(c.id);var disabled=!isSel&&selIds.length>=2;var selData=isSel?(trt.compounds||[]).find(function(s){return s.id===c.id;}):null;html+='<div class="pep-card'+(isSel?' sel':'')+(disabled?' disabled':'')+'" onclick="'+(disabled?'':('editToggleTRTCompound(\''+c.id+'\')'))+'" style="margin-bottom:'+(isSel?'0':'6px')+';'+(isSel?'border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom-color:transparent;':'')+(disabled?'opacity:0.4;cursor:default;pointer-events:none;':'')+'"><div class="pep-dot-sm" style="background:'+c.dot+'"></div><div class="pep-info"><div class="pep-name">'+c.name+'</div><div class="pep-meta">'+_metaWithHalfLife(c,c.sub)+'</div></div><div class="pep-chk">'+(isSel?'<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</div></div>';if(isSel&&selData){var doseNum=parseDec(selData.dose)||0;var weeklyDoseMg;if(c.id!=='nebido'&&selData.days&&selData.days.length){weeklyDoseMg=doseNum*selData.days.length;}else{var freqDays=((selData.freqUnit||'weeks')==='weeks'?(selData.freqVal||1)*7:(selData.freqVal||1));weeklyDoseMg=freqDays>0?doseNum*7/freqDays:0;}html+='<div style="border:1px solid var(--accent);border-top:none;border-radius:0 0 10px 10px;padding:12px 14px;margin-bottom:8px;background:rgba(232,255,60,0.015);">';html+='<div class="cfg-row"><div class="cfg-lbl">Dose</div><div class="dose-row"><input class="dose-in" type="text" inputmode="decimal" value="'+_esc(String(selData.dose||''))+'" oninput="(function(x){var cc=(_editBuf.trt.compounds||[]).find(function(x){return x.id===\''+c.id+'\'});if(cc)cc.dose=x;})(this.value)" placeholder="0"><select class="unit-sel" onchange="(function(x){var cc=(_editBuf.trt.compounds||[]).find(function(y){return y.id===\''+c.id+'\'});if(cc)cc.unit=x;})(this.value)">'+_trtUnitOptions(selData.unit)+'</select></div></div>';html+=_renderTRTCadence(c.id,selData,'edit');html+='<div class="cfg-row"><div class="cfg-lbl">Time</div><div class="time-chips">'+['AM','PM'].map(function(tm){return '<div class="time-chip'+(((selData.time||'AM')===tm)?' sel':'')+'" onclick="editSetTRTTime(\''+c.id+'\',\''+tm+'\')">'+tm+'</div>';}).join('')+'</div></div>';html+=_renderTRTTransition(c,selData,'edit');html+='<div id="trt-guide-'+c.id+'">'+_renderTRTGuide(c.id,weeklyDoseMg)+'</div>';html+='</div>';}})}return html;}
function editSetTRTTime(id,tm){var c=((_editBuf.trt&&_editBuf.trt.compounds)||[]).find(function(c){return c.id===id;});if(!c)return;c.time=(tm==='PM'?'PM':'AM');_collectEditInputs();renderStackEditor();}
function editAddPeptide(){
  var currentIds=(_editBuf.peptides||[]).map(function(p){return p.id;});
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;';
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay);};
  var sheet=document.createElement('div');
  sheet.style.cssText='background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:75vh;overflow-y:auto;';
  var groups={};PEPTIDE_CAT.forEach(function(cat){if(!groups[cat.group])groups[cat.group]=[];groups[cat.group].push(cat);});
  var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
  html+='<div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--accent);">ADD PEPTIDE</div>';
  html+='<button onclick="this.closest(\'[style*=fixed]\').remove()" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;">×</button>';
  html+='</div>';
  Object.keys(groups).forEach(function(grp){
    html+='<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted2);margin:12px 0 6px;">'+grp+'</div>';
    groups[grp].forEach(function(cat){
      var already=currentIds.includes(cat.id);
      var doseStr=cat.dflt.doseAm+(cat.dflt.unitAm?' '+cat.dflt.unitAm:'');
      if(cat.dflt.times&&cat.dflt.times.includes('PM'))doseStr+=' / '+cat.dflt.dosePm+(cat.dflt.unitPm?' '+cat.dflt.unitPm:'');
      html+='<div class="pep-card" onclick="'+(already?'':'editPickPeptide(\''+cat.id+'\')')+'" style="opacity:'+(already?0.4:1)+';cursor:'+(already?'default':'pointer')+';">';
      html+='<div class="pep-dot-sm" style="background:'+cat.dot+';"></div>';
      html+='<div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--text);">'+cat.name+'</div>';
      html+='<div style="font-size:11px;color:var(--muted2);">'+doseStr+'</div></div>';
      if(already)html+='<div style="font-size:11px;color:var(--muted2);">in protocol</div>';
      html+='<button class="info-btn" onclick="event.stopPropagation();showPeptideCard(\''+cat.id+'\')">ℹ</button>';
      html+='</div>';
    });
  });
  sheet.innerHTML=html;overlay.appendChild(sheet);document.body.appendChild(overlay);window._addPepOverlay=overlay;
}
function editPickPeptide(id){
  var cat=PEPTIDE_CAT.find(function(c){return c.id===id;});if(!cat)return;
  var d=cat.dflt;
  _editBuf.peptides.push(Object.assign({id:cat.id,name:cat.name,dot:cat.dot,times:d.times.slice(),days:d.days.slice(),note:'',active:true},_slotFieldsFromDflt(d)));
  if(window._addPepOverlay){try{document.body.removeChild(window._addPepOverlay);}catch(e){}window._addPepOverlay=null;}
  renderStackEditor();
}
async function saveEditBuf(){
  _collectEditInputs();
  // _cycleErr is a message on the screen, not part of the protocol. Without this it
  // would be written to stacks.json and come back on the next load as a permanent
  // error the user cannot clear.
  delete _editBuf._cycleErr;
  // If the user changed a dose away from the active ramp value, cancel the ramp
  (_editBuf.peptides||[]).forEach(function(p){
    if(!p.dose_phases||!p.dose_phases.length)return;
    var eff=_effectiveDose(p,_editBuf.cycle_start);
    if(!eff)return;
    var chg=TIME_SLOTS.some(function(t){
      return p.times&&p.times.includes(t)&&String(p['dose_'+_slotKey(t)]||'')!==String(eff.dose);
    });
    if(chg)delete p.dose_phases;
  });
  var _oldProtoCids=_getProtocolCompoundIds(_userStacks[_editIdx]||{});
  _userStacks[_editIdx]=_editBuf;
  // Single-source guard: if this stack now has its own TRT config AND a T-Calc plan
  // is assigned to it, warn and let the user keep one source (may clear _editBuf.trt).
  // Fast-path: only engage when this stack is the current T-Calc target.
  updateWEEKLY();
  await saveStacksToBackend();
  if(_editBuf&&_editBuf.cycle_start){
    var _editToday0=new Date(NOW);_editToday0.setHours(0,0,0,0);
    var _newProtoCids=_getProtocolCompoundIds(_editBuf);
    var _cycId=_stackCycleId(_editBuf);
    for(var _pi=0;_pi<_oldProtoCids.length;_pi++){
      if(!_newProtoCids.includes(_oldProtoCids[_pi])){
        await injClearFuture(_cycId,_oldProtoCids[_pi],dateKey(_editToday0),{tag:'delOrphanInj'});
      }
    }
    if(confirmSavePrune(_editBuf)){
      await generateAndPushInjections(_editBuf,_editToday0);
      await refreshInjectionsCache();
    }
  }
  buildWeekStrip();buildToday();buildSchedule();
  buildStackStore();
  buildTimeline();
  // Levels reads the forward plan out of _injectionsCache (_tcProtocolInjections), which
  // the refresh above has just rewritten. Rebuilding Today and Schedule but not the
  // plasma curve left the tab showing the plan as it was before the save whenever it was
  // already on screen. switchTab() rebuilds it on entry, so this only matters when the
  // user never leaves the tab — which is exactly when the stale curve is visible.
  try{ if(typeof buildTCalc==='function'&&document.getElementById('tcalc-body'))buildTCalc(); }
  catch(e){ if(typeof _logErr==='function')_logErr('saveEditBufTCalc',e); }
}
// ── Modified wizard save ─────────────────────────────────────────────────────
// ── Modified wizard step 4 review ────────────────────────────────────────────
function wizStep4(body,footer){
  var pepObjs=_wiz.peptides.map(function(p){return PEPTIDE_CAT.find(function(c){return c.id===p.id;})||{id:p.id,cg:[]};});
  var issues=checkStack(pepObjs);
  var hasErrors=issues.some(function(i){return i.level==='err';});
  var html='<div class="wiz-section">Protocol Name</div><input class="trt-in" type="text" value="'+String(_wiz.stackName||'')+'" oninput="wizSetStackName(this.value)" placeholder="e.g. Cutting, Bulk 1, TRT base…"><div class="wiz-section" style="margin-top:16px">Check</div><div id="wiz-chk-section">'+renderCheckResults(pepObjs,'wizinline')+'</div>';
  html+='<div class="wiz-section">Summary</div>';
  if(_wiz.peptides.length){
    _wiz.peptides.forEach(function(p){
      var dose=_slotDoseSummary(p,'/',false)||'?';
      // Was: days[] first, ignoring p.cadence — which mislabels every interval-mode
      // compound, because switching mode keeps the weekday list on purpose.
      var days=_cadenceLabel(p,'days')||'?';
      html+='<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:'+(p.dot||'#888')+';flex-shrink:0"></div><div style="flex:1;font-size:13px;color:var(--text)">'+p.name+'</div><div style="font-size:12px;color:var(--muted2)">'+dose+' · '+days+'</div></div>';
    });
  } else {
    html+='<div style="color:var(--muted2);font-size:13px;">No peptides selected.</div>';
  }
  _trtCompounds(_wiz.trt).forEach(function(c){
    html+='<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:'+(c.dot||'var(--accent4)')+';flex-shrink:0"></div><div style="flex:1;font-size:13px;color:var(--text)">'+c.name+'</div><div style="font-size:12px;color:var(--muted2)">'+(c.dose?c.dose+(c.unit||'mg')+' ':'')+(c.days&&c.days.length?c.days.map(function(d){return DAYS_SHORT[d];}).join('/'):(c.freqVal?'every '+c.freqVal+' '+c.freqUnit:'TRT'))+'</div></div>';
  });
  body.innerHTML=html;
  var saveLabel=hasErrors?'Save Anyway (conflicts)':'Save Protocol';
  footer.innerHTML='<button class="btn-check" onclick="wizShowCheck()">Re-check</button><button class="btn btn-primary" style="flex:1" onclick="wizSave()">'+saveLabel+'</button>';
}
function wizSetStackName(val){_wiz.stackName=val;}

function _synthesizeProtocol(weekly){
  var seen={};var peptides=[];
  weekly.forEach(function(w){
    var baseId=w.id.replace(/-am$|-mid$|-pm$/,'');
    var pn=(w.name||'').toLowerCase().replace(/\s*\(.*$/,'').trim();
    var catM=PEPTIDE_CAT.find(function(c){var cn=c.name.toLowerCase().replace(/\s*\(.*$/,'').trim();return pn===cn||cn.startsWith(pn)||pn.startsWith(cn);});
    var pepId=catM?catM.id:baseId;
    if(!seen[pepId]){var _ne={id:pepId,name:w.name,dot:w.dot,days:w.dow.slice(),times:[],note:'',active:true};TIME_SLOTS.forEach(function(tm){var k=_slotKey(tm);_ne['dose_'+k]='';_ne['unit_'+k]='mg';});seen[pepId]=_ne;peptides.push(_ne);}
    var e=seen[pepId];
    w.dow.forEach(function(d){if(!e.days.includes(d))e.days.push(d);});
    var t=w.time||'AM';
    if(!e.times.includes(t))e.times.push(t);
    var rawPart=w.detail?w.detail.split('—')[0].trim():'';
    var dm=rawPart.match(/^([\d.]+)\s*(mg|mcg|µg|IU|ml)?$/);
    var _k=_slotKey(TIME_SLOTS.indexOf(t)>=0?t:'AM');
    if(dm){e['dose_'+_k]=dm[1];e['unit_'+_k]=dm[2]||'mg';}
    else{e['dose_'+_k]=rawPart;}
    if(!w.startDate&&!w.endDate){e._permanentDose=true;}
    else if(!e._permanentDose){var _fmt=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};if(w.startDate&&!e.start_date)e.start_date=_fmt(w.startDate);if(w.endDate&&!e.end_date)e.end_date=_fmt(w.endDate);}
  });
  return{peptides:peptides,trt:{},_unsaved:true};
}
// ── Run rule checks ──────────────────────────────────────────────────────────
function checkStack(peptides){
  var results=[];
  STACK_RULES.forEach(function(rule){
    if(rule.check(peptides))results.push({level:rule.level,title:rule.title,msg:rule.msg,id:rule.id});
  });
  return results;
}
// ── Render Check Stack results ───────────────────────────────────────────────
function renderCheckResults(peptides,toggleCtx){
  var issues=checkStack(peptides);
  if(!issues.length)return '<div class="rule-box ok"><div class="rule-title ok">✓ Protocol looks clean</div><div class="rule-msg">No contraindications or redundancies detected.</div></div>';
  return issues.map(function(i){
    var ruleObj=STACK_RULES.find(function(r){return r.id===i.id;});
    var conflictHtml='';
    if(toggleCtx&&ruleObj&&ruleObj.getConflicting){
      var cids=ruleObj.getConflicting(peptides);
      if(cids.length){
        conflictHtml='<div class="conflict-peps">';
        cids.forEach(function(cid){
          var cat=PEPTIDE_CAT.find(function(c){return c.id===cid;});
          var name=cat?cat.name:cid;
          var dot=cat?cat.dot:'#888';
          conflictHtml+='<div class="conflict-pep" onclick="_rcToggle(\''+toggleCtx+'\',\''+cid+'\')">'
            +'<div class="conflict-chk"><svg width="11" height="9" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'
            +'<div style="width:7px;height:7px;border-radius:50%;background:'+dot+';flex-shrink:0"></div>'
            +'<span style="font-size:13px;color:var(--text)">'+name+'</span>'
            +'</div>';
        });
        conflictHtml+='<div style="font-size:11px;color:var(--muted2);margin-top:4px;">Uncheck one to remove it, then re-check</div></div>';
      }
    }
    return '<div class="rule-box '+i.level+'"><div class="rule-title '+i.level+'">'+(i.level==='err'?'⛔':'⚠️')+' '+i.title+'</div><div class="rule-msg">'+i.msg+'</div>'+conflictHtml+'</div>';
  }).join('');
}
function _rcToggle(ctx,id){
  if(!_wiz||!_wiz.peptides)return;
  var idx=_wiz.peptides.findIndex(function(p){return p.id===id;});
  if(idx!==-1)_wiz.peptides.splice(idx,1);
  if(ctx==='wizpopup'&&window._wizCheckSheet){
    var pepObjs=_wiz.peptides.map(function(p){return PEPTIDE_CAT.find(function(c){return c.id===p.id;})||{id:p.id,cg:[]};});
    window._wizCheckSheet.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--accent)">PROTOCOL CHECK</div><button onclick="this.closest(\'[style*=fixed]\').remove();window._wizCheckSheet=null;" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer">×</button></div>'+renderCheckResults(pepObjs,'wizpopup');
  } else {
    var pepObjs=_wiz.peptides.map(function(p){return PEPTIDE_CAT.find(function(c){return c.id===p.id;})||{id:p.id,cg:[]};});
    var chkEl=document.getElementById('wiz-chk-section');
    if(chkEl)chkEl.innerHTML=renderCheckResults(pepObjs,'wizinline');
    var saveBtn=document.querySelector('#wiz-footer .btn.btn-primary');
    if(saveBtn)saveBtn.textContent='Next →';
  }
}
// ── Save protocol to backend ─────────────────────────────────────────────────
async function saveProtocolToBackend(proto){
  try{
    var r=await fetch(AGENT_URL+'/protocol',{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(proto)});
    return r.ok;
  }catch(e){return false;}
}
// ── Build Stack tab (3 states) ────────────────────────────────────────────────
// ── Check Stack panel ─────────────────────────────────────────────────────────
function showCheckPanel(){
  if(!_userProtocol||!_userProtocol.peptides)return;
  var pepObjs=_userProtocol.peptides.map(function(p){return PEPTIDE_CAT.find(function(c){return c.id===p.id;})||{id:p.id,cg:[]};});
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;';
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay);};
  var sheet=document.createElement('div');
  sheet.style.cssText='background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:80vh;overflow-y:auto;';
  sheet.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--accent)">PROTOCOL CHECK</div><button onclick="document.body.removeChild(this.closest(\'[style*=fixed]\'))" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer">×</button></div>'+renderCheckResults(pepObjs);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
// ── Peptide info card (pokemon style) ────────────────────────────────────────
function showPeptideCard(id){
  var cat=PEPTIDE_CAT.find(function(c){return c.id===id;});if(!cat)return;
  var dot=cat.dot||'#888';
  var GOAL_ICONS={muscle:'💪',recovery:'🩹',skin:'✨',fat:'🔥',cognitive:'🧠',antiaging:'⏳',trt:'⚡',enhanced:'💉'};
  var goalsHtml=(cat.goals||[]).map(function(g){return'<span class="pcard-goal" style="background:'+dot+'20;border-color:'+dot+'44;color:'+dot+'">'+(GOAL_ICONS[g]||'')+' '+(g.charAt(0).toUpperCase()+g.slice(1))+'</span>';}).join('');
  var userPep=_userProtocol&&_userProtocol.peptides?_userProtocol.peptides.find(function(p){return p.id===id;}):null;
  var myDoseHtml='';
  if(userPep){
    var parts=[];TIME_SLOTS.forEach(function(t){var k=_slotKey(t);if(userPep['dose_'+k])parts.push(_slotLabel(t)+': '+_doseLabel(userPep.id,userPep['dose_'+k],userPep['unit_'+k]||'µg'));});
    if(parts.length)myDoseHtml='<div style="background:'+dot+'15;border:1px solid '+dot+'30;border-radius:10px;padding:10px 14px;margin-bottom:4px;"><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:'+dot+';margin-bottom:3px;">Your dose</div><div style="font-size:13px;color:var(--text);">'+parts.join(' · ')+'</div></div>';
  }
  var benefitsHtml=(cat.benefits||[]).map(function(b){return'<li>'+b+'</li>';}).join('');
  var sideHtml=(cat.sideEffects||[]).map(function(s){return'<li>'+s+'</li>';}).join('');
  var overlay=document.createElement('div');
  overlay.className='pcard-overlay';
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  var sheet=document.createElement('div');
  sheet.className='pcard-sheet';
  sheet.innerHTML=
    '<div style="margin-bottom:14px;">'
    +'<div class="pcard-name" style="color:'+dot+'">'+cat.name+'</div>'
    +'<div style="font-size:11px;font-weight:600;color:var(--muted2);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">'+cat.group+'</div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">'
    +'<div style="height:2px;flex:1;background:'+dot+';border-radius:2px;opacity:0.5;"></div>'
    +(cat.halfLife?'<div style="font-size:11px;color:var(--muted2);white-space:nowrap;">t½ '+cat.halfLife+'</div>':'')
    +'</div>'
    +'<div class="pcard-goals" style="margin-bottom:16px;">'+goalsHtml+'</div>'
    +myDoseHtml
    +(cat.mechanism?'<div class="pcard-section" style="color:'+dot+'">How it works</div><div class="pcard-body">'+cat.mechanism+'</div>':'')
    +(benefitsHtml?'<div class="pcard-section" style="color:'+dot+'">Benefits</div><ul class="pcard-ul" style="color:'+dot+'">'+benefitsHtml+'</ul>':'')
    +(cat.protocol?'<div class="pcard-section" style="color:'+dot+'">Typical protocol</div><div class="pcard-body">'+cat.protocol+'</div>':'')
    +(sideHtml?'<div class="pcard-section" style="color:'+dot+'">Side effects</div><ul class="pcard-ul">'+sideHtml+'</ul>':'')
    +'<div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;">'
    +(cat.dflt&&cat.dflt.doseAm?'<div class="pcard-stat"><div class="pcard-lbl">Typical AM dose</div><div class="pcard-val" style="color:'+dot+'">'+cat.dflt.doseAm+' '+cat.dflt.unitAm+'</div></div>':'')
    +(cat.dflt&&cat.dflt.dosePm?'<div class="pcard-stat"><div class="pcard-lbl">Typical PM dose</div><div class="pcard-val" style="color:'+dot+'">'+cat.dflt.dosePm+' '+cat.dflt.unitPm+'</div></div>':'')
    +(cat.dflt&&cat.dflt.times?'<div class="pcard-stat"><div class="pcard-lbl">Timing</div><div class="pcard-val">'+cat.dflt.times.join(' + ')+'</div></div>':'')
    +(cat.sku?'<div class="pcard-stat"><div class="pcard-lbl">SKU</div><div class="pcard-val">'+cat.sku+'</div></div>':'')
    +'</div>'
    +'<div style="position:sticky;bottom:0;background:var(--surface);padding:16px 0 28px;margin-top:20px;">'
    +'<button onclick="this.closest(\'.pcard-overlay\').remove()" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:14px;font-weight:700;padding:14px;border-radius:12px;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">Done</button>'
    +'</div>';
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
function showEnhancedCard(id){
  var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===id;});if(!cat)return;
  var dot=cat.dot||'#a855f7';
  var userComp=null;
  (_activeStackIndices||[]).forEach(function(si){var st=_userStacks[si];if(!st||!st.enhanced)return;var f=(st.enhanced.compounds||[]).find(function(c){return c.id===id;});if(f&&!userComp)userComp=f;});
  var myDoseHtml='';var activeDose=0;
  if(userComp){
    var parts=[];
    var eCat=(ENHANCEMENT_COMPOUNDS||[]).find(function(ec){return ec.id===id;});
    var isAmPm=userComp.amPm||(eCat&&eCat.amPm);
    activeDose=isAmPm?_enhSplitTotal(userComp):parseDec(userComp.dose||0);
    if(isAmPm){_enhTimes(userComp).forEach(function(t){var k=_slotKey(t);if(userComp['dose_'+k])parts.push(_slotLabel(t)+': '+userComp['dose_'+k]+' '+(userComp.unit?(userComp.unit.split('/')[0]):''));});}
    else if(userComp.dose)parts.push(userComp.dose+(userComp.unit?' '+userComp.unit:''));
    if(parts.length)myDoseHtml='<div style="background:'+dot+'15;border:1px solid '+dot+'30;border-radius:10px;padding:10px 14px;margin-bottom:12px;"><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:'+dot+';margin-bottom:3px;">Your dose</div><div style="font-size:13px;color:var(--text);">'+parts.join(' · ')+'</div></div>';
  }
  var overlay=document.createElement('div');overlay.className='pcard-overlay';overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  var sheet=document.createElement('div');sheet.className='pcard-sheet';
  sheet.innerHTML='<div style="margin-bottom:14px;"><div class="pcard-name" style="color:'+dot+'">'+(cat.name||id)+'</div><div style="font-size:11px;font-weight:600;color:var(--muted2);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">'+(cat.group||'')+'</div></div>'+myDoseHtml+_renderEnhancedGuide(cat,activeDose,(userComp&&userComp.unit)||cat.unit||'')+'<div style="position:sticky;bottom:0;background:var(--surface);padding:16px 0 28px;margin-top:20px;"><button onclick="this.closest(\'.pcard-overlay\').remove()" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:14px;font-weight:700;padding:14px;border-radius:12px;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">Done</button></div>';
  overlay.appendChild(sheet);document.body.appendChild(overlay);
}
// ── Wizard ────────────────────────────────────────────────────────────────────
var GOAL_DEFS=[{id:'muscle',label:'Muscle & Recovery',icon:'💪'},{id:'recovery',label:'Injury & Healing',icon:'🩹'},{id:'skin',label:'Skin & Anti-aging',icon:'✨'},{id:'fat',label:'Fat Loss',icon:'🔥'},{id:'cognitive',label:'Cognitive',icon:'🧠'},{id:'antiaging',label:'Longevity',icon:'⏳'},{id:'enhanced',label:'Enhanced Cycle',icon:'💉'}];
var UNITS=['mg','µg','IU','ml','%'];var UNIT_LABELS={mcg:'µg'};
// Intra-day dose slot constants (TIME_SLOTS / TIME_LABELS / TIME_RANK / _slotLabel /
// _slotKey) are defined in index.html, which loads before every tab file.
// Fasted-window qualifier per slot, shown for GH-axis compounds only. GH's lipolytic
// action is opposed by insulin, so each dose wants a low-insulin window: AM rides the
// overnight fast, the other two need ~2 h clear of the last meal. Not shown for other
// groups, where "fasted" is not the documented instruction.
var SLOT_FASTED_HINT={AM:'fasted',MID:'2 h fasted',PM:'2 h fasted'};
function _isGhAxis(id){
  var cat=(typeof PEPTIDE_CAT!=='undefined')?PEPTIDE_CAT.find(function(c){return c.id===id;}):null;
  if(cat&&cat.cg&&(cat.cg.indexOf('hgh')>=0||cat.cg.indexOf('ghrh')>=0||cat.cg.indexOf('ghrp')>=0))return true;
  // Enhanced-tier compounds come from the backend catalogue and carry no `cg` array —
  // identify them by their class/group instead. HGH is reachable from both tiers, so
  // the fasted guidance must resolve from either catalogue.
  var eCat=(typeof ENHANCEMENT_COMPOUNDS!=='undefined')?(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===id;}):null;
  if(eCat&&(eCat.cls==='ghaxis'||eCat.group==='GH Axis'))return true;
  return false;
}
// Build the per-slot dose/unit fields of a stack peptide item from a PEPTIDE_CAT
// `dflt` block. Catalogue keys are camelCase per slot (doseAm/doseMid/dosePm).
function _slotFieldsFromDflt(d){
  var o={};
  TIME_SLOTS.forEach(function(t){
    var k=_slotKey(t),C=k.charAt(0).toUpperCase()+k.slice(1);
    o['dose_'+k]=d['dose'+C]||'';
    // A slot the catalogue has no explicit unit for (e.g. MID) inherits the
    // compound's unit rather than falling back to a generic 'mg'.
    o['unit_'+k]=d['unit'+C]||d.unitAm||d.unitPm||'';
  });
  return o;
}
// "AM: 2 IU · Pre-GYM: 2 IU · PM: 2 IU" — used by every stack/wizard summary so all
// three slots surface consistently.
function _slotDoseSummary(p,sep,withLabel){
  return TIME_SLOTS.filter(function(t){return p['dose_'+_slotKey(t)];})
    .map(function(t){var k=_slotKey(t);
      return(withLabel?_slotLabel(t)+': ':'')+p['dose_'+k]+(p['unit_'+k]||'');})
    .join(sep||' · ');
}
// First populated slot's dose/unit, in chronological order — for the single-value
// contexts (dose guidance, ramp seeding) that need one representative figure.
function _slotFirstDose(p){
  for(var i=0;i<TIME_SLOTS.length;i++){var v=p['dose_'+_slotKey(TIME_SLOTS[i])];if(v)return v;}
  return '';
}
function _slotFirstUnit(p){
  for(var i=0;i<TIME_SLOTS.length;i++){var v=p['unit_'+_slotKey(TIME_SLOTS[i])];if(v)return v;}
  return '';
}
// ── Enhanced-tier cadence ─────────────────────────────────────────────────────
// Weekly dose and injection schedule are independent. A compound is scheduled either by
// weekday ("Mon + Thu") or by interval ("every 2 days", "every 12 weeks") — the ester
// decides which is meaningful, and the range must span daily through multi-week for
// every compound. Nothing is special-cased by id: a long-ester depot can be micro-dosed
// daily and a short ester can be run on fixed weekdays, and the app must express both.
//
// Back-compat: entries saved before this existed have no `cadence`, so they default to
// 'days' and behave exactly as before.
// ── ONE CADENCE MODEL FOR EVERY TIER ────────────────────────────────────────
// Henrik, 2026-08-26: "all test esters need to also have the number of day/weeks
// injection schedule as Nebido. Today it has the weekday picker from peptides. All
// compounds should have a ability to swap between these patterns."
//
// Two scheduling patterns exist and both are legitimate:
//   days     — fixed weekdays (Mon/Thu). Aligns to the calendar week.
//   interval — every N days/weeks. The only way to express EOD, E3D, or Nebido's
//              every-10-weeks, none of which fit a 7-day grid.
//
// The Enhanced tier already had both and a chip to switch. TRT had the choice made
// FOR it by a hardcoded `c.id!=='nebido'`: Nebido got the interval, every other ester
// got the weekday picker and no way to say "every 3 days". That is not a property of
// the molecule — an enanthate user dosing E3D was simply unable to write it down.
//
// So the mode becomes a field on the compound, like it already is on Enhanced, and
// ONE implementation serves all tiers. _enhCadence and friends now delegate here
// rather than keeping a parallel copy — a second implementation of "when does this
// inject" is how the tiers drift apart, which is the fault the Phase 4 merge existed
// to end.
//
// ⚠️ INFERENCE KEEPS EVERY SAVED PROTOCOL WORKING. Nothing on disk has a `cadence`
// field. A compound with weekdays means 'days'; one without means 'interval'. That
// reproduces the old behaviour exactly, including Nebido (which was written with
// days:undefined), so no migration runs and nothing reschedules on upgrade.
// THE TWO TIERS HAD DIFFERENT LEGACY DEFAULTS AND BOTH MUST SURVIVE.
// Enhanced treated a compound with no `cadence` as weekday-scheduled whatever else it
// carried — an entry with freqVal:2 and no days[] injected EVERY DAY, and
// _enhDosePerInjection divided its weekly rate by 7 accordingly. TRT did the opposite:
// no days[] meant the interval branch. Collapsing both onto one default silently
// rescheduled saved protocols in whichever tier lost, and turned a 350 mg/week entry
// into 100 mg per injection instead of 50. So the default is the caller's to state.
function _cadenceOf(c,dflt){
  if(c&&c.cadence==='interval')return 'interval';
  if(c&&c.cadence==='days')return 'days';
  if(c&&c.days&&c.days.length)return 'days';
  return (dflt==='interval')?'interval':'days';
}
// TRT's legacy reading. Nebido was scheduled by interval unconditionally — the old
// generator's `c.id!=='nebido'` guard ignored any days[] on it — so an anomalous saved
// Nebido carrying weekdays must keep injecting on its interval, not silently switch.
// This is inference for OLD data only; Nebido can now be put in weekday mode like
// anything else, and an explicit cadence field always wins.
function _trtCadenceOf(c){
  if(c&&(c.cadence==='interval'||c.cadence==='days'))return c.cadence;
  if(c&&c.id==='nebido')return 'interval';
  return _cadenceOf(c,'interval');
}
function _cadenceFreqDays(c){
  var n=parseInt(c&&c.freqVal,10); if(!(n>0))n=1;
  return (c&&c.freqUnit==='weeks')?n*7:n;
}
// Does this compound inject on this date? The single predicate, for every tier.
function _cadenceHitsMode(mode,c,d,cycleStart){
  if(mode==='interval'){
    var step=_cadenceFreqDays(c);
    if(!(step>0)||!cycleStart)return false;
    var since=Math.floor((d-cycleStart)/86400000);
    return since>=0 && since%step===0;
  }
  return !(c&&c.days&&c.days.length) || c.days.includes(d.getDay());
}
function _cadenceHitsDay(c,d,cycleStart,dflt){
  return _cadenceHitsMode(_cadenceOf(c,dflt),c,d,cycleStart);
}
// TRT resolves its mode through _trtCadenceOf, which carries the Nebido legacy rule.
// Going through _cadenceOf instead would read a stray days[] on an old Nebido row as
// weekday scheduling and silently move every injection.
function _trtHitsDay(c,d,cycleStart){
  return _cadenceHitsMode(_trtCadenceOf(c),c,d,cycleStart);
}
function _trtCadenceLabel(c){
  return _cadenceLabelMode(_trtCadenceOf(c),c);
}
// Calendar days between consecutive injections — interval states it, weekdays spread
// n injections over 7 days.
function _cadenceIntervalDays(c,dflt){
  if(_cadenceOf(c,dflt)==='interval'){var s=_cadenceFreqDays(c);return s>0?s:1;}
  var n=(c&&c.days&&c.days.length)?c.days.length:7;
  return 7/n;
}
function _cadenceLabelMode(mode,c){
  if(mode==='interval'){
    var n=parseInt(c&&c.freqVal,10); if(!(n>0))n=1;
    var u=(c&&c.freqUnit==='weeks')?'week':'day';
    return n===1?('Every '+u):('Every '+n+' '+u+'s');
  }
  var ds=(c&&c.days)||[];
  // All seven selected reads as "Every day", not "M/T/W/T/F/S/S".
  if(!ds.length||ds.length===7)return 'Every day';
  return DAYS_ORDER.filter(function(di){return ds.indexOf(di)>=0;})
                   .map(function(di){return DAYS_SHORT[di];}).join('/');
}
function _cadenceLabel(c,dflt){ return _cadenceLabelMode(_cadenceOf(c,dflt),c); }
// The schedule control: mode chips, then whichever editor the mode calls for.
// `h` names the handler set ('editSetEnh', 'wizSetEnh', 'trtEdit', 'trtWiz', …) so
// one piece of markup drives every tier and both surfaces.
function _renderCadenceControl(id,selData,h,dflt,modeOverride){
  var mode=modeOverride||_cadenceOf(selData,dflt);
  // Some tiers' handlers take a leading scope argument ('edit'/'wiz'); most do not.
  // `h.pre` is spliced in as that first argument so one piece of markup serves both.
  var a0=h.pre||'';
  var out='<div class="cfg-row"><div class="cfg-lbl">Schedule</div><div class="time-chips">'
    +[['days','Weekly days'],['interval','Every…']].map(function(m){
        return '<div class="time-chip'+(mode===m[0]?' sel':'')+'" onclick="'+h.setMode+'('+a0+'\''+id+'\',\''+m[0]+'\')">'+m[1]+'</div>';
      }).join('')
    +'</div></div>';
  if(mode==='interval'){
    var n=parseInt(selData.freqVal,10); if(!(n>0))n=1;
    var u=(selData.freqUnit==='weeks')?'weeks':'days';
    out+='<div class="cfg-row"><div class="cfg-lbl">Inject every</div><div class="dose-row">'
      +'<input class="dose-in" type="number" min="1" inputmode="numeric" value="'+n+'" oninput="'+h.setVal+'('+a0+'\''+id+'\',this.value)" style="max-width:70px;">'
      +'<select class="unit-sel" onchange="'+h.setUnit+'('+a0+'\''+id+'\',this.value)">'
      +['days','weeks'].map(function(x){return '<option'+(x===u?' selected':'')+'>'+x+'</option>';}).join('')
      +'</select></div></div>';
  }else{
    out+='<div class="cfg-row"><div class="cfg-lbl">Days</div><div class="day-chips">'
      +DAYS_ORDER.map(function(di){
        return '<div class="day-chip'+((selData.days||[]).includes(di)?' sel':'')+'" onclick="'+h.setDay+'('+a0+'\''+id+'\','+di+')">'+DAYS_SHORT[di]+'</div>';
      }).join('')
      +'</div></div>';
  }
  return out;
}
// Switching mode must not DESTROY the other mode's settings — a user comparing the
// two and switching back would lose what they had. Both representations are kept on
// the compound; only which one the generator reads changes.
function _cadenceSetMode(c,mode){
  if(!c)return;
  c.cadence=(mode==='interval')?'interval':'days';
  if(c.cadence==='interval'&&!(parseInt(c.freqVal,10)>0)){c.freqVal=1;c.freqUnit=c.freqUnit||'days';}
  if(c.cadence==='days'&&!(c.days&&c.days.length))c.days=[1];
}

// Enhanced-tier names, kept as the delegating aliases they now are.
function _enhCadence(c){ return _cadenceOf(c); }
function _enhFreqDays(c){
  var n=parseInt(c&&c.freqVal,10); if(!(n>0))n=1;
  return (c&&c.freqUnit==='weeks') ? n*7 : n;
}
// Does this compound inject on date d? cycleStart anchors interval counting.
function _enhHitsDay(c,d,cycleStart){ return _cadenceHitsDay(c,d,cycleStart); }
// Calendar days between two consecutive injections of an enhanced compound. Interval
// cadence states it outright; weekday cadence spreads n injections over 7 days.
function _enhIntervalDays(c){ return _cadenceIntervalDays(c); }
// A configured enhanced dose is a RATE ("350 mg/week"), not the amount in the syringe.
// An injection record stores an amount, so the rate has to be converted before it is
// written.
//
// The generator was the one reader that did not convert: it stored 350 with the unit
// "mg/week" verbatim, so Today rendered "Testosterone Undecanoate (Nebido) 350 mg/week"
// directly beneath a real "Nebido 100 mg" shot, and the two read as rival doses of the
// same compound (reported 2026-08-07). tab-blood.js has always divided by injections
// per week for its curve — this is the same conversion, generalised to every cadence
// and every "/period" unit the dose dropdown offers.
//
// Units with no "/period" suffix (mg, ml, IU, %) are already per-dose and pass through
// untouched, value and unit alike.
function _enhDosePerInjection(c){
  var raw=String((c&&c.dose)||'').trim();
  var unit=String((c&&c.unit)||'');
  var slash=unit.indexOf('/');
  if(slash<0)return {dose:raw,unit:unit};
  var base=unit.slice(0,slash);
  var amount=parseDec(raw);
  if(!(amount>0))return {dose:raw,unit:base};
  var per=unit.slice(slash+1).toLowerCase();
  var periodDays=(per==='week')?7:(per==='eod')?2:1;
  var mg=(amount/periodDays)*_enhIntervalDays(c);
  return {dose:String(Math.round(mg*10)/10),unit:base};
}
// Is this enhanced-tier entry a testosterone ester? Matched on the compound NAME, not
// the id: the TRT and Enhanced catalogues key the same molecule differently ('nebido'
// vs the backend catalogue's own id), so the id says nothing about what it is. This is
// the same predicate tab-blood.js uses to route testosterone into the free-T line.
function _isEnhTestosterone(c){
  // IDENTITY FIRST, NAME ONLY AS A FALLBACK.
  // This matched solely on the name containing "testosterone". _TC_TESTO_ALIAS is the
  // list of enhanced-catalogue ester ids T-Calc already recognises (test_u/test_e/
  // test_c/test_p/sustanon), and it is the same list the PK model and the curve key on,
  // so it — not a substring — is what "is this testosterone" means. A renamed catalogue
  // entry, or an ester whose brand name omits the word (the comment below already notes
  // Nebido, Testoviron Depot and Sustanon 250 as exactly that), would otherwise generate
  // its own injection stream AND stay invisible to the plasma curve: two streams for one
  // molecule, which is the failure the T-Calc ownership rule exists to prevent.
  // The name check is kept beneath it so nothing currently detected stops being detected.
  var _id=String((c&&c.id)||'');
  if(typeof _TC_TESTO_ALIAS!=='undefined'&&_TC_TESTO_ALIAS
     &&Object.prototype.hasOwnProperty.call(_TC_TESTO_ALIAS,_id))return true;
  return String((c&&c.name)||'').toLowerCase().indexOf('testosterone')!==-1;
}
// ── T-CALC OWNS TESTOSTERONE (rule 2026-08-14) ───────────────────────────────
// Henrik: "I want T-calc to own all testosterone injections, in stack wizard TRT and
// Enhanced should use T-calc. The only way to schedule testo must be using t-calc."
//
// Is this compound testosterone, whichever tier it was configured in?
//  · Enhanced — matched on the NAME, because the enhanced catalogue keys esters by its
//    own ids (test_u / test_e / …) and the name is the only thing that identifies them.
//  · TRT — matched on the TIER, because every entry in TRT_CAT is a testosterone ester
//    and the brand names do NOT all contain the word ("Nebido", "Testoviron Depot",
//    "Sustanon 250"). The tier is the testosterone tier; there is nothing else in it.
function _isTestosteroneComp(tier,c){
  if(tier==='enhanced')return _isEnhTestosterone(c);
  return tier==='trt';
}
// The testosterone this protocol carries, in whichever tier it was configured, or null.
// Mirrors _genInjBatches: a disabled tier is not running, so it does not count. TRT is
// checked first only so the returned tier is stable when both hold one — the caller
// uses this to decide that T-Calc must schedule it, which is true either way.
function _stackTestoComp(st){
  if(!st)return null;
  var trt=(st.trt&&st.trt.enabled)?(st.trt.compounds||[]).filter(function(c){return _isTestosteroneComp('trt',c);})[0]:null;
  if(trt)return {tier:'trt',c:trt};
  var enh=(st.enhanced&&st.enhanced.enabled)?(st.enhanced.compounds||[]).filter(function(c){return _isTestosteroneComp('enhanced',c);})[0]:null;
  if(enh)return {tier:'enhanced',c:enh};
  return null;
}
// Record a compound the generator deliberately did not schedule, so the UI can name it.
// A row that vanishes with no explanation is the bug, not the fix — see
// _tcalcOwnsTestoNote / _enhDormantNoteHtml, which are what read this rule back out.
function _noteInjSuppressed(stack,cycleId,c,reason){
  if(typeof _injSuppressed==='undefined'||!_injSuppressed)return;
  var k=(stack&&stack.id)||cycleId;
  if(!_injSuppressed[k])_injSuppressed[k]=[];
  _injSuppressed[k].push({id:c&&c.id,name:(c&&(c.name||c.id))||'',reason:reason});
}
// The banner shown wherever testosterone is configured but not scheduled. Deep-links
// to T-Calc, which is where the dose, cadence and dates actually live now.
// The "Scheduled in T-Calc" note explained the 2026-08-14 suppression: a testosterone
// that sat in a protocol and generated nothing. Phase 5 removed the suppression, so the
// note would now be a lie — the compound schedules from right here.
//
// It is replaced, not simply deleted, because one case still needs explaining: a
// protocol that has not been migrated yet holds its testosterone under the Enhanced
// spelling, which still schedules but under a non-canonical id. That is worth a nudge,
// and nothing else is.
function _tcalcOwnsTestoNote(what){ return ''; }

function _unmigratedTestoNote(c){
  if(!c||!_isTestoCompoundId(c.id))return '';
  if(_canonCompoundId(c.id)===c.id)return '';
  return '<div style="background:rgba(102,136,204,0.08);border:1px solid #6688cc44;border-left:3px solid #6688cc;border-radius:8px;padding:10px 12px;margin:8px 0;">'
    +'<div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#6688cc;margin-bottom:3px">Older format</div>'
    +'<div style="font-size:11px;color:var(--muted2);line-height:1.5">'+_esc((c&&(c.name||c.id))||'This compound')
    +' is stored under its old id (<code>'+_esc(c.id)+'</code>). It schedules normally. '
    +'Settings ▸ Data ▸ Merge tiers moves it to <code>'+_esc(_canonCompoundId(c.id))+'</code>.</div>'
  +'</div>';
}
// Renders the schedule control: mode chips, then either weekday chips or an interval
// input. `pfx` is 'edit' or 'wiz' so the same markup drives both the stack editor and
// the wizard — they had duplicate day-chip blocks before this.
function _renderEnhCadence(c,selData,pfx){
  return _renderCadenceControl(c.id,selData,{setMode:pfx+'SetEnhCadence',setVal:pfx+'SetEnhFreqVal',
                                             setUnit:pfx+'SetEnhFreqUnit',setDay:pfx+'SetEnhDays'});
}
// Human-readable schedule, for summaries.
function _enhCadenceLabel(c){ return _cadenceLabel(c); }

// Which intra-day slots a split enhanced compound is scheduled in, in chronological
// order. `amPm` is the legacy field name for "this compound is split across intra-day
// slots" — kept as-is so existing stored stacks keep working; it now covers three
// slots, not two, and `times` says which of them are actually used.
//
// Back-compat: stacks saved before `times` existed have no such field. For those the
// schedule is inferred from which slot doses are populated — which is exactly what
// used to decide whether a slot generated an injection, so an existing stack keeps
// the schedule it already had. If none are populated, fall back to AM+PM, the pair
// that was always rendered before.
function _enhTimes(c){
  if(Array.isArray(c.times)&&c.times.length)
    return TIME_SLOTS.filter(function(t){return c.times.indexOf(t)>=0;});
  var inferred=TIME_SLOTS.filter(function(t){
    var v=c['dose_'+_slotKey(t)];
    return v&&parseDec(v)!==0;
  });
  return inferred.length?inferred:['AM','PM'];
}
// Total daily dose of a split enhanced compound — only slots it is scheduled in, so a
// deselected slot's leftover value never inflates the total shown in dose guidance.
function _enhSplitTotal(c){
  var n=0;
  _enhTimes(c).forEach(function(t){n+=parseDec(c['dose_'+_slotKey(t)]||0)||0;});
  return n;
}
// Seed a stack entry's per-slot doses from the enhanced catalogue defaults
// (defaultDoseAm / defaultDoseMid / defaultDosePm), and set the initial schedule to
// whichever slots the catalogue actually gives a dose for.
function _enhSeedSlots(e,cat){
  TIME_SLOTS.forEach(function(t){
    var k=_slotKey(t),C=k.charAt(0).toUpperCase()+k.slice(1);
    e['dose_'+k]=String(cat['defaultDose'+C]||'');
  });
  var seeded=TIME_SLOTS.filter(function(t){return parseDec(e['dose_'+_slotKey(t)]||0)!==0;});
  e.times=seeded.length?seeded:['AM'];
}
function _renderSlotTimingHint(id,times){
  if(!_isGhAxis(id)||!times||!times.length)return'';
  var parts=TIME_SLOTS.filter(function(t){return times.indexOf(t)>=0;})
    .map(function(t){return _slotLabel(t)+' ('+SLOT_FASTED_HINT[t]+')';});
  if(!parts.length)return'';
  return'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin:2px 0 6px">'
    +'Dose in a low-insulin window — '+_esc(parts.join(' · '))+'.</div>';
}
var DAYS_SHORT=['S','M','T','W','T','F','S'];
var DAYS_ORDER=[1,2,3,4,5,6,0]; // display order: Mon first (Sun last)

function wizStepGoals(body,footer){
  var PEPTIDE_GOALS=[{id:'muscle',label:'Muscle & Recovery',icon:'💪'},{id:'recovery',label:'Injury & Healing',icon:'🩹'},{id:'skin',label:'Skin & Anti-aging',icon:'✨'},{id:'fat',label:'Fat Loss',icon:'🔥'},{id:'cognitive',label:'Cognitive',icon:'🧠'},{id:'antiaging',label:'Longevity',icon:'⏳'}];
  var trtOn=_wiz.trt.enabled;
  var enhOn=_wiz.goals.includes('enhanced');
  var html='<div class="wiz-section">Peptide Goals</div><div class="goal-grid">';
  PEPTIDE_GOALS.forEach(function(g){
    var sel=_wiz.goals.includes(g.id)?'sel':'';
    html+='<div class="goal-chip '+sel+'" onclick="wizToggleGoal(\''+g.id+'\')">'+g.icon+' '+g.label+'</div>';
  });
  html+='</div><div style="font-size:12px;color:var(--muted2);margin-top:8px;margin-bottom:16px;">Select all that apply — filters the peptide catalogue.</div>';
  // ── ONE SECTION, ONE TOGGLE: COMPOUNDS ────────────────────────────────────
  // Henrik, 2026-08-20: "Wizard still have the choice between TRT and Enhanced, this
  // isn't true anymore" and then, after I merged only the headings: "Why you ignore
  // this? TRT and Enhanced should never be separated."
  //
  // He is right, and the headings were the smaller half. Two toggles that grey each
  // other out ARE the separation — they make the user pick which of two places their
  // testosterone lives, which is exactly the question Phase 4 removed by merging the
  // tiers. Plan ▸ Compounds holds testosterone beside the 19-nors, orals and GH; the
  // wizard now asks the same single question.
  //
  // ONE toggle. On means "this protocol has compounds", and the steps that follow
  // pick which. Testosterone is chosen in the 'trt' step for everyone; the rest of the
  // catalogue follows in the 'enhanced' step, locked per tier by the same
  // _compoundAllowedForTier the Compounds tab uses. Tier is what a compound costs, not
  // a fork in the flow.
  if(_wizTier()>=2){
    var compOn = trtOn || enhOn;
    html+='<div class="wiz-section">Compounds</div>';
    html+='<div style="font-size:12px;color:var(--muted2);margin-top:6px;margin-bottom:12px;">'
       +  'TRT and other enhanced compounds. Testosterone, 19-nors, orals and GH all sit '
       +  'together in Plan ▸ Compounds once the protocol is built.</div>';
    html+='<div class="trt-toggle" onclick="wizToggleCompounds()"><div class="trt-toggle-label">⚡ Testosterone &amp; enhanced compounds</div><div class="toggle-sw'+(compOn?' on':'')+'"></div></div>';
    html+='<div style="font-size:12px;color:var(--muted2);margin-top:6px;margin-bottom:16px;">'
       +  (compOn
            ? 'Pick the ester, dose and schedule next'+(_wizTier()>=3?', then anything else you are running.':'.')
            : 'Add Testoviron, Nebido or another ester'+(_wizTier()>=3?', plus any other compound.':' to your protocol.'))
       +  '</div>';
  }
  body.innerHTML=html;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
}
// ONE toggle for the whole Compounds section (2026-08-20). The old pair set 'trt' and
// 'enhanced' as MUTUALLY EXCLUSIVE goals — each handler explicitly removed the other and
// wiped its compounds. That mutual exclusion was the separation Henrik asked to end, so
// this sets them TOGETHER instead.
//
// Both flags stay in the model rather than being replaced by one: they carry the tier
// entitlement ('enhanced' only from tier 3) and they select the wizard steps, and every
// downstream reader — _wizFlow, saveWizard, _stackTestoComp — already understands them.
// A single new flag would have meant rewriting all of that in the same change.
function wizToggleCompounds(){
  if(_wizTier()<2)return;
  var on = !!(_wiz.trt&&_wiz.trt.enabled) || _wiz.goals.indexOf('enhanced')>=0;
  var eIdx=_wiz.goals.indexOf('enhanced');
  var tIdx=_wiz.goals.indexOf('trt');
  if(!_wiz.trt)_wiz.trt={};
  if(on){
    // OFF: clear both sides, including the enhanced prefill, so re-enabling starts clean.
    _wiz.trt.enabled=false; _wiz.trt.compounds=[];
    if(tIdx!==-1)_wiz.goals.splice(tIdx,1);
    eIdx=_wiz.goals.indexOf('enhanced');
    if(eIdx!==-1)_wiz.goals.splice(eIdx,1);
    if(_wiz.enhanced){_wiz.enhanced.enabled=false;_wiz.enhanced.compounds=[];_wiz.enhanced._prefilled=false;}
  }else{
    _wiz.trt.enabled=true;
    if(!_wiz.trt.compounds)_wiz.trt.compounds=[];
    if(tIdx===-1)_wiz.goals.push('trt');
    // The rest of the catalogue is a tier-3 step. A tier-2 user still gets the
    // testosterone step, which is what their tier holds — the flow is the same shape,
    // it just ends sooner.
    if(_wizTier()>=3 && eIdx===-1)_wiz.goals.push('enhanced');
  }
  wizStepGoals(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}

function wizToggleGoalTRT(){
  if(_wizTier()<2)return;
  _wiz.trt.enabled=!_wiz.trt.enabled;
  if(!_wiz.trt.compounds)_wiz.trt.compounds=[];
  var i=_wiz.goals.indexOf('trt');
  if(_wiz.trt.enabled){
    if(i===-1)_wiz.goals.push('trt');
    var eIdx=_wiz.goals.indexOf('enhanced');
    if(eIdx!==-1)_wiz.goals.splice(eIdx,1);
    if(_wiz.enhanced){_wiz.enhanced.enabled=false;_wiz.enhanced.compounds=[];_wiz.enhanced._prefilled=false;}
  }else{_wiz.trt.compounds=[];if(i!==-1)_wiz.goals.splice(i,1);}
  wizStepGoals(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}

function wizToggleGoal(id){
  var i=_wiz.goals.indexOf(id);
  if(i===-1){
    _wiz.goals.push(id);
    if(id==='trt'){_wiz.trt.enabled=true;if(!_wiz.trt.compounds)_wiz.trt.compounds=[];}
    if(id==='enhanced'){
      var tIdx=_wiz.goals.indexOf('trt');
      if(tIdx!==-1)_wiz.goals.splice(tIdx,1);
      _wiz.trt.enabled=false;_wiz.trt.compounds=[];
    }
  } else {
    _wiz.goals.splice(i,1);
    if(id==='trt'){_wiz.trt.enabled=false;_wiz.trt.compounds=[];}
    if(id==='enhanced'){if(_wiz.enhanced){_wiz.enhanced.enabled=false;_wiz.enhanced.compounds=[];_wiz.enhanced._prefilled=false;}}
  }
  wizStepGoals(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}

function wizStepPeptides(body,footer){
  var filtered=PEPTIDE_CAT.filter(function(p){return !p.goals.every(function(g){return g==='trt';})&&p.group!=='Enhanced';});
  if(_wiz.goals.length){filtered=filtered.filter(function(p){return p.goals.some(function(g){return _wiz.goals.includes(g);});});}
  var groups={};
  filtered.forEach(function(p){if(!groups[p.group])groups[p.group]=[];groups[p.group].push(p);});
  var selIds=_wiz.peptides.map(function(x){return x.id;});
  _wiz.peptides.forEach(function(sp){
    if(!filtered.find(function(f){return f.id===sp.id;})){
      var cat=PEPTIDE_CAT.find(function(c){return c.id===sp.id;});
      if(cat){if(!groups['Selected'])groups['Selected']=[];groups['Selected'].push(cat);}
    }
  });
  var html='';
  if(!_wiz.goals.length)html+='<div style="font-size:12px;color:var(--muted2);margin-bottom:12px;">Showing all peptides. Select goals on the previous step to filter.</div>';
  Object.keys(groups).forEach(function(grp){
    html+='<div class="wiz-section">'+grp+'</div>';
    groups[grp].forEach(function(p){
      var isSel=selIds.includes(p.id);
      html+='<div class="pep-card'+(isSel?' sel':'')+'" onclick="wizTogglePep(\''+p.id+'\')"><div class="pep-dot-sm" style="background:'+p.dot+'"></div><div class="pep-info"><div class="pep-name">'+p.name+'</div><div class="pep-meta">'+(_halfLifeLabel(p)||p.desc)+'</div></div><div style="display:flex;align-items:center;gap:10px"><button class="info-btn" onclick="event.stopPropagation();showPeptideCard(\''+p.id+'\')">ℹ</button><div class="pep-chk">'+(isSel?'<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</div></div></div>';
    });
  });
  body.innerHTML=html;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
}

function wizTogglePep(id){
  var idx=_wiz.peptides.findIndex(function(p){return p.id===id;});
  if(idx===-1){
    var cat=PEPTIDE_CAT.find(function(c){return c.id===id;});
    if(!cat)return;
    var d=cat.dflt;
    _wiz.peptides.push(Object.assign({id:id,name:cat.name,dot:cat.dot,times:d.times.slice(),days:d.days.slice(),note:'',active:true},_slotFieldsFromDflt(d)));
  } else {
    _wiz.peptides.splice(idx,1);
  }
  wizStepPeptides(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}

function wizShowCheck(){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:400;display:flex;align-items:flex-end;justify-content:center;';
  overlay.onclick=function(e){if(e.target===overlay){overlay.remove();window._wizCheckSheet=null;}};
  var sheet=document.createElement('div');
  sheet.style.cssText='background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:70vh;overflow-y:auto;';
  window._wizCheckSheet=sheet;
  var pepObjs=_wiz.peptides.map(function(p){return PEPTIDE_CAT.find(function(c){return c.id===p.id;})||{id:p.id,cg:[]};});
  sheet.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--accent)">PROTOCOL CHECK</div><button onclick="this.closest(\'[style*=fixed]\').remove();window._wizCheckSheet=null;" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer">×</button></div>'+renderCheckResults(pepObjs,'wizpopup');
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

function wizStepCheck(body,footer){
  if(!_wiz.peptides.length){
    body.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--muted2);">No peptides selected. Go back and add some.</div>';
    footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
    return;
  }
  var pepObjs=_wiz.peptides.map(function(p){return PEPTIDE_CAT.find(function(c){return c.id===p.id;})||{id:p.id,cg:[]};});
  var issues=checkStack(pepObjs);
  var hasErrors=issues.some(function(i){return i.level==='err';});
  var html='<div class="wiz-section" style="margin-bottom:8px">Selected peptides</div>';
  _wiz.peptides.forEach(function(p){
    html+='<div style="display:flex;align-items:center;gap:8px;padding:5px 0"><div style="width:7px;height:7px;border-radius:50%;background:'+(p.dot||'#888')+';flex-shrink:0"></div><span style="font-size:13px;color:var(--text)">'+p.name+'</span></div>';
  });
  html+='<div class="wiz-section" style="margin-top:16px;margin-bottom:8px">Validation</div><div id="wiz-chk-section">'+renderCheckResults(pepObjs,'wizinline')+'</div>';
  body.innerHTML=html;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
}
// Contextual safety note for a compound tier (peptide / trt / enhanced) — a short,
// dismissible watch/test/stop card shown in every tier's dose-guidance view.
// Un-gated: safety always surfaces. Content is served from the backend.
function _renderSafetyNote(tier){
  if(typeof _safetyDismissed!=='undefined'&&_safetyDismissed[tier])return '';
  var n=(typeof _safetyNotes!=='undefined'&&_safetyNotes)?_safetyNotes[tier]:null;
  if(!n)return '';
  return '<div data-safety="'+tier+'" style="margin-top:8px;background:rgba(255,176,60,0.06);border:1px solid rgba(255,176,60,0.25);border-radius:8px;padding:9px 11px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><span style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">⚠️</span><span style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--warning)">Safety'+(n.label?' — '+_esc(n.label):'')+'</span></span>'+
    '<button onclick="dismissSafety(\''+tier+'\',this)" style="background:none;border:none;color:var(--muted2);font-size:15px;line-height:1;cursor:pointer;padding:0 2px">&times;</button></div>'+
    '<div style="font-size:11px;color:var(--text);line-height:1.5">'+
      (n.watch?'<div><b style="color:var(--muted2)">Watch:</b> '+_esc(n.watch)+'</div>':'')+
      (n.test?'<div style="margin-top:2px"><b style="color:var(--muted2)">Test:</b> '+_esc(n.test)+'</div>':'')+
      (n.stop?'<div style="margin-top:2px"><b style="color:var(--muted2)">Stop:</b> '+_esc(n.stop)+'</div>':'')+
    '</div></div>';
}
function dismissSafety(tier,el){if(typeof _safetyDismissed!=='undefined')_safetyDismissed[tier]=1;var c=(el&&el.closest)?el.closest('[data-safety]'):null;if(c&&c.parentNode)c.parentNode.removeChild(c);}
// ── IS THIS GUIDE SCALED PER DOSE, OR PER WEEK? ─────────────────────────────
// Reported 2026-08-20: "Adding a second 3mg dose on Wednesday doesn't change the dose
// info, it stuck on 2-4mg." Retatrutide 3 mg on two days is 6 mg/week, which is the
// OPTIMAL band (4–8) — but the caller passed the PER-DOSE 3, so it matched Therapeutic
// (2–4) and never moved however many days were added.
//
// DOSE_GUIDE's own header says "lo/hi = per-dose numeric bounds", and for 15 of the 22
// compounds that is true. Three are not: retatrutide, tirzepatide and semaglutide state
// their bands as a WEEKLY total ("2–4 mg/wk", bounds 2–4) because that is how GLP-1s
// are prescribed. Comparing a per-injection amount against a weekly band is a category
// error, and it silently under-reports the tier the user is actually in — the direction
// that matters, since the tiers carry the risk notes.
//
// The distinction is in the tier's own label, so no data migration is needed:
//   "2–4 mg/wk"        → a weekly TOTAL
//   "1000 IU × 3/wk"   → a per-dose amount with a frequency, NOT a weekly total
// The `×` is what separates them. tb500, motsc, nad and hcg all read the second way and
// keep per-dose comparison, which is what their bounds already assume.
function _doseGuideIsWeekly(tiers){
  return (tiers||[]).some(function(t){
    var d=String((t&&t.d)||'');
    if(d.indexOf('×')>=0)return false;
    return /[\d.]\s*(mg|µg|mcg|iu|ml)\s*\/\s*(wk|week)/i.test(d);
  });
}

// What the protocol actually delivers in a week: every slot dosed, on every day chosen.
// Slot doses are summed as written — a peptide mixing units across its own slots would
// need converting, and none in the catalogue does.
function _weeklyDoseTotal(p){
  if(!p)return 0;
  var days=(p.days&&p.days.length)?p.days.length:0;
  if(!days)return 0;
  var perDay=0;
  (typeof TIME_SLOTS!=='undefined'?TIME_SLOTS:['AM','PM']).forEach(function(t){
    if(!(p.times&&p.times.indexOf(t)>=0))return;
    perDay+=parseDec(p['dose_'+_slotKey(t)])||0;
  });
  return perDay*days;
}

function _renderDoseGuide(pepId,currentDose,weeklyDose){
  var tiers=DOSE_GUIDE&&DOSE_GUIDE[pepId];
  if(!tiers||!tiers.length)return'';
  var _weekly=_doseGuideIsWeekly(tiers);
  var _val=_weekly?weeklyDose:currentDose;
  var dose=typeof _val==='number'&&!isNaN(_val)?_val:0;
  var activeTierIdx=-1;
  if(dose>0){
    for(var ti=0;ti<tiers.length;ti++){
      var t=tiers[ti];
      if(typeof t.lo==='number'){
        if(dose>=t.lo&&(typeof t.hi!=='number'||dose<t.hi)){activeTierIdx=ti;break;}
      }
    }
  }
  var rows=tiers.map(function(t,i){
    var isActive=activeTierIdx!==-1?(i===activeTierIdx):!!t.b;
    var bg=isActive?'background:rgba(var(--accent-rgb,60,255,160),0.08);border:1px solid rgba(var(--accent-rgb,60,255,160),0.3);':'background:var(--surface2);border:1px solid var(--border);';
    var doseHtml=t.d?('<span style="font-size:12px;font-weight:700;color:var(--accent);white-space:nowrap">'+t.d+'</span>'):'';
    var note=t.n?('<span style="font-size:11px;color:var(--muted2);flex:1">'+t.n+'</span>'):'';
    var risk=t.r?('<div style="font-size:11px;color:#f59e0b;padding:2px 0 0 0">⚠ '+t.r+'</div>'):'';
    var _pev=t.ev||null;var _pb=(_pev&&typeof _evBadge==='function')?_evBadge(_pev.g):'';var _pa=(typeof _anchorLine==='function')?_anchorLine(t.evidence||null,_pev):'';var _pc=(_pev&&typeof _citeChips==='function')?_citeChips(_pev.cite):'';
    return'<div style="'+bg+'border-radius:6px;padding:5px 8px;margin-bottom:3px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:10px;font-weight:700;color:'+(isActive?'var(--accent)':'var(--muted2)')+';text-transform:uppercase;min-width:62px">'+t.l+'</span>'+doseHtml+_pb+'</div>'+note+risk+_pa+_pc+'</div>';
  });
  var profile=_userProfile();
  var hasProfile=profile.age>0||profile.weight_kg>0;
  var mods=_dosePersonalization(pepId,profile);
  var modHtml='';
  if(mods.length){var colorMap={adj:'#3b9eff',ok:'#3cffa0',warn:'#f59e0b',info:'#c084fc'};modHtml='<div style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px">'+mods.map(function(m){var c=colorMap[m.type]||'#3b9eff';return'<div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:4px"><span style="color:'+c+';font-size:12px;line-height:1.4;margin-top:1px">●</span><span style="font-size:11px;color:var(--text);line-height:1.4">'+m.text+'</span></div>';}).join('')+'</div>';}else if(!hasProfile){modHtml='<div style="margin-top:6px;font-size:11px;color:var(--muted2);font-style:italic">Add age & weight in Body tab for personalized dosing</div>';}
  // Say WHICH number is being matched. A highlight that moves when you add a day is
  // confusing unless the panel admits it is reading a weekly total.
  var _hdr='Recommended Doses';
  var _sub=_weekly
    ? '<div style="font-size:10px;color:var(--muted2);text-transform:none;letter-spacing:0;font-weight:400;margin-bottom:6px">Matched against '+
      (dose>0?('<b style="color:var(--accent)">'+(Math.round(dose*100)/100)+'</b>/week'):'your weekly total')+
      ' — dose × days</div>'
    : '';
  return'<div class="cfg-row" style="display:block"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px">'+_hdr+'</div>'+_sub+rows.join('')+modHtml+'</div>'+_renderSafetyNote('peptide');
}
function _renderRampSection(p,pi){
  var hasRamp=!!(p.dose_phases&&p.dose_phases.length);
  var btn='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:'+(hasRamp?'8px':'0')+'"><span style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase">Dose Escalation</span><div onclick="wizToggleRamp('+pi+')" style="cursor:pointer"><div class="toggle-sw'+(hasRamp?' on':'')+'"></div></div></div>';
  if(!hasRamp)return'<div class="cfg-row" style="display:block">'+btn+'</div>';
  var phases=(p.dose_phases||[]).slice().sort(function(a,b){return a.w-b.w;});
  var rows=phases.map(function(ph,phi){
    var uOpts=UNITS.map(function(u){return'<option value="'+u+'"'+(u===_canonUnit(ph.u||'mg')?' selected':'')+'>'+(UNIT_LABELS[u]||u)+'</option>';}).join('');
    return'<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">'
      +'<span style="font-size:11px;color:var(--muted2);white-space:nowrap;min-width:30px">Wk</span>'
      +'<input class="dose-in" type="number" inputmode="numeric" min="0" value="'+ph.w+'" oninput="wizSetPhase('+pi+','+phi+',\'w\',+this.value)" style="width:44px;text-align:center;">'
      +'<input class="dose-in" type="text" inputmode="decimal" value="'+String(ph.d||'')+'" oninput="wizSetPhase('+pi+','+phi+',\'d\',this.value)" placeholder="dose" style="width:60px;">'
      +'<select class="unit-sel" onchange="wizSetPhase('+pi+','+phi+',\'u\',this.value)">'+uOpts+'</select>'
      +'<button onclick="wizRemovePhase('+pi+','+phi+')" style="background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;padding:0 4px;line-height:1">×</button>'
      +'</div>';
  }).join('');
  return'<div class="cfg-row" style="display:block">'+btn
    +'<div style="font-size:11px;color:var(--muted2);margin-bottom:8px">Dose auto-updates each day based on cycle week</div>'
    +rows
    +'<button onclick="wizAddPhase('+pi+')" style="font-size:11px;color:var(--accent);background:none;border:1px solid var(--accent);border-radius:6px;padding:3px 10px;cursor:pointer;font-family:inherit;margin-top:2px">+ Add phase</button>'
    +'</div>';
}
function wizStepConfig(body,footer){
  if(!_wiz.peptides.length){body.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--muted2);">No peptides selected. Go back and add some.</div>';footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';return;}
  var html='<div style="font-size:12px;color:var(--muted2);margin-bottom:14px;">Configure dose, timing and frequency for each peptide.</div>';
  _wiz.peptides.forEach(function(p,pi){
    var cat=PEPTIDE_CAT.find(function(c){return c.id===p.id;});
    var dot=p.dot||(cat?cat.dot:'#888');
    html+='<div class="cfg-block"><div class="cfg-name"><div style="width:9px;height:9px;border-radius:50%;background:'+dot+';flex-shrink:0"></div>'+p.name+'<button class="info-btn" style="margin-left:auto;" onclick="showPeptideCard(\''+p.id+'\')">ℹ</button></div>';
    html+='<div class="cfg-row"><div class="cfg-lbl">Timing</div><div class="time-chips">';
    TIME_SLOTS.forEach(function(t){html+='<div class="time-chip'+(p.times&&p.times.includes(t)?' sel':'')+'" onclick="wizToggleTime('+pi+',\''+t+'\')">'+_slotLabel(t)+'</div>';});
    html+='</div></div>';
    TIME_SLOTS.forEach(function(t){
      if(!(p.times&&p.times.includes(t)))return;
      var k=_slotKey(t);
      html+='<div class="cfg-row"><div class="cfg-lbl">'+_slotLabel(t)+' Dose</div><div class="dose-row"><input class="dose-in" type="text" inputmode="decimal" value="'+String(p['dose_'+k]||'')+'" oninput="wizSetDose('+pi+',\''+k+'\',this.value)" placeholder="0"><select class="unit-sel" onchange="wizSetUnit('+pi+',\''+k+'\',this.value)">'+UNITS.map(function(u){return'<option value="'+u+'"'+(u===_canonUnit(p['unit_'+k]||_slotFirstUnit(p)||'mg')?' selected':'')+'>'+(UNIT_LABELS[u]||u)+'</option>';}).join('')+'</select></div></div>';
    });
    html+=_renderSlotTimingHint(p.id,p.times);
    html+=_renderPepCadence(pi,p,'wiz');
    html+='<div class="cfg-row"><div class="cfg-lbl">Note (optional)</div><input class="note-in" type="text" value="'+String(p.note||'')+'" oninput="wizSetNote('+pi+',this.value)" placeholder="e.g. fasted, pre-sleep..."></div>';
    html+='<div id="pep-guide-'+pi+'">'+_renderDoseGuide(p.id,parseDec(_slotFirstDose(p))||0,_weeklyDoseTotal(p))+'</div>';
    html+=_renderRampSection(p,pi);
    html+='</div>';
  });
  body.innerHTML=html;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
}

function wizToggleTime(pi,t){var p=_wiz.peptides[pi];if(!p)return;if(!p.times)p.times=[];var i=p.times.indexOf(t);if(i===-1)p.times.push(t);else if(p.times.length>1)p.times.splice(i,1);wizStepConfig(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));}
// Refreshes the guide IN PLACE. A full wizStepConfig() re-render on every keystroke
// would tear out the input being typed into and take the caret with it — which is why
// this handler never re-rendered at all, and why the highlight used to sit still until
// something else redrew the step.
function wizSetDose(pi,slot,val){
  var p=_wiz.peptides[pi];if(!p)return;
  p['dose_'+_slotKey(slot)]=val;
  var el=document.getElementById('pep-guide-'+pi);
  if(el)el.innerHTML=_renderDoseGuide(p.id,parseDec(_slotFirstDose(p))||0,_weeklyDoseTotal(p));
}
function wizSetUnit(pi,slot,val){var p=_wiz.peptides[pi];if(!p)return;p['unit_'+_slotKey(slot)]=val;}
function wizSetNote(pi,val){var p=_wiz.peptides[pi];if(!p)return;p.note=val;}
function wizToggleRamp(pi){
  var p=_wiz.peptides[pi];if(!p)return;
  if(p.dose_phases&&p.dose_phases.length){
    delete p.dose_phases;
  } else {
    // Pre-populate with DEFAULT_PHASES for this compound, or a single phase at current dose
    var def=DEFAULT_PHASES&&DEFAULT_PHASES[p.id];
    if(def){p.dose_phases=def.map(function(ph){return{w:ph.w,d:ph.d,u:ph.u};});}
    else{var u=_slotFirstUnit(p)||'mg';p.dose_phases=[{w:0,d:_slotFirstDose(p),u:u}];}
  }
  wizStepConfig(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function wizAddPhase(pi){
  var p=_wiz.peptides[pi];if(!p)return;
  if(!p.dose_phases)p.dose_phases=[];
  var lastW=p.dose_phases.length?Math.max.apply(null,p.dose_phases.map(function(ph){return ph.w||0;})):0;
  var u=p.dose_phases.length?p.dose_phases[p.dose_phases.length-1].u:(p.unit_am||'mg');
  p.dose_phases.push({w:lastW+4,d:'',u:u});
  wizStepConfig(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function wizRemovePhase(pi,phi){
  var p=_wiz.peptides[pi];if(!p||!p.dose_phases)return;
  p.dose_phases.splice(phi,1);
  if(!p.dose_phases.length)delete p.dose_phases;
  wizStepConfig(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function wizSetPhase(pi,phi,field,val){
  var p=_wiz.peptides[pi];if(!p||!p.dose_phases||!p.dose_phases[phi])return;
  p.dose_phases[phi][field]=val;
}

// Returns a normalised array of compound objects from any trt shape (new or legacy)
function _trtCompounds(trt){
  if(!trt||!trt.enabled)return [];
  if(trt.compounds&&trt.compounds.length)return trt.compounds;
  if(trt.compound){return [{id:'',name:trt.compound,dot:'var(--accent4)',dose:'',unit:'mg',freqVal:0,freqUnit:'weeks'}];}
  return [];
}
// Resolve TRT compound from a dose ID (handles both new-style id_date and legacy testo_N_date)
function _trtCompoundFromDoseId(id){
  for(var i=0;i<TRT_CAT.length;i++){if(id.startsWith(TRT_CAT[i].id+'_'))return TRT_CAT[i];}
  if(id.startsWith('testo_'))return TRT_CAT.find(function(c){return c.id==='testoviron';})||{name:'Testoviron',dot:'#e05050'};
  if(id.startsWith('nebido_'))return TRT_CAT.find(function(c){return c.id==='nebido';})||{name:'Nebido',dot:'#e8a020'};
  return null;
}
function _isTRTDoseId(id){return !!_trtCompoundFromDoseId(id);}
// Inner tab switcher HTML for stack view / editor
function _stackTabBar(activeTab,setter){
  var t3=(_userTier||1)>=3;
  // ONE COMPOUNDS TAB. Phase 4: "We will fold enhanced and TRT into one unified tab,
  // all is part of a Protocol" (Henrik, 2026-08-16). The tier-3 gate did not disappear
  // with the tab — it moved onto the groups inside it, so testosterone stays available
  // to everyone exactly as the TRT tab was, and the rest stays gated exactly as
  // Enhanced was.
  var tabs=[{k:'peptides',label:'Peptides'},{k:'compounds',label:'Compounds'}];
  var html='<div style="display:flex;gap:0;border-radius:8px;background:var(--surface2);border:1px solid var(--border);margin-bottom:16px;overflow:hidden;">';
  tabs.forEach(function(t){
    var active=t.k===activeTab;
    var bg=active&&!t.locked?'var(--accent)':'transparent';
    var color=active&&!t.locked?'#000':'var(--muted2)';
    var opacity=t.locked?'0.45':'1';
    html+='<button onclick="'+setter+'(\''+t.k+'\')" style="flex:1;padding:9px;font-size:13px;font-weight:600;border:none;cursor:pointer;font-family:inherit;background:'+bg+';color:'+color+';opacity:'+opacity+';">'+t.label+'</button>';
  });
  html+='</div>';
  return html;
}
function _renderEnhancedUpgradeCTA(){
  return '<div style="text-align:center;padding:32px 16px;">'
    +'<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px;">Enhanced Tier</div>'
    +'<div style="font-size:13px;color:var(--muted2);line-height:1.6;margin-bottom:20px;">Track AAS compounds, bloodwork schedule and E2 management alongside your peptide protocol.</div>'
    +'<button onclick="document.getElementById(\'tab-btn-settings\').click()" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:11px 24px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Enable in Settings</button>'
    +'</div>';
}
// Testosterone can be planned two ways: as a configured TRT compound on the
// stack, OR in the T-Calc planner (which pushes dated injections to the schedule
// with cycle_id 'tcalc'). Summarise any T-Calc-planned testosterone so the TRT
// tab can surface it even when no TRT compound is configured on the stack.
function _tcalcTrtSummary(){
  if(typeof _injectionsCache==='undefined'||!_injectionsCache) return null;
  var today=(typeof dateKey==='function')?dateKey(NOW):'';
  var byComp={};
  Object.keys(_injectionsCache).forEach(function(dk){
    (_injectionsCache[dk]||[]).forEach(function(e){
      // Same selector as _blTcalcTestosterone: what the row IS, not the cycle it was
      // filed under. The old `cycle_id!=='tcalc'` test predates "the stack is the
      // container" (2026-08-06) and hid every T-Calc plan bound to a protocol — which
      // is now the only way testosterone is scheduled at all.
      if(!e) return;
      if(!(typeof _tcIsTestoRow==='function'?_tcIsTestoRow(e.tier,e.compound_id)
                                            :(!e.tier||e.tier==='trt'))) return;
      var cid=e.compound_id||e.compound_name||'testosterone';
      var c=byComp[cid]||(byComp[cid]={name:e.compound_name||cid,dot:e.dot||'#e8a020',unit:e.unit||'mg',count:0,next:null,nextDose:''});
      c.count++;
      if(e.date>=today&&(!c.next||e.date<c.next)){ c.next=e.date; c.nextDose=e.dose; }
    });
  });
  var comps=Object.keys(byComp).map(function(k){return byComp[k];});
  return comps.length?comps:null;
}
// Info card for the TRT tab that mirrors the T-Calc-planned testosterone and
// deep-links to the T-Calc tab. Returns '' when nothing is planned there.
// Stored testosterone rows that no compound in this protocol accounts for.
//
// Before Phase 5 this card said "Planned in T-Calc … not configured as a TRT compound
// here", which was true then and is a lie now: testosterone schedules from the protocol
// like everything else. The card survives for the one case that still matters — rows
// left behind by an older T-Calc plan with nothing in the protocol generating them.
// That is exactly the stray-series shape that cost a day on 2026-08-16, so it is worth
// surfacing; when the protocol does configure testosterone, the card says nothing.
function _renderTcalcTrtCard(){
  var comps=(typeof _tcalcTrtSummary==='function')?_tcalcTrtSummary():null;
  if(!comps) return '';
  var _buf=(typeof _editBuf!=='undefined'&&_editBuf)?_editBuf:null;
  if(_buf&&typeof _stackTestoComp==='function'&&_stackTestoComp(_buf)) return '';
  var rows=comps.map(function(c){
    var nextTxt=c.next?('Next '+fmtDate(new Date(c.next.replace(/-/g,'/')))):'No upcoming doses';
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
      +'<div style="width:8px;height:8px;border-radius:50%;background:'+(c.dot||'#e8a020')+';flex-shrink:0"></div>'
      +'<div style="font-size:13px;font-weight:600;color:var(--text)">'+_esc(c.name)+'</div>'
      +(c.nextDose?'<div style="font-size:12px;color:var(--muted2)">'+_esc(c.nextDose)+' '+_esc(c.unit||'mg')+'</div>':'')
      +'<div style="font-size:11px;color:var(--muted2);margin-left:auto">'+_esc(nextTxt)+'</div>'
      +'</div>';
  }).join('');
  return '<div onclick="var b=document.getElementById(\'tab-btn-tcalc\');if(b)b.click();" style="cursor:pointer;background:var(--surface2);border:1px solid #6688cc44;border-left:3px solid #6688cc;border-radius:10px;padding:12px 14px;margin-bottom:12px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#6688cc">Doses with no compound</div>'
      +'<div style="font-size:11px;color:#6688cc">Open →</div>'
    +'</div>'
    +rows
    +'<div style="font-size:10px;color:var(--muted2);margin-top:6px">These doses are stored against this protocol but no compound here generates them — they came from an older T-Calc plan. Add the compound in Compounds to take them over, or clear them in the admin Records tab.</div>'
  +'</div>';
}
// TRT tab content for stack view (read-only): compounds + injection log
function _renderTRTViewTab(st){
  var compounds=_trtCompounds(st.trt);
  var html='';
  var _tcCard=(typeof _renderTcalcTrtCard==='function')?_renderTcalcTrtCard():'';
  if(_tcCard) html+=_tcCard;
  if(!compounds.length){
    if(!_tcCard) html+='<div style="color:var(--muted2);font-size:13px;padding:8px 0;">No TRT configured for this protocol.</div>';
  }else{
    html+=_tcalcOwnsTestoNote('Testosterone');
    html+='<div class="wiz-section" style="margin-bottom:10px;">Protocol</div>';
    compounds.forEach(function(c){
      var cat=TRT_CAT.find(function(t){return t.id===c.id;})||{};
      var dot=cat.dot||c.dot||'var(--accent4)';
      html+='<div class="cfg-block" style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">';
      html+='<div style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0;"></div>';
      html+='<div style="font-size:13px;font-weight:600;color:var(--text);">'+_esc(c.name)+'</div>';
      html+='<div style="font-size:12px;color:var(--muted2);">'+(c.dose?c.dose+(c.unit||'mg')+' ':'')+_trtCadenceLabel(c)+'</div>';
      html+='</div>';
    });
  }
  return html;
}
function setStackViewTab(t){_stackViewTab=_compTabId(t);renderStackEditor();}
// The two tiers became one tab. Anything that still asks for 'trt' or 'enhanced' —
// a deep link, a stored preference, a caller not yet updated — lands on Compounds
// rather than on a tab that no longer exists, which would render an empty panel.
function _compTabId(t){return (t==='trt'||t==='enhanced')?'compounds':t;}
function setEditInnerTab(t){_collectEditInputs();_editInnerTab=_compTabId(t);renderStackEditor();}
function _buildEnhancementCycleSection(){
  var c=_cycle;
  // #639: cycles are a TRT/Enhanced-tier feature. Hide for confirmed peptide-only
  // users (fail-open — see _cyclesAllowed). An active cycle always still shows.
  if(typeof _cyclesAllowed==='function'&&!_cyclesAllowed()&&!(c&&c.startDate))return '';
  var h='<div class="wiz-section" style="margin-top:24px;">Enhancement Cycle</div>';
  if(!c||!c.startDate){
    h+='<div style="background:var(--surface2);border:1px dashed var(--border);border-radius:10px;padding:20px;text-align:center;margin-bottom:16px;">';
    h+='<div style="font-size:13px;color:var(--muted2);margin-bottom:10px;">No enhancement cycle active</div>';
    h+='<div style="font-size:12px;color:var(--muted2);line-height:1.5;margin-bottom:14px;">Track AAS compounds, bloodwork schedule and E2 management alongside your peptide protocol.</div>';
    h+='<button onclick="cycleWizardOpen()" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Start Enhancement Cycle</button>';
    h+='</div>';
    return h;
  }
  var startD=parseLocalDate(c.startDate);
  var wksOn=Math.max(0,Math.floor((NOW-startD)/604800000));
  var phases=[['foundational','Foundational'],['synergy','Synergy'],['progression','Progression']];
  var phaseCol={foundational:'var(--accent)',synergy:'var(--accent3)',progression:'var(--accent2)'};
  var curPhase=c.phase||'foundational';
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;">';
  h+='<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px;">Phase</div>';
  h+='<div style="display:flex;gap:6px;margin-bottom:10px;">';
  phases.forEach(function(ph){
    var sel=curPhase===ph[0];var col=phaseCol[ph[0]];
    h+='<button onclick="stackSetCyclePhase(\''+ph[0]+'\')" style="flex:1;padding:7px 4px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid '+(sel?col:'var(--border)')+';background:'+(sel?'rgba(255,255,255,0.07)':'transparent')+';color:'+(sel?col:'var(--muted2)')+';">'+ph[1]+'</button>';
  });
  h+='</div>';
  h+='<div style="font-size:12px;color:var(--muted2);">Week '+wksOn+' of '+(c.cycleLengthWeeks||20)+' · Started '+fmtDate(startD)+'</div>';
  h+='</div>';
  var bw=c.bloodwork||[];
  if(bw.length){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;">';
    h+='<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:10px;">Bloodwork Schedule</div>';
    bw.forEach(function(entry,bi){
      var d=new Date(startD.getTime());d.setDate(d.getDate()+entry.week*7);
      var past=d<NOW;var today=d.toDateString()===NOW.toDateString();
      var dotCol=entry.done?'var(--muted2)':today?'var(--accent)':past?'rgba(255,255,255,0.15)':'var(--accent4)';
      var nameCol=entry.done?'var(--muted2)':today?'var(--accent)':'var(--text)';
      var last=bi===bw.length-1;
      h+='<div style="display:flex;align-items:center;gap:10px;padding:5px 0;'+(last?'':'border-bottom:1px solid var(--border);')+'">';
      h+='<div style="width:8px;height:8px;border-radius:50%;background:'+dotCol+';flex-shrink:0;"></div>';
      h+='<div style="flex:1;font-size:12px;font-weight:600;color:'+nameCol+';">'+(entry.done?'<s>':'')+entry.label+(entry.done?'</s>':'')+(today?' · TODAY':'')+(entry.done?' ✓':'')+'</div>';
      h+='<span style="font-size:11px;color:var(--muted2);white-space:nowrap;">Wk '+entry.week+' — '+fmtDate(d)+'</span>';
      h+='</div>';
    });
    h+='</div>';
  }
  var cmps=c.compounds||[];
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
  h+='<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);">AAS Compounds</div>';
  h+='<button onclick="stackAddAASCompound()" style="background:none;border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">+ Add</button>';
  h+='</div>';
  if(!cmps.length){
    h+='<div style="font-size:12px;color:var(--muted2);">No compounds — tap + Add to get started.</div>';
  }else{
    cmps.forEach(function(x,xi){
      var last=xi===cmps.length-1;
      h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;'+(last?'':'border-bottom:1px solid var(--border);')+'">';
      h+='<div style="flex:1;font-size:13px;font-weight:600;color:var(--text);">'+_esc(x.name)+'</div>';
      h+='<span style="font-size:12px;color:var(--accent);font-weight:700;white-space:nowrap;">'+x.dose+' '+_esc(x.unit)+'</span>';
      h+='<button onclick="stackRemoveAASCompound('+xi+')" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;padding:0 0 0 4px;line-height:1;">&#x2715;</button>';
      h+='</div>';
    });
  }
  h+='</div>';
  var _cat=function(x){return(ENHANCEMENT_COMPOUNDS||[]).find(function(ec){return ec.name===x.name;});};
  var catCmps=cmps.map(_cat).filter(Boolean);
  var hasMast=catCmps.some(function(ec){return ec.id==='mast_e';});
  var hasPrimo=catCmps.some(function(ec){return ec.id==='primo';});
  var hasTren=catCmps.some(function(ec){return ec.id==='tren_e'||ec.id==='tren_a';});
  var has19nor=catCmps.some(function(ec){return ec.cls==='19nor';});
  var oralCmps=catCmps.filter(function(ec){return ec.cls==='oral';});
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;">';
  h+='<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px;">E2 Management</div>';
  if(!cmps.length){
    h+='<div style="font-size:12px;color:var(--muted2);">Add compounds above to see E2 strategy.</div>';
  }else if(hasMast){
    h+='<div style="font-size:12px;font-weight:700;color:var(--accent3);margin-bottom:4px;">Test + Masteron</div>';
    h+='<div style="font-size:12px;color:var(--muted2);line-height:1.6;">Masteron blocks aromatase competitively — pseudo-AI effect without crashing cardioprotective E2 to zero. Monitor for low-E2 symptoms (joint pain, flat affect, low libido) if Mast ratio climbs too high.</div>';
  }else if(hasPrimo){
    h+='<div style="font-size:12px;font-weight:700;color:var(--accent3);margin-bottom:4px;">Test + Primobolan</div>';
    h+='<div style="font-size:12px;color:var(--muted2);line-height:1.6;">Primobolan (DHT-derived) does not aromatize — reduces overall E2 load proportionally to its dose. Monitor for low-E2 symptoms (joint pain, flat affect, low libido) at high Primo ratios.</div>';
  }else if(hasTren){
    h+='<div style="font-size:12px;font-weight:700;color:var(--accent2);margin-bottom:4px;">Test + Trenbolone — monitor E2 and prolactin</div>';
    h+='<div style="font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:6px;">Tren does not aromatize — keep Test at 300–400 mg/wk to limit E2 load. Target 20–40 pg/mL via Test dose adjustment. Monitor prolactin separately: Tren has ~5× stronger progestin activity than nandrolone. If prolactin exceeds upper range: cabergoline 0.25 mg 2×/week.</div>';
    if(oralCmps.length){var on=oralCmps.map(function(ec){return ec.name.split('(')[0].trim();}).join(' + ');h+='<div style="font-size:11px;color:var(--muted2);font-style:italic;">'+on+' '+(oralCmps.length===1?'does':'do')+' not aromatize — no added E2 load from the oral component.</div>';}
  }else if(has19nor){
    h+='<div style="font-size:12px;font-weight:700;color:var(--accent2);margin-bottom:4px;">Test + 19-nor — monitor E2 and prolactin</div>';
    h+='<div style="font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:6px;">19-nor compounds (Deca, NPP) do not aromatize but have progestin activity that can drive prolactin-mediated gynecomastia independently of E2. Monitor E2 (target 20–40 pg/mL) AND prolactin. If prolactin rises: cabergoline 0.25 mg 2×/week. Adjust Test dose to manage E2; adjust compound ratio to manage prolactin.</div>';
    if(oralCmps.length){var on=oralCmps.map(function(ec){return ec.name.split('(')[0].trim();}).join(' + ');h+='<div style="font-size:11px;color:var(--muted2);font-style:italic;">'+on+' '+(oralCmps.length===1?'does':'do')+' not aromatize — no added E2 load from the oral component.</div>';}
  }else{
    var e2Lbl=oralCmps.length?'Test + '+oralCmps.map(function(ec){return ec.name.split(' ')[0];}).join('/')+'  — monitor E2':'Test — monitor E2';
    h+='<div style="font-size:12px;font-weight:700;color:var(--accent2);margin-bottom:4px;">'+e2Lbl+'</div>';
    h+='<div style="font-size:12px;color:var(--muted2);line-height:1.6;'+(oralCmps.length?'margin-bottom:6px;':'')+'">Target 20–40 pg/mL. Bloat + mood swings = high E2. Flat libido + joint ache = low E2. Adjust Test dose or compound ratios — not AIs.</div>';
    if(oralCmps.length){var on=oralCmps.map(function(ec){return ec.name.split('(')[0].trim();}).join(' and ');h+='<div style="font-size:11px;color:var(--muted2);font-style:italic;">'+on+' '+(oralCmps.length===1?'does':'do')+' not aromatize — no added E2 load from the oral component.</div>';}
  }
  h+='</div>';
  return h;
}
async function stackSetCyclePhase(phase){
  var c=_cycle;if(!c||!c.id)return;
  c.phase=phase;cycleCacheSave(c);renderStackEditor();
  try{var _rph=await fetch(AGENT_URL+'/cycles/'+c.id,{method:'PATCH',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({phase:phase})});if(!_rph.ok)_logHttp('cyclePatchPhase',_rph.status,'/cycles/'+c.id);}catch(e){_logErr('cyclePatchPhase',e);}
}
function stackAddAASCompound(){
  var c=_cycle;if(!c||!c.id){alert('No active enhancement cycle');return;}
  var ins='padding:10px 12px;border-radius:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:14px;width:100%;box-sizing:border-box;font-family:inherit;outline:none;';
  var overlay=document.createElement('div');
  overlay.id='aas-add-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;';
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  var sheet=document.createElement('div');
  sheet.style.cssText='background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px;';
  // Build grouped compound select from backend catalogue
  // Appended, not reordered — a compound whose group is absent from this list renders
  // nowhere at all, which is why the backend has a test pinning the two in step.
  var _grps=['Base','DHT-Derived','19-Nor','GH Axis','Oral','Testosterone-Derived','Blends','Estrogen Control','PCT & Recovery','Side-Effect Support'];
  var selHtml='<select id="aas-name" onchange="stackAASAutoFill(this.value)" style="'+ins+'"><option value="">— Choose compound —</option>';
  _grps.forEach(function(g){var ge=(ENHANCEMENT_COMPOUNDS||[]).filter(function(e){return e.group===g;});if(!ge.length)return;selHtml+='<optgroup label="'+g+'">';ge.forEach(function(e){selHtml+='<option value="'+e.id+'">'+e.name+'</option>';});selHtml+='</optgroup>';});
  selHtml+='</select>';
  sheet.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--accent);">ADD COMPOUND</div><button onclick="document.getElementById(\'aas-add-overlay\').remove()" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1;">&#x2715;</button></div>'
    +'<div style="display:grid;gap:10px;">'
    +selHtml
    +'<div style="display:flex;gap:8px;">'
    +'<input id="aas-dose" type="text" inputmode="decimal" placeholder="Dose" style="flex:1;padding:10px 12px;border-radius:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:14px;font-family:inherit;outline:none;">'
    +'<select id="aas-unit" style="flex:1;padding:10px 8px;border-radius:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:13px;font-family:inherit;"><option>mg/week</option><option>mg/day</option><option>mg/EOD</option><option>IU/day</option><option>IU/week</option></select>'
    +'</div>'
    +'<div id="aas-info-block"></div>'
    +'<button onclick="stackConfirmAddAAS()" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Add Compound</button>'
    +'</div>';
  overlay.appendChild(sheet);document.body.appendChild(overlay);
}
// ── FEMALE DOSE GUARD (doc 07 §9 constraint 3) ──────────────────────────────
// Rendered by _renderEnhancedGuide, which is the ONE function behind every dose guide
// in the app — wizard, edit view and the add-compound modal all route through it. Put
// anywhere else and the guard would be present on one screen and absent on the two
// where a dose actually gets typed.
//
// The male dose tiers below it stay exactly as they are. This does not replace them —
// it says, above them, that those numbers are male numbers.
function _femaleGuardHtml(cat,activeDose,unit){
  if(!cat||typeof _wizUserIsFemale!=='function'||!_wizUserIsFemale())return '';
  var adv=(typeof femaleAdvice==='function')?femaleAdvice():null;
  if(!adv)return '';
  var entry=_femaleRiskFor(adv,cat.id);
  if(!entry)return '';
  var m=_FEM_RISK_STYLE[entry.risk]||_FEM_RISK_STYLE.moderate;
  var warn=_femaleDoseWarning(adv,cat.id,activeDose,unit||cat.unit||'');
  var h='<div style="display:block;margin-top:8px"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:'+m[0]+';text-transform:uppercase;margin-bottom:4px">For women</div>'
    +'<div style="background:var(--surface2);border:1px solid '+m[0]+';border-radius:6px;padding:8px 10px;">'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+_femRiskChip(entry.risk)
    +(entry.dose?('<span style="font-size:12px;font-weight:700;color:var(--accent);">'+_esc(entry.dose)+'</span>'):'')
    +(entry.evidence&&entry.evidence!=='none'?_femEvChip(entry.evidence):'')+'</div>'
    +(entry.basis?('<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-top:5px;">'+_esc(entry.basis)+'</div>'):'')
    +(entry.dose_note?('<div style="font-size:10px;color:var(--muted2);line-height:1.5;margin-top:5px;padding-left:8px;border-left:2px solid var(--border);">'+_esc(entry.dose_note)+'</div>'):'')
    +(warn?('<div style="font-size:11px;color:#f59e0b;line-height:1.55;margin-top:6px;font-weight:600;">⚠ '+_esc(warn)+'</div>'):'')
    +'<div style="font-size:10px;color:var(--muted2);line-height:1.5;margin-top:6px;font-style:italic;">The dose tiers below are male doses.</div>'
    +'</div></div>';
  return h;
}
function _renderEnhancedGuide(cat,activeDose,unit){
  if(!cat)return'';
  var html=_femaleGuardHtml(cat,activeDose,unit);
  if(cat.cadence){var cad=cat.cadence;html+='<div style="display:block;margin-top:8px"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:4px">Injection Frequency</div><div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 10px;"><div style="font-size:12px;font-weight:700;color:var(--accent);">'+cad.rec+'</div><div style="font-size:11px;color:var(--muted2);margin-top:2px;line-height:1.5;">'+cad.note+'</div><div style="font-size:10px;color:var(--muted2);margin-top:3px;font-style:italic;">½-life: '+cad.halfLife+'</div></div></div>';}
  var tiers=(cat.doseTiers&&cat.doseTiers.length)?cat.doseTiers:(DOSE_GUIDE&&DOSE_GUIDE[cat.id]?DOSE_GUIDE[cat.id]:null);
  if(tiers&&tiers.length){var rows=tiers.map(function(t){var _isActive=(activeDose&&activeDose>0)?(function(){var _ns=(t.d||'').match(/[\d.]+/g);if(_ns&&_ns.length>=2){var _mn=parseDec(_ns[0]),_mx=parseDec(_ns[_ns.length-1]);return activeDose>=_mn&&activeDose<=_mx;}return!!t.b;})():!!t.b;var bg=_isActive?'background:rgba(var(--accent-rgb,60,255,160),0.08);border:1px solid rgba(var(--accent-rgb,60,255,160),0.3);':'background:var(--surface2);border:1px solid var(--border);';var doseHtml=t.d?('<span style="font-size:12px;font-weight:700;color:var(--accent);white-space:nowrap">'+t.d+'</span>'):'';var note=t.n?('<div style="font-size:11px;color:var(--muted2);margin-top:2px;">'+t.n+'</div>'):'';var risk=t.r?('<div style="font-size:11px;color:#f59e0b;padding:2px 0 0 0">⚠ '+t.r+'</div>'):'';var _ev=t.ev||null;var _badge=(_ev&&typeof _evBadge==='function')?_evBadge(_ev.g):'';var _anch=(typeof _anchorLine==='function')?_anchorLine(cat.evidence,_ev):'';var _cit=(_ev&&typeof _citeChips==='function')?_citeChips(_ev.cite):'';return'<div style="'+bg+'border-radius:6px;padding:5px 8px;margin-bottom:3px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:10px;font-weight:700;color:'+(_isActive?'var(--accent)':'var(--muted2)')+';text-transform:uppercase;min-width:62px">'+t.l+'</span>'+doseHtml+_badge+'</div>'+note+risk+_anch+_cit+'</div>';}).join('');html+='<div style="display:block;margin-top:8px"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px">Recommended Doses</div>'+rows+'</div>';}
  var _refs=(typeof _citeChips==='function')?_citeChips(cat.refs):'';if(cat.interaction)html+='<div style="display:block;margin-top:8px"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:4px">How it works</div><div style="font-size:12px;color:var(--text);line-height:1.5;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 10px;">'+cat.interaction+_refs+'</div></div>';
  if(cat.sides)html+='<div style="display:block;margin-top:8px"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:4px">Side effects</div><div style="font-size:12px;color:var(--text);line-height:1.5;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 10px;">'+cat.sides+_refs+'</div></div>';
  return html+_renderSafetyNote('enhanced');
}
function stackAASAutoFill(id){
  var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(x){return x.id===id;});
  if(!cat)return;
  var dEl=document.getElementById('aas-dose');if(dEl&&cat.defaultDose)dEl.value=cat.defaultDose;
  var uEl=document.getElementById('aas-unit');if(uEl&&cat.unit){Array.from(uEl.options).forEach(function(o,i){if(o.value===cat.unit||o.text===cat.unit)uEl.selectedIndex=i;});}
  var infoEl=document.getElementById('aas-info-block');if(infoEl){var _du=document.getElementById('aas-unit');infoEl.innerHTML=_renderEnhancedGuide(cat,parseDec(dEl?dEl.value:0)||0,_du?_du.value:(cat.unit||''));}
}
async function stackConfirmAddAAS(){
  var c=_cycle;if(!c||!c.id)return;
  var nameEl=document.getElementById('aas-name');
  var doseEl=document.getElementById('aas-dose');
  var unitEl=document.getElementById('aas-unit');
  if(!nameEl)return;
  var id=(nameEl.value||'').trim();
  if(!id){nameEl.style.borderColor='var(--danger)';return;}
  var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(x){return x.id===id;});
  var name=cat?cat.name:id;
  var dose=parseDec(doseEl?doseEl.value:0)||0;
  var unit=(unitEl?unitEl.value:'')||'mg/week';
  var overlay=document.getElementById('aas-add-overlay');if(overlay)overlay.remove();
  c.compounds=(c.compounds||[]).concat([{name:name,dose:dose,unit:unit,active:true,startWeek:0}]);
  cycleCacheSave(c);renderStackEditor();
  try{var _rca=await fetch(AGENT_URL+'/cycles/'+c.id,{method:'PATCH',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({compounds:c.compounds})});if(!_rca.ok)_logHttp('cyclePatchCompounds',_rca.status,'/cycles/'+c.id);}catch(e){_logErr('cyclePatchCompounds',e);}
}
async function stackRemoveAASCompound(idx){
  var c=_cycle;if(!c||!c.id)return;
  var name=(c.compounds&&c.compounds[idx])?c.compounds[idx].name:'this compound';
  if(!confirmGlobalDelete(name))return;
  c.compounds=(c.compounds||[]).filter(function(_,i){return i!==idx;});
  cycleCacheSave(c);renderStackEditor();
  try{var _rcr=await fetch(AGENT_URL+'/cycles/'+c.id,{method:'PATCH',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({compounds:c.compounds})});if(!_rcr.ok)_logHttp('cyclePatchCompounds',_rcr.status,'/cycles/'+c.id);}catch(e){_logErr('cyclePatchCompounds',e);}
}
// Generate TRT dose items for a given date from the active stack's TRT config
function _getDynamicTRTDoses(d,withIds){
  var result=[];
  var seenIds={};
  _activeStackIndices.forEach(function(si){
    var st=_userStacks[si];
    if(!st||!st.trt||!st.trt.enabled||!st.cycle_start)return;
    var start=parseLocalDate(st.cycle_start);
    var days=Math.floor((d-start)/86400000);
    if(days<0)return;
    // Against the protocol's real end, not the rounded-up week count — the same overshoot the
    // card had, which would keep rendering compounds for up to six days past the end date.
    var _trtEnd=_cycleEndDateStr(st);
    if(_trtEnd&&d>=parseLocalDate(_trtEnd))return;
    if(!_trtEnd&&st.cycle_length&&days>=st.cycle_length*7)return;
    (st.trt.compounds||[]).forEach(function(c){
      if(c.end_date&&d>parseLocalDate(c.end_date))return;
      if(c.start_date&&d<parseLocalDate(c.start_date))return;
      var cat=TRT_CAT.find(function(t){return t.id===c.id;});
      if(c.days&&c.days.length){if(!c.days.includes(d.getDay()))return;}
      else{var freqDays=c.freqUnit==='weeks'?(c.freqVal||1)*7:(c.freqVal||1);if(freqDays<=0||days%freqDays!==0)return;}
      var key=c.id+'_'+si;
      if(seenIds[key])return;
      seenIds[key]=true;
      var entry={name:c.name+(c.dose?' '+c.dose+(c.unit||'mg'):''),detail:'TRT injection — IM',time:null,dot:cat?cat.dot:'#e8a020'};
      if(withIds)entry.id=c.id+'_'+si+'_'+dateKey(d);
      result.push(entry);
    });
  });
  return result;
}
function _getDynamicEnhancedDoses(d,withIds){
  var result=[];
  var seenIds={};
  _userStacks.forEach(function(st,si){
    if(!_isActiveStack(si))return;
    if(!st||!st.enhanced||!st.enhanced.enabled||!st.enhanced.compounds||!st.enhanced.compounds.length)return;
    if(st.cycle_start){
      var start=parseLocalDate(st.cycle_start);
      var daysDiff=Math.floor((d-start)/86400000);
      if(daysDiff<0)return;
      var _enhEnd=_cycleEndDateStr(st);
      if(_enhEnd&&d>=parseLocalDate(_enhEnd))return;
      if(!_enhEnd&&st.cycle_length&&daysDiff>=st.cycle_length*7)return;
    }
    (st.enhanced.compounds||[]).forEach(function(c){
      if(!_enhHitsDay(c,d,st.cycle_start?parseLocalDate(st.cycle_start):null))return;
      var key=c.id+'_'+si;
      if(seenIds[key])return;
      seenIds[key]=true;
      var dot=c.dot||'#a855f7';
      var baseUnit=c.unit?(c.unit.split('/')[0]):'';
      var unitLabel=c.unit?(' '+c.unit):'';
      var eCat=(ENHANCEMENT_COMPOUNDS||[]).find(function(ec){return ec.id===c.id;});
      var isAmPm=c.amPm||(eCat&&eCat.amPm);
      if(isAmPm){
        _enhTimes(c).forEach(function(t){
          var k=_slotKey(t);
          if(!c['dose_'+k]||parseDec(c['dose_'+k])===0)return;
          var slotEntry={name:c.name,detail:c['dose_'+k]+(baseUnit?' '+baseUnit:''),time:t,dot:dot,compId:c.id};
          if(withIds)slotEntry.id=c.id+'_'+si+'_'+k+'_'+dateKey(d);
          result.push(slotEntry);
        });
      }else{
        var entry={name:c.name,detail:(c.dose?c.dose+unitLabel:''),time:null,dot:dot,compId:c.id};
        if(withIds)entry.id=c.id+'_'+si+'_'+dateKey(d);
        result.push(entry);
      }
    });
  });
  return result;
}
function _renderTRTGuide(cId,weeklyDoseMg){
  var g=TRT_GUIDE&&TRT_GUIDE[cId];
  if(!g)return'';
  var tColor='#e8a020';
  var cadHtml='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 10px;margin-bottom:5px">'
    +'<div style="font-size:10px;font-weight:700;color:var(--muted2);text-transform:uppercase;margin-bottom:2px">Recommended cadence</div>'
    +'<div style="font-size:12px;font-weight:700;color:'+tColor+'">'+g.cadence.rec+'</div>'
    +'<div style="font-size:11px;color:var(--muted2);margin-top:2px">'+g.cadence.note+'</div>'
    +'<div style="font-size:10px;color:var(--muted2);margin-top:3px;font-style:italic">½-life: '+g.halfLife+'</div>'
    +'</div>';
  var tiersHtml=g.tiers.map(function(t){
    var isMatch=weeklyDoseMg>0?(weeklyDoseMg>=(t.wkMin||0)&&weeklyDoseMg<=(t.wkMax||9999)):!!t.b;
    var bg=isMatch?'background:rgba(232,160,32,0.1);border:1px solid rgba(232,160,32,0.4);':'background:var(--surface2);border:1px solid var(--border);';
    var risk=t.r?'<div style="font-size:11px;color:#f59e0b;padding-top:2px">⚠ '+t.r+'</div>':'';
    return'<div style="'+bg+'border-radius:6px;padding:5px 8px;margin-bottom:3px">'
      +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<span style="font-size:10px;font-weight:700;color:'+(isMatch?tColor:'var(--muted2)')+';text-transform:uppercase;min-width:80px">'+t.l+'</span>'
      +'<span style="font-size:12px;font-weight:700;color:'+tColor+'">'+t.d+'</span>'
      +((t.ev&&typeof _evBadge==='function')?_evBadge(t.ev.g):'')
      +'</div>'
      +'<div style="font-size:11px;color:var(--muted2);margin-top:1px">'+t.freq+(t.n?' — '+t.n:'')+'</div>'
      +risk
      +((t.ev&&typeof _anchorLine==='function')?_anchorLine(g.evidence,t.ev):'')
      +((t.ev&&typeof _citeChips==='function')?_citeChips(t.ev.cite):(typeof _citeChips==='function'?_citeChips(g.refs):''))
      +'</div>';
  }).join('');
  var profile=_userProfile();
  var mods=[];
  var colorMap={warn:'#f59e0b',info:'#c084fc',adj:'#3b9eff'};
  if(profile.sex==='female')mods.push({type:'warn',text:'Female TRT doses are dramatically lower — typically 5–10 mg/week SC. Do not use male TRT doses; consult an endocrinologist.'});
  if(profile.age>0&&profile.age<25)mods.push({type:'warn',text:'Age '+profile.age+': exogenous testosterone suppresses the HPTA and may impair endogenous production long-term at this age.'});
  if(profile.age>=50)mods.push({type:'info',text:'Age '+profile.age+': natural T decline is expected — start at the standard TRT range and titrate up only if bloodwork supports it.'});
  var modHtml=mods.length?'<div style="margin-top:5px;border-top:1px solid var(--border);padding-top:5px">'+mods.map(function(m){var c=colorMap[m.type]||'#3b9eff';return'<div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:3px"><span style="color:'+c+';font-size:12px;line-height:1.4;margin-top:1px">●</span><span style="font-size:11px;color:var(--text);line-height:1.4">'+m.text+'</span></div>';}).join('')+'</div>':'';
  var supraHtml='';
  if(weeklyDoseMg>250){supraHtml='<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.4);border-radius:6px;padding:7px 10px;margin-bottom:5px"><div style="font-size:11px;font-weight:700;color:#f59e0b;margin-bottom:2px">⚠ Supraphysiological dose</div><div style="font-size:11px;color:var(--muted2);line-height:1.5;">'+Math.round(weeklyDoseMg)+' mg/week exceeds the TRT range (100–200 mg/wk). At this dose you are running a blast, not a TRT protocol. Consider tracking this compound in the Enhanced tab instead and running TRT-range Test here.</div></div>';}
  // TIER PARITY (CLAUDE.md): the female guard lives on the Enhanced tier via
  // _renderEnhancedGuide, and it has to be here too. The TRT tier is where `topical`
  // and `test_e` actually live — the two compounds the female table has the most to say
  // about — so a guard present only on Enhanced would be missing from the tier where a
  // woman is most likely to be typing a dose.
  var femHtml='';
  try{
    if(typeof _femaleGuardHtml==='function'){
      // ⚠️ cId, NOT id. The parameter is cId; `id` is undefined here, so this threw on
      // every render and the catch below swallowed it — leaving the female dosing guard
      // silently absent from the whole TRT tier, which is exactly what the note above
      // says must not happen. Found 2026-08-29 via a stray [pep:trtFemaleGuard] log.
      var _fc=(typeof TRT_CAT!=='undefined'&&TRT_CAT)?TRT_CAT.find(function(x){return x&&x.id===cId;}):null;
      femHtml=_femaleGuardHtml(_fc||{id:cId,unit:'mg/week'},weeklyDoseMg,'mg/week');
    }
  }catch(e){if(typeof _logErr==='function')_logErr('trtFemaleGuard',e);}
  return'<div class="cfg-row" style="display:block;margin-top:10px">'
    +'<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px">TRT Guide</div>'
    +femHtml+supraHtml+cadHtml+tiersHtml+modHtml+'</div>'+_renderSafetyNote('trt');
}
function _refreshTRTGuide(id,freqVal,freqUnit,dose){var el=document.getElementById('trt-guide-'+id);if(!el)return;var doseNum=parseDec(dose)||0;var freqDays=(freqUnit||'weeks')==='weeks'?(freqVal||1)*7:(freqVal||1);var weeklyDoseMg=freqDays>0?doseNum*7/freqDays:0;el.innerHTML=_renderTRTGuide(id,weeklyDoseMg);}
// T-Calc is the single place a testosterone schedule is built, so the wizard's TRT
// step IS the T-Calc simple planner rather than a second, parallel one: pick the
// ester, the dose and the cadence here, and the same plan drives the T-Calc curve.
// The classic multi-compound config is NOT removed — it is one tap away for blends
// and for anything the four-field planner cannot express.
var _wizTrtClassic = false;
function wizToggleTrtClassic(){ _wizTrtClassic = !_wizTrtClassic; wizRender(); }

// Wizard-local copy of the testosterone config. It used to seed from T-Calc's simple
// plan first, because that was where a schedule lived; Phase 6 removed that planner, so
// the protocol's own compound is now the only thing to seed from — which is also the
// thing the wizard is editing.
// ── THE WIZARD'S TESTOSTERONE STEP BECOMES A REAL SCHEDULED COMPOUND ────────
// _wiz.trtPlan is {compId, doseMg, cadenceN, cadenceUnit, cadenceDays, startDate}
// — the four things the step asks for. Until Phase 6 it was committed to T-Calc's
// simple planner; that planner is gone, so it folds into the protocol's own TRT
// compound instead, in exactly the shape the classic multi-compound step writes.
// One representation of a scheduled compound, which is the whole point of the
// rewrite.
//
// Called BEFORE saveStacksToBackend() and generateAndPushInjections(), because the
// generator reads the protocol — fold it afterwards and the first schedule would
// not appear until the next save.
//
// Deliberately does nothing when:
//   • the plan is incomplete — a half-filled step is not a schedule, and inventing
//     the missing half would be inventing doses nobody asked for;
//   • the classic step already configured testosterone inline (`trt.compounds`
//     non-empty) — those are real compounds the user set up by hand, and a planner
//     must never overwrite them. This is the `_trtInline` guard that has always
//     protected that path;
//   • the protocol already carries this molecule anywhere — an Enhanced cycle picks
//     its testosterone base in the wizard's own `base` step, and adding it again
//     here would schedule the same ester twice, the exact doubling this rewrite
//     exists to end.
function _wizFoldTrtPlanIntoProto(proto){
  if(!proto) return false;
  if(typeof _wizTrtPlanComplete!=='function' || !_wizTrtPlanComplete()) return false;
  var p=(typeof _wiz!=='undefined'&&_wiz)?_wiz.trtPlan:null;
  if(!p) return false;

  proto.trt=proto.trt||{};
  var existing=proto.trt.compounds||[];
  if(existing.length) return false;                      // classic config wins

  var id=(typeof _canonCompoundId==='function')?_canonCompoundId(p.compId):p.compId;
  if(!id) return false;
  // Already present in EITHER block, under either spelling.
  var dup=(typeof _stackTestoComp==='function')?_stackTestoComp(proto):null;
  if(dup) return false;

  var days=parseDec(p.cadenceDays);
  if(!(days>0)) return false;
  // Name and dot from the catalogue the rest of the TRT block uses, falling back to
  // the merged catalogue for an ester TRT_CAT does not list.
  var meta=(typeof TRT_CAT!=='undefined'&&TRT_CAT)
    ? TRT_CAT.find(function(t){return t.id===id;}) : null;
  if(!meta && typeof _COMPOUND_CATALOG!=='undefined' && _COMPOUND_CATALOG)
    meta=_COMPOUND_CATALOG.find(function(e){return e.id===id;});
  proto.trt.enabled=true;
  proto.trt.compounds=[{
    id:id,
    name:(meta&&meta.name)||id,
    // A per-injection amount, never a rate: the step asks "dose" alongside a
    // separate cadence, so the two are already separated and must stay that way.
    dose:String(p.doseMg),
    unit:'mg',
    dot:(meta&&meta.dot)||'#b84a4a',
    cadence:'interval',
    freqVal:days,
    freqUnit:'days',
    start_date:p.startDate||''
  }];
  return true;
}

function _wizEnsureTrtPlan(){
  if(_wiz.trtPlan) return _wiz.trtPlan;
  var seed = {compId:'', doseMg:'', cadenceN:0, cadenceUnit:'week', cadenceDays:0, startDate:'',
              mode:'', targetPmol:''};
  var c=((_wiz.trt&&_wiz.trt.compounds)||[])[0];
  if(c){
    if(!seed.compId) seed.compId=c.id||'';
    if(!seed.doseMg) seed.doseMg=c.dose||'';
    // A classic TRT compound already carries the same shape: a count plus days/weeks.
    if(!seed.cadenceDays && c.freqVal && c.freqUnit){
      seed.cadenceN    = parseInt(c.freqVal,10)||0;
      seed.cadenceUnit = c.freqUnit==='weeks' ? 'week' : 'day';
      seed.cadenceDays = (typeof _tcCadenceToDays==='function')
        ? _tcCadenceToDays(seed.cadenceN,seed.cadenceUnit)
        : (c.freqUnit==='weeks' ? c.freqVal*7 : c.freqVal);
    }
  }
  // The first injection follows the protocol's own start, which now defaults to the day
  // after the last one ends rather than to today.
  if(!seed.startDate) seed.startDate = _wiz.cycle_start
    || (typeof _nextFreeStartDate==='function' ? _nextFreeStartDate()
        : (typeof dateKey==='function' ? dateKey(NOW) : ''));
  _wiz.trtPlan=seed;
  return _wiz.trtPlan;
}
function wizSetTrtPlan(field,value){
  var p=_wizEnsureTrtPlan();
  p[field]=value;
  // Seed the solve panel so the next screen opens on the number already given, rather
  // than asking for it twice.
  if((field==='targetPmol'||field==='compId')&&p.compId&&typeof _trtSolveSt==='function'){
    try{ _trtSolveSt(p.compId,'wiz').target=String(p.targetPmol||''); }catch(e){}
  }
  wizRender();
}
// Cadence is two fields but one stored interval — mirrors _tcSetSimplePlanCadence.
function wizSetTrtCadence(field,value){
  var p=_wizEnsureTrtPlan();
  var maxN=(typeof _TC_CADENCE_MAX_N!=='undefined')?_TC_CADENCE_MAX_N:20;
  var n    = field==='cadenceN'    ? (parseInt(value,10)||0) : (parseInt(p.cadenceN,10)||0);
  var unit = field==='cadenceUnit' ? value                   : p.cadenceUnit;
  if(!(typeof _TC_CADENCE_UNITS!=='undefined'&&_TC_CADENCE_UNITS[unit])) unit='week';
  n=Math.max(0,Math.min(maxN,n));
  p.cadenceN=n; p.cadenceUnit=unit;
  p.cadenceDays=(typeof _tcCadenceToDays==='function')?_tcCadenceToDays(n,unit)
               :n*(unit==='month'?30:unit==='week'?7:1);
  wizRender();
}
function _wizTrtPlanComplete(){
  var p=_wizEnsureTrtPlan();
  return !!(p.compId && parseDec(p.doseMg)>0 && parseDec(p.cadenceDays)>0 && p.startDate);
}

// ⚠️ THE SOLVER NEEDS A COMPOUND, NOT A PLAN.
// Reported: "The free T generator fails with unknown ester?" — "Compound not found."
// with an ester plainly selected.
//
// In target mode the ester lives only in _wiz.trtPlan.compId. It does not become an
// entry in _wiz.trt.compounds until save, when _wizFoldTrtPlanIntoProto runs. But
// trtSolveRun resolves the compound through _trtComp, which reads that array — so it
// had nothing to attach to and refused. trtSolveApply reads the same array, so applying
// would have failed identically a moment later.
//
// Materialise it from the plan before solving. Dose stays EMPTY: a testosterone never
// arrives with an invented dose, and Apply is what writes the ramp.
function _wizEnsureTrtCompound(p){
  if(!p||!p.compId)return null;
  if(typeof _wiz==='undefined'||!_wiz)return null;
  if(!_wiz.trt)_wiz.trt={enabled:true,compounds:[]};
  if(!_wiz.trt.compounds)_wiz.trt.compounds=[];
  _wiz.trt.enabled=true;                 // or wizSave drops the block entirely
  var c=_wiz.trt.compounds.find(function(x){return x&&x.id===p.compId;});
  if(!c){
    var meta=(typeof TRT_CAT!=='undefined'&&TRT_CAT)
      ? TRT_CAT.find(function(t){return t.id===p.compId;}) : null;
    c={id:p.compId, name:(meta&&meta.name)||p.compId, dose:'', unit:'mg',
       cadence:'interval', freqVal:1, freqUnit:'days',
       dot:(meta&&meta.dot)||'#b84a4a', active:true};
    _wiz.trt.compounds.push(c);
  }
  if(p.startDate)c.start_date=p.startDate;
  return c;
}
async function wizTrtGenerate(){
  var p=_wizEnsureTrtPlan();
  if(!p.compId)return;
  var st=_trtSolveSt(p.compId,'wiz');
  // ⚠️ NOTHING HERE MAY REJECT SILENTLY.
  // This is an onclick handler returning a promise: an unhandled rejection anywhere
  // leaves the button looking dead, with no error and no state change. trtSolveRun
  // re-renders OUTSIDE its own try/catch, so a render fault propagated straight out.
  try{
    _wizEnsureTrtCompound(p);
    st.target=String(p.targetPmol||'');
    await trtSolveRun('wiz',p.compId);
  }catch(e){
    st.running=false;
    st.error='Could not generate a schedule: '+String((e&&e.message)||e);
    if(typeof _logErr==='function')_logErr('wizTrtGenerate',e);
  }
  // ⚠️ GENERATE AND APPLY ARE ONE ACTION HERE.
  // "The 'generate and next' need to do this in one step." In the wizard nothing is
  // saved until the end, so applying is not a commitment — and leaving it unapplied is
  // how a protocol reached the review step carrying no dose at all. The separate Apply
  // button stays in the protocol editor, where a plan REPLACES a schedule already
  // running and the choice is real.
  if(st.result&&st.result.best&&typeof trtSolveApply==='function'){
    var _res=st.result;
    try{ trtSolveApply('wiz',p.compId,'best'); }
    catch(e){ if(typeof _logErr==='function')_logErr('wizTrtAutoApply',e); }
    // Apply clears the result. In the wizard the plan is the thing the user is being
    // shown, so put it back — otherwise the step blanks out the schedule it just made.
    st.result=_res;
  }
  try{ wizRender(); }
  catch(e){ if(typeof _logErr==='function')_logErr('wizTrtGenerateRender',e); }
}
function wizStepTRTHandoff(body,footer){
  if(_wizTrtClassic) return wizStepTRT(body,footer);
  // The footer goes in FIRST and the body build is wrapped: this step reads helpers
  // that live in tab-tcalc.js, which loads after this file. If any of them is missing
  // or throws, the user must still get a usable step — a blank pane with nothing but
  // a Next button gives no way to tell a broken step from an empty one.
  // Next is the only forward action on this step, so in target mode it runs the solve
  // first and stays put to show the result; pressing it again moves on.
  var _tp=(typeof _wizEnsureTrtPlan==='function')?_wizEnsureTrtPlan():null;
  // ⚠️ APPLIED COUNTS AS SOLVED. trtSolveApply clears st.result, so testing result
  // alone flipped the footer back to "Generate" the instant the plan was applied —
  // an endless loop with no way forward.
  var _needSolve=!!(_tp&&_tp.mode==='target'&&_tp.compId&&parseDec(_tp.targetPmol)>0
                    &&(function(){var q=_trtSolveSt(_tp.compId,'wiz');
                        return !q.result&&!q.running&&!q._applied;})());
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="'
    +(_needSolve?'wizTrtGenerate()':'wizNext()')+'">'
    +(_needSolve?'Generate &amp; continue →':'Next →')+'</button>';
  try{
    _wizRenderTrtPlanner(body);
  }catch(err){
    if(typeof _logErr==='function')_logErr('wizStepTRT',err);
    body.innerHTML='<div style="font-size:13px;color:var(--muted2);padding:18px 0;line-height:1.65">'
      +'Testosterone is planned in T-Calc. Continue through this protocol, then open T-Calc to set the ester, dose and cadence.'
      +'</div><div onclick="wizToggleTrtClassic()" style="text-align:center;font-size:12px;color:var(--muted2);text-decoration:underline;cursor:pointer;padding:14px 8px 4px">Advanced: multi-compound config</div>';
  }
  if(!body.innerHTML||!body.innerHTML.trim()){
    body.innerHTML='<div style="font-size:13px;color:var(--muted2);padding:18px 0;line-height:1.65">Testosterone is planned in T-Calc — continue, then set it there.</div>';
  }
}

function _wizRenderTrtPlanner(body){
  var p=_wizEnsureTrtPlan();
  var iSty='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:11px 13px;color:var(--text);font-size:16px;font-family:inherit;outline:none;width:100%;box-sizing:border-box';
  var lSty='font-size:11px;font-weight:700;letter-spacing:0.8px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;display:block';
  var ids=(typeof _tcAllCompIds==='function')?_tcAllCompIds():((typeof TRT_CAT!=='undefined'?TRT_CAT:[]).map(function(c){return c.id;}));
  var nameOf=function(id){
    if(typeof _tcCompInfo==='function'){var cd=_tcCompInfo(id);if(cd&&cd.name)return cd.name;}
    var t=(typeof TRT_CAT!=='undefined'?TRT_CAT:[]).find(function(c){return c.id===id;});
    return t?t.name:id;
  };

  // ⚠️ TWO WAYS TO SET A DOSE, BOTH OFFERED UP FRONT.
  // Henrik, 2026-08-28: "Make the free T target wizard more prominent, present two
  // choices on this screen for Test. And explain the choices briefly, but details will
  // be on next screen."
  //
  // Solving from a target level was only reachable from a compound's config panel, so
  // this step implied the only way to start was to already know your milligrams. That
  // is the harder of the two questions and the one the app can actually answer. The
  // choice now leads, each option gets one line, and the numbers come after.
  var mode=p.mode||'';
  var html='<div style="font-size:12px;color:var(--muted2);margin-bottom:14px;line-height:1.55">Your testosterone schedule. This is the same plan T-Calc uses — set it once here and the plasma curve follows it.</div>';

  html+='<label style="'+lSty+'">How do you want to set it?</label>';
  html+='<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">';
  [['target','Target a free-T level',
    'You name the level you want; the app works out the dose and how often, allowing for any ester still clearing from before.'],
   ['dose','I know the dose',
    'You already have a protocol: enter the milligrams, how often, and when it starts.']
  ].forEach(function(o){
    var on=(mode===o[0]);
    html+='<div onclick="wizSetTrtPlan(\'mode\',\''+o[0]+'\')" style="cursor:pointer;border:1px solid '
      +(on?'var(--accent)':'var(--border)')+';background:'+(on?'rgba(232,255,60,0.06)':'var(--surface2)')
      +';border-radius:10px;padding:12px 14px">'
      +'<div style="font-size:13.5px;font-weight:700;color:'+(on?'var(--accent)':'var(--text)')+'">'+o[1]+'</div>'
      +'<div style="font-size:11.5px;color:var(--muted2);line-height:1.5;margin-top:3px">'+o[2]+'</div>'
      +'</div>';
  });
  html+='</div>';

  if(!mode){
    html+='<div style="font-size:11.5px;color:var(--muted2);line-height:1.55">Pick one to carry on — or skip this step and add testosterone under Compounds later.</div>';
    html+='<div onclick="wizToggleTrtClassic()" style="text-align:center;font-size:12px;color:var(--muted2);text-decoration:underline;cursor:pointer;padding:14px 8px 4px">Advanced: multi-compound config</div>';
    body.innerHTML=html;
    return;
  }

  if(mode==='target'){
    html+='<label style="'+lSty+'">1 · Ester</label>';
    html+='<select onchange="wizSetTrtPlan(\'compId\',this.value)" style="'+iSty+';margin-bottom:14px">';
    html+='<option value="">Select a testosterone ester…</option>';
    ids.forEach(function(id){
      html+='<option value="'+id+'"'+(p.compId===id?' selected':'')+'>'+nameOf(id)+'</option>';
    });
    html+='</select>';
    html+='<label style="'+lSty+'">2 · Target free T (pmol/L)</label>';
    html+='<input type="text" inputmode="decimal" value="'+_esc(String(p.targetPmol||''))+'" placeholder="e.g. 600" onchange="wizSetTrtPlan(\'targetPmol\',this.value)" style="'+iSty+';margin-bottom:14px">';
    html+='<label style="'+lSty+'">3 · First injection</label>';
    html+='<input type="date" value="'+(p.startDate||'')+'" onchange="wizSetTrtPlan(\'startDate\',this.value)" style="'+iSty+'">';
    var _sst=(typeof _trtSolveSt==='function'&&p.compId)?_trtSolveSt(p.compId,'wiz'):null;
    if(p.compId&&_sst&&(_sst.result||_sst.running||_sst.error)){
      html+=(typeof _renderTRTSolve==='function')
        ? _renderTRTSolve({id:p.compId,name:nameOf(p.compId)},{},'wiz',true) : '';
    }else{
      html+='<div style="margin-top:14px;font-size:11.5px;color:var(--muted2);line-height:1.55">'
        +'Press Next and the app works out the schedule — how often, and how much to draw each '
        +'time — so you can see what it holds before applying it.</div>';
    }
    html+='<div onclick="wizToggleTrtClassic()" style="text-align:center;font-size:12px;color:var(--muted2);text-decoration:underline;cursor:pointer;padding:14px 8px 4px">Advanced: multi-compound config</div>';
    body.innerHTML=html;
    return;
  }

  html+='<label style="'+lSty+'">1 · Ester</label>';
  html+='<select onchange="wizSetTrtPlan(\'compId\',this.value)" style="'+iSty+';margin-bottom:14px">';
  html+='<option value="">Select a testosterone ester…</option>';
  ids.forEach(function(id){
    html+='<option value="'+id+'"'+(p.compId===id?' selected':'')+'>'+nameOf(id)+'</option>';
  });
  html+='</select>';

  html+='<label style="'+lSty+'">2 · Dose per injection (mg)</label>';
  html+='<input type="number" inputmode="decimal" min="0" step="any" value="'+(p.doseMg||'')+'" placeholder="125" onchange="wizSetTrtPlan(\'doseMg\',this.value)" style="'+iSty+';margin-bottom:14px">';

  html+='<label style="'+lSty+'">3 · Injection cadence</label>';
  var maxN=(typeof _TC_CADENCE_MAX_N!=='undefined')?_TC_CADENCE_MAX_N:20;
  var units=(typeof _TC_CADENCE_ORDER!=='undefined')?_TC_CADENCE_ORDER:['day','week','month'];
  var uLabel=function(u,n){return (typeof _tcCadenceUnitLabel==='function')?_tcCadenceUnitLabel(u,n):(parseInt(n,10)===1?u:u+'s');};
  var curN=parseInt(p.cadenceN,10)||0;
  html+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">';
  html+='<span style="font-size:13px;color:var(--muted2);flex-shrink:0">Every</span>';
  html+='<select onchange="wizSetTrtCadence(\'cadenceN\',this.value)" style="'+iSty+';flex:1;min-width:0">';
  html+='<option value="0"'+(curN?'':' selected')+'>—</option>';
  for(var _n=1;_n<=maxN;_n++) html+='<option value="'+_n+'"'+(curN===_n?' selected':'')+'>'+_n+'</option>';
  html+='</select>';
  html+='<select onchange="wizSetTrtCadence(\'cadenceUnit\',this.value)" style="'+iSty+';flex:1.4;min-width:0">';
  units.forEach(function(u){
    html+='<option value="'+u+'"'+(p.cadenceUnit===u?' selected':'')+'>'+uLabel(u,curN)+'</option>';
  });
  html+='</select></div>';

  html+='<label style="'+lSty+'">4 · First injection</label>';
  html+='<input type="date" value="'+(p.startDate||'')+'" onchange="wizSetTrtPlan(\'startDate\',this.value)" style="'+iSty+'">';

  if(_wizTrtPlanComplete()){
    var wk=parseDec(p.doseMg)*7/parseDec(p.cadenceDays);
    html+='<div style="margin-top:14px;background:rgba(90,209,176,0.08);border:1px solid rgba(90,209,176,0.25);border-radius:10px;padding:11px 13px">'
      +'<div style="font-size:12.5px;color:#5ad1b0;font-weight:600">'+(Math.round(wk*10)/10)+' mg/week</div>'
      +'<div style="font-size:11px;color:var(--muted2);margin-top:3px;line-height:1.5">Scheduled on this protocol when you finish — you can edit it under Compounds.</div></div>';
  }else{
    html+='<div style="margin-top:14px;font-size:11.5px;color:var(--muted2);line-height:1.55">Fill in all four to schedule testosterone. You can also leave this empty and add it under Compounds later.</div>';
  }

  html+='<div onclick="wizToggleTrtClassic()" style="text-align:center;font-size:12px;color:var(--muted2);text-decoration:underline;cursor:pointer;padding:14px 8px 4px">Advanced: multi-compound config</div>';

  body.innerHTML=html;
}

function wizStepTRT(body,footer){
  var trt=_wiz.trt;
  if(!trt.compounds)trt.compounds=[];
  var sel=trt.compounds;
  var selIds=sel.map(function(c){return c.id;});
  var hasNebido=selIds.includes('nebido');
  var maxReached=hasNebido?(sel.length>=2):(sel.length>=1);
  var html='<div style="font-size:12px;color:var(--muted2);margin-bottom:12px;">Select your testosterone compound and configure the protocol.</div>';
  // The classic multi-compound editor still exists, but it no longer schedules: it
  // records what the protocol runs, and T-Calc injects it (rule 2026-08-14).
  html+=_tcalcOwnsTestoNote('Testosterone');
  if((_wiz.goals||[]).includes('enhanced')){
    html+='<div style="background:rgba(224,80,80,0.06);border-left:3px solid #e05050;border-radius:8px;padding:11px 13px;margin-bottom:12px;font-size:11.5px;color:var(--muted2);line-height:1.6"><b style="color:var(--text)">Combined cycle</b> — with a second anabolic driving growth, testosterone is often run at a <b>physiological base</b> (the Standard TRT tier below) to hold libido, mood and function while limiting dose-dependent sides (estrogen, haematocrit). Testosterone is dose-dependently anabolic (Bhasin 2001), so a lower base still contributes to the load. <i>The reduce-test-while-stacking approach is common practice but has no controlled-trial evidence — treat it as guidance, not fact.</i></div>';
  }
  if(hasNebido&&sel.length===1){
    html+='<div style="font-size:11px;color:var(--muted2);margin-bottom:8px;">Nebido selected — you can add one short-acting compound for loading or bridging.</div>';
  }
  TRT_CAT.forEach(function(c){
    var isSel=selIds.includes(c.id);
    var disabled=!isSel&&maxReached;
    var selData=isSel?sel.find(function(s){return s.id===c.id;}):null;
    html+='<div class="pep-card'+(isSel?' sel':'')+(disabled?' disabled':'')+'" onclick="'+(disabled?'':('wizToggleTRTCompound(\''+c.id+'\')'))+'" style="margin-bottom:'+(isSel?'0':'8px')+';'+(isSel?'border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom-color:transparent;':'')+(disabled?'opacity:0.4;cursor:default;pointer-events:none;':'')+'"><div class="pep-dot-sm" style="background:'+c.dot+'"></div><div class="pep-info"><div class="pep-name">'+c.name+'</div><div class="pep-meta">'+_metaWithHalfLife(c,c.sub)+'</div></div><div class="pep-chk">'+(isSel?'<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</div></div>';
    if(isSel&&selData){
      var doseNum=parseDec(selData.dose)||0;
      var isNebido=c.id==='nebido';
      var weeklyDoseMg;
      if(!isNebido&&selData.days&&selData.days.length){weeklyDoseMg=doseNum*selData.days.length;}
      else{var freqDays=(selData.freqUnit||'weeks')==='weeks'?(selData.freqVal||1)*7:(selData.freqVal||1);weeklyDoseMg=freqDays>0?doseNum*7/freqDays:0;}
      html+='<div style="border:1px solid var(--accent);border-top:none;border-radius:0 0 10px 10px;padding:12px 14px;margin-bottom:8px;background:rgba(232,255,60,0.015);">';
      html+='<div class="cfg-row"><div class="cfg-lbl">Dose</div><div class="dose-row"><input class="dose-in" type="text" inputmode="decimal" value="'+String(selData.dose||'')+'" oninput="wizSetTRTDose(\''+c.id+'\',this.value)" placeholder="0"><select class="unit-sel" onchange="wizSetTRTUnit(\''+c.id+'\',this.value)">'+_trtUnitOptions(selData.unit)+'</select></div></div>';
      html+=_renderTRTCadence(c.id,selData,'wiz');
      html+=_renderTRTTransition(c,selData,'wiz');
      html+='<div id="trt-guide-'+c.id+'">'+_renderTRTGuide(c.id,weeklyDoseMg)+'</div>';
      html+='</div>';
    }
  });
  var trtSupportCat=PEPTIDE_CAT.filter(function(p){return p.goals.every(function(g){return g==='trt';});});
  if(trtSupportCat.length){
    var pepSelIds=(_wiz.peptides||[]).map(function(x){return x.id;});
    html+='<div class="wiz-section" style="margin-top:16px">TRT Support</div>';
    trtSupportCat.forEach(function(p){
      var isSel=pepSelIds.includes(p.id);
      html+='<div class="pep-card'+(isSel?' sel':'')+'" onclick="wizTogglePep(\''+p.id+'\');wizStepTRT(document.getElementById(\'wiz-body\'),document.getElementById(\'wiz-footer\'));"><div class="pep-dot-sm" style="background:'+p.dot+'"></div><div class="pep-info"><div class="pep-name">'+p.name+'</div><div class="pep-meta">'+(_halfLifeLabel(p)||p.desc)+'</div></div><div style="display:flex;align-items:center;gap:10px"><button class="info-btn" onclick="event.stopPropagation();showPeptideCard(\''+p.id+'\')">ℹ</button><div class="pep-chk">'+(isSel?'<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</div></div></div>';
    });
  }
  body.innerHTML=html;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
}
function wizToggleTRT(){_wiz.trt.enabled=!_wiz.trt.enabled;if(!_wiz.trt.compounds)_wiz.trt.compounds=[];wizStepTRT(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));}
function wizToggleTRTCompound(id){
  if(!_wiz.trt.compounds)_wiz.trt.compounds=[];
  var idx=_wiz.trt.compounds.findIndex(function(c){return c.id===id;});
  if(idx!==-1){_wiz.trt.compounds.splice(idx,1);}
  else{var cat=TRT_CAT.find(function(c){return c.id===id;});if(cat)_wiz.trt.compounds.push({id:id,name:cat.name,dose:'',unit:cat.unit,freqVal:cat.freqVal,freqUnit:cat.freqUnit,days:cat.id==='nebido'?undefined:(cat.defaultDays?cat.defaultDays.slice():[1])});}
  wizStepTRT(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function wizSetTRTDose(id,v){var c=(_wiz.trt.compounds||[]).find(function(c){return c.id===id;});if(c)c.dose=v;}
function wizSetTRTUnit(id,v){var c=(_wiz.trt.compounds||[]).find(function(c){return c.id===id;});if(c)c.unit=v;}
function editToggleEnhancedCompound(id){
  // The gate is enforced HERE as well as in the rendering, because the rendering is a
  // presentation and this is the thing that changes the protocol. The locked cards do
  // not call this — but an inline onclick is one devtools console away, and the tier
  // boundary is an entitlement, not a styling choice. Adding is refused; REMOVING is
  // not, so a compound already on a protocol can still be taken off after a downgrade
  // rather than being stuck there.
  var _already=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[])
                 .some(function(c){return c&&c.id===id;});
  if(!_already){
    var _cat=(typeof ENHANCEMENT_COMPOUNDS!=='undefined'&&ENHANCEMENT_COMPOUNDS)
      ? ENHANCEMENT_COMPOUNDS.find(function(c){return c&&c.id===id;}) : null;
    if(!_compoundAllowedForTier(_cat)){ showCompoundUpgrade(id); return; }
  }
  if(!_editBuf.enhanced)_editBuf.enhanced={enabled:false,compounds:[]};
  if(!_editBuf.enhanced.compounds)_editBuf.enhanced.compounds=[];
  var idx=_editBuf.enhanced.compounds.findIndex(function(c){return c.id===id;});
  if(idx!==-1){_editBuf.enhanced.compounds.splice(idx,1);}
  else{var cat=ENHANCEMENT_COMPOUNDS.find(function(c){return c.id===id;});if(cat){var _eEntry={id:cat.id,name:cat.name,dose:String(cat.defaultDose||''),unit:cat.unit||'mg',days:cat.defaultDays?cat.defaultDays.slice():[0,1,2,3,4,5,6],dot:cat.dot};if(cat.amPm){_eEntry.amPm=true;_enhSeedSlots(_eEntry,cat);}_editBuf.enhanced.compounds.push(_eEntry);}}
  _editBuf.enhanced.enabled=_editBuf.enhanced.compounds.length>0;
  renderStackEditor();
}
function editSetEnhDose(id,v){var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(c){return c.id===id;});if(!c)return;c.dose=v;var el=document.getElementById('enh-guide-'+id);if(el){var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(x){return x.id===id;});el.innerHTML=_renderEnhancedGuide(cat,parseDec(v||0),c.unit);}}
function editSetEnhUnit(id,v){var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(c){return c.id===id;});if(c)c.unit=v;}
function editSetEnhDoseSlot(id,slot,v){var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(c){return c.id===id;});if(!c)return;c['dose_'+_slotKey(slot)]=v;var el=document.getElementById('enh-guide-'+id);if(el){var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(x){return x.id===id;});el.innerHTML=_renderEnhancedGuide(cat,_enhSplitTotal(c),c.unit);}}
// Toggle one intra-day slot for a split enhanced compound. Mirrors editToggleTime in
// the peptide tier, including the guard that the last remaining slot cannot be removed.
// A deselected slot keeps its dose value so re-selecting it restores what was typed.
// Switching schedule mode keeps BOTH configurations intact — the weekday selection and
// the interval survive a round-trip, so toggling to compare and back loses nothing.
function editSetEnhCadence(id,mode){
  var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(x){return x.id===id;});
  if(!c)return;
  c.cadence=(mode==='interval')?'interval':'days';
  if(c.cadence==='interval'&&!(parseInt(c.freqVal,10)>0)){c.freqVal=1;c.freqUnit=c.freqUnit||'days';}
  _collectEditInputs();renderStackEditor();
}
function editSetEnhFreqVal(id,v){
  var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(x){return x.id===id;});
  if(c)c.freqVal=Math.max(1,parseInt(v,10)||1);
}
function editSetEnhFreqUnit(id,v){
  var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(x){return x.id===id;});
  if(!c)return;c.freqUnit=(v==='weeks')?'weeks':'days';_collectEditInputs();renderStackEditor();
}
function wizSetEnhCadence(id,mode){
  var c=((_wiz.enhanced&&_wiz.enhanced.compounds)||[]).find(function(x){return x.id===id;});
  if(!c)return;
  c.cadence=(mode==='interval')?'interval':'days';
  if(c.cadence==='interval'&&!(parseInt(c.freqVal,10)>0)){c.freqVal=1;c.freqUnit=c.freqUnit||'days';}
  wizStepEnhanced(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function wizSetEnhFreqVal(id,v){
  var c=((_wiz.enhanced&&_wiz.enhanced.compounds)||[]).find(function(x){return x.id===id;});
  if(c)c.freqVal=Math.max(1,parseInt(v,10)||1);
}
function wizSetEnhFreqUnit(id,v){
  var c=((_wiz.enhanced&&_wiz.enhanced.compounds)||[]).find(function(x){return x.id===id;});
  if(!c)return;c.freqUnit=(v==='weeks')?'weeks':'days';
  wizStepEnhanced(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function editToggleEnhTime(id,t){
  var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(x){return x.id===id;});
  if(!c)return;
  var cur=_enhTimes(c).slice();
  var i=cur.indexOf(t);
  if(i===-1)cur.push(t); else if(cur.length>1)cur.splice(i,1);
  c.times=TIME_SLOTS.filter(function(x){return cur.indexOf(x)>=0;});
  _collectEditInputs();renderStackEditor();
}
function wizToggleEnhTime(id,t){
  var c=((_wiz.enhanced&&_wiz.enhanced.compounds)||[]).find(function(x){return x.id===id;});
  if(!c)return;
  var cur=_enhTimes(c).slice();
  var i=cur.indexOf(t);
  if(i===-1)cur.push(t); else if(cur.length>1)cur.splice(i,1);
  c.times=TIME_SLOTS.filter(function(x){return cur.indexOf(x)>=0;});
  wizStepEnhanced(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function editSetEnhAmPm(id,on){var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(c){return c.id===id;});if(!c)return;c.amPm=!!on;_collectEditInputs();renderStackEditor();}
function editSetEnhDays(id,di){var c=((_editBuf.enhanced&&_editBuf.enhanced.compounds)||[]).find(function(c){return c.id===id;});if(!c)return;if(!c.days)c.days=[];var idx=c.days.indexOf(di);if(idx!==-1){if(c.days.length>1)c.days.splice(idx,1);}else{c.days.push(di);}c.days.sort(function(a,b){return a-b;});renderStackEditor();}
// Why an enhanced testosterone entry generates no doses: T-Calc schedules testosterone
// (rule 2026-08-14). Empty string for everything that is not testosterone — the rest of
// the Enhanced tier is generated from here exactly as before.
// `stackLike` is the buffer being edited; it is no longer consulted, because the answer
// no longer depends on what the TRT tier holds. The parameter stays so the three call
// sites (editor, wizard, view) keep their shape.
function _enhDormantNoteHtml(c,stackLike){
  // Nothing is dormant any more — Phase 5 gave every compound back its own schedule.
  // The only thing left worth saying is that an unmigrated id is an old spelling.
  return _unmigratedTestoNote(c);
}
// ── WHAT A TIER-2 USER MAY ACTUALLY ADD ─────────────────────────────────────
// Henrik, 2026-08-20: "I want a tier2 user to still see the full catalog, but
// anything else than testosterone, PCT and HCT compounds should be greyed out.
// Clicking a Enhanced compound will trigger an overlay with an (for now dummy)
// message about requiring an app upgrade."
//
// Tier 2 is the testosterone tier: TRT plus the things that go with running it —
// hCG on cycle, and the PCT compounds that come after. Everything else is tier 3.
//
// Testosterone is recognised by the CATALOGUE FLAG, not by name. The backend's
// merged catalogue carries isTestosterone, and a name check is what let
// "Testoviron Depot" slip past a testosterone filter once already. ENHANCEMENT_COMPOUNDS
// is itself already filtered to non-testosterone, so in practice everything it holds is
// locked at tier 2 today — the allowance is written out in full anyway, because the
// PCT and hCG entries are expected in this catalogue and must not arrive locked.
// These lists were written for compounds that did not exist. Every id here — hcg,
// clomid, clomiphene, nolvadex, tamoxifen — and every group — PCT, Recovery, Post-Cycle,
// HCG — matched nothing in the catalogue, so tier 2 was gated to see ancillaries and saw
// an empty set. The ancillaries landed on 2026-08-26; the names below are now the real
// catalogue ids and groups, with the old spellings kept as aliases so a stored protocol
// referring to one still resolves.
var _TIER2_EXTRA_IDS = ['hcg','hmg','clomid','clomiphene','enclomiphene','nolvadex',
                        'tamoxifen','raloxifene','toremifene',
                        'anastrozole','exemestane','cabergoline','finasteride',
                        'dutasteride','minoxidil'];
var _TIER2_EXTRA_GROUPS = ['PCT','Recovery','Post-Cycle','HCG',
                           'Estrogen Control','PCT & Recovery','Side-Effect Support'];

function _compoundAllowedForTier(c, tier){
  var t = tier || _userTier || 1;
  if (t >= 3) return true;
  if (t < 2) return false;
  if (!c) return false;
  if (c.isTestosterone === true) return true;
  if (String(c.group||'') === 'Base') return true;
  if (_TIER2_EXTRA_IDS.indexOf(String(c.id||'')) >= 0) return true;
  if (_TIER2_EXTRA_GROUPS.indexOf(String(c.group||'')) >= 0) return true;
  return false;
}

// Dummy for now, by request — the copy and the upgrade route are not decided yet.
// Deliberately NOT a confirm()/alert(): those block the page and read as an error.
function showCompoundUpgrade(compId){
  // Takes an ID and resolves the name here. Interpolating a display name straight into
  // an inline onclick breaks the moment one contains an apostrophe.
  var c = null;
  if (typeof ENHANCEMENT_COMPOUNDS !== 'undefined' && ENHANCEMENT_COMPOUNDS)
    c = ENHANCEMENT_COMPOUNDS.find(function(x){ return x && x.id === compId; });
  if (!c && typeof _COMPOUND_CATALOG !== 'undefined' && _COMPOUND_CATALOG)
    c = _COMPOUND_CATALOG.find(function(x){ return x && x.id === compId; });
  // TRT_CAT too: at tier 1 the locked cards are the testosterone esters, and they are
  // not in ENHANCEMENT_COMPOUNDS at all.
  if (!c && typeof TRT_CAT !== 'undefined' && TRT_CAT)
    c = TRT_CAT.find(function(x){ return x && x.id === compId; });
  var name = (c && c.name) || (compId === 'testosterone' ? 'Testosterone' : compId);
  var ex = document.getElementById('upg-overlay'); if (ex && ex.remove) ex.remove();
  // Built as markup and appended, the same way every other sheet in this app is. The
  // onclick belongs in the string rather than on the element: it keeps the close
  // behaviour with the markup it closes, and setAttribute is not something to assume.
  var html =
    '<div id="upg-overlay" onclick="if(event.target===this)_closeCompoundUpgrade()" ' +
      'style="position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:24px">' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center">' +
        '<div style="font-size:26px;margin-bottom:10px">🔒</div>' +
        '<div style="font-size:11px;color:var(--muted);letter-spacing:1.5px;font-weight:700;margin-bottom:6px">ENHANCED TIER</div>' +
        '<div style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:10px">' + _esc(name) + '</div>' +
        '<div style="font-size:13px;color:var(--muted2);line-height:1.6;margin-bottom:20px">' +
          'Your plan covers testosterone, hCG and PCT. Adding this compound needs an app upgrade.' +
        '</div>' +
        '<button onclick="_closeCompoundUpgrade()" style="width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">Got it</button>' +
      '</div>' +
    '</div>';
  var wrap = document.createElement('div');
  wrap.innerHTML = html;
  if (wrap.firstChild && document.body && document.body.appendChild)
    document.body.appendChild(wrap.firstChild);
}
function _closeCompoundUpgrade(){
  var el = document.getElementById('upg-overlay'); if (el && el.remove) el.remove();
}

function _renderEditEnhanced(enh,opts){
  if(!enh)enh={enabled:false,compounds:[]};
  var o=opts||{};
  var sel=enh.compounds||[];
  var selIds=sel.map(function(c){return c.id;});
  var groups={};
  ENHANCEMENT_COMPOUNDS.forEach(function(c){if(!groups[c.group])groups[c.group]=[];groups[c.group].push(c);});
  // Called with no opts from the wizard and the read-only view: same behaviour as before.
  var skip=o.skipGroups||[];
  var order=(o.order||[]).filter(function(g){return groups[g];});
  var rest=Object.keys(groups).filter(function(g){return order.indexOf(g)<0;});
  var seq=order.concat(rest).filter(function(g){return skip.indexOf(g)<0;});
  var html=o.skipGroups?'':'<div style="font-size:12px;color:var(--muted2);margin-bottom:12px;">Select enhancement compounds and configure dose and frequency.</div>';
  seq.forEach(function(grp){
    html+='<div class="wiz-section" style="margin-bottom:8px;">'+_esc(grp)+'</div>';
    groups[grp].forEach(function(c){
      var isSel=selIds.includes(c.id);
      var selData=isSel?sel.find(function(s){return s.id===c.id;}):null;
      // LOCKED, NOT HIDDEN. The card renders in full — name, class, half-life — so the
      // catalogue reads as complete and a tier-2 user can see what the tier holds.
      // Tapping explains rather than doing nothing, which is the difference between a
      // locked door and a broken one.
      var locked=!_compoundAllowedForTier(c);
      if(locked){
        html+='<div class="pep-card" onclick="showCompoundUpgrade(\''+_esc(String(c.id))+'\')" style="margin-bottom:8px;opacity:0.45;cursor:pointer">'
          +'<div class="pep-dot-sm" style="background:'+c.dot+'"></div>'
          +'<div class="pep-info"><div class="pep-name">'+_esc(c.name)+'</div>'
          +'<div class="pep-meta">'+_esc(_halfLifeLabel(c)||c.group||'')+'</div></div>'
          +'<div class="pep-chk" style="font-size:13px;color:var(--muted2)">🔒</div></div>';
        return;   // no config panel, and no way to select it
      }
      html+='<div class="pep-card'+(isSel?' sel':'')+'" onclick="editToggleEnhancedCompound(\''+c.id+'\')" style="margin-bottom:'+(isSel?'0':'8px')+';'+(isSel?'border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom-color:transparent;':'')+'"><div class="pep-dot-sm" style="background:'+c.dot+'"></div><div class="pep-info"><div class="pep-name">'+_esc(c.name)+'</div><div class="pep-meta">'+_esc(_halfLifeLabel(c)||c.group||'')+'</div></div><div class="pep-chk">'+(isSel?'<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</div></div>';
      if(isSel&&selData){
        // #637: AM/PM split is user-toggleable on any enhanced compound (defaults to
        // the catalogue amPm flag). The injection builder already honours selData.amPm.
        var _amPm=(selData.amPm!==undefined?!!selData.amPm:!!c.amPm);
        html+='<div style="border:1px solid var(--accent);border-top:none;border-radius:0 0 10px 10px;padding:12px 14px;margin-bottom:8px;background:rgba(232,255,60,0.015);">';
        html+=_enhDormantNoteHtml(c,_editBuf);
        html+='<div class="cfg-row" style="display:flex;align-items:center;justify-content:space-between"><div class="cfg-lbl" style="margin:0">Split across AM / Pre-GYM / PM</div><div onclick="editSetEnhAmPm(\''+c.id+'\','+(!_amPm)+')" style="cursor:pointer"><div class="toggle-sw'+(_amPm?' on':'')+'"></div></div></div>';
        if(_amPm){
          var _eUnit=(c.unit||'IU').split('/')[0];
          var _eTimes=_enhTimes(selData);
          html+='<div class="cfg-row"><div class="cfg-lbl">Timing</div><div class="time-chips">'
            +TIME_SLOTS.map(function(t){
              return '<div class="time-chip'+(_eTimes.indexOf(t)>=0?' sel':'')+'" onclick="editToggleEnhTime(\''+c.id+'\',\''+t+'\')">'+_slotLabel(t)+'</div>';
            }).join('')
            +'</div></div>';
          _eTimes.forEach(function(t){var k=_slotKey(t);
            html+='<div class="cfg-row"><div class="cfg-lbl">'+_slotLabel(t)+' Dose</div><div class="dose-row"><input class="dose-in" type="text" inputmode="decimal" value="'+String(selData['dose_'+k]||'')+'" oninput="editSetEnhDoseSlot(\''+c.id+'\',\''+k+'\',this.value)" placeholder="0"><span style="font-size:13px;color:var(--muted2);padding:0 6px;white-space:nowrap;">'+_eUnit+'</span></div></div>';
          });
          html+=_renderSlotTimingHint(c.id,_eTimes);
          html+=_renderEnhCadence(c,selData,'edit');
        }else{
          html+='<div class="cfg-row"><div class="cfg-lbl">Dose</div><div class="dose-row"><input class="dose-in" type="text" inputmode="decimal" value="'+String(selData.dose||'')+'" oninput="editSetEnhDose(\''+c.id+'\',this.value)" placeholder="0"><select class="unit-sel" onchange="editSetEnhUnit(\''+c.id+'\',this.value)">'+['mg/week','mg/day','mg/EOD','IU/day','IU/week','mg','ml','%'].map(function(u){return'<option'+(u===(selData.unit||'mg/week')?' selected':'')+'>'+u+'</option>';}).join('')+'</select></div></div>';
          html+=_renderEnhCadence(c,selData,'edit');
        }
        html+='<div id="enh-guide-'+c.id+'">'+_renderEnhancedGuide(c,_amPm?_enhSplitTotal(selData):parseDec(selData.dose||0),selData.unit)+'</div>';
        html+='</div>';
      }
    });
  });
  return html;
}
// The merged Compounds tier. Henrik, 2026-08-19: "Group by class testosterone on top".
//
// This COMPOSES the two editors rather than replacing them: the testosterone group is
// the TRT editor's machinery (it keys on the PK catalogue, which is now the canonical
// id space), and the remaining classes are the Enhanced editor's, minus its own
// testosterone group so a molecule cannot appear twice under two spellings.
//
// Every existing handler — editToggleTRTCompound, editSetEnhDose, the cadence editors —
// keeps working untouched. A rewrite of both editors in the same change as the merge
// would have made any regression impossible to attribute.
var COMPOUND_GROUP_ORDER=['DHT-Derived','19-Nor','Oral','GH Axis','Testosterone-Derived','Blends','Estrogen Control','PCT & Recovery','Side-Effect Support'];

function _renderEditCompounds(st){
  var html='<div style="font-size:12px;color:var(--muted2);margin-bottom:12px;">One protocol, every compound. Testosterone first, then by class.</div>';
  html+=_renderEditTRT(st.trt);
  // TIER 2 SEES THE WHOLE CATALOGUE (2026-08-20). It used to get an upgrade card in
  // place of the list, so there was no way to find out what the tier above actually
  // holds — the pitch without the product. Now the same list renders, with everything
  // outside testosterone/hCG/PCT greyed and tapping through to the upgrade message.
  // _renderEditEnhanced locks per compound, so this is ONE call for both tiers and the
  // two cannot drift apart.
  //
  // EVERY tier gets the list, corrected 2026-08-20 — "Tier 1 & 2 should see everything
  // but greyed out if not included in their tier." One call, one catalogue; the lock is
  // per compound inside the renderer, so no tier can quietly end up with a different
  // list from another.
  html+=_renderEditEnhanced(_editBuf.enhanced||{enabled:false,compounds:[]},
                            {skipGroups:['Base'],order:COMPOUND_GROUP_ORDER});
  if((_userTier||1)<3) html+=_renderEnhancedUpgradeCTA();
  return html;
}

function _renderEnhancedViewTab(st){
  var enh=st.enhanced||{};
  var compounds=enh.compounds||[];
  var html='<div class="wiz-section" style="margin-bottom:10px;">Enhancement Compounds</div>';
  if(!compounds.length){
    html+='<div style="color:var(--muted2);font-size:13px;padding:8px 0;">No enhancement compounds configured for this protocol.</div>';
  }else{
    compounds.forEach(function(c){
      var dot=c.dot||'var(--accent2)';
      var days=_enhCadenceLabel(c)||null;
      html+='<div class="cfg-block" style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">';
      html+='<div style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0;"></div>';
      html+='<div style="flex:1;font-size:13px;font-weight:600;color:var(--text);">'+_esc(c.name||c.id)+'</div>';
      var doseStr=c.amPm?(_enhTimes(c).filter(function(t){return c['dose_'+_slotKey(t)];}).map(function(t){return c['dose_'+_slotKey(t)]+' '+_slotLabel(t);}).join(' / ')+' '+(c.unit||'IU').split('/')[0]+(days?' · '+days:'')):((c.dose?c.dose+(c.unit||'mg'):'')+(days?' · '+days:''));
      html+='<div style="font-size:12px;color:var(--muted2);">'+doseStr+'</div>';
      html+='</div>';
    });
    // Recovery & PCT panel — filled async from the backend by _ensurePctPanel(st)
    html+='<div class="wiz-section" id="pct-recovery-head" style="margin-top:18px;">On-cycle &amp; recovery</div>';
    html+='<div id="pct-recovery-body"><div style="color:var(--muted2);font-size:12px;padding:8px 0;">Loading recovery plan…</div></div>';
  }
  return html;
}
// ── Recovery & PCT (fetched from /compounds/pct-plan, cached per compound set) ──
// ⚠️ PCT ADVICE ONLY WHEN PCT IS IN THE PROTOCOL.
// Henrik, 2026-09-03: "Weird PCT advice printed in Protocol details, only show if
// added to Protocol." The backend returns a full post-cycle plan for any enhanced
// compound set, and this panel printed it whether or not the user had added a
// single recovery compound — a SERM restart schedule, week by week, for a protocol
// that contains no SERM. That is advice nobody asked to be shown, on a screen whose
// job is to state what this protocol IS.
//
// The on-cycle support block is left alone: it is the other half of the same
// payload and was not what was reported.
var _pctCache={};
function _pctHasRecoveryCompound(st){
  var comps=(st&&st.enhanced&&st.enhanced.compounds)||[];
  if(!comps.length)return false;
  var cat=(typeof _COMPOUND_CATALOG!=='undefined'&&_COMPOUND_CATALOG&&_COMPOUND_CATALOG.length)
    ?_COMPOUND_CATALOG:((typeof ENHANCEMENT_COMPOUNDS!=='undefined'&&ENHANCEMENT_COMPOUNDS)||[]);
  return comps.some(function(c){
    if(!c||!c.id)return false;
    var e=cat.filter(function(x){return x&&x.id===c.id;})[0];
    return !!e&&_TIER2_EXTRA_GROUPS.indexOf(String(e.group||''))>=0;
  });
}
function _pctSig(st){var ids=((st.enhanced&&st.enhanced.compounds)||[]).map(function(c){return c.id;}).filter(Boolean).sort();var sex=((typeof getData==='function'&&getData('pep-profile',null))||{}).sex||'male';return sex+'|'+ids.join(',');}
async function pctPlanFromAgent(compoundIds,sex){
  var ctrl=new AbortController();var tid=setTimeout(function(){ctrl.abort();},10000);
  try{
    var r=await fetch(AGENT_URL+'/compounds/pct-plan',{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({compounds:compoundIds,sex:sex}),signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){if(typeof _logHttp==='function')_logHttp('pct',r.status,'/compounds/pct-plan');return{ok:false,status:r.status};}
    var d=await r.json();return{ok:true,plan:(d&&d.plan)||null};
  }catch(e){clearTimeout(tid);if(typeof _logErr==='function')_logErr('pct',e);return{ok:false,status:null,msg:String(e&&e.message||e)};}
}
// Is the agent this plan is talking about actually IN the protocol? The plan is a
// recommendation engine — it names hCG, a SERM, whatever the compound set implies —
// and Protocol details is not the place to meet a recommendation. Matched on the
// compound's own name or id, both ways, because the plan writes display names
// ("HCG") while the protocol stores catalogue entries.
function _pctAgentInStack(agent,st){
  var a=String(agent==null?'':agent).toLowerCase().trim();
  if(!a)return false;
  var comps=(st&&st.enhanced&&st.enhanced.compounds)||[];
  return comps.some(function(c){
    if(!c)return false;
    var n=String(c.name||'').toLowerCase(), i=String(c.id||'').toLowerCase();
    return (!!n&&(a.indexOf(n)>=0||n.indexOf(a)>=0))||(!!i&&(a.indexOf(i)>=0||i.indexOf(a)>=0));
  });
}
// ⚠️ THIS VIEW STATES THE PROTOCOL — IT DOES NOT RECOMMEND ONE.
// Henrik, 2026-09-03: "This advice is needed when one creates the stack, but if not
// part of the stack then it should not be part of this view."
//
// Everything here is gated on the protocol actually containing the thing being
// discussed: on-cycle entries on the named agent being in it, the whole post-cycle
// block plus its notes and guardrails on a recovery compound being in it. A
// protocol of HGH alone showed a "＋ HCG" card, an HPTA-recovery note and three
// SERM guardrails for compounds it does not contain.
function _renderPctPlanHtml(plan,hasPct,st){
  if(!plan)return '<div style="color:var(--muted2);font-size:12px;">Recovery plan unavailable.</div>';
  if(plan.applicable===false){return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:11px;color:var(--muted2);line-height:1.5;">'+_esc((plan.notes&&plan.notes[0])||'Not applicable.')+'</div>';}
  var h='';
  // ── On-cycle support (runs DURING the cycle) ──
  var onCyc=(plan.on_cycle||[]).filter(function(o){return _pctAgentInStack(o&&o.agent,st);});
  if(onCyc.length){
    h+='<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--accent);text-transform:uppercase;margin:0 0 6px;">On-cycle support</div>';
    onCyc.forEach(function(o){h+='<div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:6px;padding:8px 10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px;">＋ '+_esc(o.agent||'')+'</div><div style="font-size:12px;color:var(--muted2);line-height:1.5;">'+_esc(o.message||'')+'</div></div>';});
  }
  var p=hasPct?plan.pct:null;
  if(p){
    h+='<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:16px 0 6px;border-top:1px solid var(--border);padding-top:12px;">Post-cycle (PCT)</div>';
    h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:4px 0 4px;">Start PCT</div>';
    h+='<div style="font-size:12px;color:var(--text);line-height:1.5;margin-bottom:8px;">'+_esc(p.start||'')+'</div>';
    if(p.serm){
      var sm=p.serm;
      function _sermRows(x){return (x.schedule||[]).map(function(s){return '<div style="font-size:12px;color:var(--text);">'+_esc(s.weeks)+': <b>'+_esc(s.dose)+'</b></div>';}).join('');}
      h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:10px 0 4px;">SERM restart</div>';
      h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin-bottom:6px;"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:3px;">'+_esc(sm.primary.agent)+'</div>'+_sermRows(sm.primary)+'</div>';
      if(sm.alternative)h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin-bottom:6px;"><div style="font-size:11px;font-weight:600;color:var(--muted2);margin-bottom:3px;">Alternative · '+_esc(sm.alternative.agent)+'</div>'+_sermRows(sm.alternative)+'</div>';
      if(sm.note)h+='<div style="font-size:11px;color:#f59e0b;line-height:1.5;margin-bottom:6px;">⚠ '+_esc(sm.note)+'</div>';
    }
    if(p.confirm_labs&&p.confirm_labs.length){h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:10px 0 4px;">Confirm recovery</div>'+p.confirm_labs.map(function(l){return '<div style="font-size:11px;color:var(--text);line-height:1.5;padding:1px 0;">• '+_esc(l)+'</div>';}).join('');}
  }
  // The notes and guardrails are post-cycle copy — HPTA recovery, "never run a SERM
  // during an HCG priming phase" — so they belong to the block above and leave with it.
  if(hasPct){
    (plan.notes||[]).forEach(function(n){h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 10px;margin-top:6px;font-size:11px;color:var(--muted2);line-height:1.5;">ℹ '+_esc(n)+'</div>';});
    if(plan.guardrails&&plan.guardrails.length){h+='<div style="margin-top:8px;">'+plan.guardrails.map(function(g){return '<div style="font-size:11px;color:var(--muted2);line-height:1.5;">• '+_esc(g)+'</div>';}).join('')+'</div>';}
  }
  // The tier safety card is NOT part of this and is appended by _pctPaint, so that
  // an empty advisory can drop the heading without dropping a safety message.
  return h;
}
// Gated this hard, a plan usually renders to nothing — so the "On-cycle & recovery"
// heading goes with it rather than standing over an empty box. The enhanced-tier
// safety card is deliberately outside that test: it is about the compounds the
// protocol DOES contain, so it survives an empty advisory and renders on its own.
function _pctPaint(el,plan,hasPct,st){
  var h=_renderPctPlanHtml(plan,hasPct,st);
  var empty=!String(h||'').replace(/<[^>]*>/g,'').trim();
  var head=document.getElementById('pct-recovery-head');
  if(head)head.style.display=empty?'none':'';
  var safety=(typeof _renderSafetyNote==='function')?_renderSafetyNote('enhanced'):'';
  el.innerHTML=(empty?'':h)+safety;
}
function _ensurePctPanel(st){
  var el=document.getElementById('pct-recovery-body');if(!el||!st)return;
  var ids=((st.enhanced&&st.enhanced.compounds)||[]).map(function(c){return c.id;}).filter(Boolean);
  if(!ids.length){el.innerHTML='';return;}
  var sig=_pctSig(st),hasPct=_pctHasRecoveryCompound(st);
  if(_pctCache[sig]){_pctPaint(el,_pctCache[sig],hasPct,st);return;}
  var sex=((typeof getData==='function'&&getData('pep-profile',null))||{}).sex||'male';
  pctPlanFromAgent(ids,sex).then(function(res){
    var el2=document.getElementById('pct-recovery-body');if(!el2)return;
    if(res.ok&&res.plan){_pctCache[sig]=res.plan;_pctPaint(el2,res.plan,hasPct,st);}
    else{el2.innerHTML='<div style="color:var(--muted2);font-size:12px;">Recovery plan unavailable'+(res.status?(' (HTTP '+res.status+')'):'')+'.</div>';}
  });
}

// ── Enhanced advisor step (guided recommendation before the raw list) ────────
var _ADV_OBJECTIVES=[['lean_mass','Lean mass'],['mass','Mass / bulk'],['recomp','Recomposition'],['cut','Cutting'],['contest','Contest prep'],['strength','Strength']];
var _ADV_FLAGS=[['hair_loss','Hair-loss prone'],['hypertension_hct','High BP / hematocrit'],['lipids','Poor lipids (low HDL)'],['mood','Mood sensitive'],['fertility','Preserve fertility']];

// Cycle-stage selector — maps to the backend experience tiers. 'curious' collapses
// to 'first' (starting an enhanced protocol = at least a first cycle).
var _ADV_EXPERIENCE=[['first','First cycle'],['experienced','2nd–few cycles'],['advanced','Advanced / many']];
function _advNormExp(e){e=(e||'').toLowerCase();return e==='curious'?'first':(['first','experienced','advanced'].indexOf(e)>=0?e:'first');}
function _wizAdviseState(){
  if(!_wiz.advise){
    var prof=(typeof getData==='function')?getData('pep-profile',null):null;
    var exp0=_advNormExp((typeof _pepExpTier==='function'&&_pepExpTier())||(prof&&prof.experience)||'first');
    _wiz.advise={objective:'lean_mass',experience:exp0,flags:{},result:null,loading:false,error:'',fetched:false,_seeded:false};
  }
  return _wiz.advise;
}
// ── Wizard step: testosterone base ────────────────────────────────────────────
// Every enhanced cycle runs on a testosterone base, and the ester decides injection
// frequency for the whole cycle (propionate EOD vs undecanoate every 10-14 weeks), so
// it is chosen explicitly before any other compound rather than assumed. Esters come
// from the backend catalogue (cls==='base') — never hardcoded here.
function _wizBaseList(){
  return (typeof ENHANCEMENT_COMPOUNDS!=='undefined'?(ENHANCEMENT_COMPOUNDS||[]):[])
    .filter(function(c){return c.cls==='base';});
}
// The base currently in the protocol, if any — the stack is the source of truth so a
// user who swapped esters on a later step still sees the right one selected here.
function _wizBaseId(){
  var comps=(_wiz&&_wiz.enhanced&&_wiz.enhanced.compounds)||[];
  var ids=_wizBaseList().map(function(c){return c.id;});
  var hit=comps.find(function(c){return ids.indexOf(c.id)>=0;});
  return hit?hit.id:'';
}
// Selecting an ester REPLACES any base already in the protocol — a cycle runs on one
// testosterone, so switching must swap rather than stack. Non-base compounds are left
// untouched. The advisor result is invalidated so guidance re-fetches for the new base.
function wizSetBaseEster(id){
  if(!_wiz.enhanced)_wiz.enhanced={enabled:false,compounds:[]};
  if(!_wiz.enhanced.compounds)_wiz.enhanced.compounds=[];
  var baseIds=_wizBaseList().map(function(c){return c.id;});
  if(_wizBaseId()===id)return;
  _wiz.enhanced.compounds=_wiz.enhanced.compounds.filter(function(c){return baseIds.indexOf(c.id)<0;});
  _wizAdviseAdd(id);
  _wiz.enhanced.enabled=(_wiz.enhanced.compounds||[]).length>0;
  _wizAdviseInvalidate(_wizAdviseState());
  wizStepBase(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function wizStepBase(body,footer){
  var list=_wizBaseList();
  var sel=_wizBaseId();
  var recId='test_e';
  var st=_wizAdviseState();
  if(st&&st.result&&st.result.base&&st.result.base.recommended_id)recId=st.result.base.recommended_id;
  var html='<div style="font-size:12px;color:var(--muted2);margin-bottom:14px;line-height:1.5;">'
    +'Every enhanced cycle runs on a testosterone base. The ester sets how often you inject '
    +'and how fast a dose change shows up — pick the one that fits how you want to run the cycle.</div>';
  if(!list.length){
    // WAIT FOR IT, rather than telling the user to come back. This said "Compound
    // catalogue not loaded yet — reopen this step in a moment" and left Next enabled,
    // so on a slow connection the step was a dead end that also let you walk past it
    // without a base. It now shows the spinner and fetches, the same way
    // wizStepEnhanced does, and redraws itself when the catalogue lands.
    body.innerHTML=_WIZ_LOADING_HTML;
    footer.innerHTML='<button class="btn btn-primary" style="flex:1;opacity:0.5" disabled>Next →</button>';
    if(typeof syncEnhancedCompoundsFromAgent==='function'){
      syncEnhancedCompoundsFromAgent().then(function(result){
        // Only redraw if the user is still on this step — they may have gone back.
        if(_wizFlow()[_wiz.step]!=='base')return;
        var b=document.getElementById('wiz-body'),f=document.getElementById('wiz-footer');
        if(!b||!f)return;
        if(_wizBaseList().length){wizStepBase(b,f);return;}
        var _d=(result&&result.status)?(' (HTTP '+result.status+')'):(result&&result.msg?(' ('+result.msg+')'):'');
        b.innerHTML='<div style="padding:32px 0;text-align:center;">'
          +'<div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:8px;">Catalogue unavailable</div>'
          +'<div style="font-size:13px;color:var(--muted2);margin-bottom:20px;">Check your connection and try again.'+_esc(_d)+'</div>'
          +'<button class="btn btn-primary" onclick="wizStepBase(document.getElementById(\'wiz-body\'),document.getElementById(\'wiz-footer\'))">Try again</button></div>';
        f.innerHTML='<button class="btn btn-primary" style="flex:1;opacity:0.5" disabled>Next →</button>';
      });
    }
    return;
  }
  list.forEach(function(c){
    var isSel=(c.id===sel);
    var cad=c.cadence||{};
    html+='<div class="pep-card'+(isSel?' sel':'')+'" onclick="wizSetBaseEster(\''+c.id+'\')" '
      +'style="margin-bottom:'+(isSel?'0':'8px')+';align-items:flex-start;'
      +(isSel?'border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom-color:transparent;':'')+'">'
      +'<div class="pep-dot-sm" style="background:'+(c.dot||'#e05050')+';margin-top:4px;"></div>'
      +'<div class="pep-info"><div class="pep-name">'+_esc(c.name)
      +(c.id===recId?'<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:#0a0a0a;background:var(--accent);border-radius:8px;padding:2px 6px;margin-left:6px;vertical-align:middle;">RECOMMENDED</span>':'')
      +'</div>'
      +'<div class="pep-meta">'+_esc(_halfLifeLabel(c)||cad.halfLife||'')+(cad.rec?' · '+_esc(cad.rec):'')+'</div></div>'
      +'<div class="pep-chk">'+(isSel?'<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</div>'
      +'</div>';
    if(isSel&&cad.note){
      html+='<div style="border:1px solid var(--accent);border-top:none;border-radius:0 0 10px 10px;padding:10px 14px;margin-bottom:8px;background:rgba(232,255,60,0.015);font-size:11px;color:var(--muted2);line-height:1.5;">'
        +_esc(cad.note)+'</div>';
    }
  });
  html+=_renderSafetyNote('enhanced');
  body.innerHTML=html;
  var canNext=!!_wizBaseId();
  footer.innerHTML='<button class="btn btn-primary" style="flex:1"'+(canNext?'':' disabled')+' onclick="wizNext()">Next →</button>'
    +(canNext?'':'<div style="font-size:11px;color:var(--muted2);margin-top:8px;">Pick a testosterone base to continue.</div>');
}
function _wizAdviseInputs(){
  var st=_wizAdviseState();
  var prof=(typeof getData==='function')?getData('pep-profile',null):null;
  var sex=(prof&&prof.sex)||(typeof _userProfile==='function'&&_userProfile().sex)||'male';
  var bfEntry=(typeof _latestBodyFat==='function')?_latestBodyFat():null;
  var bf=(bfEntry&&typeof bfEntry.bf==='number')?bfEntry.bf:(typeof bfEntry==='number'?bfEntry:null);
  // `weeks` matters for the female path — the backend nudges from 6 weeks and caps at 8,
  // where the male path only nudges at 12. Without it the nudge could never fire.
  var wk=(typeof _wiz!=='undefined'&&_wiz&&_wiz.cycle_length)?_wiz.cycle_length:null;
  return {experience:_advNormExp(st.experience),sex:sex,objective:st.objective,body_fat:bf,flags:st.flags||{},base_id:_wizBaseId(),weeks:wk};
}
function wizAdviseSetExperience(v){
  var st=_wizAdviseState();st.experience=v;_wizAdviseInvalidate(st);
  // Persist the correction so it isn't stale here or elsewhere in the app.
  try{var p=(typeof getData==='function'&&getData('pep-profile',null))||{};p.experience=v;if(typeof setData==='function')setData('pep-profile',p);
      if(typeof pushPepSettingsToAgent==='function')pushPepSettingsToAgent({'pep-experience':v,'pep-profile':p});}catch(e){}
  wizStepAdvise(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
async function enhancedAdvisorFromAgent(inp){
  var ctrl=new AbortController();var tid=setTimeout(function(){ctrl.abort();},10000);
  try{
    var r=await fetch(AGENT_URL+'/compounds/enhanced-advisor',{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(inp||{}),signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){if(typeof _logHttp==='function')_logHttp('advisor',r.status,'/compounds/enhanced-advisor');return{ok:false,status:r.status};}
    var d=await r.json();return{ok:true,advice:(d&&d.advice)||null};
  }catch(e){clearTimeout(tid);if(typeof _logErr==='function')_logErr('advisor',e);return{ok:false,status:null,msg:String(e&&e.message||e)};}
}
// ── ONE PLACE THAT INVALIDATES A RECOMMENDATION ─────────────────────────────
// Three flags travel together and were being reset in five places, inconsistently:
//   _seeded  — wizApplyAdviseRecommendations has already run for this recommendation
//   _autoSel — the render has already pre-ticked for it
//   _touched — the user has answered this step (added, or removed, or removed the last)
// Two sites cleared _seeded but not _autoSel, so a new recommendation could arrive and
// never pre-tick. Adding _touched on 2026-08-20 would have made that worse — a fourth
// thing to remember at five call sites. One function instead.
//
// A NEW recommendation is a new question: everything clears, and it may pre-tick again.
function _wizAdviseInvalidate(st){
  if(!st)return;
  st.result=null; st.fetched=false;
  st._seeded=false; st._autoSel=false; st._touched=false;
}

async function wizAdviseFetch(){
  var st=_wizAdviseState();
  st.loading=true;st.error='';st._seeded=false;st._touched=false;
  wizStepAdvise(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
  var res=await enhancedAdvisorFromAgent(_wizAdviseInputs());
  st.loading=false;st.fetched=true;st._autoSel=false;
  if(res.ok&&res.advice){st.result=res.advice;if(_isFemaleAdvice(res.advice))_FEMALE_ADVICE=res.advice;}
  else{st.result=null;st.error='Could not load recommendations'+(res.status?(' (HTTP '+res.status+')'):'')+'.';}
  if(_wizFlow()[_wiz.step]==='advise')wizStepAdvise(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function wizAdviseSetObjective(v){var st=_wizAdviseState();st.objective=v;_wizAdviseInvalidate(st);wizStepAdvise(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));}
function wizAdviseToggleFlag(k){var st=_wizAdviseState();if(!st.flags)st.flags={};st.flags[k]=!st.flags[k];_wizAdviseInvalidate(st);wizStepAdvise(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));}
function _wizAdviseCompoundRow(item,kind,opts){
  opts=opts||{};
  var map={best:['var(--accent)','★'],primary:['var(--accent)','✓'],consider:['var(--muted2)','○'],later:['#7a8899','⏱'],avoid:['#f59e0b','✕'],oncycle:['var(--accent)','＋']};
  var m=map[kind]||map.consider;var accent=m[0],icon=m[1];
  var selectable=!!opts.selectable,selected=!!opts.selected;
  var bg=kind==='best'?'rgba(232,255,60,0.06)':'var(--surface2)';
  var border=(selectable&&selected)?'var(--accent)':'var(--border)';
  var bestBadge=kind==='best'?'<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:#0a0a0a;background:var(--accent);border-radius:4px;padding:1px 6px;text-transform:uppercase;">Best pick</span>':'';
  var chk=selectable?('<span style="width:18px;height:18px;border-radius:50%;border:1.5px solid '+(selected?'var(--accent)':'var(--border)')+';background:'+(selected?'var(--accent)':'transparent')+';display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">'+(selected?'<svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</span>'):'';
  var right=(bestBadge||chk)?('<span style="margin-left:auto;display:flex;align-items:center;gap:6px;">'+bestBadge+chk+'</span>'):'';
  var click=selectable?(' onclick="wizAdviseToggleCompound(\''+_esc(item.id||'')+'\')"'):'';
  var cursor=selectable?'cursor:pointer;':'';
  return '<div'+click+' style="'+cursor+'background:'+bg+';border:1px solid '+border+';border-left:3px solid '+accent+';border-radius:6px;padding:8px 10px;margin-bottom:6px;">'
    +'<div style="display:flex;align-items:center;gap:8px;"><span style="color:'+accent+';font-weight:700;font-size:12px;">'+icon+'</span><span style="font-size:13px;font-weight:700;color:var(--text);">'+_esc(item.name||item.agent||item.id)+'</span>'+right+'</div>'
    +(item.reason||item.message?'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-top:3px;">'+_esc(item.reason||item.message)+'</div>':'')
    +'</div>';
}
function _wizAdviseSection(title,items,kind,selIds){
  if(!items||!items.length)return '';
  var selectable=(kind==='best'||kind==='primary'||kind==='consider');selIds=selIds||[];
  return '<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px;">'+title+'</div>'
    +items.map(function(it){return _wizAdviseCompoundRow(it,kind,{selectable:selectable,selected:selIds.indexOf(it.id)>=0});}).join('')+'</div>';
}
// Tap a recommended compound to add/remove it from the protocol (same store the
// Enhanced step uses) — so the guidance is directly actionable.
function wizAdviseToggleCompound(id){
  // THE USER HAS NOW CHOSEN. Reported 2026-08-20: "Even if I deselect Primo and click
  // Next it is preselected again." wizApplyAdviseRecommendations re-seeds the
  // recommendations when the enhanced list is EMPTY, on the reasoning that an empty
  // list means the user never picked anything — but it cannot tell "never touched"
  // from "deliberately cleared", and clearing the one pre-ticked compound produces
  // exactly the empty list it treats as untouched. So it put Primobolan straight back.
  //
  // A flag on the step's own state settles it: the moment a row is tapped, this step
  // has an answer, and an empty answer is still an answer.
  var _ast=_wizAdviseState(); if(_ast)_ast._touched=true;
  if(!_wiz.enhanced)_wiz.enhanced={enabled:false,compounds:[]};
  if(!_wiz.enhanced.compounds)_wiz.enhanced.compounds=[];
  var idx=_wiz.enhanced.compounds.findIndex(function(c){return c.id===id;});
  if(idx!==-1){_wiz.enhanced.compounds.splice(idx,1);}
  else{var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===id;});
    if(cat){var e={id:cat.id,name:cat.name,dose:String(cat.defaultDose||''),unit:cat.unit||'mg',days:cat.defaultDays?cat.defaultDays.slice():[0,1,2,3,4,5,6],dot:cat.dot};if(cat.amPm){e.amPm=true;_enhSeedSlots(e,cat);}_wiz.enhanced.compounds.push(e);}}
  _wiz.enhanced.enabled=_wiz.enhanced.compounds.length>0;
  wizStepAdvise(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function _wizAdviseAdd(id){
  if(!id)return;if(!_wiz.enhanced)_wiz.enhanced={enabled:false,compounds:[]};if(!_wiz.enhanced.compounds)_wiz.enhanced.compounds=[];
  if(_wiz.enhanced.compounds.some(function(c){return c.id===id;}))return;
  var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===id;});if(!cat)return;
  var e={id:cat.id,name:cat.name,dose:String(cat.defaultDose||''),unit:cat.unit||'mg',days:cat.defaultDays?cat.defaultDays.slice():[0,1,2,3,4,5,6],dot:cat.dot};
  if(cat.amPm){e.amPm=true;_enhSeedSlots(e,cat);}
  _wiz.enhanced.compounds.push(e);
}
// Default selection when a fresh recommendation loads: keep the base, and pre-tick
// the best addition only if the user hasn't already chosen a non-base compound.
// ── WHERE THE TESTOSTERONE BASE COMES FROM NOW ──────────────────────────────
// Since the single Compounds toggle (2026-08-20) the 'trt' step asks for the ester,
// dose and cadence, and the enhanced half of the flow follows it. Three places still
// assumed the base lived in _wiz.enhanced.compounds, which is where the wizard used to
// put it, and they broke in two visible ways:
//
//   "Even though I added an T ester in TRT step, recommended enhanced compounds lists
//    Test E on top, no testosterone esters should show up in this step."
//   "Error that a test base is required for masteron even though one is already
//    selected in TRT step"
//
// The second was a hard block: the Next button was disabled, so an enhanced cycle could
// not be finished at all once testosterone moved.
// ⚠️ THE WIZARD HOLDS THE CHOSEN ESTER IN **TWO** PLACES, AND THIS MUST SEE BOTH.
// Reported 2026-08-20: "Wizard silently adds Test E by itself even though I choose
// Nebido" — the Validate step listed Nebido AND Testosterone Enanthate under TRT.
//
//   _wiz.trtPlan.compId   ← the TRT step's own planner: ester + dose + cadence. This
//                           is what a normal run through the wizard fills in.
//   _wiz.trt.compounds[]  ← the classic multi-compound editor, one tap away.
//
// This guard only read the second. So after choosing Nebido in the planner it answered
// "no testosterone yet", and the advise step seeded its recommended base — Test E —
// as a second TRT compound. _wizTrtSummaryRows renders both lists, which is why both
// esters showed up; nothing had gone wrong at save time yet, but the protocol was
// already carrying a compound the user never picked.
//
// A protocol gets its testosterone from ONE place. Both representations count as that
// place.
function _wizTrtHasTesto(){
  var w=(typeof _wiz!=='undefined')?_wiz:null;
  if(!w)return false;
  var p=w.trtPlan;
  if(p&&p.compId)return true;
  var cs=(w.trt&&w.trt.enabled)?(w.trt.compounds||[]):[];
  return cs.length>0;
}
// Is this recommendation a testosterone ester? Checked by id against the catalogue
// rather than by name — "Testoviron Depot" has slipped a name filter before.
function _wizAdviseIsTesto(entry){
  var id=entry&&entry.id;
  if(!id)return false;
  if(typeof _isTestoCompoundId==='function'&&_isTestoCompoundId(id))return true;
  var cat=(typeof _COMPOUND_CATALOG!=='undefined'&&_COMPOUND_CATALOG)
    ? _COMPOUND_CATALOG.find(function(c){return c&&c.id===id;}) : null;
  return !!(cat&&cat.isTestosterone);
}

// Put a recommended testosterone base where testosterone lives: _wiz.trt, in the shape
// editToggleTRTCompound produces, so the 'trt' step and the generator both understand
// it. Never overwrites an existing choice.
function _wizSeedTrtBase(id){
  if(!id)return false;
  // Refuses whenever the protocol already has an ester from EITHER representation, not
  // just from the list it is about to write into. Callers check too; this is the one
  // that actually adds the row, so it is the one that must not be bypassable.
  if(_wizTrtHasTesto())return false;
  if(!_wiz.trt)_wiz.trt={enabled:false,compounds:[]};
  if(!_wiz.trt.compounds)_wiz.trt.compounds=[];
  if(_wiz.trt.compounds.length)return false;
  var cid=(typeof _canonCompoundId==='function')?_canonCompoundId(id):id;
  var cat=(typeof TRT_CAT!=='undefined'&&TRT_CAT)
    ? TRT_CAT.find(function(c){return c&&(c.id===cid||c.id===id);}) : null;
  if(!cat)return false;
  _wiz.trt.enabled=true;
  _wiz.trt.compounds.push({id:cat.id,name:cat.name,dose:'',unit:cat.unit||'mg',
    freqVal:cat.freqVal||1,freqUnit:cat.freqUnit||'weeks',
    days:cat.id==='nebido'?undefined:(cat.defaultDays?cat.defaultDays.slice():[1])});
  return true;
}

function _wizAdviseDefaultSelect(res){
  // Adding res.base here is what put "Test E" at the top of the Enhanced list. When the
  // TRT step already holds the ester, adding it again would schedule the same molecule
  // twice — the doubling the whole rewrite exists to end.
  //
  // And when it does NOT hold one, the base cannot go into the enhanced list either:
  // ENHANCEMENT_COMPOUNDS is filtered to non-testosterone since the catalogue merge, so
  // _wizAdviseAdd's `if(!cat)return;` has been silently swallowing every recommended
  // base. Third symptom of the same fault, and the only invisible one. It goes where
  // testosterone actually lives now — the TRT block.
  if(res.base&&res.base.id&&!_wizTrtHasTesto())_wizSeedTrtBase(res.base.id);
  var hasNonBase=((_wiz.enhanced&&_wiz.enhanced.compounds)||[]).some(function(c){var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(x){return x.id===c.id;});return cat&&cat.cls!=='base';});
  if(!hasNonBase&&res.best_addition)_wizAdviseAdd(res.best_addition.id);
  if(_wiz.enhanced)_wiz.enhanced.enabled=(_wiz.enhanced.compounds||[]).length>0;
}
function wizApplyAdviseRecommendations(){
  var st=_wizAdviseState();var res=st.result;
  if(!res||st._seeded)return;
  st._seeded=true;
  if(!_wiz.enhanced)_wiz.enhanced={enabled:false,compounds:[]};
  if(!_wiz.enhanced.compounds)_wiz.enhanced.compounds=[];
  // Only seed when the user has not answered this step. Two ways to have answered:
  // a non-empty list, or having tapped anything at all — including tapping the last
  // pick OFF, which leaves the list empty on purpose.
  if(st._touched)return;
  if(_wiz.enhanced.compounds.length)return;
  // NEVER auto-seed a female protocol. Doc 07's rule is one compound at a time, chosen
  // deliberately — pre-ticking a compound for a woman hands her a selection she did not
  // make, in the one place where the selection IS the harm reduction.
  if(_isFemaleAdvice(res))return;
  var picks=[];
  // Not a `pick` — picks go into the enhanced list, which cannot hold testosterone.
  if(res.base&&res.base.id&&!_wizTrtHasTesto())_wizSeedTrtBase(res.base.id);
  (res.primary||[]).forEach(function(p){if(p&&p.id)picks.push(p.id);});
  picks.forEach(function(id){
    if(_wiz.enhanced.compounds.some(function(c){return c.id===id;}))return;
    var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(c){return c.id===id;});
    if(!cat)return;
    var e={id:cat.id,name:cat.name,dose:String(cat.defaultDose||''),unit:cat.unit||'mg',days:cat.defaultDays?cat.defaultDays.slice():[0,1,2,3,4,5,6],dot:cat.dot};
    if(cat.amPm){e.amPm=true;_enhSeedSlots(e,cat);}
    _wiz.enhanced.compounds.push(e);
  });
  _wiz.enhanced.enabled=_wiz.enhanced.compounds.length>0;
}
function wizAdviseNext(){wizApplyAdviseRecommendations();wizNext();}
// ── FEMALE PROTOCOL FLOW ────────────────────────────────────────────────────
// A female user reaching the advise step used to get the male renderer pointed at an
// empty payload: no compounds, no guidance, an objective picker that drove nothing.
// The backend now answers sex=female with its own shape (doc 07 §8/§9), and this
// renders it.
//
// ⚠️ THE ONE THING THAT MUST NOT LEAK ACROSS: the male frame. There is no testosterone
// base, the ranking is by VIRILIZATION RISK rather than by objective, and doses differ
// from the male catalogue by an order of magnitude. Rendering the female payload
// through _wizAdviseSection would put "Best addition" over a compound list ordered by
// risk — the same words meaning something entirely different.
function _isFemaleAdvice(res){return !!(res&&res.sex==='female');}
// The female compound table, cached module-wide. The dose guard has to work on every
// surface that shows a dose — the wizard, the edit view, the add-compound modal — and
// only the wizard ever calls the advisor. Without a cache the guard would exist on one
// screen and be silently absent on the two where a dose is most often typed in.
var _FEMALE_ADVICE=null;
var _femAdvicePending=null;
function femaleAdvice(){return _FEMALE_ADVICE;}
async function syncFemaleAdviceFromAgent(){
  if(_FEMALE_ADVICE)return _FEMALE_ADVICE;
  if(_femAdvicePending)return _femAdvicePending;
  _femAdvicePending=(async function(){
    try{
      var r=await fetch(AGENT_URL+'/compounds/enhanced-advisor',{method:'POST',
        headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({sex:'female'})});
      if(!r.ok){if(typeof _logHttp==='function')_logHttp('femaleAdvice',r.status,'/compounds/enhanced-advisor');return null;}
      var d=await r.json();
      var a=(d&&d.advice)||null;
      if(_isFemaleAdvice(a))_FEMALE_ADVICE=a;
      return _FEMALE_ADVICE;
    }catch(e){if(typeof _logErr==='function')_logErr('femaleAdvice',e);return null;}
    finally{_femAdvicePending=null;}
  })();
  return _femAdvicePending;
}
function _wizUserIsFemale(){
  var prof=(typeof getData==='function')?getData('pep-profile',null):null;
  var sx=(prof&&prof.sex)||(typeof localStorage!=='undefined'&&localStorage.getItem('user_sex'))||'male';
  return String(sx).toLowerCase()==='female';
}
// Risk record for one compound id, from whichever list it is on. The avoid list is
// searched too — a compound being ruled out is the single most important thing to be
// able to look up, and returning null for it would render it as unremarkable.
// Ester ids differ between the two catalogues — the TRT tier calls it 'enanthate',
// the backend calls it 'test_e' — and the female table only names 'test_e'. Without
// this alias the guard would render on Enhanced and be silently absent on the TRT tier,
// which is the tier a woman is most likely to be configuring testosterone in.
//
// Every injectable ester maps to the same female entry on purpose: the female warning
// is about the ROUTE (intramuscular testosterone) and the order-of-magnitude dose gap,
// neither of which changes with which ester is in the vial.
function _femaleTestoAlias(id){
  if(!id)return null;
  var esters=['enanthate','cypionate','propionate','phenylpropionate','testoviron','sustanon','nebido',
              'test_e','test_c','test_p','test_pp','test_u','supertest'];
  if(esters.indexOf(id)>=0)return 'test_e';
  if(id==='topical'||id==='gel'||id==='cream')return 'topical';
  return null;
}
function _femaleRiskFor(res,id){
  if(!res||!id)return null;
  var hit=(res.compounds||[]).find(function(c){return c.id===id;});
  if(hit)return hit;
  var alias=_femaleTestoAlias(id);
  if(alias){
    var ah=(res.compounds||[]).find(function(c){return c.id===alias;});
    if(ah)return ah;
  }
  var av=(res.avoid_compounds||[]).find(function(c){return c.id===id;});
  if(av)return {id:av.id,name:av.name,risk:'avoid',dose:null,evidence:'none',
                dose_anchor:null,dose_note:null,basis:av.reason,cite:av.cite||[]};
  return null;
}
var _FEM_RISK_STYLE={low:['#4ade80','LOW VIRILIZATION RISK'],moderate:['#f59e0b','MODERATE VIRILIZATION RISK'],
  high:['#f97316','HIGH VIRILIZATION RISK'],avoid:['#ef4444','AVOID']};
// Doc 07 §9 constraint 6 — evidence level is shown, never implied. 'community' is not a
// weaker grade of 'clinical'; it means nothing was measured, and it has to read that way.
var _FEM_EV_STYLE={clinical:['#4ade80','Clinical evidence'],community:['#f59e0b','Community practice — no trial'],
  none:['#ef4444','No evidence']};
function _femRiskChip(risk){
  var m=_FEM_RISK_STYLE[risk]||_FEM_RISK_STYLE.moderate;
  return '<span style="font-size:9px;font-weight:700;letter-spacing:0.8px;color:'+m[0]
    +';border:1px solid '+m[0]+';border-radius:4px;padding:1px 5px;white-space:nowrap;">'+m[1]+'</span>';
}
function _femEvChip(ev){
  var m=_FEM_EV_STYLE[ev]||_FEM_EV_STYLE.community;
  return '<span style="font-size:9px;font-weight:700;letter-spacing:0.8px;color:'+m[0]
    +';border:1px solid '+m[0]+';border-radius:4px;padding:1px 5px;white-space:nowrap;">'+_esc(m[1])+'</span>';
}
// ── DOSE GUARD (doc 07 §9 constraint 3) ─────────────────────────────────────
// The female dose strings are ranges written for humans ("5–10 mg/day, 4–8 weeks",
// "25–50 mg/week"). Parsing the ceiling out of them is what lets the app say "that is
// above the female range" instead of silently accepting a male dose.
//
// Returns null rather than guessing when the string has no readable range — a wrong
// ceiling would fire false warnings on correct doses, which teaches the user to ignore
// the warning that matters.
function _femaleDoseRange(entry){
  if(!entry||!entry.dose)return null;
  var m=String(entry.dose).match(/(\d+(?:\.\d+)?)\s*(?:[–\-—]\s*(\d+(?:\.\d+)?))?\s*(mcg|mg)\s*\/\s*(day|week)/i);
  if(!m)return null;
  var lo=parseDec(m[1]);var hi=m[2]?parseDec(m[2]):lo;
  return {lo:lo,hi:hi,unit:m[3].toLowerCase()+'/'+m[4].toLowerCase()};
}
// Normalise a wizard dose+unit onto the range's unit so mg/day and mg/week compare.
// Only same-magnitude, same-period comparisons are made; anything else returns null,
// because converting mg/week to mg/day silently would compare a weekly total against a
// daily ceiling and scream on a correct dose.
function _femaleDoseCompare(entry,dose,unit){
  var r=_femaleDoseRange(entry);if(!r)return null;
  var d=parseDec(dose);if(!(d>0))return null;
  var u=String(unit||'').toLowerCase().replace(/\s+/g,'');
  if(u!==r.unit)return null;
  if(d<=r.hi)return null;
  return {over:d,ceiling:r.hi,unit:r.unit,times:Math.round((d/r.hi)*10)/10};
}
// The warning a female user sees on a compound dosed above its female range.
function _femaleDoseWarning(res,id,dose,unit){
  var entry=_femaleRiskFor(res,id);if(!entry)return '';
  if(entry.risk==='avoid'){
    return 'Ruled out for women — '+String(entry.basis||'').replace(/\s+/g,' ');
  }
  var cmp=_femaleDoseCompare(entry,dose,unit);if(!cmp)return '';
  return cmp.over+' '+cmp.unit+' is '+cmp.times+'× the top of the female range for '
    +entry.name+' ('+entry.dose+'). Virilization risk is dose-dependent and voice change '
    +'is the one that does not reverse.';
}

// ── The blocking prompt (doc 07 §9 constraint 5) ────────────────────────────
// Pregnancy is an absolute contraindication, not a risk to weigh, so it is ASKED and
// the step does not advance until it is answered. Every other warning in this app is
// passive; this one is the exception on purpose.
//
// The answer lives on the wizard, not in storage: it is a statement about right now,
// and a remembered "yes" from six weeks ago is not an answer to today's question.
function _femAck(){if(!_wiz.femaleAck)_wiz.femaleAck={};return _wiz.femaleAck;}
function wizFemaleAck(key){
  var a=_femAck();a[key]=!a[key];
  wizStepAdvise(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function _femBlockingUnanswered(res){
  var a=_femAck();
  return ((res&&res.prompts)||[]).filter(function(p){return p.blocking&&!a[p.id];});
}
function _femPromptCard(p,answered){
  var c=p.blocking?'#ef4444':'#f59e0b';
  return '<div style="background:'+(answered?'rgba(74,222,128,0.07)':'rgba(239,68,68,0.07)')
    +';border:1px solid '+(answered?'#4ade80':c)+';border-radius:8px;padding:10px 12px;margin-bottom:8px;">'
    +'<div style="display:flex;align-items:flex-start;gap:8px;">'
    +'<div onclick="wizFemaleAck(\''+_esc(p.id)+'\')" style="cursor:pointer;width:18px;height:18px;flex-shrink:0;margin-top:1px;border-radius:4px;border:1.5px solid '+(answered?'#4ade80':c)+';background:'+(answered?'#4ade80':'transparent')+';display:inline-flex;align-items:center;justify-content:center;">'
    +(answered?'<svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</div>'
    +'<div style="flex:1;"><div onclick="wizFemaleAck(\''+_esc(p.id)+'\')" style="cursor:pointer;font-size:12px;font-weight:700;color:var(--text);line-height:1.4;">'+_esc(p.question)
    +(p.blocking?' <span style="font-size:9px;font-weight:700;letter-spacing:0.8px;color:#ef4444;">REQUIRED</span>':'')+'</div>'
    +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-top:4px;">'+_esc(p.why)+'</div>'
    +'</div></div></div>';
}
// One compound row. Carries risk, dose, what anchors the dose, and evidence level —
// all four, because the whole point is that they are different claims.
function _femCompoundRow(c,selected,warn){
  var m=_FEM_RISK_STYLE[c.risk]||_FEM_RISK_STYLE.moderate;
  var selectable=(c.risk!=='avoid');
  var anchorTxt={label:'Label dose',trial:'Trial dose',community:'Community practice'}[c.dose_anchor]||'';
  return '<div style="background:var(--surface2);border:1px solid '+(selected?'var(--accent)':'var(--border)')
    +';border-left:3px solid '+m[0]+';border-radius:6px;padding:9px 11px;margin-bottom:7px;'+(selectable?'cursor:pointer;':'')+'"'
    +(selectable?(' onclick="wizAdviseToggleCompound(\''+_esc(c.id)+'\')"'):'')+'>'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
    +'<span style="font-size:13px;font-weight:700;color:var(--text);">'+_esc(c.name)+'</span>'
    +_femRiskChip(c.risk)
    +(selectable?('<span style="margin-left:auto;width:18px;height:18px;border-radius:50%;border:1.5px solid '+(selected?'var(--accent)':'var(--border)')+';background:'+(selected?'var(--accent)':'transparent')+';display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">'+(selected?'<svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</span>'):'')
    +'</div>'
    +(c.dose?('<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px;">'
      +'<span style="font-size:12px;font-weight:700;color:var(--accent);">'+_esc(c.dose)+'</span>'
      +(anchorTxt?('<span style="font-size:9px;color:var(--muted2);letter-spacing:0.5px;">'+_esc(anchorTxt)+'</span>'):'')
      +_femEvChip(c.evidence)+'</div>'):'')
    +(c.basis?('<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-top:5px;">'+_esc(c.basis)+'</div>'):'')
    +(c.dose_note?('<div style="font-size:10px;color:var(--muted2);line-height:1.5;margin-top:5px;padding-left:8px;border-left:2px solid var(--border);">'+_esc(c.dose_note)+'</div>'):'')
    +(warn?('<div style="font-size:11px;color:#f59e0b;line-height:1.5;margin-top:6px;font-weight:600;">⚠ '+_esc(warn)+'</div>'):'')
    +'</div>';
}
// The female advise step. Returns the whole body HTML — wizStepAdvise hands over to it
// entirely rather than interleaving, so no male section can appear by accident.
function _wizAdviseFemaleHtml(res){
  var selIds=((_wiz.enhanced&&_wiz.enhanced.compounds)||[]).map(function(c){return c.id;});
  var h='';
  if(res.headline){
    h+='<div style="background:rgba(232,255,60,0.06);border:1px solid rgba(232,255,60,0.3);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:13px;font-weight:600;color:var(--text);line-height:1.5;">'+_esc(res.headline)+'</div>';
  }
  // Warnings first — a voice-change warning below the fold is a warning that did not happen.
  ((res.warnings)||[]).forEach(function(w){
    h+='<div style="background:rgba(239,68,68,0.09);border:1px solid rgba(239,68,68,0.45);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:12px;color:#fca5a5;line-height:1.55;">⚠ '+_esc(w)+'</div>';
  });
  if(res.prompts&&res.prompts.length){
    h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:14px 0 6px;">Before you start</div>';
    var a=_femAck();
    res.prompts.forEach(function(p){h+=_femPromptCard(p,!!a[p.id]);});
  }
  // Compounds, ordered by risk — NOT by objective. The subheading says so, because the
  // male step above this one asks for an objective and the user will expect it to matter.
  if(res.compounds&&res.compounds.length){
    h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:14px 0 4px;">Ranked by virilization risk</div>'
      +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:8px;">Lowest risk first. This order does not change with your objective — for women the limiting factor is androgenicity, not which goal you picked. Tap to add or remove.</div>';
    res.compounds.forEach(function(c){
      var sel=selIds.indexOf(c.id)>=0;
      h+=_femCompoundRow(c,sel,'');
    });
  }
  if(res.avoid_compounds&&res.avoid_compounds.length){
    h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#ef4444;text-transform:uppercase;margin:14px 0 6px;">Avoid outright</div>';
    res.avoid_compounds.forEach(function(c){
      h+='<div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid #ef4444;border-radius:6px;padding:8px 11px;margin-bottom:6px;">'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="color:#ef4444;font-weight:700;font-size:12px;">✕</span>'
        +'<span style="font-size:13px;font-weight:700;color:var(--text);">'+_esc(c.name)+'</span></div>'
        +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-top:3px;">'+_esc(c.reason)+'</div></div>';
    });
  }
  if(res.hard_rules&&res.hard_rules.length){
    h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:14px 0 6px;">Non-negotiable</div>';
    res.hard_rules.forEach(function(r){
      h+='<div style="border:1px solid var(--border);border-radius:6px;padding:8px 11px;margin-bottom:6px;background:var(--surface2);">'
        +'<div style="font-size:12px;font-weight:700;color:var(--text);line-height:1.45;">'+_esc(r.rule)+'</div>'
        +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-top:4px;">'+_esc(r.why)+'</div></div>';
    });
  }
  if(res.bloodwork&&res.bloodwork.length){
    h+='<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:14px 0 6px;">Bloodwork to add</div>'
      +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:9px 12px;margin-bottom:6px;">'
      +res.bloodwork.map(function(b){return '<div style="font-size:11px;color:var(--text);line-height:1.6;">• '+_esc(b)+'</div>';}).join('')
      +'</div>';
  }
  if(res.evidence_note){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 11px;margin-top:10px;font-size:11px;color:var(--muted2);line-height:1.55;">ℹ '+_esc(res.evidence_note)+'</div>';
  }
  ((res.notes)||[]).forEach(function(n){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 11px;margin-top:6px;font-size:11px;color:var(--muted2);line-height:1.55;">ℹ '+_esc(n)+'</div>';
  });
  h+=(typeof _renderSafetyNote==='function')?_renderSafetyNote('enhanced'):'';
  return h;
}

// Yes dismisses and the wizard carries on. No drops the enhanced steps from the flow
// and lands on whatever comes next, which is what "past this part" means.
function wizAdvAnswer(yes){
  _wiz.advAsked=true;
  if(yes){
    if(!_wiz.goals)_wiz.goals=[];
    if(_wiz.goals.indexOf('enhanced')<0)_wiz.goals.push('enhanced');
    if(!_wiz.enhanced)_wiz.enhanced={enabled:true,compounds:[]};
    _wiz.enhanced.enabled=true;
    _wiz.advSkipped=false;
    wizRender();
    return;
  }
  _wiz.advSkipped=true;
  var g=_wiz.goals||[]; var i=g.indexOf('enhanced'); if(i>=0)g.splice(i,1);
  if(_wiz.enhanced)_wiz.enhanced.enabled=false;
  var flow=_wizFlow();
  var idx=flow.indexOf('nutrition');
  if(idx<0)idx=flow.indexOf('review');
  _wiz.step=(idx>=0)?idx:Math.max(0,flow.length-1);
  wizRender();
}
function _wizAdvOverlayHtml(){
  var b='background:var(--surface2);border:1px solid var(--border);border-radius:10px;'
    +'padding:14px;font-size:14px;font-weight:700;color:var(--text);cursor:pointer;'
    +'font-family:inherit;width:100%;text-align:left';
  return '<div style="position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.92);'
    +'display:flex;align-items:center;justify-content:center;padding:24px">'
    +'<div style="max-width:420px;width:100%">'
    +'<div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:8px">'
    +'Add advanced compounds?</div>'
    +'<div style="font-size:12.5px;color:var(--muted2);line-height:1.55;margin-bottom:18px">'
    +'Your testosterone is set. Do you want to add anything on top of it — an oral, a '
    +'second injectable, or a GH-axis compound?</div>'
    +'<div style="display:flex;flex-direction:column;gap:10px">'
    +'<button onclick="wizAdvAnswer(true)" style="'+b+'">Yes, add compounds'
      +'<div style="font-size:11.5px;font-weight:400;color:var(--muted2);margin-top:3px;line-height:1.5">'
      +'Continues to guidance and the compound list.</div></button>'
    +'<button onclick="wizAdvAnswer(false)" style="'+b+'">No, testosterone only'
      +'<div style="font-size:11.5px;font-weight:400;color:var(--muted2);margin-top:3px;line-height:1.5">'
      +'Skips the rest of this section. You can still add compounds later from the protocol.</div></button>'
    +'</div></div></div>';
}
function wizStepAdvise(body,footer){
  var st=_wizAdviseState();
  var inp=_wizAdviseInputs();
  var _fem=(String(inp.sex||'').toLowerCase()==='female');
  // The objective picker is hidden for a female user because the female path ranks by
  // virilization risk and ignores the objective entirely. Showing a control that changes
  // nothing is worse than showing none — it implies the ranking is goal-driven when the
  // whole point is that it is not.
  var html='<div style="font-size:12px;color:var(--muted2);margin-bottom:12px;line-height:1.5;">'
    +(_fem?'Female protocols are dosed and ranked differently — by virilization risk rather than by goal. Tell us where you are and we\'ll show the compound set, the doses, and what each one actually rests on.'
          :'Tell us where you are and what you\'re after — we\'ll recommend which compound to add (and what to save for later). You can still pick anything on the next step.')+'</div>';
  // Profile summary (sex + BF are read from your profile)
  html+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:11px;color:var(--muted2);">'
    +'From your profile: <b style="color:var(--text)">'+_esc(inp.sex)+'</b>'
    +(inp.body_fat!=null?(' · <b style="color:var(--text)">'+Math.round(inp.body_fat)+'% BF</b>'):' · <span style="color:var(--muted2)">body-fat not logged</span>')+'</div>';
  // Experience / cycle stage (drives the whole recommendation — editable here)
  html+='<div class="wiz-section" style="margin-bottom:8px;">Where are you at?</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
  _ADV_EXPERIENCE.forEach(function(e){var sel=_advNormExp(st.experience)===e[0];
    html+='<div onclick="wizAdviseSetExperience(\''+e[0]+'\')" style="padding:8px 12px;border:1px solid '+(sel?'var(--accent)':'var(--border)')+';background:'+(sel?'rgba(232,255,60,0.08)':'transparent')+';color:'+(sel?'var(--accent)':'var(--text)')+';border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;">'+e[1]+'</div>';
  });
  html+='</div>';
  // Objective — male path only; it does not enter the female ranking.
  if(!_fem){
    html+='<div class="wiz-section" style="margin-bottom:8px;">Primary objective</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
    _ADV_OBJECTIVES.forEach(function(o){var sel=st.objective===o[0];
      html+='<div onclick="wizAdviseSetObjective(\''+o[0]+'\')" style="padding:8px 12px;border:1px solid '+(sel?'var(--accent)':'var(--border)')+';background:'+(sel?'rgba(232,255,60,0.08)':'transparent')+';color:'+(sel?'var(--accent)':'var(--text)')+';border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;">'+o[1]+'</div>';
    });
    html+='</div>';
  }
  // Sensitivity flags
  html+='<div class="wiz-section" style="margin-bottom:8px;">Any of these apply?</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
  _ADV_FLAGS.forEach(function(fl){var sel=!!(st.flags&&st.flags[fl[0]]);
    html+='<div onclick="wizAdviseToggleFlag(\''+fl[0]+'\')" style="padding:8px 12px;border:1px solid '+(sel?'#f59e0b':'var(--border)')+';background:'+(sel?'rgba(245,158,11,0.10)':'transparent')+';color:'+(sel?'#f59e0b':'var(--text)')+';border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;">'+(sel?'✓ ':'')+fl[1]+'</div>';
  });
  html+='</div>';
  // Fetch button
  html+='<button onclick="wizAdviseFetch()" '+(st.loading?'disabled ':'')+'style="width:100%;background:var(--accent);color:#0a0a0a;border:none;border-radius:10px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:0.5px;margin-bottom:14px;'+(st.loading?'opacity:0.6;':'')+'">'+(st.loading?'Getting recommendations…':(st.fetched?'Update recommendations':'Get recommendations'))+'</button>';
  // Results
  if(st.error){html+='<div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:8px;padding:10px 14px;font-size:12px;color:#f59e0b;">'+_esc(st.error)+'</div>';}
  else if(st.result&&_isFemaleAdvice(st.result)){
    // Female payload: rendered whole by its own function. Nothing from the male path
    // runs — no base row, no "best addition", no objective-driven ordering.
    html+=_wizAdviseFemaleHtml(st.result);
  }
  else if(st.result){
    var res=st.result;
    // Default-select base + best addition once per fresh recommendation.
    if(!st._autoSel){st._autoSel=true;_wizAdviseDefaultSelect(res);}
    var selIds=((_wiz.enhanced&&_wiz.enhanced.compounds)||[]).map(function(c){return c.id;});
    // Headline — the plain-language answer up top.
    if(res.headline){html+='<div style="background:rgba(232,255,60,0.06);border:1px solid rgba(232,255,60,0.3);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:13px;font-weight:600;color:var(--text);line-height:1.5;">'+_esc(res.headline)+'</div>';}
    // Selection is live here — tap to add/remove.
    if((res.primary&&res.primary.length)||(res.consider&&res.consider.length)||res.best_addition){
      html+='<div style="font-size:11px;color:var(--muted2);margin-bottom:10px;line-height:1.5;">Tap a compound to add or remove it — ✓ means it\'s in your protocol. Your picks carry to the next step.</div>';}
    // NO TESTOSTERONE ESTERS IN THIS STEP once the TRT step has one. Henrik: "no
    // testosterone esters should show up in this step." The base is already chosen and
    // configured — restating it here reads as a second decision to make, and tapping it
    // would add the molecule a second time. One line naming what the advice is built on
    // replaces the selectable card.
    var _trtBase=_wizTrtHasTesto();
    if(res.base&&!_trtBase){html+='<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px;">Your testosterone base</div>'+_wizAdviseCompoundRow({name:res.base.name,reason:res.base.note},'primary',{selectable:false})+'</div>';}
    else if(_trtBase){
      var _bn=((_wiz.trt&&_wiz.trt.compounds)||[]).map(function(c){return c.name||c.id;}).join(', ');
      html+='<div style="font-size:11px;color:var(--muted2);margin-bottom:12px;line-height:1.5;">Built on the testosterone you set earlier'+(_bn?' — <b style="color:var(--text)">'+_esc(_bn)+'</b>':'')+'. Everything below is what to add alongside it.</div>';
    }
    // Best addition (the single top pick), then the rest of primary — all tappable.
    // Testosterone is filtered out of every list, not just the base row: the backend can
    // return an ester among the recommendations, and it is not an ADDITION.
    if(_trtBase){
      if(res.best_addition&&_wizAdviseIsTesto(res.best_addition))res=Object.assign({},res,{best_addition:null});
      res=Object.assign({},res,{
        primary:(res.primary||[]).filter(function(p){return !_wizAdviseIsTesto(p);}),
        consider:(res.consider||[]).filter(function(p){return !_wizAdviseIsTesto(p);})
      });
    }
    var bestId=res.best_addition&&res.best_addition.id;
    var restPrimary=(res.primary||[]).filter(function(p){return p.id!==bestId;});
    if(res.best_addition){html+='<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px;">Best addition</div>'+_wizAdviseCompoundRow(res.best_addition,'best',{selectable:true,selected:selIds.indexOf(bestId)>=0})+'</div>';}
    if(restPrimary.length)html+=_wizAdviseSection(res.best_addition?'Also recommended':'Recommended for you',restPrimary,'primary',selIds);
    html+=_wizAdviseSection('Worth considering',res.consider,'consider',selIds);
    // On-cycle support (e.g. HCG) — this runs DURING the cycle, not in PCT.
    if(res.on_cycle&&res.on_cycle.length){html+='<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px;">On-cycle support</div>'+res.on_cycle.map(function(o){return _wizAdviseCompoundRow(o,'oncycle');}).join('')+'</div>';}
    html+=_wizAdviseSection('Save for a later cycle',res.save_for_later,'later');
    html+=_wizAdviseSection('Not recommended for you',res.avoid,'avoid');
    if(res.guardrails&&res.guardrails.length){html+='<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px;">Guardrails</div>'+res.guardrails.map(function(g){return '<div style="font-size:11px;color:var(--text);line-height:1.5;padding:2px 0;">• '+_esc(g)+'</div>';}).join('')+'</div>';}
    if(res.notes&&res.notes.length){html+=res.notes.map(function(n){return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 10px;margin-bottom:6px;font-size:11px;color:var(--muted2);line-height:1.5;">ℹ '+_esc(n)+'</div>';}).join('');}
    html+='<div style="font-size:11px;color:var(--muted2);margin-top:8px;line-height:1.5;">You can fine-tune doses and add anything else on the next step.</div>';
    html+=_renderSafetyNote('enhanced');
  }
  // The overlay rides on top of the fully-rendered step, so answering Yes just drops it
  // and the guidance behind it is already there — no second render, no flicker.
  body.innerHTML=html+((!_wiz.advAsked&&!_wiz.advSkipped)?_wizAdvOverlayHtml():'');
  // Doc 07 §9 constraint 5: the pregnancy prompt BLOCKS. Every other warning in this
  // wizard is passive; this one gates the step, because an absolute contraindication
  // that a user can scroll past is not a contraindication.
  var _block=(st.result&&_isFemaleAdvice(st.result))?_femBlockingUnanswered(st.result):[];
  if(_block.length){
    footer.innerHTML='<button class="btn btn-primary" style="flex:1;opacity:0.5" disabled>Next →</button>'
      +'<div style="font-size:11px;color:#ef4444;margin-top:8px;line-height:1.5;">Answer the required question above to continue.</div>';
  }else{
    footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizAdviseNext()">Next →</button>';
  }
}
function wizStepEnhanced(body,footer){
  if(!_wiz.enhanced)_wiz.enhanced={enabled:false,compounds:[]};
  // Catalogue not yet loaded — show a visible loading state and auto-fetch
  if(!ENHANCEMENT_COMPOUNDS||!ENHANCEMENT_COMPOUNDS.length){
    body.innerHTML='<div style="padding:40px 0;text-align:center;"><div class="today-spinner-dot" style="margin:0 auto 16px"></div><div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:6px;">Loading compounds…</div><div style="font-size:12px;color:var(--muted2);">Connecting to backend…</div></div>';
    footer.innerHTML='<button class="btn btn-primary" style="flex:1;opacity:0.5" disabled>Next →</button>';
    syncEnhancedCompoundsFromAgent().then(function(result){
      if(_wizFlow()[_wiz.step]!=='enhanced')return;
      var b=document.getElementById('wiz-body'),f=document.getElementById('wiz-footer');
      if(!b||!f)return;
      if(ENHANCEMENT_COMPOUNDS&&ENHANCEMENT_COMPOUNDS.length){wizStepEnhanced(b,f);}
      else{
        var _errDetail=result&&result.status?(' (HTTP '+result.status+')'):(result&&result.msg?' ('+result.msg+')':'');
        b.innerHTML='<div style="padding:32px 0;text-align:center;"><div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:8px;">Catalogue unavailable</div><div style="font-size:13px;color:var(--muted2);margin-bottom:20px;">Check your connection and try again.'+_errDetail+'</div><button class="btn btn-primary" onclick="wizStepEnhanced(document.getElementById(\'wiz-body\'),document.getElementById(\'wiz-footer\'))">Try again</button></div>';
        f.innerHTML='<button class="btn btn-primary" style="flex:1;opacity:0.5" disabled>Next →</button>';
      }
    });
    return;
  }
  // Pre-fill matching TRT compounds on first entry
  if(!_wiz.enhanced._prefilled){
    _wiz.enhanced._prefilled=true;
    _trtCompounds(_wiz.trt).forEach(function(tc){
      var match=ENHANCEMENT_COMPOUNDS.find(function(ec){return ec.name.toLowerCase()===(tc.name||'').toLowerCase();});
      if(match&&!(_wiz.enhanced.compounds||[]).some(function(c){return c.id===match.id;})){
        if(!_wiz.enhanced.compounds)_wiz.enhanced.compounds=[];
        var _pfEntry={id:match.id,name:match.name,dose:String(tc.dose||match.defaultDose||''),unit:tc.unit||match.unit||'mg',days:tc.days?tc.days.slice():(match.defaultDays?match.defaultDays.slice():[0,1,2,3,4,5,6]),dot:match.dot};
        if(match.amPm){_pfEntry.amPm=true;TIME_SLOTS.forEach(function(t){var k=_slotKey(t),C=k.charAt(0).toUpperCase()+k.slice(1);_pfEntry['dose_'+k]=String(tc['dose_'+k]||match['defaultDose'+C]||'');});}
        _wiz.enhanced.compounds.push(_pfEntry);
      }
    });
    _wiz.enhanced.enabled=(_wiz.enhanced.compounds||[]).length>0;
  }
  var sel=_wiz.enhanced.compounds||[];
  var selIds=sel.map(function(c){return c.id;});
  var groups={};
  ENHANCEMENT_COMPOUNDS.forEach(function(c){
    if(!groups[c.group])groups[c.group]=[];
    groups[c.group].push(c);
  });
  var html='<div style="font-size:12px;color:var(--muted2);margin-bottom:12px;">Select enhancement compounds and configure dose and frequency for each.</div>';
  Object.keys(groups).forEach(function(grp){
    html+='<div class="wiz-section" style="margin-bottom:8px;">'+_esc(grp)+'</div>';
    groups[grp].forEach(function(c){
      var isSel=selIds.includes(c.id);
      var selData=isSel?sel.find(function(s){return s.id===c.id;}):null;
      html+='<div class="pep-card'+(isSel?' sel':'')+'" onclick="wizToggleEnhancedCompound(\''+c.id+'\')" style="margin-bottom:'+(isSel?'0':'8px')+';'+(isSel?'border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom-color:transparent;':'')+'"><div class="pep-dot-sm" style="background:'+c.dot+'"></div><div class="pep-info"><div class="pep-name">'+_esc(c.name)+'</div><div class="pep-meta">'+_esc(_halfLifeLabel(c)||c.group||'')+'</div></div><div class="pep-chk">'+(isSel?'<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</div></div>';
      if(isSel&&selData){
        html+='<div style="border:1px solid var(--accent);border-top:none;border-radius:0 0 10px 10px;padding:12px 14px;margin-bottom:8px;background:rgba(232,255,60,0.015);">';
        html+=_enhDormantNoteHtml(c,_wiz);
        if(c.amPm){
          var _wUnit=(c.unit||'IU').split('/')[0];
          var _wTimes=_enhTimes(selData);
          html+='<div class="cfg-row"><div class="cfg-lbl">Timing</div><div class="time-chips">'
            +TIME_SLOTS.map(function(t){
              return '<div class="time-chip'+(_wTimes.indexOf(t)>=0?' sel':'')+'" onclick="wizToggleEnhTime(\''+c.id+'\',\''+t+'\')">'+_slotLabel(t)+'</div>';
            }).join('')
            +'</div></div>';
          _wTimes.forEach(function(t){var k=_slotKey(t);
            html+='<div class="cfg-row"><div class="cfg-lbl">'+_slotLabel(t)+' Dose</div><div class="dose-row"><input class="dose-in" type="text" inputmode="decimal" value="'+String(selData['dose_'+k]||'')+'" oninput="wizSetEnhDoseSlot(\''+c.id+'\',\''+k+'\',this.value)" placeholder="0"><span style="font-size:13px;color:var(--muted2);padding:0 6px;white-space:nowrap;">'+_wUnit+'</span></div></div>';
          });
          html+=_renderSlotTimingHint(c.id,_wTimes);
          html+=_renderEnhCadence(c,selData,'wiz');
        }else{
          html+='<div class="cfg-row"><div class="cfg-lbl">Dose</div><div class="dose-row"><input class="dose-in" type="text" inputmode="decimal" value="'+String(selData.dose||'')+'" oninput="wizSetEnhDose(\''+c.id+'\',this.value)" placeholder="0"><select class="unit-sel" onchange="wizSetEnhUnit(\''+c.id+'\',this.value)">'+['mg/week','mg/day','mg/EOD','IU/day','IU/week','mg','ml','%'].map(function(u){return'<option'+(u===(selData.unit||'mg/week')?' selected':'')+'>'+u+'</option>';}).join('')+'</select></div></div>';
          html+=_renderEnhCadence(c,selData,'wiz');
        }
        html+='<div id="wiz-enh-guide-'+c.id+'">'+_renderEnhancedGuide(c,c.amPm?_enhSplitTotal(selData):parseDec(selData.dose||0),selData.unit)+'</div>';
        html+='</div>';
      }
    });
  });
  // A testosterone base is still required — and the TRT step is now where it comes
  // from. Checking only _wiz.enhanced.compounds left Next DISABLED for anyone who had
  // set their ester one step earlier, which is everyone since the toggles merged.
  var hasTest=_wizTrtHasTesto()||sel.some(function(c){
    var cat=ENHANCEMENT_COMPOUNDS.find(function(ec){return ec.id===c.id;});
    return cat&&cat.cls==='base';
  });
  if(!hasTest){
    html='<div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#f59e0b;">⚠ A testosterone base is required for an enhanced cycle.</div>'+html;
  }
  body.innerHTML=html;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1'+(hasTest?'':';opacity:0.5')+'" '+(hasTest?'':'disabled ')+'onclick="wizNext()">Next →</button>';
}
function wizToggleEnhancedCompound(id){
  if(!_wiz.enhanced)_wiz.enhanced={enabled:false,compounds:[]};
  if(!_wiz.enhanced.compounds)_wiz.enhanced.compounds=[];
  var idx=_wiz.enhanced.compounds.findIndex(function(c){return c.id===id;});
  if(idx!==-1){
    _wiz.enhanced.compounds.splice(idx,1);
  }else{
    var cat=ENHANCEMENT_COMPOUNDS.find(function(c){return c.id===id;});
    if(cat){var _wEntry={id:cat.id,name:cat.name,dose:String(cat.defaultDose||''),unit:cat.unit||'mg',days:cat.defaultDays?cat.defaultDays.slice():[0,1,2,3,4,5,6],dot:cat.dot};if(cat.amPm){_wEntry.amPm=true;_enhSeedSlots(_wEntry,cat);}_wiz.enhanced.compounds.push(_wEntry);}
  }
  _wiz.enhanced.enabled=_wiz.enhanced.compounds.length>0;
  wizStepEnhanced(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));
}
function wizSetEnhDose(id,v){var c=(_wiz.enhanced.compounds||[]).find(function(c){return c.id===id;});if(!c)return;c.dose=v;var el=document.getElementById('wiz-enh-guide-'+id);if(el){var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(x){return x.id===id;});el.innerHTML=_renderEnhancedGuide(cat,parseDec(v||0),c.unit);}}
function wizSetEnhUnit(id,v){var c=(_wiz.enhanced.compounds||[]).find(function(c){return c.id===id;});if(c)c.unit=v;}
function wizSetEnhDoseSlot(id,slot,v){var c=(_wiz.enhanced.compounds||[]).find(function(c){return c.id===id;});if(!c)return;c['dose_'+_slotKey(slot)]=v;var el=document.getElementById('wiz-enh-guide-'+id);if(el){var cat=(ENHANCEMENT_COMPOUNDS||[]).find(function(x){return x.id===id;});el.innerHTML=_renderEnhancedGuide(cat,_enhSplitTotal(c),c.unit);}}
function wizSetEnhDays(id,di){var c=(_wiz.enhanced.compounds||[]).find(function(c){return c.id===id;});if(!c)return;if(!c.days)c.days=[];var idx=c.days.indexOf(di);if(idx!==-1){if(c.days.length>1)c.days.splice(idx,1);}else{c.days.push(di);}c.days.sort(function(a,b){return a-b;});wizStepEnhanced(document.getElementById('wiz-body'),document.getElementById('wiz-footer'));}
// Every TRT compound this protocol will actually dose, whichever way the tier was
// filled in. Reported 2026-08-01: the Validate and Review steps read only the classic
// _wiz.trt tier, so a protocol whose testosterone came from the T-Calc planner listed
// its peptides and nothing else — it read as a peptide-only stack. Summaries must
// always show every tier, so they go through this.
// Returns display rows: {id, name, dot, dose, cadence}.
function _wizTrtSummaryRows(){
  var rows=[], seen={};
  var nameOf=function(id){
    if(typeof _tcCompInfo==='function'){var cd=_tcCompInfo(id);if(cd&&cd.name)return cd.name;}
    var t=(typeof TRT_CAT!=='undefined'?TRT_CAT:[]).find(function(c){return c.id===id;});
    return t?t.name:(id||'Testosterone');
  };
  // The T-Calc planner plan, if the user filled it in on the TRT step.
  var p=(_wiz&&_wiz.trtPlan)||null;
  if(p&&p.compId&&parseDec(p.doseMg)>0&&parseDec(p.cadenceDays)>0){
    var n=parseInt(p.cadenceN,10)||0;
    var cad=n?('Every '+(n===1?'':n+' ')+((typeof _tcCadenceUnitLabel==='function')?_tcCadenceUnitLabel(p.cadenceUnit,n):p.cadenceUnit))
             :('Every '+parseDec(p.cadenceDays)+' days');
    rows.push({id:p.compId,name:nameOf(p.compId),dot:'var(--accent4)',dose:parseDec(p.doseMg)+'mg',cadence:cad});
    seen[p.compId]=true;
  }
  // Anything configured in the classic multi-compound editor.
  (typeof _trtCompounds==='function'?_trtCompounds(_wiz&&_wiz.trt):[]).forEach(function(c){
    if(c.id&&seen[c.id])return;
    if(c.id)seen[c.id]=true;
    // TRT's own resolver, so the label matches what _genInjBatches actually schedules.
    // This read days[] first and ignored c.cadence, so a solved every-3-days plan
    // rendered as "1x/week" — the summary contradicting the schedule underneath it.
    var days=c.id||c.cadence||c.days||c.freqVal?_trtCadenceLabel(c):'TRT';
    rows.push({id:c.id||'',name:c.name||nameOf(c.id),dot:c.dot||'var(--accent4)',
               dose:c.dose?c.dose+(c.unit||'mg'):'',cadence:days});
  });
  return rows;
}
function wizStepValidate(body,footer){
  var g=(_wiz&&_wiz.goals)||[];
  var pepGoals=g.filter(function(x){return x!=='trt'&&x!=='enhanced';});
  var hasPeps=pepGoals.length>0||(!_wiz.trt.enabled&&!g.includes('enhanced'));
  var hasEnhanced=g.includes('enhanced');
  var html='<div class="wiz-section" style="margin-bottom:8px">All Compounds</div>';
  if(hasPeps&&_wiz.peptides.length){
    html+='<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px">Peptides</div>';
    _wiz.peptides.forEach(function(p){html+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><div style="width:7px;height:7px;border-radius:50%;background:'+(p.dot||'#888')+';flex-shrink:0"></div><span style="font-size:13px;color:var(--text)">'+p.name+'</span></div>';});
  }
  var _trtRows=_wizTrtSummaryRows();
  if(_trtRows.length){
    html+='<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:10px 0 6px">TRT</div>';
    _trtRows.forEach(function(r){
      html+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><div style="width:7px;height:7px;border-radius:50%;background:'+r.dot+';flex-shrink:0"></div><span style="font-size:13px;color:var(--text)">'+_esc(r.name)+'</span></div>';
    });
  }

  if(hasEnhanced&&_wiz.enhanced&&_wiz.enhanced.compounds&&_wiz.enhanced.compounds.length){
    html+='<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin:10px 0 6px">Enhanced</div>';
    _wiz.enhanced.compounds.forEach(function(c){html+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><div style="width:7px;height:7px;border-radius:50%;background:'+(c.dot||'var(--accent2)')+';flex-shrink:0"></div><span style="font-size:13px;color:var(--text)">'+_esc(c.name||c.id)+'</span></div>';});
  }
  var pepObjs=_wiz.peptides.map(function(p){return PEPTIDE_CAT.find(function(c){return c.id===p.id;})||{id:p.id,cg:[]};});
  html+='<div class="wiz-section" style="margin-top:16px;margin-bottom:8px">Cross-Compound Check</div>';
  html+=renderCheckResults(pepObjs,'wizinline');
  body.innerHTML=html;
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
}
// Compound-aware macros as part of stack creation. Targets auto-adjust to the
// stack tier (injected androgens lower the fat floor); phase is the user override.
function wizStepNutrition(body,footer){
  var bw=parseDec(localStorage.getItem('user_weight'))||0;
  var onAndrogens=!!(_wiz&&((_wiz.trt&&_wiz.trt.enabled)||(_wiz.goals||[]).includes('enhanced')));
  var html='<div style="font-size:12px;color:var(--muted2);margin-bottom:12px;">Macro targets for this protocol'+(onAndrogens?' — adjusted for injected hormones':'')+'. These also drive the Macros tab.</div>';
  if(!bw){
    html+='<div style="background:rgba(232,255,60,0.06);border-left:3px solid var(--accent);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--muted2);line-height:1.6">Set your body weight in the <b>Weights</b> tab to see calorie and macro targets here.</div>';
    body.innerHTML=html;footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';return;
  }
  var phases=[{id:'reset',label:'Reset'},{id:'cut',label:'Cut'},{id:'recomp',label:'Recomp'}];
  html+='<div style="display:flex;gap:6px;margin-bottom:12px">'+phases.map(function(p){var s=_macrosPhase===p.id;return'<button onclick="wizSetMacroPhase(\''+p.id+'\')" style="flex:1;background:'+(s?'var(--accent)':'var(--surface2)')+';color:'+(s?'#000':'var(--muted2)')+';border:1px solid '+(s?'var(--accent)':'var(--border)')+';border-radius:20px;padding:8px 4px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">'+p.label+'</button>';}).join('')+'</div>';
  // macrosForUser, not calcMacros: ONE source for the numbers, so this step and the
  // Macros tab cannot show different targets for the same protocol.
  var m=(typeof macrosForUser==='function')?macrosForUser(_macrosPhase,onAndrogens):calcMacros(bw,_macrosPhase,onAndrogens);
  var _wdash='\u2014';
  var mi=[{l:'Calories',v:(m.kcal==null?_wdash:m.kcal),u:'kcal'},{l:'Protein',v:m.protein,u:'g'},{l:'Carbs',v:(m.carbs==null?_wdash:m.carbs),u:'g'},{l:'Fat',v:m.fat,u:'g'}];
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:12px">'+mi.map(function(x,i){return'<div style="padding:14px 6px;text-align:center'+(i<3?';border-right:1px solid var(--border)':'')+'"><div style="font-family:var(--font-mono);font-size:22px;line-height:1;color:var(--text)">'+x.v+'</div><div style="font-size:9px;color:var(--muted2);text-transform:uppercase;margin-top:3px">'+x.u+'</div><div style="font-size:9px;color:var(--muted2)">'+x.l+'</div></div>';}).join('')+'</div>';
  html+='<div style="background:rgba(60,255,160,0.06);border-left:3px solid var(--accent3);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--muted2);line-height:1.6">'+_macrosFatNote(onAndrogens,_macrosPhase,m)+'</div>';
  // No calorie target without the profile to compute one. Say what is missing rather
  // than filling the gap with a constant — that is what this model replaced.
  if(m.kcal==null){
    html+='<div style="background:rgba(232,255,60,0.06);border-left:3px solid var(--accent);border-radius:8px;padding:11px 14px;font-size:11px;color:var(--muted2);line-height:1.6;margin-top:10px">No calorie target yet — it needs <b>'+m.missing.join(' ')+'</b>. Add a body-fat reading in the <b>Body</b> tab, or your height and age.</div>';
  } else {
    html+='<div style="background:rgba(232,255,60,0.05);border-left:3px solid var(--accent);border-radius:8px;padding:11px 14px;font-size:11px;color:var(--muted2);line-height:1.6;margin-top:10px">Maintenance <b>'+m.tdee+' kcal</b> from '+(m.bmrMethod==='katch'?'Katch-McArdle':'Mifflin-St Jeor')+' \u00d7 PAL '+MACROS_PAL_BASE.toFixed(2)+(m.includeTraining&&m.trainKcal>0?(' + '+m.trainKcal+' kcal training'):'')+'.'
      +(m.ea?(' Energy availability <b>'+m.ea.value.toFixed(0)+' kcal/kg FFM</b>'+(m.ea.tier==='low'?' \u2014 <b>low</b>, below the threshold where lean mass and endocrine function start paying for it.':m.ea.tier==='suboptimal'?' \u2014 suboptimal band (30\u201345); fine for a short cut, not a long push.':' \u2014 adequate.')):'')
      +'</div>';
  }
  // Training burn: counted by default now, with the toggle living on the Macros tab.
  if(typeof _macrosTrainKcal!=='undefined'){ var _tb=Math.max(0,Math.round(_macrosTrainKcal||0)); if(_tb>0)html+='<div style="background:rgba(60,255,160,0.05);border-left:3px solid var(--accent2);border-radius:8px;padding:11px 14px;font-size:11px;color:var(--muted2);line-height:1.6;margin-top:10px">Your logged training burns about <b>+'+_tb+' kcal/day</b> (14-day avg, from the workout tracker) \u2014 '+(m.includeTraining?'<b>included</b> in the target above':'<b>not</b> included; untick lives on the Macros tab')+'.</div>'; }
  body.innerHTML=html;
  // Pull the user's measured training burn once available; re-render only if it changed
  // (self-limiting — avoids a fetch/render loop).
  if(typeof syncMacrosTrainEnergy==='function'){ var _pt=(typeof _macrosTrainKcal!=='undefined'?_macrosTrainKcal:0); syncMacrosTrainEnergy(function(){ if(_macrosTrainKcal!==_pt && _wiz && _wizFlow()[_wiz.step]==='nutrition') wizRender(); }); }
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizNext()">Next →</button>';
}
function wizSetMacroPhase(p){if(typeof setMacrosPhase==='function')setMacrosPhase(p);else _macrosPhase=p;wizRender();}
function wizStepReview(body,footer){
  var pepObjs=_wiz.peptides.map(function(p){return PEPTIDE_CAT.find(function(c){return c.id===p.id;})||{id:p.id,cg:[]};});
  var hasErrors=checkStack(pepObjs).some(function(i){return i.level==='err';});
  var html='<div class="wiz-section">Protocol Name</div><input class="trt-in" type="text" value="'+_esc(String(_wiz.stackName||''))+'" oninput="wizSetStackName(this.value)" placeholder="e.g. Cutting, Bulk 1, TRT base…">';
  html+='<div class="wiz-section" style="margin-top:16px">Summary</div>';
  var _reviewFlow=_wizFlow();
  if(_wiz.peptides.length){_wiz.peptides.forEach(function(p){var dose=_slotDoseSummary(p,'/',false)||'?';var days=_cadenceLabel(p,'days')||'?';html+='<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:'+(p.dot||'#888')+';flex-shrink:0"></div><div style="flex:1;font-size:13px;color:var(--text)">'+_esc(p.name)+'</div><div style="font-size:12px;color:var(--muted2)">'+_esc(dose+' · '+days)+'</div></div>';});}
  else if(_reviewFlow.includes('peptides')){html+='<div style="color:var(--muted2);font-size:13px;">No peptides selected.</div>';}
  _wizTrtSummaryRows().forEach(function(r){html+='<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:'+r.dot+';flex-shrink:0"></div><div style="flex:1;font-size:13px;color:var(--text)">'+_esc(r.name)+'</div><div style="font-size:12px;color:var(--muted2)">'+_esc((r.dose?r.dose+' · ':'')+r.cadence)+'</div></div>';});
  if((_wiz.goals||[]).includes('enhanced')){
    html+='<div class="wiz-section" style="margin-top:16px">Enhancement Compounds</div>';
    if(_wiz.enhanced&&_wiz.enhanced.compounds&&_wiz.enhanced.compounds.length){
      _wiz.enhanced.compounds.forEach(function(c){
        var days=_enhCadenceLabel(c)||'';
        // A SPLIT COMPOUND DOES NOT KEEP ITS DOSE IN c.dose. HGH configured as 3 IU AM
        // + 3 IU PM stores those in dose_am/dose_pm and leaves c.dose at whatever the
        // catalogue seeded — which is what reported "2IU/day" for a 6 IU/day protocol.
        // Same helper the dose guide and the generator already use.
        var _amPm=c.amPm||((typeof ENHANCEMENT_COMPOUNDS!=='undefined'&&ENHANCEMENT_COMPOUNDS||[])
                    .find(function(x){return x.id===c.id;})||{}).amPm;
        var _tot=_amPm?_enhSplitTotal(c):parseDec(c.dose||0);
        var _unit=(c.unit||'mg').split('/')[0];
        var doseLabel=(_tot>0?(_tot+_unit+(_amPm?'/day':'')):'')+(days?' · '+days:'');
        html+='<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:'+(c.dot||'var(--accent2)')+';flex-shrink:0"></div><div style="flex:1;font-size:13px;color:var(--text)">'+_esc(c.name||c.id)+'</div><div style="font-size:12px;color:var(--muted2)">'+_esc(doseLabel)+'</div></div>';
      });
    }else{html+='<div style="color:var(--muted2);font-size:13px;">No enhancement compounds selected.</div>';}
  }
  body.innerHTML=html;
  var saveLabel=hasErrors?'Save Anyway (conflicts)':'Save Protocol';
  footer.innerHTML='<button class="btn btn-primary" style="flex:1" onclick="wizSave()">'+saveLabel+'</button>';
}

function closeWizard(){if(_wizOverlay){_wizOverlay.classList.remove('open');}}
function wizBack(){
  if(_wiz.step===0){closeWizard();return;}
  _wiz.step--;
  wizRender();
}
function wizNext(){
  var flow=_wizFlow();
  _wiz.step=Math.min(flow.length-1,_wiz.step+1);
  wizRender();
}
function showWizard(editModeUnused){
  // _wiz must already be initialised by createNewStack() or editStackWithCycle()
  if(!_wizOverlay){
    _wizOverlay=document.createElement('div');
    _wizOverlay.className='wiz-overlay';
    _wizOverlay.innerHTML='<div class="wiz-header"><button class="wiz-back" id="wiz-back-btn">&#8249;</button><div class="wiz-title" id="wiz-title">BUILD STACK</div><div class="wiz-progress" id="wiz-progress"></div><button class="wiz-cancel" onclick="closeWizard()">Cancel</button></div><div class="wiz-body" id="wiz-body"></div><div class="wiz-footer" id="wiz-footer"></div>';
    document.body.appendChild(_wizOverlay);
    document.getElementById('wiz-back-btn').onclick=wizBack;
  }
  setTimeout(function(){_wizOverlay.classList.add('open');},10);
  wizRender();
}

// ── Injection generation ──────────────────────────────────────────────────────

function _deriveStackCycleId(stack){
  var name=((stack&&stack.name)||'stack').replace(/\s+/g,'_').toLowerCase().replace(/[^a-z0-9_]/g,'');
  return name+'_'+((stack&&stack.cycle_start)||'nostart');
}
// Stable per-stack id, frozen so renaming a stack or moving its cycle start no
// longer orphans the stack's scheduled injections. Legacy stacks (no id) adopt
// their CURRENT derived cycle_id, which keeps their existing injections linked.
function _ensureStackId(stack){
  if(stack&&!stack.id)stack.id=_deriveStackCycleId(stack);
  return stack?stack.id:'';
}
function _stackCycleId(stack){
  return (stack&&stack.id)?stack.id:_deriveStackCycleId(stack);
}

function _getProtocolCompoundIds(stack){
  var ids=[];
  (stack.peptides||[]).forEach(function(p){if(p.id)ids.push(p.id);});
  if(stack.trt&&stack.trt.compounds)(stack.trt.compounds||[]).forEach(function(c){if(c.id)ids.push(c.id);});
  if(stack.enhanced&&stack.enhanced.compounds)(stack.enhanced.compounds||[]).forEach(function(c){if(c.id)ids.push(c.id);});
  return ids;
}

// ── THE INJECTION INTERVAL IS NOT FIXED FOR A WHOLE PROTOCOL ────────────────
// Henrik, 2026-08-27: "cadence doesn't have to be static for the period. If it makes
// sense to start with very small daily injections for 6 days and then e2d up to e7d,
// that is totally fine AND should probably mostly be due to ester used and also to
// minimise unnecessary fluctuations in free T (since high peaks drives sides)."
//
// He is right and the single-cadence-per-compound rule was a limitation of this data
// model, not of the pharmacology. Weekly load is dose ÷ interval, so the interval is
// the second half of the dosing decision: a small weekly requirement needs a LONGER
// interval for the per-injection dose to be drawable at all, and a large one needs a
// SHORTER interval to keep the peak down — and peaks are what drive side effects.
//
// A phase may therefore carry `iv`, its own injection interval in days. Phases without
// it fall back to the compound's own cadence, so nothing already saved changes.
//
// ⚠️ AN INTERVAL NEEDS AN ORIGIN, AND IT IS THE PHASE'S OWN START — not the cycle
// start. Counting every interval from the cycle start would make a phase boundary
// silently skip or double an injection whenever the new interval did not divide the
// offset, which is a dose error produced by arithmetic the user never sees.
// cycleStart arrives as a STRING from the dose-ramp callers and as a DATE from the
// generator's hit test, which already parsed it. Accepting both is cheaper than making
// every call site agree, and getting it wrong throws inside the day loop.
function _cycleStartDate(cs){
  return (cs instanceof Date)?cs:parseLocalDate(cs);
}
function _phaseAt(p,cycleStart,targetDate){
  if(!p||!p.dose_phases||!p.dose_phases.length||!cycleStart)return null;
  var sd=_cycleStartDate(cycleStart);
  var wk=Math.floor((targetDate-sd)/604800000);
  if(wk<0)wk=0;
  var phases=p.dose_phases.slice().sort(function(a,b){return (a.w||0)-(b.w||0);});
  var cur=phases[0], idx=0;
  for(var i=1;i<phases.length;i++){if(wk>=phases[i].w){cur=phases[i];idx=i;}}
  return cur?{phase:cur,index:idx,startWeek:cur.w||0}:null;
}
// ── A PHASE MAY CARRY A REPEATING DAY PATTERN ───────────────────────────────
// Henrik, 2026-08-27: "would locking the cadence to every day and only vary the dose
// between days help then?"
//
// It helps a great deal, and it dissolves a trade-off I had stated as fact. I had said
// a shorter interval gives coarser control of the weekly load, because one syringe step
// is spread over more injections. That is only true while every injection is the SAME
// dose. Let the dose differ between days and daily dosing gives the lowest peak AND the
// finest weekly resolution at once: alternating two adjacent syringe steps puts the
// weekly average anywhere between them.
//
// Measured on the same transition — 250 mg/ml, 0.05 ml steps, target 1400 — daily with
// a dithered dose holds 1-3% off target from week 4 onward with 8% within-week ripple,
// where a fixed every-2-days wanders up to 8% off and is still drifting down at week 15
// with 14% ripple.
//
// `pattern` is that week: seven doses, repeating from the phase's own start. A phase
// without one keeps using its single `d`, so nothing already saved changes.
function _patternDoseAt(p,cycleStart,targetDate){
  var a=_phaseAt(p,cycleStart,targetDate);
  if(!a||!a.phase.pattern||!a.phase.pattern.length)return null;
  var phaseStart=new Date(_cycleStartDate(cycleStart).getTime()+(a.startWeek||0)*7*86400000);
  var day=Math.round((targetDate-phaseStart)/86400000);
  if(day<0)day=0;
  var pat=a.phase.pattern;
  return {dose:String(pat[day%pat.length]),unit:a.phase.u};
}
function _effectiveDoseAt(p,cycleStart,targetDate){
  var pat=_patternDoseAt(p,cycleStart,targetDate);
  if(pat)return pat;
  var a=_phaseAt(p,cycleStart,targetDate);
  return a?{dose:a.phase.d,unit:a.phase.u}:null;
}
// Interval in days for the phase covering this date, or null to use the compound's
// own cadence.
function _effectiveIntervalAt(p,cycleStart,targetDate){
  var a=_phaseAt(p,cycleStart,targetDate);
  var iv=a&&parseDec(a.phase.iv);
  return (iv>0)?{days:iv,startWeek:a.startWeek}:null;
}
// Does this compound inject on this date, honouring a per-phase interval when the
// active phase declares one?
function _phasedHitsDay(c,d,cycleStart,fallback){
  var pi=_effectiveIntervalAt(c,cycleStart,d);
  if(!pi)return fallback(c,d,cycleStart);
  var phaseStart=new Date(_cycleStartDate(cycleStart).getTime()+pi.startWeek*7*86400000);
  var since=Math.round((d-phaseStart)/86400000);
  return since>=0 && since%pi.days===0;
}

// STEP IN CALENDAR DAYS, NEVER IN MILLISECONDS.
// Adding 86400000 ms is 24 hours, and a DST day is 23 or 25. Crossing one, the loop
// variable creeps to 23:00 the previous day and a date is emitted twice or skipped
// entirely — a missing or duplicated injection, from a clock change.
//
// T-Calc's planner carried a guard against exactly this (2026-08-07); when Phase 6
// deleted that planner, the guard would have gone with it while the hazard moved to
// this generator, which is now the only thing expanding a schedule into dates.
function _nextDay(d){
  var n=new Date(d);
  n.setDate(n.getDate()+1);
  return n;
}

// ── A LOADING DOSE RIDES ON THE FIRST INJECTION, AND ONLY ON IT ─────────────
// Held as a plain mg on the compound rather than as a dated row. A date would have to
// be kept in step with the ramp's cycle_start offset, with the compound's own
// start_date, and with every edit to either — and a stale one would front-load the
// wrong day silently.
//
// ⚠️ THE FIRST DAY IS COMPUTED FROM THE PROTOCOL START, NEVER FROM genStart.
// Regeneration resumes from a date in the middle of a plan (a forward rewrite after an
// edit). Taking the first day from there would re-apply the front-load on whatever day
// the rewrite happened to start — a second loading dose, weeks in, every time anything
// was edited. Off the protocol start it resolves to the same calendar day every time,
// and that day falls outside a forward rewrite's window, so the rewrite simply does
// not include it.
function _trtLoadFirstDay(c,cycleStart,cycleEnd){
  if(!(parseDec(c&&c.load_mg)>0))return null;
  var from=c.start_date
    ? new Date(Math.max(parseLocalDate(c.start_date).getTime(),cycleStart.getTime()))
    : new Date(cycleStart);
  for(var d=new Date(from); d<=cycleEnd; d=_nextDay(d)){
    if(_phasedHitsDay(c,d,cycleStart,_trtHitsDay))return dateKey(d);
  }
  return null;
}

function _genInjBatches(stack,cycleId,fromDate){
  if(!stack||!stack.cycle_start)return[];
  var cycleStart=parseLocalDate(stack.cycle_start);
  var cycleEnd;
  // end_date WINS when set. The editor writes an exact date and keeps cycle_length in
  // step with it, but the length is whole weeks — rounded UP — so a protocol ending on
  // a Wednesday would otherwise generate to the following Sunday. Asking for precise
  // dates and then scheduling to a rounded week is the failure this whole change
  // exists to avoid; the exact date is the one the user typed.
  if(stack.end_date){cycleEnd=parseLocalDate(stack.end_date);}
  else if(stack.cycle_length&&stack.cycle_length>0){cycleEnd=new Date(cycleStart.getTime()+stack.cycle_length*7*86400000);}
  else{cycleEnd=new Date(NOW.getTime()+365*86400000);}
  var genStart=fromDate?new Date(Math.max(cycleStart.getTime(),fromDate.getTime())):cycleStart;
  var batches=[];

  // Peptides
  (stack.peptides||[]).forEach(function(p){
    if(p.active===false)return;
    var times=p.times||['AM'];
    var dot=p.dot||'#888';
    var pStart=p.start_date?parseLocalDate(p.start_date):cycleStart;
    var pEnd=p.end_date?parseLocalDate(p.end_date):null;
    var compEntries=[];
    for(var d=new Date(genStart);d<=cycleEnd;d=_nextDay(d)){
      // Peptides can be scheduled by interval too now (an EOD or E3D peptide never
      // fitted a 7-day grid). Default stays 'days', and an empty days[] still means
      // every day, so nothing already saved reschedules.
      if(!_phasedHitsDay(p,d,cycleStart,function(x,dd,cs){return _cadenceHitsDay(x,dd,cs,'days');}))continue;
      if(d<pStart)continue;
      if(pEnd&&d>pEnd)continue;
      var eff=_effectiveDoseAt(p,stack.cycle_start,d);
      var dk=dateKey(d);
      // One entry per selected slot (AM / MID / PM). A single-slot compound still
      // falls back to the flat p.dose/p.unit so legacy items keep generating.
      var sel=TIME_SLOTS.filter(function(t){return times.includes(t);});
      if(!sel.length)sel=['AM'];
      sel.forEach(function(t){
        var k=_slotKey(t);
        var dose=eff?eff.dose:(p['dose_'+k]||p.dose||'');
        var unit=eff?eff.unit:(p['unit_'+k]||'');
        if(dose)compEntries.push({cycle_id:cycleId,date:dk,compound_id:p.id,compound_name:p.name,tier:'peptide',dose:dose,unit:unit,dot:dot,time_of_day:t,active:true,logged:false});
      });
    }
    // AN EMPTY PLAN IS STILL A PLAN — PUSH IT.
    // This used to read `if(compEntries.length)`, so a compound that generates NOTHING
    // in the remaining window produced no batch at all, and POST /injections/batch —
    // the only thing that prunes — was never called for it. The rows written by the
    // PREVIOUS, longer cycle therefore survived untouched.
    //
    // Reported 2026-08-21: "Levels graph isn't redrawn when I shorten the Cycle". It was
    // redrawn; the record had not changed. Nebido every 14 days with the next dose on
    // 29 Aug, cycle shortened to end 24 Aug: zero entries, zero batches, and all four
    // stale doses out to 10 Oct stayed in the record and stayed in the plasma curve.
    //
    // An empty `entries` list is a valid instruction to that endpoint and means exactly
    // what is wanted here: drop this compound's UNLOGGED rows from from_date onwards and
    // write nothing back. Logged doses are preserved by the backend either way — the
    // record of what was administered is never a plan and is never cleared.
    batches.push({compound_id:p.id,from_date:dateKey(genStart),entries:compEntries});
  });

  // ── Testosterone generates here, like everything else (Phase 5) ────────────
  // Henrik, 2026-08-16: "we are dropping the T-calc style scheduling and returning to
  // the compound UI that is much easier to understand for a user."
  //
  // The 2026-08-14 rule made both tiers suppress testosterone so T-Calc could own it.
  // That rule was right about the problem — two tiers each generating the same
  // molecule put 27 enhanced/test_u rows beside 23 trt/nebido rows in one protocol —
  // and wrong about the remedy: it moved ownership to a THIRD scheduler instead of
  // removing the duplication.
  //
  // Phase 4 merged the tiers, so there is no second generator left to contend with,
  // and one-stream-per-molecule is now structural rather than enforced by suppression.
  // T-Calc's write paths are disabled in the same change (_tcWritesDisabled) so it
  // cannot open a second stream from the other side.
  //
  // _injSuppressed stays, emptied per rebuild: nothing suppresses testosterone any
  // more, but a compound that stops generating for some OTHER reason still has to be
  // able to say so. A row that vanishes with no explanation is the bug, not the fix.
  if(typeof _injSuppressed!=='undefined'&&_injSuppressed)_injSuppressed[stack.id||cycleId]=[];

  // Which molecules the TRT block already scheduled, canonically. An unmigrated
  // protocol can hold the same testosterone in both blocks under two spellings —
  // Protocol 2 held enhanced/test_u beside trt/nebido — and generating both is exactly
  // the doubling this rewrite exists to end. Migration fixes the data; this makes the
  // generator safe whether or not the user has run it.
  var _genDone={};

  // TRT compounds
  if(stack.trt&&stack.trt.enabled){
    (stack.trt.compounds||[]).forEach(function(c){
      _genDone[_canonCompoundId(c.id)]=true;
      var cat=(typeof TRT_CAT!=='undefined')?TRT_CAT.find(function(t){return t.id===c.id;}):null;
      var dot=cat?cat.dot:'#e8a020';
      // A RATE IS NOT THE AMOUNT IN THE SYRINGE — in this block too, as of Phase 4.
      // TRT compounds were always configured as a plain per-injection mg, so this
      // branch never had to convert. The merged tier changed that: a compound that
      // arrives here from the Enhanced side carries its rate unit with it, and
      // Henrik's migration moved exactly such a row ("350 mg/week", every 2 days).
      // Written verbatim it would render "Nebido 350 mg/week" on every second day —
      // the rendering the 2026-08-07 fix removed, at 3.5x the real dose. Same helper
      // the Enhanced branch uses; a plain "100 mg" passes through untouched.
      var _tpd=(typeof _enhDosePerInjection==='function')?_enhDosePerInjection(c):{dose:c.dose,unit:c.unit};
      var cStart=c.start_date?new Date(Math.max(parseLocalDate(c.start_date).getTime(),genStart.getTime())):new Date(genStart);
      var cEnd=c.end_date?new Date(Math.min(parseLocalDate(c.end_date).getTime(),cycleEnd.getTime())):new Date(cycleEnd);
      var compEntries=[];
      var _loadDay=_trtLoadFirstDay(c,cycleStart,cycleEnd), _loadMg=parseDec(c.load_mg)||0;
      // ⚠️ THE SAME TRIM THE SOLVER SCORED, FROM THE SAME FUNCTION.
      // A cap of "3 a week" is a cap on 7-day WINDOWS counting doses already in the
      // record, not a quota the plan's own first week gets to spend afresh. Working it
      // out here independently would be two implementations of one rule, which is how
      // the plan and the curve come to disagree; _injCapTrim is the single copy.
      var _capW=parseDec(c.max_inj_week)||0, _allowed=null;
      if(_capW>0&&typeof _injCapTrim==='function'){
        var _cand=[];
        for(var _cd=new Date(cStart);_cd<=cEnd;_cd=_nextDay(_cd))
          if(_phasedHitsDay(c,_cd,cycleStart,_trtHitsDay))_cand.push(new Date(_cd));
        var _taken=[];
        Object.keys(_injectionsCache||{}).forEach(function(dk){
          (_injectionsCache[dk]||[]).forEach(function(e){
            if(!e||!e.logged)return;
            var eid=(typeof _canonCompoundId==='function')?_canonCompoundId(e.compound_id):e.compound_id;
            if(eid!==_canonCompoundId(c.id))return;
            var t=new Date(e.date+'T12:00:00').getTime();
            if(isFinite(t))_taken.push(t);
          });
        });
        _allowed={};
        _injCapTrim(_cand,_taken,_capW).forEach(function(dd){_allowed[dateKey(dd)]=true;});
      }
      for(var d=new Date(cStart);d<=cEnd;d=_nextDay(d)){
        var daysSince=Math.floor((d-cycleStart)/86400000);
        var hit=false;
        // WHICH PATTERN IS A SETTING, NOT A PROPERTY OF THE MOLECULE. This read
        // `c.id!=='nebido' && c.days...`, so Nebido got the interval and every other
        // ester got weekdays with no way to say "every 3 days". _trtCadenceOf keeps
        // that exact reading for saved protocols and lets either be chosen now.
        hit=_phasedHitsDay(c,d,cycleStart,_trtHitsDay);
        if(!hit)continue;
        if(_allowed&&!_allowed[dateKey(d)])continue;   // the cap's window is already full
        // ── DOSE RAMPS APPLY TO TESTOSTERONE TOO (ester transitions) ──────────
        // _effectiveDoseAt had exactly one call site — the peptide branch — so a TRT
        // compound carrying dose_phases generated its FLAT dose and the ramp was
        // silently ignored. That is the mechanism an ester switch needs: while the old
        // ester's tail is still decaying the new one runs low, and it steps up as the
        // tail clears.
        //
        // The phase dose goes back through _enhDosePerInjection because a phase may be
        // written as a RATE ('100 mg/week') just like the flat dose can. Converting the
        // flat dose but not the ramped one would make the ramp silently mean something
        // different from the field above it — the same class of error as the 2026-08-19
        // "100mg every 2 days generated 28mg" report.
        var _eff=(typeof _effectiveDoseAt==='function')?_effectiveDoseAt(c,stack.cycle_start,d):null;
        var _dpd=_eff
          ? ((typeof _enhDosePerInjection==='function')
              ? _enhDosePerInjection(Object.assign({},c,{dose:_eff.dose,unit:_eff.unit}))
              : {dose:_eff.dose,unit:_eff.unit})
          : _tpd;
        // ⚠️ NO DOSE MEANS NO INJECTION.
        // The peptide branch has always guarded this; the TRT branch pushed regardless,
        // so a compound with an empty dose produced real rows carrying ''. That only
        // stayed invisible while every testosterone arrived pre-filled from the
        // catalogue — which is the thing being removed here.
        if(!(parseDec(_dpd.dose)>0))continue;
        // The front-load is added to this dose rather than scheduled beside it: one
        // bigger injection, not two on the same day. Guarded on mg because a loading
        // dose in milligrams has no meaning against an IU or ml dose.
        var _dOut=_dpd.dose;
        if(_loadDay&&_loadMg>0&&dateKey(d)===_loadDay&&(_dpd.unit||'mg')==='mg')
          _dOut=String(Math.round((parseDec(_dpd.dose)+_loadMg)*10)/10);
        compEntries.push({cycle_id:cycleId,date:dateKey(d),compound_id:c.id,compound_name:c.name,tier:'trt',dose:_dOut||'',unit:_dpd.unit||'mg',dot:dot,time_of_day:(c.time==='PM'?'PM':'AM'),active:true,logged:false});
      }
      // Empty batches are pushed too — see the note in the peptide branch above.
      batches.push({compound_id:c.id,from_date:dateKey(cStart),entries:compEntries});
    });
  }

  // Enhanced compounds
  if(stack.enhanced&&stack.enhanced.enabled){
    (stack.enhanced.compounds||[]).forEach(function(c){
      // A testosterone still configured here — an unmigrated protocol — generates too.
      // The tiers are one tier now; what a row is filed under stops deciding whether it
      // exists. Migrating it (Settings ▸ Data ▸ Merge tiers) moves it to the canonical
      // id; until then it schedules under the id it has, and readers canonicalise.
      //
      // Unless the same molecule already generated from the other block, in which case
      // this one is the duplicate and is recorded as suppressed — visibly, with a
      // reason, because a row that stops generating without explanation is the bug.
      var _cid=_canonCompoundId(c.id);
      if(_genDone[_cid]){_noteInjSuppressed(stack,cycleId,c,'duplicate');return;}
      _genDone[_cid]=true;
      var dot=c.dot||'#a855f7';
      var eCat=(typeof ENHANCEMENT_COMPOUNDS!=='undefined')?(ENHANCEMENT_COMPOUNDS||[]).find(function(ec){return ec.id===c.id;}):null;
      var isAmPm=c.amPm||(eCat&&eCat.amPm);
      var baseUnit=c.unit?(c.unit.split('/')[0]):'';
      var compEntries=[];
      for(var d=new Date(genStart);d<=cycleEnd;d=_nextDay(d)){
        if(!_phasedHitsDay(c,d,cycleStart,_enhHitsDay))continue;
        var dk=dateKey(d);
        if(isAmPm){
          _enhTimes(c).forEach(function(t){var k=_slotKey(t);
            if(c['dose_'+k]&&parseDec(c['dose_'+k])!==0)compEntries.push({cycle_id:cycleId,date:dk,compound_id:c.id,compound_name:c.name,tier:'enhanced',dose:c['dose_'+k],unit:baseUnit,dot:dot,time_of_day:t,active:true,logged:false});
          });
        }else{
          var _pd=_enhDosePerInjection(c);
          compEntries.push({cycle_id:cycleId,date:dk,compound_id:c.id,compound_name:c.name,tier:'enhanced',dose:_pd.dose,unit:_pd.unit,dot:dot,time_of_day:null,active:true,logged:false});
        }
      }
      // Empty batches are pushed too — see the note in the peptide branch above.
      batches.push({compound_id:c.id,from_date:dateKey(genStart),entries:compEntries});
    });
  }

  // Stamp a self-contained pharmacology snapshot (ester label + numeric half-life)
  // on every generated injection so a logged shot is a complete historical record
  // (T-History free-T view, future per-compound history). Snapshotted from the
  // catalogue here; readers fall back to the catalogue for older rows that lack it.
  batches.forEach(function(b){b.entries.forEach(function(e){var m=_injPkMeta(e.tier,e.compound_id);e.ester=m.ester;e.half_life_days=m.half_life_days;});});
  return batches;
}

// Resolve {ester, half_life_days} for an injection from the compound catalogues.
// TRT: half-life is the app's canonical PK value (_tcCompInfo), ester parsed from
// the TRT_GUIDE half-life string. Enhanced: half-life parsed from ENHANCEMENT_COMPOUNDS.
// Peptide: half-lives are sub-day / mixed (GHRH+GHRP) — not PK-modelled here → null.
function _injPkMeta(tier,id){
  var ester=null,hl=null;
  try{
    if(tier==='trt'){
      var g=(typeof TRT_GUIDE!=='undefined')?TRT_GUIDE[id]:null;
      if(g&&g.halfLife){
        var m=String(g.halfLife).match(/\(([^)]+)\)/);
        if(m){ester=m[1].replace(/\s*ester\b.*/i,'').trim();if(/\+/.test(ester))ester='blend';}
      }
      if(typeof _tcCompInfo==='function')hl=_tcCompInfo(id).halfLifeDays;
    }else if(tier==='enhanced'){
      var ec=(typeof ENHANCEMENT_COMPOUNDS!=='undefined')?(ENHANCEMENT_COMPOUNDS||[]).find(function(x){return x.id===id;}):null;
      if(ec&&ec.halfLife&&typeof _parseHalfLifeDays==='function')hl=_parseHalfLifeDays(ec.halfLife);
    }
  }catch(e){}
  return {ester:ester,half_life_days:(hl&&isFinite(hl)&&hl>0)?hl:null};
}

// ── SAY SO BEFORE A SAVE REPLACES A DOSE YOU MAY HAVE TAKEN ─────────────────
// Henrik, 2026-09-16, after 19 past PM HGH rows were pruned by a protocol rewrite:
// "Add a warning that saving a new protocol might prune unchecked doses."
//
// Saving regenerates the plan from today, which replaces this protocol's UNCHECKED rows
// from today on. Past rows are safe now (backend #274 — an unticked past dose is not a
// plan), so what is left at risk is the narrow, real case: a dose scheduled for TODAY or
// YESTERDAY that was taken and not ticked yet. The record cannot tell that apart from one
// that was skipped, so a rewrite that drops the compound or the slot takes it with it.
//
// ⚠️ IT DOES NOT WARN ABOUT THE FORWARD PLAN, and that is the whole design. A thirteen
// week protocol has ninety unchecked doses in it by definition — they are the plan, and
// replacing them is what saving MEANS. A dialog announcing that on every save is noise,
// and noise is what gets clicked through. This fires only when something is genuinely
// unrecoverable, which is rare enough to be read.
//
// Yesterday is included because the backend's prune boundary is yesterday, deliberately,
// so a server running ahead of the user's local day cannot treat their current day as
// past. The warning covers exactly what the prune can still reach.
function _injAtRiskOnSave(stack){
  if(!stack||typeof _injectionsCache==='undefined'||!_injectionsCache) return [];
  var cid=_stackCycleId(stack);
  var t0=new Date(NOW); t0.setHours(0,0,0,0);
  var from=dateKey(new Date(t0.getTime()-86400000)), to=dateKey(t0);
  var out=[];
  Object.keys(_injectionsCache).forEach(function(dk){
    if(dk<from||dk>to) return;
    (_injectionsCache[dk]||[]).forEach(function(e){
      if(!e||e.logged) return;
      if((e.cycle_id||'')!==cid) return;
      out.push({date:e.date, name:e.compound_name||e.compound_id, slot:e.time_of_day||''});
    });
  });
  out.sort(function(a,b){ return a.date<b.date?-1:a.date>b.date?1:0; });
  return out;
}
// Returns false only when the user actively declines. Nothing to warn about, or no
// confirm available, proceeds — a save must not be blocked by the absence of a dialog.
function confirmSavePrune(stack){
  var at=_injAtRiskOnSave(stack);
  if(!at.length) return true;
  if(typeof confirm!=='function') return true;
  var t0=dateKey(NOW);
  var lines=at.slice(0,6).map(function(r){
    return '  \u2022 ' + (r.date===t0?'today':r.date) + ' \u2014 ' + r.name
         + (r.slot?(' ('+r.slot+')'):'');
  }).join('\n');
  if(at.length>6) lines+='\n  \u2022 \u2026and '+(at.length-6)+' more';
  return confirm(
    'Saving replaces this protocol\'s unchecked doses from today.\n\n'
    + at.length + ' unchecked dose' + (at.length===1?'':'s') + ' from today or yesterday '
    + 'will be rewritten:\n' + lines + '\n\n'
    + 'If you have already taken any of them, tick them first \u2014 an unchecked dose '
    + 'cannot be told apart from one you skipped, and if the new plan does not schedule '
    + 'it, the record of it is gone.\n\nSave anyway?');
}

async function generateAndPushInjections(stack,fromDate){
  if(!stack||!stack.cycle_start)return;
  var cycleId=_stackCycleId(stack);
  var batches=_genInjBatches(stack,cycleId,fromDate);
  for(var i=0;i<batches.length;i++){
    var b=batches[i];
    await injWriteBatch(cycleId,b.compound_id,b.from_date,b.entries,'genInj');
  }
}

async function generateInjectionsForActiveStacks(fromDate){
  for(var i=0;i<_activeStackIndices.length;i++){
    var si=_activeStackIndices[i];
    var st=_userStacks[si];
    if(st&&st.cycle_start)await generateAndPushInjections(st,fromDate);
  }
}
