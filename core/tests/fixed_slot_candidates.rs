// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! The stat list of custom search offers every affix a fixed slot can roll, including those the slot takes only when
//! no member fits the item's type: a Stone of Jordan's maximum-resource line (issue 12, reported by Ainahir).
use d3cube::data::Data;
use d3cube::sim::Sim;
use std::rc::Rc;

fn data() -> Rc<Data> {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../web/data.json");
    Rc::new(Data::from_json(&std::fs::read_to_string(p).expect("web/data.json")).unwrap())
}

fn stems(d: &Data, list: &[usize]) -> Vec<String> {
    let mut v: Vec<String> = list.iter().map(|&a| d.affixes[a].stem.clone()).collect();
    v.sort();
    v.dedup();
    v
}

#[test]
fn stone_of_jordan_offers_its_class_maximum_resource() {
    let d = data();
    let item = d.items.iter().position(|i| i.name == "Stone of Jordan").unwrap();
    // each class's own maximum-resource line (the game's list for the ring: Discipline, Fury, Arcane Power, Mana, Spirit,
    // Wrath, Essence), in the order of the data's classes
    let own = ["MaxDiscipline", "MaxFury", "MaxArcanePower", "MaxMana", "MaxSpirit", "MaxWrath", "MaxEssence"];
    for cls in 0..7 {
        let mut sim = Sim::new(d.clone(), cls, true);
        let got = stems(&d, &sim.candidate_affixes(item));
        let resources: Vec<&String> = got.iter().filter(|s| s.starts_with("Max")).collect();
        assert_eq!(resources, vec![own[cls]], "class {cls}");
    }
}

#[test]
fn every_affix_a_stone_of_jordan_rolls_is_offered() {
    let d = data();
    let item = d.items.iter().position(|i| i.name == "Stone of Jordan").unwrap();
    for cls in 0..7 {
        let mut sim = Sim::new(d.clone(), cls, true);
        let offered = stems(&d, &sim.candidate_affixes(item));
        for seed in 1..300u32 {
            let r = sim.reforge(item, seed);
            let (crafted, _) = sim.primalize(item, seed);
            for a in r.affixes.iter().chain(crafted.iter()) {
                assert!(offered.contains(&d.affixes[*a].stem), "class {cls} seed {seed}: {} rolled but not offered", d.affixes[*a].stem);
            }
        }
    }
}
