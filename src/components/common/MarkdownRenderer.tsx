import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Full Markdown renderer with GitHub Flavored Markdown (tables, tasklists)
 * and KaTeX math ($...$ inline and $$...$$ display math) support.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  return (
    <div className={`markdown-body prose prose-sm dark:prose-invert max-w-none leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
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
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === 'string' && !children.includes('\n');
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-[12px] font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
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
