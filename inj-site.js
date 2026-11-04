// ── WHERE THE NEEDLE WENT ────────────────────────────────────────────────────
// Henrik, 2026-10-03: "Add a field for testosterone and other oils injections in
// today where I can note what injection site I used. Add a small button next to
// the injection in Today, this opens up this image and one can click one of the 6
// sites shown. Name them R (right) 1,2,3 (start from the top down) and L 1,2,3."
//
// ⚠️ R AND L ARE HIS SIDES, NOT THE PICTURE'S. The figure faces the viewer, so his
// right deltoid is drawn on the LEFT of the image — the same mirroring every
// anatomical chart has. "I did my right delt" has to store R1, so the hotspots on
// the image's left half are the R column. Every spot carries its label on the
// picture, so the mirroring is visible at the moment of tapping and never has to be
// reasoned about.
//
// Numbering is top down as asked: 1 = deltoid, 2 = glute, 3 = quad.
//
// ⚠️ 2 IS THE GLUTE, AND IT IS THE VENTROGLUTEAL ONE. Henrik asked whether glutes
// could be added as a seventh and eighth site, and whether that needed a new image.
// It would have: the dorsogluteal site people usually mean is on the BACK, and this
// figure faces front, so there is nowhere honest to put a spot for it. But spot 2 is
// already drawn on the outer hip at the level the VENTROgluteal site is taught — the
// gluteus medius, over the greater trochanter — so the site he wanted was on the
// picture all along under the wrong name. Relabelled rather than duplicated
// (2026-10-03). "(ventro)" stays in the label on purpose: if a back view is ever
// added, the dorsogluteal spot is a different injection and the two must not read
// as the same place.
//
// Coordinates are percentages of the image box, measured off the artwork's own
// crosshairs rather than eyeballed, so they hold at any rendered width.
var INJ_SITES=[
  {id:'r_delt',       label:'R1',  name:'Right delt',         front:{x:22.45,y:17.76}},
  {id:'l_delt',       label:'L1',  name:'Left delt',          front:{x:77.00,y:17.70}},
  {id:'r_lat',        label:'R2',  name:'Right lat',          front:{x:34.57,y:34.80}, back:{x:61.26,y:31.64}},
  {id:'l_lat',        label:'L2',  name:'Left lat',           front:{x:64.30,y:34.65}, back:{x:39.10,y:31.77}},
  {id:'r_glute',      label:'R3s', name:'Right glute (side)', front:{x:30.97,y:57.88}},
  {id:'l_glute',      label:'L3s', name:'Left glute (side)',  front:{x:68.05,y:57.87}},
  {id:'r_glute_rear', label:'R3r', name:'Right glute (rear)', back:{x:60.54,y:62.24}},
  {id:'l_glute_rear', label:'L3r', name:'Left glute (rear)',  back:{x:40.00,y:62.24}},
  {id:'r_quad',       label:'R4',  name:'Right quad',         front:{x:32.01,y:80.08}},
  {id:'l_quad',       label:'L4',  name:'Left quad',          front:{x:66.62,y:80.11}}
];
// ⚠️ THE MIRRORING INVERTS ON THE BACK VIEW, AND THAT IS THE EASY THING TO GET WRONG.
// Front view: the figure FACES you, so his right side is drawn on the image's LEFT —
// every front `x` for an r_ site is below 50. Back view: he faces AWAY, so his right
// side is on the image's RIGHT, and every back `x` for an r_ site is above 50. The two
// views mirror each other, and a site that lives on both (the lats) has x values on
// opposite halves. Copy a front coordinate onto a back view and the log silently
// records the wrong side, for every entry, with nothing on screen to show it.
// Tests assert the rule per view.
//
// THE NUMBER IS A LABEL; THE ANATOMY IS THE ID. The first cut stored the position —
// R1/R2/R3. Henrik added lats at 2 the same day ("1. Delts 2. Lats 3. Glute (2 sites
// side and rear) 4. Quads"), which changed what R2 and R3 MEANT: glute→lat, quad→glute.
// A position is not an identity. Inserting a site now renumbers only what is printed —
// which is exactly how the rear glute arrived here without disturbing anything.
//
// The glute is one position with two spots, so both carry the 3: R3s is the side
// (ventrogluteal, on the front view) and R3r the rear (dorsogluteal, on the back). They
// are DIFFERENT injections and must never collapse into one id, or rotating between
// them would look like repeating the same site.
var _INJ_SITE_LEGACY={R1:'r_delt', L1:'l_delt',
                      R2:'r_glute', L2:'l_glute',    // old 2 was the glute
                      R3:'r_quad',  L3:'l_quad'};    // old 3 was the quad
