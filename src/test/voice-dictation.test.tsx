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
import { VoiceDictateButton } from '../components/problem/VoiceDictateButton';
import { NotesTab } from '../components/problem/NotesTab';
import { ToastProvider } from '../context/ToastContext';
import { problemsRepo, clearAllLocalData } from '../db';
import { requestVoiceTranscription } from '../lib/gemini/client';
import type { Problem } from '../types';

// ---------------------------------------------------------------------------
// Fakes: MediaRecorder, getUserMedia, AudioContext (jsdom ships none).
// ---------------------------------------------------------------------------
vi.mock('../lib/gemini/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/gemini/client')>();
  return {
    ...actual,
    requestVoiceTranscription: vi.fn(async () => ({ text: fakeGeminiText, model: 'gemini-mock' })),
  };
});

const fakeGeminiText = 'gemini transcript of spoken notes';

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

describe('VoiceDictateButton', () => {
  it('renders nothing when unsupported', () => {
    const { container } = render(
      <VoiceDictateButton
        status="idle"
        recordingSeconds={0}
        isSupported={false}
        onToggle={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reflects recording timer and transcribing state', () => {
    const { rerender } = render(
      <VoiceDictateButton status="idle" recordingSeconds={0} isSupported onToggle={() => {}} />
    );
    expect(screen.getByRole('button', { name: /dictate notes by voice/i })).toBeInTheDocument();

    rerender(
      <VoiceDictateButton status="recording" recordingSeconds={65} isSupported onToggle={() => {}} />
    );
    expect(screen.getByRole('button', { name: /stop recording \(1:05\)/i })).toBeInTheDocument();

    rerender(
      <VoiceDictateButton status="transcribing" recordingSeconds={0} isSupported onToggle={() => {}} />
    );
    const btn = screen.getByRole('button', { name: /transcribing/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Transcribing…');
  });
});

describe('NotesTab + Gemini transcription integration', () => {
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

  it('record → stop → Gemini transcript lands in the editor', async () => {
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
  });

  it('Gemini failure surfaces the real provider error', async () => {
    vi.mocked(requestVoiceTranscription).mockRejectedValueOnce(
      new Error('API quota exhausted for the day')
    );
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <NotesTab problem={sampleProblem} noteReviews={[]} onProblemUpdated={vi.fn()} />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /dictate notes by voice/i }));
    await screen.findByRole('button', { name: /stop recording/i });
    await user.click(screen.getByRole('button', { name: /stop recording/i }));

    // The verbatim provider detail reaches the user — no silent fallback.
    await screen.findByText(/transcription failed\. api quota exhausted for the day/i);
    // Nothing was inserted into the editor.
    const textarea = screen.getByPlaceholderText(
      /What was the key insight\?/i
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
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
