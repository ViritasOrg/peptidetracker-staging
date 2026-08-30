// ── TIMELINE — visual viewer of every cycle, dose and supplement ─────────────
// Replaces the old vertical milestone list. The tab now answers "what have I
// actually been on, and when" in one screen: colour-coded compound lanes laid
// across a scrollable date window, ordered Anabolics → Peptides → Supplements
// (design spec §3, "Visual Hierarchy"). Every cycle is shown, always — there is
// deliberately no protocol filter and nothing drawn above the lanes; the lanes
// are the content, and each one names its owning protocol when expanded.
//
// Two things separate this from every other tab:
//  1. It reads the WHOLE record, not the active protocol. refreshInjectionsCache
//     filters /injections down to active cycles and drops the rest (by design —
//     Today must not show doses from a protocol you switched off). A history
//     viewer that did the same would be lying about the past, so this tab holds
//     its own cache over its own, much wider date span and keeps everything,
//     labelling each lane with the protocol that owns it.
//  2. IT WRITES NOTHING. Not a dose, not a supplement, not a new row. Tapping a
//     mark opens a read-only detail sheet and that is the whole of its
//     interaction model; Today is where anything gets ticked off. The per-dose
//     tick, the supplement slot buttons and the "+" that opened the
//     past-injection sheet were all removed on request (2026-08-30). Keep it
//     that way: this is a history view, and at four pixels a day a mis-tap here
//     writes a false claim about what went into your body.

// Plain-language "What this means" line for the cycle progress bar — derived only
// from the cycle's own position (weeks in / left, before-start / complete). No
// compound data, no dosing advice. Mirrors the Blood Levels translator (#582).
function _tlWhatThisMeans(wk,total,daysDone,totalDays){
  var daysLeft=Math.max(0,totalDays-daysDone);
  var wksLeft=Math.ceil(daysLeft/7);
  if(daysDone<0) return 'This cycle hasn\'t started yet — it begins on your start date.';
  if(daysDone>=totalDays) return 'This cycle is complete. Review your bloodwork before planning the next one.';
  var phase = wk<=Math.max(1,Math.round(total*0.25)) ? 'early — levels are still building toward steady state'
            : wk>total-1 ? 'in its final week — plan your next step or a break'
            : wk>total*0.75 ? 'in the back stretch'
            : 'mid-cycle — this is where levels are most stable';
  return 'You\'re '+phase+'. About '+wksLeft+' week'+(wksLeft===1?'':'s')+' left of '+total+'.';
}

// ── view state ───────────────────────────────────────────────────────────────
var _tlWin=28;            // days visible in the window
var _tlAnchor=null;       // Date — first day of the window (local midnight)
var _tlOpen={};           // laneKey → true when the lane is expanded
var _tlRows=null;         // raw injection rows for the loaded span
var _tlSpan=null;         // {from:Date,to:Date} currently loaded
var _tlState='idle';      // idle | loading | ready
var _tlMarks={};          // markKey → {lane,dk} for the tap handlers
var _tlOff=0;             // fractional day offset into the window — the drag lives here
var _tlDragEndedAt=0;     // ms timestamp of the last pan, to swallow its trailing click

var _TL_WINDOWS=[{d:14,l:'2W'},{d:28,l:'4W'},{d:56,l:'8W'},{d:84,l:'12W'}];
// Supplements carry no colour of their own (the catalogue is a plain list), so a
// lane gets a stable one from its id — same supplement, same colour, every render.
var _TL_SUPP_COLORS=['#6fb3d6','#7fc99b','#c9a86a','#b58fd6','#d68fa8','#8fd6cf'];

function _tl0(d){var x=new Date(d);x.setHours(0,0,0,0);return x;}
function _tlAdd(d,n){return new Date(_tl0(d).getTime()+n*86400000);}
function _tlDiff(a,b){return Math.round((_tl0(a)-_tl0(b))/86400000);}
function _tlNum(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:null;}
function _tlFmtNum(n){return (Math.round(n*100)/100).toString();}
function _tlUnit(u){return (typeof UNIT_LABELS!=='undefined'&&UNIT_LABELS[u])?UNIT_LABELS[u]:(u||'');}
function _tlEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _tlShortDate(d){return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});}

// ── lane labels ──────────────────────────────────────────────────────────────
// Long compound names do not fit a lane header: "Nebido (Testosterone
// Undecanoate)" truncated mid-word at every window size. Henrik, 2026-08-30:
// "Shorten Testosterone to Test. Also truncate esters to first three characters
// same with names like Nebido or Depot."
//
// A WORD LIST, NOT A BLANKET TRUNCATION. Cutting every long word to three
// characters would read well on the esters and badly everywhere else, and in a
// medical app it invents collisions — "Enanthate" and "Estradiol" would both
// become "Est". Only the testosterone vocabulary named in the request is
// shortened; every other name is left exactly as it is, so HGH (Somatropin),
// Anadrol and the supplements are untouched.
//
// Display only. The stored name is not changed, and the dose sheet still shows
// it in full — tap the mark and you get "Nebido (Testosterone Undecanoate)"
// back. ENHANCEMENT_COMPOUNDS is served by the backend, so a new ester that is
// not on this list simply stays long; that is a cosmetic miss, not a wrong label.
var _TL_SHORT_WORDS={
  testosterone:'Test',
  // esters
  enanthate:'Ena', cypionate:'Cyp', undecanoate:'Und', propionate:'Pro',
  phenylpropionate:'Phe', decanoate:'Dec', isocaproate:'Iso', caproate:'Cap',
  acetate:'Ace', hexahydrobenzylcarbonate:'Hex',
  // brand and formulation words
  nebido:'Neb', depot:'Dep', testoviron:'Tes', sustanon:'Sus', omnadren:'Omn',
  aveed:'Ave'
};
function _tlShortName(name){
  // Alpha runs only, so "Depo-Testosterone" shortens its second half and
  // "Sustanon 250" keeps its number.
  return String(name==null?'':name).replace(/[A-Za-z]+/g,function(w){
    return _TL_SHORT_WORDS[w.toLowerCase()]||w;
  });
}

