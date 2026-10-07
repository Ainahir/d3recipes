//! Print both traces, or explicitly regenerate editable fixtures with --write-fixtures.
use d3cube::{data::Data, sim::{chain_roots, Sim}};
use std::rc::Rc;

fn trace(d: Rc<Data>, slot_name: &str, item_name: &str, affix_count: usize) -> serde_json::Value {
    let hero = d.classes.iter().position(|c| c == "DemonHunter").unwrap();
    let slot = d.slots.iter().find(|s| s.name == slot_name).unwrap();
    let root = chain_roots(&slot.pools[hero], slot.key, 40, false, 1, true, hero, &d.items)
        .into_iter().find(|r| r.n == 1).unwrap();
    assert_eq!(d.items[root.item].name, item_name);
    let mut sim = Sim::new(d.clone(), hero, true);
    let mut seed = root.seed;
    let mut outcomes = Vec::new();
    for iteration in 1..=15 {
        let input_seed = seed;
        let (aff, next_seed) = sim.sanctify(root.item, seed);
        assert_eq!(aff.len(), affix_count, "{item_name}, roll {iteration}");
        let mut stats: Vec<_> = sim.values_max(root.item, &aff).iter().map(|line| {
            serde_json::json!({"stat": line.aff.map(|a| d.affixes[a].stem.as_str()).unwrap_or("item power"), "value": line.value})
        }).collect();
        stats.extend(aff.iter().filter(|&&a| d.affixes[a].specs.is_empty())
            .map(|&a| serde_json::json!({"stat": d.affixes[a].stem, "value": 0})));
        outcomes.push(serde_json::json!({"iteration": iteration, "input_seed": input_seed, "next_seed": next_seed, "stats": stats}));
        seed = next_seed;
    }
    serde_json::json!({
        "identifier": format!("S40-SC-DH-{}-1", slot_name.to_uppercase()),
        "season": 40, "hardcore": false, "class": "DemonHunter", "slot": slot_name,
        "upgrade": 1, "item": item_name, "item_id": d.items[root.item].id,
        "starting_seed": root.seed, "affix_count": affix_count,
        "source": "Generated from Sim::sanctify; amend expected outcomes after checking in game.",
        "notes": "Ordinary affixes only; Sanctify power replacement is not modeled. Percentages are fractions (0.15 = 15%); Sockets value 0 indicates presence. Built-in item power/damage lines are not counted as affixes.",
        "outcomes": outcomes
    })
}

fn main() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    let d = Rc::new(Data::from_json(&std::fs::read_to_string(root.join("web/data.json")).unwrap()).unwrap());
    let write = std::env::args().any(|arg| arg == "--write-fixtures");
    for (file, slot, item, count) in [
        ("sanctify_6_affix.json", "Helm", "Accursed Visage", 6),
        ("sanctify_5_affix.json", "Dagger", "Karlei's Point", 5),
    ] {
        let result = trace(d.clone(), slot, item, count);
        let json = serde_json::to_string_pretty(&result).unwrap() + "\n";
        if write {
            let path = root.join("testdata").join(file);
            std::fs::write(&path, json).unwrap();
            println!("{}: 15 consecutive outcomes, starting seed {}", path.display(), result["starting_seed"]);
        } else { println!("{json}"); }
    }
}
