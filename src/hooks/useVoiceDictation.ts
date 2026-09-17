import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_RECORD_SECONDS,
  blobToBase64,
  decodeTo16kMono,
  encodeWav16kMono,
  isAudioCaptureSupported,
  pickRecordingMimeType,
} from '../lib/voice/audio';
import {
  getSttModel,
  getTranscriber,
  transcribe16kAudio,
  normalizeTranscriptionProvider,
  type ModelLoadProgress,
  type SpeechTranscriber,
  type TranscriptionProvider,
} from '../lib/voice/stt';
import { requestVoiceTranscription } from '../lib/gemini/client';

export type VoiceDictationStatus = 'idle' | 'recording' | 'transcribing';

/** ~0.5s of audio — takes shorter than this are treated as accidental taps. */
const TARGET_MIN_SAMPLES = 8000;

interface UseVoiceDictationOptions {
  /** 'gemini' (cloud Flash transcription) or 'on-device' (local Whisper). */
  provider: TranscriptionProvider;
  /** Whisper model id — only used when provider is 'on-device'. */
  modelId: string;
  /** Fired once per transcribed take (never empty — silence yields onError). */
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

export interface VoiceDictation {
  status: VoiceDictationStatus;
  /** Non-null while on-device model weights are downloading (first use). */
  modelProgress: ModelLoadProgress | null;
  /** Elapsed recording time in seconds (for the m:ss timer). */
  recordingSeconds: number;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Record → transcribe → callback, via Gemini Flash (cloud, default) or local
 * Whisper (on-device fallback).
 *
 * Gemini path: 16 kHz mono PCM is WAV-encoded in-browser (universally
 * accepted `audio/wav`, unlike recorder-native WebM/Opus) and sent through
 * the shared transport — same queue, spacing, backoff, and quota counting as
 * every other AI feature. No model download, works on every browser.
 */
export function useVoiceDictation({
  provider,
  modelId,
  onTranscript,
  onError,
}: UseVoiceDictationOptions): VoiceDictation {
  const [status, setStatus] = useState<VoiceDictationStatus>('idle');
  const [modelProgress, setModelProgress] = useState<ModelLoadProgress | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSupported] = useState(() => isAudioCaptureSupported());

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const sessionRef = useRef(0);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const providerRef = useRef(provider);
  providerRef.current = normalizeTranscriptionProvider(provider);
  const modelIdRef = useRef(modelId);
  modelIdRef.current = modelId;

