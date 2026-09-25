import { db } from '../db';
import type { Problem, Attempt, MentorMessage, NoteReview, Settings } from '../types';

export interface ExportData {
  schemaVersion: number;
  exportedAt: string;
  problems: Problem[];
  attempts: Attempt[];
  mentorMessages: MentorMessage[];
  noteReviews: NoteReview[];
  settings?: Omit<Settings, 'geminiApiKey'>;
}

export interface ImportResult {
  importedProblems: number;
  importedAttempts: number;
  importedMentor: number;
  importedReviews: number;
}

/**
 * Exports the entire IndexedDB dataset into a JSON blob.
 * CRITICAL SECURITY REQUIREMENT (FR-8.6):
 * The geminiApiKey must be excluded from exports at any nesting level.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const [problems, attempts, mentorMessages, noteReviews, rawSettings] = await Promise.all([
    db.problems.toArray(),
    db.attempts.toArray(),
    db.mentorMessages.toArray(),
    db.noteReviews.toArray(),
    db.settings.get('current'),
  ]);

  // Strip API key strictly
  let sanitizedSettings: Omit<Settings, 'geminiApiKey'> | undefined = undefined;
  if (rawSettings) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { geminiApiKey, ...rest } = rawSettings;
    sanitizedSettings = rest;
  }

  const exportPayload: ExportData = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    problems,
    attempts,
    mentorMessages,
    noteReviews,
    settings: sanitizedSettings,
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Triggers a browser download of the exported JSON file
 */
export async function triggerExportDownload(): Promise<void> {
  const json = await exportDatabaseToJson();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `leetmentor-export-${dateStr}.json`;

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Update lastExportDate in settings
  const today = new Date().toISOString();
  await db.settings.update('current', { lastExportDate: today }).catch(() => {});
}

/**
 * Validates an import JSON string.
 * Checks schemaVersion and valid array shapes.
 */
export function validateExportPayload(jsonString: string): {
  valid: boolean;
  error?: string;
  data?: ExportData;
} {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'File does not contain a valid JSON object.' };
    }

    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) {
      return {
        valid: false,
        error: `Unsupported schema version: ${parsed.schemaVersion ?? 'unknown'}. Expected 1 or 2.`,
      };
    }

    if (!Array.isArray(parsed.problems)) {
      return { valid: false, error: 'Invalid format: problems array is missing.' };
    }

    return { valid: true, data: parsed as ExportData };
  } catch {
    return { valid: false, error: 'Could not parse JSON. The file might be corrupted.' };
  }
}

/**
 * Imports dataset into IndexedDB in Merge or Replace mode.
 * In Merge mode: skips records whose id already exists.
 * In Replace mode: wipes problems, attempts, mentorMessages, noteReviews, then inserts all records.
 * The active API key is safely preserved.
 */
export async function importDatabase(
  data: ExportData,
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  return db.transaction(
    'rw',
    [db.problems, db.attempts, db.mentorMessages, db.noteReviews],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.problems.clear(),
          db.attempts.clear(),
          db.mentorMessages.clear(),
          db.noteReviews.clear(),
        ]);

        await Promise.all([
          data.problems?.length ? db.problems.bulkAdd(data.problems) : Promise.resolve(),
          data.attempts?.length ? db.attempts.bulkAdd(data.attempts) : Promise.resolve(),
          data.mentorMessages?.length
            ? db.mentorMessages.bulkAdd(data.mentorMessages)
            : Promise.resolve(),
          data.noteReviews?.length ? db.noteReviews.bulkAdd(data.noteReviews) : Promise.resolve(),
        ]);

        return {
          importedProblems: data.problems?.length || 0,
          importedAttempts: data.attempts?.length || 0,
          importedMentor: data.mentorMessages?.length || 0,
          importedReviews: data.noteReviews?.length || 0,
        };
      }

      // Merge mode: Skip records whose id already exists
      const [existingProblemKeys, existingAttemptKeys, existingMentorKeys, existingReviewKeys] =
        await Promise.all([
          db.problems.toCollection().primaryKeys(),
          db.attempts.toCollection().primaryKeys(),
          db.mentorMessages.toCollection().primaryKeys(),
          db.noteReviews.toCollection().primaryKeys(),
        ]);

      const problemKeySet = new Set(existingProblemKeys);
      const attemptKeySet = new Set(existingAttemptKeys);
      const mentorKeySet = new Set(existingMentorKeys);
      const reviewKeySet = new Set(existingReviewKeys);

      const newProblems = (data.problems || []).filter((p) => !problemKeySet.has(p.id));
      const newAttempts = (data.attempts || []).filter((a) => !attemptKeySet.has(a.id));
      const newMentor = (data.mentorMessages || []).filter((m) => !mentorKeySet.has(m.id));
      const newReviews = (data.noteReviews || []).filter((r) => !reviewKeySet.has(r.id));

      await Promise.all([
        newProblems.length ? db.problems.bulkAdd(newProblems) : Promise.resolve(),
        newAttempts.length ? db.attempts.bulkAdd(newAttempts) : Promise.resolve(),
        newMentor.length ? db.mentorMessages.bulkAdd(newMentor) : Promise.resolve(),
        newReviews.length ? db.noteReviews.bulkAdd(newReviews) : Promise.resolve(),
      ]);

      return {
        importedProblems: newProblems.length,
        importedAttempts: newAttempts.length,
        importedMentor: newMentor.length,
        importedReviews: newReviews.length,
      };
    }
  );
}
