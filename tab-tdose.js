/* ── DOSE FINDER ───────────────────────────────────────────────────────────
 * "What weekly dose of ester X holds free T at Y?" — and then, below it, what
 * the catalogue recommends for the compounds a user reaches for next.
 *
 * ⚠️ THIS TAB INVERTS THE MODEL. IT DOES NOT INVENT ONE. ⚠️
 * Every candidate schedule is scored by _tcSolveSeries, which is _tcFreeTSeries
 * — the same function that draws the T-Calc curve, calibrated from the user's
 * own bloodwork. There is no second pharmacology here and there must never be:
 * a dose finder that disagreed with the plotted curve would be telling the user
 * two different things about the same protocol. Same rule as tcSolveTransition,
 * for the same reason.
 *
 * ⚠️ AND IT INVENTS NO DOSES FOR THE COMPOUNDS BELOW. ⚠️
 * The advanced-compound half renders ENHANCEMENT_COMPOUNDS — the backend's
 * catalogue, with its own dose tiers, evidence grades, citations and risk
 * lines — through _renderEnhancedGuide, the SAME renderer the Protocols tab
 * uses. Nothing here decides a milligram. If a number looks wrong, it is wrong
 * in /compounds/catalog and that is where it gets fixed, once, for both
 * surfaces.
 *
 * It solves for the SCHEDULE, never for the TARGET. The user chooses the level;
 * above the healthy young-male ceiling the app says that is unmeasured
 * territory (_FT_REF.above_ceiling_note) and still computes what was asked.
 */

// Where the solve starts from, and what the user last asked for. Persisted so
// reopening the tab does not throw away a target that took thought to choose.
var _tdState = null;
var _tdResult = null;          // last solve output, or {ok:false,...}
var _tdSolving = false;
var _tdOpenComp = {};          // compound id -> guide expanded

function _tdDefaults(){
  return {
    targetPmol:  '',
    esterId:     'enanthate',
    cadenceKey:  '2xwk',
    concMgPerMl: 250,
    stepMl:      _TD_STEP_ML_DEFAULT,
    showOrals:   true,
    showInj:     true
  };
}
// Same syringe granularity the transition solver uses, and for the same reason:
// 0.05 ml is five units on a 100-unit barrel, and at 250 mg/ml the difference
// between 0.1 and 0.05 ml steps is the difference between a dose that sits flat
// and one that tracks. Read from T-Calc's constant where it is loaded so the two
// surfaces cannot drift apart.
var _TD_STEP_ML_DEFAULT = (typeof _TC_SOLVE_STEP_ML !== 'undefined') ? _TC_SOLVE_STEP_ML : 0.05;

function _tdGet(){
  if(!_tdState){
    var saved = (typeof getData==='function') ? getData('pep-tdose', null) : null;
    _tdState = Object.assign(_tdDefaults(), saved||{});
  }
  return _tdState;
}