  const fail = useCallback((session: number, message: string) => {
    if (sessionRef.current !== session) return;
    sessionRef.current += 1;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      recorderRef.current?.stop();
    } catch {
      // Recorder already stopped — ignore.
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        // Ignore track teardown errors.
      }
    });
    streamRef.current = null;
    chunksRef.current = [];
    setModelProgress(null);
    setStatus('idle');
    onErrorRef.current?.(message);
  }, []);

  const cleanupTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (status !== 'idle') return;
    if (!isAudioCaptureSupported()) {
      onErrorRef.current?.(
        'Voice input needs a microphone, MediaRecorder support, and a secure page (localhost or HTTPS).'
      );
      return;
    }
    const session = ++sessionRef.current;
    const useOnDevice = providerRef.current === 'on-device';

    // On-device only: model weights in the background (cached after first
    // download). The Gemini path needs no download at all.
    const modelPromise = useOnDevice
      ? getTranscriber(modelIdRef.current, (p) => {
          if (sessionRef.current === session) setModelProgress(p.ratio === 1 ? null : p);
        })
      : null;
    if (modelPromise) {
      modelPromise.then(
        () => {
          if (sessionRef.current === session) setModelProgress(null);
        },
        (err: unknown) => {
          if (sessionRef.current !== session) return;
          const detail = err instanceof Error ? err.message : '';
          fail(
            session,
            `Could not load the speech model (one-time download needs internet). ${detail}`.trim()
          );
        }
      );
    }

    // 2) Mic immediately — recording must never wait on the download.
    let stream: MediaStream;
    const beginRecording = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        fail(
          session,
          'Microphone access was blocked. Allow microphone permission for this site, then try again.'
        );
        return;
      }
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = pickRecordingMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        fail(session, 'Could not start the recorder in this browser. Try Chrome or Edge.');
        return;
      }
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      const startedAt = Date.now();
      setRecordingSeconds(0);
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        setRecordingSeconds(elapsed);
        if (elapsed >= MAX_RECORD_SECONDS) stopRef.current();
      }, 500);
      try {
        recorder.start(250);
      } catch {
        fail(session, 'Could not start the recorder in this browser. Try Chrome or Edge.');
        return;
      }
      if (sessionRef.current === session) setStatus('recording');
    };
    void beginRecording();
  }, [status, fail]);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    const recorder = recorderRef.current;
    const stream = streamRef.current;
    if (status !== 'recording' || !recorder) return;
    cleanupTimer();
    setStatus('transcribing');

    const finish = async () => {
      try {
        // Timesliced chunks accumulated in chunksRef during recording; per
        // spec, stop() flushes a final dataavailable (handled by the same
        // collector) before onstop fires.
        const blob: Blob = await new Promise((resolve, reject) => {
          recorder.onstop = () => {
            const type = pickRecordingMimeType() || 'audio/webm';
            resolve(new Blob(chunksRef.current, { type }));
          };
          recorder.onerror = () => reject(new Error('recorder error'));
          try {
            recorder.stop();
          } catch (err) {
            reject(err instanceof Error ? err : new Error('recorder error'));
          }
        });
        stream?.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // Ignore track teardown errors.
          }
        });
        if (sessionRef.current !== session) return;

        let audio: Float32Array;
        try {
          audio = await decodeTo16kMono(blob);
        } catch {
          fail(session, 'Could not decode the recording. Try again.');
          return;
        }
        if (sessionRef.current !== session) return;
        if (audio.length < TARGET_MIN_SAMPLES) {
          fail(
            session,
            'No speech detected in the recording. Try again, speaking closer to the mic.'
          );
          return;
        }

        let text: string;
        try {
          if (providerRef.current === 'on-device') {
            let transcriber: SpeechTranscriber;
            try {
              transcriber = await getTranscriber(modelIdRef.current, (p) => {
                if (sessionRef.current === session) setModelProgress(p.ratio === 1 ? null : p);
              });
            } catch {
              fail(
                session,
                'Speech model is still downloading or failed to load. Check your connection and try again.'
              );
              return;
            }
            if (sessionRef.current !== session) return;
            text = await transcribe16kAudio(
              transcriber,
              audio,
              getSttModel(modelIdRef.current).englishOnly
            );
          } else {
            // Cloud path: WAV-encode the PCM (universally accepted audio/wav)
            // and let Gemini Flash transcribe it via the shared transport.
            const wavBase64 = await blobToBase64(encodeWav16kMono(audio));
            if (sessionRef.current !== session) return;
            text = (await requestVoiceTranscription(wavBase64)).text;
          }
        } catch (err) {
          const detail = err instanceof Error ? err.message : '';
          fail(session, `Transcription failed. ${detail}`.trim());
          return;
        }
        if (sessionRef.current !== session) return;
        sessionRef.current += 1;
        recorderRef.current = null;
        streamRef.current = null;
        setModelProgress(null);
        setStatus('idle');
        if (text) onTranscriptRef.current(text);
        else
          onErrorRef.current?.(
            'No speech detected in the recording. Try again, speaking closer to the mic.'
          );
      } catch {
        fail(session, 'Recording failed. Try again.');
      }
    };
    void finish();
  }, [status, cleanupTimer, fail]);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const toggle = useCallback(() => {
    if (status === 'recording') stop();
    else if (status === 'idle') start();
  }, [status, start, stop]);

  // Unmount: kill timer, recorder, and mic tracks; late async results are
  // dropped via the session guard. (Model download itself is shared/cached.)
  useEffect(
    () => () => {
      sessionRef.current += 1;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      try {
        recorderRef.current?.stop();
      } catch {
        // Ignore teardown errors during unmount.
      }
      streamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignore teardown errors during unmount.
        }
      });
      recorderRef.current = null;
      streamRef.current = null;
    },
    []
  );

  return { status, modelProgress, recordingSeconds, isSupported, start, stop, toggle };
}
