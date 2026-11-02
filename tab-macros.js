/* ── MACROS ── */
// Nutrition phase. PERSISTED: it is a user choice, not a per-session default, and
// future features are expected to read it. Written through to the backend on every
// change (localStorage alone is only a cache — see CLAUDE.md), and rehydrated by
// syncPepSettingsFromAgent so it survives a cache wipe or a new device.
var _MACROS_PHASES=['reset','cut','recomp'];
var _macrosPhase=(function(){
  try{
    var v=(typeof getData==='function') ? getData('macros-phase','') : '';
    return (_MACROS_PHASES.indexOf(v)>=0) ? v : 'recomp';
  }catch(e){ return 'recomp'; }
})();
// Single write path for the choice, so the macros tab and the wizard step cannot
// diverge on how it is stored.
function setMacrosPhase(p){
  if(_MACROS_PHASES.indexOf(p)<0) return _macrosPhase;
  _macrosPhase=p;
  if(typeof setData==='function') setData('macros-phase',p);
  if(typeof pushPepSettingsToAgent==='function') pushPepSettingsToAgent({'macros-phase':p});
  return _macrosPhase;
}
// The day's kcal and protein targets as last rendered, read by the food log (in index.html)
// so what you have eaten is shown against the same numbers this tab shows.
var _macrosTargets=null;
var _macrosTrainKcal=0;   // measured training burn, kcal/day averaged over the last 14 days (from /training-energy)
function loadMacros(){
  var bw=parseDec(localStorage.getItem('user_weight'))||0;
  renderMacros(bw,_macrosOnAndrogens());
  syncMacrosTrainEnergy(function(){ if(_currentTab==='macros'){ var bw2=parseDec(localStorage.getItem('user_weight'))||0; renderMacros(bw2,_macrosOnAndrogens()); } });
}
function switchMacrosPhase(p){setMacrosPhase(p);loadMacros();}
// Pull the user's measured training burn from the shared backend (their OWN workout
// logs, user-scoped server-side). Shown SEPARATELY for awareness — deliberately NOT
// added to the calorie target. The 14-day per-calendar-day average is the steady figure.
function syncMacrosTrainEnergy(cb){
  if(typeof AGENT_URL==='undefined'){ if(cb)cb(); return; }
  var bw=parseDec(localStorage.getItem('user_weight'))||0;
  var hc=parseDec(localStorage.getItem('user_height'))||0;
  var qs='?days=14'+(bw?'&bodyweight_kg='+bw:'')+(hc?'&height_cm='+hc:'');
  fetch(AGENT_URL+'/training-energy'+qs,{headers:authHeaders()})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ _macrosTrainKcal=(d&&isFinite(d.avg_per_calendar_day))?d.avg_per_calendar_day:0; if(cb)cb(); })
    .catch(function(){ if(cb)cb(); });
}
// ── ENERGY MODEL ─────────────────────────────────────────────────────────────
// Replaces `bodyweight × 31`, which appeared in NO source — not here, not in the
// backend docs that cite every other number on this screen (Helms 2014, Morton 2018,
// Whittaker 2021, Ainsworth 2011). It was the largest figure the user sees and the
// only one nobody had justified; against Bhasin 1996's standardised maintenance diet
// of 36 kcal/kg it ran ~14% low before the phase deficit was even applied.
// Henrik, 2026-09-09: "As scientific correct as possible, age should be a part of this."
//
// BMR, in preference order:
//   Katch-McArdle   370 + 21.6 × FFM        — when body fat % is on file. Lean-mass
//     equations outperform weight-based ones in low-body-fat athletic populations,
//     and a measured FFM already carries the age-related lean-mass loss that a
//     population age term stands in for.
//   Mifflin-St Jeor 10W + 6.25H − 5A + s    — the Academy of Nutrition and Dietetics
//     clinical default, explicitly age-dependent (−5 kcal per year of age).
//   Neither → NO NUMBER. The caller is told what to fill in. Inventing a constant to
//     cover missing profile data is exactly how 31 kcal/kg got here.
// The user's profile as the energy model needs it. Read once, in one place, so the
// Macros tab and the protocol wizard cannot compute different targets.
function _macrosProfile(){
  var bf=0;
  try{ if(typeof _latestBodyFat==='function'){ var v=_latestBodyFat(); if(v>0) bf=v; } }catch(e){}
  return {
    bw:       parseDec(localStorage.getItem('user_weight'))||0,
    heightCm: parseDec(localStorage.getItem('user_height'))||0,
    age:      parseInt(localStorage.getItem('user_age'),10)||0,
    sex:      ((localStorage.getItem('user_sex')||'male').toLowerCase()==='female')?'female':'male',
    bodyFatPct: bf
  };
}

