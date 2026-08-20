// ── inj-writer.js — the ONLY module that writes injections ────────────────────
//
// Phase 3 of the unified Plan rewrite (docs/unified-plan-rewrite.md §3.2).
//
// Before this file, ten call sites across tab-stack.js and tab-tcalc.js each
// built their own request to /injections. They did not agree with each other:
// one passed `&from=`, the rest `&from_date=`; some checked r.ok, some swallowed
// everything; the prune in one place covered both id spellings and in another
// only one. Every injection bug of 2026-08-15/16 lived in that gap — a delete
// that ran with no matching write, a write with no matching cache refresh, a
// prune that missed rows because it was spelled differently three functions
// away.
//
// The rule this file exists to make true, from §3.2 of the plan:
//
//   1. Only the scheduler writes injections. Nothing else calls POST/DELETE on
//      /injections for planning purposes.
//   2. Today's tick is the sole exception — PUT /injections/{id} to set `logged`
//      records an event that already happened, it does not plan one.
//
// This phase does NOT change behaviour. Each function is a faithful wrapper of
// the request its callers were already making, returning the Response (or null
// on a network error) so callers keep their own success handling. Consolidating
// the requests and changing what they do at the same time would make a
// regression impossible to attribute.

// Every write is tagged with its caller so a failure names the feature that
// caused it, not just the endpoint. _logHttp/_logErr are the app's existing
// loggers; guarded because this file loads before nothing in particular.
function _injLogHttp(tag, status, path){
  if(typeof _logHttp === 'function') _logHttp(tag, status, path);
}
function _injLogErr(tag, e){
  if(typeof _logErr === 'function') _logErr(tag, e);
}

// POST /injections/batch — write a compound's schedule from `fromDate` on.
// The backend prunes this compound's UNLOGGED rows from that date and preserves
// logged ones (routers/injections.py, batch_upsert), which is why a caller must
// never delete first "to be sure": that is what downgraded a logged dose to a
// plan before unlogged_only existed.
async function injWriteBatch(cycleId, compoundId, fromDate, entries, tag){
  try{
    var r = await fetch(AGENT_URL + '/injections/batch', {
      method:'POST',
      headers: authHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({cycle_id: cycleId, compound_id: compoundId,
                            from_date: fromDate, entries: entries})
    });
    if(!r.ok) _injLogHttp(tag || 'injWriteBatch', r.status, '/injections/batch');
    return r;
  }catch(e){ _injLogErr(tag || 'injWriteBatch', e); return null; }
}

// POST /injections — one row. Used for record entry (a past dose the user says
// they took) and for single planned doses.
async function injWriteOne(row, tag){
  try{
    var r = await fetch(AGENT_URL + '/injections', {
      method:'POST',
      headers: authHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify(row)
    });
    if(!r.ok) _injLogHttp(tag || 'injWriteOne', r.status, '/injections');
    return r;
  }catch(e){ _injLogErr(tag || 'injWriteOne', e); return null; }
}

// DELETE /injections — clear a compound's PLAN from a date forward.
//
// unlogged_only defaults to true here, where the old call sites had to remember
// to pass it. A logged injection is the record of something that was
// administered; clearing a plan must never take one with it. A caller that
// genuinely means "remove the record too" has to say so explicitly.
//
// ⚠️ AN EMPTY cycleId OR compoundId IS NOT A NARROW DELETE — IT IS NO FILTER.
// The backend reads `if cycle_id and ...`, so `?cycle_id=&from_date=<today>` matches
// EVERY injection in the account from today on, across every protocol. That exact
// request went out on 2026-08-14 and destroyed a user's whole forward schedule: 106
// HGH rows, every forward peptide row and a logged dose, none of it testosterone and
// none of it the caller's to touch.
//
// The guard against it used to live in _tcSetTargetStack, which Phase 8 deleted along
// with the rest of T-Calc's write paths — and this module, which is now the only
// place a delete is issued, never had one. So it lives here, where every delete has
// to pass through it. Refusing is always safe; a delete that does not happen leaves
// the record intact, and the caller that meant to scope it can be fixed.
//
// fromDate is required for the same reason: without it the backend has no lower
// bound and the "future" delete reaches back through the whole history.
async function injClearFuture(cycleId, compoundId, fromDate, opts){
  var o = opts || {};
  var unloggedOnly = (o.unloggedOnly === false) ? false : true;
  if(!cycleId || !compoundId || !fromDate){
    _injLogErr(o.tag || 'injClearFuture',
      new Error('refused: a delete needs cycle_id, compound_id and from_date — got ' +
                JSON.stringify({cycle_id: cycleId || '', compound_id: compoundId || '',
                                from_date: fromDate || ''}) +
                '. An empty value is NOT a filter; the backend would match every row.'));
    return null;
  }
  try{
    var r = await fetch(AGENT_URL + '/injections?cycle_id=' + encodeURIComponent(cycleId) +
                        '&compound_id=' + encodeURIComponent(compoundId) +
                        '&from_date=' + fromDate +
                        '&unlogged_only=' + (unloggedOnly ? 'true' : 'false'),
                        {method:'DELETE', headers: authHeaders()});
    if(!r.ok) _injLogHttp(o.tag || 'injClearFuture', r.status, '/injections');
    return r;
  }catch(e){ _injLogErr(o.tag || 'injClearFuture', e); return null; }
}

// Clear several compounds in one go. Runs them together rather than in series —
// a phone doing this one round trip at a time was slow enough to be visible, and
// the sequential version pushed the following write far enough down the
// microtask queue to change when callers observed it. One failure must not abort
// the rest, nor the write that follows.
async function injClearFutureMany(cycleId, compoundIds, fromDate, opts){
  return Promise.all((compoundIds || []).map(function(cid){
    return injClearFuture(cycleId, cid, fromDate, opts);
  }));
}
