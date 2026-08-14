// tab-tcalc.js — Smart T-Calc: goal-based PK optimizer

// ── Profile state (persisted to backend + localStorage cache) ─────────────────

var _tcp = {
  totalT:              '',
  shbg:                '',
  birthYear:           '',
  measuredFT:          '',
  currentDoseMgWk:     '',
  targetFT:            '',
  inventory:           [],  // [{compId, totalMg, costTotal}, ...]
  cycleType:           'trt',
  cycleDays:           168,
  preferredFreqDays:   'auto',
  overrideDoseMgWk:    '',
  overrideIntervalDays: '',
  planCompId:          '',  // kept for backward-compat with saved profiles; ignored
  backboneStartDay:    0,   // days into cycle before first backbone injection (default 0)
  manualLog:           [],  // [{compId, doseMg, date}, ...] — manual injection history
  // T-Calc is the single place a testosterone schedule is built. Two planners share
  // that job: the SIMPLE one (ester + dose + cadence) and the ADVANCED manual log
  // below it. Exactly one is live at a time; the other is greyed out but never
  // deleted, and its data is left intact so switching back restores it untouched.
  plannerMode:         '',  // '' = derive (see _tcPlannerMode), else 'simple' | 'advanced'
  simplePlan:          {compId:'', doseMg:'', cadenceDays:0, startDate:''},
  targetStackId:       ''   // stack this T-Calc testosterone is assigned to ('' = unassigned/global)
};

var _tcpSessionLoaded = false;
var _tcCurrentPlan    = null;
var _tcExtraCatalog   = [];   // extra compounds fetched from /trt-catalog at runtime
var _tcAgeMissing     = false; // true when user-settings returned but no user_age found
var _tcBwOpen         = false; // whether the bloodwork panel is expanded
var _tcBwEntries      = null; // null = not loaded; [] = loaded & empty; [...] = loaded
var _tcBwLoading      = false;
var _tcSsPeakPmol     = null;  // steady-state peak in pmol/L, read from the values this
                               // chart just PLOTTED. Never recomputed — T-Calc owns the
                               // model (doc 13, SETTLED) and this must never disagree
                               // with the curve the user is looking at.
var _tcDrawnFT        = null;  // {firstMs,unit,values:[per-day free-T]} cached from the last
                              // CALIBRATED plasma draw — the only source T-History capture may use
var _tcEditSeriesId = null;   // seriesId currently open in the Edit Series sheet
var _tcChartZoom   = 'whole'; // active zoom level: 'today' | 'week' | 'month' | 'whole'
var _tcChartPanOffset = 0;   // horizontal pan in days (float, only used in zoomed modes)
var _tcGhStack = [];          // [{pepId, startDateStr, interactions, dailyDose}] — SHBG suppressors from active stacks (dailyDose in the compound's doseResponse unit)
var _tcSysInter = null;       // compounds map from /systemic-interactions
var _tcFtBaseline = null;      // age→free-T population baseline (pmol/L) from /systemic-interactions
var _tcShbgBaseline = null;    // age→SHBG population baseline (nmol/L) from /systemic-interactions
var _tcShbgBodyFat = null;     // body-fat→SHBG adjustment params from /systemic-interactions
// Frontend fallback for the BF→SHBG adjustment so the personalisation still runs
// offline; the backend value overrides this when reachable. Adiposity lowers SHBG.
var _TC_SHBG_BF_FALLBACK = {ref_pct:{male:18,female:27},per_pct_k:{male:0.020,female:0.016},min_factor:0.60,max_factor:1.50};
var _tcActiveStacks = null;   // raw response from /protocol/stacks

// Testosterone → SHBG dose-response model. Exogenous androgens suppress hepatic
// SHBG dose-dependently (SHBG ∝ T^(−β)); this is the dominant driver of free-T
// drift away from a single bloodwork calibration. β is fitted PER USER from their
// own blood tests at runtime (see _tcFitBeta) — the values below are only the
// POPULATION FALLBACK used until a user has ≥2 SHBG labs at different T levels.
// Not tailored to any individual.
var TCALC_TSHBG_BETA    = 0.25;
var TCALC_TSHBG_BETA_LO = 0.15;
var TCALC_TSHBG_BETA_HI = 0.40;
var TCALC_TSHBG_LAG_DAYS = 25;   // SHBG responds over weeks — lag the T level by this τ

// Fit the user's personal SHBG→T dose-response exponent β from their own bloodwork.
// Model: SHBG ∝ totalT^(−β)  ⇒  ln(SHBG) = a − β·ln(totalT). β is the negated slope of a
// least-squares line through the user's (total T, SHBG) blood-test points. The band comes
// from the fit's own scatter (standard error), so it tightens as more labs are logged.
// Returns null when there isn't enough spread/data — the caller then uses the population
// fallback above. This keeps calibration inside the app and adapts to ANY user; nothing
// is hardcoded to a specific person.
function _tcFitBeta(entries) {
  if (!entries || !entries.length) return null;
  var pts = [];
  entries.forEach(function(e) {
    var tt = parseDec(e && e.total_t), sh = parseDec(e && e.shbg);
    if (tt > 0 && sh > 0) pts.push({ x: Math.log(tt), y: Math.log(sh) });
  });
  if (pts.length < 2) return null;
  var xs = pts.map(function(p){ return p.x; });
  if (Math.max.apply(null, xs) - Math.min.apply(null, xs) < 0.05) return null; // T levels too similar
  var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
  pts.forEach(function(p){ sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; });
  var denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  var slope = (n * sxy - sx * sy) / denom;
  var beta = Math.max(0.05, Math.min(0.60, -slope));   // clamp to a physiological range
  var half;
  if (n >= 3) {
    var intercept = (sy - slope * sx) / n, ssr = 0;
    pts.forEach(function(p){ var pred = intercept + slope * p.x; ssr += (p.y - pred) * (p.y - pred); });
    var seSlope = Math.sqrt((ssr / (n - 2)) / (sxx - sx * sx / n));
    half = Math.max(0.04, Math.min(0.25, seSlope));    // ~1 SE band, clamped
  } else {
    half = 0.10;                                        // two points: no scatter estimate yet
  }
  return { beta: beta, lo: Math.max(0.02, beta - half), hi: Math.min(0.70, beta + half), n: n };
}

// ── Blood test catalogue ───────────────────────────────────────────────────────

// ── Frequency options ─────────────────────────────────────────────────────────

var _TC_FREQ_OPTS = [
  {label:'Daily',           days:1},
  {label:'EOD',             days:2},
  {label:'3×/week',         days:7/3},
  {label:'2×/week (E3.5D)',days:3.5},
  {label:'Weekly',          days:7},
  {label:'Every 10 days',   days:10},
  {label:'Every 2 weeks',   days:14},
  {label:'Every 3 weeks',   days:21},
  {label:'Every 6 weeks',   days:42},
  {label:'Every 8 weeks',   days:56},
  {label:'Every 10 weeks',  days:70},
  {label:'Every 12 weeks',  days:84}
];

// Injection cadence is entered as a number (1–20) plus a unit, so any interval is
// reachable — every 3 days, every 5 weeks — rather than only the presets above.
// A month is taken as 30 days: the schedule is generated by stepping a fixed
// interval, not by walking calendar months.
var _TC_CADENCE_UNITS = {day:1, week:7, month:30};
var _TC_CADENCE_ORDER = ['day','week','month'];
var _TC_CADENCE_MAX_N = 20;

function _tcCadenceToDays(n, unit){
  var f = _TC_CADENCE_UNITS[unit];
  n = parseInt(n, 10);
  if (!f || !(n > 0)) return 0;
  return n * f;
}
// Best number+unit representation of a day count, for showing a plan that was saved
// before this control existed. Exact multiples win (28 d → 4 weeks, 90 d → 3 months);
// anything else falls back to days.
function _tcCadenceFromDays(days){
  days = parseDec(days) || 0;
  if (!(days > 0)) return {n:0, unit:'week'};
  for (var i = _TC_CADENCE_ORDER.length - 1; i >= 0; i--){
    var u = _TC_CADENCE_ORDER[i], f = _TC_CADENCE_UNITS[u];
    var n = days / f;
    if (Math.abs(n - Math.round(n)) < 1e-9 && Math.round(n) >= 1 && Math.round(n) <= _TC_CADENCE_MAX_N)
      return {n:Math.round(n), unit:u};
  }
  return {n:Math.max(1, Math.min(_TC_CADENCE_MAX_N, Math.round(days))), unit:'day'};
}
function _tcCadenceUnitLabel(unit, n){
  var base = _TC_CADENCE_UNITS[unit] ? unit : 'day';
  return parseInt(n, 10) === 1 ? base : base + 's';
}

var _TC_CYCLE_OPTS = [
  {label:'8 weeks',   days:56},
  {label:'12 weeks',  days:84},
  {label:'16 weeks',  days:112},
  {label:'20 weeks',  days:140},
  {label:'24 weeks',  days:168},
  {label:'6 months',  days:182},
  {label:'9 months',  days:273},
  {label:'12 months', days:365}
];

// ── Backend sync ──────────────────────────────────────────────────────────────

function _tcLoadProfile() {
  var cached = getData('tc-profile');
  if (cached) {
    try { Object.assign(_tcp, JSON.parse(cached)); } catch(e) {}
  }
  // Fetch extra catalog entries (no auth required — generic PK reference data)
  fetch(AGENT_URL + '/trt-catalog')
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(d) {
      if (!Array.isArray(d)) return;
      _tcExtraCatalog = d;
      buildTCalc();
      // If the inventory overlay was opened before this fetch resolved, refresh it
      if (document.getElementById('tc-inv-overlay')) _tcOpenInventory();
    })
    .catch(function(){});
  var h = (typeof authHeaders === 'function') ? authHeaders() : null;
  if (!h) return;
  fetch(AGENT_URL + '/tcalc-profile', {headers: h})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d) {
      if (!d || Object.keys(d).length === 0) return;
      Object.assign(_tcp, d);
      setData('tc-profile', JSON.stringify(_tcp));
      buildTCalc();
    })
    .catch(function(){});
  // Derive birth year from onboarding age in /user-settings
  fetch(AGENT_URL + '/user-settings', {headers: h})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(s) {
      var age = s && parseInt(s['user_age']);
      if (age && age > 0) {
        _tcp.birthYear = new Date().getFullYear() - age;
        _tcAgeMissing = false;
      } else {
        _tcAgeMissing = true;
      }
      buildTCalc();
    })
    .catch(function(){ _tcAgeMissing = true; buildTCalc(); });
  // GH→SHBG interaction parameters (public endpoint, no auth)
  fetch(AGENT_URL + '/systemic-interactions')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d) {
      if (!d || !d.compounds) return;
      _tcSysInter = d.compounds;
      if (d.ftBaseline) _tcFtBaseline = d.ftBaseline;
      if (d.shbgBaseline) _tcShbgBaseline = d.shbgBaseline;
      if (d.shbgBodyFat) _tcShbgBodyFat = d.shbgBodyFat;
      _tcComputeGhStack();
      buildTCalc();
    })
    .catch(function(){});
  // Active peptide stacks — find GH compounds for SHBG model
  fetch(AGENT_URL + '/protocol/stacks', {headers: h})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d) {
      if (!d) return;
      _tcActiveStacks = d;
      _tcComputeGhStack();
      buildTCalc();
    })
    .catch(function(){});
}

function _tcSaveProfile() {
  setData('tc-profile', JSON.stringify(_tcp));
  var h = (typeof authHeaders === 'function') ? authHeaders() : null;
  if (!h) return;
  fetch(AGENT_URL + '/tcalc-profile', {
    method: 'POST',
    headers: Object.assign({'Content-Type':'application/json'}, h),
    body: JSON.stringify(_tcp)
  }).catch(function(){});
  // NOTE: saving the profile/log does NOT touch stored T-History. History is written
  // only by an explicit user action (tcUpdateSavedHistory, the "Update saved history"
  // button) so it never changes on its own. See the HISTORY VIEWS rule in CLAUDE.md.
}

// Saturating Emax dose-response for SHBG suppression: effMaxSupp(dose) = emax·dose/(dose+ed50).
// ed50/emax are calibrated backend-side so effMaxSupp(typicalDose) == the legacy fixed
// maxSuppression, so a user dosed at the reference sees no change; only off-reference doses scale.
function _tcEffMaxSupp(dr, dose) {
  if (!dr || !(dose > 0) || !(dr.ed50 > 0) || !(dr.emax > 0)) return null;
  return dr.emax * dose / (dose + dr.ed50);
}

// Convert an amount between dosing units (mass only; IU is not mass-convertible).
// Units may carry a "/period" suffix (e.g. "mg/week") which is ignored here.
function _tcConvDose(amt, fromU, toU) {
  fromU = String(fromU || '').toLowerCase().split('/')[0].trim();
  toU   = String(toU   || '').toLowerCase().split('/')[0].trim();
  if (fromU === 'µg') fromU = 'mcg';
  if (toU   === 'µg') toU   = 'mcg';
  if (!(amt > 0) || !fromU || !toU) return null;
  if (fromU === toU) return amt;
  if (fromU === 'iu' || toU === 'iu') return null;   // IU ↔ mass is compound-specific — refuse
  var toMg = { mg: 1, mcg: 0.001, g: 1000 };
  if (toMg[fromU] == null || toMg[toU] == null) return null;
  return amt * toMg[fromU] / toMg[toU];
}

// Average daily dose for an SHBG suppressor, expressed in its backend doseResponse unit.
// Chronic SHBG suppression tracks average exposure, so sub-daily schedules are averaged
// over the week (days-per-week / 7). Returns null when the dose can't be resolved or
// converted — the caller then falls back to the fixed maxSuppression.
function _tcSuppDailyDose(inter, kind, obj) {
  var dr = inter && inter.shbg && inter.shbg.doseResponse;
  if (!dr || !dr.unit || !obj) return null;
  var nativeDaily = 0, nativeUnit = '';
  if (kind === 'peptide') {
    var times = obj.times || ['AM'];
    var _slots = (typeof TIME_SLOTS!=='undefined') ? TIME_SLOTS : ['AM','PM'];
    var per = _slots.reduce(function(sum, t){
      if (times.indexOf(t) < 0) return sum;
      return sum + (parseDec(obj['dose_' + t.toLowerCase()]) || 0);
    }, 0);
    var dpw = (obj.days || [0, 1, 2, 3, 4, 5, 6]).length;
    nativeDaily = per * dpw / 7;
    nativeUnit = obj.unit_am || obj.unit_pm || 'µg';
  } else if (kind === 'compound') {
    var raw = parseDec(obj.dose) || 0;
    var parts = String(obj.unit || 'mg/week').split('/');
    var period = (parts[1] || 'week').toLowerCase();
    var factor = (period === 'day') ? 1 : (period === 'eod' || period === '2day') ? 0.5 : 1 / 7;
    nativeDaily = raw * factor;
    nativeUnit = parts[0] || 'mg';
  } else if (kind === 'supp') {
    var rawS = parseDec(obj.dose) || 0;
    var m = String(obj.dose || '').match(/(mcg|µg|mg|iu|g)/i);
    nativeUnit = m ? m[1] : 'mg';
    var f = (obj.freq === 'weekly') ? 1 / 7 : (obj.freq === 'eod') ? 0.5 : 1;
    nativeDaily = rawS * f;
  }
  return _tcConvDose(nativeDaily, nativeUnit, dr.unit);
}

function _tcComputeGhStack() {
  if (!_tcSysInter) return;
  _tcGhStack = [];
  if (_tcActiveStacks) {
  var idxs = _tcActiveStacks.active_indices ||
    (_tcActiveStacks.active_index != null ? [_tcActiveStacks.active_index] : []);
  idxs.forEach(function(idx) {
    var stack = (_tcActiveStacks.stacks || [])[idx];
    if (!stack) return;
    var cycleStart = stack.cycle_start || '';
    // Peptides — each entry has its own start_date
    (stack.peptides || []).forEach(function(pep) {
      var pepId = pep.id;
      if (!pepId || !_tcSysInter[pepId]) return;
      var inter = _tcSysInter[pepId];
      if (!inter.shbg || inter.shbg.direction !== 'suppress') return;
      _tcGhStack.push({pepId: pepId, startDateStr: pep.start_date || cycleStart, interactions: inter, dailyDose: _tcSuppDailyDose(inter, 'peptide', pep)});
    });
    // Enhanced compounds — no per-compound start_date, fall back to cycle_start
    if (stack.enhanced && stack.enhanced.compounds) {
      (stack.enhanced.compounds || []).forEach(function(c) {
        var cId = c.id;
        if (!cId || !_tcSysInter[cId]) return;
        var inter = _tcSysInter[cId];
        if (!inter.shbg || inter.shbg.direction !== 'suppress') return;
        _tcGhStack.push({pepId: cId, startDateStr: c.start_date || cycleStart, interactions: inter, dailyDose: _tcSuppDailyDose(inter, 'compound', c)});
      });
    }
    // TRT compounds — same fallback
    if (stack.trt && stack.trt.compounds) {
      (stack.trt.compounds || []).forEach(function(c) {
        var cId = c.id;
        if (!cId || !_tcSysInter[cId]) return;
        var inter = _tcSysInter[cId];
        if (!inter.shbg || inter.shbg.direction !== 'suppress') return;
        _tcGhStack.push({pepId: cId, startDateStr: c.start_date || cycleStart, interactions: inter, dailyDose: _tcSuppDailyDose(inter, 'compound', c)});
      });
    }
  });
  }
  // Over-the-counter supplements that affect SHBG (e.g. Boron). Uses the same
  // systemic-interaction model as compounds. The SHBG-model start date is the day the
  // supplement was FIRST CHECKED in the today view (from the supplement log), so it
  // counts from when you actually started taking it — falling back to any explicit
  // start_date. No manual start date needed for a supplement to move the free-T curve.
  var _supps = (typeof _supplements !== 'undefined' && _supplements) ? _supplements : [];
  _supps.forEach(function(s) {
    if (!s || !s.supp_id) return;
    var inter = _tcSysInter[s.supp_id];
    if (!inter || !inter.shbg || inter.shbg.direction !== 'suppress') return;
    var _start = _tcSuppFirstTaken(s.supp_id) || s.start_date || '';
    _tcGhStack.push({pepId: 'supp_' + s.supp_id, startDateStr: _start, interactions: inter, dailyDose: _tcSuppDailyDose(inter, 'supp', s)});
  });
}

// Earliest date a supplement was checked ("taken") in the today view, read from the
// supplement log (_suppLog keys are "suppId|YYYY-MM-DD|slot"). '' if never taken.
function _tcSuppFirstTaken(suppId) {
  if (typeof _suppLog === 'undefined' || !_suppLog) return '';
  var best = '';
  Object.keys(_suppLog).forEach(function(k) {
    if (!_suppLog[k]) return;
    var p = k.split('|');
    if (p[0] !== suppId || !p[1]) return;
    if (!best || p[1] < best) best = p[1];
  });
  return best;
}

// ── Compound helpers ──────────────────────────────────────────────────────────

// Every ester the planners can pick from: the frontend's TRT_CAT plus whatever the
// backend catalogue serves, de-duped. The backend is the source of truth for the PK of
// esters present in both, so an id that appears in both must still be listed once.
// HCG is deliberately excluded — this list feeds testosterone planning only.
function _tcAllCompIds() {
  var ids = [];
  ((typeof TRT_CAT !== 'undefined') ? TRT_CAT.map(function(c){ return c.id; }) : [])
    .concat(_tcExtraCatalog.map(function(c){ return c.id; }))
    .forEach(function(id){ if (id && ids.indexOf(id) === -1) ids.push(id); });
  return ids;
}

function _tcCompInfo(compId) {
  if (compId === 'hcg') {
    return {id:'hcg', name:'HCG', dot:'#44cc88', halfLifeDays:2.5, halfLifeStr:'~60 hours'};
  }
  // Extra catalog entries (fetched from backend) take priority over hardcoded fallbacks
  var extra = _tcExtraCatalog.find(function(x){ return x.id === compId; });
  if (extra) {
    return {
      id:              compId,
      name:            extra.name,
      dot:             extra.dot,
      halfLifeDays:    extra.halfLifeDays || 1,
      // Depot esters have a genuinely wide half-life range — the backend serves low/high
      // where the literature spread is material (see the backend's
      // docs/enhanced-bodybuilding/11-testosterone-undecanoate-pk.md). Absent an explicit
      // range, low == high == central and no band is drawn.
      halfLifeDaysLow:  extra.halfLifeDaysLow  || extra.halfLifeDays || 1,
      halfLifeDaysHigh: extra.halfLifeDaysHigh || extra.halfLifeDays || 1,
      halfLifeNote:    extra.halfLifeNote || '',
      halfLifeStr:     extra.halfLife || '',
      bioavailability: extra.bioavailability || 1,
      maxDailyDoseMg:  extra.maxDailyDoseMg || null,
      usageNote:       extra.usageNote || '',
      // Documented time-to-peak, where the compound's label/SmPC states one. Drives the
      // absorption constant via _tcKa — see that function. Absent for compounds whose
      // labels state no tmax (cypionate, propionate, gel), which keep the bucket default.
      tmaxDays:        extra.tmaxDays || 0,
      // Mass of testosterone per mass of ester = MW(testosterone) / MW(ester).
      // Backend-served where present; the fallback below is the molecular-weight ratio,
      // a physical constant rather than compound data.
      testosteroneFraction: extra.testosteroneFraction || _TC_T_FRACTION[compId] || 1
    };
  }
  var cat   = (typeof TRT_CAT   !== 'undefined') ? TRT_CAT.find(function(x){ return x.id === compId; })   : null;
  var guide = (typeof TRT_GUIDE !== 'undefined') ? TRT_GUIDE[compId] : null;
  var hl    = guide ? (_parseHalfLifeDays(guide.halfLife) || 7) : 7;
  return {
    id:           compId,
    name:         cat   ? cat.name  : compId,
    dot:          cat   ? cat.dot   : '#e8a020',
    halfLifeDays: hl,
    halfLifeDaysLow:  hl,
    halfLifeDaysHigh: hl,
    halfLifeNote: '',
    halfLifeStr:  guide ? guide.halfLife : '',
    // The offline path must carry the ester correction too. Without this the whole
    // fraction is silently 1 whenever the /trt-catalog fetch fails — the model would
    // quietly go back to treating a 100 mg undecanoate dose as 100 mg of testosterone
    // (it is 63.1 mg), which is the exact error the field exists to fix.
    testosteroneFraction: _TC_T_FRACTION[compId] || 1
  };
}

// Testosterone mass fraction of each ester = MW(testosterone, 288.4) / MW(ester).
// Physical constants (molecular weights), not compound data — the same class as the
// Vermeulen binding constants below. Backend-served via /trt-catalog; this is the
// offline fallback. Every weight is from PubChem, recorded in the backend's
// docs/enhanced-bodybuilding/sources/pubchem-*.txt:
//   propionate C22H32O3 344.5 | enanthate C26H40O3 400.6
//   cypionate  C27H40O3 412.6 | undecanoate C30H48O3 456.7
// Sustanon 250 is a blend: 30 mg propionate + 60 phenylpropionate + 60 isocaproate +
// 100 decanoate (SmPC composition), whose testosterone masses sum to 176.2 mg of the
// 250 mg label dose -> 0.7046.
// ── TESTOSTERONE IS TESTOSTERONE, WHATEVER TIER IT IS FILED UNDER ────────────
// The same drug carries two ids depending on where it was configured: the TRT tier
// uses the /trt-catalog ids (nebido, enanthate, …) and the Enhanced tier uses the
// enhanced-catalogue ids (test_u, test_e, …). The free-T model only ever accepted
// tier === 'trt', so a user whose testosterone lives in an Enhanced protocol had
// EVERY dose discarded — past and planned.
//
// Found 2026-08-14 by reading the record rather than the UI. One account's prod data:
// 4 logged enhanced doses (8/10/12/14 Aug, 100 mg each) missing from the curve, which
// is what produced the reported plateau, and 26 scheduled enhanced doses against 0 trt
// ones, so the entire forward projection decayed to baseline as if the protocol had
// stopped.
var _TC_TESTO_ALIAS = {
  test_u: 'nebido', test_e: 'enanthate', test_c: 'cypionate',
  test_p: 'propionate', sustanon: 'sustanon'
};
// The canonical id for PK lookup and for de-duplication. Returning the same id for
// both spellings is what stops one injection recorded under both tiers on the same day
// counting twice — the curve de-duplicates on (compId|date), so the key must not depend
// on which tier the row came from.
function _tcCanonCompId(compId){
  var c = String(compId || '');
  return Object.prototype.hasOwnProperty.call(_TC_TESTO_ALIAS, c) ? _TC_TESTO_ALIAS[c] : c;
}
// Does this row describe injected testosterone the free-T model should account for?
// tier 'trt' always; tier 'enhanced' only for a known testosterone ester. Everything
// else in an Enhanced stack (nandrolone, GH, orals) is deliberately NOT testosterone
// and must not be fed to a testosterone PK model.
function _tcIsTestoRow(tier, compId){
  if (tier === 'trt') return true;
  if (tier !== 'enhanced') return false;
  return Object.prototype.hasOwnProperty.call(_TC_TESTO_ALIAS, String(compId || ''));
}

var _TC_T_FRACTION = {
  propionate:  0.8372,
  enanthate:   0.7199,
  testoviron:  0.7199,
  cypionate:   0.6990,
  nebido:      0.6315,
  sustanon:    0.7046,
  topical:     1.0
};

// ─────────────────────────────────────────────────────────────────────────────
// FREE-T MODEL — ABSOLUTE, NOT SCALE-FITTED. Read this before changing it.
//
// The curve is computed from physiology and calibrated by SOLVING for the user's
// own baseline. It is never scaled to make a single lab value land on the line.
//
//   total[t]  = testosterone APPEARANCE RATE, mg/day  (ke * PkConc, integrates to
//               the injected mass) + endogenous production P
//   TT(t)     = TT_base * total[t] / P
//   FT(t)     = Vermeulen(TT(t), SHBG(t))
//
// Testosterone's own elimination half-life is ~1 h, far faster than any depot's
// release, so serum level tracks appearance rate and the SAME clearance applies to
// endogenous and injected testosterone. That is what makes the ratio total/P the
// whole story, and why no scale factor is needed.
//
// WHY THE OLD ARCHITECTURE FAILED (do not reintroduce it). It picked calFT so the
// curve passed through one measured free T, and it invented an "endogenous baseline"
// from the drug curve itself (the peak/trough mean, or total[today]). That slab set
// the entire multiplier while meaning nothing physically, so the same protocol with
// the same labs returned 435-15789 pmol/L depending only on how far into it you were.
// Prod projected 8457 pmol/L for a protocol whose true plateau is ~1565, and its curve
// missed the user's own measured baseline by 3x. Both directions, one cause.
//
// calFT_arr[t] is now just FT(t)/total[t] — the conversion from appearance rate to
// free T at time t — kept so existing callers still render total[t]*calFT_arr[t].
// It is NOT a fitted constant. Do not "restore" a calibration factor.
// ─────────────────────────────────────────────────────────────────────────────

// HPTA suppression: your own production is NOT a constant once you inject.
// Exogenous androgen suppresses LH/FSH, so endogenous output falls toward zero — at
// supraphysiological doses it is essentially fully shut down. Adding a fixed P at every
// timepoint therefore overstates the plateau: for a 100 mg TU q2d protocol the modelled
// steady state ran (rate+P)/P instead of (rate+P_suppressed)/P, about 20% high.
//
// Shape: P(rate) = P0 * exp(-rate/P0). It is a MODEL, not a retrieved curve — but it
// introduces NO new free parameter, because the scale is P0 itself, which is the
// physiologically natural choice: feedback is set by how far exogenous input exceeds
// your own output. Behaviour it produces:
//   rate 0            -> P0          (pre-cycle: unsuppressed, so a baseline draw still
//                                     calibrates against true unsuppressed production)
//   rate = P0         -> 0.37 * P0   (a replacement-level dose partly suppresses)
//   rate = 4.9 * P0   -> 0.008 * P0  (supraphysiological: effectively shut down)
// The near-complete suppression at supraphysiological doses is well established; the
// exact curve between those points is this model's assumption and is labelled as such.
function _tcEndogAt(drugRateMgd, p0) {
  if (!(p0 > 0)) return 0;
  var r = drugRateMgd > 0 ? drugRateMgd : 0;
  return p0 * Math.exp(-r / p0);
}

// Endogenous testosterone production, mg/day. The one link between "my own level" and
// "mg I inject", so it sets how far above baseline any protocol lands.
//
// 5, not the 6.5 used until 2026-08-02. Handelsman's Endotext chapter "Androgen
// Physiology, Pharmacology, Use and Misuse" sources a tracer-derived range of 3-10
// mg/day, and anchors it concretely: an 800 mg implant "releasing ~5 mg per day
// ... replicating the testosterone production rate in healthy eugonadal men".
// Nothing published states 6.5 — it was a mid-range guess. Backend
// ENDOGENOUS_T_PRODUCTION carries the full citation; keep the two in step.
var TCALC_ENDOG_T_MGD = 5;

// ── Vermeulen free-T calculator ───────────────────────────────────────────────

// ── Vermeulen binding: the SATURABLE quadratic, not a linearisation ──
// Testosterone OCCUPIES SHBG's binding sites, so the free fraction is not a constant:
// as total T rises SHBG saturates and free T rises FASTER than proportionally. Solving
// the law of mass action gives a quadratic in free T.
//
// This replaced a linearised form, FT = TT/(1 + K_SHBG*[SHBG] + K_ALB*[Alb]), which pins
// the free fraction at ~2.08% at every level — 2x total T gave exactly 2x free T. That is
// acceptable near baseline, where SHBG is only partly occupied, and badly wrong above it:
// at a supraphysiological TT ~65-78 nmol/L the true free fraction is ~3%, so the linear
// form under-reported free T by ~51% (1565 vs 2368 pmol/L on a real user's protocol).
// Under-reporting free androgen is the direction that invites dose escalation.
// Independently verified 2026-08-01. Do not "simplify" this back to a constant fraction.
var TCALC_K_SHBG = 1.0e9;   // L/mol, testosterone-SHBG association constant (Vermeulen)
var TCALC_K_ALB  = 3.6e4;   // L/mol, testosterone-albumin
var TCALC_ALB_GL = 43;      // g/L, assumed albumin (Vermeulen's default)
var TCALC_ALB_MW = 66430;   // g/mol

function _tcAlbN() {
  return 1 + TCALC_K_ALB * (TCALC_ALB_GL / TCALC_ALB_MW);
}

// totalT and shbg in nmol/L -> free T in pmol/L.
function _tcVermeulenFT(totalT, shbg) {
  if (!totalT || !shbg || totalT <= 0 || shbg <= 0) return null;
  var T = totalT * 1e-9, S = shbg * 1e-9;
  var N = _tcAlbN();
  var a = TCALC_K_SHBG * N;
  var b = N + TCALC_K_SHBG * (S - T);
  var disc = b * b + 4 * a * T;
  if (!(disc >= 0)) return null;
  var ft = (-b + Math.sqrt(disc)) / (2 * a);
  return ft > 0 ? ft * 1e12 : null;
}

// free T in pmol/L + SHBG in nmol/L -> total T in nmol/L. Exact inverse of the above.
function _tcInvVermeulenTT(freeFT, shbg) {
  if (!(freeFT > 0) || !(shbg > 0)) return 0;
  var FT = freeFT * 1e-12, S = shbg * 1e-9;
  var tt = FT * _tcAlbN() + TCALC_K_SHBG * S * FT / (1 + TCALC_K_SHBG * FT);
  return tt * 1e9;
}

// Population SHBG baseline (nmol/L) for an age, from the backend age→SHBG table.
// 0 when the table isn't loaded or the age is unknown (model then can't run).
function _tcShbgBaselineForAge(age) {
  var b = _tcShbgBaseline;
  if (!b || !b.bands || !(age > 0)) return 0;
  for (var i = 0; i < b.bands.length; i++) {
    if (age <= b.bands[i].max_age) return b.bands[i].value;
  }
  return b.bands[b.bands.length - 1].value;
}

// Body-fat multiplier on the population SHBG baseline. Adiposity lowers SHBG, so a
// leaner person of the same age runs a higher SHBG (→ lower free-T fraction). Pure +
// testable. Returns 1 (no change) when BF% is unknown or params are missing. Applied
// ONLY to the population estimate — a measured SHBG is never touched.
function _tcShbgBodyFatFactor(bf, sex) {
  if (!(bf > 0)) return 1;
  var cfg = _tcShbgBodyFat || _TC_SHBG_BF_FALLBACK;
  if (!cfg) return 1;
  sex = (sex === 'female') ? 'female' : 'male';
  var ref = cfg.ref_pct && cfg.ref_pct[sex];
  var k   = cfg.per_pct_k && cfg.per_pct_k[sex];
  if (!(ref > 0) || !(k > 0)) return 1;
  var f  = Math.exp(-k * (bf - ref));
  var lo = (cfg.min_factor > 0) ? cfg.min_factor : 0.5;
  var hi = (cfg.max_factor > 0) ? cfg.max_factor : 1.6;
  return Math.max(lo, Math.min(hi, f));
}

// Nudge a chart label's y so it stays at least `gap` px clear of any already-placed
// label y, moving away from the collision and clamping to [lo,hi]. Keeps the peak /
// today / average axis labels readable when the curve is flat (tight zooms) and their
// values land on top of each other. Pure + testable.
function _tcNudgeLabelY(y, used, gap, lo, hi) {
  y = Math.max(lo, Math.min(hi, y));
  var moved = true, guard = 0;
  while (moved && guard++ < 50) {
    moved = false;
    for (var i = 0; i < (used || []).length; i++) {
      if (Math.abs(y - used[i]) < gap) {
        y = (y <= used[i]) ? (used[i] - gap) : (used[i] + gap);
        y = Math.max(lo, Math.min(hi, y));
        moved = true;
      }
    }
  }
  return y;
}

// ── PK helpers ────────────────────────────────────────────────────────────────

