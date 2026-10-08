use d3cube::{data::Data, sim::{chain_roots, Sim}};
use std::rc::Rc;

#[test]
fn observed_pants_two_route_matches_every_intermediate_outcome() {
    let d = Rc::new(Data::from_json(include_str!("../../web/data.json")).unwrap());
    let fixture: serde_json::Value = serde_json::from_str(include_str!("../../testdata/sanctify_cross_class_route.json")).unwrap();
    let crafter = d.classes.iter().position(|c| c == fixture["craft_class"].as_str().unwrap()).unwrap();
    let slot = d.slots.iter().find(|s| s.name == fixture["slot"].as_str().unwrap()).unwrap();
    let roots = chain_roots(&slot.pools[crafter], slot.key, fixture["season"].as_u64().unwrap() as u32,
        fixture["hardcore"].as_bool().unwrap(), fixture["upgrade"].as_u64().unwrap() as u32, true, crafter, &d.items);
    let mut sim = Sim::new(d.clone(), crafter, true);
    let (mut item, mut seed) = (roots[0].item, roots[0].seed);
    let outcomes = fixture["outcomes"].as_array().unwrap();
    assert_eq!(outcomes.len(), 9); // two upgrades, then seven operations
    for row in outcomes {
        sim.hero = d.classes.iter().position(|c| c == row["class"].as_str().unwrap()).unwrap();
        let op = row["op"].as_str().unwrap();
        let (aff, quality) = match op {
            "Hope of Cain" => {
                let root = roots.iter().find(|r| r.n as u64 == row["upgrade"].as_u64().unwrap()).unwrap();
                item = root.item;
                seed = root.seed;
                (sim.drop_item(item, root.x0, root.ancient, root.primal),
                    if root.primal { "primal" } else if root.ancient { "ancient" } else { "normal" })
            }
            "C" => {
                let g = sim.convert(item, seed);
                item = g.target;
                seed = g.child_seed;
                (g.affixes, "normal")
            }
            "S" => {
                let (aff, next) = sim.sanctify(item, seed);
                seed = next;
                (aff, "sanctified")
            }
            "R" => {
                let g = sim.reforge(item, seed);
                seed = g.child_seed;
                (g.affixes, if g.primal { "primal" } else if g.ancient { "ancient" } else { "normal" })
            }
            _ => panic!("unknown fixture operation {op}"),
        };
        assert_eq!(d.items[item].name, row["item"].as_str().unwrap(), "step {} item", row["step"]);
        assert_eq!(seed as u64, row["seed"].as_u64().unwrap(), "step {} inferred seed", row["step"]);
        if op != "Hope of Cain" {
            assert_eq!(quality, row["quality"].as_str().unwrap(), "step {} quality", row["step"]);
        }
        // Ignore the ordinary secondary replaced by the unmodeled seasonal power.
        let observed_aff = if op == "S" {
            assert_eq!(aff.len(), 6);
            &aff[..5]
        } else { &aff[..] };
        let raw = if matches!(quality, "primal" | "sanctified") {
            sim.values_max(item, observed_aff)
        } else { sim.values(item, seed, observed_aff) };
        let mut actual: Vec<_> = raw.iter().map(|l| serde_json::json!({
            "stat": l.aff.map(|a| d.affixes[a].stem.as_str()).unwrap_or("item power"), "value": l.value
        })).collect();
        actual.extend(observed_aff.iter().filter(|&&a| d.affixes[a].specs.is_empty())
            .map(|&a| serde_json::json!({"stat": d.affixes[a].stem, "value": 0})));
        let mut expected = row["stats"].as_array().unwrap().clone();
        actual.sort_by_key(|s| s.to_string());
        expected.sort_by_key(|s| s.to_string());
        assert_eq!(actual, expected, "step {} stats", row["step"]);
    }
    assert_eq!(d.items[item].name, "Hell Walkers");
    assert_eq!(outcomes.last().unwrap()["quality"], "primal");
}
