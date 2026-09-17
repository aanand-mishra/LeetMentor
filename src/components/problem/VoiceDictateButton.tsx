import React from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import type { VoiceDictationStatus } from '../../hooks/useVoiceDictation';
import { formatRecordingTime } from '../../lib/voice/audio';

interface Props {
  status: VoiceDictationStatus;
  recordingSeconds: number;
  /** False when mic/MediaRecorder/secure-context is missing — renders nothing. */
  isSupported: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * Mic toggle for voice dictation. Tiny by design: the recording timer and
 * transcribing spinner are conveyed through this one control; longer
 * explanations live in the status strip rendered by the parent next to
 * the editor.
 */
export const VoiceDictateButton: React.FC<Props> = ({
  status,
  recordingSeconds,
  isSupported,
  disabled = false,
  onToggle,
}) => {
  if (!isSupported) return null;

  const isRecording = status === 'recording';
  const isTranscribing = status === 'transcribing';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isTranscribing}
      aria-pressed={isRecording}
      aria-label={
        isRecording
          ? `Stop recording (${formatRecordingTime(recordingSeconds)})`
          : isTranscribing
            ? 'Transcribing with Gemini'
            : 'Dictate notes by voice'
      }
      title={
        isRecording
          ? 'Stop and transcribe'
          : isTranscribing
            ? 'Transcribing…'
            : 'Record voice, transcribe with Gemini Flash'
      }
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-60 ${
        isRecording
          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
          : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
      }`}
    >
      {isRecording ? (
        <>
          <span className="relative flex w-2.5 h-2.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
          <Square className="w-3.5 h-3.5 fill-current" />
          <span className="font-mono">{formatRecordingTime(recordingSeconds)}</span>
        </>
      ) : isTranscribing ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Transcribing…</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5" />
          <span>Dictate</span>
        </>
      )}
    </button>
  );
};
