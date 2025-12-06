import React from 'react';
import { Copy } from 'lucide-react';

interface CodePanelProps {
  code: string;
}

export const CodePanel: React.FC<CodePanelProps> = ({ code }) => {
  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-slate-300 font-mono text-xs border-l border-slate-800">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <span className="font-bold text-slate-400">CustomEntity.cpp</span>
        <button className="p-1 hover:bg-slate-800 rounded transition-colors" title="Copy">
          <Copy className="w-3 h-3 text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <pre className="whitespace-pre-wrap">
          <code className="text-green-400">{code}</code>
        </pre>
      </div>
    </div>
  );
};
