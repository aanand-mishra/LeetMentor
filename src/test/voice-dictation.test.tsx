import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MAX_RECORD_SECONDS,
  averageToMono,
  blobToBase64,
  decodeTo16kMono,
  downsampleTo16kMono,
  encodeWav16kMono,
  formatRecordingTime,
} from '../lib/voice/audio';
import {
  DEFAULT_TRANSCRIPTION_PROVIDER,
  aggregateProgress,
  extractTranscriptText,
  normalizeSttModelId,
  normalizeTranscriptionProvider,
  transcribe16kAudio,
  STT_MODELS,
} from '../lib/voice/stt';
import { VoiceDictateButton } from '../components/problem/VoiceDictateButton';
import { NotesTab } from '../components/problem/NotesTab';
import { ToastProvider } from '../context/ToastContext';
import { problemsRepo, settingsRepo, clearAllLocalData } from '../db';
import { requestVoiceTranscription } from '../lib/gemini/client';
import type { Problem } from '../types';

// ---------------------------------------------------------------------------
// Fakes: MediaRecorder, getUserMedia, AudioContext (jsdom ships none).
// The transformers runtime itself is mocked at the module boundary below.
// ---------------------------------------------------------------------------
vi.mock('../lib/voice/stt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/voice/stt')>();
  return {
    ...actual,
    getTranscriber: vi.fn(async () => fakeTranscriber),
  };
});

vi.mock('../lib/gemini/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/gemini/client')>();
  return {
    ...actual,
    requestVoiceTranscription: vi.fn(async () => ({ text: fakeGeminiText, model: 'gemini-mock' })),
  };
});

const fakeGeminiText = 'gemini transcript of spoken notes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transcribedInputs: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transcribedOptions: any[] = [];
async function fakeTranscriber(audio: Float32Array, options?: Record<string, unknown>) {
  transcribedInputs.push(audio);
  transcribedOptions.push(options || {});
  return { text: 'mocked transcript of spoken notes' };
}

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static supported = new Set(['audio/webm;codecs=opus', 'audio/webm']);
  static isTypeSupported(t: string) {
    return MockMediaRecorder.supported.has(t);
  }
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  state = 'inactive';
  startCalls = 0;
  stopCalls = 0;
  constructor(
    public stream: unknown,
    public options?: unknown
  ) {
    MockMediaRecorder.instances.push(this);
  }
  start() {
    this.startCalls += 1;
    this.state = 'recording';
  }
  stop() {
    this.stopCalls += 1;
    this.state = 'inactive';
    // Spec order: final dataavailable flush, then stop event.
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

class MockAudioContext {
  // 1s of 48kHz mono silence — decodes to 16000 samples (above the min gate).
  async decodeAudioData() {
    return {
      numberOfChannels: 1,
      sampleRate: 48000,
      getChannelData: () => new Float32Array(48000),
    };
  }
  async close() {}
}

const mockTracks = [{ stop: vi.fn() }];
const mockStream = { getTracks: () => mockTracks };

function installFakes() {
  MockMediaRecorder.instances = [];
  transcribedInputs.length = 0;
  transcribedOptions.length = 0;
  (window as unknown as Record<string, unknown>).MediaRecorder = MockMediaRecorder;
  (window as unknown as Record<string, unknown>).AudioContext = MockAudioContext;
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(async () => mockStream) },
    configurable: true,
  });
}

function uninstallFakes() {
  delete (window as unknown as Record<string, unknown>).MediaRecorder;
  delete (window as unknown as Record<string, unknown>).AudioContext;
}