// ── WHAT THE TARGET FIELD STARTS AT ─────────────────────────────────────────
// ⚠️ A PREFILLED TARGET IS DESCRIPTIVE, NEVER A RECOMMENDATION.
// The app has no opinion on what level anyone should hold, and a number sitting
// in the box on first open would be read as one. So it is seeded only from where
// the user ALREADY IS, and the UI names the source next to it:
//
//   1. the free T the ACTIVE PROTOCOL holds at steady state
//   2. failing that, the most recent MEASURED free T from bloodwork
//   3. failing that, blank — better an empty field than an invented figure
//
// Seeding from a reference range instead was considered and rejected: "the top
// of the healthy young-male range" is exactly the number that becomes a goal
// because it was pre-typed, and choosing the level is the user's half of this
// tool. Only ever fills an EMPTY field — a target the user typed is theirs.
//
// ⚠️ COMPUTED HERE, NOT READ OFF THE CHART.
// The obvious source is _tcSsPeakPmol, and it is the wrong one twice over: it is
// the PEAK rather than the level held, and it is a side effect of T-Calc having
// rendered — so it is null until that tab is opened and the seed silently
// changes depending on where the user has been. _tcCurveLog() is the injection
// list the curve is built from (logged past + the active protocol's plan,
// de-duplicated), so running it through the same _tcSolveSeries the solve uses
// gives the level this protocol actually holds, from anywhere, every time.
function _tdActiveProtocolLevel(){
  if(typeof _tcCurveLog!=='function' || typeof _tcSolveSeries!=='function') return 0;
  var log = _tcCurveLog();
  if(!log || !log.length) return 0;
  var ser = _tcSolveSeries(log);
  if(!ser) return 0;
  // The plateau, measured over the last DOSING week — never the washout tail the
  // series appends, for the same reason the solve never measures there.
  var lastMs = 0;
  log.forEach(function(e){
    var t = new Date(e.date+'T12:00:00').getTime();
    if(isFinite(t) && t>lastMs) lastMs = t;
  });
  if(!lastMs) return 0;
  var st = _tcSolveWindowStats(ser, lastMs-7*86400000, lastMs);
  return (st && st.mean>0) ? st.mean : 0;
}
function _tdDefaultTarget(){
  var lvl = _tdActiveProtocolLevel();
  if(lvl>0) return {value:Math.round(lvl),
                    source:'the level your active protocol holds'};
  var cal = _tdCalibration();
  if(cal.ok && parseDec(cal.free_t)>0)
    return {value:Math.round(parseDec(cal.free_t)),
            source:'your last measured free T ('+cal.date+')'};
  return {value:'', source:''};
}
function _tdSave(){
  if(typeof setData==='function') setData('pep-tdose', _tdGet());
}
function _tdSet(k,v){
  var s=_tdGet(); s[k]=v; _tdSave();
  // A changed input invalidates the answer. Showing a dose solved for a
  // different ester next to a newly-picked one is the kind of stale reading
  // that gets acted on.
  if(k!=='showOrals'&&k!=='showInj') _tdResult=null;
  buildTDose();
}

