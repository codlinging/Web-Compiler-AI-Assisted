"use client";

import { useState } from "react";
import CodeEditor from "../components/CodeEditor";

interface Token {
  token_type: string;
  value: string;
  line: number;
  column: number;
}

interface ASTNode {
  type: "FlexFile" | "FlexRule" | "Error" | "BisonFile" | "BisonTokenDecl" | "BisonGrammarRule" | "BisonAlternative";
  rules?: ASTNode[];
  pattern?: string;
  declarations?: ASTNode[];
  names?: string[];
  name?: string;
  alternatives?: ASTNode[];
  symbols?: string[];
  action?: string;
  message?: string;
  line?: number;
  column?: number;
}

const DEFAULT_FLEX_CODE = "%%\n[0-9]+    { return NUMBER; }\n[a-z]+    { return WORD; }\n%%";
const DEFAULT_BISON_CODE = "%token NUMBER WORD\n%%\nexpression:\n    expression '+' term { $$ = $1 + $3; }\n  | term { $$ = $1; }\n  ;\n";

const TreeNode = ({ 
  node, 
  onAskAI, 
  isLoadingAI, 
  aiResponse 
}: { 
  node: ASTNode | string;
  onAskAI?: (msg: string, line: number) => void;
  isLoadingAI?: boolean;
  aiResponse?: string | null;
}) => {
  if (!node) return null;

  if (typeof node === "string") {
    return <span className="text-green-300">"{node}"</span>;
  }

  // --- FLEX NODES ---
  if (node.type === "FlexFile") {
    return (
      <div className="ml-4 border-l border-gray-700 pl-4 mt-2">
        <span className="text-yellow-500 font-bold text-xs uppercase">Flex File Root</span>
        {node.rules?.map((child, i) => (
          <TreeNode key={i} node={child} onAskAI={onAskAI} isLoadingAI={isLoadingAI} aiResponse={aiResponse} />
        ))}
      </div>
    );
  }

  if (node.type === "FlexRule") {
    return (
      <div className="ml-4 border-l-2 border-purple-500 pl-4 mt-4 bg-gray-900/50 p-2 rounded flex items-center justify-between gap-4">
        <div>
           <div className="text-gray-500 text-[10px] uppercase">Pattern (Regex)</div>
           <div className="text-purple-300 font-mono text-lg">{node.pattern}</div>
        </div>
        <span className="text-gray-500 text-2xl">→</span>
        <div>
           <div className="text-gray-500 text-[10px] uppercase">Action (C Code)</div>
           <div className="text-green-400 font-mono text-sm bg-black px-2 py-1 rounded">
             {node.action}
           </div>
        </div>
      </div>
    );
  }

  // --- BISON NODES ---
  if (node.type === "BisonFile") {
    return (
      <div className="ml-4 border-l border-blue-800 pl-4 mt-2">
        <span className="text-blue-500 font-bold text-xs uppercase tracking-wider">Bison File Root</span>
        
        {node.declarations && node.declarations.length > 0 && (
          <div className="mt-4">
            <span className="text-gray-500 text-[10px] uppercase">Declarations Section</span>
            {node.declarations.map((child, i) => (
              <TreeNode key={`decl-${i}`} node={child} onAskAI={onAskAI} isLoadingAI={isLoadingAI} aiResponse={aiResponse} />
            ))}
          </div>
        )}

        {node.rules && node.rules.length > 0 && (
          <div className="mt-4">
            <span className="text-gray-500 text-[10px] uppercase">Grammar Rules Section</span>
            {node.rules.map((child, i) => (
              <TreeNode key={`rule-${i}`} node={child} onAskAI={onAskAI} isLoadingAI={isLoadingAI} aiResponse={aiResponse} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (node.type === "BisonTokenDecl") {
    return (
      <div className="ml-4 mt-2 flex gap-2 items-center bg-blue-900/20 p-2 rounded w-fit border border-blue-900/50">
        <span className="text-blue-400 font-bold text-xs font-mono">%token</span>
        {node.names?.map((n, i) => (
          <span key={i} className="text-yellow-300 font-mono text-sm">{n}</span>
        ))}
      </div>
    );
  }

  if (node.type === "BisonGrammarRule") {
    return (
      <div className="ml-4 border-l-2 border-indigo-500 pl-4 mt-4 bg-gray-900/40 p-3 rounded">
        <div className="text-indigo-400 font-bold text-lg font-mono mb-3">
          {node.name} <span className="text-gray-500">:</span>
        </div>
        <div className="flex flex-col gap-2">
          {node.alternatives?.map((alt, i) => (
             <TreeNode key={i} node={alt} onAskAI={onAskAI} isLoadingAI={isLoadingAI} aiResponse={aiResponse} />
          ))}
        </div>
      </div>
    );
  }

  if (node.type === "BisonAlternative") {
    return (
      <div className="ml-4 flex items-center gap-4 border-l border-gray-700 pl-3 py-1">
        <span className="text-gray-600 font-bold">|</span>
        <div className="flex flex-wrap gap-2 flex-1">
          {node.symbols?.length === 0 && <span className="text-gray-600 italic text-xs">/* empty */</span>}
          {node.symbols?.map((sym, i) => (
             <span key={i} className="text-teal-300 font-mono bg-black/50 px-1.5 py-0.5 rounded border border-gray-800">{sym}</span>
          ))}
        </div>
        {node.action && (
          <div className="text-green-400 font-mono text-xs bg-black px-2 py-1 rounded ml-auto border border-green-900/30">
            {node.action}
          </div>
        )}
      </div>
    );
  }

  // --- ERRORS & AI ASSISTANT ---
  if (node.type === "Error") {
    return (
      <div className="ml-4 border-l-2 border-red-500 pl-4 mt-4 bg-red-900/10 p-3 rounded-r-lg flex flex-col gap-3">
        <div>
          <span className="text-red-500 font-bold text-xs uppercase tracking-widest border border-red-500/30 px-2 py-1 rounded bg-red-900/30">
            Syntax Error
          </span>
          <p className="text-red-300 text-sm mt-2">
            <strong className="text-white">Line {node.line}, Col {node.column}:</strong> {node.message}
          </p>
        </div>

        <div className="border-t border-red-900/30 pt-3 mt-1">
          {!aiResponse && !isLoadingAI && (
            <button 
              onClick={() => onAskAI && onAskAI(node.message || "Unknown error", node.line || 1)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold py-1.5 px-4 rounded-full transition-all flex items-center gap-2"
            >
              ✨ Ask Gemini to fix this
            </button>
          )}

          {isLoadingAI && (
            <div className="text-blue-400 text-xs flex items-center gap-2 animate-pulse">
              ✨ Gemini is analyzing your code...
            </div>
          )}

          {aiResponse && (
            <div className="bg-blue-900/20 border border-blue-800/50 p-3 rounded text-sm text-blue-100 mt-2 font-sans whitespace-pre-wrap">
              <span className="font-bold text-blue-400 block mb-1">✨ AI Assistant:</span>
              {aiResponse}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <div className="text-gray-500 text-xs mt-2">Unknown Node: {node.type}</div>;
};

export default function Home() {
  const [language, setLanguage] = useState<"flex" | "bison">("flex");
  const [code, setCode] = useState(DEFAULT_FLEX_CODE);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [ast, setAst] = useState<ASTNode | null>(null); 
  
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const handleLanguageSwitch = (newLang: "flex" | "bison") => {
    setLanguage(newLang);
    setCode(newLang === "flex" ? DEFAULT_FLEX_CODE : DEFAULT_BISON_CODE);
    setTokens([]);
    setAst(null);
    setAiResponse(null);
  };

  const handleEditorChange = async (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setAiResponse(null); 
      
      try {
        const response = await fetch("http://127.0.0.1:4000/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value, language }), 
        });

        if (!response.ok) throw new Error(`Server error`);
        const data = await response.json();
        setTokens(data.tokens);
        setAst(data.ast);
      } catch (e) {
        console.error("Backend connection failed:", e);
      }
    }
  };

  const handleAskAI = async (errorMessage: string, line: number) => {
    setIsLoadingAI(true);
    setAiResponse(null);
    
    try {
      const response = await fetch("http://127.0.0.1:4000/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code,
          language: language,
          error_message: errorMessage,
          error_line: line
        }),
      });

      if (!response.ok) throw new Error("Failed to reach AI backend");
      const data = await response.json();
      setAiResponse(data.suggestion);
    } catch (e) {
      setAiResponse("⚠️ Could not connect to the AI assistant. Ensure your backend is running and the GEMINI_API_KEY is set.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Recursively find errors so squiggly lines appear even if the error is nested in Bison rules
  const findErrorNode = (node: ASTNode | undefined): { line: number; column: number; message: string } | null => {
    if (!node) return null;
    if (node.type === "Error") {
      return { line: node.line || 1, column: node.column || 1, message: node.message || "Error" };
    }
    
    if (node.rules) {
      for (const rule of node.rules) {
        const err = findErrorNode(rule);
        if (err) return err;
      }
    }
    if (node.declarations) {
      for (const decl of node.declarations) {
        const err = findErrorNode(decl);
        if (err) return err;
      }
    }
    if (node.alternatives) {
      for (const alt of node.alternatives) {
        const err = findErrorNode(alt);
        if (err) return err;
      }
    }
    return null;
  };

  const currentError = ast ? findErrorNode(ast) : null;

  return (
    <main className="flex h-screen bg-black text-white p-4 gap-4 overflow-hidden">
      <div className="w-1/2 flex flex-col gap-4">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Structura.ai Engine
            </h1>
          </div>
          <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
            <button onClick={() => handleLanguageSwitch("flex")} className={`px-4 py-1 rounded text-sm font-bold ${language === "flex" ? "bg-purple-600" : "text-gray-500"}`}>Flex</button>
            <button onClick={() => handleLanguageSwitch("bison")} className={`px-4 py-1 rounded text-sm font-bold ${language === "bison" ? "bg-blue-600" : "text-gray-500"}`}>Bison</button>
          </div>
        </header>

        <CodeEditor code={code} onChange={handleEditorChange} error={currentError} />

        <div className="h-32 bg-gray-900 rounded-lg border border-gray-800 p-2 overflow-auto">
          <div className="flex flex-wrap gap-2">
            {tokens.map((t, i) => (
              <span key={i} className="px-2 py-1 bg-black border border-gray-700 rounded text-[10px] text-blue-300 font-mono">
                {t.token_type}: <span className="text-white">{t.value}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="w-1/2 flex flex-col gap-4 bg-[#0a0a0a] rounded-lg border border-gray-800 p-4">
        <div className="flex justify-between items-center border-b border-gray-800 pb-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
            Abstract Syntax Tree
          </h2>
        </div>

        <div className="flex-1 overflow-auto font-mono text-sm">
          {ast ? (
            <TreeNode node={ast} onAskAI={handleAskAI} isLoadingAI={isLoadingAI} aiResponse={aiResponse} />
          ) : (
            <div className="text-gray-600 italic">Type code to generate AST...</div>
          )}
        </div>
      </div>
    </main>
  );
}