// tools/curve-fingerprint.js — the PK model's output for every testosterone ester.
//
// Written 2026-08-19 to answer "verify curve data before and after this change, make
// sure output for different t esters produces the same results". Run it against two
// checkouts and diff: if a single number moves, the refactor changed the medicine
// rather than the plumbing.
//
//   node tools/curve-fingerprint.js <checkout-dir> > before.json
//   PK_SOURCE=merged node tools/curve-fingerprint.js <checkout-dir> > after.json
//   diff before.json after.json
//
// It needs the real payloads beside it — cat.json (/compounds/catalog) and
// trtcat.json (/trt-catalog) — because fabricated PK numbers would prove nothing.
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = process.argv[2];
const trtCat = JSON.parse(fs.readFileSync(path.join(__dirname, 'trtcat.json'), 'utf8'));
const merged = JSON.parse(fs.readFileSync(path.join(__dirname, 'cat.json'), 'utf8'));

const noop = () => {};
const mkEl = () => ({style:{}, classList:{add:noop,remove:noop,contains:()=>false},
  appendChild:noop, removeChild:noop, insertBefore:noop, addEventListener:noop,
  children:[], querySelectorAll:()=>[], querySelector:()=>mkEl(), offsetWidth:300,
  offsetLeft:0, scrollLeft:0, clientWidth:300, dataset:{}, innerHTML:'', textContent:'',
  value:'', getContext:()=>({scale:noop,beginPath:noop,moveTo:noop,lineTo:noop,arc:noop,
    fill:noop,stroke:noop,fillText:noop,closePath:noop,save:noop,restore:noop,
    fillRect:noop,setLineDash:noop,strokeRect:noop,translate:noop,rotate:noop,
    measureText:()=>({width:0}),createLinearGradient:()=>({addColorStop:noop})})});

const store = {};
const ls = {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,
            setItem:(k,v)=>{store[k]=v;}, removeItem:k=>{delete store[k];}, key:()=>null, length:0};

const sandbox = vm.createContext({
  window:{addEventListener:noop, removeEventListener:noop, devicePixelRatio:1,
          location:{pathname:'/x/', href:'x'}, localStorage:ls, google:undefined},
  localStorage: ls,
  document:{getElementById:()=>null, querySelectorAll:()=>[], querySelector:()=>mkEl(),
            createElement:()=>mkEl(), body:mkEl(), head:mkEl(), createTextNode:()=>mkEl(),
            addEventListener:noop, hidden:false,
            documentElement:{style:{setProperty:noop,getPropertyValue:()=>''}}},
  fetch: async () => ({ok:false, status:0, json:async()=>({})}),
  console:{log:noop, warn:noop, error:noop}, setTimeout:noop, clearTimeout:noop,
  setInterval:noop, clearInterval:noop, requestAnimationFrame:noop, cancelAnimationFrame:noop,
  alert:noop, confirm:()=>false, atob:s=>Buffer.from(s,'base64').toString('binary'),
  Image:function(){}, AbortController:class{constructor(){this.signal={};}abort(){}},
});

const html = fs.readFileSync(path.join(dir,'index.html'),'utf8');
const raw  = html.slice(html.indexOf('<script>')+8, html.indexOf('</script>'));
vm.runInContext(raw.replace(/^const /gm,'var ').replace(/^let /gm,'var '), sandbox);
['inj-writer.js','tab-cycles.js','tab-macros.js','tab-stack.js','tab-today.js','tab-blood.js','tab-tcalc.js']
  .forEach(f => { const p = path.join(dir,f); if (fs.existsSync(p))
    vm.runInContext(fs.readFileSync(p,'utf8').replace(/^const /gm,'var ').replace(/^let /gm,'var '), sandbox); });

const G = sandbox;
// Feed the model exactly what the backend serves, by whichever route the build uses.
const trtRows = Array.isArray(trtCat) ? trtCat : (trtCat.catalog || trtCat.compounds || []);
// PK_SOURCE=merged exercises the new path: the rows the model integrates are pulled out
// of the merged catalogue, through the app's own _tcPkRowsFromMerged.
let pkRows = trtRows;
if (process.env.PK_SOURCE === 'merged') {
  if (typeof G._tcPkRowsFromMerged !== 'function') throw new Error('_tcPkRowsFromMerged missing');
  pkRows = G._tcPkRowsFromMerged(merged);
  if (!pkRows.length) throw new Error('merged catalogue yielded no pk rows');
}
G._tcExtraCatalog = pkRows;
G._COMPOUND_CATALOG = merged.compounds;
G._COMPOUND_ALIASES = merged.aliases || {};
G._tcBwEntries = [];
// With bloodwork the model calibrates, which is the path the drawn curve takes.
G._tcp = Object.assign(G._tcp || {}, {totalT:'17', shbg:'45', measuredFT:'217',
                                      measuredFTDate:'2026-02-01', targetFT:'1000'});
G._tcBwEntries = [{date:'2026-02-01', totalT:'17', shbg:'45', freeT:'217'}];

const esters = trtRows.map(c => c.id);
if (process.env.PK_SOURCE === 'merged') {
  const got = new Set(pkRows.map(r => r.id));
  const missing = esters.filter(id => !got.has(id));
  if (missing.length) throw new Error('merged path is missing esters: ' + missing.join(','));
}
const out = {};
esters.forEach(id => {
  const info = G._tcCompInfo(id);
  // A fixed schedule: 100 mg every 7 days for 12 weeks, so any change in half-life,
  // tmax, bioavailability or ester fraction moves the numbers.
  const log = [];
  for (let w = 0; w < 12; w++) {
    const d = new Date(Date.UTC(2026,0,1) + w*7*86400000);
    log.push({compId:id, doseMg:'100',
              date:d.toISOString().slice(0,10)});
  }
  let series = null;
  try { series = G._tcFreeTSeries(log); } catch (e) { series = {error:String(e && e.message || e)}; }
  const vals = (series && (series.total || series.series || series.values)) || null;
  const arr = vals ? Array.from(vals) : [];
  // The DRAWN curve is the calibrated free-T array, not the raw plasma total. Fingerprint
  // both: a refactor that leaves `total` alone but shifts calibration still moves the line
  // the user reads.
  const cal = (series && series.calFT_arr) ? Array.from(series.calFT_arr) : [];
  const calStat = cal.length ? {
    calN: cal.length, calPeak: Math.max(...cal).toFixed(6),
    calDay30: cal.length > 30 ? cal[30].toFixed(6) : null,
    calLast: cal[cal.length-1].toFixed(6),
    calSum: cal.reduce((a,b)=>a+b,0).toFixed(4),
  } : {calN:0};
  out[id] = {
    halfLifeDays: info.halfLifeDays, halfLifeLow: info.halfLifeDaysLow,
    halfLifeHigh: info.halfLifeDaysHigh, tmaxDays: info.tmaxDays,
    bioavailability: info.bioavailability, tFraction: info.testosteroneFraction,
    n: arr.length,
    peak: arr.length ? Math.max(...arr).toFixed(6) : null,
    day30: arr.length > 30 ? arr[30].toFixed(6) : null,
    day60: arr.length > 60 ? arr[60].toFixed(6) : null,
    last: arr.length ? arr[arr.length-1].toFixed(6) : null,
    sum: arr.length ? arr.reduce((a,b)=>a+b,0).toFixed(4) : null,
    hiLoBand: series && series.hasPkBand ? 'yes' : 'no',
    ...calStat,
    err: series && series.error ? series.error : undefined,
  };
});
console.log(JSON.stringify(out, null, 1));
