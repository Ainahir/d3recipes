// Reader for the build-definition TOML format, including comments and multiline arrays.
export function parseBuildToml(text) {
  let clean='', quote='', escaped=false, comment=false;
  for (const c of text.replace(/^\uFEFF/,'')) {
    if(comment){if(c==='\n'){comment=false;clean+=c;}continue;}
    if(quote){clean+=c;if(quote==='"'&&c==='\\'&&!escaped){escaped=true;continue;}if(c===quote&&!escaped)quote='';escaped=false;}
    else if(c==='"'||c==="'"){quote=c;clean+=c;}
    else if(c==='#')comment=true;
    else clean+=c;
  }
  if(quote)throw Error('Unterminated TOML string.');
  const statements=[];let buffer='',depth=0;quote='';escaped=false;
  for(const c of clean+'\n'){
    if(quote){buffer+=c;if(quote==='"'&&c==='\\'&&!escaped){escaped=true;continue;}if(c===quote&&!escaped)quote='';escaped=false;continue;}
    if(c==='"'||c==="'"){quote=c;buffer+=c;continue;}
    if(c==='[')depth++;if(c===']')depth--;
    if(depth<0)throw Error('Unexpected closing bracket.');
    if(c==='\n'&&depth===0){if(buffer.trim())statements.push(buffer.trim());buffer='';}else buffer+=c;
  }
  if(depth)throw Error('Unclosed TOML array.');
  function value(raw){
    if(raw.startsWith('[')){
      const result=[];let rest=raw.slice(1,-1).trim();
      while(rest){const match=/^("(?:\\.|[^"\\])*"|'[^']*')\s*(,|$)/s.exec(rest);if(!match)throw Error('Expected an array of strings.');result.push(value(match[1]));rest=rest.slice(match[0].length).trim();}
      return result;
    }
    if(raw.startsWith("'")&&raw.endsWith("'"))return raw.slice(1,-1);
    if(raw.startsWith('"')){try{return JSON.parse(raw);}catch{throw Error('Invalid quoted TOML string.');}}
    if(raw==='true'||raw==='false')return raw==='true';
    if(/^[-+]?\d+(\.\d+)?$/.test(raw))return Number(raw);
    throw Error('Unsupported TOML value: '+raw);
  }
  const builds=[];let build=null,target=null;
  for(const line of statements){
    if(line==='[[build]]'){build={slot:[]};builds.push(build);target=build;continue;}
    if(line==='[[build.slot]]'){if(!build)throw Error('A build slot must follow [[build]].');target={};build.slot.push(target);continue;}
    if(line.startsWith('[')){target=null;continue;}
    if(!target)continue;
    const m=/^([\w-]+)\s*=\s*([\s\S]+)$/.exec(line);if(!m)throw Error('Invalid TOML assignment: '+line);
    if(Object.hasOwn(target,m[1]))throw Error('Duplicate field: '+m[1]);target[m[1]]=value(m[2]);
  }
  if(!builds.length)throw Error('No [[build]] entries found.');
  for(const b of builds){if(typeof b.name!=='string'||!b.name.trim())throw Error('Every build needs a name.');for(const r of b.slot){if(typeof r.name!=='string'||(!r.any_item&&(!Array.isArray(r.items)||!r.items.length||r.items.some(x=>typeof x!=='string')))||!Array.isArray(r.stat_priority??[]))throw Error('Every imported slot needs a name, items, and optional stat_priority array.');}}
  return builds;
}
