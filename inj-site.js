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
// Numbering is top down as asked: 1 = deltoid, 2 = hip (ventrogluteal), 3 = quad.
//
// Coordinates are percentages of the image box, measured off the artwork's own
// crosshairs rather than eyeballed, so they hold at any rendered width.
var INJ_SITES=[
  {id:'R1',x:20.9,y:33.4,label:'Right delt'},
  {id:'L1',x:81.0,y:33.3,label:'Left delt'},
  {id:'R2',x:29.6,y:63.9,label:'Right hip'},
  {id:'L2',x:70.0,y:63.8,label:'Left hip'},
  {id:'R3',x:30.0,y:82.4,label:'Right quad'},
  {id:'L3',x:69.8,y:82.5,label:'Left quad'}
];
function _injSiteLabel(id){
  for(var i=0;i<INJ_SITES.length;i++) if(INJ_SITES[i].id===id) return INJ_SITES[i].label;
  return '';
}
function _injSiteValid(id){ return !!id && !!_injSiteLabel(id); }

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
function _closeInjSitePicker(){
  var o=document.getElementById('inj-site-modal');
  if(o&&o.parentNode)o.parentNode.removeChild(o);
  _injSiteEditId=null;
}
// The button on the Today row: the site when there is one, a target glyph when not.
function _injSiteButton(dose){
  if(!_injSiteApplies(dose)) return null;
  var b=document.createElement('button');
  b.className='info-btn inj-site-btn'+(dose.site?' set':'');
  b.textContent=dose.site||'⊕';
  // `title` only, like every other button on a Today row. A setAttribute call here
  // threw straight through buildToday and took the whole list down with it; the row
  // buttons this sits beside have never used one, and one button reaching for a DOM
  // API none of its neighbours touch is how a render dies on a surface that lacks it.
  b.title=dose.site?('Injection site: '+_injSiteLabel(dose.site)):'Record injection site';
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
  var spots=INJ_SITES.map(function(s){
    var sel=row.site===s.id;
    return '<button onclick="setInjSite(\''+s.id+'\')" aria-label="'+_esc(s.id+' — '+s.label)+'"'
      +' style="position:absolute;left:'+s.x+'%;top:'+s.y+'%;transform:translate(-50%,-50%);'
      +'width:52px;height:52px;border-radius:50%;cursor:pointer;padding:0;'
      +'display:flex;align-items:center;justify-content:center;font-family:inherit;'
      +'font-size:13px;font-weight:800;letter-spacing:0.5px;'
      +(sel?'background:rgba(232,255,60,0.9);color:#000;border:3px solid #000;'
           :'background:rgba(0,0,0,0.55);color:#fff;border:2px solid rgba(255,255,255,0.9);')
      +'">'+s.id+'</button>';
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
        +'Tap where you injected. <b>R</b> and <b>L</b> are your own right and left &mdash; '
        +'the figure faces you, so your right side is on the left of the picture.</div>'
      // The artwork is a light pencil drawing; it keeps its own background rather than
      // being filtered into the dark theme, which would turn an anatomical reference
      // into mud. The rounded light panel makes that look deliberate.
      +'<div style="position:relative;border-radius:12px;overflow:hidden;background:#f4f3ef">'
        +'<img src="inject-sites.jpg" alt="Front view of a torso with six injection sites marked"'
        +' style="display:block;width:100%;height:auto">'
        +spots
      +'</div>'
      +'<div id="inj-site-current" style="font-size:12px;color:var(--muted2);text-align:center;margin-top:10px;min-height:16px">'
        +(row.site?('Recorded: <b style="color:var(--accent)">'+_esc(row.site)+'</b> &middot; '+_esc(_injSiteLabel(row.site))):'No site recorded yet')
      +'</div>'
      +(row.site?('<button onclick="setInjSite(null)" style="'+btn+'background:var(--surface2);color:var(--muted2);border:1px solid var(--border)">CLEAR SITE</button>'):'')
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
