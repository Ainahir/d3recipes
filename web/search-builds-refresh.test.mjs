import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./search-builds.js',import.meta.url),'utf8');
function harness(saved,loaded){
  const controls=new Map();
  const $=id=>{if(!controls.has(id))controls.set(id,{textContent:'',innerHTML:'',replaceChildren(){this.innerHTML='';},querySelectorAll:()=>[]});return controls.get(id);};
  const select={value:loaded.id,replaceChildren(){this.value='';},add(){}};
  const messages=[];
  const context=vm.createContext({localStorage:{getItem:()=>JSON.stringify(saved)},key:'builds',select,status:{textContent:''},Option:function(){},$,build:loaded,rows:[{item:1}],active:{row:{}},job:10,info:{items:[]},worker:{postMessage:m=>messages.push(m)},esc:String,statName:String});
  vm.runInContext(source.slice(source.indexOf('function refresh()'),source.indexOf("document.getElementById('search-builds-create')"))+source.slice(source.indexOf('function cancel()'),source.indexOf("select.addEventListener('change'")),context);
  return {context,controls,messages};
}
const original={id:'a',class:0,slots:[{item:1,slot:'Head',wants:[]}]};
test('edited build cancels active job and rebuilds rows from saved record',()=>{
  const updated={...original,class:5,slots:[{item:2,slot:'Chest',wants:[{stem:'Dex'}]}]};
  const h=harness([updated],original);h.context.refresh();
  assert.equal(h.context.active,null);assert.equal(h.context.job,11);
  assert.equal(h.context.build.class,5);assert.equal(h.context.rows[0].item,2);assert.equal(h.context.rows[0].wants[0].stem,'Dex');
  assert.equal(h.messages[0].type,'cancel');
});
test('deleted selected build cancels search, clears rows, and disables Run',()=>{
  const h=harness([],original);h.context.refresh();
  assert.equal(h.context.active,null);assert.equal(h.context.build,undefined);assert.equal(h.context.rows.length,0);assert.equal(h.controls.get('run').disabled,true);
});
test('unchanged saved record preserves active search and rows',()=>{
  const h=harness([original],original);h.context.refresh();
  assert.notEqual(h.context.active,null);assert.equal(h.context.job,10);assert.equal(h.messages.length,0);
});
