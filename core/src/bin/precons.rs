// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! Prepared builds ("precons") on the same engine as custom search: reads the resolved rows (class, item, required / forced / Mystic
//! stats per row) and writes the page's `premade_*.json`.
//!
//!     precons --resolved rows.json --out web/premade_sc.json [--hc] [--carry old.json] [--prices H,R,C,P] [--node-cap N]
//!             [--max-convert N] [--max-improve N] [--threads N] [--data web/data.json] [--no-mystic-check]
//!
//! A recipe ends on a natural primal carrying the row's required stats (a row naming exactly two stats and no third may carry one of
//! them), and the Mystic must be able to add the row's Mystic stat (or the missing one of the two) by replacing a line ranked below it
//! in the row's priorities, or not listed at all (never the weapon damage range). When no recipe allows that within `--mystic-budget`
//! nodes, the row ships without the Mystic step (`nomystic` names the stat that does not fit). Every limit is a setting; 255 for a
//! count means unlimited. Prices are whole numbers (default 100, 500, 75, 2500 = the page's 1 : 5 : 0.75 : 25 in hundredths).
//! `--carry` copies the staples and salvage sections from an existing file (not generated here yet).
use d3cube::data::Data;
use d3cube::plan::{Checkpoint, Hit, Query};
use d3cube::run_query;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Instant;

const CLASSES: [&str; 7] = ["DemonHunter", "Barbarian", "Wizard", "WitchDoctor", "Monk", "Crusader", "Necromancer"];
const MAIN_STEMS: [&str; 9] = ["Str", "Dex", "Int", "StrDex", "StrInt", "StrVit", "DexInt", "DexVit", "IntVit"];
const NO_MAGNITUDE: [&str; 2] = ["Sockets", "Indestructible"];
/// a stop-off ancient or legendary must roll each required stat at this fraction of its maximum (the player's definition)
const GOOD_ENOUGH: f64 = 0.80;

struct Opts {
    resolved: String,
    out: String,
    data: String,
    carry: Option<String>,
    hc: bool,
    prices: [u64; 4],
    node_cap: usize,
    max_convert: u32,
    max_improve: u32,
    threads: usize,
    /// off: no Mystic rule (to compare with the old generator, which had none)
    mystic_check: bool,
    /// nodes for the search that keeps the Mystic step possible, before the row falls back to no Mystic step
    mystic_budget: usize,
}

fn opts() -> Opts {
    let mut o = Opts {
        resolved: String::new(),
        out: String::new(),
        data: concat!(env!("CARGO_MANIFEST_DIR"), "/../web/data.json").to_string(),
        carry: None,
        hc: false,
        prices: [100, 500, 75, 2500],
        node_cap: 12_000_000,
        max_convert: 255,
        max_improve: 255,
        threads: std::thread::available_parallelism().map_or(4, |n| n.get()),
        mystic_check: true,
        mystic_budget: 8_000_000,
    };
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut i = 0;
    while i < args.len() {
        let val = || args.get(i + 1).cloned().unwrap_or_else(|| panic!("{} needs a value", args[i]));
        match args[i].as_str() {
            "--hc" => {
                o.hc = true;
                i += 1;
                continue;
            }
            "--no-mystic-check" => {
                o.mystic_check = false;
                i += 1;
                continue;
            }
            "--resolved" => o.resolved = val(),
            "--out" => o.out = val(),
            "--data" => o.data = val(),
            "--carry" => o.carry = Some(val()),
            "--prices" => {
                let v: Vec<u64> = val().split(',').map(|x| x.trim().parse().expect("--prices H,R,C,P")).collect();
                o.prices = [v[0], v[1], v[2], v[3]];
            }
            "--node-cap" => o.node_cap = val().parse().unwrap(),
            "--max-convert" => o.max_convert = val().parse().unwrap(),
            "--max-improve" => o.max_improve = val().parse().unwrap(),
            "--threads" => o.threads = val().parse().unwrap(),
            "--mystic-budget" => o.mystic_budget = val().parse().unwrap(),
            a => panic!("unknown argument {a}"),
        }
        i += 2;
    }
    assert!(!o.resolved.is_empty() && !o.out.is_empty(), "usage: precons --resolved rows.json --out premade.json [--hc] ...");
    o
}