// ── data span ────────────────────────────────────────────────────────────────
// Wide enough to hold every cycle the user has ever configured, plus the plan
// ahead. Clamped to four years back so a stray 1970 start date cannot ask the
// backend for a decade of rows.
function _tlBounds(){
  var t0=_tl0(NOW);
  var from=_tlAdd(t0,-120),to=_tlAdd(t0,120);
  ((typeof _userStacks!=='undefined'&&_userStacks)||[]).forEach(function(st){
    if(!st||!st.cycle_start)return;
    var s=parseLocalDate(st.cycle_start);
    if(s<from)from=_tlAdd(s,-14);
    if(st.cycle_length){
      var e=_tlAdd(s,st.cycle_length*7);
      if(e>to)to=_tlAdd(e,14);
    }
  });
  var floor=_tlAdd(t0,-4*365);
  if(from<floor)from=floor;
  return {from:from,to:to};
}

// The window may be dragged outside whatever was fetched, so the span grows to
// cover wherever the user has navigated to — that is what makes the date
// navigator effectively infinite in both directions (spec §4.1).
function _tlNeeded(){
  var b=_tlBounds();
  var winFrom=_tlAdd(_tlAnchorDate(),-30),winTo=_tlAdd(_tlAnchorDate(),_tlWin+30);
  return {from:winFrom<b.from?winFrom:b.from,to:winTo>b.to?winTo:b.to};
}

async function _tlLoad(){
  if(_tlState==='loading')return;
  var need=_tlNeeded();
  if(_tlState==='ready'&&_tlSpan&&_tlSpan.from<=need.from&&_tlSpan.to>=need.to)return;
  _tlState='loading';
  var rows=[];
  if(typeof fetchInjectionsForRange==='function'){
    rows=await fetchInjectionsForRange(dateKey(need.from),dateKey(need.to));
  }
  // Backend down: fall back to whatever the app already has in memory rather
  // than showing an empty history, which would read as "you never took any of
  // this" instead of "we could not reach the record".
  if((!rows||!rows.length)&&typeof _injectionsCache!=='undefined'&&_injectionsCache){
    rows=[];
    Object.keys(_injectionsCache).forEach(function(dk){
      (_injectionsCache[dk]||[]).forEach(function(e){rows.push(e);});
    });
  }
  _tlRows=rows||[];
  _tlSpan=need;
  _tlState='ready';
  if(document.getElementById('timeline-body'))buildTimeline();
}

// ── keeping this tab's copy in step with the record ──────────────────────────
// THE SAME BUG CLASS AS _tcHistory — SEE THE NOTE IN toggleInjection.
// This tab holds its OWN fetch of /injections, over a far wider span than
// _injectionsCache, so the cache patch toggleInjection applies on every tick
// never reaches these rows. Ticking a dose on Today therefore left the timeline
// showing the pre-tick state for the rest of the session: the mark stayed
// outlined, and the lane's "6/9 taken" stayed wrong, until the app was
// restarted. Reported 2026-08-30.
//
// Anything that changes whether a dose was taken must call one of these two.
// _tlNoteInjection is the cheap path — patch the flag we already hold, repaint
// if the tab is on screen. _tlInvalidateInjections is for when the row SET
// changed (doses added, a protocol regenerated): drop the span so the next paint
// refetches rather than trusting a copy that is now missing rows.
function _tlNoteInjection(id,logged){
  var hit=false;
  (_tlRows||[]).forEach(function(e){if(e&&e.id===id){e.logged=!!logged;hit=true;}});
  // A row we do not hold is a copy we cannot trust to be complete — refetch.
  if(!hit){_tlInvalidateInjections();return;}
  if(typeof _currentTab!=='undefined'&&_currentTab==='timeline'&&document.getElementById('tl-canvas'))_tlPaint();
}
function _tlInvalidateInjections(){
  _tlSpan=null;
  if(_tlState!=='loading')_tlState='idle';
  // Visible right now: refetch immediately, which repaints when it lands. Not
  // visible: buildTimeline's own idle check picks it up when the tab is opened.
  if(typeof _currentTab!=='undefined'&&_currentTab==='timeline'&&document.getElementById('timeline-body'))_tlLoad();
}

// ── protocol / owner naming ──────────────────────────────────────────────────
// Every row belongs to something, including rows whose protocol is gone. Naming
// the owner is what turns an orphaned dose from a mystery mark into history.
function _tlOwnerId(e){
  var c=(e&&e.cycle_id)||'';
  if(c.indexOf('tcalc:')===0)return c.slice(6);
  if(c==='tcalc')return '_tcalc';
  if(c==='manual')return '_manual';
  return c||'_none';
}
function _tlOwnerName(id){
  if(id==='_tcalc')return 'T-Calc plan';
  if(id==='_manual')return 'Logged manually';
  if(id==='_none')return 'Unassigned';
  var st=((typeof _userStacks!=='undefined'&&_userStacks)||[]).filter(function(s){return s&&_tlStackId(s)===id;})[0];
  return st?(st.name||'Protocol'):'Archived protocol';
}
function _tlStackId(st){
  if(!st)return '';
  if(typeof _stackCycleId==='function')return _stackCycleId(st);
  return st.id||'';
}

