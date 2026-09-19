const $=id=>document.getElementById(id);
const pstDate=(value,options={})=>new Intl.DateTimeFormat('en-US',{timeZone:'Etc/GMT+8',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,...options}).format(new Date(value));
let snapshot=null;
function tick(){
  const now=new Date();
  $('clock').textContent=pstDate(now,{month:undefined,day:undefined,second:'2-digit'})+' PST';
  $('days').replaceChildren(document.createTextNode(Math.max(0,Math.ceil((new Date('2036-12-31T23:59:59Z')-now)/86400000)).toLocaleString()),Object.assign(document.createElement('small'),{textContent:' DAYS'}));
  const starts=[0,14].flatMap(hour=>[0,1].map(offset=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+offset,hour)))).filter(d=>d>now).sort((a,b)=>a-b);
  $('next').textContent=snapshot?.scheduleActive?pstDate(starts[0])+' PST':'Not yet enabled';
  if(snapshot && now-new Date(snapshot.reviewedAt)>24*3600000){
    $('status-message').textContent='REVIEW OVERDUE — This is an archived estimate. Source verification is more than 24 hours old.';
    $('status-message').classList.add('warning');
    $('reviewed').textContent='Review overdue';
  }
}
function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function safeUrl(value){const u=new URL(value);if(u.protocol!=='https:')throw new Error('Invalid source URL');return u.href;}
async function load(){try{
  const r=await fetch('/snapshot.json',{cache:'no-store'});if(!r.ok)throw new Error('Snapshot unavailable');
  const data=await r.json();if(!Number.isFinite(data.probability)||data.probability<0||data.probability>1)throw new Error('Invalid estimate');snapshot=data;
  $('probability').textContent=(data.probability*100).toFixed(1);$('risk-fill').style.width=(data.probability*100)+'%';
  $('published').textContent=pstDate(data.publishedAt)+' PST';$('reviewed').textContent=pstDate(data.reviewedAt)+' PST';
  $('count').textContent=String(data.sources.length).padStart(2,'0')+' SOURCES';
  $('status-message').textContent=data.scheduleActive?'Scheduled reviews run at 06:00 and 16:00 PST. Publication follows review; the estimate can remain unchanged.':'Initial review complete. Recurring reviews are not yet enabled.';
  $('sources').replaceChildren();
  data.sources.forEach((s,i)=>{
    const article=text('article','', 'source');article.append(text('div',String(i+1).padStart(2,'0'),'source-number'));
    const body=document.createElement('div'),meta=text('div','','source-meta');meta.append(text('span',s.publisher),text('span','/ '+s.date),text('span',s.type,'source-type'));
    const a=document.createElement('a');a.href=safeUrl(s.url);a.target='_blank';a.rel='noopener noreferrer';a.append(text('h3',s.title));
    body.append(meta,a,text('p',s.summary),text('div','SOURCE REVIEWED / '+pstDate(s.checkedAt)+' PST','source-check'));
    const arrow=text('a','↗','source-arrow');arrow.href=a.href;arrow.target='_blank';arrow.rel='noopener noreferrer';arrow.setAttribute('aria-label','Read '+s.title+' (opens in a new tab)');article.append(body,arrow);$('sources').append(article);
  });
  if(!data.sources.length)$('sources').append(text('p','No reviewed sources are currently included.'));
  if(data.excluded.length){$('excluded-section').hidden=false;$('excluded-count').textContent='('+data.excluded.length+')';for(const s of data.excluded){const a=text('a',s.title+' — '+s.status);a.href=safeUrl(s.url);a.target='_blank';a.rel='noopener noreferrer';$('excluded').append(a);}}
  tick();
}catch(error){$('status-message').textContent='The current snapshot could not be loaded. Please reload to try again.';$('status-message').classList.add('warning');$('sources').replaceChildren(text('p','Source feed unavailable.'));$('published').textContent='Unavailable';$('reviewed').textContent='Unavailable';}}
tick();setInterval(tick,1000);load();