/// One search: a row's (class, item(s), stats); identical rows share it.
#[derive(Clone, PartialEq)]
struct Task {
    class: usize,
    slot: String,
    items: Vec<u32>,
    required: Vec<String>,
    min_match: usize,
    mystic: Option<String>,
    /// stats the Mystic must not replace: those ranked above the stat it adds (the wanted ones are never replaced anyway)
    keep: Vec<String>,
}

fn stems(v: &Value) -> Vec<String> {
    v.as_array().map_or(Vec::new(), |a| a.iter().map(|s| s["stem"].as_str().unwrap().to_string()).collect())
}

fn hex(s: &str) -> u32 {
    u32::from_str_radix(s, 16).unwrap()
}

fn task_of(row: &Value) -> Option<Task> {
    let class = CLASSES.iter().position(|c| Some(*c) == row["search_class"].as_str())?;
    let items: Vec<u32> = if row["any_item"] == true {
        row["any_eligible"].as_array()?.iter().map(|s| hex(s.as_str().unwrap())).collect()
    } else {
        vec![hex(row["item_id"].as_str()?)]
    };
    let required = stems(&row["required_stats"]);
    let mystic = row["mystic_stat"]["stem"].as_str().map(|s| s.to_string());
    // a row naming exactly two stats and no third: a primal with one of them is a hit, the Mystic adds the other
    let min_match = if required.len() == 2 && mystic.is_none() { 1 } else { required.len() };
    // the Mystic adds the row's Mystic stat (or, on a two-stat row, the lower-ranked of the two): lines ranked above it stay
    let pos = |v: &Value| v["pos"].as_i64().unwrap_or(99);
    let rank = if mystic.is_some() { pos(&row["mystic_stat"]) } else { row["required_stats"].as_array()?.iter().map(pos).max().unwrap_or(99) };
    let listed = row["required_stats"].as_array()?.iter().chain(row["forced_stats"].as_array().into_iter().flatten());
    let keep = listed.filter(|s| pos(s) < rank).map(|s| s["stem"].as_str().unwrap().to_string()).collect();
    Some(Task { class, slot: row["hero_slot"].as_str()?.to_string(), items, required, min_match, mystic, keep })
}

/// `mystic`: keep the Mystic step possible (the row's Mystic rule); without it, every wanted stat must roll.
fn query(t: &Task, o: &Opts, mystic: bool) -> Query {
    let min_match = if mystic { t.min_match } else { t.required.len() };
    let node_cap = if mystic { o.mystic_budget.min(o.node_cap) } else { o.node_cap };
    serde_json::from_value(json!({
        "class": t.class, "slots": [t.slot], "items": t.items, "set_roots": true, "season": 40, "hardcore": o.hc, "eligible": true,
        "maxsteps": 100000, "max_primalize": o.max_improve, "max_convert": o.max_convert, "node_cap": node_cap,
        "cost_h": o.prices[0], "cost_r": o.prices[1], "cost_c": o.prices[2], "cost_p": o.prices[3],
        "quality": "primal", "end_on_primalize": false, "top": 1, "trail": true,
        "wants": t.required.iter().map(|s| json!({"fam": [s]})).collect::<Vec<_>>(), "min_match": min_match,
        "mystic_finish": mystic, "mystic": if mystic { t.mystic.iter().collect::<Vec<_>>() } else { Vec::new() }, "keep": t.keep
    }))
    .unwrap()
}

fn r3(v: f64) -> f64 {
    (v * 1000.0).round() / 1000.0
}

/// [[stem, value, max]] without the item-power line.
fn tt(cp: &Checkpoint) -> Value {
    json!(cp.lines.iter().filter(|l| l.stem != "item power").map(|l| json!([l.stem, r3(l.value), r3(l.max)])).collect::<Vec<_>>())
}

/// What to stop on at this step: [name, quality, main stem, value].
fn marker(cp: &Checkpoint) -> Value {
    let lines: Vec<_> = cp.lines.iter().filter(|l| !["item power", "Sockets", "Indestructible"].contains(&l.stem.as_str())).collect();
    let main = lines.iter().find(|l| MAIN_STEMS.contains(&l.stem.as_str())).or(lines.first());
    match main {
        Some(l) => json!([cp.name, cp.quality, l.stem, r3(l.value)]),
        None => json!([cp.name, cp.quality, null, null]),
    }
}

