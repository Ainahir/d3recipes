// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! The chain is fed to the search lazily: a search limited to the first 40 positions (what the planner used to do up front) must
//! find exactly what the unlimited one finds whenever the answer lies within those positions, and the unlimited one must never do worse.
use d3cube::data::Data;
use d3cube::plan::Query;
use d3cube::run_query;
use std::rc::Rc;

fn data() -> Rc<Data> {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../web/data.json");
    Rc::new(Data::from_json(&std::fs::read_to_string(p).expect("web/data.json")).unwrap())
}

fn query(class: usize, slot: &str, quality: &str, maxpos: u32) -> Query {
    serde_json::from_value(serde_json::json!({
        "class": class, "slots": [slot], "quality": quality, "maxpos": maxpos, "maxsteps": 60,
        "max_primalize": 0, "max_convert": 0, "cost_h": 2, "cost_r": 1, "cost_p": 25, "cost_c": 1, "top": 1
    }))
    .unwrap()
}

#[test]
fn unlimited_chain_matches_limited_where_the_answer_is_near() {
    let d = data();
    let (mut same, mut better, mut found_late) = (0, 0, 0);
    for class in 0..d.classes.len() {
        for slot in d.slots.iter() {
            for quality in ["primal", "ancient"] {
                let lim = run_query(d.clone(), query(class, &slot.name, quality, 40), 50_000);
                let unl = run_query(d.clone(), query(class, &slot.name, quality, 4096), 50_000);
                match (lim.full.first(), unl.full.first()) {
                    (Some(a), Some(b)) => {
                        assert!(b.cost <= a.cost, "{} cls {} {}: unlimited {} > limited {}", slot.name, class, quality, b.cost, a.cost);
                        if b.cost == a.cost {
                            assert_eq!((&a.route, a.hope, a.item), (&b.route, b.hope, b.item), "{} cls {} {}", slot.name, class, quality);
                            same += 1;
                        } else {
                            better += 1;
                        }
                    }
                    (None, Some(_)) => found_late += 1,
                    (Some(_), None) => panic!("{} cls {} {}: limited found a route, unlimited did not", slot.name, class, quality),
                    (None, None) => {}
                }
            }
        }
    }
    println!("identical {} cheaper {} found only with the long chain {}", same, better, found_late);
}

/// A want that can never be met ends at the node cap (bounding memory) instead of running until the caller's time limit.
#[test]
fn unreachable_want_ends_at_the_node_cap() {
    let d = data();
    let q: Query = serde_json::from_value(serde_json::json!({
        "class": 0, "slots": ["Helm"], "quality": "primal", "maxpos": 4096, "maxsteps": 1000,
        "max_primalize": 10, "max_convert": 2, "cost_h": 100, "cost_r": 500, "cost_p": 2500, "cost_c": 75, "top": 1,
        "wants": [{"alts": ["NoSuchStat"]}], "min_match": 1
    }))
    .unwrap();
    let t = std::time::Instant::now();
    let r = run_query(d, q, 50_000);
    println!("unreachable want: {} nodes in {:?}, found {}", r.status.nodes, t.elapsed(), r.full.len());
    assert!(r.full.is_empty() && r.status.done && r.status.capped);
}

/// Ending at the first full-or-near route must not change the cheapest route found, only stop sooner.
#[test]
fn end_on_near_keeps_the_cheapest_route() {
    let d = data();
    let mk = |end: bool| -> Query {
        serde_json::from_value(serde_json::json!({
            "class": 0, "slots": ["Gloves"], "quality": "primal", "max_primalize": 2, "max_convert": 2,
            "cost_h": 100, "cost_r": 500, "cost_p": 2500, "cost_c": 75, "top": 4, "end_on_near": end,
            "wants": [{"alts": ["CriticalD"]}, {"alts": ["CriticalChance"]}, {"alts": ["CooldownReduction"]}], "min_match": 3
        }))
        .unwrap()
    };
    let (all, early) = (run_query(d.clone(), mk(false), 20_000), run_query(d, mk(true), 20_000));
    let best = |r: &d3cube::plan::Results| r.full.iter().chain(r.near.iter()).map(|h| h.cost).min();
    println!("nodes {} -> {}, cheapest {:?} -> {:?}", all.status.nodes, early.status.nodes, best(&all), best(&early));
    assert_eq!(best(&all), best(&early));
    assert!(early.status.nodes <= all.status.nodes);
}