var INJ_VIEWS=[{k:'front',label:'Front',
                alt:'Front view of a figure with eight injection sites marked'},
               {k:'back', label:'Back',
                alt:'Back view of a figure with the lats and rear glutes marked'}];
function _injSitesFor(view){
  return INJ_SITES.filter(function(s){return !!s[view];});
}
function _injSiteCanon(id){
  if(!id)return '';
  var k=String(id);
  if(_INJ_SITE_LEGACY[k])return _INJ_SITE_LEGACY[k];
  for(var i=0;i<INJ_SITES.length;i++) if(INJ_SITES[i].id===k) return k;
  return '';
}
function _injSiteOf(id){
  var c=_injSiteCanon(id);
  for(var i=0;i<INJ_SITES.length;i++) if(INJ_SITES[i].id===c) return INJ_SITES[i];
  return null;
}
// The view a recorded site is easiest to see on — so reopening the picker lands on the
// half of the body the dose actually went into rather than always on the front.
function _injSiteView(id){
  var s=_injSiteOf(id);
  if(!s)return 'front';
  return s.front?'front':'back';
}
function _injSiteLabel(id){ var s=_injSiteOf(id); return s?s.label:''; }
function _injSiteName(id){ var s=_injSiteOf(id); return s?s.name:''; }
function _injSiteValid(id){ return !!_injSiteCanon(id); }

// ⚠️ OILS ONLY, WHICH IS WHAT A VIAL CONCENTRATION ALREADY MEANS. Peptides go
// subcutaneously into the belly and tablets are swallowed; neither has a site to
// rotate, and offering the button on them would be noise on most of the list. The
// trt tier is every testosterone ester, all of them oils. In the enhanced tier the
// test is the one the draw-volume code already uses: a pack of type 'vial' with a
// mg/ml strength is an injectable, a tablet is not.
function _injSiteApplies(dose){
  if(!dose) return false;
  if(dose.tier==='trt') return true;
  if(dose.tier!=='enhanced') return false;
  return (typeof _enhConcMgPerMl==='function') && _enhConcMgPerMl(dose.compound_id)>0;
}