fn good_enough(cp: &Checkpoint, required: &[String]) -> bool {
    required.iter().all(|s| {
        let best = cp.lines.iter().filter(|l| &l.stem == s).max_by(|a, b| a.value.total_cmp(&b.value));
        match best {
            None => false,
            Some(_) if NO_MAGNITUDE.contains(&s.as_str()) => true,
            Some(l) => l.max > 0.0 && l.value / l.max >= GOOD_ENOUGH,
        }
    })
}

/// The row as the page reads it (see the old export_premade.py: `cost` = steps, `w` = weighted cost).
fn row_out(row: &Value, task: Option<&Task>, hit: Option<&Hit>, dropped: bool) -> Value {
    let mut need: Vec<(i64, String)> = row["required_stats"]
        .as_array()
        .into_iter()
        .flatten()
        .chain(row["forced_stats"].as_array().into_iter().flatten())
        .map(|s| (s["pos"].as_i64().unwrap_or(99), s["stem"].as_str().unwrap().to_string()))
        .collect();
    let mut mystic = row["mystic_stat"]["stem"].as_str().map(|s| s.to_string());
    let mut o = json!({
        "slot": row["slot"], "item": row["item"], "mystic": null, "cubed": row["cubed_tag"] == true,
        "alt": row["alternate"].as_u64().unwrap_or(0), "nalt": row["alternates_in_row"].as_u64().unwrap_or(1)
    });
    if row["any_item"] == true {
        o["any"] = json!(true);
    }
    let (Some(h), Some(t)) = (hit, task) else {
        need.sort_by_key(|n| n.0);
        o["need"] = json!(need.iter().map(|n| &n.1).collect::<Vec<_>>());
        o["mystic"] = json!(mystic);
        o["found"] = json!(false);
        return o;
    };
    let last = h.trail.last().unwrap();
    if dropped {
        // no recipe leaves room for the Mystic step: say which stat does not fit
        // (a two-stat row falls back to rolling both, so nothing is left for the Mystic there)
        o["nomystic"] = json!(mystic.take());
    }
    // one of two stats missing (min_match 1): the Mystic adds it
    if !dropped && t.min_match < t.required.len() {
        if let Some(gone) = t.required.iter().find(|s| !last.lines.iter().any(|l| &&l.stem == s)) {
            need.retain(|n| &n.1 != gone);
            mystic = Some(gone.clone());
        }
    }
    need.sort_by_key(|n| n.0);
    let path: String = h.route.iter().map(|&(op, n)| op.to_string().repeat(n as usize)).collect();
    let lin: Vec<Value> = h.trail.iter().map(marker).collect();
    o["need"] = json!(need.iter().map(|n| &n.1).collect::<Vec<_>>());
    o["mystic"] = json!(mystic);
    if row["any_item"] == true {
        o["item"] = json!(h.name);
    }
    let mut cheap = Vec::new();
    for want in ["normal", "ancient"] {
        let at = h.trail[..h.trail.len() - 1].iter().position(|cp| {
            cp.name == h.name && cp.quality == want && t.required.iter().all(|s| cp.lines.iter().any(|l| &l.stem == s)) && good_enough(cp, &t.required)
        });
        if let Some(k) = at {
            cheap.push(json!({"q": want, "steps": h.hope as usize + k, "path": &path[..k], "lin": &lin[..=k], "tt": tt(&h.trail[k])}));
        }
    }
    o["found"] = json!(true);
    o["cost"] = json!(h.steps);
    o["w"] = json!(h.cost);
    o["n"] = json!(h.hope);
    o["rs"] = json!(h.slot);
    o["path"] = json!(path);
    o["q"] = json!(h.quality);
    o["seed"] = json!(format!("{:08x}", h.seed));
    o["tt"] = tt(last);
    o["lin"] = json!(lin);
    if !cheap.is_empty() {
        o["cheap"] = json!(cheap);
    }
    o
}

fn slug(title: &str) -> String {
    let mut s = String::new();
    for c in title.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            s.push(c);
        } else if !s.ends_with('-') {
            s.push('-');
        }
    }
    s.trim_matches('-').to_string()
}

