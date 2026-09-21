import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SettingsPage } from '../pages/SettingsPage';
import {
  problemsRepo,
  attemptsRepo,
  mentorRepo,
  noteReviewsRepo,
  settingsRepo,
  clearAllLocalData,
  db,
} from '../db';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider } from '../context/ThemeContext';
import { exportDatabaseToJson, importDatabase, validateExportPayload } from '../utils/export';

describe('FR-8 — Settings & Data Management Acceptance Tests', () => {
  beforeEach(async () => {
    await clearAllLocalData();
    // Configure settings with an API key
    await settingsRepo.update({
      geminiApiKey: 'test-secret-api-key-12345',
      model: 'gemini-1.5-flash',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exported JSON contains NO geminiApiKey value anywhere at any nesting level (FR-8.6 Acceptance)', async () => {
    // Add sample records
    const problem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: 'Find two numbers',
      difficulty: 'Easy',
      topics: ['Array'],
      patterns: ['Two Pointers'],
      status: 'Solved',
      confidence: 5,
      timeSpentMinutes: 15,
      hintsUsed: 0,
      starred: true,
      userTimeComplexity: 'O(N)',
      userSpaceComplexity: 'O(N)',
      notes: 'Use hash map',
      language: 'python',
      dateFirstAttempt: new Date().toISOString(),
      dateSolved: new Date().toISOString(),
    });

    await attemptsRepo.create({
      problemId: problem.id,
      code: 'def twoSum(): pass',
      language: 'python',
    });

    await mentorRepo.saveMessage({
      problemId: problem.id,
      level: 1,
      content: 'Nudge hint',
      model: 'gemini-1.5-flash',
    });

    await noteReviewsRepo.create({
      problemId: problem.id,
      notesSnapshot: 'Use hash map',
      rating: 5,
      verdict: 'solid',
      corrections: [],
      gaps: [],
      strengths: ['Great takeaway'],
      keyTakeaway: 'Hash maps give O(1) lookups',
      recallQuestions: ['Q1', 'Q2', 'Q3'],
      model: 'gemini-1.5-flash',
    });

    // Ensure settings has secret API key in IndexedDB
    const currentSettings = await settingsRepo.get();
    expect(currentSettings.geminiApiKey).toBe('test-secret-api-key-12345');

    // Perform Export
    const exportedJson = await exportDatabaseToJson();

    // Verify key is strictly stripped
    expect(exportedJson).not.toContain('test-secret-api-key-12345');
    expect(exportedJson).not.toContain('geminiApiKey');

    const parsed = JSON.parse(exportedJson);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.problems.length).toBe(1);
    expect(parsed.attempts.length).toBe(1);
    expect(parsed.mentorMessages.length).toBe(1);
    expect(parsed.noteReviews.length).toBe(1);

    if (parsed.settings) {
      expect(parsed.settings.geminiApiKey).toBeUndefined();
    }
  });

  it('export then Replace-import on empty database reproduces the exact dataset (FR-8.6 Acceptance)', async () => {
    const prob = await problemsRepo.create({
      number: 15,
      title: '3Sum',
      url: 'https://leetcode.com/problems/3sum/',
      statement: 'Given an array nums...',
      difficulty: 'Medium',
      topics: ['Array', 'Two Pointers'],
      patterns: ['Two Pointers'],
      status: 'Solved',
      confidence: 4,
      timeSpentMinutes: 45,
      hintsUsed: 2,
      starred: true,
      userTimeComplexity: 'O(N^2)',
      userSpaceComplexity: 'O(1)',
      notes: 'Sort first then 2-pointer scan.',
      language: 'python',
      dateFirstAttempt: new Date().toISOString(),
      dateSolved: new Date().toISOString(),
    });

    const exportedJson = await exportDatabaseToJson();
    const validation = validateExportPayload(exportedJson);
    expect(validation.valid).toBe(true);
    expect(validation.data).toBeDefined();

    // Wipe DB
    await clearAllLocalData();
    expect(await db.problems.count()).toBe(0);

    // Import using Replace mode
    await importDatabase(validation.data!, 'replace');

    expect(await db.problems.count()).toBe(1);
    const restored = await db.problems.get(prob.id);
    expect(restored?.title).toBe('3Sum');
    expect(restored?.difficulty).toBe('Medium');
    expect(restored?.confidence).toBe(4);
    expect(restored?.starred).toBe(true);
  });

  it('Test connection surfaces Google error text on rejected API key (FR-8.1 Acceptance)', async () => {
    // Mock global fetch to return Google 400 API_KEY_INVALID
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            code: 400,
            message: 'API key not valid. Please pass a valid API key.',
            status: 'INVALID_ARGUMENT',
            details: [{ reason: 'API_KEY_INVALID' }],
          },
        }),
      } as Response;
    });

    render(
      <ThemeProvider>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </ThemeProvider>
    );

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByText(/Google Gemini API Key/i)).toBeInTheDocument();
    });

    const testBtn = screen.getByRole('button', { name: /Test connection/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Your API key was rejected\. Check it in Settings\./i)
      ).toBeInTheDocument();
    });
  });

  it('verifies required security notice text is displayed verbatim in visible callout (FR-8.2 Acceptance)', async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /Your API key is stored unencrypted in this browser's IndexedDB and is sent directly from your browser to Google\./i
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          /Free-tier Gemini requests may be used by Google to improve their models\. Do not paste confidential or employer-owned code\./i
        )
      ).toBeInTheDocument();
    });
  });

  it('verifies AI Output Human Language setting renders, defaults to English, and can be updated', async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/AI Output Human Language/i)).toBeInTheDocument();
    });

    const langInput = screen.getByLabelText(/AI Output Human Language/i) as HTMLInputElement;
    expect(langInput.value).toBe('English');

    // Click quick preset chip "Hinglish"
    const hinglishChip = screen.getByRole('button', { name: 'Hinglish' });
    fireEvent.click(hinglishChip);

    await waitFor(async () => {
      const stored = await settingsRepo.get();
      expect(stored.responseLanguage).toBe('Hinglish');
    });

    expect(langInput.value).toBe('Hinglish');
  });
});