// ── THE SOLVE ───────────────────────────────────────────────────────────────
// Steady state, not a ramp. tcSolveTransition answers "how do I get from the
// ester I am on to a target without a trough" — a scheduling problem with an
// outgoing tail. This answers the simpler standing question: once everything has
// settled, what weekly dose HOLDS the level?
//
// ⚠️ MEASURED OVER THE LAST DOSING WEEK, NEVER THE WASHOUT TAIL.
// _tcFreeTSeries extends the series past the final injection by ~4.3 half-lives
// so the tail can decay. Averaging over the whole span therefore reports the
// decay, not the plateau — the exact error that once printed "309 pmol/L, within
// the healthy young-male range" for a protocol whose real plateau was ~1090.
// The window is the seven days ENDING at the last injection.
//
// ⚠️ CANDIDATES MUST START STRICTLY AFTER THE LAST LOGGED DOSE.
// TT_base is solved as TT_at_draw * P / total[anchorDay]. A candidate landing on
// or before the anchor moves total[anchorDay], TT_base moves inversely, the two
// cancel, and the curve comes back pinned to the measurement whatever dose was
// proposed — the solver converges on nonsense and looks confident doing it.
function _tdSolveWeekly(opts){
  opts = opts||{};
  var target = parseDec(opts.targetPmol);
  if(!(target>0)) return {ok:false, reason:'no-target'};
  var cd = _tcCompInfo(opts.esterId);
  if(!cd) return {ok:false, reason:'no-ester'};
  var cad = opts.cadence;
  if(!cad) return {ok:false, reason:'no-cadence'};

  var hist  = (opts.history||[]).slice();
  var start = opts.startDate;

  // ── HOW FAR OUT THE PLATEAU IS MEASURED ────────────────────────────────────
  // Long enough for the candidate ester to settle: five half-lives is 97% of the
  // way there, so enanthate needs ~3 weeks and the 12-week floor covers it.
  var hl = cd.halfLifeDaysHigh || cd.halfLifeDays || 1;
  var candWeeks = Math.ceil(5*hl/7);

  // ⚠️ AND LONG ENOUGH FOR WHAT IS ALREADY ON BOARD TO HAVE GONE.
  // The history is here to CALIBRATE the curve — TT_base is solved against the
  // measurement, which needs the doses around it — but its drug does not stop at
  // the calibration. It keeps releasing, and if the plateau is read while a long
  // depot is still clearing, that residue is scored as if the candidate schedule
  // produced it. The tool then under-prescribes by exactly the leftover.
  //
  // Measured on the reported case (2026-09-08): ~362 mg/week of Nebido logged
  // through 7 Sep, then "what holds 1457 pmol/L on enanthate?". At a 12-week
  // window the Nebido tail alone was still worth 439 pmol/L, so 100 mg/week
  // scored 1173 instead of its true 594 — the answer came back at roughly a
  // third of the dose actually required, and it would have read correctly for a
  // few months and then fallen away as the depot cleared.
  //
  // Nebido's half-life is 56 days, so five of them is 40 weeks. That is a long
  // window, and it is the honest one: it is how long "what does this dose hold"
  // genuinely takes to become a question about this dose alone.
  var histWeeks = 0;
  if(hist.length){
    var maxHl = 0, lastHist = '';
    hist.forEach(function(e){
      var ci = _tcCompInfo(e.compId) || {};
      var h  = (ci.halfLifeDaysHigh || ci.halfLifeDays) || 1;
      if(h > maxHl) maxHl = h;
      if((e.date||'') > lastHist) lastHist = e.date;
    });
    // Time already elapsed between the last logged dose and the plan's start
    // counts towards that washout — it has been decaying since.
    var gapDays = 0;
    if(lastHist){
      gapDays = (new Date(start+'T12:00:00') - new Date(lastHist+'T12:00:00'))/86400000;
      if(!(gapDays > 0)) gapDays = 0;
    }
    histWeeks = Math.ceil(Math.max(0, 5*maxHl - gapDays)/7);
  }
  var weeks = Math.min(_TD_MAX_WEEKS, Math.max(12, candWeeks, histWeeks));
  var dates = _tcSolveDates(cad, start, weeks);
  if(!dates.length) return {ok:false, reason:'no-dates'};

  var lastMs  = dates[dates.length-1].getTime();
  var winFrom = lastMs - 7*86400000;
  var perWeek = cad.perWeek || 1;

  var calls = 0;
  function evalDose(mg){
    var evts = hist.slice();
    dates.forEach(function(d){
      evts.push({compId:opts.esterId, doseMg:String(mg), date:_tcSolveDayKey(d)});
    });
    var ser = _tcSolveSeries(evts);
    calls++;
    if(!ser) return null;
    return _tcSolveWindowStats(ser, winFrom, lastMs);
  }

  // Fixed-point on a near-proportional response — the same shortcut, and the
  // same justification, as the transition solver: total[] is exactly linear in
  // the candidate doses, and free T is a smooth monotone function of total[].
  // Bisecting instead would cost ~40 model rebuilds where this costs ~9.
  // Not perfectly proportional — there is a suppressed endogenous floor under
  // it — so it iterates rather than scaling once.
  var mg = 100, st = evalDose(mg);
  if(!st) return {ok:false, reason:'model-failed'};
  for(var i=0;i<8;i++){
    if(!(st.mean>0)) break;
    var next = mg * (target/st.mean);
    next = Math.max(0.5, Math.min(_TD_MAX_MG, next));
    if(Math.abs(next-mg) <= Math.max(0.05, mg*0.002)){ mg=next; break; }
    mg = next;
    st = evalDose(mg);
    if(!st) return {ok:false, reason:'model-failed'};
  }

  // ⚠️ THE ANSWER IS THE SNAPPED SCHEDULE, NOT THE CONTINUOUS SOLUTION.
  // Quantising to what a syringe can be drawn to CHANGES the level, so the
  // reported figures are re-scored after snapping. Reporting the pre-snap
  // number next to a post-snap dose is how a plan drifts from its own maths.
  var stepMg = (parseDec(opts.concMgPerMl)>0 && parseDec(opts.stepMl)>0)
    ? parseDec(opts.concMgPerMl)*parseDec(opts.stepMl) : 0;
  var snapped, fin;
  if(stepMg>0){
    // ⚠️ SNAP TO THE NEARER ATTAINABLE LEVEL, NOT THE NEARER DOSE.
    // Rounding the milligrams is not the same as rounding the result: a step is
    // 12.5 mg at 250 mg/ml, and there is a suppressed endogenous floor under the
    // response, so the two are not the same ordering. Both candidates are
    // attainable, so choosing on the wrong one is a free error.
    //
    // Measured over 560 combinations (5 esters x 4 cadences x targets 250-1600
    // pmol/L at 250 mg/ml, 0.05 ml steps): this picks a different dose from
    // nearest-milligram in 8 of them (1.4%), is never worse, and is 1.6
    // percentage points closer to target on the cases where it differs. Small,
    // one extra model call, and it cannot cost anything — which is the whole
    // argument for it. Granularity is still the floor: where a step spans a wide
    // band of pmol/L neither candidate lands near, and the note under the result
    // says so rather than implying a precision the syringe does not have.
    var lo = Math.floor(mg/stepMg)*stepMg;
    var hi = lo + stepMg;
    if(!(lo>0)) lo = stepMg;
    var loSt = evalDose(lo), hiSt = evalDose(hi);
    if(!loSt || !hiSt) return {ok:false, reason:'model-failed'};
    var loErr = Math.abs(loSt.mean-target), hiErr = Math.abs(hiSt.mean-target);
    snapped = (loErr<=hiErr) ? lo  : hi;
    fin     = (loErr<=hiErr) ? loSt: hiSt;
  }else{
    snapped = Math.round(mg*10)/10;
    if(!(snapped>0)) snapped = 0.1;
    fin = evalDose(snapped);
    if(!fin) return {ok:false, reason:'model-failed'};
  }

  return {
    ok:            true,
    mgPerInjection: snapped,
    mgPerWeek:      snapped*perWeek,
    perWeek:        perWeek,
    exactMg:        mg,
    stepMg:         stepMg,
    weeks:          weeks,
    // Non-zero when the window had to be pushed out past a long ester already on
    // board, so the card can say why it is reporting week 40 rather than week 12.
    washoutWeeks:   histWeeks,
    achieved:       fin.mean,
    peak:           fin.peak,
    trough:         fin.trough,
    target:         target,
    modelCalls:     calls,
    // Honest about the ceiling of the search rather than silently returning it.
    maxedOut:       snapped >= _TD_MAX_MG - 0.001
  };
}
var _TD_MAX_MG = (typeof _TC_SOLVE_HI_MG !== 'undefined') ? _TC_SOLVE_HI_MG : 2000;
// 400 days is the same pharmacological bound the history fetch uses: at Nebido's
// 56-day half-life that is ~7 half-lives, under 1% of a dose still contributing.
var _TD_MAX_WEEKS = 57;

