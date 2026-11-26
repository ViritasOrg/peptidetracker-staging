var _bcWeightWindow=90;var _bcWeightScale='zoom';
function setBcWeightWindow(days){_bcWeightWindow=days;document.querySelectorAll('.bcw-btn').forEach(function(b){b.classList.remove('active');});var btn=document.getElementById('bcw-btn-'+days);if(btn)btn.classList.add('active');var sb=document.getElementById('bcw-scale-'+_bcWeightScale);if(sb)sb.classList.add('active');bcDrawWeightLeanChart();}
function setBcWeightScale(s){_bcWeightScale=s;document.querySelectorAll('.bcw-scale-btn').forEach(function(b){b.classList.remove('active');});var btn=document.getElementById('bcw-scale-'+s);if(btn)btn.classList.add('active');bcDrawWeightLeanChart();}
var _bcWeightHistOpen=false;
function toggleBcWeightHist(){_bcWeightHistOpen=!_bcWeightHistOpen;var el=document.getElementById('bc-weight-history-list');var chev=document.getElementById('bc-wh-chev');if(el)el.style.display=_bcWeightHistOpen?'flex':'none';if(chev)chev.style.transform=_bcWeightHistOpen?'rotate(180deg)':'rotate(0deg)';}
function sortWeightHistory(arr){return[...arr].sort(function(a,b){var av=/^\d{4}-\d{2}-\d{2}$/.test(a.date||'');var bv=/^\d{4}-\d{2}-\d{2}$/.test(b.date||'');if(av!==bv)return av?1:-1;return a.date<b.date?1:a.date>b.date?-1:0;});}
function bcRenderWeightHistory(){var _wh=sortWeightHistory(weights);var el=document.getElementById('bc-weight-history-list');if(!el)return;el.innerHTML=_wh.map(function(w){var _ok=w.date&&/^\d{4}-\d{2}-\d{2}$/.test(w.date);var _dl=_ok?fmtDate(new Date(w.date.replace(/-/g,'/'))):'<span style="color:#ff4444">⚠ invalid ('+String(w.date)+')</span>';return'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);font-size:12px;"><div style="color:var(--muted2)">'+_dl+'</div><div style="display:flex;align-items:center;gap:10px"><div style="font-family:var(--font-mono);font-size:22px;color:var(--accent)">'+w.weight+' <span style="font-size:12px">kg</span></div><button onclick="deleteWeight(\''+w.date+'\')" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;padding:4px;">✕</button></div></div>';}).join('');}
function bcDrawWeightLeanChart(){var days=_bcWeightWindow||90;var cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);var cutoffStr=cutoff.toISOString().split('T')[0];var wSeries=weights.filter(function(w){return w.date&&/^\d{4}-\d{2}-\d{2}$/.test(w.date)&&w.date>=cutoffStr&&w.weight>0&&isFinite(w.weight);});wSeries.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});var _wAllPre=weights.filter(function(w){return w.date&&/^\d{4}-\d{2}-\d{2}$/.test(w.date)&&w.weight>0&&isFinite(w.weight)&&w.date<cutoffStr;});_wAllPre.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});if(_wAllPre.length&&wSeries.length){var _wp2=_wAllPre[_wAllPre.length-1];var _wf2=wSeries[0];var _wpMs=new Date(_wp2.date.replace(/-/g,'/')).getTime();var _wfMs=new Date(_wf2.date.replace(/-/g,'/')).getTime();var _cutMs2=cutoff.getTime();var _wt2=_wfMs>_wpMs?(_cutMs2-_wpMs)/(_wfMs-_wpMs):0;var _wi=Math.round((_wp2.weight+_wt2*(_wf2.weight-_wp2.weight))*10)/10;wSeries=[{date:cutoffStr,weight:_wi}].concat(wSeries);}else if(_wAllPre.length&&!wSeries.length){wSeries=[{date:cutoffStr,weight:_wAllPre[_wAllPre.length-1].weight}];}var stored=bcLoad();var storedDates=new Set(stored.map(function(e){return e.date;}));var bcRaw=[].concat(stored);var _lcutMs=cutoff.getTime();var lAll=[];for(var _e of bcRaw){if(!_e.date)continue;var _ems=new Date(_e.date.replace(/-/g,'/')).getTime();if(!isFinite(_ems))continue;var _lw=getWeightForDate(_e.date);if(_lw)lAll.push({ms:_ems,lean:Math.round(_lw*(1-_e.bf/100)*10)/10});}lAll.sort(function(a,b){return a.ms-b.ms;});var lSeries=lAll.filter(function(l){return l.ms>=_lcutMs;});var _preLean=lAll.filter(function(l){return l.ms<_lcutMs;});if(!lSeries.length&&_preLean.length){lSeries=[{ms:_lcutMs,lean:_preLean[_preLean.length-1].lean}];}else if(lSeries.length&&_preLean.length){var _lp=_preLean[_preLean.length-1];var _t2=(_lcutMs-_lp.ms)/(lSeries[0].ms-_lp.ms);lSeries=[{ms:_lcutMs,lean:Math.round((_lp.lean+_t2*(lSeries[0].lean-_lp.lean))*10)/10}].concat(lSeries);}var canvas=document.getElementById('chart-weight-trend');if(!canvas)return;var dpr=window.devicePixelRatio||1;var cssW=(canvas.style.width='100%',canvas.offsetWidth)||300;var cssH=120;canvas.width=cssW*dpr;canvas.height=cssH*dpr;canvas.style.width='100%';canvas.style.height=cssH+'px';var ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);if(!wSeries.length&&!lSeries.length){ctx.fillStyle='#555';ctx.font='12px -apple-system,system-ui,sans-serif';ctx.fillText('No data in last '+days+' days',10,55);return;}var PAD={top:12,right:12,bottom:28,left:42};var cW=cssW-PAD.left-PAD.right;var cH=cssH-PAD.top-PAD.bottom;var cutoffMs=cutoff.getTime();var todayMs=new Date((dateKey(NOW)).replace(/-/g,'/')).getTime();var timeRange=todayMs-cutoffMs||1;function xOf(dateStr){var ms=new Date(dateStr.replace(/-/g,'/')).getTime();return PAD.left+Math.min(1,Math.max(0,(ms-cutoffMs)/timeRange))*cW;}var allVals=wSeries.map(function(w){return w.weight;}).concat(lSeries.map(function(l){return l.lean;}));var minV=Math.min.apply(null,allVals);var maxV=Math.max.apply(null,allVals);var vRange=maxV-minV||1;var yMin,yMax;if(_bcWeightScale==='abs'){yMin=0;yMax=maxV*1.08;}else{yMin=minV-vRange*0.15;yMax=maxV+vRange*0.15;}function yOf(v){return PAD.top+cH-((v-yMin)/(yMax-yMin))*cH;}ctx.strokeStyle='#3A352B';ctx.lineWidth=0.5;for(var gi=0;gi<=3;gi++){var gy=PAD.top+(cH/3)*gi;ctx.beginPath();ctx.moveTo(PAD.left,gy);ctx.lineTo(PAD.left+cW,gy);ctx.stroke();}ctx.fillStyle='#555';ctx.font='9px -apple-system,system-ui,sans-serif';ctx.textAlign='right';for(var li=0;li<=3;li++){var lv=yMax-(yMax-yMin)*(li/3);var ly2=PAD.top+(cH/3)*li;ctx.fillText(lv.toFixed(1),PAD.left-4,ly2+3);}if(wSeries.length>=1){var wPts=wSeries.map(function(w){return{x:xOf(w.date),y:yOf(w.weight)};});var wMsArr=wSeries.map(function(w){return new Date(w.date.replace(/-/g,'/')).getTime();});function lYAt(ms){if(!lSeries.length)return PAD.top+cH;var _ls=lSeries.map(function(l){return{ms:l.ms,v:l.lean};});if(ms<=_ls[0].ms)return yOf(_ls[0].v);if(ms>=_ls[_ls.length-1].ms)return yOf(_ls[_ls.length-1].v);for(var _j=1;_j<_ls.length;_j++){if(ms<=_ls[_j].ms){var _t=(ms-_ls[_j-1].ms)/(_ls[_j].ms-_ls[_j-1].ms);return yOf(_ls[_j-1].v+_t*(_ls[_j].v-_ls[_j-1].v));}}return yOf(_ls[_ls.length-1].v);}function smoothLine(ctx,pts,t){if(pts.length<2)return;if(pts.length===2){ctx.lineTo(pts[1].x,pts[1].y);return;}for(var _si=0;_si<pts.length-1;_si++){var _p0=_si>0?pts[_si-1]:pts[0];var _p1=pts[_si];var _p2=pts[_si+1];var _p3=_si<pts.length-2?pts[_si+2]:_p2;/* A handle is never longer, along the time axis, than half its own segment. Weigh-ins are unevenly spaced: with one 2 days after another and the neighbours weeks away, the handles (sized from the neighbours) reached past both ends of the 2-day segment and the line looped back in time (Henrik, 2026-11-23: "why is the yellow weight line going in an curve back in time?"). Each handle is scaled whole, so its direction is kept. */var _hw=(_p2.x-_p1.x)/2,_d1=(_p2.x-_p0.x)*t,_d2=(_p3.x-_p1.x)*t,_k1=_d1>_hw?_hw/_d1:1,_k2=_d2>_hw?_hw/_d2:1;ctx.bezierCurveTo(_p1.x+_d1*_k1,_p1.y+(_p2.y-_p0.y)*t*_k1,_p2.x-_d2*_k2,_p2.y-(_p3.y-_p1.y)*t*_k2,_p2.x,_p2.y);}}ctx.beginPath();ctx.moveTo(wPts[0].x,lYAt(wMsArr[0]));ctx.lineTo(wPts[0].x,wPts[0].y);smoothLine(ctx,wPts,0.15);for(var _ri=wPts.length-1;_ri>=0;_ri--){ctx.lineTo(wPts[_ri].x,lYAt(wMsArr[_ri]));}ctx.closePath();var wGrad=ctx.createLinearGradient(0,PAD.top,0,PAD.top+cH);wGrad.addColorStop(0,'#e8ff3c33');wGrad.addColorStop(1,'#e8ff3c00');ctx.fillStyle=wGrad;ctx.fill();ctx.beginPath();ctx.moveTo(wPts[0].x,wPts[0].y);smoothLine(ctx,wPts,0.15);ctx.strokeStyle='#e8ff3c';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();wPts.forEach(function(p){ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fillStyle='#e8ff3c';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fillStyle='#000000';ctx.fill();});}if(lSeries.length>=1){var lPts=lSeries.map(function(l){return{x:PAD.left+Math.min(1,Math.max(0,(l.ms-cutoffMs)/timeRange))*cW,y:yOf(l.lean)};});ctx.beginPath();ctx.moveTo(lPts[0].x,lPts[0].y);lPts.forEach(function(p,i){if(i>0)ctx.lineTo(p.x,p.y);});ctx.strokeStyle='#c084fc';ctx.lineWidth=2;ctx.lineJoin='round';ctx.setLineDash([]);ctx.stroke();lPts.forEach(function(p){ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fillStyle='#c084fc';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fillStyle='#000000';ctx.fill();});}var midMs=cutoffMs+timeRange/2;var midDate=new Date(midMs);function _shortDate(d){var mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return mo[d.getMonth()]+' '+d.getDate();}ctx.fillStyle='#555';ctx.font='9px -apple-system,system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(_shortDate(cutoff),PAD.left,PAD.top+cH+18);ctx.textAlign='center';ctx.fillText(_shortDate(midDate),PAD.left+cW/2,PAD.top+cH+18);ctx.textAlign='right';ctx.fillText('Today',PAD.left+cW,PAD.top+cH+18);ctx.textAlign='right';var legX=PAD.left+cW;ctx.font='9px -apple-system,system-ui,sans-serif';ctx.fillStyle='#e8ff3c';ctx.fillText('● Weight',legX,PAD.top+9);ctx.fillStyle='#c084fc';ctx.fillText('● Lean',legX,PAD.top+19);}
function bcLoad(){try{return JSON.parse(localStorage.getItem(BC_KEY)||'[]');}catch{return[];}}
function bcSave(arr){localStorage.setItem(BC_KEY,JSON.stringify(arr));}
function navyBF(n,b,h,sex,hip){if(sex==='female'&&hip){return Math.round((495/(1.29579-0.35004*Math.log10(b+hip-n)+0.22100*Math.log10(h))-450)*10)/10;}return Math.round((495/(1.0324-0.19077*Math.log10(b-n)+0.15456*Math.log10(h))-450)*10)/10;}
function setBioSex(sex){localStorage.setItem('user_sex',sex);pushPepSettingsToAgent({'user_sex':sex});document.querySelectorAll('#sex-chip-male,#sex-chip-female').forEach(function(el){el.classList.remove('sel');});var chip=document.getElementById('sex-chip-'+sex);if(chip)chip.classList.add('sel');var hr=document.getElementById('bc-hip-row');if(hr)hr.style.display=sex==='female'?'flex':'none';if(typeof _bcMethod!=='undefined'&&_bcMethod==='caliper')renderCaliperInputs();}
function parseVal(id){const _el=document.getElementById(id);if(!_el)return null;const raw=String(_el.value||'').trim().replace(',','.');const v=parseFloat(raw);return isNaN(v)?null:v;}
function bcLog(){const sex=localStorage.getItem('user_sex')||'male';const h=parseInt(localStorage.getItem('user_height')||'182');const n=parseVal('bc-neck');const b=parseVal('bc-belly');const hip=sex==='female'?parseVal('bc-hip'):null;const err=document.getElementById('bc-err');err.textContent='';if(n===null){err.textContent='Enter neck circumference';return;}if(b===null){err.textContent='Enter waist circumference';return;}if(sex==='female'&&hip===null){err.textContent='Enter hip circumference';return;}if(n<20||n>60){err.textContent='Neck out of range';return;}if(b<50||b>200){err.textContent='Waist out of range';return;}if(sex==='female'&&hip!==null&&(hip<60||hip>200)){err.textContent='Hip out of range';return;}if(b<=n){err.textContent='Waist must be larger than neck';return;}const bf=navyBF(n,b,h,sex,hip);if(bf<3||bf>60){err.textContent='Result out of range — check measurements.';return;}const entry={date:dateKey(NOW),dateLabel:fmtDate(NOW),neck:n,belly:b,bf:bf,...(hip!==null?{hip}:{})};const arr=bcLoad();const idx=arr.findIndex(e=>e.date===entry.date);if(idx!==-1)arr[idx]=entry;else arr.push(entry);arr.sort((a,b)=>a.date.localeCompare(b.date));bcSave(arr);pushBodyCompToAgent(entry);document.getElementById('bc-neck').value=entry.neck;document.getElementById('bc-belly').value=entry.belly;if(sex==='female'&&entry.hip!=null){const he=document.getElementById('bc-hip');if(he)he.value=entry.hip;}bcRender();}
function bcRender(){if(typeof _pfRenderInfo==='function')_pfRenderInfo();const _hcm=parseInt(localStorage.getItem('user_height')||'182');const _hdisp=document.getElementById('bc-height-display');if(_hdisp)_hdisp.textContent=_hcm+' cm';const stored=bcLoad();const storedDates=new Set(stored.map(e=>e.date));const raw=[...stored];raw.sort((a,b)=>new Date(a.date.replace(/-/g,'/'))-new Date(b.date.replace(/-/g,'/')));const arr=raw.map(e=>{const w=getWeightForDate(e.date);const bmi=w?Math.round(w/Math.pow(_hcm/100,2)*10)/10:null;const lean=w?Math.round(w*(1-e.bf/100)*10)/10:null;return{...e,resolvedWeight:w,bmi,lean};});document.getElementById('bc-date-badge').textContent=fmtDate(NOW).toUpperCase();bcDrawWeightLeanChart();bcRenderWeightHistory();if(!arr.length){document.getElementById('bc-results-card').style.display='none';document.getElementById('bc-chart-card').style.display='none';document.getElementById('bc-history-card').style.display='none';return;}const latest=arr[arr.length-1];document.getElementById('bc-results-card').style.display='';var _ra=document.getElementById('res-age');if(_ra)_ra.textContent=_bcAgeLabel(latest.date);document.getElementById('res-bf').textContent=latest.bf;const latestW=weights.length?weights[weights.length-1].weight:null;const latestBmi=latestW?Math.round(latestW/Math.pow(_hcm/100,2)*10)/10:null;const latestLean=latestW?Math.round(latestW*(1-latest.bf/100)*10)/10:null;document.getElementById('res-bmi').textContent=latestBmi?latestBmi.toFixed(1):'—';document.getElementById('res-weight').textContent=latestW?String(latestW):'—';document.getElementById('res-lean').textContent=latestLean?String(latestLean):'—';document.getElementById('res-neck-belly').textContent=((_bcEntryMethod(latest)!=='navy')?_bcEntryDetail(latest):('Neck '+latest.neck+' cm · Waist '+latest.belly+' cm'+(latest.hip?' · Hip '+latest.hip+' cm':'')))+(_bcPrecisionLabel(latest)?(' · '+_bcPrecisionLabel(latest)):'');document.getElementById('bc-chart-card').style.display='';document.getElementById('bc-entries-badge').textContent=arr.length+' entr'+(arr.length===1?'y':'ies');bcDrawBfChart(arr);const bmiData=arr.filter(e=>e.bmi);let bmiVals=bmiData.map(e=>e.bmi);let bmiLabels=bmiData.map(e=>_bcLabel(e));if(latestW&&arr.length){const lastDate=arr[arr.length-1].date;const todayKey=dateKey(NOW);if(todayKey>lastDate){const todayBmi=Math.round(latestW/Math.pow(_hcm/100,2)*10)/10;bmiVals=[...bmiVals,todayBmi];bmiLabels=[...bmiLabels,fmtDate(NOW)];}}if(bmiVals.length>=1)bcDrawChart('chart-bmi',bmiVals,bmiLabels,'#3cffa0','');document.getElementById('bc-history-card').style.display='';const list=document.getElementById('bc-history-list');list.innerHTML='';[...arr].reverse().forEach((e,i)=>{const row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);font-size:12px;';if(i===arr.length-1)row.style.borderBottom='none';const _g=_BC_GROUP[_bcMethodGroup(_bcEntryMethod(e))]||{color:'var(--muted2)'};const _pl=_bcPrecisionLabel(e);const _warn=_bcOutsideGoodRange(e);row.innerHTML=`<div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:${_g.color};flex-shrink:0"></span><div><div style="font-weight:500;color:var(--text)">${_bcLabel(e)}</div><div style="color:var(--muted2);margin-top:2px;">${_bcEntryDetail(e)}${_pl?' · '+_pl:''}${e.resolvedWeight?' · '+e.resolvedWeight+'kg':''}${_warn?' · <a href="'+BC_RANGE_HELP+'" target="_blank" rel="noopener" style="color:#f59e0b">outside this method\u2019s range</a>':''}${_bcEntryMethod(e)==='unknown'?_bcSetMethodHtml(e):''}</div></div></div><div style="display:flex;gap:12px;align-items:center;"><div style="text-align:center"><div style="font-family:var(--font-mono);font-size:20px;color:var(--accent2);line-height:1">${e.bf}%</div><div style="font-size:9px;color:var(--muted2);">BF</div></div>${e.lean!=null?`<div style="text-align:center"><div style="font-family:var(--font-mono);font-size:20px;color:var(--accent4);line-height:1">${e.lean}</div><div style="font-size:9px;color:var(--muted2);">lean kg</div></div>`:''}${e.bmi?`<div style="text-align:center"><div style="font-family:var(--font-mono);font-size:20px;color:var(--accent3);line-height:1">${e.bmi}</div><div style="font-size:9px;color:var(--muted2);">BMI</div></div>`:''}<button onclick="bcDeleteEntry('${e.date}')" style="background:none;border:none;color:var(--muted2);font-size:18px;cursor:pointer;padding:4px 6px;line-height:1;">✕</button></div>`;list.appendChild(row);});}
// The backend stores {date, bf} only — no dateLabel, because a display string is not
// data. syncBodyCompFromAgent rebuilds the list from the remote records, so any entry
// that has round-tripped comes back without one. Derive it from the date instead of
// depending on a field the source of truth does not carry; fall back to the raw date
// so a label is never null. (Fixed 2026-08-05: "null is not an object (evaluating
// 'labels[i].split')" — this threw inside syncBodyComp and took out the whole view.)
function _bcLabel(e){
  if(!e)return '';
  if(e.dateLabel)return e.dateLabel;
  try{ return (typeof fmtDate==='function'&&typeof parseLocalDate==='function')
    ? fmtDate(parseLocalDate(e.date)) : String(e.date||''); }
  catch(_e){ return String(e.date||''); }
}
function bcDrawChart(canvasId,values,labels,color,unit){const canvas=document.getElementById(canvasId);if(!canvas)return;const dpr=window.devicePixelRatio||1;const cssW=(canvas.style.width='100%',canvas.offsetWidth)||300;const cssH=120;canvas.width=cssW*dpr;canvas.height=cssH*dpr;canvas.style.width='100%';canvas.style.height=cssH+'px';const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);if(!values||values.length<1)return;const PAD={top:12,right:12,bottom:28,left:40};const cW=cssW-PAD.left-PAD.right;const cH=cssH-PAD.top-PAD.bottom;const minV=Math.min(...values);const maxV=Math.max(...values);const range=maxV-minV||1;const vMin=minV-range*0.15;const vMax=maxV+range*0.15;const xOf=i=>PAD.left+(values.length===1?cW/2:(i/(values.length-1))*cW);const yOf=v=>PAD.top+cH-((v-vMin)/(vMax-vMin))*cH;ctx.strokeStyle='#3A352B';ctx.lineWidth=0.5;for(let i=0;i<=3;i++){const y=PAD.top+(cH/3)*i;ctx.beginPath();ctx.moveTo(PAD.left,y);ctx.lineTo(PAD.left+cW,y);ctx.stroke();}ctx.fillStyle='#555';ctx.font='9px -apple-system,system-ui,sans-serif';ctx.textAlign='right';for(let i=0;i<=3;i++){const v=vMax-(vMax-vMin)*(i/3);const y=PAD.top+(cH/3)*i;ctx.fillText(v.toFixed(1)+(unit||''),PAD.left-4,y+3);}if(values.length===1){ctx.beginPath();ctx.arc(xOf(0),yOf(values[0]),4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();return;}const grad=ctx.createLinearGradient(0,PAD.top,0,PAD.top+cH);grad.addColorStop(0,color+'33');grad.addColorStop(1,color+'00');ctx.beginPath();ctx.moveTo(xOf(0),PAD.top+cH);values.forEach((v,i)=>ctx.lineTo(xOf(i),yOf(v)));ctx.lineTo(xOf(values.length-1),PAD.top+cH);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();ctx.moveTo(xOf(0),yOf(values[0]));values.forEach((v,i)=>{if(i>0)ctx.lineTo(xOf(i),yOf(v));});ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();values.forEach((v,i)=>{const x=xOf(i),y=yOf(v);ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fillStyle='#000000';ctx.fill();if(i===0||i===values.length-1||i%Math.max(1,Math.floor(values.length/4))===0){ctx.fillStyle='#555';ctx.font='9px -apple-system,system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(String(labels[i]||'').split(' ').slice(0,2).join(' '),x,PAD.top+cH+18);}});}
function bcDeleteEntry(date){const arr=bcLoad().filter(e=>e.date!==date);bcSave(arr);deleteBodyCompFromAgent(date);bcRender();}
function bcClearAll(){if(!confirm('Delete all logged entries?'))return;localStorage.removeItem(BC_KEY);bcRender();}
function initBodyComp(){
  var wi=document.getElementById('bc-weight-in');var hi=document.getElementById('bc-height-in');var ai=document.getElementById('bc-age-in');
  var sw=localStorage.getItem('user_weight');var sh=localStorage.getItem('user_height');var sa=localStorage.getItem('user_age');
  if(wi&&sw)wi.value=sw;if(hi&&sh)hi.value=sh;if(ai&&sa)ai.value=sa;setBioSex(localStorage.getItem('user_sex')||'male');weights=getData('weight_log',[]);syncWeightsFromAgent().then(()=>bcRender());syncBodyCompFromAgent();document.getElementById('bc-date-badge').textContent=fmtDate(NOW).toUpperCase();bcRender();var _bcPre=bcLoad();var _bcPreDates=new Set(_bcPre.map(function(e){return e.date;}));var _bcPreAll=[].concat(_bcPre);_bcPreAll.sort(function(a,b){return new Date(a.date.replace(/-/g,'/'))-new Date(b.date.replace(/-/g,'/'));});if(_bcPreAll.length){var _pl=_bcPreAll[_bcPreAll.length-1];var _pn=document.getElementById('bc-neck');var _pb=document.getElementById('bc-belly');var _ph=document.getElementById('bc-hip');if(_pn)_pn.value=_pl.neck;if(_pb)_pb.value=_pl.belly;if(_ph&&_pl.hip!=null)_ph.value=_pl.hip;}}

// Freshness label for the LATEST RESULTS card — stale data announces its age (PLASMA).
function _bcAgeLabel(dateStr,refDate){
  if(!dateStr)return '';
  var ref=refDate||NOW;var d=new Date(String(dateStr).replace(/-/g,'/'));
  if(isNaN(d.getTime()))return '';
  var a=new Date(ref);a.setHours(0,0,0,0);var b=new Date(d);b.setHours(0,0,0,0);
  var days=Math.round((a-b)/86400000);
  if(days<=0)return 'today';
  if(days===1)return '1d ago';
  if(days<60)return days+'d ago';
  return Math.round(days/30)+'mo ago';
}

/* ── CALIPER (skinfold) body-fat — validated equations, see backend docs/08 ── */
var _bcMethod='navy';     // 'navy' (tape) | 'caliper' (skinfold) | 'dexa' | 'ai'
// ── TWO METHODS THAT MEASURE NOTHING HERE ──────────────────────────────
// Henrik, 2026-09-18: "Adding BF% needs two new inputs, one is Dexa and one is AI image
// analysis" — and, on how the photos get read: "the instructions is take a few photos
// and upload to any chat bot, so the input is only a single field where the user enter
// BF %."
//
// So neither of these computes anything. Navy and caliper take raw measurements and run
// an equation over them; DEXA and AI take the finished percentage from somewhere else.
// That is why they share one section and one handler: the only thing that differs is
// which instructions to print and which name to store the entry under. Nothing in this
// file should ever grow an equation for them — if a number needs deriving, it was
// derived before it got here.
var _BC_METHODS=['navy','caliper','dexa','ai'];
// Which section a chip reveals. dexa and ai deliberately point at the same one.
var _BC_SECTION={navy:'bc-navy-section',caliper:'bc-caliper-section',
                 dexa:'bc-direct-section',ai:'bc-direct-section'};
var _BC_DIRECT_LABEL={dexa:'DEXA scan',ai:'AI photo estimate'};
var _BC_DIRECT_HELP={
  dexa:'Enter the body-fat percentage from your DEXA report. Lean mass is worked out from your logged weight, the same as every other method here.',
  ai:'Take a few photos — front, side and back, relaxed, in even light — and upload them to any chat assistant for a body-fat estimate. Enter the percentage it gives you here.'
};
var _bcCalMethod='jp3';   // 'jp3' | 'jp7' | 'dw4'
var _BC_SITE_LABEL={chest:'Chest',abdomen:'Abdomen',thigh:'Thigh',triceps:'Triceps',suprailiac:'Suprailiac',axilla:'Midaxillary',subscapular:'Subscapular',biceps:'Biceps'};
var _BC_CAL_LABEL={jp3:'Jackson-Pollock 3-site',jp7:'Jackson-Pollock 7-site',dw4:'Durnin-Womersley 4-site'};
// Durnin-Womersley Density=C-M*log10(sum4) coefficients, by sex and age band (upper bound inclusive)
var _DW_COEF={
  male:  [{max:19,C:1.1620,M:0.0630},{max:29,C:1.1631,M:0.0632},{max:39,C:1.1422,M:0.0544},{max:49,C:1.1620,M:0.0700},{max:200,C:1.1715,M:0.0779}],
  female:[{max:19,C:1.1549,M:0.0678},{max:29,C:1.1599,M:0.0717},{max:39,C:1.1423,M:0.0632},{max:49,C:1.1333,M:0.0612},{max:200,C:1.1339,M:0.0645}]
};
// Skinfold sites required for a given method+sex (JP3 differs by sex; JP7 & DW4 are the same for both)
function _bcCalSites(method,sex){
  if(method==='jp7')return['chest','axilla','triceps','subscapular','abdomen','suprailiac','thigh'];
  if(method==='dw4')return['biceps','triceps','subscapular','suprailiac'];
  return sex==='female'?['triceps','suprailiac','thigh']:['chest','abdomen','thigh'];
}
// Body density from the sum of skinfolds (mm). age in years.
function _bcBodyDensity(method,sex,age,sum){
  var s=sum,a=age,f=(sex==='female');
  if(method==='jp7')return f?(1.097-0.00046971*s+0.00000056*s*s-0.00012828*a):(1.112-0.00043499*s+0.00000055*s*s-0.00028826*a);
  if(method==='jp3')return f?(1.0994921-0.0009929*s+0.0000023*s*s-0.0001392*a):(1.10938-0.0008267*s+0.0000016*s*s-0.0002574*a);
  var tbl=_DW_COEF[f?'female':'male'];var row=null;for(var i=0;i<tbl.length;i++){if(a<=tbl[i].max){row=tbl[i];break;}}if(!row)row=tbl[tbl.length-1];
  return row.C-row.M*(Math.log(s)/Math.LN10);
}
// Siri (1961): BF% from body density
function _siriBF(bd){return 495/bd-450;}
// Full caliper BF% (0.1 rounded). vals = {site:mm}. Returns null on bad input.
function caliperBF(method,sex,age,vals){
  var sites=_bcCalSites(method,sex),sum=0;
  for(var i=0;i<sites.length;i++){var v=vals[sites[i]];if(!(v>0))return null;sum+=v;}
  var bd=_bcBodyDensity(method,sex,age,sum);if(!(bd>0))return null;
  var bf=_siriBF(bd);if(!isFinite(bf))return null;
  return Math.round(bf*10)/10;
}
// ⚠️ A ROW WITH NO METHOD IS ONLY A TAPE READING IF IT HAS TAPE NUMBERS.
// Henrik, 2026-11-23: "Bodyfat seems to assume all measurements are us navy". Rows stored
// before `method` existed are tape readings and carry neck and waist. Rows written as
// {date, bf} and nothing else (the shape Workout writes) are not: calling them tape gave
// them "Neck null · Waist null", the tape dot, the tape error bar and the tape range
// warning. Such a row is 'unknown' until the user says what it was (bcSetMethod).
function _bcEntryMethod(e){
  if(!e)return 'unknown';
  if(e.method)return e.method;
  return (e.neck>0&&e.belly>0)?'navy':'unknown';
}
var BC_METHOD_HELP='help.html#bf-method-unknown', BC_RANGE_HELP='help.html#bf-method-range';
// The picker a history row shows while its method is unknown. Only the two methods that
// are a finished percentage are offered: tape and calipers need their measurements.
function _bcSetMethodHtml(e){
  var h='<div style="margin-top:6px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px">'
    +'<select data-bc-set-method="'+e.date+'" onchange="bcSetMethod(\''+e.date+'\',this.value)" aria-label="Set how this reading was measured" style="font-size:16px;padding:8px 10px;border-radius:8px;border:1px solid var(--border-strong,var(--border));background:var(--surface2);color:var(--text);font-family:inherit">'
    +'<option value="">Set the method\u2026</option>';
  for(var k in _BC_DIRECT_LABEL)h+='<option value="'+k+'">'+_BC_DIRECT_LABEL[k]+'</option>';
  return h+'</select><a href="'+BC_METHOD_HELP+'" target="_blank" rel="noopener" style="font-size:15px;font-weight:700;color:var(--accent)">What this means</a></div>';
}
// Changes the one row in place: same date, same reading, now carrying its method.
function bcSetMethod(date,m){
  if(!_BC_DIRECT_LABEL[m])return;
  var arr=bcLoad(),e=null;
  for(var i=0;i<arr.length;i++){if(arr[i].date===date){e=arr[i];break;}}
  if(!e||_bcEntryMethod(e)!=='unknown')return;
  e.method=m;
  bcSave(arr);pushBodyCompToAgent(e);
  bcRender();
}
// One-line detail string for a stored entry (tape vs caliper), used in results + history
function _bcEntryDetail(e){
  var _m=_bcEntryMethod(e);
  if(e&&_m==='unknown')return _BC_GROUP.unknown.label;
  if(e&&_m!=='navy'){
    var lbl=_BC_CAL_LABEL[e.method]||_BC_DIRECT_LABEL[e.method]||e.method,sum=0;
    if(e.skinfolds){for(var k in e.skinfolds)sum+=(e.skinfolds[k]||0);}
    return lbl+(sum>0?' · Σ'+(Math.round(sum*10)/10)+'mm':'');
  }
  return 'Neck '+(e?e.neck:'')+' · Waist '+(e?e.belly:'')+((e&&e.hip)?' · Hip '+e.hip:'');
}
// ⚠️ DRIVEN OFF THE METHOD LIST, NOT OFF A PAIR OF NAMED VARIABLES.
// The two-method version named every chip and every section in its own body, so adding
// a third left the old chips lit and the old section open underneath the new one — the
// failure is silent and looks like a CSS bug. One list, and a new method is one entry.
function setBcMethod(m){
  _bcMethod=m;
  _BC_METHODS.forEach(function(k){
    var chip=document.getElementById('bc-method-'+k);
    if(chip)chip.classList.toggle('sel',k===m);
  });
  var want=_BC_SECTION[m];
  ['bc-navy-section','bc-caliper-section','bc-direct-section'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.style.display=(id===want)?'flex':'none';
  });
  var err=document.getElementById('bc-err');if(err)err.textContent='';
  if(m==='caliper')renderCaliperInputs();
  if(_BC_DIRECT_LABEL[m])renderDirectBfInputs();
}
// One field, because the measuring happened elsewhere. The instructions are the only
// part that differs between DEXA and an AI estimate.
function renderDirectBfInputs(){
  var host=document.getElementById('bc-direct-section');if(!host)return;
  var help=_BC_DIRECT_HELP[_bcMethod]||'';
  host.innerHTML='<div style="font-size:11px;color:var(--muted2);line-height:1.5">'+help+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:4px;"><label class="info-label">Body fat (%)</label>'
    +'<input id="bc-direct-bf" type="text" inputmode="decimal" placeholder="e.g. 14.2" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:16px;font-family:var(--font-ui);width:100%;outline:none;"></div>';
}
function setBcCalMethod(m){_bcCalMethod=m;renderCaliperInputs();}
function renderCaliperInputs(){
  var host=document.getElementById('bc-caliper-section');if(!host)return;
  var sex=localStorage.getItem('user_sex')||'male';
  var sites=_bcCalSites(_bcCalMethod,sex);
  var methods=[{id:'jp3',label:'JP 3-site'},{id:'jp7',label:'JP 7-site'},{id:'dw4',label:'DW 4-site'}];
  var h='<div style="display:flex;gap:6px">';
  methods.forEach(function(mm){var sel=_bcCalMethod===mm.id;h+='<div onclick="setBcCalMethod(\''+mm.id+'\')" class="time-chip'+(sel?' sel':'')+'" style="flex:1;text-align:center;font-size:11px;cursor:pointer;user-select:none;">'+mm.label+'</div>';});
  h+='</div>';
  h+='<div style="font-size:11px;color:var(--muted2);line-height:1.5">'+_BC_CAL_LABEL[_bcCalMethod]+' · '+sites.length+' sites (mm). Take each pinch on the right side of the body; read 1–2s after the caliper settles. Needs your age (set above).</div>';
  sites.forEach(function(site){
    h+='<div style="display:flex;flex-direction:column;gap:4px;"><label class="info-label">'+(_BC_SITE_LABEL[site]||site)+' (mm)</label><input id="bc-sf-'+site+'" type="text" inputmode="decimal" placeholder="e.g. 12.0" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:16px;font-family:var(--font-ui);width:100%;outline:none;"></div>';
  });
  host.innerHTML=h;
}
function bcLogDispatch(){
  if(_bcMethod==='caliper')bcLogCaliper();
  else if(_BC_DIRECT_LABEL[_bcMethod])bcLogDirect();
  else bcLog();
}
// ⚠️ THE METHOD IS STORED, AND IT IS NOT DECORATION.
// A DEXA percentage and a photo estimate are not the same measurement as a tape reading
// and are not the same as each other, so the entry has to carry which one it was or the
// series silently mixes them. _bcEntryDetail names it on every row and in Latest
// Results; the backend already keeps `method` for exactly this reason.
function bcLogDirect(){
  var err=document.getElementById('bc-err');if(err)err.textContent='';
  if(!_BC_DIRECT_LABEL[_bcMethod]){if(err)err.textContent='Pick a measurement method.';return;}
  var bf=parseVal('bc-direct-bf');
  if(bf===null){if(err)err.textContent='Enter the body-fat percentage.';return;}
  // The same band the tape and caliper results are held to, so one method cannot put a
  // value on the chart that another would have refused.
  if(!(bf>=3&&bf<=60)){if(err)err.textContent='Body fat out of range \u2014 enter a value between 3 and 60%.';return;}
  var entry={date:dateKey(NOW),dateLabel:fmtDate(NOW),bf:Math.round(bf*10)/10,method:_bcMethod};
  var arr=bcLoad(),idx=arr.findIndex(function(e){return e.date===entry.date;});
  if(idx!==-1)arr[idx]=entry;else arr.push(entry);
  arr.sort(function(a,b){return a.date.localeCompare(b.date);});
  bcSave(arr);pushBodyCompToAgent(entry);
  bcRender();
}
function bcLogCaliper(){
  var err=document.getElementById('bc-err');if(err)err.textContent='';
  var sex=localStorage.getItem('user_sex')||'male';
  var age=parseInt(localStorage.getItem('user_age')||'',10);
  if(!(age>=18&&age<=100)){var av=parseVal('bc-age-in');if(av!==null)age=Math.round(av);}
  if(!(age>=18&&age<=100)){if(err)err.textContent='Enter your age (18–100) in the field above — required for skinfold equations.';return;}
  var sites=_bcCalSites(_bcCalMethod,sex),vals={};
  for(var i=0;i<sites.length;i++){
    var v=parseVal('bc-sf-'+sites[i]);
    if(v===null||!(v>0&&v<100)){if(err)err.textContent='Enter '+(_BC_SITE_LABEL[sites[i]]||sites[i])+' (1–99 mm).';return;}
    vals[sites[i]]=Math.round(v*10)/10;
  }
  var bf=caliperBF(_bcCalMethod,sex,age,vals);
  if(bf===null||bf<3||bf>60){if(err)err.textContent='Result out of range — check measurements.';return;}
  var entry={date:dateKey(NOW),dateLabel:fmtDate(NOW),bf:bf,method:_bcCalMethod,skinfolds:vals};
  var arr=bcLoad(),idx=arr.findIndex(function(e){return e.date===entry.date;});
  if(idx!==-1)arr[idx]=entry;else arr.push(entry);
  arr.sort(function(a,b){return a.date.localeCompare(b.date);});
  bcSave(arr);pushBodyCompToAgent(entry);
  bcRender();
}

// ── ONE SERIES PER METHOD, AND THE ERROR BAR IS THE POINT ────────────────────
// Henrik, 2026-09-18: "The 4 different methods needs to be kept separate and preferably
// with some color flag or something to highlight different methods. Thing is dexa is the
// gold standard but expensive, us navy and caliper only give realistic values between
// 30-15% BF. AI is consistent but +/- 5% still the only realistic for a low budget high
// or low BF individual" — with a precision-vs-body-fat chart attached.
//
// Until now every entry went into one line in one colour, so a DEXA scan and a tape
// reading taken a week apart drew a step that looked like a change in the body. It was a
// change of instrument. Worse, the size of that artefact is not constant: the tape and
// the calipers are at their best around 20% and fall apart at both ends, which is exactly
// where someone lean or someone heavy is actually standing.
//
// So: a series per method, and every point carries the margin of error its method has AT
// THAT BODY FAT. The whisker is not decoration — it is the difference between "I gained
// 2%" and "I changed instrument".
//
// ── WHERE THESE NUMBERS COME FROM ───────────────────────────────
// The anchors are points on Henrik's precision-vs-body-fat chart. They were read off the
// image by eye when this shipped, which is a poor footing for an error bar — it is a
// claim about how much to trust a number, so it should not itself be a claim read off a
// picture. He supplied the text the chart was drawn from on 2026-09-18; it is kept
// verbatim in docs/bodyfat-measurement-uncertainty.md and the anchors were reconciled
// against it.
//
// ⚠️ THE DOCUMENT GIVES A FLAT SEE PER METHOD AND THAT IS NOT WHAT THIS TABLE IS.
// A Standard Error of Estimate is one central figure for a method; this table is body-fat
// DEPENDENT, which is the entire point of it — the tape and the calipers are at their
// best around 20% and fall apart at both ends, which is exactly where a lean or a heavy
// person is standing. Section 3 of that document gives the MECHANISM for the dependence
// (the Taylor expansion on C_A − C_N for the tape, the fixed subcutaneous-fat-ratio
// assumption for the calipers), not a replacement for the curve. So an anchor is only
// wrong when it falls OUTSIDE the documented envelope, and the two that did — both at the
// far left edge, where a pixel read is least reliable — were brought back to it:
// navy@40 4.7→4.5, ai@40 4.8→4.5.
//
// The caliper curve reaching 6.9 at 5% BF is NOT out of bounds. The flat SEE for a
// skilled tester is 3.0-4.0, but > 5.0 is documented for a tester working outside their
// competence — which, at 5% body fat, describes almost everyone holding a caliper.
var _BC_PRECISION={
  // Flat: a DEXA scan does not care where you are on the range. Legend on the source
  // chart reads 1.5-2%; the plotted line sits at 1.5.
  dexa:   [[3,1.5],[60,1.5]],
  navy:   [[5,4.3],[7,4.1],[10,3.9],[12,3.8],[15,3.6],[20,3.5],[25,3.6],[30,3.9],[35,4.2],[40,4.5]],
  caliper:[[5,6.9],[7,6.0],[10,5.0],[12,4.4],[15,3.9],[20,3.6],[25,3.8],[30,4.3],[35,4.8],[40,5.6]],
  ai:     [[5,4.2],[7,4.1],[10,3.9],[12,3.8],[15,3.7],[20,3.6],[25,3.8],[30,4.1],[35,4.4],[40,4.5]]
};
// The flat Standard Error of Estimate each method is DOCUMENTED at, with the model it
// comes from. This is what the app can honestly say about a method in general, where
// _BC_PRECISION is what one reading gets its error bar from. Kept as data rather than
// prose so the curve can be checked against it (see the test) instead of the bound
// living only in a comment nobody re-reads.
// Source: docs/bodyfat-measurement-uncertainty.md §3.
var _BC_SEE={
  dexa:   {lo:1.2, hi:2.5, model:'3-compartment X-ray attenuation (Beer-Lambert)',
           refs:['Pietrobelli 1996, Am J Physiol Endocrinol Metab 271(6):E941',
                 'Toombs 2012, Eur J Clin Nutr 66(1):115']},
  navy:   {lo:3.5, hi:4.5, model:'Circumference geometry → Siri',
           refs:['Hodgdon & Beckett 1984, NAVHLTHRESCEN 84-29',
                 'Siri 1961, Tech Meas Body Comp 61:223']},
  // 3.0-4.0 skilled; > 5.0 untrained, which is why the curve is allowed past the ceiling
  // at the ends where the method's own assumptions break down.
  caliper:{lo:3.0, hi:5.0, model:'Skinfold sum → Jackson-Pollock → Brožek',
           refs:['Jackson & Pollock 1978, Br J Nutr 40(3):497',
                 'Lohman 1981, Hum Biol 53:181']},
  ai:     {lo:2.5, hi:4.5, model:'Convolutional regression / SMPL mesh volume',
           refs:['Majmudar 2020, NPJ Digit Med 3(1):1',
                 'Loper 2015, ACM Trans Graph 34(6):1']}
};
// ⚠️ THE STORED METHOD IS NOT THE SERIES. Three caliper equations are all "the calipers"
// as far as precision and colour go, and an entry saved before `method` existed is a tape
// reading. Grouping in one place keeps every consumer — chart, legend, history, results —
// agreeing on which of the four a row belongs to.
function _bcMethodGroup(m){
  // ⚠️ IDEMPOTENT ON PURPOSE. The stored caliper methods are jp3/jp7/dw4 — the string
  // 'caliper' is a GROUP key and never a stored value, so without this line feeding a
  // group key back in silently returned 'navy' and a caliper series turned blue.
  if(_BC_GROUP[m])return m;
  if(m==='jp3'||m==='jp7'||m==='dw4')return 'caliper';
  return 'navy';
}
// Colours are the app's own accent tokens, deliberately: DEXA green (the one you trust),
// tape blue, calipers orange, AI purple. They are brighter than a general-purpose chart
// palette wants — this app is neon on pure black and every other chart in it already
// reads that way — so identity is never left to colour alone: each series also has its
// own marker shape and a named legend entry.
var _BC_GROUP={
  navy:   {label:'Tape (Navy)',       color:'#3b9eff', shape:'circle',  good:[15,30]},
  caliper:{label:'Caliper',           color:'#ff6b2b', shape:'square',  good:[15,30]},
  dexa:   {label:'DEXA',              color:'#3cffa0', shape:'diamond', good:null},
  ai:     {label:'AI photo estimate', color:'#c084fc', shape:'triangle',good:null},
  // Not a method: the rows nobody has named yet (_bcEntryMethod). No range and no entry
  // in _BC_PRECISION, because an error bar belongs to an instrument.
  unknown:{label:'Method not recorded',color:'#e6e6e6', shape:'circle',  good:null}
};
var _BC_GROUP_ORDER=['navy','caliper','dexa','ai','unknown'];
// Margin of error for one reading, in absolute BF percentage points.
function _bcPrecision(method,bf){
  var tbl=_BC_PRECISION[_bcMethodGroup(method)];
  if(!tbl||!tbl.length||!(bf>0))return null;
  if(bf<=tbl[0][0])return tbl[0][1];
  if(bf>=tbl[tbl.length-1][0])return tbl[tbl.length-1][1];
  for(var i=1;i<tbl.length;i++){
    if(bf<=tbl[i][0]){
      var a=tbl[i-1],b=tbl[i],t=(bf-a[0])/(b[0]-a[0]);
      return Math.round((a[1]+t*(b[1]-a[1]))*10)/10;
    }
  }
  return tbl[tbl.length-1][1];
}
// "± 3.6%" for a row, or '' when the method is unknown.
function _bcPrecisionLabel(e){
  if(!e)return '';
  var p=_bcPrecision(_bcEntryMethod(e),e.bf);
  return (p===null)?'':('±'+p.toFixed(1)+'%');
}
// Is this reading inside the range its method is actually good for? Only the tape and
// the calipers have one — they are the two that fall apart at both ends.
function _bcOutsideGoodRange(e){
  if(!e)return false;
  var g=_BC_GROUP[_bcMethodGroup(_bcEntryMethod(e))];
  if(!g||!g.good)return false;
  return !(e.bf>=g.good[0]&&e.bf<=g.good[1]);
}
function _bcMarker(ctx,shape,x,y,r){
  ctx.beginPath();
  if(shape==='square'){ctx.rect(x-r,y-r,r*2,r*2);}
  else if(shape==='diamond'){ctx.moveTo(x,y-r*1.25);ctx.lineTo(x+r*1.25,y);ctx.lineTo(x,y+r*1.25);ctx.lineTo(x-r*1.25,y);ctx.closePath();}
  else if(shape==='triangle'){ctx.moveTo(x,y-r*1.3);ctx.lineTo(x+r*1.2,y+r);ctx.lineTo(x-r*1.2,y+r);ctx.closePath();}
  else {ctx.arc(x,y,r,0,Math.PI*2);}
}
// ⚠️ THE X AXIS HAS TO BE TIME, NOT THE ROW NUMBER.
// The single-series chart spaced points by index, which is harmless while there is one
// line. With four, index spacing puts each series on its own private axis — a DEXA scan
// and a tape reading from the same morning land in different places, and the lines cross
// where nothing crossed.
function bcDrawBfChart(entries){
  var canvas=document.getElementById('chart-bf');if(!canvas)return;
  var legend=document.getElementById('bc-bf-legend');
  var dpr=window.devicePixelRatio||1, cssW=(canvas.style.width='100%',canvas.offsetWidth)||300, cssH=120;
  canvas.width=cssW*dpr;canvas.height=cssH*dpr;canvas.style.width='100%';canvas.style.height=cssH+'px';
  var ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  var rows=(entries||[]).filter(function(e){return e&&e.bf>0;});
  if(legend)legend.innerHTML='';
  if(!rows.length)return;
  var SURFACE='#15130F';
  var PAD={top:12,right:12,bottom:28,left:40};
  var cW=cssW-PAD.left-PAD.right, cH=cssH-PAD.top-PAD.bottom;
  var tOf=function(e){var d=new Date(String(e.date).replace(/-/g,'/'));return d.getTime();};
  var ts=rows.map(tOf), tMin=Math.min.apply(null,ts), tMax=Math.max.apply(null,ts);
  var tSpan=(tMax-tMin)||1;
  var xOf=function(t){return (tMax===tMin)?(PAD.left+cW/2):(PAD.left+((t-tMin)/tSpan)*cW);};
  // The band has to hold the whiskers, or an error bar is clipped and reads as a smaller
  // uncertainty than it is.
  var los=[],his=[];
  rows.forEach(function(e){var p=_bcPrecision(_bcEntryMethod(e),e.bf)||0;los.push(e.bf-p);his.push(e.bf+p);});
  var minV=Math.min.apply(null,los), maxV=Math.max.apply(null,his), range=(maxV-minV)||1;
  var vMin=minV-range*0.12, vMax=maxV+range*0.12;
  var yOf=function(v){return PAD.top+cH-((v-vMin)/(vMax-vMin))*cH;};
  ctx.strokeStyle='#3A352B';ctx.lineWidth=0.5;
  for(var g=0;g<=3;g++){var gy=PAD.top+(cH/3)*g;ctx.beginPath();ctx.moveTo(PAD.left,gy);ctx.lineTo(PAD.left+cW,gy);ctx.stroke();}
  ctx.fillStyle='#555';ctx.font='9px -apple-system,system-ui,sans-serif';ctx.textAlign='right';
  for(var gi=0;gi<=3;gi++){var vv=vMax-(vMax-vMin)*(gi/3);ctx.fillText(vv.toFixed(1)+'%',PAD.left-4,PAD.top+(cH/3)*gi+3);}
  var groups={};
  rows.forEach(function(e){var k=_bcMethodGroup(_bcEntryMethod(e));(groups[k]=groups[k]||[]).push(e);});
  var present=_BC_GROUP_ORDER.filter(function(k){return groups[k]&&groups[k].length;});
  present.forEach(function(k){
    var meta=_BC_GROUP[k], pts=groups[k].slice().sort(function(a,b){return tOf(a)-tOf(b);});
    // Whiskers first, so the marks sit on top of their own uncertainty.
    ctx.strokeStyle=meta.color+'66';ctx.lineWidth=2;ctx.lineCap='butt';
    pts.forEach(function(e){
      var p=_bcPrecision(_bcEntryMethod(e),e.bf);if(!(p>0))return;
      var x=xOf(tOf(e)), y1=yOf(e.bf-p), y2=yOf(e.bf+p);
      ctx.beginPath();ctx.moveTo(x,y1);ctx.lineTo(x,y2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-3,y1);ctx.lineTo(x+3,y1);ctx.moveTo(x-3,y2);ctx.lineTo(x+3,y2);ctx.stroke();
    });
    if(pts.length>1){
      ctx.beginPath();ctx.moveTo(xOf(tOf(pts[0])),yOf(pts[0].bf));
      for(var i=1;i<pts.length;i++)ctx.lineTo(xOf(tOf(pts[i])),yOf(pts[i].bf));
      ctx.strokeStyle=meta.color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
    }
    pts.forEach(function(e){
      var x=xOf(tOf(e)), y=yOf(e.bf);
      _bcMarker(ctx,meta.shape,x,y,4);
      ctx.fillStyle=meta.color;ctx.fill();
      ctx.strokeStyle=SURFACE;ctx.lineWidth=2;ctx.stroke();
    });
  });
  // Date ticks come off the pooled timeline, not off any one series.
  var byTime=rows.slice().sort(function(a,b){return tOf(a)-tOf(b);});
  ctx.fillStyle='#555';ctx.font='9px -apple-system,system-ui,sans-serif';ctx.textAlign='center';
  var step=Math.max(1,Math.floor(byTime.length/4));
  byTime.forEach(function(e,i){
    if(i!==0&&i!==byTime.length-1&&i%step!==0)return;
    ctx.fillText(String(_bcLabel(e)||'').split(' ').slice(0,2).join(' '),xOf(tOf(e)),PAD.top+cH+18);
  });
  // ⚠️ A LEGEND, ALWAYS, ONCE THERE IS MORE THAN ONE SERIES. Four colours on a 120px
  // canvas is not self-explanatory, and the shapes only pay off if something names them.
  if(legend){
    legend.innerHTML=present.map(function(k){
      var meta=_BC_GROUP[k];
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--muted2)">'
        +'<span style="width:8px;height:8px;background:'+meta.color+';border-radius:'+(meta.shape==='square'?'2px':'50%')+';flex-shrink:0"></span>'
        +meta.label+' ('+groups[k].length+')</span>';
    }).join('');
  }
}

// ── Profile (Henrik, 2026-11-16: "make the same Profile changes in peptide tracker", after the Workout Profile work of
// 2026-11-14). The header's Profile button opens this tab (PRIMARY_GROUPS.profile = ['body']); it holds the profile, the
// measurement log, results, trends and history it always had. The profile inputs at the top are now one card: the
// details (sex, age, height, latest weight, BMI, body fat, lean mass) with Log weight and Edit profile. Edit profile edits
// in place ("Edit profile should not open the onboarding but just make all fields in Profile view editable, the Edit
// button becomes a Save button, and Log weight a Cancel button"). Body fat is not edited here: it is logged with a
// measurement method below, so the trends never mix instruments without saying so.
var _pfEdit=null,_pfEditErr='',_pfLogW=false,PROFILE_HELP='help.html#profile-invalid';
function _pfLatestBf(){var a=bcLoad();return a.length?a[a.length-1]:null;}
function _pfLatest(){var h=parseFloat(localStorage.getItem('user_height')||'')||null,w=(weights&&weights.length)?weights[weights.length-1].weight:(parseFloat(localStorage.getItem('user_weight')||'')||null);
  var b=_pfLatestBf();return{sex:localStorage.getItem('user_sex')||'',age:parseInt(localStorage.getItem('user_age')||'',10)||null,height:h,weight:w,
    bmi:(w&&h)?Math.round(w/Math.pow(h/100,2)*10)/10:null,bf:b?b.bf:null,lean:(w&&b)?Math.round(w*(1-b.bf/100)*10)/10:null};}
function _pfEsc(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _pfInfoHtml(){var L=_pfLatest(),T='font-size:15px;color:var(--text);',E=_pfEdit;
  var row=function(k,v){return'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);'+T+'"><span>'+k+'</span><span style="font-weight:700;min-width:0">'+v+'</span></div>';};
  var field=function(id,val,suffix){return'<span style="display:inline-flex;align-items:center;gap:6px"><input id="'+id+'" type="text" inputmode="decimal" value="'+(val==null?'':_pfEsc(val))+'" style="width:84px;text-align:right;font-size:16px;font-weight:700;padding:8px 10px;color:var(--text);background:var(--surface2);border:1px solid var(--border-strong,var(--border));border-radius:8px;font-family:inherit;outline:none">'+suffix+'</span>';};
  var btn=function(attr,click,label,primary){return'<button '+attr+' onclick="'+click+'" style="flex:1;padding:12px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;'+(primary?'background:var(--accent);color:#000;border:1px solid var(--accent);':'background:var(--surface2);color:var(--text);border:1px solid var(--border-strong,var(--border));')+'">'+label+'</button>';};
  var chip=function(g,label){var on=E&&E.sex===g;return'<button data-pf-sex="'+g+'" onclick="pfEditSex(\''+g+'\')" style="padding:8px 14px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;background:'+(on?'var(--accent)':'var(--surface2)')+';color:'+(on?'#000':'var(--text)')+';border:1px solid '+(on?'var(--accent)':'var(--border)')+'">'+label+'</button>';};
  var h='<div class="card" style="padding:16px;"><div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px;">Your profile</div>';
  if(E){h+=row('Sex','<span style="display:inline-flex;gap:6px">'+chip('male','Male')+chip('female','Female')+'</span>')+row('Age',field('pf-e-age',E.age,'yrs'))+row('Height',field('pf-e-height',E.height,'cm'))
      +row('Weight',field('pf-e-weight',E.weight,'kg'))+row('BMI',L.bmi?L.bmi.toFixed(1):'—')+row('Body fat',L.bf!=null?L.bf+' %':'—')+row('Lean mass',L.lean?L.lean+' kg':'—');
    if(_pfEditErr)h+='<div data-pf-edit-err="1" style="'+T+'line-height:1.5;margin-top:10px;padding:10px;border:1px solid var(--danger,#ff3b30);border-radius:10px;"><b>'+_pfEsc(_pfEditErr)+'</b> <a href="'+PROFILE_HELP+'" target="_blank" rel="noopener" style="color:var(--accent);font-weight:700">What this means and how to fix it</a></div>';
    return h+'<div style="display:flex;gap:10px;margin-top:14px;">'+btn('data-pf-cancel="1"','pfEditCancel()','Cancel',false)+btn('data-pf-save="1"','pfEditSave()','Save',true)+'</div></div>';}
  h+=row('Sex',L.sex?(L.sex==='female'?'Female':'Male'):'—')+row('Age',L.age?L.age+' yrs':'—')+row('Height',L.height?L.height+' cm':'—')
    +row('Weight',L.weight?L.weight+' kg':'—')+row('BMI',L.bmi?L.bmi.toFixed(1):'—')+row('Body fat',L.bf!=null?L.bf+' %':'—')+row('Lean mass',L.lean?L.lean+' kg':'—');
  if(_pfLogW)h+='<div data-pf-logw="1" style="display:flex;gap:8px;margin-top:14px;align-items:stretch"><input id="bc-weight-in" type="text" inputmode="decimal" placeholder="Today\'s weight, kg" style="flex:1;min-width:0;font-size:16px;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;outline:none">'
    +'<button onclick="pfLogWeightSave()" style="flex-shrink:0;padding:10px 16px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#000;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">Save</button></div>';
  return h+'<div style="display:flex;gap:10px;margin-top:14px;">'+btn('data-pf-weight="1"','pfLogWeight()','Log weight',true)+btn('data-pf-edit="1"','pfEditStart()','Edit profile',false)+'</div></div>';}
function _pfRenderInfo(){var el=document.getElementById('pf-info');if(el)el.innerHTML=_pfInfoHtml();}
function pfLogWeight(){_pfLogW=!_pfLogW;_pfRenderInfo();}
function pfLogWeightSave(){saveBodyMeasurement('weight');_pfLogW=false;_pfRenderInfo();}
function pfEditStart(){var L=_pfLatest();_pfEdit={sex:L.sex||'',age:L.age,height:L.height,weight:L.weight};_pfEditErr='';_pfLogW=false;_pfRenderInfo();}
function pfEditCancel(){_pfEdit=null;_pfEditErr='';_pfRenderInfo();}
function _pfKeepTyped(){if(!_pfEdit)return;[['age','pf-e-age'],['height','pf-e-height'],['weight','pf-e-weight']].forEach(function(f){var e=document.getElementById(f[1]);if(e)_pfEdit[f[0]]=e.value;});}
function pfEditSex(g){if(!_pfEdit)return;_pfKeepTyped();_pfEdit.sex=g;_pfRenderInfo();}
function pfEditSave(){if(!_pfEdit)return;var v=function(id){var e=document.getElementById(id);var t=e?String(e.value||'').trim():'';return t===''?null:parseDec(t);};
  var age=v('pf-e-age'),h=v('pf-e-height'),w=v('pf-e-weight');_pfEditErr='';
  if(!_pfEdit.sex)_pfEditErr='Choose Male or Female.';
  else if(age!=null&&!(age>=13&&age<=100))_pfEditErr='Type your age in years, between 13 and 100.';
  else if(h!=null&&!(h>=100&&h<=250))_pfEditErr='Type your height in cm, between 100 and 250.';
  else if(w!=null&&!(w>=20&&w<=300))_pfEditErr='Type your weight in kg, between 20 and 300.';
  if(_pfEditErr){_pfKeepTyped();_pfRenderInfo();return;}
  var L=_pfLatest(),kv={user_sex:_pfEdit.sex};
  localStorage.setItem('user_sex',_pfEdit.sex);
  if(age!=null){age=Math.round(age);localStorage.setItem('user_age',String(age));kv.user_age=age;}
  if(h!=null){localStorage.setItem('user_height',String(h));kv.user_height=h;}
  if(w!=null&&(L.weight==null||Math.abs(w-L.weight)>=0.05)){w=Math.round(w*10)/10;var today=dateKey(NOW);saveUserWeight(w);var i=weights.findIndex(function(x){return x.date===today;});if(i!==-1)weights[i].weight=w;else weights.push({date:today,weight:w});
    weights.sort(function(a,b){return a.date.localeCompare(b.date);});setData('weight_log',weights);pushWeightToAgent(today,w);}
  var p=getData('pep-profile',{})||{};p.sex=_pfEdit.sex;if(age!=null)p.age=age;if(h!=null)p.height=h;if(w!=null)p.weight=w;setData('pep-profile',p);kv['pep-profile']=p;
  pushPepSettingsToAgent(kv);_pfEdit=null;if(typeof setBioSex==='function')setBioSex(localStorage.getItem('user_sex')||'male');bcRender();}
// Macro adherence over time (Workout's Profile has the same card): each logged day's kcal, protein, carbs and fat as % of
// that day's goals, from GET /food-log/stats `series`.
var PF_MACROS=[['kcal','Kcal','#e8ff3c'],['protein','Protein','#4fc3f7'],['carbs','Carbs','#ffb74d'],['fat','Fat','#f48fb1']];
function _pfMacroHtml(s){var T='font-size:15px;color:var(--text);line-height:1.5;';
  var h='<div class="card" style="padding:16px;"><div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:4px;">Macro adherence</div>';
  if(!s||!(s.series||[]).length)return h+'<div data-pf-macro-empty="1" style="'+T+'">Shows once you have logged food on days with goals set. Log food and set your goals in Macros.</div></div>';
  h+='<div style="'+T+'margin-bottom:10px;">Each day as % of that day\'s goals, '+_pfEsc(s.from)+' to '+_pfEsc(s.to)+'. The line at 100 % is on target.</div><canvas id="pfMacroChart" height="160" style="width:100%;display:block;"></canvas>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;">'+PF_MACROS.filter(function(m){return s.metrics&&s.metrics[m[0]];}).map(function(m){return'<span data-pf-macro="'+m[0]+'" style="'+T+'"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:'+m[2]+';margin-right:6px;vertical-align:-1px"></span>'+m[1]+' '+Math.round(s.metrics[m[0]].avg)+' % avg</span>';}).join('')+'</div>';
  return h+'</div>';}
function _pfDrawMacroChart(s){var c=document.getElementById('pfMacroChart');if(!c||!c.getContext||!s||!(s.series||[]).length)return;var ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,W=(c.style.width='100%',c.offsetWidth)||300,H=160;
  c.width=W*dpr;c.height=H*dpr;c.style.width='100%';c.style.height=H+'px';ctx.scale(dpr,dpr);
  var pts=s.series,max=150;pts.forEach(function(p){PF_MACROS.forEach(function(m){if(p[m[0]]>max)max=p[m[0]];});});max=Math.ceil(max/50)*50;
  var L=34,R=8,Tp=8,B=18,x=function(i){return L+(pts.length<2?(W-L-R)/2:i*(W-L-R)/(pts.length-1));},y=function(v){return Tp+(1-v/max)*(H-Tp-B);};
  var txt=(getComputedStyle(document.body).getPropertyValue('--text')||'#fff').trim()||'#fff';ctx.font='12px sans-serif';ctx.fillStyle=txt;ctx.strokeStyle='rgba(255,255,255,0.15)';
  [0,50,100,150,200,250,300].filter(function(v){return v<=max;}).forEach(function(v){ctx.beginPath();ctx.moveTo(L,y(v));ctx.lineTo(W-R,y(v));ctx.stroke();ctx.fillText(v+'%',2,y(v)+4);});
  ctx.setLineDash([5,4]);ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.beginPath();ctx.moveTo(L,y(100));ctx.lineTo(W-R,y(100));ctx.stroke();ctx.setLineDash([]);
  PF_MACROS.forEach(function(m){ctx.strokeStyle=m[2];ctx.fillStyle=m[2];ctx.lineWidth=2;ctx.beginPath();var on=false;pts.forEach(function(p,i){var v=p[m[0]];if(v==null){on=false;return;}if(on)ctx.lineTo(x(i),y(v));else{ctx.moveTo(x(i),y(v));on=true;}});ctx.stroke();
    pts.forEach(function(p,i){var v=p[m[0]];if(v!=null){ctx.beginPath();ctx.arc(x(i),y(v),2.5,0,Math.PI*2);ctx.fill();}});});ctx.lineWidth=1;
  ctx.fillStyle=txt;ctx.fillText(pts[0].date.slice(5),L,H-4);var e=pts[pts.length-1].date.slice(5);ctx.fillText(e,W-R-ctx.measureText(e).width,H-4);}
async function _pfRenderMacros(){var el=document.getElementById('pf-macros');if(!el)return;if(typeof _flLoadStats==='function')await _flLoadStats();el.innerHTML=_pfMacroHtml(typeof _flStats!=='undefined'?_flStats:null);_pfDrawMacroChart(typeof _flStats!=='undefined'?_flStats:null);}
