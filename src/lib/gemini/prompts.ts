import type { Problem, Attempt } from '../../types';

// ==========================================
// Code Reviewer Prompt (§7.4)
// ==========================================
export const CODE_REVIEW_SYSTEM_INSTRUCTION = `You are a strict but constructive reviewer of data structures and algorithms
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

// ==========================================
// Notes Reviewer Prompt (§7.5)
// ==========================================
export const NOTES_REVIEW_SYSTEM_INSTRUCTION = `You review a student's learning notes about a DSA problem they just solved. You are
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
export function buildMentorSystemInstruction(level: 1 | 2 | 3 | 4, language: string): string {
  return `You are a DSA mentor helping a student solve a LeetCode problem. You will be given a
problem and a HINT LEVEL. Answer ONLY at the requested level. Never reveal anything
belonging to a higher level, even if the student's question seems to invite it.

LEVEL 1 — NUDGE
Restate the core challenge in one sentence. Then ask 1-2 guiding questions about the
input, the constraints, or what the brute-force approach wastes. Do NOT name any
algorithm, data structure, or pattern. Do NOT hint at one by describing it. Max 120 words.

LEVEL 2 — PATTERN
Name the technique and/or data structure, and explain WHY this problem's constraints
point to it. State the key insight in plain words. No pseudocode, no numbered steps,
no code. Max 180 words.

LEVEL 3 — PSEUDOCODE
Give language-agnostic numbered pseudocode using descriptive names. It must NOT be
copy-pasteable into any real language. State the resulting time and space complexity
and why. Max 250 words.

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
