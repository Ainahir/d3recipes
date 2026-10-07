use d3cube::{data::Data, sim::{chain_roots, Sim}};
use std::rc::Rc;

fn main() {
    let d = Rc::new(Data::from_json(&std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../web/data.json")
    ).unwrap()).unwrap());
    let hero = d.classes.iter().position(|c| c == "DemonHunter").unwrap();
    let slot = d.slots.iter().find(|s| s.name == "Helm").unwrap();
    let root = chain_roots(&slot.pools[hero], slot.key, 40, false, 1, true, hero, &d.items)
        .into_iter().find(|r| r.n == 1).unwrap();
    assert_eq!(d.items[root.item].name, "Accursed Visage");
    assert_eq!(root.seed, 2438299784);
    let mut sim = Sim::new(d.clone(), hero, true);
    let mut seed = root.seed;
    let mut outcomes = Vec::new();
    for iteration in 1..=16 {
        let input_seed = seed;
        let (aff, next_seed) = sim.sanctify(root.item, seed);
        // Check the copied affix-generation path still matches ashes.
        let (ashes_aff, _) = sim.primalize(root.item, seed);
        assert_eq!(aff, ashes_aff);
        let mut stats: Vec<_> = sim.values_max(root.item, &aff).iter().map(|line| {
            serde_json::json!({"stat": line.aff.map(|a| d.affixes[a].stem.as_str()).unwrap_or("item power"), "value": line.value})
        }).collect();
        stats.extend(aff.iter().filter(|&&a| d.affixes[a].specs.is_empty())
            .map(|&a| serde_json::json!({"stat": d.affixes[a].stem, "value": 0})));
        outcomes.push(serde_json::json!({"iteration": iteration, "input_seed": input_seed, "next_seed": next_seed, "stats": stats}));
        seed = next_seed;
    }
    println!("{}", serde_json::to_string_pretty(&serde_json::json!({
        "identifier": "S40-SC-DH-HELM-1", "model": "ashes affixes; next seed one draw earlier", "outcomes": outcomes
    })).unwrap());
}
