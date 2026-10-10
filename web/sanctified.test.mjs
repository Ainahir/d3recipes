import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initSync,Engine} from './pkg/d3cube.js';
import {hitHtml} from './ui.js';
import {tooltipRows} from './recipe.js';
initSync({module:await readFile(new URL('./pkg/d3cube_bg.wasm',import.meta.url))});
const data=JSON.parse(await readFile(new URL('./data.json',import.meta.url),'utf8'));
const engine=new Engine(JSON.stringify(data));
function search(slot,quality,wants=[]){
 const handle=engine.search(JSON.stringify({class:0,season:40,slots:[slot],maxpos:1,maxsteps:1,quality,
 end_on_primalize:quality==='crafted',max_primalize:1,max_sanctify:1,max_convert:0,switch:[1],max_switch:1,
 cost_p:1,cost_s:1,cost_h:1,cost_r:10000,top:10,wants,trail:true}));
 while(!handle.run(1000)){}
 return JSON.parse(handle.results());
}
test('Sanctified endpoints finish on DH and show only one secondary plus power',()=>{
 for(const slot of ['Helm','Dagger']){
  const result=search(slot,'sanctified');
  assert.ok(result.full.length);
  for(const hit of result.full){
   assert.equal(hit.quality,'sanctified');
   assert.equal(hit.route.at(-1)[0],'S');
   assert.equal(hit.route_class.at(-1),0);
   assert.equal(hit.lines.filter(l=>l.stem==='sanctified power').length,1);
   const item=data.items.find(i=>i.id===hit.item);
   const html=hitHtml(hit,'sanctified',[],item,0,40,c=>data.classes[c]);
   assert.match(html,/Best · Sanctified/);
   assert.match(html,/sanctified power/);
   assert.match(html,/Angelic Crucible/);
   assert.doesNotMatch(html,/Or use an Angelic Crucible/);
  }
 }
});
test('replaced secondary cannot satisfy Sanctified requirements; Crafted remains intact',()=>{
 const crafted=search('Helm','crafted').full.find(h=>h.route_class.at(-1)===0);
 const sanctified=search('Helm','sanctified').full[0];
 // S40-SC-DH-HELM-1: the first secondary is HitFear, the second is Thorns.
 // These expectations are fixed independently of the Sanctified output.
 assert.ok(crafted.lines.some(l=>l.stem==='HitFear'));
 assert.ok(crafted.lines.some(l=>l.stem==='Thorns'));
 assert.ok(sanctified.lines.some(l=>l.stem==='HitFear'),'first secondary must remain');
 assert.ok(!sanctified.lines.some(l=>l.stem==='Thorns'),'second secondary must be replaced');
 assert.ok(search('Helm','sanctified',[{fam:['HitFear']}]).full.length,'retained secondary must satisfy matching');
 assert.equal(search('Helm','sanctified',[{fam:['Thorns']}]).full.length,0,'replaced secondary must not satisfy matching');
 assert.ok(search('Helm','crafted').full.some(h=>h.route_class.at(-1)===1));
 assert.equal(tooltipRows(sanctified.lines).at(-1).label,'One of 3 sanctified powers for this class (random)');
});

test('broad any queries include Sanctified endpoints on the selected class',()=>{
 const result=search('Helm','any');
 const hits=result.full.filter(h=>h.quality==='sanctified');
 assert.ok(hits.length,'any must register Sanctified results');
 for(const hit of hits){
  assert.equal(hit.route.at(-1)[0],'S');
  assert.equal(hit.route_class.at(-1),0);
  assert.equal(hit.lines.filter(l=>l.stem==='sanctified power').length,1);
 }
});

test('five-affix Sanctified items retain their ordinary stats',()=>{
 const crafted=search('Dagger','crafted').full.find(h=>h.route_class.at(-1)===0);
 const sanctified=search('Dagger','sanctified').full[0];
 assert.ok(crafted && sanctified);
 assert.deepEqual(sanctified.lines.filter(l=>l.stem!=='sanctified power'),crafted.lines);
});
