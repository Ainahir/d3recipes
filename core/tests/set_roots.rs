// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! Set roots: a search for a set item also starts from the other pieces of its set. (Checked once against the old Python list
//! generator, 2026-10-06: all 59 + 59 Convert rows at the same weighted cost on its prices.)
use d3cube::data::Data;
use d3cube::plan::Query;
use d3cube::run_query;
use std::rc::Rc;

fn data() -> Rc<Data> {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../web/data.json");
    Rc::new(Data::from_json(&std::fs::read_to_string(p).expect("web/data.json")).unwrap())
}

/// Fast case from the prepared lists: Crusader, Crown of Valor with CHC, Socket, Str. The generator's route starts from pants
/// (2 pants, then R C C R R R R R C C C R, weighted cost 16 at its prices); without set roots nothing reaches that cost.
#[test]
fn crown_of_valor_starts_from_pants() {
    let d = data();
    let run = |set_roots: bool| {
        let q: Query = serde_json::from_value(serde_json::json!({
            "class": 5, "slots": ["Helm"], "items": [0x75acb703u32], "set_roots": set_roots, "season": 40, "hardcore": false,
            "maxsteps": 1000, "max_primalize": 255, "max_convert": 255, "cost_h": 2, "cost_r": 1, "cost_p": 25, "cost_c": 1,
            "quality": "primal", "top": 1, "cost_limit": 17,
            "wants": [{"fam": ["CriticalChance"]}, {"fam": ["Sockets"]}, {"fam": ["Str"]}], "min_match": 3
        }))
        .unwrap();
        run_query(d.clone(), q, 100_000)
    };
    let r = run(true);
    let h = r.full.first().expect("set roots should reach the generator's route");
    println!("cost {} hope {} {} route {:?} -> {} (root {})", h.cost, h.hope, h.slot, h.route, h.name, h.root_name);
    assert_eq!(h.cost, 16);
    assert_eq!(h.slot, "Legs");
    assert_eq!(h.name, "Crown of Valor");
    assert!(run(false).full.is_empty(), "without set roots the helm alone should not reach cost 16");
}
