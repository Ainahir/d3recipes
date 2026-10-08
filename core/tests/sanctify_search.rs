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
fn unsupported_seasons_allow_explicit_sanctify_with_a_warning() {
    for season in [40,46,52,39,41,45] {
        let r = search(serde_json::json!({"season":season,"maxsteps":1,"max_primalize":0}));
        assert_eq!(r.status.nodes,3,"season {season}");
        assert_eq!(r.warnings.is_empty(), season >= 40 && (season-40)%6 == 0);
        assert!(r.full.is_empty());
        let disabled = search(serde_json::json!({"season":season,"maxsteps":1,"max_primalize":0,"max_sanctify":0}));
        assert_eq!(disabled.status.nodes,2);
        assert!(disabled.warnings.is_empty());
    }
}

#[test]
fn equivalent_five_affix_continuations_keep_the_cheapest_cost() {
    for (p,s,expected_route,expected_cost) in [
        (25,1,vec![('S',3),('P',1)],29),
        (1,25,vec![('P',4)],5),
        (1,1,vec![('P',4)],5),
    ] {
        let r=search(serde_json::json!({"slots":["Dagger"],"maxsteps":4,
            "max_primalize":255,"max_sanctify":255,"cost_p":p,"cost_s":s,"cost_r":100000,
            "wants":[{"fam":["Vit"]},{"fam":["SplashDamage"]},{"fam":["WeaponHitFear1h"]}]}));
        assert_eq!(r.full[0].route,expected_route);
        assert_eq!(r.full[0].cost,expected_cost);
        assert_eq!(r.full[0].quality,"crafted");
        assert_eq!(r.full[0].route.last().unwrap().0,'P');
    }
}

#[test]
fn finite_caps_preserve_routes_that_have_different_remaining_uses() {
    let r=search(serde_json::json!({"slots":["Dagger"],"maxsteps":4,
        "max_primalize":255,"max_sanctify":2,"cost_p":25,"cost_s":1,"cost_r":100000,
        "wants":[{"fam":["Vit"]},{"fam":["SplashDamage"]},{"fam":["WeaponHitFear1h"]}]}));
    assert_eq!(r.full[0].cost,53);
    assert_eq!(r.full[0].route,vec![('S',2),('P',2)]);
}
