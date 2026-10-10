import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./search-builds.js',import.meta.url),'utf8');
function harness(active){
  const messages=[];let advanced=0;
  const context=vm.createContext({active,job:1,document:{getElementById:()=>({textContent:''})},worker:{postMessage:m=>messages.push(m)},nextRow:()=>advanced++});
  vm.runInContext(source.slice(source.indexOf('function setOwned('),source.indexOf("select.addEventListener('change'")),context);
  return {context,messages,advanced:()=>advanced};
}
test('newly needed rows are queued once and stale results cleared',()=>{
  const row={index:1,owned:true,best:{},results:{primal:{}}},current={index:0};
  const h=harness({row:current,queue:[]});h.context.setOwned(row,false);h.context.setOwned(row,false);
  assert.equal(h.context.active.queue.length,1);assert.equal(h.context.active.queue[0],row);assert.equal(row.best,null);assert.equal(Object.keys(row.results).length,0);
  h.context.setOwned(row,true);assert.equal(h.context.active.queue.length,0);assert.equal(h.messages.length,0);
});
test('marking current row owned cancels its job and advances queue',()=>{
  const row={index:0};const h=harness({row,queue:[]});h.context.setOwned(row,true);
  assert.equal(h.messages[0].type,'cancel');assert.equal(h.context.job,2);assert.equal(h.advanced(),1);
});
test('changing ownership without an active search clears results without starting work',()=>{
  const row={index:0,best:{}};const h=harness(null);h.context.setOwned(row,false);
  assert.equal(row.best,null);assert.equal(h.advanced(),0);assert.equal(h.messages.length,0);
});

test('ownership checkbox handler preserves the active build run',()=>{
 const row={index:0,owned:false},other={index:1},run={row:other,queue:[row]};
 const h=harness(run);
 h.context.rows=[row];
 h.context.status={textContent:""};
 h.context.cancel=()=>{h.context.active=null;};
 vm.runInContext(source.slice(source.indexOf('function handleRowOption('),source.indexOf('function setOwned(')),h.context);
 const checkbox={dataset:{row:'0'},checked:true,closest:()=>({querySelectorAll:()=>[checkbox]})};
 h.context.handleRowOption(checkbox);
 assert.equal(h.context.active,run);
 assert.equal(run.queue.length,0);
 assert.equal(row.owned,true);
 checkbox.checked=false;
 h.context.handleRowOption(checkbox);
 assert.equal(h.context.active,run);
 assert.equal(run.queue[0],row);
});
test('search-mode change cancels the run and invalidates every displayed result',()=>{
 const row={index:0,owned:true},previous={index:1,owned:false,best:{},results:{primal:{}},limited:true},run={row,queue:[]};
 const h=harness(run);
 h.context.rows=[row];
 h.context.status={textContent:""};
 h.context.cancel=()=>{h.context.active=null;};
 vm.runInContext(source.slice(source.indexOf('function handleRowOption('),source.indexOf('function setOwned(')),h.context);
 h.context.rows.push(previous);
 const cells=new Map();
 h.context.document={getElementById:id=>{if(!cells.has(id))cells.set(id,{textContent:'Old result'});return cells.get(id);}};
 const checkbox={dataset:{crafted:'0'},checked:true,closest:()=>({querySelectorAll:()=>[checkbox]})};
 h.context.handleRowOption(checkbox);
 assert.equal(h.context.active,null);
 assert.equal(row.searchCrafted,true);
 assert.equal(row.owned,false);
 assert.equal(previous.best,null);
 assert.equal(Object.keys(previous.results).length,0);
 assert.equal(previous.limited,false);
 assert.match(cells.get('build-match-1').textContent,/Search cancelled/);
 assert.match(h.context.status.textContent,/Build search cancelled/);
});
