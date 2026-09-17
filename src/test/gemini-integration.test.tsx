import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildCodeReviewPayload,
  buildNotesReviewPayload,
  buildMentorSystemInstruction,
  CODE_REVIEW_RESPONSE_SCHEMA,
  NOTES_REVIEW_RESPONSE_SCHEMA,
  TRANSCRIPTION_SYSTEM_INSTRUCTION,
  buildTranscriptionUserPrompt,
} from '../lib/gemini/prompts';
import { requestVoiceTranscription } from '../lib/gemini/client';
import { settingsRepo, clearAllLocalData } from '../db';
import {
  dispatchGeminiRequest,
  fetchAvailableModels,
  resetTransportQueueState,
  GeminiError,
} from '../lib/gemini/transport';
import type { Problem, Attempt } from '../types';

describe('Phase 11 — Gemini API Integration Layer Tests', () => {
  beforeEach(() => {
    resetTransportQueueState();
    vi.restoreAllMocks();
  });
  const sampleProblem: Problem = {
    id: 'prob-1',
    number: 1,
    title: 'Two Sum',
    url: 'https://leetcode.com/problems/two-sum/',
    statement: 'Given an array of integers nums and an integer target...',
    difficulty: 'Easy',
    topics: ['Array', 'Hash Table'],
    patterns: ['Hash Map'],
    status: 'In Progress',
    confidence: null,
    timeSpentMinutes: 20,
    hintsUsed: 2,
    starred: false,
    userTimeComplexity: 'O(N)',
    userSpaceComplexity: 'O(N)',
    notes: 'Use a map to store seen values.',
    language: 'python',
    dateAdded: '2026-01-01T00:00:00Z',
    dateFirstAttempt: '2026-01-01T00:00:00Z',
    dateSolved: null,
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const sampleAttempt: Attempt = {
    id: 'att-2',
    problemId: 'prob-1',
    attemptNumber: 2,
    code: 'def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []',
    language: 'python',
    userComment: 'Switched from nested loop to single-pass map',
    createdAt: '2026-01-01T00:10:00Z',
    review: null,
  };

  const prevAttempt: Attempt = {
    id: 'att-1',
    problemId: 'prob-1',
    attemptNumber: 1,
    code: 'def twoSum(nums, target): return []',
    language: 'python',
    userComment: 'First brute force attempt',
    createdAt: '2026-01-01T00:05:00Z',
    review: {
      verdict: 'revise',
      summary: 'Quadratic brute force',
      correctness: { status: 'fails_edge_cases', failingCases: ['[2,7], target=9'] },
      complexity: {
        time: 'O(N^2)',
        space: 'O(1)',
        optimalTime: 'O(N)',
        optimalSpace: 'O(N)',
        isOptimal: false,
      },
      issues: [
        {
          severity: 'critical',
          title: 'Quadratic Time',
          detail: 'Nested loop',
          suggestion: 'Use map',
        },
      ],
      positives: ['Clean function signature'],
      nextStep: 'Use hash map',
      model: 'gemini-1.5-flash',
      createdAt: '2026-01-01T00:06:00Z',
    },
  };

  it('builds code review payload with previous context and userComment when attemptNumber > 1 (§7.4)', () => {
    const payload = buildCodeReviewPayload(sampleProblem, sampleAttempt, prevAttempt);

    expect(payload).toContain('PROBLEM: 1. Two Sum (Easy)');
    expect(payload).toContain('LANGUAGE: python');
    expect(payload).toContain('ATTEMPT NUMBER: 2');
    expect(payload).toContain('PREVIOUS REVIEW VERDICT: revise');
    expect(payload).toContain('PREVIOUS UNRESOLVED ISSUES: Quadratic Time');
    expect(payload).toContain(
      'STUDENT SAYS THEY CHANGED: Switched from nested loop to single-pass map'
    );
    expect(payload).toContain('seen[target - n]');
  });

  it('builds notes review payload with problem, hints used, and student notes (§7.5)', () => {
    const notesText =
      'Key takeaway: Map complements in O(1) average lookup to avoid O(N^2) search.';
    const payload = buildNotesReviewPayload(sampleProblem, notesText, 2);

    expect(payload).toContain('PROBLEM: 1. Two Sum (Easy)');
    expect(payload).toContain('HINTS USED: 2 of 4');
    expect(payload).toContain('ATTEMPTS BEFORE PASSING: 2');
    expect(payload).toContain(notesText);
  });

  it('builds mentor system instruction interpolating Level and Language (§7.6)', () => {
    const instructionL1 = buildMentorSystemInstruction(1, 'Python');
    expect(instructionL1).toContain('LEVEL 1 — NUDGE');
    expect(instructionL1).toContain('Current hint level: 1');

    const instructionL4 = buildMentorSystemInstruction(4, 'Java');
    expect(instructionL4).toContain('LEVEL 4 — SOLUTION');
    expect(instructionL4).toContain('Give a complete, commented solution in Java');
    expect(instructionL4).toContain('Current hint level: 4');
  });

  it('injects human responseLanguage into mentor and reviewer prompts', () => {
    // English default should not have language requirement block
    const defaultInstruction = buildMentorSystemInstruction(4, 'python', 'English');
    expect(defaultInstruction).not.toContain('HUMAN LANGUAGE REQUIREMENT');

    // Hinglish requirement
    const hinglishInstruction = buildMentorSystemInstruction(4, 'python', 'Hinglish');
    expect(hinglishInstruction).toContain('HUMAN LANGUAGE REQUIREMENT:');
    expect(hinglishInstruction).toContain('Hinglish');
    expect(hinglishInstruction).toContain('conversational Hindi written in Roman/Latin script');

    // Nepali + English (Romanized) requirement
    const nepaliInstruction = buildMentorSystemInstruction(2, 'cpp', 'Nepali+English(Romanized)');
    expect(nepaliInstruction).toContain('HUMAN LANGUAGE REQUIREMENT:');
    expect(nepaliInstruction).toContain('Nepali+English(Romanized)');
    expect(nepaliInstruction).toContain('conversational Nepali written in Roman/Latin script');
  });

  it('verifies code review and notes review response schemas match specifications', () => {
    expect(CODE_REVIEW_RESPONSE_SCHEMA.properties.verdict.enum).toEqual(['pass', 'revise']);
    expect(CODE_REVIEW_RESPONSE_SCHEMA.required).toContain('verdict');
    expect(CODE_REVIEW_RESPONSE_SCHEMA.required).toContain('complexity');
    expect(CODE_REVIEW_RESPONSE_SCHEMA.required).toContain('issues');

    expect(NOTES_REVIEW_RESPONSE_SCHEMA.properties.verdict.enum).toEqual(['solid', 'needs_work']);
    expect(NOTES_REVIEW_RESPONSE_SCHEMA.required).toContain('rating');
    expect(NOTES_REVIEW_RESPONSE_SCHEMA.required).toContain('keyTakeaway');
    expect(NOTES_REVIEW_RESPONSE_SCHEMA.required).toContain('recallQuestions');
  });

  it('handles 429 rate limit with specific error message and backoff (§7.3)', async () => {
    let callCount = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Resource exhausted: quota exceeded' } }),
      } as Response;
    });

    try {
      await dispatchGeminiRequest({
        apiKey: 'dummy-key',
        model: 'gemini-1.5-flash',
        userPrompt: 'Test',
        minSpacingMs: 0,
        backoffDelays: [10, 20],
      });
      expect.fail('Should have thrown GeminiError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(GeminiError);
      expect((err as GeminiError).statusCode).toBe(429);
      expect((err as GeminiError).message).toContain('Gemini rate limit reached');
      // Should have retried with exponential backoff
      expect(callCount).toBeGreaterThan(1);
    }
  });

  it('maps 400 invalid API key to specific settings error guidance (§7.3)', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(async () => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: { message: 'API_KEY_INVALID' } }),
      } as Response;
    });

    try {
      await dispatchGeminiRequest({
        apiKey: 'bad-key',
        model: 'gemini-1.5-flash',
        userPrompt: 'Test',
        minSpacingMs: 0,
      });
      expect.fail('Should have thrown GeminiError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(GeminiError);
      expect((err as GeminiError).message).toBe('Your API key was rejected. Check it in Settings.');
    }
  });

  it('fetches models and prioritizes Flash-class models (§7.2)', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-1.5-pro',
              displayName: 'Gemini 1.5 Pro',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-1.5-flash',
              displayName: 'Gemini 1.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/text-embedding-004',
              displayName: 'Embedding Model',
              supportedGenerationMethods: ['embedContent'], // should be filtered out
            },
          ],
        }),
      } as Response;
    });

    const models = await fetchAvailableModels('valid-api-key');

    // Filtered out embedding model
    expect(models.length).toBe(2);
    // Flash model is sorted first
    expect(models[0].id).toBe('gemini-1.5-flash');
    expect(models[1].id).toBe('gemini-1.5-pro');
  });
});

