import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./build-storage.js',import.meta.url),'utf8');
const {importPlan,conflictSnapshot,applyImport,updateBuilds,readBuilds}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const build=(id,name,value)=>({id,name,definition:{name,value}});
test('conflict choices preserve, replace, or copy the saved build',()=>{
  for(const choice of ['keep','overwrite','copies']){
    const list=[build('saved','Alpha',1)],incoming=[build('imported','Alpha',2),build('new','Beta',1)];
    applyImport(list,incoming,choice,conflictSnapshot(importPlan(list,incoming)));
    assert.equal(list.find(b=>b.name==='Beta').id,'new');
    assert.equal(list[0].id,'saved');
    assert.equal(list[0].definition.value,choice==='overwrite'?2:1);
    if(choice==='copies'){assert.equal(list[1].name,'Alpha - Imported');assert.equal(list[1].definition.name,list[1].name);}
  }
});
test('changed conflicts cannot use an earlier overwrite approval',()=>{
  const list=[build('saved','Alpha',1)],incoming=[build('imported','Alpha',2)];
  const approved=conflictSnapshot(importPlan(list,incoming));
  list[0].definition.value=3;
  assert.deepEqual(applyImport(list,incoming,'overwrite',approved),{retry:true});
  assert.equal(list[0].definition.value,3);
});
test('identical imports are skipped',()=>{
  const list=[build('saved','Alpha',1)],incoming=[build('imported','Alpha',1)];
  assert.equal(applyImport(list,incoming,'keep',conflictSnapshot(importPlan(list,incoming))).skipped,1);
  assert.equal(list.length,1);
});
test('coordinated writes read current data and retry never writes',async()=>{
  let stored='[]',queue=Promise.resolve();
  globalThis.localStorage={getItem:()=>stored,setItem:(_,value)=>stored=value};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:(_,fn)=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;}}}});
  await Promise.all([updateBuilds(list=>list.push(build('a','A',1))),updateBuilds(list=>list.push(build('b','B',1)))]);
  assert.equal(readBuilds().length,2);
  const before=stored;await updateBuilds(()=>({retry:true}));assert.equal(stored,before);
});
