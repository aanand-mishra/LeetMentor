export interface GeminiMediaPart {
  mimeType: string;
  base64Data: string;
}

export interface GeminiRequestOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  userPrompt: string;
  /** Binary attachments (e.g. voice-note WAV) sent as `inline_data` parts. */
  mediaParts?: GeminiMediaPart[];
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: Record<string, unknown>;
  thinkingConfig?: {
    thinkingBudget?: number;
  };
  minSpacingMs?: number;
  backoffDelays?: number[];
  onQueueUpdate?: (status: string) => void;
}

export interface ModelOption {
  id: string;
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
}

export class GeminiError extends Error {
  statusCode?: number;
  code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'GeminiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Single-flight queue state & 5-second minimum spacing (§7.3)
let lastRequestDispatchedAt = 0;
let queuePromise: Promise<unknown> = Promise.resolve();

export function resetTransportQueueState(): void {
  lastRequestDispatchedAt = 0;
  queuePromise = Promise.resolve();
}

/**
 * Dispatches a Gemini request ensuring:
 * 1. Single-flight execution (at most 1 in flight app-wide)
 * 2. Minimum 5-second spacing between requests (configurable for tests)
 * 3. Exponential backoff on HTTP 429 (1s, 2s, 4s, 8s)
 */
export async function dispatchGeminiRequest<T = string>(options: GeminiRequestOptions): Promise<T> {
  const minSpacing = options.minSpacingMs ?? 5000;

  // Chain behind existing queue promise
  const currentTask = (async () => {
    // 1. Wait for preceding request to complete
    await queuePromise.catch(() => {});

    // 2. Enforce minimum spacing
    const now = Date.now();
    const elapsedSinceLast = now - lastRequestDispatchedAt;

    if (lastRequestDispatchedAt > 0 && elapsedSinceLast < minSpacing) {
      const waitMs = minSpacing - elapsedSinceLast;
      options.onQueueUpdate?.(`Rate-spacing: waiting ${Math.ceil(waitMs / 1000)}s…`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    lastRequestDispatchedAt = Date.now();

    // 3. Execute with exponential backoff on 429
    return executeWithBackoff<T>(options);
  })();

  // Update global queue promise
  queuePromise = currentTask;
  return currentTask;
}

/**
 * Exponential backoff loop on 429: 1s -> 2s -> 4s -> 8s
 */
async function executeWithBackoff<T>(options: GeminiRequestOptions, attemptNumber = 1): Promise<T> {
  const backoffDelays = options.backoffDelays ?? [1000, 2000, 4000, 8000];
  const maxRetries = backoffDelays.length;

  try {
    return await executeSingleRequest<T>(options);
  } catch (err: unknown) {
    if (err instanceof GeminiError && err.statusCode === 429 && attemptNumber <= maxRetries) {
      const delay = backoffDelays[attemptNumber - 1] || 8000;
      options.onQueueUpdate?.(
        `Gemini rate limit reached. Free tier allows a limited number of requests per minute and per day. Retrying in ${delay / 1000}s…`
      );
      await new Promise((res) => setTimeout(res, delay));
      return executeWithBackoff<T>(options, attemptNumber + 1);
    }
    throw err;
  }
}

/**
 * Makes the single fetch call to Gemini generateContent endpoint
 */
async function executeSingleRequest<T>(options: GeminiRequestOptions): Promise<T> {
  const {
    apiKey,
    model,
    systemInstruction,
    userPrompt,
    mediaParts,
    temperature = 0.4,
    maxOutputTokens = 2048,
    responseMimeType,
    responseSchema,
    thinkingConfig,
  } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new GeminiError(
      'API key is missing. Please configure it in Settings.',
      400,
      'API_KEY_MISSING'
    );
  }

  // Clean model ID (remove models/ prefix if present)
  const cleanModel = model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;

  const bodyPayload: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt },
          ...(mediaParts || []).map((m) => ({
            inline_data: { mime_type: m.mimeType, data: m.base64Data },
          })),
        ],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(responseMimeType ? { responseMimeType } : {}),
      ...(responseSchema ? { responseSchema } : {}),
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify(bodyPayload),
    });
  } catch {
    // Network failure error taxonomy (§7.3)
    throw new GeminiError(
      'Could not reach Google. Check your connection. Everything else in the app works offline.',
      0,
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    let errorData: { error?: { message?: string; status?: string; details?: unknown[] } } = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse error on non-ok response
    }

    const rawMessage = errorData.error?.message || response.statusText;
    const status = response.status;

    // Error taxonomy per §7.3
    if (status === 429) {
      throw new GeminiError(
        'Gemini rate limit reached. Free tier allows a limited number of requests per minute and per day. Try again in a few minutes, or switch to a Flash-Lite model in Settings.',
        429,
        'RESOURCE_EXHAUSTED'
      );
    }

    if (
      status === 400 &&
      (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('API key not valid'))
    ) {
      throw new GeminiError(
        'Your API key was rejected. Check it in Settings.',
        400,
        'API_KEY_INVALID'
      );
    }

    if (status === 403) {
      throw new GeminiError(
        'This key does not have access to the Generative Language API. Enable it in Google AI Studio.',
        403,
        'PERMISSION_DENIED'
      );
    }

    if (status === 503) {
      if (cleanModel !== 'gemini-1.5-flash') {
        console.warn(
          `Model "${cleanModel}" returned 503 UNAVAILABLE. Retrying call with gemini-1.5-flash...`
        );
        try {
          return await executeSingleRequest<T>({
            ...options,
            model: 'gemini-1.5-flash',
          });
        } catch (retryErr) {
          console.error('Fallback to gemini-1.5-flash failed:', retryErr);
        }
      }
      throw new GeminiError(
        `Gemini server is temporarily unavailable or out of capacity for model "${cleanModel}" (503). Try switching to "gemini-1.5-flash" in Settings or retry in a few moments.`,
        503,
        'UNAVAILABLE'
      );
    }

    throw new GeminiError(
      `Gemini error (${status}): ${rawMessage}`,
      status,
      errorData.error?.status
    );
  }

  const data = await response.json();

  // Top-level block reason handling (§7.1)
  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(
      `Prompt was blocked by Gemini safety filter: ${data.promptFeedback.blockReason}`,
      400,
      'SAFETY_BLOCKED'
    );
  }

  // Handle empty candidates
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    throw new GeminiError('No response candidate returned from Gemini.', 500, 'NO_CANDIDATES');
  }

  const firstCandidate = candidates[0];

  // Non-STOP finishReason handling (§7.1)
  if (firstCandidate.finishReason && firstCandidate.finishReason !== 'STOP') {
    if (firstCandidate.finishReason === 'MAX_TOKENS') {
      console.warn('Gemini response truncated due to MAX_TOKENS');
    } else if (firstCandidate.finishReason === 'SAFETY') {
      throw new GeminiError(
        'Gemini response was blocked by safety filters.',
        400,
        'SAFETY_BLOCKED'
      );
    }
  }

  const rawText = firstCandidate.content?.parts?.[0]?.text;
  if (typeof rawText !== 'string') {
    throw new GeminiError('Empty response content received from Gemini.', 500, 'EMPTY_RESPONSE');
  }

  // If JSON output was requested, parse it
  if (responseMimeType === 'application/json') {
    try {
      return JSON.parse(rawText) as T;
    } catch {
      // Sometimes JSON might be enclosed in markdown code fences
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      return JSON.parse(cleaned) as T;
    }
  }

  return rawText as unknown as T;
}

