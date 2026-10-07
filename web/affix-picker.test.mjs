import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./affix-picker.js',import.meta.url),'utf8');
const {combo}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('disposal removes document and input listeners, including after repeated replacements',()=>{
  const document=new EventTarget();globalThis.document=document;
  const input=new EventTarget();input.setAttribute=()=>{};
  let containsCalls=0,sourceCalls=0;
  const box=new EventTarget();box.contains=()=>{containsCalls++;return false;};
  for(let i=0;i<20;i++){
    const picker=combo(input,box,()=>{sourceCalls++;return [];},'Empty',()=>{});
    document.dispatchEvent(new Event('click'));assert.equal(containsCalls,i+1);
    picker.dispose();picker.dispose();
    document.dispatchEvent(new Event('click'));assert.equal(containsCalls,i+1);
    input.dispatchEvent(new Event('focus'));assert.equal(sourceCalls,0);
    assert.equal(box.hidden,true);
  }
});
