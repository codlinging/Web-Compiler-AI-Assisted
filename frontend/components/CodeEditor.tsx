import { useRef, useEffect } from "react";
import Editor, { Monaco } from "@monaco-editor/react";

interface CodeEditorProps {
  code: string;
  onChange: (value: string | undefined) => void;
  error?: { line: number; column: number; message: string } | null;
}

export default function CodeEditor({ code, onChange, error }: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Store the editor instances when it loads
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Draw the red squiggly lines whenever the error prop changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (!model) return;

      if (error) {
        // Create the error marker
        const marker = {
          message: error.message,
          severity: monacoRef.current.MarkerSeverity.Error,
          startLineNumber: error.line,
          startColumn: error.column,
          endLineNumber: error.line,
          endColumn: error.column + 10, // Highlight a chunk of text
        };
        // Apply the marker to the editor
        monacoRef.current.editor.setModelMarkers(model, "compiler", [marker]);
      } else {
        // Clear all markers if there is no error
        monacoRef.current.editor.setModelMarkers(model, "compiler", []);
      }
    }
  }, [error]);

  return (
    <div className="flex-1 rounded-lg overflow-hidden border border-gray-800">
      <Editor
        height="100%"
        defaultLanguage="c" // Flex/Bison is heavily C-based
        theme="vs-dark"
        value={code}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          padding: { top: 16 },
        }}
      />
    </div>
  );
}