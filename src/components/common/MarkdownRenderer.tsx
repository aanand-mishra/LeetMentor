import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Copy,
  Check,
  Terminal,
  Timer,
  ShieldAlert,
  AlertTriangle,
  Compass,
  FileCode,
  Sparkles,
} from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code', e);
    }
  };

  const displayLang = (language || 'code').toUpperCase();

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-700/70 dark:border-slate-800 bg-[#1e1e2e] shadow-md group transition-all">
      {/* Chrome header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#181825] border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-400 tracking-wider">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            {displayLang}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 transition-all border border-slate-700/60 shadow-xs active:scale-95"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body with Prism syntax highlighter */}
      <div className="overflow-x-auto text-xs font-mono select-text">
        <SyntaxHighlighter
          language={language || 'text'}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1.15rem 1rem',
            background: 'transparent',
            fontSize: '0.83rem',
            lineHeight: '1.65',
            fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, Courier New, monospace',
          }}
          wrapLongLines={false}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Full Markdown renderer with GitHub Flavored Markdown (tables, tasklists),
 * KaTeX math ($...$ inline and $$...$$ display math), and IDE-grade code highlighting.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  return (
    <div className={`markdown-body max-w-none text-slate-800 dark:text-slate-200 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => {
            const raw = typeof children === 'string' ? children : String(children);
            let Icon = null;
            let badgeStyle = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/60 dark:border-indigo-800/60';

            if (/complexity/i.test(raw)) {
              Icon = Timer;
              badgeStyle = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-800/60';
            } else if (/edge case/i.test(raw)) {
              Icon = ShieldAlert;
              badgeStyle = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200/60 dark:border-amber-800/60';
            } else if (/pitfall|mistake/i.test(raw)) {
              Icon = AlertTriangle;
              badgeStyle = 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200/60 dark:border-rose-800/60';
            } else if (/related/i.test(raw)) {
              Icon = Compass;
              badgeStyle = 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-200/60 dark:border-purple-800/60';
            } else if (/solution|code/i.test(raw)) {
              Icon = FileCode;
              badgeStyle = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/60 dark:border-indigo-800/60';
            } else if (/question|challenge|pattern|insight|blueprint/i.test(raw)) {
              Icon = Sparkles;
              badgeStyle = 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-200/60 dark:border-sky-800/60';
            }

            return (
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-3 flex items-center gap-2.5 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                {Icon && (
                  <span className={`p-1 rounded-md ${badgeStyle} border inline-flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </span>
                )}
                <span>{children}</span>
              </h2>
            );
          },
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-4 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 my-2.5">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2.5 space-y-1.5 list-none pl-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 space-y-2 list-decimal list-outside pl-5 text-sm text-slate-700 dark:text-slate-300 font-medium marker:font-bold marker:text-indigo-600 dark:marker:text-indigo-400">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 flex items-start gap-2.5 my-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-2 shrink-0" aria-hidden="true" />
              <span className="flex-1">{children}</span>
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 px-4 py-2.5 rounded-r-lg my-3 text-slate-700 dark:text-slate-300 italic text-sm">
              {children}
            </blockquote>
          ),
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            />
          ),
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-3 border border-slate-200 dark:border-slate-800 rounded-lg">
              <table {...props} className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs" />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              {...props}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 text-left"
            />
          ),
          td: ({ ...props }) => (
            <td
              {...props}
              className="px-3 py-2 border-t border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-300"
            />
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900 dark:text-white">
              {children}
            </strong>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName && typeof children === 'string' && !children.includes('\n');
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-[12px] font-mono border border-slate-200/60 dark:border-slate-700/50"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            const match = /language-(\w+)/.exec(codeClassName || '');
            const language = match ? match[1] : '';
            return (
              <CodeBlock
                language={language}
                value={String(children).replace(/\n$/, '')}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

interface MathTextProps {
  content: string;
  className?: string;
}

/**
 * Inline math and text renderer. Replaces block <p> with inline <span> so it can be
 * safely used within table cells, badges, lists, headings, and labels.
 */
export const MathText: React.FC<MathTextProps> = ({ content, className = '' }) => {
  if (!content) return null;

  return (
    <span className={`inline-math-text inline ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {content}
      </ReactMarkdown>
    </span>
  );
};
