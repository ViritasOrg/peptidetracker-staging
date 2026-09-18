// ── Labs ──────────────────────────────────────────────────────────────────────
// One place to add bloodwork and read it back, driven by the backend lab-marker
// catalogue (GET /lab-markers). Writes the unified structured `markers` map to
// /bloodwork (keeping total_t/shbg/free_t mirrors so the T-Calc free-T model
// keeps reading the same store). Analysis = per-marker reference-range flags,
// plain-language "what this means", trend vs the previous draw, and safety
// markers surfaced first for every tier (harm-reduction stays un-gated).
//
// Marker catalogue + reference ranges are BACKEND reference data — never
// hardcoded here. This file only fetches, caches, and renders them.

var _labMarkers = null;          // {version, panels:[{key,label}], markers:[...]}
var _labMarkerIndex = {};        // key -> marker
var _labLoading = false;
var _labMoreOpen = false;        // "more markers" disclosure in the add sheet
var _labAdd = null;              // add-sheet working state
var LAB_MARKERS_CACHE_KEY = 'proto-lab-markers';

// ── catalogue ─────────────────────────────────────────────────────────────────

function _labSetCatalogue(cat) {
  _labMarkers = cat || null;
  _labMarkerIndex = {};
  if (cat && Array.isArray(cat.markers)) {
    cat.markers.forEach(function (m) { _labMarkerIndex[m.key] = m; });
  }
}

async function syncLabMarkersFromAgent() {
  var h = (typeof authHeaders === 'function') ? authHeaders() : null;
  try {
    var r = await fetch(AGENT_URL + '/lab-markers', { headers: h || {} });
    if (r.ok) {
      var cat = await r.json();
      _labSetCatalogue(cat);
      try { setData(LAB_MARKERS_CACHE_KEY, cat); } catch (_e) {}   // reference data cache (backend is source)
      return;
    }
  } catch (_e) {}
  // offline / error → fall back to the last cached catalogue
  var cached = getData(LAB_MARKERS_CACHE_KEY, null);
  if (cached) _labSetCatalogue(cached);
}

// ── flagging (pure, testable) ─────────────────────────────────────────────────

function _labSex() {
  var s = (localStorage.getItem('user_sex') || 'male').toLowerCase();
  return s === 'female' ? 'female' : 'male';
}

function _labRangeFor(m, sex) {
  if (!m || !m.ranges) return null;
  return m.ranges[sex] || m.ranges.male || m.ranges.female || null;
}

// Convert an entered value from `unit` to the marker's canonical unit.
// altUnits give value_in_alt = value_in_canonical * factor, so canonical = alt / factor.
function _labConvert(m, value, unit) {
  if (value == null || isNaN(value)) return null;
  if (!m || !unit || unit === m.unit) return value;
  var a = (m.altUnits || []).find(function (x) { return x.unit === unit; });
  return (a && a.factor) ? value / a.factor : value;
}

// Returns 'low' | 'in' | 'high' | null. Respects direction:
//   band   — flag both sides;  lower — only flag high;  higher — only flag low.
function _labFlag(m, canonicalValue, sex) {
  if (m == null || canonicalValue == null || isNaN(canonicalValue)) return null;
  var r = _labRangeFor(m, sex);
  if (!r) return null;
  var lo = r.low, hi = r.high, dir = m.direction || 'band';
  var hasLo = (lo != null), hasHi = (hi != null);
  if (dir === 'higher') return (hasLo && canonicalValue < lo) ? 'low' : 'in';
  if (dir === 'lower')  return (hasHi && canonicalValue > hi) ? 'high' : 'in';
  if (hasLo && canonicalValue < lo) return 'low';
  if (hasHi && canonicalValue > hi) return 'high';
  return 'in';
}

function _labFlagMeta(flag, safety) {
  if (flag === 'in')   return { label: 'In range', color: 'var(--accent3)' };
  if (flag === 'high') return { label: 'High', color: safety ? 'var(--danger)' : 'var(--warning)' };
  if (flag === 'low')  return { label: 'Low',  color: safety ? 'var(--danger)' : 'var(--warning)' };
  return { label: '', color: 'var(--muted2)' };
}

// value stored on an entry for a marker key: prefer the unified `markers` map,
// fall back to the legacy top-level total_t/shbg/free_t mirrors.
function _labEntryValue(entry, key) {
  if (entry && entry.markers && entry.markers[key] && entry.markers[key].value != null) {
    var mv = entry.markers[key];
    return { value: mv.value, unit: mv.unit || '' };
  }
  if (entry && (key === 'total_t' || key === 'shbg' || key === 'free_t') && entry[key] != null) {
    return { value: entry[key], unit: '' };
  }
  return null;
}

// canonical value of a marker on an entry (unit-converted), for flagging/trend.
function _labCanonical(entry, key) {
  var raw = _labEntryValue(entry, key);
  if (!raw) return null;
  return _labConvert(_labMarkerIndex[key], raw.value, raw.unit);
}

// trend vs the most recent OLDER entry that has the same marker.
// entries are sorted date-desc; idx is the current entry's index.
function _labTrend(entries, idx, key) {
  var cur = _labCanonical(entries[idx], key);
  if (cur == null) return null;
  for (var j = idx + 1; j < entries.length; j++) {
    var prev = _labCanonical(entries[j], key);
    if (prev != null) {
      if (cur > prev) return { dir: 'up', prev: prev };
      if (cur < prev) return { dir: 'down', prev: prev };
      return { dir: 'flat', prev: prev };
    }
  }
  return null;
}

// which marker keys does an entry carry a value for? (unified + legacy)
function _labEntryKeys(entry) {
  var keys = [];
  if (entry && entry.markers) Object.keys(entry.markers).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
  ['total_t', 'shbg', 'free_t'].forEach(function (k) {
    if (entry && entry[k] != null && keys.indexOf(k) < 0) keys.push(k);
  });
  // keep catalogue order
  if (_labMarkers && _labMarkers.markers) {
    return _labMarkers.markers.map(function (m) { return m.key; }).filter(function (k) { return keys.indexOf(k) >= 0; });
  }
  return keys;
}