// ── lane assembly ────────────────────────────────────────────────────────────
// One lane per compound (spec §4.1: "distinct, colour-coded horizontal lanes"),
// merged across protocols — the same testosterone through three blasts is one
// story, and the owner chips say which cycle each stretch belongs to.
//
// Visualisation style follows the spec's three examples directly: bars/blocks
// for the injectables you take on a handful of days (Test E, Anadrol), dots on a
// continuous line for the everyday small-volume ones (HGH, peptides,
// supplements).
function _tlLaneStyle(tier){return (tier==='peptide'||tier==='supplement')?'dots':'blocks';}
function _tlGroupOf(tier){
  if(tier==='trt'||tier==='enhanced')return 'anabolics';
  if(tier==='supplement')return 'supplements';
  return 'peptides';
}
function _tlSuppColor(id){
  var h=0,s=String(id||'');
  for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return _TL_SUPP_COLORS[h%_TL_SUPP_COLORS.length];
}

function _tlBuildLanes(from,to){
  var lanes={},order=[];
  function lane(key,init){
    if(!lanes[key]){lanes[key]=init;lanes[key].days={};lanes[key].owners={};order.push(key);}
    return lanes[key];
  }
  var fromK=dateKey(from),toK=dateKey(to);
  (_tlRows||[]).forEach(function(e){
    if(!e||!e.date)return;
    if(e.date<fromK||e.date>toK)return;
    var owner=_tlOwnerId(e);
    var tier=e.tier||'peptide';
    var key=tier+'|'+(e.compound_id||e.compound_name||'?');
    var L=lane(key,{key:key,name:e.compound_name||e.compound_id||'Compound',
      color:(tier==='trt'&&!e.dot)?'#e05050':(e.dot||'var(--accent)'),
      tier:tier,style:_tlLaneStyle(tier),group:_tlGroupOf(tier),unit:e.unit||'',compId:e.compound_id||''});
    L.owners[owner]=true;
    var day=L.days[e.date]||(L.days[e.date]={dose:null,unit:e.unit||'',n:0,logged:0,entries:[]});
    var n=_tlNum(e.dose);
    if(n!==null)day.dose=(day.dose||0)+n;
    if(e.unit)day.unit=e.unit;
    day.n++;
    if(e.logged)day.logged++;
    day.entries.push(e);
  });
  // Supplements come from the regimen + its own taken-log, not /injections.
  if(typeof _supplements!=='undefined'&&_supplements&&_supplements.length&&typeof _suppActiveOn==='function'){
    var nDays=_tlDiff(to,from)+1;
    (_supplements||[]).forEach(function(s){
      if(!s)return;
      var sid=s.supp_id||s.id||'';
      var key='supplement|'+sid;
      var L=null;
      for(var i=0;i<nDays;i++){
        var d=_tlAdd(from,i);
        if(!_suppActiveOn(s,d))continue;
        if(!L){
          L=lane(key,{key:key,name:s.name||sid,color:_tlSuppColor(sid),tier:'supplement',
            style:'dots',group:'supplements',unit:'',compId:sid,supp:s});
          L.owners['_supp']=true;
        }
        var dk=dateKey(d);
        var slots=(typeof _suppSlots==='function')?_suppSlots(s.timing):['AM'];
        var taken=0;
        slots.forEach(function(sl){if(typeof _suppIsTaken==='function'&&_suppIsTaken(sid,dk,sl))taken++;});
        L.days[dk]={dose:null,unit:'',n:slots.length,logged:taken,entries:[],slots:slots,
          doseText:(typeof _suppFmtDose==='function')?_suppFmtDose(sid,s.dose):(s.dose||'')};
      }
    });
  }
  var GROUP_RANK={anabolics:0,peptides:1,supplements:2};
  // Continuous TRT sits at the very top and stays there (spec §5, "Complex
  // Stacks"): it is the constant everything else is read against.
  var TIER_RANK={trt:0,enhanced:1,peptide:2,supplement:3};
  return order.map(function(k){return lanes[k];}).sort(function(a,b){
    if(GROUP_RANK[a.group]!==GROUP_RANK[b.group])return GROUP_RANK[a.group]-GROUP_RANK[b.group];
    if(TIER_RANK[a.tier]!==TIER_RANK[b.tier])return TIER_RANK[a.tier]-TIER_RANK[b.tier];
    return a.name.localeCompare(b.name);
  });
}

