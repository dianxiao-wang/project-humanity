const $=id=>document.getElementById(id);
const pacificTimeZone='America/Vancouver';
const pacificDate=(value,options={})=>new Intl.DateTimeFormat('en-US',{timeZone:pacificTimeZone,month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,...options}).format(new Date(value));
const pacificParts=value=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:pacificTimeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
function pacificInstant(year,month,day,hour){
  const localAsUtc=Date.UTC(year,month-1,day,hour);
  let guess=new Date(localAsUtc);
  for(let i=0;i<2;i++){const p=pacificParts(guess),represented=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);guess=new Date(localAsUtc-(represented-guess.getTime()));}
  return guess;
}
function nextPacificStart(now){
  const p=pacificParts(now),candidates=[];
  for(let dayOffset=0;dayOffset<3;dayOffset++)for(const hour of [8])candidates.push(pacificInstant(p.year,p.month,p.day+dayOffset,hour));
  return candidates.filter(date=>date>now).sort((a,b)=>a-b)[0];
}
let snapshot=null;
let currentDays=7;
function tick(){
  const now=new Date();
  $('clock').textContent=pacificDate(now,{month:undefined,day:undefined,second:'2-digit'})+' PT';
  const remaining=Math.max(0,Math.floor((new Date(snapshot?.deadline||'2036-12-31T23:59:59Z')-now)/1000));
  $('count-days').textContent=Math.floor(remaining/86400).toLocaleString('en-US');
  $('count-hours').textContent=String(Math.floor(remaining/3600)%24).padStart(2,'0');
  $('count-minutes').textContent=String(Math.floor(remaining/60)%60).padStart(2,'0');
  $('count-seconds').textContent=String(remaining%60).padStart(2,'0');
  if(snapshot)$('next').textContent=snapshot.scheduleActive?pacificDate(nextPacificStart(now))+' PT':'Not scheduled';
}
function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function safeUrl(value){const u=new URL(value);if(u.protocol!=='https:')throw new Error('Invalid source URL');return u.href;}
const svgNS='http://www.w3.org/2000/svg';
const svg=(tag,attributes={})=>{const el=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(attributes))el.setAttribute(key,String(value));return el;};
const percent=value=>(value*100).toFixed(1)+'%';
const points=value=>(value>0?'+':value<0?'−':'')+Math.abs(value*100).toFixed(1)+' pts';
const sortedHistory=()=>(snapshot?.history||[]).filter(p=>Number.isFinite(p.probability)&&Number.isFinite(Date.parse(p.at))).sort((a,b)=>new Date(a.at)-new Date(b.at));
const sourceDate=value=>{const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(d):value;};

// 100-square odds grid: one square per 1-in-100 chance, the last one partly filled.
function buildGrid(){const grid=$('odds-grid');grid.replaceChildren(...Array.from({length:100},()=>text('span','','cell')));}
function renderGrid(p){
  const grid=$('odds-grid'),value=Math.min(100,Math.max(0,p*100)),full=Math.floor(value+1e-9),part=value-full;
  [...grid.children].forEach((cell,i)=>{cell.className='cell'+(i<full?' filled':i===full&&part>0.001?' partial':'');cell.style.setProperty('--i',i);if(i===full)cell.style.setProperty('--fill',(part*100).toFixed(1)+'%');});
  grid.setAttribute('aria-label',value.toFixed(1)+' out of 100 squares filled');
  $('odds-caption').textContent=value.toFixed(1)+' in 100 · each square is a 1-in-100 chance';
  requestAnimationFrame(()=>grid.classList.add('ready'));
}