// ── analysis: series, sparklines, derived safety (Phase 5) ────────────────────

function _labTier() {
  return (typeof _userTier === 'number' && _userTier > 0) ? _userTier : 1;
}

// canonical value series for a marker, oldest → newest (for sparkline + trend).
function _labSeries(entries, key) {
  var out = [];
  (entries || []).forEach(function (e) {
    var v = _labCanonical(e, key);
    if (v != null && e && e.date) out.push({ date: e.date, value: v });
  });
  out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return out;
}

// tiny inline sparkline of a marker's history; '' when fewer than 2 points.
function _labSparkline(entries, key) {
  var s = _labSeries(entries, key);
  if (s.length < 2) return '';
  var w = 52, h = 16, pad = 2;
  var vals = s.map(function (p) { return p.value; });
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  var rng = (mx - mn) || 1;
  var d = s.map(function (p, i) {
    var x = pad + (w - 2 * pad) * (i / (s.length - 1));
    var y = pad + (h - 2 * pad) * (1 - (p.value - mn) / rng);
    return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');
  var lx = pad + (w - 2 * pad);
  var ly = pad + (h - 2 * pad) * (1 - (vals[vals.length - 1] - mn) / rng);
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="flex-shrink:0;opacity:.85" aria-hidden="true">' +
    '<path d="' + d + '" fill="none" stroke="var(--muted2)" stroke-width="1.2"/>' +
    '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="1.7" fill="var(--accent)"/></svg>';
}

// derived safety findings on an entry: safety-flagged markers out of range, with
// the backend's own guidance text (note, else meaning). Never invents medical copy.
function _labSafetyFindings(entry) {
  if (!entry) return [];
  var sex = _labSex(), out = [];
  _labEntryKeys(entry).forEach(function (k) {
    var m = _labMarkerIndex[k];
    if (!m || !m.safety) return;
    var f = _labFlag(m, _labCanonical(entry, k), sex);
    if (f === 'high' || f === 'low') out.push({ key: k, label: m.label, flag: f, text: (m.note || m.meaning || '') });
  });
  return out;
}

function _labSafetyCard(entry) {
  var f = _labSafetyFindings(entry);
  if (f.length) {
    var rows = f.map(function (x) {
      var meta = _labFlagMeta(x.flag, true);
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12.5px;font-weight:700;color:var(--text)">' + _esc(x.label) + '</span>' +
        '<span style="font-size:9px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:' + meta.color + ';border:1px solid ' + meta.color + ';border-radius:5px;padding:2px 6px">' + meta.label + '</span></div>' +
        (x.text ? '<div style="font-size:10.5px;color:var(--muted2);line-height:1.45;margin-top:4px">' + _esc(x.text) + '</div>' : '') + '</div>';
    }).join('');
    return '<div class="card" style="border-color:var(--danger)"><div class="card-header"><div class="card-title-wrap"><div class="card-dot" style="background:var(--danger)"></div><div class="card-title">WORTH ATTENTION</div></div></div>' +
      '<div style="padding:2px 16px 12px">' + rows +
      '<div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.4">Not medical advice — discuss anything out of range with your doctor.</div></div></div>';
  }
  var anySafety = _labEntryKeys(entry).some(function (k) { var m = _labMarkerIndex[k]; return m && m.safety; });
  if (anySafety) {
    return '<div class="card" style="border-color:var(--accent3)"><div style="padding:14px 16px;display:flex;align-items:center;gap:10px">' +
      '<span style="color:var(--accent3);font-size:16px">✓</span>' +
      '<span style="font-size:12.5px;color:var(--text)">Safety markers in range as of ' + _esc(entry.date || '') + '.</span></div></div>';
  }
  return '';
}

// ── render ────────────────────────────────────────────────────────────────────

function _labSignedIn() {
  return (typeof _sessionToken !== 'undefined' && _sessionToken) ||
         (typeof _googleToken !== 'undefined' && _googleToken);
}

function _labLoadingCard(msg) {
  return '<div class="card"><div class="card-body" style="padding:22px;color:var(--muted2);font-size:13px">' + _esc(msg) + '</div></div>';
}

function buildLabs() {
  var host = document.getElementById('labs-body');
  if (!host) return;
  if (!_labSignedIn()) {
    host.innerHTML = _labLoadingCard('Sign in to log and analyse bloodwork.');
    return;
  }
  if (!_labMarkers) {
    if (!_labLoading) {
      _labLoading = true;
      host.innerHTML = _labLoadingCard('Loading marker catalogue…');
      syncLabMarkersFromAgent().then(function () { _labLoading = false; buildLabs(); });
    }
    return;
  }
  if (typeof _tcBwEntries === 'undefined' || _tcBwEntries === null) {
    if (!_labLoading) {
      _labLoading = true;
      host.innerHTML = _labLoadingCard('Loading your bloodwork…');
      _tcFetchBwEntries().then(function () { _labLoading = false; buildLabs(); })
                         .catch(function () { _labLoading = false; buildLabs(); });
    }
    return;
  }
  host.innerHTML = _labRender();
}

function _labHeader() {
  return '<div class="card"><div class="card-header">' +
    '<div class="card-title-wrap"><div class="card-dot" style="background:var(--accent3)"></div>' +
    '<div class="card-title">BLOODWORK</div></div>' +
    '<span style="margin-right:6px">' + _labLogDrawButtonHtml() + '</span>' +
    '<button onclick="_labOpenAddSheet()" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:800;letter-spacing:0.4px;cursor:pointer;font-family:inherit">+ ADD</button>' +
    '</div>' +
    '<div class="card-body" style="padding:0 16px 14px;font-size:12px;color:var(--muted2);line-height:1.5">One place for every blood test. Flags, trends and what each result means — used across the app.</div></div>';
}

function _labMarkerRow(entry, entries, idx, key) {
  var m = _labMarkerIndex[key];
  var raw = _labEntryValue(entry, key);
  if (!raw) return '';
  var label = m ? m.label : key;
  var unit = raw.unit || (m ? m.unit : '');
  var canon = _labConvert(m, raw.value, raw.unit);
  var flag = _labFlag(m, canon, _labSex());
  var meta = _labFlagMeta(flag, m && m.safety);
  var tr = _labTrend(entries, idx, key);
  var arrow = tr ? (tr.dir === 'up' ? '▲' : tr.dir === 'down' ? '▼' : '–') : '';
  var spark = (idx === 0) ? _labSparkline(entries, key) : '';   // history sparkline on the latest draw
  var pill = flag ? '<span style="font-size:9px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;color:' + meta.color + ';border:1px solid ' + meta.color + ';border-radius:5px;padding:2px 6px;flex-shrink:0">' + meta.label + '</span>' : '';
  // Beginners (tier ≤ 2) get the plain-language line on every marker; pros only on the notable ones.
  var showMeaning = m && m.meaning && (_labTier() <= 2 || flag === 'high' || flag === 'low' || (m.safety && flag));
  var meaning = showMeaning ? '<div style="font-size:10.5px;color:var(--muted2);line-height:1.45;margin-top:5px">' + _esc(m.meaning) + '</div>' : '';
  return '<div style="padding:10px 2px;border-bottom:1px solid var(--border)">' +
    '<div style="display:flex;align-items:center;gap:8px">' +
      '<div style="font-size:13px;font-weight:600;color:var(--text)">' + _esc(label) + (m && m.safety ? ' <span style="color:var(--warning);font-size:10px">◆</span>' : '') + '</div>' +
      spark +
      '<div style="margin-left:auto;font-size:13px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums">' + _esc(String(raw.value)) + ' <span style="font-size:10px;color:var(--muted2);font-weight:500">' + _esc(unit) + '</span></div>' +
      (arrow ? '<span style="font-size:10px;color:var(--muted2);flex-shrink:0" title="vs previous draw">' + arrow + '</span>' : '') +
      pill +
    '</div>' + meaning + '</div>';
}

// ── A DRAW IS LOGGED WHEN IT HAPPENS, NOT WHEN THE RESULTS ARRIVE ───────────
// Henrik, 2026-09-14: "Need to be able to log time of blood test, it matters during
// cycle for t-calc since it might be many days before test results are added."
//
// It matters because the DRAW DATE is the calibration anchor. _tcFreeTSeries solves
// TT_base as TT_at_draw * P / total[anchorDay], so the anchor DAY sets the scale of the
// whole curve — and a lab that takes a week to report means the date typed in with the
// results is a week late. On a loaded protocol that is a week of accumulation charged to
// the wrong day.
//
// ⚠️ THE STATUS IS DERIVED, NEVER STORED. A draw with no results yet is simply a
// bloodwork entry carrying only its date; once any result lands it reads as done. No new
// backend field, no migration, and no way for a stored status to disagree with the data
// it describes. _tcFreeTSeries already skips entries with no usable value when choosing
// its anchor, so a pending draw sits in the record without touching the curve until its
// numbers arrive.
function _labDrawStatus(entry){
  if(!entry) return 'drawn';
  if(entry.markers && Object.keys(entry.markers).length) return 'done';
  if(entry.extra && entry.extra.length) return 'done';
  if(entry.total_t != null || entry.shbg != null || entry.free_t != null) return 'done';
  return 'drawn';
}
// ⚠️ ONE RENDERER FOR THE LOG-DRAW BUTTON, USED BY LABS AND TODAY.
// Henrik, 2026-09-14: "On Today use the same Log Draw button style as in Labs, same
// feature must look identical in UI." CLAUDE.md makes that a standing rule, and the way
// to keep it is structural: both surfaces call this, so the styles cannot drift apart
// the way they did the first time — Labs got a pill, Today got a full-width reset-btn.
// `wide` only changes the width, because Today stacks full-width actions and a pill
// floating in that column would look like a different control, not the same one.
function _labLogDrawButtonHtml(opts){
  opts=opts||{};
  var onclick = opts.onclick || 'logBloodDraw()';
  var id = opts.id ? (' id="'+opts.id+'"') : '';
  var width = opts.wide ? 'width:100%;display:block;' : '';
  return '<button'+id+' onclick="'+onclick+'" style="'+width
    +'background:var(--surface2);color:var(--accent4);border:1px solid var(--accent4);'
    +'border-radius:8px;padding:7px 12px;font-size:12px;font-weight:800;letter-spacing:0.4px;'
    +'cursor:pointer;font-family:inherit">LOG DRAW</button>';
}
// Today renders it into its own slot, so the markup comes from the same place.
function renderTodayLogDraw(){
  var host=document.getElementById('today-log-draw');
  if(!host)return;
  host.innerHTML=_labLogDrawButtonHtml({wide:true, id:'today-log-draw-btn',
                                        onclick:'logBloodDrawFromToday(this)'});
}
// ⚠️ WHAT WAS ON BOARD IS READ OUT OF THE RECORD, NOT TYPED IN.
// "App knows exactly how much testosterone I been taking, and the current ramp up is
// impossible for an end user to just say a weekly dosage … The app needs to answer this
// question NOT the user." (2026-09-16)
//
// _tcRateAtDate integrates the logged injections through the same model the curve is
// drawn from, so the figure here and the figure under the chart cannot disagree. The
// stored dose_at_bw stays as the fallback: entries predating this, and any draw whose
// dosing happened before the user started logging, still have only the typed number.
function _labDoseContext(entry){
  if(!entry || !entry.date) return '';
  var r = (typeof _tcRateAtDate === 'function') ? _tcRateAtDate(entry.date) : null;
  if(r) return (typeof _tcRateLabel === 'function') ? _tcRateLabel(r) : '';
  return (entry.dose_at_bw != null) ? (String(entry.dose_at_bw) + ' mg/wk') : '';
}
function _labStatusChip(entry){
  var done = _labDrawStatus(entry) === 'done';
  var col = done ? 'var(--accent3)' : 'var(--accent4)';
  var txt = done ? 'DONE' : 'DRAWN \u00b7 AWAITING RESULTS';
  return '<span style="font-size:9px;font-weight:800;letter-spacing:0.5px;color:'+col
    +';border:1px solid '+col+';border-radius:5px;padding:2px 6px;flex-shrink:0">'+txt+'</span>';
}
// ⚠️ ONE BLOOD TEST PER DATE, AND ONE PLACE THAT DECIDES SO.
// Both the LOG DRAW button and the ADD sheet have to answer "is there already an entry
// for this day", and they answered it in different places — LOG DRAW refused a second
// tap, ADD did not look at all. So adding results to a draw that was already logged
// created a SECOND row, and 15 Sep 2026 ended up listed twice: one "DRAWN, waiting for
// results" and one carrying the results. Reported the same day, with a screenshot.
//
// Beyond the duplicate in the list, two rows on one date give the free-T curve two
// candidate anchors for a single measurement — and the pending one carries no values,
// so which of them wins is decided by ordering rather than by data.
// ⚠️ PREFER THE PENDING ROW. RESULTS BELONG IN THE DRAW THEY CAME FROM.
// Henrik's 15 Sep ended up as two rows — one blank, one carrying free T 634 — and this
// is the other half of how. The save path asks for "the entry on this date", discards it
// unless it is still awaiting results, and POSTs a new row when it gets nothing back. So
// taking [0] blind meant that on a date holding BOTH a pending draw and a completed one,
// the completed row could answer, _pending came back null, and the results were written
// as a third row instead of into the draw that was waiting for them.
//
// Which of the two answered was decided by the sort, and until 2026-09-18 that sort's
// comparator never returned 0 — same-date order came out of the engine's algorithm
// rather than the data. Making the comparator honest stopped the order being arbitrary;
// this stops the CHOICE being arbitrary, which is the part that writes a row.
function _labEntryOnDate(d){
  if(!d) return null;
  var on = (_tcBwEntries || []).filter(function(e){ return e && e.date === d; });
  if(!on.length) return null;
  for(var i=0;i<on.length;i++){
    if(typeof _labDrawStatus === 'function' && _labDrawStatus(on[i]) === 'drawn') return on[i];
  }
  // Nothing pending — every row on this date already has results. The caller that fills
  // results in will refuse this one and create a new row, which is the documented and
  // deliberate behaviour: silently overwriting real numbers is worse than a duplicate.
  // The caller that only asks "is there a draw on this day" is answered either way.
  return on[0];
}
// Shared by the Labs header and the Today button, so the two cannot record a draw
// differently. Dates default to today; the picker lets a draw be back-dated, which is
// the normal case when it is remembered a day later.
async function logBloodDraw(dateStr){
  var d = dateStr || (typeof dateKey==='function' ? dateKey(new Date()) : '');
  if(!d) return false;
  var h = (typeof authHeaders === 'function') ? authHeaders() : null;
  if(!h){ alert('Sign in required.'); return false; }
  // One draw per day. A second tap is a mis-tap, not a second blood test, and two
  // entries on one date would give the curve two anchors for the same measurement.
  var existing = _labEntryOnDate(d);
  if(existing){
    if(typeof switchTab==='function'){ var _b=document.getElementById('tab-btn-labs'); if(_b)switchTab('labs',_b); }
    return false;
  }
  try{
    var r = await fetch(AGENT_URL + '/bloodwork', {
      method:'POST',
      headers: Object.assign({'Content-Type':'application/json'}, h),
      body: JSON.stringify({date:d})
    });
    if(!r.ok){ alert('Failed to log the draw.'); return false; }
  }catch(_e){ alert('Network error.'); return false; }
  _tcBwEntries = null;
  if (typeof _tcBwLoading !== 'undefined') _tcBwLoading = true;
  await _tcFetchBwEntries();
  if (typeof buildLabs === 'function') buildLabs();
  if (typeof buildToday === 'function' && typeof _currentTab !== 'undefined' && _currentTab === 'today') buildToday();
  return true;
}
// From Today: log it, then say so without leaving the tab.
async function logBloodDrawFromToday(btn){
  if(btn){ btn.disabled = true; btn.textContent = 'LOGGING\u2026'; }
  var ok = await logBloodDraw();
  if(btn){
    btn.disabled = false;
    btn.textContent = ok ? '\u2713 LOGGED' : 'LOG DRAW';
  }
}

function _labEntryCard(entry, entries, idx, expanded) {
  var keys = _labEntryKeys(entry);
  var sex = _labSex();
  // safety / out-of-range first, then the rest — summary before detail
  var flagged = [], normal = [];
  keys.forEach(function (k) {
    var m = _labMarkerIndex[k];
    var canon = _labCanonical(entry, k);
    var f = _labFlag(m, canon, sex);
    if (f === 'high' || f === 'low' || (m && m.safety)) flagged.push(k); else normal.push(k);
  });
  var ordered = flagged.concat(normal);
  var visible = expanded ? ordered : ordered.slice(0, flagged.length ? flagged.length : Math.min(4, ordered.length));
  var rows = visible.map(function (k) { return _labMarkerRow(entry, entries, idx, k); }).join('');
  var hiddenN = ordered.length - visible.length;
  var moreBtn = hiddenN > 0
    ? '<button onclick="_labToggleEntry(' + idx + ')" style="width:100%;background:none;border:none;color:var(--muted2);font-size:11px;font-weight:700;cursor:pointer;padding:9px;font-family:inherit">Show ' + hiddenN + ' more ▾</button>'
    : (expanded && ordered.length > 4 ? '<button onclick="_labToggleEntry(' + idx + ')" style="width:100%;background:none;border:none;color:var(--muted2);font-size:11px;font-weight:700;cursor:pointer;padding:9px;font-family:inherit">Show less ▴</button>' : '');
  var dateLabel = entry.date || '';
  var _dc = _labDoseContext(entry);
  var ctx = _dc ? '<span style="font-size:10px;color:var(--muted2)"> · ' + _esc(_dc) + '</span>' : '';
  var pending = _labDrawStatus(entry) !== 'done';
  // A pending draw has nothing to show but its date, so it offers the one action that
  // moves it forward rather than an empty body.
  var body = pending
    ? '<div style="padding:12px 16px 14px">'
      + '<div style="font-size:11.5px;color:var(--muted2);line-height:1.5;margin-bottom:10px">'
      + 'Blood taken on this date. The T-Calc curve anchors on the day of the draw, so entering the results later keeps them tied to the right day.</div>'
      + '<button onclick="_labOpenAddSheet(\'' + _esc(entry.date || '') + '\')" style="width:100%;background:var(--accent);color:#000;border:none;border-radius:9px;padding:10px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit">Add results</button>'
      + '</div>'
    : '<div style="padding:2px 16px 6px">' + rows + moreBtn + '</div>';
  return '<div class="card"><div class="card-header">' +
    '<div class="card-title-wrap"><div class="card-dot" style="background:' + (pending ? 'var(--accent4)' : 'var(--accent)') + '"></div>' +
    '<div class="card-title" style="font-size:14px">' + _esc(dateLabel) + '</div></div>' + ctx +
    _labStatusChip(entry) +
    '<button onclick="_labDeleteEntry(\'' + _esc(entry.id || '') + '\')" style="background:none;border:1px solid var(--border);border-radius:7px;color:var(--muted2);font-size:12px;cursor:pointer;padding:4px 10px;font-family:inherit;margin-left:6px">Delete</button>' +
    '</div>' + body + '</div>';
}

// ── THE LIST IS A LIST. THE DETAIL IS BEHIND A TAP. ─────────────────────────
// Henrik, 2026-09-14: "Labs views is too verbose. I want each lab test on a single line
// (can be two rows but no more). For a user with a few cycles there will quickly be 10+
// tests. Clicking a line opens a detailed view of results (this list need to include a
// lot more in the future than todays 3 values)"
//
// Every entry used to render a full card with its markers inline. That is fine for two
// draws and unusable for twenty, and it gets worse with every marker added — which is
// the direction this is going (E2, IGF-1, fasting glucose are all waiting on a form
// field). So the list shows two lines per draw and nothing else, and the full card moves
// behind a tap.
//
// Line 1: date, status, and the headline count. Line 2: what is worth knowing at a
// glance — the out-of-range markers by name, or how many results there are.
function _labRowSummary(entry){
  if(_labDrawStatus(entry) !== 'done') return 'Waiting for results';
  var keys=_labEntryKeys(entry), sex=_labSex();
  var flagged=[];
  keys.forEach(function(k){
    var m=_labMarkerIndex[k];
    var f=_labFlag(m, _labCanonical(entry,k), sex);
    if(f==='high'||f==='low') flagged.push({label:(m&&m.label)||k, flag:f, safety:!!(m&&m.safety)});
  });
  if(!flagged.length) return keys.length + (keys.length===1?' result':' results') + ' \u00b7 all in range';
  // Safety markers first — a high haematocrit matters more than a high anything else.
  flagged.sort(function(a,b){ return (b.safety?1:0)-(a.safety?1:0); });
  var names=flagged.slice(0,3).map(function(f){ return f.label+' '+(f.flag==='high'?'\u25b2':'\u25bc'); });
  var more=flagged.length>3?(' +'+(flagged.length-3)):'';
  return names.join(' \u00b7 ')+more;
}
function _labListRow(entry, idx){
  var pending=_labDrawStatus(entry)!=='done';
  var keys=pending?[]:_labEntryKeys(entry);
  var sex=_labSex();
  var worst=null;
  keys.forEach(function(k){
    var m=_labMarkerIndex[k];
    var f=_labFlag(m,_labCanonical(entry,k),sex);
    if(f==='high'||f==='low'){ if(!worst||(m&&m.safety)) worst=_labFlagMeta(f,m&&m.safety); }
  });
  var dotCol=pending?'var(--accent4)':(worst?worst.color:'var(--accent3)');
  var chip=pending
    ? '<span style="font-size:8.5px;font-weight:800;letter-spacing:0.4px;color:var(--accent4);border:1px solid var(--accent4);border-radius:4px;padding:1px 5px;flex-shrink:0">DRAWN</span>'
    : (worst?'<span style="font-size:8.5px;font-weight:800;letter-spacing:0.4px;color:'+worst.color+';border:1px solid '+worst.color+';border-radius:4px;padding:1px 5px;flex-shrink:0">'+worst.label.toUpperCase()+'</span>':'');
  var _dc2=_labDoseContext(entry);
  var ctx=_dc2?(' \u00b7 '+_esc(_dc2)):'';
  return '<div onclick="_labOpenDetail('+idx+')" style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border);cursor:pointer">'
    +'<div style="width:8px;height:8px;border-radius:50%;background:'+dotCol+';flex-shrink:0"></div>'
    +'<div style="flex:1;min-width:0">'
      +'<div style="display:flex;align-items:center;gap:7px">'
        +'<span style="font-size:13.5px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums">'+_esc(entry.date||'')+'</span>'
        +'<span style="font-size:10px;color:var(--muted2)">'+ctx+'</span>'
        +chip
      +'</div>'
      +'<div style="font-size:11px;color:var(--muted2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(_labRowSummary(entry))+'</div>'
    +'</div>'
    +'<span style="color:var(--muted2);font-size:15px;flex-shrink:0">\u203a</span>'
    +'</div>';
}
// The detail. Reuses the full card verbatim — the list is a new way IN to it, not a
// second rendering of the same results that could drift from the first.
var _labDetailIdx = null;
function _labOpenDetail(idx){
  _labDetailIdx = idx;
  var entries=_tcBwEntries||[];
  var entry=entries[idx];
  if(!entry)return;
  var old=document.getElementById('lab-detail-sheet');
  if(old)old.remove();
  var ov=document.createElement('div');
  ov.id='lab-detail-sheet';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9998;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 12px 40px';
  ov.onclick=function(e){ if(e.target===ov) _labCloseDetail(); };
  ov.innerHTML='<div style="max-width:520px;margin:0 auto">'
    +'<div style="display:flex;align-items:center;gap:10px;margin:6px 4px 12px">'
      +'<div style="flex:1;font-size:15px;font-weight:800;color:var(--text)">'+_esc(entry.date||'')+'</div>'
      +'<button onclick="_labCloseDetail()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;font-weight:700;padding:6px 14px;cursor:pointer;font-family:inherit">Close</button>'
    +'</div>'
    +_labEntryCard(entry, entries, idx, true)
    +'</div>';
  document.body.appendChild(ov);
}
function _labCloseDetail(){
  _labDetailIdx=null;
  var ov=document.getElementById('lab-detail-sheet');
  if(ov)ov.remove();
}

var _labExpanded = {};
function _labToggleEntry(idx) { _labExpanded[idx] = !_labExpanded[idx]; buildLabs(); }

function _labRender() {
  var entries = _tcBwEntries || [];
  var html = _labHeader();
  if (!entries.length) {
    html += '<div class="card"><div class="card-body" style="padding:26px 18px;text-align:center;color:var(--muted2)">' +
      '<div style="font-size:26px">🩸</div>' +
      '<div style="font-size:13px;margin-top:8px;font-weight:600;color:var(--text)">No bloodwork yet</div>' +
      '<div style="font-size:11.5px;margin-top:4px">Add your first blood test to see it flagged and trended here — and to power the T-Calc.</div>' +
      '<button onclick="_labOpenAddSheet()" style="margin-top:14px;background:var(--accent);color:#000;border:none;border-radius:9px;padding:11px 20px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">Add bloodwork</button>' +
      '</div></div>';
    return html;
  }
  // The safety summary reads the latest draw that actually HAS results. A pending draw
  // is the newest entry by date and carries none, so passing entries[0] blindly would
  // blank the summary the moment a draw is logged.
  var _latestDone = entries.filter(function(e){ return _labDrawStatus(e) === 'done'; })[0];
  if (_latestDone) html += _labSafetyCard(_latestDone);
  html += '<div class="card"><div class="card-header">'
    + '<div class="card-title-wrap"><div class="card-dot" style="background:var(--accent2)"></div>'
    + '<div class="card-title">ALL TESTS</div></div>'
    + '<span style="font-size:11px;color:var(--muted2)">' + entries.length + '</span></div>'
    + '<div style="padding:0 0 2px">'
    + entries.map(function (e, i) { return _labListRow(e, i); }).join('')
    + '</div></div>';
  return html;
}

// ── add sheet ─────────────────────────────────────────────────────────────────

var LAB_QUICK_KEYS = ['total_t', 'free_t', 'shbg', 'estradiol'];

function _labOpenAddSheet(prefillDate, preselect) {
  if (!_labMarkers) { syncLabMarkersFromAgent().then(function () { _labOpenAddSheet(prefillDate, preselect); }); return; }
  var today = new Date().toISOString().slice(0, 10);
  // Optional pre-filled date (e.g. opened from a cycle bloodwork checkpoint); never future.
  var d0 = (typeof prefillDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prefillDate) && prefillDate <= today) ? prefillDate : today;
  _labAdd = { date: d0, dose: '', values: {} };
  // When opened from a cycle checkpoint (#640) with a recommended panel, reveal the
  // full marker list so every recommended marker (incl. advanced ones) is enterable.
  _labMoreOpen = !!(preselect && preselect.length);
  var ol = document.createElement('div');
  ol.id = 'lab-add-overlay';
  ol.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  ol.onclick = function (e) { if (e.target === ol) _labCloseAddSheet(); };
  ol.innerHTML = '<div id="lab-add-sheet" style="background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:20px 20px 36px;max-height:88vh;overflow-y:auto"></div>';
  document.body.appendChild(ol);
  _labRenderAddSheet();
}

function _labCloseAddSheet() {
  var ol = document.getElementById('lab-add-overlay');
  if (ol) ol.remove();
  _labAdd = null;
}

function _labInput(key) {
  var m = _labMarkerIndex[key];
  if (!m) return '';
  var lSty = 'font-size:11px;font-weight:700;letter-spacing:0.5px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;display:block';
  var iSty = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:15px;font-family:inherit;outline:none;width:100%;box-sizing:border-box';
  var cur = _labAdd.values[key] || {};
  var units = [m.unit].concat((m.altUnits || []).map(function (a) { return a.unit; }));
  var unitCtl;
  if (units.length > 1) {
    unitCtl = '<select onchange="_labSetUnit(\'' + key + '\',this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:9px;color:var(--text);font-size:12px;font-family:inherit;flex-shrink:0">' +
      units.map(function (u) { return '<option value="' + _esc(u) + '"' + ((cur.unit || m.unit) === u ? ' selected' : '') + '>' + _esc(u) + '</option>'; }).join('') + '</select>';
  } else {
    unitCtl = '<span style="font-size:11px;color:var(--muted2);flex-shrink:0;min-width:52px">' + _esc(m.unit) + '</span>';
  }
  return '<div style="margin-bottom:12px"><label style="' + lSty + '">' + _esc(m.label) + (m.safety ? ' <span style="color:var(--warning)">◆</span>' : '') + '</label>' +
    '<div style="display:flex;gap:8px;align-items:center">' +
      '<input type="text" inputmode="decimal" value="' + _esc(cur.value || '') + '" oninput="_labSetVal(\'' + key + '\',this.value)" placeholder="—" style="' + iSty + '">' +
      unitCtl +
    '</div></div>';
}

function _labSetVal(key, v) {
  if (!_labAdd.values[key]) _labAdd.values[key] = { value: '', unit: (_labMarkerIndex[key] || {}).unit || '' };
  _labAdd.values[key].value = v;
}
function _labSetUnit(key, u) {
  if (!_labAdd.values[key]) _labAdd.values[key] = { value: '', unit: u };
  _labAdd.values[key].unit = u;
}
function _labSetDate(v) {
  _labAdd.date = v;
  // In place, never a re-render — see the note above _labDoseAtDrawHtml.
  var host = (typeof document !== 'undefined') ? document.getElementById('lab-dose-derived') : null;
  if (host) host.innerHTML = _labDoseAtDrawHtml(v);
}
function _labSetDose(v) { _labAdd.dose = v; }
function _labToggleMore() { _labMoreOpen = !_labMoreOpen; _labRenderAddSheet(); }

// The computed half of the DOSE AT DRAW block, on its own so the date field can refresh
// it without re-rendering the sheet around the control being used — the same rule
// trtSolveSet follows, and for the same reason: a full re-render tears out the input
// (and on iOS, closes the date picker mid-interaction).
function _labDoseAtDrawHtml(dateStr) {
  var r = (typeof _tcRateAtDate === 'function') ? _tcRateAtDate(dateStr) : null;
  var out = '';
  if (r && r.mgPerDay > 0) {
    out += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:6px">'
      + '<div style="font-size:15px;font-weight:700;color:var(--text)">'
      + (Math.round(r.mgPerDay * 10) / 10) + ' mg T/day'
      + '<span style="font-size:12px;color:var(--muted2);font-weight:400"> \u00b7 '
      + Math.round(r.mgPerWeek) + ' mg/wk equivalent</span></div>'
      + (r.parts.length > 1
          ? ('<div style="font-size:11px;color:var(--muted2);margin-top:4px;line-height:1.5">'
             + r.parts.map(function (p) {
                 return _esc(p.label) + ' ' + (Math.round(p.mgPerDay * 10) / 10) + ' mg/day (' + p.pct + '%)';
               }).join(' \u00b7 ') + '</div>')
          : '')
      + '<div style="font-size:10px;color:var(--muted2);margin-top:5px">From your logged injections. '
      + 'Testosterone delivered, not milligrams of ester \u2014 esters differ in how much '
      + 'testosterone they carry, so their milligrams do not add up.</div></div>';
  } else if (r) {
    out += '<div style="font-size:11px;color:var(--muted2);margin-bottom:6px;line-height:1.5">'
      + 'Nothing on board on this date, from your logged injections.</div>';
  }
  out += '<div style="font-size:10px;color:var(--muted2);margin-bottom:4px">'
    + (r ? 'Override (mg/wk) \u00b7 only if the record is incomplete' : 'mg/wk \u00b7 optional')
    + '</div>';
  return out;
}

function _labRenderAddSheet() {
  var sheet = document.getElementById('lab-add-sheet');
  if (!sheet || !_labAdd) return;
  var today = new Date().toISOString().slice(0, 10);
  var lSty = 'font-size:11px;font-weight:700;letter-spacing:0.5px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;display:block';
  var iSty = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:15px;font-family:inherit;outline:none;width:100%;box-sizing:border-box';
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">' +
    '<div style="font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--text)">ADD BLOODWORK</div>' +
    '<button onclick="_labCloseAddSheet()" style="background:none;border:none;color:var(--muted2);font-size:22px;cursor:pointer;line-height:1">×</button></div>';
  h += '<div style="margin-bottom:14px"><label style="' + lSty + '">DATE</label>' +
    '<input id="lab-date" type="date" value="' + _esc(_labAdd.date) + '" max="' + today + '" oninput="_labSetDate(this.value)" style="' + iSty + '"></div>';

  // Quick, common markers first (progressive disclosure).
  h += '<div style="font-size:11px;color:var(--muted2);margin-bottom:8px;font-weight:700;letter-spacing:0.5px">COMMON</div>';
  LAB_QUICK_KEYS.forEach(function (k) { if (_labMarkerIndex[k]) h += _labInput(k); });

  // ── DOSE AT DRAW: ANSWERED, THEN OFFERED FOR CORRECTION ──────────────────
  // The app computes this from the logged injections now. The field stays, because the
  // record only knows what has been logged — a draw taken before the user started
  // logging, or during dosing done elsewhere, still has nothing to derive from — but it
  // is no longer a question the user has to answer from nothing. When there IS an
  // answer it is stated above the box, in the ester split that makes a single weekly
  // number impossible to give.
  h += '<div style="margin-bottom:12px"><label style="' + lSty + '">DOSE AT DRAW</label>'
    + '<div id="lab-dose-derived">' + _labDoseAtDrawHtml(_labAdd.date) + '</div>'
    + '<input type="text" inputmode="decimal" value="' + _esc(_labAdd.dose || '') + '" oninput="_labSetDose(this.value)" placeholder="\u2014" style="' + iSty + '"></div>';

  // Everything else, grouped by panel, behind a disclosure.
  h += '<button onclick="_labToggleMore()" style="width:100%;background:none;border:1px dashed var(--border);border-radius:8px;color:var(--muted2);font-size:12px;font-weight:700;letter-spacing:0.4px;cursor:pointer;padding:11px;font-family:inherit;margin:4px 0 14px">' +
    (_labMoreOpen ? 'Hide extra markers ▴' : '+ More markers ▾') + '</button>';
  if (_labMoreOpen) {
    (_labMarkers.panels || []).forEach(function (p) {
      var inPanel = (_labMarkers.markers || []).filter(function (m) { return m.panel === p.key && LAB_QUICK_KEYS.indexOf(m.key) < 0; });
      if (!inPanel.length) return;
      h += '<div style="font-size:11px;color:var(--muted2);margin:10px 0 8px;font-weight:700;letter-spacing:0.5px">' + _esc((p.label || p.key).toUpperCase()) + '</div>';
      inPanel.forEach(function (m) { h += _labInput(m.key); });
    });
  }

  h += '<button onclick="_labConfirmAdd()" style="width:100%;background:var(--accent);border:none;border-radius:10px;color:#000;font-size:14px;font-weight:800;letter-spacing:0.5px;padding:14px;cursor:pointer;font-family:inherit;margin-top:6px">SAVE</button>';
  sheet.innerHTML = h;
}

async function _labConfirmAdd() {
  if (!_labAdd) return;
  var date = _labAdd.date;
  if (!date) { alert('Date is required.'); return; }
  if (date > new Date().toISOString().slice(0, 10)) { alert('Blood test date cannot be in the future.'); return; }

  var markers = {};
  Object.keys(_labAdd.values).forEach(function (k) {
    var v = _labAdd.values[k];
    if (v && v.value !== '' && v.value != null) {
      var num = parseDec(v.value);
      if (!isNaN(num)) markers[k] = { value: num, unit: (v.unit && v.unit !== (_labMarkerIndex[k] || {}).unit) ? v.unit : '' };
    }
  });
  if (!Object.keys(markers).length && !_labAdd.dose) { alert('Enter at least one result.'); return; }

  // canonical-unit mirrors so the free-T model keeps reading total_t/shbg/free_t.
  function mirror(k) {
    var mv = markers[k]; if (!mv) return null;
    return _labConvert(_labMarkerIndex[k], mv.value, mv.unit);
  }
  // Snapshot the SHBG-suppressor doses active NOW (same freeze the T-Calc entry does).
  var ghStack = (typeof _tcGhStack !== 'undefined' && _tcGhStack) ? _tcGhStack : [];
  var suppSnap = ghStack.map(function (gh) {
    var dr = gh.interactions && gh.interactions.shbg && gh.interactions.shbg.doseResponse;
    return { id: gh.pepId, dailyDose: (gh.dailyDose != null ? gh.dailyDose : null), unit: (dr && dr.unit) || '', startDate: gh.startDateStr || '' };
  }).filter(function (s) { return s.id; });

  var entry = {
    date: date,
    total_t: mirror('total_t'),
    shbg: mirror('shbg'),
    free_t: mirror('free_t'),
    dose_at_bw: (_labAdd.dose !== '' && _labAdd.dose != null) ? parseDec(_labAdd.dose) : null,
    markers: markers,
    suppressors: suppSnap
  };
  var h = (typeof authHeaders === 'function') ? authHeaders() : null;
  if (!h) { alert('Sign in required.'); return; }
  // ⚠️ RESULTS FOR A DRAW ALREADY LOGGED ARE AN UPDATE, NOT A NEW BLOOD TEST.
  // A pending draw is a real row with a real id — it is the same blood test, entered
  // before its numbers came back. POSTing here is what put 15 Sep in the list twice.
  //
  // Only a PENDING entry is filled in. An entry on this date that already HAS results
  // is a different situation: silently overwriting real numbers is worse than the
  // duplicate this fixes, so that case is left creating a second row as before.
  var _pending = (typeof _labEntryOnDate === 'function') ? _labEntryOnDate(date) : null;
  if (_pending && (_labDrawStatus(_pending) === 'done' || !_pending.id)) _pending = null;
  try {
    var r = await fetch(AGENT_URL + '/bloodwork' + (_pending ? ('/' + encodeURIComponent(_pending.id)) : ''), {
      method: _pending ? 'PUT' : 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, h),
      body: JSON.stringify(entry)
    });
    if (!r.ok) { alert('Failed to save.'); return; }
  } catch (_e) { alert('Network error.'); return; }
  _labCloseAddSheet();
  _tcBwEntries = null;
  if (typeof _tcBwLoading !== 'undefined') _tcBwLoading = true;
  await _tcFetchBwEntries();   // refresh shared store (also re-syncs the T-Calc)
  buildLabs();
  // If logged from a cycle bloodwork checkpoint, refresh that view so the
  // checkpoint reflects the new entry from the unified store.
  if (typeof renderCyclesTab === 'function' && typeof _currentTab !== 'undefined' && _currentTab === 'stacks') {
    try { renderCyclesTab(); } catch (_e) {}
  }
}

async function _labDeleteEntry(id) {
  if (!id) return;
  // The row is gone after this; leaving its detail sheet open would show a deleted draw.
  if (typeof _labCloseDetail === 'function') _labCloseDetail();
  if (typeof confirmGlobalDelete === 'function' && !confirmGlobalDelete('this blood test')) return;
  var h = (typeof authHeaders === 'function') ? authHeaders() : null;
  if (!h) return;
  try {
    await fetch(AGENT_URL + '/bloodwork/' + encodeURIComponent(id), { method: 'DELETE', headers: h });
  } catch (_e) {}
  _tcBwEntries = null;
  if (typeof _tcBwLoading !== 'undefined') _tcBwLoading = true;
  await _tcFetchBwEntries();
  buildLabs();
}