// ── window helpers ───────────────────────────────────────────────────────────
// The window is anchored on a whole day plus a FRACTIONAL offset. The fraction is
// what makes the drag continuous: without it the smallest move the view could
// make was a whole day (four pixels at 12W, twenty-five at 2W), so the stack
// stepped instead of following the finger.
function _tlAnchorDate(){
  if(!_tlAnchor)_tlAnchor=_tlAdd(NOW,-Math.floor(_tlWin*0.6));
  return _tlAnchor;
}
// Days rendered either side of the window. The drag translates the already-drawn
// strip, so this is how far a finger can travel before anything has to be
// repainted — half a window, which covers all but the longest flicks in one go.
function _tlBleed(n){return Math.max(2,Math.ceil(n/2));}
// Fold whole days out of the fraction and into the anchor, so _tlOff stays in
// [0,1) and every date index below is an ordinary integer again.
function _tlNormalise(){
  var k=Math.floor(_tlOff);
  if(k){_tlAnchor=_tlAdd(_tlAnchorDate(),k);_tlOff-=k;}
}
// First day actually on screen, for labels and summaries.
function _tlViewFrom(){return _tlAdd(_tlAnchorDate(),Math.round(_tlOff));}
function _tlShift(pages){_tlAnchor=_tlAdd(_tlAnchorDate(),Math.round(pages*_tlWin));_tlLoad();buildTimeline();}
function _tlGoToday(){_tlAnchor=_tlAdd(NOW,-Math.floor(_tlWin*0.6));_tlOff=0;buildTimeline();}
function _tlSetWin(n){
  var mid=_tlAdd(_tlViewFrom(),Math.floor(_tlWin/2));
  _tlWin=n;
  _tlAnchor=_tlAdd(mid,-Math.floor(n/2));
  _tlOff=0;
  _tlLoad();
  buildTimeline();
}
function _tlToggleLane(key){if(_tlOpen[key])delete _tlOpen[key];else _tlOpen[key]=true;_tlPaint()||buildTimeline();}

// ── rendering ────────────────────────────────────────────────────────────────
function _tlPct(i,n){return (i/n*100);}
// Horizontal position of day index i (counted from the anchor), in percent of the
// window. The fractional offset is subtracted here and nowhere else.
function _tlX(i,n){return _tlPct(i-_tlOff,n);}

// The date axis: a tick and a label at each week boundary, plus TODAY. Labelling
// every column is unreadable past a fortnight, and week boundaries are what a
// cycle is actually counted in.
function _tlAxis(from,n){
  var B=_tlBleed(n);
  var h='<div class="tl-axis"><div class="tl-strip">';
  var ti=_tlDiff(NOW,from),hasToday=ti>=-B&&ti<n+B;
  // Every week gets a tick, but at most five get a date on them — twelve weeks of
  // "17 Jul 24 Jul 31 Jul…" printed over each other is worse than no labels.
  var every=Math.max(1,Math.ceil(n/7/5))*7;
  var first=-Math.ceil(B/7)*7;
  for(var i=first;i<n+B;i+=7){
    var d=_tlAdd(from,i);
    // The TODAY flag wins the space it needs: a week label landing under it
    // keeps its tick but drops its text, rather than printing the two on top of
    // each other.
    var show=((i%every)+every)%every===0&&!(hasToday&&Math.abs(i-ti)<=Math.max(2,every/4));
    h+='<div class="tl-axis-tick" style="left:'+_tlX(i,n)+'%">'+(show?'<span>'+_tlEsc(_tlShortDate(d))+'</span>':'')+'</div>';
  }
  if(hasToday)h+='<div class="tl-axis-today" style="left:'+_tlX(ti+0.5,n)+'%">TODAY</div>';
  return h+'</div></div>';
}

// Vertical rules shared by every lane: a hairline at each week boundary and the
// today line, so a mark can be read off against a date without counting columns.
function _tlGrid(from,n){
  var B=_tlBleed(n);
  var h='<div class="tl-grid">';
  var first=-Math.ceil(B/7)*7;
  for(var i=first;i<n+B;i+=7){
    if(i===0)continue;
    h+='<div class="tl-grid-week" style="left:'+_tlX(i,n)+'%"></div>';
  }
  var ti=_tlDiff(NOW,from);
  if(ti>=-B&&ti<n+B)h+='<div class="tl-grid-today" style="left:'+_tlX(ti+0.5,n)+'%"></div>';
  return h+'</div>';
}

// The cycle bands and the milestone diamonds that used to sit here are gone
// (Henrik, 2026-08-30: "the top part showing protocol and weird milestones
// should be removed they just waste space"). They cost three or four rows above
// every lane to restate what the header already says, and the milestone
// diamonds were unlabelled — a row of shapes you could not read. The lanes
// themselves are the content; anything above them pushes the content down.

