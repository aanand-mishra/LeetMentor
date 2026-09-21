/**
 * Formats raw AI Mentor markdown outputs into well-structured, syntax-highlighted,
 * and KaTeX-compliant markdown.
 *
 * Handles:
 * 1. Naked code blocks (e.g. `class Solution: ...`) without ``` fences.
 * 2. Unheaded section titles (e.g. `Complexity Analysis`, `Edge Cases:`) to markdown headers.
 * 3. Bare LaTeX formulas (e.g. `\mathcal{O}(n)`) into `$\mathcal{O}(n)$`.
 * 4. Normalizes complexity bullets.
 */
export function formatMentorMarkdown(
  rawContent: string,
  defaultLanguage: string = 'python'
): string {
  if (!rawContent || !rawContent.trim()) return '';

  let text = rawContent.trim();

  // 1. Wrap bare LaTeX formulas in dollar signs for KaTeX rendering
  // Matches \mathcal{O}(...) not already preceded by $
  text = text.replace(/(?<!\$)\\mathcal\{O\}\(([^)]+)\)(?!\$)/g, '$\\mathcal{O}($1)$');
  text = text.replace(/(?<!\$)(\\mathcal\{[a-zA-Z0-9_]+\})(?!\$)/g, '$$1$');

  // Also convert bare "Time/Space Complexity: O(n)" to "$O(n)$" if missing $
  text = text.replace(/(Time|Space)\s+Complexity:\s*(O\([^)]+\))(?!\$)/gi, (_match, p1, p2) => {
    return `${p1} Complexity: $${p2}$`;
  });

  // 2. Process line by line to detect unheaded sections & unfenced code
  const lines = text.split('\n');
  const processedLines: string[] = [];
  let inFencedBlock = false;
  let collectingCode = false;
  let codeLines: string[] = [];

  const isCodeStart = (l: string) =>
    /^(class\s+Solution\b|def\s+[a-zA-Z_]\w*\s*\(|function\s+[a-zA-Z_]\w*\s*\(|(?:public|private|protected)\s+(?:class|void|int|bool|String|List)|#include\s*<)/.test(
      l.trim()
    );

  const isSectionHeader = (l: string) =>
    /^(Complexity Analysis|Edge Cases|Common Mistakes|Common Pitfalls|Related Problems|Algorithmic Blueprint|Pseudocode|Guiding Questions|Core Challenge|Key Pattern|Intuition|Approach):?/i.test(
      l.trim()
    );

  const flushCode = () => {
    if (codeLines.length > 0) {
      processedLines.push('```' + (defaultLanguage || 'python').toLowerCase());
      processedLines.push(...codeLines);
      processedLines.push('```\n');
      codeLines = [];
    }
    collectingCode = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Respect existing code fences
    if (trimmed.startsWith('```')) {
      if (collectingCode) {
        flushCode();
      }
      inFencedBlock = !inFencedBlock;
      processedLines.push(line);
      continue;
    }

    if (inFencedBlock) {
      processedLines.push(line);
      continue;
    }

    if (!collectingCode) {
      if (isCodeStart(trimmed)) {
        collectingCode = true;
        codeLines = [line];
        continue;
      }

      // Promote unheaded section titles to markdown headings
      if (/^Complexity Analysis:?$/i.test(trimmed)) {
        processedLines.push('\n## Complexity Analysis\n');
      } else if (/^Edge Cases:?$/i.test(trimmed)) {
        processedLines.push('\n## Edge Cases\n');
      } else if (/^(Common Mistakes|Common Pitfalls):?$/i.test(trimmed)) {
        processedLines.push('\n## Common Pitfalls\n');
      } else if (/^Related Problems:?$/i.test(trimmed)) {
        processedLines.push('\n## Related Problems\n');
      } else if (/^Guiding Questions:?$/i.test(trimmed)) {
        processedLines.push('\n## Guiding Questions\n');
      } else if (/^(Core Challenge|Core Problem):?$/i.test(trimmed)) {
        processedLines.push('\n## Core Challenge\n');
      } else if (/^(Key Pattern|Identified Pattern):?$/i.test(trimmed)) {
        processedLines.push('\n## Key Pattern & Technique\n');
      } else if (/^(Algorithmic Blueprint|Pseudocode):?$/i.test(trimmed)) {
        processedLines.push('\n## Algorithmic Blueprint\n');
      } else if (/^Time Complexity:\s*(.*)$/i.test(trimmed)) {
        processedLines.push(
          '- **Time Complexity:** ' + trimmed.replace(/^Time Complexity:\s*/i, '')
        );
      } else if (/^Space Complexity:\s*(.*)$/i.test(trimmed)) {
        processedLines.push(
          '- **Space Complexity:** ' + trimmed.replace(/^Space Complexity:\s*/i, '')
        );
      } else {
        processedLines.push(line);
      }
    } else {
      // In code collection mode
      if (
        isSectionHeader(trimmed) ||
        trimmed.startsWith('##') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('**Complexity')
      ) {
        flushCode();
        // Re-process header
        if (/^Complexity Analysis:?$/i.test(trimmed)) {
          processedLines.push('\n## Complexity Analysis\n');
        } else if (/^Edge Cases:?$/i.test(trimmed)) {
          processedLines.push('\n## Edge Cases\n');
        } else if (/^(Common Mistakes|Common Pitfalls):?$/i.test(trimmed)) {
          processedLines.push('\n## Common Pitfalls\n');
        } else if (/^Related Problems:?$/i.test(trimmed)) {
          processedLines.push('\n## Related Problems\n');
        } else {
          processedLines.push(line);
        }
      } else if (
        trimmed === '' ||
        /^(\s{2,}|\t|#|\/\/|\})/.test(line) ||
        /^[a-zA-Z_][a-zA-Z0-9_]*\s*=[^=]/.test(trimmed) ||
        /^(return|if|elif|else|while|for|break|continue|try|except|pass)\b/.test(trimmed)
      ) {
        codeLines.push(line);
      } else {
        if (codeLines.length > 2) {
          flushCode();
          processedLines.push(line);
        } else {
          processedLines.push(...codeLines);
          collectingCode = false;
          codeLines = [];
          processedLines.push(line);
        }
      }
    }
  }

  if (collectingCode) {
    flushCode();
  }

  return processedLines.join('\n').replace(/\n{3,}/g, '\n\n');
}