// ── A BODY LIKE THE USER'S ───────────────────────────────────────────────────
// Henrik, 2026-10-13: "put haircrosses in a clear color on images of bodies for the
// injection guide? I have generated three different for male and female with
// different bodyfat % and want the app to show the user a more realistic self image
// when choosing injection site". Six figures per sex view pair, cut from his sheet:
// men at 10/20/35 % and women at 15/20/35 % body fat, each front and back.
//
// The picture follows the sex set in Body and the latest LOGGED body fat, taking the
// closest figure. With no body fat logged it shows the 20 % figure — the middle of
// both sets — rather than guessing one from weight, because choosing a picture is a
// display decision and an estimate here would be a number nobody can check.
//
// Filenames are written out in full, never built from a key: promote-to-prod.yml
// proves every quoted asset name exists before promoting, and a name assembled at
// runtime is invisible to that check.
var INJ_BODIES={
  male:  [{bf:10,key:'m10',front:'inject-body-m10-front.webp',back:'inject-body-m10-back.webp'},
          {bf:20,key:'m20',front:'inject-body-m20-front.webp',back:'inject-body-m20-back.webp'},
          {bf:35,key:'m35',front:'inject-body-m35-front.webp',back:'inject-body-m35-back.webp'}],
  female:[{bf:15,key:'f15',front:'inject-body-f15-front.webp',back:'inject-body-f15-back.webp'},
          {bf:20,key:'f20',front:'inject-body-f20-front.webp',back:'inject-body-f20-back.webp'},
          {bf:35,key:'f35',front:'inject-body-f35-front.webp',back:'inject-body-f35-back.webp'}]
};
var INJ_BODY_DEFAULT_BF=20;
// Where each site sits on each figure, as [x%, y%] of the image box. The bodies differ
// in width — the 35 % figures' delts and hips sit well outside the 10 % ones' — so a
// single table cannot be shared between them. Same mirroring rule as INJ_SITES: on a
// front view an r_ site is on the image's LEFT (x < 50), on a back view on its RIGHT.
var INJ_BODY_SPOTS={
  m10:{front:{r_delt:[22,23],l_delt:[79,23],r_lat:[30,33],l_lat:[70,33],r_glute:[28,50],l_glute:[73,50],r_quad:[30,60],l_quad:[70,60]},
       back:{r_lat:[66,33],l_lat:[34,33],r_glute_rear:[62,49],l_glute_rear:[38,49]}},
  m20:{front:{r_delt:[23,24],l_delt:[79,24],r_lat:[31,34],l_lat:[70,34],r_glute:[27,51],l_glute:[74,51],r_quad:[31,61],l_quad:[70,61]},
       back:{r_lat:[67,33],l_lat:[33,33],r_glute_rear:[63,49],l_glute_rear:[37,49]}},
  m35:{front:{r_delt:[18,24],l_delt:[82,24],r_lat:[26,33],l_lat:[75,33],r_glute:[25,51],l_glute:[76,51],r_quad:[28,62],l_quad:[73,62]},
       back:{r_lat:[70,34],l_lat:[30,34],r_glute_rear:[64,50],l_glute_rear:[36,50]}},
  f15:{front:{r_delt:[21,23],l_delt:[79,23],r_lat:[29,33],l_lat:[71,33],r_glute:[29,50],l_glute:[72,50],r_quad:[30,62],l_quad:[71,62]},
       back:{r_lat:[64,37],l_lat:[36,37],r_glute_rear:[62,49],l_glute_rear:[38,49]}},
  f20:{front:{r_delt:[22,24],l_delt:[78,24],r_lat:[29,34],l_lat:[71,34],r_glute:[28,50],l_glute:[73,50],r_quad:[30,62],l_quad:[71,62]},
       back:{r_lat:[66,37],l_lat:[34,37],r_glute_rear:[64,50],l_glute_rear:[36,50]}},
  f35:{front:{r_delt:[17,24],l_delt:[83,24],r_lat:[27,34],l_lat:[73,34],r_glute:[25,51],l_glute:[76,51],r_quad:[27,63],l_quad:[74,63]},
       back:{r_lat:[68,38],l_lat:[32,38],r_glute_rear:[65,51],l_glute_rear:[35,51]}}
};
function _injBodyFor(sex,bf){
  var list=INJ_BODIES[sex==='female'?'female':'male'];
  var want=(typeof bf==='number'&&isFinite(bf)&&bf>0)?bf:INJ_BODY_DEFAULT_BF;
  var best=list[0];
  list.forEach(function(b){ if(Math.abs(b.bf-want)<Math.abs(best.bf-want)) best=b; });
  return best;
}
// A Settings override that pins one figure (Henrik, 2026-10-14: "a Settings option to pick different BF and
// male/female images"). Staging-only until 2026-11-05, when Henrik said the only thing prod does not need is
// the Push to Prod card.
// 'auto' — or anything not a figure key — leaves the choice to sex and body fat.
var INJ_BODY_OVERRIDE_KEY='inj-body-override';
function _injBodyOverrideFor(k){
  var all=INJ_BODIES.male.concat(INJ_BODIES.female);
  for(var i=0;i<all.length;i++) if(all[i].key===k) return all[i];
  return null;
}
function _injBodyOverride(){
  var k=''; try{ k=localStorage.getItem(INJ_BODY_OVERRIDE_KEY)||''; }catch(e){}
  return _injBodyOverrideFor(k);
}
function setInjBodyOverride(k){
  try{ localStorage.setItem(INJ_BODY_OVERRIDE_KEY,k||'auto'); }catch(e){}
  if(typeof pushPepSettingsToAgent==='function') pushPepSettingsToAgent({'inj-body-override':k||'auto'});
}
function _injBody(){
  var ov=_injBodyOverride(); if(ov) return ov;
  var sex='male';
  try{ sex=String(localStorage.getItem('user_sex')||'male').toLowerCase(); }catch(e){}
  var bf=null;
  try{ if(typeof _latestBodyFat==='function') bf=_latestBodyFat(); }catch(e){}
  return _injBodyFor(sex,bf);
}
// A crosshair, drawn rather than baked into the artwork, so the mark and the tap
// target are the same object and cannot drift apart. Cyan reads on both the pale skin
// and the black shorts; the dark under-stroke keeps it legible on either.
function _injCrosshair(col){
  var seg=function(c,w){ return '<g stroke="'+c+'" stroke-width="'+w+'" fill="none" stroke-linecap="round">'
    +'<circle cx="17" cy="17" r="7"/><line x1="2" y1="17" x2="10" y2="17"/><line x1="24" y1="17" x2="32" y2="17"/>'
    +'<line x1="17" y1="2" x2="17" y2="10"/><line x1="17" y1="24" x2="17" y2="32"/></g>'; };
  return '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">'+seg('#000',5)+seg(col,2.5)+'</svg>';
}