// Time to peak for a 1-compartment depot: tmax = ln(ka/ke)/(ka-ke). Exported for tests.
function _tcTmax(ka, ke) {
  if (!(ka > 0) || !(ke > 0) || Math.abs(ka - ke) < 1e-12) return 1 / ke;
  return Math.log(ka / ke) / (ka - ke);
}

// Solve the absorption constant that reproduces an OBSERVED tmax, given the half-life.
// Returns null when no ka > ke can produce that tmax — tmax is bounded above by 1/ke
// (= halfLife/ln2), so a documented tmax beyond it is inconsistent with this model and
// must fall back rather than silently fit something else.
function _tcKaFromTmax(halfLifeDays, tmaxDays) {
  if (!(halfLifeDays > 0) || !(tmaxDays > 0)) return null;
  var ke = Math.LN2 / halfLifeDays;
  if (tmaxDays >= 1 / ke) return null;
  // tmax decreases monotonically in ka for ka > ke, so bisect on that branch.
  var lo = ke * 1.0000001, hi = 500;
  if (_tcTmax(hi, ke) > tmaxDays) return null;      // even a huge ka peaks too late
  for (var i = 0; i < 80; i++) {
    var mid = (lo + hi) / 2;
    if (_tcTmax(mid, ke) > tmaxDays) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function _tcKa(halfLifeDays, tmaxDays) {
  // Absorption rate constant (1/day) for the 1-compartment depot model.
  //
  // PREFERRED PATH: when the backend serves a documented tmax for the compound
  // (tmaxDays, sourced from its label/SmPC), ka is SOLVED so the modelled peak lands
  // where the document says it does. That makes the curve's shape evidence-based in the
  // same way halfLifeDays makes its decay evidence-based, instead of inheriting whichever
  // bucket the half-life happened to fall in.
  //
  // Documented tmax values (all primary-verified, see the backend catalogue):
  //   enanthate/testoviron 1.5-3 d (Testoviron SmPC) · nebido median 7 d (AVEED §12.3)
  //   sustanon 24-48 h (Sustanon SmPC)
  // The old buckets put enanthate's peak at ~1.0 d against a documented 1.5-3 d, and
  // nebido's at ~9.0 d against a documented median of 7 d.
  var solved = _tcKaFromTmax(halfLifeDays, tmaxDays);
  if (solved !== null) return solved;

  // FALLBACK, for compounds with no documented tmax (cypionate, propionate, gel — their
  // labels state none). Bucketed by half-life, as before.
  //   Nebido (hl≥20d) → tmax≈7d | Cypionate (hl≥9d) → tmax≈2d
  //   Enanthate (hl≥3d) → tmax≈1d | Propionate (hl≥0.5d) → tmax≈0.4d | Gel → near-immediate
  // The propionate boundary is 0.5 d, not 1 d: propionate's half-life was corrected to
  // the published 0.8 d (2026-07-29), and at a 1 d boundary that would have dropped it
  // into the near-immediate bucket — halving its tmax from ~9.8 h to ~4.8 h as a silent
  // rider on the half-life change. At ka 8 it keeps tmax ≈ 7.5 h, closest to the ≈0.4 d
  // this table is calibrated to. No other compound sits in [0.5, 1) d.
  if (halfLifeDays >= 20)  return 0.40;
  if (halfLifeDays >= 9)   return 1.50;
  if (halfLifeDays >= 3)   return 3.00;
  if (halfLifeDays >= 0.5) return 8.00;
  return 15.0;
}

function _tcPkConc(dose, ka, ke, dt) {
  // 1-compartment first-order absorption model:
  // C(dt) = dose * ka/(ka-ke) * (exp(-ke*dt) - exp(-ka*dt))
  if (dt < 0) return 0;
  if (Math.abs(ka - ke) < 1e-9) return dose * ke * dt * Math.exp(-ke * dt);
  return dose * ka / (ka - ke) * (Math.exp(-ke * dt) - Math.exp(-ka * dt));
}

function _tcPeakTroughRatio(halfLifeDays, intervalDays) {
  return Math.exp(Math.LN2 / halfLifeDays * intervalDays);
}

function _tcSnapInterval(targetDays) {
  var opts = [1, 2, 7/3, 3.5, 7, 10, 14, 21, 42, 56, 70, 84];
  var best = opts[0], bestDist = Infinity;
  opts.forEach(function(d) {
    var dist = Math.abs(d - targetDays);
    if (dist < bestDist) { bestDist = dist; best = d; }
  });
  return best;
}

function _tcIntervalLabel(days) {
  var opt = _TC_FREQ_OPTS.find(function(f){ return Math.abs(f.days - days) < 0.25; });
  return opt ? opt.label : days.toFixed(1) + '-day interval';
}

// ── Inventory overlay ─────────────────────────────────────────────────────────

function _tcCategorizeComps() {
  var cats = [
    {label:'SHORT ESTERS',  borderColor:'#e8a020', ids:[]},
    {label:'MEDIUM ESTERS', borderColor:'#6688cc', ids:[]},
    {label:'LONG ESTERS',   borderColor:'#8866cc', ids:[]},
    {label:'DEPOT',         borderColor:'#44aa88', ids:[]}
  ];
  // De-dupe: the backend catalogue now serves PK for esters that are ALSO in the
  // frontend's TRT_CAT (it is the source of truth for their half-lives, not just a
  // source of extra compounds). Concatenating blind listed those esters twice in
  // the inventory picker. _tcAllCompIds already de-duped; this path did not.
  var trtIds = [];
  ((typeof TRT_CAT !== 'undefined') ? TRT_CAT.map(function(c){ return c.id; }) : [])
    .concat(_tcExtraCatalog.map(function(c){ return c.id; }))
    .forEach(function(id){ if (trtIds.indexOf(id) === -1) trtIds.push(id); });
  trtIds.forEach(function(id) {
    var hl = _tcCompInfo(id).halfLifeDays;
    if      (hl < 3)  cats[0].ids.push(id);
    else if (hl < 9)  cats[1].ids.push(id);
    else if (hl < 20) cats[2].ids.push(id);
    else              cats[3].ids.push(id);
  });
  return cats.filter(function(c){ return c.ids.length > 0; });
}

function _tcOpenInventory() {
  var equippedIds = _tcp.inventory.map(function(i){ return i.compId; });
  var cats = _tcCategorizeComps();

  var iSty = 'background:#0a0a0a;border:1px solid #2a2a2a;border-radius:6px;padding:8px 10px;color:#ccc;font-size:14px;font-family:inherit;outline:none;width:100%;box-sizing:border-box';

  function cardHtml(id, isHCG) {
    var cd  = _tcCompInfo(id);
    var inv = _tcp.inventory.find(function(i){ return i.compId === id; });
    var eq  = !!inv;
    var unit = isHCG ? 'IU' : 'mg';

    if (eq) {
      return '<div style="background:#0a0a0a;border:2px solid ' + cd.dot + ';border-radius:14px;padding:14px;box-shadow:0 0 20px ' + cd.dot + '33">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">' +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:7px">' +
              '<span style="width:9px;height:9px;border-radius:50%;background:' + cd.dot + ';display:inline-block;flex-shrink:0;box-shadow:0 0 8px ' + cd.dot + '"></span>' +
              '<span style="font-size:13px;font-weight:800;color:#fff;letter-spacing:0.3px">' + _esc(cd.name) + '</span>' +
            '</div>' +
            (cd.halfLifeStr ? '<div style="font-size:10px;color:#555;margin-top:3px;padding-left:16px">t½ ' + _esc(cd.halfLifeStr) + '</div>' : '') +
          '</div>' +
          '<button onclick="_tcToggleCompound(\'' + id + '\')" style="background:none;border:none;color:#444;font-size:20px;cursor:pointer;padding:0;line-height:1;margin-top:-2px">✕</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<div>' +
            '<div style="font-size:9px;color:#444;letter-spacing:1.2px;font-weight:700;margin-bottom:5px">STOCK (' + unit + ')</div>' +
            '<input type="text" inputmode="decimal" value="' + _esc(inv.totalMg || '') + '" placeholder="' + (isHCG ? '5000' : '1000') + '" onchange="_tcInvSetField(\'' + id + '\',\'totalMg\',this.value)" style="' + iSty + '">' +
          '</div>' +
          '<div>' +
            '<div style="font-size:9px;color:#444;letter-spacing:1.2px;font-weight:700;margin-bottom:5px">TOTAL PAID</div>' +
            '<input type="text" inputmode="decimal" value="' + _esc(inv.costTotal || '') + '" placeholder="e.g. 45" onchange="_tcInvSetField(\'' + id + '\',\'costTotal\',this.value)" style="' + iSty + '">' +
          '</div>' +
        '</div>' +
        (cd.usageNote ? '<div style="font-size:10px;color:#555;margin-top:10px;line-height:1.4">' + _esc(cd.usageNote) + '</div>' : '') +
      '</div>';
    } else {
      return '<div onclick="_tcToggleCompound(\'' + id + '\')" style="background:#0d0d0d;border:1px solid #1e1e1e;border-radius:14px;padding:14px;cursor:pointer;position:relative;overflow:hidden">' +
        '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,' + cd.dot + '44,transparent)"></div>' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + cd.dot + '55;display:inline-block"></span>' +
        '<div style="font-size:13px;font-weight:800;color:#555;margin-top:8px;letter-spacing:0.3px">' + _esc(cd.name) + '</div>' +
        (cd.halfLifeStr ? '<div style="font-size:10px;color:#333;margin-top:3px">t½ ' + _esc(cd.halfLifeStr) + '</div>' : '') +
        '<div style="font-size:9px;color:#2a2a2a;letter-spacing:1.2px;font-weight:700;margin-top:10px">TAP TO EQUIP</div>' +
      '</div>';
    }
  }

  var html = '<div id="tc-inv-overlay" onclick="if(event.target===this)_tcCloseInventory()" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);backdrop-filter:blur(16px);overflow-y:auto;-webkit-overflow-scrolling:touch">' +
    '<div style="max-width:480px;margin:0 auto;padding:16px 16px 60px">';

  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 24px">' +
    '<div>' +
      '<div style="font-size:11px;color:#444;letter-spacing:2px;font-weight:700;margin-bottom:4px">T-CALC</div>' +
      '<div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:0.5px">⚗ COMPOUND INVENTORY</div>' +
      '<div style="font-size:12px;color:#444;margin-top:4px">' + equippedIds.length + ' compound' + (equippedIds.length === 1 ? '' : 's') + ' equipped</div>' +
    '</div>' +
    '<button onclick="_tcCloseInventory()" style="background:#111;border:1px solid #333;border-radius:10px;color:#777;font-size:24px;cursor:pointer;padding:4px 14px;line-height:1;font-family:inherit">×</button>' +
  '</div>';

  // Compound categories
  cats.forEach(function(cat) {
    html += '<div style="display:flex;align-items:center;gap:10px;margin:20px 0 12px">' +
      '<div style="height:1px;width:16px;background:' + cat.borderColor + '44"></div>' +
      '<div style="font-size:10px;color:#444;letter-spacing:1.8px;font-weight:700;white-space:nowrap">' + cat.label + '</div>' +
      '<div style="flex:1;height:1px;background:' + cat.borderColor + '22"></div>' +
    '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    cat.ids.forEach(function(id) { html += cardHtml(id, false); });
    html += '</div>';
  });

  // Support / HCG
  html += '<div style="display:flex;align-items:center;gap:10px;margin:20px 0 12px">' +
    '<div style="height:1px;width:16px;background:#44cc8844"></div>' +
    '<div style="font-size:10px;color:#444;letter-spacing:1.8px;font-weight:700">SUPPORT</div>' +
    '<div style="flex:1;height:1px;background:#44cc8822"></div>' +
  '</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  html += cardHtml('hcg', true);
  html += '</div>';

  html += '</div></div>';

  var existing = document.getElementById('tc-inv-overlay');
  if (existing) existing.remove();
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  document.body.appendChild(tmp.firstChild);
}

function _tcCloseInventory() {
  var el = document.getElementById('tc-inv-overlay');
  if (el) el.remove();
  buildTCalc();
}

function _tcToggleCompound(compId) {
  var idx = _tcp.inventory.findIndex(function(i){ return i.compId === compId; });
  if (idx === -1) {
    _tcp.inventory.push({compId: compId, totalMg: '', costTotal: ''});
  } else {
    _tcp.inventory.splice(idx, 1);
  }
  _tcSaveProfile();
  _tcOpenInventory();
  buildTCalc();
}

function _tcInvSetField(compId, field, val) {
  var inv = _tcp.inventory.find(function(i){ return i.compId === compId; });
  if (!inv) return;
  inv[field] = val;
  _tcSaveProfile();
  buildTCalc();
}

// ── Manual injection log overlay ──────────────────────────────────────────────

function _tcManualComps() {
  var ids = [];
  ((typeof TRT_CAT !== 'undefined') ? TRT_CAT : []).forEach(function(c) {
    if (c.id !== 'hcg') ids.push(c.id);
  });
  _tcExtraCatalog.forEach(function(c) {
    if (c.id !== 'hcg' && ids.indexOf(c.id) === -1) ids.push(c.id);
  });
  return ids;
}

// ── Simple planner ────────────────────────────────────────────────────────────
// Ester + dose + cadence, and the curve renders. The advanced manual log is still
// there underneath for multi-compound work, historical injections and what-ifs —
// this is a second way in, not a replacement.

// Which planner is live. An explicit choice always wins. Absent one, a profile that
// already has a manual log stays on ADVANCED so nothing an existing user built
// changes underneath them; a fresh profile starts SIMPLE.
function _tcPlannerMode(){
  var m = _tcp && _tcp.plannerMode;
  if (m === 'simple' || m === 'advanced') return m;
  return ((_tcp && _tcp.manualLog && _tcp.manualLog.length) ? 'advanced' : 'simple');
}

function _tcSetPlannerMode(mode){
  if (mode !== 'simple' && mode !== 'advanced') return;
  _tcp.plannerMode = mode;
  _tcSaveProfile();
  buildTCalc();
}

// Toggle handler for the advanced switch — turning it ON makes advanced live and
// greys the simple planner; turning it OFF does the reverse. Neither discards data.
function _tcToggleAdvancedPlanner(el){
  _tcSetPlannerMode((el && el.checked) ? 'advanced' : 'simple');
}

// ── The plan lives in the stack, not beside it ────────────────────────────────
// The simple planner used to keep its own {compId, doseMg, cadence, startDate} in
// tcalc_profiles.json and generate injections from it. That is a testosterone
// schedule existing outside a stack, which is the thing this app is not allowed to
// have — and it produced exactly the contradiction reported on 2026-08-07: the plan
// card read "Testoviron Depot · 75 mg · every 2 days from 4 Aug" while the protocol
// it was assigned to held Nebido 100 mg, and _tcCurveLog's "the plan owns this day"
// rule then SUPPRESSED the stack's real injections in favour of the stale plan.
//
// Once a stack is chosen, the stack's TRT config IS the plan: the card reads from it
// and every edit writes back to it. _tcp.simplePlan remains only for the unassigned
// case — a draft being built before "Save to stack" gives it a home.
//
// The planner can express ONE ester on ONE cadence. A stack whose TRT tier holds more
// than one compound cannot be represented by it, so that stack is not adopted here
// and the advanced planner stays the place to edit it (see _tcSimplePlanStack).
function _tcSimplePlanStack(){
  var tid = _tcp && _tcp.targetStackId;
  if (!tid || typeof _userStacks === 'undefined' || !_userStacks) return null;
  var st = _userStacks.find(function(s){ return s && s.id === tid; });
  if (!st || !st.trt || !st.trt.enabled) return null;
  var comps = st.trt.compounds || [];
  if (comps.length !== 1) return null;
  return st;
}

// The plan as the bound stack states it. Cadence comes from the same freqVal/freqUnit
// pair the injection generator reads, so what the card shows and what gets injected
// cannot drift apart.
function _tcPlanFromStack(st){
  var c = (st.trt.compounds || [])[0] || {};
  var n = parseInt(c.freqVal, 10); if (!(n > 0)) n = 1;
  var unit = (c.freqUnit === 'weeks') ? 'week' : 'day';
  return {
    compId:      c.id || '',
    doseMg:      String(c.dose || ''),
    cadenceN:    n,
    cadenceUnit: unit,
    cadenceDays: _tcCadenceToDays(n, unit),
    startDate:   c.start_date || st.cycle_start || ''
  };
}

// ── Edits are a draft until Save is pressed ──────────────────────────────────
// Writing each keystroke straight into the protocol was silent: "right now it
// redraws the graph but how do I know if this update actually rewrote the TRT
// schedule?" (Henrik 2026-08-07). Rewriting a stored schedule is not something to
// infer from a chart moving.
//
// So a bound plan edits an in-memory draft. The curve previews it — that is what
// T-Calc is for — but the card says in words that the protocol still holds the old
// values, and nothing reaches the backend until Save. Discard drops the draft.
//
// The draft is deliberately NOT persisted anywhere. A half-finished plan surviving a
// reload is another store that can disagree with the protocol, which is the whole
// class of bug this tab has been fighting.
var _tcPlanDraft = null;   // {stackId, compId, doseMg, cadenceN, cadenceUnit, cadenceDays, startDate}

function _tcDraftFor(st){
  return (_tcPlanDraft && st && _tcPlanDraft.stackId === st.id) ? _tcPlanDraft : null;
}

// What the protocol actually holds right now, ignoring any draft on top of it.
function _tcStoredPlan(){
  var st = _tcSimplePlanStack();
  return st ? _tcPlanFromStack(st) : null;
}

var _TC_PLAN_FIELDS = ['compId','doseMg','cadenceN','cadenceUnit','cadenceDays','startDate'];

// Which fields the draft would change. Empty = nothing to save.
function _tcPlanChanges(){
  var st = _tcSimplePlanStack(); if (!st) return [];
  var d  = _tcDraftFor(st);      if (!d)  return [];
  var stored = _tcPlanFromStack(st);
  return _TC_PLAN_FIELDS.filter(function(k){ return String(d[k]) !== String(stored[k]); });
}
function _tcPlanDirty(){ return _tcPlanChanges().length > 0; }

function _tcSimplePlan(){
  var _st = _tcSimplePlanStack();
  if (_st) return _tcDraftFor(_st) || _tcPlanFromStack(_st);
  var p = (_tcp && _tcp.simplePlan) || {};
  var days = parseDec(p.cadenceDays) || 0;
  var n    = parseInt(p.cadenceN, 10) || 0;
  var unit = _TC_CADENCE_UNITS[p.cadenceUnit] ? p.cadenceUnit : '';
  // Plans saved before the number+unit control carry only cadenceDays. Derive the two
  // fields for display but keep the stored day count authoritative, so a legacy
  // fractional cadence (the old 3×/week preset was 2.33 d) generates exactly the same
  // schedule as before until the user actually changes it.
  if (!n || !unit){ var d = _tcCadenceFromDays(days); n = d.n; unit = d.unit; }
  return {
    compId:      p.compId || '',
    doseMg:      p.doseMg || '',
    cadenceN:    n,
    cadenceUnit: unit,
    cadenceDays: days || _tcCadenceToDays(n, unit),
    startDate:   p.startDate || ''
  };
}

function _tcBlankSimplePlan(){
  return {compId:'', doseMg:'', cadenceN:0, cadenceUnit:'week', cadenceDays:0, startDate:''};
}

// Push an edited plan into the bound stack's TRT compound, then regenerate that
// stack's injections. This is the only write path for a bound plan — nothing is kept
// in the profile for it, so the card can never show a schedule the stack does not have.
async function _tcWritePlanToStack(st, plan){
  var c = (st.trt.compounds || [])[0];
  if (!c) return;
  var oldId = c.id;
  if (plan.compId && plan.compId !== c.id){
    c.id = plan.compId;
    var cd = _tcCompInfo(plan.compId);
    c.name = (cd && cd.name) || plan.compId;
    c.dot  = (cd && cd.dot)  || c.dot;
  }
  if (plan.doseMg    !== undefined) c.dose = String(plan.doseMg);
  if (plan.startDate !== undefined) c.start_date = plan.startDate || '';
  if (plan.cadenceN){
    c.freqVal  = plan.cadenceN;
    c.freqUnit = (plan.cadenceUnit === 'week') ? 'weeks' : 'days';
    // An interval cadence and a weekday list are two different schedules and the
    // generator prefers the weekday list. Clearing it is what makes "every N days"
    // actually take effect.
    c.days = null;
  }
  c.unit = 'mg';
  if (typeof saveStacksToBackend === 'function'){ try { await saveStacksToBackend(); } catch(_e){} }

  var cyc = (typeof _stackCycleId === 'function') ? _stackCycleId(st) : (st.id || '');
  var h   = (typeof authHeaders === 'function') ? authHeaders() : null;
  var now = new Date(); now.setHours(0,0,0,0);
  var td  = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  if (h && cyc){
    // Drop the old ester's future injections too — switching Testoviron → Nebido must
    // not leave the Testoviron shots standing beside the new ones.
    var ids = (oldId && oldId !== c.id) ? [oldId, c.id] : [c.id];
    for (var i = 0; i < ids.length; i++){
      try { await fetch(AGENT_URL+'/injections?cycle_id='+encodeURIComponent(cyc)+'&compound_id='+encodeURIComponent(ids[i])+'&from_date='+td+'&unlogged_only=true', {method:'DELETE', headers:h}); } catch(_e){}
    }
  }
  if (typeof generateAndPushInjections === 'function') await generateAndPushInjections(st, now);
  if (typeof refreshInjectionsCache === 'function')    await refreshInjectionsCache();
  buildTCalc();
  if (typeof buildStackStore === 'function') buildStackStore();
  if (typeof buildToday === 'function')      buildToday();
}

// ── Save / Discard ───────────────────────────────────────────────────────────
// The ONLY path from a draft to the protocol. Nothing else writes.
async function _tcSavePlanToStack(btnId){
  var st = _tcSimplePlanStack();
  var d  = st && _tcDraftFor(st);
  if (!st || !d || !_tcPlanDirty()) return;
  var btn = btnId && document.getElementById(btnId);
  if (btn){ btn.disabled = true; btn.textContent = 'Saving…'; }
  var plan = {};
  _TC_PLAN_FIELDS.forEach(function(k){ plan[k] = d[k]; });
  try{
    await _tcWritePlanToStack(st, plan);
    _tcPlanDraft = null;
    _tcPlanSavedAt = Date.now();   // drives the "Saved" confirmation on the card
  }catch(e){
    _logErr('tcSavePlan', e);
    if (btn){ btn.disabled = false; btn.textContent = 'Save failed — try again'; }
    return;
  }
  buildTCalc();
}
// How long the post-save confirmation stays on the card. It is a rendered line, not
// a toast, so it survives the redraw that follows the save.
var _tcPlanSavedAt = 0;
var _TC_SAVED_NOTICE_MS = 20000;
function _tcJustSaved(){ return _tcPlanSavedAt && (Date.now() - _tcPlanSavedAt) < _TC_SAVED_NOTICE_MS; }

function _tcDiscardPlanDraft(){
  _tcPlanDraft = null;
  buildTCalc();
}

// Plain-language summary of what Save would write, so the button is never a leap of
// faith. Reads old → new from the protocol and the draft.
function _tcPlanChangeSummary(){
  var st = _tcSimplePlanStack(); if (!st) return [];
  var d  = _tcDraftFor(st);      if (!d)  return [];
  var was = _tcPlanFromStack(st);
  var out = [];
  if (String(d.compId) !== String(was.compId))
    out.push('Ester: ' + (_tcCompInfo(was.compId).name || was.compId || '—') + ' → ' + (_tcCompInfo(d.compId).name || d.compId || '—'));
  if (String(d.doseMg) !== String(was.doseMg))
    out.push('Dose: ' + (was.doseMg || '—') + ' → ' + (d.doseMg || '—') + ' mg per injection');
  if (String(d.cadenceDays) !== String(was.cadenceDays))
    out.push('Cadence: every ' + was.cadenceDays + ' d → every ' + d.cadenceDays + ' d');
  if (String(d.startDate) !== String(was.startDate))
    out.push('First injection: ' + (was.startDate || '—') + ' → ' + (d.startDate || '—'));
  return out;
}

// Start (or extend) the draft for the bound stack. Seeded from what the protocol
// currently holds, so an untouched field always equals the stored value and
// _tcPlanChanges reports only what the user actually altered.
function _tcTouchDraft(st){
  if (!_tcDraftFor(st)) _tcPlanDraft = Object.assign({stackId: st.id}, _tcPlanFromStack(st));
  return _tcPlanDraft;
}

function _tcSetSimplePlanField(field, value){
  var st = _tcSimplePlanStack();
  if (st){
    _tcTouchDraft(st)[field] = value;
    buildTCalc();
    return;
  }
  if (!_tcp.simplePlan) _tcp.simplePlan = _tcBlankSimplePlan();
  _tcp.simplePlan[field] = value;
  _tcSaveProfile();
  buildTCalc();
}

// Cadence is two fields but one stored interval — set either and cadenceDays is
// recomputed from both, which is also the point where a legacy fractional interval
// is replaced by the user's explicit choice.
function _tcSetSimplePlanCadence(field, value){
  var cur  = _tcSimplePlan();
  var n    = field === 'cadenceN'    ? parseInt(value, 10) || 0 : cur.cadenceN;
  var unit = field === 'cadenceUnit' ? value                    : cur.cadenceUnit;
  if (!_TC_CADENCE_UNITS[unit]) unit = 'week';
  if (n > _TC_CADENCE_MAX_N) n = _TC_CADENCE_MAX_N;
  if (n < 0) n = 0;
  var _st = _tcSimplePlanStack();
  if (_st){
    // A stack's TRT cadence is whole days or whole weeks — 'month' has no
    // representation in freqUnit, so it is stored as its day count.
    if (unit === 'month'){ n = n * 30; unit = 'day'; }
    var d = _tcTouchDraft(_st);
    d.cadenceN = n; d.cadenceUnit = unit; d.cadenceDays = _tcCadenceToDays(n, unit);
    buildTCalc();
    return;
  }
  if (!_tcp.simplePlan) _tcp.simplePlan = _tcBlankSimplePlan();
  _tcp.simplePlan.cadenceN    = n;
  _tcp.simplePlan.cadenceUnit = unit;
  _tcp.simplePlan.cadenceDays = _tcCadenceToDays(n, unit);
  _tcSaveProfile();
  buildTCalc();
}

// A plan only produces a curve once every field it needs is set.
function _tcSimplePlanComplete(){
  var p = _tcSimplePlan();
  return !!(p.compId && parseDec(p.doseMg) > 0 && p.cadenceDays > 0 && p.startDate);
}

// How far ahead a simple plan projects. Long enough to show a depot ester reaching
// steady state (Nebido needs months), bounded so a daily cadence cannot generate an
// unbounded list.
var _TC_SIMPLE_HORIZON_DAYS = 365;
var _TC_SIMPLE_MAX_INJ      = 800;

// Expand the plan into the same {compId, doseMg, date} shape the log uses. Generated
// on the fly — never written into manualLog, which stays the user's own data.
function _tcSimplePlanInjections(){
  // A SAVED plan that lives in a stack has already been turned into stored injections
  // by that stack's generator. Expanding it again here would be the same schedule from
  // two sources — the double-count this whole rework exists to remove.
  //
  // An UNSAVED draft is the exception, and it is the point of the tab: it expands here
  // so the curve previews the change before it is written. Nothing generated from a
  // draft is ever persisted — _tcSavePlanToStack writes the plan's parameters to the
  // protocol and lets the protocol's own generator produce the injections.
  if (_tcSimplePlanStack() && !_tcPlanDirty()) return [];
  if (!_tcSimplePlanComplete()) return [];
  var p = _tcSimplePlan();
  var start = parseLocalDate(p.startDate);
  if (!start || isNaN(start.getTime())) return [];
  var end = new Date(Math.max(NOW.getTime(), start.getTime()) + _TC_SIMPLE_HORIZON_DAYS * 86400000);
  var out = [];
  // Step in CALENDAR DAYS, never in milliseconds.
  //
  // This used to advance by i * cadenceDays * 86400000 ms from parseLocalDate(startDate),
  // which is LOCAL MIDNIGHT. A fixed number of milliseconds is not a fixed number of local
  // days: at each daylight-saving transition the wall clock moves an hour, and anchored at
  // midnight that immediately crosses a date boundary. Real output for "every 5 days" from
  // 2026-08-02 in a European timezone:
  //     2026-10-21 -> 2026-10-25   a 4-DAY gap  (clocks back, landed 23:00 the day before)
  //     2027-03-24 -> 2027-03-30   a 6-DAY gap  (clocks forward)
  // i.e. one dose crammed in and one dropped, which drew two visible kinks in the plasma
  // curve — an artifact of the calendar, mistaken for pharmacology.
  //
  // Date arithmetic through the Date constructor normalises in local time, so day offsets
  // are DST-proof. Cadence can still be fractional (3x/week = 7/3 d): round the CUMULATIVE
  // offset rather than each step, so doses land on whole days without drifting over a long
  // horizon — 7/3 gives 0, 2, 5, 7, 9, 12, 14 ... which is exactly 3 per week.
  var cadence = parseDec(p.cadenceDays) || 0;
  if (!(cadence > 0)) return [];
  for (var i = 0; i < _TC_SIMPLE_MAX_INJ; i++){
    var t = new Date(start.getFullYear(), start.getMonth(),
                     start.getDate() + Math.round(i * cadence), 12, 0, 0, 0);
    if (t > end) break;
    out.push({ compId: p.compId, doseMg: String(parseDec(p.doseMg)), date: dateKey(t), source: 'simple' });
  }
  return out;
}


// The simple planner card: 1) ester 2) dose 3) cadence 4) start — then the curve at
// the top of the page renders it. Greyed (and non-interactive) when the advanced
// planner is the live one.
function _tcSimplePlannerHtml(iSty, lSty){
  var live = _tcPlannerMode() === 'simple';
  var p    = _tcSimplePlan();
  var ids  = (typeof _tcAllCompIds === 'function') ? _tcAllCompIds() : [];
  var dim  = live ? '' : 'opacity:0.4;pointer-events:none;filter:grayscale(1)';

  var h = '<div class="card">';
  h += '<div class="card-header"><div class="card-title-wrap">';
  h += '<div class="card-dot" style="background:' + (live ? '#5ad1b0' : 'var(--muted2)') + '"></div>';
  h += '<div class="card-title">TESTOSTERONE PLAN</div></div>';
  var boundSt = _tcSimplePlanStack();
  var hdr = live
    ? (boundSt ? (_tcPlanDirty() ? 'unsaved changes' : _esc(boundSt.name || 'protocol')) : 'not saved to a protocol')
    : 'off — advanced planner is on';
  h += '<span style="font-size:10px;font-weight:' + (live && boundSt && _tcPlanDirty() ? '700' : '400') +
       ';color:' + (live && boundSt && _tcPlanDirty() ? '#e8a020' : 'var(--muted2)') + '">' + hdr + '</span>';
  h += '</div>';
  h += '<div style="padding:14px 16px;' + dim + '">';

  // 1 — ester
  h += '<label style="' + lSty + '">1 · Ester</label>';
  h += '<select onchange="_tcSetSimplePlanField(\'compId\', this.value)" style="' + iSty + ';width:100%;margin-bottom:14px">';
  h += '<option value="">Select a testosterone ester…</option>';
  ids.forEach(function(id){
    var cd = _tcCompInfo(id);
    h += '<option value="' + id + '"' + (p.compId === id ? ' selected' : '') + '>' + cd.name +
         (cd.halfLifeDays ? ' · ' + cd.halfLifeDays + ' d half-life' : '') + '</option>';
  });
  h += '</select>';

  // 2 — dose
  h += '<label style="' + lSty + '">2 · Dose per injection (mg)</label>';
  h += '<input type="number" inputmode="decimal" min="0" step="any" value="' + (p.doseMg || '') + '" placeholder="125" ' +
       'onchange="_tcSetSimplePlanField(\'doseMg\', this.value)" style="' + iSty + ';width:100%;margin-bottom:14px">';

  // 3 — cadence: "every N day/week/month". Two fields rather than a preset list, so
  // every 3 days, every 5 weeks and so on are all reachable.
  h += '<label style="' + lSty + '">3 · Injection cadence</label>';
  h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">';
  h += '<span style="font-size:13px;color:var(--muted2);flex-shrink:0">Every</span>';
  h += '<select onchange="_tcSetSimplePlanCadence(\'cadenceN\', this.value)" style="' + iSty + ';flex:1;min-width:0">';
  h += '<option value="0"' + (p.cadenceN ? '' : ' selected') + '>—</option>';
  for (var _n = 1; _n <= _TC_CADENCE_MAX_N; _n++)
    h += '<option value="' + _n + '"' + (p.cadenceN === _n ? ' selected' : '') + '>' + _n + '</option>';
  h += '</select>';
  h += '<select onchange="_tcSetSimplePlanCadence(\'cadenceUnit\', this.value)" style="' + iSty + ';flex:1.4;min-width:0">';
  _TC_CADENCE_ORDER.forEach(function(u){
    h += '<option value="' + u + '"' + (p.cadenceUnit === u ? ' selected' : '') + '>' +
         _tcCadenceUnitLabel(u, p.cadenceN) + '</option>';
  });
  h += '</select>';
  h += '</div>';

  // 4 — start date. Required: without it there is no timeline to place doses on.
  h += '<label style="' + lSty + '">4 · First injection</label>';
  h += '<input type="date" value="' + (p.startDate || '') + '" ' +
       'onchange="_tcSetSimplePlanField(\'startDate\', this.value)" style="' + iSty + ';width:100%">';

  if (live) {
    var _bound = _tcSimplePlanStack();
    var _dirty = _tcPlanDirty();

    // ── Unsaved changes: say what is NOT yet written, and offer the only write ──
    if (_bound && _dirty) {
      var _chg = _tcPlanChangeSummary();
      h += '<div style="margin-top:12px;background:rgba(232,168,32,0.10);border:1px solid rgba(232,168,32,0.45);border-radius:10px;padding:11px 12px">' +
        '<div style="font-size:12px;font-weight:700;color:#e8a020;margin-bottom:5px">Not saved yet</div>' +
        '<div style="font-size:11px;color:var(--muted2);line-height:1.55;margin-bottom:7px">' +
          'The curve above previews this. “' + _esc(_bound.name || 'This protocol') + '” still holds its current schedule until you save.' +
        '</div>' +
        (_chg.length
          ? '<div style="font-size:11px;color:var(--text);line-height:1.6;margin-bottom:9px">' +
              _chg.map(function(t){ return '• ' + _esc(t); }).join('<br>') +
            '</div>'
          : '') +
        '<div style="font-size:11px;color:var(--muted2);line-height:1.55;margin-bottom:9px">' +
          'Saving replaces that protocol’s testosterone injections from today forward. Past and already-logged injections are not touched.' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button id="tc-plan-save" onclick="_tcSavePlanToStack(\'tc-plan-save\')" style="flex:1;background:#e8a020;border:none;border-radius:9px;color:#0a0a0a;font-size:12px;font-weight:800;letter-spacing:0.4px;padding:9px;cursor:pointer;font-family:inherit">Save to ' + _esc(_bound.name || 'protocol') + '</button>' +
          '<button onclick="_tcDiscardPlanDraft()" style="background:none;border:1px solid var(--border);border-radius:9px;color:var(--muted2);font-size:12px;font-weight:600;padding:9px 14px;cursor:pointer;font-family:inherit">Discard</button>' +
        '</div>' +
      '</div>';
    } else if (_bound && _tcJustSaved()) {
      h += '<div style="margin-top:12px;background:rgba(90,209,176,0.10);border:1px solid rgba(90,209,176,0.35);border-radius:10px;padding:10px 12px">' +
        '<div style="font-size:12px;color:#5ad1b0;font-weight:700">Saved to ' + _esc(_bound.name || 'protocol') + '</div>' +
        '<div style="font-size:11px;color:var(--muted2);margin-top:3px;line-height:1.5">Its testosterone injections were rewritten from today forward. Check Today and Plan.</div>' +
      '</div>';
    }

    if (_tcSimplePlanComplete()) {
      // Saved and bound, the injections are the protocol's stored ones, not a local
      // expansion — count those, so the card never claims a schedule the protocol
      // does not actually hold. While a draft is live this is the preview's count.
      var n  = (_bound && !_dirty) ? _tcProtocolInjections().length : _tcSimplePlanInjections().length;
      var wk = (parseDec(p.doseMg) * 7 / p.cadenceDays);
      h += '<div style="margin-top:12px;background:rgba(90,209,176,0.08);border:1px solid rgba(90,209,176,0.25);border-radius:10px;padding:10px 12px">' +
        '<div style="font-size:12px;color:#5ad1b0;font-weight:600">' + (Math.round(wk * 10) / 10) + ' mg/week · ' + n + ' injections ' + (_dirty ? 'in this preview' : 'scheduled') + '</div>' +
        '<div style="font-size:11px;color:var(--muted2);margin-top:3px">' +
          (_dirty ? 'Preview only — nothing is stored until you save above.'
                  : (_bound ? ('Stored in ' + _esc(_bound.name || 'this protocol') + '.')
                            : 'Shown in the plasma curve at the top of this page. Use Save to stack to store it in a protocol.')) +
        '</div>' +
      '</div>';
    } else {
      h += '<div style="margin-top:12px;font-size:11px;color:var(--muted2);line-height:1.5">Fill in all four and the curve above will render this plan.</div>';
    }
  }
  h += '</div></div>';
  return h;
}

// The switch that decides which planner is live.
function _tcPlannerSwitchHtml(){
  var adv = _tcPlannerMode() === 'advanced';
  return '<div class="card" style="margin-bottom:0">' +
    '<div style="padding:12px 16px;display:flex;align-items:center;gap:12px">' +
      '<label style="display:flex;align-items:center;gap:9px;cursor:pointer;flex:1">' +
        '<input type="checkbox" ' + (adv ? 'checked' : '') + ' onchange="_tcToggleAdvancedPlanner(this)" ' +
          'style="accent-color:#6688cc;width:17px;height:17px;cursor:pointer;flex-shrink:0">' +
        '<span style="min-width:0">' +
          '<span style="display:block;font-size:13px;font-weight:600;color:var(--text)">Advanced planner</span>' +
          '<span style="display:block;font-size:11px;color:var(--muted2);line-height:1.45">' +
            (adv ? 'Multi-compound log below is live. The simple plan above is off — its settings are kept.'
                 : 'Off: the simple plan above drives the curve. Turn on for multi-compound schedules, blends and back-dated injections.') +
          '</span>' +
        '</span>' +
      '</label>' +
    '</div></div>';
}

// ── Planned TRT protocol → T-Calc ─────────────────────────────────────────────
// A testosterone protocol configured in the Stack builder used to be invisible to
// T-Calc: the two kept separate injection lists, so a user who planned TRT in
// Protocols saw an empty curve here and had to re-enter everything by hand.
//
// The stack already pushes fully-specified entries to /injections (compound_id,
// date, dose, unit, tier), so no new data is needed — T-Calc just has to read them.
//
// ⚠️ The one trap, and the reason this is filtered rather than merged wholesale:
// T-Calc's own "push log to schedule" writes ITS entries back into the same store
// under cycle_id 'tcalc' / 'tcalc:<stackId>'. Those are copies of manualLog. Pulling
// them back in would count every T-Calc injection twice and double the curve.
function _tcIsTcalcOwned(cycleId){
  var c = String(cycleId || '');
  return c === 'tcalc' || c.indexOf('tcalc:') === 0;
}

// TRT injections that came from a stack's own protocol config. Excludes T-Calc's own
// round-tripped entries, inactive entries, and any dose whose unit is not mg — a
// silent unit mix-up here would corrupt the curve, so unknown units are dropped
// rather than assumed.
// The schedule T-Calc shows is the stack's stored injections — not a private copy.
//
// _tcp.manualLog used to be a SECOND store: T-Calc wrote it to tcalc_profiles.json
// and pushed a copy into injections.json, one way, never reading back. When the two
// diverged you got the exact report of 2026-08-06 — "t-calc is empty ie has nothing
// in it, even though the t-calc injections are in the today view". Nothing could
// reconcile them because nothing ever read back.
//
// manualLog is now a CACHE of those rows, refilled from the stack on load. The
// stored injections are the source of truth; simplePlan stays in the profile because
// it is the plan's INPUT (compound, dose, cadence, start), not a derived schedule.
// ── A CHECKED INJECTION IS THE PAST. FULL STOP. ──────────────────────────────
// Henrik, 2026-08-07: "any checked injection needs to be counted regardless of which
// stack it actually belonged to. Also the Stack concept might be changed or updated
// in the future, so the checked injections is the only source of truth to the past."
//
// This does NOT contradict "the stack is the container". That rule governs WRITING:
// nothing new is ever written outside a stack. This one governs READING the past:
// when reconstructing what is already in the body, the stack an injection was filed
// under is irrelevant history. Ticking the box is the assertion that it went in.
//
// So the past is selected on `logged`, and on nothing else:
//   * NOT on cycle_id      — a protocol can be renamed, restored, replaced or deleted
//                            and its derived cycle id moves with it. The dose does not
//                            un-happen.
//   * NOT on the stack being active — switching a protocol off is not a retraction.
//   * NOT on `active`      — that flag retires a SCHEDULE, not a recorded event.
//   * NOT on a date window — see _TC_HISTORY_FROM below.
// A past-dated dose that was never ticked is a plan the user did not confirm taking,
// and is deliberately excluded: the curve shows what went in, not what was intended.
//
// What triggered this (2026-08-07): six weeks of logged TRT — two Testoviron Depot
// then 100 mg Nebido E2D from 26 June — rendered as roughly 40% of the real
// accumulated level. Three filters compounded: refreshInjectionsCache fetches only
// today-14d, drops any cycle id whose stack is inactive, and this function then kept
// only the bound stack's id. With Nebido's 56-day half-life essentially nothing from
// June had cleared, so two thirds of the accumulated dose was simply invisible.

// How far back the history reaches. 400 days, confirmed by Henrik 2026-08-07 against
// the real-world washout of the longest-acting ester in the catalogue. It is a
// generous bound however you measure that: at the app's settled Nebido half-life of
// 56 days it is ~7.1 half-lives, leaving under 1% of a dose contributing.
//
// This is a PHARMACOLOGICAL bound, not a convenience one, and that is the whole
// difference from the 14-day cache window this replaces. Anything dropped by it has
// decayed to nothing; the 14-day window dropped doses that were still most of the
// level in the body.
var _TC_HISTORY_LOOKBACK_DAYS = 400;
var _TC_HISTORY_HORIZON_DAYS  = 400;
var _tcHistory       = null;   // logged TRT injections in that window — null until fetched
var _tcHistoryState  = 'idle'; // idle | loading | ready | error
// Past-dated TRT doses that were SCHEDULED but never ticked. They are deliberately NOT
// part of the curve — a plan the user did not confirm taking is not the past, and that
// rule stays. What was missing is that nothing said so: two unticked doses left a
// six-day hole that flattened the curve across "today" and read ~50 pmol/L low, while
// the series card quietly re-derived its cadence around the hole and called an EOD run
// "every 6 days". Collected here (same 400-day fetch, no extra request) purely to be
// REPORTED. Never add these to _tcCurveLog.
var _tcSkippedPast   = [];

// The injections T-Calc treats as the past. Read from _tcHistory (all time), never
// from _injectionsCache — that cache is scoped to what Today needs and is the reason
// this was broken.
function _tcLoggedHistory(){
  return (_tcHistory || []).slice();
}

async function _tcFetchHistory(force){
  if (_tcHistoryState === 'loading') return;
  if (_tcHistory && !force) return;
  if (typeof authHeaders !== 'function') return;
  _tcHistoryState = 'loading';
  try{
    var from = new Date(NOW.getTime() - _TC_HISTORY_LOOKBACK_DAYS * 86400000);
    var to   = new Date(NOW.getTime() + _TC_HISTORY_HORIZON_DAYS  * 86400000);
    var r  = await fetch(AGENT_URL + '/injections?date_from=' + dateKey(from) +
                         '&date_to=' + dateKey(to) + '&active_only=false',
                         {headers: authHeaders()});
    if (!r.ok){ _logHttp('tcHistory', r.status, '/injections'); _tcHistoryState = 'error'; return; }
    var all = await r.json();
    var rows = [];
    var _skipped = [], _todayK = dateKey(NOW);
    (Array.isArray(all) ? all : []).forEach(function(e){
      // Testosterone from EITHER tier — see _tcIsTestoRow. The unit check further down
      // stays strict: an Enhanced row may carry a weekly RATE ('350', 'mg/week'), which
      // is not a per-injection dose and must never be treated as one.
      if (!e || !_tcIsTestoRow(e.tier, e.compound_id)) return;
      // Scheduled, past-dated, never ticked. Recorded for the note only — see
      // _tcSkippedPast. It stays out of the curve, which is the documented rule.
      if (!e.logged && e.active !== false && (e.date || '') < _todayK) {
        var _sm = parseDec(e.dose);
        if ((e.unit || 'mg').toLowerCase() === 'mg' && _sm > 0)
          _skipped.push({compId: _tcCanonCompId(e.compound_id), doseMg: String(_sm), date: e.date,
                         seriesId: e.series_id || undefined,
                         // injId and cycleId make the row addressable: the series editor
                         // has to be able to keep, retire or recreate it rather than
                         // silently dropping it (see _tcSaveEditSeries).
                         injId: e.id || undefined, cycleId: String(e.cycle_id || '')});
      }
      if (!e.logged) return;                        // checked, or it is not the past
      var unit = (e.unit || 'mg').toLowerCase();
      if (unit !== 'mg') return;                    // a unit mix-up would corrupt the curve
      var mg = parseDec(e.dose);
      if (!(mg > 0)) return;
      // injId is what makes a stored row deletable. Without it the log list can only
      // splice a cache that is rebuilt from this fetch on the next render, so the row
      // reappears and the delete is a silent no-op (2026-08-07).
      rows.push({compId: _tcCanonCompId(e.compound_id), doseMg: String(mg), date: e.date,
                 injId: e.id || undefined,
                 seriesId: e.series_id || undefined, source: 'logged'});
    });
    rows.sort(function(a,b){ return (a.date||'') < (b.date||'') ? -1 : (a.date||'') > (b.date||'') ? 1 : 0; });
    _skipped.sort(function(a,b){ return (a.date||'') < (b.date||'') ? -1 : (a.date||'') > (b.date||'') ? 1 : 0; });
    // A DATE THAT ALREADY HAS A LOGGED DOSE IS NOT A SKIPPED DOSE.
    // An unlogged row sitting on a day the user has ticked is not a missed injection —
    // it is a second row for the same dose. Duplicates should not exist (the editor no
    // longer creates them) but some are already stored from before that fix, and
    // deleting rows from the injection log to tidy up is not something this code gets
    // to do on its own — the log is the record and every delete is global.
    //
    // Reporting them as missed is what made ticking look futile: the dose was recorded,
    // the curve counted it, and the note still said "2 scheduled doses were never
    // ticked" because the twin was still sitting there unlogged. Selecting on the DAY
    // rather than the row costs nothing when there are no duplicates and makes the
    // stale ones harmless. The curve is unaffected either way — it already de-duplicates
    // on (compound, date), so a twin never double-counted.
    var _loggedDays = {};
    rows.forEach(function(e){ _loggedDays[e.compId + '|' + e.date] = true; });
    _tcHistory      = rows;
    _tcSkippedPast  = _skipped.filter(function(e){ return !_loggedDays[e.compId + '|' + e.date]; });
    _tcHistoryState = 'ready';
  }catch(e){
    _logErr('tcHistory', e);
    _tcHistoryState = 'error';
  }
  buildTCalc();
}

// manualLog is the ADVANCED planner's editable list. It is filled from the logged
// history (the past) plus this stack's own future rows, so opening the tab shows
// everything that has actually happened rather than a fortnight of it.
//
// ⚠️ It must never be narrowed from an incomplete source. Before 2026-08-07 this read
// _injectionsCache — a 14-day window — and assigned the result over manualLog; the
// next _tcSaveProfile() then persisted that truncated list into tcalc_profiles.json.
// Bail out rather than write a partial list.
function _tcLoadLogFromStack(){
  if(!_tcp)return false;
  if(_tcHistoryState!=='ready')return false;   // incomplete source → do not touch manualLog
  var cid=_tcTargetCycleId();
  var rows=_tcLoggedHistory();
  var seen={};
  rows.forEach(function(e){seen[e.compId+'|'+e.date]=true;});
  // This stack's own FUTURE rows: planned, not yet taken, so they are not in the
  // logged history but they are what the user is editing.
  if(cid&&typeof _injectionsCache!=='undefined'&&_injectionsCache){
    var todayKey=dateKey(NOW);
    Object.keys(_injectionsCache).forEach(function(dk){
      (_injectionsCache[dk]||[]).forEach(function(e){
        // ⚠️ manualLog IS THE EDITABLE PLANNER LIST, AND IT IS WRITTEN BACK.
        // Only rows T-Calc owns belong here. Pulling the PROTOCOL's own testosterone in
        // (tier 'enhanced', generated by _genInjBatches) put ~30 loose single-injection
        // rows into the log with no series card, and every one of them was deletable —
        // the user removed four real logged doses believing they were spurious new
        // entries. _tcSyncLogToBackend would also have re-posted them under T-Calc's
        // cycle id with a canonicalised compound id, cloning the protocol's plan into a
        // second stream.
        // The CURVE still counts enhanced testosterone: _tcFetchHistory supplies the
        // past and _tcProtocolInjections the future, and both are read-only. Reading is
        // the fix; owning it is not.
        if(!e||e.tier!=='trt')return;
        if(e.logged)return;                       // already covered by the history above
        if(e.active===false)return;
        if((e.date||'')<todayKey)return;          // past + unticked is not the past
        if(String(e.cycle_id||'')!==cid)return;   // this stack's plan only
        var unit=(e.unit||'mg').toLowerCase();
        if(unit!=='mg')return;
        var mg=parseDec(e.dose);
        if(!(mg>0))return;
        if(seen[e.compound_id+'|'+e.date])return;
        seen[e.compound_id+'|'+e.date]=true;
        rows.push({compId:e.compound_id,doseMg:String(mg),date:e.date,seriesId:e.series_id||undefined});
      });
    });
  }
  // T-Calc is a PLANNING tool: the flow is add doses, read the curve, and only then
  // Save to protocol — which is what binds a stack and flushes the plan to the record
  // (_tcSetTargetStack -> _tcSyncLogToBackend). So a planned dose necessarily exists
  // before any stack does, and this rebuild ran on every buildTCalc() and assigned
  // manualLog outright from the record — erasing the draft on the very next render.
  // That is why a 10-dose series starting today kept only the one logged dose for
  // today: the past half was a record, the future half was a draft, and the draft
  // never survived long enough to be saved.
  // Only entries explicitly marked draft are carried, and only for today onwards —
  // the record owns the past. A draft the record has caught up with is already in
  // `seen`, so it retires itself rather than duplicating.
  var todayK=dateKey(NOW);
  (_tcp.manualLog||[]).forEach(function(e){
    if(!e||!e.draft)return;
    if((e.date||'')<todayK)return;
    if(seen[e.compId+'|'+e.date])return;
    seen[e.compId+'|'+e.date]=true;
    rows.push(e);
  });
  // PAST-DATED DOSES THAT WERE SCHEDULED BUT NEVER TICKED BELONG TO THE PLAN.
  // They are NOT part of the curve — that rule is unchanged, and `unticked` is what
  // _tcCurveLog filters on — but dropping them from manualLog entirely made the
  // planner lose them. Editing a series regenerates every dose as a draft, the sync
  // only writes from today forward, and the draft carry-forward above is
  // today-onwards, so each save silently deleted the past-dated doses that were not
  // already logged records: "edit to 10 injections every 2 days" saved as 8, and
  // every further edit shed another two. The run is the user's plan; only the CURVE
  // is restricted to confirmed doses.
  (_tcSkippedPast||[]).forEach(function(e){
    if(!e||!e.date)return;
    if(cid&&String(e.cycleId||'')!==cid)return;    // this stack's plan only
    if(seen[e.compId+'|'+e.date])return;
    seen[e.compId+'|'+e.date]=true;
    rows.push(Object.assign({},e,{unticked:true}));
  });
  rows.sort(function(a,b){return(a.date||'')<(b.date||'')?-1:(a.date||'')>(b.date||'')?1:0;});
  _tcp.manualLog=rows;
  return true;
}

// PLANNED protocol injections — the future. The past comes from _tcLoggedHistory()
// and nothing else, so this deliberately excludes anything already ticked (that row
// is in the history, and counting both would double it) and anything past-dated but
// unticked (a plan the user never confirmed taking).
function _tcProtocolInjections(){
  if (typeof _injectionsCache === 'undefined' || !_injectionsCache) return [];
  var out = [], todayKey = dateKey(NOW);
  Object.keys(_injectionsCache).forEach(function(dateKeyStr){
    (_injectionsCache[dateKeyStr] || []).forEach(function(e){
      if (!e || !_tcIsTestoRow(e.tier, e.compound_id)) return;
      if (e.active === false) return;
      if (e.logged) return;                       // the history owns every checked dose
      if ((e.date || '') < todayKey) return;      // past + unticked ≠ the past
      if (_tcIsTcalcOwned(e.cycle_id)) return;
      var unit = (e.unit || 'mg').toLowerCase();
      if (unit !== 'mg') return;
      var mg = parseDec(e.dose);
      if (!(mg > 0)) return;
      out.push({ compId: _tcCanonCompId(e.compound_id), doseMg: String(mg), date: e.date, source: 'protocol' });
    });
  });
  return out;
}

// The injection list the CURVE is built from: the manual log plus any planned
// protocol TRT injections, de-duplicated by (compound, date).
//
// MANUAL WINS on conflict. A manual entry is a recorded event — the user typed a
// dose they actually took; a protocol entry is a plan for that day. Where both
// describe the same compound on the same date they are the same injection, and
// counting both would double it.
function _tcCurveLog(){
  // The greyed-out planner does not contribute. Its data is untouched and comes
  // straight back when the switch is flipped, but a planner that is visibly
  // disabled must not be silently driving the curve.
  var seen = {}, merged = [];
  function _add(list){
    (list || []).forEach(function(e){
      if (!e || !e.date || !(parseDec(e.doseMg) > 0)) return;
      // A past-dated dose that was never ticked is a plan the user did not confirm
      // taking, and is excluded — unchanged. manualLog now CARRIES those rows so the
      // planner and the series card can show the real run (and so editing a series
      // stops deleting them), which is exactly why the exclusion has to be enforced
      // here as well as by the date filters. `unticked` is set only in
      // _tcLoadLogFromStack, from the record's own unlogged past rows.
      if (e.unticked) return;
      var k = e.compId + '|' + e.date;
      if (seen[k]) return;
      seen[k] = true;
      merged.push(e);
    });
  }

  // ── 1. THE PAST, first and outranking everything ───────────────────────────
  // Every checked injection, whatever stack it was filed under. Added before the
  // planners so a recorded event always beats a plan for the same day — including a
  // draft preview, which must be able to change the future without rewriting what
  // already went in. This layer is what was missing entirely in simple mode: the
  // curve was built from the plan and the protocol's future rows, so six weeks of
  // logged TRT contributed nothing (2026-08-07).
  _add(_tcLoggedHistory());

  // ── 2. the live planner ────────────────────────────────────────────────────
  // The greyed-out planner does not contribute. Its data is untouched and comes
  // straight back when the switch is flipped, but a planner that is visibly
  // disabled must not be silently driving the curve.
  if (_tcPlannerMode() === 'simple') {
    _add(_tcSimplePlanInjections());
  } else {
    _add(((_tcp && _tcp.manualLog) || []).map(function(e){
      return (e.source === 'manual') ? e : Object.assign({}, e, { source: 'manual' });
    }));
  }
  // From the day the simple plan starts, the plan IS the testosterone schedule —
  // T-Calc is the single place one is built, so a stack's own TRT protocol covering
  // the same days is the same injections described twice. De-duplicating only on an
  // exact (compound, date) hit is not enough: a plan for a different ester, or on a
  // different cadence, collides with nothing and gets ADDED to the protocol instead
  // of replacing it. Reported 2026-08-01 — editing the plan's dose barely moved a
  // curve that was dominated by the protocol underneath it.
  // Dates BEFORE the plan starts are left alone: those are real past dosing, and the
  // plan says nothing about them.
  //
  // ⚠️ Only an UNBOUND plan may do this. When the plan is bound to a stack the
  // protocol injections it would suppress are its own output, and suppressing them
  // left the curve with nothing but a locally generated schedule — which is how a
  // stale "Testoviron Depot, 4 Aug" plan came to override a protocol holding Nebido
  // (2026-08-07). Bound: the stack's stored injections ARE the curve.
  var planFrom = '';
  // Bound AND saved: the protocol's stored injections ARE the curve — a plan that
  // suppressed them would just be showing its own copy of the same thing, which is
  // how a stale plan came to override a protocol holding Nebido (2026-08-07).
  // Bound and DIRTY: the draft is a preview of what Save would produce, so it owns
  // its days for the duration of the preview and the stored ones step aside.
  if (_tcPlannerMode() === 'simple' && (!_tcSimplePlanStack() || _tcPlanDirty())) {
    var _sp = _tcSimplePlan();
    if (_tcSimplePlanComplete()) planFrom = _sp.startDate || '';
  }
  // ── 3. the protocol's remaining planned future ─────────────────────────────
  _add(_tcProtocolInjections().filter(function(e){
    return !(planFrom && e.date >= planFrom);     // the plan owns this day
  }));
  merged.sort(function(a,b){ return (a.date||'') < (b.date||'') ? -1 : (a.date||'') > (b.date||'') ? 1 : 0; });
  return merged;
}

// One line under the chart naming the history it rests on: how many checked
// injections, and since when. Loading and failure are stated rather than rendered as
// a quietly-too-low curve.
function _tcHistoryNoteHtml(){
  var box = 'padding:8px 16px 0;font-size:11px;line-height:1.5;';
  if (_tcHistoryState === 'loading' || _tcHistoryState === 'idle')
    return '<div style="' + box + 'color:var(--muted2)">Loading your logged injections…</div>';
  if (_tcHistoryState === 'error')
    return '<div style="' + box + 'color:#e8a020">Could not load your logged injections, so this curve is missing everything you have already taken. ' +
           '<button onclick="_tcFetchHistory(true)" style="background:none;border:none;color:#e8a020;text-decoration:underline;font-size:11px;cursor:pointer;font-family:inherit;padding:0">Retry</button></div>';
  var h = _tcLoggedHistory();
  if (!h.length)
    return '<div style="' + box + 'color:var(--muted2)">No checked injections yet — this curve is your plan only. Tick doses off in Today and they become your history.</div>';
  // COUNT WHAT THE CURVE COUNTS: DISTINCT (compound, date).
  // This was h.length — raw stored rows. _tcCurveLog de-duplicates on (compId|date), so
  // a duplicate row inflated the headline number without moving the curve, and the line
  // stopped describing what it sits under. It also made the number useless for the one
  // comparison it is naturally used for: prod read 22 and staging 25 for schedules the
  // user believed identical, and the gap could have been three real doses or three
  // duplicate rows with no way to tell them apart from the UI.
  var _seenDose = {}, _dupes = 0;
  h.forEach(function(e){
    var k = e.compId + '|' + e.date;
    if (_seenDose[k]) { _dupes++; return; }
    _seenDose[k] = true;
  });
  var _nDoses = Object.keys(_seenDose).length;
  // Duplicate rows do not affect the curve (it de-duplicates), but they are stored data
  // the user may want to clean up, and staying silent about them is what made the two
  // environments impossible to compare. Reported, never auto-deleted — the injection log
  // is the record and every delete is global.
  var _dupHtml = _dupes ? ' <span style="color:#e8a020">' + _dupes + ' duplicate row' +
    (_dupes === 1 ? '' : 's') + ' on days already recorded — counted once here, and ' +
    (_dupes === 1 ? 'it does' : 'they do') + ' not affect the curve.</span>' : '';
  var first = h[0].date;
  var d = parseLocalDate(first);
  // Doses scheduled in the past and never ticked are NOT counted — that is the rule.
  // Say so, in the same breath as the count, and name the dates. Silence here is what
  // made a gap read as a low number instead of as missing data (the same reason this
  // line states what it stands on at all).
  var _sk = (_tcSkippedPast || []).filter(function(e){ return (e.date || '') >= first; });
  var _skHtml = '';
  if (_sk.length) {
    var _skDates = _sk.slice(-3).map(function(e){
      var _d2 = parseLocalDate(e.date);
      return _d2 && !isNaN(_d2.getTime()) ? fmtDate(_d2) : _esc(e.date);
    }).join(', ');
    _skHtml = ' <span style="color:#e8a020">' + _sk.length + ' scheduled dose' +
      (_sk.length === 1 ? ' was' : 's were') + ' never ticked (' +
      (_sk.length > 3 ? 'latest ' : '') + _skDates + ')' +
      ', so ' + (_sk.length === 1 ? 'it is' : 'they are') + ' not in this curve. ' +
      'Tick them in Today if you took them.</span>';
  }
  return '<div style="' + box + 'color:var(--muted2)">Built on <strong style="color:var(--text)">' + _nDoses +
         ' checked injection' + (_nDoses === 1 ? '' : 's') + '</strong> since ' +
         (d && !isNaN(d.getTime()) ? fmtDate(d) : _esc(first)) + ', plus the plan ahead.' +
         _dupHtml + _skHtml + '</div>';
}

// How many entries in the curve came from a planned protocol rather than the log.
function _tcProtocolCount(){
  return _tcCurveLog().filter(function(e){ return e.source === 'protocol'; }).length;
}

function _tcOpenManualLog() {
  var log   = _tcp.manualLog || [];
  var comps = _tcManualComps();
  var iSty  = 'background:#0a0a0a;border:1px solid #2a2a2a;border-radius:6px;padding:7px 10px;color:#ccc;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box';

  var html = '<div id="tc-log-overlay" onclick="if(event.target===this)_tcCloseManualLog()" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);backdrop-filter:blur(16px);overflow-y:auto;-webkit-overflow-scrolling:touch">' +
    '<div style="max-width:480px;margin:0 auto;padding:16px 16px 60px">';

  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 24px">' +
    '<div>' +
      '<div style="font-size:11px;color:#444;letter-spacing:2px;font-weight:700;margin-bottom:4px">T-CALC</div>' +
      '<div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:0.5px">INJECTION LOG</div>' +
      '<div style="font-size:12px;color:#444;margin-top:4px">' + log.length + ' injection' + (log.length === 1 ? '' : 's') + ' logged</div>' +
    '</div>' +
    '<button onclick="_tcCloseManualLog()" style="background:#111;border:1px solid #333;border-radius:10px;color:#777;font-size:24px;cursor:pointer;padding:4px 14px;line-height:1;font-family:inherit">×</button>' +
  '</div>';

  if (log.length > 0) {
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">';
    log.forEach(function(entry, idx) {
      var cd = _tcCompInfo(entry.compId || (comps[0] || 'topical'));
      var compSelect = '<select onchange="_tcSetManualField(' + idx + ',\'compId\',this.value)" style="' + iSty + ';flex:1;min-width:0">';
      comps.forEach(function(id) {
        var n = _tcCompInfo(id).name;
        compSelect += '<option value="' + _esc(id) + '"' + (entry.compId === id ? ' selected' : '') + '>' + _esc(n) + '</option>';
      });
      compSelect += '</select>';

      html += '<div style="background:#0d0d0d;border:1px solid #1e1e1e;border-radius:12px;padding:12px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + cd.dot + ';display:inline-block;flex-shrink:0"></span>' +
          compSelect +
          '<button onclick="_tcConfirmRemove(' + idx + ')" style="background:none;border:none;color:#444;font-size:18px;cursor:pointer;padding:0;flex-shrink:0;line-height:1">✕</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<div style="min-width:0"><div style="font-size:9px;color:#444;letter-spacing:1.2px;font-weight:700;margin-bottom:5px">DOSE (mg)</div>' +
          '<input type="text" inputmode="decimal" value="' + _esc(String(entry.doseMg || '')) + '" placeholder="e.g. 100" onchange="_tcSetManualField(' + idx + ',\'doseMg\',+this.value)" style="' + iSty + ';width:100%"></div>' +
          '<div style="min-width:0"><div style="font-size:9px;color:#444;letter-spacing:1.2px;font-weight:700;margin-bottom:5px">DATE</div>' +
          '<input type="date" value="' + _esc(entry.date || '') + '" onchange="_tcSetManualField(' + idx + ',\'date\',this.value)" style="' + iSty + ';width:100%"></div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:32px 0;color:#444;font-size:13px">No injections logged yet.<br><span style="font-size:12px;color:#2a2a2a">Tap + ADD INJECTION to start.</span></div>';
  }

  // Injections the curve is using that came from a planned TRT protocol rather than
  // this log. They are NOT listed as editable rows — the protocol owns them, and
  // editing them here would fork the two. Surfaced so the curve never contains
  // doses the user cannot account for.
  var _protoN = _tcProtocolCount();
  if (_protoN > 0) {
    html += '<div style="background:rgba(102,136,204,0.08);border:1px solid rgba(102,136,204,0.25);border-radius:10px;padding:11px 13px;margin-bottom:12px">' +
      '<div style="font-size:12px;color:#6688cc;font-weight:600">+ ' + _protoN + ' injection' + (_protoN === 1 ? '' : 's') + ' from your TRT protocol</div>' +
      '<div style="font-size:11px;color:var(--muted2);margin-top:3px;line-height:1.45">Included in the curve below. Edit them in Protocols — a dose you log here for the same compound and day overrides the plan.</div>' +
    '</div>';
  }

  html += '<button onclick="_tcAddManualEntry()" style="width:100%;background:#0d0d0d;border:1px dashed #2a2a2a;border-radius:10px;color:#555;font-size:13px;font-weight:700;padding:13px;cursor:pointer;font-family:inherit;letter-spacing:0.5px;margin-bottom:20px">+ ADD INJECTION</button>';

  var validLog = _tcCurveLog();
  if (validLog.length > 0) {
    html += '<div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:14px;padding:14px">' +
      '<div style="font-size:10px;color:#444;letter-spacing:1.8px;font-weight:700;margin-bottom:10px">PLASMA CURVE</div>' +
      '<canvas id="tc-manual-chart" style="width:100%;display:block;"></canvas>' +
    '</div>';
  }

  html += '</div></div>';

  var existing = document.getElementById('tc-log-overlay');
  if (existing) existing.remove();
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  document.body.appendChild(tmp.firstChild);

  if (validLog.length > 0) {
    requestAnimationFrame(function() { _tcDrawManualChart('tc-manual-chart', validLog); });
  }
}

function _tcCloseManualLog() {
  var el = document.getElementById('tc-log-overlay');
  if (el) el.remove();
}

var _tcAddSheet = null;

function _tcAddManualEntry() { _tcShowAddSheet(); }

function _tcShowAddSheet() {
  if (document.getElementById('tc-add-sheet-overlay')) return;
  var comps = _tcManualComps();
  if (!comps.length) return;
  var defaultComp = comps[0];
  var defaultDate;
  var existingDates = (_tcp.manualLog||[]).map(function(e){ return e.date; }).filter(Boolean).sort();
  if (existingDates.length > 0) {
    var p = existingDates[existingDates.length - 1].split('-');
    var next = new Date(+p[0], +p[1] - 1, +p[2] + 1);
    defaultDate = next.getFullYear() + '-' +
      String(next.getMonth() + 1).padStart(2, '0') + '-' +
      String(next.getDate()).padStart(2, '0');
  } else {
    defaultDate = new Date().toISOString().slice(0, 10);
  }
  _tcAddSheet = {isSeries: false};
  var iSty = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:11px 13px;color:var(--text);font-size:15px;font-family:inherit;outline:none;width:100%;box-sizing:border-box';
  var lSty = 'font-size:11px;font-weight:700;letter-spacing:0.8px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;display:block';
  var compOpts = comps.map(function(id){ var n=_tcCompInfo(id).name; return '<option value="'+_esc(id)+'">'+_esc(n)+'</option>'; }).join('');
  var ol = document.createElement('div');
  ol.id = 'tc-add-sheet-overlay';
  ol.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  ol.onclick = function(e){ if(e.target===ol)_tcCloseAddSheet(); };
  ol.innerHTML =
    '<div style="background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px 20px 36px;max-height:85vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
    '<div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--text)">ADD INJECTION</div>' +
    '<button onclick="_tcCloseAddSheet()" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1">×</button>' +
    '</div>' +
    '<div style="margin-bottom:14px"><label style="'+lSty+'">COMPOUND</label>' +
    '<select id="tc-as-comp" style="'+iSty+'">'+compOpts+'</select></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">' +
    '<div style="min-width:0"><label style="'+lSty+'">DOSE (mg)</label>' +
    '<input id="tc-as-dose" type="text" inputmode="decimal" placeholder="e.g. 100" style="'+iSty+'"></div>' +
    '<div style="min-width:0"><label style="'+lSty+'">DATE</label>' +
    '<input id="tc-as-date" type="date" value="'+_esc(defaultDate)+'" style="'+iSty+'"></div>' +
    '</div>' +
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px">' +
    '<div onclick="_tcAsToggle(false)" style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)">' +
    '<div id="tc-as-r1" style="width:16px;height:16px;border-radius:50%;border:2px solid var(--accent);background:var(--accent);flex-shrink:0"></div>' +
    '<div><div style="font-size:13px;font-weight:600;color:var(--text)">Single injection</div><div style="font-size:11px;color:var(--muted2)">One entry logged</div></div>' +
    '</div>' +
    '<div onclick="_tcAsToggle(true)" style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:10px">' +
    '<div id="tc-as-r2" style="width:16px;height:16px;border-radius:50%;border:2px solid var(--border);flex-shrink:0"></div>' +
    '<div><div style="font-size:13px;font-weight:600;color:var(--text)">Recurring series</div><div style="font-size:11px;color:var(--muted2)">Log multiple injections at once</div></div>' +
    '</div>' +
    '</div>' +
    '<div id="tc-as-series-opts" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div><label style="'+lSty+'">INJECTIONS</label>' +
    '<input id="tc-as-count" type="number" inputmode="numeric" min="2" max="365" step="1" value="10" style="'+iSty+'"></div>' +
    '<div><label style="'+lSty+'">EVERY (DAYS)</label>' +
    '<input id="tc-as-interval" type="number" inputmode="numeric" min="1" max="90" step="1" value="2" style="'+iSty+'"></div>' +
    '</div></div>' +
    // A partial write has to be visible in the sheet, not swallowed — back-filling a
    // long series is several POSTs and any of them can fail.
    '<div id="tc-as-err" style="font-size:12px;color:#e8a020;line-height:1.5;margin-bottom:8px"></div>' +
    '<button onclick="_tcConfirmAddSheet()" style="width:100%;background:linear-gradient(135deg,#6688cc,#4466aa);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:800;letter-spacing:0.5px;padding:14px;cursor:pointer;font-family:inherit">ADD</button>' +
    '</div>';
  document.body.appendChild(ol);
}

function _tcAsToggle(isSeries) {
  var r1=document.getElementById('tc-as-r1'); var r2=document.getElementById('tc-as-r2');
  var opts=document.getElementById('tc-as-series-opts');
  if(!r1||!r2||!opts)return;
  if(isSeries){r1.style.background='';r1.style.borderColor='var(--border)';r2.style.background='var(--accent)';r2.style.borderColor='var(--accent)';opts.style.display='block';}
  else{r1.style.background='var(--accent)';r1.style.borderColor='var(--accent)';r2.style.background='';r2.style.borderColor='var(--border)';opts.style.display='none';}
  if(_tcAddSheet)_tcAddSheet.isSeries=isSeries;
}

function _tcCloseAddSheet() {
  var ol=document.getElementById('tc-add-sheet-overlay');if(ol)ol.remove();_tcAddSheet=null;
}

// Back-fill: turn past-dated additions into REAL logged injection records.
//
// The mirror of the delete bug (2026-08-07). manualLog became a cache, so pushing a
// past-dated row into it and calling buildTCalc() rebuilt the cache from the backend
// and the row vanished — and _tcSyncLogToBackend only writes entries from TODAY
// forward, so nothing persisted it either. Adding a past injection was a no-op.
//
// This is the same thing T-History's "+ Log a past injection" has always done
// (savePastInjection in tab-thist.js): POST a record with logged:true, which is what
// makes it the past. The body shape is kept identical to that one so both back-fill
// paths produce indistinguishable rows.
//
// cycle_id: the bound stack's when there is one, so the dose also shows in Today and
// the week strip. With no stack bound there is nothing to attach it to and it falls
// back to 'manual' — the namespace refreshInjectionsCache renders unconditionally and
// which tab-thist.js already writes for exactly this case.
async function _tcCreateLoggedInjections(compId, doseMg, dates, seriesId){
  if (typeof authHeaders !== 'function') return 0;
  var cd   = _tcCompInfo(compId);
  var meta = (typeof _injPkMeta === 'function') ? _injPkMeta('trt', compId)
                                                : {ester:null, half_life_days:null};
  var cyc  = _tcTargetCycleId() || 'manual';
  var ok = 0;
  for (var i = 0; i < dates.length; i++){
    var body = {cycle_id: cyc, date: dates[i], compound_id: compId,
                compound_name: cd.name || compId, tier: 'trt',
                dose: String(doseMg), unit: 'mg', dot: cd.dot || '#e8a020',
                time_of_day: null, active: true, logged: true, source: 'manual',
                series_id: seriesId || null,
                ester: meta.ester, half_life_days: meta.half_life_days, route: null};
    try{
      var r = await fetch(AGENT_URL + '/injections',
                          {method:'POST', headers: authHeaders({'Content-Type':'application/json'}),
                           body: JSON.stringify(body)});
      if (r.ok) ok++; else _logHttp('tcAddInj', r.status, '/injections');
    }catch(e){ _logErr('tcAddInj', e); }
  }
  return ok;
}

// Past-dated doses belonging to a PLAN, not to the record: logged:false. Used when an
// edited series covers days already gone by. Re-typing a cadence is not a claim that
// those doses were injected, so this must never write logged:true — that is
// _tcCreateLoggedInjections' job, and it is called only from the Add sheet where the
// user is explicitly entering doses they took. Today is the only place a plan becomes
// a record.
async function _tcCreatePlannedInjections(compId, doseMg, dates, seriesId){
  if (typeof authHeaders !== 'function') return 0;
  var cd   = _tcCompInfo(compId);
  var meta = (typeof _injPkMeta === 'function') ? _injPkMeta('trt', compId)
                                                : {ester:null, half_life_days:null};
  var cyc  = _tcTargetCycleId() || 'manual';
  var ok = 0;
  for (var i = 0; i < dates.length; i++){
    var body = {cycle_id: cyc, date: dates[i], compound_id: compId,
                compound_name: cd.name || compId, tier: 'trt',
                dose: String(doseMg), unit: 'mg', dot: cd.dot || '#e8a020',
                time_of_day: null, active: true, logged: false, source: 'tcalc',
                series_id: seriesId || null,
                ester: meta.ester, half_life_days: meta.half_life_days, route: null};
    try{
      var r = await fetch(AGENT_URL + '/injections',
                          {method:'POST', headers: authHeaders({'Content-Type':'application/json'}),
                           body: JSON.stringify(body)});
      if (r.ok) ok++; else _logHttp('tcAddPlanInj', r.status, '/injections');
    }catch(e){ _logErr('tcAddPlanInj', e); }
  }
  return ok;
}

async function _tcConfirmAddSheet() {
  var compEl=document.getElementById('tc-as-comp');
  var doseEl=document.getElementById('tc-as-dose');
  var dateEl=document.getElementById('tc-as-date');
  var countEl=document.getElementById('tc-as-count');
  var intervalEl=document.getElementById('tc-as-interval');
  var errEl=document.getElementById('tc-as-err');
  var compId=compEl?compEl.value:'';
  var doseMg=doseEl?parseDec(doseEl.value):0;
  var startDate=dateEl?dateEl.value:'';
  var isSeries=_tcAddSheet&&_tcAddSheet.isSeries;
  if(!compId||!startDate||!(doseMg>0)){return;}
  if(!_tcp.manualLog)_tcp.manualLog=[];

  var dates=[];
  if(!isSeries){
    dates.push(startDate);
  }else{
    var count=countEl?Math.max(2,parseInt(countEl.value)||10):10;
    var intervalDays=intervalEl?Math.max(1,parseInt(intervalEl.value)||2):2;
    var sp=startDate.split('-');
    for(var i=0;i<count;i++){
      var sd=new Date(+sp[0],+sp[1]-1,+sp[2]+i*intervalDays);
      dates.push(sd.getFullYear()+'-'+String(sd.getMonth()+1).padStart(2,'0')+'-'+String(sd.getDate()).padStart(2,'0'));
    }
  }

  // A series can straddle today: the dates already taken are records, the ones ahead
  // are still a plan. Split rather than force the whole series into one of the two.
  var todayStr=dateKey(NOW);
  var past=dates.filter(function(d){return d<=todayStr;});
  var future=dates.filter(function(d){return d>todayStr;});

  // One id across the WHOLE run. A series that straddles today is split into records
  // and plan for storage, but it is still one series the user authored — giving each
  // half its own id would render it as two unrelated cards.
  var runId=dates.length>1?Date.now().toString(36):undefined;

  if(past.length){
    var wrote=await _tcCreateLoggedInjections(compId,doseMg,past,runId);
    if(wrote<past.length){
      if(errEl)errEl.textContent='Saved '+wrote+' of '+past.length+' — try again for the rest.';
      else alert('Saved '+wrote+' of '+past.length+' injections. Try again for the rest.');
      if(!wrote)return;                       // nothing landed: keep the sheet open
    }
  }
  if(future.length){
    future.forEach(function(ds){
      // draft: planned here, not yet in the record. Save to protocol is what
      // persists it — until then _tcLoadLogFromStack must carry it forward.
      _tcp.manualLog.push({compId:compId,doseMg:doseMg,date:ds,seriesId:runId,draft:true});
    });
    _tcp.manualLog.sort(function(a,b){return(a.date||'')<(b.date||'')?-1:(a.date||'')>(b.date||'')?1:0;});
    _tcSaveProfile();
    // MUST be awaited here, before the re-read below. _tcLoadLogFromStack() assigns
    // _tcp.manualLog outright from the record, so any future dose still only in the
    // profile is erased by it. Syncing afterwards then wrote that erased state back:
    // a 10-dose series starting today kept only the one logged dose for today, which
    // is the single case where past.length and future.length are both non-zero.
    await _tcSyncLogToBackend();
  }
  _tcCloseAddSheet();
  if(past.length){
    await _tcFetchHistory(true);                                  // re-read; do not guess
    if(typeof refreshInjectionsCache==='function')await refreshInjectionsCache();
    _tcLoadLogFromStack();
  }
  buildTCalc();
  if(past.length){
    if(typeof buildToday==='function')buildToday();
    if(typeof buildWeekStrip==='function')buildWeekStrip();
  }
}

function _tcConfirmRemove(idx) {
  var ex = document.getElementById('tc-del-confirm');
  if (ex) ex.remove();
  var entry = _tcp.manualLog && _tcp.manualLog[idx];
  var sid = entry && entry.seriesId;
  var seriesCount = sid ? _tcp.manualLog.filter(function(e){ return e.seriesId===sid; }).length : 0;
  var d = document.createElement('div');
  d.id = 'tc-del-confirm';
  d.style.cssText = 'position:fixed;inset:0;background:#000c;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  d.innerHTML =
    '<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;max-width:300px;width:100%;text-align:center">' +
      '<div style="font-size:13px;color:var(--accent);font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Delete this injection?</div>' +
      '<div style="font-size:12px;color:#555;margin-bottom:20px">This cannot be undone.</div>' +
      (sid && seriesCount > 1 ?
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button onclick="document.getElementById(\'tc-del-confirm\').remove();_tcRemoveManualEntry(' + idx + ')" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;color:#ccc;font-size:13px;font-weight:700;padding:12px;cursor:pointer;font-family:inherit">Delete this entry only</button>' +
        '<button onclick="document.getElementById(\'tc-del-confirm\').remove();_tcRemoveSeries(\''+sid+'\')" style="background:var(--danger,#ef4444);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;padding:12px;cursor:pointer;font-family:inherit">Delete all '+seriesCount+' in series</button>' +
        '<button onclick="document.getElementById(\'tc-del-confirm\').remove()" style="background:none;border:none;color:#555;font-size:13px;cursor:pointer;padding:8px;font-family:inherit">Cancel</button>' +
        '</div>'
      :
        '<div style="display:flex;gap:10px">' +
        '<button onclick="document.getElementById(\'tc-del-confirm\').remove()" style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;color:#888;font-size:13px;font-weight:700;padding:12px;cursor:pointer;font-family:inherit">Cancel</button>' +
        '<button onclick="document.getElementById(\'tc-del-confirm\').remove();_tcRemoveManualEntry(' + idx + ')" style="flex:1;background:var(--accent);border:none;border-radius:10px;color:#000;font-size:13px;font-weight:700;padding:12px;cursor:pointer;font-family:inherit">Delete</button>' +
        '</div>'
      ) +
    '</div>';
  document.body.appendChild(d);
}

// ── Deleting a row has to reach the stored injection ─────────────────────────
// manualLog stopped being a store on 2026-08-07 and became a cache rebuilt from the
// logged history on every render. Splicing it and calling buildTCalc() therefore
// deleted nothing: the row came straight back from injections.json, and
// _tcSyncLogToBackend only ever rewrites entries from TODAY forward, so a past dose
// was never reachable at all. Reported the same day — a test 1000 mg Nebido on 5 July
// that could not be removed and was distorting the whole curve.
//
// A row carrying injId IS a stored injection: delete the record. Everything else is
// a profile-only row and keeps the old local behaviour.
async function _tcDeleteStoredInjection(injId) {
  if (typeof authHeaders !== 'function') return false;
  try {
    var r = await fetch(AGENT_URL + '/injections/' + encodeURIComponent(injId),
                        {method: 'DELETE', headers: authHeaders()});
    // 404 means it is already gone — the user's intent is satisfied either way.
    if (!r.ok && r.status !== 404) { _logHttp('tcDelInj', r.status, '/injections/' + injId); return false; }
    return true;
  } catch (e) { _logErr('tcDelInj', e); return false; }
}

async function _tcRemoveManualEntry(idx) {
  if (!_tcp.manualLog) return;
  var row = _tcp.manualLog[idx];
  if (!row) return;
  if (row.injId) {
    // Reaches the backend, so it is gone from every device — say so first.
    if (typeof confirmGlobalDelete === 'function' &&
        !confirmGlobalDelete('this ' + (row.doseMg ? row.doseMg + ' mg ' : '') + 'injection on ' + row.date)) return;
    if (!await _tcDeleteStoredInjection(row.injId)) { buildTCalc(); return; }
    await _tcFetchHistory(true);                                  // re-read; do not guess
    if (typeof refreshInjectionsCache === 'function') await refreshInjectionsCache();
    _tcLoadLogFromStack();
    buildTCalc();
    if (typeof buildToday === 'function') buildToday();
    if (typeof buildWeekStrip === 'function') buildWeekStrip();
    return;
  }
  _tcp.manualLog.splice(idx, 1);
  _tcSaveProfile();
  buildTCalc();
  _tcSyncLogToBackend();
}

async function _tcRemoveSeries(seriesId) {
  if (!_tcp.manualLog || !seriesId) return;
  var stored = _tcp.manualLog.filter(function(e){ return e.seriesId === seriesId && e.injId; });
  if (stored.length) {
    if (typeof confirmGlobalDelete === 'function' &&
        !confirmGlobalDelete('all ' + stored.length + ' injections in this series')) return;
    for (var i = 0; i < stored.length; i++) await _tcDeleteStoredInjection(stored[i].injId);
    await _tcFetchHistory(true);
    if (typeof refreshInjectionsCache === 'function') await refreshInjectionsCache();
  }
  _tcp.manualLog = _tcp.manualLog.filter(function(e){ return e.seriesId !== seriesId; });
  _tcSaveProfile();
  if (stored.length) _tcLoadLogFromStack();
  buildTCalc();
  if (stored.length) {
    if (typeof buildToday === 'function') buildToday();
    if (typeof buildWeekStrip === 'function') buildWeekStrip();
  } else {
    _tcSyncLogToBackend();
  }
}

function _tcOpenEditSeriesSheet(sid) {
  if (!_tcp || !_tcp.manualLog) return;
  var entries = _tcp.manualLog.filter(function(e){ return e.seriesId === sid; }).sort(function(a,b){ return (a.date||'') < (b.date||'') ? -1 : (a.date||'') > (b.date||'') ? 1 : 0; });
  if (!entries.length) return;
  var first = entries[0];
  var compId = first.compId;
  var doseMg = first.doseMg || '';
  var startDate = first.date || new Date().toISOString().slice(0,10);
  var count = entries.length;
  // Same MODAL-gap cadence the series card shows. Reading entries[1]-entries[0] made
  // the sheet disagree with the card the moment a dose was missing — the card said
  // "every 2 days · 2 missed" while the editor pre-filled 6, so simply opening it and
  // pressing SAVE rewrote an EOD run to every-6-days.
  var interval = 2;
  if (entries.length >= 2) {
    var _eg = {}, _eBest = 0, _eBestN = 0;
    for (var _ei = 1; _ei < entries.length; _ei++) {
      var _p0 = (entries[_ei-1].date||'').split('-'), _p1 = (entries[_ei].date||'').split('-');
      var _g = Math.round((new Date(+_p1[0],+_p1[1]-1,+_p1[2]) - new Date(+_p0[0],+_p0[1]-1,+_p0[2]))/86400000);
      if (!(_g > 0)) continue;
      _eg[_g] = (_eg[_g]||0) + 1;
      if (_eg[_g] > _eBestN || (_eg[_g] === _eBestN && _g < _eBest)) { _eBest = _g; _eBestN = _eg[_g]; }
    }
    interval = Math.max(1, _eBest || 2);
  }
  _tcEditSeriesId = sid;
  var comps = _tcManualComps();
  var iSty = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:11px 13px;color:var(--text);font-size:15px;font-family:inherit;outline:none;width:100%;box-sizing:border-box';
  var lSty = 'font-size:11px;font-weight:700;letter-spacing:0.8px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;display:block';
  var compOpts = comps.map(function(id){ var n=_tcCompInfo(id).name; return '<option value="'+_esc(id)+'"'+(id===compId?' selected':'')+'>'+_esc(n)+'</option>'; }).join('');
  var ol = document.createElement('div');
  ol.id = 'tc-edit-series-overlay';
  ol.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  ol.onclick = function(e){ if(e.target===ol)_tcCloseEditSeriesSheet(); };
  ol.innerHTML =
    '<div style="background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px 20px 36px;max-height:85vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
    '<div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--text)">EDIT SERIES</div>' +
    '<button onclick="_tcCloseEditSeriesSheet()" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1">×</button>' +
    '</div>' +
    '<div style="margin-bottom:14px"><label style="'+lSty+'">COMPOUND</label>' +
    '<select id="tc-es-comp" style="'+iSty+'">'+compOpts+'</select></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">' +
    '<div style="min-width:0"><label style="'+lSty+'">DOSE (mg)</label>' +
    '<input id="tc-es-dose" type="text" inputmode="decimal" placeholder="e.g. 100" value="'+_esc(String(doseMg))+'" style="'+iSty+'"></div>' +
    '<div style="min-width:0"><label style="'+lSty+'">START DATE</label>' +
    '<input id="tc-es-date" type="date" value="'+_esc(startDate)+'" style="'+iSty+'"></div>' +
    '</div>' +
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div><label style="'+lSty+'">INJECTIONS</label>' +
    '<input id="tc-es-count" type="number" inputmode="numeric" min="2" max="365" step="1" value="'+_esc(String(count))+'" style="'+iSty+'"></div>' +
    '<div><label style="'+lSty+'">EVERY (DAYS)</label>' +
    '<input id="tc-es-interval" type="number" inputmode="numeric" min="1" max="90" step="1" value="'+_esc(String(interval))+'" style="'+iSty+'"></div>' +
    '</div></div>' +
    '<button onclick="_tcSaveEditSeries()" style="width:100%;background:linear-gradient(135deg,#6688cc,#4466aa);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:800;letter-spacing:0.5px;padding:14px;cursor:pointer;font-family:inherit">SAVE</button>' +
    '</div>';
  document.body.appendChild(ol);
}

function _tcCloseEditSeriesSheet() {
  var ol=document.getElementById('tc-edit-series-overlay');if(ol)ol.remove();_tcEditSeriesId=null;
}

function _tcShowSeriesDetail(sid) {
  if (!_tcp || !_tcp.manualLog) return;
  var entries = _tcp.manualLog.filter(function(e){ return e.seriesId === sid; }).sort(function(a,b){ return (a.date||'') < (b.date||'') ? -1 : (a.date||'') > (b.date||'') ? 1 : 0; });
  if (!entries.length) return;
  var mcd = _tcCompInfo(entries[0].compId || '');
  var fmtD = function(iso){ if(!iso)return''; var p=iso.split('-'); var M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return parseInt(p[2],10)+' '+M[parseInt(p[1],10)-1]; };
  var lSty = 'font-size:11px;font-weight:700;letter-spacing:0.8px;color:var(--muted);text-transform:uppercase';
  var listHtml = entries.map(function(e, i){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<div style="'+lSty+'">INJ ' + (i+1) + '</div>' +
      '<div style="font-size:13px;font-weight:600;color:var(--text)">' + fmtD(e.date||'') + '</div>' +
      '<div style="font-size:13px;font-weight:600;color:#6688cc">' + _esc(String(e.doseMg||'')) + ' mg</div>' +
      '</div>';
  }).join('');
  var ol = document.createElement('div');
  ol.id = 'tc-series-detail-overlay';
  ol.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  ol.onclick = function(e){ if(e.target===ol) ol.remove(); };
  ol.innerHTML =
    '<div style="background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px 20px 36px;max-height:80vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
    '<div><div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--text)">SERIES INJECTIONS</div>' +
    '<div style="font-size:11px;color:var(--muted2);margin-top:2px">' + _esc(mcd.name) + ' · ' + entries.length + ' injections</div></div>' +
    '<button onclick="document.getElementById(\'tc-series-detail-overlay\').remove()" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1">×</button>' +
    '</div>' + listHtml + '</div>';
  document.body.appendChild(ol);
}

function _tcSetChartZoom(z) {
  _tcChartZoom = z;
  _tcChartPanOffset = 0;
  var validLog = _tcCurveLog();
  _tcDrawManualChart('tc-main-chart', validLog, z);
  _tcAttachPanListeners(document.getElementById('tc-main-chart'));
  ['today','week','month','whole'].forEach(function(zz) {
    var btn = document.getElementById('tc-zoom-' + zz);
    if (!btn) return;
    btn.style.background   = zz === z ? 'rgba(102,136,204,0.25)' : 'none';
    btn.style.color        = zz === z ? '#6688cc' : 'var(--muted2)';
    btn.style.borderColor  = zz === z ? '#6688cc66' : 'var(--border)';
  });
}

// Steady-state average reference line — shown by default, hideable via the chart
// checkbox. Read the raw flag (getData's `|| default` would turn a stored false
// back into true, so check the string directly). Default = shown.
function _tcShowAvg() {
  try { return localStorage.getItem('tc-avg-line') !== 'false'; } catch (e) { return true; }
}
function _tcToggleAvgLine(el) {
  var v = el ? !!el.checked : !_tcShowAvg();
  setData('tc-avg-line', v);
  if (typeof pushPepSettingsToAgent === 'function') pushPepSettingsToAgent({ 'tc-avg-line': v });
  var validLog = _tcCurveLog();
  _tcDrawManualChart('tc-main-chart', validLog, _tcChartZoom);
}

function _tcAttachPanListeners(canvas) {
  if (!canvas) return;
  if (canvas._tcTouchStart) {
    canvas.removeEventListener('touchstart', canvas._tcTouchStart);
    canvas.removeEventListener('touchmove', canvas._tcTouchMove);
    canvas.removeEventListener('touchend', canvas._tcTouchEnd);
    canvas.removeEventListener('mousedown', canvas._tcMouseDown);
    canvas.removeEventListener('mousemove', canvas._tcMouseMove);
    canvas.removeEventListener('mouseup', canvas._tcMouseEnd);
    canvas._tcTouchStart = null;
  }
  var state = canvas._tcPanState;
  if (!state || state.zoom === 'whole') { canvas.style.cursor = ''; canvas.style.touchAction = ''; return; }
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'pan-y';
  var _pDX = null, _pDY = null, _pOff = null;
  canvas._tcTouchStart = function(e) {
    var t = e.touches ? e.touches[0] : e;
    _pDX = t.clientX; _pDY = t.clientY; _pOff = _tcChartPanOffset;
  };
  canvas._tcTouchMove = function(e) {
    if (_pDX === null) return;
    var t = e.touches ? e.touches[0] : e;
    var dx = t.clientX - _pDX, dy = t.clientY - (_pDY || 0);
    if (e.touches && Math.abs(dx) <= Math.abs(dy)) return;
    if (e.preventDefault) e.preventDefault();
    var s = canvas._tcPanState || state;
    _tcChartPanOffset = _pOff - dx * ((s.xEnd - s.xStart) / (s.cW || 250));
    // Redraw from the LIVE planner's schedule. This used to filter _tcp.manualLog, which
    // is empty whenever the simple planner is the live one — so dragging redrew an empty
    // chart and the curve simply would not pan. Same mistake as the curve gate in
    // buildTCalc; _tcCurveLog() is the single source both must use.
    _tcDrawManualChart(canvas.id, _tcCurveLog(), _tcChartZoom);
  };
  canvas._tcTouchEnd = function() { _pDX = null; };
  canvas._tcMouseDown = canvas._tcTouchStart;
  canvas._tcMouseMove = function(e) { if (e.buttons & 1) canvas._tcTouchMove(e); };
  canvas._tcMouseEnd = canvas._tcTouchEnd;
  canvas.addEventListener('touchstart', canvas._tcTouchStart, {passive: true});
  canvas.addEventListener('touchmove', canvas._tcTouchMove, {passive: false});
  canvas.addEventListener('touchend', canvas._tcTouchEnd);
  canvas.addEventListener('mousedown', canvas._tcMouseDown);
  canvas.addEventListener('mousemove', canvas._tcMouseMove);
  canvas.addEventListener('mouseup', canvas._tcMouseEnd);
}

async function _tcSaveEditSeries() {
  var sid = _tcEditSeriesId;
  if (!sid || !_tcp || !_tcp.manualLog) return;
  var compEl=document.getElementById('tc-es-comp');
  var doseEl=document.getElementById('tc-es-dose');
  var dateEl=document.getElementById('tc-es-date');
  var countEl=document.getElementById('tc-es-count');
  var intervalEl=document.getElementById('tc-es-interval');
  var compId=compEl?compEl.value:'';
  var doseMg=doseEl?parseDec(doseEl.value):0;
  var startDate=dateEl?dateEl.value:'';
  var count=countEl?Math.max(2,parseInt(countEl.value)||10):10;
  var intervalDays=intervalEl?Math.max(1,parseInt(intervalEl.value)||2):2;
  if(!compId||!startDate||!(doseMg>0)){return;}
  var _prev=_tcp.manualLog.filter(function(e){ return e.seriesId === sid; });
  _tcp.manualLog = _tcp.manualLog.filter(function(e){ return e.seriesId !== sid; });
  var sp=startDate.split('-');
  var _dates=[];
  for(var i=0;i<count;i++){
    var sd=new Date(+sp[0],+sp[1]-1,+sp[2]+i*intervalDays);
    _dates.push(sd.getFullYear()+'-'+String(sd.getMonth()+1).padStart(2,'0')+'-'+String(sd.getDate()).padStart(2,'0'));
  }
  // ── THE PAST HALF OF AN EDITED SERIES IS RECONCILED, NOT DISCARDED ──────────
  // Every dose used to be pushed as draft:true. _tcSyncLogToBackend only writes from
  // today forward and _tcLoadLogFromStack only carries drafts from today forward, so
  // each save deleted the past-dated doses that were not already logged records —
  // "10 injections every 2 days" came back as 8, and every further edit shed two more.
  //
  // A past-dated dose is written as a PLAN row (logged:false), never as a record. The
  // user re-typed a cadence; that is not a statement that they injected on those days,
  // and only Today may turn a plan into a record. Doses already ticked are left exactly
  // as they are — the record owns the past.
  var _editTodayK=dateKey(NOW);
  var cidNow=_tcTargetCycleId();
  var _pastDates=_dates.filter(function(d){ return d < _editTodayK; });
  var _loggedOn={};
  _tcLoggedHistory().forEach(function(e){ _loggedOn[e.compId+'|'+e.date]=true; });
  // TWO DIFFERENT QUESTIONS, TWO DIFFERENT KEYS. Getting this wrong duplicated rows.
  //
  //  _storedAny — "does the record already hold this dose?" Keyed on (compound, date)
  //  across EVERY series. A dose is a dose: the series it happens to be filed under is
  //  irrelevant to whether it exists. Filtering this by seriesId meant a run that had
  //  been split across two cards (or whose rows carried no series_id at all) failed to
  //  match, so the edit POSTed a SECOND row for a date the record already had. Today
  //  de-dupes on (compound, slot) and prefers the logged one, so ticking the dose
  //  marked one row and left its twin unlogged — _tcSkippedPast kept reporting it, the
  //  curve kept flat-lining, and the tick looked like it had been thrown away on
  //  restart. Reported as "even if I go and check those they are gone after app
  //  restart".
  //
  //  _storedMine — "may this edit retire the row?" Keyed the same way but restricted to
  //  THIS series. An edit to one run must never delete another run's doses; that is the
  //  never-merge-cards rule expressed in code.
  var _storedAny={}, _storedMine={};
  (_tcSkippedPast||[]).forEach(function(e){
    if(!e||!e.date)return;
    if(cidNow&&String(e.cycleId||'')&&String(e.cycleId||'')!==cidNow)return;
    _storedAny[e.compId+'|'+e.date]=e;
    if(e.seriesId===sid) _storedMine[e.compId+'|'+e.date]=e;
  });
  // Retire stored plan rows this edit removed from the run. Only unticked ones, and
  // only this series' own — a ticked dose is a record and an edit never deletes one.
  var _stale=Object.keys(_storedMine).filter(function(k){
    return _pastDates.indexOf(_storedMine[k].date)<0 || _storedMine[k].compId!==compId;
  }).map(function(k){ return _storedMine[k]; });
  var _toCreate=_pastDates.filter(function(d){
    return !_loggedOn[compId+'|'+d] && !_storedAny[compId+'|'+d];
  });
  for(var _si=0;_si<_stale.length;_si++){
    if(_stale[_si].injId) await _tcDeleteStoredInjection(_stale[_si].injId);
  }
  if(_toCreate.length) await _tcCreatePlannedInjections(compId,doseMg,_toCreate,sid);
  // The future half stays a draft until it is synced, exactly as before.
  _dates.forEach(function(ds){
    if(ds < _editTodayK) return;
    _tcp.manualLog.push({compId:compId,doseMg:doseMg,date:ds,seriesId:sid,draft:true});
  });
  _tcp.manualLog.sort(function(a,b){return(a.date||'')<(b.date||'')?-1:(a.date||'')>(b.date||'')?1:0;});
  _tcSaveProfile();
  _tcCloseEditSeriesSheet();
  // Persist FIRST. buildTCalc() calls _tcLoadLogFromStack(), which replaces
  // _tcp.manualLog with what the record holds — running it before the sync threw
  // the edit away and then wrote the pre-edit state back, so nothing ever saved.
  await _tcSyncLogToBackend();
  await _tcFetchHistory(true);
  _tcLoadLogFromStack();
  buildTCalc();
}

function _tcConfirmRemoveSeries(sid) {
  var ex = document.getElementById('tc-del-confirm');
  if (ex) ex.remove();
  var count = _tcp.manualLog ? _tcp.manualLog.filter(function(e){ return e.seriesId===sid; }).length : 0;
  var d = document.createElement('div');
  d.id = 'tc-del-confirm';
  d.style.cssText = 'position:fixed;inset:0;background:#000c;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  d.innerHTML =
    '<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;max-width:300px;width:100%;text-align:center">' +
      '<div style="font-size:13px;color:var(--accent);font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Delete this series?</div>' +
      '<div style="font-size:12px;color:#555;margin-bottom:20px">' + count + ' injections will be removed. This cannot be undone.</div>' +
      '<div style="display:flex;gap:10px">' +
      '<button onclick="document.getElementById(\'tc-del-confirm\').remove()" style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;color:#888;font-size:13px;font-weight:700;padding:12px;cursor:pointer;font-family:inherit">Cancel</button>' +
      '<button onclick="document.getElementById(\'tc-del-confirm\').remove();_tcRemoveSeries(\'' + sid + '\')" style="flex:1;background:var(--danger,#ef4444);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;padding:12px;cursor:pointer;font-family:inherit">Delete</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(d);
}

function _tcSetManualField(idx, field, val) {
  if (!_tcp.manualLog || !_tcp.manualLog[idx]) return;
  _tcp.manualLog[idx][field] = val;
  _tcSaveProfile();
  if (field === 'compId') {
    buildTCalc();
    _tcSyncLogToBackend();
  } else {
    var validLog = _tcCurveLog();
    if (validLog.length > 0 && document.getElementById('tc-main-chart')) {
      _tcDrawManualChart('tc-main-chart', validLog, _tcChartZoom);
    } else {
      buildTCalc();
    }
    _tcSyncLogToBackend();
  }
}

// Toggle bloodwork panel open/closed
function _tcToggleBw() {
  _tcBwOpen = !_tcBwOpen;
  buildTCalc();
}

// ── Bloodwork backend functions ───────────────────────────────────────────────

async function _tcFetchBwEntries() {
  var h = (typeof authHeaders==='function') ? authHeaders() : null;
  if (!h) { _tcBwEntries = []; _tcBwLoading = false; buildTCalc(); return; }
  try {
    var r = await fetch(AGENT_URL + '/bloodwork', {headers: h});
    _tcBwEntries = r.ok ? (await r.json()) : [];
  } catch(_e) { _tcBwEntries = []; }
  _tcBwEntries.sort(function(a,b){ return (b.date||'') < (a.date||'') ? -1 : 1; });
  // Sync most-recent entry into _tcp so calibration code reads correct values
  var latest = _tcBwEntries[0];
  if (latest) {
    if (latest.total_t    != null) _tcp.totalT         = String(latest.total_t);
    if (latest.shbg       != null) _tcp.shbg           = String(latest.shbg);
    if (latest.free_t     != null) _tcp.measuredFT     = String(latest.free_t);
    if (latest.dose_at_bw != null) _tcp.currentDoseMgWk = String(latest.dose_at_bw);
  }
  _tcBwLoading = false;
  buildTCalc();
  // Vitamin D recommendation in the Supplements tab reads from bloodwork too.
  if (typeof buildSupplements === 'function' && typeof _currentTab !== 'undefined' && _currentTab === 'supplements') buildSupplements();
}


// Age→free-T reference midpoint (pmol/L) used when no measured free T is entered.
// The table is reference DATA and lives in the backend (/systemic-interactions →
// ftBaseline); we only hold it here once fetched. Returns 0 (neutral) until it loads
// so no population numbers are ever hardcoded in the frontend.
function _tcDefaultFT(birthYear) {
  var b = _tcFtBaseline;
  if (!b || !b.bands) return 0;
  if (!birthYear) return b.default || 0;
  var age = new Date().getFullYear() - birthYear;
  for (var i = 0; i < b.bands.length; i++) {
    if (age <= b.bands[i].max_age) return b.bands[i].value;
  }
  return b.bands[b.bands.length - 1].value;
}

// Pure free-T model extracted from _tcDrawManualChart so BOTH the T-Calc chart
// and the Blood Levels tab compute free T from the SAME code (no divergence).
// sorted: injection log sorted ascending by date. hooks: optional {calFT,shbg,start}
// test hooks (same payloads the draw path used to fire on the canvas).
// Returns the day-indexed accumulation + calibration so callers can render free T
// as total[t] * (calFT_arr ? calFT_arr[t] : scale).
function _tcFreeTSeries(sorted, hooks) {
  hooks = hooks || {};
  // Every date-only string in this function is parsed at LOCAL NOON. Mixing conventions
  // is a real off-by-one: a bare new Date('2026-06-01') is UTC midnight, while the
  // bloodwork/suppressor dates below are parsed as '<date>T12:00:00' (local noon) to stay
  // DST-proof. Differencing the two gives a half-day remainder that Math.round promotes to
  // a whole day, so the draw landed on index 20 of a series starting 2026-06-01 instead of
  // 19 — and the curve was anchored one day off the measurement it was calibrated against.
  var firstDate = new Date(sorted[0].date + 'T12:00:00');
  var lastDate  = new Date(sorted[sorted.length - 1].date + 'T12:00:00');

  var maxHL = 1;
  sorted.forEach(function(e) {
    var _ci = _tcCompInfo(e.compId);
    // Size the washout window off the slowest plausible half-life, or a wide band's
    // tail gets clipped before it has decayed.
    var hl = (_ci.halfLifeDaysHigh || _ci.halfLifeDays) || 1;
    if (hl > maxHL) maxHL = hl;
  });
  var washoutDays = Math.ceil(4.3 * maxHL);

  var totalDays = Math.ceil((lastDate - firstDate) / 86400000) + washoutDays + 1;
  var total = new Float64Array(totalDays + 1);
  // PK uncertainty band. Depot esters are flip-flop kinetic — the apparent half-life is
  // the oil depot releasing, not testosterone clearing — and the published range is wide
  // enough that steady-state level differs >2x across it. Where the backend declares a
  // range we project the low and high series alongside the central estimate so callers
  // can show a band rather than a line implying precision the data does not support.
  var totalLo = new Float64Array(totalDays + 1);
  var totalHi = new Float64Array(totalDays + 1);
  var hasPkBand = false;

  sorted.forEach(function(e) {
    var cd    = _tcCompInfo(e.compId);
    var hl    = cd.halfLifeDays || 1;
    var hlLo  = cd.halfLifeDaysLow  || hl;
    var hlHi  = cd.halfLifeDaysHigh || hl;
    if (hlLo !== hl || hlHi !== hl) hasPkBand = true;
    var bioav = cd.bioavailability || 1;
    var injectDay = Math.round((new Date(e.date + 'T12:00:00') - firstDate) / 86400000);
    // A dose is prescribed as ESTER mass, but only the testosterone part is the drug:
    // 100 mg of enanthate is 72.0 mg of testosterone, undecanoate 63.2 mg. For a
    // single-ester user this is a constant the calibration absorbs, so it never showed;
    // it is a real error the moment two esters are compared or one is switched for
    // another (enanthate vs undecanoate is 14%).
    var absorbed  = parseDec(e.doseMg) * bioav * (cd.testosteroneFraction || 1);
    var series = [[hl, total], [hlLo, totalLo], [hlHi, totalHi]];
    for (var si = 0; si < series.length; si++) {
      var _hl = series[si][0], arr = series[si][1];
      var ke  = Math.LN2 / _hl;
      var ka  = _tcKa(_hl, cd.tmaxDays);
      for (var t = injectDay; t <= totalDays; t++) {
        // ABSOLUTE APPEARANCE RATE, mg testosterone/day — not an arbitrary PK scale.
        // _tcPkConc integrates to dose/ke, so ke*_tcPkConc integrates to exactly the
        // injected testosterone mass: every mg eventually appears, nothing invented.
        // This is what lets the whole curve be computed from physiology instead of
        // being scaled to fit one lab value. See the model note above _tcFreeTSeries.
        arr[t] += ke * _tcPkConc(absorbed, ka, ke, t - injectDay);
      }
    }
  });

  // PK band: order the two half-life series element-wise, do not assume the shorter
  // half-life is the lower curve. In APPEARANCE-RATE units a faster-releasing ester gives
  // a HIGHER rate early and a lower one later, so hlLo/hlHi cross the central curve
  // instead of bracketing it. (Under the old amount-like units longer half-life simply
  // meant more accumulation, so lo/hi held by construction.) Taking min/max per day keeps
  // the band an honest envelope of the declared half-life range at every timepoint.
  if (hasPkBand) {
    for (var _bd = 0; _bd <= totalDays; _bd++) {
      var _bl = totalLo[_bd], _bh = totalHi[_bd];
      totalLo[_bd] = Math.min(_bl, _bh);
      totalHi[_bd] = Math.max(_bl, _bh);
    }
  }

  // Calibrated pmol/L scale using settled peak/trough over the log window (not washout tail)
  var _mftNum  = parseDec(_tcp.measuredFT)      || _tcDefaultFT(parseInt(_tcp.birthYear) || 0);
  // True when the free-T level is an age-based population default rather than the
  // user's own measured value — drives the confidence tier / warning band below.
  var _ftIsDefault = !(parseDec(_tcp.measuredFT) > 0);
  var _curDose = parseDec(_tcp.currentDoseMgWk) || 0;
  var _logDays = totalDays - washoutDays - 1;
  var _midLog  = Math.max(0, Math.floor(_logDays / 2));
  var _logPeak = 0, _logTrough = Infinity;
  for (var _ls = _midLog; _ls <= _logDays; _ls++) {
    if (total[_ls] > _logPeak)   _logPeak   = total[_ls];
    if (total[_ls] < _logTrough) _logTrough = total[_ls];
  }
  if (_logPeak === 0) { for (var _ls2 = 0; _ls2 <= totalDays; _ls2++) if (total[_ls2] > _logPeak) _logPeak = total[_ls2]; }
  if (_logTrough === Infinity) _logTrough = _logPeak;
  var _logMean = (_logPeak + _logTrough) / 2 || _logPeak;
  // Always compute absorbed totals — needed for both calFT and warm-start
  var _totalAbsMg = 0;
  sorted.forEach(function(e) { var _ci2 = _tcCompInfo(e.compId);
    _totalAbsMg += parseDec(e.doseMg) * (_ci2.bioavailability || 1) * (_ci2.testosteroneFraction || 1); });
  var _effMgWk = _logDays > 0 ? _totalAbsMg / _logDays * 7 : 0;

  // NOTE: calFT is deliberately NOT fitted here. It used to be set to _mftNum/_logMean
  // (or a dose-scaled variant) and then re-anchored, which is precisely the scale-fitting
  // this model removed — it let any modelling error be absorbed into a constant. It is now
  // assigned below purely as a "curve is in pmol/L" flag once the baseline has been solved.
  var calFT = null;

  // Unified calibration anchor: the reference time at which _mftNum (the measured or
  // estimated free T) is taken to hold.  With an explicit bloodwork entry it is the draw
  // date; with none it is "today" — the measured level describes the user now, and any
  // injections planned after today must not rescale the historical curve.  Clamped into
  // the plotted range so an all-future plan anchors at the start and an all-past log at
  // the end.  This is what makes calFT immune to appended future injections in BOTH the
  // bloodwork and no-bloodwork cases (previously only the bloodwork case was anchored,
  // so a no-bloodwork schedule re-scaled — and its peak dropped — as injections grew).
  // Anchor on the entry that actually carries a dated measurement (see _bwCal below) —
  // the newest entry may be a partial one with no usable value.
  //
  // ⚠️ A DRAW DATED IN THE FUTURE CANNOT ANCHOR. TT_base is solved as
  // TT_at_draw * P / total[anchorDay], so every injection scheduled BEFORE the anchor
  // raises the divisor and scales the whole curve — today included — down. The comment
  // below claims appended injections cannot move TT_base; that holds only for injections
  // AFTER the anchor, and a future-dated draw puts newly planned doses before it. At a
  // 1 Sep draw, extending a schedule from 13 Aug to 30 Sep dropped today's free T by
  // 95 pmol/L purely by planning. A level cannot have been measured on a day that has
  // not happened, so such an entry is not a measurement yet and is skipped here.
  var _bwTodayKey = (function(){ var _n = new Date(); return _n.getFullYear() + '-' +
    String(_n.getMonth() + 1).padStart(2, '0') + '-' + String(_n.getDate()).padStart(2, '0'); })();
  var _bwUsable = (_tcBwEntries || []).filter(function(e){ return e && e.date && e.date <= _bwTodayKey; });
  var _bwAnchorDate = null;
  if (_bwUsable.length) {
    for (var _ba = 0; _ba < _bwUsable.length; _ba++) {
      var _bae = _bwUsable[_ba];
      if (parseDec(_bae.free_t) > 0 || parseDec(_bae.total_t) > 0) { _bwAnchorDate = _bae.date; break; }
    }
    if (!_bwAnchorDate) _bwAnchorDate = _bwUsable[0].date || null;
  }
  // RESOLVE THE FREE-T SOURCE BEFORE CHOOSING THE ANCHOR DAY — the branch below keys on
  // _ftIsDefault, and the population fallback that sets it used to run ~130 lines later.
  // An undated reading therefore took the "no bloodwork at all" branch, whose anchor day
  // depends on _logDays (the LAST injection), so appending future doses flipped the anchor
  // between day 0 and today and swung the displayed level by ~800 pmol/L. The fallback is
  // decided here, so the population case reaches the day-0 branch it is documented to take.
  var _bwCal = null;
  for (var _bi0 = 0; _bi0 < _bwUsable.length; _bi0++) {
    var _c0 = _bwUsable[_bi0];
    if (parseDec(_c0.free_t) > 0 || parseDec(_c0.total_t) > 0) { _bwCal = _c0; break; }
  }
  var _bwFT   = _bwCal ? (parseDec(_bwCal.free_t)  || 0) : 0;
  var _bwTT   = _bwCal ? (parseDec(_bwCal.total_t) || 0) : 0;
  var _bwSHBG = _bwCal ? (parseDec(_bwCal.shbg)    || 0) : 0;
  if (_bwFT > 0) { _mftNum = _bwFT; _ftIsDefault = false; }
  var _mftUndated = !_ftIsDefault && !_bwCal;   // user's own number, no date anywhere
  // NO DATED LAB -> POPULATION AVERAGE FOR THE USER'S AGE, clearly labelled an estimate.
  // The curve is always drawn and always in pmol/L. What changes without a lab is the
  // CONFIDENCE, not the unit and not whether a curve appears at all.
  // A user's own free T typed in with no date still cannot anchor the curve — the anchor
  // DAY sets the whole scale, and guessing it is what made a pre-cycle baseline get read
  // as an accumulated mid-cycle level. So we fall back to the age-based population value,
  // which is unambiguously an UNTREATED baseline and therefore anchors at day 0.
  if ((_mftUndated || _ftIsDefault) && !(_bwFT > 0) && !(_bwTT > 0)) {
    var _popFT = _tcDefaultFT(parseInt(_tcp.birthYear, 10) || 0);
    if (_popFT > 0) { _mftNum = _popFT; _ftIsDefault = true; }
  }
  var _anchorDay, _anchorCutoffDate;
  var _bwAnchorDay = _bwAnchorDate
    ? Math.round((new Date(_bwAnchorDate + 'T12:00:00') - firstDate) / 86400000)
    : null;
  if (_bwAnchorDay !== null) {
    // Bloodwork exists — anchor at the draw day, clamped into the plotted range.
    //  • Draw dated BEFORE the first injection (a pre-cycle baseline — the normal case)
    //    clamps to day 0, so the curve STARTS at the measured baseline free T and rises as
    //    injections accumulate.  (Pinning it at "today" instead made the curve begin well
    //    below baseline and only cross it days later — the reported "not plotted from 217".)
    //  • Draw dated during/after the cycle anchors at its actual day.
    // total[anchorDay] is immune to injections added after it (PkConc(dt<0)=0), so calFT
    // stays fixed and the peak can only rise as injections are added.
    _anchorDay = Math.max(0, Math.min(totalDays, _bwAnchorDay));
    if (_anchorDay === _bwAnchorDay) {
      _anchorCutoffDate = _bwAnchorDate;
    } else {
      var _adB = new Date(firstDate.getTime() + _anchorDay * 86400000);
      _anchorCutoffDate = _adB.getFullYear() + '-' + String(_adB.getMonth() + 1).padStart(2, '0') + '-' + String(_adB.getDate()).padStart(2, '0');
    }
  } else if (_ftIsDefault) {
    // Population average for the user's age. That describes an UNTREATED man, so it is a
    // pre-cycle baseline by definition and anchors at day 0 — the curve starts there and
    // the drug accumulates on top. Anchoring a population baseline at "today" would claim
    // the user is at the untreated average despite whatever they have already injected.
    _anchorDay = 0;
    var _adP = new Date(firstDate.getTime());
    _anchorCutoffDate = _adP.getFullYear() + '-' + String(_adP.getMonth() + 1).padStart(2, '0') + '-' + String(_adP.getDate()).padStart(2, '0');
  } else {
    // No bloodwork at all — anchor at "today" when it falls within the injection span
    // (the measured/estimated level describes the user now), otherwise day 0 (an all-future
    // plan) or, for a fully washed-out all-past log, day 0 as well.  total[0] is immune to
    // every later injection, so calFT cannot move and the peak can only rise.
    var _nowDayA = Math.round((Date.now() - firstDate.getTime()) / 86400000);
    _anchorDay = (_nowDayA >= 0 && _nowDayA <= _logDays) ? _nowDayA : 0;
    var _adD = new Date(firstDate.getTime() + _anchorDay * 86400000);
    _anchorCutoffDate = _adD.getFullYear() + '-' + String(_adD.getMonth() + 1).padStart(2, '0') + '-' + String(_adD.getDate()).padStart(2, '0');
  }
  // Prior-protocol residual: if the user was already dosing before this log begins,
  // that drug is still appearing. Modelled as a steady-state train of past injections,
  // in the same absolute mg/day units. Only injections up to the anchor are used, so
  // appending later ones cannot change the mix and shift the anchor.
  if (_curDose > 0) {
    var _wsFilterDate = _anchorCutoffDate;
    var _wsSorted = _wsFilterDate ? sorted.filter(function(e){ return e.date <= _wsFilterDate; }) : sorted;
    if (_wsSorted.length === 0) _wsSorted = sorted;
    var _wsGroups = {}, _wsTotalAbsMg = 0;
    _wsSorted.forEach(function(e) {
      var _wsCd  = _tcCompInfo(e.compId);
      var _wsAbs = parseDec(e.doseMg) * (_wsCd.bioavailability || 1) * (_wsCd.testosteroneFraction || 1);
      _wsTotalAbsMg += _wsAbs;
      _wsGroups[e.compId] = (_wsGroups[e.compId] || 0) + _wsAbs;
    });
    if (_wsTotalAbsMg > 0) {
      Object.keys(_wsGroups).forEach(function(wsId) {
        var wsCd    = _tcCompInfo(wsId);
        var wsHl    = wsCd.halfLifeDays || 1;
        var wsKe    = Math.LN2 / wsHl;
        var wsKa    = _tcKa(wsHl, wsCd.tmaxDays);
        var wsIv    = wsHl >= 20 ? 84 : wsHl >= 9 ? 14 : wsHl >= 3 ? 3.5 : 1;
        var wsCompWk     = _curDose * (_wsGroups[wsId] / _wsTotalAbsMg);
        var wsDosePerInj = wsCompWk * wsIv / 7 * (wsCd.bioavailability || 1) * (wsCd.testosteroneFraction || 1);
        var wsLookback   = Math.ceil(wsHl * 10 / wsIv);
        for (var _wsk = 1; _wsk <= wsLookback; _wsk++) {
          var _wsDt = _wsk * wsIv;
          for (var _wst = 0; _wst <= totalDays; _wst++) {
            total[_wst] += wsKe * _tcPkConc(wsDosePerInj, wsKa, wsKe, _wst + _wsDt);
          }
        }
      });
    }
  }

  // ENDOGENOUS PRODUCTION — a real, constant appearance rate, in the same mg/day units.
  // This replaces the old "_p2Baseline" slab, which was carved out of the drug curve
  // itself (its peak/trough mean, or total[today]) and therefore had no physical meaning
  // while setting the entire multiplier. total[] is now drug + own production throughout.
  var _endogP = TCALC_ENDOG_T_MGD > 0 ? TCALC_ENDOG_T_MGD : 0;
  if (_endogP > 0) {
    for (var _ep = 0; _ep <= totalDays; _ep++) {
      total[_ep] += _tcEndogAt(total[_ep], _endogP);
      if (hasPkBand) {
        totalLo[_ep] += _tcEndogAt(totalLo[_ep], _endogP);
        totalHi[_ep] += _tcEndogAt(totalHi[_ep], _endogP);
      }
    }
  }

  // ── SOLVE for the user's own baseline. Nothing is scaled to fit a lab value. ──
  // At the draw the model already knows the appearance rate total[anchorDay] (drug +
  // endogenous). The lab tells us the level THERE. Since TT scales with appearance rate,
  //     TT_base = TT_at_draw * P / total[anchorDay]
  // recovers the user's unmedicated total T — solving out whatever drug was on board.
  // A pre-cycle draw (total[anchor] == P) returns the measurement unchanged; a mid-cycle
  // draw is corrected for the drug present. Injections after the anchor contribute 0
  // there (PkConc(dt<0)=0), so appending them cannot move TT_base — the calFT-anchor
  // invariant now holds structurally instead of by construction.
  var _anchRate = (_anchorDay >= 0 && _anchorDay <= totalDays) ? total[_anchorDay] : _endogP;
  if (!(_anchRate > 0)) _anchRate = _endogP || 1;
  var _shbgMeas0 = parseDec(_tcp.shbg) || 0;
  var _ttMeas0   = parseDec(_tcp.totalT) || 0;
  // Total T at the draw: measured if we have it, else inferred from the measured free T
  // and the SHBG that applied at the draw (Vermeulen inverse).
  //
  // PRECEDENCE: a MEASURED free T wins over the measured total T. Free T is the quantity
  // this chart plots, and a direct free-T assay and a Vermeulen value calculated from
  // total T + SHBG routinely disagree — for one real user, lab free T 217 pmol/L against
  // Vermeulen(17 nmol/L, SHBG 45) = 332, a 1.5x gap. Anchoring on total T would draw a
  // curve that visibly misses the user's own free-T result and looks broken. So we invert
  // the measured free T through Vermeulen to get the total T consistent WITH IT, and use
  // the measured total T only when no free T was recorded. The discrepancy is reported
  // rather than hidden (see _bfAnnot / tier), never silently averaged away.
  // ── CALIBRATION NEEDS A DATE. Do not guess when a reading was taken. ──
  // TT_base is solved as TT_at_draw * P/total[anchorDay], so the anchor DAY is load
  // bearing: the same number means very different things on day 0 and on day 200. An
  // undated value used to default to "today", so a PRE-CYCLE baseline typed in by someone
  // already weeks into a protocol was treated as their accumulated level and the whole
  // projection was scaled down to fit it.
  // A value typed into the T-Calc profile carries no date and therefore cannot calibrate;
  // only a bloodwork entry (which does) can. The age-based population default is exempt:
  // it is not a measurement of this user at an unknown time, it is an explicit estimate
  // for "now", already surfaced as the 'estimate' tier with a wide band.
  // _bwCal / _bwFT / _bwTT / _bwSHBG and the population fallback are resolved UP BY THE
  // ANCHOR BLOCK — the anchor branch keys on _ftIsDefault, so deciding it here left the
  // undated case anchoring off _logDays and re-scaling as future doses were appended.
  // READ THE CALIBRATING ENTRY ITSELF — not the _tcp mirrors.
  // _ftIsDefault is derived from _tcp.measuredFT alone, and _tcFetchBwEntries only mirrors
  // free_t/total_t/shbg when the NEWEST entry happens to carry them. So a dated draw with a
  // total T but no free T (a perfectly normal TRT panel) left _ftIsDefault true, and the
  // fallback then REPLACED the user's measured value with the age population average.
  // The result: bloodwork entered, bloodwork ignored, and a chart captioned
  // "ESTIMATE - NO BLOODWORK" over it. The values come from _bwCal, the entry already
  // selected as the one carrying a dated measurement.
  if (_bwSHBG > 0) _shbgMeas0 = _bwSHBG;
  var _shbgForInv = _shbgMeas0 > 0 ? _shbgMeas0 : _tcShbgBaselineForAge(
    (parseInt(_tcp.birthYear, 10) > 0) ? (new Date().getFullYear() - parseInt(_tcp.birthYear, 10)) : 0);
  // Inverting free T needs SOME SHBG. With no measurement and no population table (no age
  // on file, or the backend reference not loaded) fall back to a mid adult-male value, so
  // the curve is still computed in pmol/L rather than silently degrading to raw mg/day —
  // which is what callers plotted when this returned 0. The tier still reports the
  // uncertainty; it must not change the UNITS of the answer.
  if (!(_shbgForInv > 0)) _shbgForInv = 35;
  var _ttAtDraw = null;
  // A measured total T from the dated draw is used directly. Inverting a free T the user
  // did not provide - worst of all a POPULATION free T - to guess a total they actually
  // measured is strictly worse than reading the number they gave us.
  if (_bwTT > 0 && !(_bwFT > 0)) _ttAtDraw = _bwTT;
  if (!(_ttAtDraw > 0) && _mftNum > 0 && _shbgForInv > 0) _ttAtDraw = _tcInvVermeulenTT(_mftNum, _shbgForInv);
  if (!(_ttAtDraw > 0) && _ttMeas0 > 0) _ttAtDraw = _ttMeas0;
  var _ttBase = (_ttAtDraw > 0 && _endogP > 0) ? (_ttAtDraw * _endogP / _anchRate) : 0;

  // calFT is retained ONLY as "is the curve expressed in pmol/L" for existing callers and
  // for the unit label. It is no longer a fitted scale factor and nothing multiplies by it.
  calFT = (_ttBase > 0) ? 1 : null;
  var _calFTPkLo = calFT, _calFTPkHi = calFT;
  if (hooks.calFT) hooks.calFT(calFT);
  var scale     = calFT || 1;
  // ALWAYS pmol/L. There is no other unit and there must never be one — see the
  // "NEVER SWITCH UNITS" rule in CLAUDE.md. A curve that silently became mg/day when it
  // could not calibrate was never a requested feature; it rendered a y-axis of 0-35 where
  // the user expected 217+ and read as a broken chart.
  var unitLabel = 'pmol/L';

  // Time-varying SHBG → free-T model.  Two drivers, both anchored at the bloodwork draw so the
  // curve passes exactly through the measured free T / SHBG (no double-counting):
  //   1. SHBG-suppressing compounds & supplements (GH peptides, Boron): dose-scaled ramp
  //      SHBG ×= ∏_i (1 − asym_i × (1 − e^(−t/halfTime_i))), asym_i = effMaxSupp(dailyDose_i)
  //      so lowering a dose relaxes SHBG back up over halfTime (no all-or-nothing switch).
  //   2. Testosterone's OWN dose-dependent SHBG suppression: SHBG scales as a power law of the
  //      modelled (lagged) T level relative to the draw — SHBG(t)/SHBG_draw = (T_lag(t)/T_lag_draw)^(−β).
  //      This is the dominant driver on a TRT/enhanced schedule and the main source of drift
  //      between blood tests. A β-uncertainty band (0.15–0.40 around 0.25) is drawn: it pinches
  //      to zero width at the draw (calibrated there) and widens away from it.
  var calFT_arr = null, _calFTlo = null, _calFThi = null;
  var _ghAnnot  = '';
  var _betaAnnot = '';
  var _bfAnnot = '';
  var _shbgMeas = parseDec(_tcp.shbg)   || 0;
  var _ttMeas   = parseDec(_tcp.totalT) || 0;
  var _tcAge    = (parseInt(_tcp.birthYear, 10) > 0) ? (new Date().getFullYear() - parseInt(_tcp.birthYear, 10)) : 0;
  // Confidence tier from DATA availability (not from whether the model ran):
  //   measured : total-T + SHBG bloodwork    → full model incl. T-driven β, β-band
  //   partial  : only a measured free T        → GH/Boron suppression on a population SHBG base
  //   estimate : no bloodwork (age-default FT) → same, wide band
  // 'estimate' means NO DATED BLOODWORK AT ALL. It must be decided by whether a calibrating
  // entry exists (_bwCal), never by whether that entry happened to include a free T -
  // claiming "NO BLOODWORK" to a user who just entered some is the bug this fixes.
  var _tier = (_shbgMeas > 0 && _ttMeas > 0) ? 'measured'
            : (_bwCal ? 'partial' : (_ftIsDefault ? 'estimate' : 'partial'));
  // Baseline SHBG: measured when present, else a population value for the user's age. The
  // SHBG suppression model runs whenever we have one — so GH/Boron move the curve even with
  // no bloodwork (population averages) or only a partial / mid-cycle test.
  var _popShbg = (_shbgMeas > 0) ? 0 : _tcShbgBaselineForAge(_tcAge);
  // Personalise the population SHBG baseline by the user's own body-fat % (adiposity
  // lowers SHBG). Only when there's no measured SHBG — a real lab always wins.
  if (_popShbg > 0) {
    var _bfPct = (typeof _latestBodyFat === 'function') ? _latestBodyFat() : null;
    if (_bfPct != null && _bfPct > 0) {
      var _bfSex = (typeof localStorage !== 'undefined' && localStorage.getItem('user_sex')) || 'male';
      var _bfFac = _tcShbgBodyFatFactor(_bfPct, _bfSex);
      if (_bfFac && _bfFac !== 1) {
        _popShbg = _popShbg * _bfFac;
        _bfAnnot = 'SHBG est · ' + Math.round(_bfPct) + '% BF';
      }
    }
  }
  if (calFT && (_shbgMeas > 0 || _popShbg > 0)) {
      // SHBG anchor day: the bloodwork draw if entered, else the free-T calibration anchor.
      // Uses the SAME today-or-earlier filter as the free-T anchor (_bwUsable). Reading
      // _tcBwEntries[0] raw meant a future-dated draw still pinned SHBG at a day whose
      // modelled T level grows as you plan doses before it — the residual rescaling that
      // survived the free-T anchor fix (21 pmol/L on the reproduction case).
      var _bwEntry = _bwUsable.length ? _bwUsable[0] : null;
      var _bwDate = _bwEntry ? _bwEntry.date : null;
      var _shbgRefDay = _bwDate
        ? Math.round((new Date(_bwDate + 'T12:00:00') - firstDate) / 86400000)
        : _anchorDay;
      _shbgRefDay = Math.max(0, Math.min(totalDays, _shbgRefDay || 0));
      // Doses that were ACTIVE AT THE DRAW, snapshotted when the bloodwork was saved.
      // Keyed by compound id → dailyDose (in its doseResponse unit). Present only for
      // draws recorded after this feature shipped; absent → we fall back to today's dose.
      var _snapMap = null;
      if (_bwEntry && Array.isArray(_bwEntry.suppressors) && _bwEntry.suppressors.length) {
        _snapMap = {};
        _bwEntry.suppressors.forEach(function(s){ if (s && s.id != null) _snapMap[s.id] = s.dailyDose; });
      }

      // Each suppressor carries TWO asymptotes: asymSnap (dose active at the draw) and
      // asymCur (today's dose). Suppression follows a two-segment first-order relaxation —
      // it ramps toward asymSnap up to the draw, then relaxes toward asymCur afterwards.
      // This keeps SHBG(draw) fixed (so the inferred baseline no longer moves when the
      // user changes a dose today) while the forward curve still tracks the new dose.
      var _ghParams = [];
      _tcGhStack.forEach(function(gh) {
        var _ghStart = gh.startDateStr ? new Date(gh.startDateStr + 'T12:00:00') : null;
        if (!_ghStart) return;
        var _dr      = gh.interactions.shbg.doseResponse;
        var _fixed   = gh.interactions.shbg.maxSuppression;
        var _asymCur = _tcEffMaxSupp(_dr, gh.dailyDose);
        if (_asymCur == null) _asymCur = _fixed;
        // asymSnap null → single-segment current-dose ramp (legacy behaviour) unless the
        // compound is explicitly recorded in the draw snapshot.
        var _asymSnap = null;
        if (_snapMap && Object.prototype.hasOwnProperty.call(_snapMap, gh.pepId)) {
          _asymSnap = _tcEffMaxSupp(_dr, _snapMap[gh.pepId]);
          if (_asymSnap == null) _asymSnap = _fixed;
        }
        _ghParams.push({
          ghDay0:   Math.round((_ghStart - firstDate) / 86400000),
          drawDay:  _shbgRefDay,
          asymCur:  _asymCur,
          asymSnap: _asymSnap,
          halfTime: gh.interactions.shbg.halfTimeDays
        });
      });
      var _suppAt = function(gp, day) {
        if (day <= gp.ghDay0) return 0;
        // No draw snapshot, or compound started at/after the draw → single current-dose ramp.
        if (gp.asymSnap == null || gp.ghDay0 >= gp.drawDay) {
          return gp.asymCur * (1 - Math.exp(-(day - gp.ghDay0) / gp.halfTime));
        }
        // Snapshot segment: dose active at the draw, from start → draw.
        if (day <= gp.drawDay) {
          return gp.asymSnap * (1 - Math.exp(-(day - gp.ghDay0) / gp.halfTime));
        }
        // Post-draw: relax from the level reached at the draw toward today's asymptote.
        var suppDraw = gp.asymSnap * (1 - Math.exp(-(gp.drawDay - gp.ghDay0) / gp.halfTime));
        return gp.asymCur + (suppDraw - gp.asymCur) * Math.exp(-(day - gp.drawDay) / gp.halfTime);
      };
      var _ghProd = function(day) {
        var p = 1;
        _ghParams.forEach(function(gp) { p *= (1 - _suppAt(gp, day)); });
        return p;
      };
      var _prodRef = _ghProd(_shbgRefDay);
      // Unsuppressed baseline SHBG + the SHBG value at the anchor.
      //  • measured : back it out of the measured draw (fixed by the snapshot).
      //  • population: the age baseline IS the unsuppressed value; suppress it to get the anchor.
      var _shbgBase, _shbgBw;
      if (_shbgMeas > 0) {
        _shbgBw = _shbgMeas;
        _shbgBase = (_prodRef > 0.05) ? _shbgBw / _prodRef : _shbgBw;
      } else {
        _shbgBase = _popShbg;
        _shbgBw = _shbgBase * _prodRef;
      }
      // Total T: measured, else inferred from the free-T anchor + baseline SHBG (Vermeulen inverse).
      var _ttNum = _ttMeas > 0 ? _ttMeas : _tcInvVermeulenTT(_mftNum, _shbgBw);
      var _vermBw = (_ttNum > 0 && _shbgBw > 0) ? _tcVermeulenFT(_ttNum, _shbgBw) : null;
      if (_vermBw) {
      // Lagged testosterone level: EMA of the modelled accumulation (SHBG responds over weeks).
      var _tlag = new Float64Array(totalDays + 1);
      var _alpha = 1 - Math.exp(-1 / TCALC_TSHBG_LAG_DAYS);
      _tlag[0] = total[0];
      for (var _li = 1; _li <= totalDays; _li++) _tlag[_li] = _tlag[_li - 1] + (total[_li] - _tlag[_li - 1]) * _alpha;
      var _tlagRef = _tlag[_shbgRefDay] || _tlag[0] || 1;   // appearance rate at the draw
      var _tFactor = function(day, beta) {
        var r = (_tlag[day] || _tlagRef) / _tlagRef;
        if (r <= 0) return 1;
        var f = Math.pow(r, -beta);
        return Math.max(0.35, Math.min(1.30, f));  // physiological clamp: ≤65% drop, ≤30% rise
      };
      // Testosterone's OWN dose-dependent SHBG suppression (the β power-law) is only trustworthy
      // with a MEASURED total T. In the population tiers we apply the GH/Boron (dose-driven)
      // suppression alone — so with no suppressors the curve stays flat at the anchor, and with
      // GH/Boron it shows their effect, without inventing a T-driven swing we can't support.
      var _useBeta = (_tier === 'measured');
      // Total T at the calibration anchor corresponds to total[_shbgRefDay] of modelled
      // drug. Everywhere else the modelled amount says how far above or below that the
      // user is, so total T must MOVE with it — pinning it at the anchor and only varying
      // SHBG made free T strictly proportional to dose, which (with the linearised
      // binding equation, fixed the same day) is what made a cycle projection read low.
      // FREE T, COMPUTED — not scaled. TT(t) = TT_base * total[t]/P, then Vermeulen.
      // Callers render total[t]*arr[t], so arr[t] = FT(t)/total[t]: the conversion from
      // appearance rate to free T at time t. There is no fitted constant anywhere here.
      var _mkArr = function(beta) {
        var arr = new Float64Array(totalDays + 1);
        for (var t = 0; t <= totalDays; t++) {
          var _tf = _useBeta ? _tFactor(t, beta) : 1;
          var _shbgT = Math.max(1, _shbgBase * _ghProd(t) * _tf);
          var _ttT = (_endogP > 0) ? _ttBase * total[t] / _endogP : _ttBase;
          var _vermT = _tcVermeulenFT(_ttT, _shbgT);
          arr[t] = (total[t] > 0 && _vermT > 0) ? _vermT / total[t] : 0;
        }
        return arr;
      };
      // Personalise β from the user's own blood tests; fall back to the population default.
      var _betaFit = _tcFitBeta(_tcBwEntries);
      var _betaC  = _betaFit ? _betaFit.beta : TCALC_TSHBG_BETA;
      var _betaLo = _betaFit ? _betaFit.lo   : TCALC_TSHBG_BETA_LO;
      var _betaHi = _betaFit ? _betaFit.hi   : TCALC_TSHBG_BETA_HI;
      // β is testosterone's own SHBG-suppression exponent. Fitting it needs ≥2 (total-T,
      // SHBG) labs at different T levels, so with one draw we show the population value and
      // tell the user what unlocks a personal fit — it does NOT mean their bloodwork is unused.
      _betaAnnot = _betaFit ? ('β ' + _betaC.toFixed(2) + ' · ' + _betaFit.n + ' labs')
                            : ('β ' + TCALC_TSHBG_BETA.toFixed(2) + ' · population · add a 2nd lab');

      calFT_arr = _mkArr(_betaC);
      if (_tier === 'measured') {
        _calFTlo = _mkArr(_betaLo);
        _calFThi = _mkArr(_betaHi);
      } else {
        // Population tiers: a wide symmetric band reflecting the estimate's uncertainty,
        // drawn around the (suppression-aware) central curve.
        var _frac = (_tier === 'estimate') ? 0.35 : 0.20;
        _calFTlo = new Float64Array(totalDays + 1);
        _calFThi = new Float64Array(totalDays + 1);
        for (var _bi = 0; _bi <= totalDays; _bi++) {
          _calFTlo[_bi] = calFT_arr[_bi] * (1 - _frac);
          _calFThi[_bi] = calFT_arr[_bi] * (1 + _frac);
        }
      }
      if (hooks.shbg) hooks.shbg({ calFT: calFT, arr: calFT_arr, lo: _calFTlo, hi: _calFThi, refDay: _shbgRefDay, total: total, beta: _betaC, personalized: !!_betaFit, tier: _tier });

      // Modelled SHBG change at "now" vs the anchor, for the chart annotation.
      var _nowDay = Math.max(0, Math.min(totalDays, Math.round((Date.now() - firstDate.getTime()) / 86400000)));
      var _shbgNow = _shbgBase * _ghProd(_nowDay) * (_useBeta ? _tFactor(_nowDay, _betaC) : 1);
      var _shbgAnchor = _shbgBase * _ghProd(_shbgRefDay);
      var _shbgDelta = _shbgAnchor > 0 ? (_shbgNow / _shbgAnchor - 1) : 0;
      if (Math.abs(_shbgDelta) > 0.01) _ghAnnot = 'SHBG ' + (_shbgDelta < 0 ? '−' : '+') + Math.round(Math.abs(_shbgDelta) * 100) + '%';
      }
  }

  // If the SHBG model could not run (no measured SHBG and no population baseline — e.g. no
  // age on file), still render the estimate with a synthetic wide band so it's never blank.
  // Fallback when the SHBG model could not run (no measured SHBG and no population
  // baseline). Free T is still COMPUTED — Vermeulen at a fixed SHBG — never left as the
  // raw appearance rate. Before this, callers that read total[t]*calFT_arr[t] fell back to
  // scale=1 and plotted mg/day as if it were pmol/L (the Blood-Levels free-T line read 6.5).
  if (!calFT_arr && _ttBase > 0 && _endogP > 0) {
    var _fbShbg = _shbgMeas0 > 0 ? _shbgMeas0 : _tcShbgBaselineForAge(
      (parseInt(_tcp.birthYear, 10) > 0) ? (new Date().getFullYear() - parseInt(_tcp.birthYear, 10)) : 0);
    if (!(_fbShbg > 0)) _fbShbg = 35;
    var _estFrac = (_tier === 'estimate') ? 0.35 : 0.20;
    calFT_arr = new Float64Array(totalDays + 1);
    _calFTlo  = new Float64Array(totalDays + 1);
    _calFThi  = new Float64Array(totalDays + 1);
    for (var _et = 0; _et <= totalDays; _et++) {
      var _fbT = _tcVermeulenFT(_ttBase * total[_et] / _endogP, _fbShbg);
      var _fbA = (total[_et] > 0 && _fbT > 0) ? _fbT / total[_et] : 0;
      calFT_arr[_et] = _fbA;
      _calFTlo[_et]  = _fbA * (1 - _estFrac);
      _calFThi[_et]  = _fbA * (1 + _estFrac);
    }
  }

  // NO ANCHOR NORMALISATION. The curve already passes through the measurement because
  // TT_base was solved from it — re-scaling here would reintroduce exactly the fitted
  // constant this rewrite removed, and would silently absorb any modelling error into it.
  // If the curve misses the lab, the MODEL is wrong and must be fixed, not rescaled.

  // Test hook: the displayed free-T value at the first plotted day (day 0).  With a
  // pre-cycle baseline anchor this must equal the measured baseline, i.e. the curve
  // starts at the baseline and rises — not below it.
  if (hooks.start) hooks.start(total[0] * (calFT_arr ? calFT_arr[0] : scale));
  return { firstDate: firstDate, totalDays: totalDays, logDays: _logDays, total: total, calFT: calFT, scale: scale,
           totalLo: totalLo, totalHi: totalHi, hasPkBand: hasPkBand,
           calFTPkLo: _calFTPkLo, calFTPkHi: _calFTPkHi,
           calFT_arr: calFT_arr, calFTlo: _calFTlo, calFThi: _calFThi, unitLabel: unitLabel,
           measuredFT: _mftNum, ghAnnot: _ghAnnot, betaAnnot: _betaAnnot, bfAnnot: _bfAnnot, tier: _tier, sorted: sorted };
}

// ── Free-T history: the single, explicit writer ──────────────────────────────
// Persists /plasma-history EXACTLY as the plasma curve is currently displayed
// (from _tcDrawnFT). This is the ONLY thing in the app that writes free-T history,
// and it runs ONLY on an explicit user action — the "Update saved history" button.
// Nothing captures automatically: the history view fetches and plots, and stays put
// until the user chooses to refresh it. Returns Promise<bool> (true = written).
function tcSaveHistoryFromCurve() {
  if (typeof AGENT_URL === 'undefined') return Promise.resolve(false);
  var d = _tcDrawnFT;
  if (!d || !d.values || !d.values.length) return Promise.resolve(false);
  var maxV = 0;
  var entries = d.values.map(function(v, k){
    if (v > maxV) maxV = v;
    var dt = new Date(d.firstMs + k * 86400000);
    var ds = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth()+1).padStart(2,'0') + '-' + String(dt.getUTCDate()).padStart(2,'0');
    return { date: ds, marker: 'free_t', value: v, unit: d.unit };
  });
  // Never persist an absurdly-high curve — that means a mis-calibration slipped through.
  if (d.unit === 'pmol/L' && maxV > 6000) return Promise.resolve(false);
  var hdrs = authHeaders({ 'Content-Type': 'application/json' });
  return fetch(AGENT_URL + '/plasma-history?marker=free_t', { method: 'DELETE', headers: hdrs })
    .then(function(){ return fetch(AGENT_URL + '/plasma-history/batch', {
        method: 'POST', headers: hdrs, body: JSON.stringify({ entries: entries }) }); })
    .then(function(r){ return !!(r && r.ok); })
    .catch(function(){ return false; });
}
// Button handler: capture once, with inline feedback on the button itself.
function tcUpdateSavedHistory(btnId) {
  var b = btnId && document.getElementById(btnId);
  if (b) { b.disabled = true; b.textContent = 'Saving\u2026'; }
  return tcSaveHistoryFromCurve().then(function(ok){
    if (b) { b.disabled = false; b.textContent = ok ? '\u2713 Saved history' : 'Could not save \u2014 try again'; }
    return ok;
  });
}

function _tcDrawManualChart(canvasId, log, zoom3) {
  var canvas = document.getElementById(canvasId);
  if (!canvas || !log || log.length === 0) return;

  var sorted = log.slice().sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var _S = _tcFreeTSeries(sorted, { calFT: canvas._testCalFTHook, shbg: canvas._testShbgHook, start: canvas._testStartHook });
  var firstDate = _S.firstDate, totalDays = _S.totalDays, logDays = _S.logDays, total = _S.total, calFT = _S.calFT, scale = _S.scale,
      calFT_arr = _S.calFT_arr, _calFTlo = _S.calFTlo, _calFThi = _S.calFThi, unitLabel = _S.unitLabel,
      _mftNum = _S.measuredFT, _ghAnnot = _S.ghAnnot, _betaAnnot = _S.betaAnnot, _bfAnnot = _S.bfAnnot, _tier = _S.tier;
  var _pkLo = _S.totalLo, _pkHi = _S.totalHi, _hasPkBand = _S.hasPkBand,
      _pkLoCal = _S.calFTPkLo, _pkHiCal = _S.calFTPkHi;
  // Cache the per-day free-T EXACTLY as this chart displays it, so saving to T-History
  // stores verbatim what the user sees — no separate re-derivation, no divergence, no
  // calibration-context bug. Only when calibrated to a real measurement (calFT set); an
  // uncalibrated estimate is never eligible to become history. Runs day 0 → last
  // injection (matching the history view's "ends at the last injection" contract).
  // End at the last injection that has actually been TAKEN — its date on or before today.
  // The plasma log includes scheduled/future doses (a series projects forward), and
  // history must never run into the future: it stops where the last checked injection is.
  if (calFT && sorted.length) {
    var _hNowMs = Date.now(), _hLastPastMs = null;
    for (var _hi = 0; _hi < sorted.length; _hi++) {
      var _hms = new Date(sorted[_hi].date).getTime();
      if (isFinite(_hms) && _hms <= _hNowMs) _hLastPastMs = _hms;   // sorted ascending → last one wins
    }
    if (_hLastPastMs === null) {
      _tcDrawnFT = null;   // nothing taken yet — no history to store
    } else {
      var _hEnd = Math.max(0, Math.min(totalDays, Math.round((_hLastPastMs - firstDate.getTime()) / 86400000)));
      var _hVals = [];
      for (var _hk = 0; _hk <= _hEnd; _hk++) {
        var _hv = total[_hk] * (calFT_arr ? calFT_arr[_hk] : scale);
        _hVals.push((!isFinite(_hv) || _hv < 0) ? 0 : Math.round(_hv * 1000) / 1000);
      }
      _tcDrawnFT = { firstMs: firstDate.getTime(), unit: unitLabel || 'pmol/L', values: _hVals };
    }
  } else {
    _tcDrawnFT = null;
  }

  // Steady-state peak in pmol/L, taken from the SAME expression the chart plots
  // (total * calFT_arr). Second half of the series only, matching the ss window
  // _tcComputeStats uses, so the ramp-up does not read as the plateau.
  // This is a read, not a calculation: no model call, no re-derivation.
  (function(){
    // ⚠️ THE WINDOW IS THE DOSING PERIOD, NOT totalDays.
    // totalDays includes the WASHOUT TAIL, sized off the slowest half-life — for a
    // 75-day depot bound that is 323 days on top of a 61-day schedule. Halving
    // totalDays therefore put this window at day 192-385, i.e. Jan-Jul of the FOLLOWING
    // year, months after the last injection. It reported the decaying tail as the
    // steady-state exposure: 309 pmol/L "within the healthy young-male range" for a
    // protocol whose actual plateau is ~1090, above the 804 top of that range. The
    // reassurance was exactly backwards, and it disagreed with the chart directly
    // above it (894 today).
    // logDays is the last injection's day index — the same second-half-of-the-cycle
    // window _tcComputeStats uses, which is what the original comment intended.
    var _ssEnd  = (logDays > 0) ? Math.min(logDays, totalDays) : totalDays;
    var _ssFrom = Math.floor(_ssEnd / 2), _ssPk = 0;
    for (var _si = _ssFrom; _si <= _ssEnd; _si++) {
      var _sv = total[_si] * (calFT_arr ? calFT_arr[_si] : scale);
      if (isFinite(_sv) && _sv > _ssPk) _ssPk = _sv;
    }
    // calFT null means the baseline never solved, so the series is not on a
    // pmol/L scale and a multiple of it would be meaningless.
    _tcSsPeakPmol = (calFT && _ssPk > 0) ? _ssPk : null;
    var _el = document.getElementById('tc-exposure-note');
    if (_el) _el.innerHTML = (typeof _ftExposureHtml === 'function' && _tcSsPeakPmol)
      ? _ftExposureHtml(_tcSsPeakPmol) : '';
  })();

  var dpr  = window.devicePixelRatio || 1;
  var cssW = canvas.offsetWidth || 300;
  var cssH = 150;
  canvas.width  = cssW * dpr; canvas.height = cssH * dpr;
  canvas.style.width  = cssW + 'px'; canvas.style.height = cssH + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var PAD = {top:12, right:14, bottom:26, left:52};
  var cW  = cssW - PAD.left - PAD.right;
  var cH  = cssH - PAD.top  - PAD.bottom;

  var maxV = 0;
  for (var i = 0; i <= totalDays; i++) {
    var _svc = total[i] * (calFT_arr ? calFT_arr[i] : scale);
    var _sv  = _calFThi ? Math.max(_svc, total[i] * _calFThi[i]) : _svc;  // include band top
    if (_sv > maxV) maxV = _sv;
  }
  if (_mftNum && calFT && _mftNum > maxV) maxV = _mftNum * 1.1;
  if (!maxV) { ctx.fillStyle = '#555'; ctx.font = '11px -apple-system,system-ui,sans-serif'; ctx.fillText('No data', 10, 40); return; }
  var vMax = maxV * 1.1;

  // Clip x-axis to where free T last crosses back down to baseline (the interesting area)
  var xDays = totalDays;
  if (_mftNum && calFT) {
    for (var _xi = totalDays; _xi > 0; _xi--) {
      if (total[_xi] * (calFT_arr ? calFT_arr[_xi] : scale) >= _mftNum) { xDays = _xi; break; }
    }
  }

  // Zoom window
  var _zoom = zoom3 || _tcChartZoom || 'whole';
  var nowDay = Math.round((Date.now() - firstDate.getTime()) / 86400000);
  var panDays = _zoom !== 'whole' ? Math.round(_tcChartPanOffset || 0) : 0;
  var xStart = 0, xEnd = xDays;
  if (_zoom === 'today')       { xStart = Math.max(0, nowDay - 2 + panDays); xEnd = Math.min(xDays, nowDay + 2 + panDays); }
  else if (_zoom === 'week')   { xStart = Math.max(0, nowDay - 3 + panDays); xEnd = Math.min(xDays, nowDay + 4 + panDays); }
  else if (_zoom === 'month')  { xStart = Math.max(0, nowDay - 15 + panDays); xEnd = Math.min(xDays, nowDay + 15 + panDays); }
  // 3 months: the span a titration decision actually plays out over — long enough to see
  // accumulation trend, short enough to still resolve individual injections.
  else if (_zoom === '3mo')    { xStart = Math.max(0, nowDay - 45 + panDays); xEnd = Math.min(xDays, nowDay + 45 + panDays); }
  // Whole view: make sure "today" is inside the window so its marker/level show
  // even when the curve has already washed back to baseline before today.
  if (_zoom === 'whole' && nowDay > xEnd && nowDay <= totalDays) xEnd = nowDay;
  if (xEnd <= xStart) xEnd = Math.min(xDays, xStart + 7);

  // Find peak within visible window
  var peakV = 0, peakT = 0;
  for (var _pi = xStart; _pi <= xEnd; _pi++) {
    var _pv = total[_pi] * (calFT_arr ? calFT_arr[_pi] : scale);
    if (_pv > peakV) { peakV = _pv; peakT = _pi; }
  }

  function xOf(t){ return PAD.left + ((t - xStart) / (xEnd - xStart)) * cW; }
  function yOf(v){ return PAD.top  + cH - (v / vMax) * cH; }

  var winDays = xEnd - xStart;
  var gridStep = winDays <= 7 ? 1 : winDays <= 30 ? 5 : xDays <= 28 ? 7 : xDays <= 84 ? 14 : 28;
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5;
  for (var dg = xStart; dg <= xEnd; dg += gridStep) {
    var gx = xOf(dg);
    ctx.beginPath(); ctx.moveTo(gx, PAD.top); ctx.lineTo(gx, PAD.top + cH); ctx.stroke();
  }

  // Measured FT reference line — teal: this is calibrated to the user's own labs
  if (_mftNum && calFT) {
    var _refY = yOf(_mftNum);
    ctx.strokeStyle = DATA_TEAL + '99'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(PAD.left, _refY); ctx.lineTo(PAD.left + cW, _refY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = DATA_TEAL + 'cc'; ctx.font = '8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(Math.round(_mftNum), PAD.left + 3, _refY - 2);
  }

  ctx.fillStyle = '#555'; ctx.font = '9px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'right';
  for (var ti = 0; ti <= 3; ti++) {
    var ty = PAD.top + (cH / 3) * ti;
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, ty); ctx.lineTo(PAD.left + cW, ty); ctx.stroke();
    var tv = vMax * (1 - ti / 3);
    ctx.fillText(calFT ? Math.round(tv) : (tv >= 100 ? Math.round(tv) : tv >= 10 ? tv.toFixed(1) : tv.toFixed(2)), PAD.left - 4, ty + 3);
  }
  ctx.save(); ctx.translate(10, PAD.top + cH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.fillStyle = '#444';
  ctx.font = '8px -apple-system,system-ui,sans-serif';
  ctx.fillText(unitLabel, 0, 0); ctx.restore();

  // ── ESTIMATE STATE — an educated guess, labelled as one. ──
  // Without a dated lab the curve is calibrated to the POPULATION AVERAGE for the user's
  // age. It is still a real pmol/L curve — units never change — but the level it is
  // pinned to is a population figure, not this user's. Say so plainly and ask for a test.
  // Drawn as ONE block below, next to the badge — not here. This used to paint three
  // lines starting at PAD.top+10, directly underneath the pill badge that starts at
  // PAD.top+2, so the badge sat on top of the first line and the result read
  // "...ge for your age" over a coloured pill, with the remaining two lines running
  // across the curve. Two separate warnings saying the same thing, overlapping.

  // SHBG suppression + β-source annotation (top-right of chart)
  if (_ghAnnot) {
    ctx.font = '8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'right';
    ctx.fillStyle = '#3cffa077';
    ctx.fillText(_ghAnnot, PAD.left + cW, PAD.top + 9);
  }
  if (_betaAnnot) {
    ctx.font = '8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'right';
    ctx.fillStyle = '#8891a5aa';   // muted: shows whether β is personalised or population default
    ctx.fillText(_betaAnnot, PAD.left + cW, PAD.top + (_ghAnnot ? 19 : 9));
  }
  if (_bfAnnot) {
    ctx.font = '8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'right';
    ctx.fillStyle = '#ff6b2baa';   // amber: SHBG baseline personalised from body fat %
    ctx.fillText(_bfAnnot, PAD.left + cW, PAD.top + ((_ghAnnot ? 10 : 0) + (_betaAnnot ? 10 : 0) + 9));
  }

  var lineColor = _tcCompInfo(sorted[0].compId).dot || '#e8a020';

  // SHBG β-uncertainty band: shaded region between the β=0.15 and β=0.40 free-T curves.
  // Pinches to zero width at the bloodwork draw (calibrated) and widens away from it.
  // ── PK uncertainty band ─────────────────────────────────────────────────────
  // Drawn first, so the SHBG band and the curve itself sit on top of it. Only appears
  // for compounds whose backend entry declares a half-life range; for a depot ester that
  // range is the published inter-individual spread, and it is wide enough that a single
  // line would misrepresent the evidence. See the backend's
  // docs/enhanced-bodybuilding/11-testosterone-undecanoate-pk.md
  if (calFT && _hasPkBand && _pkLo && _pkHi) {
    var _pkTop = function(t){ return Math.max(_pkLo[t]*_pkLoCal, _pkHi[t]*_pkHiCal) || 0; };
    var _pkBot = function(t){ return Math.min(_pkLo[t]*_pkLoCal, _pkHi[t]*_pkHiCal) || 0; };
    ctx.beginPath();
    ctx.moveTo(xOf(xStart), yOf(_pkTop(xStart)));
    for (var _pt = xStart + 1; _pt <= xEnd; _pt++) ctx.lineTo(xOf(_pt), yOf(_pkTop(_pt)));
    for (var _pb = xEnd; _pb >= xStart; _pb--) ctx.lineTo(xOf(_pb), yOf(_pkBot(_pb)));
    ctx.closePath();
    ctx.fillStyle = lineColor + '14';
    ctx.fill();
    ctx.strokeStyle = lineColor + '33';
    ctx.setLineDash([3,3]); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xOf(xStart), yOf(_pkTop(xStart)));
    for (var _pt2 = xStart + 1; _pt2 <= xEnd; _pt2++) ctx.lineTo(xOf(_pt2), yOf(_pkTop(_pt2)));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xOf(xStart), yOf(_pkBot(xStart)));
    for (var _pb2 = xStart + 1; _pb2 <= xEnd; _pb2++) ctx.lineTo(xOf(_pb2), yOf(_pkBot(_pb2)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (calFT_arr && _calFTlo && _calFThi) {
    var _bandTop = function(t){ return Math.max(total[t]*_calFTlo[t], total[t]*_calFThi[t]) || 0; };
    var _bandBot = function(t){ return Math.min(total[t]*_calFTlo[t], total[t]*_calFThi[t]) || 0; };
    ctx.beginPath();
    ctx.moveTo(xOf(xStart), yOf(_bandTop(xStart)));
    for (var _bt = xStart + 1; _bt <= xEnd; _bt++) ctx.lineTo(xOf(_bt), yOf(_bandTop(_bt)));
    for (var _bb = xEnd; _bb >= xStart; _bb--) ctx.lineTo(xOf(_bb), yOf(_bandBot(_bb)));
    ctx.closePath();
    ctx.fillStyle = lineColor + '26';
    ctx.fill();
  }

  // Today's level y — computed early so the peak label (same left-axis lane) can dodge it.
  var _tdClamp = Math.max(0, Math.min(totalDays, nowDay));
  var _tdLvl = calFT ? (total[_tdClamp] * (calFT_arr ? calFT_arr[_tdClamp] : scale)) : 0;
  var _todayLabelY = (calFT && _tdLvl > 0 && nowDay >= xStart && nowDay <= xEnd) ? yOf(_tdLvl) : null;

  // Peak highlight line + y-axis label
  if (calFT && peakV > 0 && peakV > (_mftNum || 0) * 1.05) {
    var _pkY = yOf(peakV);
    ctx.strokeStyle = lineColor + 'aa'; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(PAD.left, _pkY); ctx.lineTo(PAD.left + cW, _pkY); ctx.stroke();
    ctx.setLineDash([]);
    // Keep the peak number clear of today's boxed number when the two sit at the same height.
    var _pkTextY = (_todayLabelY != null) ? _tcNudgeLabelY(_pkY, [_todayLabelY], 11, PAD.top + 6, PAD.top + cH - 2) : _pkY;
    ctx.fillStyle = lineColor; ctx.font = 'bold 8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(peakV), PAD.left - 4, _pkTextY + 3);
  }

  var grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  grad.addColorStop(0, lineColor + '55'); grad.addColorStop(1, lineColor + '00');
  ctx.beginPath(); ctx.moveTo(xOf(xStart), PAD.top + cH);
  for (var t2 = xStart; t2 <= xEnd; t2++) {
    ctx.lineTo(xOf(t2), yOf(total[t2] * (calFT_arr ? calFT_arr[t2] : scale) || 0));
  }
  ctx.lineTo(xOf(xEnd), PAD.top + cH);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath(); ctx.moveTo(xOf(xStart), yOf(total[xStart] * (calFT_arr ? calFT_arr[xStart] : scale) || 0));
  for (var t3 = xStart + 1; t3 <= xEnd; t3++) {
    ctx.lineTo(xOf(t3), yOf(total[t3] * (calFT_arr ? calFT_arr[t3] : scale) || 0));
  }
  // The plasma curve is ALWAYS a solid line. Estimate tiers used to draw it dashed, which
  // made an uncalibrated curve read as broken rather than uncertain — at Whole zoom the
  // dashes alias against the injection cycles and the line disappears entirely. Lower
  // confidence is already carried by the badge, the wider band and the axis note; it does
  // not also need to degrade the line itself.
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.setLineDash([]);

  // AVERAGE reference line (teal, toggleable) — the mean level over the CURRENTLY
  // VISIBLE window, so it tracks the zoom (day/week/month/whole) instead of sitting at
  // one global value. In Whole it reads the whole-cycle average; zoom in and it reports
  // the average of just what you're looking at. Still makes the "peak differs, average
  // doesn't" point: an infrequent-large schedule peaks far above it, a frequent one hugs it.
  if (calFT && _tcShowAvg()) {
    var _avgSum = 0, _avgN = 0;
    for (var _ai = xStart; _ai <= xEnd; _ai++) { _avgSum += total[_ai] * (calFT_arr ? calFT_arr[_ai] : scale); _avgN++; }
    var _avgLvl = _avgN > 0 ? _avgSum / _avgN : 0;
    if (canvas._testAvgHook) canvas._testAvgHook({ avg: _avgLvl, xStart: xStart, xEnd: xEnd });
    if (_avgLvl > 0 && _avgLvl <= vMax) {
      var _avY = yOf(_avgLvl);
      ctx.strokeStyle = '#5ad1b0cc'; ctx.lineWidth = 1; ctx.setLineDash([1,3]);
      ctx.beginPath(); ctx.moveTo(PAD.left, _avY); ctx.lineTo(PAD.left + cW, _avY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#5ad1b0'; ctx.font = 'bold 8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('avg ' + Math.round(_avgLvl), PAD.left + cW, _avY - 3);
    }
  }

  // Warning badge for estimate tiers — a pill top-left of the plot so the user never
  // mistakes an age-default / no-SHBG curve for a bloodwork-calibrated result.
  if (_tier && _tier !== 'measured' && calFT) {
    var _badge = (_tier === 'estimate') ? '⚠ ESTIMATE · NO BLOODWORK' : '⚠ EST · NO SHBG DATA';
    ctx.font = 'bold 8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'left';
    var _badgeW = (ctx.measureText(_badge).width || 0) + 10;
    var _bx = PAD.left + 2, _by = PAD.top + 2;
    ctx.fillStyle = '#e8a020dd';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(_bx, _by, _badgeW, 12, 3); ctx.fill(); }
    else { ctx.fillRect(_bx, _by, _badgeW, 12); }
    ctx.fillStyle = '#1a1205'; ctx.fillText(_badge, _bx + 5, _by + 9);
    // One line of guidance, BELOW the pill (badge is 12px tall from _by), so nothing
    // overlaps. It says what to do; the badge already says what is wrong.
    ctx.font = '8px -apple-system,system-ui,sans-serif';
    ctx.fillStyle = '#e0a030bb';
    ctx.fillText('Not your levels — add a dated blood test',
                 _bx + 1, _by + 23);
  }

  // "Now" vertical line + TODAY'S free-T level (Y-axis label) — shown in EVERY
  // zoom, including Whole. The horizontal marker + left-axis number always report
  // today's estimated free T; a dot marks where "now" meets the curve.
  var _ndClamp = Math.max(0, Math.min(totalDays, nowDay));
  var _nowLvl = calFT ? (total[_ndClamp] * (calFT_arr ? calFT_arr[_ndClamp] : scale)) : 0;
  if (canvas._testNowHook) canvas._testNowHook(_nowLvl);
  if (nowDay >= xStart && nowDay <= xEnd) {
    var nowX = xOf(nowDay);
    ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(nowX, PAD.top); ctx.lineTo(nowX, PAD.top + cH); ctx.stroke();
    ctx.fillStyle = '#ffffff99'; ctx.font = 'bold 8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('today', nowX, PAD.top + 8);
    if (calFT && _nowLvl > 0) {
      var _nlY = yOf(_nowLvl);
      ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1; ctx.setLineDash([2,2]);
      ctx.beginPath(); ctx.moveTo(PAD.left, _nlY); ctx.lineTo(PAD.left + cW, _nlY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(nowX, _nlY, 3, 0, 2*Math.PI); ctx.fill();
      // Boxed Y-axis label so today's level stays legible over the gridline numbers.
      var _lbl = String(Math.round(_nowLvl));
      ctx.font = 'bold 9px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'right';
      var _tw = ctx.measureText(_lbl).width;
      ctx.fillStyle = '#000000cc'; ctx.fillRect(PAD.left - 7 - _tw, _nlY - 6, _tw + 6, 12);
      ctx.fillStyle = '#ffffff'; ctx.fillText(_lbl, PAD.left - 4, _nlY + 3);
    }
  }

  sorted.forEach(function(e) {
    var injectDay = Math.round((new Date(e.date + 'T12:00:00') - firstDate) / 86400000);
    if (injectDay < xStart || injectDay > xEnd) return;
    var dot = _tcCompInfo(e.compId).dot || lineColor;
    var ix = xOf(injectDay);
    ctx.strokeStyle = dot + '99'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ix, PAD.top + cH); ctx.lineTo(ix, PAD.top + cH + 5); ctx.stroke();
  });

  // ── SCHEDULED BUT NEVER TICKED — marked WHERE THE CURVE GOES FLAT ──────────
  // These doses are excluded from the model (a plan the user did not confirm taking
  // is not the past — unchanged rule), which is correct but invisible: the curve
  // simply stops rising, and with a 56-day depot it can tip into a visible DECLINE
  // for several days. Reported three times as "the curve flatlines", most recently
  // read as an artefact of two adjacent series joining — it is not, the join is
  // seamless. The note under the chart already names the dates; the gap has to be
  // legible at the point it happens, not only in prose. Drawn as a hollow amber
  // stem so it reads as "a dose belongs here and is not counted", never as a dose.
  if (_tcSkippedPast && _tcSkippedPast.length) {
    ctx.save();
    _tcSkippedPast.forEach(function(e) {
      if (!e || !e.date) return;
      var sd = Math.round((new Date(e.date + 'T12:00:00') - firstDate) / 86400000);
      if (sd < xStart || sd > xEnd) return;
      var sx = xOf(sd);
      ctx.strokeStyle = '#e8a020cc'; ctx.lineWidth = 1; ctx.setLineDash([2,2]);
      ctx.beginPath(); ctx.moveTo(sx, PAD.top); ctx.lineTo(sx, PAD.top + cH + 5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(sx, PAD.top + cH + 3, 2.2, 0, Math.PI * 2);
      ctx.strokeStyle = '#e8a020'; ctx.lineWidth = 1.2; ctx.stroke();
    });
    ctx.restore();
  }

  // Bloodwork dots — one per entry that has a free_t value, plotted at their calendar date
  if (_tcBwEntries && calFT) {
    _tcBwEntries.forEach(function(bwE) {
      if (bwE.free_t == null) return;
      var bwDay = Math.round((new Date(bwE.date + 'T12:00:00') - firstDate) / 86400000);
      if (bwDay < xStart || bwDay > xEnd) return;
      var bwX = xOf(bwDay);
      var bwY = yOf(bwE.free_t);
      ctx.beginPath();
      ctx.arc(bwX, bwY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#e8a020cc';
      ctx.fill();
      ctx.strokeStyle = '#e8a020';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  ctx.fillStyle = '#555'; ctx.font = '9px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'center';
  var labelEvery = winDays <= 7 ? 1 : winDays <= 30 ? 5 : xDays <= 28 ? 7 : xDays <= 84 ? 14 : 28;
  // The ladder above tops out at one label per 28 days, which was fine while the widest
  // span was a few months. A slow depot ester now carries a washout tail sized off its
  // half-life, so the visible span can exceed a year — at which point 28-day spacing
  // packs ~14 labels into room for ~8 and they overlap into an unreadable smear.
  // Widen only when they genuinely would not fit, so every span that already fitted
  // keeps its existing spacing exactly.
  // Widen only when the labels genuinely would not fit. This must be measured against
  // the VISIBLE span (winDays), not the total series length: zoomed in to a month the
  // window is ~30 days even when the whole series runs past a year, and sizing off the
  // total pushed the step beyond the window so only the leftmost label ever drew.
  if (winDays > 84) {
    var _lblMinPx  = 44;   // "26 Sep" at 9px plus breathing room
    var _maxLabels = Math.max(2, Math.floor(cW / _lblMinPx));
    while (Math.floor(winDays / labelEvery) + 1 > _maxLabels) labelEvery *= 2;
  }
  // Whatever the ladder produced, never step past the visible window — that is what
  // leaves an axis with a single lonely label.
  if (labelEvery > Math.max(1, Math.floor(winDays / 2))) {
    labelEvery = Math.max(1, Math.floor(winDays / 2));
  }
  for (var dl = xStart; dl <= xEnd; dl += labelEvery) {
    var lx = xOf(dl);
    var labelDate = new Date(firstDate.getTime() + dl * 86400000);
    var _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var lbl = labelDate.getDate() + ' ' + _MONTHS[labelDate.getMonth()];
    ctx.fillText(lbl, lx, PAD.top + cH + 18);
  }
  canvas._tcPanState = {xStart: xStart, xEnd: xEnd, cW: cW, zoom: _zoom};
}

// ── OPTIMIZER ─────────────────────────────────────────────────────────────────

function _tcOptimize() {
  var result = {plan: null, suggestions: [], warnings: [], calibration: {}};

  var ttNum   = parseDec(_tcp.totalT)          || 0;
  var shbgNum = parseDec(_tcp.shbg)            || 0;
  var mftNum  = parseDec(_tcp.measuredFT)      || 0;
  var curDose = parseDec(_tcp.currentDoseMgWk) || 0;
  var tgtFT   = parseDec(_tcp.targetFT)        || 0;

  var vermFT  = (ttNum > 0 && shbgNum > 0) ? _tcVermeulenFT(ttNum, shbgNum) : null;
  var ftFrac  = null;
  if (mftNum > 0 && ttNum > 0)    ftFrac = mftNum / (ttNum * 1000);
  else if (vermFT && ttNum > 0)   ftFrac = vermFT  / (ttNum * 1000);

  var targetTT = (tgtFT > 0 && ftFrac > 0) ? (tgtFT / ftFrac / 1000) : null;
  var mgToNmol = (curDose > 0 && ttNum > 0) ? (ttNum / curDose) : null;

  result.calibration = {ttNum:ttNum, shbgNum:shbgNum, mftNum:mftNum, curDose:curDose,
                        tgtFT:tgtFT, vermFT:vermFT, ftFrac:ftFrac,
                        targetTT:targetTT, mgToNmol:mgToNmol};

  // Always suggest HCG
  var hasHCG = _tcp.inventory.some(function(inv){ return inv.compId === 'hcg'; });
  result.suggestions.push(hasHCG ? {
    type: 'hcg-included', priority: 0,
    message: 'HCG in inventory — run 250–500 IU 2×/week alongside TRT to maintain testicular function.'
  } : {
    type: 'hcg-missing', priority: 1,
    message: 'Add HCG (250–500 IU 2×/week) to prevent testicular atrophy and preserve intratesticular testosterone.'
  });

  var testInv = _tcp.inventory.filter(function(inv){ return inv.compId !== 'hcg'; });

  if (testInv.length === 0) {
    result.suggestions.push({
      type: 'no-inventory', priority: 2,
      message: 'Open the inventory above to equip your compounds — T-Calc will build an optimised multi-ester schedule.'
    });
    return result;
  }

  // ── Determine total weekly dose ───────────────────────────────────────────
  var autoMgPerWeek, doseSource;
  if (targetTT !== null && mgToNmol !== null) {
    autoMgPerWeek = targetTT / mgToNmol;
    doseSource    = 'personal';
  } else if (targetTT !== null) {
    autoMgPerWeek = targetTT / 0.20;
    doseSource    = 'population';
    result.suggestions.push({
      type: 'calibration-estimate', priority: 3,
      message: 'Dose uses population average (±50% accuracy). Add your current weekly dose alongside bloodwork for a personal calculation.'
    });
  } else if (tgtFT > 0) {
    autoMgPerWeek = 150;
    doseSource    = 'default';
    result.suggestions.push({
      type: 'need-bloodwork', priority: 2,
      message: 'Enter Total T from bloodwork to enable personal dosing. Showing 150 mg/wk as a starting point.'
    });
  } else {
    autoMgPerWeek = 150;
    doseSource    = 'default';
    result.suggestions.push({
      type: 'using-default', priority: 3,
      message: 'Enter bloodwork + target free T for a personalised dose. Showing 150 mg/wk as a starting point.'
    });
  }

  autoMgPerWeek = Math.max(50, Math.min(600, autoMgPerWeek));

  var ovDose     = parseDec(_tcp.overrideDoseMgWk)    || 0;
  var ovInterval = parseDec(_tcp.overrideIntervalDays) || 0;
  var isManual   = ovDose > 0 || ovInterval > 0;
  if (isManual) doseSource = 'manual';
  var reqMgPerWeek = ovDose > 0 ? ovDose : autoMgPerWeek;

  // ── Dose allocation: PK-optimal (equal SS trough per ester) ─────────────
  // w_i = (e^(k_i × iv_i) − 1) / iv_i.  Short esters clear faster so they
  // need more mg/week to hold the same trough — the weight reflects that.
  // This minimises combined peak:trough regardless of which esters are equipped.
  // Stock amounts only drive coverage warnings — they never cap the cycle.
  var pkWeights = testInv.map(function(inv) {
    var cd = _tcCompInfo(inv.compId);
    var k  = Math.LN2 / cd.halfLifeDays;
    var iv = _tcSnapInterval(0.585 * cd.halfLifeDays);
    return (Math.exp(k * iv) - 1) / iv;
  });
  var totalPkWeight = pkWeights.reduce(function(a, b){ return a + b; }, 0);

  var effectiveCycle = _tcp.cycleDays;  // never capped by stock
  var compoundPlans  = [];

  testInv.forEach(function(inv, idx) {
    var cd       = _tcCompInfo(inv.compId);
    var bioav    = cd.bioavailability || 1;
    var frac     = totalPkWeight > 0 ? pkWeights[idx] / totalPkWeight : 1 / testInv.length;
    var stock    = parseDec(inv.totalMg) || 0;
    var compMgWkBioav  = reqMgPerWeek * frac;        // bioavailable mg/week for this compound
    var compMgWkApplied = compMgWkBioav / bioav;     // applied mg/week (what the user actually uses)

    var optInterval  = 0.585 * cd.halfLifeDays;
    var compInterval = ovInterval > 0         ? ovInterval
                     : _tcp.preferredFreqDays !== 'auto' ? _tcSnapInterval(parseDec(_tcp.preferredFreqDays) || optInterval)
                     : _tcSnapInterval(optInterval);

    // Cap applied dose per application when the compound has a physical maximum
    // (e.g. transdermal gel: 2 sachets × 50 mg = 100 mg per application)
    if (cd.maxDailyDoseMg) {
      var rawDosePerInj = compMgWkApplied * compInterval / 7;
      if (rawDosePerInj > cd.maxDailyDoseMg) {
        compMgWkApplied = cd.maxDailyDoseMg * 7 / compInterval;
        compMgWkBioav   = compMgWkApplied * bioav;
      }
    }

    // Warn when stock runs short — never shorten the cycle; user can reorder
    if (stock > 0) {
      var weeksAvail = stock / compMgWkApplied;
      if (weeksAvail < _tcp.cycleDays / 7 * 0.9) {
        result.suggestions.push({
          type: 'insufficient-inventory', priority: 1,
          message: '⚠ ' + cd.name + ' stock (' + Math.round(stock) + ' mg) covers ~' +
                   Math.floor(weeksAvail) + ' wk at ' + Math.round(compMgWkApplied) + ' mg/wk applied' +
                   ' — reorder before W' + (Math.floor(weeksAvail) + 1) + '.'
        });
      }
    }

    var ptr = _tcPeakTroughRatio(cd.halfLifeDays, compInterval);
    if (ptr > 2.5) {
      result.warnings.push({
        type: 'high-peak-trough',
        message: cd.name + ' peak:trough ' + ptr.toFixed(1) + '× exceeds 2.5× — increase frequency or use a shorter ester.'
      });
    }

    // Cost per mg from user-entered purchase price (cost is per applied mg)
    var costTotal  = parseDec(inv.costTotal) || 0;
    var costPerMg  = (costTotal > 0 && stock > 0) ? costTotal / stock : null;
    var costPerWeek = costPerMg !== null ? compMgWkApplied * costPerMg : null;

    compoundPlans.push({
      compId:           cd.id,
      cd:               cd,
      intervalDays:     compInterval,
      autoIntervalDays: _tcSnapInterval(optInterval),
      dosePerInj:       Math.round(compMgWkApplied * compInterval / 7 * 10) / 10,  // applied mg per dose
      mgPerWeek:        Math.round(compMgWkBioav),                                   // bioavailable mg/week shown in summary
      costPerMg:        costPerMg,
      costPerWeek:      costPerWeek !== null ? Math.round(costPerWeek * 100) / 100 : null
    });
  });

  // Total cycle cost (only when every compound has cost data)
  var totalCostPerCycle = null;
  if (compoundPlans.length > 0 && compoundPlans.every(function(cp){ return cp.costPerWeek !== null; })) {
    totalCostPerCycle = Math.round(
      compoundPlans.reduce(function(s, cp){ return s + cp.costPerWeek * effectiveCycle / 7; }, 0) * 100
    ) / 100;
  }

  result.plan = {
    compounds:        compoundPlans,
    totalMgPerWeek:   Math.round(reqMgPerWeek),
    autoMgPerWeek:    Math.round(autoMgPerWeek),
    cycleDays:        effectiveCycle,
    doseSource:       doseSource,
    isManual:         isManual,
    ftFrac:           ftFrac,
    totalCostPerCycle: totalCostPerCycle
  };

  return result;
}

// ── PK schedule + curve ───────────────────────────────────────────────────────

function _tcBuildSchedule(plan) {
  var cycleDays = plan.cycleDays;
  var nonHCG = plan.compounds.filter(function(c){ return c.compId !== 'hcg'; });
  if (nonHCG.length === 0) return [];

  function makeInj(cp, day, dose) {
    var bioav = cp.cd.bioavailability || 1;
    var hl    = cp.cd.halfLifeDays;
    return {
      day:          Math.round(day),
      dose:         Math.round(dose * bioav * 10) / 10,  // bioavailable dose drives PK curve
      compId:       cp.compId,
      halfLifeDays: hl,
      ka:           _tcKa(hl, cp.cd.tmaxDays),
      dot:          cp.cd.dot,
      name:         cp.cd.name,
      dosePerInj:   cp.dosePerInj                        // applied dose shown in schedule
    };
  }

  // Single compound — simple periodic
  if (nonHCG.length === 1) {
    var cp0 = nonHCG[0], s0 = [], d0 = 0;
    while (d0 < cycleDays) { s0.push(makeInj(cp0, d0, cp0.dosePerInj)); d0 += cp0.intervalDays; }
    return s0;
  }

  // ── Multi-compound: backbone + compensatory forward simulation ──────────────
  // Backbone = longest half-life; compensators sorted slowest-first (prefer coverage)
  var sorted      = nonHCG.slice().sort(function(a,b){ return b.cd.halfLifeDays - a.cd.halfLifeDays; });
  var backbone    = sorted[0];
  var compensators = sorted.slice(1);

  var backboneStart = Math.max(0, parseInt(_tcp.backboneStartDay) || 0);

  // Floor = 60% of backbone's single injection dose.
  // Compensators fire whenever the total plasma curve drops below this.
  var T_floor = backbone.dosePerInj * 0.60;

  // 1. Schedule backbone at its standard interval starting at backboneStart
  var sched = [];
  var d = backboneStart;
  while (d < cycleDays) { sched.push(makeInj(backbone, d, backbone.dosePerInj)); d += backbone.intervalDays; }

  // 2. Build backbone plasma curve
  var curve = new Float64Array(cycleDays + 1);
  function addToCurve(inj) {
    var ke = Math.LN2 / inj.halfLifeDays;
    var ka = inj.ka || _tcKa(inj.halfLifeDays);
    for (var t = inj.day; t <= cycleDays; t++)
      curve[t] += _tcPkConc(inj.dose, ka, ke, t - inj.day);
  }
  sched.forEach(addToCurve);

  // 3. Forward simulation — inject compensators on demand when curve < T_floor
  var lastInjDay = {};
  compensators.forEach(function(cp){ lastInjDay[cp.compId] = -9999; });

  for (var day = 0; day <= cycleDays; day++) {
    if (curve[day] >= T_floor) continue;
    // Below floor — try compensators slowest-first (maximises coverage per injection)
    for (var ci = 0; ci < compensators.length; ci++) {
      var cp = compensators[ci];
      if (day - lastInjDay[cp.compId] < cp.intervalDays) continue;
      var inj = makeInj(cp, day, cp.dosePerInj);
      sched.push(inj);
      addToCurve(inj);
      lastInjDay[cp.compId] = day;
      if (curve[day] >= T_floor) break;
    }
  }

  sched.sort(function(a,b){ return a.day - b.day || a.compId.localeCompare(b.compId); });
  return sched;
}

function _tcBuildCurve(sched, plan) {
  var n = plan.cycleDays + 1;
  var total = new Float64Array(n);
  for (var t = 0; t < n; t++) {
    var c = 0;
    for (var j = 0; j < sched.length; j++) {
      var inj = sched[j];
      if (inj.day <= t) {
        var ke = Math.LN2 / inj.halfLifeDays;
        var ka = inj.ka || _tcKa(inj.halfLifeDays);
        c += _tcPkConc(inj.dose, ka, ke, t - inj.day);
      }
    }
    total[t] = c;
  }
  return total;
}

function _tcComputeStats(total, sched, plan) {
  var n = plan.cycleDays + 1;

  // Full-cycle peak/trough
  var peak = 0, trough = Infinity;
  for (var t = 0; t < n; t++) {
    if (total[t] > peak)   peak   = total[t];
    if (total[t] < trough) trough = total[t];
  }
  if (trough === Infinity) trough = 0;

  // Use second half of cycle for "settled" band (avoids ramp-up distortion)
  var midDay = Math.floor(n / 2);
  var latePeak = 0, lateTrough = Infinity;
  for (var t2 = midDay; t2 < n; t2++) {
    if (total[t2] > latePeak)   latePeak   = total[t2];
    if (total[t2] < lateTrough) lateTrough = total[t2];
  }
  if (lateTrough === Infinity) lateTrough = trough;

  var ssTrough  = lateTrough;
  var ssPeak    = latePeak;
  var bandFloor = ssTrough * 0.85;
  var bandCeil  = ssPeak   * 1.15;

  var inBand = 0;
  for (var t3 = 0; t3 < n; t3++)
    if (total[t3] >= bandFloor && total[t3] <= bandCeil) inBand++;

  var firstInBand = null;
  for (var t4 = 7; t4 < n; t4++) {
    if (total[t4] >= ssTrough * 0.90 && firstInBand === null)
      firstInBand = Math.ceil(t4 / 7);
  }

  return {
    peak: peak, trough: trough,
    ssTrough: ssTrough, ssPeak: ssPeak,
    bandFloor: bandFloor, bandCeil: bandCeil,
    peakTroughRatio:  trough > 0 ? peak / trough : 0,
    inBandPct:        Math.round(inBand / n * 100),
    totalMg:          Math.round(sched.reduce(function(s, inj){ return s + inj.dose; }, 0)),
    firstInBandWeek:  firstInBand
  };
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function _tcDrawChart(canvasId, total, stats, plan, sched, calFT, measuredFT) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var lineColor = (plan.compounds && plan.compounds.length > 0) ? plan.compounds[0].cd.dot : '#e8a020';
  var cycleDays = plan.cycleDays;
  var scale     = calFT || 1;
  // ALWAYS pmol/L. There is no other unit and there must never be one — see the
  // "NEVER SWITCH UNITS" rule in CLAUDE.md. A curve that silently became mg/day when it
  // could not calibrate was never a requested feature; it rendered a y-axis of 0-35 where
  // the user expected 217+ and read as a broken chart.
  var unitLabel = 'pmol/L';

  var dpr  = window.devicePixelRatio || 1;
  var cssW = canvas.offsetWidth || 300;
  var cssH = 150;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var PAD = {top:12, right:14, bottom:26, left:52};
  var cW = cssW - PAD.left - PAD.right, cH = cssH - PAD.top - PAD.bottom;
  var totalWeeks = Math.ceil(cycleDays / 7);

  var maxV = stats ? stats.bandCeil * scale * 1.1 : 0;
  for (var i = 0; i <= cycleDays; i++) if (total[i] * scale > maxV) maxV = total[i] * scale;
  if (measuredFT && calFT && measuredFT > maxV) maxV = measuredFT * 1.1;
  if (!maxV) { ctx.fillStyle = '#555'; ctx.font = '11px -apple-system,system-ui,sans-serif'; ctx.fillText('No data', 10, 40); return; }
  var vMax = maxV * 1.05;

  function xOf(t){ return PAD.left + (t / cycleDays) * cW; }
  function yOf(v){ return PAD.top  + cH - (v / vMax) * cH; }

  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5;
  for (var w = 0; w <= totalWeeks; w++) {
    var gx = xOf(w * 7); if (gx > PAD.left + cW + 1) break;
    ctx.beginPath(); ctx.moveTo(gx, PAD.top); ctx.lineTo(gx, PAD.top + cH); ctx.stroke();
  }

  if (stats && stats.bandCeil > 0) {
    ctx.fillStyle = 'rgba(34,204,102,0.09)';
    ctx.fillRect(PAD.left, yOf(stats.bandCeil * scale), cW, yOf(stats.bandFloor * scale) - yOf(stats.bandCeil * scale));
    ctx.strokeStyle = 'rgba(34,204,102,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(PAD.left, yOf(stats.ssTrough * scale)); ctx.lineTo(PAD.left+cW, yOf(stats.ssTrough * scale)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left, yOf(stats.ssPeak   * scale)); ctx.lineTo(PAD.left+cW, yOf(stats.ssPeak   * scale)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Measured free T reference line (dashed orange)
  if (measuredFT && calFT) {
    var refY = yOf(measuredFT);
    ctx.strokeStyle = '#e8a02099'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(PAD.left, refY); ctx.lineTo(PAD.left + cW, refY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e8a020bb'; ctx.font = '8px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(Math.round(measuredFT), PAD.left + 3, refY - 2);
  }

  ctx.fillStyle = '#555'; ctx.font = '9px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'right';
  for (var ti = 0; ti <= 3; ti++) {
    var ty = PAD.top + (cH / 3) * ti;
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, ty); ctx.lineTo(PAD.left+cW, ty); ctx.stroke();
    var tv = vMax * (1 - ti / 3);
    ctx.fillText(calFT ? Math.round(tv) : (tv >= 100 ? Math.round(tv) : tv >= 10 ? tv.toFixed(1) : tv.toFixed(2)), PAD.left - 4, ty + 3);
  }
  ctx.save(); ctx.translate(10, PAD.top + cH/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign = 'center'; ctx.fillStyle = '#444'; ctx.font = '8px -apple-system,system-ui,sans-serif';
  ctx.fillText(unitLabel, 0, 0); ctx.restore();

  var grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  grad.addColorStop(0, lineColor + '55'); grad.addColorStop(1, lineColor + '00');
  ctx.beginPath(); ctx.moveTo(xOf(0), PAD.top + cH);
  for (var t = 0; t <= cycleDays; t++) ctx.lineTo(xOf(t), yOf(total[t] * scale || 0));
  ctx.lineTo(xOf(cycleDays), PAD.top + cH);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath(); ctx.moveTo(xOf(0), yOf(total[0] * scale || 0));
  for (var t3 = 1; t3 <= cycleDays; t3++) ctx.lineTo(xOf(t3), yOf(total[t3] * scale || 0));
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  ctx.lineWidth = 1;
  (sched || []).forEach(function(inj) {
    var ix = xOf(inj.day);
    ctx.strokeStyle = (inj.dot || lineColor) + '99';
    ctx.beginPath(); ctx.moveTo(ix, PAD.top + cH); ctx.lineTo(ix, PAD.top + cH + 5); ctx.stroke();
  });

  ctx.fillStyle = '#555'; ctx.font = '9px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'center';
  var labelEvery = totalWeeks <= 8 ? 1 : totalWeeks <= 16 ? 2 : 4;
  for (var w2 = 0; w2 <= totalWeeks; w2 += labelEvery) {
    var lx = xOf(w2 * 7); if (lx > PAD.left + cW + 8) break;
    ctx.fillText('W' + w2, lx, PAD.top + cH + 18);
  }
}

// ── Push log to schedule (writes dated injection entries directly to backend) ──

// Where T-Calc testosterone is written in the schedule. Unassigned → the global
// 'tcalc'; assigned to a stack → the 'tcalc:<stackId>' namespace. The namespace
// never collides with the stack's own injections, so the delete/re-post cycle
// below stays scoped to T-Calc testosterone only.
function _tcTargetCycleId(){
  var tid=_tcp&&_tcp.targetStackId;
  // The STACK's own cycle id — not a 'tcalc:<id>' namespace of its own. That
  // namespace existed so T-Calc's writes could not collide with the stack's, which
  // is precisely what produced two testosterone injections on the same day: same
  // compound, two cycle ids, both rendering. One container, one series.
  if(tid&&typeof _userStacks!=='undefined'&&_userStacks&&_userStacks.some(function(s){return s&&s.id===tid;}))return tid;
  // No stack, no cycle id. "No injections can exist outside of a stack object"
  // (Henrik 2026-08-06). The old global 'tcalc' bucket rendered unconditionally —
  // _tcalcEntryVisible returns true for it without checking any stack — so an
  // unassigned plan sat alongside a stack's own testosterone and the user got two
  // injections on the same day, with the single-source guard never firing because
  // its precondition is that the plan IS assigned. Returning '' means the sync
  // writes nothing until the user picks a stack.
  return '';
}
// Existing 'tcalc' entries are still RENDERED (see _tcalcEntryVisible) — refusing to
// write a new one must never make already-stored injections vanish.
function _tcHasTargetStack(){ return !!_tcTargetCycleId(); }
// Disable a stack's OWN TRT-config testosterone and delete the injections it
// generated (cycle_id '<stackId>', per testo compound, from today). Leaves the
// stack's peptides/enhanced injections untouched. Used when the user switches a
// stack's testosterone source to the T-Calc plan.
async function _tcClearStackConfigTrt(stack){
  if(!stack)return;
  var _cyc=(typeof _stackCycleId==='function')?_stackCycleId(stack):(stack.id||'');
  var _cids=((stack.trt&&stack.trt.compounds)||[]).map(function(c){return c.id;});
  stack.trt={};
  if(typeof saveStacksToBackend==='function'){try{await saveStacksToBackend();}catch(_e){}}
  var h=(typeof authHeaders==='function')?authHeaders():null;
  if(h&&_cyc){
    var _n=new Date();_n.setHours(0,0,0,0);
    var _td=_n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');
    for(var _i=0;_i<_cids.length;_i++){
      try{await fetch(AGENT_URL+'/injections?cycle_id='+encodeURIComponent(_cyc)+'&compound_id='+encodeURIComponent(_cids[_i])+'&from_date='+_td+'&unlogged_only=true',{method:'DELETE',headers:h});}catch(_e){}
    }
  }
}
// Assign (copy) the T-Calc testosterone to a stack — active OR inactive. Clears the
// previous home so it never duplicates, then re-syncs into the new one.
async function _tcSetTargetStack(stackId){
  // Single-source guard: a stack gets testosterone from ONE source. If the chosen
  // stack already has its own TRT config, warn and let the user choose — OK replaces
  // the config with the T-Calc source (clears it), Cancel keeps the config (aborts).
  if(stackId){
    var _tgt=(typeof _userStacks!=='undefined'&&_userStacks)?_userStacks.find(function(s){return s&&s.id===stackId;}):null;
    if(_tgt&&typeof _stackHasConfigTrt==='function'&&_stackHasConfigTrt(_tgt)){
      var _ok=(typeof confirm!=='function')?true
        :confirm('“'+(_tgt.name||'This protocol')+'” already has testosterone from its TRT config. Replace it with the T-Calc source?');
      if(!_ok){ if(typeof buildTCalc==='function')buildTCalc(); return; } // keep config; revert picker
      await _tcClearStackConfigTrt(_tgt);
    }
  }
  var oldCid=_tcTargetCycleId();
  _tcp.targetStackId=stackId||'';
  _tcSaveProfile();
  var newCid=_tcTargetCycleId();
  // ── CLEARING THE OLD HOME MUST TOUCH ONLY T-CALC'S OWN TESTOSTERONE ────────
  // This call used to be:
  //     DELETE /injections?cycle_id=<oldCid>&from_date=<today>
  // with no compound filter and no unlogged_only. Three faults, and on 2026-08-14
  // all three fired at once and destroyed a user's entire forward schedule.
  //
  //  1. EMPTY oldCid DELETES EVERYTHING. _tcTargetCycleId() returns '' when nothing
  //     is bound, and the backend's filter is `if cycle_id and ...` — an empty value
  //     is NO filter. Binding for the first time therefore issued
  //     `DELETE /injections?cycle_id=&from_date=<today>`: every injection in the
  //     account from today on, every protocol. That is what happened — 106 HGH rows,
  //     every forward peptide row, and a logged dose, none of them testosterone and
  //     none of them T-Calc's to touch. Only cycles whose rows all predate today
  //     survived, which is why it looked protocol-scoped and was not.
  //  2. NO compound_id. T-Calc owns testosterone and nothing else. Clearing its old
  //     home must not reach a protocol's peptides or HGH — exactly what the sibling
  //     _tcClearStackConfigTrt above gets right, per compound, deliberately.
  //  3. NO unlogged_only. A logged injection is a record of something administered;
  //     rebinding a planner must never delete one. The backend defaults this to
  //     False, so it had to be asked for and was not.
  if(oldCid&&oldCid!==newCid){
    var h=(typeof authHeaders==='function')?authHeaders():null;
    if(h){
      var _n=new Date();_n.setHours(0,0,0,0);
      var _td=_n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');
      var _tids=(typeof _tcAllCompIds==='function')?_tcAllCompIds():[];
      for(var _ti=0;_ti<_tids.length;_ti++){
        try{await fetch(AGENT_URL+'/injections?cycle_id='+encodeURIComponent(oldCid)
          +'&compound_id='+encodeURIComponent(_tids[_ti])
          +'&from_date='+_td+'&unlogged_only=true',{method:'DELETE',headers:h});}catch(_e){}
      }
    }
  }
  await _tcSyncLogToBackend();
  if(typeof buildTCalc==='function')buildTCalc();
  if(typeof buildStackStore==='function')buildStackStore();
}
// "Copy to stack" picker — lists every stack (active ● or inactive) so testosterone
// can be assigned to any of them, not just the active one.
function _tcStackPickerHtml(){
  var stacks=(typeof _userStacks!=='undefined'&&_userStacks)?_userStacks:[];
  var cur=(_tcp&&_tcp.targetStackId)||'';
  // No "Unassigned" option: testosterone belongs to a protocol. Picking none is how
  // the global bucket used to get written.
  var opts=cur?'':'<option value="" selected disabled>Choose a protocol…</option>';
  stacks.forEach(function(s,i){
    if(!s)return;
    var act=(typeof _isActiveStack==='function'&&_isActiveStack(i))?' ●':'';
    opts+='<option value="'+_esc(s.id||'')+'"'+((cur&&cur===s.id)?' selected':'')+'>'+_esc(s.name||('Protocol '+(i+1)))+act+'</option>';
  });
  return '<select onchange="_tcSetTargetStack(this.value)" title="Assign this testosterone to a protocol (● = active)" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:10px;padding:5px 7px;font-family:inherit;max-width:132px">'+opts+'</select>';
}

async function _tcSyncLogToBackend() {
  var h=(typeof authHeaders==='function')?authHeaders():null;
  if(!h)return;
  var _cid=_tcTargetCycleId();
  if(!_cid)return;   // no stack chosen yet — Save to stack is where that happens
  var _now=new Date();_now.setHours(0,0,0,0);
  var todayStr=_now.getFullYear()+'-'+String(_now.getMonth()+1).padStart(2,'0')+'-'+String(_now.getDate()).padStart(2,'0');

  // Group future log entries (>= today) by compId
  var byComp={};
  (_tcp.manualLog||[]).forEach(function(e){
    if(!e.compId||!e.date||!(parseDec(e.doseMg)>0))return;
    if(e.date<todayStr)return;
    if(!byComp[e.compId])byComp[e.compId]=[];
    byComp[e.compId].push(e);
  });

  // Clear all unlogged tcalc entries from today onwards (covers removed compounds too),
  // then re-post each compound's future entries via batch upsert.
  try{
    // unlogged_only: this clears the PLAN. Without it the delete also removed
    // logged records dated today or later, and the batch re-post recreated them
    // as unlogged plans — a record silently downgraded to a schedule.
    //
    // compound_id: and it must be scoped to TESTOSTERONE. _cid is the STACK's cycle
    // id ("the stack is the container", 2026-08-06), so that cycle also holds the
    // protocol's peptides and HGH. Unscoped, every sync — every dose edit, every
    // series save — deleted the protocol's whole unlogged forward plan and re-posted
    // only testosterone. Looping the known esters still "covers removed compounds
    // too" (the original intent), because it clears every testosterone id under the
    // cycle whether or not it is still in the plan.
    var _tid2=(typeof _tcAllCompIds==='function')?_tcAllCompIds():[];
    for(var _tj=0;_tj<_tid2.length;_tj++){
      await fetch(AGENT_URL+'/injections?cycle_id='+encodeURIComponent(_cid)
        +'&compound_id='+encodeURIComponent(_tid2[_tj])
        +'&from_date='+todayStr+'&unlogged_only=true',{method:'DELETE',headers:h});
    }
  }catch(_e){}

  var compIds=Object.keys(byComp);
  for(var _i=0;_i<compIds.length;_i++){
    var cid=compIds[_i];
    var cd=_tcCompInfo(cid);
    var entries=byComp[cid].map(function(e){
      return {
        cycle_id:_cid,compound_id:cid,
        compound_name:cd.name||cid,tier:'trt',
        date:e.date,
        dose:String(Math.round(parseDec(e.doseMg)*10)/10),
        unit:'mg',dot:cd.dot||'#e8a020',
        // The run this dose belongs to. Without it the grouping lived only in the
        // profile cache: nineteen doses came back from the record as nineteen
        // identical rows, and a restore could not rebuild the series card.
        series_id:e.seriesId||null,
        source:'tcalc'
      };
    });
    try{
      await fetch(AGENT_URL+'/injections/batch',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json'},h),
        body:JSON.stringify({cycle_id:_cid,compound_id:cid,from_date:todayStr,entries:entries})
      });
    }catch(_e){}
  }

  if(typeof refreshInjectionsCache==='function')await refreshInjectionsCache();
}


// ── Save to stack ─────────────────────────────────────────────────────────────
// "Using t-calc to create a new schedule needs a 'save to stack' user flow, where
// one chose an existing stack or create a new one (and choose if it is TRT or
// Enhanced, but only a tier 3 user will have the option of creating a new Enhanced
// stack, for tier 2 'enhanced' is greyed out)" — Henrik 2026-08-06.

// Fail-open on an unloaded tier, matching _cyclesAllowed: a flaky /user/features
// fetch must not lock an entitled user out of their own tier.
function _tcEnhancedAllowed(){
  if(typeof _featuresLoaded!=='undefined'&&!_featuresLoaded)return true;
  return (typeof _userTier!=='undefined'&&_userTier>=3);
}

function _tcCloseSaveToStack(){
  var ov=document.getElementById('tc-save-stack-overlay');
  if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);
}

// ── A DRAFT THAT IS NOT BOUND IS NOT SCHEDULED — SAY SO ──────────────────────
// _tcSyncLogToBackend() opens with `var _cid=_tcTargetCycleId(); if(!_cid)return;`.
// With no protocol bound it therefore writes NOTHING, silently: the add sheet closes
// as though it succeeded, the curve redraws (drafts are carried forward by
// _tcLoadLogFromStack), and injections.json never hears about any of it. Today reads
// the record, so it stays empty while the planner looks perfectly correct.
//
// Reported 2026-08-14: "no injections show up from today in Today view even if T-calc
// graph looks fine." The record settled it in one read — 7 draft doses (14–26 Aug) in
// tcalc_profiles.json and `targetStackId` absent from the profile entirely.
//
// The pre-existing "not saved to a protocol" text sits on the SIMPLE planner's card
// header only. In the manual planner — the one those 7 doses were added from — that
// header reads "off — advanced planner is on", so there was no indication anywhere.
//
// This states the situation and offers the existing action. It deliberately does NOT
// auto-bind or auto-write: the stack is still the container and Save to protocol is
// still the moment of persistence. Degrade the visibility of a state, never invent a
// fallback that silently changes what is stored.
// The protocol these injections are written into, by name, or null. Distinct from
// _tcSimplePlanStack, which additionally requires the stack to carry exactly one TRT
// compound because it drives the SIMPLE planner's card. Binding is binding: this
// answers "where do my doses go" for any planner mode.
// The protocols the save sheet will offer, named, with the active one marked — so the
// destination is knowable before the sheet is opened. Empty string when there are no
// protocols yet (the sheet then only offers to create one).
function _tcSaveTargetsHint(){
  var stacks=(typeof _userStacks!=='undefined'&&_userStacks)?_userStacks:[];
  var names=[];
  stacks.forEach(function(s,i){
    if(!s)return;
    var act=(typeof _isActiveStack==='function'&&_isActiveStack(i))?' (active)':'';
    names.push(_esc(s.name||('Protocol '+(i+1)))+act);
  });
  if(!names.length)return '';
  return names.join(', ');
}
function _tcBoundStack(){
  var tid=_tcp&&_tcp.targetStackId;
  if(!tid||typeof _userStacks==='undefined'||!_userStacks)return null;
  return _userStacks.find(function(s){return s&&s.id===tid;})||null;
}
function _tcUnsavedDraftBanner(){
  // ── BOUND: say WHICH protocol, always ──────────────────────────────────────
  // Henrik, 2026-08-14: "how do I know which protocol the missing injections get
  // saved to from T-calc? It just says Save to Protocol (which anyone would assume
  // is the active protocol)."
  //
  // It is not the active protocol — it is _tcp.targetStackId, whatever was last
  // bound, and the sheet's "New protocol" buttons bind a brand-new empty stack. The
  // only place the target was ever named is the SIMPLE planner's card header, which
  // reads "off — advanced planner is on" whenever the manual planner is in use. So
  // in the mode where doses are actually added, nothing named the destination before
  // saving or after. That is how a tap in that sheet moved a protocol's injections
  // to a new empty stack without it being visible anywhere.
  if(typeof _tcTargetCycleId==='function'&&_tcTargetCycleId()){
    var _bs=_tcBoundStack();
    if(!_bs)return '';
    return '<div style="display:flex;align-items:center;gap:8px;background:rgba(90,209,176,0.08);border:1px solid rgba(90,209,176,0.28);border-left:3px solid #5ad1b0;border-radius:10px;padding:10px 12px;margin-bottom:12px">'
      +'<div style="flex:1;font-size:12px;color:var(--text);line-height:1.5">'
        +'<span style="color:var(--muted2)">Injections are saved into</span> <b>'+_esc(_bs.name||'this protocol')+'</b>'
      +'</div>'
      +'<button onclick="_tcOpenSaveToStack()" style="flex-shrink:0;background:none;border:1px solid var(--border);border-radius:8px;color:var(--muted2);font-size:11px;font-weight:700;padding:6px 10px;cursor:pointer;font-family:inherit">Change</button>'
    +'</div>';
  }
  var drafts=((_tcp&&_tcp.manualLog)||[]).filter(function(e){return e&&e.draft&&e.date;});
  if(!drafts.length)return '';
  var dates=drafts.map(function(e){return e.date;}).sort();
  var fmt=function(k){var p=String(k).split('-');var d=new Date(+p[0],(+p[1]||1)-1,+p[2]||1);
    return isNaN(d)?k:d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});};
  var span=fmt(dates[0])+(dates.length>1?' – '+fmt(dates[dates.length-1]):'');
  return '<div style="background:rgba(232,168,32,0.10);border:1px solid rgba(232,168,32,0.45);border-left:3px solid #e8a020;border-radius:10px;padding:12px 14px;margin-bottom:12px">'
    +'<div style="font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:#e8a020;margin-bottom:5px">Not scheduled yet</div>'
    +'<div style="font-size:12px;color:var(--text);line-height:1.55;margin-bottom:10px">'
      +'<b>'+drafts.length+' planned dose'+(drafts.length===1?'':'s')+'</b> ('+_esc(span)+') '
      +'show on this curve but are <b>not saved to a protocol</b>, so they do not appear in Today and nothing is scheduled from them.'
    +'</div>'
    // Name the destination, or say plainly that there isn't one yet. "Save to
    // protocol" alone reads as if the app already knows where — it does not, and
    // there is deliberately no default: picking one for the user is what put a
    // protocol's injections into a new empty stack. So the button states that the
    // next step is the choice, and lists what is on offer.
    +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:9px">'
      +'They have no destination yet. You pick it in the next step'
      +(_tcSaveTargetsHint()?(' — '+_tcSaveTargetsHint()):'')+'.'
    +'</div>'
    +'<button onclick="_tcOpenSaveToStack()" style="width:100%;background:#e8a020;border:none;border-radius:9px;color:#0a0a0a;font-size:13px;font-weight:800;letter-spacing:0.4px;padding:11px;cursor:pointer;font-family:inherit">Choose a protocol…</button>'
  +'</div>';
}

// ── SAVE TO PROTOCOL — one dropdown, one button ──────────────────────────────
// Henrik, 2026-08-14: "this is a fucked up dialog. remove the create new protocol
// choices, only input is a drop down with existing protocols, active protocol
// prechosen, and a big colored Save button."
//
// The sheet used to put "New protocol → TRT / Enhanced" directly beneath the list
// of existing protocols. Those buttons create an EMPTY protocol and make it the
// only active one, and on 2026-08-14 one tap on Enhanced did exactly that: Today
// went blank, and the bind that followed deleted the account's whole forward
// schedule. A destructive option should not sit inside a dialog whose job is
// "file these doses somewhere".
//
// Creating a protocol belongs in Plan, where a protocol is built with its
// compounds. _tcCreateStackForTesto is left in place and untouched — it is simply
// no longer reachable from here.
function _tcOpenSaveToStack(){
  _tcCloseSaveToStack();
  var stacks=(typeof _userStacks!=='undefined'&&_userStacks)?_userStacks:[];
  var live=stacks.filter(function(s){return !!s;});

  // Preselect: the protocol already bound if there is one, else the ACTIVE protocol.
  // The active one is what a user assumes "Save to protocol" means, and that
  // assumption is now correct because it is what the control starts on.
  var preId='';
  if(_tcp&&_tcp.targetStackId&&live.some(function(s){return s.id===_tcp.targetStackId;}))preId=_tcp.targetStackId;
  if(!preId){
    for(var _a=0;_a<stacks.length;_a++){
      if(stacks[_a]&&typeof _isActiveStack==='function'&&_isActiveStack(_a)){preId=stacks[_a].id||'';break;}
    }
  }
  if(!preId&&live.length)preId=live[0].id||'';

  var body;
  if(!live.length){
    // No protocol to file into. Say where one is made rather than offering to
    // create an empty one from here.
    body='<div style="font-size:13px;color:var(--muted2);line-height:1.6;margin-bottom:16px">'
      +'You have no protocols yet. Build one in <b>Plan</b> with the compounds you are running, then come back and save these doses into it.'
      +'</div>';
  }else{
    var opts=stacks.map(function(st,i){
      if(!st)return '';
      var act=(typeof _isActiveStack==='function'&&_isActiveStack(i))?' · active':'';
      return '<option value="'+_esc(st.id||'')+'"'+((st.id||'')===preId?' selected':'')+'>'
        +_esc(st.name||('Protocol '+(i+1)))+act+'</option>';
    }).join('');
    body='<select id="tc-save-stack-sel" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:16px;padding:13px 12px;font-family:inherit;margin-bottom:16px">'+opts+'</select>'
      +'<button onclick="_tcSaveToExistingStack((document.getElementById(\'tc-save-stack-sel\')||{}).value)" '
      +'style="width:100%;background:#e8a020;border:none;border-radius:10px;color:#0a0a0a;font-size:15px;font-weight:800;letter-spacing:0.4px;padding:15px;cursor:pointer;font-family:inherit">Save</button>';
  }

  var ov=document.createElement('div');
  ov.id='tc-save-stack-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:600;display:flex;align-items:flex-end;justify-content:center';
  ov.onclick=function(e){if(e.target===ov)_tcCloseSaveToStack();};
  ov.innerHTML='<div style="background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:520px;padding:20px 18px calc(20px + env(safe-area-inset-bottom,0px));max-height:80vh;overflow:auto">'
    +'<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">Save to protocol</div>'
    +'<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;line-height:1.5">Testosterone belongs to a protocol, so its doses show on Today alongside everything else you are running.</div>'
    +body
    +'<button onclick="_tcCloseSaveToStack()" style="width:100%;background:none;border:none;color:var(--muted2);font-size:13px;font-family:inherit;cursor:pointer;margin-top:14px;padding:8px">Cancel</button>'
    +'</div>';
  document.body.appendChild(ov);
}

async function _tcSaveToExistingStack(id){
  _tcCloseSaveToStack();
  if(!id)return;
  await _tcSetTargetStack(id);            // handles the single-source guard + re-sync
  await _tcAfterSavedToStack();
}

// A protocol created here carries no compounds of its own — the testosterone comes
// from the T-Calc plan that is about to be assigned to it. Enhanced differs from TRT
// only in the tier flag, which is what the badges and the wizard read.
async function _tcCreateStackForTesto(tier){
  if(tier==='enhanced'&&!_tcEnhancedAllowed())return;
  var stacks=(typeof _userStacks!=='undefined'&&_userStacks)?_userStacks:[];
  if(stacks.length>=4)return;
  _tcCloseSaveToStack();

  var base=(tier==='enhanced')?'Enhanced':'TRT';
  var name=base, n=2;
  while(stacks.some(function(s){return s&&s.name===name;})){name=base+' '+n;n++;}

  var proto={name:name,cycle_length:12,peptides:[],trt:{},
             enhanced:(tier==='enhanced')?{enabled:true,compounds:[]}:{}};
  // Freeze the id BEFORE the start date — _deriveStackCycleId includes cycle_start,
  // so setting one first would move the id this stack's injections get written under.
  if(typeof _ensureStackId==='function')_ensureStackId(proto);
  _userStacks.push(proto);
  var idx=_userStacks.length-1;
  if(typeof _activeStackIndices!=='undefined')_activeStackIndices=[idx];
  if(typeof _ensureCycleStart==='function')_ensureCycleStart(idx);
  if(typeof saveStacksToBackend==='function')await saveStacksToBackend();
  await _tcSetTargetStack(proto.id);
  await _tcAfterSavedToStack();
}

async function _tcAfterSavedToStack(){
  if(typeof updateWEEKLY==='function')updateWEEKLY();
  if(typeof refreshInjectionsCache==='function')await refreshInjectionsCache();
  if(typeof buildWeekStrip==='function')buildWeekStrip();
  if(typeof buildToday==='function')buildToday();
  if(typeof buildSchedule==='function')buildSchedule();
  if(typeof buildStackStore==='function')buildStackStore();
  if(typeof buildTCalc==='function')buildTCalc();
}

async function _tcPushLogToSchedule() {
  var log=_tcp.manualLog||[];
  if(!log.length){alert('No injections logged yet.');return;}
  var h=(typeof authHeaders==='function')?authHeaders():null;
  if(!h){alert('Sign in required.');return;}
  // Nothing is scheduled outside a protocol. Ask which one first.
  if(!_tcHasTargetStack()){_tcOpenSaveToStack();return;}
  var _now=new Date();_now.setHours(0,0,0,0);
  var todayStr=_now.getFullYear()+'-'+String(_now.getMonth()+1).padStart(2,'0')+'-'+String(_now.getDate()).padStart(2,'0');
  await _tcSyncLogToBackend();
  var futureCount=log.filter(function(e){return e.date>=todayStr&&parseDec(e.doseMg)>0;}).length;
  alert('Pushed '+futureCount+' future injection'+(futureCount===1?'':'s')+' to schedule.');
}

// ── Main build ────────────────────────────────────────────────────────────────

function buildTCalc() {
  _tcComputeGhStack();  // refresh SHBG stack (compounds + supplements like Boron)
  var el = document.getElementById('tcalc-body');
  if (!el) return;

  if (!_tcpSessionLoaded) {
    _tcpSessionLoaded = true;
    _tcLoadProfile();
  }

  // Read the schedule out of the stack every time this tab is built. The profile
  // supplies the plan's inputs; the stack supplies the injections. T-Calc showing
  // something different from what is stored is the failure this removes.
  // The past comes from the backend, not from _injectionsCache — that cache spans 14
  // days and the PK model needs every checked injection that is still contributing.
  if (_tcHistoryState === 'idle') _tcFetchHistory();
  _tcLoadLogFromStack();

  if (_tcBwEntries === null && !_tcBwLoading) {
    _tcBwLoading = true;
    _tcFetchBwEntries();
  }

  var iSty = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:11px 13px;color:var(--text);font-size:16px;font-family:inherit;outline:none;width:100%;box-sizing:border-box';
  var lSty = 'font-size:11px;font-weight:700;letter-spacing:0.8px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;display:block';

  var log      = _tcp.manualLog || [];
  var comps    = _tcManualComps();
  // The curve is driven by _tcCurveLog(), NOT by the manual log: with the simple planner
  // live the schedule is generated from the plan and manualLog is legitimately empty.
  // Gating the card on manualLog meant an active plan — "140 mg/week, 74 injections
  // projected, shown in the plasma curve above" — rendered "No injections logged yet" and
  // no canvas at all. The draw calls already used _tcCurveLog(); only this gate did not.
  // `log` below still means the manual log, which is what the advanced planner edits.
  var validLog = _tcCurveLog();
  var mftNum   = parseDec(_tcp.measuredFT) || 0;

  var html = '';

  // Above the curve, because it is about whether the curve means anything yet.
  html += _tcUnsavedDraftBanner();

  // ── 1. PLASMA CURVE (top — main feature) ─────────────────────────────────────
  var chartDot = (validLog.length > 0 && validLog[0].compId)
    ? (_tcCompInfo(validLog[0].compId).dot || '#e8a020') : '#e8a020';
  html += '<div class="card">';
  html += '<div class="card-header"><div class="card-title-wrap">';
  html += '<div class="card-dot" style="background:' + chartDot + '"></div>';
  html += '<div class="card-title">PLASMA CURVE</div></div>';
  html += '<span style="font-size:11px;color:var(--muted2)">' + (mftNum > 0 ? 'calibrated · pmol/L' : 'add bloodwork to calibrate') + '</span>';
  html += '</div>';
  // Say what the curve is standing on. A silent gap in the history reads as a low
  // number, not as missing data — which is exactly how six weeks of logged TRT went
  // unnoticed until the level looked wrong (2026-08-07).
  html += _tcHistoryNoteHtml();
  // Filled by _tcDrawManualChart once the curve has been plotted — it reads the
  // drawn pmol/L values rather than recomputing them, so it cannot disagree with
  // the chart above it. Empty until then, and empty when the curve is uncalibrated.
  html += '<div id="tc-exposure-note"></div>';
  if (validLog.length > 0) {
    html += '<div style="padding:2px 16px 10px">';
    html += '<div style="display:flex;gap:4px;margin-bottom:8px">';
    ['today','week','month','3mo','whole'].forEach(function(z) {
      var isA = _tcChartZoom === z;
      html += '<button id="tc-zoom-' + z + '" onclick="_tcSetChartZoom(\'' + z + '\')" style="flex:1;background:' + (isA ? 'rgba(102,136,204,0.25)' : 'none') + ';border:1px solid ' + (isA ? '#6688cc66' : 'var(--border)') + ';border-radius:6px;color:' + (isA ? '#6688cc' : 'var(--muted2)') + ';font-size:9px;font-weight:700;letter-spacing:0.8px;cursor:pointer;padding:5px 2px;font-family:inherit">' + z.toUpperCase() + '</button>';
    });
    html += '</div>';
    html += '<label style="display:flex;align-items:center;gap:5px;font-size:9px;font-weight:700;letter-spacing:0.6px;color:var(--muted2);cursor:pointer;margin-bottom:8px;user-select:none">' +
      '<input type="checkbox" ' + (_tcShowAvg() ? 'checked' : '') + ' onchange="_tcToggleAvgLine(this)" style="accent-color:#5ad1b0;width:13px;height:13px;cursor:pointer;margin:0"> ' +
      '<span style="color:#5ad1b0">■</span> STEADY-STATE AVERAGE' +
      '</label>';
    html += '<canvas id="tc-main-chart" style="width:100%;display:block;"></canvas>';
    if (mftNum > 0) {
      html += '<button id="tc-hist-save" onclick="tcUpdateSavedHistory(\'tc-hist-save\')" style="width:100%;margin-top:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--muted2);font-size:12px;font-weight:600;padding:9px;cursor:pointer">Update saved history</button>';
      html += '<div style="font-size:10px;color:var(--muted2);opacity:0.75;line-height:1.5;margin-top:5px;text-align:center">Saves this exact curve to T-History. It won\'t change on its own — refresh it here whenever you want.</div>';
    }
    html += '</div>';
  } else {
    html += '<div style="padding:28px 16px;text-align:center;color:var(--muted2);font-size:13px">';
    html += 'No injections logged yet.<br><span style="font-size:12px;opacity:0.6">Add injections below to plot your plasma curve.</span>';
    html += '</div>';
  }
  html += '</div>';

  // ── 2. TESTOSTERONE PLAN (simple planner) + planner switch ────────────────────
  html += _tcSimplePlannerHtml(iSty, lSty);
  html += _tcPlannerSwitchHtml();

  // ── 3. INJECTION SCHEDULE (advanced planner — multi-compound manual log) ──────
  // Kept in full. When the advanced switch is off it is dimmed and non-interactive
  // rather than hidden: the entries are still the user's data, and hiding them would
  // suggest they had been lost.
  var _advLive = _tcPlannerMode() === 'advanced';
  html += '<div style="' + (_advLive ? '' : 'opacity:0.4;pointer-events:none;filter:grayscale(1)') + '">';
  html += '<div class="card">';
  html += '<div class="card-header"><div class="card-title-wrap">';
  html += '<div class="card-dot" style="background:#6688cc"></div>';
  html += '<div class="card-title">INJECTION SCHEDULE</div></div>';
  html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;min-width:0">';
  html += _tcStackPickerHtml();
  if (log.length > 0) {
    html += '<button onclick="_tcPushLogToSchedule()" style="background:none;border:1px solid var(--border);border-radius:8px;color:var(--muted2);font-size:10px;font-weight:700;letter-spacing:0.5px;cursor:pointer;padding:5px 10px;font-family:inherit">PUSH TO SCHEDULE</button>';
  }
  html += '<button onclick="_tcAddManualEntry()" style="background:linear-gradient(135deg,#6688cc,#4466aa);border:none;border-radius:8px;color:#fff;font-size:11px;font-weight:800;letter-spacing:0.8px;cursor:pointer;padding:7px 14px;font-family:inherit">+ ADD</button>';
  html += '</div></div>';
  html += '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">';

  if (log.length === 0) {
    html += '<div style="text-align:center;padding:16px 0;color:var(--muted2);font-size:13px">No injections logged yet.<br><span style="font-size:12px;opacity:0.6">Tap + ADD to log your first injection.</span></div>';
  } else {
    // Pre-compute series metadata
    var _seriesSeen = {};
    var _seriesTotals = {};
    var _seriesMeta = {};
    log.forEach(function(e){
      if(!e.seriesId)return;
      var sid=e.seriesId;
      _seriesTotals[sid]=(_seriesTotals[sid]||0)+1;
      if(!_seriesMeta[sid]){_seriesMeta[sid]={compId:e.compId,doseMg:e.doseMg,firstDate:e.date,lastDate:e.date,unticked:0};}
      else{if(e.date<_seriesMeta[sid].firstDate)_seriesMeta[sid].firstDate=e.date;if(e.date>_seriesMeta[sid].lastDate)_seriesMeta[sid].lastDate=e.date;}
      // Past-dated doses in the run that were never ticked. They are in the plan (and
      // in this count) but out of the curve, so the card has to say so.
      if(e.unticked)_seriesMeta[sid].unticked++;
    });
    Object.keys(_seriesMeta).forEach(function(sid){
      if((_seriesTotals[sid]||0)<2)return;
      var dates=log.filter(function(e){return e.seriesId===sid;}).map(function(e){return e.date||'';}).sort();
      // CADENCE IS THE MOST COMMON GAP, NOT THE FIRST ONE. Reading dates[1]-dates[0]
      // meant one missing dose at the head of the run silently rewrote the label: an
      // every-2-days series whose 3rd and 4th doses were never ticked came back as
      // "8 injections · every 6 days · 8 Aug → 26 Aug" — a span that holds 10 doses at
      // the real cadence and 8 at the printed one, so the card contradicted itself and
      // the gap was invisible. The modal gap survives holes anywhere in the run.
      var _gaps={},_best=0,_bestN=0;
      for(var _gi=1;_gi<dates.length;_gi++){
        var _g=Math.round((new Date(dates[_gi].replace(/-/g,'/'))-new Date(dates[_gi-1].replace(/-/g,'/')))/86400000);
        if(!(_g>0))continue;
        _gaps[_g]=(_gaps[_g]||0)+1;
        // Ties go to the SHORTER gap: a hole always reads as a longer-than-true interval,
        // never a shorter one, so the smaller candidate is the honest cadence.
        if(_gaps[_g]>_bestN||(_gaps[_g]===_bestN&&_g<_best)){_best=_g;_bestN=_gaps[_g];}
      }
      _seriesMeta[sid].interval=_best||Math.round((new Date(dates[1].replace(/-/g,'/'))-new Date(dates[0].replace(/-/g,'/')))/86400000);
      // ⚠️ DO NOT INFER "MISSED DOSES" FROM THE SPAN. A chip here counted
      // floor(span/cadence)+1 minus this series' own entries and called the remainder
      // "N missed". Two ways that lies, both hit on the first real schedule:
      //   • A date covered by a dose in ANOTHER series, or a standalone dose, is not in
      //     this series' list, so it counted as missed while the dose existed and was
      //     ticked — "prod says 3 injections missed but I cant see anything not checked
      //     in today view".
      //   • An intentionally irregular run reads as missed. Varying dose and cadence
      //     between runs is the point of the card list (see NEVER MERGE CARDS), so the
      //     app cannot tell a deliberate gap from a skipped shot and must not guess.
      // The `unticked` count below is the honest version of this: it counts STORED
      // doses that were not ticked, which is a fact rather than an inference, and it is
      // the one the user can act on.
    });
    var _tcFmtD=function(iso){if(!iso)return'';var p=iso.split('-');var M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return parseInt(p[2],10)+' '+M[parseInt(p[1],10)-1];};

    log.forEach(function(entry, idx) {
      var cd = _tcCompInfo(entry.compId || (comps[0] || ''));
      var sid = entry.seriesId;

      if (sid) {
        // ── One summary card per seriesId ──
        if (_seriesSeen[sid]) return;
        _seriesSeen[sid] = true;
        var meta = _seriesMeta[sid] || {};
        var total = _seriesTotals[sid] || 1;
        var iv = meta.interval;
        var ivLabel = iv ? ' · every ' + iv + ' day' + (iv === 1 ? '' : 's') : '';
        var mcd = _tcCompInfo(meta.compId || (comps[0] || ''));
        var editBtnStyle = 'background:none;border:1px solid #6688cc66;border-radius:6px;color:#6688cc;font-size:10px;font-weight:700;letter-spacing:0.5px;cursor:pointer;padding:4px 8px;font-family:inherit;flex-shrink:0';
        var deleteBtnStyle = 'background:none;border:none;color:var(--muted2);font-size:16px;cursor:pointer;padding:2px 4px;line-height:1;flex-shrink:0';
        // Stack visual: box-shadow creates two "cards" peeking behind the top card
        html += '<div onclick="_tcShowSeriesDetail(\'' + _esc(sid) + '\')" style="background:rgba(102,136,204,0.10);border:1px dashed #6688cc66;border-radius:12px;padding:12px;box-shadow:3px 3px 0 0 rgba(102,136,204,0.18),6px 6px 0 0 rgba(102,136,204,0.09);cursor:pointer;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<span style="font-size:10px;font-weight:800;letter-spacing:1px;color:#6688cc;text-transform:uppercase">⛓ SERIES</span>';
        html += '<span style="font-size:10px;color:var(--muted2)">' + total + ' injections' + ivLabel + '</span>';
        // A hole in the run, stated rather than absorbed into the cadence label.
        // `unticked` = scheduled, in the past, never ticked: in the plan, out of the
        // curve. `missing` = dates the span does not hold at all.
        if (meta.unticked > 0)
          html += '<span style="font-size:10px;font-weight:700;color:#e8a020">· ' + meta.unticked + ' not ticked</span>';
        html += '</div>';
        html += '<div style="display:flex;align-items:center;gap:6px;">';
        html += '<button onclick="event.stopPropagation();_tcOpenEditSeriesSheet(\'' + _esc(sid) + '\')" style="' + editBtnStyle + '">EDIT</button>';
        html += '<button onclick="event.stopPropagation();_tcConfirmRemoveSeries(\'' + _esc(sid) + '\')" style="' + deleteBtnStyle + '">✕</button>';
        html += '</div>';
        html += '</div>';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">';
        html += '<span style="width:8px;height:8px;border-radius:50%;background:' + mcd.dot + ';display:inline-block;flex-shrink:0"></span>';
        html += '<span style="font-size:14px;font-weight:600;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(mcd.name) + '</span>';
        html += '</div>';
        html += '<div style="display:flex;gap:24px;">';
        html += '<div><div style="' + lSty + '">DOSE</div><div style="font-size:14px;font-weight:600;color:var(--text)">' + _esc(String(meta.doseMg || '')) + ' mg</div></div>';
        if (meta.firstDate) {
          var dRange = _tcFmtD(meta.firstDate) + (meta.firstDate !== meta.lastDate ? ' → ' + _tcFmtD(meta.lastDate) : '');
          html += '<div><div style="' + lSty + '">DATES</div><div style="font-size:14px;font-weight:600;color:var(--text)">' + _esc(dRange) + '</div></div>';
        }
        html += '</div>';
        html += '</div>';
      } else {
        // Single injection card
        var compSelect = '<select onchange="_tcSetManualField(' + idx + ',\'compId\',this.value)" style="' + iSty + ';flex:1;min-width:0;font-size:14px">';
        comps.forEach(function(id) {
          var n = _tcCompInfo(id).name;
          compSelect += '<option value="' + _esc(id) + '"' + (entry.compId === id ? ' selected' : '') + '>' + _esc(n) + '</option>';
        });
        compSelect += '</select>';
        var borderCol = cd.dot + '33';
        html += '<div style="background:var(--surface2);border:1px solid ' + borderCol + ';border-radius:12px;padding:12px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
        html += '<span style="width:8px;height:8px;border-radius:50%;background:' + cd.dot + ';display:inline-block;flex-shrink:0"></span>';
        html += compSelect;
        html += '<button onclick="_tcConfirmRemove(' + idx + ')" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;padding:2px 4px;flex-shrink:0;line-height:1">✕</button>';
        html += '</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        html += '<div style="min-width:0;overflow:hidden"><div style="' + lSty + '">DOSE (mg)</div>';
        html += '<input type="text" inputmode="decimal" value="' + _esc(String(entry.doseMg || '')) + '" placeholder="e.g. 100" onchange="_tcSetManualField(' + idx + ',\'doseMg\',+this.value)" style="' + iSty + ';font-size:14px"></div>';
        html += '<div style="min-width:0;overflow:hidden"><div style="' + lSty + '">DATE</div>';
        html += '<input type="date" value="' + _esc(entry.date || '') + '" onchange="_tcSetManualField(' + idx + ',\'date\',this.value)" style="' + iSty + ';font-size:14px;min-width:0;max-width:100%;-webkit-appearance:none;appearance:none"></div>';
        html += '</div></div>';
      }
    });
  }
  html += '</div></div>';

  html += '</div>';   // /advanced planner wrapper

  // ── 4. BLOODWORK (collapsible list) ──────────────────────────────────────────
  var _latestBw = (_tcBwEntries && _tcBwEntries.length) ? _tcBwEntries[0] : null;
  var bwSummary = _latestBw
    ? (_latestBw.free_t != null
        ? 'Calibrated · ' + Math.round(_latestBw.free_t) + ' pmol/L Free T'
        : (_latestBw.total_t != null ? 'Total T ' + _latestBw.total_t + ' nmol/L' : _latestBw.date))
    : (_tcBwEntries === null ? 'Loading…' : 'No entries — tap to add');

  html += '<div class="card">';
  html += '<div class="card-header" onclick="_tcToggleBw()" style="cursor:pointer;user-select:none">';
  html += '<div class="card-title-wrap">';
  html += '<div class="card-dot" style="background:#cc8844"></div>';
  html += '<div class="card-title">BLOODWORK</div></div>';
  html += '<div style="display:flex;align-items:center;gap:8px">';
  if (!_tcBwOpen) {
    html += '<span style="font-size:11px;color:var(--muted2)">' + _esc(bwSummary) + '</span>';
  }
  html += '<span style="font-size:14px;color:var(--muted2);line-height:1">' + (_tcBwOpen ? '▲' : '▼') + '</span>';
  html += '</div></div>';

  if (_tcBwOpen) {
    html += '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">';

    // Age display
    if (_tcp.birthYear) {
      var _bwAge = new Date().getFullYear() - parseInt(_tcp.birthYear);
      html += '<div style="background:var(--surface2);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">';
      html += '<span style="font-size:12px;color:var(--muted)">Age (from profile)</span>';
      html += '<span style="font-size:15px;font-weight:700;color:var(--text)">' + _bwAge + ' yrs</span>';
      html += '</div>';
    } else if (_tcAgeMissing) {
      html += '<div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:8px;padding:10px 14px;font-size:12px;color:#f59e0b;">⚠ Age not set — go to Body Comp → Age to enable age-stratified reference ranges.</div>';
    }

    // Bloodwork entry lives in the Labs tab now — this panel is read-only context
    // for the free-T model. Route add/edit/delete to the single front door.
    html += '<div style="display:flex;justify-content:flex-end">';
    html += '<button onclick="event.stopPropagation();switchTab(\'labs\',document.getElementById(\'tab-btn-labs\'))" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:11px;font-weight:800;letter-spacing:0.8px;cursor:pointer;padding:7px 14px;font-family:inherit">MANAGE IN LABS →</button>';
    html += '</div>';

    // Entry list
    if (_tcBwEntries === null) {
      html += '<div style="text-align:center;padding:16px 0;color:var(--muted2);font-size:13px">Loading…</div>';
    } else if (_tcBwEntries.length === 0) {
      html += '<div style="text-align:center;padding:16px 0;color:var(--muted2);font-size:13px">No blood test entries yet.<br><span style="font-size:12px;opacity:0.6">Add your first result in the Labs tab.</span></div>';
    } else {
      var _fmtBwDate = function(iso) {
        if (!iso) return '';
        var p = iso.split('-');
        var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return parseInt(p[2],10) + ' ' + M[parseInt(p[1],10)-1] + ' ' + p[0];
      };
      _tcBwEntries.forEach(function(entry, idx) {
        var isLatest = idx === 0;
        var parts = [];
        if (entry.total_t    != null) parts.push('Total T ' + entry.total_t + ' nmol/L');
        if (entry.shbg       != null) parts.push('SHBG ' + entry.shbg + ' nmol/L');
        if (entry.free_t     != null) parts.push('Free T ' + entry.free_t + ' pmol/L');
        if (entry.dose_at_bw != null) parts.push(entry.dose_at_bw + ' mg/wk');
        if (entry.extra && entry.extra.length) parts.push('+' + entry.extra.length + ' more');
        html += '<div style="background:var(--surface2);border:1px solid ' + (isLatest ? '#cc884455' : 'var(--border)') + ';border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px">';
        html += '<div style="min-width:0;flex:1">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:' + (parts.length ? '4' : '0') + 'px">';
        html += '<span style="font-size:14px;font-weight:700;color:var(--text)">' + _esc(_fmtBwDate(entry.date)) + '</span>';
        if (isLatest) html += '<span style="font-size:9px;font-weight:800;letter-spacing:0.8px;background:#cc884433;color:#cc8844;border-radius:4px;padding:2px 6px">LATEST</span>';
        html += '</div>';
        if (parts.length) html += '<div style="font-size:12px;color:var(--muted2);line-height:1.6">' + _esc(parts.join(' · ')) + '</div>';
        html += '</div>';
        html += '</div>';
      });
    }

    // Target free T — user preference, stays editable
    html += '<div style="border-top:1px solid var(--border);padding-top:12px">';
    html += '<div><label style="' + lSty + '">Target free T (pmol/L)</label>';
    html += '<input type="number" inputmode="numeric" min="0" max="10000" step="10" value="' + _esc(_tcp.targetFT) + '" placeholder="225–675 optimal · 600–1000 high-normal TRT" oninput="_tcp.targetFT=this.value;_tcSaveProfile()" onchange="buildTCalc()" style="' + iSty + '"></div>';
    html += '</div>';

    // Calculated outputs from latest entry
    var _bwTgt = parseDec(_tcp.targetFT) || 0;
    if (_latestBw) {
      var _bwTT   = parseDec(_latestBw.total_t)   || 0;
      var _bwSHBG = parseDec(_latestBw.shbg)       || 0;
      var _bwMFT  = parseDec(_latestBw.free_t)     || 0;
      var _bwDose = parseDec(_latestBw.dose_at_bw) || 0;
      var _bwVerm = (_bwTT > 0 && _bwSHBG > 0) ? _tcVermeulenFT(_bwTT, _bwSHBG) : null;
      var _bwFrac = _bwMFT > 0 && _bwTT > 0 ? _bwMFT / (_bwTT * 1000)
                  : (_bwVerm !== null && _bwTT > 0 ? _bwVerm / (_bwTT * 1000) : null);
      var _bwTgtTT = (_bwTgt > 0 && _bwFrac > 0) ? (_bwTgt / _bwFrac / 1000) : null;
      var _bwMgNm  = (_bwDose > 0 && _bwTT > 0) ? (_bwTT / _bwDose) : null;
      if (_bwVerm !== null || _bwTgtTT !== null) {
        html += '<div style="background:var(--surface2);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:8px">';
        if (_bwVerm !== null) {
          html += '<div style="display:flex;justify-content:space-between;align-items:baseline">';
          html += '<span style="font-size:13px;color:var(--muted)">Vermeulen est. free T</span>';
          html += '<span style="font-size:15px;font-weight:700;color:var(--text)">' + Math.round(_bwVerm) + ' pmol/L</span></div>';
        }
        if (_bwFrac !== null) {
          html += '<div style="display:flex;justify-content:space-between;align-items:baseline">';
          html += '<span style="font-size:13px;color:var(--muted)">Free T fraction</span>';
          html += '<span style="font-size:15px;font-weight:700;color:var(--text)">' + (_bwFrac * 100).toFixed(2) + '%</span></div>';
        }
        if (_bwTgtTT !== null) {
          html += '<div style="display:flex;justify-content:space-between;align-items:baseline">';
          html += '<span style="font-size:13px;color:var(--muted)">Total T needed</span>';
          html += '<span style="font-size:15px;font-weight:700;color:var(--accent)">' + _bwTgtTT.toFixed(1) + ' nmol/L</span></div>';
        }
        if (_bwMgNm !== null && _bwTgtTT !== null) {
          html += '<div style="display:flex;justify-content:space-between;align-items:baseline">';
          html += '<span style="font-size:13px;color:var(--muted)">Weekly dose needed</span>';
          html += '<span style="font-size:15px;font-weight:700;color:var(--accent)">' + Math.round(_bwTgtTT / _bwMgNm) + ' mg/wk</span></div>';
        }
        html += '</div>';
      }
    } else if (_tcBwEntries && _tcBwEntries.length === 0) {
      html += '<div style="font-size:13px;color:var(--muted2);line-height:1.5">Add blood test entries to calibrate the plasma curve and enable dose calculations.<br>Optimal male free T: 225–675 pmol/L · High-normal TRT: 600–1000 pmol/L</div>';
    }

    html += '</div>'; // close padding
  }
  html += '</div>'; // close card

  el.innerHTML = html;

  if (validLog.length > 0) {
    requestAnimationFrame(function() { _tcDrawManualChart('tc-main-chart', validLog, _tcChartZoom); _tcAttachPanListeners(document.getElementById('tc-main-chart')); });
  }
}
