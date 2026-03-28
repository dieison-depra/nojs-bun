use logos::Logos;
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Logos, Debug, PartialEq, Serialize, Deserialize)]
#[logos(skip r"[ \t\n\f]+")] // Skip whitespace
pub enum Token {
    #[regex("[a-zA-Z_$][a-zA-Z0-9_$]*", |lex| lex.slice().to_string())]
    Identifier(String),

    #[regex(r#"'([^'\\]|\\.)*'"#, |lex| lex.slice()[1..lex.slice().len()-1].to_string())]
    #[regex(r#""([^"\\]|\\.)*""#, |lex| lex.slice()[1..lex.slice().len()-1].to_string())]
    String(String),

    #[regex(r"[0-9]+(\.[0-9]+)?", |lex| lex.slice().parse::<f64>().ok())]
    Number(f64),

    #[token("true")]
    True,
    #[token("false")]
    False,
    #[token("null")]
    Null,
    #[token("undefined")]
    Undefined,

    #[token("typeof")]
    typeof_kw,
    #[token("in")]
    in_kw,
    #[token("instanceof")]
    instanceof_kw,

    // Operators
    #[token("===")] OpEqStrict,
    #[token("!==")] OpNotEqStrict,
    #[token("==")]  OpEq,
    #[token("!=")]  OpNotEq,
    #[token(">=")]  OpGtEq,
    #[token("<=")]  OpLtEq,
    #[token("&&")]  OpAnd,
    #[token("||")]  OpOr,
    #[token("??")]  OpNullish,
    #[token("?.")]  OpOptChain,
    #[token("=>")]  OpArrow,

    #[token("+")]   OpAdd,
    #[token("-")]   OpSub,
    #[token("*")]   OpMul,
    #[token("/")]   OpDiv,
    #[token("%")]   OpMod,
    #[token(">")]   OpGt,
    #[token("<")]   OpLt,
    #[token("!")]   OpNot,
    #[token("=")]   OpAssign,
    #[token("|")]   OpPipe,

    // Punctuation
    #[token("(")]   LParen,
    #[token(")")]   RParen,
    #[token("[")]   LBracket,
    #[token("]")]   RBracket,
    #[token("{")]   LBrace,
    #[token("}")]   RBrace,
    #[token(".")]   Dot,
    #[token(",")]   Comma,
    #[token(":")]   Colon,
    #[token(";")]   Semi,
    #[token("?")]   Question,
    #[token("...")] Spread,
}

#[derive(Serialize)]
pub struct TokenData {
    #[serde(rename = "type")]
    pub token_type: String,
    pub value: Option<String>,
    pub pos: usize,
}

#[wasm_bindgen]
pub fn tokenize_expression(expr: &str) -> Result<JsValue, JsValue> {
    let mut lex = Token::lexer(expr);
    let mut tokens = Vec::new();

    while let Some(token_res) = lex.next() {
        let pos = lex.span().start;
        if let Ok(token) = token_res {
            let data = match token {
                Token::Identifier(s) => TokenData { token_type: "Identifier".into(), value: Some(s), pos },
                Token::String(s) => TokenData { token_type: "String".into(), value: Some(s), pos },
                Token::Number(n) => TokenData { token_type: "Number".into(), value: Some(n.to_string()), pos },
                Token::True => TokenData { token_type: "Keyword".into(), value: Some("true".into()), pos },
                Token::False => TokenData { token_type: "Keyword".into(), value: Some("false".into()), pos },
                Token::Null => TokenData { token_type: "Keyword".into(), value: Some("null".into()), pos },
                Token::Undefined => TokenData { token_type: "Keyword".into(), value: Some("undefined".into()), pos },
                Token::typeof_kw => TokenData { token_type: "Keyword".into(), value: Some("typeof".into()), pos },
                Token::in_kw => TokenData { token_type: "Keyword".into(), value: Some("in".into()), pos },
                Token::instanceof_kw => TokenData { token_type: "Keyword".into(), value: Some("instanceof".into()), pos },
                
                // Operators
                Token::OpEqStrict => TokenData { token_type: "Op".into(), value: Some("===".into()), pos },
                Token::OpNotEqStrict => TokenData { token_type: "Op".into(), value: Some("!==".into()), pos },
                Token::OpEq => TokenData { token_type: "Op".into(), value: Some("==".into()), pos },
                Token::OpNotEq => TokenData { token_type: "Op".into(), value: Some("!=".into()), pos },
                Token::OpGtEq => TokenData { token_type: "Op".into(), value: Some(">=".into()), pos },
                Token::OpLtEq => TokenData { token_type: "Op".into(), value: Some("<=".into()), pos },
                Token::OpAnd => TokenData { token_type: "Op".into(), value: Some("&&".into()), pos },
                Token::OpOr => TokenData { token_type: "Op".into(), value: Some("||".into()), pos },
                Token::OpNullish => TokenData { token_type: "Op".into(), value: Some("??".into()), pos },
                Token::OpOptChain => TokenData { token_type: "Op".into(), value: Some("?.".into()), pos },
                Token::OpArrow => TokenData { token_type: "Op".into(), value: Some("=>".into()), pos },
                Token::OpAdd => TokenData { token_type: "Op".into(), value: Some("+".into()), pos },
                Token::OpSub => TokenData { token_type: "Op".into(), value: Some("-".into()), pos },
                Token::OpMul => TokenData { token_type: "Op".into(), value: Some("*".into()), pos },
                Token::OpDiv => TokenData { token_type: "Op".into(), value: Some("/".into()), pos },
                Token::OpMod => TokenData { token_type: "Op".into(), value: Some("%".into()), pos },
                Token::OpGt => TokenData { token_type: "Op".into(), value: Some(">".into()), pos },
                Token::OpLt => TokenData { token_type: "Op".into(), value: Some("<".into()), pos },
                Token::OpNot => TokenData { token_type: "Op".into(), value: Some("!".into()), pos },
                Token::OpAssign => TokenData { token_type: "Op".into(), value: Some("=".into()), pos },
                Token::OpPipe => TokenData { token_type: "Op".into(), value: Some("|".into()), pos },
                Token::Spread => TokenData { token_type: "Op".into(), value: Some("...".into()), pos },

                // Punctuation
                Token::LParen => TokenData { token_type: "Punctuation".into(), value: Some("(".into()), pos },
                Token::RParen => TokenData { token_type: "Punctuation".into(), value: Some(")".into()), pos },
                Token::LBracket => TokenData { token_type: "Punctuation".into(), value: Some("[".into()), pos },
                Token::RBracket => TokenData { token_type: "Punctuation".into(), value: Some("]".into()), pos },
                Token::LBrace => TokenData { token_type: "Punctuation".into(), value: Some("{".into()), pos },
                Token::RBrace => TokenData { token_type: "Punctuation".into(), value: Some("}".into()), pos },
                Token::Dot => TokenData { token_type: "Punctuation".into(), value: Some(".".into()), pos },
                Token::Comma => TokenData { token_type: "Punctuation".into(), value: Some(",".into()), pos },
                Token::Colon => TokenData { token_type: "Punctuation".into(), value: Some(":".into()), pos },
                Token::Semi => TokenData { token_type: "Punctuation".into(), value: Some(";".into()), pos },
                Token::Question => TokenData { token_type: "Punctuation".into(), value: Some("?".into()), pos },
            };
            tokens.push(data);
        }
    }

    serde_wasm_bindgen::to_value(&tokens).map_err(|e| JsValue::from_str(&e.to_string()))
}
