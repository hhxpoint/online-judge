"use client"

import { useRef, useEffect } from "react"
import Editor, { OnMount, OnChange } from "@monaco-editor/react"

interface CodeEditorProps {
  language: "cpp" | "python"
  value: string
  onChange: (value: string) => void
}

const defaultCode: Record<string, string> = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    // Write your code here
    
    return 0;
}
`,
  python: `# Write your code here

`,
}

export function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  const editorRef = useRef<any>(null)

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    monaco.editor.defineTheme("custom-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#1a1a2e",
      },
    })

    monaco.editor.setTheme("custom-dark")
  }

  const handleChange: OnChange = (value) => {
    onChange(value || "")
  }

  useEffect(() => {
    if (!value) {
      onChange(defaultCode[language])
    }
  }, [language])

  return (
    <Editor
      height="100%"
      language={language === "cpp" ? "cpp" : "python"}
      value={value || defaultCode[language]}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: "on",
        padding: { top: 16, bottom: 16 },
      }}
      loading={
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    />
  )
}