describe('lib/voice/audio — pure helpers', () => {
  it('downsamples 48kHz to 16kHz at the right ratio', () => {
    const input = new Float32Array(48000).fill(0.5);
    const out = downsampleTo16kMono(input, 48000);
    expect(out.length).toBe(16000);
    expect(out[0]).toBeCloseTo(0.5, 5);
  });

  it('returns a copy (not the same buffer) at native 16kHz', () => {
    const input = new Float32Array([0.1, 0.2]);
    const out = downsampleTo16kMono(input, 16000);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('handles empty input without crashing', () => {
    expect(downsampleTo16kMono(new Float32Array(0), 48000).length).toBe(0);
  });

  it('averages channels to mono', () => {
    const mono = averageToMono([new Float32Array([1, 1]), new Float32Array([3, 3])]);
    expect(Array.from(mono)).toEqual([2, 2]);
    expect(averageToMono([]).length).toBe(0);
  });

  it('formats the recording timer as m:ss', () => {
    expect(formatRecordingTime(0)).toBe('0:00');
    expect(formatRecordingTime(9.7)).toBe('0:09');
    expect(formatRecordingTime(75)).toBe('1:15');
    expect(MAX_RECORD_SECONDS).toBe(120);
  });

  it('encodes 16-bit mono WAV with a valid 44-byte header', async () => {
    const blob = encodeWav16kMono(new Float32Array([0, 0.5, -0.5, 1, -1]));
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 5 * 2);
    // Read back through the production base64 path (jsdom Blob lacks arrayBuffer).
    const bytes = Uint8Array.from(await blobToBase64(blob).then(atob), (c) => c.charCodeAt(0));
    const ascii = (o: number, n: number) => String.fromCharCode(...bytes.subarray(o, o + n));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(ascii(36, 4)).toBe('data');
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getInt16(44 + 3 * 2, true)).toBe(0x7fff); // +1.0 clips to max
  });

  it('base64-encodes blobs without a data-URL prefix', async () => {
    expect(await blobToBase64(new Blob(['AB']))).toBe('QUI=');
  });

  it('decodes a blob to 16kHz mono through the AudioContext seam', async () => {
    installFakes();
    try {
      const pcm = await decodeTo16kMono(new Blob(['x'], { type: 'audio/webm' }));
      expect(pcm.length).toBe(16000);
    } finally {
      uninstallFakes();
    }
  });
});

describe('lib/voice/stt — pure helpers', () => {
  it('defaults transcription to Gemini Flash and validates stored values', () => {
    expect(DEFAULT_TRANSCRIPTION_PROVIDER).toBe('gemini');
    expect(normalizeTranscriptionProvider('on-device')).toBe('on-device');
    expect(normalizeTranscriptionProvider(' GEMINI ')).toBe('gemini');
    expect(normalizeTranscriptionProvider('whisper')).toBe('gemini');
    expect(normalizeTranscriptionProvider(null)).toBe('gemini');
  });

  it('ships tiny + base + small models and validates stored ids', () => {
    expect(STT_MODELS.map((m) => m.id)).toEqual(['tiny', 'base', 'small']);
    expect(normalizeSttModelId('base')).toBe('base');
    expect(normalizeSttModelId(' TINY ')).toBe('tiny');
    expect(normalizeSttModelId('xxl')).toBe('tiny');
    expect(normalizeSttModelId(null)).toBe('tiny');
  });

  it('normalizes every pipeline output shape to text', () => {
    expect(extractTranscriptText('  hello world ')).toBe('hello world');
    expect(extractTranscriptText({ text: ' chunk one ' })).toBe('chunk one');
    expect(extractTranscriptText([{ text: 'a' }, { text: 'b' }])).toBe('a b');
    expect(extractTranscriptText([{ text: 'a' }, 'b'])).toBe('a b');
    expect(extractTranscriptText(null)).toBe('');
    expect(extractTranscriptText(42)).toBe('');
  });

  it('aggregates per-file download progress', () => {
    expect(aggregateProgress(new Map()).ratio).toBeNull();
    const p = aggregateProgress(
      new Map([
        ['a.onnx', { loaded: 50, total: 100 }],
        ['b.onnx', { loaded: 100, total: 100 }],
      ])
    );
    expect(p.loadedBytes).toBe(150);
    expect(p.totalBytes).toBe(200);
    expect(p.ratio).toBeCloseTo(0.75, 5);
  });

  it('omits language/task kwargs for English-only models (they throw otherwise)', async () => {
    // Regression: whisper-tiny.en rejects `language`/`task` with
    // "Cannot specify 'task' or 'language' for an English-only model".
    const text = await transcribe16kAudio(fakeTranscriber, new Float32Array(16000), true);
    expect(text).toBe('mocked transcript of spoken notes');
    const sent = transcribedOptions[transcribedOptions.length - 1];
    expect(sent).not.toHaveProperty('language');
    expect(sent).not.toHaveProperty('task');
    expect(sent).toMatchObject({ chunk_length_s: 30, stride_length_s: 5 });
  });

  it('pins language/task for multilingual models', async () => {
    await transcribe16kAudio(fakeTranscriber, new Float32Array(16000), false);
    expect(transcribedOptions[transcribedOptions.length - 1]).toMatchObject({
      language: 'en',
      task: 'transcribe',
    });
  });

  it('returns empty text for empty audio without calling the model', async () => {
    const calls = transcribedOptions.length;
    await expect(transcribe16kAudio(fakeTranscriber, new Float32Array(0), true)).resolves.toBe('');
    expect(transcribedOptions.length).toBe(calls);
  });
});

