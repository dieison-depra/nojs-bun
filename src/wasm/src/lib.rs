mod parser;
mod sanitizer;
mod diff;

use wasm_bindgen::prelude::*;

// Re-export public functions
pub use parser::tokenize_expression;
pub use sanitizer::{sanitize_html, sanitize_svg};
pub use diff::diff_keyed_list;

#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    // Optional initialization logic
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();
    
    Ok(())
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "0.1.0-native".to_string()
}