// One lane's track. Marks are absolutely positioned by day index so blocks and
// dots share the same geometry and stay aligned with the axis at every window
// size; the mark itself is centred in its day column, which is what keeps a
// 12-week view legible when a column is four pixels wide.
function _tlTrack(L,from,n,expanded){
  var B=_tlBleed(n);
  var dotPx=n<=14?11:(n<=28?9:(n<=56?7:5));
  var h='<div class="tl-track'+(expanded?' is-open':'')+'"><div class="tl-strip">'+_tlGrid(from,n);
  if(L.style==='dots'){
    // The continuous line the daily dots sit on (spec §4.3), drawn only across
    // the stretch the compound is actually in the protocol.
    var keys=Object.keys(L.days).sort();
    if(keys.length){
      var a=Math.max(-B,_tlDiff(parseLocalDate(keys[0]),from));
      var b=Math.min(n-1+B,_tlDiff(parseLocalDate(keys[keys.length-1]),from));
      if(b>=a)h+='<div class="tl-baseline" style="left:'+_tlX(a+0.5,n)+'%;width:'+_tlPct(b-a,n)+'%;background:'+L.color+'"></div>';
    }
  }
  Object.keys(L.days).forEach(function(dk){
    var day=L.days[dk];
    var i=_tlDiff(parseLocalDate(dk),from);
    if(i<-B||i>=n+B)return;
    var all=day.n>0&&day.logged>=day.n,some=day.logged>0&&!all;
    var mk=L.key+'@'+dk;
    _tlMarks[mk]={lane:L.key,dk:dk};
    var sty=L.style==='dots'
      ? 'width:'+dotPx+'px;height:'+dotPx+'px;border-radius:50%;'
      : 'width:calc(100% - 2px);min-width:3px;max-width:26px;height:'+(expanded?'64%':'58%')+';border-radius:3px;';
    sty+=all?('background:'+L.color+';border:1px solid '+L.color+';')
           :(some?('background:'+L.color+';opacity:0.55;border:1px solid '+L.color+';')
                 :('background:transparent;border:1.5px solid '+L.color+';'));
    var lbl='';
    if(expanded&&n<=14&&day.dose!==null)lbl='<span class="tl-mark-lbl">'+_tlEsc(_tlFmtNum(day.dose))+'</span>';
    h+='<div class="tl-slot" style="left:'+_tlX(i,n)+'%;width:'+_tlPct(1,n)+'%" onclick="_tlOpenDose(\''+_tlEsc(mk)+'\')">'+
       lbl+'<div class="tl-mark" style="'+sty+'"></div></div>';
  });
  return h+'</div></div>';
}

// Per-week totals for an expanded lane (spec §4.2, "Wk 4: 750mg"). Weeks are
// counted from the owning protocol's start where there is one, so the number
// matches what every other tab calls week 4 — not an arbitrary window offset.
function _tlWeekSummary(L,from,n){
  var base=null;
  var stacks=((typeof _userStacks!=='undefined'&&_userStacks)||[]);
  for(var s=0;s<stacks.length;s++){
    if(stacks[s]&&stacks[s].cycle_start&&L.owners[_tlStackId(stacks[s])]){base=parseLocalDate(stacks[s].cycle_start);break;}
  }
  var out=[];
  for(var i=0;i<n;i+=7){
    var wFrom=_tlAdd(from,i),total=0,doses=0,unit=L.unit;
    for(var k=0;k<7&&i+k<n;k++){
      var day=L.days[dateKey(_tlAdd(from,i+k))];
      if(!day)continue;
      doses+=day.n;
      if(day.dose!==null){total+=day.dose;if(day.unit)unit=day.unit;}
    }
    if(!doses)continue;
    var off=base?_tlDiff(wFrom,base):-1;
    var wkLabel=(base&&off>=0)?('Wk '+(Math.floor(off/7)+1)):_tlShortDate(wFrom);
    var val=total>0?(_tlFmtNum(total)+' '+_tlUnit(unit)):(doses+' dose'+(doses===1?'':'s'));
    out.push('<span class="tl-wk"><b>'+_tlEsc(wkLabel)+'</b> '+_tlEsc(val)+'</span>');
  }
  return out.length?'<div class="tl-wkrow">'+out.join('')+'</div>':'';
}

function _tlLaneHtml(L,from,n){
  var expanded=!!_tlOpen[L.key];
  var B=_tlBleed(n),doses=0,logged=0,total=0,unit=L.unit;
  // The lane summary counts what is ON SCREEN, not what was drawn: the bleed days
  // exist only so the strip has something to slide in, and counting them would
  // make "6/9 taken" disagree with the marks the user can actually see.
  Object.keys(L.days).forEach(function(dk){
    var i=_tlDiff(parseLocalDate(dk),from);
    if(i<0||i>=n)return;
    var day=L.days[dk];
    doses+=day.n;logged+=day.logged;
    if(day.dose!==null){total+=day.dose;if(day.unit)unit=day.unit;}
  });
  var sub=total>0?(_tlFmtNum(total)+' '+_tlUnit(unit)+' · '+logged+'/'+doses+' taken')
                 :(logged+'/'+doses+' taken');
  var owners=Object.keys(L.owners).filter(function(o){return o!=='_supp';})
    .map(function(o){return '<span class="tl-own">'+_tlEsc(_tlOwnerName(o))+'</span>';}).join('');
  return '<div class="tl-lane'+(expanded?' is-open':'')+'">'+
    '<div class="tl-lane-hd" onclick="_tlToggleLane(\''+_tlEsc(L.key)+'\')">'+
      '<span class="tl-lane-dot" style="background:'+L.color+'"></span>'+
      '<span class="tl-lane-name">'+_tlEsc(_tlShortName(L.name))+'</span>'+
      '<span class="tl-lane-sub">'+_tlEsc(sub)+'</span>'+
      '<span class="tl-caret">'+(expanded?'▾':'▸')+'</span>'+
    '</div>'+
    _tlTrack(L,from,n,expanded)+
    (expanded?('<div class="tl-lane-foot">'+_tlWeekSummary(L,_tlViewFrom(),n)+(owners?'<div class="tl-ownrow">'+owners+'</div>':'')+'</div>'):'')+
  '</div>';
}

var _TL_GROUP_TITLES={anabolics:'Anabolics',peptides:'Peptides',supplements:'Supplements'};