// The calibration the answer rests on. Named, because a number solved against a
// population default and one solved against the user's own draw are different
// claims and must not look identical on screen.
function _tdCalibration(){
  var bw = (typeof _tcBwEntries!=='undefined' && _tcBwEntries) ? _tcBwEntries : [];
  var withFt = bw.filter(function(e){ return e && e.free_t!=null; })
                 .sort(function(a,b){ return (a.date||'')<(b.date||'') ? -1 : 1; });
  if(!withFt.length) return {ok:false};
  var last = withFt[withFt.length-1];
  return {ok:true, date:last.date, free_t:last.free_t, shbg:last.shbg, total_t:last.total_t};
}

// The last logged dose. Candidates must start after it — see the anchor note.
function _tdAnchorDate(){
  var hist = (typeof _tcLoggedHistory==='function') ? _tcLoggedHistory() : [];
  if(!hist.length) return '';
  return hist.map(function(e){ return e.date; }).sort().pop();
}
function _tdStartDate(){
  var anchor = _tdAnchorDate();
  var today  = dateKey(NOW);
  if(!anchor || anchor < today) return today;
  // Strictly after the anchor, never on it.
  var d = new Date(anchor+'T12:00:00');
  d.setDate(d.getDate()+1);
  return _tcSolveDayKey(d);
}

function _tdRunSolve(){
  var s = _tdGet();
  var cad = (_TC_CADENCES||[]).find(function(c){ return c.key===s.cadenceKey; });
  _tdSolving = true; buildTDose();
  // Out of the click handler so the "Solving…" paint lands first — the model is
  // ~85 ms per rebuild and nine of them is visibly not instant on a phone.
  setTimeout(function(){
    try{
      _tdResult = _tdSolveWeekly({
        targetPmol:  s.targetPmol,
        esterId:     s.esterId,
        cadence:     cad,
        history:     (typeof _tcLoggedHistory==='function') ? _tcLoggedHistory() : [],
        startDate:   _tdStartDate(),
        concMgPerMl: s.concMgPerMl,
        stepMl:      s.stepMl
      });
    }catch(e){
      if(typeof _logErr==='function') _logErr('tdSolve', e);
      _tdResult = {ok:false, reason:'threw', msg:String(e&&e.message||e)};
    }
    _tdSolving = false;
    buildTDose();
  }, 30);
}

