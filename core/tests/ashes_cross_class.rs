use d3cube::{data::Data, sim::{chain_roots, Sim}};
use std::rc::Rc;

fn check_observed_rolls(json: &str) {
    let d = Rc::new(Data::from_json(include_str!("../../web/data.json")).unwrap());
    let fixture: serde_json::Value = serde_json::from_str(json).unwrap();
    let crafter = d.classes.iter().position(|c| c == fixture["craft_class"].as_str().unwrap()).unwrap();
    let hero = d.classes.iter().position(|c| c == fixture["upgrade_class"].as_str().unwrap()).unwrap();
    let slot = d.slots.iter().find(|s| s.name == fixture["slot"].as_str().unwrap()).unwrap();
    let position = fixture["upgrade"].as_u64().unwrap() as u32;
    let root = chain_roots(&slot.pools[crafter], slot.key, fixture["season"].as_u64().unwrap() as u32,
        fixture["hardcore"].as_bool().unwrap(), position, true, crafter, &d.items)
        .into_iter().find(|r| r.n == position).unwrap();
    assert_eq!(d.items[root.item].name, fixture["item"].as_str().unwrap());
    if let Some(observed) = fixture["starting_item_observation"].as_object() {
        let mut crafter_sim = Sim::new(d.clone(), crafter, true);
        let aff = crafter_sim.drop_item(root.item, root.x0, root.ancient, root.primal);
        let lines = crafter_sim.values(root.item, root.seed, &aff);
        for (stem, expected) in observed {
            let line = lines.iter().find(|l| l.aff.map_or(false, |a| d.affixes[a].stem == *stem)).unwrap();
            assert!((line.value - expected.as_f64().unwrap()).abs() < 1e-9, "starting item {stem}");
        }
    }
    let mut sim = Sim::new(d.clone(), hero, true);
    let mut seed = root.seed;
    let outcomes = fixture["outcomes"].as_array().unwrap();
    assert_eq!(outcomes.len(), 3);
    for (i, row) in outcomes.iter().enumerate() {
        assert_eq!(row["iteration"].as_u64().unwrap(), (i + 1) as u64);
        let (aff, next) = sim.primalize(root.item, seed);
        let mut actual: Vec<_> = aff.iter().map(|&a| d.affixes[a].stem.as_str()).collect();
        if let Some(built_in) = fixture["built_in_stats"].as_object() {
            let lines = sim.values_max(root.item, &aff);
            for (stem, attr) in built_in {
                assert!(lines.iter().any(|l| l.aff.is_none() && l.attr as u64 == attr.as_u64().unwrap() && l.value > 0.0),
                    "missing built-in stat {stem}");
                actual.push(stem.as_str());
            }
        }
        if let Some(omitted) = fixture["omitted_stats"].as_array() {
            actual.retain(|s| !omitted.iter().any(|v| v.as_str() == Some(*s)));
        }
        let mut expected: Vec<_> = row["stats"].as_array().unwrap().iter().map(|s| s.as_str().unwrap()).collect();
        actual.sort_unstable();
        expected.sort_unstable();
        assert_eq!(actual, expected, "observed ashes roll {}", i + 1);
        seed = next;
    }
}

#[test]
fn barbarian_ashes_on_dh_helm_matches_three_observed_rolls() {
    check_observed_rolls(include_str!("../../testdata/ashes_cross_class_helm.json"));
}

#[test]
fn barbarian_ashes_on_dh_dagger_matches_three_observed_rolls() {
    check_observed_rolls(include_str!("../../testdata/ashes_cross_class_dagger.json"));
}

#[test]
fn barbarian_ashes_on_dh_quiver_matches_three_observed_rolls() {
    check_observed_rolls(include_str!("../../testdata/ashes_cross_class_quiver.json"));
}
