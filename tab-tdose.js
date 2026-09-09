/* ── DOSE FINDER ───────────────────────────────────────────────────────────
 * "What weekly dose of ester X holds free T at Y?" — and then, below it, what
 * the catalogue recommends for the compounds a user reaches for next.
 *
 * ⚠️ THIS TAB IS ISOLATED FROM THE T-CALC CURVE. ⚠️
 * Henrik, 2026-09-08: "This tab should work in isolation from the t-calc curve.
 * This is not to be using past injections or anything. It should only take
 * available research resources and any existing blood work as input, use the
 * chosen ester and do a calculation for needed weekly dose needed to remain at
 * the target steady state free T."
 *
 * So the ONLY inputs are:
 *   • published pharmacology — the ester's half-life, tmax, bioavailability and
 *     testosterone fraction from /trt-catalog, and endogenous production
 *   • the user's own bloodwork — free T / total T / SHBG, if any exists
 *   • the chosen ester, cadence and vial concentration
 *   • the target level
 *
 * NOT the logged injection history. NOT the active protocol. NOT _tcCurveLog,
 * _tcLoggedHistory, _tcSsPeakPmol or anything else that describes what the user
 * happens to be running. This is a standing question — "what dose holds this
 * level" — and its answer must not change because of what was injected last
 * month. Feeding the history in is exactly what broke it on 2026-09-08: a
 * 56-day Nebido depot was still releasing at the measurement window, its residue
 * was scored as if the candidate schedule had produced it, and the tool asked
 * for 100 mg/week where the honest answer was 200.
 *
 * ⚠️ ISOLATED FROM THE CURVE'S DATA, NOT FROM ITS PHARMACOLOGY. ⚠️
 * The maths still comes from _tcFreeTSeries — the PK, the HPTA-suppression term
 * and the Vermeulen binding model — because a second pharmacology here would let
 * two surfaces disagree about the same drug, which the app forbids everywhere
 * else. What is removed is the DATA coupling, not the equations.
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
// ⚠️ A PREFILLED TARGET IS DESCRIPTIVE, NEVER A RECOMMENDATION, AND IT COMES
// ONLY FROM BLOODWORK.
// It used to seed from the level the active protocol holds, which read the
// injection history through _tcCurveLog — the coupling this tab is not allowed
// to have. A measured draw is the one thing here that is neither a model output
// nor a recommendation, so it is the only honest seed.
//
// Seeding from a reference range was considered and rejected: "the top of the
// healthy young-male range" is exactly the number that becomes a goal because it
// was pre-typed, and choosing the level is the user's half of this tool. Blank
// beats invented. Only ever fills an EMPTY field — a target the user typed is
// theirs.
function _tdDefaultTarget(){
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

// ── HOW FAR TO TRUST THE NUMBER ─────────────────────────────────────────────
// The model is a faithful first-principles calculation and it still disagrees
// with the best measured dose-response data. Both of those are true, and a
// single bold figure on screen says only the first.
//
// WHERE IT AGREES. The model is TT = TT_base * total/P — serum testosterone
// proportional to appearance rate, anchored on the user's own baseline. That is
// metabolic-clearance arithmetic, and it lands within a few percent of doing the
// sum directly with the MCR the backend cites (1240 L/day for men, J Clin Invest
// 1967 PMID 6025489): at 125 mg/week enanthate the model says a mean of 1100
// ng/dL and the raw MCR sum says 1037.
//
// WHERE IT DOES NOT. Bhasin 2001 (Am J Physiol 281:E1172) gave weekly TE under
// GnRH-agonist suppression and measured MEAN NADIR concentrations — the sample
// taken immediately before the next injection. Read like for like, model trough
// against published nadir, the model runs about 1.5x high across the ladder.
//
// ⚠️ AN EARLIER READING OF THIS SAID 2x AND WAS WRONG: it compared the model's
// weekly MEAN against Bhasin's NADIR, which are not the same quantity. A third
// of the apparent error was that mistake. Always compare trough to nadir here.
//
// The most likely single cause of what remains is bioavailability: the catalogue
// declares none for the injectable esters, so the model treats the full injected
// mass as reaching circulation. The ratio also falls as dose rises (1.62x at 25
// mg/week, 1.37x at 300), which is what you would expect from SHBG dropping and
// clearance rising at supraphysiological levels — an effect no fixed factor
// captures.
//
// ⚠️ THE FACTOR IS MEASURED AGAINST THE LIVE MODEL, NOT HARDCODED.
// _tdModelBias runs the current model at Bhasin's doses and compares. If the
// pharmacology is ever corrected, the reported uncertainty narrows by itself
// instead of quietly becoming a lie. What IS hardcoded is the published data
// itself, which is a fixed historical fact.
//
// ⚠️ THE PUBLISHED DATA IS SERVED, NOT HARDCODED.
// It lives in /systemic-interactions as testosteroneDoseResponse, alongside
// endogenousT and the population baselines, and reaches here through the same
// fetch that feeds T-Calc. Two apps quoting different figures for one study is
// exactly what the one-number-one-source rule exists to stop, and a copy in each
// frontend is how that starts. There is no local fallback table on purpose: if
// the backend has not answered, the tab says it cannot state its uncertainty
// rather than stating a stale one.
function _tdLitAnchor(){
  var d = (typeof _tcDoseResponse!=='undefined') ? _tcDoseResponse : null;
  if(!d || !d.points || !d.points.length) return null;
  return d;
}
var _TD_NGDL_PER_NMOL = 28.84;   // testosterone MW 288.4 — a unit conversion, not data
var _tdBiasCache = null;

// Ratio of what this model predicts to what was measured, at matched doses and
// matched quantity (trough vs nadir, weekly cadence). >1 means the model reads
// high, so the dose it returns is a FLOOR: holding the target for real is likely
// to need more, not less.
function _tdModelBias(){
  if(_tdBiasCache) return _tdBiasCache;
  try{
    var lit = _tdLitAnchor();
    if(!lit) return null;
    var cad = (_TC_CADENCES||[]).find(function(c){ return c.key==='1xwk'; });
    var shbg = parseDec((_tdCalibration()||{}).shbg) || 45;
    if(!cad || typeof _tcInvVermeulenTT!=='function') return null;
    var ratios = [];
    lit.points.forEach(function(pt){
      var mgWk = parseDec(pt.mg_per_week), ref = parseDec(pt.value);
      if(!(mgWk>0) || !(ref>0)) return;
      var dates = _tcSolveDates(cad, dateKey(NOW), 26);
      if(!dates.length) return;
      var last = dates[dates.length-1].getTime();
      var ser = _tcSolveSeries(dates.map(function(dt){
        return {compId:'enanthate', doseMg:String(mgWk), date:_tcSolveDayKey(dt)};
      }));
      if(!ser) return;
      var st = _tcSolveWindowStats(ser, last-7*86400000, last);
      // ⚠️ TROUGH, because the served data is NADIR — the sample taken just
      // before the next injection. Comparing the weekly MEAN against it
      // overstates the disagreement by about a third, which is a mistake this
      // code has already made once.
      var ng = _tcInvVermeulenTT(st.trough, shbg) * _TD_NGDL_PER_NMOL;
      if(ng>0) ratios.push(ng/ref);
    });
    if(!ratios.length) return null;
    ratios.sort(function(a,b){ return a-b; });
    var mean = ratios.reduce(function(a,b){ return a+b; },0)/ratios.length;
    _tdBiasCache = {mean:mean, lo:ratios[0], hi:ratios[ratios.length-1],
                    n:ratios.length, source:lit.source||'', measure:lit.measure||''};
    return _tdBiasCache;
  }catch(e){
    if(typeof _logErr==='function') _logErr('tdModelBias', e);
    return null;
  }
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

  // ⚠️ NO HISTORY. NOT AN OMISSION — THE WHOLE POINT.
  // The candidate schedule is the only drug in this model. Nothing the user has
  // already injected contributes, so the answer is "the dose that holds this
  // level", full stop, rather than "the dose that holds it while your last
  // protocol is still clearing". See the isolation note at the top of the file.
  var start = opts.startDate || dateKey(NOW);

  // Long enough for the chosen ester to actually BE at steady state: five
  // half-lives is 97% of the way there. With no prior drug on board there is
  // nothing else to wait for, so this is the only term — a 56-day depot needs
  // ~40 weeks, enanthate is covered by the 12-week floor.
  var hl = cd.halfLifeDaysHigh || cd.halfLifeDays || 1;
  var weeks = Math.min(_TD_MAX_WEEKS, Math.max(12, Math.ceil(5*hl/7)));

  // ⚠️ REFUSE ON UNLOADED INPUTS RATHER THAN ANSWER FROM NOTHING.
  // The two things this tab is allowed to stand on are the user's bloodwork and
  // the population tables from /systemic-interactions. With neither, the free-T
  // conversion has nothing behind it and the solve still returns a number —
  // measured at 4025 mg/week on a blank profile, which is not a dose, it is an
  // artefact wearing one. A dosing tool must say it cannot answer.
  var _haveBw  = _tdCalibration().ok;
  var _havePop = (typeof _tcShbgBaseline!=='undefined' && _tcShbgBaseline &&
                  _tcShbgBaseline.bands && _tcShbgBaseline.bands.length);
  if(!_haveBw && !_havePop) return {ok:false, reason:'no-basis'};

  var dates = _tcSolveDates(cad, start, weeks);
  if(!dates.length) return {ok:false, reason:'no-dates'};

  var lastMs  = dates[dates.length-1].getTime();
  var winFrom = lastMs - 7*86400000;
  var perWeek = cad.perWeek || 1;

  var calls = 0;
  function evalDose(mg){
    var evts = [];
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

// ⚠️ THE ANCHOR RULE IS GONE BECAUSE THE HISTORY IS GONE.
// _tdAnchorDate/_tdStartDate used to push the plan past the last logged dose, so
// a candidate injection could not land on the calibration anchor and collapse
// TT_base. With no logged doses in the model there is no anchor to protect and
// nothing to start after: the schedule is a hypothetical steady state, and today
// is as good a day as any to begin it.
function _tdStartDate(){ return dateKey(NOW); }

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
  // ratio / assumes_test_mg_wk travel with the tier — dropping them here is how
  // the display falls back to parsing prose it no longer needs to parse.
  if(best) return {label:best.l, dose:best.d, note:best.n, risk:best.r, ev:best.ev,
                   ratio:best.ratio, assumesTest:best.assumes_test_mg_wk};
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

// ── EVERY RECOMMENDATION IS CHECKED AGAINST THE SOLVED TEST DOSE ────────────
// Reported 2026-09-08: the solver returned 200 mg/week of testosterone and the
// panel below it recommended Masteron at "1:1 TEST:MAST — 400-500 mg/wk". One
// screen, two numbers, and they contradict each other: 1:1 with a 200 mg base is
// 200 mg, not 400-500. The catalogue's absolute ranges are written against an
// assumed ~400-500 mg/week base, and nothing reconciled them with the base the
// user actually solved for.
//
// That is the ONE NUMBER, ONE SOURCE rule failing in the most visible way
// possible, so it is fixed here rather than papered over: the ratio in the
// tier's own label is applied to the solved dose, and where the catalogue's
// figure disagrees the card says so in both numbers.
//
// ⚠️ THIS INVENTS NO DOSES. It multiplies two numbers the app already states —
// the ratio the catalogue wrote into the tier label, and the base the solver
// returned. Where a tier carries no ratio there is nothing to derive, and the
// card reports the MULTIPLE of the test base instead, which is arithmetic on
// two known figures and not a recommendation either. The catalogue remains the
// only source of doses.

// The ratio a tier states, and the base its absolute mg range was written
// against. Both come from the backend as data now (`ratio`,
// `assumes_test_mg_wk`) — the label is prose for reading, and parsing prose is
// how a consumer drifts from the source.
//
// The label parse is kept as a FALLBACK ONLY, for a backend that predates the
// fields. It must never be the primary path: it cannot recover the assumed base
// at all, which is the half that makes the conflict message accurate.
function _tdTierRatio(tier){
  if(tier && tier.ratio && tier.ratio.test>0 && tier.ratio.comp>0){
    return {test:tier.ratio.test, comp:tier.ratio.comp,
            label:tier.ratio.test+':'+tier.ratio.comp,
            assumesLo:(tier.assumesTest && tier.assumesTest[0])||0,
            assumesHi:(tier.assumesTest && tier.assumesTest[1])||0};
  }
  var lbl = (tier && (tier.label != null ? tier.label : tier.l)) || '';
  var m = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/.exec(lbl);
  if(!m) return null;
  var t = parseDec(m[1]), c = parseDec(m[2]);
  if(!(t>0) || !(c>0)) return null;
  return {test:t, comp:c, label:m[1]+':'+m[2], assumesLo:0, assumesHi:0};
}
// The low/high mg the tier's dose column states, in the compound's own unit.
function _tdTierRange(rec){
  var ns = String((rec && rec.dose) || '').match(/[\d.]+/g);
  if(!ns || !ns.length) return null;
  var lo = parseDec(ns[0]), hi = parseDec(ns[ns.length-1]);
  if(!(lo>0)) return null;
  return {lo:lo, hi:(hi>0?hi:lo)};
}
// Weekly mg for a compound whose unit may be per-day.
function _tdWeeklyMg(cat, v){
  return (String((cat&&cat.unit)||'').indexOf('/day')>=0) ? v*7 : v;
}
// Compare one recommendation with the solved testosterone dose.
//   ratio    — present when the tier states one; carries the mg it implies
//   conflict — the tier states a ratio AND its own dose column contradicts it
//   multiple — the catalogue dose as a multiple of the test base
function _tdValidateAgainstBase(cat, rec, baseMgWk){
  if(!cat || !rec || !(baseMgWk>0)) return null;
  var unit = String(cat.unit||'');
  // ⚠️ EXCLUDED BY GROUP, NOT BY UNIT.
  // Only androgens compare meaningfully to a testosterone base. Anastrozole and
  // finasteride are dosed in mg like every steroid here, so a unit test lets
  // them through and prints "0.5 mg/wk = 0.003x your test base" — noise dressed
  // as rigour. They are titrated to bloodwork and symptoms, which their own
  // guide says. The androgen groups are the ones this tab already lists as
  // injectables and orals.
  var androgen = _TD_INJ_GROUPS.concat(_TD_ORAL_GROUPS);
  if(androgen.indexOf(cat.group) < 0) return null;
  if(unit.indexOf('mg')!==0) return null;
  var range = _tdTierRange(rec);
  if(!range) return null;

  var out = {baseMgWk:baseMgWk, unit:unit};
  var wkLo = _tdWeeklyMg(cat, range.lo), wkHi = _tdWeeklyMg(cat, range.hi);
  out.multipleLo = wkLo/baseMgWk;
  out.multipleHi = wkHi/baseMgWk;

  var ratio = _tdTierRatio(rec);
  if(ratio){
    // The tier's own arithmetic, applied to the base the solver returned.
    var impliedWk = baseMgWk * (ratio.comp/ratio.test);
    out.ratio = ratio;
    out.impliedWeekly = impliedWk;
    // In the compound's stated unit, so it can be read next to the tier.
    out.impliedNative = (unit.indexOf('/day')>=0) ? impliedWk/7 : impliedWk;
    // A conflict is the catalogue's stated range not containing what its own
    // label implies. A 10% tolerance keeps rounding out of it.
    out.conflict = (impliedWk < wkLo*0.9) || (impliedWk > wkHi*1.1);
  }
  return out;
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
      +  ' — free T '+_esc(String(cal.free_t))+(cal.shbg?(' · SHBG '+_esc(String(cal.shbg))):'')+'. '
      +  'This tab uses that draw and the published pharmacology of the ester you pick, and '
      +  '<strong style="color:var(--text)">nothing else</strong> — not your logged injections, '
      +  'not your active protocol. It answers what dose holds a level, from a standing start.'
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
      'no-basis':    'No bloodwork on record and the population reference tables have not '
                    +'loaded yet, so there is nothing to calibrate against. Reopen the tab '
                    +'once you are online, or log a bloodwork draw.',
      'threw':       'The solve failed: '+_esc(String(r.msg||''))
    }[r.reason] || 'The solve did not produce an answer.';
    return _tdCard('<div style="font-size:13px;color:#f59e0b;line-height:1.55;">'+why+'</div>');
  }

  var s = _tdGet();
  var cd = _tcCompInfo(s.esterId);
  var ml = (parseDec(s.concMgPerMl)>0) ? (r.mgPerInjection/parseDec(s.concMgPerMl)) : 0;

  var cadObj = (_TC_CADENCES||[]).find(function(c){ return c.key===s.cadenceKey; });

  // ⚠️ A RANGE, NOT A FIGURE.
  // The model matches metabolic-clearance arithmetic and still reads ~1.5x above
  // the only measured dose-response data, so the solved number is the BOTTOM of
  // the plausible range, not the middle of it. Printing one bold figure claims a
  // precision the pharmacology does not have, and this is a dose.
  var bias = _tdModelBias();
  var hiMg = (bias && bias.mean>1) ? r.mgPerWeek*bias.mean : 0;

  var h = _tdLabel('Weekly dose');
  if(hiMg > r.mgPerWeek*1.05){
    h += '<div style="font-size:34px;font-weight:900;color:var(--accent);line-height:1.1;">'
      +  (Math.round(r.mgPerWeek))+'<span style="font-size:22px;color:var(--muted2);">–</span>'
      +  (Math.round(hiMg))+'<span style="font-size:16px;font-weight:700;color:var(--muted2);"> mg/week</span></div>';
    h += '<div style="font-size:12px;color:var(--muted2);margin-top:5px;line-height:1.6;">'
      +  'The model says <strong style="color:var(--text)">'+Math.round(r.mgPerWeek)+' mg/week</strong>; '
      +  'measured trial data says it reads high, so treat that as the floor.</div>';
  }else{
    h += '<div style="font-size:34px;font-weight:900;color:var(--accent);line-height:1.1;">'
      +  (Math.round(r.mgPerWeek*10)/10)+'<span style="font-size:16px;font-weight:700;color:var(--muted2);"> mg/week</span></div>';
  }
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

    // ⚠️ AT A SHORT INTERVAL THE SYRINGE, NOT THE MODEL, SETS THE ERROR.
    // A step is a fixed number of mg, so the finer the cadence the larger a
    // fraction of each injection it is: 12.5 mg at 250 mg/ml is 7% of a weekly
    // 175 mg shot and 50% of the daily 25 mg one. The solver already picks the
    // nearer attainable LEVEL, so when it still lands far from target the cause
    // is granularity and the lever is the vial, not the dose. Saying so is the
    // difference between a number that looks wrong and one the user can act on.
    var _miss = Math.abs(r.achieved - r.target) / r.target;
    if(_miss > 0.10 && r.stepMg > r.mgPerInjection*0.2){
      var _finer = Math.max(1, Math.round(parseDec(s.concMgPerMl)/2));
      h += '<div style="font-size:11px;color:#f59e0b;line-height:1.65;margin-top:6px;">'
        +  '⚠ That step is '+Math.round(r.stepMg/r.mgPerInjection*100)+'% of each injection, '
        +  'so the nearest dose you can actually draw is '+Math.round(_miss*100)+'% off the target. '
        +  'The vial is the limit here, not the schedule — a thinner one (around '
        +  _finer+' mg/ml) makes each step '+Math.round(r.stepMg/2*10)/10+' mg and lets the dose land closer.'
        +  '</div>';
    }
  }
  h += '<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:6px;">'
    +  'Measured over the last dosing week of a '+r.weeks+'-week run — long enough for '
    +  _esc(cd.name||s.esterId)+' to reach steady state, and never into the washout tail.</div>';
  // A long window on a slow depot still needs explaining — but it is now purely
  // the chosen ester's own settling time, never someone else's leftovers.
  if(r.weeks > 12){
    h += '<div style="font-size:11px;color:var(--muted2);line-height:1.6;margin-top:6px;">'
      +  'The window is '+r.weeks+' weeks because '+_esc(cd.name||s.esterId)+' is slow to '
      +  'settle — five half-lives. Nothing you have already injected is included in this '
      +  'figure; it is what the schedule above holds on its own.</div>';
  }
  // ⚠️ SAY WHAT THE NUMBER RESTS ON AND WHERE IT IS KNOWN TO BE WRONG.
  // This is the difference between a calculator and a recommendation.
  if(bias){
    h += '<div style="height:1px;background:var(--border);margin:12px 0;"></div>';
    h += '<div style="font-size:10px;font-weight:700;letter-spacing:1.4px;color:var(--muted2);text-transform:uppercase;margin-bottom:6px;">How far to trust this</div>';
    h += '<div style="font-size:11px;color:var(--muted2);line-height:1.7;">'
      +  'The maths is metabolic-clearance arithmetic and agrees with doing that sum '
      +  'directly from the clearance rate in the literature. Checked against '
      +  _esc(bias.source)+' — it reads '
      +  '<strong style="color:var(--text)">'+(Math.round(bias.mean*100)/100)+'x high</strong> '
      +  'at matched doses (range '+(Math.round(bias.lo*100)/100)+'–'
      +  (Math.round(bias.hi*100)/100)+'x across '+bias.n+' dose levels), comparing its '
      +  'trough against that study\'s nadir samples. The likeliest single cause is that '
      +  'the catalogue declares no bioavailability for injectable esters, so the whole '
      +  'injected mass is modelled as reaching circulation.'
      +  '</div>';
    h += '<div style="font-size:11px;color:var(--muted2);line-height:1.7;margin-top:8px;">'
      +  'Free T here is <strong style="color:var(--text)">calculated, not measured</strong> '
      +  '(Vermeulen from total T and SHBG), and a direct assay has been seen to exceed the '
      +  'calculation. Both effects point the same way: this is a starting point to test '
      +  'against a draw, never a substitute for one.</div>';
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
  // The solved testosterone dose every recommendation below is checked against.
  // The model figure, not the top of the uncertainty range — a ratio quoted
  // against the widest possible base would overstate every companion compound.
  var base = (_tdResult && _tdResult.ok && _tdResult.mgPerWeek>0) ? _tdResult.mgPerWeek : 0;
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
      // ── CHECKED AGAINST THE SOLVED TESTOSTERONE DOSE ──────────────────────
      var val = _tdValidateAgainstBase(cat, rec, base);
      if(val){
        if(val.ratio && val.conflict){
          // The tier's own label and its own dose column disagree once the real
          // base is put in. Both numbers are shown, because which one the user
          // wants is their call and hiding either would be picking for them.
          h += '<div style="font-size:11px;color:#f59e0b;line-height:1.6;margin-top:5px;'
            +  'background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);'
            +  'border-radius:6px;padding:6px 8px;">'
            +  '⚠ At your <strong>'+Math.round(val.baseMgWk)+' mg/week</strong> base, '
            +  _esc(val.ratio.label)+' is <strong>'+Math.round(val.impliedNative)+' '
            +  _esc(val.unit.replace('mg/','mg/').replace('week','wk'))+'</strong>. '
            +  'The catalogue\'s '+_esc(String(rec.dose||''))+' assumes a '
            +  ((val.ratio.assumesLo>0)
                 ? (val.ratio.assumesLo+'–'+val.ratio.assumesHi)
                 : (Math.round(val.multipleLo*val.baseMgWk*val.ratio.test/val.ratio.comp)
                    +'–'+Math.round(val.multipleHi*val.baseMgWk*val.ratio.test/val.ratio.comp)))
            +  ' mg/week testosterone base.</div>';
        }else if(val.ratio){
          h += '<div style="font-size:11px;color:var(--muted2);margin-top:4px;">'
            +  '✓ '+_esc(val.ratio.label)+' against your '+Math.round(val.baseMgWk)
            +  ' mg/week base is '+Math.round(val.impliedNative)+' '
            +  _esc(val.unit)+' — consistent with the range above.</div>';
        }else{
          // No ratio stated, so nothing to derive. Reporting the multiple is
          // arithmetic on two known figures, and it is the thing worth seeing:
          // a 19-nor at twice the test base is a different protocol from the
          // same milligrams beside a heavier base.
          var _m = (Math.round(val.multipleLo*10)/10===Math.round(val.multipleHi*10)/10)
            ? (Math.round(val.multipleLo*10)/10)+'x'
            : (Math.round(val.multipleLo*10)/10)+'–'+(Math.round(val.multipleHi*10)/10)+'x';
          h += '<div style="font-size:11px;color:'+(val.multipleLo>1?'#f59e0b':'var(--muted2)')
            +  ';margin-top:4px;">'+(val.multipleLo>1?'⚠ ':'')+_esc(_m)+' your '
            +  Math.round(val.baseMgWk)+' mg/week testosterone base.'
            +  (val.multipleLo>1?' Running a compound above the test base is a deliberate choice, not a default.':'')
            +  '</div>';
        }
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
    + ((_tdResult && _tdResult.ok)
        ? 'Each one is checked against the ' + Math.round(_tdResult.mgPerWeek) + ' mg/week you solved for.'
        : 'Solve for a testosterone dose above and these get checked against it.')
    + ' Tap a compound for its full guide.</div>'
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