// Everything inside the scrolling canvas, repainted on its own. The drag commits
// through here rather than through buildTimeline because a full rebuild replaces
// the #tl-canvas element — and replacing the element the finger is currently on
// tears its listeners out mid-gesture.
function _tlPaint(){
  var el=document.getElementById('tl-canvas');
  if(!el)return false;
  _tlMarks={};
  var from=_tlAnchorDate(),n=_tlWin,B=_tlBleed(n);
  var lanes=_tlBuildLanes(_tlAdd(from,-B),_tlAdd(from,n-1+B));
  var h=_tlAxis(from,n);
  if(!lanes.length){
    h+='<div class="tl-blank">Nothing in this date range.<br>'+
       '<button class="tl-chip" onclick="_tlGoToday()" style="margin-top:10px">Jump to today</button></div>';
  }else{
    var lastGroup='';
    lanes.forEach(function(L){
      if(L.group!==lastGroup){
        lastGroup=L.group;
        h+='<div class="tl-group">'+_tlEsc(_TL_GROUP_TITLES[L.group]||L.group)+'</div>';
      }
      h+=_tlLaneHtml(L,from,n);
    });
  }
  el.innerHTML=h;
  el.style.setProperty('--tlx','0px');
  _tlSyncLabels();
  return true;
}

// Date-range heading, refreshed without a repaint so it can follow the finger.
function _tlSyncLabels(dayDelta){
  var main=document.querySelector('.tl-range-main');
  if(!main)return;
  var f=_tlAdd(_tlAnchorDate(),Math.round(_tlOff-(dayDelta||0))),t=_tlAdd(f,_tlWin-1);
  main.textContent=_tlShortDate(f)+' – '+_tlShortDate(t)+' '+t.getFullYear();
  var sub=document.querySelector('.tl-range-sub');
  if(sub)sub.textContent=_tlHeadSub();
}

function buildTimeline(){
  var body=document.getElementById('timeline-body');
  if(!body)return;
  // init() builds every tab once at startup; fetching the whole history there
  // would cost a wide /injections request on every cold start for a tab nobody
  // has opened. The first load happens when the tab is actually shown (switchTab
  // sets _currentTab before it calls the builder), and the navigator's own
  // arrows/window buttons call _tlLoad directly from then on.
  if(_tlState==='idle'&&(typeof _currentTab==='undefined'||_currentTab==='timeline')){_tlLoad();}
  var from=_tlViewFrom(),n=_tlWin,to=_tlAdd(from,n-1);

  // ── header: date navigator + window sizes ────────────────────────────────
  var rangeLabel=_tlShortDate(from)+' – '+_tlShortDate(to)+' '+to.getFullYear();
  var winBtns=_TL_WINDOWS.map(function(w){
    return '<button class="tl-chip'+(_tlWin===w.d?' is-on':'')+'" onclick="_tlSetWin('+w.d+')">'+w.l+'</button>';
  }).join('');
  var head='<div class="card"><div class="tl-nav">'+
    '<button class="tl-arrow" onclick="_tlShift(-1)" aria-label="Earlier">‹</button>'+
    '<div class="tl-range"><div class="tl-range-main">'+_tlEsc(rangeLabel)+'</div>'+
    '<div class="tl-range-sub">'+_tlEsc(_tlHeadSub())+'</div></div>'+
    '<button class="tl-arrow" onclick="_tlShift(1)" aria-label="Later">›</button></div>'+
    '<div class="tl-chiprow">'+winBtns+'<button class="tl-chip tl-today-btn" onclick="_tlGoToday()">Today</button></div></div>';

  // ── cycle progress + "what this means", carried over from the old tab ──────
  var prog=_tlProgressCard();

  var hasAny=(_tlRows&&_tlRows.length)||((typeof _supplements!=='undefined'&&_supplements)||[]).length;
  if(_tlState!=='ready'&&!hasAny){
    body.innerHTML=head+prog+'<div class="card"><div class="tl-loading">Loading your history…</div></div>';
    return;
  }
  // The big empty state is for having no history at all. A window that merely
  // happens to be empty is handled inside the canvas by _tlPaint, so dragging
  // past the end of your data does not rip the canvas out from under the finger.
  if(!hasAny){
    var hasStk=!!((typeof _userStacks!=='undefined'&&_userStacks)&&_userStacks.length);
    body.innerHTML=head+prog+'<div class="card"><div class="empty" style="padding:44px 20px;text-align:center"><div class="empty-icon">▤</div>'+
      '<div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:6px">No cycles to show yet</div>'+
      '<div style="font-size:13px;color:var(--muted2);line-height:1.6;max-width:280px;margin:0 auto 20px">'+
      (hasStk
        ? 'Set a start date on your protocol in Plan and every dose it schedules will be drawn here.'
        : 'Your cycles, doses and supplements appear here as colour-coded lanes once you start a protocol.')+
      '</div>'+
      '<button onclick="'+(hasStk?'switchPrimary(\'plan\')':'createNewStack()')+'" style="background:var(--accent);color:#000;border:none;border-radius:20px;padding:10px 24px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">'+
      (hasStk?'Go to Plan':'Start a protocol')+'</button>'+
      '</div></div>';
    return;
  }

  body.innerHTML=head+prog+'<div class="card"><div class="tl-canvas" id="tl-canvas" data-noswipe="1"></div>'+
    '<div class="tl-legend"><span><i class="tl-lg-fill"></i>Taken</span><span><i class="tl-lg-open"></i>Planned</span>'+
    '<span><i class="tl-lg-today"></i>Today</span><span>Tap a lane to expand · drag to move in time</span></div></div>';
  _tlPaint();
  _tlWireDrag(document.getElementById('tl-canvas'));
}

