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
 const removed=crafted.lines.filter(l=>!sanctified.lines.some(s=>s.stem===l.stem));
 assert.ok(removed.length);
 for(const line of removed){
  const result=search('Helm','sanctified',[{fam:[line.stem]}]);
  assert.equal(result.full.length,0);
 }
 assert.ok(search('Helm','crafted').full.some(h=>h.route_class.at(-1)===1));
 assert.equal(tooltipRows(sanctified.lines).at(-1).label,'One of 3 sanctified powers for this class (random)');
});
