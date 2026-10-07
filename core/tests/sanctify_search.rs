use d3cube::{data::Data, plan::Query, run_query};
use std::rc::Rc;

fn search(extra: serde_json::Value) -> d3cube::plan::Results {
    let d = Rc::new(Data::from_json(include_str!("../../web/data.json")).unwrap());
    let mut q = serde_json::json!({"class":0,"slots":["Helm"],"season":40,"maxpos":1,
        "maxsteps":2,"max_primalize":1,"max_sanctify":1,"max_convert":0,
        "max_switch":0,"quality":"crafted","end_on_primalize":true,
        "cost_h":1,"cost_s":1,"cost_p":100,"cost_r":10000,"top":1});
    for (k,v) in extra.as_object().unwrap() { q[k] = v.clone(); }
    run_query(d, serde_json::from_value::<Query>(q).unwrap(), 10000)
}

#[test]
fn sanctify_can_prepare_an_ashes_result_and_replay_its_tooltip() {
    let r = search(serde_json::json!({"wants":[
        {"fam":["Life"]},{"fam":["Skill_DemonHunter_ElementalArrow"]},
        {"fam":["FireResist"]},{"fam":["Thorns"]}],"trail":true}));
    assert_eq!(r.full.len(),1);
    assert_eq!(r.full[0].route, vec![( 'S', 1), ('P', 1)]);
    assert_eq!(r.full[0].cost,102);
    assert_eq!(r.full[0].checkpoints.len(),3);
    let disabled = search(serde_json::json!({"max_sanctify":0,"wants":[
        {"fam":["Life"]},{"fam":["Skill_DemonHunter_ElementalArrow"]},
        {"fam":["FireResist"]},{"fam":["Thorns"]}]}));
    assert!(disabled.full.is_empty());
}

#[test]
fn sanctify_is_gated_by_season_and_not_registered_as_an_ashes_endpoint() {
    for (season,nodes) in [(40,3),(46,3),(52,3),(39,2),(41,2),(45,2)] {
        let r = search(serde_json::json!({"season":season,"maxsteps":1,"max_primalize":0}));
        assert_eq!(r.status.nodes,nodes,"season {season}");
        assert!(r.full.is_empty());
    }
}