// Sub-label under the date range: the active cycle's week, matching Today's
// header wording, or the filter in force.
function _tlHeadSub(){
  var st=((typeof _userStacks!=='undefined'&&_userStacks)||[])[((typeof _activeStackIndices!=='undefined'&&_activeStackIndices)||[])[0]];
  if(st&&st.cycle_start){
    var sd=parseLocalDate(st.cycle_start);
    var wk=Math.floor(_tlDiff(NOW,sd)/7)+1;
    if(st.cycle_length)return (st.name||'Active cycle')+' · Week '+Math.min(st.cycle_length,Math.max(1,wk))+' of '+st.cycle_length;
    return (st.name||'Active cycle')+' · Week '+Math.max(1,wk);
  }
  return 'All protocols';
}

function _tlProgressCard(){
  var stacks=((typeof _userStacks!=='undefined'&&_userStacks)||[]);
  var idx=((typeof _activeStackIndices!=='undefined'&&_activeStackIndices)||[])[0];
  var active=stacks[idx];
  if(!active||!active.cycle_start||!active.cycle_length)return '';
  var sd=parseLocalDate(active.cycle_start);
  var ed=_tlAdd(sd,active.cycle_length*7);
  var raw=_tlDiff(NOW,sd),daysDone=Math.max(0,raw),totalDays=active.cycle_length*7;
  var pct=Math.min(100,Math.round(daysDone/totalDays*100));
  var wk=Math.min(active.cycle_length,Math.floor(daysDone/7)+1);
  return '<div class="card"><div style="padding:14px 16px">'+
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted2);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">'+
    '<span>'+_tlEsc(fmtDate(sd))+'</span><span style="color:var(--accent)">WK '+wk+' / '+active.cycle_length+'</span><span>'+_tlEsc(fmtDate(ed))+'</span></div>'+
    '<div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%;background:var(--accent);"></div></div>'+
    '<div style="font-size:11px;color:var(--muted2);margin-top:6px;text-align:center;">'+pct+'% complete · '+_tlEsc(active.name||'Active Cycle')+'</div>'+
    '<div style="margin-top:10px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px">'+
    '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-bottom:4px">What this means</div>'+
    '<div style="font-size:13px;color:var(--text);line-height:1.5">'+_tlEsc(_tlWhatThisMeans(wk,active.cycle_length,raw,totalDays))+'</div></div></div></div>';
}

// ── drag: the stack follows the finger, one pixel per pixel ──────────────────
// Modelled on the T-Calc chart's pan (_tcAttachPanListeners): touch-action:pan-y
// hands vertical scrolling to the browser, a horizontal move converts pixels
// straight into data units, and the view updates on every move. The first cut
// here instead waited for a 50px threshold and then jumped a whole window, which
// is what made it feel like a stepper rather than a scroll.
//
// The difference from T-Calc is what gets updated. That chart is a canvas and
// simply redraws; this is DOM, and re-serialising a dozen lanes on every
// touchmove would drop frames. So the canvas draws half a window of extra days
// either side (_tlBleed) and the move handler only writes --tlx, a single custom
// property the lane strips translate by. A repaint happens when the finger has
// travelled past that margin, and once more on release.
function _tlWireDrag(el){
  if(!el||el._tlDragWired)return;
  el._tlDragWired=true;
  var x0=null,y0=null,live=false,colPx=1,limitPx=0;
  function begin(t){
    x0=t.clientX;y0=t.clientY;live=false;
    colPx=Math.max(1,(el.clientWidth||320)/_tlWin);
    limitPx=_tlBleed(_tlWin)*colPx;
  }
  function move(e,t){
    if(x0===null)return;
    var dx=t.clientX-x0,dy=t.clientY-(y0||0);
    // Vertical wins ties, exactly as on the T-Calc chart, so an ordinary scroll
    // down the page is never captured as a pan.
    if(!live){ if(Math.abs(dx)<=Math.abs(dy))return; live=true; }
    if(e.preventDefault)e.preventDefault();
    el.style.setProperty('--tlx',dx+'px');
    _tlSyncLabels(dx/colPx);
    if(Math.abs(dx)>limitPx){ _tlCommit(dx/colPx); x0=t.clientX; y0=t.clientY; }
  }
  function end(){
    if(x0===null)return;
    var moved=live;
    x0=null;y0=null;live=false;
    if(!moved)return;
    var cur=parseFloat(el.style.getPropertyValue('--tlx'))||0;
    _tlCommit(cur/colPx);
    _tlDragEndedAt=Date.now();
    _tlLoad();
  }
  el._tlTouchStart=function(e){ if(e.touches&&e.touches.length!==1){x0=null;return;} begin(e.touches?e.touches[0]:e); };
  el._tlTouchMove =function(e){ move(e,e.touches?e.touches[0]:e); };
  el._tlTouchEnd  =function(){ end(); };
  el.addEventListener('touchstart',el._tlTouchStart,{passive:true});
  el.addEventListener('touchmove', el._tlTouchMove, {passive:false});
  el.addEventListener('touchend',  el._tlTouchEnd);
  el.addEventListener('touchcancel',el._tlTouchEnd);
  el.addEventListener('mousedown', function(e){ begin(e); });
  el.addEventListener('mousemove', function(e){ if(e.buttons&1)move(e,e); });
  el.addEventListener('mouseup',   function(){ end(); });
  el.addEventListener('mouseleave',function(){ end(); });
}

