/**
 * Audio capture helpers for on-device speech-to-text.
 *
 * Whisper consumes 16 kHz mono PCM. Browser recorders emit compressed audio
 * (usually 48 kHz Opus in WebM), so every clip goes through
 * `decodeTo16kMono()` before transcription. The resampler itself is a pure
 * function (`downsampleTo16kMono`) kept separate for unit testing.
 */

const TARGET_SAMPLE_RATE = 16000;

/** Hard cap per dictation take; the recorder auto-stops here. */
export const MAX_RECORD_SECONDS = 120;

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

/** First MediaRecorder MIME type the browser supports, or '' for the default. */
export function pickRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

/**
 * Linear-interpolation downsampler to 16 kHz mono. Pure — no AudioContext.
 * Expects single-channel PCM; callers average channels down beforehand.
 */
export function downsampleTo16kMono(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_SAMPLE_RATE) return input.slice();
  if (inputRate <= 0 || input.length === 0) return new Float32Array(0);
  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio;
    const index = Math.floor(pos);
    const frac = pos - index;
    const a = input[index] || 0;
    const b = input[index + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Averages multi-channel PCM down to mono. Pure. */
export function averageToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0].slice();
  const length = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const c of channels) sum += c[i];
    out[i] = sum / channels.length;
  }
  return out;
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.AudioContext as typeof AudioContext) || (w.webkitAudioContext as typeof AudioContext) || null
  );
}

export function isAudioCaptureSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) return false;
  return (
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    getAudioContextConstructor() !== null
  );
}

/** Reads a Blob as ArrayBuffer, with a FileReader fallback for older engines. */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error('blob read failed'));
    reader.readAsArrayBuffer(blob);
  });
}

/** Decodes a recorded blob and returns 16 kHz mono PCM ready for Whisper. */
export async function decodeTo16kMono(blob: Blob): Promise<Float32Array> {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) throw new Error('Audio decoding is not supported in this browser.');
  const buffer = await blobToArrayBuffer(blob);
  // A short-lived context: created per clip, closed right after decoding.
  const ctx = new Ctor();
  try {
    const decoded = await ctx.decodeAudioData(buffer);
    const channels: Float32Array[] = [];
    const count = Math.min(decoded.numberOfChannels, 2);
    for (let c = 0; c < count; c += 1) {
      channels.push(decoded.getChannelData(c));
    }
    return downsampleTo16kMono(averageToMono(channels), decoded.sampleRate);
  } finally {
    try {
      await ctx.close();
    } catch {
      // Ignore close errors on discarded contexts.
    }
  }
}

/** m:ss formatter for the recording timer. Pure. */
export function formatRecordingTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Encodes 16 kHz mono PCM as a 16-bit WAV Blob — the safest container for
 * Gemini audio input (`audio/wav` is always accepted, unlike recorder-native
 * WebM/Opus). Pure: deterministic bytes for given samples, unit-tested.
 */
export function encodeWav16kMono(samples: Float32Array): Blob {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Base64 (no data-URL prefix) for Gemini `inline_data`. Chunked to avoid stack limits. */
export function blobToBase64(blob: Blob): Promise<string> {
  return blobToArrayBuffer(blob).then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    // btoa is universal in browsers and jsdom; fail loudly elsewhere.
    if (typeof btoa !== 'function') {
      throw new Error('Base64 encoding is not supported in this environment.');
    }
    return btoa(binary);
  });
}
