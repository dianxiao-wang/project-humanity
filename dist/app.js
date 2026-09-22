const $=id=>document.getElementById(id);
const pacificTimeZone='America/Los_Angeles';
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
  for(let dayOffset=0;dayOffset<3;dayOffset++)for(const hour of [6,16])candidates.push(pacificInstant(p.year,p.month,p.day+dayOffset,hour));
  return candidates.filter(date=>date>now).sort((a,b)=>a-b)[0];
}
let snapshot=null;
function tick(){
  const now=new Date();
  $('clock').textContent=pacificDate(now,{month:undefined,day:undefined,second:'2-digit'})+' PT';
  const remaining = Math.max(0, Math.floor((new Date(snapshot?.deadline || '2036-12-31T23:59:59Z') - now) / 1000));
  $('count-days').textContent = Math.floor(remaining / 86400).toLocaleString();
  $('count-hours').textContent = String(Math.floor(remaining / 3600) % 24).padStart(2,'0');
  $('count-minutes').textContent = String(Math.floor(remaining / 60) % 60).padStart(2,'0');
  $('count-seconds').textContent = String(remaining % 60).padStart(2,'0');
  $('next').textContent=snapshot?.scheduleActive?pacificDate(nextPacificStart(now))+' PT':'Not yet enabled';
}
function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function safeUrl(value){const u=new URL(value);if(u.protocol!=='https:')throw new Error('Invalid source URL');return u.href;}
const svgNS='http://www.w3.org/2000/svg';
const svg=(tag,attributes={})=>{const el=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(attributes))el.setAttribute(key,String(value));return el;};
const percent=value=>(value*100).toFixed(1)+'%';
function renderHistory(days){
  const chart=$('history-chart'),tooltip=$('chart-tooltip');chart.replaceChildren();tooltip.hidden=true;
  const end=new Date(snapshot.publishedAt),start=new Date(end-days*86400000);
  const points=(snapshot.history||[]).filter(p=>Number.isFinite(p.probability)&&new Date(p.at)>=start&&new Date(p.at)<=end).sort((a,b)=>new Date(a.at)-new Date(b.at));
  $('history-range').textContent=days+' DAYS';$('history-points').textContent=String(points.length).padStart(2,'0');
  document.querySelectorAll('.range-button').forEach(button=>{const active=Number(button.dataset.days)===days;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  if(!points.length){$('history-change').textContent='NO DATA';$('history-summary').textContent='No estimates were recorded in the selected period.';const empty=svg('text',{x:500,y:170,class:'chart-empty'});empty.textContent='No recorded estimates in this range.';chart.append(empty);return;}
  const change=points.at(-1).probability-points[0].probability;
  $('history-change').textContent=(change>0?'+':'')+(change*100).toFixed(1)+' PTS';$('history-change').className=change>0?'rise':change<0?'fall':'';
  const W=1000,H=340,m={top:28,right:28,bottom:45,left:70},innerW=W-m.left-m.right,innerH=H-m.top-m.bottom;
  const values=points.map(p=>p.probability*100),low=Math.min(...values),high=Math.max(...values),padding=Math.max(.15,(high-low)*.35);
  const minY=Math.max(0,low-padding),maxY=Math.min(100,high+padding),rangeY=Math.max(.3,maxY-minY);
  const firstTime=+new Date(points[0].at),lastTime=+new Date(points.at(-1).at),rangeX=Math.max(1,lastTime-firstTime);
  const x=(p,i)=>points.length===1?m.left+innerW/2:m.left+((+new Date(p.at)-firstTime)/rangeX)*innerW;
  const y=p=>m.top+(1-((p.probability*100-minY)/rangeY))*innerH;
  const defs=svg('defs'),gradient=svg('linearGradient',{id:'history-fill',x1:'0',y1:'0',x2:'0',y2:'1'});gradient.append(svg('stop',{offset:'0%','stop-color':'#d6ff62','stop-opacity':'.22'}),svg('stop',{offset:'100%','stop-color':'#d6ff62','stop-opacity':'0'}));defs.append(gradient);chart.append(defs);
  for(let i=0;i<5;i++){const gy=m.top+(innerH*i/4),value=maxY-(rangeY*i/4);chart.append(svg('line',{x1:m.left,y1:gy,x2:W-m.right,y2:gy,class:'chart-grid'}));const label=svg('text',{x:m.left-14,y:gy+4,class:'chart-axis','text-anchor':'end'});label.textContent=value.toFixed(1)+'%';chart.append(label);}
  const dateFormat=new Intl.DateTimeFormat('en-US',{timeZone:pacificTimeZone,month:'short',day:'numeric'}),timeFormat=new Intl.DateTimeFormat('en-US',{timeZone:pacificTimeZone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  const axisDates=points.length===1?[points[0]]:[points[0],points.at(-1)];axisDates.forEach((p,i)=>{const label=svg('text',{x:points.length===1?m.left+innerW/2:i?W-m.right:m.left,y:H-14,class:'chart-axis','text-anchor':points.length===1?'middle':i?'end':'start'});label.textContent=dateFormat.format(new Date(p.at)).toUpperCase();chart.append(label);});
  const coordinates=points.map((p,i)=>[x(p,i),y(p)]),line=coordinates.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
  if(points.length>1){chart.append(svg('path',{d:line+' L '+coordinates.at(-1)[0]+' '+(m.top+innerH)+' L '+coordinates[0][0]+' '+(m.top+innerH)+' Z',class:'chart-area'}));chart.append(svg('path',{d:line,class:'chart-line'}));}
  function showPoint(index){const p=points[index],[px,py]=coordinates[index];tooltip.replaceChildren(text('strong',percent(p.probability)),text('span',timeFormat.format(new Date(p.at))+' PT'));tooltip.hidden=false;tooltip.style.left=(px/W*100)+'%';tooltip.style.top=(py/H*100)+'%';chart.querySelectorAll('.chart-point').forEach((node,i)=>node.classList.toggle('selected',i===index));}
  points.forEach((p,i)=>{const [px,py]=coordinates[i],point=svg('circle',{cx:px,cy:py,r:points.length===1?7:5,class:'chart-point',tabindex:'0',role:'button','aria-label':percent(p.probability)+' on '+timeFormat.format(new Date(p.at))+' PT'});point.addEventListener('pointerenter',()=>showPoint(i));point.addEventListener('focus',()=>showPoint(i));point.addEventListener('click',()=>showPoint(i));point.addEventListener('blur',()=>{tooltip.hidden=true;point.classList.remove('selected');});chart.append(point);});
  $('history-summary').textContent=points.length+' estimates in the last '+days+' days, from '+percent(points[0].probability)+' to '+percent(points.at(-1).probability)+'.';
}
async function load(){try{
  const r=await fetch('/snapshot.json',{cache:'no-store'});if(!r.ok)throw new Error('Snapshot unavailable');
  const data=await r.json();if(!Number.isFinite(data.probability)||data.probability<0||data.probability>1)throw new Error('Invalid estimate');snapshot=data;
  $('probability').textContent=(data.probability*100).toFixed(1);$('risk-fill').style.width=(data.probability*100)+'%';
  $('published').textContent=pacificDate(data.publishedAt)+' PT';$('reviewed').textContent=pacificDate(data.reviewedAt)+' PT';
  $('count').textContent=String(data.sources.length).padStart(2,'0')+' SOURCES';
  renderHistory(7);
  $('sources').replaceChildren();
  data.sources.forEach((s,i)=>{
    const article=text('article','', 'source');article.append(text('div',String(i+1).padStart(2,'0'),'source-number'));
    const body=document.createElement('div'),meta=text('div','','source-meta');meta.append(text('span',s.publisher),text('span','/ '+s.date),text('span',s.type,'source-type'));
    const a=document.createElement('a');a.href=safeUrl(s.url);a.target='_blank';a.rel='noopener noreferrer';a.append(text('h3',s.title));
    body.append(meta,a,text('p',s.summary),text('div','SOURCE REVIEWED / '+pacificDate(s.checkedAt)+' PT','source-check'));
    const arrow=text('a','↗','source-arrow');arrow.href=a.href;arrow.target='_blank';arrow.rel='noopener noreferrer';arrow.setAttribute('aria-label','Read '+s.title+' (opens in a new tab)');article.append(body,arrow);$('sources').append(article);
  });
  if(!data.sources.length)$('sources').append(text('p','No reviewed sources are currently included.'));
  if(data.excluded.length){$('excluded-section').hidden=false;$('excluded-count').textContent='('+data.excluded.length+')';for(const s of data.excluded){const a=text('a',s.title+' — '+s.status);a.href=safeUrl(s.url);a.target='_blank';a.rel='noopener noreferrer';$('excluded').append(a);}}
  tick();
}catch(error){$('sources').replaceChildren(text('p','Source feed unavailable.'));$('published').textContent='Unavailable';$('reviewed').textContent='Unavailable';}}
document.querySelectorAll('.range-button').forEach(button=>button.addEventListener('click',()=>snapshot&&renderHistory(Number(button.dataset.days))));
tick();setInterval(tick,1000);load();