// Fold a pixel drag, expressed in days, into the anchor and repaint in place.
function _tlCommit(dayDelta){
  if(!dayDelta)return;
  _tlOff-=dayDelta;
  _tlNormalise();
  _tlPaint();
}

// ── dose sheet ───────────────────────────────────────────────────────────────
function _tlCloseSheet(){var el=document.getElementById('tl-sheet');if(el&&el.parentNode)el.parentNode.removeChild(el);}
function _tlSheet(html){
  _tlCloseSheet();
  var wrap=document.createElement('div');
  wrap.id='tl-sheet';
  wrap.className='tl-sheet';
  wrap.onclick=function(e){if(e.target===wrap)_tlCloseSheet();};
  wrap.innerHTML='<div class="tl-sheet-inner">'+html+'</div>';
  document.body.appendChild(wrap);
}

function _tlFindLane(key,from,n){
  var B=_tlBleed(n);
  var lanes=_tlBuildLanes(_tlAdd(from,-B),_tlAdd(from,n-1+B));
  for(var i=0;i<lanes.length;i++)if(lanes[i].key===key)return lanes[i];
  return null;
}

function _tlOpenDose(markKey){
  // A drag that finishes over a mark still delivers a click on iOS. Without this
  // every pan ended in a dose sheet.
  if(Date.now()-_tlDragEndedAt<350)return;
  var m=_tlMarks[markKey];
  if(!m)return;
  var from=_tlAnchorDate(),n=_tlWin;
  var L=_tlFindLane(m.lane,from,n);
  if(!L)return;
  var day=L.days[m.dk];
  if(!day)return;
  var d=parseLocalDate(m.dk);
  var isFuture=_tlDiff(d,NOW)>0;
  var h='<div class="tl-sheet-hd"><div><div class="tl-sheet-kicker">'+_tlEsc(d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))+'</div>'+
    '<div class="tl-sheet-title"><span class="tl-lane-dot" style="background:'+L.color+'"></span>'+_tlEsc(L.name)+'</div></div>'+
    '<button class="tl-sheet-x" onclick="_tlCloseSheet()">×</button></div>';

  if(L.tier==='supplement'){
    // ⚠️ NO TICK BOX HERE EITHER — the slot buttons that used to sit below these
    // rows were removed with the injection ones (2026-08-30). A supplement is
    // ticked off on Today. The Status row is what the buttons used to convey by
    // reading "Undo AM" rather than "Mark AM as taken"; without it, removing them
    // would have taken the state away along with the control.
    var slots=day.slots||['AM'];
    h+='<div class="tl-sheet-rows">'+(day.doseText?('<div class="tl-row"><span>Dose</span><b>'+_tlEsc(day.doseText)+'</b></div>'):'')+
      '<div class="tl-row"><span>Type</span><b>Supplement</b></div>'+
      (slots.length>1?('<div class="tl-row"><span>Slots</span><b>'+_tlEsc(slots.join(' · '))+'</b></div>'):'')+
      '<div class="tl-row"><span>Status</span><b>'+(day.logged>=day.n?'Taken':(day.logged?day.logged+' of '+day.n+' taken':'Not taken'))+'</b></div></div>';
    h+='<div class="tl-sheet-note">'+
       (isFuture ? 'Scheduled. Tick it off on the day, from Today.'
                 : (day.logged>=day.n ? 'Recorded as taken.'
                    : 'Today is where supplements are ticked off.'))+
       '</div>';
    _tlSheet(h);
    return;
  }

  var e0=day.entries[0]||{};
  h+='<div class="tl-sheet-rows">'+
    (day.dose!==null?('<div class="tl-row"><span>Dose</span><b>'+_tlEsc(_tlFmtNum(day.dose)+' '+_tlUnit(day.unit))+'</b></div>'):'')+
    (day.n>1?('<div class="tl-row"><span>Injections</span><b>'+day.n+' this day</b></div>'):'')+
    (e0.time_of_day?('<div class="tl-row"><span>Time</span><b>'+_tlEsc((typeof _slotLabel==='function')?_slotLabel(e0.time_of_day):e0.time_of_day)+'</b></div>'):'')+
    '<div class="tl-row"><span>Protocol</span><b>'+_tlEsc(_tlOwnerName(_tlOwnerId(e0)))+'</b></div>'+
    '<div class="tl-row"><span>Status</span><b>'+(day.logged>=day.n?'Taken':(day.logged?day.logged+' of '+day.n+' taken':'Planned'))+'</b></div>'+
  '</div>';
  // ⚠️ NO TICK BOX HERE. An injection is ticked off on Today, and nowhere else.
  // This sheet used to carry "Mark as taken" / "Mark as not taken" buttons per
  // dose; Henrik had them removed (2026-08-30). Ticking a dose is a claim about
  // what went into your body, and the timeline is a history viewer showing months
  // at four pixels a day — far too easy to hit the wrong mark, and a mis-tick
  // here propagates straight into the free-T curve. Do not add it back.
  h+='<div class="tl-sheet-note">'+
     (isFuture ? 'Scheduled. Tick it off on the day, from Today.'
               : (day.logged>=day.n ? 'Recorded as taken.'
                  : (day.logged ? 'Partly recorded. Today is where doses are ticked off.'
                                : 'Not recorded as taken. Today is where doses are ticked off.')))+
     '</div>';
  _tlSheet(h);
}
