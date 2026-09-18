import type { Problem, Attempt } from '../../types';

// ==========================================
// Code Reviewer Prompt (§7.4)
// ==========================================
const CODE_REVIEW_SYSTEM_INSTRUCTION = `You are a strict but constructive reviewer of data structures and algorithms
solutions. The student is preparing for technical interviews. Your job is to make
them fix their own code, not to fix it for them.

Evaluate, in this order:
1. Correctness on all inputs within the stated constraints, including edge cases
   (empty input, single element, duplicates, negatives, overflow, cycles).
2. Time and space complexity versus the optimal known complexity for this problem.
3. Bug risk: off-by-one errors, mutation during iteration, uninitialized state,
   incorrect base cases.
4. Readability: naming, structure, dead code, unnecessary work.

Set verdict to "pass" ONLY IF ALL of the following hold:
- The solution is correct for every input within the constraints.
- It achieves optimal or near-optimal time and space complexity.
- There are no issues of severity "critical" or "major".
Otherwise set verdict to "revise".

Hard rules:
- Do NOT rewrite the full solution. Describe each fix in words.
- You may show at most 3 lines of corrected code per issue, only where words alone
  would be ambiguous.
- Point to the specific logic or line that is wrong.
- Always include at least one entry in "positives", even when the verdict is
  "revise". Be specific; do not praise generically.
- "nextStep" must be a single actionable sentence telling the student what to do
  next. If the verdict is "pass", it should suggest a variation or related problem
  instead.
- If the code does not compile or parse, treat that as a critical issue and say
  exactly what is malformed.`;

export function buildCodeReviewPayload(
  problem: Problem,
  attempt: Attempt,
  previousAttempt?: Attempt
): string {
  const numberStr = problem.number !== null ? `${problem.number}. ` : '';
  const statementStr =
    problem.statement && problem.statement.trim()
      ? problem.statement.trim()
      : '(not provided — identify the problem from the title and number, and state your assumption in the summary field)';

  let previousContext = '';
  if (attempt.attemptNumber > 1 && previousAttempt) {
    const prevVerdict = previousAttempt.review?.verdict || 'unreviewed';
    const prevIssues =
      previousAttempt.review?.issues?.map((i) => i.title).join(', ') || 'none recorded';
    const changedComment = attempt.userComment || 'none noted';

    previousContext = `PREVIOUS REVIEW VERDICT: ${prevVerdict}
PREVIOUS UNRESOLVED ISSUES: ${prevIssues}
STUDENT SAYS THEY CHANGED: ${changedComment}
`;
  }

  return `PROBLEM: ${numberStr}${problem.title} (${problem.difficulty})
TOPICS: ${(problem.topics || []).join(', ') || 'None'}
PROBLEM STATEMENT:
${statementStr}

LANGUAGE: ${attempt.language || problem.language || 'python'}
ATTEMPT NUMBER: ${attempt.attemptNumber}
${previousContext}
CODE:
\`\`\`
${attempt.code}
\`\`\``;
}

export const CODE_REVIEW_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: { type: 'STRING', enum: ['pass', 'revise'] },
    summary: { type: 'STRING' },
    correctness: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['correct', 'fails_edge_cases', 'incorrect'] },
        failingCases: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['status', 'failingCases'],
    },
    complexity: {
      type: 'OBJECT',
      properties: {
        time: { type: 'STRING' },
        space: { type: 'STRING' },
        optimalTime: { type: 'STRING' },
        optimalSpace: { type: 'STRING' },
        isOptimal: { type: 'BOOLEAN' },
      },
      required: ['time', 'space', 'optimalTime', 'optimalSpace', 'isOptimal'],
    },
    issues: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          severity: { type: 'STRING', enum: ['critical', 'major', 'minor'] },
          title: { type: 'STRING' },
          detail: { type: 'STRING' },
          suggestion: { type: 'STRING' },
        },
        required: ['severity', 'title', 'detail', 'suggestion'],
      },
    },
    positives: { type: 'ARRAY', items: { type: 'STRING' } },
    nextStep: { type: 'STRING' },
  },
  required: ['verdict', 'summary', 'correctness', 'complexity', 'issues', 'positives', 'nextStep'],
};

