// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! Crafting the root as any class (`craft_any`): a primal Squirt's Necklace with CHC, CHD and Lightning Damage searched as a
//! Wizard can only get cheaper when every class's Hope of Cain may craft it, here by crafting as another class (one hand-over),
//! and each route replays (root rolled by its crafter) to the tooltip it reported. With no hand-overs only the Wizard crafts.
use d3cube::data::Data;
use d3cube::plan::Query;
use d3cube::run_query;
use std::rc::Rc;

fn data() -> Rc<Data> {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../web/data.json");
    Rc::new(Data::from_json(&std::fs::read_to_string(p).expect("web/data.json")).unwrap())
}

fn query(craft_any: bool, max_switch: u32) -> Query {
    serde_json::from_value(serde_json::json!({
        "class": 2, "slots": ["Amulet"], "items": [1187653737], "quality": "primal", "max_primalize": 255, "max_convert": 0,
        "cost_h": 100, "cost_r": 500, "cost_p": 2500, "cost_switch": 100, "switch": [0, 1, 3, 4, 5, 6], "max_switch": max_switch,
        "wants": [{"fam": ["CriticalChance"]}, {"fam": ["CriticalD"]}, {"fam": ["DamageBonusLightning"]}], "min_match": 3,
        "end_on_near": true, "top": 4, "craft_any": craft_any
    }))
    .unwrap()
}

#[test]
fn crafting_as_any_class() {
    let d = data();
    let alone = run_query(d.clone(), query(false, 2), 20_000);
    let any = run_query(d.clone(), query(true, 2), 20_000);
    let none = run_query(d, query(true, 0), 20_000);
    assert!(none.near.iter().all(|h| h.craft_class == 2 && h.route_class.iter().all(|&c| c == 2)));
    let (a, m) = (&alone.near[0], &any.near[0]);
    println!("alone: cost {} hope {} by {} {:?} {:?}", a.cost, a.hope, a.craft_class, a.route, a.route_class);
    println!("any:   cost {} hope {} by {} {:?} {:?}", m.cost, m.hope, m.craft_class, m.route, m.route_class);
    assert!(alone.near.iter().all(|h| h.craft_class == 2));
    assert!(m.cost < a.cost);
    assert!(any.near.iter().any(|h| h.craft_class != 2));
    // crafting as another class counts toward `max_switch` like any hand-over
    assert!(any.near.iter().all(|h| (h.craft_class != 2) as usize + h.route_class.windows(2).filter(|w| w[0] != w[1]).count() + (h.route_class.first().map_or(false, |&c| c != h.craft_class)) as usize <= 2));
    for h in any.near.iter().chain(&alone.near) {
        let last = h.checkpoints.last().unwrap();
        let got: Vec<(&str, f64)> = last.lines.iter().map(|l| (l.stem.as_str(), l.value)).collect();
        let want: Vec<(&str, f64)> = h.lines.iter().map(|l| (l.stem.as_str(), l.value)).collect();
        assert_eq!(got, want, "crafted by {} route {:?} {:?}", h.craft_class, h.route, h.route_class);
    }
}
