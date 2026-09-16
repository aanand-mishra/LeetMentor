import { settingsRepo } from '../../db';
import type { Problem, Attempt, CodeReview, NoteReview } from '../../types';
import {
  CODE_REVIEW_SYSTEM_INSTRUCTION,
  buildCodeReviewPayload,
  CODE_REVIEW_RESPONSE_SCHEMA,
  NOTES_REVIEW_SYSTEM_INSTRUCTION,
  buildNotesReviewPayload,
  NOTES_REVIEW_RESPONSE_SCHEMA,
  buildMentorSystemInstruction,
  buildMentorPayload,
} from './prompts';
import { dispatchGeminiRequest, GeminiError } from './transport';

/**
 * Requests a structured code review for an attempt (§7.4)
 */
export async function requestCodeReview(
  problem: Problem,
  attempt: Attempt,
  previousAttempt?: Attempt,
  onQueueUpdate?: (status: string) => void
): Promise<CodeReview> {
  const settings = await settingsRepo.get();

  if (!settings.geminiApiKey || !settings.geminiApiKey.trim()) {
    throw new GeminiError(
      'Gemini API key is not configured. Please add your key in Settings.',
      400,
      'API_KEY_MISSING'
    );
  }

  const activeModel = settings.model || 'gemini-flash-lite-latest';
  const userPayload = buildCodeReviewPayload(problem, attempt, previousAttempt);

  const rawReview = await dispatchGeminiRequest<Omit<CodeReview, 'model' | 'createdAt'>>({
    apiKey: settings.geminiApiKey,
    model: activeModel,
    systemInstruction: CODE_REVIEW_SYSTEM_INSTRUCTION,
    userPrompt: userPayload,
    temperature: settings.temperature ?? 0.4,
    responseMimeType: 'application/json',
    responseSchema: CODE_REVIEW_RESPONSE_SCHEMA,
    onQueueUpdate,
  });

  // Track daily usage locally (FR-8.5)
  await settingsRepo.incrementDailyRequestCount().catch(console.error);

  const review: CodeReview = {
    ...rawReview,
    model: activeModel,
    createdAt: new Date().toISOString(),
  };

  return review;
}

export interface MentorHintResult {
  content: string;
  model: string;
}

/**
 * Requests an AI mentor hint at Level 1, 2, 3, or 4 (§7.6)
 * Note: OLU / responseSchema is omitted for Mentor calls per §7.1.
 */
export async function requestMentorHint(
  problem: Problem,
  level: 1 | 2 | 3 | 4,
  latestAttempt?: Attempt,
  onQueueUpdate?: (status: string) => void
): Promise<MentorHintResult> {
  const settings = await settingsRepo.get();

  if (!settings.geminiApiKey || !settings.geminiApiKey.trim()) {
    throw new GeminiError(
      'Gemini API key is not configured. Please add your key in Settings.',
      400,
      'API_KEY_MISSING'
    );
  }

  let activeModel = settings.model || 'gemini-flash-lite-latest';
  const lang = problem.language || settings.defaultLanguage || 'Python';
  const systemInstruction = buildMentorSystemInstruction(level, lang);
  const userPayload = buildMentorPayload(problem, latestAttempt);

  let markdownContent: string;
  let usedModel = activeModel;

  try {
    markdownContent = await dispatchGeminiRequest<string>({
      apiKey: settings.geminiApiKey,
      model: activeModel,
      systemInstruction,
      userPrompt: userPayload,
      temperature: settings.temperature ?? 0.4,
      onQueueUpdate,
    });
  } catch (err: unknown) {
    const is503 =
      err instanceof GeminiError &&
      (err.statusCode === 503 ||
        err.code === 'UNAVAILABLE' ||
        err.message.includes('503') ||
        err.message.includes('No capacity'));

    if (is503 && activeModel !== 'gemini-1.5-flash') {
      console.warn(`Model ${activeModel} out of capacity (503). Retrying with gemini-1.5-flash...`);
      try {
        usedModel = 'gemini-1.5-flash';
        markdownContent = await dispatchGeminiRequest<string>({
          apiKey: settings.geminiApiKey,
          model: usedModel,
          systemInstruction,
          userPrompt: userPayload,
          temperature: settings.temperature ?? 0.4,
          onQueueUpdate,
        });
        // Update user setting to prevent repeated 503 errors
        await settingsRepo.update({ model: usedModel }).catch(() => {});
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    } else {
      throw err;
    }
  }

  // Track daily usage locally (FR-8.5)
  await settingsRepo.incrementDailyRequestCount().catch(console.error);

  return {
    content: markdownContent,
    model: usedModel,
  };
}

/**
 * Requests a structured review of learning notes (§7.5)
 */
export async function requestNotesReview(
  problem: Problem,
  notes: string,
  attemptCount: number,
  onQueueUpdate?: (status: string) => void
): Promise<Omit<NoteReview, 'id' | 'createdAt'>> {
  const settings = await settingsRepo.get();

  if (!settings.geminiApiKey || !settings.geminiApiKey.trim()) {
    throw new GeminiError(
      'Gemini API key is not configured. Please add your key in Settings.',
      400,
      'API_KEY_MISSING'
    );
  }

  const activeModel = settings.model || 'gemini-flash-lite-latest';
  const userPayload = buildNotesReviewPayload(problem, notes, attemptCount);

  const rawResult = await dispatchGeminiRequest<Omit<NoteReview, 'id' | 'problemId' | 'notesSnapshot' | 'model' | 'createdAt'>>({
    apiKey: settings.geminiApiKey,
    model: activeModel,
    systemInstruction: NOTES_REVIEW_SYSTEM_INSTRUCTION,
    userPrompt: userPayload,
    temperature: settings.temperature ?? 0.4,
    responseMimeType: 'application/json',
    responseSchema: NOTES_REVIEW_RESPONSE_SCHEMA,
    onQueueUpdate,
  });

  // Track daily usage locally (FR-8.5)
  await settingsRepo.incrementDailyRequestCount().catch(console.error);

  return {
    ...rawResult,
    problemId: problem.id,
    notesSnapshot: notes,
    model: activeModel,
  };
}
