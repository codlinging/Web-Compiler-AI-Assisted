use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum TokenType {
    SectionSeparator, // %%
    ActionBlock,      // { ... }
    BisonKeyword,     // %token, %left, %right, etc.
    Identifier,       // WORD, NUMBER, expression, term
    Literal,          // '+', '-', etc.
    Regex,            // For Flex
    Colon,            // :
    Pipe,             // |
    Semicolon,        // ;
    Whitespace,
    Unknown,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Token {
    pub token_type: TokenType,
    pub value: String,
    pub line: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum ASTNode {
    // --- Flex Nodes ---
    FlexFile { rules: Vec<ASTNode> },
    FlexRule { pattern: String, action: String },
    
    // --- Bison Nodes ---
    BisonFile { declarations: Vec<ASTNode>, rules: Vec<ASTNode> },
    BisonTokenDecl { names: Vec<String> },
    BisonGrammarRule { name: String, alternatives: Vec<ASTNode> },
    BisonAlternative { symbols: Vec<String>, action: Option<String> },

    Error { message: String },
}

pub fn lexer(input: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();
    let mut line = 1;

    while let Some(&c) = chars.peek() {
        match c {
            '\n' => { line += 1; chars.next(); }
            ' ' | '\t' | '\r' => { chars.next(); }
            ':' => { tokens.push(Token { token_type: TokenType::Colon, value: ":".to_string(), line }); chars.next(); }
            '|' => { tokens.push(Token { token_type: TokenType::Pipe, value: "|".to_string(), line }); chars.next(); }
            ';' => { tokens.push(Token { token_type: TokenType::Semicolon, value: ";".to_string(), line }); chars.next(); }
            '\'' | '"' => {
                let quote = c;
                let mut val = String::new();
                val.push(quote);
                chars.next(); // Consume quote
                while let Some(&nc) = chars.peek() {
                    val.push(nc);
                    chars.next();
                    if nc == quote { break; }
                }
                tokens.push(Token { token_type: TokenType::Literal, value: val, line });
            }
            '%' => {
                chars.next();
                if let Some(&'%') = chars.peek() {
                    chars.next();
                    tokens.push(Token { token_type: TokenType::SectionSeparator, value: "%%".to_string(), line });
                } else {
                    let mut kw = String::from("%");
                    while let Some(&nc) = chars.peek() {
                        if !nc.is_alphabetic() { break; }
                        kw.push(nc);
                        chars.next();
                    }
                    tokens.push(Token { token_type: TokenType::BisonKeyword, value: kw, line });
                }
            }
            '{' => {
                let mut code = String::new();
                chars.next();
                while let Some(&nc) = chars.peek() {
                    if nc == '}' { break; }
                    code.push(nc);
                    chars.next();
                }
                chars.next();
                tokens.push(Token { token_type: TokenType::ActionBlock, value: code.trim().to_string(), line });
            }
            c if c.is_alphabetic() || c == '_' => {
                let mut ident = String::new();
                while let Some(&nc) = chars.peek() {
                    if !nc.is_alphanumeric() && nc != '_' { break; }
                    ident.push(nc);
                    chars.next();
                }
                tokens.push(Token { token_type: TokenType::Identifier, value: ident, line });
            }
            _ => {
                // Fallback for Flex Regexes or unknown chars
                let mut pattern = String::new();
                while let Some(&nc) = chars.peek() {
                    if nc == ' ' || nc == '\t' || nc == '\n' || nc == '{' { break; }
                    pattern.push(nc);
                    chars.next();
                }
                if !pattern.is_empty() {
                    tokens.push(Token { token_type: TokenType::Regex, value: pattern, line });
                }
            }
        }
    }
    tokens
}

pub struct Parser {
    tokens: Vec<Token>,
    current: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self { Self { tokens, current: 0 } }
    fn peek(&self) -> Option<&Token> { self.tokens.get(self.current) }
    fn advance(&mut self) -> Option<&Token> {
        if self.current < self.tokens.len() { self.current += 1; }
        self.tokens.get(self.current - 1)
    }

    // --- BISON PARSING LOGIC ---
    pub fn parse_bison_program(&mut self) -> ASTNode {
        let mut declarations = Vec::new();
        let mut rules = Vec::new();

        // 1. Parse Declarations (before %%)
        while let Some(t) = self.peek() {
            if t.token_type == TokenType::SectionSeparator {
                self.advance(); // Consume %%
                break;
            }
            if t.token_type == TokenType::BisonKeyword && t.value == "%token" {
                self.advance(); // consume %token
                let mut names = Vec::new();
                while let Some(nt) = self.peek() {
                    if nt.token_type == TokenType::Identifier {
                        names.push(nt.value.clone());
                        self.advance();
                    } else {
                        break;
                    }
                }
                declarations.push(ASTNode::BisonTokenDecl { names });
            } else {
                self.advance(); // Skip unknown declarations for now
            }
        }

        // 2. Parse Grammar Rules (after %%)
        while self.current < self.tokens.len() {
            if self.peek().unwrap().token_type == TokenType::Identifier {
                rules.push(self.parse_bison_rule());
            } else {
                self.advance(); // skip extra tokens/whitespace
            }
        }

        ASTNode::BisonFile { declarations, rules }
    }

    fn parse_bison_rule(&mut self) -> ASTNode {
        let name = self.advance().unwrap().value.clone(); // Rule name

        // Expect ':'
        if let Some(t) = self.advance() {
            if t.token_type != TokenType::Colon {
                return ASTNode::Error { message: format!("Expected ':' after rule {}", name) };
            }
        }

        let mut alternatives = Vec::new();
        let mut current_symbols = Vec::new();
        let mut current_action = None;

        while let Some(t) = self.peek() {
            match t.token_type {
                TokenType::Identifier | TokenType::Literal => {
                    current_symbols.push(t.value.clone());
                    self.advance();
                }
                TokenType::ActionBlock => {
                    current_action = Some(t.value.clone());
                    self.advance();
                }
                TokenType::Pipe => {
                    // Save the current alternative and start a new one
                    alternatives.push(ASTNode::BisonAlternative { 
                        symbols: current_symbols.clone(), 
                        action: current_action.clone() 
                    });
                    current_symbols.clear();
                    current_action = None;
                    self.advance(); // consume '|'
                }
                TokenType::Semicolon => {
                    // Save the final alternative and finish the rule
                    alternatives.push(ASTNode::BisonAlternative { 
                        symbols: current_symbols.clone(), 
                        action: current_action.clone() 
                    });
                    self.advance(); // consume ';'
                    break;
                }
                _ => { self.advance(); } // Skip unknown inside rules
            }
        }

        ASTNode::BisonGrammarRule { name, alternatives }
    }
}

// Global Entry Points
pub fn scan_code(input: &str) -> Vec<Token> { lexer(input) }
pub fn parse_flex(input: &str) -> ASTNode { 
    // Your existing Flex parser logic can remain here
    ASTNode::Error { message: "Flex parser temporarily bypassed for Bison testing".to_string() } 
}
pub fn parse_bison(input: &str) -> ASTNode {
    let tokens = lexer(input);
    let mut parser = Parser::new(tokens);
    parser.parse_bison_program()
}