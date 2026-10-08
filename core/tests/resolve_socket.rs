// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! A worn primal always has a socket and it takes the first primary pick, so a stat that can only come from a primary pick is not
//! a stat a natural primal can carry next to it. The resolver gives such a stat to the Mystic instead of listing it as required
//! (an Andariel's Visage helm with Blood Nova: no natural primal has both, and the search for one never ends), and leaves items that
//! can carry it (Leoric's Crown) alone.
use d3cube::data::Data;
use d3cube::resolve::resolve_builds;
use serde_json::Value;
use std::rc::Rc;

fn data() -> Rc<Data> {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../web/data.json");
    Rc::new(Data::from_json(&std::fs::read_to_string(p).expect("web/data.json")).unwrap())
}

const TOML: &str = r#"
[[build]]
name = "Socket squeeze"
class = "Necromancer"

[[build.slot]]
name = "Helm"
items = ["Leoric's Crown", "Andariel's Visage"]
stat_priority = ["Death Nova Damage", "Critical Hit Chance", "Socket Flawless Royal Amethyst", "Intelligence"]
"#;

fn stems(row: &Value, key: &str) -> Vec<String> {
    row[key].as_array().map_or(vec![], |a| a.iter().map(|s| s["stem"].as_str().unwrap().to_string()).collect())
}

#[test]
fn the_forced_socket_leaves_no_primary_pick_for_blood_nova() {
    let out = resolve_builds(TOML, data(), false);
    let rows: Vec<&Value> = out["builds"][0]["rows"].as_array().unwrap().iter().collect();
    let visage = rows.iter().find(|r| r["item"] == "Andariel's Visage").expect("Visage row");
    let crown = rows.iter().find(|r| r["item"] == "Leoric's Crown").expect("Crown row");
    // the Crown can carry Blood Nova and Critical Hit Chance next to its socket
    assert!(stems(crown, "required_stats").contains(&"Skill_Necromancer_BloodNova".to_string()));
    assert!(crown["mystic_stat"].is_null());
    // the Visage cannot: only the Mystic can add Blood Nova
    assert!(!stems(visage, "required_stats").contains(&"Skill_Necromancer_BloodNova".to_string()), "{visage}");
    assert_eq!(visage["mystic_stat"]["stem"], "Skill_Necromancer_BloodNova", "{visage}");
}