export function buildCodeReviewSystemInstruction(responseLanguage: string = 'English'): string {
  const lang = responseLanguage.trim();
  const languageGuidance =
    lang && lang.toLowerCase() !== 'english'
      ? `\n\nHUMAN LANGUAGE REQUIREMENT:
All natural language explanation fields in the JSON response (summary, issue titles, details, suggestions, positives, nextStep) must be written in ${lang} (e.g., if Hinglish or Nepali+English(Romanized), use Romanized text with standard English technical terms).`
      : '';
  return `${CODE_REVIEW_SYSTEM_INSTRUCTION}${languageGuidance}`;
}

// ==========================================
// Notes Reviewer Prompt (§7.5)
// ==========================================
const NOTES_REVIEW_SYSTEM_INSTRUCTION = `You review a student's learning notes about a DSA problem they just solved. You are
judging whether the notes demonstrate transferable understanding, not memorization.

Ask yourself:
- Is anything here factually wrong about the algorithm, the data structure, or the
  complexity? Flag every incorrect claim.
- Do the notes name the underlying pattern and generalize beyond this one problem?
- Is the complexity reasoning present and correct, or just asserted?
- Would these notes let the student re-derive the solution in three weeks without
  looking anything up?

Rating scale:
5 — Correct, generalized, would fully support re-derivation.
4 — Correct, mostly generalized, one small gap.
3 — Correct but problem-specific; would not transfer to a variation.
2 — Contains a factual error, or is a restatement of the solution rather than an insight.
1 — Wrong, or essentially empty of understanding.

Set verdict to "solid" for 4-5 and "needs_work" for 1-3.

Hard rules:
- "keyTakeaway" must be 1-2 sentences the student can paste into their own notes,
  written in the student's voice, generalizing beyond this specific problem.
- "recallQuestions" must contain exactly 3 questions that test the concept rather
  than the problem. Do NOT include answers.
- Be honest. If the notes are weak, say so plainly and specifically. Do not inflate
  the rating to be encouraging.
- Always include at least one entry in "strengths" if anything is genuinely correct.`;

export function buildNotesReviewSystemInstruction(responseLanguage: string = 'English'): string {
  const lang = responseLanguage.trim();
  const languageGuidance =
    lang && lang.toLowerCase() !== 'english'
      ? `\n\nHUMAN LANGUAGE REQUIREMENT:
All natural language explanation fields in the JSON response (corrections, gaps, strengths, keyTakeaway, recallQuestions) must be written in ${lang} (e.g., if Hinglish or Nepali+English(Romanized), use Romanized text with standard English technical terms).`
      : '';
  return `${NOTES_REVIEW_SYSTEM_INSTRUCTION}${languageGuidance}`;
}

export function buildNotesReviewPayload(
  problem: Problem,
  notes: string,
  attemptCount: number
): string {
  const numberStr = problem.number !== null ? `${problem.number}. ` : '';
  const statementStr =
    problem.statement && problem.statement.trim() ? problem.statement.trim() : '(not provided)';

  return `PROBLEM: ${numberStr}${problem.title} (${problem.difficulty})
TOPICS: ${(problem.topics || []).join(', ') || 'None'}    PATTERNS: ${(problem.patterns || []).join(', ') || 'None'}
PROBLEM STATEMENT:
${statementStr}

HINTS USED: ${problem.hintsUsed || 0} of 4
ATTEMPTS BEFORE PASSING: ${attemptCount}

THE STUDENT'S NOTES:
${notes}`;
}

