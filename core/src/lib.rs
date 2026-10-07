// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
pub mod data;
pub mod plan;
pub mod resolve;
pub mod sim;

use data::Data;
use plan::{Query, Search};
use std::rc::Rc;
use wasm_bindgen::prelude::*;

/// Loaded game tables; create once, then start any number of searches.
#[wasm_bindgen]
pub struct Engine {
    d: Rc<Data>,
}

#[wasm_bindgen]
impl Engine {
    #[wasm_bindgen(constructor)]
    pub fn new(data_json: &str) -> Result<Engine, JsValue> {
        Data::from_json(data_json).map(|d| Engine { d: Rc::new(d) }).map_err(|e| JsValue::from_str(&e))
    }

    /// classes, slots (with per-class availability) and the affix labels, as JSON
    pub fn describe(&self) -> String {
        let d = &self.d;
        let slots: Vec<serde_json::Value> = d
            .slots
            .iter()
            .map(|s| {
                let classes: Vec<usize> = (0..7).filter(|&c| !s.pools[c].is_empty()).collect();
                serde_json::json!({ "name": s.name, "classes": classes, "cross": s.cross })
            })
            .collect();
        serde_json::json!({ "classes": d.classes, "season": d.season, "slots": slots, "items": self.item_index() }).to_string()
    }

    /// Flat name-searchable item index for the "target item" picker: for every item that sits in a real gear
    /// slot, its id, display name, slot name, and which classes can pull it natively vs. only
    /// via a cross-class pool — everything the page needs to auto-fill class+slot from a name pick
    /// instead of the old manual category/slot grid.
    fn item_index(&self) -> Vec<serde_json::Value> {
        let d = &self.d;
        let n = d.items.len();
        let mut slot_of: Vec<Option<usize>> = vec![None; n];
        let mut native: Vec<Vec<usize>> = vec![Vec::new(); n];
        let mut cross: Vec<Vec<usize>> = vec![Vec::new(); n];
        for (si, s) in d.slots.iter().enumerate() {
            for c in 0..s.pools.len() {
                for &(item_idx, _w) in &s.pools[c] {
                    slot_of[item_idx] = Some(si);
                    if s.cross.contains(&c) {
                        cross[item_idx].push(c);
                    } else {
                        native[item_idx].push(c);
                    }
                }
            }
        }
        d.items
            .iter()
            .enumerate()
            .filter_map(|(i, it)| {
                slot_of[i].map(|si| {
                    serde_json::json!({
                        "id": it.id, "name": it.name,
                        "slot": d.slots[si].name, "classes": native[i], "cross": cross[i],
                    })
                })
            })
            .collect()
    }

    /// Stat families that can appear on items of a slot for a class, or on one item when `item_id` is not 0: {stem: sample label}
    pub fn stems(&self, class: usize, slot: &str, item_id: u32) -> String {
        let d = &self.d;
        let mut sim = sim::Sim::new(d.clone(), class.min(6), true);
        let mut seen: std::collections::BTreeMap<String, String> = std::collections::BTreeMap::new();
        if let Some(s) = d.slots.iter().find(|s| s.name == slot) {
            for &(item, _) in &s.pools[class.min(6)] {
                if item_id != 0 && d.items[item].id != item_id {
                    continue;
                }
                for ai in sim.candidate_affixes(item) {
                    let a = &d.affixes[ai];
                    // a socket has no roll (no formulas) but is a real target; weapons never roll one
                    let socket = a.socket && !d.items[item].weapon;
                    if (!a.specs.is_empty() || socket) && !a.stem.is_empty() {
                        seen.entry(a.stem.clone()).or_insert_with(|| a.label.clone());
                    }
                }
            }
        }
        serde_json::to_string(&seen).unwrap()
    }

    pub fn search(&self, query_json: &str) -> Result<SearchHandle, JsValue> {
        let q: Query = serde_json::from_str(query_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        if q.class >= 7 {
            return Err(JsValue::from_str("class out of range"));
        }
        Ok(SearchHandle { s: Search::new(self.d.clone(), q) })
    }
}

#[wasm_bindgen]
pub struct SearchHandle {
    s: Search,
}

#[wasm_bindgen]
impl SearchHandle {
    /// process up to `max_nodes` queue entries; true when finished
    pub fn run(&mut self, max_nodes: u32) -> bool {
        self.s.run(max_nodes)
    }
    pub fn results(&mut self) -> String {
        serde_json::to_string(&self.s.results()).unwrap_or_else(|e| format!("{{\"error\":\"{}\"}}", e))
    }
}

/// native access for tests and the command-line runner
pub fn run_query(d: Rc<Data>, q: Query, slice: u32) -> plan::Results {
    let mut s = Search::new(d, q);
    while !s.run(slice) {}
    s.results()
}
