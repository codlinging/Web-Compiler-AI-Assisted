"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import CodeEditor from "../components/CodeEditor";

interface Token {
  token_type: string;
  value: string;
  line: number;
  column: number;
}

interface ASTNode {
  type: "FlexFile" | "FlexRule" | "Error" | "BisonFile" | "BisonTokenDecl" | "BisonGrammarRule" | "BisonAlternative";
  prologue?: string;
  epilogue?: string;
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

// Framer Motion variant for cascading tree animations
const treeNodeVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
};

const TreeNode = ({ 
  node, onAskAI, isLoadingAI, aiResponse 
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
      <motion.div variants={treeNodeVariants} initial="hidden" animate="visible" className="ml-4 border-l border-gray-700/50 pl-4 mt-2">
        <span className="text-yellow-500 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div> Flex File Root
        </span>
        
        {node.prologue && (
          <motion.div variants={treeNodeVariants} className="mt-3 mb-2">
            <span className="text-gray-500 text-[10px] uppercase tracking-widest">Prologue</span>
            <pre className="bg-gray-900/40 backdrop-blur-sm border border-gray-700/50 p-3 rounded-lg text-blue-300 text-xs mt-1 whitespace-pre-wrap shadow-inner">
              {node.prologue}
            </pre>
          </motion.div>
        )}

        <div className="flex flex-col gap-2 mt-2">
          {node.rules?.map((child, i) => (
            <TreeNode key={i} node={child} onAskAI={onAskAI} isLoadingAI={isLoadingAI} aiResponse={aiResponse} />
          ))}
        </div>

        {node.epilogue && (
          <motion.div variants={treeNodeVariants} className="mt-4">
            <span className="text-gray-500 text-[10px] uppercase tracking-widest">Epilogue</span>
            <pre className="bg-gray-900/40 backdrop-blur-sm border border-gray-700/50 p-3 rounded-lg text-blue-300 text-xs mt-1 whitespace-pre-wrap shadow-inner">
              {node.epilogue}
            </pre>
          </motion.div>
        )}
      </motion.div>
    );
  }

  if (node.type === "FlexRule") {
    return (
      <motion.div variants={treeNodeVariants} className="ml-4 border-l-2 border-purple-500 pl-4 mt-2 bg-gradient-to-r from-gray-900/60 to-transparent p-3 rounded-r-xl flex items-center justify-between gap-4 hover:from-purple-900/20 transition-all duration-300 group">
        <div>
           <div className="text-gray-500 text-[10px] uppercase group-hover:text-purple-400 transition-colors">Pattern (Regex)</div>
           <div className="text-purple-300 font-mono text-lg">{node.pattern}</div>
        </div>
        <span className="text-gray-600 text-2xl group-hover:text-purple-500 transition-colors opacity-50">→</span>
        <div className="flex-1 max-w-[50%]">
           <div className="text-gray-500 text-[10px] uppercase">Action (C Code)</div>
           <div className="text-green-400 font-mono text-sm bg-black/50 px-3 py-1.5 rounded-md border border-gray-800/80 truncate">
             {node.action}
           </div>
        </div>
      </motion.div>
    );
  }

  // --- BISON NODES ---
  if (node.type === "BisonFile") {
    return (
      <motion.div variants={treeNodeVariants} initial="hidden" animate="visible" className="ml-4 border-l border-blue-800/50 pl-4 mt-2">
        <span className="text-blue-500 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div> Bison File Root
        </span>
        
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
      </motion.div>
    );
  }

  if (node.type === "BisonTokenDecl") {
    return (
      <motion.div variants={treeNodeVariants} className="ml-4 mt-2 flex gap-2 items-center bg-blue-900/10 p-2.5 rounded-lg w-fit border border-blue-900/30 hover:border-blue-500/50 transition-colors shadow-sm">
        <span className="text-blue-400 font-bold text-xs font-mono">%token</span>
        {node.names?.map((n, i) => (
          <span key={i} className="text-yellow-300 font-mono text-sm bg-black/40 px-2 py-0.5 rounded">{n}</span>
        ))}
      </motion.div>
    );
  }

  if (node.type === "BisonGrammarRule") {
    return (
      <motion.div variants={treeNodeVariants} className="ml-4 border-l-2 border-indigo-500 pl-4 mt-4 bg-gray-900/30 p-4 rounded-r-xl shadow-sm hover:shadow-indigo-900/10 transition-all">
        <div className="text-indigo-400 font-bold text-lg font-mono mb-3 flex items-center gap-2">
          {node.name} <span className="text-gray-600">:</span>
        </div>
        <div className="flex flex-col gap-2">
          {node.alternatives?.map((alt, i) => (
             <TreeNode key={i} node={alt} onAskAI={onAskAI} isLoadingAI={isLoadingAI} aiResponse={aiResponse} />
          ))}
        </div>
      </motion.div>
    );
  }

  if (node.type === "BisonAlternative") {
    return (
      <motion.div variants={treeNodeVariants} className="ml-4 flex items-center gap-4 border-l border-gray-700/50 pl-3 py-1.5 hover:bg-gray-800/20 rounded-r-lg transition-colors">
        <span className="text-gray-600 font-bold">|</span>
        <div className="flex flex-wrap gap-2 flex-1">
          {node.symbols?.length === 0 && <span className="text-gray-600 italic text-xs">/* empty */</span>}
          {node.symbols?.map((sym, i) => (
             <span key={i} className="text-teal-300 font-mono bg-black/60 px-2 py-1 rounded-md border border-gray-800/80 shadow-inner">{sym}</span>
          ))}
        </div>
        {node.action && (
          <div className="text-green-400 font-mono text-xs bg-black/80 px-3 py-1.5 rounded-md ml-auto border border-green-900/30 truncate max-w-[40%]">
            {node.action}
          </div>
        )}
      </motion.div>
    );
  }

  // --- ERRORS & AI ASSISTANT ---
  if (node.type === "Error") {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="ml-4 border-l-4 border-red-500 pl-4 mt-4 bg-gradient-to-r from-red-900/20 to-transparent p-4 rounded-r-xl flex flex-col gap-3 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
      >
        <div>
          <span className="text-red-500 font-bold text-xs uppercase tracking-widest border border-red-500/30 px-2 py-1 rounded bg-red-900/30 flex w-fit items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Syntax Error
          </span>
          <p className="text-red-300 text-sm mt-3 font-mono">
            <strong className="text-white bg-red-950/50 px-2 py-1 rounded mr-2">Line {node.line}, Col {node.column}</strong> {node.message}
          </p>
        </div>

        <div className="border-t border-red-900/30 pt-3 mt-1">
          {!aiResponse && !isLoadingAI && (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAskAI && onAskAI(node.message || "Unknown error", node.line || 1)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold py-2 px-5 rounded-full transition-all flex items-center gap-2 shadow-lg hover:shadow-purple-500/25"
            >
              ✨ Ask Gemini to fix this
            </motion.button>
          )}

          {isLoadingAI && (
            <div className="text-blue-400 text-xs flex items-center gap-2 animate-pulse bg-blue-900/20 w-fit px-4 py-2 rounded-full border border-blue-800/50">
              ✨ Gemini is analyzing your code...
            </div>
          )}

          {aiResponse && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-950/40 border border-blue-800/50 p-4 rounded-xl text-sm text-blue-100 mt-2 font-sans whitespace-pre-wrap shadow-inner">
              <span className="font-bold text-blue-400 flex items-center gap-2 mb-2 border-b border-blue-900/50 pb-2">
                ✨ AI Assistant Analysis
              </span>
              <span className="leading-relaxed">{aiResponse}</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  return <div className="text-gray-500 text-xs mt-2">Unknown Node: {node.type}</div>;
};

export default function Home() {
  const [language, setLanguage] = useState<"flex" | "bison">("flex");
  const [code, setCode] = useState(DEFAULT_FLEX_CODE);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [ast, setAst] = useState<ASTNode | null>(null); 
  
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"ast" | "c-code" | "console">("ast");
  
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const [testInput, setTestInput] = useState<string>("123 + 456");
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState<boolean>(false);

  const handleLanguageSwitch = (newLang: "flex" | "bison") => {
    setLanguage(newLang);
    setCode(newLang === "flex" ? DEFAULT_FLEX_CODE : DEFAULT_BISON_CODE);
    setTokens([]);
    setAst(null);
    setGeneratedCode(null);
    setAiResponse(null);
    setConsoleOutput("");
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
        setGeneratedCode(data.generated_code);
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
        body: JSON.stringify({ code, language, error_message: errorMessage, error_line: line }),
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

  const handleRunCompiler = async () => {
    if (!generatedCode) {
      setConsoleOutput("❌ Error: No valid C code to compile. Fix syntax errors first.");
      return;
    }
    
    setIsCompiling(true);
    setConsoleOutput("⚙️ System initializing...\n⚙️ Compiling with GCC...");

    try {
      const response = await fetch("http://127.0.0.1:4000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c_code: generatedCode, test_input: testInput }),
      });

      const data = await response.json();
      if (data.error) {
        setConsoleOutput(`❌ [COMPILATION ERROR]\n${data.error}`);
      } else {
        setConsoleOutput(`✅ [COMPILATION SUCCESS]\n\n🖥️ [PROGRAM OUTPUT]\n${data.output}`);
      }
    } catch (e) {
      setConsoleOutput("⚠️ Failed to reach execution server.");
    } finally {
      setIsCompiling(false);
    }
  };

  const findErrorNode = (node: ASTNode | undefined): { line: number; column: number; message: string } | null => {
    if (!node) return null;
    if (node.type === "Error") return { line: node.line || 1, column: node.column || 1, message: node.message || "Error" };
    if (node.rules) for (const rule of node.rules) { const err = findErrorNode(rule); if (err) return err; }
    if (node.declarations) for (const decl of node.declarations) { const err = findErrorNode(decl); if (err) return err; }
    if (node.alternatives) for (const alt of node.alternatives) { const err = findErrorNode(alt); if (err) return err; }
    return null;
  };

  const currentError = ast ? findErrorNode(ast) : null;

  return (
   <main className="flex h-screen bg-[#050505] text-white p-4 gap-4 overflow-hidden selection:bg-purple-500/30">
      
      {/* Left Column: Editor & Tokens */}
      <div className="w-1/2 flex flex-col gap-4">
        <header className="flex justify-between items-center bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 relative bg-gradient-to-br from-gray-800 to-black rounded-xl border border-gray-700 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
              {/* FIXED: Added w-auto h-auto to fix the Next.js warning */}
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain w-auto h-auto" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent drop-shadow-sm">
                Syntaxia 
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-0.5">Compiler Studio Engine</p>
            </div>
          </div>
          
          <div className="flex bg-black/50 p-1 rounded-xl border border-white/[0.05] shadow-inner">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => handleLanguageSwitch("flex")} 
              className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 ${language === "flex" ? "bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]" : "text-gray-500 hover:text-gray-300"}`}
            >
              Flex
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => handleLanguageSwitch("bison")} 
              className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 ${language === "bison" ? "bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]" : "text-gray-500 hover:text-gray-300"}`}
            >
              Bison
            </motion.button>
          </div>
        </header>

        {/* FIXED: Added 'flex flex-col' so the Monaco Editor knows how to stretch and fill the space! */}
        <div className="flex-1 flex flex-col bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden shadow-2xl relative group z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"></div>
          
          {/* We wrap the CodeEditor in a z-20 container so it sits above the background glow */}
          <div className="flex-1 w-full h-full relative z-20 flex flex-col">
            <CodeEditor code={code} onChange={handleEditorChange} error={currentError} />
          </div>
        </div>

        <div className="h-36 bg-white/[0.02] backdrop-blur-md rounded-2xl border border-white/[0.05] p-4 overflow-auto shadow-lg relative">
          <div className="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-widest sticky top-0 bg-[#050505]/80 backdrop-blur pb-2 z-10">Lexer Token Stream</div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {tokens.map((t, i) => (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.01 }}
                  key={i} className="px-2 py-1 bg-black/60 border border-gray-700/50 rounded-md text-[10px] text-blue-300 font-mono shadow-sm hover:border-blue-500/50 transition-colors cursor-default"
                >
                  {t.token_type}: <span className="text-gray-100">{t.value}</span>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Right Column: Engine Output (Keep your existing code for this section) */}
      {/* Right Column: Engine Output */}
      <div className="w-1/2 flex flex-col gap-4 bg-white/[0.02] backdrop-blur-md rounded-2xl border border-white/[0.05] p-5 shadow-2xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-between items-center border-b border-gray-800/50 pb-3 relative z-10">
          <div className="flex gap-6 px-2">
            {["ast", "c-code", "console"].map((mode) => (
              <button 
                key={mode} onClick={() => setViewMode(mode as any)}
                className={`text-xs font-bold uppercase tracking-widest pb-2 border-b-2 transition-all duration-300 ${viewMode === mode ? (mode === "ast" ? "text-blue-400 border-blue-500" : mode === "c-code" ? "text-green-400 border-green-500" : "text-yellow-400 border-yellow-500") : "text-gray-600 border-transparent hover:text-gray-400"}`}
              >
                {mode === "ast" ? "Syntax Tree" : mode === "c-code" ? "C Code" : "Run Console"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto font-mono text-sm relative z-10 pr-2 custom-scrollbar">
          <AnimatePresence mode="wait">
            {viewMode === "ast" && (
               <motion.div key="ast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                 {ast ? <TreeNode node={ast} onAskAI={handleAskAI} isLoadingAI={isLoadingAI} aiResponse={aiResponse} /> : <div className="text-gray-600 italic flex h-full items-center justify-center mt-20">Type code to generate Abstract Syntax Tree...</div>}
               </motion.div>
            )}
            
            {viewMode === "c-code" && (
               <motion.div key="c-code" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
                 {generatedCode ? <pre className="text-green-400/90 p-5 bg-black/60 border border-green-900/20 rounded-xl whitespace-pre-wrap shadow-inner leading-relaxed">{generatedCode}</pre> : <div className="text-gray-600 italic flex h-full items-center justify-center mt-20">Waiting for valid syntax to generate C code...</div>}
               </motion.div>
            )}
            
            {viewMode === "console" && (
              <motion.div key="console" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4 h-full">
                <div className="flex flex-col gap-3 bg-black/40 p-4 rounded-xl border border-gray-800/50 shadow-inner">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div> Test Input Stream (stdin)
                  </label>
                  <textarea 
                    value={testInput} onChange={(e) => setTestInput(e.target.value)}
                    className="bg-black/60 border border-gray-700/50 rounded-lg p-3 text-sm text-gray-200 font-mono focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all outline-none resize-none shadow-inner"
                    rows={2} placeholder="Type your test string here..."
                  />
                  <motion.button 
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    onClick={handleRunCompiler} disabled={isCompiling}
                    className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold py-2.5 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(202,138,4,0.2)]"
                  >
                    {isCompiling ? <span className="animate-spin">⚙️</span> : "▶️"} 
                    {isCompiling ? "Compiling Executable..." : "Compile & Run Grammar"}
                  </motion.button>
                </div>
                <div className="flex-1 bg-black/60 border border-gray-800/50 rounded-xl p-4 overflow-auto flex flex-col shadow-inner relative">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-3 tracking-widest sticky top-0 bg-black/80 w-fit px-2 py-1 rounded border border-gray-800">Terminal (stdout)</div>
                  <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap flex-1 leading-relaxed">
                    {consoleOutput || <span className="text-gray-600 italic">Awaiting execution command...</span>}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}