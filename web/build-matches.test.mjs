import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./search-builds.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function targetStats('),source.indexOf('function searchItems(')),context);
test('best candidate prefers match count then cheapest cost regardless of tier',()=>{
  const candidate=(tier,count,cost)=>({tier,hit:{matched:Array(count).fill(0),cost}});
  assert.equal(context.bestCandidate([candidate('primal',2,100),candidate('ancient',2,10)]).tier,'ancient');
  assert.equal(context.bestCandidate([candidate('primal',1,1),candidate('normal',2,20)]).tier,'normal');
});
test('imported priorities search first two stats and allow third at Mystic',()=>{
  const row={wants:['A','B','C','D'].map(stem=>({stem,min:null,imported:true}))};
  const query=context.priorityQuery(row);
  assert.deepEqual(Array.from(query.wants,w=>w.fam[0]),['A','B']);assert.equal(query.min_match,2);
  assert.deepEqual(Array.from(query.mystic),['C']);assert.deepEqual(Array.from(query.keep),['A','B']);assert.equal(query.mystic_finish,true);
  assert.equal(context.targetStats(row).length,3);
});
test('two imported priorities allow Mystic to finish the second',()=>{
  const query=context.priorityQuery({wants:['A','B'].map(stem=>({stem,min:null,imported:true}))});
  assert.equal(query.min_match,1);assert.deepEqual(Array.from(query.keep),['A']);
});
test('manually selected required affixes retain all requirements',()=>{
  const row={wants:['A','B','C','D'].map(stem=>({stem,min:null}))};
  assert.equal(Object.keys(context.priorityQuery(row)).length,0);assert.equal(context.targetStats(row).length,4);
});
