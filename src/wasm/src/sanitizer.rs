use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn sanitize_html(html: &str) -> String {
    // Simplified regex-based sanitizer for environment compatibility
    // (In a real production env with modern rustc, we'd use 'ammonia')
    let mut clean = html.to_string();
    
    let blocked_tags = [
        "script", "style", "iframe", "object", "embed", 
        "base", "form", "meta", "link", "noscript"
    ];

    for tag in blocked_tags {
        let re_tag = format!("<{}[^>]*>.*?</{}>", tag, tag);
        // This is a naive placeholder for the purpose of the MVP
        clean = clean.replace(&format!("<{}", tag), &format!("<!-- blocked-{}", tag));
    }
    
    clean
}

#[wasm_bindgen]
pub fn sanitize_svg(svg: &str) -> String {
    svg.to_string() // Placeholder
}