// ── NEEDLE LENGTH FOR THIS BODY ──────────────────────────────────────────────
// Henrik, 2026-10-13: recommend needle lengths, as "some kind of educated guess based
// on length weight … not everyone will have a BF measurement". The numbers and their
// sources live in the backend (GET /injection-needles, doc 21): CDC Table 6-2 for the
// deltoid and thigh, Zaybak 2007 for the glutes (BMI 25+ only), nothing for the lats.
// This only asks for the user's sex, weight and height and prints what comes back —
// including the gaps, which the backend states in words instead of inventing a number.
var INJ_NEEDLE_ROWS=[['deltoid','Delts'],['thigh','Quads'],['ventrogluteal','Glute side'],
                     ['dorsogluteal','Glute rear'],['lat','Lats']];
var _injNeedleCache={};
function _injNeedleQuery(){
  var g=function(k){ try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } };
  var sex=String(g('user_sex')||'male').toLowerCase()==='female'?'female':'male';
  var w=parseFloat(String(g('user_weight')).replace(',','.'))||0;
  var h=parseFloat(String(g('user_height')).replace(',','.'))||0;
  var a=parseFloat(String(g('user_age')).replace(',','.'))||0;
  // Henrik, 2026-10-14: "use BF if it is available not just bmi". The latest logged body
  // fat — the same reading that picks the picture — goes to the backend, which then uses
  // it instead of BMI (Deurenberg 1991) so muscle no longer reads as fat.
  var bf=null; try{ if(typeof _latestBodyFat==='function') bf=_latestBodyFat(); }catch(e){}
  return '?sex='+sex+(w>0?'&weight_kg='+w:'')+(h>0?'&height_cm='+h:'')+(a>0?'&age='+a:'')
    +((typeof bf==='number'&&isFinite(bf)&&bf>0)?'&body_fat='+bf:'');
}
function _injNeedleHtml(d){
  if(!d||!d.muscles) return '';
  return '<div style="font-size:11px;font-weight:700;letter-spacing:0.4px;color:var(--muted2);margin-bottom:4px">'
      // The heading names what the backend actually used: a logged body fat outranks BMI.
      +'NEEDLE FOR IM — ESTIMATE FROM YOUR '
      +((d.inputs&&d.inputs.body_fat)?'BODY FAT, SEX AND AGE':'SEX, WEIGHT AND HEIGHT')+'</div>'
    +INJ_NEEDLE_ROWS.map(function(r){
      var m=d.muscles[r[0]]||{};
      // The backend now answers with a RANGE (long enough for the fat, short enough to
      // stay in the muscle); its basis and note say how it got there, in its own words.
      var sub=[m.basis,m.note].filter(function(x){return !!x;}).join(' · ');
      return '<div style="padding:3px 0">'
        +'<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px">'
        +'<span style="color:var(--muted2)">'+r[1]+'</span>'
        +'<span style="color:'+(m.mm_min!=null?'var(--text)':'var(--muted2)')+';text-align:right">'+_esc(m.label||'—')+'</span></div>'
        +(sub&&m.mm_min!=null?'<div style="font-size:10px;color:var(--muted2);line-height:1.35;margin-top:1px">'+_esc(sub)+'</div>':'')
        +'</div>';
    }).join('');
}
async function _injLoadNeedles(){
  var el=document.getElementById('inj-needle'); if(!el) return;
  var q=_injNeedleQuery();
  try{
    if(!_injNeedleCache[q]){
      var r=await fetch(AGENT_URL+'/injection-needles'+q);
      if(!r.ok){ if(typeof _logHttp==='function')_logHttp('injNeedles',r.status,'/injection-needles'); return; }
      _injNeedleCache[q]=await r.json();
    }
    var cur=document.getElementById('inj-needle');
    if(cur) cur.innerHTML=_injNeedleHtml(_injNeedleCache[q]);
  }catch(e){ if(typeof _logErr==='function')_logErr('injNeedles',e); }
}

