import {baseQuery,pickHits} from './search-settings.js?v=build-table-1';
import {statName,CLASS_NAMES} from './stats.js?v=1fc672fd23';
import {stepsElement,tooltipRows} from './recipe.js?v=build-result-dom-1';
const $=id=>document.getElementById('search-builds-'+id);
let info,build,rows=[],active=null,job=0;
const worker=new Worker('./worker.js?v=worker-errors-1',{type:'module'});
const tiers=['primal','crafted','ancient','normal'];
const select = document.getElementById('search-builds-saved');
const status = document.getElementById('search-builds-status');
const key = 'd3recipes-user-builds-v1';

function refresh() {
  const selected = select.value;
  try {
    const builds = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(builds)) throw new Error('Invalid saved build data');
    select.replaceChildren(new Option('Choose a saved build', ''));
    for (const build of builds) select.add(new Option(build.name, build.id));
    const current = builds.find(record => record.id === selected);
    if (current) select.value = selected;
    const changed = JSON.stringify(build) !== JSON.stringify(current);
    if (changed) renderBuild();
    if (!builds.length) status.textContent = 'No saved builds yet. Create a build to get started.';
    else if (changed) status.textContent = current ? 'Saved build changed. Search again with its updated items and stats.' : 'Selected build is no longer saved. Choose another build.';
    else if (!active) status.textContent = '';
  } catch (error) {
    cancel();build=undefined;rows=[];$('rows').replaceChildren();$('run').disabled=true;
    $('primalSuggestion').textContent='';$('sanctifySuggestion').textContent='';
    select.replaceChildren(new Option('Choose a saved build', ''));
    status.textContent = 'Could not load saved builds: ' + error.message;
  }
}

document.getElementById('search-builds-create').addEventListener('click', () => {
  location.hash = 'create-build';
});
window.addEventListener('d3-route', event => {
  if (event.detail === 'search-builds') refresh();
});
window.addEventListener('storage', event => {
  if (event.key === key || event.key === null) refresh();
});
refresh();

