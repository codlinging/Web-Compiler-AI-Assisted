"use client";

import { useState, useEffect } from "react";
import CodeEditor from "../components/CodeEditor";
import init, { scan_code, parse_code } from "engine"; 

interface Token {
  token_type: string;
  value: string;
  line: number;
}

interface ASTNode {
  type: "FlexFile" | "Rule" | "Error";
  rules?: ASTNode[];
  pattern?: string;
  action?: string;
  message?: string;
}

const TreeNode = ({ node }: { node: ASTNode | string }) => {
  if (!node) return null;

  if (typeof node === "string") {
    return <span className="text-green-300">"{node}"</span>;
  }

  if (node.type === "FlexFile") {
    return (
      <div className="ml-4 border-l border-gray-700 pl-4 mt-2">
        <span className="text-yellow-500 font-bold text-xs uppercase">Flex File Root</span>
        {node.rules?.map((child, i) => (
          <TreeNode key={i} node={child} />
        ))}
      </div>
    );
  }

  if (node.type === "Rule") {
    return (
      <div className="ml-4 border-l-2 border-purple-500 pl-4 mt-4 bg-gray-900/50 p-2 rounded flex items-center justify-between gap-4">
        <div>
           <div className="text-gray-500 text-[10px] uppercase">Pattern (Regex)</div>
           <div className="text-purple-300 font-mono text-lg">{node.pattern}</div>
        </div>
        <div>
           <span className="text-gray-500 text-2xl">→</span>
        </div>
        <div>
           <div className="text-gray-500 text-[10px] uppercase">Action (C Code)</div>
           <div className="text-green-400 font-mono text-sm bg-black px-2 py-1 rounded">
             {node.action}
           </div>
        </div>
      </div>
    );
  }

  // ADDED: Error handling block
  if (node.type === "Error") {
    return (
      <div className="ml-4 border-l-2 border-red-500 pl-4 mt-2 bg-red-900/20 p-2 rounded">
        <span className="text-red-500 font-bold text-xs">SYNTAX ERROR</span>
        <p className="text-red-300 text-sm">{node.message}</p>
      </div>
    );
  }

  // ADDED: Fallback return so React doesn't crash
  return <div className="text-gray-500">Unknown Node</div>;
};

export default function Home() {
  // CHANGED: Default code is now Flex syntax
  const [code, setCode] = useState("%%\n[0-9]+    { return NUMBER; }\n[a-z]+    { return WORD; }\n%%");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [ast, setAst] = useState<ASTNode | null>(null); 
  const [isWasmLoaded, setIsWasmLoaded] = useState(false);

  useEffect(() => {
    init().then(() => setIsWasmLoaded(true));
  }, []);

  // Replace the WASM calls in handleEditorChange
const handleEditorChange = async (value: string | undefined) => {
  if (value !== undefined) {
    setCode(value);
    try {
      const response = await fetch("http://localhost:4000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });

      const data = await response.json();
      setTokens(data.tokens);
      setAst(data.ast);
    } catch (e) {
      console.error("Failed to connect to backend:", e);
    }
  }
};
  

  return (
    <main className="flex h-screen bg-black text-white p-4 gap-4 overflow-hidden">
      <div className="w-1/2 flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Intelligent Compiler Studio
          </h1>
          <p className="text-xs text-gray-500">Flex Parser v0.4</p>
        </header>
        <CodeEditor code={code} onChange={handleEditorChange} />

        <div className="h-32 bg-gray-900 rounded-lg border border-gray-800 p-2 overflow-auto">
          <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">Lexer Output (Tokens)</h3>
          <div className="flex flex-wrap gap-2">
            {tokens.map((t, i) => (
              <span key={i} className="px-2 py-1 bg-black border border-gray-700 rounded text-xs text-blue-300 font-mono">
                {t.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="w-1/2 flex flex-col gap-4 bg-[#111] rounded-lg border border-gray-800 p-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-2">
          Abstract Syntax Tree (Parser)
        </h2>

        <div className="flex-1 overflow-auto font-mono text-sm">
          {ast ? (
            <TreeNode node={ast} />
          ) : (
            <span className="text-gray-600 italic">Waiting for input...</span>
          )}
        </div>
      </div>
    </main>
  );
}