export const NOTES_REVIEW_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rating: { type: 'INTEGER' },
    verdict: { type: 'STRING', enum: ['solid', 'needs_work'] },
    corrections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          claim: { type: 'STRING' },
          issue: { type: 'STRING' },
          correction: { type: 'STRING' },
        },
        required: ['claim', 'issue', 'correction'],
      },
    },
    gaps: { type: 'ARRAY', items: { type: 'STRING' } },
    strengths: { type: 'ARRAY', items: { type: 'STRING' } },
    keyTakeaway: { type: 'STRING' },
    recallQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [
    'rating',
    'verdict',
    'corrections',
    'gaps',
    'strengths',
    'keyTakeaway',
    'recallQuestions',
  ],
};

// ==========================================
// Mentor Prompt (§7.6)
// ==========================================
export function buildMentorSystemInstruction(
  level: 1 | 2 | 3 | 4,
  language: string,
  responseLanguage: string = 'English'
): string {
  const lang = responseLanguage.trim();
  const languageGuidance =
    lang && lang.toLowerCase() !== 'english'
      ? `\n\nHUMAN LANGUAGE REQUIREMENT:
You must communicate and provide all your conversational explanations, hints, guiding questions, pseudocode descriptions, code comments, and docstrings in ${lang}.
- For example, if Hinglish: use natural, conversational Hindi written in Roman/Latin script mixed with English technical terms.
- For example, if Nepali+English(Romanized): use natural, conversational Nepali written in Roman/Latin script mixed with English technical terms.
- Standard programming keywords, variable identifiers, function names, and code syntax itself must remain standard valid ${language}, but all explanatory commentary, code comments (# / //), docstrings, and markdown descriptions must be written in ${lang}.
- Keep markdown section headings recognizable (e.g. "## Complexity Analysis", "## Edge Cases", "## Common Pitfalls", "## Related Problems") so the UI can format and badge them properly.`
      : '';

  return `You are a DSA mentor helping a student solve a Leetcode problem. You will be given a
problem and a HINT LEVEL. Answer ONLY at the requested level. Never reveal anything
belonging to a higher level, even if the student's question seems to invite it.${languageGuidance}

LEVEL 1 — NUDGE
Restate the core challenge in one sentence. Then ask 1-2 guiding questions about the
input, the constraints, or what the brute-force approach wastes. Do NOT name any
algorithm, data structure, or pattern. Do NOT hint at one by describing it. Max 200 words.

LEVEL 2 — PATTERN
Name the technique and/or data structure, and explain WHY this problem's constraints
point to it. State the key insight in plain words. No pseudocode, no numbered steps,
no code. Max 350 words.

LEVEL 3 — PSEUDOCODE
Give language-agnostic numbered pseudocode using descriptive names. It must NOT be
copy-pasteable into any real language. State the resulting time and space complexity
and why. Max 500 words.

LEVEL 4 — SOLUTION
Give a complete, commented solution in ${language}. Then: complexity analysis, the
edge cases that break naive attempts, the 1-2 mistakes people most commonly make here,
and 2 related problems that use the same pattern.

Formatting: return markdown. Use short paragraphs. No preamble, no sign-off, no
"Great question". Start directly with the content.

Current hint level: ${level}`;
}

export function buildMentorPayload(problem: Problem, latestAttempt?: Attempt): string {
  const numberStr = problem.number !== null ? `${problem.number}. ` : '';
  const statementStr =
    problem.statement && problem.statement.trim()
      ? problem.statement.trim()
      : '(not provided — identify the problem from its title and number. Begin your reply with one sentence stating which problem you believe this is so the student can correct you.)';

  let attemptContext = '';
  if (latestAttempt && latestAttempt.code && latestAttempt.code.trim()) {
    attemptContext = `\nThe student has already attempted this. Their most recent code:
\`\`\`
${latestAttempt.code}
\`\`\`
Tailor your hint to where their approach actually breaks down.`;
  }

  return `PROBLEM: ${numberStr}${problem.title} (${problem.difficulty})
TOPICS: ${(problem.topics || []).join(', ') || 'None'}
PROBLEM STATEMENT:
${statementStr}
${attemptContext}`;
}