function cancel(){worker.postMessage({type:'cancel'});job++;active=null;$('cancel').hidden=true;$('run').disabled=!info||!build;}
function renderBuild(){
 cancel();
 try{build=JSON.parse(localStorage.getItem(key)||'[]').find(b=>b.id===select.value);$('primalSuggestion').textContent='';$('sanctifySuggestion').textContent='';rows=(build?.slots||[]).map((r,i)=>({...r,index:i,owned:false,results:{}}));
 $('rows').replaceChildren(...rows.map(row=>{
   const tr=document.createElement('tr');
   const cell=(text,id)=>{const td=document.createElement('td');if(text!==undefined)td.textContent=text;if(id)td.id=id;tr.append(td);return td;};
   const name=row.externalName||info?.items.find(it=>it.id===row.item)?.name||row.slot;
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.row=String(row.index);checkbox.style.width='auto';checkbox.setAttribute('aria-label','Already have '+name);cell().append(checkbox);
   cell(row.slot);cell(row.any_item?'Any item':row.externalName||info?.items.find(it=>it.id===row.item)?.name||'Unknown item');
   cell((row.wants||[]).map(w=>w.label||statName(w.stem)).join(', '));
   cell('Not searched','build-match-'+row.index);cell('—','build-cost-'+row.index);
   return tr;
 }));
 $('rows').querySelectorAll('input').forEach(el=>el.addEventListener('change',()=>{const row=rows[+el.dataset.row];row.owned=el.checked;document.getElementById('build-match-'+row.index).textContent=row.owned?'Excluded from search':'Not searched';document.getElementById('build-cost-'+row.index).textContent='—';recommendPrimal();if(active?.row===row){worker.postMessage({type:'cancel'});job++;nextRow();}}));$('run').disabled=!info||!build;
 }catch(e){status.textContent=e.message;}
}
select.addEventListener('change',renderBuild);
$('cancel').addEventListener('click',()=>{cancel();status.textContent='Search cancelled.';});
$('run').addEventListener('click',()=>{
 cancel();for(const row of rows)row.best=null;recommendPrimal();
 const number=id=>Math.max(0,Math.round(+$(id).value||0));
 active={queue:rows.filter(r=>!r.owned),settings:{c:build.class,p:['cc','ch','cr','cp'].map(id=>$(id).value),f:number('floor'),n:Math.max(1,number('top')),xn:$('xn').value,xs:$('cs').value,cn:$('cn').value},secs:Math.max(1,number('secs')),season:Math.max(1,+document.getElementById('season').value||40),hc:document.getElementById('hc').value==='1'};
 $('run').disabled=true;$('cancel').hidden=false;nextRow();
});
function nextRow(){
 let row=active.queue.shift();while(row?.owned)row=active.queue.shift();
 if(!row){cancel();status.textContent='Build search complete. Costs use the selected weights.';recommendPrimal();return;}
 active.row=row;active.tier=0;active.deadline=performance.now()+active.secs*1000;row.results={};row.best=null;row.limited=false;
 const item=info.items.find(it=>it.id===row.item);
 if(!item){document.getElementById('build-match-'+row.index).textContent=row.any_item?'Choose a specific item in the editor before searching.':'Item unavailable.';nextRow();return;}
 row.itemData=item;active.query=baseQuery({...active.settings,w:row.wants.map(w=>[w.stem,w.min==null?'':String(w.min)])},item,active.season,active.hc);startTier();
}
function startTier(){const tier=tiers[active.tier];status.textContent='Searching '+active.row.itemData.name+' ('+tier+')...';worker.postMessage({type:'search',id:++job,query:{...active.query,quality:tier,end_on_primalize:tier==='crafted'},budgetMs:Math.max(1500,Math.max(1000,active.deadline-performance.now())/(4-active.tier))});}
function showMatches(row){
 const snap=row.wants.map(w=>w.stem);let chosen=[];
 for(const tier of tiers){if(!row.results[tier])continue;for(const hit of pickHits(tier,row.results[tier],snap,active.settings.n)){if(chosen.some(x=>x.hit.matched.length>=hit.matched.length&&x.hit.cost<=hit.cost))continue;chosen.push({tier,hit});}}
 const best=chosen[0];row.best=best;
 const cell=document.getElementById('build-match-'+row.index);cell.replaceChildren();
 if(best){
   const quality=document.createElement('strong');quality.textContent=best.tier==='crafted'?'Crafted primal':best.tier;
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Recipe and stats';
   const steps=stepsElement(best.hit,snap.filter((_,i)=>!best.hit.matched.includes(i)),new Set(snap),{cls:build.class,name:c=>CLASS_NAMES[info.classes[c]]||info.classes[c]});
   const lines=document.createElement('div');lines.className='lines';
   for(const row of tooltipRows(best.hit.lines)){const label=document.createElement('span'),value=document.createElement('span');label.textContent=row.label;value.textContent=row.value;lines.append(label,value);}
   details.append(summary,steps,lines);cell.append(quality,' · '+best.hit.matched.length+'/'+snap.length+' stats'+(row.limited?' · Best found within limits':''),details);
 }else cell.textContent='No matching recipe found'+(row.limited?' within limits':'');
 document.getElementById('build-cost-'+row.index).textContent=best?(best.hit.cost/100).toLocaleString(undefined,{maximumFractionDigits:2}):'—';
}
worker.onmessage=({data:m})=>{
 if(m.type==='ready'){info=m.info;if(select.value)renderBuild();$('run').disabled=!build;}
 else if(active&&m.id===job&&(m.type==='progress'||m.type==='done')){const row=active.row;row.results[tiers[active.tier]]=m.results;row.limited ||=m.results.status.capped||m.type==='done'&&!m.results.status.done;showMatches(row);if(m.type==='done'){active.tier++;if(active.tier<4)startTier();else nextRow();}}
 else if(m.type==='error'){if(m.key!==undefined)return;if(m.id!==undefined&&(!active||m.id!==job))return;if(m.id===undefined){engineFailed(m.message);return;}if(active){document.getElementById('build-match-'+active.row.index).textContent='Search failed: '+m.message;nextRow();}else status.textContent='Search engine: '+m.message;}
};
window.addEventListener('d3-route',event=>{if(event.detail!=='search-builds'&&active)cancel();});
for(const el of document.querySelectorAll('#search-builds-costs input, #season, #hc'))el.addEventListener('change',()=>{if(active)cancel();$('primalSuggestion').textContent='';$('sanctifySuggestion').textContent='';for(const row of rows){row.best=null;document.getElementById('build-match-'+row.index).textContent=row.owned?'Excluded from search':'Settings changed — search again';document.getElementById('build-cost-'+row.index).textContent='—';}});