// ── ADVANCED COMPOUNDS ──────────────────────────────────────────────────────
// Injectables and orals, straight from the catalogue. 'Base' is deliberately
// excluded: the testosterone base is what the solver above answers for, and
// listing it twice invites a user to read a catalogue default as the answer to
// the question they just solved.
var _TD_INJ_GROUPS  = ['Testosterone-Derived','DHT-Derived','19-Nor','Blends'];
var _TD_ORAL_GROUPS = ['Oral'];
// Estrogen control, PCT and side-effect support. Not "advanced compounds" — the
// things a run needs alongside them, and the ones whose absence is the problem.
// 'GH Axis' is deliberately NOT here: hGH is a growth compound, not an ancillary,
// and filing it under support would misread what it is.
var _TD_ANC_GROUPS  = ['Estrogen Control','PCT & Recovery','Side-Effect Support'];

function _tdCompounds(groups){
  // Array.isArray, not a truthiness check: the catalogue endpoint answers with
  // {compounds:[...]} and the sync normalises it, but a half-loaded or older
  // shape reaching here must render an empty section, not throw the tab away.
  var all = (typeof ENHANCEMENT_COMPOUNDS!=='undefined' && Array.isArray(ENHANCEMENT_COMPOUNDS))
    ? ENHANCEMENT_COMPOUNDS : [];
  return all.filter(function(c){ return c && groups.indexOf(c.group)>=0; });
}
// The tier the catalogue itself marks as the recommended one (`b`). Falling back
// to defaultDose rather than to the first tier: the first tier is the LOWEST, and
// presenting a floor as a recommendation is the wrong direction to be wrong in.
function _tdRecommended(cat){
  var tiers = (cat && cat.doseTiers) || [];
  var best = tiers.find(function(t){ return t && t.b; });
  if(best) return {label:best.l, dose:best.d, note:best.n, risk:best.r, ev:best.ev};
  if(cat && cat.defaultDose) return {label:'Catalogue default', dose:cat.defaultDose+' '+(cat.unit||''), note:'', risk:'', ev:null};
  return null;
}
// "Weekly dosage" for something prescribed per day. Shown ALONGSIDE the native
// unit, never instead of it — an oral is taken daily and a weekly total is an
// arithmetic convenience, not a way to take it.
function _tdWeeklyEquivalent(cat, rec){
  if(!cat || !rec || !rec.dose) return '';
  var unit = String(cat.unit||'');
  if(unit.indexOf('/day')<0) return '';
  var nums = String(rec.dose).match(/[\d.]+/g);
  if(!nums || !nums.length) return '';
  var lo = parseDec(nums[0])*7, hi = parseDec(nums[nums.length-1])*7;
  if(!(lo>0)) return '';
  var base = unit.replace('/day','');
  return (lo===hi) ? (Math.round(lo)+' '+base+'/week')
                   : (Math.round(lo)+'–'+Math.round(hi)+' '+base+'/week');
}

function tdToggleComp(id){
  _tdOpenComp[id] = !_tdOpenComp[id];
  buildTDose();
}

// ── RENDER ──────────────────────────────────────────────────────────────────
function _tdCard(inner){
  return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px;">'+inner+'</div>';
}
function _tdLabel(t){
  return '<div style="font-size:10px;font-weight:700;letter-spacing:1.4px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px;">'+t+'</div>';
}
var _TD_INPUT = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:9px 11px;color:var(--text);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;width:100%;';