// ==========================================
// Voice Transcription (spoken learning notes → text)
// ==========================================
export const TRANSCRIPTION_SYSTEM_INSTRUCTION = `You transcribe the student's spoken learning note about a data structures and algorithms problem.

Hard rules:
- Output ONLY the verbatim transcript of what was said. No commentary, no preamble, no quotes, no "Transcript:" label.
- Transcribe in the language spoken (usually English, possibly with an Indian accent).
- Fix only obvious homophone slips when the technical meaning is unambiguous (e.g. "hash map" said clearly stays "hash map"). Never rewrite, summarize, or complete the student's thoughts.
- Technical terms (Two Sum, binary search, dynamic programming, O(n), hash map, recursion) must keep standard spelling and casing.
- If the audio contains no intelligible speech, reply with exactly: [no speech detected]`;

export function buildTranscriptionUserPrompt(): string {
  return 'Transcribe the attached voice note into text.';
}

// ==========================================
// Interactive Solution Visualizer Prompt
// ==========================================
export function buildVisualizationSystemInstruction(
  language: string = 'python',
  responseLanguage: string = 'English'
): string {
  const lang = responseLanguage.trim();
  const languageGuidance =
    lang && lang.toLowerCase() !== 'english'
      ? `\n\nHUMAN LANGUAGE REQUIREMENT:
All explanation text, button titles, thought bubble explanations, and markdown walkthroughs should be written in ${lang} (using Latin/Roman script with standard English technical terms).`
      : '';

  return `You are an elite Data Structures & Algorithms Interactive Visualizer Architect and Mentor.
The student is learning algorithms and needs to deeply understand and interactively visualize the algorithm for a LeetCode problem.

Your goal is to build an interactive, single-file web application that visualizes the solution step-by-step, allows the student to play through the algorithm, and provides mentor explanations.${languageGuidance}

OUTPUT FORMAT REQUIREMENTS:
1. Wrap the entire single-file HTML/CSS/JS application inside a standard \`\`\`html ... \`\`\` code block.
   - It must be a complete standalone HTML5 document starting with <!DOCTYPE html> and ending with </html>.
   - All styling must be contained in a <style> block inside <head>.
   - All logic and interactivity must be contained in a <script> block inside <body>.
   - CRITICAL: Use ZERO external CDN dependencies, external fonts, or npm packages. No external links to Tailwind/Bootstrap/React/D3. Everything must run 100% offline using standard browser APIs (DOM, CSS transitions/animations, Canvas or SVG, and Web Audio API).
2. Directly below the \`\`\`html ... \`\`\` code block, output a structured Markdown Walkthrough:
   - ### Key Highlights of the Solution
   - ### Algorithm Invariants & Mechanics
   - ### Common Interview Traps & Pitfalls
   - ### Complexity Analysis (Time & Space)
3. CONCISENESS & COMPLETION MANDATE:
   - Keep CSS clean, compact, and modern (dark theme tokens #0b0f19, #111827). Do NOT write repetitive, bloated CSS rules.
   - Keep JavaScript clean, robust, and direct (under 250 lines). Avoid over-engineered state machines.
   - COMPLETENESS GUARANTEE: You MUST output the entire HTML application to the end, closing with </html> and the closing \`\`\` code fence.

APPLICATION DESIGN & FEATURE MANDATES:
- Visual Theme: Ultra-modern, premium dark aesthetic (deep slate #0b0f19 or #0f172a background, sleek glassmorphism cards, glowing accent borders, smooth CSS animations, high-contrast readable tokens).
- Interactive Dual Modes:
  1. Guided Visualizer:
     - Step Forward ("Step Next") and Step Backward ("Step Back") buttons.
     - "Auto Play" / Pause toggle with a responsive speed control slider (e.g. 0.3s to 2.0s).
     - "Reset" button to restart the animation from the beginning.
     - Presets bar: Standard LeetCode example(s), edge cases (e.g., already sorted, reverse, duplicates, empty/single), and a Custom Input field with a "Set" button.
  2. Interactive Practice Mode ("You are the Algorithm"):
     - An interactive mode where the user is challenged to choose or click the correct next algorithmic action at the active state.
     - Immediate visual/sound feedback, streak counter, and explanations when a misconception is triggered.
- Dynamic Invariant Zone Bar:
  - Visual breakdown displaying the algorithm's mathematical/logical invariants (e.g. partition zones: [Processed / Left], [Active Scanner / Window], [Unexplored], [Processed / Right]).
- Visual Nodes & Pointer Badges:
  - Prominent visual elements (array blocks, list nodes, tree nodes, or matrix cells) showing current values, indices, and active states.
  - Distinct glowing badges pinpointing active pointers (e.g. LOW, MID, HIGH, SLOW, FAST, LEFT, RIGHT, CURR).
  - Visual animation/transition for comparisons, swaps, pointer advances, or state updates.
- Mentor's Thought Bubble & Live Code Trace:
  - A dedicated "Thought Bubble" container that updates on every step, explaining the "WHY" behind the current operation.
  - Highlights common interview traps (e.g. why a pointer pauses vs advances after a swap).
  - Shows simulated active code snippet corresponding to the current step in ${language}.
- Sound Effects (Web Audio API):
  - Toggleable pleasant synthesized micro-tones (using AudioContext and OscillatorNode) for pointer moves, swaps, success chimes, and mistakes. Include a Mute/Unmute sound button.
- Clean Layout & Fit:
  - Design the visualizer to fit gracefully within standard desktop and laptop viewports (recommend width: 100%, max-width: 900px, responsive padding).

Ensure the JavaScript code is bug-free, fully handles boundary conditions, and renders without syntax errors.`;
}

