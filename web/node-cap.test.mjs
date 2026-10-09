import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capFor} from './ui.js';
test('node cap tiers: 3 million is the floor and only roomy desktops go above it',()=>{
  const f=3_000_000;
  assert.equal(capFor({}),f);                                     // no deviceMemory (Firefox, Safari)
  assert.equal(capFor({memoryGB:2}),f);assert.equal(capFor({memoryGB:0.5}),f);
  assert.equal(capFor({memoryGB:4}),5_000_000);
  assert.equal(capFor({memoryGB:8}),10_000_000);
  assert.equal(capFor({memoryGB:8,small:true}),f);                // phones and tablets
  assert.equal(capFor({memoryGB:8,killed:true}),f);               // a page the system killed during a search
  for(const gb of [undefined,0.25,1,2,4,8])for(const small of [false,true])for(const killed of [false,true])assert.ok(capFor({memoryGB:gb,small,killed})>=f);
});
