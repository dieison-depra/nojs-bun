use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug)]
pub enum PatchOp {
    Insert { key: String, at: usize },
    Move { key: String, from: usize, to: usize },
    Remove { key: String, at: usize },
}

#[wasm_bindgen]
pub fn diff_keyed_list(old_keys: JsValue, new_keys: JsValue) -> Result<JsValue, JsValue> {
    let old: Vec<String> = serde_wasm_bindgen::from_value(old_keys)?;
    let new: Vec<String> = serde_wasm_bindgen::from_value(new_keys)?;
    
    let mut patches = Vec::new();
    let mut old_map = HashMap::new();
    
    for (idx, key) in old.iter().enumerate() {
        old_map.insert(key, idx);
    }
    
    let mut new_map = HashMap::new();
    for (idx, key) in new.iter().enumerate() {
        new_map.insert(key, idx);
    }

    // 1. Mark for removal
    for (idx, key) in old.iter().enumerate() {
        if !new_map.contains_key(key) {
            patches.push(PatchOp::Remove { key: key.clone(), at: idx });
        }
    }

    // 2. Mark for insertion or move
    for (idx, key) in new.iter().enumerate() {
        if let Some(&old_idx) = old_map.get(key) {
            if old_idx != idx {
                patches.push(PatchOp::Move { key: key.clone(), from: old_idx, to: idx });
            }
        } else {
            patches.push(PatchOp::Insert { key: key.clone(), at: idx });
        }
    }

    serde_wasm_bindgen::to_value(&patches).map_err(|e| JsValue::from_str(&e.to_string()))
}