function _tdTargetCardHtml(){
  var s = _tdGet();
  var cal = _tdCalibration();
  // The app's own ester enumeration — TRT_CAT merged with the fetched catalogue,
  // hCG dropped. Building a second list here is how the two surfaces end up
  // offering different esters.
  var esterIds = (typeof _tcManualComps==='function') ? _tcManualComps() : [];

  // Seed only an untouched field, and say where the number came from.
  var seed = {value:'', source:''};
  if(s.targetPmol===''||s.targetPmol==null){
    seed = _tdDefaultTarget();
    if(seed.value!=='') s.targetPmol = String(seed.value);
  }

  var h = _tdLabel('Target free T');

  // What the answer is calibrated against, said plainly. A figure solved against
  // the population default is a different claim from one solved against the
  // user's own draw, and they must not look the same.
  if(cal.ok){
    h += '<div style="font-size:11px;color:var(--muted2);line-height:1.55;margin-bottom:10px;">'
      +  'Calibrated on your bloodwork of <strong style="color:var(--text)">'+_esc(cal.date)+'</strong>'
      +  ' — free T '+_esc(String(cal.free_t))+(cal.shbg?(' · SHBG '+_esc(String(cal.shbg))):'')+'.'
      +  '</div>';
  }else{
    h += '<div style="font-size:11px;color:#f59e0b;line-height:1.55;margin-bottom:10px;">'
      +  '⚠ No bloodwork with a free-T value on record, so this falls back to the '
      +  'population default for your age. Log a draw in Bloodwork and the answer '
      +  'becomes yours rather than a typical man\'s.</div>';
  }

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
    +  '<div><div style="font-size:9px;color:var(--muted2);letter-spacing:1px;font-weight:700;margin-bottom:5px;">TARGET (pmol/L)</div>'
    +  '<input id="td-target" type="text" inputmode="decimal" value="'+_esc(String(s.targetPmol||''))+'" placeholder="e.g. 600" '
    +  'onchange="_tdSet(\'targetPmol\',this.value)" style="'+_TD_INPUT+'"></div>'
    +  '<div><div style="font-size:9px;color:var(--muted2);letter-spacing:1px;font-weight:700;margin-bottom:5px;">ESTER</div>'
    +  '<select onchange="_tdSet(\'esterId\',this.value)" style="'+_TD_INPUT+'">';
  esterIds.forEach(function(id){
    if(!id) return;
    var info = _tcCompInfo(id) || {};
    h += '<option value="'+_esc(id)+'"'+(s.esterId===id?' selected':'')+'>'+_esc(info.name||id)+'</option>';
  });
  h += '</select></div></div>';

  if(seed.source){
    h += '<div style="font-size:11px;color:var(--muted2);line-height:1.55;margin:-4px 0 10px;">'
      +  'Starting from '+_esc(seed.source)+' — this is where you are, not a level the app '
      +  'recommends. Change it to whatever you want to hold.</div>';
  }

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
    +  '<div><div style="font-size:9px;color:var(--muted2);letter-spacing:1px;font-weight:700;margin-bottom:5px;">CADENCE</div>'
    +  '<select onchange="_tdSet(\'cadenceKey\',this.value)" style="'+_TD_INPUT+'">';
  (_TC_CADENCES||[]).forEach(function(c){
    h += '<option value="'+_esc(c.key)+'"'+(s.cadenceKey===c.key?' selected':'')+'>'+_esc(c.label)+'</option>';
  });
  h += '</select></div>'
    +  '<div><div style="font-size:9px;color:var(--muted2);letter-spacing:1px;font-weight:700;margin-bottom:5px;">VIAL (mg/ml)</div>'
    +  '<input type="text" inputmode="decimal" value="'+_esc(String(s.concMgPerMl||''))+'" '
    +  'onchange="_tdSet(\'concMgPerMl\',this.value)" style="'+_TD_INPUT+'"></div></div>';

  h += '<button onclick="_tdRunSolve()"'+(_tdSolving?' disabled':'')+' style="width:100%;background:var(--accent);color:#000;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;'+(_tdSolving?'opacity:0.6;':'')+'">'
    +  (_tdSolving?'Solving…':'Find weekly dose')+'</button>';

  return _tdCard(h);
}