export function buildVisualizationUserPrompt(problem: Problem, latestAttempt?: Attempt): string {
  const numberStr = problem.number !== null ? `${problem.number}. ` : '';
  const statementStr =
    problem.statement && problem.statement.trim()
      ? problem.statement.trim()
      : '(problem statement not provided — identify standard LeetCode problem from title and number)';

  let attemptContext = '';
  if (latestAttempt && latestAttempt.code && latestAttempt.code.trim()) {
    attemptContext = `\nSTUDENT'S RECENT CODE ATTEMPT:
\`\`\`${latestAttempt.language || 'python'}
${latestAttempt.code}
\`\`\`
Address any specific edge cases or misconceptions from this attempt in the visualization and thought bubble.`;
  }

  return `PROBLEM: ${numberStr}${problem.title} (${problem.difficulty})
TOPICS: ${(problem.topics || []).join(', ') || 'None'}
PATTERNS: ${(problem.patterns || []).join(', ') || 'None'}

PROBLEM STATEMENT:
${statementStr}
${attemptContext}

Please build a complete, single-file interactive web application to visualize this problem and its optimal algorithm, featuring dual modes (Guided Visualizer & Interactive Practice), dynamic invariant zones, pointer badges, mentor thought bubble, and sound effects, followed by a markdown walkthrough.`;
}