describe('VoiceDictateButton', () => {
  it('renders nothing when unsupported', () => {
    const { container } = render(
      <VoiceDictateButton
        status="idle"
        modelProgress={null}
        recordingSeconds={0}
        isSupported={false}
        onToggle={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reflects recording timer, transcribing, and download progress', () => {
    const { rerender } = render(
      <VoiceDictateButton
        status="idle"
        modelProgress={null}
        recordingSeconds={0}
        isSupported
        onToggle={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /dictate notes by voice/i })).toBeInTheDocument();

    rerender(
      <VoiceDictateButton
        status="recording"
        modelProgress={null}
        recordingSeconds={65}
        isSupported
        onToggle={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /stop recording \(1:05\)/i })).toBeInTheDocument();

    rerender(
      <VoiceDictateButton
        status="transcribing"
        modelProgress={{ loadedBytes: 1, totalBytes: 2, ratio: 0.5 }}
        recordingSeconds={0}
        isSupported
        onToggle={() => {}}
      />
    );
    const btn = screen.getByRole('button', { name: /transcribing/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Model 50%');
  });
});

describe('NotesTab + on-device STT integration', () => {
  let sampleProblem: Problem;

  beforeEach(async () => {
    await clearAllLocalData();
    vi.clearAllMocks();
    installFakes();
    sampleProblem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: 'Given an array of integers...',
      difficulty: 'Easy',
      topics: ['Array', 'Hash Table'],
      patterns: ['Hash Map'],
      status: 'In Progress',
      confidence: null,
      timeSpentMinutes: null,
      hintsUsed: 1,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: '',
      language: 'python',
      dateFirstAttempt: new Date().toISOString(),
      dateSolved: null,
    });
  });

  afterEach(() => uninstallFakes());

  it('record → stop → Gemini transcript lands in the editor (default provider)', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <NotesTab problem={sampleProblem} noteReviews={[]} onProblemUpdated={vi.fn()} />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /dictate notes by voice/i }));
    await screen.findByRole('button', { name: /stop recording/i });
    expect(MockMediaRecorder.instances).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /stop recording/i }));

    const textarea = screen.getByPlaceholderText(
      /What was the key insight\?/i
    ) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toContain('gemini transcript of spoken notes'));

    // The cloud received base64 WAV (RIFF header), not raw recorder bytes.
    expect(requestVoiceTranscription).toHaveBeenCalledTimes(1);
    const sentBase64 = vi.mocked(requestVoiceTranscription).mock.calls[0][0] as string;
    expect(
      Uint8Array.from(atob(sentBase64.slice(0, 8)), (c) => c.charCodeAt(0)).slice(0, 4)
    ).toEqual(new Uint8Array([82, 73, 70, 70])); // 'RIFF'
    // On-device model was never touched on the Gemini path.
    expect(transcribedInputs.length).toBe(0);
  });

  it('record → stop → on-device transcript when provider is on-device', async () => {
    await settingsRepo.update({ sttProvider: 'on-device' });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <NotesTab problem={sampleProblem} noteReviews={[]} onProblemUpdated={vi.fn()} />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /dictate notes by voice/i }));
    await screen.findByRole('button', { name: /stop recording/i });
    await user.click(screen.getByRole('button', { name: /stop recording/i }));

    const textarea = screen.getByPlaceholderText(
      /What was the key insight\?/i
    ) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toContain('mocked transcript of spoken notes'));
    // 16kHz mono PCM actually reached the (mocked) model.
    expect(transcribedInputs.length).toBe(1);
    expect(transcribedInputs[0].length).toBe(16000);
    // End-to-end regression: English-only model must not get language/task.
    expect(transcribedOptions[0]).not.toHaveProperty('language');
    expect(transcribedOptions[0]).not.toHaveProperty('task');
    expect(requestVoiceTranscription).not.toHaveBeenCalled();
  });

  it('mic denial surfaces an actionable error and keeps typed notes working', async () => {
    const user = userEvent.setup();
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('denied')
    );
    render(
      <ToastProvider>
        <NotesTab problem={sampleProblem} noteReviews={[]} onProblemUpdated={vi.fn()} />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /dictate notes by voice/i }));
    await screen.findByText(/microphone access was blocked/i);
    expect(screen.getByPlaceholderText(/What was the key insight\?/i)).toBeInTheDocument();
  });

  it('hides Dictate entirely when mic capture is unavailable', () => {
    uninstallFakes();
    render(
      <ToastProvider>
        <NotesTab problem={sampleProblem} noteReviews={[]} onProblemUpdated={vi.fn()} />
      </ToastProvider>
    );
    expect(screen.queryByRole('button', { name: /dictate/i })).not.toBeInTheDocument();
  });
});
