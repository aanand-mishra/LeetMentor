/**
 * On-device speech-to-text via a tiny Whisper model (Transformers.js).
 *
 * Why this instead of the browser's built-in recognition: the built-in API
 * needs a supporting browser AND a network round-trip to vendor servers, and
 * failed outright in real usage. A quantized Whisper model transcribes fully
 * on-device after a one-time download — works offline, private (mic audio
 * never leaves the device), and consistent across Chrome/Edge/Firefox/Safari.
 *
 * Cost model honesty: the heavy `@huggingface/transformers` runtime is
 * dynamic-imported (own code-split chunk, zero initial-bundle impact), and
 * model weights (~40MB tiny / ~150MB base, q4) download once from Hugging
 * Face Hub, then persist in Cache Storage for offline reuse.
 */

export interface SttModelOption {
  /** Stable id stored in settings. */
  id: string;
  /** Hugging Face repo id. */
  repo: string;
  label: string;
  approxSize: string;
  /**
   * True for English-only checkpoints (e.g. `whisper-tiny.en`). These reject
   * `language`/`task` generation kwargs outright, so callers must omit them —
   * the model can only do English transcription by construction.
   */
  englishOnly: boolean;
}

export const STT_MODELS: readonly SttModelOption[] = [
  {
    id: 'tiny',
    repo: 'onnx-community/whisper-tiny.en',
    label: 'Tiny English — fastest, good for clear speech',
    approxSize: '~40 MB download',
    englishOnly: true,
  },
  {
    id: 'base',
    repo: 'onnx-community/whisper-base.en',
    label: 'Base English — more accurate, incl. strong accents',
    approxSize: '~150 MB download',
    englishOnly: true,
  },
  {
    id: 'small',
    repo: 'onnx-community/whisper-small.en',
    label: 'Small English — most accurate, slower per take',
    approxSize: '~300 MB download',
    englishOnly: true,
  },
];

export const DEFAULT_STT_MODEL_ID = 'tiny';
export function normalizeSttModelId(id: string | null | undefined): string {
  const trimmed = (id || '').trim().toLowerCase();
  if (STT_MODELS.some((m) => m.id === trimmed)) return trimmed;
  return DEFAULT_STT_MODEL_ID;
}

export function getSttModel(id: string): SttModelOption {
  return STT_MODELS.find((m) => m.id === normalizeSttModelId(id)) || STT_MODELS[0];
}

export type TranscriptionProvider = 'gemini' | 'on-device';

export const TRANSCRIPTION_PROVIDERS: readonly { id: TranscriptionProvider; label: string }[] = [
  { id: 'gemini', label: 'Gemini Flash — most accurate, needs API key' },
  { id: 'on-device', label: 'On-device Whisper — private, works offline' },
];

export const DEFAULT_TRANSCRIPTION_PROVIDER: TranscriptionProvider = 'gemini';

export function normalizeTranscriptionProvider(
  value: string | null | undefined
): TranscriptionProvider {
  const trimmed = (value || '').trim().toLowerCase();
  if (TRANSCRIPTION_PROVIDERS.some((p) => p.id === trimmed)) {
    return trimmed as TranscriptionProvider;
  }
  return DEFAULT_TRANSCRIPTION_PROVIDER;
}

/** Minimal structural type for the ASR pipeline (avoids coupling to exact export names). */
export type SpeechTranscriber = (
  audio: Float32Array,
  options?: Record<string, unknown>
) => Promise<unknown>;

export interface ModelLoadProgress {
  loadedBytes: number;
  totalBytes: number;
  /** 0..1, or null while totals are still unknown. */
  ratio: number | null;
}