// Whether measured training energy is added to the calorie target. Henrik, 2026-09-09:
// "Yes but make it visible so user can choose to ignore" — so it is ON by default and
// carries a visible toggle. It used to be excluded silently, which made the real deficit
// on a training day 300 + the burn rather than the 300 the code intended.
// ── THE PHASE OFFSET IS NOT A CHOICE (2026-10-22) ───────────────────────────
// Henrik: "Both apps always use the % based on actual research". The backend sizes it:
// a cut loses 0.7% of bodyweight a week (Helms 2014, Garthe 2011), recomp sits at
// maintenance (Helms 2023). The Fixed kcal / % of maintenance picker is gone.
function _macrosIncludeTraining(){
  try{ return localStorage.getItem('macros-include-training')!=='false'; }catch(e){ return true; }
}
function setMacrosIncludeTraining(v){
  var on=!!v;
  if(typeof setData==='function') setData('macros-include-training',on);
  if(typeof pushPepSettingsToAgent==='function') pushPepSettingsToAgent({'macros-include-training':on});
  if(typeof loadMacros==='function') loadMacros();
  return on;
}

// ── THE MODEL LIVES IN THE BACKEND (2026-10-21) ─────────────────────────────
// Henrik: move it so Peptide Tracker and Workout read ONE model ("1. Yes"). It was
// calcMacros here; it is now GET /macro-targets in claude-agent-backend
// (routers/macro_targets.py), a line-for-line port proven identical on 2160 inputs.
// Every constant, citation and rule that used to sit above this line is there.
// This file only gathers the inputs, asks, caches the answer and draws it.
var _macrosServed={};     // query → served targets
var _macrosWaiting={};    // query → callbacks waiting on that fetch
var _macrosFailed={};     // query → true when the last fetch failed
function _macrosQuery(phase,onAndrogens){
  var p=_macrosProfile();
  return 'bw='+p.bw+'&phase='+encodeURIComponent(phase)+'&on_androgens='+(!!onAndrogens)
    +'&height_cm='+p.heightCm+'&age='+p.age+'&sex='+p.sex+'&body_fat_pct='+p.bodyFatPct
    +'&train_kcal='+Math.max(0,Math.round(_macrosTrainKcal||0))+'&include_training='+_macrosIncludeTraining();
}
// The targets for the stored profile, or null while they are being fetched. onReady
// runs once they arrive (or the fetch fails, so the caller can say so).
// A request that never answers must not leave the tab on "Calculating" for ever
// (2026-11-02: the backend restarted 8 times in an hour, one machine, and a request
// caught in a restart hung until the app was closed). After MACROS_FETCH_MS it counts
// as failed, so the tab says so and offers Try again.
var MACROS_FETCH_MS=15000;
function _macrosFetchWithin(url,ms){
  var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
  var tid=null;
  var late=new Promise(function(_,rej){ tid=setTimeout(function(){ try{if(ctrl)ctrl.abort();}catch(e){} rej(new Error('timeout')); },ms); });
  var req=fetch(url,ctrl?{signal:ctrl.signal}:undefined);
  return Promise.race([req,late]).then(function(r){ clearTimeout(tid); return r; },function(e){ clearTimeout(tid); throw e; });
}
function macrosForUser(phase,onAndrogens,onReady){
  var q=_macrosQuery(phase,onAndrogens);
  if(_macrosServed[q]) return _macrosServed[q];
  // A failed fetch stays failed until the user asks again (Try again clears it): the
  // re-render that reports the failure must not quietly start the next request.
  if(_macrosFailed[q]) return null;
  if(onReady)(_macrosWaiting[q]=_macrosWaiting[q]||[]).push(onReady);
  if(_macrosWaiting[q]&&_macrosWaiting[q]._inflight) return null;
  (_macrosWaiting[q]=_macrosWaiting[q]||[])._inflight=true;
  _macrosFetchWithin(AGENT_URL+'/macro-targets?'+q,MACROS_FETCH_MS)
    .then(function(r){ return r.ok?r.json():null; })
    .catch(function(){ return null; })
    .then(function(d){
      var cbs=_macrosWaiting[q]||[]; delete _macrosWaiting[q];
      if(d) _macrosServed[q]=d; else _macrosFailed[q]=true;
      cbs.forEach(function(cb){ try{cb(d);}catch(e){} });
    });
  return null;
}
function macrosFetchFailed(phase,onAndrogens){ return !!_macrosFailed[_macrosQuery(phase,onAndrogens)]; }
// What renderMacros and the wizard show while the targets are on their way, or when
// the backend could not be reached. Never a locally invented number in their place.
function _macrosPendingHtml(failed,retry){
  return '<div style="padding:30px 20px;text-align:center;color:var(--muted2);font-size:13px;line-height:1.6">'
    +(failed?'Could not load your targets. Check your connection.<div style="margin-top:10px"><button class="btn" onclick="_macrosFailed={};'+retry+'">Try again</button></div>'
            :'Calculating your targets\u2026')+'</div>';
}
// A standalone card showing the estimated training burn from logged workouts. It is
// presented separately and explicitly NOT added to the calorie target above.
function _macrosBurnCard(m){
  var t=Math.max(0,Math.round((m&&m.trainKcal)||_macrosTrainKcal||0));
  var on=_macrosIncludeTraining();
  var note=(t>0)
    ? (on
      ? 'Estimated from your logged workouts (training volume × range-of-motion, placed in the resistance-training MET band — Ainsworth 2011). <b>Added to the calorie target above.</b> Untick to hold the target at non-training expenditure only.'
      : 'Estimated from your logged workouts (Ainsworth 2011). <b>Not added</b> to the calorie target — so on a training day you are eating this much further below expenditure than the phase deficit alone.')
    : 'Log your workouts in the workout tracker to see your estimated training burn here.';
  return '<div class="card"><div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--accent2)"></div><div class="card-title">TRAINING BURN</div></div><span style="font-size:11px;color:var(--muted2)">14-day avg</span></div>'
    +'<div style="padding:16px 6px;text-align:center"><div style="font-family:var(--font-mono);font-size:26px;line-height:1;color:var(--accent2)">'+(t>0?('+'+t):'\u2014')+'</div><div style="font-size:9px;color:var(--muted2);text-transform:uppercase;letter-spacing:0.5px;margin-top:3px">kcal / day</div></div>'
    +'<div class="card-body">'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--text);cursor:pointer;user-select:none;margin-bottom:8px">'
    +'<input type="checkbox" '+(on?'checked':'')+' onchange="setMacrosIncludeTraining(this.checked)" style="accent-color:var(--accent2);width:15px;height:15px;cursor:pointer;margin:0"> Count training in my calorie target</label>'
    +'<div style="font-size:11px;color:var(--muted2);line-height:1.6">'+note+'</div></div></div>';
}
// How the calorie number was reached, shown rather than asserted. The old target was
// bodyweight × 31 with no source and no working; this card is the working.
function _macrosEnergyCard(m){
  if(!m||m.kcal==null){
    return '<div class="card"><div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--accent)"></div><div class="card-title">ENERGY</div></div></div>'
      +'<div class="card-body"><div style="font-size:12px;color:var(--muted2);line-height:1.6">'
      +'No calorie target yet — it needs <b>'+(m?m.missing.join(' '):'your body weight')+'</b>. '
      +'Add a body-fat reading in the <b>Body</b> tab (most accurate for a trained build), or your height and age. '
      +'Nothing is guessed here: a made-up constant is what this replaced.</div></div></div>';
  }
  var how=m.bmrMethod==='katch'
    ? 'BMR from <b>Katch-McArdle</b> (370 + 21.6 × fat-free mass) — the lean-mass equation, which outperforms weight-based ones at low body fat, and reads your age through your measured FFM rather than a population average.'
    : 'BMR from <b>Mifflin-St Jeor</b> (10W + 6.25H \u2212 5\u00d7age + 5) — the Academy of Nutrition and Dietetics clinical default, and directly age-adjusted at \u22125 kcal per year. Add a body-fat reading in the <b>Body</b> tab and this switches to the more accurate lean-mass equation.';
  var rows=[['BMR',m.bmr+' kcal'],
            ['\u00d7 PAL '+m.constants.pal.toFixed(2)+' (non-training)',Math.round(m.bmr*m.constants.pal)+' kcal'],
            ['Training (14-day avg)',(m.includeTraining?'+':'excl. ')+m.trainKcal+' kcal'],
            ['Maintenance',m.tdee+' kcal'],
            ['Phase ('+_macrosPhase+(_macrosPhase==='cut'?', lose '+m.constants.cutPctBwPerWeek+'% of bodyweight/wk':'')+')',(m.phaseOffset>=0?'+':'')+m.phaseOffset+' kcal']];
  var h='<div class="card"><div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--accent)"></div><div class="card-title">ENERGY</div></div><span style="font-size:11px;color:var(--muted2)">'+(m.bmrMethod==='katch'?'Katch-McArdle':'Mifflin-St Jeor')+'</span></div><div class="card-body">';
  rows.forEach(function(r){ h+='<div class="info-row"><span class="info-label">'+r[0]+'</span><span class="info-val">'+r[1]+'</span></div>'; });
  h+='<div class="info-row" style="font-weight:800"><span class="info-label" style="color:var(--text)">Target</span><span class="info-val" style="color:var(--accent)">'+m.kcal+' kcal</span></div>';
  // A deficit only means something as a RATE — this is the number the choice of mode
  // is actually about, so it is shown next to the target rather than left implicit.
  if(m.rate){
    var _dir=m.rate.kgPerMonth<0?'loss':'gain';
    var _rc=m.rate.tooFast?'var(--accent4)':'var(--muted2)';
    h+='<div class="info-row"><span class="info-label">Expected rate</span><span class="info-val" style="color:'+_rc+'">'
      +Math.abs(m.rate.kgPerMonth).toFixed(2)+' kg/month '+_dir+' \u00b7 '+m.rate.pctBwPerWeek.toFixed(2)+'%/wk</span></div>';
    h+='<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:4px">At 7700 kcal per kg of fat, estimated at your current weight \u2014 maintenance falls as you do, so the real rate tapers.'
      +(m.rate.tooFast?' <b>Above 1%/week</b>, which is where lean tissue starts going with the fat (Helms 2014 puts the preserving band at 0.5\u20131%/wk).':'')+'</div>';
  }
  if(_macrosPhase==='cut'||_macrosPhase==='recomp')
    h+='<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:7px">'
      +(_macrosPhase==='cut'
        ?'The cut is sized to lose <b>'+m.constants.cutPctBwPerWeek+'% of bodyweight a week</b>: Helms 2014 puts the muscle-preserving band at 0.5\u20131%/wk, and in Garthe 2011 athletes losing 0.7%/wk gained lean mass while those losing 1.4%/wk did not.'
        :'Recomp eats at <b>maintenance</b>: in Helms 2023, trained lifters on a 5% surplus gained no more muscle than at maintenance, only more fat.')+'</div>';
  h+='<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:8px">'+how+' PAL 1.40 is the bottom of FAO/WHO/UNU\u2019s sedentary/light-activity band \u2014 the bottom because measured training is added separately.</div>';
  if(m.ea){
    var col=m.ea.tier==='low'?'var(--danger,#ff3c3c)':m.ea.tier==='suboptimal'?'var(--accent4)':'var(--accent3)';
    var lbl=m.ea.tier==='low'?'LOW':m.ea.tier==='suboptimal'?'SUBOPTIMAL':'ADEQUATE';
    h+='<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
    h+='<div class="info-row"><span class="info-label">Energy availability</span><span class="info-val" style="color:'+col+'">'+m.ea.value.toFixed(0)+' kcal/kg FFM \u00b7 '+lbl+'</span></div>';
    h+='<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:4px">(intake \u2212 training) \u00f7 fat-free mass. Above 45 supports gaining; 30\u201345 is suboptimal and at-risk; 30 or below is low energy availability, where lean mass and endocrine function start paying for it.'
      +(m.ea.tier!=='adequate'?' <b>Fine for a short controlled cut \u2014 not a place to sit through a long push.</b>':'')+'</div></div>';
  }
  h+='</div></div>';
  return h;
}
// True when the user's active stack(s) include any injected androgen (TRT or Enhanced),
// which lowers the dietary-fat floor (see /macro-targets). Read-only over the active stacks.
function _macrosOnAndrogens(){
  try{
    var idxs=(typeof _activeStackIndices!=='undefined'&&_activeStackIndices&&_activeStackIndices.length)?_activeStackIndices:[];
    for(var i=0;i<idxs.length;i++){var s=(typeof _userStacks!=='undefined')?_userStacks[idxs[i]]:null;if(!s)continue;
      if(s.trt&&s.trt.enabled&&s.trt.compounds&&s.trt.compounds.length)return true;
      if(s.enhanced&&s.enhanced.compounds&&s.enhanced.compounds.length)return true;}
  }catch(e){}
  return false;
}
// Evidence-backed macro note; branches on the cut/deficit phase (protein) and on
// whether injected androgens are present (fat).
function _macrosFatNote(onAndrogens,phase,m){
  var protein=phase==='cut'
    ? 'Protein <b>2.5 g/kg</b> — raised for the cut: in a caloric deficit, lean trained athletes need more protein to preserve muscle (2.3–3.1 g/kg fat-free mass, Helms 2014).'
    : 'Protein 2.2 g/kg — upper end of the evidence-based range for muscle retention (Morton 2018).';
  // The age finding is real but it lives in DISTRIBUTION, not in the daily total: older
  // muscle needs a bigger per-meal dose to be maximally stimulated, and the daily target
  // already clears that at any age. So say where it actually applies.
  if(m&&m.perMealProteinPerKg>0){
    protein+=' Spread it: at your age a meal needs at least <b>'+m.perMealProteinPerKg.toFixed(2)
      +' g/kg</b> to maximally stimulate muscle protein synthesis (0.24 g/kg young rising to 0.40 g/kg by ~70 — anabolic resistance, Moore 2015).'
      +(m.proteinFloorBound?' That floor is what set your target here.':'');
  }
  return onAndrogens
    ? protein+' <b>Fat set lower</b> (~0.5–0.6 g/kg): on injected hormones the main reason to keep fat high — protecting your own testosterone — no longer applies (low-fat diets cut endogenous T ~10–15%, Whittaker 2021; your testes are already suppressed on-cycle). Kept at an essential-fat floor for fatty acids and satiety; carbs take the freed calories around training.'
    : protein+' Keep fat ~0.9 g/kg (≈25–30% kcal) to protect endogenous testosterone (low-fat diets cut it ~10–15%, Whittaker 2021). Adjust carbs and fat around training windows, not randomly.';
}
function saveMacrosTrainTime(val){localStorage.setItem('macros-train-time',val);pushPepSettingsToAgent({'macros-train-time':val});loadMacros();}
function saveMacrosTrainDur(val){localStorage.setItem('macros-train-dur',String(val));pushPepSettingsToAgent({'macros-train-dur':val});loadMacros();}
function renderMacros(bw,onAndrogens){
  var body=document.getElementById('macros-body');if(!body)return;
  _macrosTargets=null;
  if(!bw){body.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--muted2)"><div style="font-size:32px;margin-bottom:12px">⚖️</div><div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">Set your body weight</div><div style="font-size:13px;line-height:1.5">Log your weight in the <b>Weights</b> tab so macros can be calculated for you.</div></div>';return;}
  var m=macrosForUser(_macrosPhase,onAndrogens,function(){ if(_currentTab==='macros') renderMacros(bw,onAndrogens); });
  if(!m){ body.innerHTML=_macrosPendingHtml(macrosFetchFailed(_macrosPhase,onAndrogens),'loadMacros()'); return; }
  _macrosTargets={kcal:m.kcal,protein:m.protein,carbs:m.carbs,fat:m.fat};
  var phases=[{id:'reset',label:'Reset',color:'var(--accent4)'},{id:'cut',label:'Cut',color:'var(--accent2)'},{id:'recomp',label:'Recomp',color:'var(--accent3)'}];
  var trainTime=localStorage.getItem('macros-train-time')||'17:00';
  var trainDur=parseInt(localStorage.getItem('macros-train-dur'))||60;
  var h='<div style="display:flex;flex-direction:column;gap:14px">';
  h+='<div style="padding:0 20px"><div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:10px">Phase</div>';
  h+='<div style="display:flex;gap:6px">';
  phases.forEach(function(p){var sel=_macrosPhase===p.id;h+='<button onclick="switchMacrosPhase(\''+p.id+'\')" style="flex:1;background:'+(sel?p.color:'var(--surface2)')+';color:'+(sel?'#000':'var(--muted2)')+';border:1px solid '+(sel?p.color:'var(--border)')+';border-radius:20px;padding:8px 4px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">'+p.label+'</button>';});
  h+='</div></div>';
  var ctx=_macrosPhase==='reset'?'Start at or slightly below maintenance for 1-3 weeks. Let metabolism stabilise — energy, digestion, sleep all improve before cutting. Do not rush into a deficit.':_macrosPhase==='cut'?'Controlled deficit after metabolic reset. Increase NEAT (steps to 12-15k) and add 20-30 min cardio post-workout. Maintain protein; adjust carbs and fat around training.':'Maintenance calories with compound support for nutrient partitioning. Assess weekly — most gains happen at lower intake than expected on cycle. Do NOT chase size; chase the dry vascular look.';
  h+='<div style="margin:0 20px;background:rgba(60,255,160,0.07);border-radius:10px;padding:12px 14px;border-left:3px solid var(--accent3);font-size:12px;color:var(--muted2);line-height:1.6">'+ctx+'</div>';
  h+='<div class="card">';
  h+='<div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--accent)"></div><div class="card-title">DAILY TARGETS</div></div><span style="font-size:11px;color:var(--muted2)">'+bw+' kg</span></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr)">';
  var _dash='\u2014';
  var mi=[{l:'Calories',v:(m.kcal==null?_dash:m.kcal),u:'kcal',c:'var(--accent)'},{l:'Protein',v:m.protein,u:'g',c:'var(--accent3)'},{l:'Carbs',v:(m.carbs==null?_dash:m.carbs),u:'g',c:'var(--accent2)'},{l:'Fat',v:m.fat,u:'g',c:'var(--accent4)'}];
  mi.forEach(function(x,i){h+='<div style="padding:16px 6px;text-align:center'+(i<3?';border-right:1px solid var(--border)':'')+'">';h+='<div style="font-family:var(--font-mono);font-size:26px;line-height:1;color:'+x.c+'">'+x.v+'</div>';h+='<div style="font-size:9px;color:var(--muted2);text-transform:uppercase;letter-spacing:0.5px;margin-top:3px">'+x.u+'</div>';h+='<div style="font-size:9px;color:var(--muted2)">'+x.l+'</div></div>';});
  h+='</div><div class="card-body"><div style="font-size:11px;color:var(--muted2);line-height:1.5">'+_macrosFatNote(onAndrogens,_macrosPhase,m)+'</div></div></div>';
  h+=_macrosEnergyCard(m);
  h+=_macrosBurnCard(m);
  h+='<div class="card"><div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--accent2)"></div><div class="card-title">MEAL TIMING</div></div></div>';
  h+='<div class="card-body" style="gap:12px">';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  h+='<div style="display:grid;gap:4px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px">Start time</label>';
  h+='<input id="macros-train-time" type="time" value="'+trainTime+'" onchange="saveMacrosTrainTime(this.value)" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:14px;font-family:inherit;outline:none;width:100%"></div>';
  h+='<div style="display:grid;gap:4px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px">Duration</label>';
  h+='<div style="display:flex;gap:5px">';
  [45,60,75,90].forEach(function(d){var sel=trainDur===d;h+='<button onclick="saveMacrosTrainDur('+d+')" style="flex:1;background:'+(sel?'var(--accent2)':'var(--surface2)')+';color:'+(sel?'#000':'var(--muted2)')+';border:1px solid '+(sel?'var(--accent2)':'var(--border)')+';border-radius:8px;padding:8px 2px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">'+d+'m</button>';});
  h+='</div></div>';
  h+='</div>';
  var tp=trainTime.split(':');var tH=parseInt(tp[0])||17;var tM=parseInt(tp[1])||0;
  var endMins=(tH*60+tM+trainDur)%1440;var eH=Math.floor(endMins/60);var eM=endMins%60;
  function ofT(h2,m2,dH,dM){var t=(h2*60+m2+dH*60+dM+1440)%1440;var th=Math.floor(t/60);var tm=t%60;return(th<10?'0':'')+th+':'+(tm<10?'0':'')+tm;}
  var slots=[
    {t:ofT(tH,tM,-1,-30),icon:'&#x26A1;',label:'Pre-training',macro:'Fast carbs + light protein',detail:'Rice cakes, OJ, banana. Prime glycogen; do not eat heavy fat.',col:'var(--accent2)'},
    {t:ofT(tH,tM,0,0),t2:ofT(eH,eM,0,0),icon:'&#x1F3CB;',label:'Training window',macro:'Optional fast carbs only if session &gt;75 min',detail:'Dextrose / Gatorade. Skip if short session.',col:'var(--accent)'},
    {t:ofT(eH,eM,0,0),icon:'&#x1F504;',label:'Post-training',macro:'Protein + fast carbs ASAP',detail:'Shake + fruit / white rice. Do not delay this window.',col:'var(--accent3)'},
    {t:ofT(eH,eM,4,0),icon:'&#x1F319;',label:'Pre-sleep',macro:'Slow protein + complex carbs',detail:'Cottage cheese / casein + oats. Sustains GH pulse, prevents catabolism.',col:'var(--accent4)'}
  ];
  slots.forEach(function(s){
    h+='<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)">';
    h+='<div style="font-size:20px;line-height:1;padding-top:2px;min-width:24px;text-align:center">'+s.icon+'</div>';
    h+='<div style="flex:1"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px"><span style="font-size:13px;font-weight:700;color:var(--text)">'+s.label+'</span><span style="font-size:12px;color:'+s.col+';font-weight:700">'+(s.t2?s.t+' – '+s.t2:s.t)+'</span></div>';
    h+='<div style="font-size:12px;color:var(--text);margin-bottom:2px">'+s.macro+'</div>';
    h+='<div style="font-size:11px;color:var(--muted2)">'+s.detail+'</div></div></div>';
  });
  h+='</div></div>';
  h+='<div class="card"><div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--muted)"></div><div class="card-title">FOOD QUALITY</div></div><span class="card-badge badge-today">80/20</span></div>';
  h+='<div class="card-body"><div class="info-row"><span class="info-label">80% whole foods</span><span class="info-val" style="color:var(--accent3)">Required</span></div>';
  h+='<div style="font-size:11px;color:var(--muted2);margin-top:4px;line-height:1.5;margin-bottom:12px">Egg whites, chicken, turkey, sirloin, salmon, rice, potatoes, fruit, veg, avocado. Single-ingredient foods = insulin sensitivity = better nutrient partitioning.</div>';
  h+='<div class="info-row"><span class="info-label">20% flexible</span><span class="info-val" style="color:var(--muted2)">Lifestyle foods</span></div>';
  h+='<div style="font-size:11px;color:var(--muted2);margin-top:4px;line-height:1.5">Offset minutia, promote adherence, prevent the comp-prep mentality spiral.</div>';
  h+='</div></div>';
  h+='</div>';
  body.innerHTML=h;
  if(typeof _flRender==='function')_flRender();
}