function _tdResultCardHtml(){
  if(_tdSolving) return '';
  var r = _tdResult;
  if(!r) return '';
  if(!r.ok){
    var why = {
      'no-target':   'Enter a target free-T level first.',
      'no-ester':    'That ester is not in the catalogue.',
      'no-cadence':  'Pick an injection cadence.',
      'no-dates':    'That cadence produced no injection dates.',
      'model-failed':'The free-T model could not build a series for that input.',
      'threw':       'The solve failed: '+_esc(String(r.msg||''))
    }[r.reason] || 'The solve did not produce an answer.';
    return _tdCard('<div style="font-size:13px;color:#f59e0b;line-height:1.55;">'+why+'</div>');
  }

  var s = _tdGet();
  var cd = _tcCompInfo(s.esterId);
  var ml = (parseDec(s.concMgPerMl)>0) ? (r.mgPerInjection/parseDec(s.concMgPerMl)) : 0;

  var cadObj = (_TC_CADENCES||[]).find(function(c){ return c.key===s.cadenceKey; });

  var h = _tdLabel('Weekly dose');
  h += '<div style="font-size:34px;font-weight:900;color:var(--accent);line-height:1.1;">'
    +  (Math.round(r.mgPerWeek*10)/10)+'<span style="font-size:16px;font-weight:700;color:var(--muted2);"> mg/week</span></div>';
  h += '<div style="font-size:13px;color:var(--text);margin-top:6px;line-height:1.6;">'
    +  '<strong>'+(Math.round(r.mgPerInjection*10)/10)+' mg</strong> per injection'
    +  (ml>0?(' (<strong>'+(Math.round(ml*100)/100)+' ml</strong> at '+_esc(String(s.concMgPerMl))+' mg/ml)'):'')
    +  '</div>';
  h += '<div style="font-size:12px;color:var(--muted2);margin-top:4px;line-height:1.6;">'
    +  _esc((cadObj&&cadObj.label)||'')+' · '+_esc(cd.name||s.esterId)+'</div>';

  h += '<div style="height:1px;background:var(--border);margin:12px 0;"></div>';

  h += '<div style="font-size:12px;color:var(--muted2);line-height:1.7;">'
    +  'At steady state this holds a mean of <strong style="color:var(--text)">'+Math.round(r.achieved)+' pmol/L</strong>'
    +  ' against your target of '+Math.round(r.target)+', ranging '
    +  Math.round(r.trough)+'–'+Math.round(r.peak)+' pmol/L across the week.'
    +  '</div>';

  // The snap is not a rounding detail — it is why the achieved figure is not the
  // target, and saying so pre-empts the "why is it 612 and not 600" question.
  if(r.stepMg>0){
    h += '<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:8px;">'
      +  'Snapped to '+_esc(String(s.stepMl))+' ml steps at '+_esc(String(s.concMgPerMl))+' mg/ml — '
      +  Math.round(r.stepMg*10)/10+' mg per step. The figures above are the snapped schedule, '
      +  'not the exact solution ('+(Math.round(r.exactMg*10)/10)+' mg).</div>';
  }
  h += '<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:6px;">'
    +  'Measured over the last dosing week of a '+r.weeks+'-week run — long enough for '
    +  _esc(cd.name||s.esterId)+' to reach steady state, and never into the washout tail.</div>';
  // A 40-week window needs explaining, or it reads as an arbitrary number.
  if(r.washoutWeeks>12){
    h += '<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:6px;">'
      +  'The window is '+r.weeks+' weeks rather than 12 because a long-acting ester is '
      +  'still clearing from your logged doses. This is the dose that holds the level '
      +  'once that has gone — until then the old ester is still contributing and you '
      +  'will sit above it.</div>';
  }

  // The app's own ceiling copy, not a new opinion.
  var ceil = (typeof _FT_REF!=='undefined') ? _FT_REF : null;
  if(ceil && ceil.ceiling_pmol_l && r.target > ceil.ceiling_pmol_l){
    h += '<div style="font-size:11px;color:#f59e0b;line-height:1.6;margin-top:8px;">⚠ Target '
      +  Math.round(r.target)+' pmol/L is above the top of the healthy young-male range ('
      +  Math.round(ceil.ceiling_pmol_l)+' pmol/L). '+_esc(ceil.above_ceiling_note||'')+'</div>';
  }
  if(r.maxedOut){
    h += '<div style="font-size:11px;color:#f59e0b;line-height:1.6;margin-top:8px;">⚠ The solve hit its '
      +  'ceiling of '+_TD_MAX_MG+' mg per injection without reaching the target. Check the target '
      +  'and the ester — a short ester at a weekly cadence cannot hold a high mean.</div>';
  }
  return _tdCard(h);
}

