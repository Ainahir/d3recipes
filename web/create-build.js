import { KEY, readBuilds as saved, updateBuilds, importPlan, conflictSnapshot, applyImport } from './build-storage.js?v=import-conflicts-1';
import { parseBuildToml } from './build-toml.js?v=create-build-import-1';
import { combo } from './affix-picker.js?v=plain-text-1';
import { CLASS_NAMES, STATS, statName, HIDDEN } from './stats.js?v=1fc672fd23';
const $=id=>document.getElementById('build-'+id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slots=['Head','Shoulders','Chest','Hands','Wrists','Waist','Legs','Feet','Amulet','Ring 1','Ring 2','Main-hand','Off-hand','Dual-Wield'];
const pools={Head:['Helm','SpiritStone_Monk','VoodooMask','WizardHat'],Shoulders:['Shoulders'],Chest:['Chest','Cloak'],Hands:['Gloves'],Wrists:['Bracers'],Waist:['Belt','MightyBelt'],Legs:['Legs'],Feet:['Boots'],Amulet:['Amulet'],'Ring 1':['Ring'],'Ring 2':['Ring']};
let workerFailure=null;
let info,draft={id:null,name:'',class:0,slots:[]},generation=0;
const pending=new Map();
const worker=new Worker('./worker.js?v=worker-errors-1',{type:'module'});
const notice=text=>{ $('status').textContent=text; if($('importStatus')) $('importStatus').textContent=text; };
function listSaved(){try{$('saved').replaceChildren(new Option('Choose a saved build',''),...saved().map(b=>new Option(b.name,b.id)));}catch(e){notice(e.message);}}
function candidates(slot){return info.items.filter(it=>it.classes.includes(draft.class)&&(pools[slot]?pools[slot].includes(it.slot):slot==='Main-hand'?/Sword|Axe|Mace|Dagger|Spear|Bow|Crossbow|HandXbow|Wand|Fist|Daibo|Flail|Scythe|Staff|Polearm|MightyWeapon/.test(it.slot):/Shield|Orb|Mojo|Quiver|Phylactery|Sword$|Axe$|Mace$|Dagger$|Spear$|Wand$|FistWeapon|HandXbow|Scythe1H|Flail1H|MightyWeapon1H/.test(it.slot))).sort((a,b)=>a.name.localeCompare(b.name));}
function definition(build=draft){const names={Head:'Helm',Hands:'Gloves',Wrists:'Bracers',Waist:'Belt',Legs:'Pants',Feet:'Boots','Main-hand':'Main-Hand','Off-hand':'Off-Hand'};return {name:build.name.trim(),class:info.classes[build.class],slot:build.slots.map(r=>({name:names[r.slot]||r.slot,...(r.any_item?{any_item:true,sets:r.sets??true}:{items:[r.externalName||info.items.find(it=>it.id===r.item).name,...(r.alternatives||[])]}),stat_priority:r.wants.map(w=>w.exportName||statName(w.stem)),...(r.notes?{notes:r.notes}:{})}))};}
function toml(build=draft){const b=definition(build),q=JSON.stringify;return '[[build]]\nname = '+q(b.name)+'\nclass = '+q(b.class)+'\n'+b.slot.map(r=>'\n[[build.slot]]\nname = '+q(r.name)+'\n'+(r.any_item?'any_item = true\nsets = '+r.sets+'\n':'items = ['+r.items.map(q).join(', ')+']\n')+'stat_priority = ['+r.stat_priority.map(q).join(', ')+']\n'+(r.notes?'notes = ['+r.notes.map(q).join(', ')+']\n':'')).join('');}
function render(){generation++;$('clone').hidden=!draft.id;$('name').value=draft.name;$('class').value=String(draft.class);$('exportPreview').hidden=true;$('slots').replaceChildren(...slots.map((slot,i)=>{
  const row=draft.slots.find(r=>r.slot===slot),section=document.createElement('section');section.className='card';
  const heading=document.createElement('h3');heading.textContent=slot;
  const label=document.createElement('label');label.htmlFor='build-item-'+i;label.textContent='Item';
  const select=document.createElement('select');select.id='build-item-'+i;select.dataset.row=String(i);select.add(new Option('Leave empty',''));
  if(row&&!row.item)select.add(new Option(row.externalName||'Any item','imported',false,true));
  for(const item of candidates(slot))select.add(new Option(item.name,String(item.id),false,row?.item===item.id));
  const affixes=document.createElement('div');affixes.id='build-affixes-'+i;
  section.append(heading,label,select,affixes);return section;
}));$('slots').querySelectorAll('select').forEach(el=>el.addEventListener('change',()=>{const i=+el.dataset.row;draft.slots=draft.slots.filter(r=>r.slot!==slots[i]);if(el.value)draft.slots.push({slot:slots[i],item:+el.value,wants:[]});loadAffixes(i);}));slots.forEach((_,i)=>loadAffixes(i));}
function loadAffixes(i){const row=draft.slots.find(r=>r.slot===slots[i]),box=$('affixes-'+i);box.replaceChildren();if(!row)return;const item=info.items.find(it=>it.id===row.item);if(!item){affixPicker({i,item:row.item},[]);return;}if(workerFailure){box.textContent=workerFailure;return;}const key=crypto.randomUUID();pending.set(key,{i,generation,item:row.item});box.textContent='Loading affixes...';worker.postMessage({type:'stems',key,class:draft.class,slot:item.slot,item:row.item});}
function affixPicker(request,stems){const row=draft.slots.find(r=>r.slot===slots[request.i]);if(!row||row.item!==request.item)return;row.wants=row.wants.filter(w=>w.imported||stems.includes(w.stem));const box=$('affixes-'+request.i),inputId='build-statFind-'+request.i,pickId='build-statPick-'+request.i;
const label=document.createElement('label');label.htmlFor=inputId;label.textContent='Stats you want';
const chipList=document.createElement('div');chipList.className='chips';
const statInput=document.createElement('input');statInput.id=inputId;statInput.type='text';statInput.placeholder='Search stats: crit, cooldown, dexterity...';statInput.autocomplete='off';statInput.setAttribute('role','combobox');statInput.setAttribute('aria-expanded','false');statInput.setAttribute('aria-controls',pickId);
const suggestions=document.createElement('div');suggestions.id=pickId;suggestions.className='pick';suggestions.setAttribute('role','listbox');suggestions.hidden=true;
const help=document.createElement('p');help.className='small';help.textContent='Leave empty for any roll. Chips are ordered from highest to lowest priority.';
box.replaceChildren(label,chipList,statInput,suggestions,help);
const chips=()=>{const list=box.querySelector('.chips');list.replaceChildren(...row.wants.map((want,i)=>{
  const chip=document.createElement('div');chip.className='chip';
  const label=document.createElement('span');label.textContent=(i+1)+'. '+(want.label||statName(want.stem))+(stems.includes(want.stem)?'':' (unavailable on this item)');
  const up=document.createElement('button');up.type='button';up.dataset.up=String(i);up.title='Move up in priority';up.setAttribute('aria-label','Move '+statName(want.stem)+' up');up.disabled=i===0;up.textContent='↑';
  const remove=document.createElement('button');remove.type='button';remove.dataset.remove=String(i);remove.title='Remove';remove.setAttribute('aria-label','Remove '+statName(want.stem));remove.textContent='×';
  chip.append(label,up,remove);return chip;
}));list.querySelectorAll('[data-up]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.up;[row.wants[i-1],row.wants[i]]=[row.wants[i],row.wants[i-1]];chips();}));list.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{row.wants.splice(+b.dataset.remove,1);chips();}));};chips();const input=box.querySelector('input');combo(input,box.querySelector('.pick'),()=>{const text=input.value.trim().toLowerCase();return stems.filter(stem=>!row.wants.some(w=>w.stem===stem)&&(statName(stem).toLowerCase().includes(text)||stem.toLowerCase().includes(text))).slice(0,40).map(stem=>({value:stem,label:statName(stem)}));},'No matching stats.',stem=>{row.wants.push({stem,min:null});chips();});}
worker.onmessage=({data:m})=>{if(m.type==='ready'){info=m.info;$('class').replaceChildren(...info.classes.map((c,i)=>new Option(CLASS_NAMES[c]||c,String(i))));$('editor').hidden=false;$('loading').hidden=true;render();listSaved();}else if(m.type==='stems'){const r=pending.get(m.key);pending.delete(m.key);if(r?.resolve){r.resolve(m.stems);return;}if(r&&r.generation===generation)affixPicker(r,Object.keys(m.stems).filter(s=>!HIDDEN.test(s)).sort((a,b)=>statName(a).localeCompare(statName(b))));}else if(m.type==='error')failRequests(m.message,m.key);};
$('name').addEventListener('input',()=>draft.name=$('name').value);
$('class').addEventListener('change',()=>{draft.class=+$('class').value;draft.slots=draft.slots.filter(r=>!r.item||candidates(r.slot).some(it=>it.id===r.item));render();notice('Class changed. Items unavailable to this class were removed.');});
$('save').addEventListener('click',async()=>{if(!draft.name.trim())return notice('Enter a build name.');if(!draft.slots.length)return notice('Select at least one item.');if(pending.size)return notice('Wait for the affixes to finish loading before saving.');try{draft.name=draft.name.trim();draft.id ||=crypto.randomUUID();const record=structuredClone({...draft,version:1,definition:definition(),updatedAt:new Date().toISOString()});await updateBuilds(list=>{const i=list.findIndex(b=>b.id===record.id);if(i<0)list.push(record);else list.splice(i,1,record);});listSaved();$('saved').value=draft.id;$('clone').hidden=false;notice('Build saved in this browser.');}catch(e){notice('Could not save build: '+e.message);}});
$('saved').addEventListener('change',()=>{try{const b=saved().find(b=>b.id===$('saved').value);if(b){draft=structuredClone(b);render();notice('Saved build loaded.');}}catch(e){notice(e.message);}});
$('new').addEventListener('click',()=>{draft={id:null,name:'',class:draft.class,slots:[]};render();$('saved').value='';notice('New build.');});
$('delete').addEventListener('click',async()=>{if(!draft.id)return;try{const id=draft.id;await updateBuilds(list=>{const i=list.findIndex(b=>b.id===id);if(i>=0)list.splice(i,1);});draft.id=null;$('clone').hidden=true;listSaved();notice('Saved build deleted. The editor still contains its items.');}catch(e){notice(e.message);}});
$('export').addEventListener('click',()=>{$('toml').value=toml();$('exportPreview').hidden=false;const url=URL.createObjectURL(new Blob([toml()],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download=(draft.name||'build').replace(/[^a-z0-9_-]/gi,'_')+'.toml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});

const normalize=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
$('import').addEventListener('click',()=>{$('importFile').value='';$('importFile').click();});
$('importFile').addEventListener('change',async()=>{
  const file=$('importFile').files[0];if(!file)return;
  $('import').disabled=true;
  try{
    if(file.size>2000000)throw Error('Choose a TOML file smaller than 2 MB.');
    const builds=parseBuildToml(await file.text()), incoming=[], failures=[], reports=[];
    let count=0;
    for(const source of builds){
      notice('Importing '+source.name+' ('+(count+failures.length+1)+' of '+builds.length+')...');
      try{
        const {build,skipped}=await prepareImported(source);
        if(incoming.some(b=>normalize(b.name)===normalize(build.name)))throw Error('Duplicate build name in this file. Rename it before importing.');
        incoming.push({...build,id:crypto.randomUUID(),version:1,sourceFile:file.name,definition:definition(build),updatedAt:new Date().toISOString()});
        count++;if(skipped.length)reports.push(source.name+': skipped '+skipped.join(', '));
      }catch(e){failures.push(source.name+': '+e.message);}
    }
    let result;
    while(true){
      const plan=importPlan(saved(),incoming), conflicts=plan.filter(p=>p.conflict);
      const choice=conflicts.length?await chooseImportConflicts(conflicts):'keep';
      if(choice==='cancel'){notice('Import cancelled. No builds were saved.');return;}
      result=await updateBuilds(list=>applyImport(list,incoming,choice,conflictSnapshot(plan)));
      if(!result.retry)break;
      notice('Saved builds changed while you were deciding. Review the updated conflicts.');
    }
    listSaved();
    notice('Import complete: '+result.added+' added, '+result.replaced+' overwritten, '+result.skipped+' kept or identical.'+(failures.length?' Failed: '+failures.join('; ')+'.':'')+(reports.length?' '+reports.join('; ')+'.':''));
  }catch(e){notice('Import failed: '+e.message);}finally{$('import').disabled=false;}
});
async function prepareImported(source){
    const build=source;
    const slotNames={Helm:'Head',Gloves:'Hands',Bracers:'Wrists',Belt:'Waist',Pants:'Legs',Boots:'Feet','Main-Hand':'Main-hand','Off-Hand':'Off-hand'};
    const skipped=[];const importedSlots=build.slot.flatMap(r=>{if(r.any_item)return [r];const items=(r.items||[]).filter(name=>{if(/\((Cubed|Crafted|[^)]*Bounties[^)]*)\)/i.test(name)){skipped.push(name);return false;}return true;});return items.length?[{...r,items}]:[];});
    const rows=importedSlots.map(r=>{const slot=slotNames[r.name]||r.name;if(!slots.includes(slot))throw Error('Unsupported equipment slot: '+r.name);
      const item=info.items.find(it=>normalize(it.name)===normalize((r.items?.[0]||'').replace(/\s*\([^)]*\)\s*$/,''))||normalize(it.name)==='ringofthezodiac'&&normalize(r.items?.[0]||'')==='obsidianringofthezodiac');if(!item&&!r.any_item&&!/\((Crafted|[^)]*Bounties[^)]*)\)/i.test(r.items?.[0]||''))throw Error('Unknown item: '+r.items?.[0]);return{slot,item:item?.id||null,externalName:item?.name||r.items?.[0],any_item:r.any_item,sets:r.sets,notes:r.notes,source:r,wants:[],alternatives:(r.items||[]).slice(1).map(name=>{const alt=info.items.find(it=>normalize(it.name)===normalize(name)||normalize(it.name)==='ringofthezodiac'&&normalize(name)==='obsidianringofthezodiac');return alt?.name||name;})};});
    if(new Set(rows.map(r=>r.slot)).size!==rows.length)throw Error('The file repeats an equipment slot.');
    let hero=build.class?info.classes.findIndex(c=>normalize(c)===normalize(build.class)):info.classes.findIndex((_,c)=>rows.filter(r=>r.item).every(r=>info.items.find(it=>it.id===r.item).classes.includes(c)));
    if(hero<0)throw Error('No matching character class. Add a valid class field to the build.');
    for(const row of rows){
      const item=info.items.find(it=>it.id===row.item);
      if(item&&!item.classes.includes(hero))throw Error(item.name+' is unavailable to '+info.classes[hero]);
      const key=crypto.randomUUID();const stems=item?await new Promise((resolve,reject)=>{if(workerFailure){reject(Error(workerFailure));return;}pending.set(key,{resolve,reject});try{worker.postMessage({type:'stems',key,class:hero,slot:item.slot,item:item.id});}catch(e){failRequests(e.message,key);}}):{};
      for(const name of row.source.stat_priority||[]){const alias=/^sockets?\b/i.test(name)?'Sockets':({armor:'DR',life:'Life',elitedamage:'DamageVsElite',elitedamagereduction:'DamReductionVsElite'})[normalize(name.replace(/\s*\(Secondary\)/i,''))];const cleanName=name.replace(/\s*\(Secondary\)/i,'').replace(/Death Nova/i,'Blood Nova').replace(/^Cooldown$/i,'Cooldown Reduction');const stem=Object.keys(stems).find(s=>(alias?s===alias:normalize(statName(s))===normalize(cleanName)||normalize(s)===normalize(cleanName)));const canonicalStem=stem||alias||Object.keys(STATS).find(s=>normalize(statName(s))===normalize(cleanName)||normalize(s)===normalize(cleanName));const keyStem=canonicalStem||cleanName;if(!row.wants.some(w=>w.stem===keyStem))row.wants.push({stem:keyStem,min:null,imported:true,exportName:canonicalStem?statName(canonicalStem):cleanName,label:canonicalStem?null:cleanName});}
      delete row.source;
    }
    return {build:{name:build.name,class:hero,slots:rows},skipped};
}

$('clone').addEventListener('click',async()=>{
  if(!draft.id)return;
  if(pending.size)return notice('Wait for the affixes to finish loading before cloning.');
  try{
    const copy=structuredClone(draft);copy.id=crypto.randomUUID();copy.name=copy.name.trim()+' - Copy';
    delete copy.sourceFile;
    copy.version=1;copy.updatedAt=new Date().toISOString();copy.definition=definition(copy);
    await updateBuilds(list=>list.push(copy));
    draft=copy;listSaved();render();$('saved').value=copy.id;
    notice('Build cloned and saved. You are editing '+copy.name+'.');
  }catch(e){notice('Could not clone build: '+e.message);}
});

$('exportAll').addEventListener('click',()=>{
  try{
    const builds=saved();if(!builds.length)return notice('No saved builds to export.');
    const text=builds.map(build=>toml(build)).join('\n');
    $('toml').value=text;$('exportPreview').hidden=false;
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain'})),a=document.createElement('a');
    a.href=url;a.download='saved-builds.toml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    notice('Exported '+builds.length+' saved builds. Unsaved editor changes are not included.');
  }catch(e){notice('Could not export saved builds: '+e.message);}
});

function chooseImportConflicts(conflicts){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='build-conflicts';dialog.setAttribute('aria-label','Import conflicts');
    const title=document.createElement('h2');title.textContent='Saved build conflicts';dialog.append(title);
    const explanation=document.createElement('p');explanation.textContent='These imported builds differ from saved builds with the same name. Choose how to handle them. New builds will also be imported.';dialog.append(explanation);
    const list=document.createElement('ul');for(const {build} of conflicts){const li=document.createElement('li');li.textContent=build.name;list.append(li);}dialog.append(list);
    const finish=choice=>{dialog.close();dialog.remove();resolve(choice);};
    for(const [choice,label] of [['keep','Keep saved'],['overwrite','Overwrite conflicts'],['copies','Import as copies'],['cancel','Cancel import']]){
      const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=label;button.addEventListener('click',()=>finish(choice));dialog.append(button);
    }
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish('cancel');});document.body.append(dialog);dialog.showModal();dialog.querySelector('button').focus();
  });
}
window.addEventListener('storage',event=>{if(event.key===KEY){const selected=$('saved').value;listSaved();$('saved').value=selected;}});

function failRequests(message,key){
  const error=Error(message);
  if(key===undefined)workerFailure='Search engine unavailable: '+message+'. Reload the page to retry.';
  for(const [id,request] of pending){
    if(key!==undefined&&id!==key)continue;
    pending.delete(id);
    if(request.reject)request.reject(error);
    else if(request.generation===generation){const box=$('affixes-'+request.i);if(box)box.textContent='Could not load affixes: '+message;}
  }
  notice('Could not load item tables: '+message);
}
worker.addEventListener('error',event=>{event.preventDefault();failRequests(event.message||'Worker crashed');});
worker.addEventListener('messageerror',()=>failRequests('Could not read the worker response'));
