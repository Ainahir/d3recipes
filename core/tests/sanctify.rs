use d3cube::{data::Data, sim::{chain_roots, Sim}};
use std::rc::Rc;

fn data() -> Rc<Data> {
    Rc::new(Data::from_json(include_str!("../../web/data.json")).unwrap())
}

#[test]
fn five_affix_sanctify_matches_ashes_including_subsequent_reforges() {
    let d = data();
    let item = d.items.iter().position(|i| i.name == "The Furnace").unwrap();
    let mut ashes = Sim::new(d.clone(), 1, true);
    let mut sanctify = Sim::new(d, 1, true);
    for start in [0, 1, 2438299784, u32::MAX] {
        let mut seed = start;
        for _ in 0..16 {
            let expected = ashes.primalize(item, seed);
            assert_eq!(expected.0.len(), 5);
            let actual = sanctify.sanctify(item, seed);
            assert_eq!(actual, expected, "input seed {seed}");
            let a = ashes.reforge(item, expected.1);
            let s = sanctify.reforge(item, actual.1);
            assert_eq!((s.affixes, s.child_seed, s.ancient, s.primal),
                       (a.affixes, a.child_seed, a.ancient, a.primal));
            seed = actual.1;
        }
    }
}

fn check_fixture(json: &str) {
    let d = data();
    let fixture: serde_json::Value = serde_json::from_str(json).unwrap();
    let hero = d.classes.iter().position(|c| c == fixture["class"].as_str().unwrap()).unwrap();
    let slot = d.slots.iter().find(|s| s.name == fixture["slot"].as_str().unwrap()).unwrap();
    let position = fixture["upgrade"].as_u64().unwrap() as u32;
    let root = chain_roots(&slot.pools[hero], slot.key, fixture["season"].as_u64().unwrap() as u32,
        fixture["hardcore"].as_bool().unwrap(), position, true, hero, &d.items)
        .into_iter().find(|r| r.n == position).unwrap();
    let item = root.item;
    assert_eq!(d.items[item].name, fixture["item"].as_str().unwrap());
    assert_eq!(d.items[item].id as u64, fixture["item_id"].as_u64().unwrap());
    assert_eq!(root.seed as u64, fixture["starting_seed"].as_u64().unwrap());
    let mut sim = Sim::new(d.clone(), hero, true);
    let mut seed = root.seed;
    let outcomes = fixture["outcomes"].as_array().unwrap();
    assert_eq!(outcomes.len(), 15);
    for (index, outcome) in outcomes.iter().enumerate() {
        assert_eq!(outcome["iteration"].as_u64().unwrap(), (index + 1) as u64);
        assert_eq!(seed as u64, outcome["input_seed"].as_u64().unwrap());
        let (aff, next) = sim.sanctify(item, seed);
        assert_eq!(aff.len() as u64, fixture["affix_count"].as_u64().unwrap());
        assert_eq!(next as u64, outcome["next_seed"].as_u64().unwrap(), "roll {} next seed", index + 1);
        let mut stats: Vec<_> = sim.values_max(item, &aff).iter().map(|l| {
            serde_json::json!({"stat": l.aff.map(|a| d.affixes[a].stem.as_str()).unwrap_or("item power"), "value": l.value})
        }).collect();
        stats.extend(aff.iter().filter(|&&a| d.affixes[a].specs.is_empty())
            .map(|&a| serde_json::json!({"stat": d.affixes[a].stem, "value": 0})));
        let mut expected = outcome["stats"].as_array().unwrap().clone();
        stats.sort_by_key(|s| s.to_string());
        expected.sort_by_key(|s| s.to_string());
        assert_eq!(stats, expected, "{} roll {} stats", d.items[item].name, index + 1);
        seed = next;
    }
}

#[test]
fn six_affix_helm_matches_editable_game_fixture() {
    check_fixture(include_str!("../../testdata/sanctify_6_affix.json"));
}

#[test]
fn five_affix_dagger_matches_editable_game_fixture() {
    check_fixture(include_str!("../../testdata/sanctify_5_affix.json"));
}
