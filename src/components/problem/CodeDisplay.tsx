import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, GitCompare } from 'lucide-react';
import { computeSimpleLineDiff } from '../../utils/diff';

interface Props {
  code: string;
  previousCode?: string;
  language?: string;
}

export const CodeDisplay: React.FC<Props> = ({ code, previousCode }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const lines = code.split('\n');
  const isLong = lines.length > 20;
  const displayedLines = isLong && !expanded ? lines.slice(0, 20) : lines;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const diffLines = previousCode && showDiff ? computeSimpleLineDiff(previousCode, code) : [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden text-slate-100 text-xs font-mono shadow-inner my-3">
      {/* Code Toolbar */}
      <div className="bg-slate-950/80 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2">
          <span>{lines.length} lines</span>
          {previousCode && (
            <button
              type="button"
              onClick={() => setShowDiff((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors ${
                showDiff
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <GitCompare className="w-3 h-3" />
              {showDiff ? 'Hide Diff' : 'Diff vs Previous'}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-slate-800 text-slate-300 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Code / Diff Body */}
      {showDiff && previousCode ? (
        <div className="p-3 overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs leading-5">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={`flex items-start px-2 py-0.5 rounded ${
                line.type === 'added'
                  ? 'bg-emerald-950/60 text-emerald-200'
                  : line.type === 'removed'
                    ? 'bg-rose-950/60 text-rose-300'
                    : 'text-slate-300'
              }`}
            >
              <span className="w-4 select-none opacity-50 shrink-0">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <pre className="flex-1 whitespace-pre">{line.text || ' '}</pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 overflow-x-auto relative">
          <div className="space-y-0.5">
            {displayedLines.map((line, idx) => (
              <div key={idx} className="flex leading-5">
                <span className="w-8 select-none text-slate-600 text-right pr-3 shrink-0">
                  {idx + 1}
                </span>
                <span className="whitespace-pre flex-1 text-slate-200">{line || ' '}</span>
              </div>
            ))}
          </div>

          {isLong && !expanded && (
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
          )}
        </div>
      )}

      {/* Show all toggle */}
      {isLong && !showDiff && (
        <div className="bg-slate-950/60 px-3 py-2 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-sans font-medium"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Show all {lines.length} lines <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
