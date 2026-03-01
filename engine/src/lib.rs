use serde::{Deserialize,Serialize};
#[derive(Serialize, Deserialize,Clone,Debug,PartialEq)]
pub enum TokenType{
    SectionSeparator,
    ActionBlock,
    BisonKeyword,
    Identifier,
    Literal,
    Regex,
    Colon,
    Pipe,
    Semicolon,
    Whitespace,
    Unkown,
}
#[derive(Serialize, Deserialize,Clone,Debug)]
pub struct Token{
    pub token_type:TokenType,
    pub value:String,
    pub line:usize,
    pub column:usize,
}
#[derive(Serialize,Deserialize,Clone,Debug)]
#[serde(tag="type")]
pub enum ASTNode{
    FlexFile {rules:Vec<ASTNode>},
    FlexRule {pattern:String, action:String},
    BisonFile{declarations:Vec<ASTNode>,rules:Vec<ASTNode>},
    BisonTokenDecl{names:Vec<String>},
    BisonGrammarRule{name:String, alternatives:Vec<ASTNode>},
    BisonAlternative{symbols:Vec<String>, action:Option<String>},
    Error { message: String, line: usize, column: usize },
}
pub fn lexer(input: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();
    let mut line = 1;
    let mut column=1;

    while let Some(&c) = chars.peek() {
        let start_col=column;
        match c {
            '\n' => { line += 1;column=1; chars.next(); }
            ' ' | '\t' | '\r' => { chars.next(); }
            ':' => { tokens.push(Token { token_type: TokenType::Colon, value: ":".to_string(), line,column:start_col });column+=1; chars.next(); }
            '|' => { tokens.push(Token { token_type: TokenType::Pipe, value: "|".to_string(), line ,column: start_col});column+=1; chars.next(); }
            ';' => { tokens.push(Token { token_type: TokenType::Semicolon, value: ";".to_string(), line,column: start_col }); column+=1; chars.next(); }
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
                tokens.push(Token { token_type: TokenType::Literal, value: val, line ,column: start_col});
            }
            '%' => {
                chars.next();
                if let Some(&'%') = chars.peek() {
                    chars.next();
                    tokens.push(Token { token_type: TokenType::SectionSeparator, value: "%%".to_string(), line ,column: start_col});
                } else {
                    let mut kw = String::from("%");
                    while let Some(&nc) = chars.peek() {
                        if !nc.is_alphabetic() { break; }
                        kw.push(nc);
                        chars.next();
                    }
                    tokens.push(Token { token_type: TokenType::BisonKeyword, value: kw, line ,column: start_col});
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
                tokens.push(Token { token_type: TokenType::ActionBlock, value: code.trim().to_string(), line,column: start_col });
            }
            c if c.is_alphabetic() || c == '_' => {
                let mut ident = String::new();
                while let Some(&nc) = chars.peek() {
                    if !nc.is_alphanumeric() && nc != '_' { break; }
                    ident.push(nc);
                    chars.next();
                }
                tokens.push(Token { token_type: TokenType::Identifier, value: ident, line,column: start_col });
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
                    tokens.push(Token { token_type: TokenType::Regex, value: pattern, line,column: start_col });
                }
            }
        }
    }
    tokens
}
pub struct Parser{
    tokens:Vec<Token>,
    current:usize,
}
impl Parser{
    pub fn new(tokens:Vec<Token>)->Self{Self{tokens,current:0}}
    fn peek(&self)->Option<&Token>{self.tokens.get(self.current)}
    fn advance(&mut self)->Option<&Token>{
        if self.current<self.tokens.len(){self.current +=1;}
        self.tokens.get(self.current-1)
    }

    pub fn parse_bison_program(&mut self)->ASTNode{
        let mut declarations=Vec::new();
        let mut rules=Vec::new();
        while let Some(t)=self.peek(){
            if t.token_type==TokenType::SectionSeparator{
                self.advance();
                break;
            }
            if t.token_type==TokenType::BisonKeyword && t.value=="%token"{
                self.advance();
                let mut names=Vec::new();
                while let Some(nt)=self.peek(){
                    if nt.token_type==TokenType::Identifier{
                        names.push(nt.value.clone());
                        self.advance();
                    }else{
                        break;
                    }
                }
                declarations.push(ASTNode::BisonTokenDecl { names });
        }else{
            self.advance();
        }
    }
    while self.current<self.tokens.len(){
        if self.peek().unwrap().token_type==TokenType::Identifier{
            rules.push(self.parse_bison_rule());
        }else{
            self.advance();
        }
    }
    ASTNode::BisonFile{declarations,rules}
}
fn parse_bison_rule(&mut self)->ASTNode{
    let name=self.advance().unwrap().value.clone();
    if let Some(t)=self.advance(){
        if t.token_type!=TokenType::Colon{
            return ASTNode::Error{message: "Expected Regex Pattern".to_string(), line: t.line, column: t.column};
        }
    }
    let mut alternatives=Vec::new();
    let mut current_symbols=Vec::new();
    let mut current_action=None;
    while let Some(t)=self.peek(){
        match t.token_type{
            TokenType::Identifier| TokenType::Literal=>{
                current_symbols.push(t.value.clone());
                self.advance();
            }
            TokenType::ActionBlock=>{
                current_action=Some(t.value.clone());
                self.advance();
            }
            TokenType::Pipe=>{
                alternatives.push(ASTNode::BisonAlternative { symbols: current_symbols.clone(), action: current_action.clone() });
                current_symbols.clear();
                current_action=None;
                self.advance();
            }
            TokenType::Semicolon=>{
                alternatives.push(ASTNode::BisonAlternative { symbols: current_symbols.clone(), action: current_action.clone() });
                self.advance();
                break;
            }
            _=>{self.advance();}
        }
    }
    ASTNode::BisonGrammarRule { name, alternatives }

}
pub fn parse_flex_program(&mut self)->ASTNode{
    let mut rules=Vec::new();
    while self.current<self.tokens.len(){
        if let Some(t)=self.peek(){
            if t.token_type==TokenType::SectionSeparator{
                self.advance();
                continue;
            }
        }
        rules.push(self.parse_flex_rules());
    }
    ASTNode::FlexFile { rules }
}
fn parse_flex_rules(&mut self)->ASTNode{
    let pattern_token=self.advance();
    let pattern=match pattern_token{
        Some(t) if t.token_type==TokenType::Regex||t.token_type==TokenType::Identifier=>t.value.clone(),
        _ => {
    let (l, c) = self.peek().map(|t| (t.line, t.column)).unwrap_or((0, 0));
    return ASTNode::Error { message: "Expected Regex Pattern".to_string(), line: l, column: c }
},
    };
    let action_token = self.advance();
        let action = match action_token {
            Some(t) if t.token_type == TokenType::ActionBlock => t.value.clone(),
            _ => {
    let (l, c) = self.peek().map(|t| (t.line, t.column)).unwrap_or((0, 0));
    return ASTNode::Error { message: "Expected Regex Pattern".to_string(), line: l, column: c }
},
        };
    ASTNode::FlexRule { pattern, action }

}
}
pub fn scan_code(input:&str)->Vec<Token>{lexer(input)}
pub fn parse_flex(input:&str)->ASTNode{
    let tokens=lexer(input);
    let mut parser=Parser::new(tokens);
    parser.parse_flex_program()
}
pub fn parse_bison(input:&str)->ASTNode{
    let tokens=lexer(input);
    let mut parser=Parser::new(tokens);
    parser.parse_bison_program()
}