export function parseVisualizationResponse(rawText: string): { html: string; explanation: string } {
  if (!rawText || !rawText.trim()) {
    return { html: '', explanation: '' };
  }

  const trimmed = rawText.trim();
  let html = '';
  let explanation = '';

  // 1. Locate start of HTML: either opening fence preceding <!DOCTYPE/<html or directly <!DOCTYPE/<html
  const htmlStartMatch = /(?:```+|~~~+)\s*(?:html|htm)?\s*\n?(?=<!DOCTYPE|<html)|<!DOCTYPE\s+html|<html/i.exec(trimmed);

  if (htmlStartMatch) {
    const matchIndex = htmlStartMatch.index;
    const docStartMatch = /<!DOCTYPE\s+html|<html/i.exec(trimmed.slice(matchIndex));
    const actualHtmlStart = matchIndex + (docStartMatch ? docStartMatch.index : 0);
    const preText = trimmed.slice(0, matchIndex).trim();

    // Look for closing </html>
    const endTagMatch = /<\/html>/i.exec(trimmed.slice(actualHtmlStart));
    if (endTagMatch) {
      const endIdx = actualHtmlStart + endTagMatch.index + endTagMatch[0].length;
      html = trimmed.slice(actualHtmlStart, endIdx).trim();

      // Post text is everything after </html> (skipping closing fence)
      const rest = trimmed.slice(endIdx).replace(/^\s*(?:```+|~~~+)?\s*/, '').trim();
      explanation = [preText, rest].filter(Boolean).join('\n\n').trim();
    } else {
      // Truncated response without </html>
      const candidate = trimmed.slice(actualHtmlStart);
      // Look for a markdown section break like \n### or \n##
      const mdBreak = /\n(?=#{1,3}\s)/.exec(candidate);
      if (mdBreak) {
        html = candidate.slice(0, mdBreak.index).trim();
        const postText = candidate.slice(mdBreak.index).trim();
        explanation = [preText, postText].filter(Boolean).join('\n\n').trim();
      } else {
        html = candidate.replace(/\s*(?:```+|~~~+)\s*$/, '').trim();
        explanation = preText;
      }

      // Auto-repair missing closing tags for truncated HTML
      if (/<style/i.test(html) && !/<\/style>/i.test(html)) {
        html += '\n</style>';
      }
      if (/<script/i.test(html) && !/<\/script>/i.test(html)) {
        html += '\n</script>';
      }
      if (/<body/i.test(html) && !/<\/body>/i.test(html)) {
        html += '\n</body>';
      }
      if (!/<\/html>/i.test(html)) {
        html += '\n</html>';
      }
    }
  } else {
    // Fallback: check standard code fence with ```html ... ```
    const fenceMatch = /```(?:html|htm)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenceMatch) {
      html = fenceMatch[1].trim();
      const preText = trimmed.slice(0, fenceMatch.index).trim();
      const postText = trimmed.slice(fenceMatch.index + fenceMatch[0].length).trim();
      explanation = [preText, postText].filter(Boolean).join('\n\n').trim();
    } else {
      // Direct html tags fallback
      const tagMatch = /<html[\s\S]*?<\/html>/i.exec(trimmed);
      if (tagMatch) {
        html = tagMatch[0].trim();
        explanation = trimmed.replace(tagMatch[0], '').trim();
      } else if (
        trimmed.includes('<script') ||
        trimmed.includes('<div') ||
        trimmed.includes('<canvas') ||
        trimmed.includes('<svg')
      ) {
        html = trimmed;
        explanation = 'Interactive visualizer generated.';
      } else {
        html = '';
        explanation = trimmed;
      }
    }
  }

  // Ensure valid DOCTYPE wrapper and head
  if (html) {
    if (!/<!doctype html>/i.test(html)) {
      if (!/<html/i.test(html)) {
        html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Interactive Visualizer</title>\n</head>\n<body>\n${html}\n</body>\n</html>`;
      } else {
        html = `<!DOCTYPE html>\n${html}`;
      }
    }

    // Always inject dark theme CSS into <head> so the iframe never flashes white or renders white canvas
    const darkThemeStyle = '<style id="dsa-dark-root">:root, html, body { background-color: #0b0f19 !important; color: #f8fafc; color-scheme: dark; }</style>';
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1\n${darkThemeStyle}\n`);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/(<html[^>]*>)/i, `$1\n<head>\n${darkThemeStyle}\n</head>`);
    }
  }

  // Clean explanation: remove any residual raw HTML code fences
  explanation = explanation
    .replace(/```(?:html|htm)?\s*<!DOCTYPE[\s\S]*?```/gi, '')
    .replace(/```(?:html|htm)?\s*<html[\s\S]*?```/gi, '')
    .trim();

  return {
    html: html.trim(),
    explanation: explanation.trim() || 'Interactive visualizer generated successfully.',
  };
}