interface ProgressEvent {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

const transcriberCache = new Map<string, Promise<SpeechTranscriber>>();

/** Number of known bytes across in-flight files → aggregate ratio. Pure. */
export function aggregateProgress(
  files: ReadonlyMap<string, { loaded: number; total: number }>
): ModelLoadProgress {
  let loadedBytes = 0;
  let totalBytes = 0;
  for (const f of files.values()) {
    loadedBytes += f.loaded;
    totalBytes += f.total;
  }
  return {
    loadedBytes,
    totalBytes,
    ratio: totalBytes > 0 ? Math.min(1, loadedBytes / totalBytes) : null,
  };
}

/**
 * Loads (or reuses) the Whisper pipeline for a model id. The transformers
 * runtime is imported lazily so it never touches the initial bundle.
 * Failures evict the cache entry so a retry actually retries.
 */
export function getTranscriber(
  modelId: string,
  onProgress?: (p: ModelLoadProgress) => void
): Promise<SpeechTranscriber> {
  const model = getSttModel(modelId);
  const cached = transcriberCache.get(model.id);
  if (cached) return cached;

  const loading = (async (): Promise<SpeechTranscriber> => {
    const { pipeline, env } = await import('@huggingface/transformers');

    // Single-threaded WASM: works without COOP/COEP isolation headers and
    // keeps behavior identical between dev, preview, and production builds.
    try {
      const backends = (env as unknown as Record<string, unknown>).backends as
        Record<string, Record<string, Record<string, unknown>>> | undefined;
      if (backends?.onnx?.wasm) backends.onnx.wasm.numThreads = 1;
    } catch {
      // Non-fatal: the default threading config still works.
    }

    const files = new Map<string, { loaded: number; total: number }>();
    const pipe = await pipeline('automatic-speech-recognition', model.repo, {
      dtype: 'q4',
      progress_callback: (event: ProgressEvent) => {
        if (!onProgress) return;
        if (event.status === 'progress' && event.file) {
          const total = typeof event.total === 'number' ? event.total : 0;
          const loaded =
            typeof event.loaded === 'number'
              ? event.loaded
              : typeof event.progress === 'number' && total > 0
                ? (event.progress / 100) * total
                : 0;
          files.set(event.file, { loaded, total });
          onProgress(aggregateProgress(files));
        } else if (event.status === 'done' && event.file) {
          const prev = files.get(event.file);
          files.set(event.file, {
            loaded: prev?.total || prev?.loaded || 0,
            total: prev?.total || 0,
          });
          onProgress(aggregateProgress(files));
        }
      },
    });
    return pipe as unknown as SpeechTranscriber;
  })();

  transcriberCache.set(model.id, loading);
  loading.catch(() => {
    if (transcriberCache.get(model.id) === loading) transcriberCache.delete(model.id);
  });
  return loading;
}

/**
 * Normalizes the many shapes an ASR pipeline can return into plain text.
 * Pure — handles string, {text}, [{text}] (chunks), and nested variants.
 */
export function extractTranscriptText(output: unknown): string {
  if (typeof output === 'string') return output.trim();
  if (Array.isArray(output)) {
    return output
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) {
          const t = (item as Record<string, unknown>).text;
          return typeof t === 'string' ? t : '';
        }
        return '';
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (output && typeof output === 'object' && 'text' in output) {
    const t = (output as Record<string, unknown>).text;
    return typeof t === 'string' ? t.trim() : '';
  }
  return '';
}

/**
 * Runs 16 kHz mono PCM through Whisper.
 * @param englishOnly English-only checkpoints (`.en`) must NOT receive
 * `language`/`task` kwargs — they throw (see the "Cannot specify 'task' or
 * 'language'" error). Multilingual checkpoints need them to pin English.
 */
export async function transcribe16kAudio(
  transcriber: SpeechTranscriber,
  audio: Float32Array,
  englishOnly = true
): Promise<string> {
  if (audio.length === 0) return '';
  const options: Record<string, unknown> = {
    chunk_length_s: 30,
    stride_length_s: 5,
  };
  if (!englishOnly) {
    options.language = 'en';
    options.task = 'transcribe';
  }
  const output = await transcriber(audio, options);
  return extractTranscriptText(output);
}
