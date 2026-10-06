// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! Set roots: a search for a set item also starts from the other pieces of its set. Checked against the prepared lists, which
//! the (separate) list generator built with roots in every slot of the set: on the generator's prices and limits, the planner
//! must find each Convert row's route at the same weighted cost. Slow (minutes): `cargo test --release -- --ignored`.
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

const CLASSES: [&str; 7] = ["DemonHunter", "Barbarian", "Wizard", "WitchDoctor", "Monk", "Crusader", "Necromancer"];

#[test]
#[ignore]
fn convert_rows_match_the_generator() {
    let d = data();
    for (file, hc) in [("premade_sc.json", false), ("premade_hc.json", true)] {
        let p = format!("{}/../web/{}", env!("CARGO_MANIFEST_DIR"), file);
        let lists: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap();
        let (mut same, mut cheaper, mut worse, mut without_worse) = (0, 0, 0, 0);
        for b in lists["builds"].as_array().unwrap() {
            let class = CLASSES.iter().position(|c| *c == b["class"].as_str().unwrap()).unwrap();
            for r in b["rows"].as_array().unwrap() {
                let path = r["path"].as_str().unwrap_or("");
                if r["found"] != true || !path.contains('C') || r["any"] == true {
                    continue;
                }
                let name = r["item"].as_str().unwrap();
                let Some(item) = d.items.iter().find(|it| it.name == name && it.setid != 0) else { continue };
                let need: Vec<String> = r["need"].as_array().unwrap().iter().map(|s| s.as_str().unwrap().to_string()).collect();
                let w = r["w"].as_u64().unwrap();
                let ii = d.items.iter().position(|it| it.id == item.id).unwrap();
                let own = d.slots.iter().find(|s| s.pools[class].iter().any(|&(i, _)| i == ii)).map(|s| s.name.clone()).unwrap();
                let run = |set_roots: bool| {
                    let q: Query = serde_json::from_value(serde_json::json!({
                        "class": class, "slots": [own], "items": [item.id], "set_roots": set_roots,
                        "season": 40, "hardcore": hc, "maxsteps": 1000, "max_primalize": 255, "max_convert": 255,
                        "cost_h": 2, "cost_r": 1, "cost_p": 25, "cost_c": 1, "quality": "primal", "top": 1, "cost_limit": w + 1,
                        "wants": need.iter().map(|s| serde_json::json!({"fam": [s]})).collect::<Vec<_>>(), "min_match": need.len()
                    }))
                    .unwrap();
                    run_query(d.clone(), q, 100_000).full.first().map(|h| h.cost)
                };
                let (with, without) = (run(true), run(false));
                match with {
                    Some(c) if c == w => same += 1,
                    Some(c) if c < w => cheaper += 1,
                    _ => {
                        worse += 1;
                        println!("{file} {} {name} ({}): generator {w} (from {} {}), set roots {with:?}", b["id"], r["slot"], r["rs"], r["path"]);
                    }
                }
                if without.map_or(true, |c| c > w) {
                    without_worse += 1;
                }
            }
        }
        println!("{file}: with set roots {same} same, {cheaper} cheaper, {worse} not found at the generator's cost; without set roots {without_worse} not found");
        assert_eq!(worse, 0);
    }
}

/// The page's own settings on the same rows: what set roots change for a player (cheapest primal found, and nodes spent).
#[test]
#[ignore]
fn page_settings_with_and_without_set_roots() {
    let d = data();
    let p = format!("{}/../web/premade_sc.json", env!("CARGO_MANIFEST_DIR"));
    let lists: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap();
    let (mut better, mut same, mut worse, mut nodes_with, mut nodes_without) = (0, 0, 0, 0u64, 0u64);
    for b in lists["builds"].as_array().unwrap() {
        let class = CLASSES.iter().position(|c| *c == b["class"].as_str().unwrap()).unwrap();
        for r in b["rows"].as_array().unwrap() {
            if r["found"] != true || !r["path"].as_str().unwrap_or("").contains('C') || r["any"] == true {
                continue;
            }
            let name = r["item"].as_str().unwrap();
            let Some(item) = d.items.iter().find(|it| it.name == name && it.setid != 0) else { continue };
            let ii = d.items.iter().position(|it| it.id == item.id).unwrap();
            let own = d.slots.iter().find(|s| s.pools[class].iter().any(|&(i, _)| i == ii)).map(|s| s.name.clone()).unwrap();
            let need: Vec<String> = r["need"].as_array().unwrap().iter().map(|s| s.as_str().unwrap().to_string()).collect();
            let run = |set_roots: bool| {
                let q: Query = serde_json::from_value(serde_json::json!({
                    "class": class, "slots": [own], "items": [item.id], "set_roots": set_roots,
                    "season": 40, "hardcore": false, "maxsteps": 1000, "max_primalize": 255, "max_convert": 2,
                    "cost_h": 100, "cost_r": 500, "cost_p": 2500, "cost_c": 75, "quality": "primal", "top": 1,
                    "wants": need.iter().map(|s| serde_json::json!({"fam": [s]})).collect::<Vec<_>>(), "min_match": need.len()
                }))
                .unwrap();
                let r = run_query(d.clone(), q, 100_000);
                (r.full.first().map(|h| h.cost), r.status.nodes)
            };
            let ((with, nw), (without, nwo)) = (run(true), run(false));
            nodes_with += nw;
            nodes_without += nwo;
            match (with, without) {
                (Some(a), Some(b)) if a == b => same += 1,
                (Some(a), Some(b)) if a < b => better += 1,
                (Some(_), None) => better += 1,
                _ => {
                    worse += 1;
                    println!("worse: {} {name}: with {with:?} without {without:?}", b["id"]);
                }
            }
        }
    }
    println!("page settings: set roots cheaper {better}, same {same}, worse {worse}; nodes with {nodes_with}, without {nodes_without}");
}