describe('Voice transcription via Gemini audio input', () => {
  beforeEach(() => {
    resetTransportQueueState();
    vi.restoreAllMocks();
  });

  function mockTranscriptResponse(text: string) {
    return vi.spyOn(global, 'fetch').mockImplementationOnce(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
        }),
      } as Response;
    });
  }

  it('sends WAV bytes as inline_data alongside the transcription prompt', async () => {
    const fetchSpy = mockTranscriptResponse('hello hello');
    await settingsRepo.update({ geminiApiKey: 'test-key', model: 'gemini-2.0-flash' });

    const result = await requestVoiceTranscription('UklGRg==');
    expect(result.text).toBe('hello hello');
    expect(result.model).toBe('gemini-2.0-flash');

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    const parts = body.contents[0].parts;
    expect(parts[0].text).toContain('Transcribe');
    expect(parts[1].inline_data.mime_type).toBe('audio/wav');
    expect(parts[1].inline_data.data).toBe('UklGRg==');
    // Plain-text response: no JSON schema requested.
    expect(body.generationConfig.responseMimeType).toBeUndefined();
    expect(body.generationConfig.temperature).toBe(0);
  });

  it('maps the no-speech sentinel to empty text', async () => {
    mockTranscriptResponse('[no speech detected]');
    await settingsRepo.update({ geminiApiKey: 'test-key' });

    const result = await requestVoiceTranscription('UklGRg==');
    expect(result.text).toBe('');
  });

  it('throws a settings-guiding error when no API key is configured', async () => {
    await clearAllLocalData();

    await expect(requestVoiceTranscription('UklGRg==')).rejects.toMatchObject({
      code: 'API_KEY_MISSING',
    });
  });

  it('transcription prompt demands verbatim output only', () => {
    expect(TRANSCRIPTION_SYSTEM_INSTRUCTION).toContain('verbatim');
    expect(TRANSCRIPTION_SYSTEM_INSTRUCTION).toContain('ONLY the verbatim transcript');
    expect(TRANSCRIPTION_SYSTEM_INSTRUCTION).toContain('[no speech detected]');
    expect(buildTranscriptionUserPrompt()).toContain('Transcribe');
  });
});
