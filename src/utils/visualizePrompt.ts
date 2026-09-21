import type { Problem, Attempt } from '../types';

export interface BuildVisualizationPromptOptions {
  problem: Problem;
  latestAttempt?: Attempt;
  programmingLanguage: string;
  humanLanguage: string;
  includeCode?: boolean;
}

export const COMMON_PROGRAMMING_LANGUAGES = [
  'Python',
  'JavaScript',
  'TypeScript',
  'Java',
  'C++',
  'C',
  'C#',
  'Go',
  'Rust',
  'Kotlin',
  'Swift',
] as const;

export const COMMON_HUMAN_LANGUAGES = [
  'English',
  'Hinglish',
  'Nepali',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Mandarin Chinese',
  'Japanese',
  'Portuguese',
] as const;

/**
 * Builds a prompt for generating a self-contained, single-file interactive
 * HTML/CSS/JS visualization of a Data Structures & Algorithms problem.
 */
export function buildVisualizationPrompt({
  problem,
  latestAttempt,
  programmingLanguage,
  humanLanguage,
  includeCode = true,
}: BuildVisualizationPromptOptions): string {
  const numberStr = problem.number !== null && problem.number !== undefined ? `${problem.number}. ` : '';
  const title = problem.title.trim();
  const difficulty = problem.difficulty;
  const topicsStr = problem.topics && problem.topics.length > 0 ? problem.topics.join(', ') : 'None specified';
  const patternsStr = problem.patterns && problem.patterns.length > 0 ? problem.patterns.join(', ') : 'None specified';

  const hasStatement = Boolean(problem.statement && problem.statement.trim());
  const statementText = hasStatement
    ? problem.statement.trim()
    : '(Problem statement not provided in tracker. Please recognize this standard LeetCode problem from the number and title.)';

  const studentCode = latestAttempt?.code?.trim();
  const shouldIncludeCode = Boolean(includeCode && studentCode);

  let studentCodeSection = '';
  if (shouldIncludeCode && studentCode) {
    studentCodeSection = `\n### STUDENT'S RECENT CODE ATTEMPT (${latestAttempt?.language || programmingLanguage}):
\`\`\`${(latestAttempt?.language || programmingLanguage).toLowerCase()}
${studentCode}
\`\`\`
Address any subtle edge cases, invariants, or potential bottlenecks from this attempt in the visualization.\n`;
  }

  return `You are an expert Data Structures & Algorithms (DSA) educator and interactive frontend developer.

Your goal is to build a complete, self-contained, single-file interactive HTML web application that visualizes the solution and algorithm for the following problem.

---
### PROBLEM DETAILS:
- Problem: ${numberStr}${title}
- Difficulty: ${difficulty}
- Topics / Data Structures: ${topicsStr}
- Core Pattern: ${patternsStr}
- Programming Language for Code Trace: ${programmingLanguage}
- Primary Human Language for Explanations & Mentorship: ${humanLanguage}

### PROBLEM STATEMENT:
${statementText}
${studentCodeSection}
---
### INTERACTIVE VISUALIZER REQUIREMENTS:

1. **Self-Contained Single File (Offline Ready)**:
   - Output ONLY a single, complete HTML file starting with \`<!DOCTYPE html>\` containing all necessary \`<style>\` and \`<script>\` tags.
   - Do NOT require external dependencies, CDNs, or bundlers. Use native HTML5, CSS3, and vanilla modern JavaScript (ES6+) so it opens and runs immediately in any browser.

2. **Visual Design & Aesthetics (Dark Mode)**:
   - Modern, sleek dark UI (e.g., slate/navy background #0f172a, high-contrast text, subtle glowing borders).
   - Responsive layout designed to fit nicely on standard desktop and laptop screens (max width ~900-1000px, centered).
   - Glassmorphism containers, smooth CSS transitions, and distinct glowing badges for active elements/pointers.

3. **Step-by-Step Guided Mode**:
   - Interactive playback controls: Play/Pause, Step Next, Step Previous, and Reset.
   - Animation speed slider (Slow to Fast).
   - Custom test input field with a "Load / Run" button so users can test custom arrays, strings, or numbers.
   - Presets bar: Quick buttons for the standard LeetCode example(s) plus edge cases (e.g. single item, duplicates, sorted, reverse, empty/boundary).

4. **Visual Nodes, Pointer Badges & Invariant Zones**:
   - Clear visual elements matching the data structure (e.g. animated array boxes/bars with indices, linked list nodes with pointers, tree nodes, or matrix grid).
   - Distinct, colorful pointer badges (e.g. LOW, MID, HIGH, LEFT, RIGHT, SLOW, FAST, CURR).
   - Visual transitions/animations for comparisons, swaps, pointer shifts, or state changes.
   - Dynamic Invariant Zone bar showing logical partitions (e.g. [Processed / Left], [Active Window], [Unexplored], [Processed / Right]).

5. **Mentor's Thought Bubble & Live Code Trace**:
   - A dedicated "Thought Bubble" card that updates dynamically at EVERY step, explaining the intuitive "WHY" behind the current operation.
   - All explanations, notes, and mentor commentary MUST be written in **${humanLanguage}**.
   - Highlights common interview traps or misconceptions.
   - Displays a clean syntax-highlighted code block in **${programmingLanguage}**, visually highlighting the line corresponding to the current step.

6. **Web Audio Sound Effects**:
   - Gentle synthesized micro-beeps using the Web Audio API (\`AudioContext\`) on swaps, pointer advances, or success, with an easily accessible Mute/Unmute button.

Please provide the complete, ready-to-run HTML file inside a single \`\`\`html ... \`\`\` code block, followed by 2-3 bullet points explaining how to save and open it in a browser.`;
}
