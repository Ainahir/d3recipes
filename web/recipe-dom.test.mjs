import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./recipe.js',import.meta.url),'utf8');
const element=tag=>({tag,children:[],textContent:'',append(...children){this.children.push(...children);}});
const context=vm.createContext({document:{createElement:element},slotPlural:()=> 'helms',stopOn:cp=>cp.name,statName:s=>s,RANGE_STEMS:new Set()});
vm.runInContext(source.slice(source.indexOf('export function stepsElement'),source.indexOf('// Full-tooltip rows')).replace('export ',''),context);
test('recipe DOM preserves steps, class swaps, checkpoint notes and Mystic instructions as text',()=>{
  const markup='<img src=x onerror=alert(1)>';
  const h={hope:8,slot:'Helm',root_name:'A',name:'B',route:[['R',8],['C',1]],route_class:[1,0],checkpoints:[{name:markup},{name:'checkpoint'}],mystic:['Dex'],mystic_class:1};
  const list=context.stepsElement(h,['Crit'],new Set(['Crit']),{cls:0,name:()=>markup});
  assert.equal(list.className,'steps');assert.equal(list.children.length,4);
  assert.equal(list.children[0].textContent,'Craft & upgrade 8 helms');
  assert.equal(list.children[0].children[1].textContent,'as '+markup);
  assert.equal(list.children[0].children[3].textContent,'(stop on '+markup+')');
  assert.equal(list.children[1].textContent,'Reforge ×8');assert.equal(list.children[2].textContent,'Convert ×1');
  assert.equal(list.children[3].children.at(-1),': Dex → Crit');
});