function recommendPrimal(){
  $('sanctifySuggestion').textContent='';
  const candidates=rows.filter(row=>!row.owned&&row.best).sort((a,b)=>b.best.hit.cost-a.best.hit.cost);
  const highest=candidates.reduce((best,row)=>!best||row.best.hit.cost>best.best.hit.cost?row:best,null);
  for(const row of rows){const tr=document.getElementById('build-match-'+row.index)?.closest('tr');if(tr){tr.style.backgroundColor='';tr.style.outline='';tr.removeAttribute('aria-selected');}}
  if(!highest){$('primalSuggestion').textContent='';$('sanctifySuggestion').textContent='';return;}
  const tr=document.getElementById('build-match-'+highest.index).closest('tr');tr.style.backgroundColor='var(--panel)';tr.style.outline='2px solid var(--accent, #c69340)';tr.setAttribute('aria-selected','true');
  // One highlighted candidate: the most expensive recipe among the items still needed.
  for(const row of rows){if(row!==highest){const other=document.getElementById('build-match-'+row.index)?.closest('tr');if(other)other.style.outline='';}}
  const name=highest.itemData?.name||highest.externalName||highest.slot;
  $('primalSuggestion').textContent=highest.best.tier==='crafted'
    ? name+' has the highest recipe cost. Its best match already uses a crafted primal. Only one crafted primal can be equipped per character.'
    : 'Suggested crafted primal: '+name+' ('+highest.slot+'), the highest-cost recipe at '+(highest.best.hit.cost/100).toLocaleString(undefined,{maximumFractionDigits:2})+'. Consider Improve Legendary instead of this recipe. Only one crafted primal can be equipped per character; its required stats are not guaranteed.';
  const season=Math.round(+document.getElementById('season').value||40);
  // Use the requested six-season recurrence from Light's Calling season 34 onward.
  if(season>=34&&(season-40)%6===0&&candidates.length>1){
    const second=candidates[1],item=second.itemData?.name||second.externalName||second.slot;
    const rowElement=document.getElementById('build-match-'+second.index).closest('tr');
    rowElement.style.outline='2px solid #70aee6';rowElement.setAttribute('aria-selected','true');
    $('sanctifySuggestion').textContent="Light's Calling — suggested Sanctified item: "+item+' ('+second.slot+'), the second-highest-cost recipe at '+(second.best.hit.cost/100).toLocaleString(undefined,{maximumFractionDigits:2})+'. Use an Angelic Crucible to Sanctify it instead. Sanctification rerolls its stats and adds a random class power; only one Sanctified item can be equipped.';
  }

}

function engineFailed(message){
  if(active){document.getElementById('build-match-'+active.row.index).textContent='Search failed: '+message;cancel();}
  info=null;$('run').disabled=true;status.textContent='Search engine unavailable: '+message+'. Reload the page to retry.';
}
worker.addEventListener('error',event=>{event.preventDefault();engineFailed(event.message||'Worker crashed');});
worker.addEventListener('messageerror',()=>engineFailed('Could not read the worker response'));