function niceStep(span){for(const s of [.1,.2,.25,.5,1,2,2.5,5,10,20,25])if(span/s<=4)return s;return 25;}
function renderHistory(days){
  currentDays=days;
  const chart=$('history-chart'),tooltip=$('chart-tooltip'),frame=chart.parentElement;chart.replaceChildren();tooltip.hidden=true;
  const W=Math.max(280,Math.round(frame.clientWidth||1000)),H=W<600?240:320;chart.setAttribute('viewBox',`0 0 ${W} ${H}`);
  document.querySelectorAll('.range-button').forEach(button=>{const active=Number(button.dataset.days)===days;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  const end=new Date(snapshot.publishedAt),start=new Date(end-days*86400000);
  const pts=sortedHistory().filter(p=>new Date(p.at)>=start&&new Date(p.at)<=end);
  const setReadout=(id,value,cls='')=>{$(id).textContent=value;$(id).className=cls;};
  if(!pts.length){['history-change','history-low','history-high'].forEach(id=>setReadout(id,'—'));$('history-summary').textContent='No estimates were recorded in the selected period.';const empty=svg('text',{x:W/2,y:H/2,class:'chart-empty'});empty.textContent='No estimates recorded in this range yet.';chart.append(empty);return;}
  const values=pts.map(p=>p.probability*100),low=Math.min(...values),high=Math.max(...values),change=pts.at(-1).probability-pts[0].probability;
  setReadout('history-change',pts.length>1?points(change):'—',change>0.0005?'rise':change<-0.0005?'fall':'');
  setReadout('history-low',low.toFixed(1)+'%');setReadout('history-high',high.toFixed(1)+'%');

  const m={top:18,right:14,bottom:34,left:48},innerW=W-m.left-m.right,innerH=H-m.top-m.bottom;
  const pad=Math.max(.4,(high-low)*.25),step=niceStep(high-low+2*pad);
  const minY=Math.max(0,Math.floor((low-pad)/step)*step),maxY=Math.min(100,Math.ceil((high+pad)/step)*step),rangeY=maxY-minY||1;
  const t0=+new Date(pts[0].at),t1=+new Date(pts.at(-1).at),rangeX=Math.max(1,t1-t0);
  const x=p=>pts.length===1?m.left+innerW/2:m.left+((+new Date(p.at)-t0)/rangeX)*innerW;
  const y=p=>m.top+(1-(p.probability*100-minY)/rangeY)*innerH;
  const decimals=step<1?(step<.5?1:1):0;
  for(let v=minY;v<=maxY+1e-9;v+=step){const gy=m.top+(1-(v-minY)/rangeY)*innerH;chart.append(svg('line',{x1:m.left,y1:gy,x2:W-m.right,y2:gy,class:'chart-grid'}));const label=svg('text',{x:m.left-10,y:gy+4,class:'chart-axis','text-anchor':'end'});label.textContent=v.toFixed(decimals)+'%';chart.append(label);}
  const shortSpan=rangeX<2*86400000;
  const axisFormat=new Intl.DateTimeFormat('en-US',{timeZone:pacificTimeZone,month:'short',day:'numeric',...(shortSpan?{hour:'2-digit',minute:'2-digit',hour12:false}:{})});
  const timeFormat=new Intl.DateTimeFormat('en-US',{timeZone:pacificTimeZone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  (pts.length===1?[pts[0]]:[pts[0],pts.at(-1)]).forEach((p,i,arr)=>{const label=svg('text',{x:arr.length===1?m.left+innerW/2:i?W-m.right:m.left,y:H-10,class:'chart-axis','text-anchor':arr.length===1?'middle':i?'end':'start'});label.textContent=axisFormat.format(new Date(p.at));chart.append(label);});

  const coords=pts.map(p=>[x(p),y(p)]),line=coords.map((c,i)=>(i?'L':'M')+c[0].toFixed(1)+' '+c[1].toFixed(1)).join(' ');
  const defs=svg('defs'),gradient=svg('linearGradient',{id:'history-fill',x1:0,y1:0,x2:0,y2:1});
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#c5f05e';
  gradient.append(svg('stop',{offset:'0%','stop-color':accent,'stop-opacity':.18}),svg('stop',{offset:'100%','stop-color':accent,'stop-opacity':0}));defs.append(gradient);chart.append(defs);
  if(pts.length>1){chart.append(svg('path',{d:`${line} L${coords.at(-1)[0].toFixed(1)} ${m.top+innerH} L${coords[0][0].toFixed(1)} ${m.top+innerH} Z`,class:'chart-area'}),svg('path',{d:line,class:'chart-line'}));}
  const guide=svg('line',{y1:m.top,y2:m.top+innerH,class:'chart-guide',visibility:'hidden'});chart.append(guide);
  const dots=pts.map((p,i)=>{const last=i===pts.length-1;const dot=svg('circle',{cx:coords[i][0],cy:coords[i][1],r:last?5:3.5,class:'chart-point'+(last?' latest':''),tabindex:0,'aria-label':percent(p.probability)+' on '+timeFormat.format(new Date(p.at))+' PT'});chart.append(dot);return dot;});
  function show(i){
    const [px,py]=coords[i];tooltip.replaceChildren(text('strong',percent(pts[i].probability)),text('span',timeFormat.format(new Date(pts[i].at))+' PT'));tooltip.hidden=false;
    tooltip.style.left=Math.min(W-70,Math.max(70,px))/W*100+'%';tooltip.style.top=py/H*100+'%';
    guide.setAttribute('x1',px);guide.setAttribute('x2',px);guide.setAttribute('visibility','visible');
    dots.forEach((d,j)=>{d.classList.toggle('selected',j===i);d.setAttribute('r',j===i?6:j===pts.length-1?5:3.5);});
  }
  function hide(){tooltip.hidden=true;guide.setAttribute('visibility','hidden');dots.forEach((d,j)=>{d.classList.remove('selected');d.setAttribute('r',j===pts.length-1?5:3.5);});}
  const hit=svg('rect',{x:m.left-8,y:0,width:innerW+16,height:H,class:'chart-hit'});chart.insertBefore(hit,dots[0]);
  const nearest=event=>{const r=chart.getBoundingClientRect(),vx=(event.clientX-r.left)/r.width*W;let best=0;coords.forEach((c,i)=>{if(Math.abs(c[0]-vx)<Math.abs(coords[best][0]-vx))best=i;});return best;};
  chart.onpointermove=event=>show(nearest(event));chart.onpointerleave=hide;
  dots.forEach((d,i)=>{d.addEventListener('focus',()=>show(i));d.addEventListener('blur',hide);});
  $('history-summary').textContent=pts.length+' estimates in the last '+days+' days, from '+percent(pts[0].probability)+' to '+percent(pts.at(-1).probability)+'.';
}

function renderChange(){
  const h=sortedHistory(),el=$('change');if(h.length<2){el.hidden=true;return;}
  const delta=h.at(-1).probability-h.at(-2).probability;el.hidden=false;
  if(Math.abs(delta)<0.0005){el.className='change';el.textContent='Unchanged since the last update';return;}
  el.className='change '+(delta>0?'rise':'fall');el.textContent=(delta>0?'▲ ':'▼ ')+Math.abs(delta*100).toFixed(1)+' pts since the last update';
}

function renderSources(data){
  const list=$('sources');list.replaceChildren();
  data.sources.forEach(s=>{
    const article=text('article','','source'),meta=text('div','','source-meta');
    meta.append(text('span',s.publisher),text('span',sourceDate(s.date)),text('span',s.type,'source-type'));
    const h3=document.createElement('h3'),a=document.createElement('a');a.href=safeUrl(s.url);a.target='_blank';a.rel='noopener noreferrer';
    a.append(document.createTextNode(s.title),text('span','↗','arrow'));a.lastChild.setAttribute('aria-hidden','true');a.setAttribute('aria-label',s.title+' (opens in a new tab)');h3.append(a);
    article.append(meta,h3,text('p',s.summary),text('div','Reviewed '+pacificDate(s.checkedAt)+' PT','source-check'));list.append(article);
  });
  if(!data.sources.length)list.append(text('p','No reviewed sources are currently included.','muted'));
  $('count').textContent=data.sources.length+(data.sources.length===1?' source':' sources');
  if(data.excluded?.length){$('excluded-section').hidden=false;$('excluded-count').textContent='('+data.excluded.length+')';$('excluded').replaceChildren();for(const s of data.excluded){const a=text('a',s.title+' — '+s.status);a.href=safeUrl(s.url);a.target='_blank';a.rel='noopener noreferrer';$('excluded').append(a);}}
}

async function load(){try{
  const r=await fetch('/snapshot.json',{cache:'no-store'});if(!r.ok)throw new Error('Snapshot unavailable');
  const data=await r.json();if(!Number.isFinite(data.probability)||data.probability<0||data.probability>1)throw new Error('Invalid estimate');snapshot=data;
  $('probability').textContent=(data.probability*100).toFixed(1);
  if(data.probability>0&&data.probability<.5)$('odds').textContent=', or about 1 in '+Math.round(1/data.probability);
  renderGrid(data.probability);renderChange();
  $('published').textContent=pacificDate(data.publishedAt)+' PT';$('reviewed').textContent=pacificDate(data.reviewedAt)+' PT';
  renderHistory(currentDays);renderSources(data);tick();
}catch(error){$('sources').replaceChildren(text('p','Source feed unavailable.','muted'));$('published').textContent='Unavailable';$('reviewed').textContent='Unavailable';}}

document.querySelectorAll('.range-button').forEach(button=>button.addEventListener('click',()=>snapshot&&renderHistory(Number(button.dataset.days))));
let lastWidth=0;
if('ResizeObserver' in window)new ResizeObserver(entries=>{const w=Math.round(entries[0].contentRect.width);if(snapshot&&Math.abs(w-lastWidth)>8){lastWidth=w;renderHistory(currentDays);}}).observe(document.querySelector('.chart-frame'));
buildGrid();tick();setInterval(tick,1000);load();