function _tdCompoundRowsHtml(groups){
  var list = _tdCompounds(groups);
  if(!list.length){
    return '<div style="font-size:12px;color:var(--muted2);line-height:1.6;">'
      + 'Catalogue not loaded yet — open Protocols once to fetch it, or pull to refresh.</div>';
  }
  return list.map(function(cat){
    var rec  = _tdRecommended(cat);
    var wk   = _tdWeeklyEquivalent(cat, rec);
    var open = !!_tdOpenComp[cat.id];
    var ev   = (rec && rec.ev && typeof _evBadge==='function') ? _evBadge(rec.ev.g) : '';
    var h = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:6px;">'
      + '<div onclick="tdToggleComp(\''+_esc(cat.id)+'\')" style="display:flex;align-items:center;gap:9px;cursor:pointer;flex-wrap:wrap;">'
      + '<span style="width:8px;height:8px;border-radius:50%;background:'+_esc(cat.dot||'var(--accent)')+';flex-shrink:0;"></span>'
      + '<span style="font-size:13px;font-weight:700;color:var(--text);flex:1;min-width:0;">'+_esc(cat.name||cat.id)+'</span>'
      + '<span style="font-size:11px;color:var(--muted2);">'+(open?'▴':'▾')+'</span>'
      + '</div>';
    if(rec){
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;">'
        +  '<span style="font-size:10px;font-weight:700;color:var(--muted2);text-transform:uppercase;letter-spacing:0.8px;">'+_esc(rec.label||'')+'</span>'
        +  '<span style="font-size:13px;font-weight:700;color:var(--accent);">'+_esc(String(rec.dose||''))+'</span>'
        +  ev+'</div>';
      if(wk){
        h += '<div style="font-size:11px;color:var(--muted2);margin-top:3px;">= '+_esc(wk)+' total, taken daily — the weekly figure is arithmetic, not a way to take it.</div>';
      }
      if(rec.risk){
        h += '<div style="font-size:11px;color:#f59e0b;line-height:1.55;margin-top:4px;">⚠ '+_esc(rec.risk)+'</div>';
      }
    }
    // The FULL guide — cadence, every tier, evidence, citations, sides — from
    // the same renderer the Protocols tab uses. One source, one wording.
    if(open && typeof _renderEnhancedGuide==='function'){
      h += '<div style="margin-top:8px;">'+_renderEnhancedGuide(cat, 0, cat.unit||'')+'</div>';
    }
    return h+'</div>';
  }).join('');
}

function _tdAdvancedHtml(){
  var s = _tdGet();
  var h = '';

  h += _tdCard(_tdLabel('Injectables')
    + '<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-bottom:10px;">'
    + 'Weekly doses from the compound catalogue, with the tier it marks as recommended. '
    + 'Your testosterone base is the question above — these run alongside it, not instead of it. '
    + 'Tap a compound for its full guide.</div>'
    + _tdCompoundRowsHtml(_TD_INJ_GROUPS));

  h += _tdCard(_tdLabel('Orals')
    + '<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-bottom:10px;">'
    + 'Orals are prescribed per day and every one of these is 17α-alkylated unless its guide says '
    + 'otherwise — run lengths are short and liver markers are the monitoring, not an optional extra. '
    + 'Tap a compound for its full guide.</div>'
    + _tdCompoundRowsHtml(_TD_ORAL_GROUPS));

  h += _tdCard(_tdLabel('Ancillaries &amp; support')
    + '<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-bottom:10px;">'
    + 'Estrogen control, PCT and side-effect support. These are dosed to BLOODWORK and '
    + 'to symptoms, not to a cycle template — an AI in particular is titrated from a '
    + 'measured E2, and the figures below are starting points to test against a draw, '
    + 'never a standing prescription. Tap a compound for its full guide.</div>'
    + _tdCompoundRowsHtml(_TD_ANC_GROUPS));

  if(typeof _renderSafetyNote==='function'){
    h += _tdCard(_renderSafetyNote('enhanced'));
  }
  return h;
}

function buildTDose(){
  var el = document.getElementById('tdose-body');
  if(!el) return;
  try{
    var h = '';
    h += '<div style="padding:14px 0 4px;">'
      +  '<div style="font-size:11px;color:var(--muted2);letter-spacing:2px;font-weight:700;">LEVELS</div>'
      +  '<div style="font-size:22px;font-weight:900;color:var(--text);letter-spacing:0.4px;margin-top:2px;">DOSE FINDER</div>'
      +  '</div>';
    h += _tdTargetCardHtml();
    h += _tdResultCardHtml();
    h += _tdAdvancedHtml();
    el.innerHTML = h;
  }catch(e){
    if(typeof _logErr==='function') _logErr('buildTDose', e);
    el.innerHTML = '<div style="padding:16px;font-size:13px;color:#f59e0b;">Dose Finder failed to render: '
      + _esc(String(e&&e.message||e))+'</div>';
  }
}
