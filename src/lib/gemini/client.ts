import { settingsRepo } from '../../db';
import type { Problem, Attempt, CodeReview, NoteReview } from '../../types';
import {
  buildCodeReviewSystemInstruction,
  buildCodeReviewPayload,
  CODE_REVIEW_RESPONSE_SCHEMA,
  buildNotesReviewSystemInstruction,
  buildNotesReviewPayload,
  NOTES_REVIEW_RESPONSE_SCHEMA,
  buildMentorSystemInstruction,
  buildMentorPayload,
  TRANSCRIPTION_SYSTEM_INSTRUCTION,
  buildTranscriptionUserPrompt,
  buildVisualizationSystemInstruction,
  buildVisualizationUserPrompt,
  parseVisualizationResponse,
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
  const humanLang = settings.responseLanguage || 'English';
  const userPayload = buildCodeReviewPayload(problem, attempt, previousAttempt);

  const rawReview = await dispatchGeminiRequest<Omit<CodeReview, 'model' | 'createdAt'>>({
    apiKey: settings.geminiApiKey,
    model: activeModel,
    systemInstruction: buildCodeReviewSystemInstruction(humanLang),
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

  const activeModel = settings.model || 'gemini-flash-lite-latest';
  const lang = problem.language || settings.defaultLanguage || 'Python';
  const humanLang = settings.responseLanguage || 'English';
  const systemInstruction = buildMentorSystemInstruction(level, lang, humanLang);
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
  const humanLang = settings.responseLanguage || 'English';
  const userPayload = buildNotesReviewPayload(problem, notes, attemptCount);

  const rawResult = await dispatchGeminiRequest<
    Omit<NoteReview, 'id' | 'problemId' | 'notesSnapshot' | 'model' | 'createdAt'>
  >({
    apiKey: settings.geminiApiKey,
    model: activeModel,
    systemInstruction: buildNotesReviewSystemInstruction(humanLang),
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

/**
 * Transcribes a spoken learning note via Gemini Flash audio input.
 *
 * Reuses the shared transport (single-flight queue, 5s spacing, backoff,
 * error taxonomy) and the daily quota counter like every other AI feature.
 * The WAV must be base64 (no data-URL prefix); temperature 0 keeps output
 * deterministic. Returns '' when the model reports no intelligible speech.
 */
export async function requestVoiceTranscription(
  audioBase64Wav: string,
  onQueueUpdate?: (status: string) => void
): Promise<{ text: string; model: string }> {
  const settings = await settingsRepo.get();

  if (!settings.geminiApiKey || !settings.geminiApiKey.trim()) {
    throw new GeminiError(
      'Gemini API key is not configured. Add your key in Settings for cloud transcription.',
      400,
      'API_KEY_MISSING'
    );
  }

  if (!audioBase64Wav) {
    throw new GeminiError('No audio to transcribe.', 400, 'EMPTY_AUDIO');
  }

  const activeModel = settings.model || 'gemini-flash-lite-latest';

  const rawText = await dispatchGeminiRequest<string>({
    apiKey: settings.geminiApiKey,
    model: activeModel,
    systemInstruction: TRANSCRIPTION_SYSTEM_INSTRUCTION,
    userPrompt: buildTranscriptionUserPrompt(),
    mediaParts: [{ mimeType: 'audio/wav', base64Data: audioBase64Wav }],
    temperature: 0,
    onQueueUpdate,
  });

  // Track daily usage locally (FR-8.5)
  await settingsRepo.incrementDailyRequestCount().catch(console.error);

  const text = rawText.trim();
  return {
    text: text === '[no speech detected]' ? '' : text,
    model: activeModel,
  };
}

export const DEFAULT_FLASH_MODEL = 'gemini-3.6-flash';

export const SUPPORTED_FLASH_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Recommended)' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
] as const;

/**
 * Ensures the target model is strictly a Gemini Flash model and never a Lite model.
 */
export function resolveFlashModel(requestedModel?: string): string {
  const clean = requestedModel?.trim();
  // Strictly reject any lite models or TTS audio models
  if (
    clean &&
    !clean.toLowerCase().includes('lite') &&
    !clean.toLowerCase().includes('tts')
  ) {
    // If user has old deprecated gemini-2.5-flash which 404s, upgrade to recommended 3.6
    if (clean === 'gemini-2.5-flash') {
      return DEFAULT_FLASH_MODEL;
    }
    if (clean.toLowerCase().includes('flash')) {
      return clean;
    }
  }
  return DEFAULT_FLASH_MODEL;
}

export interface VisualizationResult {
  html: string;
  explanation: string;
  model: string;
}

/**
 * Requests an interactive DSA visualizer and practice sandbox generated by Gemini Flash.
 * Strictly uses full Flash models (e.g. gemini-3.5-flash) and never Lite models.
 */
export async function requestProblemVisualization(
  problem: Problem,
  latestAttempt?: Attempt,
  preferredModel?: string,
  onQueueUpdate?: (status: string) => void
): Promise<VisualizationResult> {
  const settings = await settingsRepo.get();

  if (!settings.geminiApiKey || !settings.geminiApiKey.trim()) {
    throw new GeminiError(
      'Gemini API key is not configured. Please add your key in Settings.',
      400,
      'API_KEY_MISSING'
    );
  }

  // Model resolution: prioritize user-selected preferredModel -> settings.visualizeModel -> settings.model
  // Always sanitize through resolveFlashModel to strictly forbid Lite models
  const candidateModel = preferredModel || settings.visualizeModel || settings.model;
  let activeModel = resolveFlashModel(candidateModel);

  const lang = problem.language || settings.defaultLanguage || 'python';
  const humanLang = settings.responseLanguage || 'English';
  const systemInstruction = buildVisualizationSystemInstruction(lang, humanLang);
  const userPayload = buildVisualizationUserPrompt(problem, latestAttempt);

  let rawResponse: string;
  let usedModel = activeModel;

  try {
    rawResponse = await dispatchGeminiRequest<string>({
      apiKey: settings.geminiApiKey,
      model: activeModel,
      systemInstruction,
      userPrompt: userPayload,
      temperature: settings.temperature ?? 0.3,
      maxOutputTokens: 20480,
      thinkingConfig: {
        thinkingBudget: 1024,
      },
      onQueueUpdate,
    });
  } catch (err: unknown) {
    const is404 =
      err instanceof GeminiError &&
      (err.statusCode === 404 ||
        err.message.includes('404') ||
        err.message.includes('no longer available'));

    const is503 =
      err instanceof GeminiError &&
      (err.statusCode === 503 ||
        err.code === 'UNAVAILABLE' ||
        err.message.includes('503') ||
        err.message.includes('No capacity'));

    if ((is404 || is503) && activeModel !== 'gemini-3.5-flash' && activeModel !== 'gemini-flash-latest') {
      const fallbackModel = 'gemini-3.5-flash';
      console.warn(
        `Model ${activeModel} failed (${err instanceof GeminiError ? err.statusCode : 'err'}). Retrying with ${fallbackModel}...`
      );
      usedModel = fallbackModel;
      rawResponse = await dispatchGeminiRequest<string>({
        apiKey: settings.geminiApiKey,
        model: usedModel,
        systemInstruction,
        userPrompt: userPayload,
        temperature: settings.temperature ?? 0.3,
        maxOutputTokens: 20480,
        thinkingConfig: {
          thinkingBudget: 1024,
        },
        onQueueUpdate,
      });
      // Update settings.visualizeModel to prevent repeated errors
      await settingsRepo.update({ visualizeModel: usedModel }).catch(() => {});
    } else {
      throw err;
    }
  }

  // Track daily usage locally
  await settingsRepo.incrementDailyRequestCount().catch(console.error);

  const parsed = parseVisualizationResponse(rawResponse);

  return {
    html: parsed.html,
    explanation: parsed.explanation,
    model: usedModel,
  };
}

