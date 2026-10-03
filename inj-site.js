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
var INJ_VIEWS=[{k:'front',label:'Front',img:'inject-sites-v2.webp',
                alt:'Front view of a muscular figure with eight injection sites marked'},
               {k:'back', label:'Back', img:'inject-sites-back.webp',
                alt:'Back view of a muscular figure with the lats and rear glutes marked'}];
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

var _injSiteEditId=null;
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
function openInjSitePicker(id){
  var row=(typeof _findCachedInjection==='function')?_findCachedInjection(id):null;
  if(!row) return;
  _injSiteEditId=id;
  var name=(typeof _tdName==='function')?_tdName(row.compound_name||row.compound_id,row.compound_id)
                                        :(row.compound_name||row.compound_id||'');
  var amount=(row.dose||'')+(row.unit?' '+((typeof UNIT_LABELS!=='undefined'&&UNIT_LABELS[row.unit])||row.unit):'');
  var o=document.createElement('div');
  o.id='inj-site-modal';
  o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9999;'
    +'overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px 16px 40px;';
  o.onclick=function(e){ if(e.target===o) _closeInjSitePicker(); };
  var _view=_injSiteView(row.site);
  var spots=function(view){ return _injSitesFor(view).map(function(s){
    var sel=_injSiteCanon(row.site)===s.id;
    var p=s[view];
    return '<button onclick="setInjSite(\''+s.id+'\')" aria-label="'+_esc(s.label+' — '+s.name)+'"'
      +' style="position:absolute;left:'+p.x+'%;top:'+p.y+'%;transform:translate(-50%,-50%);'
      +'width:52px;height:52px;border-radius:50%;cursor:pointer;padding:0;'
      +'display:flex;align-items:center;justify-content:center;font-family:inherit;'
      +'font-size:13px;font-weight:800;letter-spacing:0.5px;'
      +(sel?'background:rgba(232,255,60,0.9);color:#000;border:3px solid #000;'
           :'background:rgba(0,0,0,0.55);color:#fff;border:2px solid rgba(255,255,255,0.9);')
      +'">'+s.label+'</button>';
  }).join(''); };
  // Both views are rendered up front and one is hidden, so switching is instant and the
  // back image is already decoded by the time it is wanted.
  var panes=INJ_VIEWS.map(function(v){
    return '<div data-injview="'+v.k+'" style="position:relative;border-radius:12px;overflow:hidden;'
      +'background:#f4f3ef;'+(v.k===_view?'':'display:none;')+'">'
      +'<img src="'+v.img+'" alt="'+_esc(v.alt)+'" style="display:block;width:100%;height:auto">'
      +spots(v.k)+'</div>';
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
        +'Tap where you injected. <b>R</b> and <b>L</b> are always your own right and left.'
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
      +'<div id="inj-site-current" style="font-size:12px;color:var(--muted2);text-align:center;margin-top:10px;min-height:16px">'
        +(_injSiteLabel(row.site)?('Recorded: <b style="color:var(--accent)">'+_esc(_injSiteLabel(row.site))+'</b> &middot; '+_esc(_injSiteName(row.site))):'No site recorded yet')
      +'</div>'
      +(_injSiteLabel(row.site)?('<button onclick="setInjSite(null)" style="'+btn+'background:var(--surface2);color:var(--muted2);border:1px solid var(--border)">CLEAR SITE</button>'):'')
      +'<button onclick="_closeInjSitePicker()" style="'+btn+'background:var(--surface2);color:var(--text);border:1px solid var(--border)">CLOSE</button>'
    +'</div></div>';
  document.body.appendChild(o);
}
// Tapping a spot records it and closes — one tap, which is the whole point of the
// button being on the row rather than buried in an editor.
async function setInjSite(site){
  var id=_injSiteEditId;
  if(!id) return;
  if(site!==null&&!_injSiteValid(site)) return;   // only the six the picture has
  _closeInjSitePicker();
  await _setInjectionSite(id,site);
}