/**
 * Fetches available models from Google Generative Language API (§7.2)
 * Filters to models supporting generateContent, preferring Flash-class models.
 */
export async function fetchAvailableModels(apiKey: string): Promise<ModelOption[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new GeminiError('API key required to fetch models', 400);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey.trim(),
      },
    });
  } catch {
    throw new GeminiError(
      'Could not reach Google. Check your connection. Everything else in the app works offline.',
      0,
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    let errJson: { error?: { message?: string } } = {};
    try {
      errJson = await response.json();
    } catch {
      // Ignore
    }
    const msg = errJson.error?.message || response.statusText;

    if (
      response.status === 400 &&
      (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid'))
    ) {
      throw new GeminiError(
        'Your API key was rejected. Check it in Settings.',
        400,
        'API_KEY_INVALID'
      );
    }
    if (response.status === 403) {
      throw new GeminiError(
        'This key does not have access to the Generative Language API. Enable it in Google AI Studio.',
        403,
        'PERMISSION_DENIED'
      );
    }
    throw new GeminiError(`Failed to fetch models: ${msg}`, response.status);
  }

  const data = await response.json();
  const models = (data.models || []) as Array<{
    name: string;
    displayName: string;
    description: string;
    supportedGenerationMethods?: string[];
  }>;

  // Filter to entries supporting generateContent
  const eligible = models.filter((m) =>
    (m.supportedGenerationMethods || []).includes('generateContent')
  );

  const mapped: ModelOption[] = eligible.map((m) => ({
    id: m.name.replace(/^models\//, ''),
    displayName: m.displayName || m.name,
    description: m.description || '',
    supportedGenerationMethods: m.supportedGenerationMethods || [],
  }));

  // Sort preferring Flash-class models as default selection (§7.2)
  mapped.sort((a, b) => {
    const aIsFlash = a.id.toLowerCase().includes('flash');
    const bIsFlash = b.id.toLowerCase().includes('flash');
    if (aIsFlash && !bIsFlash) return -1;
    if (!aIsFlash && bIsFlash) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return mapped;
}

/**
 * Minimal live test call for "Test connection" button in Settings (FR-8.1)
 */
export async function testConnection(
  apiKey: string,
  model = 'gemini-flash-lite-latest'
): Promise<{ ok: boolean; message: string }> {
  try {
    const cleanModel = model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Ping' }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });

    if (!response.ok) {
      let errJson: { error?: { message?: string } } = {};
      try {
        errJson = await response.json();
      } catch {
        // Ignore
      }
      const msg = errJson.error?.message || response.statusText;

      if (
        response.status === 400 &&
        (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid'))
      ) {
        return { ok: false, message: 'Your API key was rejected. Check it in Settings.' };
      }
      if (response.status === 403) {
        return {
          ok: false,
          message:
            'This key does not have access to the Generative Language API. Enable it in Google AI Studio.',
        };
      }
      return { ok: false, message: `Google error (${response.status}): ${msg}` };
    }

    return { ok: true, message: 'Connection successful! Gemini API is responding.' };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TypeError') {
      return {
        ok: false,
        message:
          'Could not reach Google. Check your connection. Everything else in the app works offline.',
      };
    }
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown connection error.' };
  }
}
