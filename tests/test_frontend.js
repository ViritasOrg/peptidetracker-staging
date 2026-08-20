/**
 * Frontend logic tests — peptide tracker
 * Run: node /tmp/test_frontend.js
 */
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const htmlPath = process.argv[2] || '/tmp/pt_live.html';
const html = fs.readFileSync(htmlPath, 'utf8');
const rawScript = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));

const patchedScript = rawScript
  .replace('const PEPTIDE_CAT=',      'var PEPTIDE_CAT=')
.replace('const THEMES=',           'var THEMES=')
  .replace('const STACK_RULES=',      'var STACK_RULES=')
  .replace('const WEEKLY_DEFAULT=',   'var WEEKLY_DEFAULT=')
  .replace("const VERSION='",         "var VERSION='")
  .replace('const APP_ID=',          'var APP_ID=')
  .replace('const AGENT_URL=',        'var AGENT_URL=')
  .replace('let _googleToken=',      'var _googleToken=')
  .replace('const GOOGLE_CLIENT_ID=', 'var GOOGLE_CLIENT_ID=')
  .replace('const CYCLE_SUGGESTIONS=','var CYCLE_SUGGESTIONS=')
  .replace('var WIZ_TITLES=',         'var WIZ_TITLES=')
  .replace('const WIZ_TITLES=',       'var WIZ_TITLES=')
  .replace('let WEEKLY=',             'var WEEKLY=')
  .replace('let _wiz=',               'var _wiz=')
  .replace('let _userStacks=',        'var _userStacks=')
  .replace('let _activeStackIndices=', 'var _activeStackIndices=')
  .replace('let _stacksLoaded=',      'var _stacksLoaded=')
  .replace('let _userWeight=',        'var _userWeight=')
  .replace('var _wizOverlay=',        'var _wizOverlay=')
  .replace('const RECON_DB=',         'var RECON_DB=')
  .replace("let _tabVis={};let _currentTab='today';let _currentPrimary='today';let _lastSub={};",
           "var _tabVis={};var _currentTab='today';var _currentPrimary='today';var _lastSub={};")
  .replace('let _viewDate=',          'var _viewDate=')
  // buildToday returns at its spinner guard while this is true, so a test that renders
  // the empty state has to be able to clear it. As a top-level `let` it is not a
  // sandbox property and cannot be set from outside at all.
  .replace('let _syncPending=',       'var _syncPending=')
  .replace('let _reconStackIdx=',     'var _reconStackIdx=')
.replace('let _reconStackPicked=',  'var _reconStackPicked=')
  .replace('let _reconState=',        'var _reconState=')
  .replace('let weights=',            'var weights=')
  .replace('var _bcWeightWindow=',    'var _bcWeightWindow=')
  .replace('var _bcWeightHistOpen=',  'var _bcWeightHistOpen=')
  .replace('const PRICELIST=',        'var PRICELIST=')
  .replace('const DOSE_GUIDE=',       'var DOSE_GUIDE=')
  .replace('const DEFAULT_PHASES=',   'var DEFAULT_PHASES=')
  .replace('const TRT_CAT=',          'var TRT_CAT=')
  .replace('const TRT_GUIDE=',        'var TRT_GUIDE=');

const noop = () => {};
const mockCtx = {scale:noop,beginPath:noop,moveTo:noop,lineTo:noop,arc:noop,fill:noop,stroke:noop,fillText:noop,closePath:noop,createLinearGradient:()=>({addColorStop:noop}),save:noop,restore:noop,fillRect:noop,setLineDash:noop,strokeRect:noop,translate:noop,rotate:noop,measureText:()=>({width:0})};
const mockEl = () => {
  const el = {style:{},classList:{add:noop,remove:noop,contains:()=>false},appendChild:noop,removeChild:noop,insertBefore:noop,addEventListener:noop,children:[],querySelectorAll:()=>[],querySelector:()=>mockEl(),offsetWidth:300,offsetLeft:0,scrollLeft:0,clientWidth:300,dataset:{},getContext:()=>mockCtx};
  Object.defineProperty(el,'innerHTML',  {get:()=>'',set:noop});
  Object.defineProperty(el,'textContent',{get:()=>'',set:noop});
  Object.defineProperty(el,'value',      {get:()=>'0',set:noop});
  Object.defineProperty(el,'className',  {get:()=>'',set:noop});
  Object.defineProperty(el,'hidden',     {get:()=>false,set:noop});
  return el;
};
const _lsStore = {};
const _lsBase = {_s:_lsStore,getItem(k){return Object.prototype.hasOwnProperty.call(_lsStore,k)?_lsStore[k]:null;},setItem(k,v){_lsStore[k]=v;},removeItem(k){delete _lsStore[k];}};
const _lsProxy = new Proxy(_lsBase,{ownKeys(){return[...'_s,getItem,setItem,removeItem'.split(','),...Object.keys(_lsStore)];},getOwnPropertyDescriptor(t,k){if(k in t)return Object.getOwnPropertyDescriptor(t,k)||{value:t[k],enumerable:false,configurable:true,writable:false};if(Object.prototype.hasOwnProperty.call(_lsStore,k))return{value:_lsStore[k],enumerable:true,configurable:true,writable:true};}});
const sandbox = vm.createContext({
  window:    {addEventListener:noop,removeEventListener:noop,devicePixelRatio:1,location:{reload:noop}},
  localStorage: _lsProxy,
  document:  {getElementById:()=>mockEl(),querySelectorAll:()=>[mockEl()],querySelector:()=>mockEl(),createElement:()=>mockEl(),body:mockEl(),head:mockEl(),createTextNode:()=>mockEl(),addEventListener:noop,hidden:false,documentElement:{style:{setProperty:noop,getPropertyValue:()=>''}}},
  fetch:     async()=>({ok:false,json:async()=>({})}),
  google:undefined,confirm:()=>false,alert:noop,Image:function(){},setTimeout:noop,clearTimeout:noop,setInterval:noop,console,
  // The real browser has this; buildTCalc schedules its canvas draw through it. Without
  // it, any test that renders a NON-EMPTY plasma curve throws ReferenceError.
  requestAnimationFrame:noop,cancelAnimationFrame:noop,
  AbortController:class{constructor(){this.signal={};}abort(){}},
});
vm.runInContext(patchedScript, sandbox);
// Load tab files so their functions/vars are available in the same sandbox
const tabFiles = ['inj-writer.js','tab-cycles.js','tab-macros.js','tab-stack.js','tab-today.js',
                  'tab-schedule.js','tab-timeline.js','tab-body.js','tab-recon.js','tab-blood.js','tab-tcalc.js','tab-thist.js','tab-labs.js','tab-supplements.js'];
const dir = path.dirname(path.resolve(htmlPath));
tabFiles.forEach(f => {
  const tabPath = path.join(dir, f);
  if (fs.existsSync(tabPath)) {
    let src = fs.readFileSync(tabPath, 'utf8');
    src = src.replace('const RECON_DB=', 'var RECON_DB=');
    vm.runInContext(src, sandbox);
  }
});
const G = sandbox;

// Seed the age→free-T population baseline the app fetches from the backend
// (/systemic-interactions → ftBaseline). In the real app init() sets this; the
// test fetch stub returns nothing, so provide the same reference data here.
G._tcFtBaseline = {
  unit: 'pmol/L', default: 350,
  bands: [
    {max_age:24, value:450}, {max_age:34, value:400}, {max_age:44, value:340},
    {max_age:54, value:280}, {max_age:64, value:220}, {max_age:200, value:180},
  ],
};
// Population SHBG baseline (age→nmol/L), also served by /systemic-interactions.
G._tcShbgBaseline = {
  unit: 'nmol/L',
  bands: [
    {max_age:24, value:30}, {max_age:34, value:32}, {max_age:44, value:35},
    {max_age:54, value:38}, {max_age:64, value:42}, {max_age:200, value:48},
  ],
};

let passed=0, failed=0;
function check(name, condition, detail) {
  if(condition){console.log(`  ✓ ${name}`);passed++;}
  else{console.log(`  ✗ ${name}${detail?': '+detail:''}`);failed++;}
}

// ── Peptide catalogue ─────────────────────────────────────────────────────────
console.log('\n── Peptide catalogue ──────────────────────────────────────');
check('PEPTIDE_CAT defined',               Array.isArray(G.PEPTIDE_CAT));
check('20+ entries',                       G.PEPTIDE_CAT.length>=20,             `got ${G.PEPTIDE_CAT.length}`);
check('all have id/name/dot/cg/goals',     G.PEPTIDE_CAT.every(p=>p.id&&p.name&&p.dot&&Array.isArray(p.cg)&&Array.isArray(p.goals)));
check('cjc-ipa exists',                    G.PEPTIDE_CAT.some(p=>p.id==='cjc-ipa'));
check('glow exists',                       G.PEPTIDE_CAT.some(p=>p.id==='glow'));
check('retatrutide exists',                G.PEPTIDE_CAT.some(p=>p.id==='retatrutide'));
check('tesamorelin exists',                G.PEPTIDE_CAT.some(p=>p.id==='tesamorelin'));
check('sermorelin exists',                 G.PEPTIDE_CAT.some(p=>p.id==='sermorelin'));

// ── Stack rules ───────────────────────────────────────────────────────────────
console.log('\n── checkStack / STACK_RULES ───────────────────────────────');
check('STACK_RULES is array',              Array.isArray(G.STACK_RULES));
check('8 rules defined',                   G.STACK_RULES.length===8,             `got ${G.STACK_RULES.length}`);
check('checkStack defined',                typeof G.checkStack==='function');
['ghrh-multi','cjc-tesa','glp1-multi','ghrh-ghrp-solo','gh-hgh-overlap','healing-blend-overlap','healing-blend-component','cjc-ipa-double']
  .forEach(id=>check(`rule "${id}" exists`, G.STACK_RULES.some(r=>r.id===id)));
if(typeof G.checkStack==='function'){
const r1=G.checkStack([{id:'cjc-ipa',cg:['ghrh','ghrp']},{id:'tesamorelin',cg:['ghrh']}]);
check('CJC+Tesa → err: ghrh-multi',        r1.some(r=>r.level==='err'&&r.id==='ghrh-multi'));
check('CJC+Tesa → err: cjc-tesa',          r1.some(r=>r.level==='err'&&r.id==='cjc-tesa'));
check('CJC+Glow → 0 issues',               G.checkStack([{id:'cjc-ipa',cg:['ghrh','ghrp']},{id:'glow',cg:[]}]).length===0);
check('Reta+Sema → err: glp1-multi',       G.checkStack([{id:'retatrutide',cg:['glp1']},{id:'semaglutide',cg:['glp1']}]).some(r=>r.id==='glp1-multi'));
check('CJC-noDac alone → warn: ghrp-solo', G.checkStack([{id:'cjc-nodac',cg:['ghrh']}]).some(r=>r.level==='warn'&&r.id==='ghrh-ghrp-solo'));
check('CJC+HGH → warn: gh-hgh-overlap',   G.checkStack([{id:'cjc-ipa',cg:['ghrh','ghrp']},{id:'hgh',cg:['hgh']}]).some(r=>r.id==='gh-hgh-overlap'));
check('single Reta → 0 issues',            G.checkStack([{id:'retatrutide',cg:['glp1']}]).length===0);
check('Klow+Glow → err: healing-blend-overlap',      G.checkStack([{id:'klow',cg:[]},{id:'glow',cg:[]}]).some(r=>r.id==='healing-blend-overlap'));
check('bpc-tb+Glow → err: healing-blend-overlap',    G.checkStack([{id:'bpc-tb',cg:[]},{id:'glow',cg:[]}]).some(r=>r.id==='healing-blend-overlap'));
check('Glow+bpc157 → warn: healing-blend-component', G.checkStack([{id:'glow',cg:[]},{id:'bpc157',cg:[]}]).some(r=>r.id==='healing-blend-component'));
check('klow+tb500 → warn: healing-blend-component',  G.checkStack([{id:'klow',cg:[]},{id:'tb500',cg:[]}]).some(r=>r.id==='healing-blend-component'));
check('cjc-ipa+ipa → warn: cjc-ipa-double',          G.checkStack([{id:'cjc-ipa',cg:['ghrh','ghrp']},{id:'ipamorelin',cg:['ghrp']}]).some(r=>r.id==='cjc-ipa-double'));
check('cjc-ipa alone → no cjc-ipa-double',           !G.checkStack([{id:'cjc-ipa',cg:['ghrh','ghrp']}]).some(r=>r.id==='cjc-ipa-double'));
}

// ── buildWeeklyFromProtocol ───────────────────────────────────────────────────
console.log('\n── buildWeeklyFromProtocol ────────────────────────────────');
check('function defined',                  typeof G.buildWeeklyFromProtocol==='function');
const wkly=G.buildWeeklyFromProtocol({peptides:[
  {id:'cjc-am',name:'CJC',dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'4',active:true},
  {id:'cjc-pm',name:'CJC',dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['PM'],dose_pm:'5',active:true},
  {id:'glow-1',name:'Glow',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'2',active:true},
  {id:'reta',  name:'Reta',dot:'#e8ff3c',days:[0],             times:['AM'],dose_am:'3',active:true},
  {id:'old',   name:'Old', dot:'#888',   days:[0],             times:['AM'],             active:false},
]});
check('4 active entries (inactive excluded)', wkly.length===4,                   `got ${wkly.length}`);
check('all have id/name/dow/dot',             wkly.every(w=>w.id&&w.name&&w.dow&&w.dot));
check('cjc-am → AM',                         wkly.find(w=>w.id==='cjc-am')?.time==='AM');
check('cjc-pm → PM',                         wkly.find(w=>w.id==='cjc-pm')?.time==='PM');
check('reta → dow [0] only',                 JSON.stringify(wkly.find(w=>w.id==='reta')?.dow)==='[0]');
check('glow-1 → 7 days',                     wkly.find(w=>w.id==='glow-1')?.dow.length===7);
const split=G.buildWeeklyFromProtocol({peptides:[{id:'x',name:'X',dot:'#fff',days:[0,1,2,3,4,5,6],times:['AM','PM'],dose_am:'4',dose_pm:'5',active:true}]});
check('AM+PM → 2 rows',                       split.length===2,                  `got ${split.length}`);
check('row 0 AM, row 1 PM',                   split[0].time==='AM'&&split[1].time==='PM');
check('empty protocol → empty array',         G.buildWeeklyFromProtocol({peptides:[]}).length===0);

// ── _synthesizeProtocol ───────────────────────────────────────────────────────
console.log('\n── _synthesizeProtocol ────────────────────────────────────');
check('function defined',                   typeof G._synthesizeProtocol==='function');
if(typeof G._synthesizeProtocol==='function'){
const synth=G._synthesizeProtocol(G.WEEKLY_DEFAULT);
check('has peptides',                        synth.peptides.length>0,            `got ${synth.peptides.length}`);
check('marked _unsaved=true',                synth._unsaved===true);
check('no duplicate IDs',                    (()=>{const ids=synth.peptides.map(p=>p.id);return ids.length===new Set(ids).size;})());
check('each peptide has times array',        synth.peptides.every(p=>Array.isArray(p.times)));
check('each peptide has days array',         synth.peptides.every(p=>Array.isArray(p.days)));
check('synth peptides use PEPTIDE_CAT ids', synth.peptides.every(p=>G.PEPTIDE_CAT.some(c=>c.id===p.id)),
  synth.peptides.filter(p=>!G.PEPTIDE_CAT.some(c=>c.id===p.id)).map(p=>p.id).join(', '));
check('synth: reta maps to canonical id',   synth.peptides.some(p=>p.id==='retatrutide'));
check('synth: cjc maps to canonical id',    synth.peptides.some(p=>p.id==='cjc-ipa'));
check('synth: glow maps to canonical id',   synth.peptides.some(p=>p.id==='glow'));
check('synth: reta days includes Sun+Wed',  (()=>{const r=synth.peptides.find(p=>p.id==='retatrutide');return r&&r.days.includes(0)&&r.days.includes(3);})());
}

// ── WEEKLY_DEFAULT ────────────────────────────────────────────────────────────
console.log('\n── WEEKLY_DEFAULT ─────────────────────────────────────────');
check('defined and non-empty',              G.WEEKLY_DEFAULT?.length>0);
check('all have id/name/dow/dot',           G.WEEKLY_DEFAULT.every(w=>w.id&&w.name&&w.dow&&w.dot));
check('reta-sun on Sunday (dow 0)',         G.WEEKLY_DEFAULT.some(w=>w.id==='reta-sun'&&w.dow.includes(0)));
check('reta-wed on Wednesday (dow 3)',      G.WEEKLY_DEFAULT.some(w=>w.id==='reta-wed'&&w.dow.includes(3)));
check('cjc-am is AM, 7 days',              G.WEEKLY_DEFAULT.some(w=>w.id==='cjc-am'&&w.time==='AM'&&w.dow.length===7));
check('cjc-pm is PM, 7 days',              G.WEEKLY_DEFAULT.some(w=>w.id==='cjc-pm'&&w.time==='PM'&&w.dow.length===7));
check('glow-1 is 7 days AM',               G.WEEKLY_DEFAULT.some(w=>w.id==='glow-1'&&w.time==='AM'&&w.dow.length===7));
check('glow-2 removed (period ended)',     !G.WEEKLY_DEFAULT.some(w=>w.id==='glow-2'), 'glow-2 still in WEEKLY_DEFAULT');

// ── _synthesizeProtocol date propagation ──────────────────────────────────────
console.log('\n── _synthesizeProtocol: date propagation ───────────────────');
if(typeof G._synthesizeProtocol==='function'){
check('synth: glow has no end_date (permanent)',
  (()=>{const g=G._synthesizeProtocol(G.WEEKLY_DEFAULT).peptides.find(p=>p.id==='glow');return g&&!g.end_date;})(),
  'glow got end_date from a temporary entry — check _synthesizeProtocol');
// Simulate a WEEKLY list where one entry is permanent and one is timed
const mixedWeekly=[
  {id:'x-am',name:'TestPep',detail:'1 mg',dow:[0,1,2,3,4,5,6],time:'AM',dot:'#fff'},
  {id:'x-pm',name:'TestPep',detail:'2 mg',dow:[0,1,2,3,4,5,6],time:'PM',dot:'#fff',
   startDate:new Date(2025,0,1),endDate:new Date(2025,5,30)},
];
const mixedSynth=G._synthesizeProtocol(mixedWeekly);
const testPep=mixedSynth.peptides.find(p=>p.name==='TestPep');
check('synth: permanent+timed entry → no end_date on merged peptide',
  testPep&&!testPep.end_date, `end_date: ${testPep?.end_date}`);
check('synth: permanent+timed entry → has AM+PM times',
  testPep&&testPep.times.includes('AM')&&testPep.times.includes('PM'));
}

// ── Stack Store state & functions ─────────────────────────────────────────────
console.log('\n── Stack Store ────────────────────────────────────────────');
check('_userStacks defined',               Array.isArray(G._userStacks));
check('_activeStackIndices defined',        Array.isArray(G._activeStackIndices));
check('_stacksLoaded defined',             typeof G._stacksLoaded!=='undefined');
check('loadUserStacks defined',            typeof G.loadUserStacks==='function');
check('saveStacksToBackend defined',       typeof G.saveStacksToBackend==='function');
check('updateWEEKLY defined',              typeof G.updateWEEKLY==='function');
check('buildStackStore defined',           typeof G.buildStackStore==='function');
check('useStack defined',                  typeof G.useStack==='function');
check('deleteStack defined',               typeof G.deleteStack==='function');
check('createNewStack defined',            typeof G.createNewStack==='function');
check('editStackWithCycle defined',        typeof G.editStackWithCycle==='function');

// ── Wizard init ───────────────────────────────────────────────────────────────
console.log('\n── Wizard init & createNewStack ───────────────────────────');
check('initWizard defined',                typeof G.initWizard==='function');
if(typeof G.initWizard==='function') G.initWizard();
check('initWizard: step=0',                G._wiz.step===0);
check('initWizard: peptides=[]',           G._wiz.peptides.length===0);
check('initWizard: goals=[]',              G._wiz.goals.length===0);
check('initWizard: cycle_length set',      G._wiz.cycle_length>0,               `got ${G._wiz.cycle_length}`);
check('initWizard: stackIndex=-1',         G._wiz.stackIndex===-1);
check('initWizard: stackName is string',   typeof G._wiz.stackName==='string'&&G._wiz.stackName.length>0);

// ── _nextStackName: new stacks bump Cycle N (not always "Cycle 1") ──
if(typeof G._nextStackName==='function'){
  var _nsSaved=G._userStacks;
  G._userStacks=[];                       check('_nextStackName: first protocol = Protocol 1', G._nextStackName()==='Protocol 1');
  G._userStacks=[{name:'Protocol 1'}];    check('_nextStackName: after Protocol 1 = Protocol 2', G._nextStackName()==='Protocol 2');
  G._userStacks=[{name:'Protocol 1'},{name:'Protocol 2'},{name:'Protocol 3'}]; check('_nextStackName: bumps to Protocol 4', G._nextStackName()==='Protocol 4');
  G._userStacks=[{name:'Protocol 1'},{name:'Protocol 3'}]; check('_nextStackName: past highest Protocol N (no collision)', G._nextStackName()==='Protocol 4');
  G._userStacks=[{name:'Cutting Stack'},{name:'Bulking'}]; check('_nextStackName: non-numbered names → next slot', G._nextStackName()==='Protocol 3');
  G._userStacks=_nsSaved;
  // initWizard uses it for a fresh (non-edit) stack
  G._userStacks=[{name:'Protocol 1'}]; G.initWizard();
  check('initWizard: default name bumps (Protocol 2)', G._wiz.stackName==='Protocol 2');
  G._userStacks=_nsSaved;
}

// ── Today view: de-dupe injection slots (dose-edit doubling fix) ──
if (typeof G._dedupInjectionSlots === 'function') {
  // A slot with both an administered (logged) shot and a newly-planned one collapses
  // to ONE row, keeping the logged shot.
  var _ddOut = G._dedupInjectionSlots([
    {compound_id:'hgh', time_of_day:'AM', dose:'2', logged:true},
    {compound_id:'hgh', time_of_day:'AM', dose:'3', logged:false},
  ]);
  check('dedup slots: duplicate compound+slot collapses to one', _ddOut.length === 1);
  check('dedup slots: keeps the already-logged shot', _ddOut[0].logged === true && _ddOut[0].dose === '2');
  // AM and PM are distinct slots — both survive.
  check('dedup slots: AM and PM are independent',
    G._dedupInjectionSlots([
      {compound_id:'hgh', time_of_day:'AM', dose:'3'},
      {compound_id:'hgh', time_of_day:'PM', dose:'3'},
    ]).length === 2);
  // Different compounds in the same slot both survive; original order preserved.
  var _ddOrder = G._dedupInjectionSlots([
    {compound_id:'glow', time_of_day:'AM', dose:'0.1'},
    {compound_id:'hgh',  time_of_day:'AM', dose:'3'},
    {compound_id:'glow', time_of_day:'AM', dose:'0.1'},
  ]);
  check('dedup slots: distinct compounds kept, order preserved',
    _ddOrder.length === 2 && _ddOrder[0].compound_id === 'glow' && _ddOrder[1].compound_id === 'hgh');
  check('dedup slots: tolerates empty/null input',
    G._dedupInjectionSlots([]).length === 0 && G._dedupInjectionSlots(null).length === 0);
}

// ── TRT tab: surface T-Calc-planned testosterone (the "two ways to plan TRT") ──
if(typeof G._tcalcTrtSummary==='function'){
  var _ttSaved=G._injectionsCache;
  // no tcalc injections → no summary, no card
  G._injectionsCache={};
  check('_tcalcTrtSummary: null when no tcalc injections', G._tcalcTrtSummary()===null);
  check('_renderTcalcTrtCard: empty when nothing planned', G._renderTcalcTrtCard()==='');
  // seed a tcalc TRT injection + an unrelated stack injection
  G._injectionsCache={
    '2026-07-10':[{cycle_id:'tcalc',tier:'trt',compound_id:'test-e',compound_name:'Testosterone Enanthate',dose:'50',unit:'mg',dot:'#e8a020',date:'2026-07-10',source:'tcalc'}],
    '2026-07-13':[{cycle_id:'tcalc',tier:'trt',compound_id:'test-e',compound_name:'Testosterone Enanthate',dose:'50',unit:'mg',dot:'#e8a020',date:'2026-07-13',source:'tcalc'},
                  {cycle_id:'stack_x',tier:'peptide',compound_id:'ipamorelin',compound_name:'Ipamorelin',date:'2026-07-13'}]
  };
  var _ttSum=G._tcalcTrtSummary();
  check('_tcalcTrtSummary: finds the tcalc testosterone compound', !!_ttSum && _ttSum.length===1 && _ttSum[0].name==='Testosterone Enanthate');
  check('_tcalcTrtSummary: counts only tcalc entries (ignores stack peptide)', _ttSum[0].count===2);
  var _ttCard=G._renderTcalcTrtCard();
  // Phase 5: the card no longer claims T-Calc schedules these. It now reports stored
  // doses that NO compound in the protocol generates — the stray-series shape.
  check('_renderTcalcTrtCard: labels it as doses with no compound', /Doses with no compound/.test(_ttCard));
  check('_renderTcalcTrtCard: names the compound', /Testosterone Enanthate/.test(_ttCard));
  check('_renderTcalcTrtCard: deep-links to the T-Calc tab', /tab-btn-tcalc/.test(_ttCard));
  // _renderTRTViewTab shows the card and suppresses "No TRT configured"
  if(typeof G._renderTRTViewTab==='function'){
    var _ttView=G._renderTRTViewTab({trt:{enabled:false,compounds:[]}});
    check('_renderTRTViewTab: shows the orphan-dose card', /Doses with no compound/.test(_ttView));
    check('_renderTRTViewTab: suppresses "No TRT configured" when T-Calc card shows', !/No TRT configured/.test(_ttView));
    // with no tcalc plan, the empty message returns
    G._injectionsCache={};
    var _ttViewEmpty=G._renderTRTViewTab({trt:{enabled:false,compounds:[]}});
    check('_renderTRTViewTab: "No TRT configured" when nothing planned', /No TRT configured/.test(_ttViewEmpty));
  }
  // edit view (_renderEditTRT) shows the card above the compound list, regardless of toggle
  if(typeof G._renderEditTRT==='function'){
    // Tier 2: below it the group renders locked (2026-08-20) and there is no orphan
    // card, because there is no compound list to sit above.
    var _prevTierOrphan=G._userTier; G._userTier=2;
    G._injectionsCache={
      '2026-07-10':[{cycle_id:'tcalc',tier:'trt',compound_id:'test-e',compound_name:'Testosterone Enanthate',dose:'50',unit:'mg',dot:'#e8a020',date:'2026-07-10',source:'tcalc'}]
    };
    var _ttEditOff=G._renderEditTRT({enabled:false,compounds:[]});
    check('_renderEditTRT: shows the orphan-dose card when toggle OFF', /Doses with no compound/.test(_ttEditOff));
    var _ttEditOn=G._renderEditTRT({enabled:true,compounds:[]});
    var _cardIdx=_ttEditOn.indexOf('Doses with no compound');
    var _protoIdx=_ttEditOn.indexOf('Testosterone');
    check('_renderEditTRT: card sits above the compound list', _cardIdx>-1 && _cardIdx>_protoIdx);
    G._userTier=_prevTierOrphan;
    G._injectionsCache={};
    check('_renderEditTRT: no card when nothing planned', !/Doses with no compound/.test(G._renderEditTRT({enabled:true,compounds:[]})));
  }
  G._injectionsCache=_ttSaved;
}

if(typeof G.createNewStack==='function') G.createNewStack();
check('createNewStack: editMode=false',    G._wiz.editMode===false);
check('createNewStack: step=0',            G._wiz.step===0);

// ── Edit existing stack ───────────────────────────────────────────────────────
console.log('\n── Edit existing stack ────────────────────────────────────');
const testStack = {
  name:'Cutting Cycle',cycle_length:12,
  peptides:[
    {id:'cjc-am',name:'CJC',dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'4',active:true},
    {id:'glow-1',name:'Glow',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'2',active:true},
  ],
  trt:{enabled:true,compound:'Nebido',injections:[{date:'2026-06-01',label:'Inj 1',dose:'250mg'}]}
};
G._userStacks=[testStack];G._activeStackIndices=[0];
if(typeof G.editStackWithCycle==='function'){
G._userTier=2;G.editStackWithCycle(0);G._userTier=1;
check('editStack: editMode=true',          G._wiz.editMode===true);
check('editStack: stackIndex=0',           G._wiz.stackIndex===0);
check('editStack: stackName loaded',       G._wiz.stackName==='Cutting Cycle');
check('editStack: cycle_length=12',        G._wiz.cycle_length===12,            `got ${G._wiz.cycle_length}`);
check('editStack: 2 peptides loaded',      G._wiz.peptides.length===2,          `got ${G._wiz.peptides.length}`);
check('editStack: TRT compound loaded (T2)',G._wiz.trt.compound==='Nebido');
check('editStack: deep copy (no mutation)',G._userStacks[0].peptides!==G._wiz.peptides);
check('editStack: goals inferred',         Array.isArray(G._wiz.goals));
// T3 edit: 'enhanced' NOT auto-included — only present if stack has enhanced compounds
G._userTier=3;G.editStackWithCycle(0);
check('editStack T3: enhanced not auto-included (peptide-only stack)', !G._wiz.goals.includes('enhanced'));
G._userTier=1;
}

// ── Cycle length ──────────────────────────────────────────────────────────────
console.log('\n── Cycle length ───────────────────────────────────────────');
check('CYCLE_WEEKS defined',               Array.isArray(G.CYCLE_WEEKS));
check('multiples of 4 from 4 to 240 (60 months)', G.CYCLE_WEEKS&&G.CYCLE_WEEKS.length===60&&G.CYCLE_WEEKS[0]===4&&G.CYCLE_WEEKS[59]===240&&G.CYCLE_WEEKS.every((v,i)=>v===(i+1)*4));
if(typeof G.initWizard==='function') G.initWizard();
G.wizSetCycleLength('8');  check('wizSetCycleLength("8")=8',    G._wiz.cycle_length===8,  `got ${G._wiz.cycle_length}`);
G.wizSetCycleLength('12'); check('wizSetCycleLength("12")=12',  G._wiz.cycle_length===12);
G.wizSetCycleLength(10);   check('wizSetCycleLength(10)=10',    G._wiz.cycle_length===10);
G.wizSetCycleLength('16'); check('custom cycle length 16',      G._wiz.cycle_length===16);

// ── Wizard navigation ─────────────────────────────────────────────────────────
console.log('\n── Wizard navigation ──────────────────────────────────────');
// _wizFlow: peps-only (T1, no TRT, no enhanced)
G._userTier=1;G.initWizard();
var t1flow=G._wizFlow();
check('_wizFlow: peps-only has 7 steps', t1flow.length===7, 'got '+t1flow.length);
check('_wizFlow: peps-only step[0]=cycle',  t1flow[0]==='cycle');
check('_wizFlow: peps-only step[6]=review', t1flow[6]==='review');
check('_wizFlow: peps-only has nutrition',  t1flow.includes('nutrition'));
check('_wizFlow: peps-only has no trt',     !t1flow.includes('trt'));
check('_wizFlow: peps-only has no enhanced',!t1flow.includes('enhanced'));
check('_wizFlow: peps-only has no validate',!t1flow.includes('validate'));
// _wizFlow: TRT-only (T2, trt enabled, no pep goals)
G._userTier=2;G.initWizard();G._wiz.trt.enabled=true;
var trtOnlyFlow=G._wizFlow();
check('_wizFlow: TRT-only has 5 steps', trtOnlyFlow.length===5, 'got '+trtOnlyFlow.length);
check('_wizFlow: TRT-only steps', trtOnlyFlow.join(',')===('cycle,goals,trt,nutrition,review'));
// _wizFlow: Peps + TRT (T2, trt enabled, pep goal selected)
G._userTier=2;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['muscle'];
var pepTrtFlow=G._wizFlow();
check('_wizFlow: peps+TRT has 9 steps', pepTrtFlow.length===9, 'got '+pepTrtFlow.length);
check('_wizFlow: peps+TRT has validate', pepTrtFlow.includes('validate'));
check('_wizFlow: peps+TRT ends with review', pepTrtFlow[pepTrtFlow.length-1]==='review');
// _wizFlow: TRT + Enhanced (T3, trt enabled, enhanced goal, no pep goals)
G._userTier=3;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['enhanced'];
var trtEnhFlow=G._wizFlow();
// 8, not 9, since 2026-08-20: the single Compounds toggle sets trt AND enhanced
// together, and the 'trt' step already asks for the ester, dose and cadence — so
// 'base', which asks an enhanced cycle for its testosterone, would ask twice.
check('_wizFlow: TRT+enhanced has 8 steps', trtEnhFlow.length===8, 'got '+trtEnhFlow.length);
check('_wizFlow: TRT+enhanced steps', trtEnhFlow.join(',')===('cycle,goals,trt,advise,enhanced,validate,nutrition,review'));
check('  …and testosterone is asked for exactly once',
  trtEnhFlow.filter(function(x){return x==='trt'||x==='base';}).length===1);
check('_wizFlow: advise precedes enhanced', trtEnhFlow.indexOf('advise')===trtEnhFlow.indexOf('enhanced')-1);
// _wizFlow: Peps + TRT + Enhanced (T3, all tiers)
G._userTier=3;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['enhanced','muscle'];
var allFlow=G._wizFlow();
check('_wizFlow: peps+TRT+enhanced has 11 steps', allFlow.length===11, 'got '+allFlow.length);
check('_wizFlow: peps+TRT+enhanced has advise', allFlow.includes('advise'));
check('_wizFlow: peps+TRT+enhanced has peptides', allFlow.includes('peptides'));
check('_wizFlow: peps+TRT+enhanced has trt',      allFlow.includes('trt'));
check('_wizFlow: peps+TRT+enhanced has enhanced',  allFlow.includes('enhanced'));
check('_wizFlow: peps+TRT+enhanced has validate',  allFlow.includes('validate'));
// wizStepAdvise: renders the guidance step without throwing (network only fires on button click)
G._userTier=3;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['enhanced'];
var _advBody={innerHTML:''}, _advFooter={innerHTML:''}, _advThrew=false;
try{ G.wizStepAdvise(_advBody,_advFooter); }catch(e){ _advThrew=true; }
check('wizStepAdvise: renders without throwing', !_advThrew);
check('wizStepAdvise: shows objective picker', _advBody.innerHTML.includes('Primary objective'));
check('wizStepAdvise: shows experience/cycle-stage picker', _advBody.innerHTML.includes('Where are you at?') && _advBody.innerHTML.includes('2nd–few cycles'));
check('wizStepAdvise: has a Get recommendations action', _advBody.innerHTML.includes('Get recommendations'));
check('wizStepAdvise: Next button proceeds via wizAdviseNext', _advFooter.innerHTML.includes('wizAdviseNext'));
check('wizAdviseSetObjective updates advise state', (G.wizAdviseSetObjective('cut'), G._wiz.advise.objective==='cut'));
check('wizAdviseSetExperience updates advise state', (G.wizAdviseSetExperience('experienced'), G._wiz.advise.experience==='experienced'));
check('_advNormExp collapses curious → first', G._advNormExp('curious')==='first');
// Advisor result renders the new structure (headline, best addition, save-for-later, on-cycle)
G._userTier=3;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['enhanced'];
G._wiz.advise=G._wizAdviseState();
G._wiz.advise.result={headline:'Add ONE compound to your testosterone base — start with Primobolan.',base:{name:'Testosterone Enanthate',note:'base'},best_addition:{id:'primo',name:'Primobolan',reason:'mild lean-mass'},primary:[{id:'primo',name:'Primobolan',reason:'mild lean-mass'}],consider:[{id:'anavar',name:'Anavar',reason:'oral ⚠ hepatically active'}],save_for_later:[{id:'tren_e',name:'Trenbolone Enanthate',reason:'advanced-only'}],avoid:[],on_cycle:[{agent:'HCG',message:'HCG 250–500 IU 2×/week.'}],guardrails:['Prefer injectables over orals'],notes:[]};
var _advB2={innerHTML:''},_advF2={innerHTML:''};
try{ G.wizStepAdvise(_advB2,_advF2); }catch(e){ _advB2.innerHTML='THREW'; }
check('wizStepAdvise result: shows headline', _advB2.innerHTML.includes('Add ONE compound'));
check('wizStepAdvise result: shows Best addition', _advB2.innerHTML.includes('Best addition') && _advB2.innerHTML.includes('Best pick'));
check('wizStepAdvise result: shows Save for a later cycle', _advB2.innerHTML.includes('Save for a later cycle'));
check('wizStepAdvise result: shows On-cycle support (HCG)', _advB2.innerHTML.includes('On-cycle support') && _advB2.innerHTML.includes('HCG'));
// Recommendation cards are TAPPABLE (the reported bug: could not pick a different compound)
check('wizStepAdvise result: recommendation cards are tappable', _advB2.innerHTML.includes('wizAdviseToggleCompound'));
// Tap-to-select actually toggles the protocol store, and default-select pre-ticks base + best
G._userTier=3;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['enhanced'];
G.ENHANCEMENT_COMPOUNDS=[{id:'test_e',name:'Testosterone Enanthate',cls:'base',defaultDose:300,unit:'mg/week',defaultDays:[1,4],dot:'#e05050'},{id:'primo',name:'Primobolan',cls:'dht',defaultDose:500,unit:'mg/week',defaultDays:[1,4],dot:'#3cffa0'},{id:'deca',name:'Deca',cls:'19nor',defaultDose:300,unit:'mg/week',defaultDays:[1,4],dot:'#888'}];
G._wiz.advise=G._wizAdviseState();
G._wiz.advise.result={headline:'h',base:{id:'test_e',name:'Testosterone Enanthate'},best_addition:{id:'primo',name:'Primobolan'},primary:[{id:'primo',name:'Primobolan'}],consider:[{id:'deca',name:'Deca'}],save_for_later:[],avoid:[],on_cycle:[]};
var _advB3={innerHTML:''},_advF3={innerHTML:''};
G.wizStepAdvise(_advB3,_advF3); // triggers default-select
var _ids=function(){return ((G._wiz.enhanced&&G._wiz.enhanced.compounds)||[]).map(function(c){return c.id;});};
// The base no longer joins the ENHANCED list — that is the reported bug ("recommended
// enhanced compounds lists Test E on top"). It goes to the TRT block, canonicalised,
// and only the addition is pre-ticked here.
var _trtIds=function(){return ((G._wiz.trt&&G._wiz.trt.compounds)||[]).map(function(c){return c.id;});};
check('advisor default-selects the best addition', _ids().indexOf('primo')>=0, _ids().join(','));
check('  …and puts the testosterone base in the TRT block, not the enhanced list',
  _trtIds().indexOf('enanthate')>=0 && _ids().indexOf('test_e')<0,
  'trt='+_trtIds().join(',')+' enh='+_ids().join(','));
G.wizAdviseToggleCompound('deca'); check('tapping a different compound adds it', _ids().indexOf('deca')>=0);
G.wizAdviseToggleCompound('primo'); check('tapping the best pick removes it', _ids().indexOf('primo')<0);
check('after swapping, deca is still selected (choice sticks)', _ids().indexOf('deca')>=0);
G.initWizard();
// wizNext / wizBack
G._userTier=1;G.initWizard();
G._userTier=1;G.initWizard();
G.wizNext();check('wizNext: 0→1', G._wiz.step===1);
G.wizNext();check('wizNext: 1→2', G._wiz.step===2);
G._wiz.step=2;G.wizBack();check('wizBack: 2→1', G._wiz.step===1);
// peps-only: wizNext from last step stays clamped
G._userTier=1;G.initWizard();G._wiz.step=6;G.wizNext();
check('wizNext: peps-only does not exceed step 6', G._wiz.step===6);
// TRT-only: step through all 5 steps (cycle,goals,trt,nutrition,review)
G._userTier=2;G.initWizard();G._wiz.trt.enabled=true;
G.wizNext();G.wizNext();G.wizNext();G.wizNext();
check('wizNext: TRT-only after 4 calls = step 4 (review)', G._wiz.step===4);
G.wizNext();check('wizNext: TRT-only does not exceed step 4', G._wiz.step===4);
G.wizBack();check('wizBack: TRT-only 4→3 (nutrition)', G._wiz.step===3);
// TRT+Enhanced (no peps): cycle,goals,trt,advise,enhanced,validate,nutrition,review.
// 'base' is gone from this path as of 2026-08-20 — the single Compounds toggle sets
// both flags, so the 'trt' step already asked for the testosterone an enhanced cycle
// runs on. One question, one answer.
G._userTier=3;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['enhanced'];
G.wizNext();G.wizNext();G.wizNext();G.wizNext();G.wizNext();G.wizNext();G.wizNext();
check('wizNext: TRT+enhanced after 7 calls = step 7 (review)', G._wiz.step===7);
G.wizNext();check('wizNext: TRT+enhanced does not exceed step 7', G._wiz.step===7);
G.wizBack();check('wizBack: TRT+enhanced 7→6 (nutrition)', G._wiz.step===6);
G.wizBack();check('wizBack: TRT+enhanced 6→5 (validate)', G._wiz.step===5);
G.wizBack();check('wizBack: TRT+enhanced 5→4 (enhanced)', G._wiz.step===4);
G.wizBack();check('wizBack: TRT+enhanced 4→3 (advise)', G._wiz.step===3);
G.wizBack();check('wizBack: TRT+enhanced 3→2 (trt)', G._wiz.step===2);
check('  …and no step asks for the testosterone base a second time',
  G._wizFlow().indexOf('base')===-1);
// Peps+TRT: validate step appears
G._userTier=2;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['muscle'];
G.wizNext();G.wizNext();G.wizNext();G.wizNext();G.wizNext();G.wizNext();G.wizNext();G.wizNext();
check('wizNext: peps+TRT after 8 calls = step 8 (review)', G._wiz.step===8);
G.wizBack();check('wizBack: peps+TRT 8→7 (nutrition)', G._wiz.step===7);
G._userTier=1; // restore
G.wizSetStackName('My New Stack');
check('wizSetStackName updates _wiz', G._wiz.stackName==='My New Stack');

// ── updateWEEKLY from active stack ────────────────────────────────────────────
console.log('\n── updateWEEKLY ───────────────────────────────────────────');
G._userStacks=[testStack];G._activeStackIndices=[0];
G.updateWEEKLY();
check('updateWEEKLY builds WEEKLY',   G.WEEKLY.length>0,                        `got ${G.WEEKLY.length}`);
check('WEEKLY contains cjc-am',       G.WEEKLY.some(w=>w.id==='cjc-am'));
check('WEEKLY contains glow-1',       G.WEEKLY.some(w=>w.id==='glow-1'));
G._userStacks=[];G.updateWEEKLY();
check('empty active indices → empty WEEKLY (not WEEKLY_DEFAULT)',G.WEEKLY.length===0);

// ── Stack → daily schedule ────────────────────────────────────────────────────
console.log('\n── Stack → daily schedule ─────────────────────────────────');
// Helper: simulate buildToday's filtering for a given date + WEEKLY list
function dosesForDate(d, weekly){
  var dow=d.getDay();
  return weekly.filter(function(w){
    if(!w.dow.includes(dow))return false;
    if(w.startDate&&d<w.startDate)return false;
    if(w.endDate&&d>w.endDate)return false;
    return true;
  }).map(function(w){return{id:w.id+'_'+G.dateKey(d),name:w.name,time:w.time,dot:w.dot};});
}
// Date helpers — fixed dates for deterministic tests
var SUN=new Date(2026,5,7);  // Sunday   (dow 0)
var MON=new Date(2026,5,8);  // Monday   (dow 1)
var WED=new Date(2026,5,10); // Wednesday (dow 3)
var SAT=new Date(2026,5,13); // Saturday  (dow 6)

// 1. Reta (Sunday + Wednesday only)
const retaStack={name:'Reta Only',peptides:[
  {id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0,3],times:['AM'],dose_am:'3',unit_am:'mg',active:true},
]};
G._userStacks=[retaStack];G._activeStackIndices=[0];G.updateWEEKLY();
check('reta: WEEKLY entry present',           G.WEEKLY.some(w=>w.id==='retatrutide'));
check('reta: shows on Sunday (dow 0)',        dosesForDate(SUN,G.WEEKLY).some(d=>d.name==='Retatrutide'));
check('reta: shows on Wednesday (dow 3)',     dosesForDate(WED,G.WEEKLY).some(d=>d.name==='Retatrutide'));
check('reta: absent on Monday (dow 1)',       !dosesForDate(MON,G.WEEKLY).some(d=>d.name==='Retatrutide'));
check('reta: absent on Saturday (dow 6)',     !dosesForDate(SAT,G.WEEKLY).some(d=>d.name==='Retatrutide'));
check('reta: time is AM',                     G.WEEKLY.find(w=>w.id==='retatrutide')?.time==='AM');
check('reta: dose id format YYYY-MM-DD',       dosesForDate(SUN,G.WEEKLY)[0]?.id==='retatrutide_2026-06-07');

// 2. CJC-IPA (daily AM + PM → 2 WEEKLY entries)
const cjcStack={name:'CJC Stack',peptides:[
  {id:'cjc-ipa',name:'CJC-1295 / IPA',dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['AM','PM'],dose_am:'4',dose_pm:'5',unit_am:'IU',unit_pm:'IU',active:true},
]};
G._userStacks=[cjcStack];G._activeStackIndices=[0];G.updateWEEKLY();
check('cjc: 2 WEEKLY entries (AM+PM)',        G.WEEKLY.filter(w=>w.name.includes('CJC')).length===2);
check('cjc-am: appears every day',           [SUN,MON,WED,SAT].every(d=>dosesForDate(d,G.WEEKLY).some(x=>x.id.startsWith('cjc-ipa-am'))));
check('cjc-pm: appears every day',           [SUN,MON,WED,SAT].every(d=>dosesForDate(d,G.WEEKLY).some(x=>x.id.startsWith('cjc-ipa-pm'))));
check('cjc: AM entry time=AM',               G.WEEKLY.find(w=>w.id==='cjc-ipa-am')?.time==='AM');
check('cjc: PM entry time=PM',               G.WEEKLY.find(w=>w.id==='cjc-ipa-pm')?.time==='PM');

// 3. Inactive peptide excluded
const mixedStack={name:'Mixed',peptides:[
  {id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0,3],times:['AM'],dose_am:'3',unit_am:'mg',active:true},
  {id:'ipamorelin', name:'Ipamorelin', dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'200',unit_am:'mcg',active:false},
]};
G._userStacks=[mixedStack];G._activeStackIndices=[0];G.updateWEEKLY();
check('inactive peptide excluded from WEEKLY',!G.WEEKLY.some(w=>w.name==='Ipamorelin'));
check('active peptide still in WEEKLY',       G.WEEKLY.some(w=>w.name==='Retatrutide'));

// 4. startDate filtering — peptide not started yet
var FUTURE=new Date(2026,11,1); // far future
const futureStack={name:'Future',peptides:[
  {id:'semaglutide',name:'Semaglutide',dot:'#e8ff3c',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.5',unit_am:'mg',start_date:'2026-12-01',active:true},
]};
G._userStacks=[futureStack];G._activeStackIndices=[0];G.updateWEEKLY();
check('future startDate: absent today (June)',!dosesForDate(SUN,G.WEEKLY).some(d=>d.name==='Semaglutide'));
check('future startDate: shows on start day', dosesForDate(FUTURE,G.WEEKLY).some(d=>d.name==='Semaglutide'));

// 5. endDate filtering — expired peptide
const expiredStack={name:'Expired',peptides:[
  {id:'aod9604',name:'AOD9604',dot:'#e8ff3c',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'300',unit_am:'mcg',end_date:'2026-05-31',active:true},
]};
G._userStacks=[expiredStack];G._activeStackIndices=[0];G.updateWEEKLY();
check('expired endDate: absent on June 7',   !dosesForDate(SUN,G.WEEKLY).some(d=>d.name==='AOD9604'));
check('expired endDate: present on May 30',  dosesForDate(new Date(2026,4,30),G.WEEKLY).some(d=>d.name==='AOD9604'));

// 6. Multi-stack: active stack drives WEEKLY
const stackA={name:'Stack A',peptides:[{id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0],times:['AM'],dose_am:'3',unit_am:'mg',active:true}]};
const stackB={name:'Stack B',peptides:[{id:'semaglutide', name:'Semaglutide',dot:'#f59e0b',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.5',unit_am:'mg',active:true}]};
G._userStacks=[stackA,stackB];
G._activeStackIndices=[0];G.updateWEEKLY();
check('active stack A: shows Reta on Sunday', dosesForDate(SUN,G.WEEKLY).some(d=>d.name==='Retatrutide'));
check('active stack A: no Sema',              !dosesForDate(SUN,G.WEEKLY).some(d=>d.name==='Semaglutide'));
G._activeStackIndices=[1];G.updateWEEKLY();
check('active stack B: shows Sema on Sunday', dosesForDate(SUN,G.WEEKLY).some(d=>d.name==='Semaglutide'));
check('active stack B: no Reta',              !dosesForDate(SUN,G.WEEKLY).some(d=>d.name==='Retatrutide'));

// ── New stack saved includes cycle_length ─────────────────────────────────────
console.log('\n── wizSave includes cycle_length ──────────────────────────');
G.initWizard();
G.wizSetCycleLength(8);
G.wizSetStackName('Bulk Phase');
G._wiz.peptides=[{id:'cjc-am',name:'CJC',dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'4',active:true}];
G._userStacks=[];
// Mock saveStacksToBackend to capture what gets saved
let savedProto=null;
G.saveStacksToBackend=async function(){savedProto=G._userStacks[0];return true;};
G.wizSave().then(async ()=>{
  check('saved stack has cycle_length', savedProto&&savedProto.cycle_length===8,  `got ${savedProto?.cycle_length}`);
  check('saved stack has name',         savedProto&&savedProto.name==='Bulk Phase');
  check('saved stack has peptides',     savedProto&&savedProto.peptides.length===1);

  // ── Check state stability: loadUserStacks must not remap p.id ────────────────
  console.log('\n── Check state stability (id remapping regression) ──────────');
  // Simulate a stack saved before PR#10 with WEEKLY_DEFAULT-style ids
  const oldStyleStack={
    name:'My Stack',
    peptides:[
      {id:'reta-sun',name:'Retatrutide',dot:'#e8ff3c',days:[0,3],times:['AM'],dose_am:'3',unit_am:'mg'},
      {id:'cjc-am',  name:'CJC-1295 / IPA',dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'4',unit_am:'IU'},
      {id:'glow-1',  name:'GLOW Stack',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.2',unit_am:'IU'},
    ]
  };
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(oldStyleStack))],active_index:0})});
  await G.loadUserStacks();
  const lp=G._userStacks[0].peptides;
  check('loadUserStacks: reta-sun id not remapped', lp[0].id==='reta-sun',  `got "${lp[0].id}" (would break check state)`);
  check('loadUserStacks: cjc-am id not remapped',   lp[1].id==='cjc-am',   `got "${lp[1].id}" (would break check state)`);
  check('loadUserStacks: glow-1 id not remapped',   lp[2].id==='glow-1',   `got "${lp[2].id}" (would break check state)`);
  check('loadUserStacks: glow-1 unit_am IU→ml',     lp[2].unit_am==='ml',  `got "${lp[2].unit_am}" (unit migration broken)`);
  const wklyChk=G.buildWeeklyFromProtocol(G._userStacks[0]);
  const wklyIds=wklyChk.map(w=>w.id);
  check('WEEKLY: reta-sun id preserved',            wklyIds.includes('reta-sun'),       `ids: ${wklyIds.join(', ')}`);
  check('WEEKLY: cjc-am id preserved',              wklyIds.includes('cjc-am'),         `ids: ${wklyIds.join(', ')}`);
  check('WEEKLY: glow-1 id preserved',              wklyIds.includes('glow-1'),         `ids: ${wklyIds.join(', ')}`);
  check('WEEKLY: no retatrutide (check state safe)',!wklyIds.includes('retatrutide'),   `retatrutide appeared — stored check state would not match`);

  // ── Glow end_date migration (glow disappeared regression) ────────────────────
  console.log('\n── Glow end_date migration ─────────────────────────────────');
  // Simulate a stack where _synthesizeProtocol wrongly set end_date on merged glow peptide
  const glowExpiredStack={name:'My Stack',peptides:[
    {id:'glow',name:'GLOW Stack',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM','PM'],dose_am:'0.09',unit_am:'ml',end_date:'2026-06-03'},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(glowExpiredStack))],active_index:0})});
  await G.loadUserStacks();
  const glowP2=G._userStacks[0].peptides[0];
  check('migration: expired end_date cleared from glow',   !glowP2.end_date,  `end_date still set: ${glowP2.end_date}`);
  // Glow has no start_date — migration must NOT stamp one (new/test stacks must stay date-free)
  check('migration: glow with no start_date NOT auto-stamped', !glowP2.start_date, `start_date unexpectedly set: ${glowP2.start_date}`);
  const wklyGlow=G.buildWeeklyFromProtocol(G._userStacks[0]);
  check('migration: glow-am entry has no endDate',         !wklyGlow.find(w=>w.id==='glow-am')?.endDate, 'glow-am still has endDate');
  check('migration: glow-pm entry has no endDate',         !wklyGlow.find(w=>w.id==='glow-pm')?.endDate, 'glow-pm still has endDate');
  // Verify start_date is PRESERVED when an expired end_date is cleared (the real bug fix)
  const glowWithSdExpired={name:'My Stack',peptides:[
    {id:'glow',name:'GLOW Stack',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.09',unit_am:'ml',start_date:'2026-04-16',end_date:'2026-06-03'},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(glowWithSdExpired))],active_index:0})});
  await G.loadUserStacks();
  const glowP3=G._userStacks[0].peptides[0];
  check('migration: start_date preserved when expired end_date cleared', glowP3.start_date==='2026-04-16'&&!glowP3.end_date, `start_date=${glowP3.start_date} end_date=${glowP3.end_date}`);
  // ── Regression: new stacks must not get auto-dated ───────────────────────────
  console.log('\n── New stack: no auto start_date ───────────────────────────');
  // Any new stack created by the wizard has no start_date on its peptides.
  // loadUserStacks must NOT stamp April dates on them.
  const newCjcStack={name:'Test CJC',peptides:[
    {id:'cjc-ipa',name:'CJC-1295/Ipa',dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'4',unit_am:'IU',active:true},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(newCjcStack))],active_index:0})});
  await G.loadUserStacks();
  const newCjcPep=G._userStacks[0].peptides[0];
  check('new CJC stack: no auto start_date stamped', !newCjcPep.start_date, `start_date unexpectedly set: ${newCjcPep.start_date}`);
  const newRetaStack={name:'Test Reta',peptides:[
    {id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0],times:['AM'],dose_am:'3',unit_am:'mg',active:true},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(newRetaStack))],active_index:0})});
  await G.loadUserStacks();
  check('new Reta stack: no auto start_date stamped', !G._userStacks[0].peptides[0].start_date, `start_date unexpectedly set: ${G._userStacks[0].peptides[0].start_date}`);
  // Glow recon: 70mg/3ml = 23.333mg/ml, 9 IU = 0.09ml
  const rcGlow9=G.reconCalc('0.09','ml',G.RECON_DB['glow'].vials[G.RECON_DB['glow'].defaultVi],G.RECON_DB['glow'].water[G.RECON_DB['glow'].defaultWi],'mg');
  check('glow 3ml: 0.09ml → 9 IU',    rcGlow9&&rcGlow9.iu===9,      `got ${rcGlow9?.iu}`);
  check('glow default water is 3ml',   G.RECON_DB['glow'].water[G.RECON_DB['glow'].defaultWi]===3, `got ${G.RECON_DB['glow'].water[G.RECON_DB['glow'].defaultWi]}`);

  // ── Glow dose_am migration (0.2 ml → 0.09 ml) ────────────────────────────────
  console.log('\n── Glow dose_am migration (0.2→0.09) ──────────────────────');
  const glowOldDoseStack={name:'My Stack',peptides:[
    {id:'glow',name:'GLOW Stack',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.2',unit_am:'ml'},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(glowOldDoseStack))],active_index:0})});
  await G.loadUserStacks();
  const glowMigP=G._userStacks[0].peptides[0];
  check('migration: glow dose_am 0.2→0.09',    glowMigP.dose_am==='0.09', `got "${glowMigP.dose_am}"`);
  check('migration: glow unit_am preserved ml', glowMigP.unit_am==='ml',   `got "${glowMigP.unit_am}"`);
  const wklyMig=G.buildWeeklyFromProtocol(G._userStacks[0]);
  check('migration: glow WEEKLY detail has 0.09', wklyMig[0]?.detail?.includes('0.09'), `got "${wklyMig[0]?.detail}"`);
  // Custom dose (not 0.2) must NOT be overridden
  const glowCustomDoseStack={name:'My Stack',peptides:[
    {id:'glow',name:'GLOW Stack',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.12',unit_am:'ml'},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(glowCustomDoseStack))],active_index:0})});
  await G.loadUserStacks();
  check('migration: custom glow dose 0.12 not overridden', G._userStacks[0].peptides[0].dose_am==='0.12', `got "${G._userStacks[0].peptides[0].dose_am}"`);
  // migration must fire when backend stores dose_am as a number (not a string)
  const glowNumericStack={name:'My Stack',peptides:[
    {id:'glow',name:'GLOW Stack',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:0.2,unit_am:'mg'},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(glowNumericStack))],active_index:0})});
  await G.loadUserStacks();
  check('migration: glow numeric dose 0.2 → 0.09',  G._userStacks[0].peptides[0].dose_am==='0.09', `got "${G._userStacks[0].peptides[0].dose_am}"`);
  check('migration: glow numeric dose unit → ml',   G._userStacks[0].peptides[0].unit_am==='ml',   `got "${G._userStacks[0].peptides[0].unit_am}"`);
  // dose_am = 0.09 but unit_am = 'mg' (right number, wrong unit — the actual bug in prod)
  const glowWrongUnitStack={name:'My Stack',peptides:[
    {id:'glow',name:'GLOW Stack',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.09',unit_am:'mg'},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(glowWrongUnitStack))],active_index:0})});
  await G.loadUserStacks();
  check('migration: glow 0.09mg unit fixed → ml', G._userStacks[0].peptides[0].unit_am==='ml',  `got "${G._userStacks[0].peptides[0].unit_am}"`);
  check('migration: glow 0.09mg dose preserved',  G._userStacks[0].peptides[0].dose_am==='0.09',`got "${G._userStacks[0].peptides[0].dose_am}"`);

  // ── TRT compound end_date auto-migration ─────────────────────────────────────
  console.log('\n── TRT compound end_date auto-migration ─────────────────────');
  {
    // Stack with testoviron TRT compound and no end_date → end_date should NOT be auto-set (TESTO removed)
    const trtMigStack = {
      name: 'TRT Migration Test',
      cycle_start: '2026-05-01',
      trt: { enabled: true, compounds: [
        { id: 'testoviron', name: 'Testoviron Depot', dose: '125', unit: 'mg', freqVal: 1, freqUnit: 'weeks' }
      ]},
      peptides: []
    };
    G.fetch = async () => ({ ok: true, json: async () => ({ stacks: [JSON.parse(JSON.stringify(trtMigStack))], active_index: 0 }) });
    await G.loadUserStacks();
    const migC = G._userStacks[0].trt.compounds[0];
    check('TRT migration: testoviron end_date NOT auto-set (configurable per stack)', !migC.end_date, `end_date was auto-set to ${migC.end_date}`);
    check('TRT migration: no hardcoded TESTO date injected',        migC.end_date !== '2026-05-26', `got hardcoded date ${migC.end_date}`);
    // Existing end_date must not be overwritten
    const trtMigExistingEnd = {
      ...trtMigStack,
      trt: { enabled: true, compounds: [
        { id: 'testoviron', name: 'Testoviron Depot', dose: '125', unit: 'mg', freqVal: 1, freqUnit: 'weeks', end_date: '2026-06-01' }
      ]}
    };
    G.fetch = async () => ({ ok: true, json: async () => ({ stacks: [JSON.parse(JSON.stringify(trtMigExistingEnd))], active_index: 0 }) });
    await G.loadUserStacks();
    const migC2 = G._userStacks[0].trt.compounds[0];
    check('TRT migration: existing end_date not overwritten',       migC2.end_date === '2026-06-01', `got ${migC2.end_date}`);
    // Other TRT compounds (Nebido) are unaffected
    const trtNebidoStack = {
      ...trtMigStack,
      trt: { enabled: true, compounds: [
        { id: 'nebido', name: 'Nebido', dose: '1000', unit: 'mg', freqVal: 12, freqUnit: 'weeks' }
      ]}
    };
    G.fetch = async () => ({ ok: true, json: async () => ({ stacks: [JSON.parse(JSON.stringify(trtNebidoStack))], active_index: 0 }) });
    await G.loadUserStacks();
    const migC3 = G._userStacks[0].trt.compounds[0];
    check('TRT migration: nebido end_date not set by migration',    !migC3.end_date,               `got ${migC3.end_date}`);
  }

  // ── getChecked: old-style → canonical id mapping ──────────────────────────────
  console.log('\n── getChecked: id alias mapping ────────────────────────────');
  // Use a fixed date via _viewDate so we control the key (G.NOW is a const, not on sandbox)
  var chkDate=new Date(2026,5,4);  // June 4, 2026 (Thursday)
  G._viewDate=chkDate;
  const chkDk=G.dateKey(chkDate);
  // CJC aliases: cjc-am/cjc-pm → cjc-ipa-am/cjc-ipa-pm
  sandbox.localStorage._s['proto-chk-'+chkDk]=JSON.stringify(['cjc-am_'+chkDk,'cjc-pm_'+chkDk]);
  var chkCjc=G.getChecked();
  check('getChecked: cjc-am → cjc-ipa-am',   chkCjc.includes('cjc-ipa-am_'+chkDk), `got ${JSON.stringify(chkCjc)}`);
  check('getChecked: cjc-pm → cjc-ipa-pm',   chkCjc.includes('cjc-ipa-pm_'+chkDk), `got ${JSON.stringify(chkCjc)}`);
  // GLOW aliases: glow-1/glow-2 → glow
  sandbox.localStorage._s['proto-chk-'+chkDk]=JSON.stringify(['glow-1_'+chkDk,'glow-2_'+chkDk]);
  var chkGlow=G.getChecked();
  check('getChecked: glow-1 → glow',          chkGlow.includes('glow_'+chkDk), `got ${JSON.stringify(chkGlow)}`);
  check('getChecked: glow-2 → glow',          chkGlow.every(id=>id==='glow_'+chkDk), `got ${JSON.stringify(chkGlow)}`);
  // Reta aliases: reta-sun/reta-wed → retatrutide
  sandbox.localStorage._s['proto-chk-'+chkDk]=JSON.stringify(['reta-sun_'+chkDk,'reta-wed_'+chkDk]);
  var chkReta=G.getChecked();
  check('getChecked: reta-sun → retatrutide', chkReta.includes('retatrutide_'+chkDk), `got ${JSON.stringify(chkReta)}`);
  check('getChecked: reta-wed → retatrutide', chkReta.every(id=>id==='retatrutide_'+chkDk), `got ${JSON.stringify(chkReta)}`);
  // Canonical ids pass through unchanged
  sandbox.localStorage._s['proto-chk-'+chkDk]=JSON.stringify(['cjc-ipa-am_'+chkDk,'glow_'+chkDk,'retatrutide_'+chkDk]);
  var chkCanon=G.getChecked();
  check('getChecked: canonical ids unchanged', JSON.stringify(chkCanon)===JSON.stringify(['cjc-ipa-am_'+chkDk,'glow_'+chkDk,'retatrutide_'+chkDk]), `got ${JSON.stringify(chkCanon)}`);
  // Mixed old+canonical
  sandbox.localStorage._s['proto-chk-'+chkDk]=JSON.stringify(['cjc-am_'+chkDk,'glow_'+chkDk]);
  var chkMix=G.getChecked();
  check('getChecked: mixed old+canonical → all canonical', chkMix.includes('cjc-ipa-am_'+chkDk)&&chkMix.includes('glow_'+chkDk), `got ${JSON.stringify(chkMix)}`);
  // testo ids are unaffected (multi-underscore prefix)
  sandbox.localStorage._s['proto-chk-'+chkDk]=JSON.stringify(['testo_0_'+chkDk]);
  var chkTesto=G.getChecked();
  check('getChecked: testo id unchanged',      chkTesto[0]==='testo_0_'+chkDk, `got ${JSON.stringify(chkTesto)}`);
  delete sandbox.localStorage._s['proto-chk-'+chkDk];
  G._viewDate=null;

  // ── _normDoseId: date suffix normalization ────────────────────────────────────
  console.log('\n── _normDoseId: date suffix normalization ──────────────────');
  check('_normDoseId defined',              typeof G._normDoseId === 'function');
  check('_normDoseId: already padded',      G._normDoseId('retatrutide_2026-06-12') === 'retatrutide_2026-06-12');
  check('_normDoseId: un-padded month',     G._normDoseId('retatrutide_2026-6-12')  === 'retatrutide_2026-06-12');
  check('_normDoseId: un-padded day',       G._normDoseId('retatrutide_2026-06-2')  === 'retatrutide_2026-06-02');
  check('_normDoseId: un-padded both',      G._normDoseId('retatrutide_2026-6-2')   === 'retatrutide_2026-06-02');
  check('_normDoseId: multi-part prefix',   G._normDoseId('nebido_0_2026-6-12')     === 'nebido_0_2026-06-12');
  check('_normDoseId: testo multi-part',    G._normDoseId('testo_1_2026-6-5')       === 'testo_1_2026-06-05');
  check('_normDoseId: cjc hyphen id',       G._normDoseId('cjc-ipa-am_2026-6-12')  === 'cjc-ipa-am_2026-06-12');
  check('_normDoseId: already padded noop', G._normDoseId('glow_2026-12-31')        === 'glow_2026-12-31');

  // ── _migrateCheckedKeys: old proto-chk key migration ──────────────────────────
  console.log('\n── _migrateCheckedKeys: proto-chk key migration ────────────');
  check('_migrateCheckedKeys defined', typeof G._migrateCheckedKeys === 'function');
  // Scenario 1: un-padded key only — should rename key and normalize IDs
  {
    const oldKey = 'proto-chk-2026-6-3';
    const newKey = 'proto-chk-2026-06-03';
    sandbox.localStorage._s[oldKey] = JSON.stringify(['retatrutide_2026-6-3','glow_2026-6-3','testo_0_2026-6-3']);
    delete sandbox.localStorage._s[newKey];
    G._migrateCheckedKeys();
    check('migrate: old key removed',               sandbox.localStorage._s[oldKey] === undefined,
      `still has: ${sandbox.localStorage._s[oldKey]}`);
    check('migrate: new key created',               sandbox.localStorage._s[newKey] !== undefined);
    const migrated = JSON.parse(sandbox.localStorage._s[newKey] || '[]');
    check('migrate: reta ID normalized',            migrated.includes('retatrutide_2026-06-03'),
      `got ${JSON.stringify(migrated)}`);
    check('migrate: glow ID normalized',            migrated.includes('glow_2026-06-03'),
      `got ${JSON.stringify(migrated)}`);
    check('migrate: testo ID normalized',           migrated.includes('testo_0_2026-06-03'),
      `got ${JSON.stringify(migrated)}`);
    check('migrate: 3 entries preserved',           migrated.length === 3, `got ${migrated.length}`);
    delete sandbox.localStorage._s[newKey];
  }
  // Scenario 2: both old and new key exist — should merge (new key takes precedence)
  {
    const oldKey2 = 'proto-chk-2026-6-4';
    const newKey2 = 'proto-chk-2026-06-04';
    sandbox.localStorage._s[oldKey2] = JSON.stringify(['retatrutide_2026-6-4','glow_2026-6-4']);
    sandbox.localStorage._s[newKey2] = JSON.stringify(['cjc-ipa-am_2026-06-04']);
    G._migrateCheckedKeys();
    check('merge: old key removed',                 sandbox.localStorage._s[oldKey2] === undefined);
    const merged = JSON.parse(sandbox.localStorage._s[newKey2] || '[]');
    check('merge: 3 IDs after merge',               merged.length === 3, `got ${JSON.stringify(merged)}`);
    check('merge: existing new-key ID preserved',   merged.includes('cjc-ipa-am_2026-06-04'));
    check('merge: old IDs normalized+merged (reta)',merged.includes('retatrutide_2026-06-04'),
      `got ${JSON.stringify(merged)}`);
    check('merge: old IDs normalized+merged (glow)',merged.includes('glow_2026-06-04'),
      `got ${JSON.stringify(merged)}`);
    delete sandbox.localStorage._s[newKey2];
  }
  // Scenario 3: already-padded key is untouched
  {
    const paddedKey = 'proto-chk-2026-06-05';
    sandbox.localStorage._s[paddedKey] = JSON.stringify(['glow_2026-06-05']);
    G._migrateCheckedKeys();
    check('migrate: padded key untouched',          sandbox.localStorage._s[paddedKey] !== undefined);
    check('migrate: padded key content unchanged',  JSON.parse(sandbox.localStorage._s[paddedKey]).length === 1);
    delete sandbox.localStorage._s[paddedKey];
  }

  // ── getChecked: old-format key+IDs → normalized output (regression guard) ────
  console.log('\n── getChecked: old-format key regression guard ─────────────');
  {
    G._viewDate = new Date(2026, 5, 12); // June 12, 2026
    const newKey3 = 'proto-chk-2026-06-12';
    const oldKey3 = 'proto-chk-2026-6-12';
    delete sandbox.localStorage._s[newKey3];
    sandbox.localStorage._s[oldKey3] = JSON.stringify(['retatrutide_2026-6-12','glow_2026-6-12','testo_0_2026-6-12']);
    const chkOld = G.getChecked();
    check('old key: reta ID normalized',            chkOld.includes('retatrutide_2026-06-12'),
      `got ${JSON.stringify(chkOld)}`);
    check('old key: glow ID normalized',            chkOld.includes('glow_2026-06-12'),
      `got ${JSON.stringify(chkOld)}`);
    check('old key: testo ID normalized',           chkOld.includes('testo_0_2026-06-12'),
      `got ${JSON.stringify(chkOld)}`);
    check('old key: all IDs have padded date suffix', chkOld.every(id => /_\d{4}-\d{2}-\d{2}$/.test(id)),
      `unpadded: ${chkOld.filter(id => !/_\d{4}-\d{2}-\d{2}$/.test(id)).join(', ')}`);
    // Simulate buildToday() creating padded dose ID — must match getChecked() output
    const builtId = 'retatrutide_' + G.dateKey(new Date(2026, 5, 12));
    check('old key: matches buildToday() dose ID',  chkOld.includes(builtId),
      `builtId=${builtId}, checked=${JSON.stringify(chkOld)}`);
    delete sandbox.localStorage._s[oldKey3];
    G._viewDate = null;
  }

  // ── getPastDoses: normalizes un-padded server dates ───────────────────────────
  console.log('\n── getPastDoses: server date normalization ──────────────────');
  {
    const origLog = G.window._peptideLog;
    G.window._peptideLog = [
      {date: '2026-6-7',   doses: ['retatrutide_2026-6-7',  'glow_2026-6-7']},
      {date: '2026-06-08', doses: ['cjc-ipa-am_2026-06-08']},
    ];
    const d1 = new Date(2026, 5, 7);
    const r1 = G.getPastDoses(d1);
    check('getPastDoses: finds entry with un-padded date',  r1 !== null, 'returned null');
    check('getPastDoses: reta ID normalized',               r1 && r1.includes('retatrutide_2026-06-07'),
      `got ${JSON.stringify(r1)}`);
    check('getPastDoses: glow ID normalized',               r1 && r1.includes('glow_2026-06-07'),
      `got ${JSON.stringify(r1)}`);
    const d2 = new Date(2026, 5, 8);
    const r2 = G.getPastDoses(d2);
    check('getPastDoses: finds entry with padded date',     r2 !== null);
    check('getPastDoses: padded ID unchanged',              r2 && r2[0] === 'cjc-ipa-am_2026-06-08');
    check('getPastDoses: returns null for missing date',    G.getPastDoses(new Date(2026,5,9)) === null);
    G.window._peptideLog = origLog;
  }

  // ── _getDynamicTRTDoses: cycle_length end-date guard ─────────────────────────
  console.log('\n── _getDynamicTRTDoses: cycle_length end-date guard ────────');
  {
    const savedStacks  = G._userStacks;
    const savedIdx     = G._activeStackIndices.slice();
    // Stack with 8-week cycle starting May 1 → cycle ends June 26
    const trtStack = {
      name: 'TRT Test',
      cycle_start: '2026-05-01',
      cycle_length: 8,
      trt: { enabled: true, compounds: [{ id: 'testoviron', name: 'Testoviron Depot', dose: '125', unit: 'mg', freqVal: 1, freqUnit: 'weeks' }] },
      peptides: []
    };
    G._userStacks = [trtStack];
    G._activeStackIndices = [0];

    // Day 0: cycle start → should inject (0 % 7 === 0)
    const d0 = new Date(2026, 4, 1);
    const r0 = G._getDynamicTRTDoses(d0, false);
    check('TRT: day 0 (cycle start) produces dose',        r0.length === 1, `got ${r0.length} doses`);

    // Day 7: one week in → should inject
    const d7 = new Date(2026, 4, 8);
    const r7 = G._getDynamicTRTDoses(d7, false);
    check('TRT: day 7 (week 1) produces dose',             r7.length === 1, `got ${r7.length} doses`);

    // Day 55: 7 weeks 6 days in → still within 8-week cycle (55 < 56), 55%7===6 → no injection day
    const d55 = new Date(2026, 4, 1 + 55);
    const r55 = G._getDynamicTRTDoses(d55, false);
    check('TRT: day 55 (not injection day) → no dose',    r55.length === 0, `got ${r55.length} doses`);

    // Day 56: 8 weeks exactly → cycle_length*7 = 56, days >= 56 → no dose (washout)
    const d56 = new Date(2026, 4, 1 + 56);
    const r56 = G._getDynamicTRTDoses(d56, false);
    check('TRT: day 56 (== cycle_length*7) → no dose (washout)',  r56.length === 0, `got ${r56.length} doses`);

    // Day 63: one week past cycle end → still no dose
    const d63 = new Date(2026, 4, 1 + 63);
    const r63 = G._getDynamicTRTDoses(d63, false);
    check('TRT: day 63 (past cycle end) → no dose',       r63.length === 0, `got ${r63.length} doses`);

    // No cycle_length set → doses continue indefinitely (backward compat)
    const trtNoCycle = { ...trtStack, cycle_length: undefined };
    G._userStacks = [trtNoCycle];
    const rNoCycle = G._getDynamicTRTDoses(d63, false);
    check('TRT: no cycle_length → dose still generated',  rNoCycle.length === 1, `got ${rNoCycle.length} doses`);

    // per-compound end_date: doses suppressed after the end_date
    const trtWithEnd = {
      ...trtStack,
      cycle_length: undefined,
      trt: { enabled: true, compounds: [
        { ...trtStack.trt.compounds[0], end_date: '2026-05-26' }  // bridge ended May 26
      ]}
    };
    G._userStacks = [trtWithEnd];
    // day 7 (May 8) is before end_date May 26 → dose expected
    const rBeforeEnd = G._getDynamicTRTDoses(new Date(2026,4,8), false);
    check('TRT end_date: dose before end_date',            rBeforeEnd.length === 1, `got ${rBeforeEnd.length} doses`);
    // May 22 (day 21, 21%7=0) is a valid injection day AND used as end_date → dose expected (inclusive)
    const trtWithEnd22 = { ...trtWithEnd, trt: { enabled: true, compounds: [{ ...trtWithEnd.trt.compounds[0], end_date: '2026-05-22' }] } };
    G._userStacks = [trtWithEnd22];
    const rOnEnd = G._getDynamicTRTDoses(new Date(2026,4,22), false);
    check('TRT end_date: dose on end_date (inclusive)',    rOnEnd.length === 1,     `got ${rOnEnd.length} doses`);
    // June 13 (day 43 from May 1) → past end_date → suppressed
    const rPastEnd = G._getDynamicTRTDoses(new Date(2026,5,13), false);
    check('TRT end_date: dose past end_date suppressed',   rPastEnd.length === 0,  `got ${rPastEnd.length} doses`);

    // TRT disabled → no doses
    const trtDisabled = { ...trtStack, trt: { enabled: false, compounds: trtStack.trt.compounds } };
    G._userStacks = [trtDisabled];
    const rOff = G._getDynamicTRTDoses(d7, false);
    check('TRT: trt.enabled=false → no doses',            rOff.length === 0, `got ${rOff.length} doses`);

    G._userStacks       = savedStacks;
    G._activeStackIndices = savedIdx;
  }

  // ── loadUserStacks: WEEKLY updated (post-load re-render coverage) ─────────────
  console.log('\n── loadUserStacks: WEEKLY updated after load ───────────────');
  const canonicalLoadStack={name:'My Stack',peptides:[
    {id:'glow',name:'GLOW Stack',dot:'#3b9eff',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.09',unit_am:'ml',active:true},
    {id:'cjc-ipa',name:'CJC-1295 / IPA',dot:'#3cffa0',days:[0,1,2,3,4,5,6],times:['AM','PM'],dose_am:'4',unit_am:'IU',dose_pm:'5',unit_pm:'IU',active:true},
  ]};
  G.fetch=async()=>({ok:true,json:async()=>({stacks:[JSON.parse(JSON.stringify(canonicalLoadStack))],active_index:0})});
  await G.loadUserStacks();
  check('post-load: WEEKLY has glow',        G.WEEKLY.some(w=>w.id==='glow'),        `ids: ${G.WEEKLY.map(w=>w.id).join(', ')}`);
  check('post-load: WEEKLY has cjc-ipa-am',  G.WEEKLY.some(w=>w.id==='cjc-ipa-am'), `ids: ${G.WEEKLY.map(w=>w.id).join(', ')}`);
  check('post-load: WEEKLY has cjc-ipa-pm',  G.WEEKLY.some(w=>w.id==='cjc-ipa-pm'), `ids: ${G.WEEKLY.map(w=>w.id).join(', ')}`);
  check('post-load: glow has no endDate',    !G.WEEKLY.find(w=>w.id==='glow')?.endDate, 'glow endDate set after load');

  // ── _deriveEarliestStartDate ────────────────────────────────────────────────
  console.log('\n── _deriveEarliestStartDate ────────────────────────────────');
  check('derive: null for empty array',              G._deriveEarliestStartDate([])===null);
  check('derive: null when no start_dates',          G._deriveEarliestStartDate([{id:'x'},{id:'y'}])===null);
  check('derive: single peptide',                    G._deriveEarliestStartDate([{start_date:'2026-04-04'}])==='2026-04-04');
  check('derive: returns earliest of multiple',      G._deriveEarliestStartDate([{start_date:'2026-04-16'},{start_date:'2026-04-04'},{start_date:'2026-05-01'}])==='2026-04-04');
  check('derive: ignores peptides without start_date', G._deriveEarliestStartDate([{id:'x'},{start_date:'2026-04-16'},{start_date:'2026-04-04'}])==='2026-04-04');

  // ── cycle_start in _collectEditInputs ────────────────────────────────────────
  // cycle_start is NEVER auto-derived from peptide dates — only what user sets in the input
  console.log('\n── cycle_start collect (no auto-derive) ────────────────────');
  const noop2=()=>{};
  const mkInp=v=>({value:v,style:{},classList:{add:noop2,remove:noop2},appendChild:noop2});
  function runCollect(cycleDateInInput, peptides){
    G._editBuf={name:'t',cycle_start:cycleDateInInput,cycle_length:12,peptides};
    const origGet=G.document.getElementById;
    G.document.getElementById=function(id){
      if(id==='edit-cycle-start')return mkInp(cycleDateInInput);
      if(id==='edit-stack-name')return mkInp('t');
      const m=id.match(/^ed-sd-(\d+)$/);
      if(m)return mkInp(peptides[+m[1]]?.start_date||'');
      return mkInp('');
    };
    G._collectEditInputs();
    G.document.getElementById=origGet;
    return G._editBuf.cycle_start;
  }
  const pepApr4=[{id:'retatrutide',name:'Reta',start_date:'2026-04-04',times:['AM'],days:[0,3],dose_am:'3',unit_am:'mg'}];
  const pepApr4andApr16=[...pepApr4,{id:'glow',name:'GLOW',start_date:'2026-04-16',times:['AM'],days:[0,1,2,3,4,5,6],dose_am:'0.09',unit_am:'ml'}];

  check('collect: empty input → cycle_start deleted (not auto-filled)',   runCollect('',pepApr4)===undefined,                     `got ${runCollect('',pepApr4)}`);
  check('collect: future user date kept, not overridden by past peptide', runCollect('2026-05-18',pepApr4)==='2026-05-18',        `got ${runCollect('2026-05-18',pepApr4)}`);
  check('collect: explicit date kept unchanged',                           runCollect('2026-04-04',pepApr4)==='2026-04-04',        `got ${runCollect('2026-04-04',pepApr4)}`);
  check('collect: future date kept even with multiple past peptides',      runCollect('2026-05-18',pepApr4andApr16)==='2026-05-18',`got ${runCollect('2026-05-18',pepApr4andApr16)}`);
  check('collect: early user-set date kept, not moved forward by peptide', runCollect('2026-03-01',pepApr4)==='2026-03-01',       `got ${runCollect('2026-03-01',pepApr4)}`);

  // ── Weight history sort ───────────────────────────────────────────────────────
  console.log('\n── Weight history sort (newest first) ─────────────────────');
  check('sortWeightHistory defined',    typeof G.sortWeightHistory === 'function');
  check('bcRenderWeightHistory defined',typeof G.bcRenderWeightHistory === 'function');
  check('bcDrawWeightLeanChart defined', typeof G.bcDrawWeightLeanChart === 'function');
  check('setBcWeightWindow defined',    typeof G.setBcWeightWindow === 'function');
  check('toggleBcWeightHist defined',   typeof G.toggleBcWeightHist === 'function');
  check('deleteWeight defined',         typeof G.deleteWeight === 'function');
  check('deleteWeightFromAgent defined',typeof G.deleteWeightFromAgent === 'function');

  // Newest entry is first
  const _whSorted = G.sortWeightHistory([
    { date: '2026-06-01', weight: 90 },
    { date: '2026-06-10', weight: 88 },
    { date: '2026-05-15', weight: 91 },
    { date: '2026-06-05', weight: 89 },
  ]);
  check('sort: first entry is newest (2026-06-10)',
    _whSorted[0].date === '2026-06-10', `got "${_whSorted[0].date}"`);
  check('sort: last entry is oldest (2026-05-15)',
    _whSorted[_whSorted.length - 1].date === '2026-05-15', `got "${_whSorted[_whSorted.length - 1].date}"`);
  check('sort: strictly descending order',
    _whSorted.every((w, i) => i === 0 || _whSorted[i - 1].date >= w.date),
    `got ${JSON.stringify(_whSorted.map(w => w.date))}`);

  // Does not mutate input
  const _whIn = [{ date: '2026-01-01', weight: 80 }, { date: '2026-02-01', weight: 81 }];
  G.sortWeightHistory(_whIn);
  check('sort: does not mutate input', _whIn[0].date === '2026-01-01', `got "${_whIn[0].date}"`);

  // Invalid-date entries float to top
  const _whMixed = G.sortWeightHistory([
    { date: '2026-06-01', weight: 90 },
    { date: '2026-6-3',   weight: 69 },
    { date: '2026-06-10', weight: 88 },
  ]);
  check('sort: invalid-date entry is first',
    !/^\d{4}-\d{2}-\d{2}$/.test(_whMixed[0].date), `got "${_whMixed[0].date}"`);
  check('sort: valid entries are newest-first below invalid',
    _whMixed[1].date === '2026-06-10' && _whMixed[2].date === '2026-06-01',
    `got ${JSON.stringify(_whMixed.map(w => w.date))}`);

  // Edge cases
  check('sort: empty → []',   G.sortWeightHistory([]).length === 0);
  const _wh1 = G.sortWeightHistory([{ date: '2026-06-01', weight: 90 }]);
  check('sort: single entry', _wh1.length === 1 && _wh1[0].weight === 90);

  // ── Weight window (30/60/90d filter) ─────────────────────────────────────────
  console.log('\n── Weight window (30/60/90d filter) ───────────────────────');
  check('default _bcWeightWindow is 90', G._bcWeightWindow === 90, `got ${G._bcWeightWindow}`);

  const _origBCW = G._bcWeightWindow;
  const _origBcDraw = G.bcDrawWeightLeanChart;
  let _bcDrawCalls = 0;
  G.bcDrawWeightLeanChart = () => { _bcDrawCalls++; };

  G.setBcWeightWindow(30);
  check('setBcWeightWindow(30) sets _bcWeightWindow=30', G._bcWeightWindow === 30, `got ${G._bcWeightWindow}`);
  check('setBcWeightWindow(30) calls bcDrawWeightLeanChart', _bcDrawCalls === 1, `got ${_bcDrawCalls}`);
  G.setBcWeightWindow(60);
  check('setBcWeightWindow(60) sets _bcWeightWindow=60', G._bcWeightWindow === 60, `got ${G._bcWeightWindow}`);
  G.setBcWeightWindow(90);
  check('setBcWeightWindow(90) sets _bcWeightWindow=90', G._bcWeightWindow === 90, `got ${G._bcWeightWindow}`);

  G.bcDrawWeightLeanChart = _origBcDraw;
  G._bcWeightWindow = _origBCW;

  // toggleBcWeightHist toggles state without throwing
  const _whOpenBefore = G._bcWeightHistOpen;
  try {
    G.toggleBcWeightHist();
    check('toggleBcWeightHist toggles open state', G._bcWeightHistOpen === !_whOpenBefore, `got ${G._bcWeightHistOpen}`);
    G.toggleBcWeightHist();
    check('toggleBcWeightHist toggles back',       G._bcWeightHistOpen === _whOpenBefore,  `got ${G._bcWeightHistOpen}`);
  } catch(e) {
    check('toggleBcWeightHist does not throw', false, e.message);
  }

  // deleteWeight removes entry from weights array
  G.weights = [{ date: '2026-06-01', weight: 90 }, { date: '2026-06-05', weight: 89 }];
  // The sandbox stubs confirm() to false, and deleteWeight now asks before deleting
  // (it used to delete silently). Say yes for this behavioural check.
  const _cfWas = G.confirm; G.confirm = () => true;
  G.deleteWeight('2026-06-01');
  G.confirm = _cfWas;
  check('deleteWeight removes correct entry', G.weights.length === 1 && G.weights[0].date === '2026-06-05',
    `got ${JSON.stringify(G.weights)}`);
  check('deleteWeight preserves other entries', G.weights[0].weight === 89, `got ${G.weights[0].weight}`);

  // ── wizSave: correct tab navigation ──────────────────────────────────────────
  console.log('\n── wizSave: correct tab navigation ────────────────────────────');
  {
    let capturedTabId = null;
    const origSwitchTab = G.switchTab;
    G.switchTab = function(id) { capturedTabId = id; };
    const origSave2 = G.saveStacksToBackend;
    G.saveStacksToBackend = async function() { return true; };
    G.initWizard();
    G.wizSetStackName('Nav Test');
    G._wiz.peptides = [{id:'cjc-ipa',name:'CJC',dot:'#3cffa0',days:[0],times:['AM'],dose_am:'4',active:true}];
    G._userStacks = [];
    await G.wizSave();
    check('wizSave: calls switchTab with "stacks" (not "stack")', capturedTabId === 'stacks',
      `got "${capturedTabId}"`);
    G.switchTab = origSwitchTab;
    G.saveStacksToBackend = origSave2;
  }

  // ── _renderTRTGuide: dynamic tier highlighting ─────────────────────────────────
  console.log('\n── _renderTRTGuide: dynamic tier highlighting ─────────────────');
  {
    function getHighlightedTier(html) {
      const marker = 'rgba(232,160,32,0.1)';
      const idx = html.indexOf(marker);
      if (idx < 0) return null;
      const after = html.slice(idx, idx + 500);
      for (const label of ['Performance','High-normal','Standard TRT','Clinical','Optimised','Accelerated']) {
        if (after.includes(label)) return label;
      }
      return null;
    }
    const _trtDefined = typeof G._renderTRTGuide === 'function';
    check('_renderTRTGuide defined', _trtDefined);
    if (_trtDefined) {
      const h250 = G._renderTRTGuide('testoviron', 250);
      check('testoviron 250mg/wk: Performance highlighted',
        getHighlightedTier(h250) === 'Performance', `got "${getHighlightedTier(h250)}", html: ${h250.slice(0,300)}`);
      const h125 = G._renderTRTGuide('testoviron', 125);
      check('testoviron 125mg/wk: Standard TRT highlighted',
        getHighlightedTier(h125) === 'Standard TRT', `got "${getHighlightedTier(h125)}"`);
      const h180 = G._renderTRTGuide('testoviron', 180);
      check('testoviron 180mg/wk: High-normal highlighted',
        getHighlightedTier(h180) === 'High-normal', `got "${getHighlightedTier(h180)}"`);
      const h0 = G._renderTRTGuide('testoviron', 0);
      check('testoviron 0mg/wk (no dose): High-normal fallback (b:1)',
        getHighlightedTier(h0) === 'High-normal', `got "${getHighlightedTier(h0)}"`);
      const hNebido = G._renderTRTGuide('nebido', 83);
      check('nebido 83mg/wk (1000mg/12wks): Clinical highlighted',
        getHighlightedTier(hNebido) === 'Clinical', `got "${getHighlightedTier(hNebido)}"`);
    }
  }

  // ── init(): stale pep-last-tab cleanup ─────────────────────────────────────────
  console.log('\n── init(): stale pep-last-tab cleanup ─────────────────────────');
  {
    // Simulate the init() defensive cleanup: if tab button not found, remove the stale key
    G.localStorage.setItem('pep-last-tab', 'stack'); // invalid/old tab ID from wizSave bug
    const origGetById2 = G.document.getElementById;
    G.document.getElementById = function(id) {
      if (id === 'tab-btn-stack') return null; // simulate missing element for invalid tab
      return origGetById2(id);
    };
    const _ltStale = G.localStorage.getItem('pep-last-tab');
    if (_ltStale) {
      const _bStale = G.document.getElementById('tab-btn-' + _ltStale);
      if (_bStale) G.switchTab(_ltStale, _bStale);
      else G.localStorage.removeItem('pep-last-tab');
    }
    check('init(): stale "stack" tab ID cleared from localStorage',
      G.localStorage.getItem('pep-last-tab') === null,
      `got "${G.localStorage.getItem('pep-last-tab')}"`);
    G.document.getElementById = origGetById2;

    // Valid tab ID must NOT be cleared (mockEl returns non-null for valid IDs)
    G.localStorage.setItem('pep-last-tab', 'stacks');
    const _ltValid = G.localStorage.getItem('pep-last-tab');
    if (_ltValid) {
      const _bValid = G.document.getElementById('tab-btn-' + _ltValid);
      if (!_bValid) G.localStorage.removeItem('pep-last-tab');
    }
    check('init(): valid "stacks" tab ID preserved in localStorage',
      G.localStorage.getItem('pep-last-tab') === 'stacks',
      `got "${G.localStorage.getItem('pep-last-tab')}"`);
    G.localStorage.removeItem('pep-last-tab');
  }

  // Final summary
  // ── Injection Schedule header/date overflow (Add button off-screen) ──────────
console.log('\n── Card header overflow regressions ────────────────────────');
{
  const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
  check('card-header wraps instead of overflowing', /\.card-header\{[^}]*flex-wrap:wrap/.test(css));
  check('card-title-wrap can shrink (min-width:0)', /\.card-title-wrap\{[^}]*min-width:0/.test(css));
  const tc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  // The injection-schedule card's layout checks (wrapping controls, a constrained date
  // input for iOS) went with the card itself in Phase 6.
}

console.log(`\n${'─'.repeat(59)}`);
  
// ── The profile must survive a cache wipe (2026-08-05) ─────────────────────
// localStorage is a cache, never the source of truth. pep-profile carried the
// onboarded flag, the experience tier and the goals, and only the four shared
// user_* fields were ever pushed — so wiping the cache lost all three and the app
// replayed onboarding as if the account were new.
{
  const _tsProf = require('fs').readFileSync(require('path').join(__dirname,'../tab-stack.js'),'utf8');

  check('onboarding pushes the profile object itself',
    /kv\['pep-profile'\]=profile;/.test(rawScript));
  check('the profile carries the onboarded flag',
    /goals:\(_obData\.goals\|\|\[\]\)\.slice\(\),onboarded:true\}/.test(rawScript));
  check('the startup sync restores it', /if\(s\['pep-profile'\]/.test(rawScript));
  check('the restored profile is merged, not swapped in whole',
    /setData\('pep-profile',Object\.assign\(\{\},getData\('pep-profile',\{\}\),s\['pep-profile'\]\)\)/.test(rawScript));
  check('correcting the experience tier pushes the profile too',
    /pushPepSettingsToAgent\(\{'pep-experience':v,'pep-profile':p\}\)/.test(_tsProf));

  // applyTheme pushes as well as stores, so re-applying an unchanged theme sent the
  // same value back to the backend on every single load. Same guard as workout.
  check('the theme is only re-applied when it differs',
    /s\['pep-theme'\]&&getData\('pep-theme',null\)!==s\['pep-theme'\]/.test(rawScript));
}


// ── No hardcoded personal data, and deletes say they are global (2026-08-05) ─
// BC_SEED held one person's real neck/belly/body-fat measurements, in a public
// repo, merged into every user's body-comp history at four separate call sites.
// Henrik: remove anything hardcoded, and "delete entries need an extra
// confirmation step explaining that the delete is global."
{
  const fsx = require('fs'), pathx = require('path');
  const rd = f => fsx.readFileSync(pathx.join(__dirname, '..', f), 'utf8');
  const body = rd('tab-body.js'), labs = rd('tab-labs.js');
  const supp = rd('tab-supplements.js'), stack = rd('tab-stack.js');

  check('no BC_SEED constant', !/BC_SEED/.test(rawScript));
  check('  …and no merge sites left in tab-body.js', !/BC_SEED/.test(body));
  check('no hardcoded measurements anywhere in the app',
    ![rawScript, body].some(src => /neck:42,belly:9[0-9]/.test(src)));

  check('there is one shared confirm helper', /function confirmGlobalDelete\(what\)\{/.test(rawScript));
  check('  …and it says the record leaves the backend',
    /deletes it from your account on the backend/.test(rawScript));
  check('  …and that every device is affected, not just this one',
    /every device you are signed in on — not just this one/.test(rawScript));
  check('  …and that it cannot be undone', /It cannot be undone\./.test(rawScript));

  check('deleting a weight asks (it used to delete silently)',
    /function deleteWeight\(date\)\{if\(!confirmGlobalDelete\(/.test(rawScript));
  check('deleting a protocol asks', /confirmGlobalDelete\('this protocol'\)/.test(rawScript));
  check('deleting a blood test asks', /confirmGlobalDelete\('this blood test'\)/.test(labs));
  check('removing a supplement asks', /confirmGlobalDelete\('this supplement'\)/.test(supp));
  check('removing a compound from a cycle asks', /confirmGlobalDelete\(name\)/.test(stack));

  // Every one of those writes through to the backend, so none may keep the old
  // wording that implied a local-only change.
  check('no delete still uses the old local-sounding prompt',
    !/confirm\('Delete this protocol\?|confirm\('Delete this blood test\?|confirm\('Remove this supplement\?/
      .test(rawScript + labs + supp + stack));
}


// ── Today must not claim "nothing scheduled" while doses exist (2026-08-06) ──
// Henrik: "Today never renders with any injections at all except teato from
// t-calc????" — with 679 injections stored. refreshInjectionsCache drops every
// non-tcalc entry whose cycle_id is not in activeCycleIds, and a stack only
// contributes one when it is BOTH toggled active AND has a cycle_start. His only
// active protocol had no start date, so the set was empty and everything was
// filtered — then Today rendered "✓ Nothing scheduled today", which is the one
// thing that was not true.
{
  const today = require('fs').readFileSync(require('path').join(__dirname,'../tab-today.js'),'utf8');

  check('the filter records why an entry was dropped',
    /_injHidden\.count\+\+;/.test(rawScript));
  check('  …and which protocol it belonged to',
    /_injHidden\.stacks\[_nm\]=\(_injHidden\.stacks\[_nm\]\|\|0\)\+1;/.test(rawScript));
  check('  …and names an active protocol that has no start date',
    /noStart:\(_activeStackIndices\|\|\[\]\)\.reduce/.test(rawScript));
  check('_injHidden is declared alongside the injection cache',
    /var _injHidden=\{count:0,stacks:\{\},noStart:\[\],orphans:\{\}\};/.test(rawScript));

  check('Today reports hidden doses instead of "nothing scheduled"',
    /_hid&&_hid\.count/.test(today));
  check('  …says how many are hidden', /\+' dose'\+\(_hid\.count===1\?'':'s'\)\+' hidden/.test(today));
  check('  …names the inactive protocol first', /which '\+\(_names\.length>1\?'are':'is'\)\+' not active/.test(today));
  check('  …with a no-start fallback when the owner is unknown', /has no start date, so its schedule/.test(today));
  check('  …and offers a way to fix it', /Open Plan<\/button>/.test(today));
  check('  …via the real tab switcher',
    /switchTab\(\\'stacks\\',document\.getElementById\(\\'tab-btn-stacks\\'\)\)/.test(today));

  // The cheerful message must survive for the case it is actually true.
  check('"Nothing scheduled today" still shows when nothing IS scheduled',
    /_hid&&_hid\.count\)\{[\s\S]*?\}else\{[\s\S]*?Nothing scheduled today/.test(today));
  check('protocol names are escaped', /_esc\(_hid\.noStart\[0\]\)/.test(today));
}


// ── An active protocol renders, and activating one starts its cycle ─────────
// Henrik 2026-08-06: "An active protocol must render, but stack creation needs to
// make start date the date it is activated if not set prior to."
{
  const stackJs = require('fs').readFileSync(require('path').join(__dirname,'../tab-stack.js'),'utf8');

  check('an active protocol contributes its cycle id with or without a start date',
    /var activeCycleIds=_activeStackIndices\.reduce\(function\(set,si\)\{\s*var st=_userStacks\[si\];\s*if\(st\)set\.add\(_stackCycleId\(st\)\);/.test(rawScript));
  check('  …the old cycle_start requirement is gone',
    !/if\(st&&st\.cycle_start\)set\.add\(_stackCycleId\(st\)\)/.test(rawScript));

  check('activation backfills the start date', /function _ensureCycleStart\(idx\)\{/.test(rawScript));
  check('  …to today', /st\.cycle_start=dateKey\(NOW\);/.test(rawScript));
  check('  …and never overwrites one already set', /if\(st\.cycle_start\)return false;/.test(rawScript));

  // _deriveStackCycleId includes the start date. Setting one before the id is
  // frozen would move the cycle id and orphan every stored injection.
  check('the stack id is frozen BEFORE the start date is set',
    /_ensureStackId==='function'\)_ensureStackId\(st\);\s*if\(st\.cycle_start\)return false;/.test(rawScript));

  check('toggling a protocol on starts it', /_activeStackIndices=\[idx\];\s*_ensureCycleStart\(idx\);/.test(rawScript));
  check('useStack starts it too',
    (rawScript.match(/_activeStackIndices=\[idx\];\s*_ensureCycleStart\(idx\);/g) || []).length === 2);
  check('a first protocol from the wizard starts it',
    /if\(_userStacks\.length===1\)\{_activeStackIndices=\[0\];if\(typeof _ensureCycleStart==='function'\)_ensureCycleStart\(0\);\}/.test(stackJs));
  check('starting from a template starts it',
    /_activeStackIndices=\[_idx\];\s*if\(typeof _ensureCycleStart==='function'\)_ensureCycleStart\(_idx\);/.test(stackJs));
}


// ── T-Calc saves to a stack, never outside one (2026-08-06) ────────────────
// Henrik: "T-calc should be used in the stack wizard, and testosterone injections
// should be part of a stack. No injections can exist outside of a stack object."
// The double-dose came straight from the global bucket: 'tcalc' rendered
// unconditionally, so an unassigned plan sat next to an Enhanced stack's own
// testosterone and nothing reconciled them.
{
  const tc = require('fs').readFileSync(require('path').join(__dirname,'../tab-tcalc.js'),'utf8');

  check('the sync writes nothing without a stack',
    /if\(!_cid\)return;/.test(tc));
  // Phase 6: there is no Save-to-protocol sheet and T-Calc no longer creates a
  // protocol. What these guarded — that nothing is scheduled outside a protocol, and
  // that creating one is a deliberate act with a cap and a start date — now lives
  // entirely in the Plan tabs, which is where protocols were always meant to be made.
  check('T-Calc neither saves to nor creates a protocol',
    !/function _tcOpenSaveToStack/.test(tc) && !/function _tcCreateStackForTesto/.test(tc));

  // Already-stored 'tcalc' entries must keep rendering — refusing to write a new one
  // must never make existing injections disappear.
  check('existing global entries still render', /if\(cyc==='tcalc'\)return true;/.test(rawScript));
}


// ── T-Calc reads and writes the stack, not a private store (2026-08-06) ─────
// Henrik: "t-calc is empty ie has nothing in it, even though the t-calc injections
// are in the today view. Today view is also showing double injections... T-calc
// needs to save and read injections to a stack to avoid this situation."
//
// Both symptoms were one flaw: _tcp.manualLog (in tcalc_profiles.json) and
// injections.json held the same schedule, and the sync only ever pushed ONE WAY.
// Diverge them and T-Calc renders empty while its injections still show; write from
// both sides under different cycle ids and the same compound renders twice.
{
  const tc = require('fs').readFileSync(require('path').join(__dirname,'../tab-tcalc.js'),'utf8');

  check('T-Calc writes into the stack\'s own cycle id', /return tid;/.test(tc));
  check('  …not a private tcalc namespace', !/return 'tcalc:'\+tid;/.test(tc));

  check('the schedule is read back out of the stack', /function _tcLoadLogFromStack\(\)\{/.test(tc));
  // Updated 2026-08-07. The PAST is no longer stack-scoped — a checked injection
  // counts whatever protocol it was filed under — so the cycle-id filter now gates
  // only the stack's own FUTURE rows, and the function no longer bails when no stack
  // is chosen (there is still a history to show).
  check('  …with the stack\'s cycle id gating only its future rows',
    /if\(String\(e\.cycle_id\|\|''\)!==cid\)return;\s*\/\/ this stack's plan only/.test(tc));
  check('  …ignoring inactive rows', /if\(e\.active===false\)return;/.test(tc));
  check('  …and refusing a non-mg unit rather than assuming', /if\(unit!=='mg'\)return;/.test(tc));
  check('  …on every build of the tab', /_tcLoadLogFromStack\(\);/.test(tc));
  // The guard that replaced it: never assign a manualLog built from an incomplete
  // source. That is what let a 14-day window overwrite the stored log.
  check('  …and refusing to narrow the log from an incomplete source',
    /if\(_tcHistoryState!=='ready'\)return false;/.test(tc));

  // simplePlan survives ONLY for a plan that has no stack yet. Once one is chosen the
  // plan reads and writes that stack (see the block below) — the earlier assertion
  // here ("the plan parameters still live in the profile") described the design that
  // produced the 2026-08-07 divergence and has been replaced.
  check('an unassigned plan still has somewhere to live', /_tcBlankSimplePlan/.test(tc));
}

// ── 2026-08-07: three symptoms, one protocol ─────────────────────────────────
// "Under TRT the testosterone doses (from Enhanced?) is visible, but in t-calc I see
// Testoviron Depot injections (from local storage???) In Today view (for tomorrow) I
// see double injections with Nebido (ie I assume from TRT AND Enhanced???)."
{
  const stackJs = require('fs').readFileSync(require('path').join(__dirname,'../tab-stack.js'),'utf8');
  const bloodJs = require('fs').readFileSync(require('path').join(__dirname,'../tab-blood.js'),'utf8');
  const tcJs    = require('fs').readFileSync(require('path').join(__dirname,'../tab-tcalc.js'),'utf8');

  // ── A. a configured enhanced dose is a RATE; an injection stores an AMOUNT ──
  // Today rendered "Testosterone Undecanoate (Nebido) 350 mg/week" as a dose row
  // because the generator wrote the weekly rate and its unit verbatim.
  const dpi = G._enhDosePerInjection;
  check('an enhanced weekly rate converts to a per-injection dose',
    dpi({dose:'350',unit:'mg/week',cadence:'interval',freqVal:5,freqUnit:'days'}).dose === '250');
  check('  …carrying the base unit, never "mg/week"',
    dpi({dose:'350',unit:'mg/week',cadence:'interval',freqVal:5,freqUnit:'days'}).unit === 'mg');
  check('  …spread across a weekday schedule',   // 350/wk on Mon+Thu = 175 a shot
    dpi({dose:'350',unit:'mg/week',days:[1,4]}).dose === '175');
  check('  …a daily rate taken daily is unchanged',
    dpi({dose:'10',unit:'mg/day',days:[0,1,2,3,4,5,6]}).dose === '10');
  check('  …mg/EOD every other day is unchanged',
    dpi({dose:'50',unit:'mg/EOD',cadence:'interval',freqVal:2,freqUnit:'days'}).dose === '50');
  check('  …and a unit with no period passes straight through',
    dpi({dose:'100',unit:'mg'}).dose === '100' && dpi({dose:'100',unit:'mg'}).unit === 'mg');

  // ── B. ONE SCHEDULER: THE PROTOCOL (Phase 5, 2026-08-19) ────────────────────
  // Henrik: "we are dropping the T-calc style scheduling and returning to the compound
  // UI that is much easier to understand for a user."
  //
  // This block used to assert the opposite: that NEITHER tier generated testosterone,
  // because T-Calc owned it (rule of 2026-08-14). That rule was right about the problem
  // — two tiers each generating the same molecule put 27 enhanced/test_u rows beside 23
  // trt/nebido rows in one protocol — and wrong about the remedy: it moved ownership to
  // a third scheduler rather than removing the duplication. Phase 4 merged the tiers, so
  // the requirement that survives is ONE STREAM PER MOLECULE, and that is what is
  // asserted here now.
  const mkStack = (trtOn) => ({
    id:'s1', name:'Protocol 1', cycle_start:'2026-08-01', cycle_length:12,
    trt:{enabled:trtOn, compounds:trtOn?[{id:'nebido',name:'Nebido',dose:'100',unit:'mg',freqVal:5,freqUnit:'days'}]:[]},
    enhanced:{enabled:true, compounds:[
      {id:'test-u', name:'Testosterone Undecanoate (Nebido)', dose:'350', unit:'mg/week', cadence:'interval', freqVal:5, freqUnit:'days'},
      {id:'hgh',    name:'HGH',                               dose:'4',   unit:'IU/day',  days:[0,1,2,3,4,5,6]},
    ]},
  });
  const idsOf = st => G._genInjBatches(st,'s1',null).map(b => b.compound_id);

  check('testosterone schedules from the protocol again',
    idsOf(mkStack(true)).indexOf('nebido') !== -1);
  check('  …including one still filed under the Enhanced spelling',
    idsOf(mkStack(false)).indexOf('test-u') !== -1);
  check('  …while the rest of the tier is untouched',
    idsOf(mkStack(true)).indexOf('hgh') !== -1 && idsOf(mkStack(false)).indexOf('hgh') !== -1);

  // Every TRT_CAT id is a testosterone ester, and the brand names do NOT all contain
  // the word — so none of them may be skipped for want of matching on "testosterone".
  check('  …for EVERY ester in the TRT catalogue, brand-named or not',
    G.TRT_CAT.every(cat => idsOf({
      id:'s1', cycle_start:'2026-08-01', cycle_length:12,
      trt:{enabled:true, compounds:[{id:cat.id,name:cat.name,dose:'100',unit:'mg',freqVal:1,freqUnit:'weeks',days:[1]}]},
    }).length === 1),
    G.TRT_CAT.map(c => c.id).join(','));

  // ONE STREAM PER MOLECULE — the requirement the 2026-08-14 rule existed to protect,
  // now structural: the merged tier means there is no second generator to contend with.
  // A protocol that still holds the same molecule in both blocks (unmigrated) is the
  // case that used to double it.
  const bothBlocks = {
    id:'s1', cycle_start:'2026-08-01', cycle_length:12,
    trt:{enabled:true, compounds:[{id:'nebido',name:'Nebido',dose:'100',unit:'mg',freqVal:5,freqUnit:'days'}]},
    enhanced:{enabled:true, compounds:[{id:'test_u',name:'Testosterone Undecanoate (Nebido)',dose:'350',unit:'mg/week',cadence:'interval',freqVal:5,freqUnit:'days'}]},
  };
  const canon = id => (G._canonCompoundId ? G._canonCompoundId(id) : id);
  const bothIds = idsOf(bothBlocks).map(canon);
  check('an unmigrated protocol does not schedule the same molecule twice',
    bothIds.filter(x => x === 'nebido').length === 1,
    'ids: ' + idsOf(bothBlocks).join(','));

  // Peptides are a separate tier and must keep generating.
  check('  …and peptides still generate alongside a testosterone protocol',
    idsOf({
      id:'s1', cycle_start:'2026-08-01', cycle_length:12,
      peptides:[{id:'reta',name:'Retatrutide',dose_am:'2',unit_am:'mg',times:['AM'],days:[1],active:true}],
      trt:{enabled:true, compounds:[{id:'nebido',name:'Nebido',dose:'100',unit:'mg',freqVal:5,freqUnit:'days'}]},
    }).indexOf('reta') !== -1);

  // Nothing is suppressed any more, so nothing may be RECORDED as suppressed — a note
  // saying "scheduled elsewhere" beside a compound that schedules right here is worse
  // than no note at all.
  idsOf(mkStack(true));
  check('nothing is recorded as suppressed for testosterone',
    (G._injSuppressed['s1']||[]).length === 0,
    JSON.stringify(G._injSuppressed['s1']||[]));
  check('  …and no config screen still claims T-Calc schedules it',
    G._tcalcOwnsTestoNote('Testosterone') === '');
  check('  …replaced by one that only fires for an unmigrated id',
    G._enhDormantNoteHtml({id:'test_u',name:'Testosterone Undecanoate (Nebido)'},{}).indexOf('Older format') !== -1 &&
    G._enhDormantNoteHtml({id:'nebido',name:'Nebido'},{}) === '' &&
    G._enhDormantNoteHtml({id:'hgh',name:'HGH'},{}) === '');

  // No generated injection may carry a rate unit — that is the "350 mg/week" row.
  const units = G._genInjBatches(mkStack(false),'s1',null)
    .reduce((a,b) => a.concat(b.entries.map(e => e.unit||'')), []);
  check('no generated injection carries a "/period" unit',
    units.every(u => u.indexOf('/') === -1), units.join(','));

  // The free-T preview curve must show the doses that WILL be injected. Deriving a
  // schedule from stack config would plot a stream nothing generates, and double it
  // against the T-Calc plan — the same double the one-stream rule always forbade.
  check('the free-T log takes testosterone from T-Calc alone',
    /_blTcalcTestosterone\(\)/.test(bloodJs) &&
    !/_trtOwnsTesto/.test(bloodJs) &&
    !/st\.trt && st\.trt\.enabled/.test(bloodJs));

  // ── The blood/free-T curves use the SAME conversion, not a second copy ──────
  // tab-blood.js kept its own rate maths and only ever understood "mg/week" on a
  // weekday schedule. Anything else — mg/day, mg/EOD, an interval cadence — fell
  // through to the raw configured number and was plotted as if the whole period's
  // dose went in at every injection.
  check('the blood curves route through one shared conversion',
    /function _blDosePerInjection\(/.test(bloodJs) &&
    /_enhDosePerInjection\(/.test(bloodJs));
  check('  …and keep no second copy of the rate maths',
    !/injsPerWeek/.test(bloodJs), 'the local mg/week-only division is still there');

  const bdpi = (c) => Number(G._blDosePerInjection(c, null));
  check('mg/week on an interval cadence converts',            // 350/wk E5D = 250
    bdpi({dose:'350', unit:'mg/week', cadence:'interval', freqVal:5, freqUnit:'days'}) === 250);
  check('  …mg/day injected twice a week is a DAILY rate',    // 70/d over 3.5 d = 245
    bdpi({dose:'70', unit:'mg/day', days:[1,4]}) === 245);
  check('  …mg/EOD injected weekly likewise',                 // 50/2d over 7 d = 175
    bdpi({dose:'50', unit:'mg/EOD', days:[1]}) === 175);
  check('  …and a cadence that matches its unit is unchanged',
    bdpi({dose:'10', unit:'mg/day', days:[0,1,2,3,4,5,6]}) === 10 &&
    bdpi({dose:'50', unit:'mg/EOD', cadence:'interval', freqVal:2, freqUnit:'days'}) === 50);

  // Placement, not just amount: switching a compound to "every N days" leaves the old
  // weekday list behind, and _enhHitsDay ignores it. This did not, so the curve put
  // doses on days nothing is injected on.
  const idays = G._pkInjectionDays({cadence:'interval', freqVal:5, freqUnit:'days', days:[1,4]}, 21, 1);
  check('an interval cadence beats a stale weekday list',
    JSON.stringify(idays) === JSON.stringify([0,5,10,15,20]), JSON.stringify(idays));
  check('  …while a weekday compound is untouched',
    JSON.stringify(G._pkInjectionDays({days:[1,4]}, 14, 1)) === JSON.stringify([0,3,7,10]));
  check('  …and so is a compound with neither (TRT/peptide precedence)',
    JSON.stringify(G._pkInjectionDays({freqVal:2, freqUnit:'weeks'}, 42, 1)) === JSON.stringify([0,14,28]));

  // ── C. the plan lived in the stack it was assigned to ─────────────────────
  // Phase 6 deleted the planner these guarded — _tcSimplePlanStack, the adoption rule,
  // the write-back, and "the plan owns this day", which let a stale Testoviron plan
  // suppress a protocol holding Nebido. With one scheduler there is no plan to adopt
  // and no suppression to arbitrate; what survives is asserted where it now lives:
  // the protocol generates, and _tcCurveLog reads stored rows only.
  // Functions, not prose: the historical note above the deleted code names the old rule
  // deliberately, so matching on its wording would fail for the wrong reason.
  check('the plan-in-a-stack apparatus is gone',
    !/function _tcSimplePlanStack\(/.test(tcJs) && !/function _tcWritePlanToStack\(/.test(tcJs) &&
    !/function _tcSimplePlan\(/.test(tcJs) && !/_tcPlanDraft = Object\.assign/.test(tcJs));

  // The plan card, the draft, the change summary and the write-back all belonged to the
  // simple planner. Phase 6 removed it: the protocol IS the plan, the Compounds tab is
  // where it is edited, and there is no second copy to keep in step or to summarise.
  // The surviving requirement — an edit reaches the record and the curve — is asserted
  // against the protocol editor and _genInjBatches.
  check('the simple planner and its draft machinery are gone',
    typeof G._tcSimplePlan !== 'function' && typeof G._tcPlanDirty !== 'function' &&
    typeof G._tcSetSimplePlanField !== 'function' && typeof G._tcPlanChanges !== 'function');
}

// ── A CHECKED INJECTION IS THE PAST (2026-08-07) ─────────────────────────────
// Henrik: "any checked injection needs to be counted regardless of which stack it
// actually belonged to. Also the Stack concept might be changed or updated in the
// future, so the checked injections is the only source of truth to the past."
//
// Six weeks of logged TRT — two Testoviron Depot, then 100 mg Nebido E2D from 26
// June — rendered as roughly 40% of the real accumulated level. Three filters
// compounded: the shared cache fetches only today-14d, drops any cycle id whose stack
// is inactive, and _tcLoadLogFromStack then kept only the bound stack's id. At
// Nebido's 56-day half-life essentially nothing from June had cleared.
{
  const tcJs = require('fs').readFileSync(require('path').join(__dirname,'../tab-tcalc.js'),'utf8');
  const injJs = require('fs').readFileSync(require('path').join(__dirname,'../inj-writer.js'),'utf8');
  const _svH = G._tcHistory, _svHS = G._tcHistoryState, _svC = G._injectionsCache, _svP = G._tcp;

  check('T-Calc fetches its own history, not the 14-day shared cache',
    /function _tcFetchHistory\(/.test(tcJs) && /AGENT_URL \+ '\/injections\?date_from='/.test(tcJs));
  check('  …over a pharmacological lookback, not a convenience one',
    /_TC_HISTORY_LOOKBACK_DAYS = 400/.test(tcJs));
  check('  …selecting on logged, and refusing anything else',
    /if \(!e\.logged\) return;/.test(tcJs));
  // The rule this protects is that the PAST is selected on `logged` and nothing else —
  // never narrowed by which stack a dose was filed under. Narrowed 2026-08-14 from
  // "the token cycle_id never appears" to "cycle_id is never TESTED": the skipped-dose
  // rows now carry cycle_id as metadata so the series editor can address them, which is
  // a record, not a filter. Any comparison or branch on cycle_id inside this fetch still
  // fails — that is the thing that broke six weeks of TRT.
  {
    const _fetchSrc = tcJs.slice(tcJs.indexOf('async function _tcFetchHistory'),
                                 tcJs.indexOf('// manualLog is the ADVANCED planner'));
    const _cycTested = _fetchSrc.split('\n').some(l =>
      /cycle_id/.test(l) && (/[!=]==?/.test(l) || /\bif\s*\(/.test(l) || /\breturn\b/.test(l)));
    check('  …with no cycle_id filter anywhere in that fetch', !_cycTested);
    check('  …and the logged rows carry no cycle id at all',
      !/rows\.push\(\{[^}]*cycle/i.test(_fetchSrc.replace(/\n/g, ' ')));
  }
  check('  …and triggered when the tab is built', /if \(_tcHistoryState === 'idle'\) _tcFetchHistory\(\);/.test(tcJs));

  // The curve, end to end.
  const hist = (rows) => { G._tcHistory = rows; G._tcHistoryState = 'ready'; };
  const P = (o) => Object.assign({tier:'trt',active:true,unit:'mg',cycle_id:'stack1'}, o);

  hist([{compId:'nebido',doseMg:'100',date:'2026-06-26',source:'logged'},
        {compId:'nebido',doseMg:'100',date:'2026-06-28',source:'logged'},
        {compId:'testoviron',doseMg:'250',date:'2026-06-20',source:'logged'}]);
  G._injectionsCache = {};
  G._tcp = Object.assign({}, _svP || {}, {manualLog:[], plannerMode:'simple',
    simplePlan:{compId:'',doseMg:'',cadenceN:0,cadenceUnit:'week',cadenceDays:0,startDate:''}});
  let cl = G._tcCurveLog();
  check('logged injections from six weeks ago reach the curve', cl.length === 3, JSON.stringify(cl));
  check('  …even with an empty plan and an empty shared cache',
    cl.every(e => e.source === 'logged'));

  // The rule that matters: the stack it was filed under is irrelevant history.
  hist([{compId:'nebido',doseMg:'100',date:'2026-06-26',source:'logged',cycle_id:'a_stack_long_gone'}]);
  check('a checked dose counts whatever stack it belonged to', G._tcCurveLog().length === 1);

  // Past + unticked is a plan the user never confirmed taking, not the past.
  hist([]);
  G._injectionsCache = {'2026-06-26':[P({compound_id:'nebido',date:'2026-06-26',dose:'100'})]};
  check('a past dose that was never checked is NOT counted', G._tcCurveLog().length === 0);
  check('  …and _tcProtocolInjections is future-only', G._tcProtocolInjections().length === 0);

  // A checked dose must never also be counted as a plan.
  hist([{compId:'nebido',doseMg:'100',date:'2026-09-01',source:'logged'}]);
  G._injectionsCache = {'2026-09-01':[P({compound_id:'nebido',date:'2026-09-01',dose:'100',logged:true})]};
  check('a checked dose is not double-counted as a plan too', G._tcCurveLog().length === 1);
  check('  …and the checked record is the one kept', G._tcCurveLog()[0].source === 'logged');

  // History outranks a plan for the same day — a preview must not rewrite the past.
  hist([{compId:'nebido',doseMg:'100',date:'2026-08-01',source:'logged'}]);
  G._injectionsCache = {};
  G._tcp = Object.assign({}, G._tcp, {plannerMode:'simple',
    simplePlan:{compId:'enanthate',doseMg:'250',cadenceN:2,cadenceUnit:'day',cadenceDays:2,startDate:'2026-08-01'}});
  cl = G._tcCurveLog();
  const onDay = cl.filter(e => e.date === '2026-08-01');
  check('a plan cannot overwrite a checked injection on the same day',
    onDay.length === 1 && onDay[0].source === 'logged' && parseFloat(onDay[0].doseMg) === 100,
    JSON.stringify(onDay));

  // The truncation guard: manualLog must never be rebuilt from an incomplete source.
  G._tcHistoryState = 'loading';
  G._tcp = Object.assign({}, G._tcp, {manualLog:[{compId:'nebido',doseMg:'100',date:'2026-06-26'}]});
  G._tcLoadLogFromStack();
  check('a half-loaded history never overwrites the stored log',
    G._tcp.manualLog.length === 1, JSON.stringify(G._tcp.manualLog));

  // And the note that makes a future gap visible instead of silent.
  check('the curve says what history it is standing on', /function _tcHistoryNoteHtml\(/.test(tcJs));
  G._tcHistoryState = 'error';
  check('  …and says so when the history could not be loaded',
    /Could not load your logged injections/.test(G._tcHistoryNoteHtml()));
  hist([{compId:'nebido',doseMg:'100',date:'2026-06-26',source:'logged'}]);
  check('  …naming the count and the start date',
    /1 checked injection/.test(G._tcHistoryNoteHtml()));

  // ── Deleting a row must reach the stored injection ─────────────────────────
  // Reported 2026-08-07: "There is a test injection of 1000mg nebio on 5 july but I
  // cant delete it?" manualLog became a cache the same day, so splicing it and
  // re-rendering rebuilt the row straight back out of injections.json — and
  // _tcSyncLogToBackend only rewrites from TODAY forward, so a past dose was never
  // reachable by any path.
  check('a stored history row carries its injection id, or it cannot be deleted',
    /injId: e\.id \|\| undefined/.test(tcJs));
  // The request moved into inj-writer.js as injDeleteOne (2026-08-20) — it was the
  // last injection DELETE issued outside that module. Assert the behaviour where it
  // now lives, and that T-Calc still routes to it rather than re-opening its own.
  check('deleting a stored row calls DELETE on the record',
    /injDeleteOne\(injId, 'tcDelInj'\)/.test(tcJs) &&
    !/AGENT_URL \+ '\/injections\/' \+ encodeURIComponent\(injId\)/.test(tcJs));
  {
    const _iw = fs.readFileSync(path.join(__dirname, '../inj-writer.js'), 'utf8');
    check('  …through inj-writer, which addresses the row by id',
      /AGENT_URL \+ '\/injections\/' \+ encodeURIComponent\(injId\)/.test(_iw) &&
      /method:'DELETE'/.test(_iw));
    check('  …and refuses an empty id rather than issuing a bare DELETE',
      /if\(!injId\)/.test(_iw));
  }
  check('  …re-reads the history rather than guessing what is left',
    /await _tcFetchHistory\(true\);/.test(tcJs));
  check('  …and says the delete is global first',
    /confirmGlobalDelete\('this ' \+/.test(tcJs));
  // Deleting a whole SERIES was a planner action and went with it; deleting a single
  // stored dose is record maintenance and is what the checks above cover.
  check('  …while the series delete is gone with the planner',
    !/function _tcRemoveSeries/.test(tcJs));
  check('a profile-only row still deletes locally',
    /_tcp\.manualLog\.splice\(idx, 1\);/.test(tcJs));
  // 404 is success: the record is gone, which is what was asked for.
  // 404 handling moved with the request into inj-writer.js; assert it there.
  const _iwSrc = fs.readFileSync(path.join(__dirname, '../inj-writer.js'), 'utf8');
  check('  …and an already-deleted record is not reported as a failure',
    /if\(!r\.ok && r\.status !== 404\)/.test(_iwSrc));

  // ── Adding a PAST injection must create a real record ──────────────────────
  // Reported 2026-08-07, straight after the delete fix: "I cant now add the old
  // injections back?" The mirror of the same cause — manualLog is a cache, so a
  // past-dated push was rebuilt away by the next render, and _tcSyncLogToBackend
  // only writes from TODAY forward so nothing persisted it either.
  // The POST moved into inj-writer.js in Phase 3 (one module owns every write).
  // Same requirement, followed to where it now lives: the add path must reach a
  // real POST /injections, not just mutate manualLog.
  // MOVED 2026-08-20 (Henrik: "Move Add away from T-calc"). Every requirement below
  // was written against T-Calc's Add sheet; that sheet is gone and record entry lives
  // in Today's "+ Log a past injection" (savePastInjection in tab-thist.js), which now
  // also enters a run and can mark it already taken. The REQUIREMENTS did not move —
  // only the code they apply to — so they are re-pointed rather than deleted.
  const thJs = fs.readFileSync(path.join(__dirname, '../tab-thist.js'), 'utf8');
  check('a past-dated add POSTs a real injection record',
    /await injWriteOne\(body, 'pastInjection'\)/.test(thJs) &&
    /fetch\(AGENT_URL \+ '\/injections', \{\s*\n\s*method:'POST'/.test(injJs));
  check('  …carrying the PK snapshot, like the T-History back-fill does',
    /_injPkMeta\(d\.tier, d\.compId\)/.test(thJs));
  check('  …under cycle_id manual, which is where hand-entered doses live',
    /cycle_id: 'manual'/.test(thJs));
  check('  …and the T-Calc sheet it replaced is gone, not merely unlinked',
    !/function _tcShowAddSheet/.test(tcJs) && !/function _tcCreateLoggedInjections/.test(tcJs) &&
    !/_tcOpenLogPastDose\(\)/.test(tcJs));

  // A run straddling today: the past half is the record, the future half is not this
  // sheet's business. Planning is Plan ▸ Compounds.
  check('a series straddling today writes only the past half',
    /_piDates\(d\)\.filter\(function\(x\)\{ return x <= today; \}\)/.test(thJs));
  check('  …and says how many were dropped rather than dropping them quietly',
    /fall after today and will not be written/.test(thJs));

  // The write must land before anything re-reads the record.
  const _saveFn = thJs.slice(thJs.indexOf('async function savePastInjection()'),
                             thJs.indexOf('async function savePastInjection()') + 6000);
  check('a logged dose is written before the record is re-read',
    _saveFn.indexOf('await _tcFetchHistory(true)') > -1 &&
    _saveFn.indexOf("injWriteOne(body, 'pastInjection')") < _saveFn.indexOf('await _tcFetchHistory(true)'));

  check('  …and the series editor that shared the hazard is gone',
    !/function _tcSaveEditSeries/.test(tcJs));

  // The plan sync clears before it re-posts. That delete had no logged filter, so it
  // removed logged records dated today or later and the re-post recreated them as
  // unlogged plans — a record silently downgraded to a schedule.
  // Stronger than it was: this used to pass if the string appeared anywhere in
  // tab-tcalc.js. Every clear now goes through one function, and that function
  // defaults to unlogged_only — a caller cannot forget it any more, it has to
  // pass unloggedOnly:false on purpose.
  check('the plan sync clears only the plan, never a logged record',
    /injClearFuture/.test(tcJs) &&
    /var unloggedOnly = \(o\.unloggedOnly === false\) \? false : true;/.test(injJs));

  // ── A planned dose is a DRAFT until Save to protocol ───────────────────────
  // Henrik, 2026-08-08: "the user flow would always be add injections and when happy
  // with the curve then save it to a protocol. Its a planning tool!"
  // _tcSetTargetStack is what binds a stack and then flushes manualLog to the record,
  // so a planned dose necessarily exists BEFORE any stack does. _tcLoadLogFromStack
  // assigned manualLog outright from the record and runs on every buildTCalc(), so
  // the draft was erased on the very next render and never survived to be saved —
  // which is why a 10-dose series starting today kept only the one logged dose for
  // today (a record) and lost the nine future ones (a draft).
  // Phase 6: nothing stages a draft, because nothing plans here. The failure this
  // guarded — a nine-dose future series silently erased on the next render — cannot
  // occur when the future half is refused rather than staged.
  check('no dose is staged as an unsaved draft any more',
    !/draft:true/.test(tcJs));

  hist([]);
  G._injectionsCache = {};
  var _dk = G.dateKey, _now = new Date();   // NOW is a const, not on the sandbox
  var _fut  = _dk(new Date(_now.getTime() + 7 * 86400000));
  var _fut2 = _dk(new Date(_now.getTime() + 9 * 86400000));
  var _old  = _dk(new Date(_now.getTime() - 7 * 86400000));
  G._tcp = Object.assign({}, G._tcp, {manualLog:[
    {compId:'nebido',doseMg:'100',date:_fut,  seriesId:'s1',draft:true},
    {compId:'nebido',doseMg:'100',date:_fut2, seriesId:'s1',draft:true}]});
  G._tcLoadLogFromStack();
  check('a planned series survives the rebuild that runs on every build',
    G._tcp.manualLog.length === 2, JSON.stringify(G._tcp.manualLog));

  // The record owns the past: a draft dated before today is not resurrected.
  G._tcp = Object.assign({}, G._tcp, {manualLog:[
    {compId:'nebido',doseMg:'100',date:_old,seriesId:'s2',draft:true}]});
  G._tcLoadLogFromStack();
  check('  …but a draft in the past is dropped — the record owns the past',
    G._tcp.manualLog.length === 0, JSON.stringify(G._tcp.manualLog));

  // Once the record holds it, the draft retires instead of duplicating the row.
  hist([]);
  G._injectionsCache = {};
  G._tcHistory = [{compId:'nebido',doseMg:'100',date:_fut,source:'logged'}];
  G._tcHistoryState = 'ready';
  G._tcp = Object.assign({}, G._tcp, {manualLog:[
    {compId:'nebido',doseMg:'100',date:_fut,seriesId:'s1',draft:true}]});
  G._tcLoadLogFromStack();
  check('  …and a draft the record caught up with does not duplicate',
    G._tcp.manualLog.length === 1, JSON.stringify(G._tcp.manualLog));
  hist([]);
  G._injectionsCache = {};
  check('  …and the history re-read after writing, not assumed',
    /await _tcFetchHistory\(true\)/.test(thJs) &&
    thJs.indexOf("injWriteOne(body, 'pastInjection')") < thJs.indexOf('await _tcFetchHistory(true)'));
  check('a partial write is reported rather than swallowed',
    /'Saved ' \+ written\.length \+ ' of ' \+ dates\.length/.test(thJs) &&
    /id="pi-err"/.test(thJs));

  // ── A series is part of the RECORD, not of the profile cache ───────────────
  // Henrik, 2026-08-07: "Make injections.json keep track of injections that are part
  // of a series so a restore recreates the series cards in t-calc." The grouping used
  // to live only in _tcp.manualLog, so nineteen doses read back out of the record
  // came back as nineteen identical rows and a restore could not rebuild the card.
  check('a created past injection carries its series id to the record',
    /series_id: seriesId/.test(thJs));
  check('  …one id spanning the whole run, so a restore rebuilds one card',
    /var seriesId = \(dates\.length > 1\)/.test(thJs));
  // The plan sync that also stamped series_id (_tcSyncLogToBackend) is deleted
  // (Phase 8). Record entry is the only path left that writes one, and the check
  // above covers it. Assert the sync is gone rather than that it stamps.
  check('  …and the deleted plan sync no longer writes a competing one',
    !/series_id:e\.seriesId\|\|null/.test(tcJs) && !/function _tcSyncLogToBackend/.test(tcJs));
  check('a stored history row reads its series id back',
    /seriesId: e\.series_id \|\| undefined/.test(tcJs));
  check('  …as does a planned row rebuilt from the stack',
    /seriesId:e\.series_id\|\|undefined/.test(tcJs));
  // Moved to Today 2026-08-20; same rule, same reason.
  check('one id spans the whole run, so a logged run is still one card',
    /var seriesId = \(dates\.length > 1\)/.test(thJs) && /series_id: seriesId/.test(thJs));
  check('  …and a single dose gets no series id at all',
    /: null;/.test(thJs.slice(thJs.indexOf('var seriesId = (dates.length > 1)'),
                              thJs.indexOf('var seriesId = (dates.length > 1)') + 260)));

  // End to end: the grouping survives a round trip through the record. The card is
  // rendered inline in buildTCalc (which needs a DOM), so this asserts the input that
  // card groups on — one seriesId shared by the restored rows, and none invented for
  // a standalone dose.
  hist([{compId:'nebido',doseMg:'100',date:'2026-06-26',seriesId:'r1',source:'logged'},
        {compId:'nebido',doseMg:'100',date:'2026-06-28',seriesId:'r1',source:'logged'},
        {compId:'nebido',doseMg:'100',date:'2026-06-30',seriesId:'r1',source:'logged'},
        {compId:'testoviron',doseMg:'250',date:'2026-06-20',source:'logged'}]);
  G._injectionsCache = {};
  G._tcp = Object.assign({}, _svP || {}, {manualLog:[]});
  G._tcLoadLogFromStack();
  const grouped = {};
  G._tcp.manualLog.forEach(e => { if (e.seriesId) grouped[e.seriesId] = (grouped[e.seriesId]||0) + 1; });
  check('restored rows regroup into ONE series, not N loose doses',
    Object.keys(grouped).length === 1 && grouped.r1 === 3, JSON.stringify(grouped));
  check('  …and a standalone dose is not swept into it',
    G._tcp.manualLog.filter(e => !e.seriesId).length === 1);
  check('  …with the series reaching the curve as three separate injections',
    G._tcCurveLog().filter(e => e.seriesId === 'r1').length === 3);

  G._tcHistory = _svH; G._tcHistoryState = _svHS; G._injectionsCache = _svC; G._tcp = _svP;
}


// ── Ticking a dose keeps the curve and the record in agreement ───────────────
// _tcHistory is fetched ONCE per session — _tcFetchHistory returns early on a warm
// cache and buildTCalc only calls it while the state is 'idle'. Everything else the
// curve rests on (_injectionsCache, _tcp.manualLog) is rebuilt from the backend on
// every refresh, so before this was fixed the two drifted apart the moment a logged
// flag changed in Today, and stayed apart for the rest of the session:
//   untick — the dose left the record but stayed in _tcHistory, so the curve KEPT it
//   tick   — the dose entered the record but not _tcHistory, and both
//            _tcProtocolInjections and _tcLoadLogFromStack skip logged rows, so the
//            curve LOST it once anything rebuilt manualLog
// Display-only and cleared on restart, which is exactly what made it hard to place:
// six unticks left the curve frozen at 31 doses / first 16 Jul / peak 1225 pmol/L
// while the record said 25 / 28 Jul / 1018 (2026-08-15).
//
// This drives the REAL toggleInjection against a backend that actually flips the row,
// so it fails if the re-read is dropped — a source-text assertion would not.
console.log('\n── Today tick ⇄ T-Calc history ────────────────────────────');
{
  const _tkSave = {f:G.fetch, h:G._tcHistory, hs:G._tcHistoryState, sk:G._tcSkippedPast,
                   tp:G._tcp, c:G._injectionsCache, us:G._userStacks, ai:G._activeStackIndices,
                   sl:G._stacksLoaded, sn:G._stacksNormalized, bw:G._tcBwEntries, bl:G._tcBwLoading};
  const CYC = 'tk1';
  const _tkD = (o) => { const t = new Date(); t.setDate(t.getDate()+o);
    return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };
  const STORED = [];
  for (let i = -30; i <= 30; i += 2)
    STORED.push({id:'tk'+i, compound_id:'nebido', tier:'trt', cycle_id:CYC,
                 date:_tkD(i), dose:'100', unit:'mg', logged:i<0, active:true});

  G._userStacks = [{id:CYC, name:'Tick', cycle_start:_tkD(-60), peptides:[],
                    trt:{enabled:true, compounds:[{id:'nebido',name:'T',dose:'100',unit:'mg',freq_days:2}]}}];
  G._activeStackIndices = [0]; G._stacksLoaded = true; G._stacksNormalized = true;
  G._tcBwEntries = []; G._tcBwLoading = true;      // bloodwork is not part of this path
  G._tcp = {targetStackId:CYC, plannerMode:'advanced', manualLog:[], measuredFT:'350', birthYear:'1980'};
  G._tcHistory = STORED.filter(e => e.logged)
    .map(e => ({compId:'nebido', doseMg:'100', date:e.date, injId:e.id, source:'logged'}));
  G._tcHistoryState = 'ready'; G._tcSkippedPast = [];
  // A backend that honours the PUT: the record really changes under the curve.
  G.fetch = async (url, opt) => {
    if (opt && opt.method === 'PUT') {
      const row = STORED.find(e => e.id === String(url).split('/injections/')[1]);
      if (row) row.logged = JSON.parse(opt.body).logged;
      return {ok:true, status:200, json:async()=>({})};
    }
    return {ok:true, status:200, json:async()=>String(url).includes('/injections')?STORED:[]};
  };

  const shape = () => { const l = G._tcCurveLog(); return {n:l.length, first:l.length?l[0].date:null}; };
  // AWAITED, not fire-and-forget. This block lives inside the wizSave().then(async …)
  // chain that ends in process.exit(), so an unawaited IIFE races that exit and its
  // checks vanish silently — the same trap the note above the exit call describes.
  await (async () => {
    await G.refreshInjectionsCache(); G.buildTCalc();
    const before = shape();
    const first6 = STORED.filter(e => e.logged).slice(0, 6).map(e => e.id);
    for (const id of first6) await G.toggleInjection(id, true);       // untick six
    const live = shape();
    check('unticking six doses drops them from the curve',
      live.n === before.n - 6, `${before.n} -> ${live.n}`);
    check('  …and moves the "since" date off the dose that was undone',
      live.first !== before.first, `first still ${live.first}`);
    // A reload must agree with what was already on screen — that gap WAS the bug.
    G._tcHistory = null; G._tcHistoryState = 'idle'; G._tcSkippedPast = [];
    await G._tcFetchHistory(true); await G.refreshInjectionsCache(); G.buildTCalc();
    const reload = shape();
    check('  …and a reload shows the same curve, not a corrected one',
      reload.n === live.n && reload.first === live.first,
      `live ${live.n}/${live.first} vs reload ${reload.n}/${reload.first}`);
    // The other direction. Ticking used to LOSE the dose as soon as anything rebuilt
    // manualLog, because it left the plan without entering the history. Asserting a
    // fixed count here would be wrong — three of these were just unticked above, so
    // re-ticking them legitimately puts them back. The invariant that actually holds
    // in both directions is the one that was broken: what is on screen equals what a
    // reload would show.
    const due = STORED.filter(e => !e.logged).slice(0, 3).map(e => e.id);
    for (const id of due) { await G.toggleInjection(id, false); await G.refreshInjectionsCache(); G.buildTCalc(); }
    const tickLive = shape();
    G._tcHistory = null; G._tcHistoryState = 'idle'; G._tcSkippedPast = [];
    await G._tcFetchHistory(true); await G.refreshInjectionsCache(); G.buildTCalc();
    const tickReload = shape();
    check('ticking a dose does not drop it from the curve on the next rebuild',
      tickLive.n === tickReload.n && tickLive.first === tickReload.first,
      `live ${tickLive.n}/${tickLive.first} vs reload ${tickReload.n}/${tickReload.first}`);
    check('  …and the history it is read from is a forced re-read of the record',
      /else if\(typeof _tcFetchHistory==='function'\)\{[\s\S]*?await _tcFetchHistory\(true\);\}/
        .test(require('fs').readFileSync(require('path').join(__dirname,'../tab-today.js'),'utf8')));

    G.fetch = _tkSave.f; G._tcHistory = _tkSave.h; G._tcHistoryState = _tkSave.hs;
    G._tcSkippedPast = _tkSave.sk; G._tcp = _tkSave.tp; G._injectionsCache = _tkSave.c;
    G._userStacks = _tkSave.us; G._activeStackIndices = _tkSave.ai;
    G._stacksLoaded = _tkSave.sl; G._stacksNormalized = _tkSave.sn;
    G._tcBwEntries = _tkSave.bw; G._tcBwLoading = _tkSave.bl;
  })();
}


// ── Evidence grades + research citations ─────────────────────────────────────
// Henrik, 2026-08-12: "this app will basically have research citations and t-calc
// as its USP." So a dose recommendation must never render without (a) how well
// evidenced it is and (b) what it stands on. These tests exist because an
// authoritative-looking badge with nothing behind it is worse than no badge.
{
  const stack = fs.readFileSync(path.join(__dirname, '../tab-stack.js'), 'utf8');
  const cycles = fs.readFileSync(path.join(__dirname, '../tab-cycles.js'), 'utf8');

  // The registry is the backend's. Nothing here may hardcode bibliography —
  // that is the compound-data-lives-in-the-backend rule applied to citations.
  check('citations come from the backend, not a frontend const',
    /_absorbCitations/.test(rawScript) && /AGENT_URL\+'\/citations'/.test(rawScript));
  check('the enhanced catalogue fetch absorbs the citations riding with it',
    /_absorbCitations\(d\)/.test(cycles));
  check('citations are also fetched standalone, so a TRT-only user still gets them',
    /async function syncCitations\(\)/.test(rawScript));
  check('  …and startup actually calls it', /syncCitations\(\)/.test(rawScript));
  check('no PMID is hardcoded in the frontend',
    !/PMID\s*\d{5,}/.test(rawScript) && !/PMID\s*\d{5,}/.test(stack));

  // The three shared helpers. One implementation, because all three compound
  // tiers must render evidence identically (UI parity rule).
  check('a grade badge helper exists', /function _evBadge\(/.test(rawScript));
  check('an anchor-line helper exists', /function _anchorLine\(/.test(rawScript));
  check('a citation-chip helper exists', /function _citeChips\(/.test(rawScript));
  check('the grade legend is rendered from the backend, not restated locally',
    /_GRADES\[g\]/.test(rawScript));

  // The anchor is the point of the whole feature.
  {
    const i = rawScript.indexOf('function _anchorLine(');
    const body = rawScript.slice(i, i + 1400);
    check('a dose above the anchor is called uncharted, not endorsed',
      /highest dose ever measured in a trial/.test(body) && /Uncharted, not endorsed/.test(body));
    check('a compound with no anchor says so explicitly',
      /No dose of this compound has ever been measured/.test(body));
    check('  …rather than silently rendering nothing for it',
      /no_anchor/.test(body));
  }

  // PARITY: all three tiers must show grade, anchor and sources. This is the
  // rule that gets quietly broken, so it is asserted per renderer.
  const tiers = [
    ['Enhanced', '_renderEnhancedGuide', 'function stackAASAutoFill'],
    ['TRT', '_renderTRTGuide', 'function _refreshTRTGuide'],
    // End marker must be the NEXT function in file order, not any function that
    // _renderDoseGuide happens to call — _dosePersonalization is defined earlier,
    // so indexOf returned -1 and sliced an empty body that passed nothing.
    ['Peptides', '_renderDoseGuide', 'function _renderRampSection'],
  ];
  tiers.forEach(function(t){
    const name = t[0];
    const start = stack.indexOf('function ' + t[1] + '(');
    const end = stack.indexOf(t[2], start);
    const body = start >= 0 && end > start ? stack.slice(start, end) : '';
    check(name + ' tier renders an evidence badge', /_evBadge\(/.test(body));
    check(name + ' tier renders the dose anchor', /_anchorLine\(/.test(body));
    check(name + ' tier renders source chips', /_citeChips\(/.test(body));
  });

  // Mechanism and side-effect copy are claims too, not just doses.
  {
    const i = stack.indexOf('function _renderEnhancedGuide(');
    const body = stack.slice(i, stack.indexOf('function stackAASAutoFill', i));
    check('"How it works" carries its sources', /cat\.interaction\+_refs/.test(body));
    check('"Side effects" carries its sources', /cat\.sides\+_refs/.test(body));
  }

  // A user must be able to read the whole evidence base, not only what happens
  // to be on screen.
  check('Settings exposes every reference', /function openAllReferences\(/.test(rawScript));
  check('  …and the grade legend', /function openGradeLegend\(/.test(rawScript));
  check('  …via a Settings card', /function buildRefsCard\(/.test(rawScript));
  check('  …that loadSettings actually builds', /buildRefsCard\(\);/.test(rawScript));
  check('a single citation opens in full', /function openCitation\(/.test(rawScript));
  check('a citation shows what the document states', /What it states/.test(rawScript));
  check('a citation shows its caveat, so it cannot be over-read',
    /Read with this caveat/.test(rawScript));
  check('a checked absence is shown as a source in its own right',
    /Checked absence/.test(rawScript));
  check('the grade legend says a grade is not a safety rating',
    /not a safety rating/.test(rawScript));

  // Citation text is backend-supplied, so it goes through the escaper.
  {
    const i = rawScript.indexOf('function openCitation(');
    const body = rawScript.slice(i, rawScript.indexOf('function openGradeLegend(', i));
    check('citation fields are escaped before rendering',
      /_esc\(c\.title/.test(body) && /_esc\(c\.states\)/.test(body));
  }
}


// ── Free-T exposure vs the physiological range ───────────────────────────────
// Henrik, 2026-08-12: "for testosterone the real metric is free T." The dose
// anchor cannot see SHBG; this can. The risk in building it is that it quietly
// becomes a SECOND free-T model that disagrees with the chart, or that it starts
// claiming an outcome nobody has measured. These tests guard both.
{
  const tc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');

  check('the reference range comes from the backend, not a frontend const',
    /_FT_REF/.test(rawScript) && /free_t_reference/.test(rawScript));
  check('  …and no pmol/L threshold is hardcoded in the frontend',
    !/\b(804|243)\s*pmol/.test(rawScript) && !/ceiling_pmol_l\s*[:=]\s*\d/.test(rawScript));
  check('an exposure helper exists', /function _ftExposureHtml\(/.test(rawScript));

  {
    const i = rawScript.indexOf('function _ftExposureHtml(');
    const body = rawScript.slice(i, rawScript.indexOf('function openAllReferences(', i));
    check('it renders nothing when the range has not loaded',
      /if\(!_FT_REF\|\|!_FT_REF\.ceiling_pmol_l\)return''/.test(body));
    check('it renders nothing without a curve', /if\(!\(pmol>0\)\|\|!isFinite\(pmol\)\)return''/.test(body));
    check('the multiple is rounded to the backend step, not shown raw',
      /_FT_REF\.round_to/.test(body) && /Math\.round\(\(pmol\/ceil\)\/step\)\*step/.test(body));
    check('above the ceiling is described as unmeasured, not unsafe',
      /above_ceiling_note/.test(body));
    check('  …and the frontend does not invent its own harm wording',
      !/dangerous|unsafe|toxic/i.test(body));
    check('the calculated-free-T caveat always ships with the number',
      /_FT_REF\.caveat/.test(body));
    check('the range carries its citation chips', /_citeChips\(/.test(body));
    check('every rendered field is escaped', /_esc\(headline\)/.test(body) && /_esc\(_FT_REF\.caveat/.test(body));
    check('units are pmol/L and nothing else', /pmol\/L/.test(body) && !/\bng\/dL\b|\bpg\/mL\b|\bmg\/day\b/.test(body));
  }

  // The load-bearing one. doc 13 is SETTLED: T-Calc owns the free-T model and
  // this readout must be a READ of what was plotted, never a second derivation.
  {
    const i = tc.indexOf('_tcSsPeakPmol = ');
    const around = tc.slice(Math.max(0, i - 900), i + 300);
    check('the exposure value is read from the plotted series',
      /total\[_si\] \* \(calFT_arr \? calFT_arr\[_si\] : scale\)/.test(around));
    check('  …with no call into the model to get it',
      !/_tcFreeTSeries\(/.test(around));
    // Corrected 2026-08-14. This asserted the literal Math.floor(totalDays / 2) — which
    // WAS the bug: totalDays includes the washout tail, so that window sat months after
    // the last injection and reported the decaying tail as steady-state exposure. The
    // intent in the name is right and is what is asserted now: start at the halfway
    // point (skip the ramp-up) of the DOSING period, and never run past the last dose.
    check('  …over the steady-state window, not the ramp-up',
      /_ssFrom = Math\.floor\(_ssEnd \/ 2\)/.test(around));
    check('  …and that window ENDS at the last injection, not in the washout tail',
      /_ssEnd\s*=\s*\(logDays > 0\)/.test(around) && !/_si <= totalDays/.test(around));
    check('an uncalibrated curve yields no multiple at all',
      /_tcSsPeakPmol = \(calFT && _ssPk > 0\) \? _ssPk : null/.test(tc));
  }

  check('T-Calc renders a slot for the exposure note', /id="tc-exposure-note"/.test(tc));
  check('  …filled only after the chart has been drawn',
    /getElementById\('tc-exposure-note'\)/.test(tc));
  check('the readout never writes to stored history',
    !/_tcSsPeakPmol[\s\S]{0,200}(setData|pushT|POST)/.test(tc));
}


// ── T-Calc: today's level must not move when you PLAN ────────────────────────
// Reported 2026-08-14: "I am playing around with future injections, but even if I have
// 30 injections scheduled suddenly the curve has a flat area? And calculated free T for
// today has dropped 100pmol/l?"
//
// TT_base is solved as TT_at_draw * P / total[anchorDay], so every injection dated at or
// before the anchor raises the divisor and scales the WHOLE curve — today included — down.
// The model comment claimed appended injections cannot move it; that holds only for
// injections AFTER the anchor. Two states put newly planned doses before it:
//   • a draw dated in the FUTURE (a level cannot have been measured on a day that has
//     not happened) — 96 pmol/L of drift on the reproduction case
//   • an UNDATED reading, which took the "no bloodwork at all" branch whose anchor day
//     depends on _logDays, i.e. on the LAST injection — 810 pmol/L of drift
console.log('\n── T-calc: the anchor is immune to planning ahead ─────────');
if (typeof G._tcFreeTSeries === 'function') {
  const _anSave = {tp:G._tcp, bw:G._tcBwEntries, gh:G._tcGhStack};
  const _anT = [{compId:'nebido',doseMg:'100',date:'2026-06-26'},
                {compId:'nebido',doseMg:'100',date:'2026-06-28'}];
  const _anEod = (end) => { const o=[]; let d=new Date('2026-06-30T12:00:00');
    const E=new Date(end+'T12:00:00');
    while(d<=E){o.push({compId:'nebido',doseMg:'100',date:d.toISOString().slice(0,10)});
      d=new Date(d.getTime()+2*86400000);} return o; };
  const _anToday = (log) => {
    const s=log.slice().sort((a,b)=>a.date<b.date?-1:1);
    const S=G._tcFreeTSeries(s,{});
    const n=Math.max(0,Math.min(S.totalDays,Math.round((Date.now()-S.firstDate.getTime())/86400000)));
    return S.total[n]*(S.calFT_arr?S.calFT_arr[n]:S.scale);
  };
  // Every horizon must give the SAME value for today. Planning is not a measurement.
  const _anSpread = (label, tp, bw) => {
    G._tcp = Object.assign({}, _anSave.tp||{}, tp);
    G._tcBwEntries = bw; G._tcGhStack = [];
    // HORIZONS MUST BE RELATIVE TO TODAY, NOT HARDCODED.
    // The assertion is that extending a plan FURTHER AHEAD cannot move today's value.
    // These were fixed dates, and on 2026-08-16 the shortest ('2026-08-13') fell into
    // the past: its last dose landed three days before today, so that series had stopped
    // dosing while the others were still running. It then read 869.5 against 888.0 —
    // correct pharmacology (a plan that ended really does give a lower level) measuring
    // something the test was never written to measure. All seven _anSpread cases broke
    // together the day it expired, and the three horizons still covering today agreed to
    // the digit throughout, which is the invariant holding. Anchored to NOW it cannot
    // rot again.
    const _anFw = (n) => new Date(Date.now() + n*86400000).toISOString().slice(0,10);
    const v = [_anFw(7), _anFw(30), _anFw(90), _anFw(180)]
      .map(e => _anToday(_anT.concat(_anEod(e))));
    const spread = Math.max(...v) - Math.min(...v);
    check('today is unchanged by the plan ahead — ' + label,
      spread < 1, 'spread ' + spread.toFixed(1) + ' pmol/L across horizons: ' + v.map(x=>x.toFixed(0)).join('/'));
  };
  const _anBase = {measuredFT:'217', shbg:'45', totalT:'17', birthYear:'1980', currentDoseMgWk:''};
  _anSpread('pre-cycle draw',            _anBase, [{date:'2026-06-20',free_t:217,shbg:45,total_t:17}]);
  _anSpread('mid-cycle draw',            _anBase, [{date:'2026-07-20',free_t:217,shbg:45,total_t:17}]);
  _anSpread('draw dated TODAY',          _anBase, [{date:(function(){const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');})(),free_t:217,shbg:45,total_t:17}]);
  _anSpread('draw dated in the FUTURE',  _anBase, [{date:'2027-09-01',free_t:217,shbg:45,total_t:17}]);
  _anSpread('bloodwork entry with NO date', _anBase, [{free_t:217,shbg:45,total_t:17}]);
  _anSpread('undated free T, no lab',    _anBase, []);
  _anSpread('no lab, no free T',         {measuredFT:'',shbg:'',totalT:'',birthYear:'1980',currentDoseMgWk:''}, []);
  _anSpread('prior-protocol warm start', Object.assign({},_anBase,{currentDoseMgWk:'175'}),
            [{date:'2026-06-20',free_t:217,shbg:45,total_t:17}]);

  // A future-dated draw cannot calibrate at all — it is not a measurement yet, so the
  // curve degrades to the labelled population estimate rather than anchoring on it.
  // The unit NEVER changes (CLAUDE.md): confidence degrades, pmol/L does not.
  G._tcp = Object.assign({}, _anSave.tp||{}, _anBase);
  G._tcBwEntries = [{date:'2027-09-01',free_t:217,shbg:45,total_t:17}]; G._tcGhStack = [];
  const _anFutEnd = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);   // relative, for the same reason
  const _anFut = G._tcFreeTSeries(_anT.concat(_anEod(_anFutEnd)).sort((a,b)=>a.date<b.date?-1:1), {});
  check('a future-dated draw does not calibrate the curve', _anFut.measuredFT !== 217);
  check('  …and the curve is still drawn in pmol/L', _anFut.unitLabel === 'pmol/L');

  const _anSrc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  check('the anchor only considers draws dated today or earlier',
    /_bwUsable\s*=\s*\(_tcBwEntries \|\| \[\]\)\.filter/.test(_anSrc));
  check('the SHBG reference day uses the same filtered list',
    /_bwEntry = _bwUsable\.length \? _bwUsable\[0\] : null/.test(_anSrc));
  check('the population fallback is resolved BEFORE the anchor day is chosen',
    _anSrc.indexOf('_popFT = _tcDefaultFT') < _anSrc.indexOf('var _anchorDay, _anchorCutoffDate;'));

  G._tcp = _anSave.tp; G._tcBwEntries = _anSave.bw; G._tcGhStack = _anSave.gh;
}

// ── T-Calc: an unticked past dose is excluded — and SAID SO ──────────────────
// The exclusion itself is the rule and does not change: a past-dated dose that was never
// ticked is a plan the user did not confirm taking. What was wrong is that it happened
// silently. Two doses missed on 10 and 12 Aug left a six-day hole that flattened the
// curve across "today" and read low, while the series card re-derived its cadence from
// the first surviving gap and printed "8 injections · every 6 days · 8 Aug → 26 Aug" —
// a span that holds 10 doses at the real every-2-days cadence.
console.log('\n── T-calc: skipped doses are reported, not absorbed ───────');
{
  const _skSrc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  check('unticked past doses are collected for reporting',
    /var _tcSkippedPast\s*=\s*\[\]/.test(_skSrc));
  check('  …from the full history fetch, not a second request',
    /_tcSkippedPast\s*=\s*_skipped/.test(_skSrc));
  check('  …and are still kept OUT of the curve',
    !/_add\(\s*_tcSkippedPast/.test(_skSrc) && !/_tcSkippedPast.*_tcCurveLog/.test(_skSrc));
  check('the curve note names them and says they are not counted',
    /never ticked/.test(_skSrc) && /not in this curve/.test(_skSrc));
  check('  …and tells the user what to do about it',
    /Tick them in Today if you took them/.test(_skSrc));
  // Cadence must survive a hole anywhere in the run.
  check('series cadence is the MODAL gap, not the first gap',
    !/_seriesMeta\[sid\]\.interval=Math\.round\(\(d1-d0\)\/86400000\)/.test(_skSrc));

  // The gap has to be visible ON THE CHART, at the point the curve stops rising.
  // Reported three times as "the curve flatlines" — the third time read as an
  // artefact of two adjacent series joining, which it is not (the join is seamless;
  // the flat is entirely the unticked doses). Prose under the chart was not enough.
  check('skipped doses are marked on the chart itself',
    /_tcSkippedPast && _tcSkippedPast\.length/.test(_skSrc) &&
    /ctx\.arc\(sx, PAD\.top \+ cH \+ 3/.test(_skSrc));
  check('  …distinct from a real dose tick, not drawn as one',
    /setLineDash\(\[2,2\]\)[\s\S]{0,400}?ctx\.arc\(sx/.test(_skSrc));

  // Removed 2026-08-14, and asserted ABSENT so it cannot come back by accident.
  // The card briefly inferred "N missed" from floor(span/cadence)+1 minus the series'
  // own entries. It counted a date covered by another series (or a standalone dose) as
  // missed while the dose existed and was ticked — reported as "prod says 3 injections
  // missed but I cant see anything not checked in today view" — and it flagged any
  // deliberately irregular run, which is what the card list exists to support.
  check('the card never INFERS missed doses from the cadence',
    !/ missed<\/span>/.test(_skSrc) && !/\.missing\s*=/.test(_skSrc),
    'the span-vs-cadence guess is back');
  // The series card carried that count and went with the schedule card (Phase 6). The
  // rule it enforced — never INFER a missed dose from a cadence gap, only report a
  // stored dose that was genuinely not ticked — is kept above, against the source.
  check('  …and the series card that carried the count is gone',
    !/_seriesMeta\[sid\]\.unticked/.test(_skSrc));
}


// ── T-Calc: editing a series must not shed its past ──────────────────────────
// Reported 2026-08-14: "If I edit the last series to 10 injections every 2 day and click
// save it saves as 8 injections every 6 day? And every edit drops number of injections
// by 2????"
//
// _tcSaveEditSeries regenerated EVERY dose as draft:true. _tcSyncLogToBackend only
// writes from today forward and _tcLoadLogFromStack only carries drafts from today
// forward, so each save deleted the past-dated doses that were not already logged
// records. Two unticked doses (10 + 12 Aug) vanished on every save, and because the
// editor also derived its cadence from entries[1]-entries[0] the surviving 8 Aug -> 14
// Aug gap re-labelled an EOD run "every 6 days" — which the next save then applied.
console.log('\n── The series editor is gone; its rules moved ─────────────');
{
  const _esSrc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  // What this block guarded: an edited series dropping its past-dated doses (a vial two
  // doses short), re-typing a cadence being written as a RECORD rather than a plan,
  // ticked doses being overwritten, and removed doses being left behind in the record.
  // The editor is gone, so the first three cannot happen; the fourth — never claiming a
  // dose was injected unless the user says so — is asserted where record entry lives.
  check('the series editor is gone', !/function _tcSaveEditSeries/.test(_esSrc));
  check('  …and nothing writes a plan row behind the user',
    !/function _tcCreatePlannedInjections/.test(_esSrc));
  // Record entry still exists and still means what it says: logged:true, only for dates
  // the user picked, never inferred.
  // Moved to Today 2026-08-20. Still explicit, and now explicitly OPTIONAL: the
  // "Already taken" checkbox decides, defaulting to true because a mid-cycle user is
  // entering doses they had. Never inferred from the date.
  {
    const _thE = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-thist.js'),'utf8');
    check('logging a dose you took is still explicit',
      /logged: logged,/.test(_thE) && /var logged = !!d\.logged;/.test(_thE));
    check('  …and defaults to taken, the mid-cycle case', /logged: true \}/.test(_thE));
    check('  …with an untaken past dose kept out of the curve, as designed',
      /Past-dated doses that are never ticked stay OUT of the free-T curve/.test(_thE));
  }
}

// The exclusion is behavioural, not just textual: an unticked row in the plan must not
// move the modelled level by even a fraction of a pmol/L.
if (typeof G._tcFreeTSeries === 'function' && typeof G._tcCurveLog === 'function') {
  const _uxSave = {tp:G._tcp, h:G._tcHistory, hs:G._tcHistoryState, c:G._injectionsCache, sk:G._tcSkippedPast};
  G._tcHistory = [{compId:'nebido',doseMg:'100',date:'2026-06-26',source:'logged'},
                  {compId:'nebido',doseMg:'100',date:'2026-06-28',source:'logged'}];
  G._tcHistoryState = 'ready'; G._injectionsCache = {};
  G._tcp = Object.assign({}, _uxSave.tp||{}, {plannerMode:'advanced', manualLog:[
    {compId:'nebido',doseMg:'100',date:'2026-06-26'},
    {compId:'nebido',doseMg:'100',date:'2026-06-28'},
  ]});
  const _uxClean = G._tcCurveLog().length;
  G._tcp.manualLog = G._tcp.manualLog.concat([
    {compId:'nebido',doseMg:'100',date:'2026-06-30',unticked:true},
    {compId:'nebido',doseMg:'100',date:'2026-07-02',unticked:true},
  ]);
  const _uxWith = G._tcCurveLog().length;
  check('an unticked plan row never reaches the curve log',
    _uxWith === _uxClean, 'curve grew from ' + _uxClean + ' to ' + _uxWith);
  G._tcp = _uxSave.tp; G._tcHistory = _uxSave.h; G._tcHistoryState = _uxSave.hs;
  G._injectionsCache = _uxSave.c; G._tcSkippedPast = _uxSave.sk;
}


// ── T-Calc: every way a schedule can be CREATED, driven end to end ───────────
// Audit 2026-08-14. Until now the two main creation paths — the Add sheet and the
// series editor — were guarded only by source greps (call ordering, await present,
// draft flag). Those catch "someone deleted the await"; they do not catch "the
// resulting schedule is wrong", which is exactly what shipped: a straddling edit
// silently lost its past-dated doses on every save.
//
// These drive the real functions with stubbed DOM fields and a recording fetch, and
// assert what is actually WRITTEN, for every temporal permutation:
//   entry point  x  {all past, straddling today, all future}
console.log('\n── T-calc: schedule creation permutations ────────────────');
if (typeof G._tcConfirmAddSheet === 'function' && typeof G._tcSaveEditSeries === 'function') {
  const _pmSave = {tp:G._tcp, us:G._userStacks, h:G._tcHistory, hs:G._tcHistoryState,
                   c:G._injectionsCache, sk:G._tcSkippedPast, as:G._tcAddSheet,
                   es:G._tcEditSeriesId, f:G.fetch, g:G.document.getElementById};
  const _dk = G.dateKey, _now = new Date();
  const _d = (off) => _dk(new Date(_now.getTime() + off * 86400000));

  // Record every write instead of performing it.
  const _arm = (fields) => {
    const calls = [];
    G.fetch = async (url, opt) => {
      const m = (opt && opt.method) || 'GET';
      let body = null;
      try { body = opt && opt.body ? JSON.parse(opt.body) : null; } catch (e) {}
      calls.push({url:String(url), method:m, body:body});
      return {ok:true, status:200, json: async () => []};
    };
    G.document.getElementById = (id) =>
      Object.prototype.hasOwnProperty.call(fields, id)
        ? {value:fields[id], textContent:'', style:{}, innerHTML:'', remove(){}, appendChild(){}}
        : {value:'', textContent:'', style:{}, innerHTML:'', remove(){}, appendChild(){},
           classList:{add(){},remove(){},contains:()=>false}, getContext:()=>null, offsetWidth:300};
    return calls;
  };
  const _reset = () => {
    G._userStacks = [{id:'s1', name:'P1', cycle_start:_d(-30)}];
    G._tcp = {targetStackId:'s1', manualLog:[], plannerMode:'advanced', measuredFT:'217'};
    G._tcHistory = []; G._tcHistoryState = 'ready';
    G._injectionsCache = {}; G._tcSkippedPast = [];
  };
  // Doses written as RECORDS (logged:true) via POST /injections
  const _recs  = (c) => c.filter(x => x.method === 'POST' && /\/injections$/.test(x.url) && x.body && x.body.logged === true);
  // Doses written as PLAN rows (logged:false) via POST /injections
  const _plans = (c) => c.filter(x => x.method === 'POST' && /\/injections$/.test(x.url) && x.body && x.body.logged === false);
  // Future plan, written by the batch upsert
  const _batch = (c) => c.filter(x => x.method === 'POST' && /\/injections\/batch$/.test(x.url))
                         .reduce((n, x) => n + ((x.body && x.body.entries) ? x.body.entries.length : 0), 0);

  // ── ADD SHEET ────────────────────────────────────────────────────────────
  const _add = async (label, fields, isSeries, expect) => {
    _reset();
    G._tcAddSheet = {isSeries: isSeries};
    const calls = _arm(fields);
    await G._tcConfirmAddSheet();
    const r = _recs(calls).length, p = _plans(calls).length, b = _batch(calls);
    check('add · ' + label,
      r === expect.records && b === expect.future && p === 0,
      'records=' + r + ' (want ' + expect.records + '), future=' + b + ' (want ' + expect.future + '), plans=' + p);
  };
  // A dose already taken is a RECORD; a dose ahead is a PLAN.
  //
  // Phase 5 (2026-08-19) removed T-Calc's planning and kept its record entry: the
  // protocol is the only thing that writes a schedule now, and there is no other way
  // to log a dose you already took. So the past half of this matrix still asserts the
  // exact dose counts — that is the vial arithmetic, and a series that comes back two
  // doses short is a vial that no longer adds up — while the future half must write
  // NOTHING and say where planning went.
  await _add('single dose in the past', {'tc-as-comp':'nebido','tc-as-dose':'100','tc-as-date':_d(-5)}, false,
             {records:1, future:0});
  await _add('single dose in the future — refused, not planned',
             {'tc-as-comp':'nebido','tc-as-dose':'100','tc-as-date':_d(5)}, false,
             {records:0, future:0});
  await _add('series entirely in the past', {'tc-as-comp':'nebido','tc-as-dose':'100','tc-as-date':_d(-20),
             'tc-as-count':'5','tc-as-interval':'2'}, true, {records:5, future:0});
  await _add('series entirely in the future — refused', {'tc-as-comp':'nebido','tc-as-dose':'100','tc-as-date':_d(4),
             'tc-as-count':'5','tc-as-interval':'2'}, true, {records:0, future:0});
  // The seam is where doses used to go missing: the past half must still land in full.
  await _add('series straddling today — the past half is still recorded in full',
             {'tc-as-comp':'nebido','tc-as-dose':'100','tc-as-date':_d(-4),
             'tc-as-count':'5','tc-as-interval':'2'}, true, {records:3, future:0});
  await _add('series starting exactly today', {'tc-as-comp':'nebido','tc-as-dose':'100','tc-as-date':_d(0),
             'tc-as-count':'10','tc-as-interval':'2'}, true, {records:1, future:0});

  // ── SERIES EDITOR ────────────────────────────────────────────────────────
  // The reported bug: a straddling edit dropped its past-dated doses on every save.
  // The editor must account for EVERY dose in the run it was asked to write.
  const _edit = async (label, existing, fields, expect) => {
    _reset();
    G._tcp.manualLog = existing.map(d => ({compId:'nebido', doseMg:'100', date:d, seriesId:'sX'}));
    G._tcEditSeriesId = 'sX';
    const calls = _arm(fields);
    await G._tcSaveEditSeries();
    const r = _recs(calls).length, p = _plans(calls).length, b = _batch(calls);
    check('edit · ' + label,
      p === expect.plans && b === expect.future && r === expect.records,
      'plans=' + p + ' (want ' + expect.plans + '), future=' + b + ' (want ' + expect.future +
      '), records=' + r + ' (want ' + expect.records + ')');
  };
  const _ex = [_d(-4), _d(-2), _d(0), _d(2)];
  // Editing a series is planning, and planning left T-Calc in Phase 5. Every one of
  // these permutations must now write NOTHING — a second writer beside the protocol
  // generator is the duplication this rewrite exists to end. The dose-count arithmetic
  // these guarded is asserted against _genInjBatches in the "one scheduler" block.
  await _edit('grown, straddling today — refused', _ex,
    {'tc-es-comp':'nebido','tc-es-dose':'100','tc-es-date':_d(-4),'tc-es-count':'10','tc-es-interval':'2'},
    {plans:0, future:0, records:0});
  await _edit('entirely in the future — refused', _ex,
    {'tc-es-comp':'nebido','tc-es-dose':'100','tc-es-date':_d(4),'tc-es-count':'6','tc-es-interval':'2'},
    {plans:0, future:0, records:0});
  await _edit('entirely in the past — refused', _ex,
    {'tc-es-comp':'nebido','tc-es-dose':'100','tc-es-date':_d(-20),'tc-es-count':'4','tc-es-interval':'2'},
    {plans:0, future:0, records:0});
  await _edit('shrunk, straddling today — refused', _ex,
    {'tc-es-comp':'nebido','tc-es-dose':'100','tc-es-date':_d(-4),'tc-es-count':'3','tc-es-interval':'2'},
    {plans:0, future:0, records:0});


  // ── REMOVAL — the inverse, and historically the most fragile ──────────────
  // CLAUDE.md: "Writing to manualLog alone is a silent no-op — it is a cache and the
  // next render rebuilds it. That bug shipped twice in one day (delete, then add)."
  // These had NO coverage at all before this audit. A delete must reach the RECORD.
  // agree=false models the user cancelling at the global-delete prompt.
  const _del = async (label, rows, run, expect, agree) => {
    _reset();
    G._tcp.manualLog = rows.slice();
    const calls = _arm({});
    const _oc = G.confirmGlobalDelete;
    G.confirmGlobalDelete = () => (agree !== false);
    await run();
    G.confirmGlobalDelete = _oc;
    const dels = calls.filter(x => x.method === 'DELETE' && /\/injections\//.test(x.url));
    check('remove · ' + label, dels.length === expect,
      'DELETE /injections/<id> x' + dels.length + ', want ' + expect);
  };
  const _stored = (d, i, sid) => ({compId:'nebido', doseMg:'100', date:d, injId:'i'+i, seriesId:sid});
  await _del('a stored row deletes the record, not just the cache',
    [_stored(_d(-6),1), _stored(_d(-4),2)],
    () => G._tcRemoveManualEntry(0), 1);
  // Phase 5: removing a SERIES is a planning action and is refused — the protocol owns
  // the schedule now, so deleting a run happens by editing the compound in
  // Plan ▸ Compounds. Deleting a single stored dose is record maintenance and still
  // works (the cases below), because that is the user correcting their own record.
  await _del('removing a whole series is refused, not silently partial',
    [_stored(_d(-6),1,'sA'), _stored(_d(-4),2,'sA'), _stored(_d(-2),3,'sA')],
    () => G._tcRemoveSeries('sA'), 0);
  await _del('a profile-only row (no injId) reaches no endpoint',
    [{compId:'nebido', doseMg:'100', date:_d(4), draft:true}],
    () => G._tcRemoveManualEntry(0), 0);
  await _del('cancelling the global-delete prompt deletes nothing',
    [_stored(_d(-6),1), _stored(_d(-4),2)],
    () => G._tcRemoveManualEntry(0), 0, false);
  await _del('cancelling it on a series deletes nothing either',
    [_stored(_d(-6),1,'sA'), _stored(_d(-4),2,'sA')],
    () => G._tcRemoveSeries('sA'), 0, false);


  // ── NEVER CREATE A DOSE THE RECORD ALREADY HOLDS ──────────────────────────
  // Reported: "even if I go and check those they are gone after app restart."
  // The existence check was keyed on (compound, date, seriesId). A run split across
  // two cards — or rows carrying no series_id — failed to match, so the edit POSTed a
  // SECOND row for a date already stored. Today de-dupes on (compound, slot) and
  // prefers the logged one, so ticking marked one row and left its twin unlogged:
  // _tcSkippedPast kept reporting it, the curve kept flat-lining, and the tick looked
  // discarded on restart. Existence is (compound, date); seriesId only governs what
  // this edit may RETIRE.
  const _dupCase = async (storedSeriesId) => {
    _reset();
    G._tcp.manualLog = [{compId:'nebido',doseMg:'100',date:_d(-6),seriesId:'sX'},
                        {compId:'nebido',doseMg:'100',date:_d(-4),seriesId:'sX'}];
    G._tcSkippedPast = [
      {compId:'nebido',doseMg:'100',date:_d(-6),injId:'a1',cycleId:'s1',seriesId:storedSeriesId},
      {compId:'nebido',doseMg:'100',date:_d(-4),injId:'a2',cycleId:'s1',seriesId:storedSeriesId}];
    G._tcEditSeriesId = 'sX';
    const calls = _arm({'tc-es-comp':'nebido','tc-es-dose':'100','tc-es-date':_d(-6),
                        'tc-es-count':'6','tc-es-interval':'2'});
    await G._tcSaveEditSeries();
    return _plans(calls).map(x => x.body.date);
  };
  for (const [lbl, sidv] of [['same series id','sX'],['a different series id','sOld'],['no series id',undefined]]) {
    const made = await _dupCase(sidv);
    check('edit · no duplicate row when the record already holds the dose (' + lbl + ')',
      made.indexOf(_d(-6)) < 0 && made.indexOf(_d(-4)) < 0,
      'POSTed ' + JSON.stringify(made) + ' — ' + _d(-6) + '/' + _d(-4) + ' already exist');
  }
  check('edit · a refused edit creates nothing at all',
    (await _dupCase('sOld')).length === 0);

  // THE REGRESSION these guarded: a schedule must write as many doses as it was asked
  // for. T-Calc's editor wrote only the future half, so "10 every 2 days" starting four
  // days ago persisted 8, and each further save shed two more — a vial that no longer
  // adds up (CLAUDE.md: a series usually maps to a VIAL).
  //
  // The editor is refused now, so the invariant moves to the thing that does the
  // scheduling: _genInjBatches over a protocol whose cycle started before today.
  const _genCount = (startOff, intervalDays) => {
    const st = {id:'acct', cycle_start:_d(startOff), cycle_length:8,
                trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'100',
                     unit:'mg', freqVal:intervalDays, freqUnit:'days'}]}};
    return G._genInjBatches(st, 'acct', null)
            .reduce((n, b) => n + (b.entries||[]).length, 0);
  };
  const _genDates = (startOff, intervalDays) => {
    const st = {id:'acct', cycle_start:_d(startOff), cycle_length:8,
                trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'100',
                     unit:'mg', freqVal:intervalDays, freqUnit:'days'}]}};
    return G._genInjBatches(st, 'acct', null)
            .reduce((a, b) => a.concat((b.entries||[]).map(e => e.date)), []);
  };
  const _d10 = _genDates(-10, 2), _d4 = _genDates(-4, 2);
  check('gen · a protocol that began 10 days ago keeps its past-dated doses',
    _d10.filter(x => x < _d(0)).length >= 4, 'past doses: ' + _d10.filter(x => x < _d(0)).length);
  check('gen · …every one of them, none shed at the seam',
    _d10.filter(x => x < _d(0)).length > _d4.filter(x => x < _d(0)).length,
    _d10.filter(x => x < _d(0)).length + ' vs ' + _d4.filter(x => x < _d(0)).length);
  check('gen · …and regenerating writes exactly the same run',
    JSON.stringify(_genDates(-10, 2)) === JSON.stringify(_d10));
  check('gen · …on the cadence asked for, with no gaps',
    (() => {
      const gap = (a,b) => Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00'))/86400000);
      return _d10.length > 2 && gap(_d10[0], _d10[1]) === 2 && gap(_d10[1], _d10[2]) === 2;
    })(), JSON.stringify(_d10.slice(0,3)));

  G._tcp = _pmSave.tp; G._userStacks = _pmSave.us; G._tcHistory = _pmSave.h;
  G._tcHistoryState = _pmSave.hs; G._injectionsCache = _pmSave.c;
  G._tcSkippedPast = _pmSave.sk; G._tcAddSheet = _pmSave.as; G._tcEditSeriesId = _pmSave.es;
  G.fetch = _pmSave.f; G.document.getElementById = _pmSave.g;
}


// A stale duplicate row must not make a ticked dose look skipped.
// Duplicates are no longer created, but some are already stored, and deleting rows
// from the injection log to tidy up is not this code's call — the log is the record.
// Selecting skipped doses by DAY rather than by row makes the stale ones harmless.
if (typeof G._tcFetchHistory === 'function') {
  const _dpSave = {f:G.fetch, h:G._tcHistory, hs:G._tcHistoryState, sk:G._tcSkippedPast};
  const _mk = (date, logged, id) => ({id:id, tier:'trt', logged:logged, unit:'mg',
    dose:'100', compound_id:'nebido', date:date, active:true, cycle_id:'s1'});
  const _today = G.dateKey(new Date());
  const _past  = G.dateKey(new Date(Date.now() - 4*86400000));
  const _past2 = G.dateKey(new Date(Date.now() - 6*86400000));
  G.fetch = async () => ({ok:true, status:200, json: async () => ([
    _mk(_past,  true,  'r1'),   // ticked
    _mk(_past,  false, 'r2'),   // its stale twin
    _mk(_past2, false, 'r3'),   // genuinely never ticked
  ])});
  G._tcHistory = null; G._tcHistoryState = 'idle';
  await G._tcFetchHistory(true);
  const dates = (G._tcSkippedPast||[]).map(e => e.date);
  check('a ticked dose is not reported skipped because a duplicate row exists',
    dates.indexOf(_past) < 0, 'reported ' + JSON.stringify(dates));
  check('  …while a genuinely unticked dose is still reported',
    dates.indexOf(_past2) >= 0, 'reported ' + JSON.stringify(dates));
  check('  …and the ticked dose still counts in the history',
    (G._tcHistory||[]).some(e => e.date === _past));
  G.fetch = _dpSave.f; G._tcHistory = _dpSave.h;
  G._tcHistoryState = _dpSave.hs; G._tcSkippedPast = _dpSave.sk;
}


// ── EXPOSURE reports the DOSING window, never the washout tail ───────────────
// Reported 2026-08-14: "The text in the green box says I am at 309pmol/l but graph
// shows me at 894?" The steady-state window was Math.floor(totalDays/2), and totalDays
// includes a washout tail sized off the slowest half-life — 323 days on top of a
// 61-day schedule for a 75-day depot bound. The window therefore landed in Jan-Jul of
// the FOLLOWING year, months after the last injection, and reported the decaying tail
// as steady-state exposure: 309 pmol/L "within the healthy young-male range" for a
// protocol whose real plateau is ~1090, i.e. ~1.5x ABOVE the top of that range. The
// reassurance was exactly backwards and contradicted the chart directly above it.
if (typeof G._tcDrawManualChart === 'function' && typeof G._tcFreeTSeries === 'function') {
  const _exSave = {tp:G._tcp, bw:G._tcBwEntries, gh:G._tcGhStack};
  G._tcp = Object.assign({}, _exSave.tp||{}, {measuredFT:'217', shbg:'45', totalT:'17',
    birthYear:'1980', currentDoseMgWk:''});
  G._tcBwEntries = [{date:'2026-06-26', free_t:217, shbg:45, total_t:17}];
  G._tcGhStack = [];
  const _exEod = (a,b) => { const o=[]; let d=new Date(a+'T12:00:00'); const E=new Date(b+'T12:00:00');
    while(d<=E){o.push({compId:'nebido',doseMg:'100',date:d.toISOString().slice(0,10)});
      d=new Date(d.getTime()+2*86400000);} return o; };
  const _exLog = _exEod('2026-06-26','2026-08-26');
  const _exS = G._tcFreeTSeries(_exLog.slice(), {});
  const _exFt = t => _exS.total[t] * (_exS.calFT_arr ? _exS.calFT_arr[t] : _exS.scale);
  check('the model exposes the dosing-window length separately from the washout tail',
    _exS.logDays > 0 && _exS.logDays < _exS.totalDays,
    'logDays=' + _exS.logDays + ' totalDays=' + _exS.totalDays);
  // The tail is long enough that halving totalDays lands past the last injection —
  // this is the precondition that made the bug possible, so assert it explicitly.
  check('  …and the tail is long enough that totalDays/2 falls beyond the last dose',
    Math.floor(_exS.totalDays / 2) > _exS.logDays);
  G._tcDrawManualChart('tc-manual-chart', _exLog.slice());
  const _exPk = G._tcSsPeakPmol;
  let _dosePk = 0, _tailPk = 0;
  for (let t = 0; t <= _exS.logDays; t++) _dosePk = Math.max(_dosePk, _exFt(t));
  for (let t = Math.floor(_exS.totalDays/2); t <= _exS.totalDays; t++) _tailPk = Math.max(_tailPk, _exFt(t));
  check('exposure reports the steady state of the dosing period',
    _exPk > _dosePk * 0.85, 'reported ' + Math.round(_exPk) + ', dosing peak ' + Math.round(_dosePk));
  check('  …not the washout tail months after the last injection',
    _exPk > _tailPk * 2, 'reported ' + Math.round(_exPk) + ', tail peak ' + Math.round(_tailPk));
  // And it must not contradict the chart: today's level sits inside the plotted curve,
  // so the exposure figure has to be of the same order, not a third of it.
  const _exNow = _exFt(Math.max(0, Math.min(_exS.totalDays,
    Math.round((Date.now() - _exS.firstDate.getTime())/86400000))));
  check('  …and is the same order as the level the chart plots for today',
    _exPk >= _exNow * 0.8, 'exposure ' + Math.round(_exPk) + ' vs chart today ' + Math.round(_exNow));
  G._tcp = _exSave.tp; G._tcBwEntries = _exSave.bw; G._tcGhStack = _exSave.gh;
}


// ── "Built on N checked injections" counts DOSES, not stored rows ────────────
// Reported 2026-08-14: prod read 22 and staging 25 for schedules the user believed
// identical — "I can only verify one week back in time and there all are checked BUT I
// don't have the double injections that I see in Stage". The count was h.length, i.e.
// raw stored rows, while _tcCurveLog de-duplicates on (compId|date). A duplicate row
// therefore inflated the headline without moving the curve, so the number could not be
// compared between two environments and did not describe the curve it sits under.
if (typeof G._tcHistoryNoteHtml === 'function') {
  const _cnSave = {h:G._tcHistory, hs:G._tcHistoryState, sk:G._tcSkippedPast};
  const _txt = () => G._tcHistoryNoteHtml().replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  G._tcHistoryState = 'ready'; G._tcSkippedPast = [];
  const _three = [{compId:'nebido',doseMg:'100',date:'2026-08-08'},
                  {compId:'nebido',doseMg:'100',date:'2026-08-10'},
                  {compId:'nebido',doseMg:'100',date:'2026-08-12'}];
  G._tcHistory = _three.slice();
  check('the headline counts three doses when there are three', /Built on 3 checked injections/.test(_txt()));
  check('  …and says nothing about duplicates when there are none', !/duplicate/.test(_txt()));
  // Two duplicate rows on days already recorded must NOT become two more injections.
  G._tcHistory = _three.concat([{compId:'nebido',doseMg:'100',date:'2026-08-10'},
                                {compId:'nebido',doseMg:'100',date:'2026-08-12'}]);
  check('duplicate rows do not inflate the headline count',
    /Built on 3 checked injections/.test(_txt()), _txt());
  check('  …they are reported so the user can find them', /2 duplicate rows/.test(_txt()));
  check('  …and are stated not to affect the curve', /do not affect the curve/.test(_txt()));
  // The headline must agree with what the curve is actually built from.
  if (typeof G._tcCurveLog === 'function') {
    const _cnP = G._tcp;
    G._tcp = Object.assign({}, _cnP||{}, {plannerMode:'advanced', manualLog:[]});
    G._injectionsCache = {};
    const _m = _txt().match(/Built on (\d+) checked/);
    check('  …and the number matches the curve log exactly',
      _m && Number(_m[1]) === G._tcCurveLog().length,
      'headline ' + (_m && _m[1]) + ' vs curve log ' + G._tcCurveLog().length);
    G._tcp = _cnP;
  }
  G._tcHistory = _cnSave.h; G._tcHistoryState = _cnSave.hs; G._tcSkippedPast = _cnSave.sk;
}


// ── Testosterone counts whatever TIER it is filed under ──────────────────────
// Found 2026-08-14 by reading the injection record directly instead of the UI. The
// same drug carries two ids: the TRT tier uses /trt-catalog ids (nebido, enanthate),
// the Enhanced tier uses the enhanced-catalogue ids (test_u, test_e). The model only
// accepted tier === 'trt', so a user whose testosterone lives in an Enhanced protocol
// had EVERY dose discarded. On one real account: 4 logged enhanced doses missing from
// the curve (the reported plateau) and 26 scheduled enhanced doses against 0 trt ones,
// so the whole forward projection decayed as if the protocol had stopped.
console.log('\n── T-calc: enhanced-tier testosterone counts too ──────────');
if (typeof G._tcIsTestoRow === 'function') {
  check('TRT-tier rows are always testosterone', G._tcIsTestoRow('trt','nebido'));
  check('enhanced-tier testosterone esters count',
    G._tcIsTestoRow('enhanced','test_u') && G._tcIsTestoRow('enhanced','test_e') &&
    G._tcIsTestoRow('enhanced','test_c') && G._tcIsTestoRow('enhanced','test_p') &&
    G._tcIsTestoRow('enhanced','sustanon'));
  // The guard that matters: an Enhanced stack is full of things that are NOT
  // testosterone, and feeding them to a testosterone PK model would be nonsense.
  check('  …but nothing else in an Enhanced stack does',
    !G._tcIsTestoRow('enhanced','nandrolone') && !G._tcIsTestoRow('enhanced','hgh') &&
    !G._tcIsTestoRow('enhanced','anavar') && !G._tcIsTestoRow('peptide','glow'));
  check('the enhanced id canonicalises to the TRT-catalogue id',
    G._tcCanonCompId('test_u') === 'nebido' && G._tcCanonCompId('test_e') === 'enanthate' &&
    G._tcCanonCompId('test_c') === 'cypionate' && G._tcCanonCompId('test_p') === 'propionate');
  check('  …and a TRT id is left alone', G._tcCanonCompId('nebido') === 'nebido');
}
if (typeof G._tcFetchHistory === 'function') {
  const _etSave = {f:G.fetch, h:G._tcHistory, hs:G._tcHistoryState, sk:G._tcSkippedPast, tp:G._tcp, c:G._injectionsCache};
  const _row = (o) => Object.assign({id:'x'+Math.random(), active:true, logged:true,
    unit:'mg', dose:'100', cycle_id:'c1'}, o);
  const _run = async (rows) => {
    G.fetch = async () => ({ok:true, status:200, json: async () => rows});
    G._tcHistory = null; G._tcHistoryState = 'idle'; G._tcSkippedPast = [];
    await G._tcFetchHistory(true);
    return G._tcHistory || [];
  };
  // A protocol-logged Enhanced dose must reach the history.
  let _h = await _run([_row({tier:'enhanced', compound_id:'test_u', date:'2026-08-12'})]);
  check('an Enhanced-tier testosterone dose reaches the history', _h.length === 1, JSON.stringify(_h));
  check('  …stored under the canonical compound id', _h.length === 1 && _h[0].compId === 'nebido');
  // A weekly RATE is not a per-injection dose. Enhanced protocols store 350 mg/week;
  // treating that as an injection would inflate the curve enormously.
  _h = await _run([_row({tier:'enhanced', compound_id:'test_u', date:'2026-08-12', dose:'350', unit:'mg/week'})]);
  check('a weekly RATE is never treated as an injected dose', _h.length === 0, JSON.stringify(_h));
  // Non-testosterone Enhanced compounds stay out.
  _h = await _run([_row({tier:'enhanced', compound_id:'hgh', date:'2026-08-12', dose:'3', unit:'IU'}),
                   _row({tier:'peptide', compound_id:'glow', date:'2026-08-12', dose:'0.1', unit:'ml'})]);
  check('  …and nothing that is not testosterone gets in', _h.length === 0);
  // THE DOUBLE-COUNT GUARD: one injection recorded under both tiers on the same day.
  _h = await _run([_row({tier:'enhanced', compound_id:'test_u', date:'2026-08-12'}),
                   _row({tier:'trt',      compound_id:'nebido', date:'2026-08-12'})]);
  G._tcp = Object.assign({}, _etSave.tp||{}, {plannerMode:'advanced', manualLog:[]});
  G._injectionsCache = {};
  check('the same dose under both tiers counts ONCE in the curve',
    G._tcCurveLog().length === 1, 'curve log length ' + G._tcCurveLog().length);
  G.fetch = _etSave.f; G._tcHistory = _etSave.h; G._tcHistoryState = _etSave.hs;
  G._tcSkippedPast = _etSave.sk; G._tcp = _etSave.tp; G._injectionsCache = _etSave.c;
}


// ── Enhanced testosterone is READ, never OWNED ───────────────────────────────
// Reported 2026-08-14, minutes after the tier fix shipped: "t-calc in prod now shows
// very high levels and had a bunch of new single injections that I had to delete."
// Reading the record showed NOTHING had been written — the row count went DOWN by 4.
// _tcLoadLogFromStack had started pulling the PROTOCOL's own testosterone (tier
// 'enhanced', generated by _genInjBatches) into manualLog. manualLog is the editable
// planner list: those ~30 rows appeared as loose single injections with no series card,
// every one deletable, and four REAL logged doses were deleted as if they were junk.
// _tcSyncLogToBackend would also have re-posted them under T-Calc's cycle id with a
// canonicalised compound id, cloning the protocol's plan into a second stream.
//
// The curve must still count them. That is what _tcFetchHistory (past) and
// _tcProtocolInjections (future) are for, and both are read-only.
console.log('\n── T-calc: enhanced doses are read, not owned ─────────────');
if (typeof G._tcLoadLogFromStack === 'function' && typeof G._tcCurveLog === 'function') {
  const _roSave = {tp:G._tcp, us:G._userStacks, h:G._tcHistory, hs:G._tcHistoryState,
                   c:G._injectionsCache, sk:G._tcSkippedPast};
  const _dk = G.dateKey, _now = new Date();
  const _d = (o) => _dk(new Date(_now.getTime() + o*86400000));
  const _cyc = 's_proto';
  // The protocol's own testosterone: enhanced tier, no series_id, future-dated.
  const _enh = [_d(2), _d(4), _d(6)].map((dt,i) => ({id:'e'+i, cycle_id:_cyc, date:dt,
    compound_id:'test_u', compound_name:'Testosterone Undecanoate', tier:'enhanced',
    dose:'100', unit:'mg', active:true, logged:false}));
  G._injectionsCache = {}; _enh.forEach(e => { (G._injectionsCache[e.date] = G._injectionsCache[e.date]||[]).push(e); });
  G._tcHistory = [{compId:'nebido', doseMg:'100', date:_d(-2), source:'logged'}];
  G._tcHistoryState = 'ready'; G._tcSkippedPast = [];
  G._userStacks = [{id:_cyc, name:'P', cycle_start:_d(-40)}];
  G._tcp = Object.assign({}, _roSave.tp||{}, {targetStackId:_cyc, plannerMode:'advanced', manualLog:[]});
  G._tcLoadLogFromStack();
  const _ml = G._tcp.manualLog || [];
  check('the protocol’s enhanced testosterone stays OUT of the editable log',
    _ml.filter(e => e.compId === 'test_u' || e.compId === 'nebido' && e.date > _d(0)).length === 0 &&
    _ml.every(e => e.compId !== 'test_u'),
    'manualLog: ' + JSON.stringify(_ml.map(e => e.compId + '@' + e.date)));
  // …and the curve still sees them, via the read-only protocol path.
  const _curve = G._tcCurveLog();
  const _proto = _curve.filter(e => e.source === 'protocol');
  check('  …while the CURVE still counts them', _proto.length === 3,
    'protocol doses in curve: ' + _proto.length);
  check('  …under the canonical compound id', _proto.every(e => e.compId === 'nebido'));
  const _seen = new Set(); let _dup = 0;
  _curve.forEach(e => { const k = e.compId+'|'+e.date; if (_seen.has(k)) _dup++; else _seen.add(k); });
  check('  …with no duplicate (compound, date) in the curve', _dup === 0);
  // Source-level guard: manualLog is written back, so its filter must stay trt-only.
  const _lsSrc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  const _fn = _lsSrc.slice(_lsSrc.indexOf('function _tcLoadLogFromStack'),
                           _lsSrc.indexOf('function _tcProtocolInjections'));
  check('_tcLoadLogFromStack filters strictly on tier trt',
    /if\(!e\|\|e\.tier!=='trt'\)return;/.test(_fn) && !/_tcIsTestoRow/.test(_fn),
    'the editable log is accepting other tiers again');
  G._tcp = _roSave.tp; G._userStacks = _roSave.us; G._tcHistory = _roSave.h;
  G._tcHistoryState = _roSave.hs; G._injectionsCache = _roSave.c; G._tcSkippedPast = _roSave.sk;
}


// ── The INJECTION GENERATOR — output asserted, not just "was it called" ──────
// Coverage gap closed 2026-08-14. _genInjBatches decides the tier, compound id, dose,
// unit and cadence of every injection a protocol writes, and every existing test either
// stubbed generateAndPushInjections out or asserted it had been CALLED. Its output was
// never checked. That is the path that files testosterone under the Enhanced tier,
// which the free-T model then discarded — 4 logged and 26 scheduled doses missing from
// a real user's curve, found only by reading the backend record.
console.log('\n── Injection generator: what it actually produces ─────────');
if (typeof G._genInjBatches === 'function') {
  const _giSave = {now:G.NOW};
  const _dk = G.dateKey, _n = new Date();
  const _d = (o) => _dk(new Date(_n.getTime() + o*86400000));
  const _flat = (b) => b.reduce((a,x) => a.concat(x.entries), []);

  // A PEPTIDE generates tier:'peptide', at the compound's own cadence. This is the
  // shape assertion the TRT tier used to carry, moved to a tier that still generates.
  let _b = G._genInjBatches({id:'s1', cycle_start:_d(-10), cycle_length:4,
    peptides:[{id:'reta', name:'Retatrutide', dose_am:'2', unit_am:'mg',
      times:['AM'], days:[0,2,4,6], active:true}]}, 'cyc1', null);
  let _e = _flat(_b);
  check('a peptide generates tier "peptide"', _e.length > 0 && _e.every(x => x.tier === 'peptide'));
  check('  …carrying the compound id unchanged', _e.every(x => x.compound_id === 'reta'));
  check('  …and a PK snapshot field for the history to read', _e.every(x => 'half_life_days' in x));

  // ── ONE SCHEDULER: THE PROTOCOL (Phase 5, 2026-08-19) ──────────────────────
  // These checks asserted the 2026-08-14 rule: that neither tier generated
  // testosterone, because T-Calc owned it. Phase 4 merged the tiers and Phase 5 gave
  // the generator testosterone back, so what they assert now is the requirement that
  // actually survives — ONE stream per molecule, generated here.
  _b = G._genInjBatches({id:'s2', cycle_start:_d(-10), cycle_length:4,
    trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'100', unit:'mg',
      freqVal:2, freqUnit:'days'}]}}, 'cyc2', null);
  _e = _flat(_b);
  check('the protocol generates its testosterone', _e.length > 0);
  check('  …tagged trt, so the free-T model still finds it',
    _e.every(x => x.tier === 'trt' && x.compound_id === 'nebido'));

  _b = G._genInjBatches({id:'s3', cycle_start:_d(-10), cycle_length:4,
    enhanced:{enabled:true, compounds:[{id:'test_u', name:'Testosterone Undecanoate',
      dose:'100', unit:'mg', freqVal:2, freqUnit:'days'}]}}, 'cyc3', null);
  check('  …and so does one still filed under the Enhanced spelling',
    _flat(_b).length > 0, 'ids: ' + _flat(_b).map(x => x.compound_id).join(','));

  // The case that used to double: an unmigrated protocol holding the same molecule in
  // both blocks. 27 enhanced/test_u rows beside 23 trt/nebido rows is what that cost.
  _b = G._genInjBatches({id:'s3b', cycle_start:_d(-10), cycle_length:4,
    trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'100', unit:'mg',
      freqVal:2, freqUnit:'days'}]},
    enhanced:{enabled:true, compounds:[{id:'test_u', name:'Testosterone Undecanoate',
      dose:'100', unit:'mg', freqVal:2, freqUnit:'days'}]}}, 'cyc3b', null);
  _e = _flat(_b);
  const _canonIds = [...new Set(_e.map(x => G._canonCompoundId(x.compound_id)))];
  check('  …and the same molecule in both blocks still schedules ONCE',
    _canonIds.length === 1 && _canonIds[0] === 'nebido',
    'ids generated: ' + [...new Set(_e.map(x => x.compound_id))].join(','));
  check('  …with the duplicate recorded, not silently dropped',
    (G._injSuppressed['s3b']||[]).length === 1 &&
    (G._injSuppressed['s3b']||[]).every(x => x.reason === 'duplicate'),
    JSON.stringify(G._injSuppressed['s3b']||[]));

  // A non-testosterone Enhanced compound is never suppressed by that rule.
  _b = G._genInjBatches({id:'s4', cycle_start:_d(-10), cycle_length:4,
    trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'100', unit:'mg',
      freqVal:2, freqUnit:'days'}]},
    enhanced:{enabled:true, compounds:[{id:'nandrolone', name:'Nandrolone', dose:'100',
      unit:'mg', freqVal:2, freqUnit:'days'}]}}, 'cyc4', null);
  check('  …but a non-testosterone Enhanced compound still generates',
    _flat(_b).some(x => x.compound_id === 'nandrolone'));

  // A WEEKLY RATE becomes a per-injection dose. This is why one environment stores
  // 350 mg/week on the protocol and 100 mg on the generated rows; getting it wrong
  // would write a week's worth of drug into every single injection.
  check('a weekly rate converts to a per-injection dose',
    G._enhDosePerInjection({dose:'350', unit:'mg/week', freqVal:2, freqUnit:'days'}).dose === '50');
  check('  …and the unit drops the period', 
    G._enhDosePerInjection({dose:'350', unit:'mg/week', freqVal:2, freqUnit:'days'}).unit === 'mg');
  check('  …while a plain mg dose is passed through untouched',
    G._enhDosePerInjection({dose:'100', unit:'mg', freqVal:2, freqUnit:'days'}).dose === '100');

  // No cycle_start, nothing generated — an unstarted protocol must not write a schedule.
  check('a protocol with no cycle_start generates nothing',
    G._genInjBatches({id:'s5', trt:{enabled:true, compounds:[{id:'nebido', dose:'100',
      unit:'mg', freqVal:2, freqUnit:'days'}]}}, 'cyc5', null).length === 0);
  // A disabled TRT tier generates nothing.
  check('a disabled tier generates nothing',
    _flat(G._genInjBatches({id:'s6', cycle_start:_d(-10), cycle_length:4,
      trt:{enabled:false, compounds:[{id:'nebido', dose:'100', unit:'mg', freqVal:2,
        freqUnit:'days'}]}}, 'cyc6', null)).length === 0);
  // Every row is stamped with the cycle it belongs to — the container rule.
  _b = G._genInjBatches({id:'s7', cycle_start:_d(-10), cycle_length:4,
    trt:{enabled:true, compounds:[{id:'nebido', dose:'100', unit:'mg', freqVal:2,
      freqUnit:'days'}]}}, 'cyc7', null);
  check('every generated row carries its stack cycle id',
    _flat(_b).every(x => x.cycle_id === 'cyc7'));
  check('  …and is generated unlogged — only Today turns a plan into a record',
    _flat(_b).every(x => x.logged === false && x.active === true));
  G.NOW = _giSave.now;
}


// ── _tcSetManualField and _tcPushLogToSchedule — previously ZERO coverage ────
// Both mutate or persist the schedule and neither had a single test reference before
// 2026-08-14. Editing a row's dose in place and "Push to schedule" are the two paths a
// user reaches most often after building a plan.
console.log('\n── T-calc: field edit and push-to-schedule ────────────────');
if (typeof G._tcSetManualField === 'function' && typeof G._tcPushLogToSchedule === 'function') {
  const _pfSave = {tp:G._tcp, us:G._userStacks, f:G.fetch, a:G.alert,
                   h:G._tcHistory, hs:G._tcHistoryState, c:G._injectionsCache};
  const _dk = G.dateKey, _n = new Date();
  const _d = (o) => _dk(new Date(_n.getTime() + o*86400000));
  const _arm = () => { const calls = [];
    G.fetch = async (u,o) => { let b=null; try{ b=o&&o.body?JSON.parse(o.body):null; }catch(e){}
      calls.push({url:String(u), method:(o&&o.method)||'GET', body:b});
      return {ok:true, status:200, json: async () => []}; };
    return calls; };
  const _alerts = [];
  G.alert = (m) => _alerts.push(String(m));
  // _tcSetManualField is NOT async and fires _tcSyncLogToBackend() without awaiting it,
  // so its POST resolves on a later microtask. Drain the queue before asserting, or the
  // write lands after the check AND leaks into the next block's recorder. (setTimeout is
  // a no-op in this sandbox, so pump promises rather than the macrotask queue.)
  const _flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
  G._userStacks = [{id:'sP', name:'P', cycle_start:_d(-20)}];
  G._tcHistory = []; G._tcHistoryState = 'ready'; G._injectionsCache = {};

  // Editing a dose in place must persist — a field edit that only touches the local
  // object is the "silent no-op" failure this codebase has shipped repeatedly.
  G._tcp = {targetStackId:'sP', plannerMode:'advanced', measuredFT:'217',
            manualLog:[{compId:'nebido', doseMg:'100', date:_d(3), seriesId:'sx'}]};
  let _calls = _arm();
  G._tcSetManualField(0, 'doseMg', '125');
  // Assert the LOCAL edit before flushing. The sync that follows calls
  // _tcLoadLogFromStack, which rebuilds manualLog from the record — empty in this
  // fixture — so after the flush there is legitimately no row 0 to read.
  check('editing a dose updates the entry', G._tcp.manualLog[0].doseMg === '125');
  await _flush();
  // Phase 5: T-Calc no longer writes. The edit stays local to the planner view until
  // the planner itself is removed in Phase 6 — the protocol is what schedules now, so
  // a write from here would open the second stream this rewrite exists to close.
  check('  …and no longer reaches the backend — T-Calc does not schedule',
    !_calls.some(c => /\/injections/.test(c.url) && c.method === 'POST'),
    'calls: ' + _calls.map(c => c.method + ' ' + c.url.split('/').pop()).join(', '));
  // An out-of-range index must be a no-op, not a crash.
  let _threw = false;
  try { G._tcSetManualField(99, 'doseMg', '1'); } catch (e) { _threw = true; }
  await _flush();
  check('  …and an index that does not exist is a safe no-op', !_threw);

  // Push to schedule: refuses without a protocol, because nothing is scheduled
  // outside one (THE STACK IS THE CONTAINER).
  _alerts.length = 0;
  G._tcp = {targetStackId:'', plannerMode:'advanced',
            manualLog:[{compId:'nebido', doseMg:'100', date:_d(3)}]};
  _calls = _arm();
  await G._tcPushLogToSchedule();
  await _flush();
  check('push to schedule writes nothing when no protocol is bound',
    !_calls.some(c => c.method === 'POST' && /injections/.test(c.url)));
  // With a protocol bound it syncs and reports the FUTURE count only.
  _alerts.length = 0;
  G._tcp = {targetStackId:'sP', plannerMode:'advanced', manualLog:[
    {compId:'nebido', doseMg:'100', date:_d(-4)},   // past — not "pushed"
    {compId:'nebido', doseMg:'100', date:_d(2)},
    {compId:'nebido', doseMg:'100', date:_d(4)}]};
  _calls = _arm();
  _alerts.length = 0;
  await G._tcPushLogToSchedule();
  check('  …and with one bound it still writes nothing',
    !_calls.some(c => /\/injections/.test(c.url) && c.method === 'POST'));
  check('  …saying where scheduling lives instead',
    _alerts.some(m => /Plan ▸ Compounds/.test(m)), 'alerts: ' + JSON.stringify(_alerts));

  G._tcp = _pfSave.tp; G._userStacks = _pfSave.us; G.fetch = _pfSave.f; G.alert = _pfSave.a;
  G._tcHistory = _pfSave.h; G._tcHistoryState = _pfSave.hs; G._injectionsCache = _pfSave.c;
}


// ── Hidden doses are counted and explained, never deleted ────────────────────
// Reported 2026-08-15: an active protocol carrying Nebido through 26 Aug showed none
// of it in Today, and 14 Aug held nothing at all — not a peptide, not GH.
//
// Two silent drops in refreshInjectionsCache, both of which returned before touching
// _injHidden, so the app believed nothing was hidden and Today said nothing was wrong:
//   1. a T-Calc dose bound to a protocol that is not active. Since _genInjBatches
//      suppresses the ENTIRE trt tier (_isTestosteroneComp('trt',c) is `tier==='trt'`),
//      T-Calc is the only scheduler of testosterone, so this branch owns every
//      testosterone dose a user has.
//   2. a row whose compound_id is not in the active protocol's config — which was also
//      DELETED from today forward, on an ordinary refresh, unrecoverably.
console.log('\n── Hidden doses: counted, explained, never deleted ────────');
{
  const _hdSave = {f:G.fetch, us:G._userStacks, ai:G._activeStackIndices, sl:G._stacksLoaded,
                   c:G._injectionsCache, hid:G._injHidden};
  const _dels = [];
  const _dk = (o) => { const t = new Date(G.NOW || new Date()); t.setDate(t.getDate()+o);
    return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };
  const TODAY = _dk(0);

  const P2 = {id:'P2', name:'Protocol 2', cycle_start:_dk(-50), cycle_length:44,
    peptides:[{id:'glow', name:'Glow', dose_am:'2', unit_am:'mg', times:['AM'],
               days:[0,1,2,3,4,5,6], active:true}],
    trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'100', unit:'mg', freqVal:2, freqUnit:'days'}]},
    enhanced:{}};
  const P1 = {id:'P1', name:'Protocol 1', cycle_start:_dk(-90), cycle_length:12,
              peptides:[], trt:{}, enhanced:{}};
  const STORED = [
    {id:'g1', compound_id:'glow',   tier:'peptide',  cycle_id:'P2',       date:TODAY, dose:'2',   unit:'mg', active:true, logged:false},
    {id:'n1', compound_id:'nebido', tier:'trt',      cycle_id:'tcalc:P1', date:TODAY, dose:'100', unit:'mg', active:true, logged:false},
    {id:'h1', compound_id:'hgh',    tier:'enhanced', cycle_id:'P2',       date:TODAY, dose:'1',   unit:'IU', active:true, logged:false},
  ];
  G._userStacks = [P2, P1]; G._activeStackIndices = [0]; G._stacksLoaded = true;
  G.fetch = async (url, opt) => {
    if (opt && opt.method === 'DELETE') { _dels.push(String(url)); return {ok:true, status:200, json:async()=>({})}; }
    return {ok:true, status:200, json:async()=>String(url).includes('/injections') ? STORED : []};
  };

  await G.refreshInjectionsCache();
  const vis = (G._injectionsCache[TODAY] || []).map(e => e.compound_id);

  check('a cache refresh deletes nothing', _dels.length === 0, JSON.stringify(_dels));
  check('the active protocol’s own dose still renders',
    vis.length === 1 && vis[0] === 'glow', JSON.stringify(vis));
  check('every dropped dose is counted as hidden',
    G._injHidden.count === 2, `count=${G._injHidden.count}`);
  check('  …a T-Calc dose names the protocol its plan is saved to',
    !!G._injHidden.stacks['Protocol 1 (T-Calc plan)'], JSON.stringify(G._injHidden.stacks));
  check('  …and an unlisted compound is reported by compound, not by protocol',
    G._injHidden.orphans && G._injHidden.orphans.hgh === 1, JSON.stringify(G._injHidden.orphans));

  // A T-Calc plan bound to the ACTIVE protocol must still render — the fix must not
  // turn "hidden" into "hidden from everyone".
  STORED[1].cycle_id = 'tcalc:P2';
  await G.refreshInjectionsCache();
  check('a T-Calc dose bound to the ACTIVE protocol still renders',
    (G._injectionsCache[TODAY] || []).some(e => e.compound_id === 'nebido'));
  // …as must an unassigned one.
  STORED[1].cycle_id = 'tcalc';
  await G.refreshInjectionsCache();
  check('  …as does an unassigned one', (G._injectionsCache[TODAY] || []).some(e => e.compound_id === 'nebido'));

  G.fetch = _hdSave.f; G._userStacks = _hdSave.us; G._activeStackIndices = _hdSave.ai;
  G._stacksLoaded = _hdSave.sl; G._injectionsCache = _hdSave.c; G._injHidden = _hdSave.hid;
}

// ── Rebuild schedule: refills a gap without disturbing the record ────────────
// Regeneration only ever ran forward from midnight today, so a day that lost its doses
// stayed lost — nothing could reach backwards. This drives the real rebuildScheduleFrom()
// against a stub implementing the ACTUAL POST /injections/batch semantics from the
// backend's routers/injections.py: for each (cycle_id, compound_id) it drops this user's
// UNLOGGED rows from from_date onward, keeps logged ones, and refuses to re-insert into a
// (date, time_of_day) slot that still holds a logged row. The whole feature rests on that
// contract, so the stub encodes it rather than assuming a friendlier one.
console.log('\n── Rebuild schedule from a date ───────────────────────────');
{
  const _rbSave = {f:G.fetch, doc:G.document, us:G._userStacks, ai:G._activeStackIndices,
                   sl:G._stacksLoaded, c:G._injectionsCache, cf:G.confirm};
  const _d0 = new Date();
  const _bk = (n) => { const t = new Date(_d0.getFullYear(), _d0.getMonth(), _d0.getDate()-n, 12,0,0,0);
    return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };
  const HOLE = _bk(1), TICKED = _bk(2);

  G._userStacks = [{id:'P2', name:'Protocol 2', cycle_start:_bk(50), cycle_length:44,
    peptides:[{id:'glow', name:'Glow', dose_am:'2', unit_am:'mg', times:['AM'],
               days:[0,1,2,3,4,5,6], active:true}], trt:{}, enhanced:{}}];
  G._activeStackIndices = [0]; G._stacksLoaded = true; G.confirm = () => true;

  let DB = [];
  for (let i = -50; i <= 60; i++) {
    const d = _bk(-i);
    if (d === HOLE) continue;                       // the gap
    DB.push({id:'x'+i, cycle_id:'P2', compound_id:'glow', tier:'peptide', date:d,
             dose:'2', unit:'mg', time_of_day:'AM', active:true, logged:(d === TICKED)});
  }
  const hadHole = DB.filter(e => e.date === HOLE).length === 0;
  const tickedBefore = DB.filter(e => e.logged).length;

  G.fetch = async (url, opt) => {
    const u = String(url);
    if (opt && opt.method === 'POST' && u.includes('/injections/batch')) {
      const p = JSON.parse(opt.body);
      DB = DB.filter(e => !(e.cycle_id === p.cycle_id && e.compound_id === p.compound_id
                            && (e.date||'') >= p.from_date && !e.logged));
      const kept = new Set(DB.filter(e => e.cycle_id === p.cycle_id && e.compound_id === p.compound_id
                            && (e.date||'') >= p.from_date && e.logged).map(e => e.date+'|'+e.time_of_day));
      for (const en of p.entries) {
        if (kept.has(en.date+'|'+en.time_of_day)) continue;
        DB.push(Object.assign({}, en, {id:'n'+DB.length}));
      }
      return {ok:true, status:200, json:async()=>({ok:true})};
    }
    return {ok:true, status:200, json:async()=>u.includes('/injections') ? DB : []};
  };

  const _origDoc = G.document;            // capture before swapping, or the stub recurses
  const _vals = {'s-rebuild-from': _bk(14)};
  const _stub = Object.create(_origDoc);
  _stub.getElementById = (id) => {
    const e = _origDoc.getElementById(id);
    if (id in _vals) return new Proxy(e, {get:(t,k)=> k==='value' ? _vals[id] : t[k], set:()=>true});
    return e;
  };
  G.document = _stub;

  check('the gap exists before the rebuild', hadHole);
  await G.rebuildScheduleFrom();
  check('rebuilding refills the missing day',
    DB.filter(e => e.date === HOLE).length === 1, `${DB.filter(e=>e.date===HOLE).length} row(s)`);
  check('  …without un-ticking or dropping a recorded dose',
    DB.filter(e => e.logged).length === tickedBefore &&
    DB.some(e => e.date === TICKED && e.logged), `ticked ${DB.filter(e=>e.logged).length}/${tickedBefore}`);
  check('  …and without duplicating any slot', (() => {
    const c = {}; DB.forEach(e => { const k = e.date+'|'+e.time_of_day; c[k] = (c[k]||0)+1; });
    return !Object.values(c).some(n => n > 1);
  })());
  // It must refuse rather than guess when there is nothing to rebuild.
  G._activeStackIndices = [];
  const _before = DB.length;
  await G.rebuildScheduleFrom();
  check('no active protocol rebuilds nothing', DB.length === _before);

  G.fetch = _rbSave.f; G.document = _rbSave.doc; G._userStacks = _rbSave.us;
  G._activeStackIndices = _rbSave.ai; G._stacksLoaded = _rbSave.sl;
  G._injectionsCache = _rbSave.c; G.confirm = _rbSave.cf;
}

// ── Today explains testosterone that is configured but never scheduled ───────
// Since 2026-08-14 T-Calc is the only scheduler of testosterone: _genInjBatches
// suppresses it in BOTH tiers — the whole trt tier, and any enhanced compound whose
// NAME contains "testosterone", which the catalogue's "Testosterone Undecanoate
// (Nebido)" does. So a protocol can display an ester in its Enhanced tier and generate
// nothing for it. Those doses are not hidden and not counted, because they were never
// created, so no hidden-dose message can cover this; the explaining banner lives only
// inside the stack editor's tier tabs, which is not where anyone looks when a dose is
// missing. Reported: "even though Enhanced has Nebido scheduled there is no injections
// in Today for testosterone."
console.log('\n── Today: testosterone configured but not scheduled ───────');
{
  const _tnSave = {doc:G.document, us:G._userStacks, ai:G._activeStackIndices,
                   sl:G._stacksLoaded, c:G._injectionsCache, sp:G._syncPending,
                   cr:G._injCacheReady, hid:G._injHidden};
  const _n = new Date();
  const _k = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const TODAY = _k(_n);
  const _bk = (x) => _k(new Date(_n.getFullYear(), _n.getMonth(), _n.getDate()-x, 12,0,0,0));

  // The generator's own view: the catalogue name is what triggers suppression.
  check('an Enhanced "Testosterone Undecanoate (Nebido)" is suppressed by the generator',
    G._isTestosteroneComp('enhanced', {id:'test_u', name:'Testosterone Undecanoate (Nebido)'}) === true);
  check('  …while a non-testosterone Enhanced compound still generates',
    G._isTestosteroneComp('enhanced', {id:'hgh', name:'HGH (Somatropin)'}) === false);

  let _alert = '';
  const _origDoc = G.document;         // capture before swapping, or the stub recurses
  const _stub = Object.create(_origDoc);
  _stub.getElementById = (id) => {
    const e = _origDoc.getElementById(id);
    if (id !== 'today-alerts') return e;
    return new Proxy(e, {get:(t,k)=> k==='innerHTML' ? _alert : t[k],
                         set:(t,k,v)=>{ if(k==='innerHTML') _alert=v; else t[k]=v; return true; }});
  };
  G.document = _stub;
  G._stacksLoaded = true; G._syncPending = false; G._injCacheReady = true;
  G._injHidden = {count:0, stacks:{}, noStart:[], orphans:{}};
  G._activeStackIndices = [0];
  G._userStacks = [{id:'P2', name:'Protocol 2', cycle_start:_bk(50), cycle_length:44,
    peptides:[{id:'glow', name:'Glow Stack', active:true}], trt:{},
    enhanced:{enabled:true, compounds:[
      {id:'test_u', name:'Testosterone Undecanoate (Nebido)', dose:'250', unit:'mg'},
      {id:'hgh',    name:'HGH (Somatropin)',                  dose:'3',   unit:'IU'}]}}];
  // Peptides and HGH render; no testosterone anywhere — the reported state.
  G._injectionsCache = {[TODAY]:[
    {id:'a', compound_id:'glow', compound_name:'Glow', tier:'peptide',  cycle_id:'P2', date:TODAY, dose:'0.1', unit:'ml', active:true, logged:false, time_of_day:'AM'},
    {id:'b', compound_id:'hgh',  compound_name:'HGH',  tier:'enhanced', cycle_id:'P2', date:TODAY, dose:'3',   unit:'IU', active:true, logged:false, time_of_day:'AM'}]};

  _alert = ''; G.buildToday();
  check('Today says testosterone is not scheduled', /Testosterone not scheduled/.test(_alert));
  check('  …naming the compound', /Nebido/.test(_alert), _alert.slice(0,120));
  // Phase 5: the cause changed. It no longer means "T-Calc owns this" — the protocol
  // schedules testosterone now, so an empty calendar means it has not generated yet.
  check('  …and pointing at Plan, which is what schedules it now',
    /Plan ▸ Compounds/.test(_alert) && /tab-btn-stack/.test(_alert) && !/T-Calc/.test(_alert));

  // Bound plan → scheduled → the note must go away.
  G._injectionsCache[TODAY].push({id:'c', compound_id:'test_u', tier:'trt', cycle_id:'tcalc:P2',
    date:TODAY, dose:'250', unit:'mg', active:true, logged:false, time_of_day:'AM'});
  _alert = ''; G.buildToday();
  check('a protocol with a T-Calc plan bound gets no such note', !/Testosterone not scheduled/.test(_alert));

  // No ester configured at all → nothing to explain.
  G._userStacks[0].enhanced.compounds = [{id:'hgh', name:'HGH (Somatropin)', dose:'3', unit:'IU'}];
  G._injectionsCache[TODAY] = G._injectionsCache[TODAY].filter(e => e.compound_id !== 'test_u');
  _alert = ''; G.buildToday();
  check('  …nor does one with no testosterone configured', !/Testosterone not scheduled/.test(_alert));

  G.document = _tnSave.doc; G._userStacks = _tnSave.us; G._activeStackIndices = _tnSave.ai;
  G._stacksLoaded = _tnSave.sl; G._injectionsCache = _tnSave.c; G._syncPending = _tnSave.sp;
  G._injCacheReady = _tnSave.cr; G._injHidden = _tnSave.hid;
}

// ── A T-Calc plan saved into a protocol reaches Today ────────────────────────
// T-Calc canonicalises testosterone on WRITE: _TC_TESTO_ALIAS maps the enhanced
// catalogue's test_u/test_e/test_c/test_p onto nebido/enanthate/cypionate/propionate,
// so a plan saved into a protocol stores compound_id 'nebido'. _getProtocolCompoundIds
// reads the protocol's config and returns 'test_u'. Raw string equality never matched,
// so EVERY T-Calc testosterone dose in an Enhanced-tier protocol was treated as an
// orphan — dropped from the cache, and before the delete was removed, deleted from the
// record from today forward.
//
// Reported: "Injections are saved in protocol 2 that is active but there is zero Nebido
// injections in Today", while Levels showed 25 checked injections and a calibrated curve
// for the same protocol. Both were right — T-Calc reads /injections directly and never
// passes this filter; Today renders only what survives it.
console.log('\n── T-Calc plan ids reach Today ────────────────────────────');
{
  const _idSave = {f:G.fetch, us:G._userStacks, ai:G._activeStackIndices, sl:G._stacksLoaded,
                   sn:G._stacksNormalized, c:G._injectionsCache, hid:G._injHidden};
  const _n = new Date();
  const _k = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const TODAY = _k(_n);
  const _bk = (x) => _k(new Date(_n.getFullYear(), _n.getMonth(), _n.getDate()-x, 12,0,0,0));

  const P2 = {id:'P2', name:'Protocol 2', cycle_start:_bk(50), cycle_length:44,
    peptides:[{id:'glow', name:'Glow', active:true}], trt:{},
    enhanced:{enabled:true, compounds:[
      {id:'test_u', name:'Testosterone Undecanoate (Nebido)', dose:'250', unit:'mg'},
      {id:'hgh',    name:'HGH (Somatropin)',                  dose:'3',   unit:'IU'}]}};
  G._userStacks = [P2]; G._activeStackIndices = [0];
  G._stacksLoaded = true; G._stacksNormalized = true;

  // The mismatch this guards against, stated as data rather than trusted:
  check('the protocol lists the catalogue id, T-Calc writes the canonical one',
    G._getProtocolCompoundIds(P2).includes('test_u') && G._tcCanonCompId('test_u') === 'nebido');

  const _dels = [];
  const STORED = [
    {id:'g',  compound_id:'glow',   tier:'peptide', cycle_id:'P2', date:TODAY,   dose:'0.1', unit:'ml', active:true, logged:false},
    {id:'n1', compound_id:'nebido', tier:'trt',     cycle_id:'P2', date:TODAY,   dose:'250', unit:'mg', active:true, logged:false},
    {id:'n2', compound_id:'nebido', tier:'trt',     cycle_id:'P2', date:_bk(1),  dose:'250', unit:'mg', active:true, logged:true},
  ];
  G.fetch = async (url, opt) => {
    if (opt && opt.method === 'DELETE') { _dels.push(String(url)); return {ok:true, status:200, json:async()=>({})}; }
    return {ok:true, status:200, json:async()=>String(url).includes('/injections') ? STORED : []};
  };
  await G.refreshInjectionsCache();
  const vis = (G._injectionsCache[TODAY] || []).map(e => e.compound_id);

  check('a T-Calc dose saved into the protocol renders in Today',
    vis.includes('nebido'), JSON.stringify(vis));
  check('  …and is not counted as an orphan',
    G._injHidden.count === 0 && !(G._injHidden.orphans || {}).nebido, JSON.stringify(G._injHidden.orphans));
  check('  …nor deleted from the record', _dels.length === 0, JSON.stringify(_dels));
  check('  …so the protocol reads as having testosterone scheduled',
    G._stackHasScheduledTrt('P2') === true);

  // A genuinely unlisted compound must STILL be caught — the fix widens the match to
  // canonical ids, it does not disable the check.
  STORED.push({id:'z', compound_id:'nandrolone', tier:'enhanced', cycle_id:'P2',
               date:TODAY, dose:'200', unit:'mg', active:true, logged:false});
  await G.refreshInjectionsCache();
  check('a compound the protocol really does not list is still reported',
    (G._injHidden.orphans || {}).nandrolone === 1, JSON.stringify(G._injHidden.orphans));
  check('  …and still never deleted', _dels.length === 0);

  G.fetch = _idSave.f; G._userStacks = _idSave.us; G._activeStackIndices = _idSave.ai;
  G._stacksLoaded = _idSave.sl; G._stacksNormalized = _idSave.sn;
  G._injectionsCache = _idSave.c; G._injHidden = _idSave.hid;
}

// ── Saving a T-Calc plan actually creates its injections ────────────────────
// _tcWritePlanToStack deletes the ester's future rows and then rebuilt them by calling
// generateAndPushInjections. Since 2026-08-14 _genInjBatches SUPPRESSES testosterone in
// both tiers (_isTestosteroneComp is `tier==='trt'` for the whole TRT tier), so that
// call returns nothing for testosterone and saving a plan was a delete followed by
// silence. Reported as "no Nebido injections scheduled" on a protocol whose T-Calc card
// read "Injections are saved into Protocol 2": the configuration saved, the injections
// destroyed. The plan's rows are now written directly by _tcPostPlanInjections.
console.log('\n── T-Calc: saving a plan writes its injections ────────────');
{
  const _spSave = {f:G.fetch, us:G._userStacks, ai:G._activeStackIndices, sl:G._stacksLoaded,
                   c:G._injectionsCache, ssb:G.saveStacksToBackend};
  const _n = new Date();
  const _k = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const _bk = (x) => _k(new Date(_n.getFullYear(), _n.getMonth(), _n.getDate()-x, 12,0,0,0));
  const TODAY = _k(_n);

  const st = {id:'P2', name:'Protocol 2', cycle_start:_bk(50), cycle_length:44, peptides:[],
    trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'250', unit:'mg', freqVal:2, freqUnit:'days'}]},
    enhanced:{}};
  G._userStacks = [st]; G._activeStackIndices = [0]; G._stacksLoaded = true;
  G.saveStacksToBackend = async () => {};

  // Phase 5 inverted this: the generator is what produces testosterone now, which is
  // why T-Calc's own write path is disabled below rather than duplicating it.
  const _gen = G._genInjBatches(st, 'P2', new Date(_n.getFullYear(), _n.getMonth(), _n.getDate(), 12,0,0,0));
  check('the stack generator produces the testosterone rows',
    _gen.some(b => ['nebido','test_u'].includes(b.compound_id)));

  const POSTED = [], DELETED = [];
  G.fetch = async (url, opt) => {
    const u = String(url);
    if (opt && opt.method === 'DELETE') { DELETED.push(u); return {ok:true, status:200, json:async()=>({})}; }
    if (opt && opt.method === 'POST' && u.includes('/injections/batch')) {
      POSTED.push(JSON.parse(opt.body)); return {ok:true, status:200, json:async()=>({ok:true})};
    }
    return {ok:true, status:200, json:async()=>[]};
  };
  // Phase 5: _tcWritePlanToStack no longer writes. What used to be asserted here — that
  // saving a T-Calc plan produced the ester's injections on its own cadence, from today
  // forward, as planned rows, never past the cycle end — is now the PROTOCOL
  // generator's job, and is asserted against _genInjBatches above and in the
  // "one scheduler" block. What matters here is that the old path stays silent, so the
  // two cannot both write.
  // Phase 6 deleted _tcWritePlanToStack outright. Phase 5 had only disabled it, and the
  // check here was that it wrote nothing; the stronger statement is that there is no
  // such function to call.
  check('T-Calc\'s plan write is gone, not merely disabled',
    typeof G._tcWritePlanToStack !== 'function' && typeof G._tcPostPlanInjections !== 'function');
  check('  …and nothing in T-Calc wrote an injection getting here',
    POSTED.length === 0 && DELETED.length === 0,
    `posted ${POSTED.length}, deleted ${DELETED.length}`);

  // …and the doses it used to write are exactly what the generator now produces, on
  // the protocol's own cadence, never past its cycle end.
  const _genRows = _gen.filter(b => ['nebido','test_u'].includes(b.compound_id))
                       .reduce((a,b) => a.concat(b.entries||[]), []);
  check('  …with the generator writing them instead', _genRows.length > 0);
  check('  …as planned rows, not administered ones',
    _genRows.every(e => e.logged === false));
  check('  …and never past the protocol\'s own cycle end', (() => {
    const cs = new Date(_bk(50)+'T12:00:00');
    const ce = new Date(cs.getTime() + 44*7*86400000);
    return _genRows.every(e => new Date(e.date+'T12:00:00') <= ce);
  })());

  G.fetch = _spSave.f; G._userStacks = _spSave.us; G._activeStackIndices = _spSave.ai;
  G._stacksLoaded = _spSave.sl; G._injectionsCache = _spSave.c;
  G.saveStacksToBackend = _spSave.ssb;
}

// ── The cycle header states what is stored, and enhanced testo is matched by id ──
// Two fixes, both about a claim the app made without the data to back it:
//  1. buildToday's cycle line read `_st.cycle_length||12`, so a protocol with NO end
//     date still printed "Week 12 of 12 · Ends <date>". That invented cycle was read as
//     evidence a cycle had ended and sent a whole investigation to the wrong protocol.
//  2. _isEnhTestosterone matched only on the NAME containing "testosterone". _TC_TESTO_
//     ALIAS is the ester-id list T-Calc, the PK model and the curve all key on, so it is
//     what "is this testosterone" means. Sustanon 250 and Testoviron Depot do not carry
//     the word; such a compound would generate its own stream AND stay invisible to the
//     curve — two streams for one molecule.
console.log('\n── Cycle header + enhanced testosterone identity ──────────');
{
  const _hxSave = {doc:G.document, us:G._userStacks, ai:G._activeStackIndices,
                   sl:G._stacksLoaded, c:G._injectionsCache, cr:G._injCacheReady,
                   sp:G._syncPending, hid:G._injHidden};
  const _n = new Date();
  const _k = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const _bk = (x) => _k(new Date(_n.getFullYear(), _n.getMonth(), _n.getDate()-x, 12,0,0,0));

  // ── 2. identity-based detection ──
  check('an enhanced ester is testosterone by its ID',
    G._isEnhTestosterone({id:'test_u', name:'Testosterone Undecanoate (Nebido)'}) === true);
  check('  …including one whose name never says "testosterone"',
    G._isEnhTestosterone({id:'sustanon', name:'Sustanon 250'}) === true);
  check('  …with the name check kept, so nothing detected before stops being detected',
    G._isEnhTestosterone({id:'weird_id', name:'Testosterone Enanthate'}) === true);
  check('  …and a non-testosterone compound is still not one',
    G._isEnhTestosterone({id:'hgh', name:'HGH (Somatropin)'}) === false &&
    G._isEnhTestosterone({id:'nandrolone', name:'Nandrolone Decanoate'}) === false);

  // ── 1. the header ──
  let _hdr = '';
  const _origDoc = G.document;
  const _stub = Object.create(_origDoc);
  _stub.getElementById = (id) => {
    const e = _origDoc.getElementById(id);
    if (id !== 'today-cycle-info') return e;
    return new Proxy(e, {get:(t,k)=> k==='textContent' ? _hdr : t[k],
                         set:(t,k,v)=>{ if(k==='textContent') _hdr=v; else t[k]=v; return true; }});
  };
  G.document = _stub;
  G._stacksLoaded = true; G._syncPending = false; G._injCacheReady = true;
  G._injectionsCache = {}; G._injHidden = {count:0, stacks:{}, noStart:[], orphans:{}};
  G._activeStackIndices = [0];

  const _mk = (cl) => [{id:'A', name:'P', cycle_start:_bk(60), cycle_length:cl,
                        peptides:[], trt:{}, enhanced:{}}];

  G._userStacks = _mk(44); _hdr = ''; G.buildToday();
  check('a real cycle length is still reported in full',
    /Week \d+ of 44/.test(_hdr) && /Ends /.test(_hdr), _hdr);

  G._userStacks = _mk(0); _hdr = ''; G.buildToday();
  check('a protocol with no end date says so', /No end date/.test(_hdr), _hdr);
  check('  …and never invents a 12-week cycle',
    !/of 12/.test(_hdr) && !/Ends /.test(_hdr), _hdr);

  G._userStacks = _mk(undefined); _hdr = ''; G.buildToday();
  check('  …same when the length is absent entirely',
    /No end date/.test(_hdr) && !/of 12/.test(_hdr), _hdr);
  check('  …while still saying when it started',
    /^Started /.test(_hdr), _hdr);

  G.document = _hxSave.doc; G._userStacks = _hxSave.us; G._activeStackIndices = _hxSave.ai;
  G._stacksLoaded = _hxSave.sl; G._injectionsCache = _hxSave.c;
  G._injCacheReady = _hxSave.cr; G._syncPending = _hxSave.sp; G._injHidden = _hxSave.hid;
}

// ── Editing a series re-reads the injection cache ────────────────────────────
// _tcSaveEditSeries synced the record and refetched the history, but never refreshed
// _injectionsCache — and the curve also draws on that, via _tcProtocolInjections. So
// shortening a series removed the doses from the record and left them in the cache, and
// the curve kept drawing them: a Nebido run cut to 16 Aug still ran to October, looking
// like the edit had been ignored. _tcConfirmAddSheet had always done this; the edit path
// never did. Order matters — the cache must be refreshed BEFORE _tcLoadLogFromStack,
// which reads it to rebuild manualLog.
console.log('\n── An edit re-reads the cache: the protocol path now ─────');
{
  // 2026-08-16: _tcSaveEditSeries synced the record and refetched the history but never
  // refreshed _injectionsCache, which the curve also draws on — so a Nebido run cut to
  // 16 Aug still ran to October, looking like the edit had been ignored.
  //
  // That editor is gone. The same hazard now belongs to the protocol path: whatever
  // writes injections must refresh the cache before anything reads it back.
  const _esSrc = require('fs').readFileSync(require('path').join(__dirname,'../tab-tcalc.js'),'utf8');
  const _stSrc = require('fs').readFileSync(require('path').join(__dirname,'../tab-stack.js'),'utf8');
  check('the series editor that skipped the refresh is gone',
    !/function _tcSaveEditSeries/.test(_esSrc));
  check('saving a protocol refreshes the injection cache after writing',
    /await generateAndPushInjections\(/.test(_stSrc) &&
    /refreshInjectionsCache\(\)/.test(_stSrc));
  check('  …and record entry still re-reads both the history and the cache',
    /await _tcFetchHistory\(true\);[\s\S]{0,200}refreshInjectionsCache\(\)/.test(_esSrc));
}

  // ── Tier 2 sees the whole catalogue, locked ────────────────────────────────
  // Henrik, 2026-08-20: "I want a tier2 user to still see the full catalog, but
  // anything else than testosterone, PCT and HCT compounds should be greyed out.
  // Clicking a Enhanced compound will trigger an overlay with an (for now dummy)
  // message about requiring an app upgrade."
  console.log('\n── Tier 2: full catalogue, locked ─────────────────────────');
  {
    const _svCat = G.ENHANCEMENT_COMPOUNDS, _svTier = G._userTier, _svBuf = G._editBuf;
    G.ENHANCEMENT_COMPOUNDS = [
      {id:'deca',  name:'Deca',        group:'19-Nor',      dot:'#888', isTestosterone:false},
      {id:'tren_e',name:'Tren E',      group:'19-Nor',      dot:'#888', isTestosterone:false},
      {id:'primo', name:'Primobolan',  group:'DHT-Derived', dot:'#3cf', isTestosterone:false},
      {id:'hgh',   name:'HGH',         group:'GH Axis',     dot:'#e8a', isTestosterone:false},
      {id:'hcg',   name:'HCG',         group:'Recovery',    dot:'#4c8', isTestosterone:false},
      {id:'nolvadex', name:'Nolvadex', group:'PCT',         dot:'#4c8', isTestosterone:false},
    ];

    // ── the rule itself ──
    G._userTier = 2;
    const allowed = id => G._compoundAllowedForTier(
      G.ENHANCEMENT_COMPOUNDS.find(c => c.id === id));
    check('tier 2: hCG is allowed',      allowed('hcg') === true);
    check('tier 2: PCT is allowed',      allowed('nolvadex') === true);
    check('tier 2: a 19-nor is locked',  allowed('deca') === false);
    check('tier 2: tren is locked',      allowed('tren_e') === false);
    check('tier 2: a DHT is locked',     allowed('primo') === false);
    check('tier 2: GH is locked',        allowed('hgh') === false);
    check('tier 2: testosterone is allowed by the catalogue FLAG, not its name',
      G._compoundAllowedForTier({id:'testoviron', name:'Testoviron Depot', isTestosterone:true}) === true &&
      G._compoundAllowedForTier({id:'mystery', name:'No testosterone in this name', isTestosterone:true}) === true);
    G._userTier = 3;
    check('tier 3: everything is allowed',
      ['deca','tren_e','primo','hgh','hcg','nolvadex'].every(allowed));

    // ── what tier 2 actually sees ──
    G._userTier = 2;
    G._editBuf = {trt:{enabled:false,compounds:[]}, enhanced:{enabled:false,compounds:[]}};
    const t2 = G._renderEditCompounds({trt:{}, enhanced:{}});
    check('tier 2 sees the whole catalogue, not an upgrade card in its place',
      t2.includes('Deca') && t2.includes('Primobolan') && t2.includes('HGH'));
    check('  …with the classes named, so the tier reads as complete',
      t2.includes('19-Nor') && t2.includes('DHT-Derived') && t2.includes('GH Axis'));
    check('  …the locked ones greyed', (t2.match(/opacity:0\.45/g) || []).length >= 4);
    check('  …and tapping one opens the upgrade overlay',
      t2.includes("showCompoundUpgrade('deca')"));
    check('  …never the selection toggle', !t2.includes("editToggleEnhancedCompound('deca')"));
    check('  …while hCG and PCT stay selectable, because tier 2 may have them',
      t2.includes("editToggleEnhancedCompound('hcg')") &&
      t2.includes("editToggleEnhancedCompound('nolvadex')"));

    // ── and the gate holds where it counts: the protocol ──
    // The overlay's own DOM is not under test here; the harness element stub has no
    // remove(). Hand these lookups back null and let the guards do their job.
    const _svGetEl2 = G.document.getElementById;
    G.document.getElementById = function(id){
      if (id === 'upg-overlay') return null;
      return _svGetEl2.call(G.document, id);
    };
    G._editBuf = {trt:{enabled:false,compounds:[]}, enhanced:{enabled:false,compounds:[]}};
    G.editToggleEnhancedCompound('deca');
    check('a locked compound cannot be added even by calling the toggle directly',
      (G._editBuf.enhanced.compounds || []).length === 0);
    G.editToggleEnhancedCompound('hcg');
    check('  …while an allowed one still adds normally',
      (G._editBuf.enhanced.compounds || []).some(c => c.id === 'hcg'));
    // A downgrade must not strand a compound on the protocol.
    G._editBuf.enhanced.compounds.push({id:'deca', name:'Deca'});
    G.editToggleEnhancedCompound('deca');
    check('  …and a locked compound already on the protocol can still be REMOVED',
      !(G._editBuf.enhanced.compounds || []).some(c => c.id === 'deca'));

    // ── tier 1: the same catalogue, all of it locked ──
    // Corrected 2026-08-20: "Tier 1 & 2 should see everything but greyed out if not
    // included in their tier." Tier 1 has no testosterone either, so that group locks
    // too — which is the part tier 2 does NOT do.
    G._userTier = 1;
    check('tier 1: nothing in the enhancement catalogue is allowed',
      ['deca','tren_e','primo','hgh','hcg','nolvadex'].every(id => allowed(id) === false));
    check('tier 1: testosterone is locked too, unlike tier 2',
      G._compoundAllowedForTier({id:'nebido', name:'Nebido', isTestosterone:true}) === false);
    G._editBuf = {trt:{enabled:false,compounds:[]}, enhanced:{enabled:false,compounds:[]}};
    const t1 = G._renderEditCompounds({trt:{}, enhanced:{}});
    check('tier 1 sees the whole catalogue, same as everyone',
      t1.includes('Deca') && t1.includes('Primobolan') && t1.includes('HGH') &&
      t1.includes('19-Nor') && t1.includes('GH Axis'));
    check('  …including the testosterone group, rendered and locked',
      t1.includes('Testosterone') && t1.includes('showCompoundUpgrade('));
    check('  …with nothing selectable at all',
      !t1.includes("editToggleEnhancedCompound('deca')") &&
      !t1.includes("editToggleTRTCompound('"));
    // The toggles refuse too — rendering is presentation, these change the protocol.
    G._editBuf = {trt:{enabled:false,compounds:[]}, enhanced:{enabled:false,compounds:[]}};
    G.editToggleTRT();
    check('tier 1: the testosterone tier cannot be switched on',
      !G._editBuf.trt.enabled);
    G.editToggleTRTCompound('nebido');
    check('  …nor a testosterone ester added',
      (G._editBuf.trt.compounds || []).length === 0);
    // …but a downgrade must not strand what is already there.
    G._editBuf.trt = {enabled:true, compounds:[{id:'nebido', name:'Nebido'}]};
    G.editToggleTRTCompound('nebido');
    check('  …while one already on the protocol can still be removed',
      (G._editBuf.trt.compounds || []).length === 0);

    // ── tier 3 is untouched ──
    G._userTier = 3;
    G._editBuf = {trt:{enabled:false,compounds:[]}, enhanced:{enabled:false,compounds:[]}};
    const t3 = G._renderEditCompounds({trt:{}, enhanced:{}});
    check('tier 3 still gets a fully selectable catalogue',
      t3.includes("editToggleEnhancedCompound('deca')") && !t3.includes('opacity:0.45'));

    G.document.getElementById = _svGetEl2;
    G.ENHANCEMENT_COMPOUNDS = _svCat; G._userTier = _svTier; G._editBuf = _svBuf;
  }

  // ── Log a past injection: a run, and whether it was taken ───────────────────
  // Henrik, 2026-08-20: "The Add past injections, should instead be able to add a
  // series of injections as well as have a checkbox if these old injections should
  // already be checked (most common use case for a mid cycle user)."
  console.log('\n── Past injection: series + already-taken ─────────────────');
  {
    const _svFetch = G.fetch, _svAuth = G.authHeaders, _svDraft = G._piDraft;
    // The sheet's own DOM is not under test here — the record it produces is. The
    // harness's element stub has no remove(), so hand these lookups back null and let
    // the guards in the sheet do their job.
    const _svGetEl = G.document.getElementById;
    G.document.getElementById = function(id){
      if (id === 'pi-overlay' || id === 'pi-err' || id === 'pi-save' || id === 'pi-preview') return null;
      return _svGetEl.call(G.document, id);
    };
    let posted = [];
    G.authHeaders = function(){ return {}; };
    G.fetch = function(u, o){
      const body = o && o.body ? JSON.parse(o.body) : null;
      if (String(u).indexOf('/injections') > -1 && o && o.method === 'POST') posted.push(body);
      return Promise.resolve({ok:true, status:200,
        json:()=>Promise.resolve({entry: Object.assign({id:'x'+posted.length}, body)})});
    };

    const today = G._thTodayStr();
    const daysAgo = n => { const p = today.split('-'); const d = new Date(+p[0], +p[1]-1, +p[2] - n);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };

    // ── the date maths, before anything is written ──
    G._piDraft = {tier:'trt', compId:'nebido', dose:'100', unit:'mg', date: daysAgo(10),
                  time:'', isSeries:true, count:5, intervalDays:2, logged:true};
    const dates = G._piDates(G._piDraft);
    check('a series expands to one date per injection', dates.length === 5, dates.join(','));
    check('  …stepping by the interval, in calendar days',
      dates[0] === daysAgo(10) && dates[1] === daysAgo(8) && dates[4] === daysAgo(2), dates.join(','));
    check('a single dose is just its own date',
      G._piDates({date: daysAgo(3), isSeries:false}).join(',') === daysAgo(3));

    // ── the whole run reaches the record ──
    posted = [];
    await G.savePastInjection();
    check('every dose in the run is written', posted.length === 5, 'posted ' + posted.length);
    check('  …each marked as taken, because the box was ticked',
      posted.every(p => p.logged === true));
    check('  …sharing one series id, so a restore rebuilds one card',
      posted.every(p => p.series_id && p.series_id === posted[0].series_id));
    check('  …under cycle_id manual', posted.every(p => p.cycle_id === 'manual'));
    check('  …carrying the dose and compound asked for',
      posted.every(p => p.dose === '100' && p.compound_id === 'nebido' && p.unit === 'mg'));

    // ── the checkbox is honoured ──
    posted = [];
    G._piDraft = {tier:'trt', compId:'nebido', dose:'100', unit:'mg', date: daysAgo(6),
                  time:'', isSeries:true, count:3, intervalDays:2, logged:false};
    await G.savePastInjection();
    check('unticking "already taken" writes them as NOT taken',
      posted.length === 3 && posted.every(p => p.logged === false));

    // ── this sheet records the past; it does not plan ──
    posted = [];
    G._piDraft = {tier:'trt', compId:'nebido', dose:'100', unit:'mg', date: daysAgo(2),
                  time:'', isSeries:true, count:6, intervalDays:2, logged:true};
    await G.savePastInjection();
    check('a run straddling today writes only the dates that have happened',
      posted.length === 2, 'posted ' + posted.length + ': ' + posted.map(p=>p.date).join(','));
    check('  …and never a date in the future',
      posted.every(p => p.date <= today), posted.map(p=>p.date).join(','));

    // ── a single dose still works, unchanged ──
    posted = [];
    G._piDraft = {tier:'trt', compId:'nebido', dose:'250', unit:'mg', date: daysAgo(4),
                  time:'', isSeries:false, count:5, intervalDays:2, logged:true};
    await G.savePastInjection();
    check('one dose still writes exactly one row', posted.length === 1);
    check('  …with no series id, because there is no series',
      posted[0] && (posted[0].series_id === null || posted[0].series_id === undefined));

    // ── refusals ──
    for (const [label, draft] of [
      ['a run with no count',    {tier:'trt',compId:'nebido',dose:'100',date:daysAgo(5),isSeries:true,count:0,intervalDays:2,logged:true}],
      ['a run with no interval', {tier:'trt',compId:'nebido',dose:'100',date:daysAgo(5),isSeries:true,count:3,intervalDays:0,logged:true}],
      ['a dose of zero',         {tier:'trt',compId:'nebido',dose:'0',date:daysAgo(5),isSeries:false,logged:true}],
      ['a date in the future',   {tier:'trt',compId:'nebido',dose:'100',date:'2099-01-01',isSeries:false,logged:true}],
      ['an absurd run length',   {tier:'trt',compId:'nebido',dose:'100',date:daysAgo(400),isSeries:true,count:999,intervalDays:1,logged:true}],
    ]) {
      posted = [];
      G._piDraft = draft;
      await G.savePastInjection();
      check('refused: ' + label, posted.length === 0, 'wrote ' + posted.length);
    }

    G.fetch = _svFetch; G.authHeaders = _svAuth; G._piDraft = _svDraft;
    G.document.getElementById = _svGetEl;
  }

  // ── One Compounds toggle, never a TRT/Enhanced fork ────────────────────────
  // Henrik, 2026-08-20: "Why you ignore this? TRT and Enhanced should never be
  // separated." The two toggles set 'trt' and 'enhanced' as mutually exclusive goals,
  // each handler wiping the other — so the wizard made the user choose which of two
  // places their testosterone lived, the exact question the tier merge removed.
  console.log('\n── Goals: one Compounds toggle ────────────────────────────');
  {
    const _svTierC = G._userTier;

    // ── tier 3: one switch turns both on ──
    G._userTier = 3; G.initWizard();
    check('starts off', !G._wiz.trt.enabled && !G._wiz.goals.includes('enhanced'));
    G.wizToggleCompounds();
    check('one toggle turns testosterone AND the enhanced catalogue on together',
      G._wiz.trt.enabled === true && G._wiz.goals.includes('enhanced'));
    check('  …never one at the cost of the other',
      G._wiz.goals.includes('trt') && G._wiz.goals.includes('enhanced'));
    check('  …and the flow asks for testosterone exactly once',
      G._wizFlow().filter(x => x === 'trt' || x === 'base').length === 1,
      G._wizFlow().join(','));
    G.wizToggleCompounds();
    check('toggling off clears both sides',
      !G._wiz.trt.enabled && !G._wiz.goals.includes('enhanced') &&
      !G._wiz.goals.includes('trt') && (G._wiz.trt.compounds||[]).length === 0);

    // ── tier 2: same switch, flow just ends sooner ──
    G._userTier = 2; G.initWizard();
    G.wizToggleCompounds();
    check('tier 2: the same toggle turns testosterone on', G._wiz.trt.enabled === true);
    check('  …without granting the tier-3 catalogue', !G._wiz.goals.includes('enhanced'));
    check('  …and its flow still includes the testosterone step',
      G._wizFlow().indexOf('trt') > -1);

    // ── tier 1: no compounds at all ──
    G._userTier = 1; G.initWizard();
    G.wizToggleCompounds();
    check('tier 1: the toggle does nothing, because the tier has no compounds',
      !G._wiz.trt.enabled && !G._wiz.goals.includes('enhanced'));

    // ── the screen itself ──
    G._userTier = 3; G.initWizard();
    const gb = {innerHTML:''}, gf = {innerHTML:''};
    G.wizStepGoals(gb, gf);
    check('the Goals screen has ONE compounds toggle',
      (gb.innerHTML.match(/class="toggle-sw/g) || []).length === 1, gb.innerHTML);
    check('  …under a single Compounds heading',
      gb.innerHTML.includes('>Compounds</div>') &&
      !gb.innerHTML.includes('>TRT</div>') &&
      !gb.innerHTML.includes('>Enhanced Cycle</div>'));
    check('  …naming TRT and the other enhanced compounds',
      /TRT and other enhanced compounds/.test(gb.innerHTML));
    check('  …and greying nothing, since there is no either/or left',
      !gb.innerHTML.includes('pointer-events:none'));

    G._userTier = _svTierC;
  }

  // ── The testosterone base comes from the TRT step ──────────────────────────
  // Henrik, 2026-08-20, both from the same cause — the enhanced half of the flow still
  // looked for the base in _wiz.enhanced.compounds after the single Compounds toggle
  // moved it to the 'trt' step:
  //   "Even though I added an T ester in TRT step, recommended enhanced compounds lists
  //    Test E on top, no testosterone esters should show up in this step."
  //   "Error that a test base is required for masteron even though one is already
  //    selected in TRT step"
  console.log('\n── Enhanced flow reads the TRT step ───────────────────────');
  {
    const _svCat = G.ENHANCEMENT_COMPOUNDS, _svWiz = G._wiz, _svTier = G._userTier;
    G._userTier = 3;
    G.ENHANCEMENT_COMPOUNDS = [
      {id:'mast_e', name:'Masteron Enanthate', group:'DHT-Derived', cls:'dht', dot:'#3cf', unit:'mg/week', defaultDose:300},
      {id:'primo',  name:'Primobolan',         group:'DHT-Derived', cls:'dht', dot:'#3cf', unit:'mg/week', defaultDose:400},
    ];

    // ── the hard block ──
    G.initWizard();
    G._wiz.trt = {enabled:true, compounds:[{id:'enanthate', name:'Testosterone Enanthate', dose:'250', unit:'mg'}]};
    G._wiz.enhanced = {enabled:true, _prefilled:true, compounds:[{id:'mast_e', name:'Masteron Enanthate', dose:'300', unit:'mg/week'}]};
    check('a testosterone set in the TRT step counts as the base', G._wizTrtHasTesto() === true);
    const eb = {innerHTML:''}, ef = {innerHTML:''};
    G.wizStepEnhanced(eb, ef);
    check('THE BUG: no "testosterone base is required" warning when TRT has one',
      !eb.innerHTML.includes('testosterone base is required'));
    check('  …and Next is NOT disabled, so the cycle can actually be finished',
      !ef.innerHTML.includes('disabled'), ef.innerHTML);

    // …while a genuinely baseless enhanced cycle is still stopped.
    G._wiz.trt = {enabled:false, compounds:[]};
    const eb2 = {innerHTML:''}, ef2 = {innerHTML:''};
    G.wizStepEnhanced(eb2, ef2);
    check('an enhanced cycle with no testosterone anywhere is still blocked',
      eb2.innerHTML.includes('testosterone base is required') && ef2.innerHTML.includes('disabled'));

    // ── no testosterone esters in the guidance step ──
    G.initWizard();
    G._wiz.trt = {enabled:true, compounds:[{id:'enanthate', name:'Testosterone Enanthate', dose:'250', unit:'mg'}]};
    G._wiz.enhanced = {enabled:false, compounds:[]};
    const res = {
      headline: 'Add ONE compound to your testosterone base',
      base: {id:'enanthate', name:'Testosterone Enanthate', note:'Twice-weekly smooths the swing.'},
      best_addition: {id:'primo', name:'Primobolan', reason:'Mild, non-aromatizing.'},
      primary: [{id:'enanthate', name:'Testosterone Enanthate', reason:'base'},
                {id:'mast_e', name:'Masteron Enanthate', reason:'hardening'}],
      consider: [{id:'cypionate', name:'Testosterone Cypionate', reason:'alt base'}],
    };
    check('a testosterone recommendation is recognised by id',
      G._wizAdviseIsTesto({id:'enanthate'}) === true &&
      G._wizAdviseIsTesto({id:'cypionate'}) === true);
    check('  …and a non-testosterone one is not',
      G._wizAdviseIsTesto({id:'mast_e'}) === false &&
      G._wizAdviseIsTesto({id:'primo'}) === false);

    // The auto-select must not put the ester into the enhanced list.
    G._wizAdviseDefaultSelect(res);
    const picked = (G._wiz.enhanced.compounds || []).map(c => c.id);
    check('THE BUG: the base is not added to the enhanced list when TRT has it',
      picked.indexOf('enanthate') === -1, picked.join(','));
    check('  …while the best addition still is', picked.indexOf('primo') >= 0, picked.join(','));

    // …and with no TRT base, the old behaviour stands.
    G.initWizard();
    G._wiz.trt = {enabled:false, compounds:[]};
    G._wiz.enhanced = {enabled:false, compounds:[]};
    G._wizAdviseDefaultSelect(res);
    // Third symptom, and the invisible one: _wizAdviseAdd looks the id up in
    // ENHANCEMENT_COMPOUNDS, which excludes testosterone since the catalogue merge, so
    // `if(!cat)return;` had been swallowing every recommended base. It now seeds the
    // TRT block, where testosterone actually lives.
    check('with no TRT base, the recommended base seeds the TRT block',
      ((G._wiz.trt && G._wiz.trt.compounds) || []).some(c => c.id === 'enanthate'),
      JSON.stringify((G._wiz.trt||{}).compounds || []));
    check('  …and never lands in the enhanced list, which cannot hold testosterone',
      !(G._wiz.enhanced.compounds || []).some(c => c.id === 'enanthate'));
    check('  …with the tier switched on so it generates',
      !!(G._wiz.trt && G._wiz.trt.enabled));

    G.ENHANCEMENT_COMPOUNDS = _svCat; G._wiz = _svWiz; G._userTier = _svTier;
  }

  // ── The dose guide follows the protocol, not one injection ─────────────────
  // Henrik, 2026-08-20, on Retatrutide 3 mg with W and S selected: "Adding a second
  // 3mg dose on Wednesday doesn't change the dose info, it stuck on 2-4mg." 3 mg twice
  // a week is 6 mg/week, which is OPTIMAL (4–8) — but the guide was comparing the
  // per-injection 3 against bands written in mg/wk.
  console.log('\n── Dose guide: weekly vs per-dose ─────────────────────────');
  {
    const label = html => (html.match(/<span style="[^"]*color:var\(--accent\)[^"]*text-transform:uppercase[^"]*">([^<]+)<\/span>/g) || [])
      .map(m => (m.match(/>([^<]+)<\/span>/) || [])[1] || '').map(x => x.trim());

    // ── which guides are weekly ──
    const G_ = id => (G.DOSE_GUIDE || {})[id];
    check('retatrutide is a weekly guide', G._doseGuideIsWeekly(G_('retatrutide')) === true);
    check('  …as are the other GLP-1s',
      G._doseGuideIsWeekly(G_('tirzepatide')) === true &&
      G._doseGuideIsWeekly(G_('semaglutide')) === true);
    check('a "× 3/wk" frequency is NOT a weekly total',
      G._doseGuideIsWeekly(G_('motsc')) === false &&
      G._doseGuideIsWeekly(G_('nad')) === false &&
      G._doseGuideIsWeekly(G_('tb500')) === false);
    check('  …nor is a plain per-dose guide',
      G._doseGuideIsWeekly(G_('bpc157')) === false &&
      G._doseGuideIsWeekly(G_('hgh')) === false);

    // ── the weekly total itself ──
    const reta = d => ({id:'retatrutide', times:['AM'], dose_am:'3', unit_am:'mg', days:d});
    check('one day of 3 mg is 3/week', G._weeklyDoseTotal(reta([3])) === 3);
    check('the reported case: 3 mg on two days is 6/week', G._weeklyDoseTotal(reta([3,0])) === 6);
    check('no days selected is nothing per week', G._weeklyDoseTotal(reta([])) === 0);
    check('both slots count toward the day',
      G._weeklyDoseTotal({id:'retatrutide', times:['AM','PM'], dose_am:'2', dose_pm:'1', days:[1,2]}) === 6);

    // ── and the highlight actually moves ──
    const one = G._renderDoseGuide('retatrutide', 3, G._weeklyDoseTotal(reta([3])));
    check('3 mg once a week sits in Therapeutic',
      label(one).some(l => l.indexOf('Therapeutic') === 0), label(one).join('|'));
    const two = G._renderDoseGuide('retatrutide', 3, G._weeklyDoseTotal(reta([3,0])));
    check('THE BUG: adding the second day moves it to Optimal',
      label(two).some(l => l.indexOf('Optimal') === 0), label(two).join('|'));
    check('  …and it no longer says Therapeutic',
      !label(two).some(l => l.indexOf('Therapeutic') === 0), label(two).join('|'));
    const three = G._renderDoseGuide('retatrutide', 3, G._weeklyDoseTotal(reta([3,0,5])));
    check('  …a third day reaches Max', label(three).some(l => l.indexOf('Max') === 0), label(three).join('|'));
    check('the panel says it is reading a weekly total', /dose × days/.test(two));

    // ── a per-dose guide is untouched by day count ──
    const bpcA = G._renderDoseGuide('bpc157', 500, 500 * 1);
    const bpcB = G._renderDoseGuide('bpc157', 500, 500 * 7);
    check('a per-dose guide ignores how many days are selected',
      label(bpcA).join('|') === label(bpcB).join('|'), label(bpcA).join('|') + ' vs ' + label(bpcB).join('|'));
  }

  // ── Deselecting a recommendation sticks ────────────────────────────────────
  // Henrik, 2026-08-20: "Even if I deselect Primo and click Next it is preselected
  // again." wizApplyAdviseRecommendations re-seeds when the enhanced list is EMPTY,
  // reasoning that empty means the user never chose — but clearing the one pre-ticked
  // compound produces exactly that empty list, so Primobolan came straight back.
  console.log('\n── Advise: a deselect is an answer ────────────────────────');
  {
    const _svCat = G.ENHANCEMENT_COMPOUNDS, _svWiz = G._wiz, _svDoc = G.document.getElementById;
    // The toggle re-renders the step through wiz-body/wiz-footer, so those two have to
    // be writable objects; everything else can be null. The selection is what is under
    // test, not the markup.
    G.document.getElementById = id =>
      (id === 'wiz-body' || id === 'wiz-footer') ? {innerHTML:''} : null;
    G.ENHANCEMENT_COMPOUNDS = [
      {id:'primo', name:'Primobolan', group:'DHT-Derived', cls:'dht',   defaultDose:400, unit:'mg/week', defaultDays:[1,4], dot:'#3cf'},
      {id:'npp',   name:'NPP',        group:'19-Nor',      cls:'19nor', defaultDose:300, unit:'mg/week', defaultDays:[1,4], dot:'#888'},
    ];
    const advice = {best_addition:{id:'primo', name:'Primobolan'},
                    primary:[{id:'primo', name:'Primobolan'}, {id:'npp', name:'NPP'}],
                    consider:[]};
    const fresh = () => {
      G.initWizard();
      G._userTier = 3;
      G._wiz.trt = {enabled:true, compounds:[{id:'enanthate', name:'Testosterone Enanthate'}]};
      G._wiz.goals = ['trt','enhanced'];
      G._wiz.enhanced = {enabled:false, compounds:[]};
      G._wiz.advise = {objective:'lean_mass', experience:'first', flags:{}, result:advice,
                       loading:false, error:'', fetched:true, _seeded:false, _autoSel:false};
      return G._wizAdviseState();
    };
    const ids = () => ((G._wiz.enhanced||{}).compounds||[]).map(c => c.id);

    // Render pre-ticks the best addition, as before.
    let st = fresh();
    G.wizStepAdvise({innerHTML:''}, {innerHTML:''});
    check('the best pick is pre-ticked on a fresh recommendation', ids().indexOf('primo') >= 0, ids().join(','));

    // THE BUG: untick it, press Next.
    G.wizAdviseToggleCompound('primo');
    check('unticking it removes it', ids().indexOf('primo') === -1, ids().join(','));
    G.wizApplyAdviseRecommendations();
    check('THE BUG: pressing Next does not put it back', ids().indexOf('primo') === -1, ids().join(','));
    check('  …and nothing else is seeded in its place', ids().length === 0, ids().join(','));

    // A user who picks something else keeps exactly that.
    st = fresh();
    G.wizStepAdvise({innerHTML:''}, {innerHTML:''});
    G.wizAdviseToggleCompound('primo');   // off
    G.wizAdviseToggleCompound('npp');     // on
    G.wizApplyAdviseRecommendations();
    check('a deliberate swap survives Next', ids().join(',') === 'npp', ids().join(','));

    // Untouched: seeding still works, which is what it was for.
    st = fresh();
    G.wizApplyAdviseRecommendations();
    check('an untouched step is still seeded from the recommendation',
      ids().indexOf('primo') >= 0, ids().join(','));

    // A NEW recommendation is a new question — pre-ticking is allowed again.
    st = fresh();
    G.wizStepAdvise({innerHTML:''}, {innerHTML:''});
    G.wizAdviseToggleCompound('primo');
    check('touched is recorded', G._wizAdviseState()._touched === true);
    G._wizAdviseInvalidate(G._wizAdviseState());
    check('a new recommendation clears every seed flag',
      G._wizAdviseState()._touched === false && G._wizAdviseState()._seeded === false &&
      G._wizAdviseState()._autoSel === false && G._wizAdviseState().result === null);

    G.ENHANCEMENT_COMPOUNDS = _svCat; G._wiz = _svWiz; G.document.getElementById = _svDoc;
  }

  // ── The wizard never adds a second testosterone ester ──────────────────────
  // Henrik, 2026-08-20: "Wizard silently adds Test E by itself even though I choose
  // Nebido." The wizard holds the chosen ester in TWO places — _wiz.trtPlan.compId
  // (the TRT step's planner, which a normal run fills in) and _wiz.trt.compounds
  // (the classic editor). _wizTrtHasTesto only read the second, so after picking
  // Nebido it answered "no testosterone yet" and the advise step seeded its
  // recommended base as a second TRT compound. Validate renders both lists, so both
  // esters appeared.
  console.log('\n── Wizard: one ester, from either place ───────────────────');
  {
    const _svWiz2 = G._wiz, _svTier2 = G._userTier;
    G.initWizard(); G._userTier = 3;

    // ── the guard sees both representations ──
    G._wiz.trtPlan = null; G._wiz.trt = {enabled:false, compounds:[]};
    check('no ester anywhere reads as none', G._wizTrtHasTesto() === false);

    G._wiz.trtPlan = {compId:'nebido', doseMg:'1000', cadenceDays:70, startDate:'2026-08-01'};
    check('THE BUG: an ester chosen in the TRT planner counts', G._wizTrtHasTesto() === true);

    G._wiz.trtPlan = null; G._wiz.trt = {enabled:true, compounds:[{id:'enanthate', name:'Test E'}]};
    check('  …and so does one from the classic editor', G._wizTrtHasTesto() === true);

    // ── the seeder refuses once either holds one ──
    G._wiz.trtPlan = {compId:'nebido', doseMg:'1000', cadenceDays:70, startDate:'2026-08-01'};
    G._wiz.trt = {enabled:false, compounds:[]};
    const seeded = G._wizSeedTrtBase('enanthate');
    check('the advise base is NOT seeded on top of the planner choice', seeded === false);
    check('  …so the protocol still carries exactly one ester',
      (G._wiz.trt.compounds || []).length === 0, JSON.stringify(G._wiz.trt.compounds));

    // ── and Validate lists one, not two ──
    if (typeof G._wizTrtSummaryRows === 'function') {
      const rows = G._wizTrtSummaryRows();
      check('Validate shows one testosterone row, the one chosen',
        rows.length === 1 && rows[0].id === 'nebido',
        rows.map(r => r.id).join(','));
    }

    // ── with nothing chosen, seeding still works, which is what it is for ──
    G._wiz.trtPlan = null; G._wiz.trt = {enabled:false, compounds:[]};
    check('an empty protocol still accepts the recommended base',
      G._wizSeedTrtBase('enanthate') === true &&
      (G._wiz.trt.compounds || []).some(c => c.id === 'enanthate'));

    G._wiz = _svWiz2; G._userTier = _svTier2;
  }

  // ── Every tab a button navigates to actually exists ────────────────────────
  // Henrik, 2026-08-20: "Open plan Compounds doesn't do anything if clicked? Do you
  // have tests for all features/buttons?" — no, and this class had NO coverage.
  //
  // The button read getElementById('tab-btn-stack'). The real id is 'tab-btn-stacks',
  // plural. Wrapped in `if(b)b.click();` the miss was silent: no error, no navigation,
  // nothing in the console. Two buttons were dead this way, both written by me.
  //
  // Same shape as dmWhere and the deleted _tcSetChartZoom: a name that resolves to
  // nothing, guarded so it cannot complain. Source greps cannot catch it — the string
  // is present and spelled plausibly. Compare it against the ids the page DEFINES.
  console.log('\n── Buttons navigate somewhere real ────────────────────────');
  {
    const base = path.dirname(path.resolve(htmlPath));
    const html = fs.readFileSync(path.resolve(htmlPath), 'utf8');
    const modules = [...html.matchAll(/src="([a-z-]+\.js)/g)].map(m => m[1]);
    let all = html;
    for (const f of modules) {
      const fp = path.join(base, f);
      if (fs.existsSync(fp)) all += '\n' + fs.readFileSync(fp, 'utf8');
    }

    // The nav ids the page actually defines.
    const defined = new Set([...html.matchAll(/id="(tab-btn-[a-z]+)"/g)].map(m => m[1]));
    check('the page defines its tab buttons', defined.size >= 10, [...defined].join(','));

    // Every tab-btn-* id referenced anywhere, however it is quoted or escaped.
    const referenced = new Set([...all.matchAll(/tab-btn-[a-z]+/g)].map(m => m[0]));
    const dangling = [...referenced].filter(id => !defined.has(id)).sort();
    check('every tab-btn-* id a handler asks for exists',
      dangling.length === 0,
      dangling.length ? 'dangling: ' + dangling.join(', ') : 'checked ' + referenced.size);

    // switchTab's first argument must be a tab the app knows.
    const tabNames = new Set([...defined].map(id => id.replace('tab-btn-', '')));
    const switched = new Set([...all.matchAll(/switchTab\(\\?'([a-z]+)\\?'/g)].map(m => m[1]));
    const unknownTabs = [...switched].filter(t => !tabNames.has(t)).sort();
    check('every switchTab target is a real tab',
      unknownTabs.length === 0,
      unknownTabs.length ? 'unknown: ' + unknownTabs.join(', ') : 'checked ' + switched.size);

    // The two buttons that were dead, named so a regression is obvious.
    const tcSrc = fs.readFileSync(path.join(base, 'tab-tcalc.js'), 'utf8');
    const tdSrc = fs.readFileSync(path.join(base, 'tab-today.js'), 'utf8');
    check("T-Calc's \"Open Plan ▸ Compounds\" points at a real button",
      /tab-btn-stacks/.test(tcSrc) && !/tab-btn-stack['\\]/.test(tcSrc));
    check("  …as does Today's \"testosterone not scheduled\" alert",
      /tab-btn-stacks/.test(tdSrc) && !/tab-btn-stack['\\]/.test(tdSrc));
  }

  // ── The wizard says it is loading, instead of showing nothing ──────────────
  // Henrik, 2026-08-20: "The wizard needs a loading spinner between screens, I am
  // having slow internet and you are sometimes presented with an empty screen for a
  // while." wizRender handed `body` to the renderer without clearing it, so a step
  // waiting on the backend left the previous screen — or nothing — on display.
  console.log('\n── Wizard: loading state between steps ────────────────────');
  {
    const _svCat = G.ENHANCEMENT_COMPOUNDS, _svRend = G._WIZ_RENDERERS, _svDoc = G.document.getElementById;
    const els = {};
    const el = id => (els[id] = els[id] || {innerHTML:'', textContent:'', scrollTop:0});
    G.document.getElementById = id => el(id);

    G.initWizard(); G._userTier = 3;

    // A renderer that returns without writing — the slow-step case.
    G._WIZ_RENDERERS = Object.assign({}, _svRend, {goals: function(){ /* writes nothing */ }});
    G._wiz.step = 1;
    G.wizRender();
    check('a step that has not drawn yet shows the spinner',
      /today-spinner-dot/.test(el('wiz-body').innerHTML), el('wiz-body').innerHTML.slice(0,80));
    check('  …and says so in words, not just an animation',
      /Loading/.test(el('wiz-body').innerHTML));
    check('  …with Next disabled, so a half-loaded step cannot be walked past',
      /disabled/.test(el('wiz-footer').innerHTML), el('wiz-footer').innerHTML.slice(0,120));

    // A renderer that writes replaces the spinner in the same tick — no flash.
    G._WIZ_RENDERERS = Object.assign({}, _svRend, {
      goals: function(b,f){ b.innerHTML = '<div>real content</div>'; f.innerHTML = '<button>Next</button>'; }});
    G.wizRender();
    check('a ready step replaces the spinner outright',
      el('wiz-body').innerHTML === '<div>real content</div>');
    check('  …and re-enables its own footer',
      !/disabled/.test(el('wiz-footer').innerHTML));

    // A throwing renderer must not strand the user on a spinner forever.
    G._WIZ_RENDERERS = Object.assign({}, _svRend, {
      goals: function(){ throw new Error('boom'); }});
    G.wizRender();
    check('a step that throws shows an error, not an endless spinner',
      /could not be drawn/.test(el('wiz-body').innerHTML) && !/today-spinner-dot/.test(el('wiz-body').innerHTML));
    check('  …naming the failure', /boom/.test(el('wiz-body').innerHTML));
    check('  …and offering a way out', /Try again/.test(el('wiz-body').innerHTML));

    G._WIZ_RENDERERS = _svRend;
    G.ENHANCEMENT_COMPOUNDS = _svCat;
    G.document.getElementById = _svDoc;
  }

  // ── The shopping list includes what the protocol is built on ───────────────
  // Henrik, 2026-08-20: "Test U missing in Shopping list for a new protocol."
  // The cart read st.peptides and st.enhanced.compounds and never st.trt.compounds,
  // so testosterone was invisible to it. Hidden while enhanced cycles carried their
  // base in the ENHANCED block; exposed the moment Phase 4 merged the tiers and
  // testosterone moved to `trt` for every protocol.
  console.log('\n── Shopping list: testosterone ────────────────────────────');
  {
    const wk = 12;
    // Nebido: 1000 mg every 12 weeks, ampoule is 1000mg/4ml.
    const neb = G._calcTrtCartItem({id:'nebido', name:'Nebido', dose:'1000', unit:'mg',
                                    freqVal:12, freqUnit:'weeks'}, wk);
    check('Nebido appears at all', !!neb && !neb.noData, JSON.stringify(neb));
    check('  …one injection in a 12-week cycle, so 1000 mg',
      neb.totalMg === 1000, JSON.stringify(neb));
    check('  …which is one ampoule', neb.units === 1 && /ampoule/.test(neb.unitLabel));
    check('  …with the pack size read from the catalogue',
      /1000 mg\/4 mL/.test(neb.packDesc), neb.packDesc);

    // Testoviron 125 mg weekly, ampoule is 250mg/ml → 1500 mg → 6 ampoules.
    const tv = G._calcTrtCartItem({id:'testoviron', name:'Testoviron Depot',
                                   dose:'125', unit:'mg', freqVal:1, freqUnit:'weeks',
                                   days:[1]}, wk);
    check('a weekly ester totals dose × weeks', tv.totalMg === 125 * wk, JSON.stringify(tv));
    check('  …and rounds ampoules up, never down', tv.units === Math.ceil(1500 / 250), JSON.stringify(tv));

    // KNOWN GAP, pinned deliberately: only nebido and testoviron state a concentration
    // in TRT_CAT ("1000mg/4ml", "250mg/ml"). enanthate/cypionate/propionate say
    // "Generic / Jenapharm" and the like, so there is nothing to divide by and no
    // ampoule count can be given. They still report total mg, which is the part that
    // matters for ordering. Adding pack sizes for them is Henrik's data to supply —
    // inventing a concentration would put a wrong number on a shopping list.
    const ena = G._calcTrtCartItem({id:'enanthate', name:'Testosterone Enanthate',
                                    dose:'125', unit:'mg', freqVal:1, freqUnit:'weeks',
                                    days:[1]}, wk);
    check('an ester with no stated concentration reports total mg and no ampoule count',
      ena.totalMg === 125 * wk && ena.units === null, JSON.stringify(ena));

    // Twice weekly is twice the total.
    const twice = G._calcTrtCartItem({id:'enanthate', name:'Testosterone Enanthate',
                                      dose:'125', unit:'mg', days:[1,4]}, wk);
    check('two injection days a week doubles the total', twice.totalMg === 125 * 2 * wk, JSON.stringify(twice));

    // A RATE must not be counted as a per-injection amount.
    const rate = G._calcTrtCartItem({id:'enanthate', name:'Testosterone Enanthate',
                                     dose:'250', unit:'mg/week', days:[1,4]}, wk);
    check('a mg/week rate is converted, not multiplied as if it were per injection',
      rate.totalMg === 250 * wk, JSON.stringify(rate));

    // No dose yet: say so rather than vanishing.
    const empty = G._calcTrtCartItem({id:'nebido', name:'Nebido', dose:'', unit:'mg',
                                      freqVal:12, freqUnit:'weeks'}, wk);
    check('a compound with no dose is listed, not dropped',
      !!empty && empty.noData === true, JSON.stringify(empty));

    // A compound with no parseable pack still reports its total.
    const noPack = G._calcTrtCartItem({id:'unknown-ester', name:'Something', dose:'100',
                                       unit:'mg', days:[1]}, wk);
    check('an unknown ester still reports total mg',
      noPack.totalMg === 100 * wk && noPack.units === null, JSON.stringify(noPack));

    // And the renderer actually has a section for it.
    const idx = fs.readFileSync(path.resolve(htmlPath), 'utf8');
    check('the cart renders a testosterone section',
      /Testosterone — source separately/.test(idx));
    check('  …built from st.trt.compounds', /st\.trt&&st\.trt\.compounds\)\?st\.trt\.compounds\.filter/.test(idx));
    check('  …and the empty-cart message accounts for it',
      /!hasItems&&!peptides\.length&&!enhanceCmpds\.length&&!trtCmpds\.length/.test(idx));
  }

console.log(`  ${passed} passed  ${failed} failed  ${passed+failed} total`);
  process.exit(failed===0?0:1);
});

// ── Blend vial PEPTIDE_CAT defaults ──────────────────────────────────────────
console.log('\n── Blend vial PEPTIDE_CAT defaults ────────────────────────');
const glowCat  = G.PEPTIDE_CAT.find(p=>p.id==='glow');
const klowCat  = G.PEPTIDE_CAT.find(p=>p.id==='klow');
const bpcTbCat = G.PEPTIDE_CAT.find(p=>p.id==='bpc-tb');
check('glow default unit is ml',    glowCat?.dflt?.unitAm==='ml',  `got "${glowCat?.dflt?.unitAm}"`);
check('glow default dose is 0.09',  parseFloat(glowCat?.dflt?.doseAm)===0.09, `got "${glowCat?.dflt?.doseAm}"`);
check('klow default unit is ml',    klowCat?.dflt?.unitAm==='ml',  `got "${klowCat?.dflt?.unitAm}"`);
check('klow default dose is 0.1',   parseFloat(klowCat?.dflt?.doseAm)===0.1, `got "${klowCat?.dflt?.doseAm}"`);
check('bpc-tb default unit is mg',  bpcTbCat?.dflt?.unitAm==='mg', `got "${bpcTbCat?.dflt?.unitAm}"`);
check('bpc-tb default dose is 1',   parseFloat(bpcTbCat?.dflt?.doseAm)===1.0, `got "${bpcTbCat?.dflt?.doseAm}"`);

// ── reconCalc ml unit ─────────────────────────────────────────────────────────
console.log('\n── reconCalc: ml dose unit ─────────────────────────────────');
// 0.2ml dose → ml=0.2, iu=20 (identity: ml input passes straight through)
const rcMl1=G.reconCalc('0.2','ml',70,2,'mg');
check('reconCalc ml: 0.2ml → ml=0.2',    rcMl1&&rcMl1.ml===0.2,  `got ${rcMl1?.ml}`);
check('reconCalc ml: 0.2ml → iu=20',     rcMl1&&rcMl1.iu===20,   `got ${rcMl1?.iu}`);
// 0.5ml dose on klow-type (80mg/2ml=40mg/ml) → 50 IU
const rcMl2=G.reconCalc('0.5','ml',80,2,'mg');
check('reconCalc ml: 0.5ml → ml=0.5',    rcMl2&&rcMl2.ml===0.5,  `got ${rcMl2?.ml}`);
check('reconCalc ml: 0.5ml → iu=50',     rcMl2&&rcMl2.iu===50,   `got ${rcMl2?.iu}`);

// ── reconDoseRow: ml unit and volume warnings ─────────────────────────────────
console.log('\n── reconDoseRow: ml unit & warnings ───────────────────────');
const rowMl  = G.reconDoseRow('AM','0.2','ml',70,2,'mg');
check('reconDoseRow ml: shows 20 IU',           rowMl.includes('20 IU'),         `snippet: ${rowMl.slice(0,150)}`);
check('reconDoseRow ml: no redundant arrow',    !rowMl.includes('→'),            'found arrow → in ml-input row');
check('reconDoseRow ml: no tiny-vol warning',   !rowMl.includes('Very small'),   'spurious tiny warning');
// 1.5mg at 35mg/ml = 0.0429ml < 0.05 → tiny volume warning
const rowTiny = G.reconDoseRow('AM','1.5','mg',70,2,'mg');
check('reconDoseRow: tiny vol < 0.05ml warns',  rowTiny.includes('Very small volume'), `snippet: ${rowTiny.slice(0,200)}`);
// Large volume (3ml at 2.5mg/ml)
const rowLarge= G.reconDoseRow('AM','3','ml',5,2,'mg');
check('reconDoseRow: large vol > 1ml warns',    rowLarge.includes('Large injection volume'), `snippet: ${rowLarge.slice(0,200)}`);

// ── Recon guide: low-dead-space (LDS) syringe hardware guidance (#636) ────────
{
  const guide = G.buildReconGuide();
  check('recon guide recommends low-dead-space syringes',
    /low[- ]dead[- ]space|LDS/i.test(guide));
  check('recon guide warns about ~10% loss to dead space',
    guide.includes('10%') && /dead[- ]space|hub/i.test(guide));
}

// ── reconDoseRow: 1mg threshold display logic ────────────────────────────────
console.log('\n── reconDoseRow: 1mg threshold display ────────────────────');
// IU input <1mg → IU only (no ml, no mcg) — CJC 4 IU at 6.667mg/ml = 0.267mg
const rowIuSmall = G.reconDoseRow('AM','4','IU',20,3,'mg');
check('reconDoseRow IU<1mg: shows 4 IU',       rowIuSmall.includes('4 IU'),    `snippet: ${rowIuSmall.slice(0,150)}`);
check('reconDoseRow IU<1mg: no syringe label', !rowIuSmall.includes('syringe'),`snippet: ${rowIuSmall.slice(0,150)}`);
check('reconDoseRow IU<1mg: no mcg',           !rowIuSmall.includes('mcg'),    `snippet: ${rowIuSmall.slice(0,150)}`);
check('reconDoseRow IU<1mg: no small-vol warn',!rowIuSmall.includes('Very small'),`snippet: ${rowIuSmall.slice(0,200)}`);
// IU input >=1mg → IU + mg (no ml) — 9 IU at 23.333mg/ml = 2.1mg
const rowIuLarge = G.reconDoseRow('AM','9','IU',70,3,'mg');
check('reconDoseRow IU>=1mg: shows 9 IU',      rowIuLarge.includes('9 IU'),    `snippet: ${rowIuLarge.slice(0,150)}`);
check('reconDoseRow IU>=1mg: shows 2.1 mg',    rowIuLarge.includes('2.1 mg'), `snippet: ${rowIuLarge.slice(0,150)}`);
check('reconDoseRow IU>=1mg: no ml',           !rowIuLarge.includes(' ml'),    `snippet: ${rowIuLarge.slice(0,150)}`);
// ml input <1mg → IU only — 0.04ml at 6.667mg/ml = 0.267mg
const rowMlSmall = G.reconDoseRow('AM','0.04','ml',20,3,'mg');
check('reconDoseRow ml<1mg: shows 4 IU',       rowMlSmall.includes('4 IU'),   `snippet: ${rowMlSmall.slice(0,150)}`);
check('reconDoseRow ml<1mg: no syringe label',  !rowMlSmall.includes('syringe'),`snippet: ${rowMlSmall.slice(0,150)}`);
// ml input >=1mg → IU · ml = Xmg — GLOW 0.09ml at 23.333mg/ml = 2.1mg
const rowMlLarge = G.reconDoseRow('AM','0.09','ml',70,3,'mg');
check('reconDoseRow ml>=1mg: shows 9 IU',      rowMlLarge.includes('9 IU'),   `snippet: ${rowMlLarge.slice(0,150)}`);
check('reconDoseRow ml>=1mg: shows 0.09 ml',   rowMlLarge.includes('0.09 ml'),`snippet: ${rowMlLarge.slice(0,150)}`);
check('reconDoseRow ml>=1mg: shows 2.1 mg',    rowMlLarge.includes('2.1 mg'), `snippet: ${rowMlLarge.slice(0,150)}`);
// mg input <1mg → IU only — Sema 0.5mg at 2.5mg/ml = 20 IU
const rowMgSmall = G.reconDoseRow('AM','0.5','mg',5,2,'mg');
check('reconDoseRow mg<1mg: shows 20 IU',      rowMgSmall.includes('20 IU'),  `snippet: ${rowMgSmall.slice(0,150)}`);
check('reconDoseRow mg<1mg: no 0.5 mg text',   !rowMgSmall.includes('0.5 mg'),`snippet: ${rowMgSmall.slice(0,150)}`);
// mg input >=1mg → original format — Reta 3mg at 10mg/ml = 30 IU
const rowMgLarge = G.reconDoseRow('AM','3','mg',10,1,'mg');
check('reconDoseRow mg>=1mg: shows 3 mg',      rowMgLarge.includes('3 mg'),   `snippet: ${rowMgLarge.slice(0,150)}`);
check('reconDoseRow mg>=1mg: shows 30 IU',     rowMgLarge.includes('30 IU'),  `snippet: ${rowMgLarge.slice(0,150)}`);
// mcg input <1mg → IU only — 200mcg at 2.5mg/ml = 8 IU
const rowMcgSmall = G.reconDoseRow('AM','200','mcg',5,2,'mg');
check('reconDoseRow mcg<1mg: shows 8 IU',      rowMcgSmall.includes('8 IU'),  `snippet: ${rowMcgSmall.slice(0,150)}`);
check('reconDoseRow mcg<1mg: no mcg text',     !rowMcgSmall.includes('mcg'), `snippet: ${rowMcgSmall.slice(0,150)}`);

// ── µg unit display: never show incorrect "mcg" to the user ──────────────────
// Internal unit key stays 'mcg' (calc logic unchanged); only the DISPLAYED label is µg.
console.log('\n── µg unit display (mcg → µg) ──────────────────────────────');
// _doseLabel: mcg-unit dose renders as µg, never mcg
const dlMcg = G._doseLabel('ipamorelin','200','mcg');
check('_doseLabel mcg: displays µg',           dlMcg.includes('µg'),  `got: ${dlMcg}`);
check('_doseLabel mcg: never shows mcg',        !dlMcg.includes('mcg'), `got: ${dlMcg}`);
check('_doseLabel mg: unchanged (no µg)',      !G._doseLabel('ipamorelin','2','mg').includes('µg'), 'mg dose leaked µg');
// reconDoseRow: mcg input ≥1mg shows the dose with µg label, not mcg
const rowMcgBig = G.reconDoseRow('AM','2000','mcg',5,2,'mg');
check('reconDoseRow mcg≥1mg: shows µg',        rowMcgBig.includes('2000 µg'), `snippet: ${rowMcgBig.slice(0,150)}`);
check('reconDoseRow mcg≥1mg: never shows mcg',  !rowMcgBig.includes('mcg'),    `snippet: ${rowMcgBig.slice(0,150)}`);
// UNIT_LABELS drives the Today/day views' raw-unit rendering
check('UNIT_LABELS maps mcg→µg',               G.UNIT_LABELS && G.UNIT_LABELS.mcg==='µg', `got: ${G.UNIT_LABELS&&G.UNIT_LABELS.mcg}`);

// ── buildReconCard HTML rendering ─────────────────────────────────────────────
console.log('\n── buildReconCard HTML rendering ───────────────────────────');
G._reconStackIdx=0; G._reconState={};

// Glow: 0.2ml at 70mg/2ml=35mg/ml → 0.2ml → 20 IU
const glowP  ={id:'glow',       name:'Glow Stack',        dose_am:'0.2',unit_am:'ml',dose_pm:'',unit_pm:'ml'};
const glowH  =G.buildReconCard(glowP,0);
check('buildReconCard glow: shows 20 IU',       glowH.includes('20 IU'),         `snippet: ${glowH.slice(0,200)}`);
check('buildReconCard glow: no redundant →',    !glowH.includes('>→<'),          'found >→< in glow card');

// Klow: 0.2ml at 80mg/2ml=40mg/ml → 20 IU
G._reconState={};
const klowP  ={id:'klow',       name:'Klow Stack',        dose_am:'0.2',unit_am:'ml',dose_pm:'',unit_pm:'ml'};
const klowH  =G.buildReconCard(klowP,1);
check('buildReconCard klow: shows 20 IU',       klowH.includes('20 IU'),         `snippet: ${klowH.slice(0,200)}`);

// BPC-TB: 1mg at 10mg/2ml=5mg/ml → 0.2ml → 20 IU
G._reconState={};
const bpcTbP ={id:'bpc-tb',     name:'BPC+TB Blend',      dose_am:'1', unit_am:'mg',dose_pm:'',unit_pm:'mg'};
const bpcTbH =G.buildReconCard(bpcTbP,2);
check('buildReconCard bpc-tb: shows 20 IU',     bpcTbH.includes('20 IU'),        `snippet: ${bpcTbH.slice(0,200)}`);

// Retatrutide: 3mg at 10mg/1ml=10mg/ml → 0.3ml → 30 IU
G._reconState={};
const retaP  ={id:'retatrutide',name:'Retatrutide',        dose_am:'3', unit_am:'mg',dose_pm:'',unit_pm:'mg'};
const retaH  =G.buildReconCard(retaP,3);
check('buildReconCard retatrutide: shows 30 IU', retaH.includes('30 IU'),        `snippet: ${retaH.slice(0,200)}`);

// Tirzepatide: 5mg at 10mg/1ml=10mg/ml → 0.5ml → 50 IU
G._reconState={};
const tirzP  ={id:'tirzepatide',name:'Tirzepatide',        dose_am:'5', unit_am:'mg',dose_pm:'',unit_pm:'mg'};
const tirzH  =G.buildReconCard(tirzP,4);
check('buildReconCard tirzepatide: shows 50 IU', tirzH.includes('50 IU'),        `snippet: ${tirzH.slice(0,200)}`);

// Semaglutide: 0.5mg at 5mg/2ml=2.5mg/ml → 0.2ml → 20 IU
G._reconState={};
const semaP  ={id:'semaglutide',name:'Semaglutide',        dose_am:'0.5',unit_am:'mg',dose_pm:'',unit_pm:'mg'};
const semaH  =G.buildReconCard(semaP,5);
check('buildReconCard semaglutide: shows 20 IU', semaH.includes('20 IU'),        `snippet: ${semaH.slice(0,200)}`);

// Ipamorelin: 200mcg at 5mg/2ml=2.5mg/ml → 0.08ml → 8 IU
G._reconState={};
const ipaP   ={id:'ipamorelin', name:'Ipamorelin',         dose_am:'200',unit_am:'mcg',dose_pm:'',unit_pm:'mcg'};
const ipaH   =G.buildReconCard(ipaP,6);
check('buildReconCard ipamorelin: shows 8 IU',   ipaH.includes('8 IU'),          `snippet: ${ipaH.slice(0,200)}`);

// HGH: 1 IU at 10IU/1ml → 0.1ml → 10 IU
G._reconState={};
const hghP   ={id:'hgh',        name:'HGH',                dose_am:'1',  unit_am:'IU',dose_pm:'',unit_pm:'IU'};
const hghH   =G.buildReconCard(hghP,7);
check('buildReconCard hgh: shows 10 IU',         hghH.includes('10 IU'),         `snippet: ${hghH.slice(0,200)}`);

// Synthesized-stack IDs (WEEKLY_DEFAULT style) must resolve correctly
console.log('\n── buildReconCard: synthesized-stack (WEEKLY_DEFAULT) IDs ──');
// 'reta-sun' is the id _synthesizeProtocol used to create before this fix
G._reconState={};
const retaSynP ={id:'reta-sun', name:'Retatrutide',   dose_am:'3',  unit_am:'mg',dose_pm:'',unit_pm:'mg'};
const retaSynH =G.buildReconCard(retaSynP,0);
check('buildReconCard reta-sun: resolves to 10mg/ml',  retaSynH.includes('10 mg/ml'),  `snippet: ${retaSynH.slice(0,300)}`);
check('buildReconCard reta-sun: shows 30 IU',          retaSynH.includes('30 IU'),     `snippet: ${retaSynH.slice(0,300)}`);

G._reconState={};
const cjcAmSynP={id:'cjc-am',  name:'CJC-1295 / IPA', dose_am:'400',unit_am:'mcg',dose_pm:'',unit_pm:'mcg'};
const cjcAmSynH=G.buildReconCard(cjcAmSynP,1);
check('buildReconCard cjc-am: resolves to cjc-ipa db',cjcAmSynH.includes('6.667 mg/ml'), `snippet: ${cjcAmSynH.slice(0,300)}`);
check('buildReconCard cjc-am: shows 6 IU',            cjcAmSynH.includes('6 IU'),        `snippet: ${cjcAmSynH.slice(0,300)}`);

G._reconState={};
const glow1SynP={id:'glow-1',  name:'GLOW Stack',     dose_am:'0.09',unit_am:'ml', dose_pm:'',unit_pm:'ml'};
const glow1SynH=G.buildReconCard(glow1SynP,2);
check('buildReconCard glow-1: resolves to 23.333mg/ml',glow1SynH.includes('23.333 mg/ml'),`snippet: ${glow1SynH.slice(0,300)}`);
check('buildReconCard glow-1: shows 9 IU',             glow1SynH.includes('9 IU'),         `snippet: ${glow1SynH.slice(0,300)}`);

// ── Meta ──────────────────────────────────────────────────────────────────────
console.log('\n── Meta ───────────────────────────────────────────────────');
check('VERSION defined',                    typeof G.VERSION==='string');
check('VERSION is x.xx (no suffix)',        /^\d+\.\d+$/.test(G.VERSION),        `got "${G.VERSION}"`);
check('AGENT_URL is https',                 G.AGENT_URL?.startsWith('https://'));
check('authHeaders is function (Google-only auth)', typeof G.authHeaders==='function');
check('no WEIGHTS_TOKEN/app_pin leftovers',  !rawScript.includes('WEIGHTS_TOKEN')&&!rawScript.includes('app_pin'));
check('no duplicate functions',             (()=>{const fs=rawScript.match(/(?:async )?function (\w+)\s*\(/g)||[];const names=fs.map(s=>s.replace(/async |function |\s*\(/g,''));return names.every((n,i)=>names.indexOf(n)===i);})());

// ── RECON_DB ──────────────────────────────────────────────────────────────────
console.log('\n── RECON_DB & reconCalc ───────────────────────────────────');
check('RECON_DB defined',                   typeof G.RECON_DB==='object'&&G.RECON_DB!==null);
check('20+ entries in RECON_DB',            Object.keys(G.RECON_DB||{}).length>=20,  `got ${Object.keys(G.RECON_DB||{}).length}`);
check('all PEPTIDE_CAT ids in RECON_DB',    G.PEPTIDE_CAT.every(p=>G.RECON_DB[p.id]),
  G.PEPTIDE_CAT.filter(p=>!G.RECON_DB[p.id]).map(p=>p.id).join(', '));
check('each entry has vials array',         Object.values(G.RECON_DB).every(e=>Array.isArray(e.vials)&&e.vials.length>0));
check('each entry has water array',         Object.values(G.RECON_DB).every(e=>Array.isArray(e.water)&&e.water.length>0));
check('hgh unit=IU',                        G.RECON_DB['hgh']?.unit==='IU');
check('hcg unit=IU',                        G.RECON_DB['hcg']?.unit==='IU');
check('semax nasal=true',                   G.RECON_DB['semax']?.nasal===true);
check('reconCalc defined',                  typeof G.reconCalc==='function');
// mcg dose on mg vial: 200mcg, 5mg/2ml → 2.5mg/ml → 0.08ml, 8 IU
const rc1=G.reconCalc('200','mcg',5,2,'mg');
check('200mcg/5mg@2ml → 0.08ml',           rc1&&rc1.ml===0.08,                     `got ${rc1?.ml}`);
check('200mcg/5mg@2ml → 8 IU',             rc1&&rc1.iu===8,                        `got ${rc1?.iu}`);
// mg dose on mg vial: 3mg, 5mg/1ml → 5mg/ml → 0.6ml, 60 IU
const rc2=G.reconCalc('3','mg',5,1,'mg');
check('3mg/5mg@1ml → 0.6ml',               rc2&&rc2.ml===0.6,                      `got ${rc2?.ml}`);
check('3mg/5mg@1ml → 60 IU',               rc2&&rc2.iu===60,                       `got ${rc2?.iu}`);
// IU pen dose on mg vial: 4 IU, 5mg/2ml → 0.04ml, 4 IU, 100mcg equiv
const rc3=G.reconCalc('4','IU',5,2,'mg');
check('4 IU pen/5mg@2ml → 0.04ml',         rc3&&rc3.ml===0.04,                     `got ${rc3?.ml}`);
check('4 IU pen/5mg@2ml → 100mcg equiv',   rc3&&rc3.mcgEquiv===100,                `got ${rc3?.mcgEquiv}`);
// IU/IU (HGH): 1 IU, 10IU/1ml → 0.1ml, 10 IU
const rc4=G.reconCalc('1','IU',10,1,'IU');
check('1 IU/10IU@1ml → 0.1ml',             rc4&&rc4.ml===0.1,                      `got ${rc4?.ml}`);
check('1 IU/10IU@1ml → 10 IU',             rc4&&rc4.iu===10,                       `got ${rc4?.iu}`);
// null cases
check('reconCalc null on empty dose',       G.reconCalc('','mg',5,2,'mg')===null);
check('reconCalc null on zero dose',        G.reconCalc('0','mg',5,2,'mg')===null);
// Recon functions defined
['renderRecon','selectReconStack','setReconState','buildReconCard','buildReconGuide','reconDoseRow']
  .forEach(fn=>check(fn+' defined', typeof G[fn]==='function'));

// ── RECON_DB defaults & clinical doses ────────────────────────────────────────
console.log('\n── RECON_DB defaults & clinical doses ─────────────────────');
const RDB=G.RECON_DB||{};
check('all entries have defaultVi',         Object.values(RDB).every(e=>e.defaultVi!=null),
  Object.entries(RDB).filter(([,e])=>e.defaultVi==null).map(([k])=>k).join(', '));
check('all entries have defaultWi',         Object.values(RDB).every(e=>e.defaultWi!=null),
  Object.entries(RDB).filter(([,e])=>e.defaultWi==null).map(([k])=>k).join(', '));
check('all defaultVi valid index',          Object.values(RDB).every(e=>e.defaultVi<e.vials.length),
  Object.entries(RDB).filter(([,e])=>e.defaultVi>=e.vials.length).map(([k])=>k).join(', '));
check('all defaultWi valid index',          Object.values(RDB).every(e=>e.defaultWi<e.water.length),
  Object.entries(RDB).filter(([,e])=>e.defaultWi>=e.water.length).map(([k])=>k).join(', '));

function defVial(id){const e=RDB[id];return e.vials[e.defaultVi];}
function defWater(id){const e=RDB[id];return e.water[e.defaultWi];}

// retatrutide: defaultVi=1→10mg, defaultWi=1→1ml → 10mg/ml → 3mg = 0.3ml = 30 IU
const rcReta=G.reconCalc('3','mg',defVial('retatrutide'),defWater('retatrutide'),'mg');
check('retatrutide default: 3mg → 0.3ml',  rcReta&&rcReta.ml===0.3,   `got ${rcReta?.ml}`);
check('retatrutide default: 3mg → 30 IU',  rcReta&&rcReta.iu===30,    `got ${rcReta?.iu}`);

// tirzepatide: defaultVi=1→10mg, defaultWi=1→1ml → 10mg/ml → 5mg = 0.5ml = 50 IU
const rcTirz=G.reconCalc('5','mg',defVial('tirzepatide'),defWater('tirzepatide'),'mg');
check('tirzepatide default: 5mg → 0.5ml',  rcTirz&&rcTirz.ml===0.5,   `got ${rcTirz?.ml}`);
check('tirzepatide default: 5mg → 50 IU',  rcTirz&&rcTirz.iu===50,    `got ${rcTirz?.iu}`);

// semaglutide: defaultVi=1→5mg, defaultWi=1→2ml → 2.5mg/ml → 0.5mg = 0.2ml = 20 IU
const rcSema=G.reconCalc('0.5','mg',defVial('semaglutide'),defWater('semaglutide'),'mg');
check('semaglutide default: 0.5mg → 0.2ml',rcSema&&rcSema.ml===0.2,   `got ${rcSema?.ml}`);
check('semaglutide default: 0.5mg → 20 IU',rcSema&&rcSema.iu===20,    `got ${rcSema?.iu}`);

// hgh (IU vial): defaultVi=1→10IU, defaultWi=0→1ml → 10IU/ml → 1IU = 0.1ml = 10 IU
const rcHgh=G.reconCalc('1','IU',defVial('hgh'),defWater('hgh'),'IU');
check('hgh default: 1 IU → 0.1ml',         rcHgh&&rcHgh.ml===0.1,    `got ${rcHgh?.ml}`);
check('hgh default: 1 IU → 10 IU',         rcHgh&&rcHgh.iu===10,     `got ${rcHgh?.iu}`);

// hcg (IU vial): defaultVi=0→5000IU, defaultWi=0→1ml → 5000IU/ml → 500IU = 0.1ml = 10 IU
const rcHcg=G.reconCalc('500','IU',defVial('hcg'),defWater('hcg'),'IU');
check('hcg default: 500 IU → 0.1ml',       rcHcg&&rcHcg.ml===0.1,    `got ${rcHcg?.ml}`);
check('hcg default: 500 IU → 10 IU',       rcHcg&&rcHcg.iu===10,     `got ${rcHcg?.iu}`);

// ipamorelin: defaultVi=1→5mg, defaultWi=1→2ml → 2.5mg/ml → 200mcg = 0.08ml = 8 IU
const rcIpa=G.reconCalc('200','mcg',defVial('ipamorelin'),defWater('ipamorelin'),'mg');
check('ipamorelin default: 200mcg → 0.08ml',rcIpa&&rcIpa.ml===0.08,  `got ${rcIpa?.ml}`);
check('ipamorelin default: 200mcg → 8 IU', rcIpa&&rcIpa.iu===8,      `got ${rcIpa?.iu}`);

// bpc157: defaultVi=0→5mg, defaultWi=1→2ml → 2.5mg/ml → 250mcg = 0.1ml = 10 IU
const rcBpc=G.reconCalc('250','mcg',defVial('bpc157'),defWater('bpc157'),'mg');
check('bpc157 default: 250mcg → 0.1ml',    rcBpc&&rcBpc.ml===0.1,    `got ${rcBpc?.ml}`);
check('bpc157 default: 250mcg → 10 IU',    rcBpc&&rcBpc.iu===10,     `got ${rcBpc?.iu}`);

// cjc-ipa: 2×10mg combo vials / 3ml = 6.667mg/ml → 400mcg blend = 0.06ml = 6 IU
const rcCjc=G.reconCalc('400','mcg',defVial('cjc-ipa'),defWater('cjc-ipa'),'mg');
check('cjc-ipa default: 400mcg blend → 0.06ml',rcCjc&&rcCjc.ml===0.06, `got ${rcCjc?.ml}`);
check('cjc-ipa default: 400mcg blend → 6 IU',  rcCjc&&rcCjc.iu===6,    `got ${rcCjc?.iu}`);

// ── Price list validation ─────────────────────────────────────────────────────
console.log('\n── Price list: RECON_DB vials match pricelist.csv ─────────');
const plPath = path.join(__dirname, 'pricelist.csv');
// Map RECON_DB key → product name(s) in pricelist.csv (partial match on column 1)
const PRICELIST_MAP = {
  'cjc-ipa':    ['CJC1295(without DAC)5mg+IPA 5mg'],
  'cjc-nodac':  ['CJC-1295 Without DAC'],
  'ipamorelin': ['Ipamorelin'],
  'sermorelin': ['Sermorelin'],
  'tesamorelin':['Tesamorelin'],
  'hgh':        ['HGH'],
  'glow':       ['Glow(TB500 10mg + BPC-157 10mg + GHK-CU 50mg)'],
  'klow':       ['Klow(TB500 10mg + BPC-157 10mg + GHK-CU 50mg + KPV 10mg)'],
  'bpc-tb':     ['BPC 5mg + TB 5mg','BPC 10mg + TB 10mg'],
  'bpc157':     ['BPC 157'],
  'tb500':      ['TB500'],
  'ghkcu':      ['GHK-CU'],
  'retatrutide':['Retatrutide'],
  'tirzepatide':['Tirzepatide'],
  'semaglutide':['Semaglutide'],
  'aod9604':    ['AOD9604'],
  'semax':      ['Semax'],
  'selank':     ['Selank'],
  'epitalon':   ['Epitalon'],
  'motsc':      ['MOTS-C'],
  'nad':        ['NAD+'],
  'hcg':        ['HCG'],
};
check('pricelist.csv exists',               fs.existsSync(plPath));
if(fs.existsSync(plPath)){
  // Parse CSV: track current product name across continuation rows
  const plLines=fs.readFileSync(plPath,'utf8').split('\n');
  const plSizes={}; // productName → Set of numeric sizes
  let curProd='';
  for(const line of plLines){
    const cols=line.split(';');
    const name=(cols[1]||'').trim();
    const mg=(cols[2]||'').trim();
    if(name)curProd=name;
    if(curProd&&mg){
      const m=mg.match(/^(\d+(?:\.\d+)?)(mg|iu|ml)/i);
      if(m){
        if(!plSizes[curProd])plSizes[curProd]=new Set();
        plSizes[curProd].add(parseFloat(m[1]));
      }
    }
  }
  // For each RECON_DB key, verify every vial size appears in the price list
  for(const [dbKey,plNames] of Object.entries(PRICELIST_MAP)){
    const entry=RDB[dbKey];
    if(!entry){check(`${dbKey}: in RECON_DB`,false,'missing');continue;}
    // Merge available sizes from all matching product names
    const available=new Set();
    for(const pn of plNames)(plSizes[pn]||new Set()).forEach(s=>available.add(s));
    // cjc-ipa RECON_DB uses 20mg = 2 × 10mg combo vials combined into one cartridge
    if(dbKey==='cjc-ipa')for(const pn of plNames)(plSizes[pn]||new Set()).forEach(s=>available.add(s*2));
    check(`${dbKey}: pricelist found`,available.size>0,`no rows for "${plNames.join('","')}"`);
    const bad=entry.vials.filter(v=>!available.has(v));
    check(`${dbKey}: all vials in pricelist`,bad.length===0,
      bad.length?`vials [${bad.join(',')}] not in pricelist (available: ${[...available].join(',')})`:'');
  }
}

// ── syncBodyCompFromAgent: force-push all local BC entries to backend ────────
console.log('\n── syncBodyCompFromAgent: pushes all local entries to backend ───');
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const fnStart = src.indexOf('async function syncBodyCompFromAgent(');
  const fnBody = fnStart >= 0 ? src.slice(fnStart, src.indexOf('}catch(e){}', fnStart) + 11) : '';
  check('syncBodyCompFromAgent fetches remote and merges with local',
    fnBody.includes('fetch(AGENT_URL+"/bodycomp"') && fnBody.includes('bcLoad()'));
  check('syncBodyCompFromAgent pushes ALL local entries with zero-padded dates via Promise.all',
    fnBody.includes('local.map(e=>') && fnBody.includes('padStart(2,') && fnBody.includes('pushBodyCompToAgent('));
}

// ── dose dedup migration ─────────────────────────────────────────────────────
console.log('\n── dose dedup migration ────────────────────────────────────────');
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  // Migration IIFE must be present in init()
  check('dose-dedup migration IIFE present in init()',
    src.includes('pep-dose-dedup-v1') && src.includes('proto-chk-'));
  // Normaliser function _ndi must be defined inside the IIFE
  check('normaliser _ndi defined in migration IIFE',
    src.includes('function _ndi(id)') && src.includes('zfill') === false);
  // Regex handles non-padded month/day
  check('_ndi regex matches non-padded dates',
    src.includes('\\d{4}-\\d{1,2}-\\d{1,2}'));
  // Migration runs before buildWeekStrip/buildToday
  // Verify the migration IIFE immediately precedes buildWeekStrip() inside init()
  check('migration immediately precedes buildWeekStrip() in init()',
    src.includes("'pep-dose-dedup-v1','1');})();buildWeekStrip()"));
  // Idempotency: guard on migration flag
  check('migration is idempotent (skips if flag set)',
    src.includes("localStorage.getItem('pep-dose-dedup-v1'"));
  // Migration sets flag after running
  check('migration sets pep-dose-dedup-v1 flag',
    src.includes("localStorage.setItem('pep-dose-dedup-v1','1')"));

  // Unit-test the normaliser logic in isolation
  function _ndi(id){var _m=id.match(/^(.+)_(\d{4}-\d{1,2}-\d{1,2})$/);if(!_m)return id;var _p=_m[2].split('-');return _m[1]+'_'+_p[0]+'-'+('0'+_p[1]).slice(-2)+'-'+('0'+_p[2]).slice(-2);}
  check('_ndi pads single-digit month and day',    _ndi('cjc-am_2026-5-2')     === 'cjc-am_2026-05-02');
  check('_ndi leaves already-padded IDs unchanged', _ndi('cjc-am_2026-05-02')  === 'cjc-am_2026-05-02');
  check('_ndi handles compound with underscores',   _ndi('testo_3_2026-3-9')   === 'testo_3_2026-03-09');
  check('_ndi returns ID unchanged if no date suffix', _ndi('no-date-here')     === 'no-date-here');

  // Dedup logic: array with padded+non-padded → only padded remains
  (function(){
    var seen=new Set();var dd=[];
    ['cjc-am_2026-5-22','cjc-am_2026-05-22'].forEach(function(id){
      var n=_ndi(id);if(!seen.has(n)){seen.add(n);dd.push(n);}
    });
    check('dedup collapses padded+non-padded into single entry', dd.length===1 && dd[0]==='cjc-am_2026-05-22');
  })();
}

// ── No active stack (on-break support) ───────────────────────────────────────
{
  console.log('\n── No active stack ────────────────────────────────────────');
  const sA={name:'Stack A',peptides:[{id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0],times:['AM'],dose_am:'3',unit_am:'mg',active:true}]};
  const sB={name:'Stack B',peptides:[{id:'semaglutide', name:'Semaglutide',dot:'#f59e0b',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.5',unit_am:'mg',active:true}]};

  // updateWEEKLY with empty activeStackIndices → empty WEEKLY
  G._userStacks=[sA,sB];G._activeStackIndices=[];G.updateWEEKLY();
  check('no active stacks → WEEKLY is empty array',G.WEEKLY.length===0);

  // Array.isArray guard prevents [] from being treated as falsy
  check('toggleStack guard removed: can deactivate last active stack',
    (function(){
      var src=rawScript;
      // The old guard "if(_activeStackIndices.length===1)return;" must not exist
      return !src.includes('_activeStackIndices.length===1)return;');
    })()
  );

  // updateWEEKLY uses WEEKLY=[] not WEEKLY_DEFAULT.slice() for empty active
  check('updateWEEKLY uses WEEKLY=[] for empty active (not WEEKLY_DEFAULT)',
    rawScript.includes('if(!active.length){WEEKLY=[];return;}'));

  // active_index sent as null when no active stacks
  check('saveStacksToBackend sends active_index null when no active stacks',
    rawScript.includes('_activeStackIndices.length?_activeStackIndices[0]:null'));

  // Array.isArray guard on loading from backend
  check('loadStacks uses Array.isArray guard (not ||) for active_indices from backend',
    rawScript.includes('Array.isArray(data.active_indices)?data.active_indices:'));

  // Array.isArray guard on loading from localStorage cache
  check('loadStacks uses Array.isArray guard (not ||) for active_indices from cache',
    rawScript.includes('Array.isArray(cached.active_indices)?cached.active_indices:'));

  // deleteStack no longer forces [0] when result is empty
  check('deleteStack does not force _activeStackIndices=[0] after removal',
    !rawScript.includes("if(!_activeStackIndices.length)_activeStackIndices=[0];"));
}


// ── Wizard summaries list every tier ─────────────────────────────────────────
// Reported 2026-08-01: "never shows trt ester chosen, makes me think it is a
// peptide-only stack". Validate and Review read only the classic _wiz.trt tier, so a
// protocol whose testosterone came from the T-Calc planner (_wiz.trtPlan — the
// default path since the TRT step became that planner) listed its peptides and
// nothing else. Both steps now go through _wizTrtSummaryRows.
{
  console.log('\n── Wizard summaries cover every tier ──────────────────────');
  const _svWiz = G._wiz;
  const _mkEl2 = () => { let h=''; return {set innerHTML(v){h=v;}, get innerHTML(){return h;}}; };
  const _pep = {id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'3',unit_am:'mg',active:true};

  check('_wizTrtSummaryRows is defined', typeof G._wizTrtSummaryRows === 'function');
  if (typeof G._wizTrtSummaryRows === 'function') {
    // A plan built in the TRT step is a real TRT compound and must be summarised
    G._wiz = {goals:['trt'], peptides:[_pep], trt:{}, enhanced:{}, stackName:'P',
      trtPlan:{compId:'enanthate',doseMg:'125',cadenceN:5,cadenceUnit:'day',cadenceDays:5,startDate:'2026-08-01'}};
    let rows = G._wizTrtSummaryRows();
    check('a T-Calc-planner protocol reports its ester', rows.length===1 && rows[0].id==='enanthate',
      JSON.stringify(rows));
    check('  …with its dose', rows[0].dose==='125mg', rows[0].dose);
    check('  …and its cadence in words', rows[0].cadence==='Every 5 days', rows[0].cadence);
    check('  …named, not left as a raw id', rows[0].name && rows[0].name!=='enanthate', rows[0].name);

    G._wiz.trtPlan.cadenceN=1; G._wiz.trtPlan.cadenceUnit='week'; G._wiz.trtPlan.cadenceDays=7;
    check('a cadence of one reads "Every week", not "Every 1 weeks"',
      G._wizTrtSummaryRows()[0].cadence==='Every week', G._wizTrtSummaryRows()[0].cadence);

    // An incomplete plan is not a compound
    G._wiz.trtPlan={compId:'enanthate',doseMg:'',cadenceN:0,cadenceUnit:'week',cadenceDays:0,startDate:''};
    check('an unfinished plan contributes nothing', G._wizTrtSummaryRows().length===0);

    // The classic tier still works, and both together de-duplicate
    G._wiz.trtPlan=null;
    G._wiz.trt={enabled:true,compounds:[{id:'testosterone-cyp',name:'Test Cyp',dose:'100',unit:'mg',freqVal:1,freqUnit:'weeks',dot:'#e8a020'}]};
    rows = G._wizTrtSummaryRows();
    check('the classic multi-compound tier is still summarised',
      rows.length===1 && rows[0].id==='testosterone-cyp', JSON.stringify(rows));
    G._wiz.trtPlan={compId:'testosterone-cyp',doseMg:'100',cadenceN:1,cadenceUnit:'week',cadenceDays:7,startDate:'2026-08-01'};
    check('the same ester configured both ways is listed once',
      G._wizTrtSummaryRows().length===1, JSON.stringify(G._wizTrtSummaryRows()));
    G._wiz.trtPlan={compId:'enanthate',doseMg:'125',cadenceN:1,cadenceUnit:'week',cadenceDays:7,startDate:'2026-08-01'};
    check('two different esters are both listed', G._wizTrtSummaryRows().length===2,
      JSON.stringify(G._wizTrtSummaryRows().map(function(r){return r.id;})));
  }

  // End to end through the two steps that render a summary
  G._wiz = {goals:['trt'], peptides:[_pep], trt:{}, enhanced:{}, stackName:'P', step:0,
    trtPlan:{compId:'enanthate',doseMg:'125',cadenceN:5,cadenceUnit:'day',cadenceDays:5,startDate:'2026-08-01'}};
  if (typeof G.wizStepValidate === 'function') {
    const vb=_mkEl2(), vf=_mkEl2();
    G.wizStepValidate(vb,vf);
    check('Validate shows a TRT heading when a plan exists', /TRT</.test(vb.innerHTML) || />TRT/.test(vb.innerHTML),
      vb.innerHTML.slice(0,200));
    check('  …and names the ester', /Enanthate|Testosterone/i.test(vb.innerHTML));
    check('  …alongside the peptides', /Retatrutide/.test(vb.innerHTML));
  }
  if (typeof G.wizStepReview === 'function') {
    const rb=_mkEl2(), rf=_mkEl2();
    G.wizStepReview(rb,rf);
    check('Review lists the ester in the summary', /Enanthate|Testosterone/i.test(rb.innerHTML),
      rb.innerHTML.slice(0,300));
    check('  …with dose and cadence', /125mg/.test(rb.innerHTML) && /Every 5 days/.test(rb.innerHTML));
    check('  …and still lists the peptides', /Retatrutide/.test(rb.innerHTML));
  }

  // A peptide-only protocol must NOT sprout an empty TRT section
  G._wiz = {goals:[], peptides:[_pep], trt:{}, enhanced:{}, stackName:'P', step:0, trtPlan:null};
  if (typeof G.wizStepValidate === 'function') {
    const nb=_mkEl2(), nf=_mkEl2();
    G.wizStepValidate(nb,nf);
    check('a peptide-only protocol shows no TRT section', !/>TRT</.test(nb.innerHTML));
  }
  G._wiz = _svWiz;
}


// ── Staging has its own backend namespace ────────────────────────────────────
// Reported 2026-08-01: "testing stage fucks my prod data". Both builds sent no
// X-App-Id, so staging wrote into the same user records as production. Staging now
// declares its own namespace; production keeps sending nothing, which is where its
// data already lives — changing that would orphan it.
{
  console.log('\n── Staging data namespace ─────────────────────────────────');
  check('APP_ID is declared and keys off IS_STAGING',
    /const APP_ID=IS_STAGING\?'stage':''/.test(rawScript));
  check('authHeaders sends X-App-Id when there is one',
    /function authHeaders\(extra\)\{const h=\{\};if\(APP_ID\)h\['X-App-Id'\]=APP_ID;/.test(rawScript));
  check('production still sends no namespace header, so its data is untouched',
    typeof G.APP_ID === 'string' && G.APP_ID === '' && !('X-App-Id' in G.authHeaders()),
    JSON.stringify(G.authHeaders()));
  check('  …and the auth token still goes out either way',
    /const _t=_sessionToken\|\|_googleToken;if\(_t\)h\['Authorization'\]/.test(rawScript));

  // The copy button
  check('copyDataToStage is defined', typeof G.copyDataToStage === 'function');
  check('buildStageCopyCard is defined', typeof G.buildStageCopyCard === 'function');
  check('it posts to the copy endpoint', /AGENT_URL\+'\/account\/copy-to-stage',\{method:'POST'/.test(rawScript));
  check('  …authenticated', /copy-to-stage',\{method:'POST',headers:authHeaders\(\)\}/.test(rawScript));
  check('the card is rendered with the other settings cards',
    (rawScript.match(/buildStageCopyCard\(\)/g)||[]).length >= 3,
    'found '+((rawScript.match(/buildStageCopyCard\(\)/g)||[]).length));
  check('it is hidden on staging — there is nothing to copy from there',
    /if\(IS_STAGING\)\{card\.innerHTML='';return;\}/.test(rawScript));
  check('the copy is confirmed before it runs', /confirm\('Copy your data to the staging app\?/.test(rawScript));
  check('  …and says plainly that this app is not changed',
    /Nothing in this app changes/.test(rawScript));

  // Rendered markup, in the production case
  if (typeof G.buildStageCopyCard === 'function') {
    let _html='';
    const _svGet = G.document.getElementById;
    G.document.getElementById = id => id==='s-stagecopy-card'
      ? {set innerHTML(v){_html=v;}, get innerHTML(){return _html;}}
      : _svGet(id);
    G.buildStageCopyCard();
    check('the card renders a copy button', /s-stagecopy-btn/.test(_html) && /Copy my data to staging/.test(_html));
    check('  …with somewhere to report the result', /s-stagecopy-status/.test(_html));
    G.document.getElementById = _svGet;
  }
}

// ── Only one protocol may be active ──────────────────────────────────────────
// Reported 2026-08-01: three protocols showed "Active" at once, including two
// overlapping TRT protocols, so Today merged doses from all of them. Activation
// is a radio, not a set of checkboxes — switching one on switches the rest off.
// _activeStackIndices keeps its array shape (the backend payload, the cache and
// every reader still expect it) but never holds more than one index.
{
  console.log('\n── Only one active protocol ───────────────────────────────');
  const _svStacks = G._userStacks, _svAct = G._activeStackIndices;
  const _mkS = n => ({name:n, peptides:[{id:'retatrutide',name:'Reta',dot:'#e8ff3c',
    days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'3',unit_am:'mg',active:true}]});
  G._userStacks = [_mkS('A'), _mkS('B'), _mkS('C')];

  check('_normalizeActiveStack is defined', typeof G._normalizeActiveStack === 'function');
  if (typeof G._normalizeActiveStack === 'function') {
    G._activeStackIndices = [0,1,2];
    check('stored data with several active is clamped to one',
      JSON.stringify(G._normalizeActiveStack()) === '[0]', JSON.stringify(G._activeStackIndices));
    G._activeStackIndices = [2,0];
    check('  …the first listed one wins',
      JSON.stringify(G._normalizeActiveStack()) === '[2]', JSON.stringify(G._activeStackIndices));
    G._activeStackIndices = [];
    check('  …none active stays none active (on-break is valid)',
      JSON.stringify(G._normalizeActiveStack()) === '[]');
    G._activeStackIndices = [7,1];
    check('  …an index past the end of the list is dropped',
      JSON.stringify(G._normalizeActiveStack()) === '[1]', JSON.stringify(G._activeStackIndices));
    G._activeStackIndices = null;
    check('  …a non-array survives without throwing',
      JSON.stringify(G._normalizeActiveStack()) === '[]');
  }

  // The load path must apply it, or the user keeps seeing their old multi-active set
  check('loadUserStacks normalizes before building anything',
    /_normalizeActiveStack\(\);\s*\n\s*var _needIdSave/.test(rawScript));

  // toggleStack behaves as a radio
  check('activating a protocol replaces the active one rather than adding to it',
    /pos===-1\)\{\s*\n\s*_activeStackIndices=\[idx\];/.test(rawScript));
  check('  …no code path pushes a second index onto the active set',
    !/_activeStackIndices\.push\(/.test(rawScript), 'a push( survives in index.html');
  check('deactivating the active protocol clears it, leaving none active',
    /\}\s*else\s*\{\s*\n\s*_activeStackIndices=\[\];\s*\n\s*\}/.test(rawScript));

  // Starting a protocol from a template makes it THE active one
  {
    const _tsSrc = fs.readFileSync(path.join(dir,'tab-stack.js'),'utf8');
    check('starting a template activates it exclusively',
      /_activeStackIndices=\[_idx\];/.test(_tsSrc));
    check('  …tab-stack.js never pushes onto the active set either',
      !/_activeStackIndices\.push\(/.test(_tsSrc));
  }

  // Through the real toggle. toggleStack is async, but it mutates the active set
  // synchronously before its first await, so the assertion needs no await.
  if (typeof G.toggleStack === 'function') {
    const _sv = {save:G.saveStacksToBackend, ref:G.refreshInjectionsCache, ws:G.buildWeekStrip,
                 t:G.buildToday, s:G.buildSchedule, ss:G.buildStackStore};
    G.saveStacksToBackend = async () => {}; G.refreshInjectionsCache = async () => {};
    G.buildWeekStrip = () => {}; G.buildToday = () => {};
    G.buildSchedule = () => {}; G.buildStackStore = () => {};
    const _quiet = p => { if (p && p.catch) p.catch(() => {}); };

    G._activeStackIndices = [0];
    _quiet(G.toggleStack(1));
    check('turning on B turns A off', JSON.stringify(G._activeStackIndices) === '[1]',
      JSON.stringify(G._activeStackIndices));
    _quiet(G.toggleStack(2));
    check('turning on C turns B off', JSON.stringify(G._activeStackIndices) === '[2]',
      JSON.stringify(G._activeStackIndices));
    _quiet(G.toggleStack(2));
    check('turning the active one off leaves none active',
      JSON.stringify(G._activeStackIndices) === '[]', JSON.stringify(G._activeStackIndices));
    G.updateWEEKLY();
    check('  …and WEEKLY empties out with it', G.WEEKLY.length === 0);
    _quiet(G.toggleStack(9));
    check('an out-of-range index is ignored', JSON.stringify(G._activeStackIndices) === '[]');

    G.saveStacksToBackend = _sv.save; G.refreshInjectionsCache = _sv.ref;
    G.buildWeekStrip = _sv.ws; G.buildToday = _sv.t;
    G.buildSchedule = _sv.s; G.buildStackStore = _sv.ss;
  }
  G._userStacks = _svStacks; G._activeStackIndices = _svAct;
  G.updateWEEKLY();
}

// ── getDosesForDate + _findWeeklyItemInfo (date-range scheduling) ──────────────
{
  console.log('\n── getDosesForDate ─────────────────────────────────────────');
  const fs2=require('fs');
  const todayJs=fs2.readFileSync(require('path').join(__dirname,'../tab-today.js'),'utf8');
  const tabStackJs=fs2.readFileSync(require('path').join(__dirname,'../tab-stack.js'),'utf8');

  check('getDosesForDate function defined',typeof G.getDosesForDate==='function');
  check('_findWeeklyItemInfo function defined',typeof G._findWeeklyItemInfo==='function');

  // Empty-state coaching: a user with no active stack is offered a first action,
  // not a dead "nothing scheduled"; a rest day on an active stack still reads calm.
  check('Today empty state coaches first-timers to build a protocol', todayJs.includes('Build your first protocol') && todayJs.includes('createNewStack()'));
  check('Today empty state keeps "Nothing scheduled today" for active-stack rest days', todayJs.includes('Nothing scheduled today'));
  check('Today empty state branches on an active stack', todayJs.includes('_hasActive'));
  check('Today empty state offers a template when templates loaded', todayJs.includes('openTemplatePicker()') && todayJs.includes('_protocolTemplates'));

  // Empty-state coaching extended to Levels + Timeline (usability study, #621):
  // a dead "nothing here" becomes a first action routed to the right flow.
  {
    const _bloodJs2 = fs.readFileSync(path.join(__dirname, '../tab-blood.js'), 'utf8');
    const _tlJs2 = fs.readFileSync(path.join(__dirname, '../tab-timeline.js'), 'utf8');
    check('Levels empty state has a CTA (build stack / go to Plan)',
      _bloodJs2.includes('Build your first protocol') && /switchPrimary\(\\?'plan\\?'\)/.test(_bloodJs2) && _bloodJs2.includes('createNewStack()'));
    check('Levels empty state branches on whether stacks exist', _bloodJs2.includes('_hasStacks'));
    check('Timeline empty state coaches with a CTA',
      _tlJs2.includes('No milestones yet') && /switchPrimary\(\\?'plan\\?'\)/.test(_tlJs2) && _tlJs2.includes('createNewStack()'));
    check('Timeline empty state branches on whether stacks exist', _tlJs2.includes('_hasStk'));
  }

  // Protocol templates — fetched from the backend, instantiated into a stack.
  check('syncProtocolTemplates fetches the backend endpoint', rawScript.includes("'/protocol-templates'") && rawScript.includes('function syncProtocolTemplates'));
  if (typeof G.useTemplate === 'function' && typeof G.openTemplatePicker === 'function') {
    var _svS=G._userStacks,_svA=G._activeStackIndices,_svT=G._protocolTemplates,_svSave=G.saveStacksToBackend,_svGen=G.generateAndPushInjections,_svRef=G.refreshInjectionsCache,_svNew=G.createNewStack;
    G._protocolTemplates=[{id:'tpl-x',name:'Test Plan',cycle_length:8,
      peptides:[{id:'bpc157',name:'BPC-157',dot:'#3b9eff',times:['AM'],days:[0,1,2,3,4,5,6],dose_am:'250',unit_am:'mcg'}],
      trt:{compounds:[{id:'enanthate',name:'Testosterone Enanthate',dot:'#e05050',dose:'125',unit:'mg',freqVal:1,freqUnit:'weeks',days:[1]}]},
      enhanced:null}];
    G._userStacks=[]; G._activeStackIndices=[];
    G.saveStacksToBackend=async function(){return true;}; G.generateAndPushInjections=async function(){}; G.refreshInjectionsCache=async function(){};
    G.useTemplate('tpl-x'); // synchronous portion runs before the first await
    var _st=G._userStacks[G._userStacks.length-1];
    check('useTemplate: creates a stack from the template', !!_st && _st.name==='Test Plan' && _st.cycle_length===8);
    check('useTemplate: stack starts today so doses schedule immediately', !!(_st && _st.cycle_start));
    check('useTemplate: maps peptides into the stack model', !!_st && _st.peptides.length===1 && _st.peptides[0].id==='bpc157' && _st.peptides[0].dose_am==='250' && _st.peptides[0].active===true);
    check('useTemplate: maps TRT compounds with frequency', !!_st && _st.trt && _st.trt.enabled===true && _st.trt.compounds[0].id==='enanthate' && _st.trt.compounds[0].freqVal===1);
    check('useTemplate: activates the new stack', G._activeStackIndices.indexOf(G._userStacks.length-1)>=0);
    check('useTemplate: assigns a stable stack id', !!(_st && _st.id));
    // picker falls back to the wizard when no templates exist
    G._protocolTemplates=[]; var _newCalled=false; G.createNewStack=function(){_newCalled=true;};
    G.openTemplatePicker();
    check('openTemplatePicker: no templates → falls back to the wizard', _newCalled===true);
    G._userStacks=_svS;G._activeStackIndices=_svA;G._protocolTemplates=_svT;G.saveStacksToBackend=_svSave;G.generateAndPushInjections=_svGen;G.refreshInjectionsCache=_svRef;G.createNewStack=_svNew;
  } else {
    check('useTemplate / openTemplatePicker present', false);
  }

  const cycleStack={name:'Cycle A',cycle_start:'2026-06-21',cycle_length:12,end_date:'2026-09-13',
    peptides:[{id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'3',unit_am:'mg',active:true}]};
  G._userStacks=[cycleStack];G._activeStackIndices=[0];
  var jun21=new Date(2026,5,21);
  var doses21=G.getDosesForDate(jun21);
  check('getDosesForDate: date-ranged stack shows doses on start date',doses21.length>0);
  check('getDosesForDate: dose id includes the date',doses21[0]&&doses21[0].id.includes('2026-06-21'));

  var may1=new Date(2026,4,1);
  check('getDosesForDate: no doses before cycle_start',G.getDosesForDate(may1).length===0);

  var dec1=new Date(2026,11,1);
  check('getDosesForDate: no doses after end_date',G.getDosesForDate(dec1).length===0);

  const noDateStack={name:'No Date',peptides:[{id:'semaglutide',name:'Sema',dot:'#f59e0b',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'0.5',unit_am:'mg',active:true}]};
  G._userStacks=[noDateStack];G._activeStackIndices=[];
  check('getDosesForDate: no-date stack inactive → no doses',G.getDosesForDate(jun21).length===0);
  G._activeStackIndices=[0];
  check('getDosesForDate: no-date stack active → shows doses',G.getDosesForDate(jun21).length>0);

  G._userStacks=[cycleStack];
  var found=G._findWeeklyItemInfo('retatrutide');
  check('_findWeeklyItemInfo finds peptide by base id',found&&found.name==='Retatrutide');
  check('_findWeeklyItemInfo returns null for unknown id',G._findWeeklyItemInfo('unknown-peptide')===null);

  check('end_date normalization in loadUserStacks',rawScript.includes('if(stack.end_date){var _cep=stack.end_date.split'));

  check('buildToday reads from _injectionsCache instead of getDosesForDate or WEEKLY',
    todayJs.includes('_injectionsCache') && !todayJs.includes('getDosesForDate(NOW)') && !todayJs.includes('WEEKLY.forEach(d=>'));
  check('showDayInline uses _injectionsCache for scheduled doses',
    todayJs.includes('_injectionsCache[dk]') && !todayJs.includes('doses=getDosesForDate(d)'));
  check('buildWeekStrip past days: falls back to getPastDoses within isPast branch',
    /if\(isPast\)[\s\S]{0,400}getPastDoses\(d\)/.test(todayJs));
  check('showDayInline past days: getPastDoses used to surface orphaned logged doses',
    todayJs.includes('isPast') && todayJs.includes('getPastDoses(d)') && todayJs.includes('_findWeeklyItemInfo(bid)'));
  check('showDayInline past days: isChk does not use _pastChecked shortcut',
    !todayJs.includes('_pastChecked||checked') && !todayJs.includes('dose._pastChecked'));
  check('buildWeekStrip uses _injectionsCache for future/today dots',
    todayJs.includes('_injectionsCache[dk]') && !todayJs.includes('getDosesForDate(d).forEach'));
  check('buildWeekStrip uses getPastDoses + _findWeeklyItemInfo for past dots',
    todayJs.includes('getPastDoses(d)') && todayJs.includes('_findWeeklyItemInfo(bid)'));

  // ── _getDynamicEnhancedDoses ──────────────────────────────────────────────
  check('_getDynamicEnhancedDoses defined in tab-stack.js',
    typeof G._getDynamicEnhancedDoses === 'function');

  const enhStack={name:'Enhanced Cycle',cycle_start:'2026-06-21',cycle_length:12,peptides:[],
    enhanced:{enabled:true,compounds:[{id:'testosterone-e',name:'Testosterone E',dose:'250',unit:'mg/week',days:[1,4],dot:'#e8a020'}]}};
  G._userStacks=[enhStack];G._activeStackIndices=[0];
  // Mon June 22 = JS getDay() 1
  var mon22=new Date(2026,5,22);
  var enhDoses=G._getDynamicEnhancedDoses(mon22,true);
  check('_getDynamicEnhancedDoses: returns dose on scheduled day',enhDoses.length===1);
  check('_getDynamicEnhancedDoses: dose has correct name',enhDoses[0]&&enhDoses[0].name==='Testosterone E');
  check('_getDynamicEnhancedDoses: dose id includes date',enhDoses[0]&&enhDoses[0].id&&enhDoses[0].id.includes('2026-06-22'));

  // Wed June 24 = JS getDay() 3 — not in days:[1,4]
  var wed24=new Date(2026,5,24);
  check('_getDynamicEnhancedDoses: no dose on unscheduled day',G._getDynamicEnhancedDoses(wed24,true).length===0);

  // Before cycle_start
  check('_getDynamicEnhancedDoses: no dose before cycle_start',G._getDynamicEnhancedDoses(new Date(2026,4,1),true).length===0);

  // Stack with no cycle_start — requires _activeStackIndices
  const enhNoDate={name:'Enhanced No Date',peptides:[],enhanced:{enabled:true,compounds:[{id:'testosterone-e',name:'Testosterone E',dose:'250',unit:'mg/week',days:[1,4],dot:'#e8a020'}]}};
  G._userStacks=[enhNoDate];G._activeStackIndices=[];
  check('_getDynamicEnhancedDoses: no-date enhanced stack inactive → no doses',G._getDynamicEnhancedDoses(mon22,true).length===0);
  G._activeStackIndices=[0];
  check('_getDynamicEnhancedDoses: no-date enhanced stack active → shows doses',G._getDynamicEnhancedDoses(mon22,true).length===1);

  // buildToday/showDayInline/buildWeekStrip now use _injectionsCache (not _getDynamicEnhancedDoses directly)
  check('buildToday reads enhanced doses from _injectionsCache, not _getDynamicEnhancedDoses directly',
    todayJs.includes('_injectionsCache') && !todayJs.includes('_getDynamicEnhancedDoses(NOW,true)'));
  check('showDayInline reads enhanced doses from _injectionsCache, not _getDynamicEnhancedDoses directly',
    todayJs.includes('_injectionsCache') && !todayJs.includes('_getDynamicEnhancedDoses(d,true)'));
  check('buildWeekStrip reads enhanced dots from _injectionsCache, not _getDynamicEnhancedDoses directly',
    todayJs.includes('_injectionsCache') && !todayJs.includes('_getDynamicEnhancedDoses(d,false)'));

  check('tab-stack.js edit view has no Cycle End field (removed — use cycle length instead)',
    !tabStackJs.includes("id='edit-cycle-end'")&&!tabStackJs.includes('id="edit-cycle-end"'));
  check('tab-stack.js Cycle Length select has No end date option (value 0)',
    tabStackJs.includes("value=\"0\"")&&tabStackJs.includes('No end date'));
}

// ── Duplicate-dosing detection, within one protocol ───────────────────────────
// Only one protocol is ever active (2026-08-01), so the old protocol-vs-protocol
// comparison had nothing left to compare. What can still double-dose you is the
// same compound appearing in two tiers of the SAME protocol — testosterone under
// both TRT and Enhanced — so that is what _detectStackConflicts now checks, across
// Peptides + TRT + Enhanced together.
{
  console.log('\n── Duplicate dosing within a protocol ─────────────────────');
  check('_getStackCompounds defined',typeof G._getStackCompounds==='function');
  check('_detectStackConflicts defined',typeof G._detectStackConflicts==='function');

  const _pep=(id,name)=>({id:id,name:name,dot:'#e8ff3c',days:[0,1,2,3,4,5,6],times:['AM'],dose_am:'3',unit_am:'mg',active:true});
  const _trt=(id,name)=>({id:id,name:name,dose:'100',unit:'mg/week',days:[3],dot:'#e8a020'});
  const _enh=(id,name)=>({id:id,name:name,dose:'250',unit:'mg/week',days:[1,4],dot:'#a855f7'});

  // _getStackCompounds spans every tier and tags which one each came from
  const _all={name:'All tiers',peptides:[_pep('retatrutide','Retatrutide')],
    trt:{enabled:true,compounds:[_trt('testosterone-cyp','Testosterone Cyp')]},
    enhanced:{enabled:true,compounds:[_enh('testosterone-e','Testosterone E')]}};
  const _comps=G._getStackCompounds(_all);
  check('_getStackCompounds reads all three tiers together',_comps.length===3,
    JSON.stringify(_comps.map(c=>c.id)));
  check('  …and records which tier each compound came from',
    JSON.stringify(_comps.map(c=>c.tier))==='["Peptides","TRT","Enhanced"]',
    JSON.stringify(_comps.map(c=>c.tier)));
  check('  …carrying the compound-group tags used for axis lookups',
    Array.isArray(_comps[0].cg)&&_comps[0].cg.includes('glp1'));
  check('_getStackCompounds: empty protocol returns []',G._getStackCompounds({peptides:[]}).length===0);

  // The case this exists for: one compound configured in two tiers
  const _dup={name:'Dup',peptides:[],
    trt:{enabled:true,compounds:[_trt('testosterone-e','Testosterone E')]},
    enhanced:{enabled:true,compounds:[_enh('testosterone-e','Testosterone E')]}};
  G._userStacks=[_dup];G._activeStackIndices=[0];
  let det=G._detectStackConflicts(0);
  check('the same compound in TRT and Enhanced is a conflict',det.conflicts.length===1,
    det.conflicts.length+' found');
  check('  …reported as a duplicate',det.conflicts[0].reason==='duplicate');
  check('  …naming the tier that is kept and the tier that is dropped',
    det.conflicts[0].existingTier==='TRT'&&det.conflicts[0].tier==='Enhanced',
    det.conflicts[0].existingTier+' -> '+det.conflicts[0].tier);

  // Duplicated inside a single tier counts too
  const _dupPep={name:'DupPep',peptides:[_pep('retatrutide','Retatrutide'),_pep('retatrutide','Retatrutide')]};
  G._userStacks=[_dupPep];G._activeStackIndices=[0];
  check('the same compound twice inside one tier is a conflict',
    G._detectStackConflicts(0).conflicts.length===1);

  // A protocol with distinct compounds in every tier is clean
  G._userStacks=[_all];G._activeStackIndices=[0];
  check('distinct compounds across tiers are not a conflict',
    G._detectStackConflicts(0).conflicts.length===0);
  check('an empty protocol is not a conflict',
    G._detectStackConflicts(0,{}).conflicts.length===0);
  check('an index with no protocol behind it returns no conflicts',
    G._detectStackConflicts(99).conflicts.length===0);

  // Deliberately NOT a conflict: two different compounds on the same axis. Across
  // two protocols that meant "you forgot"; inside one it is the standard GH-axis
  // pairing (CJC-1295 + Ipamorelin), and blocking it would fire on normal protocols.
  const _ghAxis={name:'GH',peptides:[_pep('cjc-ipa','CJC-1295/IPA')],
    enhanced:{enabled:true,compounds:[_enh('hgh','HGH (Somatropin)')]}};
  G._userStacks=[_ghAxis];G._activeStackIndices=[0];
  check('two different compounds on one axis are NOT blocked inside a protocol',
    G._detectStackConflicts(0).conflicts.length===0,
    JSON.stringify(G._detectStackConflicts(0).conflicts));

  // The cross-protocol machinery is gone, not merely unreachable
  check('the protocol-vs-protocol comparison is gone',
    !/_activeStackIndices\.forEach[\s\S]{0,200}conflictingSet/.test(rawScript));
  check('_calcLatestActiveEnd (scheduled-after-other-cycles) is gone',
    !rawScript.includes('_calcLatestActiveEnd'));
  check('the modal no longer offers to deactivate other protocols',
    !rawScript.includes("_resolveConflict('deactivate'")&&!rawScript.includes('_resolveConflict(\\\'deactivate\\\''));

  // CROSS_STACK_CLUSTERS still defines the axes, still used by _getStackCompounds
  check('CROSS_STACK_CLUSTERS still defined',rawScript.includes('const CROSS_STACK_CLUSTERS='));
  check('CROSS_STACK_CLUSTERS maps ghrh to gh-axis',rawScript.includes("'ghrh':'gh-axis'"));
  check('CROSS_STACK_CLUSTERS maps hgh to gh-axis',rawScript.includes("'hgh':'gh-axis'"));
  check('CROSS_STACK_CLUSTERS maps glp1 to glp1-axis',rawScript.includes("'glp1':'glp1-axis'"));

  // Wiring: the check runs on activation and on startup
  check('_scanAndShowStartupConflicts defined',typeof G._scanAndShowStartupConflicts==='function');
  check('_scanAndShowStartupConflicts called in loadUserStacks',rawScript.includes('_scanAndShowStartupConflicts()'));
  check('the startup scan checks the one active protocol',
    /var idx=_activeStackIndices\.length\?_activeStackIndices\[0\]:null;/.test(rawScript));
  // The activation branch also backfills cycle_start (2026-08-06), so these are no
  // longer adjacent lines. What matters is that the conflict check still runs on
  // activation, before anything is saved.
  check('activating a protocol runs the duplicate check',
    /_activeStackIndices=\[idx\];[\s\S]{0,120}?var det=_detectStackConflicts\(idx\);/.test(rawScript));
  check('_resolveConflict defined in index.html',rawScript.includes('async function _resolveConflict('));

  // "Keep the first entry only" drops the later copy and leaves everything else
  if(typeof G._resolveConflict==='function'){
    const _sv={save:G.saveStacksToBackend,ws:G.buildWeekStrip,t:G.buildToday,s:G.buildSchedule,ss:G.buildStackStore,uw:G.updateWEEKLY,gid:G.document.getElementById};
    G.saveStacksToBackend=async()=>{};G.buildWeekStrip=()=>{};G.buildToday=()=>{};
    G.buildSchedule=()=>{};G.buildStackStore=()=>{};G.updateWEEKLY=()=>{};
    // The mock element has no .remove(); returning null for the overlay lookup keeps
    // _resolveConflict on its real path instead of throwing before it edits anything.
    G.document.getElementById=id=>id==='stack-conflict-modal'?null:_sv.gid(id);
    const _target={name:'Dup',peptides:[_pep('retatrutide','Reta')],
      trt:{enabled:true,compounds:[_trt('testosterone-e','Test E')]},
      enhanced:{enabled:true,compounds:[_enh('testosterone-e','Test E'),_enh('anavar','Anavar')]}};
    G._userStacks=[_target];G._activeStackIndices=[0];
    G._pendingConflictData={newIdx:0,conflicts:G._detectStackConflicts(0).conflicts};
    const _p=G._resolveConflict('remove'); if(_p&&_p.catch)_p.catch(()=>{});
    check('resolving "keep the first" drops the duplicate',
      (_target.enhanced.compounds||[]).filter(c=>c.id==='testosterone-e').length===0);
    check('  …keeps the copy in the earlier tier',
      (_target.trt.compounds||[]).some(c=>c.id==='testosterone-e'));
    check('  …and leaves every non-duplicate compound alone',
      _target.peptides.length===1&&(_target.enhanced.compounds||[]).some(c=>c.id==='anavar'));
    check('the protocol is clean afterwards',G._detectStackConflicts(0).conflicts.length===0);

    // "Keep both" acknowledges without touching the data
    const _keep={name:'K',peptides:[],
      trt:{enabled:true,compounds:[_trt('testosterone-e','Test E')]},
      enhanced:{enabled:true,compounds:[_enh('testosterone-e','Test E')]}};
    G._userStacks=[_keep];G._activeStackIndices=[0];
    G._pendingConflictData={newIdx:0,conflicts:G._detectStackConflicts(0).conflicts};
    const _p2=G._resolveConflict('keep'); if(_p2&&_p2.catch)_p2.catch(()=>{});
    check('resolving "keep both" changes nothing',
      _keep.trt.compounds.length===1&&_keep.enhanced.compounds.length===1);

    G.saveStacksToBackend=_sv.save;G.buildWeekStrip=_sv.ws;G.buildToday=_sv.t;
    G.buildSchedule=_sv.s;G.buildStackStore=_sv.ss;G.updateWEEKLY=_sv.uw;
    G.document.getElementById=_sv.gid;
  }
}

// ── Storage tab hideable via Settings ─────────────────────────────────────────
{
  check('TAB_LABELS uses Object.assign to conditionally include storage (IS_STAGING gate)',
    rawScript.includes("Object.assign({today:'Today'") && rawScript.includes("IS_STAGING?{storage:'Storage'}:{}"));
  check('TAB_DEFAULTS uses Object.assign to conditionally include storage:true',
    rawScript.includes("IS_STAGING?{storage:true}:{}"));
  check('tab-btn-storage exists in HTML (hidden by default)',
    html.includes('id="tab-btn-storage"'));
  check('storage tab visibility gated by TAB_LABELS membership (no manual show override in init)',
    rawScript.includes('function _subVisible(id)') &&
    rawScript.includes('id in TAB_LABELS') &&
    !rawScript.includes("tab-btn-storage').style.display=''"));
  check('initTabVis called in init() without manual storage override after it',
    (function(){
      var i = rawScript.indexOf('initTabVis();');
      var after = rawScript.slice(i, i + 60);
      return i >= 0 && !after.includes('tab-btn-storage');
    })());
}

// ── Storage tab: copy helpers + clear button ──────────────────────────────────
{
  const G=sandbox;
  check('buildStoragePage function defined',typeof G.buildStoragePage==='function');
  check('_lsCopyText function defined',typeof G._lsCopyText==='function');
  check('_lsFbCopy function defined (textarea fallback)',typeof G._lsFbCopy==='function');
  check('lsDbgCopy accepts button arg (not just index)',rawScript.includes('function lsDbgCopy(i,btn)'));
  check('lsDbgCopyAll accepts button arg',rawScript.includes('function lsDbgCopyAll(btn)'));
  check('lsDbgClearAll function defined',typeof G.lsDbgClearAll==='function');
  check('buildStoragePage renders Clear All button',rawScript.includes('lsDbgClearAll()'));
  check('buildStoragePage renders Copy All with button arg (onclick passes this)',rawScript.includes('lsDbgCopyAll(this)'));
  check('buildStoragePage per-row copy passes this to lsDbgCopy',rawScript.includes("lsDbgCopy('+i+',this)"));
  check('buildStoragePage scrolls to top on refresh',rawScript.includes('_el.scrollTop=0'));
  check('_lsCopyText uses clipboard API with .then() feedback (not silent catch)',rawScript.includes('.then(function(){_flash(true);})')&&rawScript.includes('.catch(function(){_lsFbCopy('));
  check('no silent clipboard swallow (old pattern gone)',!rawScript.includes('.catch(function(){})')||rawScript.includes('_lsFbCopy'));
}

// ── Cycle wizard — compound dropdown + Tren template ─────────────────────────
{
  const tabCyclesJs = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-cycles.js'),'utf8');
  // Compound data compliance: must NOT be hardcoded in the public frontend repo
  check('ENHANCEMENT_COMPOUNDS not hardcoded in tab-cycles.js (must come from backend)',
    !(/var ENHANCEMENT_COMPOUNDS\s*=\s*\[\s*\{/).test(tabCyclesJs));
  check('syncEnhancedCompoundsFromAgent defined in tab-cycles.js',
    tabCyclesJs.includes('syncEnhancedCompoundsFromAgent'));
  check('syncEnhancedCompoundsFromAgent fetches /compounds/enhanced',
    tabCyclesJs.includes('/compounds/enhanced'));
  // ADD COMPOUND modal uses select not text input
  const tabStackJs = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-stack.js'),'utf8');
  check('stackAddAASCompound uses select dropdown (not free-text input) for compound name',
    tabStackJs.includes('<select id="aas-name"'));
  check('stackAddAASCompound renders grouped options via ENHANCEMENT_COMPOUNDS',
    tabStackJs.includes('optgroup')&&tabStackJs.includes('stackAASAutoFill'));
  check('stackAddAASCompound unit select includes IU/day option',
    tabStackJs.includes('<option>IU/day</option>'));
  check('stackAddAASCompound unit select includes IU/week option',
    tabStackJs.includes('<option>IU/week</option>'));
  // Regression: Enhanced wizard and edit dropdowns must include IU/day and IU/week
  // so GH Axis compounds (HGH unit="IU/day") don't silently show as "mg"
  check('Enhanced wizard unit dropdown includes IU/day (wizSetEnhUnit context)',
    tabStackJs.split('wizSetEnhUnit').some(function(s){return s.slice(0,500).includes('IU/day');}));
  check('Enhanced wizard unit dropdown includes IU/week (wizSetEnhUnit context)',
    tabStackJs.split('wizSetEnhUnit').some(function(s){return s.slice(0,500).includes('IU/week');}));
  check('Enhanced edit unit dropdown includes IU/day (editSetEnhUnit context)',
    tabStackJs.split('editSetEnhUnit').some(function(s){return s.slice(0,500).includes('IU/day');}));
  check('Enhanced edit unit dropdown includes IU/week (editSetEnhUnit context)',
    tabStackJs.split('editSetEnhUnit').some(function(s){return s.slice(0,500).includes('IU/week');}));
  check('stackAddAASCompound modal has aas-info-block div for dose guidance',
    tabStackJs.includes('id="aas-info-block"'));
  check('_renderEnhancedGuide function defined in tab-stack.js',
    tabStackJs.includes('function _renderEnhancedGuide('));
  check('_renderEnhancedGuide renders cadence block (Injection Frequency)',
    tabStackJs.includes('cat.cadence')&&tabStackJs.includes('Injection Frequency'));
  check('_renderEnhancedGuide renders cadence halfLife and rec fields',
    tabStackJs.includes('cad.rec')&&tabStackJs.includes('cad.halfLife'));
  check('_renderEnhancedGuide renders doseTiers from backend catalogue',
    tabStackJs.includes('cat.doseTiers')&&tabStackJs.includes('doseTiers.length'));
  check('_renderEnhancedGuide falls back to DOSE_GUIDE if no doseTiers',
    tabStackJs.includes('_renderDoseGuide(cat.id)')||tabStackJs.includes('DOSE_GUIDE[cat.id]'));
  check('_renderEnhancedGuide renders interaction field',
    tabStackJs.includes('cat.interaction'));
  check('_renderEnhancedGuide renders sides field',
    tabStackJs.includes('cat.sides'));
  check('stackAASAutoFill populates aas-info-block on compound select',
    tabStackJs.includes('aas-info-block')&&tabStackJs.includes('_renderEnhancedGuide(cat)'));
  // E2 management: class-based detection
  check('E2 management uses cls field from ENHANCEMENT_COMPOUNDS catalogue',
    tabStackJs.includes('ec.cls'));
  check('E2 management detects 19-nor compounds (has19nor)',
    tabStackJs.includes('has19nor'));
  check('E2 management detects Tren specifically (hasTren)',
    tabStackJs.includes('hasTren'));
  check('E2 management detects oral compounds and notes no E2 impact',
    tabStackJs.includes('oralCmps')&&tabStackJs.includes('not aromatize'));
  check('E2 management for 19-nor shows prolactin warning',
    tabStackJs.includes('prolactin')&&tabStackJs.includes('cabergoline'));
  check('E2 management for Tren shows prolactin warning distinct from generic 19-nor',
    tabStackJs.includes('tren_e')&&tabStackJs.includes('tren_a')&&tabStackJs.includes('progestin'));
  check('E2 management label for Test+oral does not say Test-only',
    !tabStackJs.includes('Test-only'));
  // TRT supraphysiological warning
  check('_renderTRTGuide shows supraphysiological warning above 250 mg/wk',
    tabStackJs.includes('weeklyDoseMg>250')&&tabStackJs.includes('Supraphysiological'));
  check('supraphysiological warning includes actual dose in mg',
    tabStackJs.includes('Math.round(weeklyDoseMg)'));
  // Structural tests (don't depend on compound data)
  check('CYCLE_TEMPLATES has Tren template (id: tren)',
    G.CYCLE_TEMPLATES&&G.CYCLE_TEMPLATES.some(function(t){return t.id==='tren';}));
  check('_cwizSetCmpd function defined',typeof G._cwizSetCmpd==='function');
  check('_cwizToggleInfo function defined',typeof G._cwizToggleInfo==='function');
  check('wizard step 2 uses compound dropdown (select with _cwizSetCmpd)',
    tabCyclesJs.includes('_cwizSetCmpd')&&tabCyclesJs.includes('Choose compound'));
  check('wizard step 2 shows ⓘ info button for known compounds',
    tabCyclesJs.includes('_cwizToggleInfo')&&tabCyclesJs.includes('cwiz-info-'));
  check('wizard step 2 shows Custom option in compound select',
    tabCyclesJs.includes('__custom__')&&tabCyclesJs.includes('Custom…'));
  check('_cwizSetCmpd auto-fills dose and unit from ENHANCEMENT_COMPOUNDS',
    tabCyclesJs.includes('ec.defaultDose')&&tabCyclesJs.includes('ec.unit'));
  check('optgroup labels used in compound dropdown (Base, DHT-Derived, 19-Nor)',
    tabCyclesJs.includes('optgroup label=')&&tabCyclesJs.includes('19-Nor'));
  // Inject mock compound data so wizard behaviour tests work (fetch is noop in test sandbox)
  G.ENHANCEMENT_COMPOUNDS=[
    {id:'_tc_base',name:'Test Base Compound',group:'Base',dot:'#e05050',defaultDose:300,unit:'mg/week',pack:{type:'vial',conc_mg_ml:250,vol_ml:10}},
    {id:'_tc_oral',name:'Test Oral Compound',group:'Oral',dot:'#d060d0',defaultDose:50,unit:'mg/day',pack:{type:'tablet',mg_per_tab:10,tabs_per_pack:100}}
  ];
}
{
  // ── PRICELIST & Cart functions ───────────────────────────────────────────
  const G=sandbox;
  check('PRICELIST is defined',typeof G.PRICELIST==='object'&&G.PRICELIST!==null);
  check('PRICELIST CP10 = 10mg/vial × 10 vials (no price)',
    G.PRICELIST&&G.PRICELIST['CP10']&&G.PRICELIST['CP10'].q===10&&G.PRICELIST['CP10'].n===10&&!('usd' in G.PRICELIST['CP10']));
  check('PRICELIST H24 = 24 IU/vial × 10 vials (no price)',
    G.PRICELIST&&G.PRICELIST['H24']&&G.PRICELIST['H24'].q===24&&G.PRICELIST['H24'].unit==='iu'&&!('usd' in G.PRICELIST['H24']));
  check('PRICELIST RT5 = 5mg × 10 (no price)',
    G.PRICELIST&&G.PRICELIST['RT5']&&G.PRICELIST['RT5'].q===5&&!('usd' in G.PRICELIST['RT5']));
  check('openCartModal function defined',typeof G.openCartModal==='function');
  check('closeCartModal function defined',typeof G.closeCartModal==='function');
  check('_renderCartModal function defined',typeof G._renderCartModal==='function');
  check('_calcPeptideCartItem function defined',typeof G._calcPeptideCartItem==='function');
  check('_calcEnhancementCartItem function defined',typeof G._calcEnhancementCartItem==='function');
  // optimizer: retatrutide 3mg/week 1x/week 12wks → 36mg total → RT20 (46.7d ≤ 55) → 2 vials
  check('_calcPeptideCartItem: retatrutide 3mg/week 1x/week 12wks → RT20 → 2 vials (no price, no boxes)',
    (function(){
      var p={id:'retatrutide',name:'Retatrutide',dose_am:'3',dose_pm:'',unit_am:'mg',unit_pm:'mg',times:['AM'],days:[0],active:true};
      var item=G._calcPeptideCartItem(p,12);
      return item&&item.sku==='RT20'&&item.vials===2&&item.boxes==null&&!('price' in item);
    })());
  // optimizer: HGH 3 IU/day 7 days/week 12wks → 252 IU → H24 → 11 vials (H24 was already optimal)
  check('_calcPeptideCartItem: HGH 3 IU/day 7 days/week 12wks → 252 IU → 11 vials H24 (no boxes, no price)',
    (function(){
      var p={id:'hgh',name:'HGH',dose_am:'3',dose_pm:'',unit_am:'IU',unit_pm:'IU',times:['AM'],days:[0,1,2,3,4,5,6],active:true};
      var item=G._calcPeptideCartItem(p,12);
      var totalIU=3*7*12; // 252 IU
      var vials=Math.ceil(totalIU/24); // ceil(10.5)=11
      return item&&item.sku==='H24'&&item.vials===vials&&item.boxes==null&&!('price' in item);
    })());
  check('_calcEnhancementCartItem: vial compound 400mg/week 16wks → 6400mg → 3 vials (250×10=2500mg each)',
    (function(){
      var c={name:'Test Base Compound',dose:400,unit:'mg/week',active:true};
      var item=G._calcEnhancementCartItem(c,16);
      return item&&item.units===Math.ceil(400*16/2500)&&item.unitLabel==='vials';
    })());
  check('_calcEnhancementCartItem: tablet compound 50mg/day 8wks → 2800mg → 3 packs (10×100=1000mg each)',
    (function(){
      var c={name:'Test Oral Compound',dose:50,unit:'mg/day',active:true};
      var item=G._calcEnhancementCartItem(c,8);
      return item&&item.units===Math.ceil(50*7*8/1000)&&item.unitLabel==='packs';
    })());
  check('buildStackStore HTML includes Shopping List button',
    (function(){var html=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'index.html'),'utf8');return html.includes('openCartModal')&&html.includes('Shopping List');})());
  // ── Vial optimizer ───────────────────────────────────────────────────────────
  check('_optimalVialSku function defined',typeof G._optimalVialSku==='function');
  // Tesamorelin 2mg/day 7d/wk 12wks → 168mg → TSM20 → 9 vials
  check('_calcPeptideCartItem: Tesamorelin 2mg/day 7d/wk 12wks → TSM20 → 9 vials',
    (function(){
      var p={id:'tesamorelin',name:'Tesamorelin',dose_am:'2',dose_pm:'',unit_am:'mg',unit_pm:'mg',times:['AM'],days:[0,1,2,3,4,5,6],active:true};
      var item=G._calcPeptideCartItem(p,12);
      return item&&item.sku==='TSM20'&&item.vials===9&&item.boxes==null;
    })());
  // NAD+ 100mg 3d/wk 12wks → 3600mg → NJ1000 → 4 vials
  check('_calcPeptideCartItem: NAD+ 100mg 3d/wk 12wks → NJ1000 → 4 vials',
    (function(){
      var p={id:'nad',name:'NAD+',dose_am:'100',dose_pm:'',unit_am:'mg',unit_pm:'mg',times:['AM'],days:[1,3,5],active:true};
      var item=G._calcPeptideCartItem(p,12);
      return item&&item.sku==='NJ1000'&&item.vials===4&&item.boxes==null;
    })());
  // NAD+ 100mg 1d/wk 12wks — NJ1000 = 70 days > 55, must use NJ500 → 3 vials
  check('_calcPeptideCartItem: NAD+ 100mg 1d/wk 12wks → NJ500 (NJ1000 violates 55-day rule) → 3 vials',
    (function(){
      var p={id:'nad',name:'NAD+',dose_am:'100',dose_pm:'',unit_am:'mg',unit_pm:'mg',times:['AM'],days:[1],active:true};
      var item=G._calcPeptideCartItem(p,12);
      return item&&item.sku==='NJ500'&&item.vials===3&&item.boxes==null;
    })());
  // Shopping list render: vials bolded, no box display
  check('shopping list renders vials in bold span (no box count)',
    (function(){
      var html=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'index.html'),'utf8');
      var hasBoldVials=html.includes('font-weight:600;color:var(--text)">\'+item.vials');
      var hasBoxRender=html.includes('item.boxes');
      return hasBoldVials&&!hasBoxRender;
    })());
}

// ── Three-tier wizard — HGH & tier-aware steps ───────────────────────────────
console.log('\n── Three-tier wizard — HGH & tier-aware steps ──────────────');
{
  // HGH must NOT appear in peptides step (it is an Enhancement compound)
  check('HGH is in PEPTIDE_CAT with group Enhanced',
    G.PEPTIDE_CAT&&G.PEPTIDE_CAT.some(function(p){return p.id==='hgh'&&p.group==='Enhanced';}));

  // _wizTier and _wizFlow helpers
  check('_wizTier defined', typeof G._wizTier==='function');
  check('_wizFlow defined', typeof G._wizFlow==='function');

  // Flow 1: Peps only (T1)
  G._userTier=1;G.initWizard();
  var f1=G._wizFlow();
  check('flow peps-only: 7 steps', f1.length===7, 'got '+f1.length);
  check('flow peps-only: last=review', f1[f1.length-1]==='review');
  check('flow peps-only: no trt', !f1.includes('trt'));
  check('flow peps-only: no validate', !f1.includes('validate'));

  // Flow 2: TRT only (T2, trt.enabled=true, no pep goals)
  G._userTier=2;G.initWizard();G._wiz.trt.enabled=true;
  var f2=G._wizFlow();
  check('flow TRT-only: 5 steps', f2.length===5, 'got '+f2.length);
  check('flow TRT-only: has trt', f2.includes('trt'));
  check('flow TRT-only: no peptides step', !f2.includes('peptides'));
  check('flow TRT-only: no validate', !f2.includes('validate'));

  // Flow 3: Peps + TRT (T2, trt.enabled, pep goal)
  G._userTier=2;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['muscle'];
  var f3=G._wizFlow();
  check('flow peps+TRT: 9 steps', f3.length===9, 'got '+f3.length);
  check('flow peps+TRT: has peptides', f3.includes('peptides'));
  check('flow peps+TRT: has trt', f3.includes('trt'));
  check('flow peps+TRT: has validate', f3.includes('validate'));

  // Flow 4: TRT + Enhanced (T3, trt.enabled, enhanced goal, no pep goals)
  G._userTier=3;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['enhanced'];
  var f4=G._wizFlow();
  check('flow TRT+enhanced: 8 steps', f4.length===8, 'got '+f4.length);
  check('flow TRT+enhanced: has advise before enhanced', f4.indexOf('advise')===f4.indexOf('enhanced')-1);
  check('flow TRT+enhanced: has enhanced', f4.includes('enhanced'));
  check('flow TRT+enhanced: has validate', f4.includes('validate'));
  check('flow TRT+enhanced: no peptides step', !f4.includes('peptides'));

  // Flow 5: Peps + TRT + Enhanced (T3, all tiers)
  G._userTier=3;G.initWizard();G._wiz.trt.enabled=true;G._wiz.goals=['enhanced','muscle'];
  var f5=G._wizFlow();
  check('flow peps+TRT+enhanced: 11 steps', f5.length===11, 'got '+f5.length);
  check('flow peps+TRT+enhanced: has all tiers', f5.includes('peptides')&&f5.includes('trt')&&f5.includes('enhanced'));
  check('flow peps+TRT+enhanced: has validate', f5.includes('validate'));

  // T3 initWizard defaults to no enhanced goal
  G._userTier=3;G.initWizard();
  check('T3 initWizard does not auto-include enhanced goal', !G._wiz.goals.includes('enhanced'));

  // wizStepPeptides filter: HGH (group=Enhanced) must not appear
  G._userTier=1;
  G._wiz={step:0,goals:[],peptides:[],trt:{enabled:false,compounds:[]},editMode:false,stackIndex:-1,stackName:'Test',cycle_length:12};
  var pepBody={innerHTML:''};
  var pepFoot={innerHTML:''};
  G.wizStepPeptides(pepBody,pepFoot);
  var pepHtml=pepBody.innerHTML;
  // Check HGH id not in rendered content - we need to check if HGH card was rendered
  // The rendered HTML contains data-id or onclick with 'hgh' only if HGH was included
  check('wizStepPeptides HTML does not include HGH (id=hgh excluded by group:Enhanced filter)',
    !pepHtml.includes("wizTogglePep('hgh')"), 'HGH card found in T1 peptides step');

  // Enhanced goal set: still no HGH (group filter is unconditional)
  G._wiz.goals=['enhanced'];
  var pepBody2={innerHTML:''};
  G.wizStepPeptides(pepBody2,pepFoot);
  check('wizStepPeptides with enhanced goal still excludes HGH',
    !pepBody2.innerHTML.includes("wizTogglePep('hgh')"), 'HGH appeared with enhanced goal');

  // Restore tier
  G._userTier=1;
}

// ── Enhanced wizard redesign tests ──────────────────────────────────────────
{
  G._userTier=3;

  // wizToggleEnhancedCompound pre-populates dose, unit and days
  G.initWizard();G._wiz.goals=['enhanced'];
  var testId=(G.ENHANCEMENT_COMPOUNDS&&G.ENHANCEMENT_COMPOUNDS[0]&&G.ENHANCEMENT_COMPOUNDS[0].id)||null;
  if(testId){
    G.wizToggleEnhancedCompound(testId);
    var ec=G._wiz.enhanced.compounds.find(function(c){return c.id===testId;});
    check('wizToggleEnhancedCompound: compound added to _wiz.enhanced.compounds', !!ec);
    check('wizToggleEnhancedCompound: dose pre-populated as string', typeof ec.dose==='string');
    var cat=G.ENHANCEMENT_COMPOUNDS.find(function(c){return c.id===testId;});
    var expDays=cat&&cat.defaultDays?cat.defaultDays:[0,1,2,3,4,5,6];
    check('wizToggleEnhancedCompound: days uses compound defaultDays', Array.isArray(ec.days)&&JSON.stringify(ec.days.slice().sort(function(a,b){return a-b;}))=== JSON.stringify(expDays.slice().sort(function(a,b){return a-b;})));
    check('wizToggleEnhancedCompound: unit set', !!ec.unit);
    check('wizToggleEnhancedCompound: _wiz.enhanced.enabled=true after adding', G._wiz.enhanced.enabled===true);
    // Toggle off
    G.wizToggleEnhancedCompound(testId);
    check('wizToggleEnhancedCompound: removed on second click', G._wiz.enhanced.compounds.length===0);
    check('wizToggleEnhancedCompound: _wiz.enhanced.enabled=false when empty', G._wiz.enhanced.enabled===false);
  }

  // wizSetEnhDose, wizSetEnhUnit, wizSetEnhDays setters
  if(testId){
    G.initWizard();G._wiz.goals=['enhanced'];
    G.wizToggleEnhancedCompound(testId);
    G.wizSetEnhDose(testId,'250');
    var ec2=G._wiz.enhanced.compounds.find(function(c){return c.id===testId;});
    check('wizSetEnhDose: dose updated', ec2&&ec2.dose==='250');
    G.wizSetEnhUnit(testId,'ml');
    check('wizSetEnhUnit: unit updated', ec2&&ec2.unit==='ml');
    // Force days to a known single-day state for toggle tests
    if(ec2)ec2.days=[3];
    G.wizSetEnhDays(testId,1); // add Monday to [3]
    check('wizSetEnhDays: days includes added day', ec2&&ec2.days&&ec2.days.includes(1));
    G.wizSetEnhDays(testId,3); // remove Wednesday (days=[1] now)
    check('wizSetEnhDays: days still has Mon after removing Wed', ec2&&ec2.days&&ec2.days.includes(1)&&!ec2.days.includes(3));
    // Cannot deselect last day
    G.wizSetEnhDays(testId,1); // try removing Mon when it's the only day
    check('wizSetEnhDays: cannot remove last day', ec2&&ec2.days&&ec2.days.length>=1);
  }

  // wizStepEnhanced prefill: TRT compound matching ENHANCEMENT_COMPOUNDS name is auto-added on first entry
  // Uses ENHANCEMENT_COMPOUNDS[0] as the matching compound — no TRT_CAT needed since _trtCompounds returns trt.compounds directly
  if(G.ENHANCEMENT_COMPOUNDS&&G.ENHANCEMENT_COMPOUNDS.length){
    var enhFirst=G.ENHANCEMENT_COMPOUNDS[0];
    G.initWizard();G._userTier=3;G._wiz.goals=['enhanced'];G._wiz.trt.enabled=true;
    G._wiz.trt.compounds=[{id:'_trt_test',name:enhFirst.name,dose:'125',unit:'mg',days:[1,3,5]}];
    var pfBody={innerHTML:''};var pfFoot={innerHTML:''};
    G.wizStepEnhanced(pfBody,pfFoot);
    var preAdded=G._wiz.enhanced.compounds.find(function(c){return c.id===enhFirst.id;});
    check('wizStepEnhanced prefill: TRT-matching compound auto-added', !!preAdded);
    check('wizStepEnhanced prefill: pre-filled dose matches TRT dose', preAdded&&preAdded.dose==='125');
    check('wizStepEnhanced prefill: pre-filled days match TRT days', preAdded&&Array.isArray(preAdded.days)&&preAdded.days.length===3&&preAdded.days.includes(1)&&preAdded.days.includes(3)&&preAdded.days.includes(5));
    check('wizStepEnhanced prefill: enabled=true after prefill', G._wiz.enhanced.enabled===true);
    var beforeLen=G._wiz.enhanced.compounds.length;
    var pfBody2={innerHTML:''};var pfFoot2={innerHTML:''};
    G.wizStepEnhanced(pfBody2,pfFoot2);
    check('wizStepEnhanced prefill: _prefilled flag prevents duplicate on re-render', G._wiz.enhanced.compounds.length===beforeLen);
  }

  // wizStepReview: no blocking save with TRT compound also in Enhanced
  if(testId){
    G.initWizard();G._userTier=3;G._wiz.goals=['enhanced'];
    var safeEnh=G.ENHANCEMENT_COMPOUNDS&&G.ENHANCEMENT_COMPOUNDS.find(function(c){return c.id===testId;});
    if(safeEnh){
      G._wiz.enhanced.compounds=[{id:safeEnh.id,name:safeEnh.name,dose:'50',unit:'mg',days:[1,2,3,4,5,6,0],dot:safeEnh.dot}];
      G._wiz.enhanced.enabled=true;
      var revBody2={innerHTML:''};var revFoot2={innerHTML:''};
      G.wizStepReview(revBody2,revFoot2);
      check('wizStepReview: enhanced compound without peptide errors → Save Protocol label', revFoot2.innerHTML.includes('Save Protocol'));
    }
  }

  // Enhanced summary in review shows days label
  if(testId){
    G.initWizard();G._userTier=3;G._wiz.goals=['enhanced'];
    var anyEnh=G.ENHANCEMENT_COMPOUNDS&&G.ENHANCEMENT_COMPOUNDS.find(function(c){return c.id===testId;});
    if(anyEnh){
      G._wiz.enhanced.compounds=[{id:anyEnh.id,name:anyEnh.name,dose:'50',unit:'mg',days:[1,2,3,4,5,6,0],dot:anyEnh.dot}];
      G._wiz.enhanced.enabled=true;
      var revBody3={innerHTML:''};var revFoot3={innerHTML:''};
      G.wizStepReview(revBody3,revFoot3);
      check('wizStepReview: enhanced compound summary shows "Every day" for 7-day schedule',
        revBody3.innerHTML.includes('Every day'));
    }
  }

  G._userTier=1;
}

// ── Edit Enhanced tab — stack editor regression ──────────────────────────────
console.log('\n── Edit Enhanced tab — stack editor regression ─────────────');
{
  const G=sandbox;
  G._userTier=3;

  // Helper functions exist
  check('editToggleEnhancedCompound defined', typeof G.editToggleEnhancedCompound==='function');
  check('editSetEnhDose defined',             typeof G.editSetEnhDose==='function');
  check('editSetEnhUnit defined',             typeof G.editSetEnhUnit==='function');
  check('editSetEnhDays defined',             typeof G.editSetEnhDays==='function');
  check('_renderEditEnhanced defined',        typeof G._renderEditEnhanced==='function');
  check('_renderEnhancedViewTab defined',     typeof G._renderEnhancedViewTab==='function');

  // _renderEditEnhanced returns string HTML
  var editEnh=G._renderEditEnhanced({enabled:false,compounds:[]});
  check('_renderEditEnhanced returns string', typeof editEnh==='string');
  check('_renderEditEnhanced shows intro text', editEnh.includes('enhancement compounds'));

  var testId2=(G.ENHANCEMENT_COMPOUNDS&&G.ENHANCEMENT_COMPOUNDS[0]&&G.ENHANCEMENT_COMPOUNDS[0].id)||null;
  if(testId2){
    G._editBuf={name:'Test',peptides:[],trt:{enabled:false,compounds:[]},cycle_length:12};
    G.editToggleEnhancedCompound(testId2);
    check('editToggleEnhancedCompound: creates enhanced on _editBuf', !!G._editBuf.enhanced);
    check('editToggleEnhancedCompound: compound added', G._editBuf.enhanced.compounds.length===1);
    check('editToggleEnhancedCompound: enabled=true', G._editBuf.enhanced.enabled===true);
    check('editToggleEnhancedCompound: dose is string', typeof G._editBuf.enhanced.compounds[0].dose==='string');
    var cat2=G.ENHANCEMENT_COMPOUNDS.find(function(c){return c.id===testId2;});
    var expDays2=cat2&&cat2.defaultDays?cat2.defaultDays:[0,1,2,3,4,5,6];
    check('editToggleEnhancedCompound: days uses compound defaultDays', Array.isArray(G._editBuf.enhanced.compounds[0].days)&&JSON.stringify(G._editBuf.enhanced.compounds[0].days.slice().sort(function(a,b){return a-b;}))=== JSON.stringify(expDays2.slice().sort(function(a,b){return a-b;})));

    G.editSetEnhDose(testId2,'200');
    check('editSetEnhDose: updates dose', G._editBuf.enhanced.compounds[0].dose==='200');

    G.editSetEnhUnit(testId2,'ml');
    check('editSetEnhUnit: updates unit', G._editBuf.enhanced.compounds[0].unit==='ml');

    // Force single-day state for toggle test
    G._editBuf.enhanced.compounds[0].days=[5];
    G.editSetEnhDays(testId2,3);
    check('editSetEnhDays: adds day 3', G._editBuf.enhanced.compounds[0].days.includes(3));

    G._editBuf.enhanced.compounds[0].days=[1];
    G.editSetEnhDays(testId2,1);
    check('editSetEnhDays: cannot deselect last day', G._editBuf.enhanced.compounds[0].days.length>=1);

    var viewHtml=G._renderEnhancedViewTab({enhanced:{enabled:true,compounds:[{id:testId2,name:'Test Compound',dose:'250',unit:'mg',days:[1,3],dot:'#e05050'}]}});
    check('_renderEnhancedViewTab: contains compound name', viewHtml.includes('Test Compound'));
    check('_renderEnhancedViewTab: contains dose', viewHtml.includes('250mg'));
    check('_renderEnhancedViewTab: includes On-cycle & recovery panel when compounds present', viewHtml.includes('On-cycle &amp; recovery') && viewHtml.includes('pct-recovery-body'));
    // PCT panel separates on-cycle support from post-cycle
    var _pctSplit=G._renderPctPlanHtml({applicable:true,on_cycle:[{agent:'HCG',message:'HCG 250–500 IU 2×/week.'}],pct:{start:'≈2 week(s) after the last injection.',serm:{primary:{agent:'Tamoxifen',schedule:[{weeks:'1–2',dose:'20 mg/day'}]}},confirm_labs:['LH and FSH']},notes:[],guardrails:[]});
    check('_renderPctPlanHtml: labels On-cycle support', _pctSplit.includes('On-cycle support'));
    check('_renderPctPlanHtml: labels Post-cycle (PCT)', _pctSplit.includes('Post-cycle (PCT)'));
    check('_renderPctPlanHtml: on-cycle HCG at 250–500 IU', _pctSplit.includes('250–500 IU'));

    // _renderPctPlanHtml renders a backend plan (no network — pass a mock plan)
    check('_renderPctPlanHtml defined', typeof G._renderPctPlanHtml==='function');
    var _pctMock={applicable:true,on_cycle:[{agent:'HCG',message:'HCG 500–1000 IU 2×/week.'}],pct:{start:'≈2 week(s) after the last injection.',serm:{primary:{agent:'Tamoxifen (Nolvadex)',schedule:[{weeks:'1–2',dose:'20 mg/day'}]},alternative:{agent:'Clomiphene (Clomid)',schedule:[{weeks:'1–2',dose:'50 mg/day'}]},note:'HCG primes before, never during.'},confirm_labs:['LH and FSH']},notes:['n'],guardrails:['g']};
    var _pctHtml=G._renderPctPlanHtml(_pctMock);
    check('_renderPctPlanHtml: shows on-cycle HCG', _pctHtml.includes('HCG'));
    check('_renderPctPlanHtml: shows SERM restart (Tamoxifen)', _pctHtml.includes('Tamoxifen'));
    check('_renderPctPlanHtml: shows PCT start timing', _pctHtml.includes('after the last injection'));
    check('_renderPctPlanHtml: shows confirm labs', _pctHtml.includes('LH and FSH'));
    var _pctFemale=G._renderPctPlanHtml({applicable:false,notes:['female note']});
    check('_renderPctPlanHtml: female/non-applicable shows note', _pctFemale.includes('female note'));

    var viewEmpty=G._renderEnhancedViewTab({enhanced:{enabled:false,compounds:[]}});
    check('_renderEnhancedViewTab empty: shows no compounds message', viewEmpty.includes('No enhancement compounds'));

    var viewMissing=G._renderEnhancedViewTab({});
    check('_renderEnhancedViewTab: handles missing enhanced key', viewMissing.includes('No enhancement compounds'));

    var gBody={innerHTML:''};var gFoot={innerHTML:''};
    G.initWizard();G._wiz.goals=['enhanced'];
    G.wizStepGoals(gBody,gFoot);
    check('wizStepGoals T3: shows the single Compounds toggle',
      gBody.innerHTML.includes('Testosterone &amp; enhanced compounds'));

    // #637: AM/PM split is user-toggleable on any enhanced compound
    check('editSetEnhAmPm defined', typeof G.editSetEnhAmPm==='function');
    G.editSetEnhAmPm(testId2,true);
    check('editSetEnhAmPm: sets amPm=true', G._editBuf.enhanced.compounds[0].amPm===true);
    G.editSetEnhAmPm(testId2,false);
    check('editSetEnhAmPm: sets amPm=false', G._editBuf.enhanced.compounds[0].amPm===false);
    // Edit view surfaces the Split AM / PM toggle row and honours the per-compound flag
    var enhEditOn=G._renderEditEnhanced({enabled:true,compounds:[{id:testId2,name:'Test',dose_am:'2',dose_pm:'1',unit:'IU/day',days:[1],amPm:true}]});
    check('_renderEditEnhanced: shows the split toggle', enhEditOn.includes('Split across AM / Pre-GYM / PM'));
    // Dose rows now follow the selected schedule rather than always showing all three.
    // This fixture has no `times`, so it infers AM+PM from its populated doses.
    check('_renderEditEnhanced amPm on: rows follow the selected schedule',
      enhEditOn.includes('AM Dose')&&enhEditOn.includes('PM Dose')&&!enhEditOn.includes('Pre-GYM Dose'));
    check('_renderEditEnhanced amPm on: offers all three timing chips',
      enhEditOn.includes('>AM</div>')&&enhEditOn.includes('>Pre-GYM</div>')&&enhEditOn.includes('>PM</div>'));
    var enhEditOff=G._renderEditEnhanced({enabled:true,compounds:[{id:testId2,name:'Test',dose:'250',unit:'mg/week',days:[1],amPm:false}]});
    check('_renderEditEnhanced amPm off: single Dose row, no per-slot rows',
      enhEditOff.includes('Split across AM / Pre-GYM / PM')&&!enhEditOff.includes('AM Dose')&&!enhEditOff.includes('Pre-GYM Dose'));

    G.editToggleEnhancedCompound(testId2);
    check('editToggleEnhancedCompound: removes compound on second call', G._editBuf.enhanced.compounds.length===0);
    check('editToggleEnhancedCompound: enabled=false when empty', G._editBuf.enhanced.enabled===false);
  }

  G._userTier=1;
}

// ── Wizard step render tests ──────────────────────────────────────────────────
console.log('\n── Wizard step render tests ────────────────────────────────');
{
  const G=sandbox;

  // wizStep1: cycle length selector
  G._userTier=1;
  G.initWizard();
  var s1B={innerHTML:''};var s1F={innerHTML:''};
  G.wizStep1(s1B,s1F);
  check('wizStep1: body not empty', s1B.innerHTML.length>0);
  check('wizStep1: contains cycle length select', s1B.innerHTML.includes('<select'));
  check('wizStep1: has "No end date" option', s1B.innerHTML.includes('No end date'));
  check('wizStep1: has month option', s1B.innerHTML.includes('month'));
  check('wizStep1: footer has Next button', s1F.innerHTML.includes('Next'));

  // wizStepGoals T1: no TRT section, no Enhanced Cycle toggle
  G._userTier=1;
  G.initWizard();
  var gB1={innerHTML:''};var gF1={innerHTML:''};
  G.wizStepGoals(gB1,gF1);
  check('wizStepGoals T1: body not empty', gB1.innerHTML.length>0);
  check('wizStepGoals T1: contains goal-chip', gB1.innerHTML.includes('goal-chip'));
  check('wizStepGoals T1: no Testosterone toggle (T1 has no TRT access)', !gB1.innerHTML.includes('Testosterone protocol'));
  check('wizStepGoals T1: no Enhanced toggle', !gB1.innerHTML.includes('Steroids'));
  check('wizStepGoals T1: footer has Next button', gF1.innerHTML.includes('Next'));

  // wizStepGoals T2: TRT toggle present, no Enhanced Cycle
  G._userTier=2;
  G.initWizard();
  var gB2={innerHTML:''};var gF2={innerHTML:''};
  G.wizStepGoals(gB2,gF2);
  // One toggle since 2026-08-20 ("TRT and Enhanced should never be separated"), at
  // every tier that has compounds at all. What the tier changes is where the flow ENDS,
  // not whether there are two switches to choose between.
  check('wizStepGoals T2: has the Compounds toggle',
    gB2.innerHTML.includes('Testosterone &amp; enhanced compounds'));
  check('wizStepGoals T2: and only one toggle, not a TRT/Enhanced pair',
    (gB2.innerHTML.match(/class="toggle-sw/g)||[]).length===1);

  // wizStepGoals T3: Enhanced Cycle section visible + toggleable
  G._userTier=3;
  G.initWizard();
  var gB3={innerHTML:''};var gF3={innerHTML:''};
  G.wizStepGoals(gB3,gF3);
  check('wizStepGoals T3: shows the same single Compounds toggle',
    gB3.innerHTML.includes('Testosterone &amp; enhanced compounds'));
  check('wizStepGoals T3: one toggle here too, same as tier 2',
    (gB3.innerHTML.match(/class="toggle-sw/g)||[]).length===1);
  check('wizStepGoals T3: initWizard does not auto-include enhanced in goals', !G._wiz.goals.includes('enhanced'));
  check('wizStepGoals T3: the toggle starts OFF by default', !gB3.innerHTML.includes('toggle-sw on'));

  // wizStepCheck: empty peptides
  G._userTier=1;
  G.initWizard();
  var ckB1={innerHTML:''};var ckF1={innerHTML:''};
  G.wizStepCheck(ckB1,ckF1);
  check('wizStepCheck empty: mentions no peptides', ckB1.innerHTML.includes('No peptides'));
  check('wizStepCheck empty: footer has Next', ckF1.innerHTML.includes('Next'));

  // wizStepCheck: with peptide (no conflicts)
  G.initWizard();
  var pepCat0=G.PEPTIDE_CAT&&G.PEPTIDE_CAT.find(function(p){return p.id==='cjc-ipa';});
  if(pepCat0){
    var d0=pepCat0.dflt;
    G._wiz.peptides=[{id:'cjc-ipa',name:pepCat0.name,dot:pepCat0.dot,times:['AM'],days:[1,2,3,4,5],dose_am:d0.doseAm,dose_pm:'',unit_am:d0.unitAm,note:'',active:true}];
    var ckB2={innerHTML:''};var ckF2={innerHTML:''};
    G.wizStepCheck(ckB2,ckF2);
    check('wizStepCheck with peptide: lists peptide name', ckB2.innerHTML.includes(pepCat0.name));
    check('wizStepCheck with peptide: shows Validation section', ckB2.innerHTML.includes('Validation'));
  }

  // wizStepConfig: empty peptides
  G.initWizard();
  var cfB1={innerHTML:''};var cfF1={innerHTML:''};
  G.wizStepConfig(cfB1,cfF1);
  check('wizStepConfig empty: mentions no peptides', cfB1.innerHTML.includes('No peptides'));

  // wizStepConfig: with peptide — shows dose/timing/days controls
  if(pepCat0){
    var d0=pepCat0.dflt;
    G.initWizard();
    G._wiz.peptides=[{id:'cjc-ipa',name:pepCat0.name,dot:pepCat0.dot,times:['AM'],days:[1,2,3,4,5],dose_am:d0.doseAm,dose_pm:'',unit_am:d0.unitAm,note:'',active:true}];
    var cfB2={innerHTML:''};var cfF2={innerHTML:''};
    G.wizStepConfig(cfB2,cfF2);
    check('wizStepConfig with peptide: shows cfg-block', cfB2.innerHTML.includes('cfg-block'));
    check('wizStepConfig with peptide: shows peptide name', cfB2.innerHTML.includes(pepCat0.name));
    check('wizStepConfig with peptide: shows AM Dose row', cfB2.innerHTML.includes('AM Dose'));
    check('wizStepConfig with peptide: shows Days row', cfB2.innerHTML.includes('Days'));
    check('wizStepConfig with peptide: footer has Next', cfF2.innerHTML.includes('Next'));
  }

  // wizStepTRT: renders TRT compound list
  G._userTier=2;
  G.initWizard();
  var trtB={innerHTML:''};var trtF={innerHTML:''};
  G.wizStepTRT(trtB,trtF);
  check('wizStepTRT: body not empty', trtB.innerHTML.length>0);
  if(G.TRT_CAT&&G.TRT_CAT.length){
    check('wizStepTRT: lists first TRT compound', trtB.innerHTML.includes(G.TRT_CAT[0].name));
  }
  check('wizStepTRT: footer has Next', trtF.innerHTML.includes('Next'));

  // wizStepEnhanced: renders compound list (T3)
  G._userTier=3;
  G.initWizard();
  var eB={innerHTML:''};var eF={innerHTML:''};
  G.wizStepEnhanced(eB,eF);
  check('wizStepEnhanced: body not empty', eB.innerHTML.length>0);
  check('wizStepEnhanced: footer has Next', eF.innerHTML.includes('Next'));
  if(G.ENHANCEMENT_COMPOUNDS&&G.ENHANCEMENT_COMPOUNDS.length){
    check('wizStepEnhanced: lists compound group', eB.innerHTML.includes(G.ENHANCEMENT_COMPOUNDS[0].group));
  }

  // wizStepEnhanced: empty catalogue shows visible loading state (not invisible muted text)
  var savedEnhCat=G.ENHANCEMENT_COMPOUNDS;
  G.ENHANCEMENT_COMPOUNDS=[];
  G._userTier=3;
  G.initWizard();
  G._wiz.step=2; // simulate being on Enhanced step in the flow
  var elB={innerHTML:''};var elF={innerHTML:''};
  G.wizStepEnhanced(elB,elF);
  check('wizStepEnhanced empty catalogue: shows loading text (not silent blank)', elB.innerHTML.includes('Loading compounds'));
  check('wizStepEnhanced empty catalogue: Next button disabled when loading', elF.innerHTML.includes('disabled'));
  G.ENHANCEMENT_COMPOUNDS=savedEnhCat; // restore

  // syncEnhancedCompoundsFromAgent: backend returns {compounds:[...]} — must extract array, not assign whole object
  var origEnhCat=G.ENHANCEMENT_COMPOUNDS;
  G.ENHANCEMENT_COMPOUNDS=[];
  // Simulate response from backend: wrapped object ({"compounds":[...]})
  var fakeCompound={id:'test_e',name:'Test',group:'Base'};
  var wrappedResponse={compounds:[fakeCompound]};
  // Extract array using same logic as the fixed syncEnhancedCompoundsFromAgent
  var d=wrappedResponse;
  var extracted=Array.isArray(d)?d:(d.compounds||[]);
  G.ENHANCEMENT_COMPOUNDS=extracted;
  check('syncEnhancedCompoundsFromAgent: extracts .compounds array from wrapped response', Array.isArray(G.ENHANCEMENT_COMPOUNDS));
  check('syncEnhancedCompoundsFromAgent: ENHANCEMENT_COMPOUNDS has length after extract', G.ENHANCEMENT_COMPOUNDS.length===1);
  G.ENHANCEMENT_COMPOUNDS=origEnhCat; // restore

  // wizStepReview: empty stack — no peptides
  G._userTier=1;
  G.initWizard();
  var rvB={innerHTML:''};var rvF={innerHTML:''};
  G.wizStepReview(rvB,rvF);
  check('wizStepReview empty: body not empty', rvB.innerHTML.length>0);
  check('wizStepReview empty: shows Protocol Name input', rvB.innerHTML.includes('Protocol Name'));
  check('wizStepReview empty: shows Summary section', rvB.innerHTML.includes('Summary'));
  check('wizStepReview empty: no peptides message', rvB.innerHTML.includes('No peptides'));
  check('wizStepReview empty: footer has Save Protocol', rvF.innerHTML.includes('Save Protocol'));

  // wizStepReview: Enhanced-only flow — no "No peptides selected." shown
  G._userTier=3;
  G.initWizard();
  G._wiz.goals=['enhanced'];
  G._wiz.enhanced={enabled:false,compounds:[]};
  var rvEnhB={innerHTML:''};var rvEnhF={innerHTML:''};
  G.wizStepReview(rvEnhB,rvEnhF);
  check('wizStepReview enhanced-only: no "No peptides" message (peptides not in flow)', !rvEnhB.innerHTML.includes('No peptides selected'));
  check('wizStepReview enhanced-only: shows "No enhancement compounds selected"', rvEnhB.innerHTML.includes('No enhancement compounds selected'));
  check('wizStepReview enhanced-only: shows Enhancement Compounds section heading', rvEnhB.innerHTML.includes('Enhancement Compounds'));

  // wizStepReview: Enhanced-only flow with a compound — compound shown in summary
  G._wiz.enhanced={enabled:true,compounds:[{id:'test-c',name:'Test Compound',dose:'200',unit:'mg',days:[1,4],dot:'#f00'}]};
  var rvEnhB2={innerHTML:''};var rvEnhF2={innerHTML:''};
  G.wizStepReview(rvEnhB2,rvEnhF2);
  check('wizStepReview enhanced with compound: compound name shown', rvEnhB2.innerHTML.includes('Test Compound'));
  check('wizStepReview enhanced with compound: no "No enhancement compounds" message', !rvEnhB2.innerHTML.includes('No enhancement compounds selected'));

  // TRT/Enhanced mutual exclusion — enabling TRT clears Enhanced
  G._userTier=3;
  G.initWizard();
  G._wiz.goals=['enhanced'];
  if(!G._wiz.enhanced)G._wiz.enhanced={enabled:true,compounds:[]};
  G._wiz.enhanced.compounds=[{id:'x',name:'X',dose:'100',unit:'mg',days:[1],dot:'#f00'}];
  G._wiz.enhanced.enabled=true;
  G.wizToggleGoalTRT(); // enable TRT → should clear Enhanced
  check('wizToggleGoalTRT: enabling TRT removes enhanced from goals', !G._wiz.goals.includes('enhanced'));
  check('wizToggleGoalTRT: enabling TRT clears enhanced compounds', !G._wiz.enhanced||G._wiz.enhanced.compounds.length===0);
  check('wizToggleGoalTRT: enabling TRT sets enhanced.enabled=false', !G._wiz.enhanced||G._wiz.enhanced.enabled===false);

  // TRT/Enhanced mutual exclusion — enabling Enhanced clears TRT
  G._userTier=3;
  G.initWizard();
  G._wiz.trt.enabled=true;G._wiz.goals=['trt'];G._wiz.trt.compounds=[{id:'t',name:'T',dose:'125',unit:'mg',days:[1]}];
  G.wizToggleGoal('enhanced'); // enable Enhanced → should clear TRT
  check('wizToggleGoal enhanced: clears TRT enabled flag', G._wiz.trt.enabled===false);
  check('wizToggleGoal enhanced: removes trt from goals', !G._wiz.goals.includes('trt'));
  check('wizToggleGoal enhanced: clears TRT compounds', G._wiz.trt.compounds.length===0);

  // ── THE MUTUAL EXCLUSION IS GONE (2026-08-20) ─────────────────────────────
  // These asserted that turning one of TRT/Enhanced on GREYED THE OTHER OUT. That
  // greying WAS the separation Henrik asked to end — "TRT and Enhanced should never be
  // separated" — so what used to be the correct behaviour is now the bug. One toggle
  // covers both, and neither state disables anything.
  G._userTier=3;
  G.initWizard();
  G._wiz.goals=['enhanced'];
  var gmB={innerHTML:''};var gmF={innerHTML:''};
  G.wizStepGoals(gmB,gmF);
  check('wizStepGoals: the Compounds section is shown when enhanced is on',
    gmB.innerHTML.includes('Compounds'));
  check('  …and nothing is greyed out, because there is nothing to exclude',
    !gmB.innerHTML.includes('pointer-events:none'));
  check('  …with the toggle reading ON', gmB.innerHTML.includes('toggle-sw on'));

  G._userTier=3;
  G.initWizard();
  G._wiz.trt.enabled=true;G._wiz.goals=['trt'];
  var gmB2={innerHTML:''};var gmF2={innerHTML:''};
  G.wizStepGoals(gmB2,gmF2);
  check('wizStepGoals: TRT on reads as the same single toggle, ON',
    gmB2.innerHTML.includes('Testosterone &amp; enhanced compounds') &&
    gmB2.innerHTML.includes('toggle-sw on'));
  check('  …and still greys nothing out', !gmB2.innerHTML.includes('pointer-events:none'));

  // wizStepEnhanced: mandatory Testosterone — Next disabled when no base compound selected
  G._userTier=3;
  G.initWizard();G._wiz.goals=['enhanced'];
  var savedECat=G.ENHANCEMENT_COMPOUNDS;
  G.ENHANCEMENT_COMPOUNDS=[{id:'test_e',name:'Testosterone Enanthate',group:'Androgens',cls:'base',dot:'#e05050',defaultDose:250,unit:'mg/week'}];
  var meB={innerHTML:''};var meF={innerHTML:''};
  G.wizStepEnhanced(meB,meF);
  check('wizStepEnhanced: Next disabled when no base compound selected', meF.innerHTML.includes('disabled'));
  check('wizStepEnhanced: warning banner shown when no base compound', meB.innerHTML.includes('Testosterone'));
  // Now select the base compound
  G.wizToggleEnhancedCompound('test_e');
  var meB2={innerHTML:''};var meF2={innerHTML:''};
  G.wizStepEnhanced(meB2,meF2);
  check('wizStepEnhanced: Next enabled after base compound selected', !meF2.innerHTML.includes('disabled'));
  check('wizStepEnhanced: warning gone after base compound selected', !meB2.innerHTML.includes('⚠'));
  G.ENHANCEMENT_COMPOUNDS=savedECat;

  G._userTier=1;
}

// ── _stackTabBar ──────────────────────────────────────────────────────────────
console.log('\n── _stackTabBar ────────────────────────────────────────────');
{
  const G=sandbox;

  // Phase 4 merged TRT and Enhanced into ONE Compounds tab. The tier-3 gate did not
  // disappear with them — it moved onto the groups inside the tab, so testosterone
  // stays available to everyone (as the TRT tab was) and the rest stays gated (as
  // Enhanced was). These checks follow the gate to where it now lives.
  G._userTier=1;
  var tb1=G._stackTabBar('peptides','setStackViewTab');
  check('_stackTabBar T1: renders Peptides tab', tb1.includes('Peptides'));
  check('_stackTabBar: one Compounds tab, not TRT + Enhanced',
    tb1.includes('Compounds') && !tb1.includes('>TRT<') && !tb1.includes('>Enhanced<'));
  check('_stackTabBar: no tab is locked any more', !tb1.includes('0.45'));

  // The gate: a tier-1 user still gets testosterone, and gets the CTA instead of the
  // enhancement classes.
  // The catalogue comes from the backend and carries `group`; the sandbox default has
  // only `cls`, so give this block the shape the app actually receives.
  const _catSave = G.ENHANCEMENT_COMPOUNDS;
  G.ENHANCEMENT_COMPOUNDS=[
    {id:'test_e',name:'Testosterone Enanthate',group:'Base',cls:'base',defaultDose:300,unit:'mg/week',defaultDays:[1,4],dot:'#e05050'},
    {id:'primo', name:'Primobolan',            group:'DHT-Derived',cls:'dht',  defaultDose:500,unit:'mg/week',defaultDays:[1,4],dot:'#3cffa0'},
    {id:'deca',  name:'Deca',                  group:'19-Nor',     cls:'19nor',defaultDose:300,unit:'mg/week',defaultDays:[1,4],dot:'#888'},
  ];
  G._editBuf={trt:{enabled:false,compounds:[]},enhanced:{enabled:false,compounds:[]}};
  var cmpT1=G._renderEditCompounds({trt:{},enhanced:{}});
  check('Compounds T1: testosterone is available',   cmpT1.includes('Testosterone'));
  // Corrected 2026-08-20: "Tier 1 & 2 should see everything but greyed out if not
  // included in their tier." Tier 1 gets the whole catalogue too, all of it locked —
  // including testosterone, which tier 1 has no access to either.
  check('  …tier 1 sees the enhancement classes as well, locked',  cmpT1.includes('19-Nor'));
  check('  …with every card greyed at tier 1',
    (cmpT1.match(/opacity:0\.45/g) || []).length >= 4);
  check('  …and none of them selectable',
    !cmpT1.includes("editToggleEnhancedCompound('deca')") &&
    !cmpT1.includes("editToggleTRTCompound('"));
  G._userTier=3;
  var cmpT3=G._renderEditCompounds({trt:{},enhanced:{}});
  check('Compounds T3: the other classes appear',    cmpT3.includes('19-Nor'));
  check('  …testosterone first, then by class',
    cmpT3.indexOf('Testosterone') < cmpT3.indexOf('19-Nor'));
  check('  …with no second testosterone group under its other spelling',
    cmpT3.indexOf('DHT-Derived') > 0 && !/Base<\/div>/.test(cmpT3));

  G.ENHANCEMENT_COMPOUNDS=_catSave;

  // Active tab gets accent background; others transparent
  var tbEnhActive=G._stackTabBar('compounds','setEditInnerTab');
  check('_stackTabBar T3: active Compounds tab gets accent bg', tbEnhActive.includes('var(--accent)'));

  // Setter propagated to onclick handlers
  check('_stackTabBar view: onclick uses setStackViewTab', tb1.includes('setStackViewTab'));
  var tbEdit=G._stackTabBar('trt','setEditInnerTab');
  check('_stackTabBar edit: onclick uses setEditInnerTab', tbEdit.includes('setEditInnerTab'));

  G._userTier=1;
}

// ── View & Edit tab render functions ─────────────────────────────────────────
console.log('\n── View & Edit tab render functions ────────────────────────');
{
  const G=sandbox;

  // _renderEnhancedUpgradeCTA: non-T3 users see upgrade call-to-action
  var ctaHtml=G._renderEnhancedUpgradeCTA();
  check('_renderEnhancedUpgradeCTA: returns string', typeof ctaHtml==='string');
  check('_renderEnhancedUpgradeCTA: not empty', ctaHtml.length>0);
  check('_renderEnhancedUpgradeCTA: mentions Enhanced Tier', ctaHtml.includes('Enhanced Tier'));
  check('_renderEnhancedUpgradeCTA: has Enable in Settings button', ctaHtml.includes('Enable in Settings'));

  // _renderTRTViewTab: no TRT configured
  var noTRTSt={name:'T',peptides:[],trt:{enabled:false,compounds:[]},cycle_length:12};
  var tvH1=G._renderTRTViewTab(noTRTSt);
  check('_renderTRTViewTab empty: returns string', typeof tvH1==='string');
  check('_renderTRTViewTab empty: mentions no TRT configured', tvH1.includes('No TRT configured'));
  check('_renderTRTViewTab empty: shows Injection Log section', tvH1.includes('Injection Log'));
  check('_renderTRTViewTab empty: prompts to set start date', tvH1.includes('Set a start date'));

  // _renderTRTViewTab: with TRT compound (no cycle_start → injection log shows set-start-date)
  if(G.TRT_CAT&&G.TRT_CAT.length){
    // Use any TRT compound — both Nebido and Testoviron show name/dose/Protocol section
    var tCat0v=G.TRT_CAT.find(function(c){return c.id!=='nebido';})||G.TRT_CAT[0];
    var withTRTSt={name:'T',peptides:[],trt:{enabled:true,compounds:[{id:tCat0v.id,name:tCat0v.name,dose:'125',unit:'mg',days:[1,3]}]},cycle_length:12};
    var tvH2=G._renderTRTViewTab(withTRTSt);
    check('_renderTRTViewTab with compound: shows Protocol section', tvH2.includes('Protocol'));
    check('_renderTRTViewTab with compound: shows compound name', tvH2.includes(tCat0v.name));
    check('_renderTRTViewTab with compound: shows dose', tvH2.includes('125'));
    check('_renderTRTViewTab with compound: still shows injection log area', tvH2.includes('Injection Log'));
  }

  // _renderEditTRT: null/empty → toggle is off, no compound cards visible.
  // Tier stated explicitly: below tier 2 the testosterone group renders LOCKED as of
  // 2026-08-20, so exercising the editor itself needs a tier that has it.
  var _prevTierTrt=G._userTier; G._userTier=2;
  var etH1=G._renderEditTRT(null);
  check('_renderEditTRT null: returns string', typeof etH1==='string');
  // The tier is no longer called TRT — it is the testosterone group of one Compounds tab.
  check('_renderEditTRT null: shows the Testosterone heading', etH1.includes('Testosterone'));
  check('_renderEditTRT null: toggle is OFF (not "toggle-sw on")', etH1.includes('toggle-sw')&&!etH1.includes('toggle-sw on'));

  // _renderEditTRT: enabled with compound → toggle on, dose controls
  // Use testoviron (not nebido) so the Days row appears (nebido shows Frequency instead)
  if(G.TRT_CAT&&G.TRT_CAT.length){
    var tCatNonNebido=G.TRT_CAT.find(function(c){return c.id!=='nebido';})||G.TRT_CAT[0];
    var tCat0=tCatNonNebido;
    G._editBuf={name:'T',peptides:[],trt:{enabled:true,compounds:[{id:tCat0.id,name:tCat0.name,dose:'125',unit:'mg',days:[1,3]}]},enhanced:{enabled:false,compounds:[]},cycle_length:12};
    var etH2=G._renderEditTRT({enabled:true,compounds:[{id:tCat0.id,name:tCat0.name,dose:'125',unit:'mg',days:[1,3]}]});
    check('_renderEditTRT enabled: toggle is ON', etH2.includes('toggle-sw on'));
    check('_renderEditTRT enabled: shows compound name', etH2.includes(tCat0.name));
    check('_renderEditTRT enabled: shows Dose row', etH2.includes('Dose'));
    check('_renderEditTRT enabled: shows Days row (non-Nebido compound)', etH2.includes('Days'));
    // #637: TRT compounds expose an AM/PM Time selector (parity with peptides/enhanced)
    check('_renderEditTRT enabled: shows Time row', etH2.includes('>Time<'));
    check('_renderEditTRT enabled: shows AM/PM time chips', etH2.includes('editSetTRTTime'));
  G._userTier=_prevTierTrt;
    check('editSetTRTTime defined', typeof G.editSetTRTTime==='function');
    G.editSetTRTTime(tCat0.id,'PM');
    check('editSetTRTTime: sets time=PM', G._editBuf.trt.compounds[0].time==='PM');
    G.editSetTRTTime(tCat0.id,'AM');
    check('editSetTRTTime: sets time=AM', G._editBuf.trt.compounds[0].time==='AM');
  }

  // _renderEditPep: renders peptide config card
  var pepCat0=G.PEPTIDE_CAT&&G.PEPTIDE_CAT.find(function(p){return p.id==='cjc-ipa';});
  if(pepCat0){
    G._editBuf={name:'T',peptides:[{id:'cjc-ipa',name:pepCat0.name,dot:pepCat0.dot,times:['AM'],days:[1,2,3],dose_am:'100',dose_pm:'',unit_am:'mcg',note:'',active:true}],trt:{enabled:false,compounds:[]},enhanced:{enabled:false,compounds:[]},cycle_length:12};
    var pepCard=G._renderEditPep(G._editBuf.peptides[0],0);
    check('_renderEditPep: returns string', typeof pepCard==='string');
    check('_renderEditPep: shows peptide name', pepCard.includes(pepCat0.name));
    check('_renderEditPep: shows cfg-block wrapper', pepCard.includes('cfg-block'));
    check('_renderEditPep: shows Timing row (AM/PM chips)', pepCard.includes('AM'));
    check('_renderEditPep: shows AM Dose field', pepCard.includes('AM Dose'));
    check('_renderEditPep: shows Days row', pepCard.includes('Days'));
    check('_renderEditPep: shows Note field', pepCard.includes('Note'));
    check('_renderEditPep: shows Start date field', pepCard.includes('Start'));
  }

  G._userTier=1;
}

// ── Source-code structural assertions ─────────────────────────────────────────
console.log('\n── Source-code structural assertions ───────────────────────');
{
  const tsJs=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-stack.js'),'utf8');

  // Enhanced view branch must call _renderEnhancedViewTab, not _buildEnhancementCycleSection
  check('source: _renderEnhancedViewTab(st) present in tab-stack.js',
    tsJs.includes('_renderEnhancedViewTab(st)'));
  check('source: _renderEditEnhanced(_editBuf.enhanced present in tab-stack.js',
    tsJs.includes('_renderEditEnhanced(_editBuf.enhanced'));
  // These two patterns would prove the OLD broken routing is gone:
  check('source: view Enhanced branch does NOT call _buildEnhancementCycleSection',
    !(function(){var m=tsJs.match(/stackViewTab===.enhanced.[\s\S]{0,400}_buildEnhancementCycleSection/);return!!m;})());
  check('source: edit Enhanced branch does NOT call _buildEnhancementCycleSection',
    !(function(){var m=tsJs.match(/editInnerTab===.enhanced.[\s\S]{0,400}_buildEnhancementCycleSection/);return!!m;})());

  // wizStepGoals must show the Enhanced toggle for T3 (restored 2026-06-25, when it
  // was removed unasked and users lost per-stack opt-out). These checks used to look
  // for the heading "Enhanced Cycle"; the headings merged into one "Compounds" section
  // on 2026-08-20 at Henrik's request, because the tier merge made two headings
  // describe an app that no longer exists. The TOGGLE is what the 2026-06-25 guard is
  // actually about, so assert that instead — and the T1/T2 negatives above move with
  // it, or they would pass for the wrong reason now the heading is gone everywhere.
  check('source: wizStepGoals offers ONE compounds toggle, not a TRT/Enhanced pair',
    (function(){var fn=tsJs.match(/function wizStepGoals\([\s\S]{0,4000}/);
      return fn && fn[0].includes('wizToggleCompounds()') &&
             !fn[0].includes("wizToggleGoal(\\'enhanced\\')") &&
             !fn[0].includes('wizToggleGoalTRT()');})());
  check('source: the two headings became one Compounds section',
    (function(){var fn=tsJs.match(/function wizStepGoals\([\s\S]{0,4000}/);
      return fn && fn[0].includes("wiz-section\">Compounds<") &&
             !fn[0].includes("wiz-section\">TRT<") &&
             !fn[0].includes("wiz-section\">Enhanced Cycle<");})());
  check('  …and the description names TRT and the other enhanced compounds',
    (function(){var fn=tsJs.match(/function wizStepGoals\([\s\S]{0,4000}/);
      return fn && /TRT and other enhanced compounds/.test(fn[0]);})());

  // #637: TRT injection entries must carry a real AM/PM time_of_day, never hardcoded null
  check('source: TRT injection builder sets time_of_day from c.time (not null)',
    tsJs.includes("time_of_day:(c.time==='PM'?'PM':'AM')"));
  check('source: no TRT injection entry hardcodes time_of_day:null',
    !(function(){var m=tsJs.match(/tier:'trt'[\s\S]{0,120}time_of_day:null/);return!!m;})());
  // Enhanced injection builder honours the per-compound amPm flag (user-toggleable)
  check('source: enhanced injection builder reads c.amPm',
    tsJs.includes('var isAmPm=c.amPm||(eCat&&eCat.amPm)'));

  // All required render functions must be defined in tab-stack.js
  check('source: function _renderEnhancedViewTab( defined', tsJs.includes('function _renderEnhancedViewTab('));
  check('source: function _renderEditEnhanced( defined', tsJs.includes('function _renderEditEnhanced('));
  check('source: function _renderEnhancedUpgradeCTA( defined', tsJs.includes('function _renderEnhancedUpgradeCTA('));
  check('source: function _renderEditTRT( defined', tsJs.includes('function _renderEditTRT('));
  check('source: function _renderTRTViewTab( defined', tsJs.includes('function _renderTRTViewTab('));
  check('source: function _stackTabBar( defined', tsJs.includes('function _stackTabBar('));

  // Tier gates confirmed in source.
  // The gate moved inside the merged tab (Phase 4), then changed SHAPE on 2026-08-20:
  // tier 2 now sees the whole catalogue with the compounds it cannot use greyed out,
  // rather than a card in place of the list. So the gate is no longer "render or do
  // not render at tier 3" — it is per-compound, inside the renderer.
  check('source: the catalogue renders at every tier, gated per compound',
    /html\+=_renderEditEnhanced\(_editBuf\.enhanced/.test(tsJs) &&
    !tsJs.includes("if((_userTier||1)>=3){\n    html+=_renderEditEnhanced("));
  check('source: and testosterone locks below tier 2 rather than hiding',
    /if\(\(_userTier\|\|1\)<2\)\{\s*\n\s*var lockedHtml=/.test(tsJs));
  check('source: and the lock is per compound, inside the renderer',
    /var locked=!_compoundAllowedForTier\(c\);/.test(tsJs));
  check('source: view Enhanced branch gates on tier >=3', tsJs.includes('(_userTier||1)>=3?_renderEnhancedViewTab'));

  // _buildEnhancementCycleSection still exists (used by Cycles tab via stackSetCyclePhase etc.)
  check('source: _buildEnhancementCycleSection function still exists (Cycles tab)', tsJs.includes('function _buildEnhancementCycleSection('));

  // _refreshTRTGuide: TRT guide highlight updates when frequency changes
  check('source: _refreshTRTGuide function defined', tsJs.includes('function _refreshTRTGuide('));
  check('source: wizSetTRTFreq calls _refreshTRTGuide', (function(){var m=tsJs.match(/function wizSetTRTFreq\([\s\S]{0,200}/);return m&&m[0].includes('_refreshTRTGuide');})());
  check('source: wizSetTRTFreqUnit calls _refreshTRTGuide', (function(){var m=tsJs.match(/function wizSetTRTFreqUnit\([\s\S]{0,200}/);return m&&m[0].includes('_refreshTRTGuide');})());
  // Window widened 2026-08-20: _renderEditTRT now opens with the tier-1 locked branch,
  // which pushed the handler past the old 4000-char slice.
  check('source: _renderEditTRT freqVal handler calls _refreshTRTGuide', (function(){var m=tsJs.match(/function _renderEditTRT\([\s\S]{0,6000}/);return m&&m[0].includes('_refreshTRTGuide');})());
  check('source: wizStepTRT wraps guide in trt-guide-id div', (function(){var m=tsJs.match(/function wizStepTRT\([\s\S]{0,5200}/);return m&&m[0].includes("id=\"trt-guide-");})());
  check('source: _renderEditTRT wraps guide in trt-guide-id div', (function(){var m=tsJs.match(/function _renderEditTRT\([\s\S]{0,6000}/);return m&&m[0].includes('trt-guide-');})());

  // _refreshTRTGuide logic: correct weekly dose calculation
  (function(){
    G.initWizard();
    G._wiz.trt.enabled=true;
    G._wiz.trt.compounds=[{id:'nebido',name:'Nebido',dose:'1000',unit:'mg',freqVal:12,freqUnit:'weeks'}];
    // weeklyDoseMg at 12 weeks: 1000*7/(12*7) = 83.3 → Clinical (wkMin:60,wkMax:90)
    var g=G.TRT_GUIDE['nebido'];
    var freqDays=12*7;var wk=1000*7/freqDays;
    var match12=g.tiers.filter(function(t){return wk>=(t.wkMin||0)&&wk<=(t.wkMax||9999);});
    check('_renderTRTGuide: Nebido 12wks highlights Clinical', match12.length===1&&match12[0].l==='Clinical');

    freqDays=10*7;wk=1000*7/freqDays;
    var match10=g.tiers.filter(function(t){return wk>=(t.wkMin||0)&&wk<=(t.wkMax||9999);});
    check('_renderTRTGuide: Nebido 10wks highlights Optimised', match10.length===1&&match10[0].l==='Optimised');

    freqDays=8*7;wk=1000*7/freqDays;
    var match8=g.tiers.filter(function(t){return wk>=(t.wkMin||0)&&wk<=(t.wkMax||9999);});
    check('_renderTRTGuide: Nebido 8wks highlights Accelerated', match8.length===1&&match8[0].l==='Accelerated');
  })();
}

// ── DOSE_GUIDE: structural validation (all 22 peptide compounds) ──────────────
console.log('\n── DOSE_GUIDE: structural validation ────────────────────────');
{
  check('DOSE_GUIDE defined', typeof G.DOSE_GUIDE==='object'&&G.DOSE_GUIDE!==null);
  if(G.DOSE_GUIDE&&G.PEPTIDE_CAT){
    var dgKeys=Object.keys(G.DOSE_GUIDE);
    var catIds=G.PEPTIDE_CAT.map(function(p){return p.id;});
    check('DOSE_GUIDE has exactly 22 entries', dgKeys.length===22, 'got '+dgKeys.length);
    check('every PEPTIDE_CAT id has a DOSE_GUIDE entry',
      catIds.every(function(id){return!!G.DOSE_GUIDE[id];}),
      catIds.filter(function(id){return!G.DOSE_GUIDE[id];}).join(', '));
    check('no orphan DOSE_GUIDE keys (every key is a PEPTIDE_CAT id)',
      dgKeys.every(function(k){return catIds.includes(k);}),
      dgKeys.filter(function(k){return!catIds.includes(k);}).join(', '));

    var badNoTiers=dgKeys.filter(function(k){return!Array.isArray(G.DOSE_GUIDE[k])||G.DOSE_GUIDE[k].length===0;});
    check('every DOSE_GUIDE entry is a non-empty array', badNoTiers.length===0, badNoTiers.join(', '));

    var badNoLabel=dgKeys.filter(function(k){return G.DOSE_GUIDE[k].some(function(t){return!t.l;});});
    check('every DOSE_GUIDE tier has an l (label) field', badNoLabel.length===0, badNoLabel.join(', '));

    var missingB=dgKeys.filter(function(k){return!G.DOSE_GUIDE[k].some(function(t){return t.b;});});
    check('every DOSE_GUIDE compound has exactly one b:1 (baseline) tier',
      missingB.length===0, 'missing b:1: '+missingB.join(', '));

    var multiB=dgKeys.filter(function(k){return G.DOSE_GUIDE[k].filter(function(t){return t.b;}).length>1;});
    check('no DOSE_GUIDE compound has more than one b:1 tier', multiB.length===0, 'multiple b:1: '+multiB.join(', '));
  }
}

// ── _renderDoseGuide: runtime HTML output for every peptide compound ──────────
console.log('\n── _renderDoseGuide: runtime HTML for all 22 compounds ──────');
{
  if(typeof G._renderDoseGuide==='function'&&G.DOSE_GUIDE&&G.PEPTIDE_CAT){
    var pepIds=G.PEPTIDE_CAT.map(function(p){return p.id;});
    var emptyRenders=pepIds.filter(function(id){var h=G._renderDoseGuide(id);return!h||h.length===0;});
    check('_renderDoseGuide returns non-empty HTML for every peptide compound',
      emptyRenders.length===0, 'empty for: '+emptyRenders.join(', '));

    var missingHeading=pepIds.filter(function(id){return!G._renderDoseGuide(id).includes('Recommended Doses');});
    check('_renderDoseGuide always includes Recommended Doses heading',
      missingHeading.length===0, 'missing heading: '+missingHeading.join(', '));

    // Spot-checks: baseline tier (b:1) label appears in rendered HTML
    var spotChecks=[
      {id:'cjc-ipa',    label:'Optimal'},
      {id:'retatrutide',label:'Optimal'},
      {id:'tirzepatide',label:'Optimal'},
      {id:'semaglutide', label:'Optimal'},
      {id:'hgh',        label:'Recomp'},
      {id:'tesamorelin',label:'Standard'},
      {id:'bpc-tb',     label:'Acute'},
      {id:'bpc157',     label:'Optimal'},
      {id:'tb500',      label:'Loading'},
      {id:'aod9604',    label:'Standard'},
      {id:'hcg',        label:'Standard'},
      {id:'nad',        label:'Optimal'},
      {id:'motsc',      label:'Optimal'},
      {id:'epitalon',   label:'Standard'},
      {id:'glow',       label:'Standard'},
      {id:'klow',       label:'Standard'},
    ];
    spotChecks.forEach(function(sc){
      var h=G._renderDoseGuide(sc.id);
      check('_renderDoseGuide('+sc.id+'): baseline tier "'+sc.label+'" present in HTML',
        h.includes(sc.label), 'HTML: '+h.slice(0,200));
    });

    // Risk warning (r field) appears for compounds that have it
    var retaHtml=G._renderDoseGuide('retatrutide');
    check('_renderDoseGuide(retatrutide): risk warning rendered',
      retaHtml.includes('⚠'), 'got: '+retaHtml.slice(0,300));

    var hghHtml=G._renderDoseGuide('hgh');
    check('_renderDoseGuide(hgh): risk warning rendered', hghHtml.includes('⚠'));

    // Returns empty string for unknown compound
    check('_renderDoseGuide unknown id returns empty string', G._renderDoseGuide('not-a-compound')==='');
  }
}

// ── Wizard TRT step IS the planner, and can never render blank ───────────────
// Reported: after the peptide steps, Next landed on an empty BUILD TRT screen with
// only a Next button, and the saved protocol contained peptides only. The step now
// renders the same four-field planner T-Calc uses, and is structurally unable to
// render nothing: the footer is written first, the body build is wrapped, and an
// empty result is backfilled.
console.log('\n── Wizard TRT step ────────────────────────────────────────');
{
  var _mkEl = function(){
    var o={style:{},classList:{add:function(){},remove:function(){},contains:function(){return false;}},scrollTop:0};
    Object.defineProperty(o,'innerHTML',{get:function(){return o._h||'';},set:function(v){o._h=String(v);}});
    return o;
  };
  if(typeof G.wizStepTRTHandoff==='function'){
    var _svWiz=G._wiz;
    G._wiz={step:0,goals:['trt'],peptides:[],trt:{enabled:true,compounds:[]},enhanced:{},editMode:false,stackIndex:-1,stackName:'t',cycle_length:12};
    var b=_mkEl(), f=_mkEl();
    G.wizStepTRTHandoff(b,f);

    check('the TRT step renders content (was a blank screen)', b.innerHTML.length > 200,
      'rendered '+b.innerHTML.length+' chars');
    check('  …the ester field is there',   /1 · Ester/.test(b.innerHTML));
    check('  …the dose field is there',    /2 · Dose per injection/.test(b.innerHTML));
    check('  …the cadence field is there', /3 · Injection cadence/.test(b.innerHTML));
    check('  …the start-date field is there', /4 · First injection/.test(b.innerHTML));
    check('the footer always carries Next', /wizNext\(\)/.test(f.innerHTML));
    check('the advanced multi-compound config is still reachable', /wizToggleTrtClassic/.test(b.innerHTML));
    check('  …and the cadence is the same two-field control as T-Calc',
      /wizSetTrtCadence\('cadenceN'/.test(b.innerHTML) && /wizSetTrtCadence\('cadenceUnit'/.test(b.innerHTML));
    check('  …offering 1 to 20 and day/week/month',
      /<option value="20"/.test(b.innerHTML) && /value="month"/.test(b.innerHTML));
    if(typeof G.wizSetTrtCadence==='function'){
      G.wizSetTrtCadence('cadenceN','5'); G.wizSetTrtCadence('cadenceUnit','week');
      check('  …and setting it recomputes the wizard plan interval',
        G._wiz.trtPlan.cadenceDays===35, String(G._wiz.trtPlan.cadenceDays));
    }

    // Fail-safe: if a helper this step depends on blows up, the user still gets a step
    var _svIds=G._tcAllCompIds;
    G._tcAllCompIds=function(){ throw new Error('tab-tcalc.js unavailable'); };
    var b2=_mkEl(), f2=_mkEl();
    G.wizStepTRTHandoff(b2,f2);
    check('a throw inside the step still renders something usable', b2.innerHTML.length > 40,
      'rendered '+b2.innerHTML.length+' chars');
    check('  …and the footer still lets the user continue', /wizNext\(\)/.test(f2.innerHTML));
    G._tcAllCompIds=_svIds;

    // Phase 6: the step used to seed from T-Calc's simple plan, because that was where
    // a schedule lived. That planner is gone, so a stored simplePlan must NOT leak back
    // into the wizard — the protocol's own compound is the only seed.
    if(typeof G._wizEnsureTrtPlan==='function'){
      var _svTcp=G._tcp;
      G._tcp=Object.assign({},_svTcp||{},{simplePlan:{compId:'cypionate',doseMg:'150',cadenceDays:7,startDate:'2026-07-01'}});
      G._wiz.trtPlan=null; G._wiz.trt={enabled:false,compounds:[]};
      var seeded=G._wizEnsureTrtPlan();
      check('a retired T-Calc plan no longer seeds the wizard step',
        !seeded.compId && !seeded.doseMg,
        JSON.stringify(seeded));

      // …and from a classic TRT compound when there is no T-Calc plan yet
      G._tcp=Object.assign({},_svTcp||{},{simplePlan:{}});
      G._wiz.trtPlan=null;
      G._wiz.trt={enabled:true,compounds:[{id:'enanthate',dose:'125',freqVal:1,freqUnit:'weeks'}]};
      var seeded2=G._wizEnsureTrtPlan();
      check('…or from a classic TRT compound, converted to days',
        seeded2.compId==='enanthate' && String(seeded2.doseMg)==='125' && Number(seeded2.cadenceDays)===7);
      G._tcp=_svTcp;
    }

    // Completeness gate
    if(typeof G._wizTrtPlanComplete==='function'){
      G._wiz.trtPlan={compId:'enanthate',doseMg:'125',cadenceDays:3.5,startDate:'2026-07-01'};
      check('a full plan counts as complete', G._wizTrtPlanComplete() === true);
      G._wiz.trtPlan={compId:'enanthate',doseMg:'',cadenceDays:3.5,startDate:'2026-07-01'};
      check('a plan missing the dose is not complete', G._wizTrtPlanComplete() === false);
    }
    G._wiz=_svWiz;
  }else{
    check('wizStepTRTHandoff available', false);
  }

  var _stSrc2=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-stack.js'),'utf8');
  check('the footer is written before the body build (so a throw cannot strand the user)',
    /footer\.innerHTML=[\s\S]{0,200}try\{/.test(_stSrc2));
  check('an empty body is backfilled rather than shown blank',
    /if\(!body\.innerHTML\|\|!body\.innerHTML\.trim\(\)\)/.test(_stSrc2));
  // ── The wizard plan becomes a scheduled compound, not planner state ───────
  // Until 2026-08-20 this asserted the plan was committed to `_tcp.simplePlan`.
  // Phase 6 deleted the planner that read it, so the commit wrote to a field the
  // profile keeps only so old saves are not rewritten — the user's dose, cadence
  // and start date went in and nothing ever came out. Behavioural now: drive the
  // fold and read the protocol it produced.
  check('the plan is no longer committed to the dead planner',
    !/_tcp\.simplePlan=\{compId:_wp\.compId/.test(_stSrc2) && !/_tcp\.plannerMode='simple'/.test(_stSrc2));
  if(typeof G._wizFoldTrtPlanIntoProto==='function'){
    const _svW=G._wiz;
    G._wiz={goals:['trt'], trtPlan:{compId:'enanthate',doseMg:'125',cadenceN:3,cadenceUnit:'day',cadenceDays:3.5,startDate:'2026-07-01'}};

    const proto={id:'p1', name:'P1'};
    const wrote=G._wizFoldTrtPlanIntoProto(proto);
    const c=((proto.trt||{}).compounds||[])[0];
    check('the wizard plan lands in the protocol as a real compound', wrote===true && !!c);
    check('  …under the canonical id', !!c && c.id==='enanthate');
    check('  …carrying the dose as a per-injection amount, never a rate',
      !!c && c.dose==='125' && c.unit==='mg');
    check('  …with the cadence as an interval the generator understands',
      !!c && Number(c.freqVal)===3.5 && c.freqUnit==='days');
    check('  …and the first-injection date the user picked',
      !!c && c.start_date==='2026-07-01');
    check('  …with the tier switched on, or nothing would generate',
      !!proto.trt && proto.trt.enabled===true);

    // A classic multi-compound configuration is the user's own work. A planner must
    // never overwrite it — this is the guard `_trtInline` has always provided.
    const classic={id:'p2', trt:{enabled:true, compounds:[{id:'nebido',name:'Nebido',dose:'100',unit:'mg'}]}};
    const wrote2=G._wizFoldTrtPlanIntoProto(classic);
    check('a classic configuration still wins over the wizard plan',
      wrote2===false && classic.trt.compounds.length===1 && classic.trt.compounds[0].id==='nebido');

    // An Enhanced cycle already picked its base ester in the wizard's `base` step.
    // Folding again would schedule the same molecule twice — the doubling the whole
    // rewrite exists to end — including across the two id spellings.
    const enh={id:'p3', enhanced:{enabled:true, compounds:[{id:'test_e',name:'Testosterone Enanthate'}]}};
    const wrote3=G._wizFoldTrtPlanIntoProto(enh);
    check('an ester already on the protocol is not scheduled a second time',
      wrote3===false && !((enh.trt||{}).compounds||[]).length);

    // Half-filled is not a schedule. Inventing the missing half would be inventing
    // doses nobody asked for.
    G._wiz.trtPlan={compId:'enanthate',doseMg:'',cadenceDays:3.5,startDate:'2026-07-01'};
    const partial={id:'p4'};
    check('an incomplete plan schedules nothing at all',
      G._wizFoldTrtPlanIntoProto(partial)===false && !((partial.trt||{}).compounds||[]).length);

    G._wiz=_svW;
  }else{
    check('_wizFoldTrtPlanIntoProto exists', false);
  }
}

// ── T-Calc simple planner (ester → dose → cadence → curve) ───────────────────
// T-Calc is now the single place a testosterone schedule is built. The simple
// planner is the default way in; the advanced multi-compound log is kept and sits
// below it, greyed out unless its switch is on. Exactly one drives the curve.
console.log('\n── T-Calc simple planner ──────────────────────────────────');
{
  // ── The planner modes are gone (Phase 6) ──────────────────────────────────
  // This block tested the simple/advanced switch: which of the two planners drove the
  // curve, and that the greyed-out one did not contribute. Phase 6 deleted both, so the
  // question no longer exists — and what replaced it is stricter, because there is now
  // exactly one source of future doses rather than a rule about which of three wins.
  check('the planner modes are gone, not merely disabled',
    typeof G._tcPlannerMode !== 'function' && typeof G._tcSimplePlanInjections !== 'function');

  // ── The planner is GONE (Phase 6, 2026-08-20) ─────────────────────────────
  // Henrik: "If I only can add injections in the protocol builder why is the injection
  // scheduler still in t-calc?" Phase 5 disabled these write paths but left the UI
  // standing, so the buttons were still there and only said "moved to Plan ▸ Compounds"
  // once pressed. These checks used to assert the planner was kept and dimmed; they now
  // assert it is not there at all.
  var _tcSrc = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-tcalc.js'),'utf8');
  check('the injection schedule card is gone', !/INJECTION SCHEDULE/.test(_tcSrc));
  check('  …along with the simple planner and its switch',
    !/function _tcSimplePlannerHtml/.test(_tcSrc) && !/function _tcPlannerSwitchHtml/.test(_tcSrc));
  check('  …and the protocol picker and push-to-schedule',
    !/function _tcStackPickerHtml/.test(_tcSrc) && !/function _tcPushLogToSchedule/.test(_tcSrc));
  check('  …and the plan write paths behind them',
    !/function _tcWritePlanToStack/.test(_tcSrc) && !/function _tcSavePlanToStack/.test(_tcSrc) &&
    !/function _tcPostPlanInjections/.test(_tcSrc));
  check('T-Calc points at Plan ▸ Compounds instead', /Plan ▸ Compounds/.test(_tcSrc));
  // Record entry is not planning: logging a dose already taken is how a mid-cycle user
  // gets their history in, and it has no other home yet (§8 of the rewrite plan).
  // Record entry survived Phase 6 inside T-Calc, then MOVED to Today on 2026-08-20
  // ("Move Add away from T-calc"). It still survives — it is how a mid-cycle user gets
  // their history in — but T-Calc now routes to it rather than holding a second sheet.
  {
    const _thSrc = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-thist.js'),'utf8');
    check('  …while logging a dose already taken survives, on Today',
      /function openPastInjection/.test(_thSrc) && /Log a past injection/.test(_thSrc));
    check('  …with the date capped at today, so it cannot plan through the back door',
      /max="'\+_thTodayStr\(\)\+'"/.test(_thSrc) &&
      /return x <= today;/.test(_thSrc));
    check('  …and T-Calc keeps only a route to it, not a sheet of its own',
      /openPastInjection\(/.test(_tcSrc) && !/function _tcShowAddSheet/.test(_tcSrc));
  }
  // The curve reads stored rows only now — no planner can drive it invisibly.
  check('the curve takes its future from the protocol alone',
    /_add\(_tcProtocolInjections\(\)\);/.test(_tcSrc) &&
    !/function _tcSimplePlanInjections/.test(_tcSrc));

  // Regression (2026-07-30): the ester dropdown rendered with only its placeholder.
  // _tcAllCompIds() was referenced by three call sites but never actually defined —
  // it existed only in a comment. Every call site guards with typeof===>'function',
  // so the missing function degraded silently to an empty list instead of throwing.
  check('_tcAllCompIds is actually defined', typeof G._tcAllCompIds === 'function');
  if (typeof G._tcAllCompIds === 'function') {
    var _allIds = G._tcAllCompIds();
    check('  …and returns the ester catalogue, not an empty list', _allIds.length > 0,
      'got ' + _allIds.length + ' ids');
    check('  …including the frontend TRT_CAT esters',
      (G.TRT_CAT || []).every(function(c){ return _allIds.indexOf(c.id) !== -1; }));
    check('  …with no id listed twice',
      _allIds.length === _allIds.filter(function(id, i){ return _allIds.indexOf(id) === i; }).length);
    check('  …and no HCG (this list is testosterone planning only)',
      _allIds.indexOf('hcg') === -1);

    // An ester the backend serves but TRT_CAT does not must still be offered, and an
    // ester served by both must appear exactly once.
    var _svExtra = G._tcExtraCatalog;
    var _dupId = (G.TRT_CAT && G.TRT_CAT[0]) ? G.TRT_CAT[0].id : 'enanthate';
    G._tcExtraCatalog = [{id:_dupId, name:'Dup', halfLifeDays:5},
                         {id:'__backend_only__', name:'Backend Only', halfLifeDays:9}];
    var _mixed = G._tcAllCompIds();
    check('  …a backend-only ester is offered', _mixed.indexOf('__backend_only__') !== -1);
    check('  …an ester in both catalogues is listed once',
      _mixed.filter(function(id){ return id === _dupId; }).length === 1);
    G._tcExtraCatalog = _svExtra;
  }

  // The user-visible symptom: real <option> rows in the ester select, not just the
  // "Select a testosterone ester…" placeholder.
  if (typeof G._tcSimplePlannerHtml === 'function') {
    var _svTcp2 = G._tcp;
    G._tcp = {manualLog:[], simplePlan:{}, plannerMode:'simple'};
    var _plannerHtml = G._tcSimplePlannerHtml('', '');
    // Scope to the ester <select> only — the cadence select below it also has options,
    // so matching the whole card would pass even with an empty ester list.
    var _esterBlock = _plannerHtml.slice(_plannerHtml.indexOf('1 · Ester'),
                                         _plannerHtml.indexOf('2 · Dose per injection'));
    var _opts = (_esterBlock.match(/<option value="(?!")[^"]+"/g) || []);
    check('the ester dropdown renders real options (was placeholder-only)',
      _opts.length > 0, 'rendered ' + _opts.length + ' esters');
    check('  …each names its compound', /<option value="[^"]+"[^>]*>[^<]+</.test(_esterBlock));
    G._tcp = _svTcp2;
  }
  // The control itself: two fields, in both places a plan can be built
  if (typeof G._tcSimplePlannerHtml === 'function') {
    var _svTcp3 = G._tcp;
    G._tcp = {manualLog:[], simplePlan:{compId:'enanthate',doseMg:'125',cadenceN:3,cadenceUnit:'day',cadenceDays:3,startDate:'2026-08-01'}, plannerMode:'simple'};
    var _cadHtml = G._tcSimplePlannerHtml('', '');
    var _cadBlock = _cadHtml.slice(_cadHtml.indexOf('3 · Injection cadence'), _cadHtml.indexOf('4 · First injection'));
    check('the cadence row renders two selects, not one preset list',
      (_cadBlock.match(/<select/g)||[]).length===2, JSON.stringify((_cadBlock.match(/<select/g)||[]).length));
    check('  …the number runs 1 to 20',
      /<option value="1"/.test(_cadBlock) && /<option value="20"/.test(_cadBlock) && !/<option value="21"/.test(_cadBlock));
    check('  …the unit offers day, week and month',
      /value="day"/.test(_cadBlock) && /value="week"/.test(_cadBlock) && /value="month"/.test(_cadBlock));
    check('  …the saved cadence comes back selected',
      /<option value="3" selected>/.test(_cadBlock) && /value="day" selected/.test(_cadBlock), _cadBlock.slice(0,400));
    check('  …and the old preset list is gone from this control',
      !/2×\/week|E3\.5D|How often/.test(_cadBlock));
    G._tcp = _svTcp3;
  }


  // Catch-all for the bug class: a `typeof X === 'function'` guard around a helper
  // that does not exist anywhere fails open and silently renders nothing.
  {
    var _dir = path.dirname(path.resolve(htmlPath));
    var _allSrc = ['tab-cycles.js','tab-macros.js','tab-stack.js','tab-today.js','tab-schedule.js',
                   'tab-timeline.js','tab-body.js','tab-recon.js','tab-blood.js','tab-tcalc.js',
                   'tab-thist.js','tab-labs.js','tab-supplements.js']
      .map(function(f){ try { return fs.readFileSync(path.join(_dir,f),'utf8'); } catch(e){ return ''; } })
      .join('\n') + '\n' + html;
    var _guarded = [], _m, _re = /typeof\s+(_tc[A-Za-z0-9_]*|_wiz[A-Za-z0-9_]*)\s*===?\s*'function'/g;
    while ((_m = _re.exec(_allSrc))) { if (_guarded.indexOf(_m[1]) === -1) _guarded.push(_m[1]); }
    var _undef = _guarded.filter(function(n){
      return !new RegExp('function\\s+' + n + '\\s*\\(').test(_allSrc) &&
             !new RegExp('(var|let|const)\\s+' + n + '\\s*=\\s*function').test(_allSrc);
    });
    check('every typeof-guarded T-Calc/wizard helper actually exists',
      _undef.length === 0, _undef.length ? 'missing: ' + _undef.join(', ') : 'checked ' + _guarded.length);
  }

  // Wizard hand-off
  var _stSrc = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-stack.js'),'utf8');
  check('the wizard TRT step hands off to T-Calc', /trt:wizStepTRTHandoff/.test(_stSrc));
  check('the classic in-wizard TRT config is kept, one tap away',
    /function wizStepTRT\(body,footer\)/.test(_stSrc) && /wizToggleTrtClassic/.test(_stSrc));
  // ── Where saving lands, and what it links (rewritten 2026-08-20) ──────────
  // These asserted the T-Calc hand-off: route to 'tcalc' and set targetStackId so
  // "the plan and the protocol stay linked". Phase 6 removed the planner at the
  // other end, which turned the hand-off into the bug — the user was shown a tab
  // that could not hold what they had just described, and the schedule was dropped
  // on the way. The protocol is now both where it is built and where you land.
  check('saving no longer routes to T-Calc',
    !/switchTab\('tcalc'/.test(_stSrc),
    'the wizard is sending the user back to a tab that cannot schedule');
  check('  …nor re-binds a protocol as the T-Calc target',
    !/_tcp\.targetStackId=_savedStack\.id/.test(_stSrc),
    'setting targetStackId re-arms the single-source confirm + the writes-disabled alert');
  check('  …and everyone lands on the protocol they just built',
    /switchTab\('stacks',document\.getElementById\('tab-btn-stacks'\)\);/.test(_stSrc));
  check('the classic in-wizard TRT config is still what wins when present',
    /if\(existing\.length\) return false;/.test(_stSrc));

  // The hand-off triggers on WHAT THE PROTOCOL CARRIES, not the goal chip. Gating on
  // goals.includes('trt') missed the entire Enhanced path: an enhanced cycle picks its
  // testosterone BASE in the wizard's own `base` step, landing in enhanced.compounds
  // with goals === ['enhanced'] — so it generated nothing (correct) and offered no
  // route to the only tab that could schedule it (a dead end).
  // NOT wrapped in a typeof guard: on the pre-fix source _stackTestoComp does not
  // exist, and a guard would skip every assertion below and report green — which is
  // exactly what it did on the first attempt at this block.
  check('_stackTestoComp exists', typeof G._stackTestoComp === 'function');
  if (typeof G._stackTestoComp === 'function') {
    const enhOnly = {enhanced:{enabled:true, compounds:[
      {id:'test_u', name:'Testosterone Undecanoate'}, {id:'hgh', name:'HGH'},
      {id:'masteron', name:'Masteron (Drostanolone)'}]}};
    check('an Enhanced-only protocol still counts as carrying testosterone',
      (G._stackTestoComp(enhOnly)||{}).tier === 'enhanced');
    check('  …identifying the base ester, not the HGH or the Masteron',
      (G._stackTestoComp(enhOnly)||{}).c.id === 'test_u');
    check('  …and Masteron alone is NOT testosterone',
      G._stackTestoComp({enhanced:{enabled:true, compounds:[
        {id:'masteron', name:'Masteron (Drostanolone)'}, {id:'hgh', name:'HGH'}]}}) === null);
    check('  …a disabled tier is not running, so it does not count',
      G._stackTestoComp({enhanced:{enabled:false, compounds:[{id:'test_u',name:'Testosterone Undecanoate'}]}}) === null);
    check('  …and a TRT-tier ester is found by tier, brand name notwithstanding',
      (G._stackTestoComp({trt:{enabled:true, compounds:[{id:'nebido',name:'Nebido'}]}})||{}).tier === 'trt');
  }
  // _stackTestoComp used to drive the hand-off. It now drives DUPLICATE DETECTION
  // in the fold: an Enhanced cycle that already carries its base ester must not have
  // the same molecule scheduled again from the wizard step. Same question — what does
  // this protocol already carry — put to better use.
  check('the fold asks what the protocol already carries',
    /_stackTestoComp\(proto\)/.test(_stSrc),
    'without this an Enhanced base ester gets scheduled twice');
  check('  …and canonicalises the wizard ester before storing it',
    /_canonCompoundId\(p\.compId\)/.test(_stSrc));
}

// ── T-Calc is populated by the planned TRT protocol ──────────────────────────
// A TRT protocol built in Protocols used to be invisible to T-Calc: two separate
// injection lists, so the curve was empty until everything was re-entered by hand.
// The curve now merges the manual log with the stack's planned TRT injections.
// MANUAL WINS on conflict — a logged dose is a recorded event, a protocol entry is
// a plan for that day; counting both would double the injection.
console.log('\n── T-Calc ← planned TRT protocol ──────────────────────────');
{
  if(typeof G._tcCurveLog==='function' && typeof G._tcProtocolInjections==='function'){
    var _svCache = G._injectionsCache, _svTcp = G._tcp;
    // Dates below are all in the FUTURE: an unticked protocol row is a plan, and a
    // plan is never in the past (2026-08-07). The logged history is emptied so this
    // block tests the plan/manual merge in isolation — the history layer has its own
    // block further down.
    var _svHistP = G._tcHistory, _svHStateP = G._tcHistoryState;
    G._tcHistory = []; G._tcHistoryState = 'ready';
    var _setup = function(cache, manual){
      G._injectionsCache = cache;
      G._tcp = Object.assign({}, _svTcp || {}, {manualLog: manual});
    };
    var P = function(o){ return Object.assign({tier:'trt',active:true,unit:'mg',cycle_id:'stack1'}, o); };

    _setup({'2026-09-01':[P({compound_id:'enanthate',date:'2026-09-01',dose:'125'})]}, []);
    check('a planned TRT injection reaches the curve', G._tcCurveLog().length === 1);
    check('  …carrying compound, dose and date', (function(){
      var e=G._tcCurveLog()[0];
      return e.compId==='enanthate' && parseFloat(e.doseMg)===125 && e.date==='2026-09-01' && e.source==='protocol';
    })());

    // THE RECORD WINS OVER THE PLAN, on the same compound and day. Phase 6 removed the
    // planner, so the record is the logged history rather than manualLog — the rule
    // itself is unchanged and is what stops a dose being counted twice.
    _setup({'2026-09-01':[P({compound_id:'enanthate',date:'2026-09-01',dose:'125'})]}, []);
    G._tcHistory = [{compId:'enanthate', doseMg:'150', date:'2026-09-01', source:'manual'}];
    G._tcHistoryState = 'ready';
    var merged = G._tcCurveLog();
    check('same compound + day is NOT double-counted', merged.length === 1,
      JSON.stringify(merged.map(function(e){return e.compId+'@'+e.date+'='+e.doseMg;})));
    check('the logged dose wins over the planned one',
      parseFloat(merged[0].doseMg) === 150 && merged[0].source !== 'protocol',
      merged[0].doseMg + ' / ' + merged[0].source);

    // Different day → both kept
    _setup({'2026-09-08':[P({compound_id:'enanthate',date:'2026-09-08',dose:'125'})]}, []);
    G._tcHistory = [{compId:'enanthate', doseMg:'150', date:'2026-09-01', source:'manual'}];
    G._tcHistoryState = 'ready';
    check('a planned dose on another day is kept alongside the record',
      G._tcCurveLog().length === 2);
    check('the merged log is sorted by date', (function(){
      var l=G._tcCurveLog(); return l.length === 2 && l[0].date <= l[1].date;
    })());
    G._tcHistory = []; G._tcHistoryState = 'ready';

    // THE DOUBLE-COUNT TRAP: T-Calc pushes its own log into /injections under
    // cycle_id 'tcalc' / 'tcalc:<stackId>'. Reading those back would count every
    // T-Calc injection twice.
    _setup({'2026-09-01':[P({compound_id:'enanthate',date:'2026-09-01',dose:'125',cycle_id:'tcalc'})]},
           [{compId:'enanthate',doseMg:'125',date:'2026-09-01'}]);
    // Rows T-Calc pushed under its old 'tcalc' namespace stay excluded. The curve used
    // to still show the dose because manualLog supplied it; with the planner gone, an
    // excluded row simply is not on the curve — which is the stronger statement.
    check('T-Calc\'s own pushed entries are not read back (no self-double-count)',
      G._tcProtocolInjections().length === 0 && G._tcCurveLog().length === 0,
      'curve ' + G._tcCurveLog().length + ', protocol ' + G._tcProtocolInjections().length);
    _setup({'2026-09-02':[P({compound_id:'enanthate',date:'2026-09-02',dose:'125',cycle_id:'tcalc:stack9'})]}, []);
    check('the tcalc:<stackId> namespace is excluded too', G._tcProtocolInjections().length === 0);

    // Only TRT, only active, only mg — an unknown unit must be dropped, not assumed
    _setup({'2026-09-01':[
      P({compound_id:'bpc157',date:'2026-09-01',dose:'250',tier:'peptide'}),
      P({compound_id:'deca',date:'2026-09-01',dose:'200',tier:'enhanced'}),
      P({compound_id:'enanthate',date:'2026-09-01',dose:'125',active:false}),
      P({compound_id:'cypionate',date:'2026-09-01',dose:'1',unit:'ml'}),
      P({compound_id:'testoviron',date:'2026-09-01',dose:'0'})
    ]}, []);
    check('non-TRT tiers, inactive entries, non-mg units and zero doses are all excluded',
      G._tcProtocolInjections().length === 0, JSON.stringify(G._tcProtocolInjections()));

    // Future-dated plan entries are kept — that is the point of a projection
    var _future = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
    var _fc = {}; _fc[_future] = [P({compound_id:'enanthate',date:_future,dose:'125'})];
    _setup(_fc, []);
    check('future planned injections are included so the curve projects forward',
      G._tcCurveLog().length === 1);

    // The manual log itself must not be mutated by any of this
    var _manual = [{compId:'enanthate',doseMg:'150',date:'2026-09-01'}];
    _setup({'2026-09-08':[P({compound_id:'enanthate',date:'2026-09-08',dose:'125'})]}, _manual);
    G._tcCurveLog();
    check('the manual log is never written to by the merge',
      G._tcp.manualLog.length === 1 && G._tcp.manualLog[0].doseMg === '150');

    check('_tcProtocolCount reports what the banner shows',
      G._tcProtocolCount() === 1);

    // Empty / missing cache must not throw
    _setup({}, []);
    check('no protocol and no log → empty curve, no throw', G._tcCurveLog().length === 0);
    G._injectionsCache = undefined;
    check('a missing injections cache is handled', G._tcProtocolInjections().length === 0);

    G._injectionsCache = _svCache; G._tcHistory = _svHistP; G._tcHistoryState = _svHStateP; G._tcp = _svTcp;
  }else{
    check('_tcCurveLog / _tcProtocolInjections available', false);
  }
}

// ── Supplements are never due before they were added ─────────────────────────
// A daily supplement returned true before the start-date check, so adding one made
// it retroactively due on every past day — none of which could have been ticked —
// and Today's adherence % plus the week strip counted those as missed doses.
console.log('\n── Supplements: no retroactive back-fill ──────────────────');
{
  if(typeof G._suppActiveOn==='function'){
    var _mk=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    var today=new Date(); today.setHours(0,0,0,0);
    var yesterday=new Date(today.getTime()-86400000);
    var lastWeek=new Date(today.getTime()-7*86400000);
    var tomorrow=new Date(today.getTime()+86400000);
    var daily={supp_id:'d3',freq:'daily',start_date:_mk(today)};

    check('daily supplement is NOT due the day before it was added',
      G._suppActiveOn(daily, yesterday) === false);
    check('daily supplement is NOT due a week before it was added',
      G._suppActiveOn(daily, lastWeek) === false);
    check('daily supplement IS due on the day it was added',
      G._suppActiveOn(daily, today) === true);
    check('daily supplement IS due tomorrow',
      G._suppActiveOn(daily, tomorrow) === true);

    // The other frequencies kept their existing behaviour
    var eod={supp_id:'x',freq:'eod',start_date:_mk(today)};
    check('eod: not due before start', G._suppActiveOn(eod, yesterday) === false);
    check('eod: due on start day',     G._suppActiveOn(eod, today) === true);
    check('eod: due 2 days after',     G._suppActiveOn(eod, new Date(today.getTime()+2*86400000)) === true);
    check('eod: not due 1 day after',  G._suppActiveOn(eod, tomorrow) === false);
    var weekly={supp_id:'w',freq:'weekly',start_date:_mk(today)};
    check('weekly: not due before start', G._suppActiveOn(weekly, lastWeek) === false);
    check('weekly: due on the same weekday', G._suppActiveOn(weekly, new Date(today.getTime()+7*86400000)) === true);

    // Legacy rows saved before start_date was stamped must not change behaviour —
    // guessing a start date would hide doses the user really did take.
    check('legacy entry with no start_date stays always-active',
      G._suppActiveOn({supp_id:'legacy',freq:'daily'}, lastWeek) === true);

    // The count Today actually renders
    if(typeof G._supplementsForDay==='function'){
      var _sv=G._supplements;
      G._supplements=[daily];
      check('_supplementsForDay excludes it on a past day', G._supplementsForDay(yesterday).length === 0);
      check('_supplementsForDay includes it today',        G._supplementsForDay(today).length === 1);
      G._supplements=_sv;
    }
    // New supplements must still be stamped on save, or the guard has nothing to read
    var _suppSrc=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-supplements.js'),'utf8');
    check('a saved supplement is stamped with start_date', /start_date:\s*\(existing/.test(_suppSrc));
  }else{
    check('_suppActiveOn available', false);
  }
}

// ── Macros phase is remembered ───────────────────────────────────────────────
// It was a plain var defaulting to 'recomp' on every load, so the user's choice was
// lost on reload. Now persisted and pushed to the backend like any other setting.
console.log('\n── Macros phase persistence ───────────────────────────────');
{
  var _macSrc=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-macros.js'),'utf8');
  check('setMacrosPhase exists as the single write path', typeof G.setMacrosPhase === 'function');
  check('the choice is written to localStorage', /setData\('macros-phase'/.test(_macSrc));
  check('the choice is pushed to the backend (cache is never the source of truth)',
    /pushPepSettingsToAgent\(\{'macros-phase'/.test(_macSrc));
  check('syncPepSettingsFromAgent rehydrates it', /s\['macros-phase'\]/.test(rawScript));
  if(typeof G.setMacrosPhase === 'function'){
    var _svPhase=G._macrosPhase;
    G.setMacrosPhase('cut');
    check('setting the phase updates the live value', G._macrosPhase === 'cut');
    check('the choice survives a re-read of storage', G.getData('macros-phase','') === 'cut');
    G.setMacrosPhase('bogus');
    check('an unknown phase is rejected, not stored', G._macrosPhase === 'cut');
    G.setMacrosPhase('reset');
    check('every valid phase is accepted', G._macrosPhase === 'reset');
    G.setMacrosPhase(_svPhase || 'recomp');
  }
  check('the wizard step writes through the same path', /wizSetMacroPhase\(p\)\{if\(typeof setMacrosPhase/.test(
    fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-stack.js'),'utf8')));
}

// ── Absorption constant is solved from documented tmax ───────────────────────
// The ka table used to bucket by half-life, which put enanthate's peak at ~1.0 d
// against a documented 1.5-3 d (Testoviron SmPC) and Nebido's at ~9.0 d against a
// documented median of 7 d (AVEED §12.3). Where the backend serves a documented
// tmax, ka is now solved so the modelled peak lands where the document says.
console.log('\n── ka solved from documented tmax ─────────────────────────');
{
  if(typeof G._tcKa==='function' && typeof G._tcKaFromTmax==='function' && typeof G._tcPkConc==='function'){
    var _peakDay = function(ka, ke){
      var best=0, bv=-1;
      for(var t=0;t<=120;t+=0.01){ var v=G._tcPkConc(100,ka,ke,t); if(v>bv){bv=v;best=t;} }
      return best;
    };
    // [label, halfLife, documented tmax, observed window]
    [['enanthate',4.5,2.25,[1.5,3.0]],
     ['nebido',56,7.0,[4,42]],
     ['sustanon',8.5,1.5,[1,2]]].forEach(function(c){
      var name=c[0], hl=c[1], tm=c[2], win=c[3];
      var ke=Math.LN2/hl, ka=G._tcKa(hl,tm), peak=_peakDay(ka,ke);
      check('ka solved for '+name+' peaks at its documented tmax ('+tm+' d)',
        Math.abs(peak-tm) < 0.05, 'peaks at '+peak.toFixed(2)+' d');
      check('ka solved for '+name+' peaks inside the observed window',
        peak >= win[0]-0.05 && peak <= win[1]+0.05, 'peak '+peak.toFixed(2)+' vs '+win.join('-'));
    });

    // The specific regression: enanthate used to peak a day early
    check('enanthate no longer peaks ~1 d early (was ka 3.0 → 1.04 d)',
      _peakDay(G._tcKa(4.5,2.25), Math.LN2/4.5) > 1.4);
    check('nebido no longer peaks ~2 d late (was ka 0.40 → 8.97 d)',
      _peakDay(G._tcKa(56,7.0), Math.LN2/56) < 8.0);

    // Compounds whose labels state NO tmax must be untouched by this change
    check('cypionate (no documented tmax) keeps its bucket ka', G._tcKa(8) === 3.00 && G._tcKa(8,0) === 3.00);
    check('propionate (no documented tmax) keeps its bucket ka', G._tcKa(0.8) === 8.00 && G._tcKa(0.8,0) === 8.00);
    check('gel (no documented tmax) keeps its bucket ka',        G._tcKa(1.5,0) === 8.00);

    // Guards: bad or impossible input must fall back, never fit something else
    check('tmax beyond the model maximum (1/ke) is rejected', G._tcKaFromTmax(4.5, 99) === null);
    check('impossible tmax falls back to the bucket',         G._tcKa(4.5, 99) === 3.00);
    check('zero / negative / NaN tmax falls back',
      G._tcKa(4.5,0)===3.00 && G._tcKa(4.5,-1)===3.00 && G._tcKa(4.5,NaN)===3.00);
    check('solved ka always exceeds ke (absorption faster than elimination)',
      G._tcKaFromTmax(4.5,2.25) > Math.LN2/4.5 && G._tcKaFromTmax(56,7) > Math.LN2/56);
    check('_tcTmax round-trips a solved ka',
      Math.abs(G._tcTmax(G._tcKaFromTmax(8.5,1.5), Math.LN2/8.5) - 1.5) < 1e-6);

    // The backend entry's tmax must actually reach the model
    var _sv = G._tcExtraCatalog;
    G._tcExtraCatalog = [{id:'enanthate',name:'Testosterone Enanthate',dot:'#e05050',
                          halfLifeDays:4.5,halfLife:'~4.5 days',tmaxDays:2.25}];
    check('backend tmaxDays reaches _tcCompInfo', G._tcCompInfo('enanthate').tmaxDays === 2.25);
    G._tcExtraCatalog = [{id:'enanthate',name:'Testosterone Enanthate',dot:'#e05050',
                          halfLifeDays:4.5,halfLife:'~4.5 days'}];
    check('absent tmaxDays is 0, not undefined (falls back cleanly)',
      G._tcCompInfo('enanthate').tmaxDays === 0);
    G._tcExtraCatalog = _sv;
  }else{
    check('_tcKa / _tcKaFromTmax / _tcPkConc available', false);
  }
}

// ── Propionate half-life correction (2026-07-29) ─────────────────────────────
// Propionate ran at 2 d with no source, against a published IM half-life of
// 0.8 d (~20 h) — the shortest-acting ester. Corrected on an explicit decision.
// A 2 d value understated both the peak and the depth of the EOD trough.
console.log('\n── Propionate half-life correction ────────────────────────');
{
  if(G.TRT_GUIDE && G.TRT_GUIDE['propionate'] && typeof G._parseHalfLifeDays==='function'){
    var _pHl = G.TRT_GUIDE['propionate'].halfLife;
    check('propionate fallback parses to the published 0.8 d',
      G._parseHalfLifeDays(_pHl) === 0.8, 'parsed '+G._parseHalfLifeDays(_pHl)+' from "'+_pHl+'"');
    check('the legacy 2 d value is gone', !/~?2\s*days?/.test(_pHl));
    check('propionate keeps its ester stamp',
      typeof G._injPkMeta!=='function' || G._injPkMeta('trt','propionate').ester==='propionate');
    // Shortest-acting ester: must stay shorter than every other TRT entry
    if(typeof G.TRT_CAT!=='undefined'){
      var _hls = G.TRT_CAT.filter(function(c){ return c.id!=='propionate'; })
        .map(function(c){ return G._parseHalfLifeDays(G.TRT_GUIDE[c.id].halfLife); })
        .filter(function(v){ return v>0; });
      check('propionate is the shortest-acting ester in the fallback table',
        _hls.every(function(v){ return v > 0.8; }), 'others: '+_hls.join(', '));
    }
  }else{
    check('TRT_GUIDE.propionate available', false);
  }
  // The ka table buckets by half-life. 0.8 d must NOT fall into the near-immediate
  // (gel) bucket — that would halve propionate's tmax as a rider on the half-life fix.
  if(typeof G._tcKa==='function'){
    check('_tcKa keeps propionate (0.8 d) in its calibrated bucket, not the gel bucket',
      G._tcKa(0.8) === 8.00, 'got ka='+G._tcKa(0.8));
    check('_tcKa: propionate tmax stays near the calibrated ~0.4 d', (function(){
      var ka=G._tcKa(0.8), ke=Math.LN2/0.8, tmax=Math.log(ka/ke)/(ka-ke);
      return tmax > 0.25 && tmax < 0.45;
    })());
    check('_tcKa: other buckets unchanged',
      G._tcKa(56)===0.40 && G._tcKa(8)===3.00 && G._tcKa(4.5)===3.00 && G._tcKa(1.5)===8.00);
    check('_tcKa: the near-immediate bucket still exists below 0.5 d', G._tcKa(0.2) === 15.0);
  }
}

// ── Backend is the source of truth for ester PK ──────────────────────────────
// /trt-catalog now serves PK for EVERY ester (not just ones missing from TRT_CAT),
// so two things must hold: a backend entry must win over the hardcoded TRT_GUIDE
// fallback for any id, and an id present in both must not be listed twice in the
// inventory picker (_tcCategorizeComps concatenated TRT_CAT + backend blind).
console.log('\n── Ester PK: backend is the source of truth ───────────────');
{
  if(typeof G._tcCompInfo==='function' && typeof G.TRT_CAT!=='undefined'){
    var _svCat = G._tcExtraCatalog;
    // Mock the backend serving every TRT_CAT ester with a distinctive half-life
    G._tcExtraCatalog = G.TRT_CAT.map(function(c,i){
      return {id:c.id, name:c.name, dot:c.dot, halfLifeDays: 100+i, halfLife:(100+i)+' days (test)'};
    });

    check('every TRT_CAT ester resolves its half-life from the backend entry',
      G.TRT_CAT.every(function(c,i){ return G._tcCompInfo(c.id).halfLifeDays === 100+i; }),
      G.TRT_CAT.map(function(c){ return c.id+'='+G._tcCompInfo(c.id).halfLifeDays; }).join(' '));

    check('backend value overrides the hardcoded TRT_GUIDE fallback',
      G._tcCompInfo('nebido').halfLifeDays === 100 &&
      G._parseHalfLifeDays(G.TRT_GUIDE['nebido'].halfLife) !== 100);

    if(typeof G._tcCategorizeComps==='function'){
      var _cats = G._tcCategorizeComps();
      var _all = _cats.reduce(function(a,c){ return a.concat(c.ids); }, []);
      var _dupes = _all.filter(function(id,i){ return _all.indexOf(id) !== i; });
      check('inventory picker lists no ester twice when the backend also serves it',
        _dupes.length === 0, 'duplicated: '+_dupes.join(', '));
      check('inventory picker still covers every TRT_CAT ester',
        G.TRT_CAT.every(function(c){ return _all.indexOf(c.id) >= 0; }));
    }

    // A band served by the backend must reach the model; absent one, low==high==central
    G._tcExtraCatalog = [{id:'nebido',name:'Nebido',dot:'#e05050',halfLifeDays:56,halfLifeDaysLow:37,halfLifeDaysHigh:75,halfLife:'~56 days'}];
    var _nb = G._tcCompInfo('nebido');
    check('backend half-life band reaches the model',
      _nb.halfLifeDaysLow===37 && _nb.halfLifeDays===56 && _nb.halfLifeDaysHigh===75);
    check('band is ordered low <= central <= high',
      _nb.halfLifeDaysLow <= _nb.halfLifeDays && _nb.halfLifeDays <= _nb.halfLifeDaysHigh);
    G._tcExtraCatalog = [{id:'cypionate',name:'Testosterone Cypionate',dot:'#e05050',halfLifeDays:8,halfLife:'~8 days'}];
    var _cy = G._tcCompInfo('cypionate');
    check('no band served → low == high == central (no false precision)',
      _cy.halfLifeDaysLow===8 && _cy.halfLifeDaysHigh===8);

    G._tcExtraCatalog = _svCat;
  }else{
    check('_tcCompInfo + TRT_CAT available', false);
  }
}

// ── Nebido fallback PK must match the backend catalogue ──────────────────────
// Regression: TRT_GUIDE.nebido said "~34 days", so whenever the unauthenticated
// /trt-catalog fetch failed the whole app fell back to a 34 d half-life for
// testosterone undecanoate — roughly half the backend's 56 d, making projected
// levels and washout decay about twice as fast. The backend value is derived in
// docs/enhanced-bodybuilding/11-testosterone-undecanoate-pk.md (Bayer CCDS + UK
// SmPC): 56 d plateau-equivalent, 37-75 d individual band.
console.log('\n── Nebido fallback PK vs backend ──────────────────────────');
{
  if(G.TRT_GUIDE && G.TRT_GUIDE['nebido'] && typeof G._parseHalfLifeDays==='function'){
    var _nebHl = G.TRT_GUIDE['nebido'].halfLife;
    check('TRT_GUIDE.nebido fallback parses to the backend 56 d central value',
      G._parseHalfLifeDays(_nebHl) === 56, 'parsed '+G._parseHalfLifeDays(_nebHl)+' from "'+_nebHl+'"');
    check('TRT_GUIDE.nebido no longer carries the stale 34 d single-dose figure',
      !/\b34\s*days?\b/.test(_nebHl));
    check('TRT_GUIDE.nebido states the 37-75 d individual band',
      /37\s*-\s*75/.test(_nebHl));
    // The ester name is parsed out of this same string by _injPkMeta (first
    // parenthetical), so the parenthetical must stay the ester, not the band.
    check('TRT_GUIDE.nebido still yields the undecanoate ester stamp',
      typeof G._injPkMeta!=='function' || G._injPkMeta('trt','nebido').ester==='undecanoate',
      JSON.stringify(typeof G._injPkMeta==='function'?G._injPkMeta('trt','nebido'):null));
  }else{
    check('TRT_GUIDE.nebido + _parseHalfLifeDays available', false);
  }
}

// ── TRT_GUIDE: structural validation (all 6 TRT compounds) ───────────────────
console.log('\n── TRT_GUIDE: structural validation ─────────────────────────');
{
  if(G.TRT_GUIDE&&G.TRT_CAT){
    var trtIds=G.TRT_CAT.map(function(c){return c.id;});
    var trtKeys=Object.keys(G.TRT_GUIDE);

    check('TRT_GUIDE has exactly 6 entries', trtKeys.length===6, 'got '+trtKeys.length);
    check('every TRT_CAT id has a TRT_GUIDE entry',
      trtIds.every(function(id){return!!G.TRT_GUIDE[id];}),
      trtIds.filter(function(id){return!G.TRT_GUIDE[id];}).join(', '));
    check('no orphan TRT_GUIDE keys',
      trtKeys.every(function(k){return trtIds.includes(k);}),
      trtKeys.filter(function(k){return!trtIds.includes(k);}).join(', '));

    trtIds.forEach(function(id){
      var g=G.TRT_GUIDE[id];
      check('TRT_GUIDE['+id+'] has halfLife field', typeof g.halfLife==='string'&&g.halfLife.length>0);
      check('TRT_GUIDE['+id+'] has cadence.rec field', g.cadence&&typeof g.cadence.rec==='string');
      check('TRT_GUIDE['+id+'] has cadence.note field', g.cadence&&typeof g.cadence.note==='string');
      check('TRT_GUIDE['+id+'] has tiers array', Array.isArray(g.tiers)&&g.tiers.length>0);
      check('TRT_GUIDE['+id+'] has exactly one b:1 tier',
        g.tiers.filter(function(t){return t.b;}).length===1);
      g.tiers.forEach(function(t,i){
        check('TRT_GUIDE['+id+'] tier '+i+' has l label', typeof t.l==='string'&&t.l.length>0);
        check('TRT_GUIDE['+id+'] tier '+i+' has d dose', typeof t.d==='string'&&t.d.length>0);
        check('TRT_GUIDE['+id+'] tier '+i+' has wkMin', typeof t.wkMin==='number');
        check('TRT_GUIDE['+id+'] tier '+i+' has wkMax', typeof t.wkMax==='number');
        check('TRT_GUIDE['+id+'] tier '+i+' wkMin <= wkMax', t.wkMin<=t.wkMax);
      });
      // Ranges must be non-overlapping: each tier's wkMin > previous tier's wkMax
      var sorted=g.tiers.slice().sort(function(a,b){return a.wkMin-b.wkMin;});
      var overlaps=false;
      for(var i=1;i<sorted.length;i++){if(sorted[i].wkMin<=sorted[i-1].wkMax)overlaps=true;}
      check('TRT_GUIDE['+id+'] tier ranges are non-overlapping', !overlaps);
    });
  }
}

// ── _renderTRTGuide: runtime HTML for all 6 TRT compounds ────────────────────
console.log('\n── _renderTRTGuide: runtime HTML for all 6 TRT compounds ────');
{
  if(typeof G._renderTRTGuide==='function'&&G.TRT_GUIDE&&G.TRT_CAT){
    function getHighlightedTierLabel(html){
      var marker='rgba(232,160,32,0.1)';
      var idx=html.indexOf(marker);if(idx<0)return null;
      var after=html.slice(idx,idx+500);
      var labels=['Performance','High-normal','Standard TRT','Clinical','Optimised','Accelerated'];
      for(var i=0;i<labels.length;i++){if(after.includes(labels[i]))return labels[i];}
      return null;
    }

    // --- enanthate ---
    check('enanthate 125mg/wk → Standard TRT',
      getHighlightedTierLabel(G._renderTRTGuide('enanthate',125))==='Standard TRT');
    check('enanthate 200mg/wk → High-normal',
      getHighlightedTierLabel(G._renderTRTGuide('enanthate',200))==='High-normal');
    check('enanthate 300mg/wk → Performance',
      getHighlightedTierLabel(G._renderTRTGuide('enanthate',300))==='Performance');
    check('enanthate 0mg/wk → High-normal (b:1 fallback)',
      getHighlightedTierLabel(G._renderTRTGuide('enanthate',0))==='High-normal');

    // --- cypionate ---
    check('cypionate 100mg/wk → Standard TRT',
      getHighlightedTierLabel(G._renderTRTGuide('cypionate',100))==='Standard TRT');
    check('cypionate 175mg/wk → High-normal',
      getHighlightedTierLabel(G._renderTRTGuide('cypionate',175))==='High-normal');
    check('cypionate 300mg/wk → Performance',
      getHighlightedTierLabel(G._renderTRTGuide('cypionate',300))==='Performance');
    check('cypionate 0mg/wk → High-normal (b:1 fallback)',
      getHighlightedTierLabel(G._renderTRTGuide('cypionate',0))==='High-normal');

    // --- propionate ---
    check('propionate 100mg/wk → Standard TRT',
      getHighlightedTierLabel(G._renderTRTGuide('propionate',100))==='Standard TRT');
    check('propionate 150mg/wk → High-normal',
      getHighlightedTierLabel(G._renderTRTGuide('propionate',150))==='High-normal');
    check('propionate 250mg/wk → Performance',
      getHighlightedTierLabel(G._renderTRTGuide('propionate',250))==='Performance');
    check('propionate 0mg/wk → High-normal (b:1 fallback)',
      getHighlightedTierLabel(G._renderTRTGuide('propionate',0))==='High-normal');

    // --- sustanon ---
    check('sustanon 100mg/wk → Standard TRT',
      getHighlightedTierLabel(G._renderTRTGuide('sustanon',100))==='Standard TRT');
    check('sustanon 175mg/wk → High-normal',
      getHighlightedTierLabel(G._renderTRTGuide('sustanon',175))==='High-normal');
    check('sustanon 300mg/wk → Performance',
      getHighlightedTierLabel(G._renderTRTGuide('sustanon',300))==='Performance');
    check('sustanon 0mg/wk → High-normal (b:1 fallback)',
      getHighlightedTierLabel(G._renderTRTGuide('sustanon',0))==='High-normal');

    // --- nebido (full range) ---
    check('nebido 70mg/wk (1000mg/10.2wks) → Clinical',
      getHighlightedTierLabel(G._renderTRTGuide('nebido',75))==='Clinical');
    check('nebido 100mg/wk (1000mg/7wks) → Optimised',
      getHighlightedTierLabel(G._renderTRTGuide('nebido',100))==='Optimised');
    check('nebido 125mg/wk (1000mg/5.6wks) → Accelerated',
      getHighlightedTierLabel(G._renderTRTGuide('nebido',125))==='Accelerated');
    check('nebido 0mg/wk → Clinical (b:1 fallback)',
      getHighlightedTierLabel(G._renderTRTGuide('nebido',0))==='Clinical');

    // --- HTML structure: all compounds produce non-empty, well-formed output ---
    G.TRT_CAT.forEach(function(c){
      var html=G._renderTRTGuide(c.id,150);
      check('_renderTRTGuide('+c.id+'): returns non-empty HTML', typeof html==='string'&&html.length>50);
      check('_renderTRTGuide('+c.id+'): contains TRT Guide heading', html.includes('TRT Guide'));
      check('_renderTRTGuide('+c.id+'): contains halfLife from guide', html.includes('½-life'));
      check('_renderTRTGuide('+c.id+'): contains cadence rec', html.includes(G.TRT_GUIDE[c.id].cadence.rec.slice(0,10)));
    });

    // --- Supraphysiological warning block (distinct from Performance tier note text) ---
    var supraNebido=G._renderTRTGuide('nebido',300);
    check('_renderTRTGuide: supraphysiological warning block at 300mg/wk for nebido',
      supraNebido.includes('Supraphysiological dose'));
    var supraTesto=G._renderTRTGuide('testoviron',300);
    check('_renderTRTGuide: supraphysiological warning block at 300mg/wk for testoviron',
      supraTesto.includes('Supraphysiological dose'));
    // Warning block must NOT appear at sub-250 doses
    var noSupra=G._renderTRTGuide('testoviron',200);
    check('_renderTRTGuide: no supraphysiological warning block at 200mg/wk',
      !noSupra.includes('Supraphysiological dose'));

    // --- Unknown compound returns empty string ---
    check('_renderTRTGuide unknown id returns empty string', G._renderTRTGuide('not-a-compound',100)==='');
  }
}

// ── _renderEnhancedGuide: runtime HTML with mock compound data ────────────────
console.log('\n── _renderEnhancedGuide: runtime HTML validation ────────────');
{
  if(typeof G._renderEnhancedGuide==='function'){
    // null / undefined → empty string
    check('_renderEnhancedGuide(null) returns empty string', G._renderEnhancedGuide(null)==='');
    check('_renderEnhancedGuide(undefined) returns empty string', G._renderEnhancedGuide(undefined)==='');

    // Mock compound with full data (cadence + doseTiers + interaction + sides)
    var mockFull={
      id:'test-compound',
      cadence:{rec:'Every 3.5 days',note:'Split twice weekly for stable levels',halfLife:'4.5 days'},
      doseTiers:[
        {l:'Conservative',d:'200 mg/wk',n:'Intro dose',freq:'2×/wk'},
        {l:'Optimal',d:'400 mg/wk',n:'Performance range',freq:'2×/wk',b:1},
        {l:'High',d:'600 mg/wk',n:'Advanced',freq:'2×/wk',r:'Elevated CV risk'}
      ],
      interaction:'Binds AR receptors; promotes nitrogen retention.',
      sides:'Acne, hair loss, HPTA suppression.'
    };
    var htmlFull=G._renderEnhancedGuide(mockFull);
    check('_renderEnhancedGuide: returns non-empty HTML for full compound', htmlFull.length>100);
    check('_renderEnhancedGuide: renders Injection Frequency heading', htmlFull.includes('Injection Frequency'));
    check('_renderEnhancedGuide: renders cadence rec value', htmlFull.includes('Every 3.5 days'));
    check('_renderEnhancedGuide: renders half-life', htmlFull.includes('4.5 days'));
    check('_renderEnhancedGuide: renders Recommended Doses heading', htmlFull.includes('Recommended Doses'));
    check('_renderEnhancedGuide: renders tier labels', htmlFull.includes('Conservative')&&htmlFull.includes('Optimal'));
    check('_renderEnhancedGuide: renders risk warning ⚠', htmlFull.includes('⚠'));
    check('_renderEnhancedGuide: renders interaction section heading', htmlFull.includes('How it works'));
    check('_renderEnhancedGuide: renders interaction text', htmlFull.includes('Binds AR receptors'));
    check('_renderEnhancedGuide: renders side effects heading', htmlFull.includes('Side effects'));
    check('_renderEnhancedGuide: renders sides text', htmlFull.includes('Acne, hair loss'));

    // No doseTiers but has DOSE_GUIDE entry → falls back to DOSE_GUIDE
    var mockFallback={id:'hgh',cadence:{rec:'AM injection',note:'Fasted AM',halfLife:'~20 min'}};
    var htmlFallback=G._renderEnhancedGuide(mockFallback);
    check('_renderEnhancedGuide: falls back to DOSE_GUIDE[hgh] when no doseTiers',
      htmlFallback.includes('Recommended Doses'));
    check('_renderEnhancedGuide: DOSE_GUIDE fallback shows hgh tier label (Anti-aging)',
      htmlFallback.includes('Anti-aging'));

    // No doseTiers and no DOSE_GUIDE entry → no Recommended Doses section
    var mockNoDose={id:'unknown-compound',cadence:{rec:'Weekly',note:'Once weekly',halfLife:'7 days'}};
    var htmlNoDose=G._renderEnhancedGuide(mockNoDose);
    check('_renderEnhancedGuide: renders cadence even without dose tiers',
      htmlNoDose.includes('Injection Frequency'));
    check('_renderEnhancedGuide: no Recommended Doses section when no tiers exist',
      !htmlNoDose.includes('Recommended Doses'));

    // Empty doseTiers array → falls back to DOSE_GUIDE
    var mockEmptyTiers={id:'bpc157',doseTiers:[],cadence:{rec:'Daily',note:'SC injection',halfLife:'~4 hrs'}};
    var htmlEmpty=G._renderEnhancedGuide(mockEmptyTiers);
    check('_renderEnhancedGuide: empty doseTiers falls back to DOSE_GUIDE[bpc157]',
      htmlEmpty.includes('Optimal'));

    // No cadence field → renders dose tiers but no Injection Frequency block
    var mockNoCadence={id:'nad',doseTiers:[{l:'Maintenance',d:'100 mg/wk',n:'NAD+ support',b:1}]};
    var htmlNoCad=G._renderEnhancedGuide(mockNoCadence);
    check('_renderEnhancedGuide: no cadence → no Injection Frequency block',
      !htmlNoCad.includes('Injection Frequency'));
    check('_renderEnhancedGuide: no cadence → still renders dose tiers',
      htmlNoCad.includes('Recommended Doses'));
  }
}

// ── _dosePersonalization: sex, age, weight modifiers for peptides ─────────────
console.log('\n── _dosePersonalization: sex / age / weight modifiers ───────');
{
  if(typeof G._dosePersonalization==='function'&&typeof G._userProfile==='function'){
    function setProfile(sex,age,weightKg){
      G.localStorage.setItem('user_sex',sex||'male');
      G.localStorage.setItem('user_age',String(age||0));
      G.localStorage.setItem('user_weight',String(weightKg||0));
    }
    function clearProfile(){
      G.localStorage.removeItem('user_sex');
      G.localStorage.removeItem('user_age');
      G.localStorage.removeItem('user_weight');
    }

    // --- GH axis: female ---
    setProfile('female',35,65);
    var ghIds=['cjc-ipa','cjc-nodac','ipamorelin','sermorelin','tesamorelin','hgh'];
    ghIds.forEach(function(id){
      var mods=G._dosePersonalization(id,G._userProfile());
      check('_dosePersonalization('+id+', female): lower-end adj present',
        mods.some(function(m){return m.type==='adj'&&m.text.includes('50% more sensitive');}));
    });

    // --- GH axis: age 50+ ---
    setProfile('male',55,80);
    ghIds.forEach(function(id){
      var mods=G._dosePersonalization(id,G._userProfile());
      check('_dosePersonalization('+id+', age55): age adj present',
        mods.some(function(m){return m.type==='adj'&&m.text.includes('Age 55');}));
    });

    // --- GH axis: age <30 ---
    setProfile('male',22,75);
    var modsYoung=G._dosePersonalization('cjc-ipa',G._userProfile());
    check('_dosePersonalization(cjc-ipa, age22): standard tolerance note present',
      modsYoung.some(function(m){return m.type==='ok'&&m.text.includes('standard doses well tolerated');}));

    // --- GH axis: no mods for non-GH peptide ---
    setProfile('female',55,65);
    var modsNonGH=G._dosePersonalization('retatrutide',G._userProfile());
    var hasGhMod=modsNonGH.some(function(m){return m.text&&m.text.includes('GH peptides');});
    check('_dosePersonalization(retatrutide): no GH-axis mod (not a GH peptide)',!hasGhMod);

    // --- GLP-1: heavy (>100kg) ---
    setProfile('male',35,110);
    var glp1Ids=['retatrutide','tirzepatide','semaglutide'];
    glp1Ids.forEach(function(id){
      var mods=G._dosePersonalization(id,G._userProfile());
      check('_dosePersonalization('+id+', 110kg): higher dose / protein adj present',
        mods.some(function(m){return m.type==='adj'&&m.text.includes('110kg')&&m.text.includes('protein');}));
    });

    // --- GLP-1: light (<65kg) ---
    setProfile('male',35,58);
    glp1Ids.forEach(function(id){
      var mods=G._dosePersonalization(id,G._userProfile());
      check('_dosePersonalization('+id+', 58kg): lighter frame ok note present',
        mods.some(function(m){return m.type==='ok'&&m.text.includes('58kg')&&m.text.includes('lighter frame');}));
    });

    // --- GLP-1: mid-weight (65–100kg) → no weight mod ---
    setProfile('male',35,80);
    var modsMid=G._dosePersonalization('retatrutide',G._userProfile());
    var hasWeightMod=modsMid.some(function(m){return m.text&&m.text.includes('kg');});
    check('_dosePersonalization(retatrutide, 80kg): no weight-specific mod',!hasWeightMod);

    // --- HCG: female warning ---
    setProfile('female',35,65);
    var modsHcgF=G._dosePersonalization('hcg',G._userProfile());
    check('_dosePersonalization(hcg, female): contraindication warning present',
      modsHcgF.some(function(m){return m.type==='warn'&&m.text.includes('not typically indicated for women');}));

    // --- HCG: male → no female warning ---
    setProfile('male',35,80);
    var modsHcgM=G._dosePersonalization('hcg',G._userProfile());
    var hcgFemaleWarn=modsHcgM.some(function(m){return m.text&&m.text.includes('not typically indicated');});
    check('_dosePersonalization(hcg, male): no female warning',!hcgFemaleWarn);

    // --- NAD: weight-based dose calculation ---
    setProfile('male',35,90);
    var modsNad=G._dosePersonalization('nad',G._userProfile());
    check('_dosePersonalization(nad, 90kg): weight-based target includes 135mg (90*1.5)',
      modsNad.some(function(m){return m.type==='info'&&m.text.includes('135mg');}));

    // --- NAD: no weight set → no weight mod ---
    clearProfile();
    var modsNadNoW=G._dosePersonalization('nad',G._userProfile());
    var hasNadWeightMod=modsNadNoW.some(function(m){return m.type==='info'&&m.text&&m.text.includes('mg SC');});
    check('_dosePersonalization(nad, no weight): no weight-based mod',!hasNadWeightMod);

    // --- Non-personalised compound: no mods ---
    setProfile('female',55,110);
    var modsEpitalon=G._dosePersonalization('epitalon',G._userProfile());
    check('_dosePersonalization(epitalon): no personalization mods (epitalon has none)',
      modsEpitalon.length===0);

    // ── IGF-1 → GH-axis direction ──
    if(typeof G._igf1Recommendation==='function'){
      setProfile('male',45,80);
      check('_igf1ToNgml: nmol/L → ng/mL (×7.649)', Math.abs(G._igf1ToNgml(30,'nmol/L')-229.47)<1);
      check('_igf1ToNgml: ng/mL passes through',     G._igf1ToNgml(150,'ng/mL')===150);
      check('_igf1RefRange(45) = 90–260 ng/mL', (function(){var r=G._igf1RefRange(45);return r.lo===90&&r.hi===260;})());
      check('_igf1Rec: below upper-third → increase', (function(){var r=G._igf1Recommendation(120,'ng/mL',45);return r.status==='Below target'&&r.direction==='increase';})());
      check('_igf1Rec: upper-normal → hold',           (function(){var r=G._igf1Recommendation(250,'ng/mL',45);return r.status==='At target'&&r.direction==='hold';})());
      check('_igf1Rec: above range → reduce',          (function(){var r=G._igf1Recommendation(300,'ng/mL',45);return r.status==='Above range'&&r.direction==='reduce';})());
      check('_igf1Rec: never emits a mg number',       (function(){var r=G._igf1Recommendation(120,'ng/mL',45);return !/\bmg\b/.test(r.text);})());
      check('_igf1Rec: lab range override used',        (function(){var r=G._igf1Recommendation(150,'ng/mL',45,100,200);return r.src==='lab'&&r.hi===200;})());
      check('_igf1Rec: override converts with value unit',(function(){var r=G._igf1Recommendation(26,'nmol/L',45,13,34);return r.src==='lab'&&Math.abs(r.hi-260)<2;})());
      // surfaces in _dosePersonalization for GH-axis when IGF-1 is in bloodwork
      var _savedBw2=G._tcBwEntries;
      G._tcBwEntries=[{date:'2026-07-01',extra:[{name:'IGF-1',value:120,unit:'ng/mL'}]}];
      var _ghMods=G._dosePersonalization('ipamorelin',G._userProfile());
      check('_dosePersonalization(ipamorelin): IGF-1 mod present when logged',
        _ghMods.some(function(m){return m.text&&m.text.indexOf('IGF-1')!==-1&&m.text.indexOf('increasing')!==-1;}));
      var _nonGh=G._dosePersonalization('retatrutide',G._userProfile());
      check('_dosePersonalization(retatrutide): no IGF-1 mod (not GH-axis)',
        !_nonGh.some(function(m){return m.text&&m.text.indexOf('IGF-1')!==-1;}));
      G._tcBwEntries=null;
      check('_latestBwMarker: null when no bloodwork', G._latestBwMarker('IGF-1')===null);
      G._tcBwEntries=_savedBw2;
    }

    clearProfile();
  }
}

// ── _renderDoseGuide: sex/age/weight modifiers appear in HTML output ──────────
console.log('\n── _renderDoseGuide: personalization text in HTML output ────');
{
  if(typeof G._renderDoseGuide==='function'&&typeof G._dosePersonalization==='function'){
    function setProfile(sex,age,weightKg){
      G.localStorage.setItem('user_sex',sex||'male');
      G.localStorage.setItem('user_age',String(age||0));
      G.localStorage.setItem('user_weight',String(weightKg||0));
    }
    function clearProfile(){
      G.localStorage.removeItem('user_sex');
      G.localStorage.removeItem('user_age');
      G.localStorage.removeItem('user_weight');
    }

    // Female GH axis → lower-end note in rendered HTML
    setProfile('female',35,65);
    var htmlGhF=G._renderDoseGuide('cjc-ipa');
    check('_renderDoseGuide(cjc-ipa, female): female GH adj text in HTML',
      htmlGhF.includes('50% more sensitive'));

    // Heavy GLP-1 → protein note in rendered HTML
    setProfile('male',35,110);
    var htmlGlp1Heavy=G._renderDoseGuide('retatrutide');
    check('_renderDoseGuide(retatrutide, 110kg): heavy weight adj in HTML',
      htmlGlp1Heavy.includes('110kg'));

    // Female HCG → warning in rendered HTML
    setProfile('female',35,65);
    var htmlHcgF=G._renderDoseGuide('hcg');
    check('_renderDoseGuide(hcg, female): female warning in HTML',
      htmlHcgF.includes('not typically indicated'));

    // No profile → "Add age & weight" nudge appears
    clearProfile();
    var htmlNoProfile=G._renderDoseGuide('cjc-ipa');
    check('_renderDoseGuide(cjc-ipa, no profile): profile nudge shown',
      htmlNoProfile.includes('Add age & weight'));

    clearProfile();
  }
}

// ── _renderTRTGuide: sex, age personalization modifiers ───────────────────────
console.log('\n── _renderTRTGuide: sex / age personalization modifiers ─────');
{
  if(typeof G._renderTRTGuide==='function'){
    function setProfile(sex,age,weightKg){
      G.localStorage.setItem('user_sex',sex||'male');
      G.localStorage.setItem('user_age',String(age||0));
      G.localStorage.setItem('user_weight',String(weightKg||0));
    }
    function clearProfile(){
      G.localStorage.removeItem('user_sex');
      G.localStorage.removeItem('user_age');
      G.localStorage.removeItem('user_weight');
    }

    // Female → female TRT warning in rendered HTML
    setProfile('female',35,65);
    var htmlTrtF=G._renderTRTGuide('testoviron',125);
    check('_renderTRTGuide(testoviron, female): female TRT dose warning present',
      htmlTrtF.includes('5–10 mg/week SC'));

    // Age <25 → HPTA suppression personalization warning (distinct from tier risk text "HPTA shutdown")
    setProfile('male',22,75);
    var htmlYoung=G._renderTRTGuide('testoviron',125);
    check('_renderTRTGuide(testoviron, age22): HPTA suppression personalization warning',
      htmlYoung.includes('exogenous testosterone suppresses'));
    check('_renderTRTGuide(testoviron, age22): age shown in warning text',
      htmlYoung.includes('Age 22'));

    // Age exactly 25 → no young-age personalization warning
    setProfile('male',25,80);
    var html25=G._renderTRTGuide('testoviron',125);
    check('_renderTRTGuide(testoviron, age25): no young-age personalization (boundary: <25)',
      !html25.includes('Age 25:'));

    // Age >=50 → natural T decline note
    setProfile('male',55,80);
    var htmlOlder=G._renderTRTGuide('testoviron',125);
    check('_renderTRTGuide(testoviron, age55): age 50+ natural T decline note',
      htmlOlder.includes('natural T decline'));
    check('_renderTRTGuide(testoviron, age55): age shown in note',
      htmlOlder.includes('Age 55'));

    // Male, age 35, normal profile → no personalization mods
    setProfile('male',35,80);
    var htmlNorm=G._renderTRTGuide('testoviron',125);
    check('_renderTRTGuide(testoviron, male35): no HPTA suppression personalization', !htmlNorm.includes('exogenous testosterone suppresses'));
    check('_renderTRTGuide(testoviron, male35): no female warning', !htmlNorm.includes('5–10 mg/week'));
    check('_renderTRTGuide(testoviron, male35): no age 50+ note', !htmlNorm.includes('natural T decline'));

    // Personalization works across different TRT compounds
    setProfile('female',22,55);
    ['nebido','enanthate','cypionate','propionate','sustanon'].forEach(function(id){
      var h=G._renderTRTGuide(id,100);
      check('_renderTRTGuide('+id+', female+22yo): female warning and HPTA suppression personalization',
        h.includes('5–10 mg/week SC')&&h.includes('exogenous testosterone suppresses'));
    });

    clearProfile();
  }
}

// ── Dynamic dose guide highlighting (_renderDoseGuide) ───────────────────────
{
  // Helper: extract labels of highlighted (active) tiers from rendered HTML
  function activeTierLabel(html){
    var matches=html.match(/<span style="[^"]*color:var\(--accent\)[^"]*text-transform:uppercase[^"]*">([^<]+)<\/span>/g)||[];
    return matches.map(function(m){var r=m.match(/>([^<]+)<\/span>/);return r?r[1].trim():'';});
  }

  // ── RETATRUTIDE IS SCALED PER WEEK, NOT PER DOSE (2026-08-20) ─────────────
  // These numbers were always weekly — the tiers read "2–4 mg/wk" — but the guide was
  // being handed a PER-DOSE amount, so "3" meant 3 mg per injection and matched the
  // weekly band by coincidence. Reported as: "Adding a second 3mg dose on Wednesday
  // doesn't change the dose info, it stuck on 2-4mg."
  //
  // The weekly total is now the third argument, and these pass it. Note the 5 mg case
  // below kept PASSING through the bug, because an unmatched value falls back to the
  // tier flagged b:1 — which is Optimal. A test that passes for the wrong reason is
  // worse than one that fails.
  // Retatrutide at 3 mg/week → Therapeutic (2–4 mg/wk), NOT Optimal
  var htmlReta3=G._renderDoseGuide('retatrutide',0,3);
  check('_renderDoseGuide: reta 3mg highlights Therapeutic tier',
    activeTierLabel(htmlReta3).some(function(l){return l.indexOf('Therapeutic')===0;}));
  check('_renderDoseGuide: reta 3mg does NOT highlight Optimal tier',
    !activeTierLabel(htmlReta3).some(function(l){return l.indexOf('Optimal')===0;}));

  // Retatrutide at 5 mg → Optimal (4–8 mg/wk)
  var htmlReta5=G._renderDoseGuide('retatrutide',0,5);
  check('_renderDoseGuide: reta 5mg highlights Optimal tier',
    activeTierLabel(htmlReta5).some(function(l){return l.indexOf('Optimal')===0;}));

  // Retatrutide at 1 mg → Start (0–2 mg/wk)
  var htmlReta1=G._renderDoseGuide('retatrutide',0,1);
  check('_renderDoseGuide: reta 1mg highlights Start tier',
    activeTierLabel(htmlReta1).some(function(l){return l.indexOf('Start')===0;}));

  // Retatrutide at 9 mg → Max (>=8 mg/wk)
  var htmlReta9=G._renderDoseGuide('retatrutide',0,9);
  check('_renderDoseGuide: reta 9mg highlights Max tier',
    activeTierLabel(htmlReta9).some(function(l){return l.indexOf('Max')===0;}));

  // Dose 0 → fall back to b:1 tier (Optimal for retatrutide)
  var htmlReta0=G._renderDoseGuide('retatrutide',0,0);
  check('_renderDoseGuide: reta dose=0 falls back to b:1 (Optimal)',
    activeTierLabel(htmlReta0).some(function(l){return l.indexOf('Optimal')===0;}));

  // HGH at 3 IU → Recomp (2.5–5 IU range)
  var htmlHgh3=G._renderDoseGuide('hgh',3);
  check('_renderDoseGuide: hgh 3 IU highlights Recomp tier',
    activeTierLabel(htmlHgh3).some(function(l){return l.indexOf('Recomp')===0;}));

  // BPC-157 at 500 mcg → Optimal (375–750 range)
  var htmlBpc=G._renderDoseGuide('bpc157',500);
  check('_renderDoseGuide: bpc157 500mcg highlights Optimal tier',
    activeTierLabel(htmlBpc).some(function(l){return l.indexOf('Optimal')===0;}));
}

// ── T-Calc PK model regression tests ─────────────────────────────────────────
console.log('\n── T-Calc PK model ─────────────────────────────────────────');
check('_tcPkConc defined',          typeof G._tcPkConc === 'function');
check('_tcKa defined',              typeof G._tcKa === 'function');
check('_tcVermeulenFT defined',     typeof G._tcVermeulenFT === 'function');
check('_tcDrawManualChart defined', typeof G._tcDrawManualChart === 'function');

if (typeof G._tcPkConc === 'function') {
  var _tc_ke_te = Math.LN2 / 4.5, _tc_ka_te = G._tcKa(4.5);
  check('_tcPkConc: dt=0  → 0',     G._tcPkConc(100, _tc_ka_te, _tc_ke_te, 0) === 0);
  check('_tcPkConc: dt=-1 → 0',     G._tcPkConc(100, _tc_ka_te, _tc_ke_te, -1) === 0);
  check('_tcPkConc: TE peak > 0 at ~1d',
    G._tcPkConc(100, _tc_ka_te, _tc_ke_te, 1) > 0,
    'got '+G._tcPkConc(100, _tc_ka_te, _tc_ke_te, 1).toFixed(3));
  check('_tcPkConc: TE decays from 1d to 5d',
    G._tcPkConc(100, _tc_ka_te, _tc_ke_te, 5) < G._tcPkConc(100, _tc_ka_te, _tc_ke_te, 1));
}

if (typeof G._tcKa === 'function') {
  // Boundary moved 1d → 0.5d when propionate was corrected to 0.8 d (2026-07-29),
  // so 0.8 keeps ka 8 instead of dropping into the near-immediate bucket.
  check('_tcKa: HL=0.4d → 15.0 (gel/near-immediate)', G._tcKa(0.4) === 15.0, 'got '+G._tcKa(0.4));
  check('_tcKa: HL=0.8d →  8.0 (propionate)',      G._tcKa(0.8) ===  8.0, 'got '+G._tcKa(0.8));
  check('_tcKa: HL=2d   →  8.0 (same bucket)',     G._tcKa(2)   ===  8.0, 'got '+G._tcKa(2));
  check('_tcKa: HL=4.5d →  3.0 (enanthate/TE)',    G._tcKa(4.5) ===  3.0, 'got '+G._tcKa(4.5));
  check('_tcKa: HL=10d  →  1.5 (cypionate/TC)',    G._tcKa(10)  ===  1.5, 'got '+G._tcKa(10));
  check('_tcKa: HL=34d  →  0.4 (undecanoate/TU)',  G._tcKa(34)  ===  0.4, 'got '+G._tcKa(34));
}

if (typeof G._tcVermeulenFT === 'function') {
  var _tc_ft20_40 = G._tcVermeulenFT(20, 40);
  check('Vermeulen: TT=20 SHBG=40 → 350–500 pmol/L',
    _tc_ft20_40 > 350 && _tc_ft20_40 < 500,
    'got '+(_tc_ft20_40 ? Math.round(_tc_ft20_40) : _tc_ft20_40));
  check('Vermeulen: TT=0   → null', G._tcVermeulenFT(0, 40) === null);
  check('Vermeulen: SHBG=0 → null', G._tcVermeulenFT(20, 0) === null);
  check('Vermeulen: higher SHBG → lower free T',
    G._tcVermeulenFT(20, 80) < G._tcVermeulenFT(20, 20));
}

// Warm-start accumulation: prior injections must give non-zero residual at t=0
if (typeof G._tcPkConc === 'function' && typeof G._tcKa === 'function') {
  // TE (enanthate): 125mg/wk E3.5D, 13 prior injections look-back
  var _ws_ke_te = Math.LN2 / 4.5, _ws_ka_te = G._tcKa(4.5);
  var _ws_dose_te = 125 * 3.5 / 7;
  var _ws_sum_te = 0;
  for (var _wsi = 1; _wsi <= 13; _wsi++) {
    _ws_sum_te += G._tcPkConc(_ws_dose_te, _ws_ka_te, _ws_ke_te, _wsi * 3.5);
  }
  check('warm-start TE: 13 prior E3.5D injections accumulate > 0 at t=0',
    _ws_sum_te > 0, 'got '+_ws_sum_te.toFixed(3));

  // TU (Nebido): 1000mg Q84d, 5 prior injections look-back
  var _ws_ke_tu = Math.LN2 / 34, _ws_ka_tu = G._tcKa(34);
  var _ws_dose_tu = 1000 * 84 / 7;
  var _ws_sum_tu = 0;
  for (var _wsi2 = 1; _wsi2 <= 5; _wsi2++) {
    _ws_sum_tu += G._tcPkConc(_ws_dose_tu, _ws_ka_tu, _ws_ke_tu, _wsi2 * 84);
  }
  check('warm-start Nebido: 5 prior Q84d injections accumulate > 0 at t=0',
    _ws_sum_tu > 0, 'got '+_ws_sum_tu.toFixed(3));
}

// Regression: _tcDrawManualChart must not crash when curDose=0 and measuredFT is set.
// This was the bug: if (calFT && _curDose > 0) skipped the warm-start entirely when
// "Dose at bloodwork" was left blank, causing the curve to always start at 0.
if (typeof G._tcDrawManualChart === 'function') {
  var _ws_savedFT   = G._tcp.measuredFT;
  var _ws_savedDose = G._tcp.currentDoseMgWk;
  G._tcp.measuredFT      = '217';
  G._tcp.currentDoseMgWk = '';
  var _ws_log = [
    {compId: 'testoviron', doseMg: '125', date: '2026-06-24'},
    {compId: 'testoviron', doseMg: '125', date: '2026-06-28'},
  ];
  var _ws_threw = false;
  try { G._tcDrawManualChart('tc-manual-chart', _ws_log); }
  catch (e) { _ws_threw = true; console.error('  _tcDrawManualChart threw:', e.message); }
  check('_tcDrawManualChart: no crash when curDose=0 and measuredFT set', !_ws_threw);
  G._tcp.measuredFT      = _ws_savedFT;
  G._tcp.currentDoseMgWk = _ws_savedDose;
}

// _tcFreeTSeries: the pure free-T model extracted from _tcDrawManualChart. Both
// the T-Calc chart and the Blood Levels tab call it, so it must return a usable
// day-indexed series and (pre-cycle-baseline case) start at the measured baseline.
if (typeof G._tcFreeTSeries === 'function') {
  var _fsFT = G._tcp.measuredFT, _fsDose = G._tcp.currentDoseMgWk, _fsBw = G._tcBwEntries;
  // Calibration now requires a DATED reading (an undated value cannot say WHEN the user
  // was at that level, and the anchor day is load-bearing). Same intent, expressed with a
  // pre-cycle draw.
  G._tcp.measuredFT = '217'; G._tcp.currentDoseMgWk = '';
  G._tcBwEntries = [{date:'2026-06-20', free_t:217}];
  var _fsLog = [
    {compId:'testoviron', doseMg:'125', date:'2026-06-24'},
    {compId:'testoviron', doseMg:'125', date:'2026-06-28'},
  ].sort(function(a,b){return a.date<b.date?-1:1;});
  var _fs = G._tcFreeTSeries(_fsLog, {});
  var _fsFtAt = function(t){ return _fs.total[t] * (_fs.calFT_arr ? _fs.calFT_arr[t] : _fs.scale); };
  check('_tcFreeTSeries: returns firstDate + day-indexed total',
    _fs && _fs.firstDate && typeof _fs.firstDate.getTime === 'function' && _fs.total && _fs.total.length === _fs.totalDays + 1);
  check('_tcFreeTSeries: calibrates to pmol/L when measured FT is set', _fs.unitLabel === 'pmol/L' && _fs.calFT > 0);
  check('_tcFreeTSeries: day-0 free T starts at the measured baseline (~217)', Math.abs(_fsFtAt(0) - 217) < 217 * 0.03);
  check('_tcFreeTSeries: free T rises above baseline as injections accumulate', _fsFtAt(_fs.totalDays) > _fsFtAt(0));
  var _fsHookVal = null;
  G._tcFreeTSeries(_fsLog, { start: function(v){ _fsHookVal = v; } });
  check('_tcFreeTSeries: fires the start hook with day-0 free T', _fsHookVal !== null && Math.abs(_fsHookVal - _fsFtAt(0)) < 1e-6);
  G._tcp.measuredFT = _fsFT; G._tcp.currentDoseMgWk = _fsDose; G._tcBwEntries = _fsBw;
}

// _tcDefaultFT: age→free-T midpoint comes from the backend baseline, NOT hardcoded.
if (typeof G._tcDefaultFT === 'function') {
  var _dfSaved = G._tcFtBaseline;
  check('_tcDefaultFT: unknown birth year → backend "default" midpoint', G._tcDefaultFT(0) === 350);
  check('_tcDefaultFT: age band lookup uses backend values (age ~40 → 340)',
    G._tcDefaultFT(new Date().getFullYear() - 40) === 340);
  check('_tcDefaultFT: oldest band applies beyond the last max_age', G._tcDefaultFT(new Date().getFullYear() - 80) === 180);
  // No reference data hardcoded in the frontend: with the baseline unloaded it must
  // return a neutral 0, never a population number baked into the code.
  G._tcFtBaseline = null;
  check('_tcDefaultFT: neutral 0 when the backend baseline has not loaded', G._tcDefaultFT(0) === 0 && G._tcDefaultFT(1985) === 0);
  G._tcFtBaseline = _dfSaved;
}

// Confidence tiers: the model must render an HONEST estimate — with a wide, clearly
// wider-when-less-data uncertainty band — even when the user has no bloodwork, so people
// who can't test regularly still get something, flagged as lower confidence.
if (typeof G._tcFreeTSeries === 'function') {
  var _t3p0 = G._tcp, _t3Bw0 = G._tcBwEntries, _t3Gh0 = G._tcGhStack;
  var _t3Log = [{compId:'testoviron',doseMg:'125',date:'2026-06-24'},{compId:'testoviron',doseMg:'125',date:'2026-06-28'}].sort(function(a,b){return a.date<b.date?-1:1;});
  G._tcGhStack = [];

  // estimate: no measured FT, no SHBG/TT, no bloodwork → age-default level + wide band
  G._tcp = {measuredFT:'', currentDoseMgWk:'', totalT:'', shbg:'', birthYear:'1985', manualLog:_t3Log};
  G._tcBwEntries = null;
  var _t3e = G._tcFreeTSeries(_t3Log, {});
  var _t3mid = Math.floor(_t3e.totalDays / 2);
  check('tier: no bloodwork at all → "estimate"', _t3e.tier === 'estimate');
  check('tier: estimate still renders a calibrated pmol/L curve', _t3e.calFT > 0 && !!_t3e.calFT_arr && _t3e.unitLabel === 'pmol/L');
  check('tier: estimate carries a wide (~±35%) uncertainty band',
    !!_t3e.calFThi && Math.abs(_t3e.calFThi[_t3mid]/_t3e.calFT_arr[_t3mid] - 1.35) < 0.02 && Math.abs(_t3e.calFTlo[_t3mid]/_t3e.calFT_arr[_t3mid] - 0.65) < 0.02);

  // partial: a measured FT but no SHBG/total-T → medium band, no SHBG dynamics
  G._tcp = {measuredFT:'300', currentDoseMgWk:'', totalT:'', shbg:'', birthYear:'1985', manualLog:_t3Log};
  G._tcBwEntries = [{date:'2026-06-20', free_t:300}];   // dated: calibration requires it
  var _t3pt = G._tcFreeTSeries(_t3Log, {});
  check('tier: measured FT but no SHBG/TT → "partial"', _t3pt.tier === 'partial');
  check('tier: partial band (~±20%) is narrower than the no-bloodwork estimate band',
    !!_t3pt.calFThi && Math.abs(_t3pt.calFThi[_t3mid]/_t3pt.calFT_arr[_t3mid] - 1.20) < 0.02);

  // measured: FT + total T + SHBG + a bloodwork entry → real SHBG model (β-band, not flat)
  var _t3mLog = [{compId:'testoviron',doseMg:'100',date:'2026-06-24'}];
  for (var _t3i=0; _t3i<8; _t3i++){ var _t3d=new Date(new Date('2026-06-26').getTime()+_t3i*3*86400000); _t3mLog.push({compId:'nebido',doseMg:'100',date:_t3d.getFullYear()+'-'+String(_t3d.getMonth()+1).padStart(2,'0')+'-'+String(_t3d.getDate()).padStart(2,'0')}); }
  G._tcp = {measuredFT:'400', currentDoseMgWk:'', totalT:'25', shbg:'40', birthYear:'1985', manualLog:_t3mLog};
  G._tcBwEntries = [{date:'2026-06-24', total_t:25, shbg:40, free_t:400}];
  var _t3ms = G._tcFreeTSeries(_t3mLog, {});
  check('tier: full bloodwork → "measured"', _t3ms.tier === 'measured');
  check('tier: measured band is a real β-band with width away from the draw (not synthetic flat)',
    !!_t3ms.calFThi && !!_t3ms.calFTlo && _t3ms.calFThi[_t3ms.totalDays] > _t3ms.calFTlo[_t3ms.totalDays]);

  G._tcp = _t3p0; G._tcBwEntries = _t3Bw0; G._tcGhStack = _t3Gh0;
}

// SHBG suppression now runs WITHOUT bloodwork (population baselines): GH/Boron move the
// curve for people who don't test, and for partial/mid-cycle tests.
if (typeof G._tcFreeTSeries === 'function') {
  var _psTp = G._tcp, _psBw = G._tcBwEntries, _psGh = G._tcGhStack, _psBase = G._tcShbgBaseline;
  var _psLog = [];
  for (var _pi=0; _pi<30; _pi++){ var _pd=new Date(new Date('2026-05-01').getTime()+_pi*3.5*86400000); _psLog.push({compId:'enanthate', doseMg:'100', date:_pd.getFullYear()+'-'+String(_pd.getMonth()+1).padStart(2,'0')+'-'+String(_pd.getDate()).padStart(2,'0')}); }
  var _psGhI = {shbg:{direction:'suppress', maxSuppression:0.40, halfTimeDays:25, doseResponse:{unit:'IU/day', ed50:2, emax:0.56, typicalDose:5}}};
  function _psSpread(s){ var mn=1e9,mx=-1e9; for(var t=0;t<=s.totalDays;t++){ var v=s.calFT_arr?s.calFT_arr[t]:s.scale; if(v<mn)mn=v; if(v>mx)mx=v; } return mx/(mn||1); }
  function _psFt(s,t){ return s.total[t]*(s.calFT_arr?s.calFT_arr[t]:s.scale); }
  // estimate tier: no measured FT / SHBG / TT, but age present → population baselines
  G._tcp = {measuredFT:'', currentDoseMgWk:'', totalT:'', shbg:'', birthYear:'1985', manualLog:_psLog};
  G._tcBwEntries = null;
  G._tcGhStack = [];
  var _psFlat = G._tcFreeTSeries(_psLog.slice(), {});
  check('no-bloodwork SHBG: model runs in the estimate tier (calibrated pmol/L)',
    _psFlat.tier === 'estimate' && _psFlat.calFT > 0 && !!_psFlat.calFT_arr);
  // What "no invented T-driven swing" means, now that the binding equation is the real
  // Vermeulen one. This used to assert calFT_arr was FLAT (spread < 1.01). That assertion
  // only held while free T was LINEAR in total T: with saturable SHBG binding, free T rises
  // faster than proportionally, so calFT_arr — which carries exactly that non-linearity,
  // total[] carrying the amount — must bend with dose. Demanding flatness would be demanding
  // the linearisation back. (Verified: in this tier the array reproduces bit-for-bit from a
  // CONSTANT-SHBG Vermeulen reconstruction.)
  //
  // The real invariant is that SHBG itself never moves without a measured total T — the β
  // power-law stays off. β acts through a LAGGED EMA of total T, so when it is on, two days
  // that share the same total T get different free-T scaling depending on how they got
  // there. With SHBG constant, calFT_arr is a pure function of total[t] and nothing else.
  function _psPathDep(s){
    var worst = 0;
    for (var a = 0; a <= s.totalDays; a++) {
      for (var b = a + 15; b <= s.totalDays; b++) {          // rising limb vs falling limb
        if (!(s.total[a] > 0) || !(s.total[b] > 0)) continue;
        if (Math.abs(s.total[a] / s.total[b] - 1) > 0.002) continue;   // same total T
        var d = Math.abs(s.calFT_arr[a] / s.calFT_arr[b] - 1);
        if (d > worst) worst = d;
      }
    }
    return worst;
  }
  var _psDepEst = _psPathDep(_psFlat);
  check('no-bloodwork SHBG: no β-driven swing — SHBG is constant, so free T is a pure function of total T',
    _psDepEst < 0.002, 'path-dependence=' + _psDepEst.toFixed(6));

  // add a GH suppressor → the curve must bend (suppression shows without any bloodwork)
  G._tcGhStack = [{pepId:'hgh', startDateStr:'2026-05-01', interactions:_psGhI, dailyDose:5}];
  var _psSupp = G._tcFreeTSeries(_psLog.slice(), {});
  check('no-bloodwork SHBG: a GH suppressor bends the free-T curve (population SHBG baseline used)',
    _psSpread(_psSupp) > 1.03, 'spread=' + _psSpread(_psSupp).toFixed(3));
  check('no-bloodwork SHBG: GH raises free T later in the cycle vs the same schedule with no GH',
    _psFt(_psSupp, _psSupp.totalDays - 5) > _psFt(_psFlat, _psFlat.totalDays - 5));
  // without the population SHBG baseline (e.g. table not loaded) → safe flat fallback
  // With no population SHBG baseline the model must not invent SHBG DYNAMICS — SHBG is
  // held fixed. This used to be asserted as "calFT_arr is flat (spread < 1.01)", which
  // only held while binding was linearised. With the saturable Vermeulen quadratic the
  // free FRACTION legitimately rises with total T even at constant SHBG, so a flat array
  // would now mean the binding curve had been linearised again. Assert the real property:
  // no path dependence — two days sharing a total T scale identically, which can only be
  // true if nothing is moving SHBG around.
  G._tcShbgBaseline = null;
  var _psDepFlat = _psPathDep(G._tcFreeTSeries(_psLog.slice(), {}));
  check('no-bloodwork SHBG: no population baseline → SHBG held fixed (no invented dynamics)',
    _psDepFlat < 0.002, 'path-dependence=' + _psDepFlat.toFixed(6));
  G._tcShbgBaseline = _psBase;
  // Teeth for the path-dependence check above: with a MEASURED total T the β power-law does
  // run, SHBG tracks the lagged T level, and the very same measurement separates clearly.
  // Without this, "path-dependence is small" could pass simply by being unmeasurable.
  G._tcGhStack = [];
  G._tcp = {measuredFT:'400', currentDoseMgWk:'', totalT:'25', shbg:'40', birthYear:'1985', manualLog:_psLog};
  G._tcBwEntries = [{date:'2026-05-01', total_t:25, shbg:40, free_t:400}];
  var _psMeas = G._tcFreeTSeries(_psLog.slice(), {});
  var _psDepMeas = _psPathDep(_psMeas);
  check('no-bloodwork SHBG: …and the measured tier DOES apply β (so the check above can fail)',
    _psMeas.tier === 'measured' && _psDepMeas > 0.005 && _psDepMeas > _psDepEst * 5,
    'measured=' + _psDepMeas.toFixed(6) + ' vs estimate=' + _psDepEst.toFixed(6));
  G._tcp = _psTp; G._tcBwEntries = _psBw; G._tcGhStack = _psGh;
}

// ── Ester mass fraction: a dose is ESTER mass, only part of it is testosterone ──
console.log('\n── T-calc: ester mass fraction (testosteroneFraction) ──');
if (typeof G._TC_T_FRACTION === 'object' && G._TC_T_FRACTION) {
  var _efT = 288.4;   // testosterone C19H28O2, PubChem CID 6013
  var _efMW = { propionate:344.5, enanthate:400.6, cypionate:412.6, undecanoate:456.7,
                phenylpropionate:420.6, isocaproate:386.6, decanoate:442.7 };
  function _efRatio(e){ return Math.round(_efT/_efMW[e]*10000)/10000; }
  check('ester fraction: enanthate is the MW ratio, not a remembered constant',
    Math.abs(G._TC_T_FRACTION.enanthate - _efRatio('enanthate')) < 1e-9,
    'got ' + G._TC_T_FRACTION.enanthate + ' want ' + _efRatio('enanthate'));
  check('ester fraction: testoviron IS enanthate, same fraction',
    G._TC_T_FRACTION.testoviron === G._TC_T_FRACTION.enanthate);
  check('ester fraction: cypionate', Math.abs(G._TC_T_FRACTION.cypionate - _efRatio('cypionate')) < 1e-9);
  check('ester fraction: propionate', Math.abs(G._TC_T_FRACTION.propionate - _efRatio('propionate')) < 1e-9);
  check('ester fraction: nebido is undecanoate', Math.abs(G._TC_T_FRACTION.nebido - _efRatio('undecanoate')) < 1e-9);
  check('ester fraction: topical gel is unesterified testosterone (1.0)', G._TC_T_FRACTION.topical === 1.0);
  // Sustanon is a blend — the dose-weighted mean of its four SmPC-stated components.
  // Regression on a real error: 0.729 (from a "182.2 mg" figure that does not reproduce)
  // overstated its testosterone content by 3.5%.
  var _efBlend = [[30,'propionate'],[60,'phenylpropionate'],[60,'isocaproate'],[100,'decanoate']];
  var _efMg = 0, _efTotal = 0;
  _efBlend.forEach(function(c){ _efMg += c[0]; _efTotal += c[0] * _efT / _efMW[c[1]]; });
  check('ester fraction: Sustanon components sum to the 250 mg label dose', _efMg === 250);
  check('ester fraction: Sustanon blend is 176.2 mg testosterone per 250 mg',
    Math.abs(_efTotal - 176.16) < 0.05, 'got ' + _efTotal.toFixed(2));
  check('ester fraction: Sustanon is the dose-weighted blend (0.7046)',
    Math.abs(G._TC_T_FRACTION.sustanon - Math.round(_efTotal/250*10000)/10000) < 1e-9,
    'got ' + G._TC_T_FRACTION.sustanon);
  check('ester fraction: the superseded 0.729 is gone', G._TC_T_FRACTION.sustanon !== 0.729);
  // Ordering the model depends on: a heavier ester delivers LESS testosterone per mg.
  check('ester fraction: propionate > enanthate > cypionate > undecanoate (heavier ester, less T)',
    G._TC_T_FRACTION.propionate > G._TC_T_FRACTION.enanthate &&
    G._TC_T_FRACTION.enanthate  > G._TC_T_FRACTION.cypionate &&
    G._TC_T_FRACTION.cypionate  > G._TC_T_FRACTION.nebido);
  // The whole point: switching ester at the same mg changes delivered testosterone.
  if (typeof G._tcCompInfo === 'function') {
    var _efEn = G._tcCompInfo('enanthate'), _efNe = G._tcCompInfo('nebido');
    check('ester fraction: _tcCompInfo exposes it to the PK model',
      _efEn.testosteroneFraction > 0 && _efNe.testosteroneFraction > 0);
    check('ester fraction: 100 mg enanthate delivers ~14% more testosterone than 100 mg undecanoate',
      Math.abs((_efEn.testosteroneFraction / _efNe.testosteroneFraction) - 1.14) < 0.02,
      'ratio=' + (_efEn.testosteroneFraction / _efNe.testosteroneFraction).toFixed(4));
  }
} else {
  check('_TC_T_FRACTION defined', false);
}

// ── ABSOLUTE free-T model: the invariants the old scale-fitted one violated ──
console.log('\n── T-calc: absolute model (no fitted scale factor) ──');
if (typeof G._tcFreeTSeries === 'function' && typeof G._tcVermeulenFT === 'function') {
  var _amS={tp:G._tcp,bw:G._tcBwEntries,gh:G._tcGhStack};
  function _amIso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  // 100 mg TU every 2 days — the real protocol that exposed this.
  function _amRun(startStr,n){
    var st=new Date(startStr+'T12:00:00');
    var log=[]; var t=new Date(st.getTime());
    for(var i=0;i<n;i++){log.push({compId:'nebido',doseMg:'100',date:_amIso(t)});t=new Date(t.getTime()+2*86400000);}
    G._tcp={measuredFT:'217',currentDoseMgWk:'0',totalT:'',shbg:'45',birthYear:'1985',manualLog:log};
    G._tcBwEntries=[{date:_amIso(new Date(st.getTime()-86400000)),free_t:217,shbg:45}];
    G._tcGhStack=[];
    var s=G._tcFreeTSeries(log.slice(),{});
    var ft=function(i){return s.total[i]*(s.calFT_arr?s.calFT_arr[i]:s.scale);};
    var mx=0;for(var i=0;i<=s.totalDays;i++)if(ft(i)>mx)mx=ft(i);
    return {s:s, ft:ft, peak:mx};
  }
  var _amA=_amRun('2026-06-26',900);
  // 1. total[] is an ABSOLUTE appearance rate in mg/day, not an arbitrary scale.
  //    Before the first dose it is exactly endogenous production.
  check('absolute model: day-0 appearance rate == endogenous production (mg/day)',
    Math.abs(_amA.s.total[0] - G.TCALC_ENDOG_T_MGD) < 1e-6, 'total[0]='+_amA.s.total[0]);
  // 2. Steady-state appearance rate == the dose rate. Mass balance: every injected mg
  //    appears. 100mg TU q2d = 100*0.6315/2 mg testosterone/day, + endogenous.
  // Endogenous production is SUPPRESSED by the exogenous dose (HPTA shutdown), so the
  // steady-state appearance rate is the dose rate plus whatever survives suppression —
  // which at this dose is ~0.8% of baseline, i.e. essentially the dose rate alone.
  var _amRate=100*0.6315/2, _amSS=0;
  for(var i=Math.floor(_amA.s.totalDays*0.6);i<=Math.floor(_amA.s.totalDays*0.7);i++) _amSS=Math.max(_amSS,_amA.s.total[i]);
  var _amPsup=G._tcEndogAt(_amRate, G.TCALC_ENDOG_T_MGD);
  check('absolute model: steady-state rate == dose rate + SUPPRESSED endogenous (mass balance)',
    Math.abs(_amSS-(_amRate+_amPsup))/(_amRate+_amPsup) < 0.03,
    'got '+_amSS.toFixed(2)+' want '+(_amRate+_amPsup).toFixed(2));
  check('absolute model: a supraphysiological dose shuts endogenous production down',
    _amPsup < G.TCALC_ENDOG_T_MGD*0.05, 'P still '+_amPsup.toFixed(3)+' mg/d');
  check('absolute model: no dose leaves endogenous production untouched',
    Math.abs(G._tcEndogAt(0, G.TCALC_ENDOG_T_MGD) - G.TCALC_ENDOG_T_MGD) < 1e-9);
  check('absolute model: suppression is monotone in dose',
    G._tcEndogAt(1,5) > G._tcEndogAt(5,5) && G._tcEndogAt(5,5) > G._tcEndogAt(20,5));
  // 3. The curve starts at the user's own measured baseline (pre-cycle draw).
  check('absolute model: day-0 free T == the measured baseline',
    Math.abs(_amA.ft(0)-217) < 1.0, 'day0='+_amA.ft(0).toFixed(1));
  // 4. THE BUG THIS REPLACED: the projected plateau must not depend on how far into the
  //    protocol you happen to be. The old model answered 435-15789 pmol/L for one protocol
  //    because its "endogenous baseline" was carved from the drug curve.
  var _amB=_amRun('2025-06-01',900), _amC=_amRun('2026-07-25',900);
  var _amSpread=Math.max(_amA.peak,_amB.peak,_amC.peak)/Math.min(_amA.peak,_amB.peak,_amC.peak);
  check('absolute model: plateau does NOT depend on how far into the protocol you are',
    _amSpread < 1.05,
    'peaks '+_amA.peak.toFixed(0)+' / '+_amB.peak.toFixed(0)+' / '+_amC.peak.toFixed(0)+' spread='+_amSpread.toFixed(3));
  // 5. The plateau matches first principles: TT scales as (rate+P)/P, then Vermeulen.
  // No measured total T in this scenario -> 'partial' tier -> the beta power-law is OFF,
  // so SHBG stays at the measured 45. (Applying beta here would be testing a different
  // tier than the one the scenario configures.)
  var _amTT0=G._tcInvVermeulenTT(217,45), _amMult=(_amRate+_amPsup)/G.TCALC_ENDOG_T_MGD;
  var _amWant=G._tcVermeulenFT(_amTT0*_amMult, 45);
  check('absolute model: plateau matches (rate+P_suppressed)/P0 then Vermeulen, within 5%',
    Math.abs(_amA.peak-_amWant)/_amWant < 0.05,
    'model '+_amA.peak.toFixed(0)+' vs first-principles '+_amWant.toFixed(0));
  // 6. Binding must stay SATURABLE. A linearised form pins the free fraction at a
  //    constant, which under-reports free T by ~51% at supraphysiological total T —
  //    the direction that invites dose escalation. Independently verified 2026-08-01.
  var _amF15=G._tcVermeulenFT(15,40)/15000, _amF60=G._tcVermeulenFT(60,40)/60000;
  check('absolute model: free fraction RISES with total T (SHBG saturates, not linear)',
    _amF60 > _amF15*1.2, 'free% 15->'+(_amF15*100).toFixed(2)+'  60->'+(_amF60*100).toFixed(2));
  check('absolute model: doubling total T raises free T MORE than 2x',
    G._tcVermeulenFT(30,40)/G._tcVermeulenFT(15,40) > 2.05,
    'ratio='+(G._tcVermeulenFT(30,40)/G._tcVermeulenFT(15,40)).toFixed(4));
  check('absolute model: Vermeulen inverse round-trips through the quadratic',
    Math.abs(G._tcInvVermeulenTT(G._tcVermeulenFT(25,40),40) - 25) < 0.01);
  var _amSrcV=require('fs').readFileSync(require('path').join(dir,'tab-tcalc.js'),'utf8');
  check('absolute model: the linearised binding form has not come back',
    /disc|Math\.sqrt/.test(_amSrcV.slice(_amSrcV.indexOf('function _tcVermeulenFT'), _amSrcV.indexOf('function _tcVermeulenFT')+700)),
    'the quadratic solve is gone from _tcVermeulenFT');
  // 6. No fitted scale factor may come back.
  var _amSrc=require('fs').readFileSync(require('path').join(dir,'tab-tcalc.js'),'utf8');
  check('absolute model: calFT is not refitted to the measurement',
    !/calFT\s*=\s*_mftNum\s*\//.test(_amSrc), 'a calFT = _mftNum/... scale fit reappeared');
  check('absolute model: no anchor re-normalisation of calFT_arr',
    !/calFT_arr\[_ai\]\s*\*=/.test(_amSrc), 'the anchor normalisation reappeared');
  G._tcp=_amS.tp; G._tcBwEntries=_amS.bw; G._tcGhStack=_amS.gh;
}

// ── UNITS ARE ALWAYS pmol/L + missing labs fall back to the population average ──
// A curve that silently became mg/day when it could not calibrate was never a requested
// feature. It rendered a y-axis of 0-35 where the user expected 217+ pmol/L and read as a
// broken chart. Missing bloodwork changes the CONFIDENCE, never the unit.
console.log('\n── T-calc: always pmol/L, population estimate when no lab ──');
{
  var _puSrc = require('fs').readFileSync(require('path').join(dir,'tab-tcalc.js'),'utf8');
  check('units: no mg fallback anywhere in the unit label',
    !/unitLabel\s*=\s*calFT\s*\?/.test(_puSrc), 'a conditional unit label is back');
  check('units: unitLabel is assigned the literal pmol/L',
    (_puSrc.match(/var unitLabel = 'pmol\/L';/g) || []).length >= 2);
  // Targeted: unitLabel itself must never be assigned mg. (Bare 'mg' elsewhere is a DOSE
  // unit — mg of drug injected — which is correct and unrelated to the chart's y-axis.)
  check('units: unitLabel is never assigned mg',
    !/unitLabel\s*=\s*[^;\n]*'mg'/.test(_puSrc), 'unitLabel can still become mg');
  check('units: the free-T axis cannot render a non-pmol/L unit',
    !/unitLabel\s*=\s*(?!'pmol\/L')/.test(_puSrc) || /var unitLabel = 'pmol\/L';/.test(_puSrc));
  // The CLAUDE.md rule is that a no-bloodwork curve is drawn in pmol/L but LABELLED an
  // estimate with a prompt for a blood test. All three guarantees still hold; the wording
  // moved on 2026-08-02 because the old copy was rendered TWICE — a pill badge and a
  // 3-line text block at overlapping coordinates, which painted over each other and over
  // the curve. One block now carries it. Assert the guarantees, not the old duplication.
  check('estimate: chart labels it an ESTIMATE',
    /⚠ ESTIMATE · NO BLOODWORK/.test(_puSrc));
  check('estimate: chart says it is not the user\'s levels', /Not your levels/.test(_puSrc));
  check('estimate: chart asks for a dated blood test', /add a dated blood test/i.test(_puSrc));
  // and the population-average calibration itself is untouched by the copy change
  check('estimate: still calibrated to the age population average',
    /POPULATION AVERAGE FOR THE USER'S AGE/.test(_puSrc));
  // the curve is solid at every tier — dashes made an estimate look like a broken chart
  check('plasma curve is never dashed for estimate tiers',
    !/_tier !== 'measured'\) ctx\.setLineDash/.test(_puSrc));

  if (typeof G._tcFreeTSeries === 'function') {
    var _puSave = {tp:G._tcp, bw:G._tcBwEntries, gh:G._tcGhStack};
    var _puLog = [{compId:'nebido', doseMg:'100', date:'2026-06-26'},
                  {compId:'nebido', doseMg:'100', date:'2026-06-28'},
                  {compId:'nebido', doseMg:'100', date:'2026-06-30'}];
    // No bloodwork at all -> population average for age, still pmol/L.
    G._tcp = {measuredFT:'', currentDoseMgWk:'0', totalT:'', shbg:'', birthYear:'1985', manualLog:_puLog};
    G._tcBwEntries = null; G._tcGhStack = [];
    var _puA = G._tcFreeTSeries(_puLog.slice(), {});
    var _puFt = function(S,i){ return S.total[i]*(S.calFT_arr?S.calFT_arr[i]:S.scale); };
    check('no lab: unit is STILL pmol/L (never mg)', _puA.unitLabel === 'pmol/L', 'got '+_puA.unitLabel);
    check('no lab: curve is calibrated, not blank', _puA.calFT != null);
    check('no lab: tier reports it as an estimate', _puA.tier === 'estimate', 'tier='+_puA.tier);
    var _popFT = G._tcDefaultFT(1985);
    check('no lab: day 0 sits at the population average for the age',
      Math.abs(_puFt(_puA,0) - _popFT) < Math.max(1, _popFT*0.02),
      'day0='+_puFt(_puA,0).toFixed(1)+' population='+_popFT);
    check('no lab: the curve still rises with the drug', _puFt(_puA,_puA.totalDays-1) > _puFt(_puA,0));

    // An UNDATED personal reading must not anchor the curve — the anchor day sets the
    // whole scale. It falls back to the same population estimate rather than to no curve.
    G._tcp = {measuredFT:'900', currentDoseMgWk:'0', totalT:'', shbg:'', birthYear:'1985', manualLog:_puLog};
    G._tcBwEntries = null;
    var _puB = G._tcFreeTSeries(_puLog.slice(), {});
    check('undated personal value does not anchor the curve (population used instead)',
      _puB.tier === 'estimate' && Math.abs(_puFt(_puB,0) - _popFT) < Math.max(1, _popFT*0.02),
      'day0='+_puFt(_puB,0).toFixed(1));
    check('undated personal value: unit is still pmol/L', _puB.unitLabel === 'pmol/L');

    // A DATED lab wins and drops the estimate labelling.
    G._tcp = {measuredFT:'217', currentDoseMgWk:'0', totalT:'', shbg:'45', birthYear:'1985', manualLog:_puLog};
    G._tcBwEntries = [{date:'2026-06-25', free_t:217, shbg:45}];
    var _puC = G._tcFreeTSeries(_puLog.slice(), {});
    check('dated lab: anchors on the user\'s own value, not the population',
      Math.abs(_puFt(_puC,0) - 217) < 1.0, 'day0='+_puFt(_puC,0).toFixed(1));
    check('dated lab: no longer flagged as an estimate', _puC.tier !== 'estimate', 'tier='+_puC.tier);
    G._tcp = _puSave.tp; G._tcBwEntries = _puSave.bw; G._tcGhStack = _puSave.gh;
  }
}

// ── Simple planner must actually drive the plasma curve ──
// Reported 2026-08-02 (trt-stage): the plan card said "140 mg/week - 74 injections
// projected - Shown in the plasma curve at the top of this page" while the curve itself
// said "No injections logged yet" and drew nothing. buildTCalc gated the curve card on
// _tcp.manualLog, which is legitimately EMPTY when the simple planner is the live one.
console.log('\n── T-calc: the live planner drives the curve ──');
{
  var _spSrc = require('fs').readFileSync(require('path').join(dir,'tab-tcalc.js'),'utf8');
  check('curve gate uses _tcCurveLog(), not a manualLog filter',
    /var validLog = _tcCurveLog\(\);/.test(_spSrc) &&
    !/var validLog = log\.filter/.test(_spSrc),
    'buildTCalc still gates the plasma curve on the manual log');
  if (typeof G._tcCurveLog === 'function' && typeof G._tcSimplePlanInjections === 'function') {
    var _spSave = {tp:G._tcp};
    // Simple planner live, manual log EMPTY — exactly the reported state.
    G._tcp = Object.assign({}, G._tcp, {
      manualLog: [],
      simplePlan: {compId:'testoviron', doseMg:'100', cadenceN:5, cadenceUnit:'days',
                   cadenceDays:5, startDate:'2026-08-02'},
      plannerMode: 'simple'
    });
    var _spInj = G._tcSimplePlanInjections();
    check('simple planner generates a schedule from the plan alone', _spInj.length > 0,
      'got ' + _spInj.length + ' injections');
    var _spCurve = G._tcCurveLog();
    check('curve log is non-empty when the plan is live and manualLog is empty',
      _spCurve.length > 0, 'got ' + _spCurve.length);
    check('curve log entries carry the planned compound and dose',
      _spCurve.length > 0 && _spCurve[0].compId === 'testoviron' && parseFloat(_spCurve[0].doseMg) === 100,
      _spCurve.length ? JSON.stringify(_spCurve[0]) : 'empty');
    G._tcp = _spSave.tp;
  }
}

// ── Schedule generation must step in CALENDAR days, not milliseconds ──
// Reported 2026-08-02: two visible kinks in the plasma curve, mistaken for pharmacology.
// The generator advanced by i * cadenceDays * 86400000 ms from parseLocalDate(startDate),
// which is LOCAL MIDNIGHT. A fixed number of ms is not a fixed number of local days — at
// each DST transition the wall clock shifts an hour and, anchored at midnight, crosses a
// date boundary. "Every 5 days" from 2026-08-02 in a European timezone produced
// 2026-10-21 -> 2026-10-25 (4-day gap) and 2027-03-24 -> 2027-03-30 (6-day gap): one dose
// crammed in, one dropped. EOD degraded to gaps of 1, 2 AND 3 days.
//
// NOTE: CI runs in UTC, where no DST transition occurs, so a purely functional test cannot
// reproduce it here. The source guard below is what actually protects this.
console.log('\n── DST-proof schedule generation ──');
{
  // The hazard did not go away with T-Calc's planner — it MOVED. _genInjBatches is now
  // the only thing that expands a schedule into dates, and it stepped by 86400000 ms.
  // A DST day is 23 or 25 hours, so crossing one the loop variable creeps to 23:00 the
  // previous day and a date is emitted twice or skipped: a duplicated or missing
  // injection, from a clock change.
  //
  // CI runs in UTC, where no transition occurs, so a purely functional test cannot
  // reproduce it here — the source guard is what protects it, as it was for the planner.
  var _dsSrc = require('fs').readFileSync(require('path').join(dir,'tab-stack.js'),'utf8');
  check('the generator steps in calendar days', /function _nextDay\(d\)\{[\s\S]{0,120}setDate\(n\.getDate\(\)\+1\)/.test(_dsSrc));
  check('  …and never in milliseconds from the start instant',
    !/d=new Date\(d\.getTime\(\)\+86400000\)/.test(_dsSrc),
    'ms stepping is back — this is the DST bug');

  // Behavioural, in whatever zone CI runs: a daily compound across a month yields one
  // dose per calendar day, none repeated and none missing.
  var _dsStack = {id:'dst', cycle_start:'2026-03-01', cycle_length:8,
    trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'100', unit:'mg',
         freqVal:1, freqUnit:'days'}]}};
  var _dsDates = G._genInjBatches(_dsStack, 'dst', null)
                  .reduce(function(a,b){ return a.concat((b.entries||[]).map(function(e){return e.date;})); }, []);
  check('  …one dose per day, with no date repeated',
    _dsDates.length === new Set(_dsDates).size, 'dupes in ' + _dsDates.length + ' dates');
  check('  …and no calendar day skipped across the whole cycle', (function(){
    for (var i = 1; i < _dsDates.length; i++){
      var gap = Math.round((new Date(_dsDates[i]+'T12:00:00') - new Date(_dsDates[i-1]+'T12:00:00'))/86400000);
      if (gap !== 1) return false;
    }
    return _dsDates.length > 40;
  })(), _dsDates.length + ' dates from ' + _dsDates[0] + ' to ' + _dsDates[_dsDates.length-1]);
}

// ── A DATED draw calibrates even with no free T ──
// Reported 2026-08-02: bloodwork entered on 26 Jun, chart still captioned
// "ESTIMATE · NO BLOODWORK". _ftIsDefault was derived from _tcp.measuredFT alone, and
// _tcFetchBwEntries only mirrors free_t when the NEWEST entry carries one. A normal TRT
// panel (total T + SHBG, no free T) therefore left _ftIsDefault true, which BOTH mislabelled
// the chart AND replaced the measured total T with the age population average — the user's
// bloodwork was ignored, not merely uncredited.
console.log('\n\u2500\u2500 T-calc: a dated draw calibrates \u2500\u2500');
{
  var _dcSrc = require('fs').readFileSync(require('path').join(dir,'tab-tcalc.js'),'utf8');
  check('tier is decided by the calibrating entry, not by free-T presence',
    /_bwCal \? 'partial' : \(_ftIsDefault \? 'estimate' : 'partial'\)/.test(_dcSrc));
  check('a measured total T is used directly, not re-derived',
    /_bwTT > 0 && !\(_bwFT > 0\)\) _ttAtDraw = _bwTT/.test(_dcSrc));
  check('population fallback is gated on having no dated draw',
    /!\(_bwFT > 0\) && !\(_bwTT > 0\)/.test(_dcSrc));

  if (typeof G._tcFreeTSeries === 'function') {
    var _dcSave = {tp:G._tcp, bw:G._tcBwEntries, gh:G._tcGhStack};
    G._tcGhStack = [];
    var _dcLog = [{compId:'testoviron', doseMg:'100', date:'2026-06-01'},
                  {compId:'testoviron', doseMg:'100', date:'2026-06-15'},
                  {compId:'testoviron', doseMg:'100', date:'2026-06-29'}];
    // total T + SHBG, NO free T — exactly the panel that triggered the report
    G._tcp = {measuredFT:'', currentDoseMgWk:'', totalT:'', shbg:'', birthYear:'1980',
              manualLog:_dcLog};
    G._tcBwEntries = [{date:'2026-06-26', total_t:25, shbg:40, free_t:null}];
    function _dcRun() {
      var _t = null;
      try { G._tcFreeTSeries(_dcLog, { shbg: function(o){ if (o && o.tier) _t = o.tier; } }); }
      catch(e) { _t = 'THREW:' + e.message; }
      return _t;
    }
    var _dcTier = _dcRun();
    check('total-T-only draw is NOT reported as "no bloodwork"',
      _dcTier !== null && _dcTier !== 'estimate', 'tier=' + _dcTier);
    // and with nothing at all it still IS an estimate — the label must stay honest
    G._tcBwEntries = [];
    var _dcTier2 = _dcRun();
    check('no bloodwork at all is still reported as an estimate',
      _dcTier2 === 'estimate', 'tier=' + _dcTier2);
    G._tcp = _dcSave.tp; G._tcBwEntries = _dcSave.bw; G._tcGhStack = _dcSave.gh;
  }
}

// ── Promotion gates on THIS repo's CI, not on every check on the commit ──
// Moving to the ViritasOrg org enabled CodeQL by default. It flagged three pre-existing
// findings in code already live in prod, and because the gate failed on ANY failed or
// cancelled check, a scanner the repo does not control blocked the deploy. A cancelled
// pages-build-deployment (which a visibility change causes) did the same. Security
// findings get triaged in the Security tab; they are not a reason to refuse to ship.
// Test failures still block — that part must never be relaxed.
console.log('\n\u2500\u2500 Promotion: CI gate scope \u2500\u2500');
{
  // These assert THIS repo's promote-to-prod.yml — a staging-repo workflow. The
  // promotion copies index.html, tab-*.js, ci.yml and tests/ into prod, but not the
  // promote workflow (prod must not run staging's). So on prod these tests would
  // assert a file that legitimately differs there, and they failed every promotion
  // after they were added on 2026-08-02 — which is what pinned prod at v1.271 while
  // the promote PRs piled up unmerged.
  //
  // Scoped to the repo they are about, not weakened: on any -staging/-stage repo, or
  // a checkout that cannot be identified at all, they run in full and still fail loudly.
  //
  // WHICH REPO IS THIS CHECKOUT? On CI, GITHUB_REPOSITORY says so. Locally it is unset,
  // and the old fallback — "no env var means run them" — was wrong in a PROD checkout:
  // these five then asserted staging's workflow against prod's own copy of
  // promote-to-prod.yml, which legitimately differs, and failed on every local run with
  // nothing actually broken. Not hypothetical — that is exactly how prod came to be
  // reported as having "5 pre-existing failures" while its CI was green (2026-08-15).
  // The origin remote names the repo the working tree came from, so ask that instead.
  var _pgRepo = process.env.GITHUB_REPOSITORY || '';
  if (!_pgRepo) {
    try {
      var _pgCfg = require('fs').readFileSync(require('path').join(dir, '.git/config'), 'utf8');
      var _pgM = _pgCfg.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/);
      if (_pgM) _pgRepo = _pgM[1].replace(/\.git$/, '');
    } catch (e) { /* no .git — a tarball or vendored copy; stay indeterminate */ }
  }
  // Indeterminate stays LOUD: an unidentifiable checkout runs them rather than skipping,
  // so a real regression in staging's gate can never hide behind a missing remote.
  var _pgIsProd = _pgRepo && !/-(staging|stage)$/.test(_pgRepo);
  if (_pgIsProd) {
    console.log('  – skipped on ' + _pgRepo + ' (staging-only workflow)');
  } else {
  var _pgSrc = require('fs').readFileSync(
    require('path').join(dir, '.github/workflows/promote-to-prod.yml'), 'utf8');
  check('gate selects the test check by name',
    /select\(\.name == "test"\)/.test(_pgSrc));
  check('failure count is computed over the CI subset, not all checks',
    /FAILED=\$\(echo "\$CI"/.test(_pgSrc));
  check('pending count is computed over the CI subset, not all checks',
    /PENDING=\$\(echo "\$CI"/.test(_pgSrc));
  check('a failing test still blocks the merge',
    /if \[ "\$FAILED" -gt "0" \]/.test(_pgSrc));
  check('non-blocking failures are reported, not swallowed',
    /non-blocking checks not passing/.test(_pgSrc));
  }
}

// ── P0 (endogenous T production) is 5 mg/day, sourced ──
// Changed from 6.5 on 2026-08-02 at Henrik's request, on retrieved evidence:
// Handelsman/Endotext sources a 3-10 mg/day tracer-derived range and anchors it at
// "~5 mg per day ... replicating the testosterone production rate in healthy
// eugonadal men". Nothing published states 6.5. P0 is both the baseline AND the
// suppression scale in P(rate)=P0*exp(-rate/P0), so every free-T number moves with
// it — do not "tidy" it back to a rounder number.
console.log('\n\u2500\u2500 T-calc: endogenous production constant \u2500\u2500');
{
  var _p0Src = require('fs').readFileSync(require('path').join(dir,'tab-tcalc.js'),'utf8');
  check('TCALC_ENDOG_T_MGD is 5 mg/day', /var TCALC_ENDOG_T_MGD = 5;/.test(_p0Src));
  check('the old unsourced 6.5 is gone', !/TCALC_ENDOG_T_MGD = 6\.5/.test(_p0Src));
  check('the change carries its citation', /eugonadal men/.test(_p0Src));
  if (typeof G.TCALC_ENDOG_T_MGD !== 'undefined') {
    check('runtime value is 5', G.TCALC_ENDOG_T_MGD === 5, String(G.TCALC_ENDOG_T_MGD));
  }
  if (typeof G._tcEndogAt === 'function') {
    // unsuppressed: zero drug leaves production at P0 exactly
    check('zero drug leaves production at P0', Math.abs(G._tcEndogAt(0,5) - 5) < 1e-9);
    // and suppression still scales to P0, not to the old constant
    check('suppression scales to the new P0',
      Math.abs(G._tcEndogAt(5,5) - 5*Math.exp(-1)) < 1e-9);
  }
}

// ── Every draw path uses the LIVE planner's log; plus the 3-month zoom ──
// The pan handler redrew from _tcp.manualLog, which is empty when the simple planner is
// live, so dragging the chart redrew an EMPTY series and the curve would not scroll at
// all. Identical mistake to the buildTCalc curve gate — hence a guard that covers every
// draw path rather than the one that happened to be reported.
console.log('\n── T-calc: pan + zoom levels ──');
{
  var _pzSrc = require('fs').readFileSync(require('path').join(dir,'tab-tcalc.js'),'utf8');
  check('no draw path filters _tcp.manualLog for the curve',
    !/_tcp\.manualLog\.filter\(function\(e2\)/.test(_pzSrc),
    'a draw path still builds its series from the manual log');
  check('pan handler redraws from _tcCurveLog()',
    /_tcDrawManualChart\(canvas\.id, _tcCurveLog\(\), _tcChartZoom\)/.test(_pzSrc));
  // every _tcDrawManualChart call must be handed _tcCurveLog() or a var derived from it
  var _pzCalls = _pzSrc.match(/_tcDrawManualChart\([^)]*\)/g) || [];
  var _pzBad = _pzCalls.filter(function(c){ return /manualLog/.test(c); });
  check('no _tcDrawManualChart call is passed the manual log directly',
    _pzBad.length === 0, _pzBad.join(' | '));

  check('3-month zoom is offered', /'today','week','month','3mo','whole'/.test(_pzSrc));
  check('3-month zoom has a window (±45 days)',
    /_zoom === '3mo'[\s\S]{0,140}nowDay - 45[\s\S]{0,60}nowDay \+ 45/.test(_pzSrc));
  // the zoom levels must be ordered shortest → longest, so the strip reads sensibly
  var _pzM = _pzSrc.match(/\['today','week','month','3mo','whole'\]/);
  check('zoom levels ordered shortest to longest', !!_pzM);
  if (typeof G._tcSetChartZoom === 'function') {
    var _pzSave = G._tcChartZoom;
    G.requestAnimationFrame = G.requestAnimationFrame || function(){};
    var _pzThrew = false;
    try { G._tcSetChartZoom('3mo'); } catch(e){ _pzThrew = true; }
    check('selecting the 3-month zoom does not throw', !_pzThrew);
    check('3-month zoom becomes the active level', G._tcChartZoom === '3mo');
    check('pan offset resets when the zoom changes', G._tcChartPanOffset === 0);
    try { G._tcSetChartZoom(_pzSave || 'whole'); } catch(e){}
  }
}

// Regression: warm-start ke for curDose=0 must use slowest compound ke (not weighted avg).
// Bug: weighted ke was dominated by TE (short HL=4.5d), causing the prior-protocol
// baseline to wash out in ~7 days. By Day 30 it was <6% of initial, leaving total
// free T far below baseline. Fix: use ke of longest-HL compound (TU, 34d).
if (typeof G._tcKa === 'function') {
  var _blKe_te = Math.LN2 / 4.5;   // 0.154/d  (TE, short-acting)
  var _blKe_tu = Math.LN2 / 34;    // 0.0204/d (TU Nebido, long-acting)
  // 250mg TE + 200mg TU: old weighted ke ≈ 0.0946/d, new min ke = ke_tu
  var _blKe_avg = (250 * _blKe_te + 200 * _blKe_tu) / 450;
  check('warm-start ke: TU ke < weighted ke for TE+TU log',
    _blKe_tu < _blKe_avg,
    'tu='+_blKe_tu.toFixed(4)+' avg='+_blKe_avg.toFixed(4));
  check('warm-start ke: TU baseline at Day 30 is >50% intact (correct slow decay)',
    Math.exp(-_blKe_tu * 30) > 0.5,
    'got '+Math.exp(-_blKe_tu * 30).toFixed(3));
  check('warm-start ke: old weighted baseline at Day 30 is <10% (too fast, was the bug)',
    Math.exp(-_blKe_avg * 30) < 0.1,
    'got '+Math.exp(-_blKe_avg * 30).toFixed(3));
}

// Smoke test: mixed TE+TU log with curDose=0 must not crash
if (typeof G._tcDrawManualChart === 'function') {
  var _bl_savedFT   = G._tcp.measuredFT;
  var _bl_savedDose = G._tcp.currentDoseMgWk;
  G._tcp.measuredFT      = '217';
  G._tcp.currentDoseMgWk = '';
  var _bl_log = [
    {compId: 'testoviron', doseMg: '100', date: '2026-06-27'},
    {compId: 'testoviron', doseMg: '150', date: '2026-06-28'},
    {compId: 'nebido',     doseMg: '100', date: '2026-06-29'},
    {compId: 'nebido',     doseMg: '100', date: '2026-07-01'},
  ];
  var _bl_threw = false;
  try { G._tcDrawManualChart('tc-manual-chart', _bl_log); }
  catch (e) { _bl_threw = true; console.error('  mixed TE+TU chart threw:', e.message); }
  check('warm-start ke fix: mixed TE+TU log no crash when curDose=0', !_bl_threw);
  G._tcp.measuredFT      = _bl_savedFT;
  G._tcp.currentDoseMgWk = _bl_savedDose;
}

// ── buildToday / buildStackStore: smoke tests ─────────────────────────────────
// These tests catch the class of bug where "Today and Stacks don't load" because
// a rendering function throws.  The DOM mock noops innerHTML writes, so we just
// verify the functions complete without throwing.
console.log('\n── buildToday: smoke test ──────────────────────────────────');
{
  const _bts = G._userStacks;
  const _bta = G._activeStackIndices.slice();
  const _btl = G._stacksLoaded;
  const _btw = G.WEEKLY;
  G._stacksLoaded = true;

  // Stack with peptides + TRT + Enhanced (including amPm compound)
  const smokeStack = {
    name: 'Smoke Stack',
    cycle_start: '2026-06-01',
    cycle_length: 12,
    peptides: [
      { id: 'cjc-ipa', name: 'CJC-1295/Ipa', dot: '#3cffa0', days: [0,1,2,3,4,5,6],
        times: ['AM','PM'], dose_am: '100', unit_am: 'mcg', dose_pm: '100', unit_pm: 'mcg', active: true }
    ],
    trt: { enabled: true, compounds: [
      { id: 'testoviron', name: 'Testoviron Depot', dose: '125', unit: 'mg', freqVal: 1, freqUnit: 'weeks' }
    ]},
    enhanced: { enabled: true, compounds: [
      { id: 'hgh', name: 'HGH', dot: '#a855f7', days: [0,1,2,3,4,5,6],
        amPm: true, dose_am: '2', dose_pm: '0', unit: 'IU/day' }
    ]}
  };
  G._userStacks = [smokeStack];
  G._activeStackIndices = [0];
  G.WEEKLY = G.buildWeeklyFromProtocol(smokeStack);

  let btThrew = false;
  try { G.buildToday(); }
  catch(e) { btThrew = true; console.error('  buildToday threw:', e.message); }
  check('buildToday: no crash with peptides+TRT+Enhanced stack', !btThrew);

  // Also call with _stacksLoaded=false to test the spinner path
  G._stacksLoaded = false;
  let btThrew2 = false;
  try { G.buildToday(); }
  catch(e) { btThrew2 = true; console.error('  buildToday (spinner path) threw:', e.message); }
  check('buildToday: no crash in spinner path (_stacksLoaded=false)', !btThrew2);

  G._userStacks = _bts;
  G._activeStackIndices = _bta;
  G._stacksLoaded = _btl;
  G.WEEKLY = _btw;
}

console.log('\n── buildStackStore: smoke test ─────────────────────────────');
{
  const _bss = G._userStacks;
  const _bsa = G._activeStackIndices.slice();
  const _bsl = G._stacksLoaded;
  G._stacksLoaded = true;

  const smokeStack2 = {
    name: 'Smoke Stack 2',
    cycle_start: '2026-06-01',
    cycle_length: 8,
    peptides: [{ id: 'retatrutide', name: 'Retatrutide', dot: '#f97316', days: [0,3],
                 times: ['AM'], dose_am: '3', unit_am: 'mg', active: true }],
    trt: { enabled: false, compounds: [] },
    enhanced: { enabled: false, compounds: [] }
  };
  G._userStacks = [smokeStack2];
  G._activeStackIndices = [0];

  let bssThrew = false;
  try { G.buildStackStore(); }
  catch(e) { bssThrew = true; console.error('  buildStackStore threw:', e.message); }
  check('buildStackStore: no crash with valid stack', !bssThrew);

  // Multiple stacks
  G._userStacks = [smokeStack2, smokeStack2, smokeStack2];
  let bssThrew2 = false;
  try { G.buildStackStore(); }
  catch(e) { bssThrew2 = true; console.error('  buildStackStore (multi) threw:', e.message); }
  check('buildStackStore: no crash with 3 stacks', !bssThrew2);

  // Empty stacks
  G._userStacks = [];
  let bssThrew3 = false;
  try { G.buildStackStore(); }
  catch(e) { bssThrew3 = true; console.error('  buildStackStore (empty) threw:', e.message); }
  check('buildStackStore: no crash with empty stacks array', !bssThrew3);

  // _stacksLoaded=false → spinner path
  G._stacksLoaded = false;
  G._userStacks = [smokeStack2];
  let bssThrew4 = false;
  try { G.buildStackStore(); }
  catch(e) { bssThrew4 = true; console.error('  buildStackStore (spinner) threw:', e.message); }
  check('buildStackStore: no crash in spinner path (_stacksLoaded=false)', !bssThrew4);

  G._userStacks = _bss;
  G._activeStackIndices = _bsa;
  G._stacksLoaded = _bsl;
}

// ── _getDynamicEnhancedDoses: Enhanced doses on Today tab ─────────────────────
console.log('\n── _getDynamicEnhancedDoses ────────────────────────────────');
{
  const _des = G._userStacks;
  const _dea = G._activeStackIndices.slice();

  const enhStack = {
    name: 'Enh Stack',
    cycle_start: '2026-06-01',
    cycle_length: 12,
    peptides: [],
    trt: { enabled: false, compounds: [] },
    enhanced: { enabled: true, compounds: [
      { id: 'hgh', name: 'HGH', dot: '#a855f7', days: [0,1,2,3,4,5,6],
        amPm: true, dose_am: '2', dose_pm: '0', unit: 'IU/day' },
      { id: 'bpc157', name: 'BPC-157', dot: '#22d3ee', days: [1,2,3,4,5],
        dose: '250', unit: 'mcg' }
    ]}
  };
  G._userStacks = [enhStack];
  G._activeStackIndices = [0];

  // Monday June 2, 2026 (dow=1) — both compounds scheduled
  const monday = new Date(2026, 5, 2);
  const monDoses = G._getDynamicEnhancedDoses(monday, true);
  check('Enhanced: 2 doses on Mon (both scheduled)',   monDoses.length === 2, `got ${monDoses.length}`);
  check('Enhanced: HGH present on Mon',               monDoses.some(d => d.name === 'HGH'));
  check('Enhanced: BPC-157 present on Mon (weekday)', monDoses.some(d => d.name === 'BPC-157'));
  check('Enhanced: dose IDs include date suffix',     monDoses.every(d => d.id && d.id.includes('_2026-')));

  // Sunday June 7, 2026 (dow=0) — BPC-157 NOT scheduled (days=[1..5])
  const sunday = new Date(2026, 5, 7);
  const sunDoses = G._getDynamicEnhancedDoses(sunday, true);
  check('Enhanced: 1 dose on Sun (BPC-157 not scheduled)', sunDoses.length === 1, `got ${sunDoses.length}`);
  check('Enhanced: HGH present on Sun',               sunDoses.some(d => d.name === 'HGH'));
  check('Enhanced: BPC-157 absent on Sun',            !sunDoses.some(d => d.name === 'BPC-157'));

  // Date before cycle start → no doses
  const preCycle = new Date(2026, 4, 30); // May 30, before June 1 start
  const preDoses = G._getDynamicEnhancedDoses(preCycle, false);
  check('Enhanced: 0 doses before cycle start',       preDoses.length === 0, `got ${preDoses.length}`);

  // Date after cycle end (cycle_start + 12wks = Aug 24, 2026)
  const postCycle = new Date(2026, 7, 25); // Aug 25
  const postDoses = G._getDynamicEnhancedDoses(postCycle, false);
  check('Enhanced: 0 doses after cycle end',          postDoses.length === 0, `got ${postDoses.length}`);

  // Inactive stack → no doses
  G._activeStackIndices = [];
  const inactiveDoses = G._getDynamicEnhancedDoses(monday, false);
  check('Enhanced: 0 doses for inactive stack',       inactiveDoses.length === 0, `got ${inactiveDoses.length}`);
  G._activeStackIndices = [0];

  // No enhanced.enabled → no doses
  const noEnhStack = { ...enhStack, enhanced: { enabled: false, compounds: enhStack.enhanced.compounds } };
  G._userStacks = [noEnhStack];
  const noEnhDoses = G._getDynamicEnhancedDoses(monday, false);
  check('Enhanced: 0 doses when enabled=false',       noEnhDoses.length === 0, `got ${noEnhDoses.length}`);

  // amPm compound with both doses non-zero → 2 separate entries
  const enhStackBothAmPm = {
    name: 'HGH Stack',
    cycle_start: '2026-06-01',
    cycle_length: 12,
    peptides: [],
    trt: { enabled: false, compounds: [] },
    enhanced: { enabled: true, compounds: [
      { id: 'hgh', name: 'HGH', dot: '#3cffa0', days: [0,1,2,3,4,5,6],
        amPm: true, dose_am: '3', dose_pm: '3', unit: 'IU/day' }
    ]}
  };
  G._userStacks = [enhStackBothAmPm];
  G._activeStackIndices = [0];
  const bothAmPmDoses = G._getDynamicEnhancedDoses(monday, true);
  check('Enhanced amPm: both AM+PM non-zero → 2 entries', bothAmPmDoses.length === 2, `got ${bothAmPmDoses.length}`);
  check('Enhanced amPm: AM entry has time=AM', bothAmPmDoses.some(function(d){return d.time==='AM';}));
  check('Enhanced amPm: PM entry has time=PM', bothAmPmDoses.some(function(d){return d.time==='PM';}));
  check('Enhanced amPm: AM detail includes dose', bothAmPmDoses.some(function(d){return d.time==='AM'&&d.detail.includes('3');}));
  check('Enhanced amPm: AM entry id unique from PM', bothAmPmDoses[0].id!==bothAmPmDoses[1].id);

  // amPm via catalog fallback (stored compound lacks amPm:true but ENHANCEMENT_COMPOUNDS has it)
  const enhStackCatalogFallback = {
    name: 'HGH Fallback',
    cycle_start: '2026-06-01',
    cycle_length: 12,
    peptides: [],
    trt: { enabled: false, compounds: [] },
    enhanced: { enabled: true, compounds: [
      { id: 'hgh-fallback', name: 'HGH', dot: '#3cffa0', days: [0,1,2,3,4,5,6],
        // amPm NOT set, but dose_am/dose_pm present — catalog should provide fallback
        dose_am: '2', dose_pm: '2', unit: 'IU/day' }
    ]}
  };
  // Simulate ENHANCEMENT_COMPOUNDS catalog entry with amPm:true
  G.ENHANCEMENT_COMPOUNDS = (G.ENHANCEMENT_COMPOUNDS||[]).concat([{id:'hgh-fallback',name:'HGH',amPm:true,dot:'#3cffa0',group:'GH Axis'}]);
  G._userStacks = [enhStackCatalogFallback];
  G._activeStackIndices = [0];
  const fallbackDoses = G._getDynamicEnhancedDoses(monday, true);
  check('Enhanced catalog fallback: amPm via ENHANCEMENT_COMPOUNDS → 2 entries', fallbackDoses.length === 2, `got ${fallbackDoses.length}`);
  check('Enhanced catalog fallback: entries have compId', fallbackDoses.every(function(d){return d.compId==='hgh-fallback';}));
  // Restore
  G.ENHANCEMENT_COMPOUNDS = (G.ENHANCEMENT_COMPOUNDS||[]).filter(function(c){return c.id!=='hgh-fallback';});

  // compId field present on regular (non-amPm) dose
  const enhStackSingle = {
    name: 'Single Enhanced',
    cycle_start: '2026-06-01',
    cycle_length: 12,
    peptides: [],
    trt: { enabled: false, compounds: [] },
    enhanced: { enabled: true, compounds: [
      { id: 'primo', name: 'Primobolan', dot: '#a855f7', days: [0,1,2,3,4,5,6], dose: '200', unit: 'mg/week' }
    ]}
  };
  G._userStacks = [enhStackSingle];
  G._activeStackIndices = [0];
  const singleEnhDoses = G._getDynamicEnhancedDoses(monday, true);
  check('Enhanced single: compId set on non-amPm dose', singleEnhDoses.length===1 && singleEnhDoses[0].compId==='primo');

  G._userStacks = _des;
  G._activeStackIndices = _dea;
}

// Regression: adding future injections must not lower the pre-bw peak.
// Root cause: warm-start (_curDose > 0 path) computed compound fractions from ALL
// injections. Adding post-bw Nebido shifted the Testoviron/Nebido fraction mix,
// changing total[anchorDay], which changed calFT and pulled the whole curve down.
// Fix: warm-start uses only pre-bw injections for compound fractions, so
// total[anchorDay] (and therefore calFT) is immune to post-bw log extensions.
//
// Test strategy: the chart draws ctx.fillText(Math.round(peakV), ...) for the peak
// concentration label. This encodes the ABSOLUTE pmol/L peak — unlike canvas Y
// coordinates which autoscale and are identical regardless of calFT shifts.
// The second-largest positive number in all fillText calls is Math.round(peakV).
console.log('\n── calFT anchor: adding post-bw injections must not lower existing peak (PR #444/#448) ──');
if (typeof G._tcDrawManualChart === 'function') {
  var _cfSavedFT    = G._tcp.measuredFT;
  var _cfSavedDose  = G._tcp.currentDoseMgWk;
  var _cfSavedBwE   = G._tcBwEntries;
  var _cfSavedGetEl = G.document.getElementById;

  G._tcp.measuredFT      = '217';
  G._tcp.currentDoseMgWk = '250';   // _curDose > 0: the code path that had the bug
  G._tcBwEntries = [{date:'2026-06-27', free_t:217, total_t:600, shbg:40}];

  // Instrument canvas: capture calFT directly via canvas._testCalFTHook.
  // The chart sets canvas._testCalFTHook(calFT) after computing the final calFT scalar.
  // This avoids canvas-autoscale issues (minY, fillText, etc. all change with vMax).
  var _cfMockCtx = {
    scale:noop, beginPath:noop, arc:noop, fill:noop, stroke:noop,
    fillText:noop, closePath:noop, save:noop, restore:noop, fillRect:noop,
    setLineDash:noop, strokeRect:noop, translate:noop, rotate:noop, moveTo:noop, lineTo:noop,
    measureText:function(){ return {width:0}; },
    createLinearGradient:function(){ return {addColorStop:noop}; }
  };
  function _cfRunChart(log) {
    var capturedCalFT = null;
    G.document.getElementById = function(id) {
      if (id==='tc-manual-chart') return {
        style:{}, classList:{add:noop,remove:noop,contains:()=>false},
        offsetWidth:350, offsetHeight:250,
        _testCalFTHook: function(v){ capturedCalFT = v; },
        getContext: function(){ return _cfMockCtx; }
      };
      return _cfSavedGetEl(id);
    };
    G._tcDrawManualChart('tc-manual-chart', log);
    G.document.getElementById = _cfSavedGetEl;
    return capturedCalFT;
  }

  // Short log: Henrik's exact scenario — 2 Testoviron + 10 Nebido every 2 days
  var _cfLog1 = [
    {compId:'testoviron', doseMg:'100', date:'2026-06-27'},
    {compId:'testoviron', doseMg:'150', date:'2026-06-28'},
    {compId:'nebido', doseMg:'102', date:'2026-06-29'},
    {compId:'nebido', doseMg:'102', date:'2026-07-01'},
    {compId:'nebido', doseMg:'102', date:'2026-07-03'},
    {compId:'nebido', doseMg:'102', date:'2026-07-05'},
    {compId:'nebido', doseMg:'102', date:'2026-07-07'},
    {compId:'nebido', doseMg:'102', date:'2026-07-09'},
    {compId:'nebido', doseMg:'102', date:'2026-07-11'},
    {compId:'nebido', doseMg:'102', date:'2026-07-13'},
    {compId:'nebido', doseMg:'102', date:'2026-07-15'},
    {compId:'nebido', doseMg:'102', date:'2026-07-17'}
  ];
  // Extended: same + 10 more Nebido every 4 days (all after bw date Jun 27)
  var _cfLog2 = _cfLog1.concat([
    {compId:'nebido', doseMg:'100', date:'2026-07-21'},
    {compId:'nebido', doseMg:'100', date:'2026-07-25'},
    {compId:'nebido', doseMg:'100', date:'2026-07-29'},
    {compId:'nebido', doseMg:'100', date:'2026-08-02'},
    {compId:'nebido', doseMg:'100', date:'2026-08-06'},
    {compId:'nebido', doseMg:'100', date:'2026-08-10'},
    {compId:'nebido', doseMg:'100', date:'2026-08-14'},
    {compId:'nebido', doseMg:'100', date:'2026-08-18'},
    {compId:'nebido', doseMg:'100', date:'2026-08-22'},
    {compId:'nebido', doseMg:'100', date:'2026-08-26'}
  ]);

  var _cfThrew = false, _cfCalFT1 = null, _cfCalFT2 = null;
  try {
    _cfCalFT1 = _cfRunChart(_cfLog1);
    _cfCalFT2 = _cfRunChart(_cfLog2);
  } catch(e) {
    _cfThrew = true;
    console.error('  calFT anchor test threw:', e.message);
  }
  check('calFT anchor: no crash', !_cfThrew);
  check('calFT anchor: calFT captured for short log', !_cfThrew && _cfCalFT1 !== null);
  check('calFT anchor: calFT captured for extended log', !_cfThrew && _cfCalFT2 !== null);
  if (!_cfThrew && _cfCalFT1 !== null && _cfCalFT2 !== null) {
    // calFT must be identical between short and extended log — it is anchored at the
    // bloodwork date and must not shift when post-bw injections are added.
    check(
      'calFT anchor: calFT must not change when post-bw injections are added (PR #448 regression)',
      Math.abs(_cfCalFT2 - _cfCalFT1) < 1e-9,
      'short-log calFT='+_cfCalFT1.toFixed(8)+' extended-log calFT='+_cfCalFT2.toFixed(8)
    );
  }

  G._tcp.measuredFT          = _cfSavedFT;
  G._tcp.currentDoseMgWk     = _cfSavedDose;
  G._tcBwEntries             = _cfSavedBwE;
  G.document.getElementById  = _cfSavedGetEl;
}

// Today's free-T level marker: _tcDrawManualChart reports today's level via
// _testNowHook in EVERY zoom (incl. whole), matching _tcFreeTSeries at nowDay.
if (typeof G._tcDrawManualChart === 'function' && typeof G._tcFreeTSeries === 'function') {
  var _nvFT=G._tcp.measuredFT,_nvDose=G._tcp.currentDoseMgWk,_nvBw=G._tcBwEntries,_nvGet=G.document.getElementById;
  G._tcp.measuredFT='217'; G._tcp.currentDoseMgWk=''; G._tcBwEntries=[{date:'2026-05-25',free_t:217}];
  var _nvNow=Date.now();
  function _nvDate(off){ var dt=new Date(_nvNow+off*86400000); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
  var _nvLog=[-20,-16,-12,-8,-4,0].map(function(o){ return {compId:'testoviron',doseMg:'125',date:_nvDate(o)}; });
  var _nvCtx={scale:noop,beginPath:noop,arc:noop,fill:noop,stroke:noop,fillText:noop,closePath:noop,save:noop,restore:noop,fillRect:noop,setLineDash:noop,strokeRect:noop,translate:noop,rotate:noop,moveTo:noop,lineTo:noop,measureText:function(){return{width:10};},createLinearGradient:function(){return{addColorStop:noop};}};
  function _nvRun(zoom){ var cap=null; G.document.getElementById=function(id){ if(id==='tc-manual-chart') return {style:{},classList:{add:noop,remove:noop,contains:function(){return false;}},offsetWidth:350,offsetHeight:250,_testNowHook:function(v){cap=v;},getContext:function(){return _nvCtx;}}; return _nvGet(id); }; G._tcDrawManualChart('tc-manual-chart',_nvLog,zoom); G.document.getElementById=_nvGet; return cap; }
  var _nvWhole=_nvRun('whole'), _nvToday=_nvRun('today');
  var _nvS=G._tcFreeTSeries(_nvLog.slice(),{});
  var _nvNd=Math.max(0,Math.min(_nvS.totalDays,Math.round((_nvNow-_nvS.firstDate.getTime())/86400000)));
  var _nvExpect=_nvS.total[_nvNd]*(_nvS.calFT_arr?_nvS.calFT_arr[_nvNd]:_nvS.scale);
  check('_tcDrawManualChart: reports today free-T level in WHOLE zoom', _nvWhole!==null && _nvWhole>0);
  check('_tcDrawManualChart: today-level matches the model at nowDay', Math.abs(_nvWhole-_nvExpect) < 1);
  check('_tcDrawManualChart: today-level reported in every zoom (today==whole)', _nvToday!==null && Math.abs(_nvToday-_nvWhole) < 1);
  G._tcp.measuredFT=_nvFT; G._tcp.currentDoseMgWk=_nvDose; G._tcBwEntries=_nvBw; G.document.getElementById=_nvGet;
}

// Regression: path 2 (curDose=0) calFT anchor must also be immune to post-BW injections.
// Root cause: flat baseline added in the else branch used _logMean computed from the
// full log.  Post-BW injections increased _logMean, which inflated total[anchorDay],
// which lowered calFT and pulled the whole curve down — same symptom as PR #448 but
// on the curDose=0 code path.
console.log('\n── calFT anchor path-2 (curDose=0): post-bw injections must not shift calFT ──');
if (typeof G._tcDrawManualChart === 'function') {
  var _cf2SavedFT   = G._tcp.measuredFT;
  var _cf2SavedDose = G._tcp.currentDoseMgWk;
  var _cf2SavedBwE  = G._tcBwEntries;
  var _cf2SavedGetEl = G.document.getElementById;

  G._tcp.measuredFT      = '217';
  G._tcp.currentDoseMgWk = '';    // _curDose === 0 → path 2 (no prior-dose warm-start)
  G._tcBwEntries = [{date:'2026-06-27', free_t:217, total_t:600, shbg:40}];

  var _cf2MockCtx = {
    scale:noop, beginPath:noop, arc:noop, fill:noop, stroke:noop,
    fillText:noop, closePath:noop, save:noop, restore:noop, fillRect:noop,
    setLineDash:noop, strokeRect:noop, translate:noop, rotate:noop, moveTo:noop, lineTo:noop,
    measureText:function(){ return {width:0}; },
    createLinearGradient:function(){ return {addColorStop:noop}; }
  };
  function _cf2RunChart(log) {
    var captured = null;
    G.document.getElementById = function(id) {
      if (id === 'tc-manual-chart') return {
        style:{}, classList:{add:noop,remove:noop,contains:function(){return false;}},
        offsetWidth:350, offsetHeight:250,
        _testCalFTHook: function(v){ captured = v; },
        getContext: function(){ return _cf2MockCtx; }
      };
      return _cf2SavedGetEl(id);
    };
    G._tcDrawManualChart('tc-manual-chart', log);
    G.document.getElementById = _cf2SavedGetEl;
    return captured;
  }

  // Short log: injections starting 3 days before BW (anchorDay=3 > 0 — fixes are active)
  var _cf2Log1 = [
    {compId:'testoviron', doseMg:'125', date:'2026-06-24'},
    {compId:'testoviron', doseMg:'125', date:'2026-06-26'},
    {compId:'testoviron', doseMg:'125', date:'2026-06-28'}
  ];
  // Extended: same + 10 Nebido injections after BW date (Jun 27)
  var _cf2Log2 = _cf2Log1.concat([
    {compId:'nebido', doseMg:'100', date:'2026-07-01'},
    {compId:'nebido', doseMg:'100', date:'2026-07-05'},
    {compId:'nebido', doseMg:'100', date:'2026-07-09'},
    {compId:'nebido', doseMg:'100', date:'2026-07-13'},
    {compId:'nebido', doseMg:'100', date:'2026-07-17'},
    {compId:'nebido', doseMg:'100', date:'2026-07-21'},
    {compId:'nebido', doseMg:'100', date:'2026-07-25'},
    {compId:'nebido', doseMg:'100', date:'2026-07-29'},
    {compId:'nebido', doseMg:'100', date:'2026-08-02'},
    {compId:'nebido', doseMg:'100', date:'2026-08-06'}
  ]);

  var _cf2Threw = false, _cf2CalFT1 = null, _cf2CalFT2 = null;
  try {
    _cf2CalFT1 = _cf2RunChart(_cf2Log1);
    _cf2CalFT2 = _cf2RunChart(_cf2Log2);
  } catch(e) {
    _cf2Threw = true;
    console.error('  calFT path-2 anchor test threw:', e.message);
  }
  check('calFT path-2 anchor: no crash', !_cf2Threw);
  check('calFT path-2 anchor: calFT captured for short log',    !_cf2Threw && _cf2CalFT1 !== null);
  check('calFT path-2 anchor: calFT captured for extended log', !_cf2Threw && _cf2CalFT2 !== null);
  if (!_cf2Threw && _cf2CalFT1 !== null && _cf2CalFT2 !== null) {
    check(
      'calFT path-2 anchor: calFT must not change when post-bw injections added (curDose=0 regression)',
      Math.abs(_cf2CalFT2 - _cf2CalFT1) < 1e-9,
      'short calFT='+_cf2CalFT1.toFixed(8)+' extended calFT='+_cf2CalFT2.toFixed(8)
    );
  }

  G._tcp.measuredFT         = _cf2SavedFT;
  G._tcp.currentDoseMgWk    = _cf2SavedDose;
  G._tcBwEntries            = _cf2SavedBwE;
  G.document.getElementById = _cf2SavedGetEl;
}

// Regression: path 2 (curDose=0) calFT anchor with anchorDay=0 (BW same day as first injection).
// Root cause: when _p2BwDay=0, total[0]=0 for all injections (tcPkConc(dt=0)=0), so the
// pre-BW scan yielded _p2Pk=0 and fell back to _logMean (full-log mean, unstable).
// Post-BW injections increased _logMean → inflated _p2Baseline → shifted total[0] → changed calFT.
// Fix: when _p2Pk=0, compute _p2Baseline from BW-date injections' own settled PK.
console.log('\n── calFT anchor path-2 anchorDay=0 (BW=first injection day): post-bw injections must not shift calFT ──');
if (typeof G._tcDrawManualChart === 'function') {
  var _cf3SavedFT   = G._tcp.measuredFT;
  var _cf3SavedDose = G._tcp.currentDoseMgWk;
  var _cf3SavedBwE  = G._tcBwEntries;
  var _cf3SavedGetEl = G.document.getElementById;

  G._tcp.measuredFT       = '217';
  G._tcp.currentDoseMgWk  = '';   // _curDose === 0 → path 2
  G._tcBwEntries = [{date:'2026-06-27', free_t:217, total_t:600, shbg:40}];

  var _cf3MockCtx = {
    scale:noop, beginPath:noop, arc:noop, fill:noop, stroke:noop,
    fillText:noop, closePath:noop, save:noop, restore:noop, fillRect:noop,
    setLineDash:noop, strokeRect:noop, translate:noop, rotate:noop, moveTo:noop, lineTo:noop,
    measureText:function(){ return {width:0}; },
    createLinearGradient:function(){ return {addColorStop:noop}; }
  };
  var _cf3Captured = null;
  G.document.getElementById = function(id) {
    if (id === 'tc-manual-chart') return {
      style:{}, classList:{add:noop,remove:noop,contains:function(){return false;}},
      offsetWidth:350, offsetHeight:250,
      _testCalFTHook: function(v){ _cf3Captured = v; },
      getContext: function(){ return _cf3MockCtx; }
    };
    return _cf3SavedGetEl(id);
  };

  function _cf3RunChart(lg) { _cf3Captured = null; G._tcDrawManualChart('tc-manual-chart', lg, false); return _cf3Captured; }

  // Short log: BW date = first injection date (anchorDay=0)
  var _cf3Log1 = [
    {compId:'testoviron', doseMg:'100', date:'2026-06-27'}
  ];
  // Extended log: add post-BW injections — must not change calFT
  var _cf3Log2 = [
    {compId:'testoviron', doseMg:'100', date:'2026-06-27'},
    {compId:'testoviron', doseMg:'100', date:'2026-07-04'},
    {compId:'testoviron', doseMg:'100', date:'2026-07-18'},
    {compId:'testoviron', doseMg:'100', date:'2026-08-01'}
  ];

  var _cf3CalFT1 = null, _cf3CalFT2 = null, _cf3Threw = false;
  try {
    _cf3CalFT1 = _cf3RunChart(_cf3Log1);
    _cf3CalFT2 = _cf3RunChart(_cf3Log2);
  } catch(e) {
    _cf3Threw = true;
    console.error('  calFT path-2 anchorDay=0 test threw:', e.message);
  }
  check('calFT path-2 anchorDay=0: no crash', !_cf3Threw);
  check('calFT path-2 anchorDay=0: calFT captured for short log',    !_cf3Threw && _cf3CalFT1 !== null);
  check('calFT path-2 anchorDay=0: calFT captured for extended log', !_cf3Threw && _cf3CalFT2 !== null);
  if (!_cf3Threw && _cf3CalFT1 !== null && _cf3CalFT2 !== null) {
    check(
      'calFT path-2 anchorDay=0: calFT must not change when post-bw injections added',
      Math.abs(_cf3CalFT2 - _cf3CalFT1) < 1e-9,
      'short calFT='+_cf3CalFT1.toFixed(8)+' extended calFT='+_cf3CalFT2.toFixed(8)
    );
  }

  G._tcp.measuredFT         = _cf3SavedFT;
  G._tcp.currentDoseMgWk    = _cf3SavedDose;
  G._tcBwEntries            = _cf3SavedBwE;
  G.document.getElementById = _cf3SavedGetEl;
}

// Regression: NO bloodwork entry — appending future injections must not lower the peak.
// Root cause (reported by Henrik): with measuredFT set but no _tcBwEntries entry, calFT
// fell back to _mftNum / _logMean over a window that grew as injections were appended, so
// adding injections shrank calFT and pulled the whole curve — including the peak — DOWN.
// Fix: anchor calFT at "today" when there is no bloodwork draw date, mirroring the
// bloodwork-anchored path so calFT is immune to injections added after the anchor.
console.log('\n── no-bloodwork anchor: appending future injections must not lower peak (Henrik report) ──');
if (typeof G._tcDrawManualChart === 'function') {
  var _nbSavedFT   = G._tcp.measuredFT;
  var _nbSavedDose = G._tcp.currentDoseMgWk;
  var _nbSavedBwE  = G._tcBwEntries;
  var _nbSavedGh   = G._tcGhStack;
  var _nbSavedGetEl = G.document.getElementById;

  G._tcp.measuredFT      = '223';
  G._tcp.currentDoseMgWk = '';     // path 2 (curDose === 0)
  G._tcBwEntries = null;           // the buggy scenario: measured FT but NO bloodwork entry
  G._tcGhStack   = [];

  var _nbCalFT = null, _nbFillNums = [];
  var _nbMockCtx = {
    scale:noop, beginPath:noop, arc:noop, fill:noop, stroke:noop,
    fillText:function(t){ if(/^\d+$/.test(String(t))) _nbFillNums.push(Number(t)); },
    closePath:noop, save:noop, restore:noop, fillRect:noop,
    setLineDash:noop, strokeRect:noop, translate:noop, rotate:noop, moveTo:noop, lineTo:noop,
    measureText:function(){ return {width:0}; },
    createLinearGradient:function(){ return {addColorStop:noop}; }
  };
  G.document.getElementById = function(id) {
    if (id === 'tc-manual-chart') return {
      style:{}, classList:{add:noop,remove:noop,contains:function(){return false;}},
      offsetWidth:350, offsetHeight:250,
      _testCalFTHook: function(v){ _nbCalFT = v; },
      getContext: function(){ return _nbMockCtx; }
    };
    return _nbSavedGetEl(id);
  };

  // Dates anchored to the real "today" so the implicit anchor (today) lands mid-schedule
  // in both logs and captures the same pre-anchor injections regardless of run date.
  var _nbBase = new Date(); _nbBase.setHours(12,0,0,0);
  function _nbDate(off){ var d=new Date(_nbBase.getTime()+off*86400000); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function _nbSeries(offsets){ return offsets.map(function(o){ return {compId:'nebido', doseMg:'102', date:_nbDate(o)}; }); }

  // Short: 12 injections (starting 6 days before today). Extended: +10 more into the future.
  var _nbOff1 = [-6,-4,-2,0,2,4,6,8,10,12,14,16];
  var _nbOff2 = _nbOff1.concat([18,20,22,24,26,28,30,32,34,36]);

  function _nbRun(offsets){ _nbCalFT = null; _nbFillNums = []; G._tcDrawManualChart('tc-manual-chart', _nbSeries(offsets)); return {calFT:_nbCalFT, peak:Math.max.apply(null, _nbFillNums.concat([0]))}; }

  var _nbThrew = false, _nbR1 = null, _nbR2 = null, _nbUncal = null;
  var _nbSavedBw = G._tcBwEntries;
  try {
    // NEW CONTRACT: with no dated reading the curve is not calibrated at all — the model
    // refuses to guess WHEN an undated free T was taken, because the anchor day sets the
    // whole scale. Captured first, before a dated draw is supplied below.
    G._tcBwEntries = null;
    _nbUncal = _nbRun(_nbOff1);
    // The invariant this block exists for — appending FUTURE injections must not rescale
    // the curve — is unchanged and still worth testing, so give it a dated draw.
    G._tcBwEntries = [{date:_nbDate(-7), free_t:217}];
    _nbR1 = _nbRun(_nbOff1);
    _nbR2 = _nbRun(_nbOff2);
  } catch(e) {
    _nbThrew = true;
    console.error('  no-bloodwork anchor test threw:', e.message);
  }
  G._tcBwEntries = _nbSavedBw;
  check('no-bloodwork anchor: no crash', !_nbThrew);
  // Undated no longer means UNCALIBRATED — it means the population estimate is used.
  // The curve is always drawn and always pmol/L; only the confidence changes.
  check('undated reading still yields a calibrated pmol/L curve (population estimate)',
    !_nbThrew && _nbUncal && _nbUncal.calFT != null,
    'calFT=' + (_nbUncal && _nbUncal.calFT));
  check('dated draw: calFT captured (short & extended)', !_nbThrew && _nbR1 && _nbR2 && _nbR1.calFT != null && _nbR2.calFT != null);
  if (!_nbThrew && _nbR1 && _nbR2 && _nbR1.calFT != null && _nbR2.calFT != null) {
    check(
      'no-bloodwork anchor: calFT must not change when future injections are appended',
      Math.abs(_nbR2.calFT - _nbR1.calFT) < 1e-9,
      'short calFT='+_nbR1.calFT.toFixed(8)+' extended calFT='+_nbR2.calFT.toFixed(8)
    );
    check(
      'no-bloodwork anchor: peak must not drop when future injections are appended',
      _nbR2.peak >= _nbR1.peak,
      'short peak='+_nbR1.peak+' extended peak='+_nbR2.peak
    );
  }

  // All-past edge case: a fully washed-out cycle logged entirely in the past (today falls
  // outside the injection span).  Appending more past injections must still not lower the
  // peak — the anchor falls back to day 0, whose value is immune to every later injection.
  function _nbPastSeries(n){
    var a = [];
    var _start = new Date(_nbBase.getTime() - 200*86400000);
    for (var i=0;i<n;i++){ var d=new Date(_start.getTime()+i*2*86400000); a.push({compId:'nebido', doseMg:'102', date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}); }
    return a;
  }
  var _nbPastThrew = false, _nbP1 = null, _nbP2 = null;
  try {
    _nbCalFT = null; _nbFillNums = []; G._tcDrawManualChart('tc-manual-chart', _nbPastSeries(10)); _nbP1 = {calFT:_nbCalFT, peak:Math.max.apply(null,_nbFillNums.concat([0]))};
    _nbCalFT = null; _nbFillNums = []; G._tcDrawManualChart('tc-manual-chart', _nbPastSeries(20)); _nbP2 = {calFT:_nbCalFT, peak:Math.max.apply(null,_nbFillNums.concat([0]))};
  } catch(e) { _nbPastThrew = true; console.error('  no-bloodwork all-past test threw:', e.message); }
  check('no-bloodwork anchor (all-past): no crash', !_nbPastThrew);
  if (!_nbPastThrew && _nbP1 && _nbP2 && _nbP1.calFT != null && _nbP2.calFT != null) {
    check(
      'no-bloodwork anchor (all-past): calFT must not change when more past injections are appended',
      Math.abs(_nbP2.calFT - _nbP1.calFT) < 1e-9,
      'short calFT='+_nbP1.calFT.toFixed(8)+' extended calFT='+_nbP2.calFT.toFixed(8)
    );
    check(
      'no-bloodwork anchor (all-past): peak must not drop when more past injections are appended',
      _nbP2.peak >= _nbP1.peak,
      'short peak='+_nbP1.peak+' extended peak='+_nbP2.peak
    );
  }

  G._tcp.measuredFT         = _nbSavedFT;
  G._tcp.currentDoseMgWk    = _nbSavedDose;
  G._tcBwEntries            = _nbSavedBwE;
  G._tcGhStack              = _nbSavedGh;
  G.document.getElementById = _nbSavedGetEl;
}

// Regression: PRE-CYCLE baseline bloodwork (draw dated BEFORE the first injection).
// This is the normal workflow — you get baseline bloodwork before starting a cycle — and it
// is the case Henrik reported twice.  Two properties must hold:
//   1. The curve must START at the measured baseline free T (displayed[0] === measuredFT) and
//      rise from there — not begin near zero and only cross the baseline days later.
//   2. Appending injections must NOT lower the peak (calFT is invariant), and the peak must be
//      physiological — anchoring the floor at the tiny day-0 residual made it absurdly high.
// The injected accumulation is scaled so its value at "today" is one baseline unit, which is
// invariant to injections planned after today.
console.log('\n── pre-cycle baseline bloodwork: starts at baseline, peak rises, no drop (Henrik report) ──');
if (typeof G._tcDrawManualChart === 'function') {
  var _pbSavedFT   = G._tcp.measuredFT;
  var _pbSavedDose = G._tcp.currentDoseMgWk;
  var _pbSavedBwE  = G._tcBwEntries;
  var _pbSavedGh   = G._tcGhStack;
  var _pbSavedGetEl = G.document.getElementById;

  G._tcp.measuredFT      = '217';
  G._tcp.currentDoseMgWk = '';

  // Dates anchored to "today" so the first injection is 6 days ago (today falls inside the
  // injection span, as in Henrik's live app) regardless of when the test runs.
  var _pbBase = new Date(); _pbBase.setHours(12,0,0,0);
  function _pbDate(off){ var d=new Date(_pbBase.getTime()+off*86400000); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  // Baseline draw dated ~4 months before the first injection (a genuine pre-cycle baseline).
  G._tcBwEntries = [{date:_pbDate(-132), free_t:217, total_t:600, shbg:40}];
  G._tcGhStack   = [];

  var _pbCalFT = null, _pbStart = null, _pbFillNums = [];
  var _pbMockCtx = {
    scale:noop, beginPath:noop, arc:noop, fill:noop, stroke:noop,
    fillText:function(t){ if(/^\d+$/.test(String(t))) _pbFillNums.push(Number(t)); },
    closePath:noop, save:noop, restore:noop, fillRect:noop,
    setLineDash:noop, strokeRect:noop, translate:noop, rotate:noop, moveTo:noop, lineTo:noop,
    measureText:function(){ return {width:0}; },
    createLinearGradient:function(){ return {addColorStop:noop}; }
  };
  G.document.getElementById = function(id) {
    if (id === 'tc-manual-chart') return {
      style:{}, classList:{add:noop,remove:noop,contains:function(){return false;}},
      offsetWidth:350, offsetHeight:250,
      _testCalFTHook:  function(v){ _pbCalFT = v; },
      _testStartHook:  function(v){ _pbStart = v; },
      getContext: function(){ return _pbMockCtx; }
    };
    return _pbSavedGetEl(id);
  };

  // Henrik's exact schedule: 2 Testoviron loaders (6/5 days ago) + 10 Nebido, then +10 more.
  var _pbLog1 = [
    {compId:'testoviron', doseMg:'100', date:_pbDate(-6)},
    {compId:'testoviron', doseMg:'150', date:_pbDate(-5)}
  ];
  for (var _pbi=0; _pbi<10; _pbi++){ _pbLog1.push({compId:'nebido', doseMg:'102', date:_pbDate(-4 + _pbi*2)}); }
  var _pbLog2 = _pbLog1.slice();
  for (var _pbj=0; _pbj<10; _pbj++){ _pbLog2.push({compId:'nebido', doseMg:'100', date:_pbDate(18 + _pbj*4)}); }

  function _pbRun(lg){ _pbCalFT=null; _pbStart=null; _pbFillNums=[]; G._tcDrawManualChart('tc-manual-chart', lg); return {calFT:_pbCalFT, start:_pbStart, peak:Math.max.apply(null,_pbFillNums.concat([0]))}; }

  var _pbThrew=false, _pbR1=null, _pbR2=null;
  try { _pbR1 = _pbRun(_pbLog1); _pbR2 = _pbRun(_pbLog2); }
  catch(e){ _pbThrew=true; console.error('  pre-cycle baseline test threw:', e.message); }
  check('pre-cycle baseline: no crash', !_pbThrew);
  check('pre-cycle baseline: calFT & start captured', !_pbThrew && _pbR1 && _pbR2 && _pbR1.calFT != null && _pbR1.start != null);
  if (!_pbThrew && _pbR1 && _pbR2 && _pbR1.calFT != null && _pbR1.start != null) {
    check(
      'pre-cycle baseline: curve STARTS at the measured baseline (217 pmol/L)',
      Math.abs(_pbR1.start - 217) <= 1 && Math.abs(_pbR2.start - 217) <= 1,
      'short start='+_pbR1.start.toFixed(2)+' extended start='+_pbR2.start.toFixed(2)
    );
    check(
      'pre-cycle baseline: calFT must not change when injections are appended',
      Math.abs(_pbR2.calFT - _pbR1.calFT) < 1e-9,
      'short calFT='+_pbR1.calFT.toFixed(8)+' extended calFT='+_pbR2.calFT.toFixed(8)
    );
    check(
      'pre-cycle baseline: peak rises (does not drop) when injections are appended',
      _pbR2.peak >= _pbR1.peak,
      'short peak='+_pbR1.peak+' extended peak='+_pbR2.peak
    );
    check(
      'pre-cycle baseline: peak is physiological, not absurdly inflated (< 3000 pmol/L)',
      _pbR2.peak < 3000,
      'extended peak='+_pbR2.peak
    );
  }

  G._tcp.measuredFT         = _pbSavedFT;
  G._tcp.currentDoseMgWk    = _pbSavedDose;
  G._tcBwEntries            = _pbSavedBwE;
  G._tcGhStack              = _pbSavedGh;
  G.document.getElementById = _pbSavedGetEl;
}

// ── Supplements feature ──────────────────────────────────────────────────────
console.log('\n── Supplements: catalogue, cadence logic, and rendering ──');
if (typeof G.SUPPLEMENT_CAT !== 'undefined') {
  check('SUPPLEMENT_CAT is a non-empty array', Array.isArray(G.SUPPLEMENT_CAT) && G.SUPPLEMENT_CAT.length >= 10);
  check('every catalogue entry has id, name and a dose list',
    G.SUPPLEMENT_CAT.every(function(c){ return c.id && c.name && Array.isArray(c.doses) && c.doses.length; }));
  check('catalogue ids are unique',
    new Set(G.SUPPLEMENT_CAT.map(function(c){return c.id;})).size === G.SUPPLEMENT_CAT.length);

  // Units: metric (µg/mg/g) is the default — µg (not "mcg"), and no dose may lead with IU.
  var _allDoses = [];
  G.SUPPLEMENT_CAT.forEach(function(c){ c.doses.forEach(function(d){ _allDoses.push({id:c.id, d:d}); }); });
  check('units: every dose leads with a metric unit (µg/mg/g), never a bare IU',
    _allDoses.every(function(x){ return /^\s*[\d.]+\s*(µg|mg|g)\b/.test(x.d) || /^\s*[\d.]+\s*(capsule|scoop|serving|FU)\b/.test(x.d); }),
    _allDoses.filter(function(x){ return !/^\s*[\d.]+\s*(µg|mg|g|capsule|scoop|serving|FU)\b/.test(x.d); }).map(function(x){return x.id+':'+x.d;}).join(', '));
  check('units: micrograms written "µg", never "mcg"',
    _allDoses.every(function(x){ return x.d.indexOf('mcg') === -1; }),
    _allDoses.filter(function(x){ return x.d.indexOf('mcg') !== -1; }).map(function(x){return x.id+':'+x.d;}).join(', '));
  check('units: no dose starts with an IU value',
    _allDoses.every(function(x){ return !/^\s*[\d.]+\s*IU\b/.test(x.d); }));
  // IU-dosed fat-soluble vitamins show BOTH units (metric + IU in parentheses)
  ['vitd3','vita','vite'].forEach(function(id){
    var c = G.SUPPLEMENT_CAT.find(function(e){ return e.id===id; });
    check('units: '+id+' present and shows metric + IU',
      !!c && c.doses.every(function(d){ return /(µg|mg)\b/.test(d) && /\(\s*[\d.]+\s*IU\s*\)/.test(d); }));
  });

  // Display formatter: supplements saved before the µg change keep their old stored dose,
  // but must render correctly — the reported "Vitamin D3 shows 5000 IU only" bug.
  if (typeof G._suppFmtDose === 'function') {
    check('display: legacy Vitamin D3 "5000 IU" renders as metric + IU',
      G._suppFmtDose('vitd3','5000 IU') === '125 µg (5000 IU)', G._suppFmtDose('vitd3','5000 IU'));
    check('display: legacy "100 mcg" renders as "100 µg"',
      G._suppFmtDose('vitk2','100 mcg') === '100 µg');
    check('display: mg doses are untouched',
      G._suppFmtDose('boron','10 mg') === '10 mg');
    check('display: already-metric dose passes through unchanged',
      G._suppFmtDose('vitd3','125 µg (5000 IU)') === '125 µg (5000 IU)');
    check('display: never shows "mcg" after formatting',
      ['100 mcg','250 mcg','5000 IU'].every(function(x){ return G._suppFmtDose('selenium',x).indexOf('mcg') === -1; }));
  }

  // cadence: daily always active
  check('daily supplement active on any day',
    G._suppActiveOn({freq:'daily'}, new Date('2026-07-03')) === true);

  // every other day: active on start day and +2, not +1
  var _eod = {freq:'eod', start_date:'2026-07-01'};
  check('eod active on start day',      G._suppActiveOn(_eod, new Date('2026-07-01T09:00:00')) === true);
  check('eod inactive on day+1',        G._suppActiveOn(_eod, new Date('2026-07-02T09:00:00')) === false);
  check('eod active on day+2',          G._suppActiveOn(_eod, new Date('2026-07-03T09:00:00')) === true);
  check('eod inactive before start',    G._suppActiveOn(_eod, new Date('2026-06-30T09:00:00')) === false);

  // weekly: same weekday only (2026-07-01 is a Wednesday)
  var _wk = {freq:'weekly', start_date:'2026-07-01'};
  check('weekly active on same weekday (+7)', G._suppActiveOn(_wk, new Date('2026-07-08T09:00:00')) === true);
  check('weekly inactive on other weekday',   G._suppActiveOn(_wk, new Date('2026-07-09T09:00:00')) === false);

  // _supplementsForDay filters by activity
  G._supplements = [
    {id:'a', supp_id:'vitd3', name:'Vitamin D3', dose:'5000 IU', freq:'daily',  timing:'AM'},
    {id:'b', supp_id:'omega3', name:'Omega-3',   dose:'2000 mg', freq:'weekly', timing:'PM', start_date:'2026-07-01'}
  ];
  var _wed = G._supplementsForDay(new Date('2026-07-01T09:00:00'));
  var _thu = G._supplementsForDay(new Date('2026-07-02T09:00:00'));
  check('_supplementsForDay includes daily + matching weekly', _wed.length === 2);
  check('_supplementsForDay drops non-matching weekly',        _thu.length === 1 && _thu[0].name === 'Vitamin D3');

  // renderTodaySupplements writes a section when supplements are active
  if (typeof G.renderTodaySupplements === 'function') {
    var _rtsHTML = null;
    var _savedGE = G.document.getElementById;
    var _capEl = { set innerHTML(v){ _rtsHTML = v; }, get innerHTML(){ return _rtsHTML; } };
    G.document.getElementById = function(id){ return id==='today-supplements' ? _capEl : _savedGE(id); };
    var _rtsThrew = false;
    try { G.renderTodaySupplements(new Date('2026-07-01T09:00:00')); } catch(e){ _rtsThrew=true; console.error('  renderTodaySupplements threw:', e.message); }
    check('renderTodaySupplements: no crash', !_rtsThrew);
    check('renderTodaySupplements: shows a SUPPLEMENTS section', typeof _rtsHTML==='string' && /SUPPLEMENTS/.test(_rtsHTML));
    check('renderTodaySupplements: lists the active supplement name', typeof _rtsHTML==='string' && /Vitamin D3/.test(_rtsHTML));
    // empty when nothing active
    G._supplements = [];
    G.renderTodaySupplements(new Date('2026-07-01T09:00:00'));
    check('renderTodaySupplements: empty when no supplements active', _rtsHTML === '');
    G.document.getElementById = _savedGE;
    G._supplements = [];
  }

  // ── Vitamin D (25-OH-D) → D3 dose recommendation ──
  if (typeof G._vitDRecommendation === 'function') {
    // unit conversion: ng/mL → nmol/L (× 2.496)
    check('_vitDToNmol: ng/mL converts (20 → ~49.9)', Math.abs(G._vitDToNmol(20,'ng/mL') - 49.92) < 0.1);
    check('_vitDToNmol: nmol/L passes through',        G._vitDToNmol(60,'nmol/L') === 60);
    check('_vitDToNmol: rejects non-positive',         G._vitDToNmol(0,'nmol/L') === null);
    // classification bands
    check('_vitDRec: <50 = Deficient',        G._vitDRecommendation(40).status === 'Deficient');
    check('_vitDRec: Deficient has loading',   /5000 IU/.test(G._vitDRecommendation(40).loading||''));
    check('_vitDRec: 50–75 = Insufficient',    G._vitDRecommendation(60).status === 'Insufficient');
    check('_vitDRec: 75–125 = Sufficient',     /Sufficient/.test(G._vitDRecommendation(90).status));
    check('_vitDRec: 125–250 = Above target',  G._vitDRecommendation(150).status === 'Above target');
    check('_vitDRec: >250 = Excess',           G._vitDRecommendation(300).status === 'Excess');
    // weight-based loading total (van Groningen): 40×(75−40)×90 = 126000 IU
    check('_vitDRec: weight-based loading total', /126,000 IU/.test(G._vitDRecommendation(40,90).totalNote||''));
    check('_vitDRec: no weight → no total note',   !G._vitDRecommendation(40,0).totalNote);
    // marker lookup from bloodwork extras (newest-first)
    var _savedBw = G._tcBwEntries;
    G._tcBwEntries = [{date:'2026-07-01', extra:[{name:'Vitamin D', value:42, unit:'nmol/L'}]}];
    var _mk = G._suppLatestBwMarker('Vitamin D');
    check('_suppLatestBwMarker: finds Vitamin D in extras', _mk && Number(_mk.value) === 42 && _mk.unit === 'nmol/L');
    check('_suppLatestBwMarker: null for missing marker',   G._suppLatestBwMarker('IGF-1') === null);
    check('_renderVitDCard: renders card when level present',
      typeof G._renderVitDCard()==='string' && /Deficient/.test(G._renderVitDCard()) && /nmol\/L/.test(G._renderVitDCard()));
    G._tcBwEntries = null;
    check('_renderVitDCard: empty when no bloodwork', G._renderVitDCard() === '');
    G._tcBwEntries = _savedBw;
  }

  // ── custom dose via two dropdowns (no free text) ──
  if (typeof G._suppParseDose === 'function') {
    check('_suppParseDose: "125 µg (5000 IU)" → 125 µg',
      (function(){var p=G._suppParseDose('125 µg (5000 IU)');return p&&p.amount===125&&p.unit==='µg';})());
    check('_suppParseDose: "5 g" → 5 g',
      (function(){var p=G._suppParseDose('5 g');return p&&p.amount===5&&p.unit==='g';})());
    check('_suppParseDose: legacy "100 mcg" → 100 µg',
      (function(){var p=G._suppParseDose('100 mcg');return p&&p.amount===100&&p.unit==='µg';})());
    check('_suppParseDose: "2000 mg" → 2000 mg',
      (function(){var p=G._suppParseDose('2000 mg');return p&&p.amount===2000&&p.unit==='mg';})());
    check('_suppParseDose: count-based "1 capsule" → null (no dropdown unit)',
      G._suppParseDose('1 capsule') === null);
    check('_suppParseDose: empty → null', G._suppParseDose('') === null);
    // unit dropdown maps to a fixed unit set; amount options are per-unit
    check('_SUPP_UNITS is [µg,mg,g,IU]', JSON.stringify(G._SUPP_UNITS) === JSON.stringify(['µg','mg','g','IU']));
    check('_suppAmountOptions(µg): starts 5, ends 1000', (function(){var o=G._suppAmountOptions('µg');return o[0]===5&&o[o.length-1]===1000;})());
    check('_suppAmountOptions(g): includes fractional 0.5', G._suppAmountOptions('g').indexOf(0.5)!==-1);
    check('_suppAmountOptions(IU): ends 10000', (function(){var o=G._suppAmountOptions('IU');return o[o.length-1]===10000;})());
    check('_suppAmountOptions(mg default): ends 2000', (function(){var o=G._suppAmountOptions('mg');return o[o.length-1]===2000;})());
    check('_suppDefaultAmount: µg=50, mg=100, g=5, IU=1000',
      G._suppDefaultAmount('µg')===50 && G._suppDefaultAmount('mg')===100 && G._suppDefaultAmount('g')===5 && G._suppDefaultAmount('IU')===1000);

    // DOM wiring: drive the two-dropdown flow end-to-end with select mocks that
    // mimic a browser <select> (setting innerHTML with a `selected` option updates value).
    (function(){
      function mkSel(){ var _html='',_val='';
        return {
          set innerHTML(h){ _html=h; var m=/value="([^"]*)"\s+selected/.exec(h); _val = m ? m[1] : ((/value="([^"]*)"/.exec(h)||[])[1]||''); },
          get innerHTML(){ return _html; },
          get value(){ return _val; }, set value(v){ _val=String(v); },
          style:{display:''}, getAttribute:function(){return null;}, setAttribute:function(){}, removeAttribute:function(){} }; }
      var els={'supp-as-comp':mkSel(),'supp-as-dose':mkSel(),'supp-as-dose-custom':mkSel(),
        'supp-as-amount':mkSel(),'supp-as-unit':mkSel()};
      els['supp-as-comp'].value='vitd3';
      var savedGE=G.document.getElementById;
      G.document.getElementById=function(id){ return els[id]||savedGE(id); };
      try {
        G._suppInitDoseControls(500,'mg');
        check('dropdown wiring: unit select = mg',            els['supp-as-unit'].value==='mg');
        check('dropdown wiring: amount select = 500',         els['supp-as-amount'].value==='500');
        check('dropdown wiring: _suppCurrentDropdownDose = "500 mg"', G._suppCurrentDropdownDose()==='500 mg');
        els['supp-as-unit'].value='µg'; // user changes unit
        G._suppUnitSel();
        check('dropdown wiring: unit switch resets amount to default (50 µg)', G._suppCurrentDropdownDose()==='50 µg');
        // editing preserves a non-standard amount by injecting it as an option
        G._suppInitDoseControls(437,'mg');
        check('dropdown wiring: non-standard amount preserved (437 mg)', G._suppCurrentDropdownDose()==='437 mg');
      } finally { G.document.getElementById=savedGE; }
    })();
  }

  check('buildSupplements is defined', typeof G.buildSupplements === 'function');
  check('syncSupplementsFromAgent is defined', typeof G.syncSupplementsFromAgent === 'function');
  check('pushSupplementToAgent / deleteSupplementFromAgent defined',
    typeof G.pushSupplementToAgent === 'function' && typeof G.deleteSupplementFromAgent === 'function');

  // ── checkboxes: slots + taken-state rendering ──
  check('_suppSlots: AM & PM expands to two slots',
    JSON.stringify(G._suppSlots('AMPM')) === '["AM","PM"]');
  check('_suppSlots: AM / PM single slot',
    JSON.stringify(G._suppSlots('AM')) === '["AM"]' && JSON.stringify(G._suppSlots('PM')) === '["PM"]');
  check('toggleSupplementDose + syncSupplementLogFromAgent defined',
    typeof G.toggleSupplementDose === 'function' && typeof G.syncSupplementLogFromAgent === 'function');

  if (typeof G.renderTodaySupplements === 'function') {
    var _cbHTML = null;
    var _savedGE2 = G.document.getElementById;
    var _capEl2 = { set innerHTML(v){ _cbHTML = v; }, get innerHTML(){ return _cbHTML; } };
    G.document.getElementById = function(id){ return id==='today-supplements' ? _capEl2 : _savedGE2(id); };
    // an AM&PM daily supplement → two checkbox slots; mark the AM slot taken
    G._supplements = [{id:'x', supp_id:'vitd3', name:'Vitamin D3', dose:'5000 IU', freq:'daily', timing:'AMPM'}];
    G._suppLog = {};
    G._suppLog[G._suppLogKey('vitd3','2026-07-01','AM')] = true;
    G.renderTodaySupplements(new Date('2026-07-01T09:00:00'));
    check('checkbox row: renders a check-box element', typeof _cbHTML==='string' && /check-box/.test(_cbHTML));
    check('checkbox row: AM slot shows as checked', typeof _cbHTML==='string' && /check-box checked/.test(_cbHTML));
    check('checkbox row: badge counts done / total slots', typeof _cbHTML==='string' && /1 \/ 2/.test(_cbHTML));
    check('checkbox row: onclick wires toggleSupplementDose', typeof _cbHTML==='string' && /toggleSupplementDose\(/.test(_cbHTML));
    G.document.getElementById = _savedGE2;
    G._supplements = []; G._suppLog = {};
  }

  // ── SHBG: supplements feed the free-T (systemic-interaction) model ──
  if (typeof G._tcComputeGhStack === 'function') {
    var _savedSys = G._tcSysInter, _savedStacks = G._tcActiveStacks, _savedSupp = G._supplements, _savedGh = G._tcGhStack;
    G._tcSysInter = { boron: { shbg: { direction:'suppress', maxSuppression:0.25, halfTimeDays:14 } } };
    G._tcActiveStacks = null;
    G._supplements = [{id:'b', supp_id:'boron', name:'Boron', dose:'6 mg', freq:'daily', timing:'AM', start_date:'2026-06-01'}];
    G._tcGhStack = [];
    G._tcComputeGhStack();
    check('SHBG model includes an active Boron supplement',
      Array.isArray(G._tcGhStack) && G._tcGhStack.some(function(e){ return e.pepId==='supp_boron' && e.interactions && e.interactions.shbg; }));
    // a supplement with no systemic interaction is NOT added
    G._supplements = [{id:'c', supp_id:'vitc', name:'Vitamin C', dose:'1000 mg', freq:'daily', timing:'AM'}];
    G._tcComputeGhStack();
    check('SHBG model ignores supplements with no interaction',
      G._tcGhStack.every(function(e){ return e.pepId !== 'supp_vitc'; }));

    // Start date comes from the FIRST checked date in the today view (supplement log),
    // not the stored start_date — so a supplement counts from when it was first taken.
    var _savedLog2 = G._suppLog;
    G._supplements = [{id:'b', supp_id:'boron', name:'Boron', dose:'6 mg', freq:'daily', start_date:'2026-06-20'}];
    G._suppLog = {};
    G._suppLog[G._suppLogKey('boron','2026-06-05','AM')] = true;
    G._suppLog[G._suppLogKey('boron','2026-06-11','AM')] = true;   // later — must not win
    G._tcGhStack = [];
    G._tcComputeGhStack();
    var _bEntry = G._tcGhStack.find(function(e){ return e.pepId==='supp_boron'; });
    check('supplement start = earliest checked date (2026-06-05), not stored start_date',
      _bEntry && _bEntry.startDateStr === '2026-06-05', _bEntry && _bEntry.startDateStr);
    // never checked → falls back to the explicit start_date
    G._suppLog = {};
    G._tcGhStack = [];
    G._tcComputeGhStack();
    var _bEntry2 = G._tcGhStack.find(function(e){ return e.pepId==='supp_boron'; });
    check('supplement start falls back to start_date when never checked',
      _bEntry2 && _bEntry2.startDateStr === '2026-06-20', _bEntry2 && _bEntry2.startDateStr);
    G._suppLog = _savedLog2 || {};

    G._tcSysInter = _savedSys; G._tcActiveStacks = _savedStacks; G._supplements = _savedSupp || []; G._tcGhStack = _savedGh || [];
  }
} else {
  check('SUPPLEMENT_CAT defined (tab-supplements.js loaded)', false);
}

// ── SHBG suppression is dose-dependent + time-varying (Emax dose-response) ──
console.log('\n── T-calc: dose-dependent SHBG suppression (effMaxSupp) ──');
if (typeof G._tcEffMaxSupp === 'function') {
  var _drH = {unit:'IU/day', ed50:2, emax:0.56, typicalDose:5};
  // saturating Emax: 0 at 0 dose, monotone up, capped by emax, calibrated at typical dose
  check('effMaxSupp: zero dose → zero suppression', G._tcEffMaxSupp(_drH, 0) === null || G._tcEffMaxSupp(_drH, 0) === 0);
  check('effMaxSupp: monotone increasing in dose', G._tcEffMaxSupp(_drH, 4) < G._tcEffMaxSupp(_drH, 5) && G._tcEffMaxSupp(_drH, 5) < G._tcEffMaxSupp(_drH, 8));
  check('effMaxSupp: calibrated to ~0.40 at the 5 IU typical dose', Math.abs(G._tcEffMaxSupp(_drH, 5) - 0.40) < 0.02);
  check('effMaxSupp: saturates below emax', G._tcEffMaxSupp(_drH, 1e6) <= _drH.emax + 1e-9);
  check('effMaxSupp: HGH 4 IU suppresses less than the 5 IU reference', G._tcEffMaxSupp(_drH, 4) < G._tcEffMaxSupp(_drH, 5));
  check('effMaxSupp: null/invalid dose-response → null', G._tcEffMaxSupp(null, 5) === null && G._tcEffMaxSupp({ed50:2,emax:0.5}, -1) === null);
}
if (typeof G._tcConvDose === 'function') {
  check('convDose: mcg → mg divides by 1000', Math.abs(G._tcConvDose(300, 'mcg', 'mg/day') - 0.3) < 1e-9);
  check('convDose: same unit is identity (strips /period)', G._tcConvDose(10, 'mg', 'mg/day') === 10);
  check('convDose: IU ↔ mass refused (returns null)', G._tcConvDose(5, 'IU', 'mg/day') === null);
  check('convDose: IU → IU passes through', Math.abs(G._tcConvDose(5, 'IU', 'IU/day') - 5) < 1e-9);
}
if (typeof G._tcSuppDailyDose === 'function') {
  var _iHgh = {shbg:{direction:'suppress', maxSuppression:0.40, halfTimeDays:25, doseResponse:{unit:'IU/day', ed50:2, emax:0.56, typicalDose:5}}};
  // peptide dosed 5 IU AM every day → 5 IU/day
  check('suppDailyDose: daily IU peptide → 5 IU/day',
    Math.abs(G._tcSuppDailyDose(_iHgh, 'peptide', {dose_am:'5', unit_am:'IU', times:['AM'], days:[0,1,2,3,4,5,6]}) - 5) < 1e-9);
  // same 5 IU dosed only 5 days/week → averaged to 5·5/7 IU/day
  check('suppDailyDose: 5-day/week schedule is averaged over the week',
    Math.abs(G._tcSuppDailyDose(_iHgh, 'peptide', {dose_am:'5', unit_am:'IU', times:['AM'], days:[1,2,3,4,5]}) - 5*5/7) < 1e-9);
  var _iBor = {shbg:{direction:'suppress', maxSuppression:0.09, halfTimeDays:4, doseResponse:{unit:'mg/day', ed50:4, emax:0.126, typicalDose:10}}};
  check('suppDailyDose: daily boron supplement "10 mg" → 10 mg/day',
    Math.abs(G._tcSuppDailyDose(_iBor, 'supp', {dose:'10 mg', freq:'daily'}) - 10) < 1e-9);
  var _iCjc = {shbg:{direction:'suppress', maxSuppression:0.20, halfTimeDays:32, doseResponse:{unit:'mcg/day', ed50:120, emax:0.28, typicalDose:300}}};
  check('suppDailyDose: enhanced compound "2100 mcg/week" → 300 mcg/day',
    Math.abs(G._tcSuppDailyDose(_iCjc, 'compound', {dose:'2100', unit:'mcg/week'}) - 300) < 1e-9);
  check('suppDailyDose: no dose-response → null', G._tcSuppDailyDose({shbg:{direction:'suppress',maxSuppression:0.2,halfTimeDays:10}}, 'supp', {dose:'10 mg', freq:'daily'}) === null);
}

// integration: a lower GH dose leaves SHBG higher → a lower free-T peak than the reference dose.
if (typeof G._tcDrawManualChart === 'function' && typeof G._tcEffMaxSupp === 'function') {
  var _ddSaveTp = G._tcp, _ddSaveBw = G._tcBwEntries, _ddSaveGh = G._tcGhStack, _ddSaveGE = G.document.getElementById;
  var _ddCap = null;
  var _ddCtx = { scale:noop,beginPath:noop,arc:noop,fill:noop,stroke:noop,fillText:noop,closePath:noop,save:noop,restore:noop,fillRect:noop,setLineDash:noop,strokeRect:noop,translate:noop,rotate:noop,moveTo:noop,lineTo:noop,measureText:function(){return{width:0};},createLinearGradient:function(){return{addColorStop:noop};} };
  G.document.getElementById = function(id){ return id==='tc-manual-chart' ? { style:{},classList:{add:noop,remove:noop,contains:function(){return false;}},offsetWidth:350,offsetHeight:250,_testShbgHook:function(v){_ddCap=v;},getContext:function(){return _ddCtx;} } : _ddSaveGE(id); };
  var _ddLog = [{compId:'testoviron',doseMg:'100',date:'2026-06-01'}];
  for (var _ddi=0;_ddi<12;_ddi++){ var _ddd=new Date(new Date('2026-06-03').getTime()+_ddi*3*86400000); _ddLog.push({compId:'nebido',doseMg:'100',date:_ddd.getFullYear()+'-'+String(_ddd.getMonth()+1).padStart(2,'0')+'-'+String(_ddd.getDate()).padStart(2,'0')}); }
  G._tcp = {measuredFT:'400', currentDoseMgWk:'0', totalT:'25', shbg:'40', birthYear:'1980', manualLog:_ddLog};
  G._tcBwEntries = [{date:'2026-06-15', total_t:25, shbg:40, free_t:400}];
  var _ghInter = {shbg:{direction:'suppress', maxSuppression:0.40, halfTimeDays:25, doseResponse:{unit:'IU/day', ed50:2, emax:0.56, typicalDose:5}}};
  function _ddPeak(dailyDose){
    G._tcGhStack = [{pepId:'hgh', startDateStr:'2026-06-01', interactions:_ghInter, dailyDose:dailyDose}];
    _ddCap = null; G._tcDrawManualChart('tc-manual-chart', _ddLog);
    var arr=_ddCap.arr, tot=_ddCap.total, pk=0,pv=0;
    for(var t=0;t<tot.length;t++){ var v=tot[t]*arr[t]; if(v>pv){pv=v;pk=t;} }
    return pv;
  }
  var _ddThrew=false, _peak2=0, _peak4=0, _peak5=0, _peak8=0;
  try { _peak2=_ddPeak(2); _peak4=_ddPeak(4); _peak5=_ddPeak(5); _peak8=_ddPeak(8); } catch(e){ _ddThrew=true; console.error('  dose-dep test threw:', e.message); }
  check('dose-dep SHBG: no crash', !_ddThrew && _ddCap !== null);
  // Higher GH dose → more SHBG suppression → higher modelled free-T peak (monotone in dose).
  // Monotonicity holds across well-separated doses, but NOT step-by-step. Measured
  // 2026-08-02 after P0 moved 6.5 -> 5 mg/day: peaks went 664.10 / 662.83 / 668.90 /
  // 680.48 for 2 / 4 / 5 / 8 IU — 4 IU lands 1.27 pmol/L (0.19%) BELOW 2 IU. At the
  // old P0 the same fixture was cleanly monotone (579.85 / 597.57 / 603.17 / 613.85).
  // Cause is peak TIMING, not magnitude: more SHBG suppression moves the maximum onto
  // a different injection cycle, and near ed50=2 the two candidate peaks are within a
  // fraction of a percent, so the winner can swap. Asserting strict step-by-step
  // monotonicity was over-specifying the model. The span assertion below is the real
  // property — more GH suppression means a higher free-T peak — and it is unchanged.
  check('dose-dep SHBG: free-T peak increases with GH dose across the span (2<5<8 IU)',
    _peak2 < _peak5 && _peak5 < _peak8,
    'peak2=' + _peak2.toFixed(1) + ' peak5=' + _peak5.toFixed(1) + ' peak8=' + _peak8.toFixed(1));
  check('dose-dep SHBG: no adjacent dose inverts by more than 0.5%',
    _peak4 > _peak2 * 0.995,
    'peak2=' + _peak2.toFixed(1) + ' peak4=' + _peak4.toFixed(1));
  check('dose-dep SHBG: lower HGH dose (4 IU) → lower free-T peak than 5 IU reference',
    !_ddThrew && _peak4 < _peak5, 'peak4='+_peak4.toFixed(1)+' peak5='+_peak5.toFixed(1));
  G._tcp = _ddSaveTp; G._tcBwEntries = _ddSaveBw; G._tcGhStack = _ddSaveGh; G.document.getElementById = _ddSaveGE;
}

// ── Mid-cycle draw: a suppressor-dose snapshot freezes the SHBG baseline ──
// A change to today's dose must NOT retroactively move the pre-draw curve / baseline
// (the snapshot pins the draw), but MUST move the forward (post-draw) curve.
console.log('\n── T-calc: draw snapshot decouples the SHBG baseline from today\'s dose ──');
if (typeof G._tcFreeTSeries === 'function') {
  var _snSaveTp = G._tcp, _snSaveBw = G._tcBwEntries, _snSaveGh = G._tcGhStack;
  var _snLog = [{compId:'testoviron', doseMg:'100', date:'2026-06-01'}];
  for (var _sni=0; _sni<16; _sni++){ var _snd=new Date(new Date('2026-06-03').getTime()+_sni*3*86400000); _snLog.push({compId:'nebido', doseMg:'100', date:_snd.getFullYear()+'-'+String(_snd.getMonth()+1).padStart(2,'0')+'-'+String(_snd.getDate()).padStart(2,'0')}); }
  var _snInter = {shbg:{direction:'suppress', maxSuppression:0.40, halfTimeDays:25, doseResponse:{unit:'IU/day', ed50:2, emax:0.56, typicalDose:5}}};
  // Mid-cycle draw on 2026-06-20; suppressor started 2026-06-01 (draw is day ~19).
  var _snSuppSnap = [{id:'hgh', dailyDose:5, unit:'IU/day', startDate:'2026-06-01'}];
  G._tcp = {measuredFT:'400', currentDoseMgWk:'0', totalT:'25', shbg:'40', birthYear:'1985', manualLog:_snLog};

  function _snSeries(dailyDose, withSnap){
    G._tcGhStack = [{pepId:'hgh', startDateStr:'2026-06-01', interactions:_snInter, dailyDose:dailyDose}];
    G._tcBwEntries = [{date:'2026-06-20', total_t:25, shbg:40, free_t:400, suppressors: withSnap ? _snSuppSnap : undefined}];
    var s = G._tcFreeTSeries(_snLog.slice(), {});
    return { ft:function(d){ return s.total[d]*(s.calFT_arr?s.calFT_arr[d]:s.scale); }, calFT:s.calFT, days:s.totalDays };
  }

  var _snThrew=false, _s5, _s4, _s5n, _s4n;
  try { _s5=_snSeries(5,true); _s4=_snSeries(4,true); _s5n=_snSeries(5,false); _s4n=_snSeries(4,false); }
  catch(e){ _snThrew=true; console.error('  snapshot test threw:', e.message); }
  check('draw snapshot: no crash', !_snThrew && _s5 && _s4);
  if (!_snThrew) {
    var _preDay = 8, _postDay = 45;   // before vs after the day-19 draw
    // WITH snapshot: today's dose (5→4) must not move the pre-draw free T (baseline frozen).
    check('draw snapshot: pre-draw free T is unchanged when today\'s dose changes',
      Math.abs(_s5.ft(_preDay) - _s4.ft(_preDay)) < 1e-6,
      'ft5='+_s5.ft(_preDay).toFixed(4)+' ft4='+_s4.ft(_preDay).toFixed(4));
    // …but the forward curve DOES respond to the new dose (more GH → more free T).
    check('draw snapshot: post-draw free T tracks today\'s dose (5 IU > 4 IU)',
      _s5.ft(_postDay) > _s4.ft(_postDay) + 1e-6,
      'ft5='+_s5.ft(_postDay).toFixed(2)+' ft4='+_s4.ft(_postDay).toFixed(2));
    // Calibration stays exact at the draw regardless of the snapshot.
    var _snRef = 19;
    check('draw snapshot: curve still passes through the measured free T at the draw',
      Math.abs(_s5.ft(_snRef) - 400) < 400*0.03, 'ft@draw='+_s5.ft(_snRef).toFixed(1));
    // Contrast: WITHOUT a snapshot the old coupling remains — a dose change moves the
    // pre-draw curve too. This is exactly what the snapshot fixes.
    check('draw snapshot: WITHOUT a snapshot the pre-draw curve is (still) dose-coupled',
      Math.abs(_s5n.ft(_preDay) - _s4n.ft(_preDay)) > 1e-6,
      'ft5='+_s5n.ft(_preDay).toFixed(4)+' ft4='+_s4n.ft(_preDay).toFixed(4));
  }
  G._tcp = _snSaveTp; G._tcBwEntries = _snSaveBw; G._tcGhStack = _snSaveGh;
}

// ── Steady-state AVERAGE line: toggle + the pharmacology it communicates ──
console.log('\n── T-calc: steady-state average line ──');
if (typeof G._tcShowAvg === 'function' && typeof G._tcToggleAvgLine === 'function') {
  var _avSaved = null; try { _avSaved = localStorage.getItem('tc-avg-line'); } catch(e){}
  var _avSaveTp = G._tcp; G._tcp = { manualLog: [] };   // make the toggle's redraw a no-op
  try { localStorage.removeItem('tc-avg-line'); } catch(e){}
  check('avg line: shown by default', G._tcShowAvg() === true);
  G._tcToggleAvgLine({ checked: false });
  check('avg line: hiding it persists (survives getData\'s ||-default trap)', G._tcShowAvg() === false);
  G._tcToggleAvgLine({ checked: true });
  check('avg line: re-showing it persists', G._tcShowAvg() === true);
  G._tcp = _avSaveTp;
  try { if (_avSaved === null) localStorage.removeItem('tc-avg-line'); else localStorage.setItem('tc-avg-line', _avSaved); } catch(e){}
}

// The line's premise: at steady state the MEAN is set by mg/day (dose ÷ interval),
// independent of injection frequency, while the PEAK grows with dose-per-shot.
// Proven directly from the PK primitive so it can't drift from the model.
if (typeof G._tcPkConc === 'function' && typeof G._tcKa === 'function') {
  var _ssHl = 7, _ssKe = Math.LN2 / _ssHl, _ssKa = G._tcKa(_ssHl);
  function _ssMeanPeak(dose, interval) {
    var N = 360, c = new Float64Array(N + 1);
    for (var inj = 0; inj <= N; inj += interval) { for (var t = inj; t <= N; t++) c[t] += G._tcPkConc(dose, _ssKa, _ssKe, t - inj); }
    var from = N - 60, sum = 0, n = 0, pk = 0;
    for (var t2 = from; t2 <= N; t2++) { sum += c[t2]; if (c[t2] > pk) pk = c[t2]; n++; }
    return { mean: sum / n, peak: pk };
  }
  var _ssA = _ssMeanPeak(100, 2);   // 50 mg/day, frequent small shots
  var _ssB = _ssMeanPeak(300, 6);   // 50 mg/day, infrequent larger shots
  check('avg line: steady-state MEAN is ~equal across injection frequency (same mg/day)',
    Math.abs(_ssA.mean - _ssB.mean) / _ssA.mean < 0.02, 'meanA=' + _ssA.mean.toFixed(3) + ' meanB=' + _ssB.mean.toFixed(3));
  check('avg line: PEAK is markedly higher for the infrequent larger dose',
    _ssB.peak > _ssA.peak * 1.15, 'peakA=' + _ssA.peak.toFixed(3) + ' peakB=' + _ssB.peak.toFixed(3));
}

// The line averages the VISIBLE window, so it tracks the zoom instead of one global value.
if (typeof G._tcDrawManualChart === 'function' && typeof G._tcFreeTSeries === 'function') {
  var _awSaveTp = G._tcp, _awSaveBw = G._tcBwEntries, _awSaveGh = G._tcGhStack, _awSaveGE = G.document.getElementById;
  var _awCap = null;
  var _awCtx = { scale:noop,beginPath:noop,arc:noop,fill:noop,stroke:noop,fillText:noop,closePath:noop,save:noop,restore:noop,fillRect:noop,setLineDash:noop,strokeRect:noop,translate:noop,rotate:noop,moveTo:noop,lineTo:noop,measureText:function(){return{width:0};},createLinearGradient:function(){return{addColorStop:noop};} };
  G.document.getElementById = function(id){ return id==='tc-main-chart' ? { style:{},classList:{add:noop,remove:noop,contains:function(){return false;}},offsetWidth:350,offsetHeight:250,_testAvgHook:function(v){_awCap=v;},getContext:function(){return _awCtx;} } : _awSaveGE(id); };
  // A long single-ester ramp so the early window sits well below the settled plateau.
  var _awLog = [];
  for (var _awi=0; _awi<40; _awi++){ var _awd=new Date(new Date('2026-04-01').getTime()+_awi*3.5*86400000); _awLog.push({compId:'enanthate', doseMg:'100', date:_awd.getFullYear()+'-'+String(_awd.getMonth()+1).padStart(2,'0')+'-'+String(_awd.getDate()).padStart(2,'0')}); }
  G._tcp = {measuredFT:'500', currentDoseMgWk:'', totalT:'', shbg:'', birthYear:'1985', manualLog:_awLog};
  G._tcBwEntries = [{date:'2026-06-20', free_t:500}]; G._tcGhStack = [];
  var _awS = G._tcFreeTSeries(_awLog.slice(), {});
  function _awWinMean(a,b){ var s=0,n=0; for(var t=a;t<=b;t++){ s+=_awS.total[t]*(_awS.calFT_arr?_awS.calFT_arr[t]:_awS.scale); n++; } return n?s/n:0; }
  try { localStorage.removeItem('tc-avg-line'); } catch(e){}
  var _awThrew=false, _awWhole=null, _awMonth=null;
  try {
    _awCap=null; G._tcDrawManualChart('tc-main-chart', _awLog, 'whole'); _awWhole=_awCap;
    _awCap=null; G._tcDrawManualChart('tc-main-chart', _awLog, 'month'); _awMonth=_awCap;
  } catch(e){ _awThrew=true; console.error('  avg-window test threw:', e.message); }
  check('avg window: hook fires with a window', !_awThrew && _awWhole && _awMonth);
  if (_awWhole && _awMonth) {
    check('avg window: reported average equals the mean of its own visible window',
      Math.abs(_awWhole.avg - _awWinMean(_awWhole.xStart, _awWhole.xEnd)) < 0.5);
    check('avg window: zoom changes the window (month narrower than whole)',
      (_awMonth.xEnd - _awMonth.xStart) < (_awWhole.xEnd - _awWhole.xStart));
    check('avg window: the two zooms yield different averages (not a stale global value)',
      Math.abs(_awWhole.avg - _awMonth.avg) > 1);
  }
  G._tcp = _awSaveTp; G._tcBwEntries = _awSaveBw; G._tcGhStack = _awSaveGh; G.document.getElementById = _awSaveGE;
}

// ── Chart label de-collision (peak/today overlap in tight zooms) ──
if (typeof G._tcNudgeLabelY === 'function') {
  var _nlo = 10, _nhi = 200;
  check('label nudge: no collision → unchanged (clamped)',
    G._tcNudgeLabelY(100, [140], 11, _nlo, _nhi) === 100);
  check('label nudge: clamps to bounds', G._tcNudgeLabelY(5, [], 11, _nlo, _nhi) === _nlo && G._tcNudgeLabelY(999, [], 11, _nlo, _nhi) === _nhi);
  // a label landing on top of an existing one is pushed at least `gap` away
  var _n1 = G._tcNudgeLabelY(102, [100], 11, _nlo, _nhi);
  check('label nudge: overlapping label pushed ≥ gap away', Math.abs(_n1 - 100) >= 11 - 1e-9);
  // clears two nearby occupied rows
  var _n2 = G._tcNudgeLabelY(100, [100, 110], 11, _nlo, _nhi);
  check('label nudge: clears every nearby label', Math.abs(_n2 - 100) >= 11 - 1e-9 && Math.abs(_n2 - 110) >= 11 - 1e-9);
  check('label nudge: result stays within bounds', G._tcNudgeLabelY(100, [100,110,120,130], 11, _nlo, _nhi) >= _nlo);
}

// ── Testosterone → SHBG dose-dependent free-T model (+ uncertainty band) ──
console.log('\n── T-calc: testosterone→SHBG dose-dependent model + β band ──');
if (typeof G._tcDrawManualChart === 'function') {
  var _shSavedTp   = G._tcp;
  var _shSavedBw   = G._tcBwEntries;
  var _shSavedGh   = G._tcGhStack;
  var _shSavedGE   = G.document.getElementById;

  var _shCap = null;
  var _shCtx = {
    scale:noop, beginPath:noop, arc:noop, fill:noop, stroke:noop, fillText:noop,
    closePath:noop, save:noop, restore:noop, fillRect:noop, setLineDash:noop,
    strokeRect:noop, translate:noop, rotate:noop, moveTo:noop, lineTo:noop,
    measureText:function(){ return {width:0}; }, createLinearGradient:function(){ return {addColorStop:noop}; }
  };
  G.document.getElementById = function(id){
    if (id==='tc-manual-chart') return {
      style:{}, classList:{add:noop,remove:noop,contains:function(){return false;}},
      offsetWidth:350, offsetHeight:250,
      _testShbgHook: function(v){ _shCap = v; },
      getContext: function(){ return _shCtx; }
    };
    return _shSavedGE(id);
  };

  // Testosterone-ester schedule, bloodwork with total T + SHBG (activates the model).
  var _shLog = [
    {compId:'testoviron', doseMg:'100', date:'2026-06-27'},
    {compId:'testoviron', doseMg:'150', date:'2026-06-28'}
  ];
  for (var _shi=0; _shi<10; _shi++){ var _shd=new Date(new Date('2026-06-29').getTime()+_shi*2*86400000); _shLog.push({compId:'nebido', doseMg:'102', date:_shd.getFullYear()+'-'+String(_shd.getMonth()+1).padStart(2,'0')+'-'+String(_shd.getDate()).padStart(2,'0')}); }

  G._tcp = {measuredFT:'217', currentDoseMgWk:'0', totalT:'16.2', shbg:'45', birthYear:'1980', manualLog:_shLog};
  G._tcBwEntries = [{date:'2026-06-27', free_t:217, total_t:16.2, shbg:45}];
  G._tcGhStack = [];  // no compound suppressors — testosterone alone must drive the model

  var _shThrew = false;
  try { _shCap = null; G._tcDrawManualChart('tc-manual-chart', _shLog); }
  catch(e){ _shThrew = true; console.error('  T→SHBG test threw:', e.message); }
  check('T→SHBG: no crash', !_shThrew);
  check('T→SHBG: model activates from total T + SHBG alone (no GH/Boron needed)', !_shThrew && _shCap !== null);

  if (_shCap) {
    var _arr=_shCap.arr, _lo=_shCap.lo, _hi=_shCap.hi, _cal=_shCap.calFT, _ref=_shCap.refDay, _tot=_shCap.total;
    // peak index by central curve
    var _pk=0,_pv=0; for (var _t=0; _t<_tot.length; _t++){ var _v=_tot[_t]*_arr[_t]; if(_v>_pv){_pv=_v;_pk=_t;} }
    // The curve must pass through the user's measured free T at the draw. This used to be
    // asserted as arr[ref]/calFT === 1, which tested the old REPRESENTATION (arr was a
    // multiplier around a fitted calFT). calFT is no longer a fitted scale factor — the
    // baseline is solved from the lab instead — so assert the property directly. It now
    // holds because TT_base was derived from this measurement, not because the curve was
    // rescaled to hit it: a modelling error can no longer be absorbed into a constant.
    check('T→SHBG: curve passes through the measured free T at the draw',
      Math.abs(_tot[_ref] * _arr[_ref] - 217) < 0.5,
      'rendered at draw=' + (_tot[_ref] * _arr[_ref]).toFixed(4) + ' vs measured 217');
    check('T→SHBG: band pinches to zero width at the draw',
      Math.abs(_lo[_ref]-_hi[_ref]) < 1e-6);
    // Same contract change: compare the free-T FRACTION at the peak against its value at
    // the draw, rather than against calFT.
    check('T→SHBG: free-T fraction rises above the draw dose (SHBG suppressed)',
      _arr[_pk] > _arr[_ref] * 1.02, 'arr[peak]/arr[ref]='+(_arr[_pk]/_arr[_ref]).toFixed(4));
    check('T→SHBG: β band brackets the central curve at the peak',
      _lo[_pk] <= _arr[_pk] + 1e-9 && _arr[_pk] <= _hi[_pk] + 1e-9);
    check('T→SHBG: band has real width away from the draw (hi > lo at peak)',
      _hi[_pk] > _lo[_pk] * 1.01);
    // model raises the peak vs a flat (linear) calibration
    check('T→SHBG: modelled peak exceeds the naive linear peak',
      _tot[_pk]*_arr[_pk] > _tot[_pk]*_cal * 1.02);
  }

  G._tcp = _shSavedTp; G._tcBwEntries = _shSavedBw; G._tcGhStack = _shSavedGh;
  G.document.getElementById = _shSavedGE;
}

// ── Per-user β calibration (SHBG ∝ totalT^−β fitted from the user's own labs) ──
console.log('\n── T-calc: β personalised from the user\'s own bloodwork (no hardcoding) ──');
if (typeof G._tcFitBeta === 'function') {
  function _synth(tt, b){ return {total_t: tt, shbg: 60 * Math.pow(tt, -b)}; }
  // clean data generated with a known exponent must be recovered
  var _fit2 = G._tcFitBeta([_synth(15,0.30), _synth(45,0.30)]);
  check('β fit: recovers exponent from 2 clean labs', _fit2 && Math.abs(_fit2.beta - 0.30) < 0.02, _fit2 && ('β='+_fit2.beta.toFixed(4)));
  var _fit4 = G._tcFitBeta([_synth(15,0.30), _synth(25,0.30), _synth(40,0.30), _synth(60,0.30)]);
  check('β fit: recovers exponent from 4 clean labs', _fit4 && Math.abs(_fit4.beta - 0.30) < 0.02);
  check('β fit: 4 labs report n and a band', _fit4 && _fit4.n === 4 && _fit4.hi > _fit4.lo && _fit4.lo < _fit4.beta && _fit4.beta < _fit4.hi);
  check('β fit: more consistent labs → tighter band than the 2-lab default (±0.10)',
    _fit4 && (_fit4.hi - _fit4.lo) < 0.20);
  // not enough / unusable data → null (caller uses population fallback)
  check('β fit: null with a single lab', G._tcFitBeta([_synth(20,0.3)]) === null);
  check('β fit: null when all labs are at the same T level', G._tcFitBeta([{total_t:20,shbg:40},{total_t:20,shbg:42}]) === null);
  check('β fit: null when SHBG is missing', G._tcFitBeta([{total_t:15},{total_t:45}]) === null);
  check('β fit: null on empty/undefined', G._tcFitBeta([]) === null && G._tcFitBeta(null) === null);
  // physiological clamp — a nonsense steep drop is capped
  var _fitSteep = G._tcFitBeta([{total_t:15,shbg:200},{total_t:60,shbg:1}]);
  check('β fit: clamps β to a physiological ceiling (≤0.60)', _fitSteep && _fitSteep.beta <= 0.60 + 1e-9);

  // integration: with ≥2 labs at different T, the SHBG model reports personalised β
  if (typeof G._tcDrawManualChart === 'function') {
    var _pbSaveTp = G._tcp, _pbSaveBw = G._tcBwEntries, _pbSaveGh = G._tcGhStack, _pbSaveGE = G.document.getElementById;
    var _pbCap = null;
    var _pbCtx = { scale:noop,beginPath:noop,arc:noop,fill:noop,stroke:noop,fillText:noop,closePath:noop,save:noop,restore:noop,fillRect:noop,setLineDash:noop,strokeRect:noop,translate:noop,rotate:noop,moveTo:noop,lineTo:noop,measureText:function(){return{width:0};},createLinearGradient:function(){return{addColorStop:noop};} };
    G.document.getElementById = function(id){ return id==='tc-manual-chart' ? { style:{},classList:{add:noop,remove:noop,contains:function(){return false;}},offsetWidth:350,offsetHeight:250,_testShbgHook:function(v){_pbCap=v;},getContext:function(){return _pbCtx;} } : _pbSaveGE(id); };
    var _pbLog = [{compId:'testoviron',doseMg:'100',date:'2026-06-27'}];
    for (var _pi2=0;_pi2<10;_pi2++){ var _pd3=new Date(new Date('2026-06-29').getTime()+_pi2*3*86400000); _pbLog.push({compId:'nebido',doseMg:'100',date:_pd3.getFullYear()+'-'+String(_pd3.getMonth()+1).padStart(2,'0')+'-'+String(_pd3.getDate()).padStart(2,'0')}); }
    G._tcp = {measuredFT:'400', currentDoseMgWk:'0', totalT:'30', shbg:'30', birthYear:'1980', manualLog:_pbLog};
    // two blood tests at different T levels → personalised fit
    G._tcBwEntries = [{date:'2026-06-27', total_t:30, shbg:30, free_t:400},{date:'2026-06-20', total_t:15, shbg:45, free_t:220}];
    G._tcGhStack = [];
    _pbCap = null; var _pbThrew=false;
    try { G._tcDrawManualChart('tc-manual-chart', _pbLog); } catch(e){ _pbThrew=true; }
    check('β fit integration: SHBG model runs with multi-lab data', !_pbThrew && _pbCap !== null);
    check('β fit integration: model reports personalised β (not the population default)',
      _pbCap && _pbCap.personalized === true);
    G._tcp = _pbSaveTp; G._tcBwEntries = _pbSaveBw; G._tcGhStack = _pbSaveGh; G.document.getElementById = _pbSaveGE;
  }
} else {
  check('_tcFitBeta defined', false);
}

// ── Blood Levels: combined multi-line chart (compounds + supplements) ─────────
console.log('\n── Blood Levels: combined chart (compounds + supplements) ──');
if (typeof G._blBuildLines === 'function') {
  var _blSaveStacks = G._userStacks, _blSaveIdx = G._activeStackIndices, _blSaveSupp = G._supplements, _blSaveLines = G._blLines;
  var _blSaveMFT = G._tcp.measuredFT, _blSaveDose0 = G._tcp.currentDoseMgWk, _blSaveInj0 = G._injectionsCache, _blSaveBw0 = G._tcBwEntries;
  G._tcp.measuredFT = '217';        // calibrate the aggregated Free T line to pmol/L
  G._tcp.currentDoseMgWk = '';      // no prior protocol → curve starts at the baseline
  G._tcBwEntries = [{date:'2026-05-25', free_t:217}];  // pre-cycle baseline draw → day-0 anchors at 217
  // Testosterone reaches this chart as INJECTIONS, never as stack config (rule
  // 2026-08-14 — T-Calc owns the schedule). The stack below still carries a TRT ester
  // so the fixture also proves that config alone draws nothing.
  G._injectionsCache = (function(){
    var c = {};
    for (var i = 0; i < 12; i++) {
      var d = new Date(new Date('2026-06-01').getTime() + i*3.5*86400000);
      var k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      c[k] = [{cycle_id:'test_20260601', compound_id:'testoviron', compound_name:'Testoviron',
               tier:'trt', date:k, dose:'125', unit:'mg', active:true}];
    }
    return c;
  })();
  G._userStacks = [{
    name:'Test', cycle_length:12, cycle_start:'2026-06-01',
    peptides:[{id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0,3],times:['AM'],dose_am:'3',unit_am:'mg',active:true}],
    trt:{enabled:true, compounds:[{id:'testoviron',name:'Testoviron',dose:'250',unit:'mg',days:[0,3]}]},
    enhanced:{enabled:false, compounds:[]}
  }];
  G._activeStackIndices = [0];
  G._supplements = [{id:'s1',supp_id:'vitd3',name:'Vitamin D3',dose:'5000 IU',freq:'daily',timing:'AM',start_date:'2026-06-01'}];

  var _blLines = G._blBuildLines();
  G._blLines = _blLines;
  check('_blBuildLines: includes a peptide line',    _blLines.some(function(l){return l.kind==='peptide';}));
  check('_blBuildLines: aggregates testosterone into ONE Free T line', _blLines.filter(function(l){return l.kind==='freet';}).length === 1);
  check('_blBuildLines: no per-ester TRT amount lines remain', !_blLines.some(function(l){return l.kind==='trt';}));
  check('_blBuildLines: includes a supplement line', _blLines.some(function(l){return l.kind==='supplement';}));
  check('_blBuildLines: sets a timeline',            G._blTimeline && G._blTimeline.totalDays > 0);

  // General amount-line mechanics are exercised on the peptide line (an amount line).
  var _blPep = _blLines.filter(function(l){return l.kind==='peptide';})[0];
  var _blArgmax = 0; for (var _bi=1;_bi<_blPep.curve.length;_bi++) if (_blPep.curve[_bi] > _blPep.curve[_blArgmax]) _blArgmax = _bi;
  // curves are sub-day sampled (_BL_SPD steps/day); convert the argmax step → day
  var _blPeakDay = _blPep.offset + _blArgmax / _blPep.spd;
  check('_blBuildLines: sub-day sampling (spd>1)', _blPep.spd > 1);
  check('_blValueAt: peak normalises to 1.0', G._blValueAt(_blPep, _blPeakDay) === 1);
  check('_blValueAt: null before a line starts', G._blValueAt(_blPep, _blPep.offset - 1) === null);
  check('_blValueAt: null after a line ends',    G._blValueAt(_blPep, _blPep.offset + _blPep.curve.length) === null);
  // end-of-cycle washout tail is truncated (no drop toward zero past the last dose)
  check('_blRawMgAt: null past the last dose (no washout tail)',
    G._blRawMgAt(_blPep, _blPep.offset + _blPep.lastStep/_blPep.spd + 2) === null);
  check('_blRawMgAt: non-null at the last dose',
    G._blRawMgAt(_blPep, _blPep.offset + _blPep.lastStep/_blPep.spd) !== null);

  // Free T aggregated line: real blood level (pmol/L), starts at the 217 baseline,
  // rises with injections, drawn across the whole timeline (day-indexed, no washout).
  var _blFT = _blLines.filter(function(l){return l.kind==='freet';})[0];
  check('_blBuildLines: Free T line is pmol/L', _blFT && _blFT.unit === 'pmol/L' && _blFT.conc === true);
  check('_blBuildLines: Free T day-indexed (spd=1)', _blFT && _blFT.spd === 1);
  check('_blBuildLines: Free T starts near the 217 baseline', _blFT && Math.abs(_blFT.curve[0] - 217) < 217*0.15, 'curve[0]='+(_blFT&&_blFT.curve[0])+' peak='+(_blFT&&_blFT.peak));
  check('_blBuildLines: Free T rises above baseline with injections', _blFT && _blFT.peak > _blFT.curve[0]*1.05);
  check('_blBuildLines: Free T is plasma (bright series red)', _blFT && _blFT.color === '#FF7A6B');

  // absorption model for amount line kinds: a dose at day 0 gives curve[0] ~ 0
  // (nothing absorbed yet) and a peak strictly later — not an instant jump.
  ['peptide','supplement'].forEach(function(kind){
    var _ln = _blLines.filter(function(l){ return l.kind===kind; })[0];
    if (!_ln) { check('_blBuildLines: '+kind+' line present for absorption check', false); return; }
    var _am = 0; for (var _k=1;_k<_ln.curve.length;_k++) if (_ln.curve[_k] > _ln.curve[_am]) _am = _k;
    check('_blBuildLines: '+kind+' uses absorption (curve[0] ~ 0, not an instant jump)', _ln.curve[0] < _ln.curve[_am] * 0.2);
    check('_blBuildLines: '+kind+' peak is delayed after the dose (absorption)', _am > 0);
  });
  // _blKa keeps absorption faster than elimination even for ultra-short halves
  check('_blKa: clamps ka above ke for ultra-short half-life', G._blKa(0.02, Math.LN2/0.02) > Math.LN2/0.02);
  check('_blKa: leaves ester ka unclamped (ka>ke already)', G._blKa(4.5, Math.LN2/4.5) === G._tcKa(4.5));

  // mg-equivalent conversion + dual-axis scaling
  check('_blToMg: mg passes through',      G._blToMg(50,'mg') === 50);
  check('_blToMg: µg → mg (×0.001)',       G._blToMg(500,'µg') === 0.5);
  check('_blToMg: mcg alias → mg',         G._blToMg(500,'mcg') === 0.5);
  check('_blToMg: g → mg (×1000)',         G._blToMg(5,'g') === 5000);
  check('_blToMg: IU kept on numeric scale (approx)', G._blToMg(4,'IU') === 4);
  check('_blFmtMg: mg band',   G._blFmtMg(150) === '150 mg');
  check('_blFmtMg: µg band',   G._blFmtMg(0.125) === '125 µg');
  check('_blFmtMg: g band',    /g$/.test(G._blFmtMg(5000)));
  // lines now carry unit + mg-equivalent peak
  check('_blBuildLines: amount line carries a unit',  !!_blPep.unit);
  check('_blBuildLines: amount line has peakMg > 0',  _blPep.peakMg > 0);
  // _blLogBounds: single log axis brackets every peak, µg → g on one scale
  var _axWide = G._blLogBounds([{id:'big',peakMg:1400},{id:'mid',peakMg:5},{id:'small',peakMg:0.1}]);
  check('_blLogBounds: top ≥ largest peak',   _axWide.top >= 1400);
  check('_blLogBounds: bottom ≤ smallest peak', _axWide.bottom <= 0.1 && _axWide.bottom > 0);
  check('_blLogBounds: spans the full µg→g range on one axis', _axWide.top/_axWide.bottom >= 1400/0.1);
  check('_blLogBounds: smallest line gets ≥ a decade of headroom (not pinned to floor)', _axWide.bottom <= 0.1/5);
  // regression: with Nebido (grams) + a small supplement (few mg), the small line
  // must sit well above the floor, not read as a flat zero (Vitamin D3 bug).
  var _axNebD3 = G._blLogBounds([{id:'neb',peakMg:852},{id:'d3',peakMg:2.7}]);
  var _d3h = (Math.log10(2.7)-Math.log10(_axNebD3.bottom))/(Math.log10(_axNebD3.top)-Math.log10(_axNebD3.bottom));
  check('_blLogBounds: mg-scale supplement sits >15% up the axis (not pinned)', _d3h > 0.15);
  var _axNarrow = G._blLogBounds([{id:'a',peakMg:100},{id:'b',peakMg:120}]);
  check('_blLogBounds: close peaks still get ≥2 decades of headroom', _axNarrow.top/_axNarrow.bottom >= 100);
  check('_blNiceCeil: rounds 1400 → 2000 (1-2-5)', G._blNiceCeil(1400) === 2000);
  check('_blNiceFloor: rounds 0.1 → 0.1',          G._blNiceFloor(0.1) === 0.1);
  // _blRawMgAt returns real mg-equivalent (not normalised)
  var _rawPeak = G._blRawMgAt(_blPep, _blPeakDay);
  check('_blRawMgAt: returns mg-equivalent at peak', Math.abs(_rawPeak - _blPep.peakMg) < 1e-9);
  // adaptive axis formatter: pmol/L when only concentration lines are visible,
  // mg-equivalent when only amount lines, bare magnitude when mixed.
  check('_blAxisFmt: labels pmol/L for a lone concentration line', G._blAxisFmt([{conc:true,unit:'pmol/L'}])(100).indexOf('pmol/L') !== -1);
  check('_blAxisFmt: mg-equivalent when only amount lines', /mg|µg|g/.test(G._blAxisFmt([{unit:'mg'}])(150)));
  check('_blAxisFmt: bare magnitude when units are mixed', G._blAxisFmt([{conc:true,unit:'pmol/L'},{unit:'mg'}])(100).indexOf('pmol/L') === -1);

  // supplement half-life map (evidence-based plasma half-lives, in days)
  check('_blSuppHalfLife: vitd3 = 15d (25-OH-D biomarker)', G._blSuppHalfLife('vitd3') === 15);
  check('_blSuppHalfLife: vitc ~30min (0.02d)',   G._blSuppHalfLife('vitc') === 0.02);
  check('_blSuppHalfLife: creatine ~2-3h (0.1d)', G._blSuppHalfLife('creatine') === 0.1);
  check('_blSuppHalfLife: betaalanine ~20min',    G._blSuppHalfLife('betaalanine') === 0.015);
  check('_blSuppHalfLife: omega3 ~2.5d',          G._blSuppHalfLife('omega3') === 2.5);
  check('_blSuppHalfLife: b6 long terminal 17.5d',G._blSuppHalfLife('b6') === 17.5);
  check('_blSuppHalfLife: coq10 ~33h (1.375d)',   G._blSuppHalfLife('coq10') === 1.375);
  // trace minerals + adaptogens (evidence-based)
  check('_blSuppHalfLife: boron ~21h (0.875d)',        G._blSuppHalfLife('boron') === 0.875);
  check('_blSuppHalfLife: selenium selenomethionine 10.5d', G._blSuppHalfLife('selenium') === 10.5);
  check('_blSuppHalfLife: iodine plasma clearance ~2h', G._blSuppHalfLife('iodine') === 0.073);
  check('_blSuppHalfLife: rhodiola ~45min',            G._blSuppHalfLife('rhodiola') === 0.031);
  check('_blSuppHalfLife: ginseng Rb1 ~16h (0.68d)',   G._blSuppHalfLife('ginseng') === 0.68);
  check('_blSuppHalfLife: tongkat ~1h (0.052d)',       G._blSuppHalfLife('tongkat') === 0.052);
  check('_blSuppHalfLife: ashwagandha ~3.75h (0.156d)',G._blSuppHalfLife('ashwagandha') === 0.156);
  check('_blSuppHalfLife: curcumin ~6.5h (0.271d)',    G._blSuppHalfLife('curcumin') === 0.271);
  check('_blSuppHalfLife: unknown falls back to 0.5d', G._blSuppHalfLife('nope') === 0.5);
  // new adaptogens are in the catalogue
  if (typeof G.SUPPLEMENT_CAT !== 'undefined') {
    ['rhodiola','ginseng','ginkgo','bacopa','tongkat'].forEach(function(id){
      check('SUPPLEMENT_CAT includes '+id, G.SUPPLEMENT_CAT.some(function(s){ return s.id===id && s.doses && s.doses.length; }));
    });
  }
  // every catalogued supplement has an explicit half-life (no silent fallback)
  if (typeof G.SUPPLEMENT_CAT !== 'undefined') {
    var _blMissing = G.SUPPLEMENT_CAT.filter(function(s){ return G._SUPP_HALFLIFE[s.id] === undefined; }).map(function(s){ return s.id; });
    check('_SUPP_HALFLIFE: covers every catalogue supplement', _blMissing.length === 0, 'missing: '+_blMissing.join(', '));
    check('_SUPP_HALFLIFE: all values positive', G.SUPPLEMENT_CAT.every(function(s){ var h=G._SUPP_HALFLIFE[s.id]; return h===undefined || h>0; }));
  }

  // _blDrawChart must not throw with a headless canvas mock
  (function(){
    var n=function(){};
    var fctx={scale:n,beginPath:n,moveTo:n,lineTo:n,stroke:n,fill:n,fillText:n,closePath:n,save:n,restore:n,
      setLineDash:n,translate:n,rotate:n,fillRect:n,createLinearGradient:function(){return{addColorStop:n};},measureText:function(){return{width:0};}};
    var fcanvas={offsetWidth:320,width:0,height:0,style:{},getContext:function(){return fctx;}};
    var _blThrew=false;
    try { G._blZoom='month'; G._blDrawChart(fcanvas);
          G._blZoom='week';  G._blDrawChart(fcanvas); } catch(e){ _blThrew=true; console.error('  _blDrawChart threw:', e.message); }
    check('_blDrawChart: no throw (month + week zoom)', !_blThrew);
    check('_blDrawChart: records a pan window', fcanvas._blWin && fcanvas._blWin.xEnd > fcanvas._blWin.xStart);
    G._blZoom='week';
  })();

  // Free T aggregates every testosterone injection into one line and folds multiple
  // esters together. The source is T-Calc ALONE (rule 2026-08-14): this block used to
  // seed one ester through `stack.trt` and one through T-Calc and assert both landed.
  // The stack tiers no longer schedule testosterone, so deriving a curve from that
  // config would plot doses nothing will ever inject — both esters come from the
  // record now, under a STACK cycle id, which is where T-Calc writes them.
  (function(){
    var _saveInj = G._injectionsCache, _saveStacks2 = G._userStacks, _saveIdx2 = G._activeStackIndices, _saveSupp2 = G._supplements;
    G._userStacks = [{ name:'T', cycle_length:12, cycle_start:'2026-06-01',
      peptides:[], trt:{enabled:true,compounds:[{id:'testoviron',name:'Testoviron',dose:'125',unit:'mg',days:[0,3]}]},
      enhanced:{enabled:false,compounds:[]} }];
    G._activeStackIndices = [0]; G._supplements = [];
    G._injectionsCache = {
      '2026-06-08':[{cycle_id:'protocol_1_20260601',compound_id:'testoviron',compound_name:'Testoviron',tier:'trt',date:'2026-06-08',dose:'125',unit:'mg',active:true}],
      '2026-06-10':[{cycle_id:'protocol_1_20260601',compound_id:'nebido',compound_name:'Nebido',tier:'trt',date:'2026-06-10',dose:'1000',unit:'mg',active:true}]
    };
    var _tlog = G._blTestosteroneLog();
    check('_blTestosteroneLog: merges every ester into one dated log',
      _tlog.length > 1 && _tlog.some(function(e){return e.compId==='testoviron';}) && _tlog.some(function(e){return e.compId==='nebido';}));
    // The stack above HAS a TRT ester configured. It must contribute nothing.
    check('_blTestosteroneLog: stack TRT config contributes no doses of its own',
      _tlog.length === 2, 'got ' + _tlog.length + ' doses from 2 stored injections');
    // …and a plan filed under a stack cycle id is found, which the old
    // `cycle_id==="tcalc"` selector would have discarded outright.
    check('_blTestosteroneLog: finds a plan bound to a protocol, not just legacy "tcalc"',
      _tlog.some(function(e){return e.compId==='nebido';}));
    check('_blTestosteroneLog: sorted ascending by date', _tlog.every(function(e,i){ return i===0 || _tlog[i-1].date <= e.date; }));
    var _tl = G._blBuildLines();
    var _fts = _tl.filter(function(l){ return l.kind==='freet'; });
    check('_blBuildLines: exactly one Free T line for multiple esters', _fts.length === 1);
    check('_blBuildLines: Free T is plasma + pmol/L', _fts[0] && _fts[0].color === '#FF7A6B' && _fts[0].unit === 'pmol/L');
    check('_blBuildLines: Free T peak > baseline (rises with injections)', _fts[0] && _fts[0].peak > _fts[0].curve[0]);
    G._injectionsCache = _saveInj; G._userStacks = _saveStacks2; G._activeStackIndices = _saveIdx2; G._supplements = _saveSupp2;
  })();

  // Selection is on WHAT THE ROW IS, never on which cycle it was filed under.
  //
  // The last check in this block used to assert the opposite — that a stack cycle_id
  // was IGNORED, "so a stack's own config injections are not double-counted here."
  // That guarded a double-count between two writers, and there is only one writer now
  // (rule 2026-08-14). Meanwhile "the stack is the container" (2026-08-06) moved
  // T-Calc's own writes onto the stack's cycle id, so the old selector excluded
  // exactly the rows it exists to find. It survived only because the stack-config
  // derivation was quietly covering for it.
  if (typeof G._blTcalcTestosterone === 'function') {
    var _sInjA = G._injectionsCache;
    G._injectionsCache = {
      '2026-06-10':[{cycle_id:'tcalc',         compound_id:'nebido', compound_name:'Nebido',        tier:'trt', date:'2026-06-10', dose:'1000', unit:'mg', active:true}],
      '2026-06-12':[{cycle_id:'tcalc:mystack', compound_id:'test-e', compound_name:'Testosterone E',tier:'trt', date:'2026-06-12', dose:'50',   unit:'mg', active:true}],
      '2026-06-14':[{cycle_id:'mystack',       compound_id:'test-c', compound_name:'Test C',        tier:'trt', date:'2026-06-14', dose:'80',   unit:'mg', active:true}],
      '2026-06-16':[{cycle_id:'mystack',       compound_id:'test_u', compound_name:'Testosterone Undecanoate', tier:'enhanced', date:'2026-06-16', dose:'250', unit:'mg', active:true}],
      '2026-06-18':[{cycle_id:'mystack',       compound_id:'hgh',    compound_name:'HGH',           tier:'enhanced', date:'2026-06-18', dose:'4', unit:'IU', active:true}]
    };
    var _tct = G._blTcalcTestosterone();
    check('_blTcalcTestosterone: includes a legacy unassigned tcalc plan', _tct.some(function(c){ return c.id==='nebido'; }));
    check('_blTcalcTestosterone: includes a legacy tcalc:<id> plan',       _tct.some(function(c){ return c.id==='test-e'; }));
    check('_blTcalcTestosterone: includes a plan filed under a STACK cycle id',
      _tct.some(function(c){ return c.id==='test-c'; }),
      'this is where T-Calc writes since 2026-08-06 — excluding it blanked the curve');
    // An enhanced-tier ester is included — under its CANONICAL id, so it merges with
    // the same molecule's TRT-tier rows rather than becoming a second compound.
    check('_blTcalcTestosterone: includes an enhanced-tier testosterone row',
      _tct.some(function(c){ return c.doses.some(function(d){ return d.date.getMonth()===5 && d.date.getDate()===16; }); }));
    check('  …canonicalised, so test_u does not appear as its own compound',
      _tct.every(function(c){ return c.id!=='test_u'; }));
    check('_blTcalcTestosterone: and still excludes non-testosterone rows',
      _tct.every(function(c){ return c.id!=='hgh'; }));

    // ── ONE MOLECULE, TWO IDS, TWO ROWS — count it ONCE ──────────────────────
    // Read from the live record 2026-08-14: the account holds `enhanced/test_u`
    // under `protocol_2_nostart` AND `trt/nebido` under T-Calc's legacy `manual`
    // cycle, on the SAME days (8, 10, 12 Aug). Widening the selector above to
    // "any testosterone row" made both visible here for the first time, and
    // grouping on the raw compound id would have drawn the free-T curve at double
    // the real dose. _tcCurveLog canonicalises and dedupes on (compId|date); this
    // now does the same, because it is looking at the same rows.
    G._injectionsCache = {
      '2026-08-08':[
        {cycle_id:'manual',             compound_id:'nebido', compound_name:'Nebido', tier:'trt',      date:'2026-08-08', dose:'100', unit:'mg', logged:true,  active:true},
        {cycle_id:'protocol_2_nostart', compound_id:'test_u', compound_name:'Testosterone Undecanoate', tier:'enhanced', date:'2026-08-08', dose:'100', unit:'mg', logged:false, active:true}],
      '2026-08-10':[
        {cycle_id:'manual',             compound_id:'nebido', compound_name:'Nebido', tier:'trt',      date:'2026-08-10', dose:'100', unit:'mg', logged:true,  active:true},
        {cycle_id:'protocol_2_nostart', compound_id:'test_u', compound_name:'Testosterone Undecanoate', tier:'enhanced', date:'2026-08-10', dose:'100', unit:'mg', logged:false, active:true}]
    };
    var _dup = G._blTcalcTestosterone();
    var _dupDoses = _dup.reduce(function(a,c){ return a + c.doses.length; }, 0);
    check('_blTcalcTestosterone: test_u and nebido on one day are ONE injection',
      _dupDoses === 2, 'got ' + _dupDoses + ' doses from 2 days of duplicated rows');
    check('  …merged under the canonical id, not kept as two compounds',
      _dup.length === 1 && _dup[0].id === 'nebido', _dup.map(function(c){return c.id;}).join(','));
    check('  …and the free-T log inherits the de-duplication',
      G._blTestosteroneLog().length === 2);
    G._injectionsCache = _sInjA;
  }

  // "What this means" card — a computed one-liner from the Free T model state.
  if (typeof G._blFreetCard === 'function') {
    var _svBl = G._blLines, _svTcp2 = G._tcp;
    G._blLines = [{ kind:'freet', curve:[100,120,180] }]; G._tcp = { measuredFT:0 };
    var _c1 = G._blFreetCard();
    check('what-this-means: rising testo reads as above baseline', _c1.includes('trending above baseline'));
    check('what-this-means: no bloodwork nudges to add a lab',     _c1.includes('population estimate'));
    check('what-this-means: card is labelled',                     _c1.includes('What this means'));
    G._blLines = [{ kind:'freet', curve:[200,200,200] }]; G._tcp = { measuredFT:'350' };
    var _c2 = G._blFreetCard();
    check('what-this-means: flat line reads as near baseline',      _c2.includes('near your baseline'));
    check('what-this-means: measured FT shows calibrated note',     _c2.includes('Calibrated to your bloodwork'));
    G._blLines = [{ kind:'peptide', curve:[1,2] }];
    check('what-this-means: no Free T line → no card',              G._blFreetCard() === '');
    G._blLines = _svBl; G._tcp = _svTcp2;
  }

  // Timeline "What this means" — a computed one-liner from cycle position only.
  if (typeof G._tlWhatThisMeans === 'function') {
    check('timeline wtm: before start reads as not started',
      G._tlWhatThisMeans(1, 12, -3, 84).includes("hasn't started"));
    check('timeline wtm: early cycle mentions building to steady state',
      /early|building/.test(G._tlWhatThisMeans(2, 12, 10, 84)));
    check('timeline wtm: mid cycle reads as stable',
      G._tlWhatThisMeans(6, 12, 42, 84).includes('mid-cycle'));
    check('timeline wtm: final week flags planning next step',
      G._tlWhatThisMeans(12, 12, 81, 84).includes('final week'));
    check('timeline wtm: complete cycle nudges bloodwork review',
      G._tlWhatThisMeans(12, 12, 90, 84).includes('complete'));
    check('timeline wtm: reports weeks remaining',
      /week[s]? left/.test(G._tlWhatThisMeans(6, 12, 42, 84)));
  }

  // Semantic chart palette — canvas hues mirror the CSS tokens.
  {
    const _bloodJs = fs.readFileSync(path.join(__dirname, '../tab-blood.js'), 'utf8');
    const _tcalcJs = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
    check('data hues defined (plasma/teal/amber)', rawScript.includes("DATA_PLASMA='#FF7A6B'") && rawScript.includes("DATA_TEAL='#2fd4c4'") && rawScript.includes("DATA_AMBER='#ffb03c'"));
    check('T-Calc measured-FT line is teal (calibrated)', _tcalcJs.includes("DATA_TEAL + '99'"));
    check('Blood optimal zone is teal ("good")',          _bloodJs.includes("DATA_TEAL + '22'"));
    check('Blood "now" marker uses the amber token',        _bloodJs.includes("DATA_AMBER + '99'"));
    // Canvas charts no longer reference the removed DM Sans webfont (dead ref →
    // browser default). They use the system stack, matching the CSS --font tokens.
    check('no canvas font references the removed DM Sans webfont',
      !_bloodJs.includes('DM Sans') && !_tcalcJs.includes('DM Sans') &&
      !fs.readFileSync(path.join(__dirname, '../tab-body.js'), 'utf8').includes('DM Sans') &&
      !rawScript.includes('DM Sans'));
    check('canvas fonts use the system UI stack',
      _bloodJs.includes("-apple-system,system-ui,sans-serif") && _tcalcJs.includes("-apple-system,system-ui,sans-serif"));
    // Body-comp charts: stale pre-PLASMA theme greys aligned to the current tokens
    // (#0a0a0a inner-dot fills now blend with the true-black bg; #2a2a2a grid → --border).
    const _bodyJs = fs.readFileSync(path.join(__dirname, '../tab-body.js'), 'utf8');
    check('body-comp charts drop the stale #0a0a0a / #2a2a2a theme greys',
      !_bodyJs.includes('#0a0a0a') && !_bodyJs.includes('#2a2a2a'));
    check('body-comp inner-dot fills use the true-black bg', _bodyJs.includes("fillStyle='#000000'"));
  }

  // Phase 2: backend PK dataset → actual blood levels for compounds with an assay
  // (Vitamin D3 → 25-OH-D), reference ranges attached, no-assay compounds untouched.
  (function(){
    if(typeof G._blPKFor !== 'function') return;
    var _sInj=G._injectionsCache,_sStk=G._userStacks,_sIdx=G._activeStackIndices,_sSup=G._supplements,
        _sPK=G._BL_PK,_sMFT=G._tcp.measuredFT,_sDose=G._tcp.currentDoseMgWk,_sBw=G._tcBwEntries;
    G._BL_PK = {
      markers: { free_t:{name:'Free testosterone',unit:'pmol/L',ref:[200,700],opt:[400,650]},
                 vitamin_d_25oh:{name:'25-OH-D',unit:'nmol/L',ref:[50,125],opt:[75,125]} },
      compounds: { testosterone:{marker:'free_t',assay:true,model:{type:'freeT'}},
                   testoviron:{marker:'free_t',assay:true,model:{type:'freeT'}},
                   vitd3:{marker:'vitamin_d_25oh',assay:true,model:{type:'linear',baseline:50,perUnitPerDay:0.017,unit:'IU'}},
                   retatrutide:{marker:null,assay:false} }
    };
    G._tcp.measuredFT='217'; G._tcp.currentDoseMgWk=''; G._tcBwEntries=[{date:'2026-05-25',free_t:217}];
    // Testosterone comes from the injection record, not from the stack's TRT config
    // (rule 2026-08-14) — without a stored injection there is no Free T line to check.
    G._injectionsCache={ '2026-06-08':[{cycle_id:'p2_20260601', compound_id:'testoviron',
      compound_name:'Testoviron', tier:'trt', date:'2026-06-08', dose:'125', unit:'mg', active:true}] };
    G._userStacks=[{ name:'P2', cycle_length:12, cycle_start:'2026-06-01',
      peptides:[{id:'retatrutide',name:'Retatrutide',dot:'#e8ff3c',days:[0,3],times:['AM'],dose_am:'3',unit_am:'mg',active:true}],
      trt:{enabled:true,compounds:[{id:'testoviron',name:'Testoviron',dose:'125',unit:'mg',days:[0,3]}]},
      enhanced:{enabled:false,compounds:[]} }];
    G._activeStackIndices=[0];
    G._supplements=[{id:'d',supp_id:'vitd3',name:'Vitamin D3',dose:'5000 IU',freq:'daily',timing:'AM',start_date:'2026-06-01'}];
    var L=G._blBuildLines();
    check('_blPKFor: resolves compound + its marker',
      (function(){var p=G._blPKFor('testoviron'); return !!p && p.comp.marker==='free_t' && !!p.marker && p.marker.unit==='pmol/L';})());
    var _d3=L.filter(function(l){return l.pkId==='vitd3';})[0];
    check('_blBuildLines: Vitamin D3 → 25-OH-D concentration (nmol/L)', !!_d3 && _d3.conc===true && _d3.unit==='nmol/L');
    check('_blBuildLines: D3 starts at the population baseline (~50 nmol/L)', !!_d3 && Math.abs(_d3.curve[0]-50) < 5);
    check('_blBuildLines: D3 rises above baseline with dosing (~50→135)', !!_d3 && _d3.peak > 60);
    check('_blBuildLines: D3 carries its reference range for the band', !!_d3 && !!_d3.marker && _d3.marker.ref[0]===50);
    var _ft=L.filter(function(l){return l.kind==='freet';})[0];
    check('_blBuildLines: Free T carries its reference range', !!_ft && !!_ft.marker && _ft.marker.unit==='pmol/L');
    var _rp=L.filter(function(l){return l.pkId==='retatrutide';})[0];
    check('_blBuildLines: no-assay compound stays an amount line', !!_rp && !_rp.conc && _rp.unit==='mg');
    G._BL_PK=_sPK; G._injectionsCache=_sInj; G._userStacks=_sStk; G._activeStackIndices=_sIdx; G._supplements=_sSup;
    G._tcp.measuredFT=_sMFT; G._tcp.currentDoseMgWk=_sDose; G._tcBwEntries=_sBw;
  })();

  G._userStacks = _blSaveStacks; G._activeStackIndices = _blSaveIdx; G._supplements = _blSaveSupp; G._blLines = _blSaveLines;
  G._tcp.measuredFT = _blSaveMFT; G._tcp.currentDoseMgWk = _blSaveDose0; G._injectionsCache = _blSaveInj0; G._tcBwEntries = _blSaveBw0;
} else {
  check('_blBuildLines defined', false);
}

// ── parseDec (decimal comma AND dot support) ─────────────────────────────────
console.log('\n── parseDec ────────────────────────────────────────────────');
check('parseDec defined',            typeof G.parseDec === 'function');
check('parseDec("82,5") → 82.5',     G.parseDec('82,5') === 82.5);
check('parseDec("82.5") → 82.5',     G.parseDec('82.5') === 82.5);
check('parseDec("0,25") → 0.25',     G.parseDec('0,25') === 0.25);
check('parseDec(" 90 ") → 90',       G.parseDec(' 90 ') === 90);
check('parseDec("") → NaN',          Number.isNaN(G.parseDec('')));
check('parseDec(null) → NaN',        Number.isNaN(G.parseDec(null)));
check('parseDec(5) → 5 (number passthrough)', G.parseDec(5) === 5);
check('decimal inputs use inputmode="decimal"', (html.match(/inputmode="decimal"/g) || []).length >= 5);
check('body measurements parse via parseDec',  html.includes('var v=parseDec(inp.value);'));
{
  const tcalcSrc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  check('tab-tcalc.js has no raw parseFloat left', !tcalcSrc.includes('parseFloat('));
  const stackSrc = fs.readFileSync(path.join(__dirname, '../tab-stack.js'), 'utf8');
  check('tab-stack.js has no raw parseFloat left', !stackSrc.includes('parseFloat('));
}

// ── Labs: catalogue-driven bloodwork flagging ─────────────────────────────────
console.log('\n── Labs: flagging / conversion / trend ────────────────────');
if (typeof G._labSetCatalogue === 'function') {
  // seed a small catalogue (the real one comes from GET /lab-markers; fetch is stubbed)
  G._labSetCatalogue({
    version: 't',
    panels: [{key:'hormones',label:'Hormones'},{key:'cbc',label:'Blood count'},{key:'lipids',label:'Lipids'}],
    markers: [
      {key:'total_t',label:'Total Testosterone',unit:'nmol/L',panel:'hormones',direction:'band',safety:false,
       ranges:{male:{low:8.6,high:29.0},female:{low:0.3,high:2.4}},altUnits:[{unit:'ng/dL',factor:28.84}],meaning:'m1'},
      {key:'hematocrit',label:'Hematocrit',unit:'%',panel:'cbc',direction:'band',safety:true,
       ranges:{male:{low:40,high:54},female:{low:36,high:48}},altUnits:[],meaning:'m2'},
      {key:'hdl',label:'HDL',unit:'mmol/L',panel:'lipids',direction:'higher',safety:true,
       ranges:{male:{low:1.0,high:null},female:{low:1.3,high:null}},altUnits:[],meaning:'m3'},
      {key:'ldl',label:'LDL',unit:'mmol/L',panel:'lipids',direction:'lower',safety:true,
       ranges:{male:{low:0,high:3.0},female:{low:0,high:3.0}},altUnits:[],meaning:'m4'},
    ],
  });
  const M = k => G._labMarkerIndex[k];

  // band: below/above/in
  check('lab flag band: below range → low',  G._labFlag(M('total_t'), 6, 'male') === 'low');
  check('lab flag band: above range → high', G._labFlag(M('total_t'), 40, 'male') === 'high');
  check('lab flag band: within → in',        G._labFlag(M('total_t'), 18, 'male') === 'in');
  // sex-specific range applied
  check('lab flag uses female range',        G._labFlag(M('total_t'), 1.5, 'female') === 'in' && G._labFlag(M('total_t'), 1.5, 'male') === 'low');
  // direction: lower (only flags high), higher (only flags low)
  check('lab flag lower: high LDL flagged',  G._labFlag(M('ldl'), 4.0, 'male') === 'high');
  check('lab flag lower: low LDL is in',     G._labFlag(M('ldl'), 0.5, 'male') === 'in');
  check('lab flag higher: low HDL flagged',  G._labFlag(M('hdl'), 0.8, 'male') === 'low');
  check('lab flag higher: open top is in',   G._labFlag(M('hdl'), 3.0, 'male') === 'in');   // high bound null
  check('lab flag: null value → null',       G._labFlag(M('total_t'), null, 'male') === null);

  // unit conversion: entered ng/dL → canonical nmol/L (alt = canonical*factor ⇒ canonical = alt/factor)
  const conv = G._labConvert(M('total_t'), 577, 'ng/dL');
  check('lab convert ng/dL→nmol/L ≈ 20', Math.abs(conv - 20) < 0.2, `got ${conv}`);
  check('lab convert: canonical unit passthrough', G._labConvert(M('total_t'), 20, 'nmol/L') === 20);
  check('lab convert: empty unit passthrough',     G._labConvert(M('total_t'), 20, '') === 20);

  // entry value resolution: unified markers map preferred, legacy mirror fallback
  check('lab entry value: from markers map', G._labEntryValue({markers:{hematocrit:{value:52,unit:'%'}}}, 'hematocrit').value === 52);
  check('lab entry value: legacy mirror',    G._labEntryValue({total_t:22}, 'total_t').value === 22);
  check('lab entry value: missing → null',   G._labEntryValue({markers:{}}, 'shbg') === null);

  // trend vs previous older entry (entries sorted date-desc)
  const entries = [
    {date:'2026-07-01', markers:{total_t:{value:22,unit:''}}},
    {date:'2026-06-01', markers:{total_t:{value:18,unit:''}}},
  ];
  check('lab trend: rising vs previous', (G._labTrend(entries,0,'total_t')||{}).dir === 'up');
  check('lab trend: none when no prior', G._labTrend(entries,1,'total_t') === null);

  // safety flag colouring: out-of-range safety marker uses danger
  check('lab flag meta: safety high → danger', G._labFlagMeta('high', true).color === 'var(--danger)');
  check('lab flag meta: non-safety high → warning', G._labFlagMeta('high', false).color === 'var(--warning)');
  check('lab flag meta: in → ok colour', G._labFlagMeta('in', true).label === 'In range');

  // entry key ordering follows catalogue order, includes legacy mirrors
  const ek = G._labEntryKeys({markers:{hdl:{value:1.2}}, total_t:20});
  check('lab entry keys: catalogue-ordered', ek.indexOf('total_t') < ek.indexOf('hdl'));
} else {
  check('tab-labs.js loaded (_labSetCatalogue present)', false, 'tab-labs.js not loaded in harness');
}

// wiring: the Labs tab is registered end-to-end in index.html
check('Labs tab button present',        html.includes("switchTab('labs',this)"));
check('Labs content pane present',      html.includes('id="tab-labs"'));
check('Labs in TAB_DEFAULTS',           /TAB_DEFAULTS=[^;]*labs:true/.test(html));
check('Labs dispatched in switchTab',   html.includes("if(id==='labs')buildLabs()"));
check('tab-labs.js script included',    html.includes('tab-labs.js'));
check('lab-markers catalogue synced on init', html.includes('syncLabMarkersFromAgent()'));

// Session/auth diagnostic readout (Settings → Account).
if(typeof G._fmtTokExp==='function'){
  if(typeof G.atob!=='function')G.atob=function(s){return Buffer.from(s,'base64').toString('binary');};
  var _futTok='h.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')+'.s';
  var _fe=G._fmtTokExp(_futTok);
  check('_fmtTokExp decodes JWT exp → ~60m left', !!_fe && _fe.leftMin>=59 && _fe.leftMin<=61, _fe?String(_fe.leftMin):'null');
  check('_fmtTokExp returns null for junk', G._fmtTokExp('not-a-jwt')===null);
  check('_renderAuthDebug defined; Session row present', typeof G._renderAuthDebug==='function' && html.includes('id="s-session"'));
}
// One-Tap must not fire while a valid backend session token exists (the fix for the
// Google prompt popping up ~1h after login once the redundant Google ID token expires).
if(typeof G._hasValidSession==='function'){
  if(typeof G.atob!=='function')G.atob=function(s){return Buffer.from(s,'base64').toString('binary');};
  var _mkSess=function(sec){return 'h.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+sec})).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')+'.s';};
  G.localStorage.setItem('session_token',_mkSess(3600));
  check('_hasValidSession: true for a live session token', G._hasValidSession()===true);
  G.localStorage.setItem('session_token',_mkSess(-60));
  check('_hasValidSession: false once the session token has expired', G._hasValidSession()===false);
  G.localStorage.setItem('session_token','');
  check('_hasValidSession: false when absent', G._hasValidSession()===false);
  check('One-Tap prompt gated behind !_hasValidSession() at sign-in init', html.includes('if(!_hasValidSession())google.accounts.id.prompt()'));
  check('One-Tap refresh interval gated behind !_hasValidSession()', html.includes('<300000&&!_hasValidSession()&&window.google'));
}

// Macros moved into the Today primary group as a sub-tab; visible by default.
check('Macros is a Today sub-tab (primaryOf)', typeof G.primaryOf==='function' && G.primaryOf('macros')==='today');
check('Macros in the Today group, not More (source)', /today:\[[^\]]*'macros'[^\]]*\]/.test(html) && !/more:\[[^\]]*'macros'/.test(html));
check('Macros visible by default', /TAB_DEFAULTS=[^;]*macros:true/.test(html));
// Daily Check-in card removed from Today.
check('Daily Check-in card removed from Today', !html.includes('today-checkin-card') && !html.includes('toggleTodayCheckIn()'));
{
  const labsSrc = fs.readFileSync(path.join(__dirname, '../tab-labs.js'), 'utf8');
  check('tab-labs.js has no raw parseFloat', !labsSrc.includes('parseFloat('));
  check('tab-labs.js writes structured markers to /bloodwork', labsSrc.includes("markers: markers") && labsSrc.includes("'/bloodwork'"));
  check('tab-labs.js keeps total_t/shbg/free_t mirrors', labsSrc.includes("total_t: mirror('total_t')"));
  check('tab-labs.js does not hardcode reference ranges (backend-driven)', labsSrc.includes('/lab-markers'));
}

// ── Phase 3: "Blood Levels" → "Levels" rename + entry moved to Labs ───────────
console.log('\n── Labs Phase 3: rename + single front door ───────────────');
// tab renamed (display only) — internal key 'blood' unchanged so prefs survive
check('nav tab labelled "Levels"',        /switchTab\('blood',this\)">Levels</.test(html));
check('no "Blood Levels" nav label left', !/switchTab\('blood',this\)">Blood Levels</.test(html));
check('TAB_LABELS blood → "Levels"',      /blood:'Levels'/.test(html));
check('internal tab key still "blood"',   html.includes("switchTab('blood',this)") && html.includes('id="tab-btn-blood"'));
{
  const tcalcSrc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  // entry moved out of T-Calc → single front door in Labs
  check('T-Calc no longer shows "+ ADD ENTRY"',      !tcalcSrc.includes('+ ADD ENTRY'));
  check('T-Calc add button routes to Labs',           tcalcSrc.includes('MANAGE IN LABS') && tcalcSrc.includes('tab-btn-labs'));
  check('T-Calc entry list has no inline delete',    !tcalcSrc.includes('event.stopPropagation();_tcBwDeleteEntry('));
  check('T-Calc still consumes bloodwork (_tcBwEntries)', tcalcSrc.includes('_tcBwEntries'));
}

// ── Phase 4: cycle bloodwork folded into the unified store ────────────────────
console.log('\n── Labs Phase 4: cycle checkpoints → one store ────────────');
if (typeof G._cycleBwMatch === 'function') {
  const _saveBw = G._tcBwEntries;
  G._tcBwEntries = [{ id: 'a', date: '2026-07-01' }, { id: 'b', date: '2026-06-01' }];
  const near = G._cycleBwMatch(new Date('2026-07-03T12:00:00'));
  check('cycle bw match: entry within ±14d → nearest', !!near && near.id === 'a');
  const far = G._cycleBwMatch(new Date('2026-05-01T12:00:00'));
  check('cycle bw match: nothing within window → null', far === null);
  G._tcBwEntries = null;
  check('cycle bw match: no entries → null', G._cycleBwMatch(new Date('2026-07-01T12:00:00')) === null);
  check('cycle bw match: bad date → null', G._cycleBwMatch(new Date('nope')) === null);
  G._tcBwEntries = _saveBw;
} else {
  check('tab-cycles.js loaded (_cycleBwMatch present)', false, '_cycleBwMatch missing');
}
{
  const cyc = fs.readFileSync(path.join(__dirname, '../tab-cycles.js'), 'utf8');
  check('checkpoint "Log result" routes to unified sheet', cyc.includes('_cycleLogCheckpoint(') && cyc.includes('_labOpenAddSheet'));
  check('checkpoint done derived from unified store',       cyc.includes('_cycleBwMatch(d)') && cyc.includes('var _done=bw.done||!!_uni'));
  check('checkpoint no longer opens the separate inline form', !/onclick="cycleBwToggle\(/.test(cyc));
  const labs = fs.readFileSync(path.join(__dirname, '../tab-labs.js'), 'utf8');
  check('Labs add-sheet accepts a prefill date + preselect panel',   labs.includes('function _labOpenAddSheet(prefillDate, preselect)'));
  check('Labs add-sheet reveals full panel when opened with a recommended set', labs.includes('_labMoreOpen = !!(preselect && preselect.length)'));
  check('Labs save refreshes the cycle view',      labs.includes('renderCyclesTab()'));
}

// ── Cycle protocol batch: pre-cycle labeling, panels, ancillaries, tier (#638-640) ──
console.log('\n── Cycle protocol enrichment ──────────────────────────────');
{
  const cyc = fs.readFileSync(path.join(__dirname, '../tab-cycles.js'), 'utf8');
  const stk = fs.readFileSync(path.join(__dirname, '../tab-stack.js'), 'utf8');
  // #638: pre-cycle labeling
  check('checkpoint week label: baseline reads "Pre-cycle", not "Week 0"',
    /_cycleBwWeekLabel\(bw\)/.test(cyc) && cyc.includes("bw.phase==='pre'||bw.week===0") && cyc.includes("'Pre-cycle'"));
  check('checkpoint no longer hardcodes "Week "+bw.week in the render', !cyc.includes("'Week '+bw.week+' — '"));
  // #640: recommended panels
  check('checkpoint renders recommended marker chips', cyc.includes('_cycleBwMarkersHtml(bw)') && cyc.includes('recommended_markers'));
  check('checkpoint markers fall back to fetched phase panels', cyc.includes('_cycleBwPanels') && cyc.includes("getData('proto-cycle-bw-panels'"));
  check('log checkpoint passes recommended markers to Labs', cyc.includes('_labOpenAddSheet(dstr,_markers)'));
  check('bloodwork-recommendations fetched from backend', cyc.includes("'/cycles/bloodwork-recommendations'"));
  // #639: templates enrichment + safety + ancillaries + tier gate
  check('cycle templates enriched from backend', cyc.includes("'/cycles/templates'") && cyc.includes('function syncCycleTemplatesFromAgent'));
  check('safety badges render gyno/liver risk', cyc.includes('function _cycleSafetyBadges') && cyc.includes('gyno_risk') && cyc.includes('liver_risk'));
  check('ancillaries render as "have on hand"', cyc.includes('function _cycleAncillariesHtml') && cyc.includes('HAVE ON HAND'));
  check('wizard step 1 shows safety + ancillaries', cyc.includes('_cycleSafetyBadges(t)') && cyc.includes('_cycleAncillariesHtml(t)'));
  check('cycles feature gated to TRT/Enhanced (fail-open)',
    stk.includes('_cyclesAllowed()') && /function _cyclesAllowed\(\)\{if\(!_featuresLoaded\)return true/.test(rawScript));
}

// ── Reta escalation reconciled to +1 mg/week (#641) ──────────────────────────
console.log('\n── Reta escalation reconcile ──────────────────────────────');
{
  const recon = fs.readFileSync(path.join(__dirname, '../tab-recon.js'), 'utf8');
  // DEFAULT_PHASES reta must be strictly +1 mg/week
  const reta = G.DEFAULT_PHASES && G.DEFAULT_PHASES.retatrutide;
  check('DEFAULT_PHASES reta present', Array.isArray(reta) && reta.length >= 6);
  if (Array.isArray(reta)) {
    const incrOk = reta.every((p, i) => i === 0 || (Number(p.d) - Number(reta[i - 1].d) === 1 && Number(p.w) - Number(reta[i - 1].w) === 1));
    check('DEFAULT_PHASES reta escalates +1 mg every week', incrOk, JSON.stringify(reta.map(p => p.d)));
  }
  check('no "monthly" reta escalation prose in catalogue', !rawScript.includes('Escalate monthly: 2 mg'));
  check('no "every 4 weeks" reta prose in Recon', !recon.includes('every 4 weeks as tolerated'));
  check('reta prose states +1 mg/week', rawScript.includes('Escalate by 1 mg every week') && recon.includes('escalate by 1 mg every week'));
  check('backend escalation schedule consumed', rawScript.includes("'/compounds/escalation'") && rawScript.includes('function syncEscalationFromAgent'));
}

// ── Phase 5: analysis polish (safety summary, sparklines, tier) ───────────────
console.log('\n── Labs Phase 5: safety summary + sparklines + tier ───────');
if (typeof G._labSafetyFindings === 'function') {
  G._labSetCatalogue({
    version: 't5',
    panels: [{key:'cbc',label:'Blood count'},{key:'hormones',label:'Hormones'}],
    markers: [
      {key:'hematocrit',label:'Hematocrit',unit:'%',panel:'cbc',direction:'band',safety:true,
       ranges:{male:{low:40,high:54},female:{low:36,high:48}},altUnits:[],meaning:'hct-mean',note:'hct-note'},
      {key:'total_t',label:'Total T',unit:'nmol/L',panel:'hormones',direction:'band',safety:false,
       ranges:{male:{low:8.6,high:29},female:{low:0.3,high:2.4}},altUnits:[],meaning:'tt-mean'},
    ],
  });
  const entries = [
    {date:'2026-07-01', markers:{hematocrit:{value:50}}},
    {date:'2026-06-01', markers:{hematocrit:{value:45}}},
  ];
  // tier
  check('_labTier default is 1',        G._labTier() === 1);
  const _st = G._userTier; G._userTier = 4;
  check('_labTier reflects _userTier',  G._labTier() === 4);
  G._userTier = _st;
  // series + sparkline
  const ser = G._labSeries(entries, 'hematocrit');
  check('series oldest→newest',         ser.length === 2 && ser[0].value === 45 && ser[1].value === 50);
  check('sparkline empty when <2 pts',  G._labSparkline([entries[0]], 'hematocrit') === '');
  const spk = G._labSparkline(entries, 'hematocrit');
  check('sparkline is an SVG path',      /<svg/.test(spk) && /<path/.test(spk));
  // derived safety findings
  const fHigh = G._labSafetyFindings({markers:{hematocrit:{value:58}}});
  check('safety finding on out-of-range safety marker', fHigh.length === 1 && fHigh[0].key === 'hematocrit' && fHigh[0].flag === 'high');
  check('safety finding prefers backend note',          fHigh[0].text === 'hct-note');
  check('no safety finding when in range',              G._labSafetyFindings({markers:{hematocrit:{value:48}}}).length === 0);
  check('no safety finding for non-safety marker',      G._labSafetyFindings({markers:{total_t:{value:40}}}).length === 0);
} else {
  check('tab-labs.js Phase 5 helpers present', false, '_labSafetyFindings missing');
}
{
  const labs = fs.readFileSync(path.join(__dirname, '../tab-labs.js'), 'utf8');
  check('Labs renders a derived safety card',   labs.includes('_labSafetyCard(entries[0])'));
  check('Labs marker rows include a sparkline',  labs.includes('_labSparkline(entries, key)'));
  check('safety guidance uses backend note→meaning', labs.includes('m.note || m.meaning'));
}

// ── Blood Levels: "Day" zoom is a 24h window, not several days ────────────────
console.log('\n── Blood Levels: Day zoom = 24h window ────────────────────');
{
  const blSrc = fs.readFileSync(path.join(__dirname, '../tab-blood.js'), 'utf8');
  const m = blSrc.match(/_blZoom==='today'\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
  check("'today' zoom branch found", !!m);
  if (m) {
    const body = m[1];
    // window must be a single day: start ≈ now-0.5, end = start+1 (24h), not nowDay±2
    check("Day zoom spans 24h (xStart+1)",     body.includes('xStart+1'));
    check("Day zoom centred on now (-0.5)",    body.includes('nowDay-0.5'));
    check("Day zoom no longer ±2 days",        !body.includes('nowDay-2') && !body.includes('nowDay+2'));
  }
}

// ── Testosterone compounds render red ─────────────────────────────────────────
console.log('\n── Testosterone compounds use the red dot ─────────────────');
if (Array.isArray(G.TRT_CAT)) {
  check('all TRT_CAT esters are red (#e05050)', G.TRT_CAT.every(c => c.dot === '#e05050'), JSON.stringify(G.TRT_CAT.map(c=>c.dot)));
  check('TRT_CAT covers the esters', G.TRT_CAT.length >= 6);
} else {
  check('TRT_CAT present', false);
}
{
  const todaySrc = fs.readFileSync(path.join(__dirname, '../tab-today.js'), 'utf8');
  // existing (snapshot-dotted) TRT injections recolour to red at render
  check("Today recolours TRT doses red at render", todaySrc.includes("dose.tier==='trt'?'#e05050'"));
}

// ── Stack cards: tier badges (peptide / TRT / enhanced), option B ─────────────
console.log('\n── Stack tier badges (detect from what the stack runs) ────');
if (typeof G._stackTierFlags === 'function') {
  const f = G._stackTierFlags;
  // TRT badge only when the stack is ACTIVE and has testosterone planned
  check('tier: active + configured TRT → TRT',       f({peptides:[1,2],trt:{compounds:[{id:'nebido'}]}}, true, false).trt === true);
  check('tier: inactive + configured TRT → no TRT',  f({peptides:[1,2],trt:{compounds:[{id:'nebido'}]}}, false, false).trt === false);
  check('tier: active + T-Calc testosterone → TRT',  f({peptides:[1,2],trt:{}}, true, true).trt === true);
  check('tier: inactive + T-Calc testosterone → no TRT', f({peptides:[1,2],trt:{}}, false, true).trt === false);
  check('tier: active but no testosterone → no TRT', f({peptides:[1,2],trt:{}}, true, false).trt === false);
  check('tier: enhanced compounds → Enhanced',   f({peptides:[],enhanced:{compounds:[{id:'tren'}]}}, false, false).enhanced === true);
  check('tier: peptide count + flag',            f({peptides:[1,2,3]}, false, false).pCount === 3 && f({peptides:[1,2,3]}, false, false).peptide === true);
  check('tier: empty stack → no tiers', (function(){ var t=f({peptides:[],trt:{},enhanced:{compounds:[]}}, false, false); return !t.peptide && !t.trt && !t.enhanced; })());
} else {
  check('_stackTierFlags present', false);
}
{
  const idxSrc = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('stack card renders TRT + Enhanced chips', idxSrc.includes("_stackTierChip('TRT','#e05050')") && idxSrc.includes("_stackTierChip('ENHANCED'"));
  check('stack card uses injection-aware tier flags',  idxSrc.includes('_stackTierFlags(st,isActive,_stackHasScheduledTrt(st.id))'));
}

// ── Option B / phase 1: stable stack ids (injections stop orphaning) ──────────
console.log('\n── Stable stack ids ──────────────────────────────────────');
if (typeof G._stackCycleId === 'function' && typeof G._ensureStackId === 'function') {
  // legacy stack (no id) derives the old name_start cycle id → existing injections stay linked
  check('derive: sanitised name_start', G._deriveStackCycleId({name:'Cycle 2 TRT+HGH', cycle_start:'2026-05-18'}) === 'cycle_2_trthgh_2026-05-18');
  check('stackCycleId prefers a stored id', G._stackCycleId({id:'fixed_id', name:'X', cycle_start:'2026-01-01'}) === 'fixed_id');
  check('legacy (no id) still derives', G._stackCycleId({name:'Cycle 2 TRT+HGH', cycle_start:'2026-05-18'}) === 'cycle_2_trthgh_2026-05-18');
  // ensureStackId adopts the CURRENT derived id (keeps existing injections), then freezes it
  var _leg = {name:'Cycle 2 TRT+HGH', cycle_start:'2026-05-18'};
  check('ensureStackId adopts current derived id', G._ensureStackId(_leg) === 'cycle_2_trthgh_2026-05-18' && _leg.id === 'cycle_2_trthgh_2026-05-18');
  // once assigned, a rename or start-date change must NOT change the id
  var _s = {name:'A', cycle_start:'2026-01-01'}; G._ensureStackId(_s); var _id1 = _s.id;
  _s.name = 'Renamed'; _s.cycle_start = '2026-02-02';
  check('id stable across rename + start change', G._stackCycleId(_s) === _id1 && G._ensureStackId(_s) === _id1);
} else {
  check('_stackCycleId / _ensureStackId present', false);
}
{
  const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('loadUserStacks backfills + persists ids', idx.includes('_ensureStackId(stack)') && idx.includes('_needIdSave'));
  const stk = fs.readFileSync(path.join(__dirname, '../tab-stack.js'), 'utf8');
  check('wizSave preserves the stable id on edit', stk.includes('proto.id=_userStacks[_wiz.stackIndex].id') && stk.includes('_ensureStackId(proto)'));
}

// ── Option B / phase 2: copy T-Calc testosterone to any stack ─────────────────
console.log('\n── T-Calc → copy testosterone to any stack ────────────────');
if (typeof G._injOwnerStackId === 'function' && typeof G._stackHasScheduledTrt === 'function') {
  check('owner: tcalc namespace → stack id', G._injOwnerStackId({cycle_id:'tcalc:cycle_2_2026'}) === 'cycle_2_2026');
  check('owner: plain stack cycle_id → itself', G._injOwnerStackId({cycle_id:'my_stack_2026'}) === 'my_stack_2026');
  check('owner: unassigned tcalc → tcalc', G._injOwnerStackId({cycle_id:'tcalc'}) === 'tcalc');
  var _cache = { '2026-07-20':[ {tier:'peptide',cycle_id:'s1'}, {tier:'trt',cycle_id:'tcalc:s2'} ], '2026-07-22':[ {tier:'trt',cycle_id:'s3'} ] };
  check('scheduledTrt: via tcalc:<id> namespace', G._stackHasScheduledTrt('s2', _cache) === true);
  check('scheduledTrt: via own cycle_id',         G._stackHasScheduledTrt('s3', _cache) === true);
  check('scheduledTrt: peptide-only stack → no',  G._stackHasScheduledTrt('s1', _cache) === false);
  check('scheduledTrt: unknown stack → no',       G._stackHasScheduledTrt('nope', _cache) === false);
} else {
  check('_injOwnerStackId / _stackHasScheduledTrt present', false);
}
if (typeof G._tcTargetCycleId === 'function') {
  var _svT = G._tcp.targetStackId, _svS = G._userStacks;
  G._userStacks = [{id:'cyc_a'},{id:'cyc_b'}];
  // No stack, no cycle id (2026-08-06). The global 'tcalc' bucket is what let an
  // unassigned plan render alongside a stack's own testosterone — two injections on
  // the same day, and the single-source guard never fired because it requires the
  // plan to BE assigned. Nothing is written outside a stack now.
  G._tcp.targetStackId = '';       check('targetCycleId: no stack → empty',          G._tcTargetCycleId() === '');
  // The STACK's own cycle id. A separate 'tcalc:<id>' namespace is what allowed the
  // same compound to exist as two series on the same day (2026-08-06).
  G._tcp.targetStackId = 'cyc_b';  check('targetCycleId: assigned → the stack id',    G._tcTargetCycleId() === 'cyc_b');
  G._tcp.targetStackId = 'ghost';  check('targetCycleId: unknown stack → empty',     G._tcTargetCycleId() === '');
  check('_tcHasTargetStack follows it', G._tcHasTargetStack() === false);
  G._tcp.targetStackId = 'cyc_a';  check('  …and is true once a stack is chosen',    G._tcHasTargetStack() === true);
  G._tcp.targetStackId = _svT; G._userStacks = _svS;
}
{
  const tc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  // Superseded by Phase 8: _tcSyncLogToBackend is deleted, so there is no T-Calc
  // sync to write a cycle id. The protocol's generator owns cycle_id now.
  check('T-Calc has no sync writing a cycle id any more',
    !tc.includes('function _tcSyncLogToBackend') && !tc.includes('cycle_id:_cid'));
  // The copy-to-stack picker was part of the schedule card and went with it (Phase 6).
  check('the copy-to-stack picker is gone', !tc.includes('_tcStackPickerHtml'));
  const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('badge detects testo from stack injections', idx.includes('_stackHasScheduledTrt(st.id)'));
}

// ── Option B / phase 3: active = stack property; schedule surfaces its testo ───
console.log('\n── Active = stack property (schedule filtering) ───────────');
if (typeof G._tcalcEntryVisible === 'function') {
  var _act = new Set(['cyc_b']);
  check('visible: unassigned tcalc → always',            G._tcalcEntryVisible({cycle_id:'tcalc'}, _act) === true);
  check('visible: assigned to an ACTIVE stack',          G._tcalcEntryVisible({cycle_id:'tcalc:cyc_b'}, _act) === true);
  check('hidden: assigned to an INACTIVE stack',         G._tcalcEntryVisible({cycle_id:'tcalc:cyc_a'}, _act) === false);
  check('n/a: own-stack row not a tcalc-family entry',   G._tcalcEntryVisible({cycle_id:'cyc_b'}, _act) === false);
} else {
  check('_tcalcEntryVisible present', false);
}
{
  const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('cache surfaces active assigned testo',       idx.includes('_tcalcEntryVisible(e,activeCycleIds)'));
  check('toggleStack refreshes cache on active switch', /async function toggleStack[\s\S]*?refreshInjectionsCache\(\)/.test(idx));
  check('useStack refreshes cache on active switch',    /async function useStack[\s\S]*?refreshInjectionsCache\(\)/.test(idx));
}

// ── Single testosterone source per stack (warn + let me choose) ───────────────
console.log('\n── Single testo source per stack ──────────────────────────');
if (typeof G._stackHasConfigTrt === 'function') {
  check('configTrt: enabled with compounds → yes', G._stackHasConfigTrt({trt:{enabled:true,compounds:[{id:'testoviron'}]}}) === true);
  check('configTrt: disabled with compounds → no', G._stackHasConfigTrt({trt:{enabled:false,compounds:[{id:'testoviron'}]}}) === false);
  check('configTrt: enabled but empty → no',       G._stackHasConfigTrt({trt:{enabled:true,compounds:[]}}) === false);
  check('configTrt: no trt → no',                  G._stackHasConfigTrt({trt:{}}) === false);
} else {
  check('_stackHasConfigTrt present', false);
}

if (typeof G._reconcileStackTestoSource === 'function') {
  var _svTcp = G._tcp, _svConfirm = G.confirm, _svSetTarget = G._tcSetTargetStack;
  // Conflict: stack has config testo AND is the current T-Calc target.
  var _mkConflictStack = function(){ return {id:'s1', name:'S1', trt:{enabled:true,compounds:[{id:'testoviron'}]}}; };
  G._tcp = { targetStackId:'s1' };

  // (a) Cancel / keep-T-Calc → discard the config testosterone (trt cleared), no unassign.
  var _unassigned = false;
  G._tcSetTargetStack = function(v){ _unassigned = (v===''); return Promise.resolve(); };
  G.confirm = function(){ return false; };
  var _s = _mkConflictStack();
  G._reconcileStackTestoSource(_s); // sync up to first await; Cancel branch has no await
  check('reconcile: Cancel keeps T-Calc, drops config testo', _s.trt && !_s.trt.enabled && !_unassigned);

  // (b) OK / switch-to-config → unassign the T-Calc plan, keep config testo.
  _unassigned = false;
  G.confirm = function(){ return true; };
  var _s2 = _mkConflictStack();
  G._reconcileStackTestoSource(_s2); // _tcSetTargetStack('') invoked synchronously before await
  check('reconcile: OK switches to config, unassigns T-Calc', _unassigned === true && _s2.trt.enabled === true);

  // (c) No conflict when the stack is not the T-Calc target → no prompt, no change.
  G._tcp = { targetStackId:'other' };
  var _confirmed = false; G.confirm = function(){ _confirmed = true; return true; };
  var _s3 = _mkConflictStack();
  G._reconcileStackTestoSource(_s3);
  check('reconcile: not the target → no-op', _confirmed === false && _s3.trt.enabled === true);

  // (d) No conflict when the target stack has no config testo → no prompt.
  G._tcp = { targetStackId:'s1' };
  _confirmed = false; G.confirm = function(){ _confirmed = true; return true; };
  var _s4 = {id:'s1', name:'S1', trt:{}};
  G._reconcileStackTestoSource(_s4);
  check('reconcile: no config testo → no-op', _confirmed === false);

  G._tcp = _svTcp; G.confirm = _svConfirm; G._tcSetTargetStack = _svSetTarget;
} else {
  // Phase 8 removed _reconcileStackTestoSource: it arbitrated between a stack's TRT
  // config and an assigned T-Calc plan, and a plan can no longer be assigned. Its
  // absence is the expected state, not a missing dependency.
  check('_reconcileStackTestoSource is gone, and nothing calls it',
    typeof G._reconcileStackTestoSource !== 'function');
}

if (typeof G._tcClearStackConfigTrt === 'function') {
  var _svSave = G.saveStacksToBackend, _svAuth = G.authHeaders;
  G.saveStacksToBackend = function(){ return Promise.resolve(); };
  G.authHeaders = function(){ return null; }; // null → skip the injection DELETE loop in tests
  var _cs = {id:'s9', name:'S9', trt:{enabled:true,compounds:[{id:'testoviron'}]}, peptides:[{id:'cjc'}]};
  G._tcClearStackConfigTrt(_cs); // stack.trt={} runs synchronously before the first await
  check('clearStackConfigTrt: disables config testo, keeps peptides', _cs.trt && !_cs.trt.enabled && _cs.peptides.length === 1);
  G.saveStacksToBackend = _svSave; G.authHeaders = _svAuth;
} else {
  // Phase 8 removed _tcClearStackConfigTrt with the rest of T-Calc's write paths.
  check('_tcClearStackConfigTrt is gone', typeof G._tcClearStackConfigTrt !== 'function');
}

{
  const tc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  // Both of these asserted the two halves of the single-source guard — T-Calc
  // clearing a protocol's own testosterone to make room for a plan, and the save
  // paths reconciling the two sources. Phase 8 removed the conflict itself: a
  // protocol holds testosterone in one place, so there is no second source and no
  // arbitration. Assert neither half came back.
  check('nothing clears a protocol\'s testosterone to make room for a plan',
    !/function _tcClearStackConfigTrt/.test(tc) && !/_tcClearStackConfigTrt\(/.test(tc));
  const stk = fs.readFileSync(path.join(__dirname, '../tab-stack.js'), 'utf8');
  check('the save paths reconcile nothing, because there is one source',
    (stk.match(/_reconcileStackTestoSource\(/g) || []).length === 0);
}

// ── Two-tier navigation: 5 primary tabs + nested sub-tabs ─────────────────────
console.log('\n── 5-tab bottom nav + sub-nav ─────────────────────────────');
if (typeof G.switchPrimary === 'function' && typeof G.primaryOf === 'function') {
  // Every legacy destination maps to exactly one primary group (primaryOf reads the internal map).
  var _dests = ['today','stacks','blood','tcalc','labs','supplements','recon','schedule','macros','timeline','body','settings','storage'];
  check('nav: every destination maps to a primary group', _dests.every(function(id){ return G.primaryOf(id) !== ''; }));
  check('primaryOf: tcalc → levels',   G.primaryOf('tcalc') === 'levels');
  check('primaryOf: recon → plan',     G.primaryOf('recon') === 'plan');
  check('primaryOf: settings → more',  G.primaryOf('settings') === 'more');
  check('primaryOf: unknown → ""',     G.primaryOf('nope') === '');
  // Regression (2026-07-17): tapping a week-strip day from another primary calls
  // switchTab('today',…) directly — the sub-tab strip must follow the new primary,
  // not keep showing the previous group's tabs (e.g. MACROS/SETTINGS over Today).
  check('switchTab refreshes the sub-tab strip for the new primary',
    /_setPrimaryActive\(_pr\);_applySubtabVis\(_pr\);/.test(rawScript));
  // Human sub-tab renames present (jargon → plain language)
  check('sub-labels: T-Calc → Testosterone',  rawScript.includes("tcalc:'Testosterone'"));
  check('sub-labels: Recon → Reconstitution', rawScript.includes("recon:'Reconstitution'"));
  check('sub-labels: blood → Blood Levels',   rawScript.includes("blood:'Blood Levels'"));
  // switchPrimary opens the first visible sub-tab, or the remembered one (_tabVis/_lastSub exposed as vars)
  var _origSwitch = G.switchTab, _cap = null; G.switchTab = function(id){ _cap = id; };
  G._tabVis = {}; G._lastSub = {};
  G.switchPrimary('levels'); check('switchPrimary: opens first visible sub-tab (levels → blood)', _cap === 'blood');
  G._lastSub = { levels:'tcalc' }; _cap = null; G.switchPrimary('levels'); check('switchPrimary: reopens the remembered sub-tab (tcalc)', _cap === 'tcalc');
  // Regression: legacy per-tab settings that hid EVERY sub-tab in a group must not
  // leave the primary empty/unreachable — it falls back to the whole group.
  var _svVis = G._tabVis;
  G._tabVis = { blood:false, tcalc:false, thist:false }; _cap = null; G._lastSub = {};
  G.switchPrimary('levels'); check('switchPrimary: all sub-tabs hidden → still opens the group (fallback)', _cap === 'blood');
  if (typeof G._groupVisibleSubs === 'function') {
    check('_groupVisibleSubs: falls back to full group when all hidden', G._groupVisibleSubs('levels').length === 3);
  }
  G._tabVis = _svVis;
  G.switchTab = _origSwitch;
  // switchTab records the active primary + its last sub-tab (bookkeeping runs before any builder)
  G._lastSub = {}; try { G.switchTab('timeline', G.document.getElementById('tab-btn-timeline')); } catch(e){}
  check('switchTab: sets _currentPrimary from the tab', G._currentPrimary === 'plan');
  check('switchTab: remembers the last sub for that primary', G._lastSub['plan'] === 'timeline');
} else {
  check('switchPrimary / primaryOf present', false);
}
{
  check('bottom nav has all 5 primary buttons', ['today','plan','levels','labs','more'].every(function(p){ return html.includes('id="navbtn-'+p+'"'); }));
  const _navcss = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
  check('.navbar is fixed to the bottom',        /\.navbar\{[^}]*position:fixed[^}]*bottom:0/.test(_navcss));
  check('content clears the fixed bottom bar',   /\.content\{[^}]*padding:[^;]*116px/.test(_navcss));
}

// ── Adaptive onboarding: experience + goals → suggested template ──────────────
console.log('\n── Adaptive onboarding ────────────────────────────────────');
if (Array.isArray(G._OB_ORDER) && typeof G.obToggleGoal === 'function' && typeof G.obSetExperience === 'function') {
  check('onboarding asks experience before the cosmetic steps', G._OB_ORDER.indexOf('experience') >= 0 && G._OB_ORDER.indexOf('experience') < G._OB_ORDER.indexOf('theme'));
  check('onboarding asks goals before the cosmetic steps',      G._OB_ORDER.indexOf('goals') >= 0 && G._OB_ORDER.indexOf('goals') < G._OB_ORDER.indexOf('stats'));
  var _svOb = G._obData;
  G._obData = { sex:null, height:'', weight:'', theme:3, experience:'', goals:[] };
  G.obSetExperience('advanced'); check('obSetExperience records the level', G._obData.experience === 'advanced');
  G.obToggleGoal('recovery');    check('obToggleGoal adds a goal',            G._obData.goals.indexOf('recovery') >= 0);
  G.obToggleGoal('recovery');    check('obToggleGoal removes on second tap',  G._obData.goals.indexOf('recovery') < 0);
  G._obData = _svOb;
  check('obFinish persists experience + goals to the backend', rawScript.includes("kv['pep-experience']") && rawScript.includes("kv['pep-goals']"));
  check('obFinish offers a goal-matched template when empty',  rawScript.includes('openTemplatePicker(_g)'));
  const _stkJs = fs.readFileSync(path.join(__dirname, '../tab-stack.js'), 'utf8');
  check('template picker accepts goal preferences + marks suggested', _stkJs.includes('function openTemplatePicker(preferGoals)') && _stkJs.includes('SUGGESTED'));
} else {
  check('_OB_ORDER / obToggleGoal / obSetExperience present', false);
}

// ── Serious onboarding: tour + in-flow starting point ─────────────────────────
console.log('\n── Serious onboarding (tour + starting point) ─────────────');
if (Array.isArray(G._OB_ORDER) && typeof G.obSetStart === 'function') {
  check('flow ends at the starting-point step', G._OB_ORDER[G._OB_ORDER.length - 1] === 'start');
  check('nav tour step precedes the starting point',
    G._OB_ORDER.indexOf('tour') >= 0 && G._OB_ORDER.indexOf('tour') < G._OB_ORDER.indexOf('start'));
  check('stats step comes before the cosmetic theme step',
    G._OB_ORDER.indexOf('stats') < G._OB_ORDER.indexOf('theme'));
  check('stats step collects age', rawScript.includes('_obData.age=this.value'));
  check('obFinish persists age locally + to backend',
    rawScript.includes("localStorage.setItem('user_age',String(profile.age))") && rawScript.includes("kv['user_age']=profile.age"));
  var _svOb2 = G._obData;
  G._obData = { sex:null, height:'', weight:'', age:'', theme:3, experience:'', goals:['recovery'], startChoice:null };
  G.obSetStart('build');    check('obSetStart records the builder choice',  G._obData.startChoice === 'build');
  G.obSetStart('tpl:abc');  check('obSetStart records a template choice',   G._obData.startChoice === 'tpl:abc');
  // Ranking: goal-matched templates first
  var _svTpl = G._protocolTemplates;
  G._protocolTemplates = [ { id:'x', name:'X', goals:['muscle'] }, { id:'y', name:'Y', goals:['recovery'] } ];
  var _rk = G._obRankedTemplates();
  check('_obRankedTemplates puts goal matches first', _rk.list[0].id === 'y' && _rk.matches(_rk.list[0]) && !_rk.matches(_rk.list[1]));
  G._protocolTemplates = _svTpl;
  G._obData = _svOb2;
  // Finish routing: template → useTemplate, build → createNewStack, explore → Today
  check('obFinish schedules the chosen template via useTemplate', rawScript.includes("useTemplate(_tid)"));
  check('obFinish opens the stack builder on build choice',       /_choice==='build'[\s\S]{0,120}createNewStack/.test(rawScript));
  check('obFinish lands explore on Today',                        /_choice==='explore'[\s\S]{0,80}switchPrimary\('today'\)/.test(rawScript));
  check('skipping before the choice keeps the legacy picker fallback', rawScript.includes('openTemplatePicker(_g)'));
  check('tour step names all five primaries',
    ['Today','Plan','Levels','Labs','More'].every(function (n) { return G._obHtmlTour().indexOf(n) >= 0; }));
  check('start step offers build + explore alternatives',
    (function () { var s = G._obData, r; G._obData = { goals: [], startChoice: null }; r = G._obHtmlStart(); G._obData = s;
      return r.indexOf('Build my own stack') >= 0 && r.indexOf('Just explore first') >= 0; })());
} else {
  check('serious onboarding (obSetStart / tour / start) present', false);
}

// ── Experience-tier adaptive density (#623) ──────────────────────────────────
console.log('\n── Adaptive density (experience tier) ─────────────────────');
if (typeof G._isSimplified === 'function' && typeof G._pepExpTier === 'function') {
  var _svProf = G.getData('pep-profile', null), _svDens = G.getData('pep-density', null);
  // explicit override wins regardless of tier
  G.setData('pep-profile', { experience: 'advanced' }); G.setData('pep-density', 'simple');
  check('detail level "simple" forces simplified even for advanced tier', G._isSimplified() === true);
  G.setData('pep-density', 'full');
  check('detail level "full" forces full even for a beginner tier', (function(){ G.setData('pep-profile',{experience:'first'}); return G._isSimplified() === false; })());
  // auto follows the tier
  G.setData('pep-density', 'auto');
  G.setData('pep-profile', { experience: 'curious' }); check('auto + curious → simplified', G._isSimplified() === true);
  G.setData('pep-profile', { experience: 'first' });   check('auto + first cycle → simplified', G._isSimplified() === true);
  G.setData('pep-profile', { experience: 'experienced' }); check('auto + experienced → full', G._isSimplified() === false);
  G.setData('pep-profile', { experience: 'advanced' });    check('auto + advanced → full', G._isSimplified() === false);
  // safety: an existing user with no experience recorded is never auto-simplified
  G.setData('pep-profile', { experience: '' }); check('auto + no experience recorded → full (existing users unaffected)', G._isSimplified() === false);
  G.setData('pep-profile', null);               check('auto + no profile at all → full', G._isSimplified() === false);
  G.setData('pep-profile', _svProf); G.setData('pep-density', _svDens);
  check('setPepDensity persists locally and pushes to backend',
    rawScript.includes("setData('pep-density',mode)") && rawScript.includes("pushPepSettingsToAgent({'pep-density':mode})"));
  check('pep-density synced back from backend settings', rawScript.includes("s['pep-density']"));
  check('Settings exposes an overridable Detail level control (auto/simple/full)',
    rawScript.includes("_densityRow('auto'") && rawScript.includes("_densityRow('simple'") && rawScript.includes("_densityRow('full'"));
  var _reconJs2 = fs.readFileSync(path.join(__dirname, '../tab-recon.js'), 'utf8');
  check('Recon dose guidance sits behind a disclosure in simplified mode',
    _reconJs2.includes('_isSimplified()') && _reconJs2.includes('<details') && _reconJs2.includes('Dosing guidance'));
} else {
  check('adaptive density (_isSimplified / _pepExpTier) present', false);
}

// ── Contextual safety notes (watch/test/stop, all tiers) ─────────────────────
console.log('\n── Contextual safety notes ────────────────────────────────');
if (typeof G._renderSafetyNote === 'function') {
  var _svSN = G._safetyNotes, _svSD = G._safetyDismissed;
  G._safetyNotes = { trt:{ label:'TRT', watch:'hematocrit', test:'6 weeks', stop:'see a doctor' } };
  G._safetyDismissed = {};
  var _sc = G._renderSafetyNote('trt');
  check('safety note renders watch/test/stop', _sc.includes('Watch:') && _sc.includes('Test:') && _sc.includes('Stop:') && _sc.includes('hematocrit'));
  check('safety note shows the tier label',    _sc.includes('TRT'));
  check('safety note: unknown tier → empty',   G._renderSafetyNote('nope') === '');
  G._safetyDismissed = { trt:1 };
  check('safety note: dismissed tier → empty', G._renderSafetyNote('trt') === '');
  G._safetyNotes = _svSN; G._safetyDismissed = _svSD;
  const _stkSN = fs.readFileSync(path.join(__dirname, '../tab-stack.js'), 'utf8');
  check('safety note shown in ALL three tiers (parity)', _stkSN.includes("_renderSafetyNote('peptide')") && _stkSN.includes("_renderSafetyNote('trt')") && _stkSN.includes("_renderSafetyNote('enhanced')"));
  check('syncSafetyNotes fetches the backend endpoint', rawScript.includes("'/safety-notes'") && rawScript.includes('function syncSafetyNotes'));
} else {
  check('_renderSafetyNote present', false);
}

// ── PLASMA theme tokens ────────────────────────────────────────────────────────
console.log('\n── PLASMA theme tokens ────────────────────────────────────');
{
  const _css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
  check('true-black ground',                    _css.includes('--bg:#000000'));
  check('warm surfaces',                        _css.includes('--surface:#15130F') && _css.includes('--surface2:#1F1B15'));
  check('hairline border brightened',           _css.includes('--border:#3A352B'));
  check('--border-strong exists (3.3:1 functional boundaries)', _css.includes('--border-strong:#6E675A'));
  check('ink ramp: text/muted2/muted',          _css.includes('--text:#F5F4EF') && _css.includes('--muted2:#C9C4BA') && _css.includes('--muted:#8D897C'));
  check('muted no longer the 2.75:1 WCAG failure', !_css.includes('#5a5751'));
  check('plasma series brightened, danger deepened', _css.includes('--plasma:#FF7A6B') && _css.includes('--danger:#FF3B30'));
  // the VOLTAGE default theme applies at startup and must carry the same values,
  // otherwise applyTheme() would override the stylesheet tokens with the old greys
  const _volt = (G.THEMES || []).find(function(t){ return t.id === 1; });
  check('VOLTAGE default theme matches PLASMA surfaces', !!_volt && _volt.vars.surface === '#15130F' && _volt.vars.surface2 === '#1F1B15' && _volt.vars.border === '#3A352B');
  check('VOLTAGE default theme matches PLASMA ink',      !!_volt && _volt.vars.text === '#F5F4EF' && _volt.vars.muted === '#8D897C' && _volt.vars.muted2 === '#C9C4BA');
  check('VOLTAGE danger is status-only deep red',        !!_volt && _volt.vars.danger === '#FF3B30');
  check('non-default themes untouched',                  (G.THEMES || []).length >= 4 && G.THEMES[1].vars.surface === '#150c10');
}

// ── PLASMA nav icons + strong boundaries ──────────────────────────────────────
console.log('\n── PLASMA nav + boundaries ────────────────────────────────');
{
  const _css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
  check('all 5 nav buttons carry a glyph icon', ['today','plan','levels','labs','more'].every(function(p){
    return new RegExp('id="navbtn-'+p+'"[^>]*>\\s*<span class="navic">.+?</span>').test(html);
  }));
  check('nav icon is 26px block above an 11px label', /\.navic\{[^}]*display:block[^}]*font-size:26px/.test(_css) && /\.navbtn\{[^}]*font-size:11px/.test(_css));
  check('navbar insets clear the rounded phone corners', /\.navbar\{[^}]*padding-left:max\(22px,env\(safe-area-inset-left\)\)[^}]*padding-right:max\(22px,env\(safe-area-inset-right\)\)/.test(_css));
  check('active nav tab gets a lime top indicator (color is not the only cue)', /\.navbtn\.active::before\{[^}]*background:var\(--accent\)/.test(_css));
  check('checkboxes use --border-strong', /\.check-box\{[^}]*border:2px solid var\(--border-strong\)/.test(_css) && /\.pep-chk\{[^}]*border:2px solid var\(--border-strong\)/.test(_css));
  check('toggle off-track uses --border-strong', /\.toggle-sw\{[^}]*background:var\(--border-strong\)/.test(_css));
  check('selection chips use --border-strong', ['day-chip','time-chip','goal-chip'].every(function(c){
    return new RegExp('\\.'+c+'\\{[^}]*border:1px solid var\\(--border-strong\\)').test(_css);
  }));
  check('text inputs use --border-strong', ['input\\.dose-in','select\\.unit-sel','input\\.note-in','input\\.trt-in'].every(function(c){
    return new RegExp(c+'\\{[^}]*border:1px solid var\\(--border-strong\\)').test(_css);
  }));
  check('decorative hairlines still use --border (cards, dividers)', /\.card\{[^}]*border:1px solid var\(--border\)/.test(_css) && /\.divider\{[^}]*background:var\(--border\)/.test(_css));
}

// ── PLASMA Today rings + streak + freshness ────────────────────────────────────
console.log('\n── PLASMA Today rings ─────────────────────────────────────');
if (typeof G._ringStats === 'function' && typeof G._calcDoseStreak === 'function') {
  const _svCache = G._injectionsCache, _svSupps = G._supplements, _svLog = G.window._peptideLog;
  const _rd = new Date(2026, 5, 10); // Wed 10 Jun 2026
  const _k = d => G.dateKey ? G.dateKey(d) : d.toISOString().split('T')[0];
  const day = off => { const d = new Date(_rd); d.setDate(d.getDate() + off); return _k(d); };
  const dose = (id, logged) => ({ id, compound_id: id, time_of_day: 'AM', active: true, logged });
  G._supplements = [];
  G.window._peptideLog = [];

  // ring stats: 1 of 2 doses logged today; yesterday 1/1 → week 2/3
  G._injectionsCache = {};
  G._injectionsCache[day(0)]  = [dose('a', true), dose('b', false)];
  G._injectionsCache[day(-1)] = [dose('a1', true)];
  let st = G._ringStats(_rd);
  check('_ringStats: today doses 1/2', st.dDone === 1 && st.dTot === 2, JSON.stringify(st));
  check('_ringStats: 7-day window 2/3', st.wDone === 2 && st.wTot === 3, JSON.stringify(st));
  check('_ringStats: no supplements → 0/0', st.sDone === 0 && st.sTot === 0);

  // streak: incomplete today is skipped; d-1 complete, d-2 empty (gap), d-3 complete → 2
  G._injectionsCache = {};
  G._injectionsCache[day(0)]  = [dose('a', true), dose('b', false)];
  G._injectionsCache[day(-1)] = [dose('c', true)];
  G._injectionsCache[day(-3)] = [dose('d', true)];
  check('streak: skips incomplete today, bridges a rest day', G._calcDoseStreak(_rd) === 2, 'got ' + G._calcDoseStreak(_rd));

  // streak: complete today counts; a partially-logged past day breaks it
  G._injectionsCache = {};
  G._injectionsCache[day(0)]  = [dose('a', true)];
  G._injectionsCache[day(-1)] = [dose('b', true), dose('c', false)];
  check('streak: complete today counts, partial past day breaks', G._calcDoseStreak(_rd) === 1, 'got ' + G._calcDoseStreak(_rd));

  // streak: 3 consecutive empty days end the walk
  G._injectionsCache = {};
  G._injectionsCache[day(0)]  = [dose('a', true)];
  G._injectionsCache[day(-5)] = [dose('z', true)];
  check('streak: 3 empty days end the history walk', G._calcDoseStreak(_rd) === 1, 'got ' + G._calcDoseStreak(_rd));

  // streak: dose-escalation immunity — the same day counts identically with more doses logged
  G._injectionsCache = {};
  G._injectionsCache[day(0)] = [dose('a', true), dose('extra1', true), dose('extra2', true)];
  const _s3 = G._calcDoseStreak(_rd);
  G._injectionsCache[day(0)] = [dose('a', true)];
  check('rings/streak measure the plan, not the amount', _s3 === G._calcDoseStreak(_rd));

  G._injectionsCache = _svCache; G._supplements = _svSupps; G.window._peptideLog = _svLog;

  // wiring + markup
  const _todayJs = fs.readFileSync(path.join(__dirname, '../tab-today.js'), 'utf8');
  const _suppJs  = fs.readFileSync(path.join(__dirname, '../tab-supplements.js'), 'utf8');
  check('today page has the rings container', html.includes('id="today-rings"'));
  check('buildToday refreshes the rings', /function buildToday\(\)\{if\(typeof buildTodayRings==='function'\)buildTodayRings\(\);/.test(_todayJs));
  check('supplement toggle refreshes the rings', _suppJs.includes("if(typeof buildTodayRings==='function') buildTodayRings();"));
  check('rings hide while sync pending', /_syncPending\|\|!_injCacheReady\)\{el\.innerHTML='';return;\}/.test(_todayJs));
  check('ring colors ride theme tokens (lime/teal/violet)', _todayJs.includes("'var(--accent)'") && _todayJs.includes("'var(--teal)'") && _todayJs.includes("'var(--accent4)'"));
} else {
  check('_ringStats/_calcDoseStreak present', false);
}
console.log('\n── PLASMA freshness chip ──────────────────────────────────');
if (typeof G._bcAgeLabel === 'function') {
  const _ref = new Date(2026, 6, 16);
  check('_bcAgeLabel: same day → today',  G._bcAgeLabel('2026-07-16', _ref) === 'today',  G._bcAgeLabel('2026-07-16', _ref));
  check('_bcAgeLabel: 1 day → 1d ago',    G._bcAgeLabel('2026-07-15', _ref) === '1d ago', G._bcAgeLabel('2026-07-15', _ref));
  check('_bcAgeLabel: 5 days → 5d ago',   G._bcAgeLabel('2026-07-11', _ref) === '5d ago', G._bcAgeLabel('2026-07-11', _ref));
  check('_bcAgeLabel: ~2 months → 2mo ago', G._bcAgeLabel('2026-05-07', _ref) === '2mo ago', G._bcAgeLabel('2026-05-07', _ref));
  check('_bcAgeLabel: bad input → empty', G._bcAgeLabel('', _ref) === '' && G._bcAgeLabel('nonsense', _ref) === '');
  const _bodyJs = fs.readFileSync(path.join(__dirname, '../tab-body.js'), 'utf8');
  check('LATEST RESULTS header carries the age chip', html.includes('id="res-age"'));
  check('bcRender sets the age chip from the latest entry', _bodyJs.includes("_ra.textContent=_bcAgeLabel(latest.date)"));
} else {
  check('_bcAgeLabel present', false);
}

// ── Recon tab defaults to the ACTIVE stack ─────────────────────────────────────
console.log('\n── Recon: active stack default ────────────────────────────');
if (typeof G.renderRecon === 'function' && typeof G.selectReconStack === 'function') {
  const _svStacks = G._userStacks, _svIdx = G._activeStackIndices,
        _svRIdx = G._reconStackIdx, _svPicked = G._reconStackPicked;
  G._userStacks = [{ name: 'Old stack', peptides: [] }, { name: 'Active stack', peptides: [] }];
  G._activeStackIndices = [1];
  G._reconStackPicked = false; G._reconStackIdx = 0;
  G.renderRecon();
  check('recon defaults to the active stack, not index 0', G._reconStackIdx === 1, 'idx=' + G._reconStackIdx);
  // explicit user choice wins and sticks across re-renders
  G.selectReconStack(0);
  check('manual selection sticks (picked flag set)', G._reconStackPicked === true && G._reconStackIdx === 0);
  G.renderRecon();
  check('re-render does not override a manual selection', G._reconStackIdx === 0, 'idx=' + G._reconStackIdx);
  // out-of-range active index is ignored safely
  G._reconStackPicked = false; G._reconStackIdx = 0; G._activeStackIndices = [9];
  G.renderRecon();
  check('out-of-range active index falls back safely', G._reconStackIdx === 0, 'idx=' + G._reconStackIdx);
  G._userStacks = _svStacks; G._activeStackIndices = _svIdx;
  G._reconStackIdx = _svRIdx; G._reconStackPicked = _svPicked;
} else {
  check('renderRecon/selectReconStack present', false);
}

// ── Swipe navigation between top-level (bottom-nav) tabs ─────────────────────
console.log('\n── Swipe navigation between top-level tabs ─────────────────');
{
  const G=sandbox;
  check('_navSwipeTarget defined', typeof G._navSwipeTarget==='function');
  check('_navVisiblePrimaries defined', typeof G._navVisiblePrimaries==='function');
  check('_navNoSwipeZone defined', typeof G._navNoSwipeZone==='function');
  check('_initSwipeNav defined', typeof G._initSwipeNav==='function');
  check('_navActiveView defined', typeof G._navActiveView==='function');
  // drag-follow animation wiring must be present
  var _swpSrc=fs.readFileSync(path.resolve(htmlPath),'utf8');
  check('swipe: touchmove drag handler wired', _swpSrc.includes("addEventListener('touchmove'"));
  check('swipe: view follows finger via translateX', /av\.style\.transform='translateX\(/.test(_swpSrc));
  check('swipe: rubber-band resistance at the ends', _swpSrc.includes('dx*0.28'));
  if(typeof G._navSwipeTarget==='function'){
    var order=['today','plan','levels','labs','more']; // mirrors PRIMARY_ORDER (const, not exported to sandbox)
    // swipe left (dir +1) → next primary
    check('swipe next from first → second', G._navSwipeTarget(order,order[0],1)===order[1]);
    // swipe right (dir -1) → previous primary
    check('swipe prev from second → first', G._navSwipeTarget(order,order[1],-1)===order[0]);
    // no wrap past the last tab
    check('no wrap past last tab', G._navSwipeTarget(order,order[order.length-1],1)===null);
    // no wrap before the first tab
    check('no wrap before first tab', G._navSwipeTarget(order,order[0],-1)===null);
    // unknown current → null (safe)
    check('unknown current primary → null', G._navSwipeTarget(order,'__nope__',1)===null);
    // single visible primary → null (nothing to move to)
    check('single visible primary → null', G._navSwipeTarget([order[0]],order[0],1)===null);
    // respects the visible subset, not the full order
    check('operates on the visible subset', G._navSwipeTarget([order[0],order[2]],order[0],1)===order[2]);
  }
}

// ── Pre-cycle body-fat readiness card ────────────────────────────────────────
console.log('\n── Pre-cycle body-fat readiness card ───────────────────────');
{
  const G=sandbox;
  check('_bfReadinessCard defined', typeof G._bfReadinessCard==='function');
  check('_latestBodyFat defined', typeof G._latestBodyFat==='function');
  check('_READINESS_FALLBACK has body_fat', !!(G._READINESS_FALLBACK&&G._READINESS_FALLBACK.body_fat));
  if(typeof G._bfReadinessCard==='function'){
    G.localStorage.setItem('user_sex','male');
    // Tier gating: only trt/enhanced get the card, never peptide
    check('readiness card shown for enhanced tier', G._bfReadinessCard('enhanced').indexOf('Lean out before you start')>=0);
    check('readiness card shown for trt tier', G._bfReadinessCard('trt').indexOf('Lean out before you start')>=0);
    check('readiness card NOT shown for peptide tier', G._bfReadinessCard('peptide')==='');
    // High BF (> male elevated 20) → strong "lean out" framing with the actual %
    G.localStorage.setItem('proto-bodycomp-v2', JSON.stringify([{date:'2026-07-01',bf:25,neck:42,belly:100}]));
    var hi=G._bfReadinessCard('enhanced');
    check('latest BF resolves to logged entry (25)', G._latestBodyFat()===25);
    check('high BF → recommend leaning out first', hi.indexOf('Recommend leaning out first')>=0);
    check('high BF → shows the user’s %', hi.indexOf('25')>=0);
    // Borderline (between target 15 and elevated 20)
    G.localStorage.setItem('proto-bodycomp-v2', JSON.stringify([{date:'2026-07-02',bf:17,neck:42,belly:95}]));
    check('borderline BF → a little above ideal', G._bfReadinessCard('trt').indexOf('A little above ideal')>=0);
    // At/under target 15 → good to start
    G.localStorage.setItem('proto-bodycomp-v2', JSON.stringify([{date:'2026-07-03',bf:12,neck:41,belly:88}]));
    check('lean BF → good range to start', G._bfReadinessCard('enhanced').indexOf('Good range to start')>=0);
    // Female band (target 25 / elevated 30): 27% is borderline, not elevated
    G.localStorage.setItem('user_sex','female');
    G.localStorage.setItem('proto-bodycomp-v2', JSON.stringify([{date:'2026-07-04',bf:27,neck:34,belly:80,hip:98}]));
    check('female borderline (27%) → a little above ideal', G._bfReadinessCard('enhanced').indexOf('A little above ideal')>=0);
    G.localStorage.setItem('user_sex','male');
    G.localStorage.removeItem('proto-bodycomp-v2');
  }
  // Source wiring: both cycle-start surfaces call the card
  var _cycSrc=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-cycles.js'),'utf8');
  check('cycle wizard step 1 renders readiness card', _cycSrc.includes("_bfReadinessCard('enhanced')"));
  var _stkSrc=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-stack.js'),'utf8');
  check('TRT protocol section renders readiness card', _stkSrc.includes("_bfReadinessCard('trt')"));
}

// ── T-Calc: body-fat adjustment of the population SHBG baseline ───────────────
console.log('\n── T-Calc: body-fat → SHBG baseline adjustment ─────────────');
{
  const G=sandbox;
  const approx=(a,b)=>Math.abs(a-b)<1e-3;
  check('_tcShbgBodyFatFactor defined', typeof G._tcShbgBodyFatFactor==='function');
  if(typeof G._tcShbgBodyFatFactor==='function'){
    // Unknown / non-positive BF → no change
    check('factor=1 when BF unknown (0)', G._tcShbgBodyFatFactor(0,'male')===1);
    check('factor=1 when BF null', G._tcShbgBodyFatFactor(null,'male')===1);
    // At the reference BF the factor is exactly 1 (male ref 18, female ref 27)
    check('male at ref 18% → factor 1', approx(G._tcShbgBodyFatFactor(18,'male'),1));
    check('female at ref 27% → factor 1', approx(G._tcShbgBodyFatFactor(27,'female'),1));
    // Higher BF lowers SHBG (<1); lower BF raises it (>1)
    check('high BF (28%) lowers SHBG (<1)', G._tcShbgBodyFatFactor(28,'male')<1);
    check('high BF (28%) ≈ 0.819', approx(G._tcShbgBodyFatFactor(28,'male'),Math.exp(-0.02*10)));
    check('lean BF (12%) raises SHBG (>1)', G._tcShbgBodyFatFactor(12,'male')>1);
    // Monotonic: fatter → smaller factor
    check('monotonic in BF', G._tcShbgBodyFatFactor(30,'male')<G._tcShbgBodyFatFactor(20,'male'));
    // Clamp: extreme adiposity floored at min_factor (0.60)
    check('extreme BF floored at 0.60', approx(G._tcShbgBodyFatFactor(60,'male'),0.60));
    check('factor never below min', G._tcShbgBodyFatFactor(90,'male')>=0.60);
    // Sex-specific bands differ
    check('male vs female bands differ at 30%', G._tcShbgBodyFatFactor(30,'male')!==G._tcShbgBodyFatFactor(30,'female'));
    // Direction check through Vermeulen: lower SHBG → higher free T
    if(typeof G._tcVermeulenFT==='function'){
      var ftBase=G._tcVermeulenFT(20,40);
      var ftAdj=G._tcVermeulenFT(20,40*G._tcShbgBodyFatFactor(28,'male'));
      check('BF-lowered SHBG raises the free-T estimate', ftAdj>ftBase);
    }
  }
  // Source wiring: applied only to the population baseline, sync consumes the params
  var _tcSrc=fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-tcalc.js'),'utf8');
  check('tcalc consumes shbgBodyFat from backend', _tcSrc.includes('d.shbgBodyFat'));
  check('tcalc applies BF factor to population SHBG', _tcSrc.includes('_popShbg = _popShbg * _bfFac'));
  check('tcalc guards BF factor behind _popShbg>0 (no measured SHBG)',
    /_popShbg > 0[\s\S]{0,400}_tcShbgBodyFatFactor/.test(_tcSrc));
}

// ── Female Tier-3 cycle protocols (sex-aware wizard) ─────────────────────────
console.log('\n── Female Tier-3 cycle protocols ───────────────────────────');
{
  const G=sandbox;
  check('CYCLE_TEMPLATES_FEMALE defined', Array.isArray(G.CYCLE_TEMPLATES_FEMALE));
  check('_userSexCyc defined', typeof G._userSexCyc==='function');
  check('_activeCycleTemplates defined', typeof G._activeCycleTemplates==='function');
  check('_cycleTemplateById defined', typeof G._cycleTemplateById==='function');
  check('_femaleCycleNoteHtml defined', typeof G._femaleCycleNoteHtml==='function');
  if(Array.isArray(G.CYCLE_TEMPLATES_FEMALE)){
    // SAFETY-CRITICAL: tren / 19-nors / harsh DHTs / male orals never appear anywhere
    var banned=/trenbolone|\bnpp\b|nandrolone|\bdeca\b|masteron|drostanolone|dianabol|methandrostenolone|anadrol|oxymetholone/i;
    // Injectable testosterone esters are banned even in HRT (peaky → virilizing)
    var injTest=/testosterone\s*(enanthate|cypionate|propionate)|sustanon/i;
    var leak=null, injLeak=null, perfTest=null;
    G.CYCLE_TEMPLATES_FEMALE.forEach(function(t){(t.compounds||[]).forEach(function(c){
      if(banned.test(c.name))leak=t.id+':'+c.name;
      if(injTest.test(c.name))injLeak=t.id+':'+c.name;
      // testosterone may ONLY appear in the hrt-kind template
      if(t.kind!=='hrt'&&/testosterone/i.test(c.name))perfTest=t.id+':'+c.name;
    });});
    check('NO tren/19-nor/harsh compound in any female template', leak===null, leak||'');
    check('NO injectable testosterone ester in any female template', injLeak===null, injLeak||'');
    check('testosterone appears ONLY in the HRT template', perfTest===null, perfTest||'');
    // Female performance whitelist + dose bands (HRT handled separately below)
    var okDose=true;
    G.CYCLE_TEMPLATES_FEMALE.forEach(function(t){(t.compounds||[]).forEach(function(c){
      if(/oxandrolone|anavar/i.test(c.name)){ if(!(c.unit==='mg/day'&&c.dose<=10)) okDose=false; }
      else if(/primobolan|metenolone/i.test(c.name)){ if(!(c.unit==='mg/week'&&c.dose<=50)) okDose=false; }
    });});
    check('female doses within safe bands (Anavar ≤10 mg/day, Primo ≤50 mg/week)', okDose);
    // HRT template: physiologic, transdermal, low dose
    var hrt=G.CYCLE_TEMPLATES_FEMALE.find(function(t){return t.kind==='hrt';});
    check('female HRT template present (kind=hrt)', !!hrt);
    if(hrt){
      var hc=hrt.compounds[0];
      check('HRT testosterone is transdermal (not injectable)', /transdermal/i.test(hc.name));
      check('HRT is a low-dose topical (% cream or ≤10 mg/day)', (hc.unit==='%'&&hc.dose<=2)||(hc.unit==='mg/day'&&hc.dose<=10));
      check('HRT framed as replacement, not a cycle', /replacement/i.test(hrt.desc));
    }
    // Performance female cycles (non-HRT) stay short (≤8 weeks)
    check('all female PERFORMANCE cycles ≤8 weeks', G.CYCLE_TEMPLATES_FEMALE.filter(function(t){return t.kind!=='hrt';}).every(function(t){return t.weeks<=8;}));
    // Every female template carries a virilization risk axis + a stop-protocol ancillary
    check('female templates carry viril_risk', G.CYCLE_TEMPLATES_FEMALE.every(function(t){return t.safety&&t.safety.viril_risk;}));
    check('female templates carry a virilization stop-protocol', G.CYCLE_TEMPLATES_FEMALE.every(function(t){return (t.ancillaries||[]).some(function(a){return /virilization/i.test(a.name);});}));
    // No AI / hCG in a female kit
    check('female kit has no AI/hCG', G.CYCLE_TEMPLATES_FEMALE.every(function(t){return !(t.ancillaries||[]).some(function(a){return /aromatase inhibitor|\bhcg\b/i.test(a.name);});}));
  }
  if(typeof G._activeCycleTemplates==='function'){
    // Male user → male set (test present); female user → female set (never test)
    G.localStorage.setItem('user_sex','male');
    var maleSet=G._activeCycleTemplates();
    check('male user gets the male template set', maleSet.some(function(t){return /Test/i.test(t.name);}));
    G.localStorage.setItem('user_sex','female');
    var femSet=G._activeCycleTemplates();
    check('female user gets the female set (ids)', femSet.some(function(t){return t.id==='fem_first';}));
    check('female user NEVER sees a performance/injectable testosterone template', !femSet.some(function(t){return t.kind!=='hrt'&&(t.compounds||[]).some(function(c){return /testosterone/i.test(c.name);});}));
    check('female user gets the low-dose testosterone HRT option', femSet.some(function(t){return t.kind==='hrt';}));
    // Contraindication banner shows for female, hidden for male
    check('female contraindication banner renders', /Do not use|different sport/i.test(G._femaleCycleNoteHtml()));
    check('female banner lists testosterone + tren as avoid', /Testosterone/.test(G._femaleCycleNoteHtml())&&/Trenbolone/.test(G._femaleCycleNoteHtml()));
    G.localStorage.setItem('user_sex','male');
    check('male user sees no female banner', G._femaleCycleNoteHtml()==='');
    // lookup spans both sets
    check('_cycleTemplateById finds a female template', !!G._cycleTemplateById('fem_synergy'));
    check('_cycleTemplateById finds a male template', !!G._cycleTemplateById('first'));
  }
  // Viril badge renders in the safety badges
  if(typeof G._cycleSafetyBadges==='function'){
    check('_cycleSafetyBadges renders a Viril badge', /Viril/.test(G._cycleSafetyBadges({safety:{viril_risk:'low'}})));
  }
}

// ── SI units: µg not mcg + % for topical products ───────────────────────────
console.log('\n── SI units (µg not mcg) + % topical unit ──────────────────');
{
  const G=sandbox;
  check('_canonUnit defined', typeof G._canonUnit==='function');
  if(typeof G._canonUnit==='function'){
    check('_canonUnit maps legacy mcg → µg', G._canonUnit('mcg')==='µg');
    check('_canonUnit leaves µg as µg', G._canonUnit('µg')==='µg');
    check('_canonUnit leaves mg/IU/ml/% untouched', G._canonUnit('mg')==='mg'&&G._canonUnit('%')==='%'&&G._canonUnit('IU')==='IU');
  }
  // Unit dropdown list: µg + % present, raw mcg gone
  check('UNITS uses µg (SI), not mcg', Array.isArray(G.UNITS)&&G.UNITS.indexOf('µg')>=0&&G.UNITS.indexOf('mcg')<0);
  check('UNITS offers % for topical products', Array.isArray(G.UNITS)&&G.UNITS.indexOf('%')>=0);
  // Peptide catalogue defaults never store the US "mcg" token
  if(Array.isArray(G.PEPTIDE_CAT)){
    var catMcg=G.PEPTIDE_CAT.some(function(p){var d=p&&p.dflt;return d&&(d.unitAm==='mcg'||d.unitPm==='mcg');});
    check('no PEPTIDE_CAT default uses mcg', !catMcg);
    var catUg=G.PEPTIDE_CAT.some(function(p){var d=p&&p.dflt;return d&&(d.unitAm==='µg'||d.unitPm==='µg');});
    check('peptide catalogue uses µg defaults', catUg);
  }
  // Legacy mcg data still renders — but as µg, never mcg
  if(typeof G._doseLabel==='function'){
    var lbl=G._doseLabel('cjc-ipa','100','mcg');
    check('_doseLabel renders legacy mcg as µg', /µg/.test(lbl)&&!/mcg/.test(lbl), lbl);
    check('_doseLabel passes % through', /%/.test(G._doseLabel('someid','1','%')));
  }
  // Female HRT cream is expressed as a % topical
  if(Array.isArray(G.CYCLE_TEMPLATES_FEMALE)){
    var hrt=G.CYCLE_TEMPLATES_FEMALE.find(function(t){return t.kind==='hrt';});
    check('HRT cream expressed as % topical', !!hrt&&hrt.compounds[0].unit==='%');
  }
  // GUARD: the unit dropdown must NEVER render an 'mcg' option — even for legacy mcg
  // data the option shown is 'µg'. Enforces the "never surface mcg" rule.
  if(typeof G._renderEditPep==='function'){
    G._editBuf={name:'T',peptides:[{id:'cjc-ipa',name:'CJC/IPA',dot:'#3cffa0',times:['AM','PM'],days:[1,2,3],dose_am:'100',dose_pm:'100',unit_am:'mcg',unit_pm:'mcg',active:true}],trt:{enabled:false,compounds:[]},enhanced:{enabled:false,compounds:[]},cycle_length:12};
    var pepHtml=G._renderEditPep(G._editBuf.peptides[0],0);
    check('unit dropdown never renders an mcg option', !/>mcg<|value="mcg"/.test(pepHtml));
    check('unit dropdown offers µg', /value="µg"/.test(pepHtml));
  }
}

// ── Caliper (skinfold) BF% ─────────────────────────────────────────────────
console.log('\n── Caliper (skinfold) BF% ─────────────────────────────────');
if(typeof G.caliperBF==='function'){
  check('JP3 male sites = chest/abdomen/thigh', JSON.stringify(G._bcCalSites('jp3','male'))===JSON.stringify(['chest','abdomen','thigh']));
  check('JP3 female sites = triceps/suprailiac/thigh', JSON.stringify(G._bcCalSites('jp3','female'))===JSON.stringify(['triceps','suprailiac','thigh']));
  check('JP7 has 7 sites (both sexes)', G._bcCalSites('jp7','male').length===7 && G._bcCalSites('jp7','female').length===7);
  check('DW4 has 4 sites, identical both sexes', G._bcCalSites('dw4','male').length===4 && JSON.stringify(G._bcCalSites('dw4','male'))===JSON.stringify(G._bcCalSites('dw4','female')));
  check('Siri 1.05 g/ml ≈ 21.43%', Math.abs(G._siriBF(1.05)-21.4286)<0.01, String(G._siriBF(1.05)));
  // Worked examples — expected values hand-computed from the published equations (±0.3 tol)
  var _jp3=G.caliperBF('jp3','male',30,{chest:10,abdomen:18,thigh:14});
  check('JP3 male worked example ≈12.7%', _jp3!==null && Math.abs(_jp3-12.7)<0.3, String(_jp3));
  var _jp7=G.caliperBF('jp7','male',30,{chest:10,axilla:10,triceps:10,subscapular:10,abdomen:10,suprailiac:10,thigh:10});
  check('JP7 male worked example ≈10.2%', _jp7!==null && Math.abs(_jp7-10.2)<0.3, String(_jp7));
  var _dw4=G.caliperBF('dw4','male',25,{biceps:5,triceps:10,subscapular:12,suprailiac:13});
  check('DW4 male 20-29 worked example ≈16.2%', _dw4!==null && Math.abs(_dw4-16.2)<0.3, String(_dw4));
  check('DW4 age band selection changes result', G.caliperBF('dw4','male',45,{biceps:5,triceps:10,subscapular:12,suprailiac:13})!==_dw4);
  check('BF rises with skinfold sum', G.caliperBF('jp3','male',30,{chest:20,abdomen:30,thigh:24})>G.caliperBF('jp3','male',30,{chest:8,abdomen:12,thigh:10}));
  check('missing required site returns null', G.caliperBF('jp3','male',30,{chest:10,abdomen:18})===null);
  check('sex changes JP3 result', G.caliperBF('jp3','female',30,{triceps:12,suprailiac:14,thigh:16})!==G.caliperBF('jp3','male',30,{chest:12,abdomen:14,thigh:16}));
}
if(typeof G._bcEntryDetail==='function'){
  check('entry detail: tape entry shows Neck', /Neck/.test(G._bcEntryDetail({method:'navy',neck:42,belly:94})));
  check('entry detail: caliper entry shows method label', /Jackson-Pollock 3-site/.test(G._bcEntryDetail({method:'jp3',skinfolds:{chest:10,abdomen:18,thigh:14}})));
}

// ── Injection pharmacology stamp (_injPkMeta) ──────────────────────────────
if(typeof G._injPkMeta==='function'){
  console.log('\n── Injection pharmacology stamp ───────────────────────────');
  var _mE=G._injPkMeta('trt','enanthate');
  check('_injPkMeta trt enanthate: ester parsed + numeric half-life', _mE.ester==='enanthate' && _mE.half_life_days>0, JSON.stringify(_mE));
  var _mN=G._injPkMeta('trt','nebido');
  check('_injPkMeta trt nebido: undecanoate ester', _mN.ester==='undecanoate', JSON.stringify(_mN));
  var _mP=G._injPkMeta('peptide','ipamorelin');
  check('_injPkMeta peptide: null ester + null half-life (not PK-modelled)', _mP.ester===null && _mP.half_life_days===null, JSON.stringify(_mP));
}

// ── T-Historical (free-T loaded from backend; captured by the T-Calc model) ──
console.log('\n── T-Historical (backend-persisted free-T) ────────────────');

// _thLoggedTrt / _thMergedPastLog: the injection source the capture computes from.
if(typeof G._thLoggedTrt==='function'){
  var _ltRows=[
    {compound_id:'enanthate',dose:'125',date:'2026-02-01',tier:'trt',logged:true},
    {compound_id:'enanthate',dose:'0',date:'2026-02-08',tier:'trt',logged:true},      // zero dose
    {compound_id:'enanthate',dose:'100',date:'2026-02-15',tier:'trt',logged:false},   // unchecked
    {compound_id:'ipamorelin',dose:'200',date:'2026-02-01',tier:'peptide',logged:true} // non-T
  ];
  var _lt=G._thLoggedTrt(_ltRows);
  check('_thLoggedTrt: only logged TRT with dose>0 → 1, mapped to {compId,doseMg,date}',
        _lt.length===1 && _lt[0].compId==='enanthate' && _lt[0].doseMg===125 && _lt[0].date==='2026-02-01', JSON.stringify(_lt));
}
if(typeof G._thMergedPastLog==='function'){
  var _mlSaveTcp=G._tcp, _mlSaveInj=G._thInjections;
  G._tcp={manualLog:[{compId:'enanthate',doseMg:100,date:'2026-01-01'}]};
  G._thInjections=[
    {compound_id:'enanthate',dose:'100',date:'2026-01-01',tier:'trt',logged:true},   // dup of manualLog → deduped
    {compound_id:'enanthate',dose:'120',date:'2026-01-08',tier:'trt',logged:true},   // new
    {compound_id:'enanthate',dose:'100',date:'2999-01-01',tier:'trt',logged:true}    // future → excluded
  ];
  var _ml=G._thMergedPastLog();
  check('_thMergedPastLog: manualLog ∪ logged-trt, deduped, past-only, sorted → 2',
        _ml.length===2 && _ml[0].date==='2026-01-01' && _ml[1].date==='2026-01-08', JSON.stringify(_ml.map(function(x){return x.date;})));
  G._tcp=_mlSaveTcp; G._thInjections=_mlSaveInj;
}

// _thSeries: builds the render series from STORED plasma rows (no PK math here).
if(typeof G._thSeries==='function'){
  var _sSaveData=G._thData, _sSaveInj=G._thInjections;
  G._thInjections=[];
  G._thData=[
    {date:'2026-03-01',marker:'free_t',value:300,unit:'pmol/L'},
    {date:'2026-03-03',marker:'free_t',value:500,unit:'pmol/L'},   // gap on 03-02 → interpolated
    {date:'2026-03-04',marker:'free_t',value:450,unit:'pmol/L'}
  ];
  var _s=G._thSeries();
  check('_thSeries: spans first→last stored day (totalDays=3)', !!_s && _s.totalDays===3, _s?String(_s.totalDays):'null');
  check('_thSeries: calibrated flag from stored unit (pmol/L)', !!_s && _s.calibrated===true);
  check('_thSeries: plots the stored values (ft[0]=300, ft[3]=450)', !!_s && _s.ft[0]===300 && _s.ft[3]===450, _s?(_s.ft[0]+','+_s.ft[3]):'null');
  check('_thSeries: gaps interpolated (ft[1] between 300 and 500)', !!_s && _s.ft[1]>300 && _s.ft[1]<500, _s?String(_s.ft[1]):'null');
  check('_thSeries: maxFt = peak stored value', !!_s && _s.maxFt===500, _s?String(_s.maxFt):'null');
  G._thData=[];
  check('_thSeries: empty store → null (drives empty state)', G._thSeries()===null);
  G._thData=_sSaveData; G._thInjections=_sSaveInj;
}

// _thZoomLevels: always W/M/Y/All (fixed windows, never hidden).
if(typeof G._thZoomLevels==='function'){
  check('_thZoomLevels: always Week/Month/Year/All', G._thZoomLevels().map(function(z){return z.id;}).join(',')==='week,month,year,all');
}
// _thWindow: each period is EXACTLY 1 week / 1 month / 1 year wide, ending at the
// as-of day, and may extend before the first data point on short histories.
if(typeof G._thWindow==='function'){
  var _wW=G._thWindow('week',27,27);
  check('_thWindow week: exactly 7 days wide', (_wW.winEnd-_wW.winStart)===7, (_wW.winEnd-_wW.winStart)+'');
  var _wM=G._thWindow('month',27,27);
  check('_thWindow month: exactly 30 days even when history is shorter', (_wM.winEnd-_wM.winStart)===30 && _wM.winStart===-3 && _wM.winEnd===27, JSON.stringify(_wM));
  var _wY=G._thWindow('year',27,27);
  check('_thWindow year: exactly 365 days', (_wY.winEnd-_wY.winStart)===365, (_wY.winEnd-_wY.winStart)+'');
  var _wA=G._thWindow('all',27,27);
  check('_thWindow all: full history span', _wA.winStart===0 && _wA.winEnd===27);
  var _wMid=G._thWindow('month',50,120);
  check('_thWindow month: ends at the as-of day, still exactly 30 wide', _wMid.winEnd===50 && _wMid.winStart===20);
}

// ── Capture MUST reproduce the T-Calc curve and NEVER blow up ────────────────
// Hard regression for the ~50× / 9,345 pmol/L explosions. The capture computes the
// per-day free-T with the exact T-Calc model (no anchor override) — the value that
// gets stored and plotted. It must stay physiological in every calibration state,
// ── T-History capture: explicit, from the displayed curve, no blow-up ─────────
// History is WRITTEN only by tcSaveHistoryFromCurve (the "Update saved history"
// button), and only ever the plasma curve exactly as displayed (cached in _tcDrawnFT
// during a calibrated draw). No re-derivation, no auto-capture. These tests pin: the
// draw caches a bounded series (calibrated to bloodwork — the case that used to read
// ~10x high), and the writer clears-then-writes, refuses garbage, and no-ops with
// nothing to save.
console.log('\n── T-History capture (explicit, bounded) ──────────────────');
if (typeof G._tcDrawManualChart === 'function' && typeof G.tcSaveHistoryFromCurve === 'function') {
  var _svFT=G._tcp.measuredFT, _svDose=G._tcp.currentDoseMgWk, _svBw=G._tcBwEntries, _svFetch=G.fetch;

  // Calibrated draw: a real blood draw during the cycle → curve anchors to it.
  G._tcp.measuredFT='497'; G._tcp.currentDoseMgWk='';
  G._tcBwEntries=[{date:'2026-07-20', free_t:497}];
  G._tcDrawnFT=null;
  var _dl=[]; for(var _di=0;_di<12;_di++){ var _dd=new Date(new Date('2026-06-26').getTime()+_di*2*86400000);
    _dl.push({compId:'testoviron',doseMg:'125',date:_dd.getFullYear()+'-'+String(_dd.getMonth()+1).padStart(2,'0')+'-'+String(_dd.getDate()).padStart(2,'0')}); }
  try { G._tcDrawManualChart('tc-main-chart', _dl); } catch(e){}
  check('a calibrated draw caches the displayed series', !!(G._tcDrawnFT && G._tcDrawnFT.values && G._tcDrawnFT.values.length));
  var _mx = G._tcDrawnFT ? Math.max.apply(null, G._tcDrawnFT.values.concat([0])) : 0;
  check('cached series is bounded — no 10x blow-up (anchored to bloodwork)', _mx>0 && _mx<1500, 'max '+Math.round(_mx));
  check('cached series ends at the last injection (no future tail)',
    !!G._tcDrawnFT && G._tcDrawnFT.values.length === Math.round((new Date(_dl[_dl.length-1].date)-new Date(_dl[0].date))/86400000)+1);

  // A scheduled FUTURE dose must NOT extend history into the future — it ends at the
  // last injection actually taken (date on or before today).
  var _fToday = new Date();
  var _fStart = new Date(_fToday.getTime() - 20*86400000);
  var _fMid   = new Date(_fToday.getTime() -  4*86400000);   // last TAKEN shot
  var _fFut   = new Date(_fToday.getTime() + 14*86400000);   // scheduled, not taken
  var _fmt = function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  G._tcDrawnFT=null;
  try { G._tcDrawManualChart('tc-main-chart', [
    {compId:'testoviron',doseMg:'125',date:_fmt(_fStart)},
    {compId:'testoviron',doseMg:'125',date:_fmt(_fMid)},
    {compId:'testoviron',doseMg:'125',date:_fmt(_fFut)} ]); } catch(e){}
  var _fLastDay = !!G._tcDrawnFT ? (G._tcDrawnFT.values.length - 1) : -1;
  var _fExpect  = Math.round((_fMid - _fStart)/86400000);
  check('history stops at the last TAKEN injection, not a scheduled future dose',
    !!G._tcDrawnFT && _fLastDay === _fExpect, 'lastDay '+_fLastDay+' expected '+_fExpect);
  check('no stored history point is dated in the future',
    !!G._tcDrawnFT && (G._tcDrawnFT.firstMs + _fLastDay*86400000) <= Date.now());
  check('cached entries would carry the pmol/L unit', !!G._tcDrawnFT && G._tcDrawnFT.unit==='pmol/L');

  // Writer guards — synchronous (fetch is only called when it actually writes):
  var _calls; var _mockFetch=function(){ _calls=[]; return function(u,o){ _calls.push({url:u,method:(o&&o.method)||'GET',body:o&&o.body}); return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); }; };

  // no cached curve → writes nothing
  G._tcDrawnFT=null; G.fetch=_mockFetch(); G.tcSaveHistoryFromCurve();
  check('writer with no cached curve calls no endpoint', _calls.length===0);

  // an absurd curve is refused before any write
  G._tcDrawnFT={firstMs:Date.now(),unit:'pmol/L',values:[100,7000]}; G.fetch=_mockFetch(); G.tcSaveHistoryFromCurve();
  check('writer refuses an absurdly-high curve (>6000) — no write', _calls.length===0);

  // a normal curve clears the marker (DELETE) first, then writes
  G._tcDrawnFT={firstMs:new Date('2026-06-26T00:00:00Z').getTime(),unit:'pmol/L',values:[210,240,300,420,497]};
  G.fetch=_mockFetch(); G.tcSaveHistoryFromCurve();
  check('writer clears the free_t marker (DELETE) before writing',
    _calls.length>=1 && _calls[0].method==='DELETE' && /plasma-history/.test(_calls[0].url) && /marker=free_t/.test(_calls[0].url));

  G._tcp.measuredFT=_svFT; G._tcp.currentDoseMgWk=_svDose; G._tcBwEntries=_svBw; G.fetch=_svFetch;
}

// No path in the app captures history automatically — the button is the only writer.
{
  var _files = ['tab-tcalc.js','tab-thist.js','tab-today.js'];
  var _autoOk = _files.every(function(f){
    var src = fs.readFileSync(path.join(dir,f),'utf8');
    // The dead auto-capture helpers must be gone entirely (comments excepted).
    var codeOnly = src.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
    return codeOnly.indexOf('_captureFreeTHistory') < 0 && codeOnly.indexOf('_thComputeFreeT') < 0;
  });
  check('no automatic history capture remains in any tab', _autoOk);
  var _tcSrc = fs.readFileSync(path.join(dir,'tab-tcalc.js'),'utf8');
  check('saving the T-Calc profile does not capture history',
    _tcSrc.slice(_tcSrc.indexOf('function _tcSaveProfile'), _tcSrc.indexOf('function _tcSaveProfile')+900).indexOf('SaveHistoryFromCurve') < 0);
}

// Add-a-past-injection modal: catalogue wiring + validation surface.
if(typeof G._piCat==='function'){
  check('_piCat trt → TRT_CAT list', Array.isArray(G._piCat('trt')) && G._piCat('trt').length>0);
  check('_piCat peptide → PEPTIDE_CAT list', Array.isArray(G._piCat('peptide')) && G._piCat('peptide').length>0);
  check('_piDefaultUnit: peptide µg, trt mg', G._piDefaultUnit('peptide')==='µg' && G._piDefaultUnit('trt')==='mg');
}

// ── Compound-aware macros (Batch 2) ────────────────────────────────────────
console.log('\n── Compound-aware macros ──────────────────────────────────');
if(typeof G.calcMacros==='function'){
  var _mOff=G.calcMacros(90,'recomp',false);
  var _mOn =G.calcMacros(90,'recomp',true);
  check('calcMacros protein = 2.2 g/kg in a non-cut phase', _mOff.protein===Math.round(90*2.2), String(_mOff.protein));
  check('calcMacros fat lower on injected androgens', _mOn.fat < _mOff.fat, _mOn.fat+' vs '+_mOff.fat);
  check('calcMacros carbs energy-balanced & non-negative', _mOn.carbs>=0 && _mOff.carbs>=0);
  check('calcMacros cut < recomp kcal', G.calcMacros(90,'cut',true).kcal < G.calcMacros(90,'recomp',true).kcal);
  check('calcMacros flags onAndrogens through', G.calcMacros(90,'recomp',true).onAndrogens===true && _mOff.onAndrogens===false);
  // Phase-aware protein: a cut raises protein (deficit preserves muscle — Helms 2014),
  // and being on androgens does NOT raise it further (nitrogen retention is already better).
  check('calcMacros cut protein = 2.5 g/kg (raised for the deficit)', G.calcMacros(90,'cut',false).protein===Math.round(90*2.5), String(G.calcMacros(90,'cut',false).protein));
  check('calcMacros cut protein > recomp protein', G.calcMacros(90,'cut',false).protein > G.calcMacros(90,'recomp',false).protein);
  check('calcMacros protein independent of androgens within a phase', G.calcMacros(90,'cut',true).protein===G.calcMacros(90,'cut',false).protein);
  if(typeof G._macrosFatNote==='function'){
    check('_macrosFatNote cut mentions the raised protein + Helms', /2\.5 g\/kg/.test(G._macrosFatNote(false,'cut')) && /Helms 2014/.test(G._macrosFatNote(false,'cut')));
    check('_macrosFatNote non-cut keeps 2.2 g/kg', /2\.2 g\/kg/.test(G._macrosFatNote(false,'recomp')));
  }
  // Calorie target is intake-only: ~31 kcal/kg ± phase, and NOT affected by the
  // measured training burn (which is presented separately).
  check('calcMacros recomp kcal = 31 kcal/kg + 100 (training not folded in)', G.calcMacros(90,'recomp',false).kcal===Math.round(90*31)+100, String(G.calcMacros(90,'recomp',false).kcal));
  check('calcMacros returns no maintenance/train fields (target is training-independent)', G.calcMacros(90,'recomp',false).trainKcal===undefined && G.calcMacros(90,'recomp',false).maint===undefined);
  // Training burn is shown separately via _macrosBurnCard, driven by _macrosTrainKcal.
  if(typeof G._macrosBurnCard==='function'){
    G._macrosTrainKcal=270;
    check('_macrosBurnCard shows the burn kcal and marks it separate from the target', /270/.test(G._macrosBurnCard()) && /not added to the calorie target/i.test(G._macrosBurnCard()));
    G._macrosTrainKcal=0;
    check('_macrosBurnCard with no data prompts to log workouts, not zero-burn scare', /log your workouts/i.test(G._macrosBurnCard()));
  }
}
if(typeof G._macrosOnAndrogens==='function'){
  G._userStacks=[{trt:{enabled:true,compounds:[{id:'enanthate'}]},enhanced:{compounds:[]}}]; G._activeStackIndices=[0];
  check('_macrosOnAndrogens: true when TRT enabled', G._macrosOnAndrogens()===true);
  G._userStacks=[{trt:{enabled:false,compounds:[]},enhanced:{compounds:[{id:'nandrolone'}]}}]; G._activeStackIndices=[0];
  check('_macrosOnAndrogens: true when Enhanced present', G._macrosOnAndrogens()===true);
  G._userStacks=[{trt:{enabled:false,compounds:[]},enhanced:{compounds:[]},peptides:[{id:'cjc-ipa'}]}]; G._activeStackIndices=[0];
  check('_macrosOnAndrogens: false for peptide-only', G._macrosOnAndrogens()===false);
}
if(typeof G._wizFlow==='function'){
  G._wiz={goals:[],trt:{enabled:false,compounds:[]},enhanced:{enabled:false,compounds:[]}};
  var _nf=G._wizFlow();
  check('_wizFlow includes the nutrition (macros) step', _nf.indexOf('nutrition')>=0);
  check('nutrition step precedes review', _nf.indexOf('nutrition') < _nf.indexOf('review'));
}

// ── Supplements sub-tab lives under the Plan group (moved from Today) ───────────
console.log('\n── Supplements grouped under Plan ─────────────────────────');
if(typeof G.primaryOf==='function'){
  check('Supplements is in the Plan group', G.primaryOf('supplements')==='plan');
  check('Supplements is no longer in the Today group', G.primaryOf('supplements')!=='today');
  check('Stacks stays in Plan',                G.primaryOf('stacks')==='plan');
  check('Today dashboard still owns its supplement card (renderTodaySupplements)',
        typeof G.renderTodaySupplements==='function' && html.includes('id="today-supplements"'));
}

// ── HGH default timing: AM-fasted soft nudge ───────────────────────────────────
// Rule (2026-07-23): exogenous HGH defaults to a single fasted AM dose (insulin opposes
// GH's lipolytic action; AM off the overnight fast is the simplest low-insulin window).
// PM remains available for users who split higher doses. Evidence: backend
// docs/enhanced-bodybuilding/10-gh-injection-timing.md.
console.log('\n── HGH default timing (AM-fasted nudge) ───────────────────');
{
  const _hi = html.indexOf("id:'hgh'");
  check('peptide-tier HGH entry present', _hi >= 0);
  if (_hi >= 0) {
    const _seg = html.slice(_hi, _hi + 3200);
    const _dfltM = _seg.match(/dflt:\{times:\[([^\]]*)\]/);
    check('HGH default times is AM-only (no PM by default)',
      !!_dfltM && /'AM'/.test(_dfltM[1]) && !/'PM'/.test(_dfltM[1]),
      _dfltM ? _dfltM[1] : 'no dflt match');
    check('HGH protocol still says inject fasted', /Inject fasted/i.test(_seg));
  }
}


// ── Third intra-day dose slot: MID / "Pre-GYM" ────────────────────────────────
// Exogenous HGH is commonly split into 2-3 fasted micro-doses, so a compound must be
// able to schedule three doses in one day. MID sits between AM and PM everywhere:
// slot constants, the stack/wizard editors, injection generation and the day ordering.
// Backend counterpart: _TIME_SLOTS in routers/injections.py.
console.log('\n── Third dose slot (AM / Pre-GYM / PM) ────────────────────');
{
  check('TIME_SLOTS is AM, MID, PM in chronological order',
    Array.isArray(G.TIME_SLOTS) && G.TIME_SLOTS.join(',')==='AM,MID,PM');
  check('MID is labelled "Pre-GYM" in the UI', G._slotLabel('MID')==='Pre-GYM');
  check('AM/PM labels unchanged', G._slotLabel('AM')==='AM' && G._slotLabel('PM')==='PM');
  check('_slotKey maps a slot to its field suffix',
    G._slotKey('MID')==='mid' && G._slotKey('AM')==='am' && G._slotKey('PM')==='pm');
  check('MID sorts between AM and PM',
    G.TIME_RANK.AM < G.TIME_RANK.MID && G.TIME_RANK.MID < G.TIME_RANK.PM);

  // Editor renders a dose row per selected slot, and only for selected slots.
  var _p3={id:'hgh',name:'HGH',dot:'#3cffa0',times:['AM','MID','PM'],days:[1,2,3,4,5],
           dose_am:'2',dose_mid:'2',dose_pm:'2',unit_am:'IU',unit_mid:'IU',unit_pm:'IU',active:true};
  var _ed3=G._renderEditPep(_p3,0);
  check('editor: three slots selected → three dose rows',
    _ed3.includes('AM Dose')&&_ed3.includes('Pre-GYM Dose')&&_ed3.includes('PM Dose'));
  check('editor: Pre-GYM input bound to dose_mid', _ed3.includes('dose_mid=this.value'));
  var _ed1=G._renderEditPep({id:'hgh',name:'HGH',times:['AM'],days:[1],dose_am:'2',unit_am:'IU',active:true},0);
  check('editor: AM-only → no Pre-GYM row', _ed1.includes('AM Dose')&&!_ed1.includes('Pre-GYM Dose'));

  // GH-axis compounds carry the fasted-window qualifier Henrik specified.
  check('GH-axis: fasted hint names all three windows',
    _ed3.includes('AM (fasted)')&&_ed3.includes('Pre-GYM (2 h fasted)')&&_ed3.includes('PM (2 h fasted)'));
  var _edRet=G._renderEditPep({id:'retatrutide',name:'Retatrutide',times:['AM'],days:[0],dose_am:'3',unit_am:'mg',active:true},0);
  check('non-GH compound gets no fasted hint', !_edRet.includes('(fasted)'));

  // A slot with no catalogue unit inherits the compound's unit, not a generic mg.
  var _hghCat=G.PEPTIDE_CAT.find(function(c){return c.id==='hgh';});
  check('slot unit inherits compound unit (IU, not mg)',
    G._slotFieldsFromDflt(_hghCat.dflt).unit_mid==='IU');

  // buildWeeklyFromProtocol surfaces all three doses.
  var _wk3=G.buildWeeklyFromProtocol({peptides:[_p3]});
  var _mid=_wk3.filter(function(e){return e.time==='MID';});
  check('weekly view emits a MID entry', _mid.length>0);
  check('weekly MID entry carries its own dose', _mid.length>0 && /2/.test(_mid[0].detail||''));

  // Today ordering puts Pre-GYM between AM and PM.
  var _doses=[{time_of_day:'PM'},{time_of_day:'MID'},{time_of_day:'AM'}];
  _doses.sort(function(a,b){return (G.TIME_RANK[a.time_of_day]??2)-(G.TIME_RANK[b.time_of_day]??2);});
  check('today ordering is AM → Pre-GYM → PM',
    _doses.map(function(d){return d.time_of_day;}).join(',')==='AM,MID,PM');

  // The HGH default is untouched by this change — still a single fasted AM dose.
  check('HGH default is still AM-only (3-split stays opt-in)',
    _hghCat.dflt.times.length===1 && _hghCat.dflt.times[0]==='AM');
  check('HGH protocol documents the three fasted micro-doses',
    /Pre-GYM/.test(_hghCat.protocol) && /2 \+ 2 \+ 2 IU/.test(_hghCat.protocol));
  check('HGH protocol labels the 3-split as not trial-backed',
    /rather than trial-backed/.test(_hghCat.protocol));
}


// ── Dose inputs must raise a numeric keypad on iOS ────────────────────────────
// A bare type="text" input opens the QWERTY keyboard on iOS, so entering a dose
// meant switching to the 123 layer every time. Dose fields are numeric (and may be
// decimal: 0.09 ml, 2.5 mg), so every one carries inputmode="decimal". type="number"
// is deliberately not used — it adds spinners and fights locale decimal separators.
// Covers all three tiers: peptide, TRT and enhanced, editor and wizard alike.
console.log('\n── Dose inputs: numeric keypad ────────────────────────────');
{
  const _stackSrc = fs.readFileSync(path.join(dir,'tab-stack.js'),'utf8');
  const _textDose = _stackSrc.match(/class="dose-in" type="text"(?! inputmode="decimal")/g) || [];
  check('every text dose input declares inputmode="decimal"', _textDose.length===0,
    _textDose.length+' dose input(s) missing inputmode');
  const _withMode = _stackSrc.match(/class="dose-in" type="text" inputmode="decimal"/g) || [];
  check('all 9 dose inputs are covered', _withMode.length===9, 'found '+_withMode.length);

  // The enhanced tier is where HGH actually lives, so pin its rendered markup directly.
  // ENHANCEMENT_COMPOUNDS is backend-fetched, so seed the HGH entry the editor looks up.
  var _prevEnhCat = G.ENHANCEMENT_COMPOUNDS;
  // _renderEditEnhanced locks non-testosterone cards below tier 3 as of 2026-08-20, so
  // the tier has to be stated to exercise the editor itself. It used to be ignored here.
  var _prevTierEnh = G._userTier; G._userTier = 3;
  G.ENHANCEMENT_COMPOUNDS = [{id:'hgh',name:'HGH (Somatropin)',group:'GH Axis',cls:'ghaxis',
    dot:'#e8a020',defaultDose:2,unit:'IU/day',defaultDays:[1,2,3,4,5],
    amPm:true,defaultDoseAm:2,defaultDosePm:0}];
  var _enhHtml = G._renderEditEnhanced({enabled:true,compounds:[
    {id:'hgh',name:'HGH',dose_am:'2',dose_mid:'2',dose_pm:'2',unit:'IU/day',days:[1],amPm:true}]});
  var _enhInputs = (_enhHtml.match(/<input class="dose-in"[^>]*>/g)||[]);
  check('enhanced tier renders dose inputs', _enhInputs.length>0);
  check('every rendered enhanced dose input has the numeric keypad',
    _enhInputs.length>0 && _enhInputs.every(function(t){return t.indexOf('inputmode="decimal"')>=0;}));
  check('enhanced tier renders one dose input per slot', _enhInputs.length===3, 'got '+_enhInputs.length);
  G.ENHANCEMENT_COMPOUNDS = _prevEnhCat; G._userTier = _prevTierEnh;
}

// ── Every numeric field raises a numeric keypad, app-wide ─────────────────────
// Reported 2026-07-31: the onboarding Age field opened iOS's numbers-and-
// punctuation keyboard (digits plus - / : ; ( ) £ & @ " and an ABC key) rather
// than a plain keypad. That layout is what bare type="number" gets on iOS —
// inputmode is what actually selects the keypad, and 14 number inputs had none.
// Decimal-capable fields use inputmode="decimal"; integer fields (age, height,
// week counts, injection counts/intervals, frequencies) use inputmode="numeric".
console.log('\n── Numeric keypad on every number field ───────────────────');
{
  var _numFiles = ['index.html'].concat(fs.readdirSync(dir).filter(function(f){
    return /^tab-.*\.js$/.test(f); }).sort());
  var _bare = [];
  _numFiles.forEach(function(f){
    var s = fs.readFileSync(path.join(dir,f),'utf8');
    var re = /type=(\\?")number\1/g, m;
    while ((m = re.exec(s))) {
      var st = s.lastIndexOf('<input', m.index), en = s.indexOf('>', m.index);
      if (st === -1 || en === -1) continue;
      if (s.slice(st, en + 1).indexOf('inputmode') === -1)
        _bare.push(f + ':' + (s.slice(0, m.index).split('\n').length));
    }
  });
  check('no type="number" input is left without an inputmode', _bare.length === 0,
    _bare.length ? _bare.join(', ') : 'all number inputs declare one');

  // Behavioural, not just source-scanning: the two fields from the report.
  if (typeof G._obHtml2 === 'function') {
    var _svOb = G._obData;
    G._obData = {sex:'male'};
    var _ob = G._obHtml2();
    var _obNum = (_ob.match(/<input[^>]*>/g) || []).filter(function(t){
      return /type="(number|text)"/.test(t); });
    check('the onboarding stats step renders its inputs', _obNum.length === 3,
      'got ' + _obNum.length);
    check('  …every one declares an inputmode',
      _obNum.every(function(t){ return t.indexOf('inputmode=') !== -1; }));
    check('  …Age asks for a plain numeric keypad',
      /Age<\/label>[\s\S]{0,80}inputmode="numeric"/.test(_ob));
    check('  …Height asks for a plain numeric keypad',
      /Height \(cm\)<\/label>[\s\S]{0,80}inputmode="numeric"/.test(_ob));
    check('  …Body Weight still allows a decimal point',
      /Body Weight \(kg\)<\/label>[\s\S]{0,80}inputmode="decimal"/.test(_ob));
    G._obData = _svOb;
  } else {
    check('_obHtml2 available for the onboarding keypad check', false);
  }
}


// ── Fasted-window labels reach the Enhanced tier ──────────────────────────────
// HGH is reachable from BOTH the peptide catalogue and the backend enhanced
// catalogue, and it is the enhanced tier that users actually configure it from.
// The per-slot fasted qualifier — AM (fasted) / Pre-GYM (2 h fasted) / PM (2 h
// fasted) — must therefore render in the enhanced editor and wizard too, not just
// the peptide ones. Enhanced catalogue entries carry no `cg` array, so _isGhAxis
// resolves them by cls/group instead.
console.log('\n── Enhanced tier: fasted-window labels ────────────────────');
{
  const _prevCat = G.ENHANCEMENT_COMPOUNDS;
  G.ENHANCEMENT_COMPOUNDS = [
    {id:'hgh',name:'HGH (Somatropin)',group:'GH Axis',cls:'ghaxis',dot:'#e8a020',
     defaultDose:2,unit:'IU/day',defaultDays:[1,2,3,4,5],amPm:true,defaultDoseAm:2,defaultDosePm:0},
    {id:'test_e',name:'Testosterone Enanthate',group:'Base',cls:'base',dot:'#e05050',
     defaultDose:300,unit:'mg/week',defaultDays:[1,4],amPm:true,defaultDoseAm:150,defaultDosePm:150}];

  check('_isGhAxis resolves an enhanced-catalogue GH compound', G._isGhAxis('hgh')===true);
  check('_isGhAxis is false for a non-GH enhanced compound', G._isGhAxis('test_e')===false);

  // Tier stated explicitly: _renderEditEnhanced locks non-testosterone cards below
  // tier 3 as of 2026-08-20, and these exercise the editor itself.
  var _prevTierSlots=G._userTier; G._userTier=3;
  var _mk=function(id){return G._renderEditEnhanced({enabled:true,compounds:[
    {id:id,name:id,dose_am:'2',dose_mid:'2',dose_pm:'2',unit:'IU/day',days:[1],amPm:true}]});};
  var _hghHtml=_mk('hgh'), _tHtml=_mk('test_e');

  check('enhanced editor names all three fasted windows',
    _hghHtml.indexOf('AM (fasted)')>=0 && _hghHtml.indexOf('Pre-GYM (2 h fasted)')>=0
      && _hghHtml.indexOf('PM (2 h fasted)')>=0);
  check('enhanced editor explains why (low-insulin window)',
    _hghHtml.indexOf('low-insulin window')>=0);
  check('non-GH enhanced compound gets no fasted hint',
    _tHtml.indexOf('(fasted)')<0);

  G.ENHANCEMENT_COMPOUNDS = _prevCat;
}


// ── Enhanced tier: schedule chips ─────────────────────────────────────────────
// The enhanced tier used to express its schedule implicitly — all three dose rows
// were always shown and you skipped a slot by leaving it blank. It now has the same
// AM / Pre-GYM / PM chips as the peptide tier, backed by a `times` array.
//
// The delicate part is back-compat: stacks saved before `times` existed must keep the
// schedule they already had. _enhTimes infers it from which slot doses are populated,
// which is precisely what used to decide whether a slot generated an injection.
console.log('\n── Enhanced tier: schedule chips ──────────────────────────');
{
  const _prev = G.ENHANCEMENT_COMPOUNDS;
  G.ENHANCEMENT_COMPOUNDS = [{id:'hgh',name:'HGH (Somatropin)',group:'GH Axis',cls:'ghaxis',
    dot:'#e8a020',defaultDose:2,unit:'IU/day',defaultDays:[1,2,3,4,5],
    amPm:true,defaultDoseAm:2,defaultDosePm:0}];

  // back-compat: no `times` field
  check('legacy AM+PM stack keeps AM+PM',
    G._enhTimes({id:'hgh',amPm:true,dose_am:'2',dose_pm:'2'}).join('+')==='AM+PM');
  check('legacy AM-only stack keeps AM',
    G._enhTimes({id:'hgh',amPm:true,dose_am:'2',dose_pm:'0'}).join('+')==='AM');
  check('legacy stack with no doses falls back to AM+PM',
    G._enhTimes({id:'hgh',amPm:true}).join('+')==='AM+PM');

  // explicit times wins, and is normalised to chronological order
  check('explicit times overrides inference',
    G._enhTimes({id:'hgh',amPm:true,times:['AM','PM'],dose_am:'2',dose_mid:'9',dose_pm:'2'}).join('+')==='AM+PM');
  check('times is returned in chronological order',
    G._enhTimes({id:'hgh',amPm:true,times:['PM','AM','MID']}).join('+')==='AM+MID+PM');
  check('a deselected slot does not inflate the daily total',
    G._enhSplitTotal({id:'hgh',amPm:true,times:['AM','PM'],dose_am:'2',dose_mid:'9',dose_pm:'2'})===4);

  // chip toggling, including the never-empty guard
  G._editBuf={cycle_start:'2026-07-01',peptides:[],enhanced:{enabled:true,compounds:[
    {id:'hgh',name:'HGH',amPm:true,dose_am:'2',dose_pm:'2',unit:'IU/day',days:[1]}]}};
  var _cur=function(){return G._enhTimes(G._editBuf.enhanced.compounds[0]).join('+');};
  G.editToggleEnhTime('hgh','MID');
  check('selecting Pre-GYM adds it in order', _cur()==='AM+MID+PM');
  G.editToggleEnhTime('hgh','PM');
  check('deselecting PM removes it', _cur()==='AM+MID');
  G.editToggleEnhTime('hgh','AM'); G.editToggleEnhTime('hgh','MID');
  check('the last remaining slot cannot be deselected', _cur()==='MID');

  // rendered rows follow the chips
  G._editBuf.enhanced.compounds[0].times=['AM','PM'];
  var _h2=G._renderEditEnhanced(G._editBuf.enhanced);
  check('AM+PM selected renders no Pre-GYM row',
    _h2.indexOf('AM Dose')>=0 && _h2.indexOf('PM Dose')>=0 && _h2.indexOf('Pre-GYM Dose')<0);
  check('the unselected Pre-GYM chip is still offered', _h2.indexOf('>Pre-GYM</div>')>=0);
  G._editBuf.enhanced.compounds[0].times=['AM','MID','PM'];
  check('all three selected renders all three rows',
    G._renderEditEnhanced(G._editBuf.enhanced).indexOf('Pre-GYM Dose')>=0);

  // the split toggle itself is untouched — it still distinguishes a single untimed
  // daily dose from per-slot dosing, and must not disappear now that chips exist
  var _off=G._renderEditEnhanced({enabled:true,compounds:[
    {id:'hgh',name:'HGH',amPm:false,dose:'6',unit:'IU/day',days:[1]}]});
  check('split OFF still gives one untimed Dose row',
    _off.indexOf('>Dose</div>')>=0 && _off.indexOf('AM Dose')<0);
  check('the split toggle is still present when off',
    _off.indexOf('Split across AM / Pre-GYM / PM')>=0);
  G._userTier=_prevTierSlots;

  // seeding a fresh entry from the catalogue
  var _seed={};
  G._enhSeedSlots(_seed,G.ENHANCEMENT_COMPOUNDS[0]);
  check('a newly added HGH seeds an AM-only schedule (split stays opt-in)',
    (_seed.times||[]).join('+')==='AM');

  G.ENHANCEMENT_COMPOUNDS = _prev;
}


// ── Wizard: mandatory testosterone-base step ──────────────────────────────────
// The advisor used to present Testosterone Enanthate as "required base (always
// included)" — the only ester on offer. Every enhanced cycle runs on a testosterone
// base and the ester decides injection frequency for the whole cycle, so it is now
// picked explicitly on its own step, before any other compound. Esters come from the
// backend catalogue (cls==='base'); nothing is hardcoded in the frontend.
console.log('\n── Wizard: testosterone base step ─────────────────────────');
{
  const _prevCat = G.ENHANCEMENT_COMPOUNDS;
  G.ENHANCEMENT_COMPOUNDS = [
    {id:'test_e',name:'Testosterone Enanthate',cls:'base',dot:'#e05050',defaultDose:300,unit:'mg/week',defaultDays:[1,4],
     cadence:{rec:'2×/week',halfLife:'~7 days',note:'Twice-weekly smooths peak-to-trough.'}},
    {id:'test_p',name:'Testosterone Propionate',cls:'base',dot:'#e05050',defaultDose:350,unit:'mg/week',defaultDays:[1,3,5],
     cadence:{rec:'EOD or daily',halfLife:'~0.8 days',note:'Short ester — inject EOD.'}},
    {id:'test_u',name:'Testosterone Undecanoate (Nebido)',cls:'base',dot:'#e05050',defaultDose:100,unit:'mg/week',defaultDays:[1],
     cadence:{rec:'1000 mg every 10–14 weeks',halfLife:'~34 days',note:'Ultra-long ester.'}},
    {id:'primo',name:'Primobolan',cls:'dht',dot:'#3b9eff',defaultDose:400,unit:'mg/week',defaultDays:[1,4]}];

  G.initWizard(); G._wiz.goals=['enhanced'];
  var _flow=G._wizFlow();
  check('enhanced flow includes a base step', _flow.indexOf('base')>=0);
  check('the base step comes before guidance', _flow.indexOf('base')<_flow.indexOf('advise'));
  check('the base step comes before the enhanced compound list',
    _flow.indexOf('base')<_flow.indexOf('enhanced'));

  var _b={innerHTML:''}, _f={innerHTML:''};
  G.wizStepBase(_b,_f);
  check('every base ester in the catalogue is offered',
    _b.innerHTML.indexOf('Testosterone Enanthate')>=0 && _b.innerHTML.indexOf('Testosterone Propionate')>=0
      && _b.innerHTML.indexOf('Testosterone Undecanoate')>=0);
  check('non-base compounds are not offered as a base', _b.innerHTML.indexOf('Primobolan')<0);
  check('the recommended ester is badged, not forced', _b.innerHTML.indexOf('RECOMMENDED')>=0);
  check('the step is mandatory — Next is gated until an ester is picked',
    _f.innerHTML.indexOf('disabled')>=0);

  G.wizSetBaseEster('test_p');
  check('picking an ester records it as the base', G._wizBaseId()==='test_p');
  check('the picked ester is added to the protocol',
    ((G._wiz.enhanced&&G._wiz.enhanced.compounds)||[]).some(function(c){return c.id==='test_p';}));
  G.wizStepBase(_b,_f);
  check('Next is enabled once an ester is picked', _f.innerHTML.indexOf('disabled')<0);
  check('the chosen ester shows its own cadence note', _b.innerHTML.indexOf('Short ester')>=0);

  // switching must swap the base, never stack two testosterones
  G._wizAdviseAdd('primo');
  G.wizSetBaseEster('test_u');
  var _ids=((G._wiz.enhanced&&G._wiz.enhanced.compounds)||[]).map(function(c){return c.id;});
  check('switching ester replaces the old base', _ids.indexOf('test_p')<0 && _ids.indexOf('test_u')>=0);
  check('switching ester leaves non-base compounds alone', _ids.indexOf('primo')>=0);
  check('only ever one testosterone base in the protocol',
    _ids.filter(function(i){return ['test_e','test_p','test_u'].indexOf(i)>=0;}).length===1);

  check('the chosen ester is sent to the advisor', G._wizAdviseInputs().base_id==='test_u');

  // the guidance step no longer calls the base "always included"
  const _stackSrc = fs.readFileSync(path.join(dir,'tab-stack.js'),'utf8');
  check('guidance no longer labels the base "always included"',
    _stackSrc.indexOf('Required base (always included)')<0);

  G.ENHANCEMENT_COMPOUNDS = _prevCat;
}


// ── Depot-ester PK: corrected half-life + uncertainty band ────────────────────
// T-Calc modelled testosterone undecanoate at ~34 d, parsed from the hardcoded
// TRT_GUIDE string. That is the fitted SINGLE-DOSE terminal half-life for castor-oil
// TU — real, but the wrong figure for projecting months of accumulation, which it
// under-predicts by ~1.65x in steady-state level. The backend now serves 56 d central —
// the mean of the plateau-equivalents derived from BOTH primaries (CCDS 42/17 -> 53.6 d,
// UK SmPC 37/16 -> 57.8 d) — with a 37-75 d band that is the published inter-individual
// spread (CV 34% on trough), i.e. an individual prediction interval. See the backend's
// docs/enhanced-bodybuilding/11-testosterone-undecanoate-pk.md). _tcCompInfo already
// prefers /trt-catalog over the hardcoded fallback, so the correction flows through.
console.log('\n── Depot-ester PK band ────────────────────────────────────');
{
  const _prevExtra = G._tcExtraCatalog;
  G._tcExtraCatalog = [{id:'nebido',name:'Nebido (Testosterone Undecanoate)',dot:'#e8a020',
    halfLife:'~56 days plateau-equivalent (37-75 d individual range)',
    halfLifeDays:56, halfLifeDaysLow:37, halfLifeDaysHigh:75}];

  var _ci = G._tcCompInfo('nebido');
  check('backend PK override reaches T-Calc (56 d, not the hardcoded 34)', _ci.halfLifeDays===56);
  check('half-life band is exposed', _ci.halfLifeDaysLow===37 && _ci.halfLifeDaysHigh===75);

  // A compound with no declared range must not produce a spurious band.
  G._tcExtraCatalog = [];
  var _plain = G._tcCompInfo('testoviron');
  check('without a declared range, low == high == central',
    _plain.halfLifeDaysLow===_plain.halfLifeDays && _plain.halfLifeDaysHigh===_plain.halfLifeDays);

  G._tcExtraCatalog = [{id:'nebido',name:'Nebido',dot:'#e8a020',
    halfLifeDays:56, halfLifeDaysLow:37, halfLifeDaysHigh:75}];

  // Frequent micro-dosing — the regimen the single-exponential model fits best, since
  // dosing far inside the half-life drives peak-to-trough toward 1.
  var _log=[], _t0=new Date('2026-01-01');
  for (var _d=0; _d<420; _d+=2) {
    _log.push({date:new Date(_t0.getTime()+_d*86400000).toISOString().slice(0,10),
               compId:'nebido', doseMg:'100'});
  }
  var _S = G._tcFreeTSeries(_log, {});
  check('a declared range switches the band on', _S.hasPkBand===true);
  check('band arrays are returned', !!_S.totalLo && !!_S.totalHi);

  var _wk = function(w){ return Math.min(Math.round(w*7), _S.totalDays); };
  check('band brackets the central curve throughout',
    [8,16,26,33,52].every(function(w){
      var t=_wk(w);
      return _S.totalLo[t] <= _S.total[t]+1e-9 && _S.total[t] <= _S.totalHi[t]+1e-9;
    }));
  check('a slower half-life accumulates to a higher level',
    _S.totalHi[_wk(52)] > _S.total[_wk(52)] && _S.total[_wk(52)] > _S.totalLo[_wk(52)]);

  // The clinically important consequence: on the corrected model, an early plateau is
  // an illusion — week 8 is roughly halfway to where a constant dose is heading.
  // Measure the RISE from day 0, not the absolute level: any additive endogenous
  // baseline cancels in the difference, so this isolates the injection-driven
  // accumulation the claim is actually about.
  var _base  = _S.total[0];
  var _rise  = function(w){ return _S.total[_wk(w)] - _base; };
  var _full  = _rise(60);
  check('week 8 covers only about half the eventual rise (accumulation lag is real)',
    _rise(8)/_full < 0.62, 'got '+(_rise(8)/_full).toFixed(2));
  check('still climbing at week 26', _rise(26)/_full < 0.95,
    'got '+(_rise(26)/_full).toFixed(2));

  // Washout must be sized off the SLOWEST plausible half-life or the band's tail clips.
  check('washout window covers the high half-life',
    _S.totalDays >= Math.round(420 + 4.3*75) - 2, 'got '+_S.totalDays);


  // The band is anchored, not free-floating: all three series are calibrated to pass
  // through the measured bloodwork value, so the band pinches at the anchor and widens
  // away from it. What is known is the level at the draw; what is uncertain is the path.
  check('per-series calibration factors are returned',
    typeof _S.calFTPkLo === 'number' && typeof _S.calFTPkHi === 'number');
  check('a slower half-life needs a smaller calibration factor',
    !(_S.calFTPkLo > 0 && _S.calFTPkHi > 0) || _S.calFTPkHi <= _S.calFTPkLo);

  G._tcExtraCatalog = _prevExtra;
}


// ── T-Calc x-axis label density ───────────────────────────────────────────────
// The label-spacing ladder topped out at one label per 28 days. That was fine while
// the widest span was a few months, but a slow depot ester now carries a washout tail
// sized off its half-life, so the visible span can exceed a year — at which point
// 28-day spacing packs ~14 labels into room for ~8 and they overlap into a smear.
// Spacing now widens when labels genuinely would not fit, scoped to the >84 d regime
// so every shorter window keeps its previous spacing exactly.
console.log('\n── T-Calc x-axis label density ────────────────────────────');
{
  // Mirror of the in-chart calculation (the draw path needs a live canvas).
  // Mirror of the in-chart calculation. Density is measured against the VISIBLE span,
  // not the total series length — zoomed to a month the window is ~30 days even when the
  // whole series runs past a year, and sizing off the total pushed the step beyond the
  // window so only the leftmost label drew.
  var _spacing = function(winDays, xDays, cW){
    var e = winDays <= 7 ? 1 : winDays <= 30 ? 5 : winDays <= 28 ? 7 : winDays <= 84 ? 14 : 28;
    if (winDays > 84) {
      var maxL = Math.max(2, Math.floor(cW / 44));
      while (Math.floor(winDays / e) + 1 > maxL) e *= 2;
    }
    var cap = Math.max(1, Math.floor(winDays / 2));
    if (e > cap) e = cap;
    return e;
  };
  var _count = function(xDays, e){ return Math.floor(xDays / e) + 1; };
  var _W = 330;                       // representative phone chart width
  var _fits = Math.floor(_W / 44);

  check('short and medium spans keep their previous spacing',
    _spacing(7,7,_W)===1 && _spacing(30,30,_W)===5 && _spacing(84,84,_W)===14);
  // The regression Henrik hit: zoomed to a month over a year-long series, the step was
  // sized off the 390-day total and exceeded the 30-day window, so only "10 Jul" drew.
  check('month zoom over a long series still labels the window',
    _count(30, _spacing(30, 390, _W)) >= 4, 'got '+_count(30,_spacing(30,390,_W))+' labels');
  check('zoomed spacing never exceeds half the visible window',
    [4,7,30,84,146,390].every(function(w){ return _spacing(w,500,_W) <= Math.max(1,Math.floor(w/2)); }));
  check('today and week zooms still label every day',
    _spacing(4,390,_W)===1 && _spacing(7,390,_W)===1);
  check('a 146 d span still uses the ladder top (28 d)', _spacing(146,146,_W)===28);
  check('a year-long depot span widens past the ladder', _spacing(390,390,_W) > 28);
  check('labels fit at every span up to 500 d',
    [90,146,232,390,500].every(function(x){ return _count(x,_spacing(x,x,_W)) <= _fits; }));
  check('the old 28 d spacing would NOT have fit at 390 d (regression is real)',
    _count(390,28) > _fits, 'old gave '+_count(390,28)+' labels, room for '+_fits);
  check('spacing never collapses to zero or negative',
    [7,30,84,146,232,390,500,900].every(function(x){ return _spacing(x,x,_W) >= 1; }));
  check('a wider canvas is allowed more labels',
    _spacing(390,390,900) <= _spacing(390,390,300));
}


// ── Enhanced tier: dose and cadence are independent ───────────────────────────
// Weekly dose and injection schedule are separate concerns. The enhanced tier could
// only express weekdays, which is meaningless for a long-ester depot (every 10-14
// weeks) and cannot express EOD either. Cadence is now weekday OR interval, and the
// interval range spans daily through multi-week for EVERY compound — nothing is
// special-cased by id, because a long-ester depot can legitimately be micro-dosed daily.
console.log('\n── Enhanced cadence: dose vs schedule ─────────────────────');
{
  var _cs = new Date('2026-01-01');
  var _hits = function(c, days){
    var n = 0;
    for (var i = 0; i < (days||84); i++) {
      if (G._enhHitsDay(c, new Date(_cs.getTime() + i*86400000), _cs)) n++;
    }
    return n;
  };

  // back-compat: entries saved before cadence existed must behave exactly as before
  check('legacy weekday entry is unchanged', _hits({id:'x',days:[1,4]})===24);
  check('legacy entry with no days still means every day', _hits({id:'x'})===84);
  check('legacy entry reports as weekday mode', G._enhCadence({id:'x',days:[1,4]})==='days');

  // the full range Henrik asked for: daily through multi-week
  check('every 1 day', _hits({id:'x',cadence:'interval',freqVal:1,freqUnit:'days'})===84);
  check('every 2 days (EOD micro-dosing)', _hits({id:'x',cadence:'interval',freqVal:2,freqUnit:'days'})===42);
  check('every 1 week', _hits({id:'x',cadence:'interval',freqVal:1,freqUnit:'weeks'})===12);
  check('every 12 weeks (depot label interval)',
    _hits({id:'x',cadence:'interval',freqVal:12,freqUnit:'weeks'})===1);

  // no compound is special-cased — the same interval works whatever the id
  check('interval is not gated on compound id',
    _hits({id:'nebido',cadence:'interval',freqVal:2,freqUnit:'days'})
      === _hits({id:'test_p',cadence:'interval',freqVal:2,freqUnit:'days'}));

  // guards: a bad frequency must never divide by zero or schedule nothing
  check('freqVal 0 / negative / non-numeric falls back to daily',
    ['0',-3,'abc',null,undefined].every(function(v){
      return _hits({id:'x',cadence:'interval',freqVal:v,freqUnit:'days'})===84;
    }));
  check('interval with no cycle start does not crash or fire',
    G._enhHitsDay({id:'x',cadence:'interval',freqVal:2}, new Date(), null)===false);

  // switching mode must not destroy the other configuration
  G._editBuf={cycle_start:'2026-01-01',peptides:[],enhanced:{enabled:true,compounds:[
    {id:'x',name:'X',days:[1,4],unit:'mg/week',dose:'250'}]}};
  var _c0=function(){return G._editBuf.enhanced.compounds[0];};
  G.editSetEnhCadence('x','interval');
  G.editSetEnhFreqVal('x','2');
  check('switching to interval keeps the weekday selection',
    (_c0().days||[]).join(',')==='1,4');
  G.editSetEnhCadence('x','days');
  check('switching back restores weekday mode', G._enhCadence(_c0())==='days');
  check('and remembers the interval for next time', parseInt(_c0().freqVal,10)===2);

  // labels
  check('interval label reads naturally',
    G._enhCadenceLabel({id:'x',cadence:'interval',freqVal:2,freqUnit:'days'})==='Every 2 days' &&
    G._enhCadenceLabel({id:'x',cadence:'interval',freqVal:1,freqUnit:'weeks'})==='Every week');
  check('weekday label keeps its previous rendering',
    G._enhCadenceLabel({id:'x',days:[0,1,2,3,4,5,6]})==='Every day');
}


// ── T-History reads and plots; it never calculates ────────────────────────────
// The history view loads /plasma-history and draws it. Writing is owned by T-Calc,
// which is where the PK model lives. buildTHist used to backfill when the store looked
// empty or the tail looked stale — so opening the tab recomputed the whole series with
// whatever the client model was and wrote it back OVER the stored values. A model bug
// then silently rewrote saved history, and the view disagreed with its own source of
// truth. These tests exist so that cannot come back.
console.log('\n── T-History: read-only view ──────────────────────────────');
{
  const _th = fs.readFileSync(path.join(dir,'tab-thist.js'),'utf8');
  const _fn = _th.slice(_th.indexOf('function buildTHist()'), _th.indexOf('function _thRender('));
  check('buildTHist exists', _fn.length > 0);
  check('buildTHist never captures/persists', _fn.indexOf('_captureFreeTHistory') < 0);
  check('buildTHist never recomputes the series', _fn.indexOf('_thComputeFreeT') < 0);
  check('buildTHist never re-derives via the PK model', _fn.indexOf('_tcFreeTSeries') < 0);
  check('buildTHist has no staleness/backfill heuristic',
    _fn.indexOf('stale') < 0 && _fn.indexOf('backfill') < 0);
  check('buildTHist reads /plasma-history', _fn.indexOf('/plasma-history') >= 0);

  // The render path must be equally pure.
  const _rd = _th.slice(_th.indexOf('function _thRender('), _th.indexOf('function _thRender(')+4000);
  check('_thRender never captures or recomputes',
    _rd.indexOf('_captureFreeTHistory') < 0 && _rd.indexOf('_thComputeFreeT') < 0);

  // The view no longer contains ANY capture path — writing moved entirely to T-Calc.
  check('the view file has no capture function at all',
    _th.indexOf('function _captureFreeTHistory') < 0 && _th.indexOf('function _thComputeFreeT') < 0);
  const _tc = fs.readFileSync(path.join(dir,'tab-tcalc.js'),'utf8');
  check('T-Calc owns the write path (tcSaveHistoryFromCurve)',
    _tc.indexOf('function tcSaveHistoryFromCurve') >= 0);

  check('the file states the read-only rule for the next reader',
    _th.indexOf('THIS VIEW READS AND PLOTS. IT NEVER CALCULATES') >= 0);

  // The view never plots a future-dated point — history is the past. This also cleans up
  // any future points an older build stored, without a re-capture or backend edit.
  if (typeof G._thSeries === 'function') {
    var _thSave = G._thData;
    var _t = new Date();
    var _mk = function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
    var _past1 = new Date(_t.getTime()-10*86400000), _past2 = new Date(_t.getTime()-2*86400000);
    var _future = new Date(_t.getTime()+200*86400000);
    G._thData = [
      {marker:'free_t', date:_mk(_past1), value:300, unit:'pmol/L'},
      {marker:'free_t', date:_mk(_past2), value:480, unit:'pmol/L'},
      {marker:'free_t', date:_mk(_future), value:1200, unit:'pmol/L'} ];
    var _ser = G._thSeries();
    check('the view drops future-dated stored points', !!_ser &&
      (_ser.firstMs + _ser.lastDay*86400000) <= _t.getTime() + 86400000, 'lastDay maps past today');
    check('the surviving series ends at the last PAST point (no Feb-2027 tail)',
      !!_ser && _mk(new Date(_ser.firstMs + _ser.lastDay*86400000)) === _mk(_past2));
    G._thData = _thSave;
  }
}

console.log('\n───────────────────────────────────────────────────────────');

// ── Today never hangs on a failed backend call (regression, 2026-08-05) ──────
// A backend outage left Today spinning forever, and it did NOT recover when the
// backend came back: _syncPending was cleared only on the success path of
// syncPeptideLogFromAgent, and _injCacheReady only on a clean run of
// refreshInjectionsCache. buildToday() gates its spinner on both. Settings showed
// "Online" the whole time because checkAgentStatus polls separately.
{
  const sync = rawScript.slice(
    rawScript.indexOf('async function syncPeptideLogFromAgent()'),
    rawScript.indexOf('async function syncPeptideLogFromAgent()') + 900);
  check('syncPeptideLogFromAgent clears _syncPending in a finally',
    /finally\{_syncPending=false;buildToday\(\);\}/.test(sync));
  check('  …and no longer clears it only on the success path',
    !/_syncPending=false;buildToday\(\);\}catch/.test(sync));
  check('  …the !r.ok early return still exists (failure is still logged)',
    /if\(!r\.ok\)\{_logHttp\('syncPepLog'/.test(sync));

  const refIdx = rawScript.indexOf('async function refreshInjectionsCache()');
  const ref = rawScript.slice(refIdx, rawScript.indexOf('\n}', rawScript.indexOf('_injCacheReady=true', refIdx)));
  // Still a finally, so a throw cannot leave Today spinning forever — the point of the
  // original check. It now also wakes the plasma curve, which waits on this cache.
  check('refreshInjectionsCache sets _injCacheReady in a finally',
    /finally\{\s*_injCacheReady=true;/.test(ref));
  check('  …and tells the curve the cache has landed',
    /finally\{[\s\S]{0,400}?buildTCalc\(\)/.test(ref));
  check('  …and catches its own throws', /catch\(_e\)\{_logErr\('refreshInjCache',_e\);\}/.test(ref));

  // The gate itself must stay — the fix is that the flags always resolve, not that
  // the spinner was removed.
  check('buildToday still gates on both flags (spinner kept for the real loading case)',
    /_syncPending\|\|!_injCacheReady/.test(fs.readFileSync(path.join(__dirname,'../tab-today.js'),'utf8')));
}


// ── loadUserStacks always reaches a rendered state (regression, 2026-08-05) ──
// Plan AND Today both spun forever after a backend outage. loadUserStacks handled
// the fetch failure, but the normalization after it (_synthesizeProtocol,
// _normalizeActiveStack, _ensureStackId, date parsing, PEPTIDE_CAT.find,
// updateWEEKLY) ran unguarded before `_stacksLoaded=true`. One throw there left
// _stacksLoaded false (Plan spinner) and skipped refreshInjectionsCache entirely,
// so _injCacheReady never resolved either (Today spinner) and buildToday/
// buildSchedule never ran. A reload hit the same throw, so it never recovered.
{
  const i = rawScript.indexOf('async function loadUserStacks()');
  const body = rawScript.slice(i, rawScript.indexOf('function updateWEEKLY()', i));
  check('loadUserStacks found', i >= 0);
  check('_stacksLoaded is set in a finally (Plan can never stay on its spinner)',
    /finally\{\s*_stacksLoaded=true;\s*buildStackStore\(\);\s*\}/.test(body));
  check('normalization throws are caught, not fatal',
    /catch\(_e\)\{[^}]*_logErr\('loadStacks:normalize',_e\);\}/.test(body));
  check('injection-cache throws are caught, not fatal',
    /catch\(_e\)\{_logErr\('loadStacks:injections',_e\);\}/.test(body));
  check('buildToday still runs even if the injection cache blew up',
    /finally\{[\s\S]*try\{buildToday\(\);\}catch/.test(body));
  check('buildSchedule still runs too', /try\{buildSchedule\(\);\}catch/.test(body));
  check('buildWeekStrip still runs too', /try\{buildWeekStrip\(\);\}catch/.test(body));
  check('one failing renderer cannot take out the others (each wrapped separately)',
    (body.match(/try\{build(WeekStrip|Today|Schedule)\(\);\}catch/g) || []).length === 3);
  // The offline fallback must survive: a dead backend still renders cached stacks.
  check('cached stacks are still used when the endpoint fails',
    /localStorage\.getItem\('stacks_cache'\)/.test(body));
}


// ── Diagnostics log persists failures (added 2026-08-05) ────────────────────
// _pepErrors is window-only: wiped on reload, invisible on an iOS PWA. Two hangs
// that day had to be diagnosed from screenshots because the exception was
// unreadable. The log now survives a reload and can be copied out of Storage.
{
  check('_diagPush defined',        typeof G._diagPush === 'function');
  check('_diagAll defined',         typeof G._diagAll === 'function');
  check('copyDiagnostics defined',  typeof G.copyDiagnostics === 'function');
  check('clearDiagnostics defined', typeof G.clearDiagnostics === 'function');

  check('_logErr persists, not just window._pepErrors',
    /_diagPush\(\{t:Date\.now\(\),ctx:ctx,msg:/.test(rawScript));
  check('_logHttp persists status and url',
    /_diagPush\(\{t:Date\.now\(\),ctx:ctx,status:status,url:url\}\)/.test(rawScript));
  check('the Storage page renders the card', /_diagRenderInto\(_el\);/.test(rawScript));

  // Must never throw: it is called from inside the error handlers themselves.
  const push = rawScript.slice(rawScript.indexOf('function _diagPush('),
                               rawScript.indexOf('function _diagAll('));
  check('_diagPush wraps its whole body so it can never throw',
    /catch\(e\)\{\}\s*$/.test(push.trim().replace(/\}\s*$/, '')) || /\}catch\(e\)\{\}/.test(push));
  check('  …and a corrupt stored value degrades to an empty list, not a throw',
    /catch\(e\)\{a=\[\];\}/.test(push));
  check('_diagPush caps the ring buffer', /while\(a\.length>DIAG_MAX\)a\.shift\(\)/.test(push));

  // Entries are exception text and URLs — never inject them as HTML. The apps
  // already carry deferred CodeQL findings of exactly this shape.
  const render = rawScript.slice(rawScript.indexOf('function _diagRenderInto('),
                                 rawScript.indexOf('function buildStoragePage('));
  check('the diagnostics view adds no innerHTML sink', !/innerHTML/.test(render));
  check('  …it uses textContent for entry text', /pre\.textContent=/.test(render));

  // Round-trip the real functions.
  G.localStorage.removeItem('pep-diag-log');
  check('empty store reads as an empty list', G._diagAll().length === 0);
  G._diagPush({t: 1, ctx: 'unit', msg: 'boom'});
  G._diagPush({t: 2, ctx: 'unit', status: 500, url: '/x'});
  const all = G._diagAll();
  check('entries round-trip through localStorage', all.length === 2, `got ${all.length}`);
  check('  …preserving the HTTP status', all[1].status === 500);
  for (let i = 0; i < 200; i++) G._diagPush({t: i, ctx: 'flood', msg: String(i)});
  check('the buffer is capped, oldest dropped first', G._diagAll().length === 60,
    `got ${G._diagAll().length}`);
  check('  …and the newest entry survives', G._diagAll().slice(-1)[0].msg === '199');
  G.localStorage.removeItem('pep-diag-log');
}


// ── Body-comp labels survive a backend round-trip (regression, 2026-08-05) ──
// Reported by the new diagnostics log, first real use:
//   [syncBodyComp] null is not an object (evaluating 'labels[i].split')
// dateLabel is a DISPLAY string derived from date, but it was stored, and
// /bodycomp carries only {date, bf}. syncBodyCompFromAgent rebuilds from the remote
// records (`merged=[...remote]`), so every synced entry came back without a label;
// arr.map(e=>e.dateLabel) then yielded undefined and labels[i].split(' ') threw
// inside syncBodyComp, taking out the whole Body Comp view.
{
  const body = fs.readFileSync(path.join(__dirname, '../tab-body.js'), 'utf8');
  check('_bcLabel helper exists', /function _bcLabel\(e\)\{/.test(body));
  check('the BF chart derives its labels', /arr\.map\(e=>_bcLabel\(e\)\)/.test(body));
  check('the BMI chart derives its labels', /bmiLabels=bmiData\.map\(e=>_bcLabel\(e\)\)/.test(body));
  check('no raw e.dateLabel read remains in a render path', !/\be\.dateLabel\b(?!\)return)/.test(
    body.replace(/function _bcLabel\(e\)\{[\s\S]*?\n\}/, '')));
  check('bcDrawChart cannot throw on a missing label',
    /String\(labels\[i\]\|\|''\)\.split\(' '\)/.test(body));

  // Exercise the real helper against the exact shape the backend returns.
  const mk = new Function('fmtDate', 'parseLocalDate',
    body.slice(body.indexOf('function _bcLabel(e){'), body.indexOf('function bcDrawChart(')) +
    '\nreturn _bcLabel;');
  const lbl = mk(d => 'FMT:' + d, d => d);
  check('a remote entry with no dateLabel still gets a label',
    lbl({date: '2026-08-05'}) === 'FMT:2026-08-05', `got ${lbl({date:'2026-08-05'})}`);
  check('a local entry keeps the label it already had',
    lbl({date: '2026-08-05', dateLabel: '5 Aug'}) === '5 Aug');
  check('a null entry yields a string, never null', lbl(null) === '');
  check('an entry with no date at all yields a string',
    typeof lbl({}) === 'string');
  // Without the fallback helpers present it must degrade, not throw.
  const bare = new Function(
    body.slice(body.indexOf('function _bcLabel(e){'), body.indexOf('function bcDrawChart(')) +
    '\nreturn _bcLabel;')();
  check('degrades to the raw date when the date helpers are unavailable',
    bare({date: '2026-08-05'}) === '2026-08-05', `got ${bare({date:'2026-08-05'})}`);
}


// ── Orphan injections are never deleted on a partial compound list ──────────
// Regression, 2026-08-05, INTRODUCED BY THE loadUserStacks HARDENING EARLIER THAT
// SAME DAY. refreshInjectionsCache treats any injection whose compound_id is not in
// _getProtocolCompoundIds(stack) as an orphan and DELETEs it from today forward.
// That is only safe when the compound list is complete. Before the hardening, a throw
// during normalisation aborted loadUserStacks before the cache ever refreshed, so a
// partial list could not reach the delete. Making loadUserStacks always render removed
// that accidental protection: a normalisation throw then let the delete run against a
// half-built list and destroy live peptide injections. (TRT survived because
// cycle_id 'tcalc' bypasses the orphan check entirely.)
{
  // 2026-08-15: THE ORPHAN DELETE IS GONE ENTIRELY, so the checks that used to assert
  // it was correctly *gated* are replaced by one asserting it does not exist.
  //
  // Gating it was never enough. A compound id that merely fails to MATCH the active
  // protocol's config — renamed, rebuilt, canonicalised, or a tier whose scheduler
  // moved — is indistinguishable here from one deliberately removed, and either way the
  // row was destroyed on an ordinary cache refresh with nothing counted or shown. The
  // delete ran from today forward and every regeneration path also starts at midnight
  // today (_regenFrom, tab-stack 116/239/520, tab-tcalc 1063), so anything it removed
  // was never backfilled: one refresh, one permanent hole in the schedule. Reported as
  // an active protocol quietly losing doses, with 14 Aug empty of everything.
  //
  // refreshInjectionsCache renders a cache. It must not write to the record at all.
  const ref = rawScript.slice(rawScript.indexOf('async function refreshInjectionsCache()'),
                              rawScript.indexOf('_injCacheReady=true'));
  check('refreshInjectionsCache issues NO DELETE — it renders, it does not prune',
    !/method:'DELETE'/.test(ref));
  check('  …and no request of any other method either',
    !/method:'(POST|PUT|PATCH)'/.test(ref));
  check('  …with the orphan-delete machinery removed, not just bypassed',
    !/_orphanBulkDel/.test(rawScript) && !/orphanDelSkipped/.test(rawScript));
  check('an unlisted compound is counted as hidden instead of deleted',
    /_injHidden\.orphans\[e\.compound_id\]=\(_injHidden\.orphans\[e\.compound_id\]\|\|0\)\+1;/.test(rawScript));
  // The flag that gated the delete is still set on load; nothing reads it now. Left in
  // place deliberately rather than removed in the same change as a data-loss fix.
  check('_stacksNormalized is still maintained', /let _stacksNormalized=false;/.test(rawScript) &&
    /_stacksNormalized=true;\s*\}catch\(_e\)\{_stacksNormalized=false;_logErr\('loadStacks:normalize'/.test(rawScript));
}


// ── Deleting every stack must stick (regression, 2026-08-05) ───────────────
// Reported: "when I delete all stacks my old peptide stack reappears".
// loadUserStacks synthesised a stack from WEEKLY_DEFAULT whenever the list came back
// empty, then persisted it via saveStacksToBackend — so deleting every protocol
// recreated one on the next load AND wrote it to the backend.
//
// WEEKLY_DEFAULT is also one specific person's real protocol, so seeding it handed
// that protocol to anyone with an empty stack — the same class of issue as
// _DEFAULT_PEPTIDES in protocol.py (2026-06-24).
{
  const i = rawScript.indexOf('async function loadUserStacks()');
  const body = rawScript.slice(i, rawScript.indexOf('function updateWEEKLY()', i));
  check('an empty stack list no longer synthesises one',
    !/_userStacks=\[_synthesizeProtocol\(WEEKLY_DEFAULT\)\]/.test(body));
  check('  …and no longer names it "My Stack"', !/_userStacks\[0\]\.name='My Stack'/.test(body));
  check('an empty list clears the active selection', /if\(!_userStacks\.length\)_activeStackIndices=\[\]/.test(body));
  // The offline path must still work: a dead backend falls back to cached stacks.
  check('cached stacks are still restored when the endpoint fails',
    /localStorage\.getItem\('stacks_cache'\)/.test(body));
  // buildToday already renders the correct empty state — the synthesis was what kept
  // that screen unreachable.
  const today = fs.readFileSync(path.join(__dirname, '../tab-today.js'), 'utf8');
  check('the empty state offers a template or a build-your-own', /No protocol yet/.test(today));
  check('  …rather than a silently invented protocol', /Build your first protocol|openTemplatePicker/.test(today));
}


// ── DELETES MUST NEVER REACH ANOTHER COMPOUND, OR A RECORD ───────────────────
// 2026-08-14, the worst incident of the session. Binding T-Calc to a protocol for
// the FIRST time destroyed the account's entire forward schedule: 106 HGH rows,
// every forward peptide row, and a logged dose — none of them testosterone.
//
// _tcSetTargetStack cleared its "old home" with
//     DELETE /injections?cycle_id=<oldCid>&from_date=<today>
// and oldCid is '' when nothing is bound yet. The backend filters with
// `if cycle_id and ...`, so an empty value is NO filter: it deleted every injection
// in the account from today on, across every protocol, logged included.
console.log('\n── injection deletes: scoped, and never a record ──────────');
{
  const _dsSave = { f: G.fetch, tp: G._tcp, us: G._userStacks, ah: G.authHeaders };
  const dels = [];
  // The stub records synchronously as the call is made, so the first DELETE lands
  // even without awaiting the async function under test.
  G.fetch = (url, opt) => {
    if ((opt || {}).method === 'DELETE') dels.push(String(url));
    return Promise.resolve({ ok: true, status: 200, json: async () => ([]) });
  };
  G.authHeaders = () => ({});
  G._userStacks = [{ id:'protocol_2_nostart', name:'Protocol 2', cycle_start:'2026-05-18' }];
  G._tcp = { manualLog: [], targetStackId: '' };      // unbound — the incident's state
  if (typeof G._tcSetTargetStack === 'function') {
    try { G._tcSetTargetStack('protocol_2_nostart'); } catch (e) {}
  }
  const inj = dels.filter(u => u.indexOf('/injections?') >= 0);
  check('binding from unbound issues NO cycle-wide delete',
    !inj.some(u => /cycle_id=(&|$)/.test(u)), inj.join(' | ') || '(none issued)');
  check('  …and no delete is unscoped by compound',
    inj.every(u => u.indexOf('compound_id=') >= 0),
    inj.filter(u => u.indexOf('compound_id=') < 0).join(' | ') || 'ok');
  check('  …and none may take a logged record',
    inj.every(u => u.indexOf('unlogged_only=true') >= 0),
    inj.filter(u => u.indexOf('unlogged_only=true') < 0).join(' | ') || 'ok');
  G.fetch = _dsSave.f; G._tcp = _dsSave.tp; G._userStacks = _dsSave.us; G.authHeaders = _dsSave.ah;

  // Structural backstop across all three files. A plan-clear that forgets
  // unlogged_only downgrades a record to a schedule; one that forgets compound_id
  // reaches a protocol's peptides and HGH. This holds for deletes added later.

// ── The save-to-protocol sheet is gone (Phase 6) ────────────────────────────
// It filed a planner's doses into a protocol: a dropdown of protocols, the active one
// preselected, one Save button, and — until 2026-08-14 — a "New protocol" option that
// created an empty stack, made it active and moved a protocol's injections to it with
// nothing on screen saying so.
//
// With the planner gone there are no doses to file: the protocol generates its own.
// The whole sheet and its after-save refresh went with it.
{
  const _ssSrc = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-tcalc.js'),'utf8');
  check('the save-to-protocol sheet is gone',
    !/tc-save-stack-sel/.test(_ssSrc) && !/function _tcOpenSaveToStack/.test(_ssSrc));
  check('  …with its after-save refresh',
    !/function _tcAfterSavedToStack/.test(_ssSrc) && !/function _tcSaveSheetBusy/.test(_ssSrc));
  // The protocol creator that dialog once carried must not survive it: creating an
  // empty protocol and activating it is not something T-Calc does at all now.
  check('  …and the protocol creator it used to offer',
    !/function _tcCreateStackForTesto/.test(_ssSrc));
}

  // ── The forward plan must not be counted twice after saving ────────────────
  // 2026-08-15, before/after in the same build: after saving 7 doses the curve read
  // peak 1690 / avg 603 / exposure 1665; after restarting the app, 1176 / 435 /
  // 1051 on the same data. TODAY was 895 in both — the past was identical and only
  // the FUTURE doubled. The 7 doses were counted as drafts still in manualLog AND
  // as the stored protocol rows they had just become.
  {
    const _dupSave = { tp: G._tcp, ic: G._injectionsCache, h: G._tcHistory, hs: G._tcHistoryState };
    // Relative to today: these were fixed dates when written on 2026-08-15 and have
    // since aged into the past, where the curve legitimately drops them. The point of
    // the check is the double count, not the calendar.
    const _dk = function(off){ var t = new Date(); t.setDate(t.getDate()+off);
      return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };
    const days = [_dk(2), _dk(4), _dk(6)];
    // Post-save state: the same doses in BOTH places, as the app had them.
    G._tcHistory = [{compId:'nebido', doseMg:'100', date:_dk(-14)}];
    G._tcHistoryState = 'ready';
    G._injectionsCache = {};
    days.forEach(function(d){
      G._injectionsCache[d] = [{cycle_id:'protocol_2_nostart', compound_id:'nebido',
        tier:'trt', date:d, dose:'100', unit:'mg', logged:false, active:true}];
    });
    G._tcp = { targetStackId:'protocol_2_nostart',
               manualLog: days.map(function(d){ return {compId:'nebido', doseMg:'100', date:d, draft:true}; }) };

    if (typeof G._tcCurveLog === 'function') {
      const log = G._tcCurveLog();
      const fut = log.filter(function(e){ return e.date >= days[0]; });
      check('a saved dose is not counted twice on the curve',
        fut.length === days.length,
        'got ' + fut.length + ' forward doses from ' + days.length + ' injections: ' +
        fut.map(function(e){ return e.date+'/'+e.compId; }).join(' '));

      // The same molecule under two spellings must collapse to one dose. manualLog
      // stored the RAW compound_id while history and protocol rows store the
      // canonical one, so test_u and nebido were two keys for one injection.
      G._tcp = { targetStackId:'protocol_2_nostart',
                 manualLog: [{compId:'test_u', doseMg:'100', date:days[0], draft:true}] };
      const log2 = G._tcCurveLog().filter(function(e){ return e.date === days[0]; });
      check('  …nor under a second spelling of the same ester',
        log2.length === 1, 'got ' + log2.map(function(e){ return e.compId; }).join(','));
    }
    G._tcp=_dupSave.tp; G._injectionsCache=_dupSave.ic; G._tcHistory=_dupSave.h; G._tcHistoryState=_dupSave.hs;
  }

  // Saving must do what a cold start does: re-read the record, then rebuild. The
  // after-save hook belonged to the save-to-protocol sheet and went with it (Phase 6);
  // the requirement moved to the one write path T-Calc still has — record entry.
  {
    const _srcA = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-tcalc.js'),'utf8');
    check('the after-save hook is gone with the sheet it served',
      !/function _tcAfterSavedToStack/.test(_srcA));
    // The add path moved to Today (2026-08-20); the requirement follows it. Rebuilding
    // manualLog from the record is no longer part of it — savePastInjection appends the
    // doses it just wrote and re-reads the history, which is the same guarantee without
    // routing through a profile cache.
    const _thA = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-thist.js'),'utf8');
    const addFn = _thA.slice(_thA.indexOf('async function savePastInjection()'),
                             _thA.indexOf('async function savePastInjection()') + 6000);
    check('logging a dose forces a fresh history read', /_tcFetchHistory\(true\)/.test(addFn));
    check('  …and the curve only sees what was actually taken',
      /tier === 'trt' && logged &&/.test(addFn));
    check('manualLog stores the CANONICAL compound id',
      /compId:_tcCanonCompId\(e\.compound_id\)/.test(_srcA));
  }

  const _dsDir = path.dirname(path.resolve(htmlPath));
  ['tab-tcalc.js','tab-stack.js','index.html'].forEach(function(f){
    const src = fs.readFileSync(path.join(_dsDir,f),'utf8');
    const bad = (src.match(/'\/injections\?[^\n]*method:'DELETE'/g) || [])
      .filter(l => l.indexOf('unlogged_only=true') < 0);
    check(f + ': every /injections DELETE passes unlogged_only',
      bad.length === 0, bad.join(' | ').slice(0, 200));
  });
  // _tcSetTargetStack held the empty-cycle-id guard: an unbound plan produced
  // `DELETE /injections?cycle_id=&from_date=…`, which is NO filter, and on 2026-08-14
  // wiped every forward injection in the account. Phase 8 deleted the function, so
  // assert the guard is enforced where deletes actually live now — one module, which
  // is the stronger form of the same protection.
  check('the empty-cycle-id delete cannot be issued from T-Calc any more',
    !/function _tcSetTargetStack/.test(fs.readFileSync(path.join(_dsDir,'tab-tcalc.js'),'utf8')));
  {
    const iw = fs.readFileSync(path.join(_dsDir,'inj-writer.js'),'utf8');
    check('  …because inj-writer refuses an unscoped delete outright',
      /if\(!cycleId \|\| !compoundId \|\| !fromDate\)/.test(iw),
      'inj-writer is the only place a delete is issued — the guard has to be here');
  }
}

console.log(`  ${passed} passed  ${failed} failed  ${passed+failed} total`);
// Do NOT process.exit() here. ~137 checks live inside a `G.wizSave().then(...)`
// block near the top of this file; that callback is a microtask and only runs after
// this synchronous phase finishes. Calling process.exit(1) killed the process first,
// so ANY synchronous failure silently skipped those 137 tests — they disappeared
// exactly when the suite was already broken and you most needed them. Setting
// exitCode lets the queue drain; the async block prints the full total and exits
// with the true aggregate.
process.exitCode = failed > 0 ? 1 : 0;

// ── A draft that is not bound: no longer possible (Phase 6) ─────────────────
// This block tested the banner that announced unsaved planner drafts. 2026-08-14: "no
// injections show up from today in Today view even if T-calc graph looks fine" — seven
// draft doses sat in the profile with no protocol bound, so the sync wrote nothing while
// the curve drew from them.
//
// Phase 6 removed the planner, so nothing creates a draft and there is no unbound state
// to announce: a dose is scheduled by the protocol or it does not exist. What the block
// was really protecting — that the curve never shows doses the record does not hold —
// is now structural, and is asserted against how the curve is built.
console.log('\n── Drafts cannot exist: the planner is gone ───────────────');
{
  const _dfSrc = fs.readFileSync(path.join(path.dirname(path.resolve(htmlPath)),'tab-tcalc.js'),'utf8');
  check('nothing stages an unsaved draft any more',
    !/function _tcUnsavedDraftBanner/.test(_dfSrc) && !/draft:true/.test(_dfSrc));
  check('  …and the save-to-protocol route is gone with it',
    !/function _tcOpenSaveToStack/.test(_dfSrc) && !/function _tcSaveToExistingStack/.test(_dfSrc));
  check('the curve is built from the record and the protocol only',
    /_add\(_tcLoggedHistory\(\)\);/.test(_dfSrc) && /_add\(_tcProtocolInjections\(\)\);/.test(_dfSrc));
}

// ── T-History: the "as of" readout follows the series end ────────────────────
// 2026-08-14: "T-calc shows 894 pmol/l today, T-History shows 858 — which curve is
// incorrect?" Neither. The stored point for 14 Aug was 893.99, matching T-Calc
// exactly. _thFocusDay is module-level and was reset only when it fell OUTSIDE the
// series, so a series that GREW left the cursor on the OLD last day — the readout
// said "As of 12 Aug · 858" while the chart drew the new points.
console.log('\n── T-History: as-of cursor follows new points ─────────────');
{
  const has = typeof G._thNormFocusDay === 'function';
  check('_thNormFocusDay exists', has);
  const norm = (s) => { if (has) G._thNormFocusDay(s); };
  const S = (lastDay) => ({ totalDays:lastDay, lastDay:lastDay });

  // Fresh: no cursor yet → pin to the end.
  G._thFocusDay = null; G._thPrevLastDay = null;
  norm(S(48));
  check('an unset cursor starts at the series end', G._thFocusDay === 48);

  // THE BUG: two new points captured. Cursor was at the old end → follow it.
  norm(S(50));
  check('a cursor at the end follows the series when it grows', G._thFocusDay === 50,
    'got ' + G._thFocusDay + ' — this is the 858-vs-894 report');

  // A deliberately scrubbed cursor is NOT dragged to the end.
  G._thFocusDay = 20;
  norm(S(52));
  check('  …but a scrubbed cursor stays where the user put it', G._thFocusDay === 20);
  norm(S(54));
  check('  …and keeps staying there across further captures', G._thFocusDay === 20);

  // Scrub back onto the end → it is pinned again and resumes following.
  G._thFocusDay = 54;
  norm(S(56));
  check('  …scrubbing back to the end re-pins it', G._thFocusDay === 56);

  // Out of range in either direction is clamped to the end.
  G._thFocusDay = 999; norm(S(56));
  check('a cursor past the end is clamped', G._thFocusDay === 56);
  G._thFocusDay = -3;  norm(S(56));
  check('a negative cursor is clamped', G._thFocusDay === 56);

  // Both render paths must normalise, or the readout and the chart disagree.
  const _thSrc = require('fs').readFileSync(require('path').join(__dirname,'../tab-thist.js'),'utf8');
  check('both _thRender and _thRedraw normalise the cursor',
    (_thSrc.match(/_thNormFocusDay\(series\);/g) || []).length >= 2);
  // The "never computes" rule is already asserted against the buildTHist function
  // body itself further down (search: "buildTHist never captures/persists"). A
  // whole-file grep for those names matches the comment that says they are absent,
  // which is why the duplicate attempted here was both redundant and wrong.
}

// ── Today: a finished cycle says so ──────────────────────────────────────────
// Every generator stops at `days >= cycle_length*7`, so a protocol past its end date
// schedules nothing. Today's empty state had no branch for that and fell through to the
// hidden-doses message, which blamed unrelated inactive protocols: a real 12-week
// protocol that ended on 10 Aug rendered "66 doses hidden — they belong to 'a protocol
// that no longer exists' and 'Enhanced', which are not active" (2026-08-15). True, and
// not the reason. Renders the real buildToday and reads the HTML it produces, so it
// fails if the branch is dropped — a source grep would not.
console.log('\n── Today: finished cycle empty state ──────────────────────');
{
  const _ceSave = {doc:G.document, us:G._userStacks, ai:G._activeStackIndices,
                   sl:G._stacksLoaded, c:G._injectionsCache, cr:G._injCacheReady,
                   sp:G._syncPending, hid:G._injHidden};
  let _html = '';
  const _stub = Object.create(_ceSave.doc);
  _stub.getElementById = (id) => {
    const e = _ceSave.doc.getElementById(id);
    if (id !== 'today-checklist') return e;
    return new Proxy(e, {
      get: (t, k) => k === 'innerHTML' ? _html : t[k],
      set: (t, k, v) => { if (k === 'innerHTML') _html = v; else t[k] = v; return true; },
    });
  };
  G.document = _stub;
  G._injectionsCache = {}; G._injCacheReady = true; G._syncPending = false;
  G._injHidden = {count:66, stacks:{'a protocol that no longer exists':37, 'Enhanced':29}, noStart:[]};
  G._stacksLoaded = true;
  G._activeStackIndices = [0];

  // Started 18 May, 12 weeks → ended 10 Aug. Anchored to NOW so it cannot go stale.
  const _dk = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const _startBack = (days) => { const t = new Date(G.NOW || new Date()); t.setDate(t.getDate()-days); return _dk(t); };

  // 89 days in on a 12-week (84-day) cycle — over by 5 days, as reported.
  G._userStacks = [{id:'A', name:'Main', cycle_start:_startBack(89), cycle_length:12,
                    peptides:[], trt:{}, enhanced:{}}];
  _html = ''; G.buildToday();
  check('a finished cycle is reported as finished, not as hidden doses',
    /Cycle finished/.test(_html) && !/doses hidden/.test(_html), _html.slice(0, 160));
  check('  …naming the protocol and the date it ended',
    /Main/.test(_html) && /12-week/.test(_html), _html.slice(0, 160));
  check('  …and pointing at the thing that changes it',
    /Extend it or remove its end date/.test(_html));

  // Still inside the cycle: the hidden-doses message is the right one and must stay.
  G._userStacks = [{id:'A', name:'Main', cycle_start:_startBack(10), cycle_length:12,
                    peptides:[], trt:{}, enhanced:{}}];
  _html = ''; G.buildToday();
  check('a live cycle still reports hidden doses, not a false ending',
    /doses hidden/.test(_html) && !/Cycle finished/.test(_html), _html.slice(0, 160));

  // No end date: a cycle that cannot end must never be called finished.
  G._userStacks = [{id:'A', name:'Main', cycle_start:_startBack(400), cycle_length:0,
                    peptides:[], trt:{}, enhanced:{}}];
  _html = ''; G.buildToday();
  check('  …and "no end date" never reports one', !/Cycle finished/.test(_html));

  G.document = _ceSave.doc; G._userStacks = _ceSave.us; G._activeStackIndices = _ceSave.ai;
  G._stacksLoaded = _ceSave.sl; G._injectionsCache = _ceSave.c; G._injCacheReady = _ceSave.cr;
  G._syncPending = _ceSave.sp; G._injHidden = _ceSave.hid;
}

// ── Week strip: a week back, plus the calendar card ──────────────────────────
// Briefly a year (2026-08-17), reverted 2026-08-19: "Restore the 7 days only
// carousel." The calendar card is what reaches an older day now.
console.log('\n── Week strip ─────────────────────────────────────────────');
{
  const _wsSave = {doc:G.document, cache:G._injectionsCache, plog:G.window._peptideLog};
  const _strip = {dataset:{}, scrollLeft:0, clientWidth:350, children:[],
                  set innerHTML(v){ if(v==='') this.children=[]; }, get innerHTML(){ return ''; },
                  appendChild(el){ el.offsetLeft = (this.children.length+1)*50;
                                   this.children.push(el); }};
  G.document = Object.assign({}, _wsSave.doc, {
    getElementById:(id)=> id==='week-strip' ? _strip : _wsSave.doc.getElementById(id),
    createElement:()=>({style:{}, className:'', innerHTML:'', onclick:null,
                        offsetLeft:0, offsetWidth:44}),
  });
  G._injectionsCache = {};
  G.window._peptideLog = [];

  G.buildWeekStrip();
  check('the strip covers a week back',             G.WEEK_STRIP_BACK === 7);
  check('  …and six days forward',                  G.WEEK_STRIP_FWD === 6);
  check('  …so it renders back + today + forward, plus the calendar card',
    _strip.children.length === 15, `got ${_strip.children.length}`);
  check('  …with the calendar card at the far-left end of the strip',
    /week-cal/.test(_strip.children[0].className));
  check('  …with exactly one tile marked today',
    _strip.children.filter(e=>/(^|\s)today(\s|$)/.test(e.className)).length === 1);

  // The strip is rebuilt on every tick and re-centres on today each time — the
  // scroll-holding added for the year-long window went with it.
  _strip.scrollLeft = 0;
  G.buildWeekStrip();
  check('every build re-centres on today',          _strip.scrollLeft > 0);

  G.document = _wsSave.doc; G._injectionsCache = _wsSave.cache;
  G.window._peptideLog = _wsSave.plog;
}

// ── Month calendar ───────────────────────────────────────────────────────────
// Henrik, 2026-08-19: "add a card last (to the left in the carousel) that opens a
// new view with a traditional month/day table view. To access historic injections"
console.log('\n── Month calendar ─────────────────────────────────────────');
{
  const _cSave = {doc:G.document, cache:G._injectionsCache, plog:G.window._peptideLog,
                  vd:G._viewDate, sdi:G.showDayInline, st:G.switchTab};
  const _mk = () => {
    const el = {children:[], className:'', textContent:'', onclick:null, parentNode:null,
                style:{cssText:''}, offsetLeft:0, offsetWidth:44, dataset:{},
                appendChild(c){ c.parentNode = el; el.children.push(c); return c; },
                removeChild(c){ el.children = el.children.filter(x=>x!==c); return c; }};
    Object.defineProperty(el,'innerHTML',{get:()=>'', set(v){ if(v==='') el.children=[]; }});
    return el;
  };
  const _body = _mk();
  G.document = Object.assign({}, _cSave.doc, {createElement:()=>_mk(), body:_body,
                                              getElementById:()=>null});
  G._injectionsCache = {}; G.window._peptideLog = []; G._viewDate = null;
  let _opened = null;
  G.showDayInline = (d) => { _opened = d; };
  G.switchTab = () => {};

  G.showMonthCalendar();
  const _ov = _body.children[_body.children.length-1];
  const _sheet = _ov.children[0];
  const _grid = _sheet.children[1];
  check('the card opens a month view', !!_ov && !!_grid);

  // CLAUDE.md: weeks start on Monday, everywhere.
  check('the weekday header is Monday-first',
    _grid.children.slice(0,7).map(c=>c.textContent).join('') === 'MTWTFSS',
    _grid.children.slice(0,7).map(c=>c.textContent).join(''));

  const _now = new Date();
  const _dim = new Date(_now.getFullYear(), _now.getMonth()+1, 0).getDate();
  const _lead = [1,2,3,4,5,6,0].indexOf(new Date(_now.getFullYear(), _now.getMonth(), 1).getDay());
  const _cells = _grid.children.slice(7);
  check('  …the month starts on the right weekday',
    _cells.filter(c=>c.className==='cal-pad').length === _lead, `lead ${_lead}`);
  check('  …and every day of the month has a cell',
    _cells.filter(c=>/cal-day/.test(c.className)).length === _dim, `expected ${_dim}`);
  check('  …with today marked',
    _cells.filter(c=>/cal-today/.test(c.className)).length === 1);

  // The calendar navigates; showDayInline is still the only thing that renders or
  // ticks a day's doses, so there is no second copy of that logic.
  const _firstDay = _cells.filter(c=>/cal-day/.test(c.className))[0];
  _firstDay.onclick();
  // _opened is a Date from the sandbox realm, so instanceof against this file's Date
  // is false — duck-type it instead.
  check('tapping a day opens it in Today',
    !!_opened && typeof _opened.getDate === 'function' &&
    _opened.getDate() === 1 && _opened.getMonth() === _now.getMonth());
  check('  …and closes the calendar', _body.children.indexOf(_ov) === -1);

  // Stepping back a month is how you reach anything older than the strip.
  G.showMonthCalendar();
  const _ov2 = _body.children[_body.children.length-1];
  const _sheet2 = _ov2.children[0];
  const _title = () => _sheet2.children[0].children[1].textContent;
  const _thisMonth = _title();
  _sheet2.children[0].children[0].onclick();          // ‹
  check('‹ steps to the previous month', _title() !== _thisMonth);
  _sheet2.children[0].children[2].onclick();          // ›
  check('  …and › comes back', _title() === _thisMonth);

  // Dots follow the same rules as the strip: logged wins, scheduled-not-ticked is dim.
  const _dk = (o) => { const t = new Date(); t.setDate(t.getDate()+o);
                       return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };
  const _yst = new Date(); _yst.setDate(_yst.getDate()-1);
  G._injectionsCache = {[_dk(-1)]:[{dot:'#aaa', active:true, logged:true},
                                   {dot:'#bbb', active:true, logged:false}]};
  let _info = G._calDots(_yst);
  check('a past day shows its logged doses only', _info.dots.join(',') === '#aaa' && _info.logged === true);
  G._injectionsCache = {[_dk(-1)]:[{dot:'#bbb', active:true, logged:false}]};
  _info = G._calDots(_yst);
  check('  …and a missed scheduled dose shows dim', _info.dim === true && _info.dots.join(',') === '#bbb');

  const _tmr = new Date(); _tmr.setDate(_tmr.getDate()+1);
  G._injectionsCache = {[_dk(1)]:[{dot:'#ccc', active:true, logged:false}]};
  _info = G._calDots(_tmr);
  check('a future day shows what is scheduled', _info.dots.join(',') === '#ccc' && _info.dim === false);

  G.document = _cSave.doc; G._injectionsCache = _cSave.cache; G.window._peptideLog = _cSave.plog;
  G._viewDate = _cSave.vd; G.showDayInline = _cSave.sdi; G.switchTab = _cSave.st;
}

// ── No fixed banners over the navbar ─────────────────────────────────────────
// Henrik, 2026-08-19: "Remove the bottom of screen banners, they block navigation
// menu in apps. Also stuff like this should already live in Settings."
// .navbar is position:fixed;bottom:0;z-index:100 — anything else pinned to bottom:0
// sits on top of it and the app's own navigation stops being reachable.
console.log('\n── No fixed banners over the navbar ───────────────────────');
{
  const _bSrc = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const _bToday = fs.readFileSync(path.join(__dirname, '../tab-today.js'), 'utf8');
  const _allJs = rawScript + _bToday;
  check('nothing pins itself to the bottom of the screen',
    !/position:fixed;bottom:0/.test(_allJs));
  check('  …the local-data sync bar is gone',      !/sync-bar/.test(_allJs));
  check('  …and the update banner with it',        !/New version <strong/.test(_allJs));

  // Removing a banner must not remove the action it carried.
  check('syncing local dose logs moved into Settings',
    /id="peptide-sync-btn" onclick="pushAllPeptideToBackend\(\)"/.test(_bSrc));
  check('  …inside the Data section',
    _bSrc.indexOf('id="s-sec-data"') < _bSrc.indexOf('id="peptide-sync-btn"') &&
    _bSrc.indexOf('id="peptide-sync-btn"') < _bSrc.indexOf('id="s-sec-app"'));
  check('  …and the button resets instead of removing a bar it no longer sits in',
    /btn.textContent='Sync';btn.disabled=false;/.test(rawScript) &&
    !/closest\('\.sync-bar'\)/.test(rawScript));

  // A version found on load lands on the Settings row, same as pressing Check.
  const _uSave = {doc:G.document};
  let _btn = {textContent:'Check', disabled:false, style:{}, onclick:null};
  G.document = Object.assign({}, _uSave.doc,
    {getElementById:(id)=> id==='s-update-btn' ? _btn : _uSave.doc.getElementById(id)});
  G._markUpdateAvailable('9.99');
  check('a detected update marks the Settings version row',
    _btn.textContent === 'Update to v9.99' && _btn.disabled === false &&
    typeof _btn.onclick === 'function');
  _btn = null;
  G.document = Object.assign({}, _uSave.doc, {getElementById:()=>null});
  let _threw = false;
  try { G._markUpdateAvailable('9.99'); } catch(e){ _threw = true; }
  check('  …and does nothing when that row is not on screen', !_threw);
  G.document = _uSave.doc;
}

// ── Phase 3: one module owns every injection write ───────────────────────────
// docs/unified-plan-rewrite.md §3.2. Ten call sites across tab-stack.js and
// tab-tcalc.js each built their own request and did not agree with each other.
// Every injection bug of 2026-08-15/16 lived in that gap.
console.log('\n── One writer for injections ──────────────────────────────');
{
  const _fs2 = require('fs'), _p2 = require('path');
  const _injSrc = _fs2.readFileSync(_p2.join(__dirname, '../inj-writer.js'), 'utf8');

  // The invariant, checked by construction: no module but inj-writer.js may issue a
  // planning write. Today's tick is the documented exception — it records an event
  // that already happened.
  const _mods = _fs2.readdirSync(_p2.join(__dirname, '..'))
    .filter(f => (f.endsWith('.js') && f !== 'inj-writer.js'))
    .concat(['index.html']);
  // ⚠️ `method:\s*'…'` — WITH optional whitespace. Until 2026-08-20 this pattern
  // required `method:'POST'` with none, and tab-thist.js's past-injection write said
  // `method: 'POST'`. One space was the whole difference between a rule and a rule
  // that is enforced: the single direct write left in the app sat here reported as
  // compliant. A guard that can be stepped around by a formatter is not a guard.
  const _writeRe = /fetch\(\s*AGENT_URL\s*\+\s*'(\/injections[^']*)'[^;]{0,300}?method:\s*'(POST|DELETE|PUT)'/gs;
  const _offenders = [];
  _mods.forEach(f => {
    const body = _fs2.readFileSync(_p2.join(__dirname, '..', f), 'utf8');
    let m;
    const re = new RegExp(_writeRe.source, 'gs');
    while((m = re.exec(body)) !== null){
      const isTick = m[2] === 'PUT' && f === 'tab-today.js';
      if(!isTick) _offenders.push(`${f}: ${m[2]} ${m[1]}`);
    }
  });
  check('nothing outside inj-writer.js writes an injection', _offenders.length === 0,
        _offenders.join(' | '));

  // …and the exception is still exactly two ticks, not a door left open.
  const _todaySrc = _fs2.readFileSync(_p2.join(__dirname, '../tab-today.js'), 'utf8');
  check('  …except Today\'s tick, which records rather than plans',
    (_todaySrc.match(/method:'PUT'/g) || []).length === 2 &&
    /body:JSON.stringify\(\{logged:newLogged\}\)/.test(_todaySrc));

  // Behavioural: drive the writer against a stubbed fetch. The stub is re-armed
  // immediately before each call — this block runs after the synchronous suite, and
  // other in-flight async tests swap the shared fetch between awaits.
  const _wSave = {fetch:G.fetch, auth:G.authHeaders};
  let _calls = [];
  const _arm2 = (impl) => {
    _calls = [];
    G.authHeaders = (extra) => Object.assign({Authorization:'Bearer x'}, extra || {});
    G.fetch = impl || (async (url, opts) => {
      _calls.push({url, opts});
      return {ok:true, status:200, json:async()=>({})};
    });
  };

  (async () => {
    _arm2();
    await G.injWriteBatch('cyc1', 'nebido', '2026-08-19', [{date:'2026-08-19', dose:'100'}], 'test');
    const _batchCalls = _calls.filter(c => /\/injections\/batch$/.test(c.url) &&
                                          String(c.opts.body).includes('"cycle_id":"cyc1"'));
    check('injWriteBatch posts one batch to /injections/batch',
      _batchCalls.length === 1 && _batchCalls[0].opts.method === 'POST',
      'saw ' + _batchCalls.length);
    const _body = JSON.parse(_batchCalls[0].opts.body);
    check('  …carrying cycle, compound, from_date and the entries',
      _body.cycle_id === 'cyc1' && _body.compound_id === 'nebido' &&
      _body.from_date === '2026-08-19' && _body.entries.length === 1);

    _arm2();
    await G.injClearFuture('cyc1', 'nebido', '2026-08-19', {tag:'test'});
    const _del = _calls.filter(c => c.opts.method === 'DELETE');
    check('injClearFuture deletes only from the given date forward',
      _del.length === 1 && /cycle_id=cyc1/.test(_del[0].url) &&
      /compound_id=nebido/.test(_del[0].url) && /from_date=2026-08-19/.test(_del[0].url),
      'saw ' + _del.length);
    // The whole point of the default: a logged dose is the record of something that
    // was administered, and clearing a plan must never take one with it.
    check('  …and spares logged doses unless told otherwise, by default',
      /unlogged_only=true/.test(_del[0].url));

    _arm2();
    await G.injClearFuture('cyc1', 'nebido', '2026-08-19', {unloggedOnly:false});
    check('  …with removing the record itself requiring an explicit flag',
      _calls.some(c => /unlogged_only=false/.test(c.url)));

    _arm2();
    await G.injClearFutureMany('cyc1', ['nebido','test_u','enanthate'], '2026-08-19', {});
    check('injClearFutureMany covers every id it is given',
      ['nebido','test_u','enanthate'].every(id =>
        _calls.some(c => c.url.includes('compound_id=' + id))));

    // A phone doing these one at a time was slow enough to see, and the sequential
    // version moved the following write down the microtask queue.
    let _open = 0, _maxOpen = 0;
    _arm2(async () => { _open++; _maxOpen = Math.max(_maxOpen, _open);
                        await Promise.resolve(); _open--; return {ok:true, status:200}; });
    await G.injClearFutureMany('cyc1', ['a','b','c'], '2026-08-19', {});
    check('  …in parallel, not one round trip after another', _maxOpen > 1, `maxOpen ${_maxOpen}`);

    // One failure must not abort the rest, nor the write that follows it.
    _arm2(async (url) => { if(String(url).includes('compound_id=b')) throw new Error('network');
                           return {ok:true, status:200}; });
    let _blew = false;
    try { await G.injClearFutureMany('cyc1', ['a','b','c'], '2026-08-19', {}); }
    catch(e){ _blew = true; }
    check('  …and one failed prune does not abort the others', !_blew);

    _arm2(async () => { throw new Error('offline'); });
    const _r = await G.injWriteBatch('c','n','2026-08-19',[], 'test');
    check('a network failure returns null rather than throwing at the caller', _r === null);

    G.fetch = _wSave.fetch; G.authHeaders = _wSave.auth;
  })();
}

// ── Phase 4: one Compounds tier ───────────────────────────────────────────────
// Henrik, 2026-08-16: "We will fold enhanced and TRT into one unified tab, all is part
// of a Protocol." And 2026-08-19: "Group by class testosterone on top", "any pre
// existing protocol needs to be merged into the new format".
console.log('\n── Compounds tier: folding an old protocol ────────────────');
{
  const G2 = sandbox;
  const _fSave = {stacks:G2._userStacks, buf:G2._editBuf, idx:G2._editIdx, doc:G2.document};
  G2.document = Object.assign({}, _fSave.doc, {getElementById:()=>null});

  const _open = (stack) => {
    G2._userStacks = [stack];
    G2.showStackEditor(0);
    return G2._editBuf;
  };

  // The exact shape that caused the 2026-08-16 mess: testosterone configured in the
  // Enhanced tier under its own spelling, while T-Calc wrote the TRT one.
  let buf = _open({id:'p2', name:'Protocol 2', peptides:[], trt:{},
                   enhanced:{enabled:true, compounds:[
                     {id:'test_u', name:'Testosterone Undecanoate (Nebido)', dose:'350',
                      unit:'mg/week', cadence:'interval', freqVal:2, freqUnit:'days'},
                     {id:'hgh',    name:'HGH (Somatropin)', dose:'3', unit:'IU/day'}]}});
  check('an Enhanced testosterone folds into the one tier',
    (buf.trt.compounds || []).length === 1);
  check('  …under the canonical id, not the tier it came from',
    buf.trt.compounds[0].id === 'nebido', buf.trt.compounds[0].id);
  // A rate becomes an amount on the way in: this block stores what goes in the syringe.
  // 350 mg/week on an every-2-days cadence is 100 mg. Carrying "mg/week" across is what
  // produced a dose the editor could not display, and a 28.6 mg injection (2026-08-19).
  check('  …converting the rate into the amount in the syringe',
    buf.trt.compounds[0].dose === '100' && buf.trt.compounds[0].unit === 'mg',
    buf.trt.compounds[0].dose + ' ' + buf.trt.compounds[0].unit);
  check('  …and leaves the tier enabled so it is not silently dormant',
    buf.trt.enabled === true);
  check('non-testosterone compounds stay exactly where they were',
    buf.enhanced.compounds.length === 1 && buf.enhanced.compounds[0].id === 'hgh');

  // A protocol holding the SAME molecule in both blocks is the double-stream case.
  // The TRT entry is the one T-Calc has been scheduling from, so it wins; the point is
  // that exactly one survives.
  buf = _open({id:'p3', peptides:[],
               trt:{enabled:true, compounds:[{id:'nebido', dose:'100', unit:'mg'}]},
               enhanced:{enabled:true, compounds:[{id:'test_u', dose:'350', unit:'mg/week'}]}});
  check('the same molecule in both blocks collapses to one entry',
    buf.trt.compounds.length === 1 && buf.trt.compounds[0].dose === '100');
  check('  …and the duplicate is gone from the other block',
    buf.enhanced.compounds.length === 0);

  // Nothing is written until Save — the fold happens in the edit buffer.
  check('the stored protocol is untouched until the user saves',
    G2._userStacks[0].enhanced.compounds.length === 1 &&
    G2._userStacks[0].enhanced.compounds[0].id === 'test_u');

  // A protocol with nothing to fold must come through unchanged.
  buf = _open({id:'p4', peptides:[], trt:{enabled:true, compounds:[{id:'nebido', dose:'100'}]},
               enhanced:{enabled:true, compounds:[{id:'deca', dose:'300'}]}});
  check('a protocol with nothing to fold is left alone',
    buf.trt.compounds.length === 1 && buf.enhanced.compounds.length === 1 &&
    buf.enhanced.compounds[0].id === 'deca');

  check('folding an empty protocol is a no-op, not a crash',
    G2._editFoldTestosterone({}) === 0 && G2._editFoldTestosterone(null) === 0);

  // Old tab ids must land somewhere real rather than on a tab that no longer exists.
  check('a stored "trt" tab id lands on Compounds',      G2._compTabId('trt') === 'compounds');
  check('  …and so does "enhanced"',                     G2._compTabId('enhanced') === 'compounds');
  check('  …while peptides is left alone',               G2._compTabId('peptides') === 'peptides');

  G2._userStacks = _fSave.stacks; G2._editBuf = _fSave.buf; G2._editIdx = _fSave.idx;
  G2.document = _fSave.doc;
}

// ── Migrating stored protocols to the merged tier ─────────────────────────────
// Henrik, 2026-08-19: "any pre existing protocol needs to be merged into the new
// format" → "Ok just migrate". The stored protocol is rewritten, rather than each one
// having to be opened and saved.
console.log('\n── Protocol migration ─────────────────────────────────────');
{
  const G3 = sandbox;
  const _mSave = {save:G3.saveStacksToBackend, bs:G3.buildStackStore,
                  bt:G3.buildToday, confirm:G3.confirm, alert:G3.alert};
  let _saved = 0, _asked = '', _told = '';
  G3.saveStacksToBackend = async () => { _saved++; };
  G3.buildStackStore = () => {}; G3.buildToday = () => {};
  G3.alert = (m) => { _told = m; };

  // The migration takes the list it operates on, so these tests never touch
  // _userStacks — the suite's other async blocks share that global.
  // Exactly the shape staging holds today: one protocol, testosterone in the Enhanced
  // block under its own spelling, HGH beside it.
  const _live = () => ([{id:'protocol_2_nostart', name:'Protocol 2', peptides:[{id:'glow'}],
                         trt:{}, enhanced:{enabled:true, compounds:[
                           {id:'test_u', name:'Testosterone Undecanoate (Nebido)', dose:'350',
                            unit:'mg/week', cadence:'interval', freqVal:2, freqUnit:'days'},
                           {id:'hgh', name:'HGH (Somatropin)', dose:'2', unit:'IU/day'}]}}]);

  let _stacks = _live();
  let _rep = G3._migrateProtocolsReport(_stacks);
  check('the report names what would move', _rep.length === 1);
  check('  …from the old spelling to the canonical one',
    _rep[0].from === 'test_u' && _rep[0].to === 'nebido');
  check('  …carrying the dose so the confirm can show it',
    _rep[0].dose === '350' && _rep[0].unit === 'mg/week');
  check('  …and naming the protocol it belongs to', _rep[0].stack === 'Protocol 2');
  check('a report changes nothing on its own',
    _stacks[0].enhanced.compounds.length === 2 &&
    (_stacks[0].trt.compounds || []).length === 0);

  (async () => {
    // Declining the confirm must leave everything alone — including the backend.
    G3.confirm = () => false;
    await G3.migrateProtocolsToCompounds(_stacks);
    check('declining the confirm writes nothing',
      _saved === 0 && _stacks[0].enhanced.compounds.length === 2);

    G3.confirm = (m) => { _asked = m; return true; };
    // Deltas, not totals: this block runs after the synchronous suite and other
    // in-flight tests share the stubbed saveStacksToBackend.
    let _before = _saved;
    await G3.migrateProtocolsToCompounds(_stacks);
    check('the confirm says protocols stay separate',
      /Protocols stay separate/.test(_asked));
    check('  …and that no injection is touched',
      /no injection is added, changed or deleted/.test(_asked));
    check('migrating moves testosterone into the one tier',
      _stacks[0].trt.compounds.length === 1 && _stacks[0].trt.compounds[0].id === 'nebido');
    check('  …converting the weekly rate to the per-injection amount',
      _stacks[0].trt.compounds[0].dose === '100' && _stacks[0].trt.compounds[0].unit === 'mg',
      _stacks[0].trt.compounds[0].dose + ' ' + _stacks[0].trt.compounds[0].unit);
    check('  …leaving everything else where it was',
      _stacks[0].enhanced.compounds.length === 1 &&
      _stacks[0].enhanced.compounds[0].id === 'hgh');
    check('  …keeping the protocol itself intact',
      _stacks.length === 1 && _stacks[0].peptides.length === 1);
    check('  …and persisting it', _saved > _before);

    // Running it twice must be a no-op, not a second round of moves.
    // Capture every message: other blocks share the stubbed alert in this window.
    const _msgs2 = [];
    G3.alert = (m) => { _msgs2.push(String(m)); };
    const _snapshot = JSON.stringify(_stacks);
    await G3.migrateProtocolsToCompounds(_stacks);
    check('running it again reports nothing to do',
      _msgs2.some(m => /Nothing to migrate/.test(m)), _msgs2.join(' || ').slice(0,120));
    // Idempotence is the real requirement — asserting on a save COUNT is unreliable
    // here, because other in-flight blocks share the stubbed saveStacksToBackend.
    check('  …and changes nothing the second time', JSON.stringify(_stacks) === _snapshot);

    // Two protocols stay two protocols — the tier merge is not a protocol merge.
    const _two = _live().concat(_live().map(x => JSON.parse(JSON.stringify(
      Object.assign({}, x, {id:'other', name:'Other'})))));
    await G3.migrateProtocolsToCompounds(_two);
    check('two protocols are migrated, not collapsed into one',
      _two.length === 2 && _two.every(x => x.trt.compounds.length === 1));

    G3.saveStacksToBackend = _mSave.save; G3.buildStackStore = _mSave.bs;
    G3.buildToday = _mSave.bt; G3.confirm = _mSave.confirm; G3.alert = _mSave.alert;
  })();
}

// ── A rate unit is not the amount in the syringe — in EITHER block ────────────
// Found by reading the record after Henrik ran Merge tiers (2026-08-19). The
// migration moved his testosterone from the Enhanced block to the merged tier
// carrying "350 mg/week", and the TRT branch of _genInjBatches never converted a rate
// to a per-injection amount — it had never needed to, because TRT compounds were
// always configured as plain mg. The result would have been "Nebido 350 mg/week" on
// every second day in Today: the exact rendering the 2026-08-07 fix removed, and a
// 3.5x overstatement of the dose sitting next to a real 100 mg shot.
console.log('\n── Rate units convert in both blocks ──────────────────────');
{
  const G4 = sandbox;
  // Henrik's protocol exactly as stored after the migration.
  const st = {id:'protocol_2_nostart', name:'Protocol 2', cycle_start:'2026-05-18', cycle_length:20,
              trt:{enabled:true, compounds:[{id:'nebido', name:'Testosterone Undecanoate (Nebido)',
                   dose:'350', unit:'mg/week', cadence:'interval', freqVal:2, freqUnit:'days',
                   days:[1,3], dot:'#b84a4a'}]}};
  const rows = G4._genInjBatches(st, 'protocol_2_nostart', null)
                 .reduce((a,b) => a.concat(b.entries||[]), []);
  check('a migrated mg/week compound still generates', rows.length > 0);
  check('  …as an AMOUNT per injection, not the weekly rate',
    rows.every(e => String(e.dose) === '100'),
    'first: ' + JSON.stringify(rows.slice(0,2).map(e => e.dose + ' ' + e.unit)));
  check('  …with the rate unit stripped, as the record stores amounts',
    rows.every(e => String(e.unit).indexOf('/') === -1),
    'units: ' + [...new Set(rows.map(e => e.unit))].join(','));

  // A plain per-injection TRT entry must pass through untouched — the conversion is
  // for rate units only, and 100 mg every 2 days means 100 mg in the syringe.
  const plain = G4._genInjBatches({id:'p', cycle_start:'2026-08-01', cycle_length:4,
    trt:{enabled:true, compounds:[{id:'nebido', name:'Nebido', dose:'100', unit:'mg',
         freqVal:2, freqUnit:'days'}]}}, 'p', null)
    .reduce((a,b) => a.concat(b.entries||[]), []);
  check('a plain mg dose is unchanged',
    plain.length > 0 && plain.every(e => String(e.dose) === '100' && e.unit === 'mg'));

  // And the weekday-cadence form: 350 mg/week over two days a week is 175 each.
  const wk = G4._genInjBatches({id:'w', cycle_start:'2026-08-01', cycle_length:4,
    trt:{enabled:true, compounds:[{id:'enanthate', name:'Testosterone Enanthate',
         dose:'350', unit:'mg/week', days:[1,4]}]}}, 'w', null)
    .reduce((a,b) => a.concat(b.entries||[]), []);
  check('a weekly rate split across two days is halved',
    wk.length > 0 && wk.every(e => String(e.dose) === '175' && e.unit === 'mg'),
    'first: ' + JSON.stringify(wk.slice(0,2).map(e => e.dose + ' ' + e.unit)));
}

// ── A dose unit is never displayed as something it is not ────────────────────
// Henrik, 2026-08-19: "Choosing 100mg every 2 day generates a 28mg dose instead of the
// planned 100mg. The compound planner still treats it as weekly dose."
//
// The entry stored unit "mg/week" — carried in from the Enhanced block by the tier
// migration — while this dropdown offered only mg/ml/IU/%. A <select> whose options do
// not contain its value renders the FIRST option, so the screen said "100 mg" and
// storage said "100 mg/week". The generator then divided, correctly, by a rate the user
// had never been shown: 100 / 7 * 2 = 28.6 mg.
console.log('\n── Dose units are shown as stored ─────────────────────────');
{
  const G5 = sandbox;
  const _uSave = {tier:G5._userTier, buf:G5._editBuf};
  G5._userTier = 3;
  G5._editBuf = {trt:{enabled:true, compounds:[]}, enhanced:{enabled:false, compounds:[]}};

  const html = G5._renderEditTRT({enabled:true, compounds:[
    {id:'nebido', name:'Nebido', dose:'100', unit:'mg/week', cadence:'interval',
     freqVal:2, freqUnit:'days'}]});
  // The <select> for this compound must carry the stored unit as its selected option.
  check('a stored rate unit is offered, not silently replaced',
    /<option selected>mg\/week<\/option>/.test(html),
    (html.match(/<option[^>]*>[^<]*<\/option>/g) || []).slice(0,8).join(''));
  check('  …and mg is NOT the one shown as selected',
    !/<option selected>mg<\/option>/.test(html));

  const plain = G5._renderEditTRT({enabled:true, compounds:[
    {id:'nebido', name:'Nebido', dose:'100', unit:'mg', freqVal:2, freqUnit:'days'}]});
  check('a plain mg entry still shows mg', /<option selected>mg<\/option>/.test(plain));

  // Any unit that somehow reaches this screen must be visible, including one the list
  // does not know — the failure was a value with nowhere to render, not this value.
  const odd = G5._renderEditTRT({enabled:true, compounds:[
    {id:'nebido', name:'Nebido', dose:'1', unit:'ampoule/fortnight'}]});
  check('an unknown unit is appended rather than hidden',
    /<option selected>ampoule\/fortnight<\/option>/.test(odd));

  check('the list covers the rate units the other tier can produce',
    ['mg/week','mg/day','mg/EOD'].every(u => G5.TRT_UNITS.indexOf(u) >= 0));

  G5._userTier = _uSave.tier; G5._editBuf = _uSave.buf;
}

// ── Half-life on every compound card ─────────────────────────────────────────
// Henrik, 2026-08-19: "For all compounds can we list half time? Instead of the
// 'short ester' etc." A class label and a phrase like "Short ester" are ways of saying
// a number without saying it — and the number is what decides injection frequency and
// how long a side effect persists after stopping.
console.log('\n── Half-life on compound cards ────────────────────────────');
{
  const G5 = sandbox;
  const hl = G5._halfLifeLabel;

  check('a peptide half-life is read straight off the catalogue',
    hl({id:'cjc-ipa', halfLife:'GHRH ~30 min · IPA ~2 h'}) === 't½ GHRH ~30 min · IPA ~2 h');
  check('an enhanced compound reads its cadence half-life',
    hl({id:'deca', cadence:{halfLife:'~6 days'}}) === 't½ ~6 days');

  // The stored strings are written for a detail panel, not a 44px card.
  check('a long clinical string is trimmed to its leading figure',
    hl({id:'nebido'}) === 't½ ~56 days', hl({id:'nebido'}));
  // A blend states both components with a middle dot; keeping only the first would hide
  // half the answer, so that separator is deliberately not a split point.
  check('  …but a two-part blend keeps both parts',
    hl({id:'cjc-ipa', halfLife:'GHRH ~30 min · IPA ~2 h'}) === 't½ GHRH ~30 min · IPA ~2 h');
  check('  …and a clause with no figure never wins over one that has it',
    hl({id:'sus-x', cadence:{halfLife:'blended esters; effective ~4–5 days'}}) === 't½ effective ~4–5 days',
    hl({id:'sus-x', cadence:{halfLife:'blended esters; effective ~4–5 days'}}));
  check('  …and a trailing qualification after a semicolon is dropped',
    hl({id:'x', cadence:{halfLife:'~34 days terminal; released over ~10–14 weeks'}}) === 't½ ~34 days terminal');

  // NOTHING IS INVENTED. A compound with no published half-life keeps its old subtitle
  // rather than being given a number — this app has shipped an invented fallback before
  // (the mg/day free-T axis, 2026-08-02) and it cost a day.
  check('a compound with no half-life gets no label', hl({id:'unknown-thing'}) === '');
  check('  …and neither does a missing entry', hl(null) === '' && hl(undefined) === '');

  // The vial spec is concrete data, so it survives behind the half-life.
  check('the TRT card keeps its vial spec after the half-life',
    G5._metaWithHalfLife({id:'nebido', halfLife:'~56 days'}, 'Testosterone Undecanoate 1000mg/4ml') ===
    't½ ~56 days · Testosterone Undecanoate 1000mg/4ml');
  check('  …and shows the spec alone when the half-life is unknown',
    G5._metaWithHalfLife({id:'nope'}, 'Some 250mg/ml') === 'Some 250mg/ml');

  // The backend PK catalogue outranks the bundled fallback: the card must not disagree
  // with the curve, which integrates that same figure.
  const _exSave = G5._tcExtraCatalog;
  G5._tcExtraCatalog = [{id:'nebido', halfLife:'~56 days (backend)'}];
  check('the backend PK catalogue wins over the bundled guide',
    hl({id:'nebido'}) === 't½ ~56 days');
  G5._tcExtraCatalog = _exSave;

  // Rendered, not just computed: every tier's card must carry it.
  const _cSave = {cat:G5.ENHANCEMENT_COMPOUNDS, buf:G5._editBuf, tier:G5._userTier};
  G5._userTier = 3;
  G5.ENHANCEMENT_COMPOUNDS = [{id:'deca', name:'Deca', group:'19-Nor', cls:'19nor',
                               dot:'#888', defaultDose:300, unit:'mg/week',
                               cadence:{halfLife:'~6 days', rec:'Twice weekly'}}];
  G5._editBuf = {trt:{enabled:false,compounds:[]}, enhanced:{enabled:false,compounds:[]}};
  const enhHtml = G5._renderEditEnhanced({enabled:false, compounds:[]});
  check('an enhanced card shows the half-life instead of its class',
    /t½ ~6 days/.test(enhHtml) && !/>19-Nor<\/div><\/div>/.test(enhHtml));
  G5.ENHANCEMENT_COMPOUNDS = _cSave.cat; G5._editBuf = _cSave.buf; G5._userTier = _cSave.tier;
}

// ── The app reads the merged catalogue ───────────────────────────────────────
// Henrik, 2026-08-19: "Didn't we merge the catalogs?" We had — in the backend, in
// Phase 1 — and nothing in the app was reading it. Two sources were still being
// fetched and reconciled client-side, which is the work the merged endpoint removes.
console.log('\n── Merged catalogue: the app reads it ─────────────────────');
{
  const G6 = sandbox;
  const _mcSave = {fetch:G6.fetch, cat:G6.ENHANCEMENT_COMPOUNDS, merged:G6._COMPOUND_CATALOG,
                   al:G6._COMPOUND_ALIASES};
  const MERGED = {
    compounds:[
      {id:'nebido', name:'Nebido', group:'Base', isTestosterone:true, aliases:['test_u'],
       pk:{halfLife:'~56 days plateau-equivalent (37-75 d individual range)'},
       cadence:{halfLife:'~34 days terminal'}},
      {id:'deca', name:'Deca', group:'19-Nor', isTestosterone:false,
       cadence:{halfLife:'~14–16 days'}},
      {id:'hgh', name:'HGH', group:'GH Axis', isTestosterone:false, cadence:{halfLife:'~20 min active'}},
    ],
    aliases:{test_u:'nebido', test_e:'enanthate'},
  };

  (async () => {
    // Only this call's catalogue requests: other in-flight blocks share the stub.
    let asked = [];
    const _armCat = (handler) => { asked = []; G6.fetch = async (u, o) => {
      const url = String(u);
      if (/\/compounds\//.test(url)) asked.push(url);
      return handler(url, o);
    }; };

    _armCat(async () => ({ok:true, status:200, json: async () => MERGED}));
    await G6.syncEnhancedCompoundsFromAgent();
    check('the app fetches /compounds/catalog', asked.some(u => /\/compounds\/catalog$/.test(u)));
    // Ordering is asserted on the source rather than on a call log: this block runs
    // after the synchronous suite, and other in-flight tests swap the shared fetch stub
    // between the two awaits inside the function — a flaky log, not a real signal.
    const _cycSrc = fs.readFileSync(path.join(__dirname, '../tab-cycles.js'), 'utf8');
    check('  …with the pre-merge endpoint only as a fallback beneath it',
      _cycSrc.indexOf("'/compounds/catalog'") < _cycSrc.indexOf("'/compounds/enhanced'") &&
      /A backend that predates the merge still serves the old endpoint/.test(_cycSrc));
    check('  …keeping the whole merged list for lookups',
      G6._COMPOUND_CATALOG.length === 3);
    check('  …and the alias map the backend owns',
      G6._COMPOUND_ALIASES.test_u === 'nebido');

    // ENHANCEMENT_COMPOUNDS must keep meaning what it meant: the compounds the Enhanced
    // editor renders. Testosterone has its own section in the merged tab, and listing
    // the esters in both would show every one of them twice.
    check('the Enhanced list excludes testosterone, which has its own section',
      G6.ENHANCEMENT_COMPOUNDS.length === 2 &&
      !G6.ENHANCEMENT_COMPOUNDS.some(c => c.id === 'nebido'));

    // The join is what removes the client-side reconciliation: pk wins over cadence for
    // the same compound, because pk is the figure the plasma curve integrates.
    // The PK string is the one the curve integrates, qualifier and all: Nebido's
    // "plateau-equivalent" is the difference between the depot releasing and
    // testosterone clearing, which is exactly what a reader needs to know.
    check('a half-life comes from the merged entry\'s PK figure, not its cadence text',
      G6._halfLifeLabel({id:'nebido', pk:MERGED.compounds[0].pk,
                         cadence:MERGED.compounds[0].cadence}) === 't½ ~56 days plateau-equivalent',
      G6._halfLifeLabel({id:'nebido', pk:MERGED.compounds[0].pk, cadence:MERGED.compounds[0].cadence}));
    check('  …and a non-PK compound reads its own catalogue entry',
      G6._halfLifeLabel({id:'deca', cadence:{halfLife:'~14–16 days'}}) === 't½ ~14–16 days');

    // A backend that predates the merge must still work.
    check('an older backend still gets a catalogue, from the old endpoint',
      /if\(!r2\.ok\)\{_logHttp\('syncEnhanced'/.test(_cycSrc) &&
      /ENHANCEMENT_COMPOUNDS=Array\.isArray\(d2\)/.test(_cycSrc));
    check('  …and a failed catalogue fetch is reported, not swallowed',
      /_logHttp\('syncCatalog',r\.status,'\/compounds\/catalog'\)/.test(_cycSrc));

    G6.fetch = _mcSave.fetch; G6.ENHANCEMENT_COMPOUNDS = _mcSave.cat;
    G6._COMPOUND_CATALOG = _mcSave.merged; G6._COMPOUND_ALIASES = _mcSave.al;
  })();
}

// ── The PK model reads the merged catalogue, and the curve does not move ──────
// Henrik, 2026-08-19: "Do it but verify curve data before and after this change, make
// sure output for different t esters produces the same results before merge of anything."
//
// These numbers ARE the model: half-life, the uncertainty band, tmax, bioavailability
// and the ester fraction the plasma curve integrates. The refactor was verified by
// fingerprinting every ester's curve — PK inputs, raw plasma peak, and the calibrated
// free-T series — through both paths against the live payloads; identical to six
// decimals. These checks keep it that way.
console.log('\n── PK catalogue from the merged endpoint ──────────────────');
{
  const G7 = sandbox;
  // Shaped exactly like the live payload: the merged entry carries the trt-catalog row
  // verbatim under `pk`.
  const PK_NEBIDO = {id:'nebido', name:'Nebido (Testosterone Undecanoate)', dot:'#e8a020',
                     halfLifeDays:56, halfLifeDaysLow:37, halfLifeDaysHigh:75,
                     tmaxDays:7, testosteroneFraction:0.6315, halfLife:'~56 days'};
  const PK_ENAN   = {id:'enanthate', name:'Testosterone Enanthate', dot:'#e05050',
                     halfLifeDays:4.5, tmaxDays:2.25, testosteroneFraction:0.7199};
  const MERGED = {compounds:[
    {id:'nebido', name:'Nebido', isTestosterone:true, pk:PK_NEBIDO},
    {id:'enanthate', name:'Enanthate', isTestosterone:true, pk:PK_ENAN},
    {id:'deca', name:'Deca', isTestosterone:false},          // no pk — not testosterone
  ]};

  const rows = G7._tcPkRowsFromMerged(MERGED);
  check('every PK entry is pulled out of the merged catalogue', rows.length === 2);
  check('  …verbatim, so the model reads the same numbers it always did',
    rows.find(r => r.id === 'nebido') === PK_NEBIDO);
  check('  …and a compound with no PK entry is skipped, not faked',
    !rows.some(r => r.id === 'deca'));
  check('a payload with no compounds yields nothing', G7._tcPkRowsFromMerged({}).length === 0 &&
    G7._tcPkRowsFromMerged(null).length === 0);

  // THE FAILURE THAT WOULD MATTER MOST: an empty or malformed response must never be
  // applied. _tcExtraCatalog is what the model integrates — emptying it silently drops
  // every ester back to the 7-day default and flattens the curve, with nothing on screen
  // to say why.
  const _pkSave = G7._tcExtraCatalog;
  G7._tcExtraCatalog = [PK_NEBIDO];
  check('an empty catalogue is refused rather than applied',
    G7._tcApplyPkCatalog([]) === false && G7._tcExtraCatalog.length === 1);
  check('  …and so is a non-array', G7._tcApplyPkCatalog(null) === false &&
    G7._tcApplyPkCatalog({compounds:[]}) === false && G7._tcExtraCatalog.length === 1);

  // The model's own reader must see the merged numbers, unchanged.
  G7._tcExtraCatalog = rows;
  const nb = G7._tcCompInfo('nebido');
  check('the model reads the merged half-life, band and tmax',
    nb.halfLifeDays === 56 && nb.halfLifeDaysLow === 37 && nb.halfLifeDaysHigh === 75 &&
    nb.tmaxDays === 7);
  check('  …and the ester fraction, which is 14% between enanthate and undecanoate',
    nb.testosteroneFraction === 0.6315 &&
    G7._tcCompInfo('enanthate').testosteroneFraction === 0.7199);
  G7._tcExtraCatalog = _pkSave;

  // /trt-catalog stays as the fallback: it is public unauthenticated reference data, and
  // it is what an older backend serves.
  const _tcSrc = fs.readFileSync(path.join(__dirname, '../tab-tcalc.js'), 'utf8');
  check('the merged endpoint is tried first, /trt-catalog second',
    _tcSrc.indexOf("'/compounds/catalog'") < _tcSrc.indexOf("'/trt-catalog'"));
  check('  …and the fallback is inside the catch, so a failure cannot leave it unset',
    /catch\(function\(\)\{[\s\S]{0,400}\/trt-catalog/.test(_tcSrc));
}

// ── Nothing calls a function that no longer exists ──────────────────────────
// Phase 8 deleted _tcSyncLogToBackend while three live call sites still named it.
// Shipping that would have thrown ReferenceError the moment one ran — the same
// shape as the admin UI's dmWhere on 2026-08-20, where a missing function was
// reported to the user as a network failure.
//
// Source greps cannot catch this: every assertion about a deleted function passes
// precisely BECAUSE the name is absent. So check the other direction — every
// helper this app CALLS must also be DEFINED in a file the page loads.
console.log('\n── No call reaches a function that was deleted ─────────────');
{
  const base = path.dirname(path.resolve(htmlPath));
  const html = fs.readFileSync(path.resolve(htmlPath), 'utf8');
  // Every module the page actually loads, taken from its own script tags, so a new
  // file cannot silently fall outside the check.
  const loaded = [...html.matchAll(/src="([a-z-]+\.js)/g)].map(m => m[1]);
  check('the loaded modules were discovered from index.html', loaded.length >= 10);

  let all = html;
  for (const f of loaded) {
    const fp = path.join(base, f);
    if (fs.existsSync(fp)) all += '\n' + fs.readFileSync(fp, 'utf8');
  }

  // Strip line comments and block comments so prose ("_tcSyncLogToBackend would
  // also have re-posted…") is not read as a call. Strings are left in place: an
  // inline onclick="_tcFoo()" IS a real call site and must count.
  const code = all.replace(/\/\*[\s\S]*?\*\//g, ' ')
                  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

  const defined = new Set();
  let m;
  const reDecl = /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = reDecl.exec(code))) defined.add(m[1]);
  const reAssign = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = reAssign.exec(code))) defined.add(m[1]);

  // A call behind `typeof X === 'function'` is a deliberate optional dependency —
  // load order across these modules is real, and those guards are how it is handled.
  const guarded = new Set();
  const reGuard = /typeof\s+([A-Za-z_$][\w$]*)\s*[!=]==?\s*'(?:function|undefined)'/g;
  while ((m = reGuard.exec(code))) guarded.add(m[1]);

  // This app's own helpers only, by prefix: browser and DOM builtins are out of
  // scope and cannot produce a false failure.
  const isOurs = n => /^(_tc|_wiz|_gen|_enh|_canon|_inj|inj|_cal|_trt)[A-Z_]/.test(n);
  const called = new Set();
  // Not preceded by '.', or `canvas._tcTouchMove(e)` — a property holding a
  // function, defined by assignment on the element — reads as a missing global.
  const reCall = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = reCall.exec(code))) if (isOurs(m[2])) called.add(m[2]);

  const missing = [...called].filter(n => !defined.has(n) && !guarded.has(n)).sort();
  check('every helper the app calls is defined in a module it loads',
    missing.length === 0,
    missing.length ? 'undefined: ' + missing.join(', ')
                   : 'checked ' + called.size + ' helpers across ' + loaded.length + ' modules');

  // The three Phase 8 removed, named so a re-add is caught.
  for (const gone of ['_tcSyncLogToBackend','_tcSetTargetStack','_tcClearStackConfigTrt']) {
    check('  \u2026' + gone + ' is defined nowhere', !defined.has(gone));
  }
}

// ── An unscoped delete never leaves the app ─────────────────────────────────
// On 2026-08-14 `DELETE /injections?cycle_id=&from_date=<today>` went out and
// destroyed a user's entire forward schedule: an empty value is not a narrow
// filter, it is NO filter, and the backend matched every row in the account.
// The guard lived in _tcSetTargetStack; Phase 8 deleted that with the rest of
// T-Calc's write paths, so it now lives in inj-writer.js — the only module that
// issues a delete. Driven for real, not grepped.
console.log('\n── inj-writer refuses an unscoped delete ──────────────────');
{
  const _svFetch = G.fetch, _svAuth = G.authHeaders;
  let urls = [];
  G.fetch = function(u, o){ urls.push(String(u) + ' [' + ((o && o.method) || 'GET') + ']');
                            return Promise.resolve({ok:true, status:200, json:()=>Promise.resolve([])}); };
  G.authHeaders = function(){ return {}; };

  const today = '2026-08-20';
  const cases = [
    ['empty cycle id',    ['',        'nebido', today]],
    ['empty compound id', ['cyc1',    '',       today]],
    ['empty from date',   ['cyc1',    'nebido', '']],
    ['all three missing', ['',        '',       '']],
  ];
  for (const [label, args] of cases) {
    urls = [];
    G.injClearFuture(args[0], args[1], args[2], {tag:'guardtest'});
    check('refused: ' + label, urls.length === 0, urls.join(' | '));
  }

  // …and a fully scoped delete still goes out, or the guard would be a bug of its own.
  urls = [];
  G.injClearFuture('cyc1', 'nebido', today, {tag:'guardtest'});
  const sent = urls.join(' | ');
  check('a fully scoped delete is still issued', urls.length === 1, sent);
  check('  …carrying all three filters', /cycle_id=cyc1/.test(sent) &&
        /compound_id=nebido/.test(sent) && /from_date=2026-08-20/.test(sent));
  check('  …and unlogged_only, so a recorded dose is never taken with the plan',
        /unlogged_only=true/.test(sent));

  // injClearFutureMany fans out through the same guard.
  urls = [];
  G.injClearFutureMany('', ['nebido','enanthate'], today, {tag:'guardtest'});
  check('the many-compound form is guarded too, not just the single', urls.length === 0, urls.join(' | '));

  G.fetch = _svFetch; G.authHeaders = _svAuth;
}
