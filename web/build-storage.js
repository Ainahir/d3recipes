export const KEY = 'd3recipes-user-builds-v1';
export function readBuilds() {
  const list = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(list)) throw Error('Invalid saved build data');
  return list;
}
// Never retain a storage snapshot across asynchronous preparation or user input.
export function updateBuilds(change) {
  if (!navigator.locks) throw Error('Saving builds requires a browser with Web Locks support.');
  return navigator.locks.request(KEY, () => {
    const list = readBuilds();
    const result = change(list);
    if (result?.retry) return result;
    localStorage.setItem(KEY, JSON.stringify(list));
    return result;
  });
}
const normalize = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
export const content = build => JSON.stringify(build.definition);
export function importPlan(list, incoming) {
  return incoming.map(build => {
    const prior = list.find(saved => normalize(saved.name) === normalize(build.name));
    return {build, prior, conflict: !!prior && content(prior) !== content(build)};
  });
}
export const conflictSnapshot = plan => JSON.stringify(plan.filter(p => p.conflict).map(p => [p.build.id, p.prior.id, p.prior]));
export function applyImport(list, incoming, choice, approved) {
  const plan = importPlan(list, incoming);
  if (conflictSnapshot(plan) !== approved) return {retry:true};
  let added=0, replaced=0, skipped=0;
  for (const {build, prior, conflict} of plan) {
    if (prior && (!conflict || choice === 'keep')) {skipped++; continue;}
    if (prior && choice === 'overwrite') {
      list.splice(list.indexOf(prior), 1, {...build, id:prior.id}); replaced++;
    } else {
      const copy = structuredClone(build);
      if (prior) {
        const base = copy.name + ' - Imported'; let name=base, n=2;
        while (list.some(b => normalize(b.name) === normalize(name))) name=base+' '+n++;
        copy.name=name; copy.definition.name=name;
      }
      list.push(copy); added++;
    }
  }
  return {added,replaced,skipped};
}
