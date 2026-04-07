"use client";

import Editor from "@monaco-editor/react";

type MonacoCodeEditorProps = {
  value: string;
  language: string;
  onChange: (value: string) => void;
};

export function MonacoCodeEditor({ value, language, onChange }: MonacoCodeEditorProps) {
  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      onChange={(nextValue) => onChange(nextValue || "")}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
      }}
    />
  );
}