fn main() {
    let o = opts();
    let t0 = Instant::now();
    let doc: Value = serde_json::from_str(&std::fs::read_to_string(&o.resolved).expect("--resolved")).unwrap();
    let data_json = std::fs::read_to_string(&o.data).expect("--data");

    // distinct searches
    let mut tasks: Vec<Task> = Vec::new();
    for b in doc["builds"].as_array().unwrap() {
        for r in b["rows"].as_array().unwrap() {
            if let Some(t) = task_of(r) {
                if !tasks.contains(&t) {
                    tasks.push(t);
                }
            }
        }
    }
    // the slowest searches first, roughly: set items (many roots) before the rest
    let next = AtomicUsize::new(0);
    let results: Mutex<HashMap<usize, (Option<Hit>, u64, bool, bool)>> = Mutex::new(HashMap::new());
    eprintln!("{} rows -> {} distinct searches on {} threads", doc["builds"].as_array().unwrap().iter().map(|b| b["rows"].as_array().unwrap().len()).sum::<usize>(), tasks.len(), o.threads);
    std::thread::scope(|s| {
        for _ in 0..o.threads {
            s.spawn(|| {
                let d = Rc::new(Data::from_json(&data_json).unwrap());
                loop {
                    let i = next.fetch_add(1, Ordering::SeqCst);
                    if i >= tasks.len() {
                        break;
                    }
                    let t1 = Instant::now();
                    let t = &tasks[i];
                    let mut r = run_query(d.clone(), query(t, &o, o.mystic_check), 200_000);
                    let mut nodes = r.status.nodes;
                    let mut dropped = false;
                    // nothing leaves room for the Mystic step: the cheapest recipe with every wanted stat, no Mystic step
                    if r.full.is_empty() && o.mystic_check && (t.mystic.is_some() || t.min_match < t.required.len()) {
                        r = run_query(d.clone(), query(t, &o, false), 200_000);
                        nodes += r.status.nodes;
                        dropped = true;
                    }
                    let hit = r.full.into_iter().next();
                    eprintln!(
                        "  [{i}] {} {:?}: {}{} ({} nodes, {:.1}s)",
                        CLASSES[t.class],
                        t.required,
                        hit.as_ref().map_or("NOT FOUND".to_string(), |h| format!("{} cost {}", h.name, h.cost)),
                        if dropped { " (no Mystic step)" } else { "" },
                        nodes,
                        t1.elapsed().as_secs_f64()
                    );
                    results.lock().unwrap().insert(i, (hit, nodes, r.status.capped, dropped));
                }
            });
        }
    });
    let results = results.into_inner().unwrap();

    let carry: Value = o.carry.as_ref().map_or(json!({}), |p| serde_json::from_str(&std::fs::read_to_string(p).expect("--carry")).unwrap());
    let mut builds = Vec::new();
    let (mut rows, mut found) = (0, 0);
    for b in doc["builds"].as_array().unwrap() {
        if b["class"].is_null() {
            continue;
        }
        let mut out_rows = Vec::new();
        for r in b["rows"].as_array().unwrap() {
            if r["item"].is_null() {
                continue;
            }
            let task = task_of(r);
            let res = task.as_ref().and_then(|t| tasks.iter().position(|x| x == t)).map(|i| &results[&i]);
            let hit = res.and_then(|x| x.0.as_ref());
            rows += 1;
            found += hit.is_some() as usize;
            out_rows.push(row_out(r, task.as_ref(), hit, res.map_or(false, |x| x.3)));
        }
        builds.push(json!({"id": slug(b["title"].as_str().unwrap()), "title": b["title"], "class": b["class"], "rows": out_rows}));
    }
    let out = json!({
        "season": 40, "hardcore": o.hc, "builds": builds,
        "staples": carry.get("staples").cloned().unwrap_or(json!([])), "salvage": carry.get("salvage").cloned().unwrap_or(json!([]))
    });
    std::fs::write(&o.out, serde_json::to_string(&out).unwrap()).expect("--out");
    let capped = results.values().filter(|r| r.2).count();
    let dropped = results.values().filter(|r| r.3).count();
    let nodes: u64 = results.values().map(|r| r.1).sum();
    eprintln!("wrote {}: {found}/{rows} rows found, {dropped} searches without a Mystic step, {capped} searches hit the node budget, {nodes} nodes, {:.1}s", o.out, t0.elapsed().as_secs_f64());
}