var _injSiteEditId=null;
// True when the picker was opened by tapping an unlogged row: picking a site then also
// ticks the dose (see _todayRowTap in tab-today.js).
var _injSiteLogOnPick=false;
// Switching views is pure display — it must never touch what is recorded. The panes
// are already in the DOM, so this only flips visibility and the caption, and the hint
// has to flip with it because the left/right mirroring is opposite on the two views.
function injSiteView(view){
  INJ_VIEWS.forEach(function(v){
    var pane=document.querySelector('[data-injview="'+v.k+'"]');
    if(pane)pane.style.display=(v.k===view)?'':'none';
    var tab=document.querySelector('[data-injtab="'+v.k+'"]');
    if(tab){
      tab.style.background=(v.k===view)?'var(--accent)':'transparent';
      tab.style.color=(v.k===view)?'#000':'var(--muted2)';
    }
  });
  var h=document.getElementById('inj-site-hint');
  if(h)h.textContent=(view==='front')
    ?' The figure faces you, so your right side is on the left of the picture.'
    :' This view is from behind, so your right side is on the right of the picture.';
}
function _closeInjSitePicker(){
  var o=document.getElementById('inj-site-modal');
  if(o&&o.parentNode)o.parentNode.removeChild(o);
  _injSiteEditId=null;
  _injSiteLogOnPick=false;
}
// The button on the Today row: the site when there is one, a target glyph when not.
function _injSiteButton(dose){
  if(!_injSiteApplies(dose)) return null;
  var b=document.createElement('button');
  var _lbl=_injSiteLabel(dose.site);
  b.className='info-btn inj-site-btn'+(_lbl?' set':'');
  b.textContent=_lbl||'⊕';
  // `title` only, like every other button on a Today row. A setAttribute call here
  // threw straight through buildToday and took the whole list down with it; the row
  // buttons this sits beside have never used one, and one button reaching for a DOM
  // API none of its neighbours touch is how a render dies on a surface that lacks it.
  b.title=_lbl?('Injection site: '+_injSiteName(dose.site)):'Record injection site';
  (function(_id){
    b.onclick=function(e){ e.stopPropagation(); openInjSitePicker(_id); };
  }(dose.id));
  return b;
}
function openInjSitePicker(id,opts){
  var row=(typeof _findCachedInjection==='function')?_findCachedInjection(id):null;
  if(!row) return false;
  _injSiteEditId=id;
  var logMode=!!(opts&&opts.logOnPick)&&!row.logged;
  _injSiteLogOnPick=logMode;
  var name=(typeof _tdName==='function')?_tdName(row.compound_name||row.compound_id,row.compound_id)
                                        :(row.compound_name||row.compound_id||'');
  var amount=(row.dose||'')+(row.unit?' '+((typeof UNIT_LABELS!=='undefined'&&UNIT_LABELS[row.unit])||row.unit):'');
  var o=document.createElement('div');
  o.id='inj-site-modal';
  o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9999;'
    +'overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px 16px 40px;';
  o.onclick=function(e){ if(e.target===o) _closeInjSitePicker(); };
  var _view=_injSiteView(row.site);
  var body=_injBody();
  var spots=function(view){ return _injSitesFor(view).map(function(s){
    var p=(INJ_BODY_SPOTS[body.key]&&INJ_BODY_SPOTS[body.key][view]||{})[s.id];
    if(!p) return '';
    var sel=_injSiteCanon(row.site)===s.id;
    return '<button onclick="setInjSite(\''+s.id+'\')" aria-label="'+_esc(s.label+' — '+s.name)+'"'
      +' style="position:absolute;left:'+p[0]+'%;top:'+p[1]+'%;transform:translate(-50%,-50%);'
      +'width:44px;height:44px;border:none;background:transparent;cursor:pointer;padding:0;'
      +'display:flex;align-items:center;justify-content:center;font-family:inherit;">'
      +_injCrosshair(sel?'#e8ff3c':'#00e5ff')
      +'<span style="position:absolute;top:100%;left:50%;transform:translate(-50%,-8px);white-space:nowrap;'
      +'font-size:10px;font-weight:800;letter-spacing:0.3px;padding:1px 5px;border-radius:6px;'
      +(sel?'background:#e8ff3c;color:#000;':'background:rgba(0,0,0,0.72);color:#fff;')
      +'">'+s.label+'</span></button>';
  }).join(''); };
  // Both views are rendered up front and one is hidden, so switching is instant and the
  // back image is already decoded by the time it is wanted.
  var panes=INJ_VIEWS.map(function(v){
    // The figures are tall and narrow, so the image is sized by HEIGHT and the spot
    // layer wraps it exactly (fit-content) — the percentages are of the image box.
    return '<div data-injview="'+v.k+'" style="border-radius:12px;overflow:hidden;'
      +'background:#f4f4f4;'+(v.k===_view?'':'display:none;')+'">'
      +'<div style="position:relative;width:fit-content;margin:0 auto">'
      +'<img src="'+body[v.k]+'" alt="'+_esc(v.alt)+'" style="display:block;height:min(60vh,540px);width:auto">'
      +spots(v.k)+'</div></div>';
  }).join('');
  var tabs=INJ_VIEWS.map(function(v){
    return '<button data-injtab="'+v.k+'" onclick="injSiteView(\''+v.k+'\')" style="flex:1;padding:8px;'
      +'font-size:12px;font-weight:700;border:none;cursor:pointer;font-family:inherit;'
      +(v.k===_view?'background:var(--accent);color:#000;':'background:transparent;color:var(--muted2);')
      +'">'+v.label+'</button>';
  }).join('');
  var btn='display:block;width:100%;padding:12px 14px;border-radius:10px;border:none;font-size:13px;'
    +'font-weight:800;letter-spacing:0.4px;cursor:pointer;margin-top:10px;text-align:center;font-family:inherit;';
  o.innerHTML='<div style="max-width:420px;margin:20px auto 0;background:var(--surface);'
      +'border:1px solid var(--border);border-radius:16px;overflow:hidden">'
    +'<div style="padding:16px 18px;border-bottom:1px solid var(--border)">'
      +'<div style="font-size:16px;font-weight:800;color:var(--text)">Injection site</div>'
      +'<div style="font-size:12px;color:var(--muted2);margin-top:3px">'+_esc(name)
        +(amount?' &middot; '+_esc(amount):'')+' &middot; '+_esc(row.date||'')+'</div>'
    +'</div>'
    +'<div style="padding:14px 16px">'
      +'<div style="font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:10px">'
        +(logMode?'Tap where you injected to log this dose. ':'Tap where you injected. ')+'<b>R</b> and <b>L</b> are always your own right and left.'
        +'<span id="inj-site-hint"> '+(_view==='front'
            ?'The figure faces you, so your right side is on the left of the picture.'
            :'This view is from behind, so your right side is on the right of the picture.')
        +'</span></div>'
      // The artwork is a light pencil drawing; it keeps its own background rather than
      // being filtered into the dark theme, which would turn an anatomical reference
      // into mud. The rounded light panel makes that look deliberate.
      +'<div style="display:flex;border-radius:8px;overflow:hidden;border:1px solid var(--border);margin-bottom:10px">'
        +tabs
      +'</div>'
      +panes
      +'<div id="inj-needle" style="margin-top:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;min-height:16px"></div>'
      +'<div id="inj-site-current" style="font-size:12px;color:var(--muted2);text-align:center;margin-top:10px;min-height:16px">'
        +(_injSiteLabel(row.site)?('Recorded: <b style="color:var(--accent)">'+_esc(_injSiteLabel(row.site))+'</b> &middot; '+_esc(_injSiteName(row.site))):'No site recorded yet')
      +'</div>'
      +((_injSiteLabel(row.site)&&!logMode)?('<button onclick="setInjSite(null)" style="'+btn+'background:var(--surface2);color:var(--muted2);border:1px solid var(--border)">CLEAR SITE</button>'):'')
      +'<button onclick="_closeInjSitePicker()" style="'+btn+'background:var(--surface2);color:var(--text);border:1px solid var(--border)">CLOSE</button>'
    +'</div></div>';
  document.body.appendChild(o);
  _injLoadNeedles();
  return true;
}
// Tapping a spot records it and closes — one tap, which is the whole point of the
// button being on the row rather than buried in an editor.
async function setInjSite(site){
  var id=_injSiteEditId;
  var logIt=_injSiteLogOnPick;
  if(!id) return;
  if(site!==null&&!_injSiteValid(site)) return;   // only the six the picture has
  _closeInjSitePicker();
  await _setInjectionSite(id,site);
  // Log mode: the site tap IS the tick. Sequential, so the two PUTs to the same row
  // never race; the site write redraws optimistically before its await anyway.
  if(logIt&&site!==null){
    var row=(typeof _findCachedInjection==='function')?_findCachedInjection(id):null;
    if(row&&!row.logged&&typeof toggleInjection==='function') await toggleInjection(id,false);
  }
}
