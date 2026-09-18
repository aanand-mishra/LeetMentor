import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProblemDetailPage } from '../pages/ProblemDetailPage';
import {
  db,
  problemsRepo,
  visualizationsRepo,
  settingsRepo,
  clearAllLocalData,
} from '../db';
import { ToastProvider } from '../context/ToastContext';
import {
  resolveFlashModel,
  SUPPORTED_FLASH_MODELS,
} from '../lib/gemini/client';
import {
  buildVisualizationSystemInstruction,
  buildVisualizationUserPrompt,
  parseVisualizationResponse,
} from '../lib/gemini/prompts';

describe('Phase: Interactive Visualize Tab & Solution Generator', () => {
  beforeEach(async () => {
    await clearAllLocalData();
    vi.restoreAllMocks();
  });

  describe('1. Model Policy & Resolution (Flash models only, strictly no Lite)', () => {
    it('provides supported Flash models in dropdown definition', () => {
      expect(SUPPORTED_FLASH_MODELS.length).toBeGreaterThanOrEqual(6);
      const ids = SUPPORTED_FLASH_MODELS.map((m) => m.id);
      expect(ids).toContain('gemini-3.8-flash');
      expect(ids).toContain('gemini-3.7-flash');
      expect(ids).toContain('gemini-3.6-flash');
      expect(ids).toContain('gemini-3.5-flash');
      expect(ids).toContain('gemini-flash-latest');
      expect(ids).toContain('gemini-2.0-flash');
      expect(ids).toContain('gemini-1.5-flash');
      // Must not contain any lite models
      ids.forEach((id) => {
        expect(id.toLowerCase()).not.toContain('lite');
      });
    });

    it('rejects lite models and substitutes with default gemini-3.6-flash', () => {
      expect(resolveFlashModel('gemini-flash-lite-latest')).toBe('gemini-3.6-flash');
      expect(resolveFlashModel('gemini-2.0-flash-lite')).toBe('gemini-3.6-flash');
      expect(resolveFlashModel('gemini-2.0-flash-lite-preview-02-05')).toBe('gemini-3.6-flash');
    });

    it('preserves valid non-lite Flash models and upgrades deprecated 2.5', () => {
      expect(resolveFlashModel('gemini-3.8-flash')).toBe('gemini-3.8-flash');
      expect(resolveFlashModel('gemini-3.7-flash')).toBe('gemini-3.7-flash');
      expect(resolveFlashModel('gemini-3.6-flash')).toBe('gemini-3.6-flash');
      expect(resolveFlashModel('gemini-2.0-flash')).toBe('gemini-2.0-flash');
      expect(resolveFlashModel('gemini-1.5-flash')).toBe('gemini-1.5-flash');
      // Deprecated 2.5 upgrades to 3.6
      expect(resolveFlashModel('gemini-2.5-flash')).toBe('gemini-3.6-flash');
    });

    it('defaults to gemini-3.6-flash when model is empty or undefined', () => {
      expect(resolveFlashModel(undefined)).toBe('gemini-3.6-flash');
      expect(resolveFlashModel('')).toBe('gemini-3.6-flash');
      expect(resolveFlashModel('   ')).toBe('gemini-3.6-flash');
    });
  });

  describe('2. Prompt Engineering & Response Parsing', () => {
    it('builds system instruction mandating standalone single-file HTML and dark-mode aesthetic', () => {
      const instruction = buildVisualizationSystemInstruction('python', 'English');
      expect(instruction).toContain('<!DOCTYPE html>');
      expect(instruction).toContain('Guided Visualizer');
      expect(instruction).toContain('Interactive Practice Mode');
      expect(instruction).toContain('Dynamic Invariant Zone Bar');
      expect(instruction).toContain('Web Audio API');
      expect(instruction).toContain('ZERO external CDN dependencies');
    });

    it('builds user prompt with problem details and constraints', () => {
      const prompt = buildVisualizationUserPrompt({
        id: 'test-id',
        number: 75,
        title: 'Sort Colors',
        url: null,
        statement: 'Given an array nums with n objects colored red, white, or blue...',
        difficulty: 'Medium',
        topics: ['Array', 'Two Pointers'],
        patterns: ['Dutch National Flag'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateAdded: new Date().toISOString(),
        dateFirstAttempt: null,
        dateSolved: null,
        updatedAt: new Date().toISOString(),
      });

      expect(prompt).toContain('75. Sort Colors (Medium)');
      expect(prompt).toContain('Dutch National Flag');
      expect(prompt).toContain('Given an array nums');
    });

    it('parses fenced HTML code block and separates markdown walkthrough', () => {
      const mockRawResponse = `Here is the interactive simulator:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head><style>body { background: #0f172a; }</style></head>
<body><div id="app">Sort Colors Visualizer</div><script>console.log("ready");</script></body>
</html>
\`\`\`

### Key Highlights of the Solution
- Guided visualizer with 3 pointers (low, mid, high).
- Dynamic partition zones.`;

      const parsed = parseVisualizationResponse(mockRawResponse);
      expect(parsed.html).toContain('<!DOCTYPE html>');
      expect(parsed.html).toContain('Sort Colors Visualizer');
      expect(parsed.html).toContain('console.log("ready")');
      expect(parsed.explanation).toContain('### Key Highlights of the Solution');
      expect(parsed.explanation).toContain('Guided visualizer with 3 pointers');
    });

    it('handles HTML without code block and repairs incomplete tags', () => {
      const rawHtmlOnly = `<div id="visualizer">Interactive Node</div><script>let mid = 0;</script>`;
      const parsed = parseVisualizationResponse(rawHtmlOnly);
      expect(parsed.html).toContain('<!DOCTYPE html>');
      expect(parsed.html).toContain('Interactive Node');
      expect(parsed.html).toContain('</html>');
    });
  });

  describe('3. Dexie Persistence & Repository', () => {
    it('saves, retrieves, and updates visualization in IndexedDB', async () => {
      const prob = await problemsRepo.create({
        number: 75,
        title: 'Sort Colors',
        url: null,
        statement: 'Sort 0s, 1s, 2s in-place',
        difficulty: 'Medium',
        topics: ['Array'],
        patterns: ['Two Pointers'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      const saved = await visualizationsRepo.save({
        problemId: prob.id,
        html: '<!DOCTYPE html><html><body>Visualizer</body></html>',
        explanation: 'Three-pointer Dutch National Flag explanation.',
        model: 'gemini-2.5-flash',
      });

      expect(saved.id).toBeDefined();
      expect(saved.problemId).toBe(prob.id);

      const retrieved = await visualizationsRepo.getForProblem(prob.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.html).toContain('Visualizer');
      expect(retrieved?.model).toBe('gemini-2.5-flash');
      expect(retrieved?.explanation).toContain('Three-pointer');
    });

    it('cascades deletion across problems and visualizations', async () => {
      const prob = await problemsRepo.create({
        number: 1,
        title: 'Two Sum',
        url: null,
        statement: 'Find two indices...',
        difficulty: 'Easy',
        topics: ['Array'],
        patterns: ['Hash Map'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      await visualizationsRepo.save({
        problemId: prob.id,
        html: '<html>Two Sum</html>',
        explanation: 'Hash map visualizer',
        model: 'gemini-2.5-flash',
      });

      expect(await db.visualizations.where('problemId').equals(prob.id).count()).toBe(1);

      // Delete problem
      await problemsRepo.delete(prob.id);

      expect(await db.problems.get(prob.id)).toBeUndefined();
      expect(await db.visualizations.where('problemId').equals(prob.id).count()).toBe(0);
    });
  });

  describe('4. Problem Detail Page Hash Routing (#visualize)', () => {
    it('activates the Visualize tab via URL hash and renders hero empty state', async () => {
      const prob = await problemsRepo.create({
        number: 75,
        title: 'Sort Colors',
        url: null,
        statement: 'Sort red, white, blue objects...',
        difficulty: 'Medium',
        topics: ['Array'],
        patterns: ['Two Pointers'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      render(
        <MemoryRouter initialEntries={[`/problem/${prob.id}#visualize`]}>
          <ToastProvider>
            <Routes>
              <Route path="/problem/:id" element={<ProblemDetailPage />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^visualize$/i })).toBeInTheDocument();
        expect(screen.getByText(/Interactive Algorithm Visualizer & Sandbox/i)).toBeInTheDocument();
        expect(screen.getByText(/Dual Interactive Modes/i)).toBeInTheDocument();
        expect(screen.getByText(/Generate Interactive Solution & Visualizer/i)).toBeInTheDocument();
      });
    });

    it('renders selectable Flash model dropdown in the empty state', async () => {
      const prob = await problemsRepo.create({
        number: 75,
        title: 'Sort Colors',
        url: null,
        statement: 'Sort colors',
        difficulty: 'Medium',
        topics: ['Array'],
        patterns: ['Two Pointers'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      render(
        <MemoryRouter initialEntries={[`/problem/${prob.id}#visualize`]}>
          <ToastProvider>
            <Routes>
              <Route path="/problem/:id" element={<ProblemDetailPage />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        const select = screen.getByLabelText(/Select Gemini Flash Model/i);
        expect(select).toBeInTheDocument();
        expect(screen.getByText(/Gemini 3.6 Flash \(Recommended\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Gemini 3.8 Flash/i)).toBeInTheDocument();
        expect(screen.getByText(/Gemini 2.0 Flash/i)).toBeInTheDocument();
      });
    });
  });

  describe('5. Interactive Rendering & Features', () => {
    it('renders the interactive iframe, code view switch, and download button when visualization exists', async () => {
      const prob = await problemsRepo.create({
        number: 75,
        title: 'Sort Colors',
        url: null,
        statement: 'Sort colors',
        difficulty: 'Medium',
        topics: ['Array'],
        patterns: ['Two Pointers'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      await visualizationsRepo.save({
        problemId: prob.id,
        html: `<!DOCTYPE html><html><body><div id="sim">Dutch National Flag Simulation</div></body></html>`,
        explanation: '### Invariant Analysis\n`mid` pointer divides the elements into four zones.',
        model: 'gemini-2.5-flash',
      });

      render(
        <MemoryRouter initialEntries={[`/problem/${prob.id}#visualize`]}>
          <ToastProvider>
            <Routes>
              <Route path="/problem/:id" element={<ProblemDetailPage />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // Iframe is present
        const iframe = screen.getByTitle(/Sort Colors Interactive Visualizer/i);
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('sandbox');

        // View switcher buttons are present
        expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /code/i })).toBeInTheDocument();

        // Download & Fullscreen buttons are present
        expect(screen.getByTitle(/Download Standalone HTML/i)).toBeInTheDocument();
        expect(screen.getByTitle(/Expand Fullscreen/i)).toBeInTheDocument();

        // Walkthrough markdown is rendered
        expect(screen.getByText(/Mentor's Visual Guide & Algorithm Invariants/i)).toBeInTheDocument();
        expect(screen.getByText(/Invariant Analysis/i)).toBeInTheDocument();
      });
    });

    it('switches to code view when clicking Code button', async () => {
      const user = userEvent.setup();
      const prob = await problemsRepo.create({
        number: 75,
        title: 'Sort Colors',
        url: null,
        statement: 'Sort colors',
        difficulty: 'Medium',
        topics: ['Array'],
        patterns: ['Two Pointers'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      await visualizationsRepo.save({
        problemId: prob.id,
        html: `<!DOCTYPE html><html><body><div id="sim">Special Simulation Code</div></body></html>`,
        explanation: 'Dutch National Flag explanation',
        model: 'gemini-2.5-flash',
      });

      render(
        <MemoryRouter initialEntries={[`/problem/${prob.id}#visualize`]}>
          <ToastProvider>
            <Routes>
              <Route path="/problem/:id" element={<ProblemDetailPage />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /code/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /code/i }));

      await waitFor(() => {
        expect(screen.getByText(/Special Simulation Code/i)).toBeInTheDocument();
        expect(screen.getByTitle(/Copy HTML code/i)).toBeInTheDocument();
      });
    });

    it('handles missing API key gracefully by displaying an alert with link to Settings', async () => {
      const user = userEvent.setup();
      await settingsRepo.update({ geminiApiKey: '' });

      const prob = await problemsRepo.create({
        number: 75,
        title: 'Sort Colors',
        url: null,
        statement: 'Sort colors',
        difficulty: 'Medium',
        topics: ['Array'],
        patterns: ['Two Pointers'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      render(
        <MemoryRouter initialEntries={[`/problem/${prob.id}#visualize`]}>
          <ToastProvider>
            <Routes>
              <Route path="/problem/:id" element={<ProblemDetailPage />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Generate Interactive Solution & Visualizer/i)).toBeInTheDocument();
      });

      const generateBtn = screen.getByText(/Generate Interactive Solution & Visualizer/i);
      await user.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Configure API Key in Settings/i)).toBeInTheDocument();
      });
    });

    it('appends visualizer walkthrough to Problem Notes when clicking Save to Notes', async () => {
      const user = userEvent.setup();
      const prob = await problemsRepo.create({
        number: 75,
        title: 'Sort Colors',
        url: null,
        statement: 'Sort colors',
        difficulty: 'Medium',
        topics: ['Array'],
        patterns: ['Two Pointers'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: 'Initial notes.',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      await visualizationsRepo.save({
        problemId: prob.id,
        html: `<!DOCTYPE html><html><body>Visualizer</body></html>`,
        explanation: 'Key Invariant: 0s to the left of low, 2s to the right of high.',
        model: 'gemini-2.5-flash',
      });

      render(
        <MemoryRouter initialEntries={[`/problem/${prob.id}#visualize`]}>
          <ToastProvider>
            <Routes>
              <Route path="/problem/:id" element={<ProblemDetailPage />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save to Problem Notes/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Save to Problem Notes/i }));

      await waitFor(async () => {
        const updatedProb = await problemsRepo.getById(prob.id);
        expect(updatedProb?.notes).toContain('Initial notes.');
        expect(updatedProb?.notes).toContain('Key Invariant: 0s to the left of low');
      });
    });

    it('recovers truncated responses missing </html> and closing code fence', () => {
      const truncatedGeminiOutput = `\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    .node { color: red; }
  </style>
</head>
<body>
  <div id="app">Truncated App</div>
  <script>
    console.log("partially generated");`;

      const parsed = parseVisualizationResponse(truncatedGeminiOutput);
      expect(parsed.html).toContain('Truncated App');
      expect(parsed.html).toContain('</script>');
      expect(parsed.html).toContain('</html>');
      expect(parsed.html).toContain('#0b0f19');
    });

    it('injects dark mode background styles to prevent white flashing in iframes', () => {
      const raw = `\`\`\`html
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello</h1></body>
</html>
\`\`\`
### Walkthrough
Explanation text here`;

      const parsed = parseVisualizationResponse(raw);
      expect(parsed.html).toContain('id="dsa-dark-root"');
      expect(parsed.html).toContain('background-color: #0b0f19 !important');
      expect(parsed.explanation).toContain('Explanation text here');
      expect(parsed.explanation).not.toContain('<!DOCTYPE html>');
    });
  });
});
