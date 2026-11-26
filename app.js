const $=id=>document.getElementById(id);
let mode='goals';
let league='nhl',data=null,sort=0,desc=false,token=0;
const fmt=n=>Number.isFinite(n)?n.toLocaleString('cs-CZ',{maximumFractionDigits:2,minimumFractionDigits:2}):'—';
function options(el,items){el.replaceChildren(...items.map(([v,t])=>new Option(t,v)))}
function opponents(){options($('opponent'),[['all','Všichni'],...Object.entries(data.teams).filter(([k])=>k!==$('team').value).sort((a,b)=>a[1].localeCompare(b[1]))])}
async function load(l){league=l;document.body.classList.toggle('nhl-mode',l==='nhl');const t=++token;data=null;$('table').replaceChildren();$('metrics').replaceChildren();$('distribution').replaceChildren();$('updated').textContent='';$('status').textContent='Načítám data…';document.querySelectorAll('[data-league]').forEach(b=>b.classList.toggle('active',b.dataset.league===l));try{const r=await fetch('data/'+l+'.json',{cache:'no-cache'});if(!r.ok)throw Error();const d=await r.json();if(t!==token)return;data=d;options($('team'),Object.entries(d.teams).sort((a,b)=>a[1].localeCompare(b[1])));opponents();sort=l==='nhl'?19:0;desc=false;render()}catch(e){if(t===token)$('status').textContent='Data zatím nejsou dostupná. Je potřeba dokončit první aktualizaci.'}}
function table(headers,rows){const el=$('table');el.replaceChildren();const head=el.createTHead().insertRow();headers.forEach((h,i)=>{const c=document.createElement('th');c.textContent=h;c.tabIndex=0;c.onclick=()=>{desc=sort===i?!desc:false;sort=i;render()};c.onkeydown=e=>{if(e.key==='Enter')c.click()};head.append(c)});const body=el.createTBody();rows.sort((a,b)=>{let x=a[sort],y=b[sort];return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'cs'))*(desc?-1:1)});for(const row of rows){const tr=body.insertRow();row.forEach((v,i)=>tr.insertCell().textContent=typeof v==='number'&&!Number.isInteger(v)?fmt(v):v)}}
function render(){if(!data)return;if(league==='nhl'){renderNhl();return;}const team=$('team').value,s=$('season').value,p=$('period').value,v=$('venue').value,o=$('opponent').value;let games=data.games.filter(g=>(s==='both'||g.season===data.seasons[s==='current'?1:0])&&(g.home===team||g.away===team)&&(v==='all'||g[v]===team)&&(o==='all'||(g.home===team?g.away:g.home)===o));if(p==='custom')games=games.filter(g=>(!$('from').value||g.date>=$('from').value)&&(!$('to').value||g.date<=$('to').value));games.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);if(/^\d+$/.test(p))games=games.slice(0,+p);$('status').textContent=data.teams[team]+' · '+games.length+' zápasů';$('updated').textContent='Aktualizace: '+new Date(data.updated).toLocaleString('cs-CZ');$('metrics').replaceChildren();$('distribution').replaceChildren();if(league==='nhl'){const m=new Map();for(const g of games)for(const [id,name,club,goals,points] of g.players){if(club!==team)continue;const a=m.get(id)||[name,0,0,0];a[1]++;a[2]+=+(goals>0);a[3]+=+(points>0);m.set(id,a)}table(['Hráč','GP','G+','G %','Kurz G','P+','P %','Kurz P'],[...m.values()].map(([n,g,a,b])=>[n,g,a,100*a/g,a?g/a:'—',b,100*b/g,b?g/b:'—']))}else{const rows=games.map(g=>{const h=g.home===team,a=h?g.hr:g.ar,b=h?g.ar:g.hr;return [g.date,data.teams[h?g.away:g.home]||'?',h?'D':'V',a,b,a+b]});const labels=['Tým','Soupeř','Celkem'];for(let i=0;i<3;i++){const sum=rows.reduce((a,r)=>a+r[i+3],0);const d=document.createElement('div');const strong=document.createElement('strong');strong.textContent=fmt(rows.length?sum/rows.length:NaN);d.append(labels[i]+' · průměr',strong,'Součet: '+sum);$('metrics').append(d);const counts=new Map();rows.forEach(r=>counts.set(r[i+3],(counts.get(r[i+3])||0)+1));const p=document.createElement('p');p.textContent=labels[i]+': '+[...counts].sort((a,b)=>a[0]-b[0]).map(([n,c])=>n+' doběhů: '+c+'× ('+fmt(100*c/rows.length)+' %)').join(' · ');$('distribution').append(p)}table(['Datum','Soupeř','D/V','R+','R−','Celkem'],rows)}}
document.querySelectorAll('[data-league]').forEach(b=>b.onclick=()=>load(b.dataset.league));for(const id of ['season','period','venue','opponent','from','to'])$(id).onchange=render;$('team').onchange=()=>{opponents();render()};$('theme').onclick=()=>{document.body.classList.toggle('light');try{localStorage.setItem('light',document.body.classList.contains('light')?'1':'0')}catch(e){}};try{if(localStorage.getItem('light')==='1')document.body.classList.add('light')}catch(e){}load('nhl');
function renderNhl(){
 const team=$('team').value, current=data.seasons[1], weights=[.15,.20,.20,.15,.15,.15], all=new Map(), latest=new Map();
 const games=[...data.games].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
 for(const g of games)for(const [id,name,club,goals,points] of g.players){
   if(!latest.has(id))latest.set(id,club);
   if(!all.has(id))all.set(id,{name,history:[]});
   all.get(id).history.push({season:g.season,hit:(mode==='goals'?goals:points)>0});
 }
 const rows=[];
 for(const [id,p] of all){
   if(latest.get(id)!==team)continue;
   const h=p.history, periods=[h.slice(0,10),h.slice(0,20),h.slice(0,30),h.slice(0,40),h.filter(g=>g.season===current),h.filter(g=>g.season===data.seasons[0])];
   let weighted=0,total=0;const row=[data.names?.[id]||p.name];
   periods.forEach((a,i)=>{const f=a.length?a.filter(g=>g.hit).length/a.length:null;row.push(a.length,f===null?null:100*f,f?1/f:null);if(f!==null){weighted+=f*weights[i];total+=weights[i]}});
   const fair=weighted?total/weighted:null;row.push(fair,fair===null?null:fair*1.10);rows.push(row);
 }
 $('status').textContent=data.teams[team]+' · '+rows.length+' hráčů';
 $('updated').textContent='Aktualizace: '+new Date(data.updated).toLocaleString('cs-CZ');
 $('metrics').replaceChildren();$('distribution').textContent='Váhy: 10 zápasů 15 % · 20 zápasů 20 % · 30 zápasů 20 % · 40 zápasů 15 % · tato sezona 15 % · minulá sezona 15 %. Hledaný kurz = vážený kurz + 10 %. Chybějící období se vynechávají a váhy se přepočítají.';
 const el=$('table');el.replaceChildren();const head=el.createTHead(), top=head.insertRow(), sub=head.insertRow();
 function th(tr,label,col,span=1,rowspan=1){const c=document.createElement('th');c.textContent=label;c.colSpan=span;c.rowSpan=rowspan;if(col!==null){c.tabIndex=0;c.onclick=()=>{desc=sort===col?!desc:col!==0;sort=col;render()};c.onkeydown=e=>{if(e.key==='Enter')c.click()};if(sort===col)c.textContent+=desc?' ↓':' ↑';}tr.append(c);return c}
 th(top,'Hráč',0,1,2).className='sticky-name';
 ['Posledních 10','Posledních 20','Posledních 30','Posledních 40','Tato sezona','Minulá sezona'].forEach((label,i)=>{th(top,label,null,3);['GP',mode==='goals'?'G %':'P %','Kurz'].forEach((s,j)=>th(sub,s,1+i*3+j))});
 th(top,'Váž. kurz',19,1,2);th(top,'Hledaný kurz',20,1,2);
 rows.sort((a,b)=>{const x=a[sort],y=b[sort];if(x===null)return y===null?0:1;if(y===null)return -1;return (typeof x==='number'?x-y:String(x).localeCompare(String(y),'cs'))*(desc?-1:1)});
 const body=el.createTBody();for(const row of rows){const tr=body.insertRow();row.forEach((v,i)=>{const td=tr.insertCell();td.textContent=v===null?'—':i===0?v:i>=19||i%3===0?fmt(v):i%3===2?fmt(v)+' %':v;if(i===0)td.className='sticky-name';if(i>=19)td.className='weighted'})}
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));render()});
