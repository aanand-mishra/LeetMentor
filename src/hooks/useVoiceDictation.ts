import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_RECORD_SECONDS,
  blobToBase64,
  decodeTo16kMono,
  encodeWav16kMono,
  isAudioCaptureSupported,
  pickRecordingMimeType,
} from '../lib/voice/audio';
import { requestVoiceTranscription } from '../lib/gemini/client';

export type VoiceDictationStatus = 'idle' | 'recording' | 'transcribing';

/** ~0.5s of audio — takes shorter than this are treated as accidental taps. */
const TARGET_MIN_SAMPLES = 8000;

interface UseVoiceDictationOptions {
  /** Fired once per transcribed take (never empty — silence yields onError). */
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

export interface VoiceDictation {
  status: VoiceDictationStatus;
  /** Elapsed recording time in seconds (for the m:ss timer). */
  recordingSeconds: number;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Record → transcribe → callback, via Gemini Flash (cloud).
 *
 * 16 kHz mono PCM is WAV-encoded in-browser (universally accepted
 * `audio/wav`, unlike recorder-native WebM/Opus) and sent through the shared
 * transport — same queue, spacing, backoff, and quota counting as every other
 * AI feature. Transcription failures surface the real provider error.
 */
export function useVoiceDictation({
  onTranscript,
  onError,
}: UseVoiceDictationOptions): VoiceDictation {
  const [status, setStatus] = useState<VoiceDictationStatus>('idle');
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

    const beginRecording = async () => {
      let stream: MediaStream;
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

        // Cloud transcription: WAV-encode the PCM (universally accepted
        // audio/wav) and let Gemini Flash transcribe it via the shared
        // transport. Provider errors propagate verbatim.
        let text: string;
        try {
          const wavBase64 = await blobToBase64(encodeWav16kMono(audio));
          if (sessionRef.current !== session) return;
          text = (await requestVoiceTranscription(wavBase64)).text;
        } catch (err) {
          const detail = err instanceof Error ? err.message : '';
          fail(session, `Transcription failed. ${detail}`.trim());
          return;
        }
        if (sessionRef.current !== session) return;
        sessionRef.current += 1;
        recorderRef.current = null;
        streamRef.current = null;
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
  // dropped via the session guard.
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

  return { status, recordingSeconds, isSupported, start, stop, toggle };
}
