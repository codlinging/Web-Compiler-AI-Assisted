use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum TokenType {
    SectionSeparator,
    Regex,
    ActionBlock,
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
    FlexFile {
        rules: Vec<ASTNode>,
    },
    Rule {
        pattern: String,
        action: String,
    },
    Error {
        message: String,
    },
}

pub fn lexer(input: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();
    let mut line = 1;

    while let Some(&c) = chars.peek() {
        match c {
            '\n' => {
                line += 1;
                chars.next();
            }
            ' ' | '\t' | '\r' => {
                chars.next();
            }
            '%' => {
                chars.next();
                if let Some(&'%') = chars.peek() {
                    chars.next();
                    tokens.push(Token {
                        token_type: TokenType::SectionSeparator,
                        value: "%%".to_string(),
                        line,
                    });
                }
            }
            '{' => {
                let mut code = String::new();
                chars.next();
                while let Some(&nc) = chars.peek() {
                    if nc == '}' {
                        break;
                    }
                    code.push(nc);
                    chars.next();
                }
                chars.next();
                tokens.push(Token {
                    token_type: TokenType::ActionBlock,
                    value: code.trim().to_string(),
                    line,
                });
            }
            _ => {
                let mut pattern = String::new();
                while let Some(&nc) = chars.peek() {
                    if nc == ' ' || nc == '\t' || nc == '\n' || nc == '{' {
                        break;
                    }
                    pattern.push(nc);
                    chars.next();
                }
                if !pattern.is_empty() {
                    tokens.push(Token {
                        token_type: TokenType::Regex,
                        value: pattern,
                        line,
                    });
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
    pub fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, current: 0 }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.current)
    }

    fn advance(&mut self) -> Option<&Token> {
        if self.current < self.tokens.len() {
            self.current += 1;
        }
        self.tokens.get(self.current - 1)
    }

    pub fn parse_program(&mut self) -> ASTNode {
        let mut rules = Vec::new();

        while self.current < self.tokens.len() {
            if let Some(t) = self.peek() {
                if t.token_type == TokenType::SectionSeparator {
                    self.advance();
                    continue;
                }
            }
            rules.push(self.parse_rule());
        }
        ASTNode::FlexFile { rules }
    }

    fn parse_rule(&mut self) -> ASTNode {
        let pattern_token = self.advance();
        let pattern = match pattern_token {
            Some(t) if t.token_type == TokenType::Regex => t.value.clone(),
            _ => {
                return ASTNode::Error {
                    message: "Expected Regex Pattern".to_string(),
                }
            }
        };

        let action_token = self.advance();
        let action = match action_token {
            Some(t) if t.token_type == TokenType::ActionBlock => t.value.clone(),
            _ => {
                return ASTNode::Error {
                    message: "Expected Action Block {...}".to_string(),
                }
            }
        };

        ASTNode::Rule { pattern, action }
    }
}

// Cleaned up entry points that return standard Rust types
pub fn parse_code(input: &str) -> ASTNode {
    let tokens = lexer(input);
    let mut parser = Parser::new(tokens);
    parser.parse_program()
}

pub fn scan_code(input: &str) -> Vec<Token> {
    lexer(input)
}