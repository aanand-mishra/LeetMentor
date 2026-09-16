import { describe, it, expect, beforeEach } from 'vitest';
import { computeSimpleLineDiff } from '../utils/diff';
import { importDatabase, validateExportPayload, type ExportData } from '../utils/export';
import { clearAllLocalData, db, problemsRepo } from '../db';

describe('Unit utilities: diff and import merge', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('computeSimpleLineDiff handles additions, deletions, and unchanged lines', () => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nline 2 modified\nline 3\nline 4 added';

    const diff = computeSimpleLineDiff(oldText, newText);

    expect(diff.length).toBeGreaterThan(0);
    expect(diff.some((d) => d.type === 'unchanged' && d.text === 'line 1')).toBe(true);
    expect(diff.some((d) => d.type === 'added' && d.text === 'line 4 added')).toBe(true);
  });

  it('importDatabase in Merge mode skips existing IDs and inserts new records', async () => {
    // Insert an existing problem
    const existing = await problemsRepo.create({
      number: 1,
      title: 'Two Sum Existing',
      url: null,
      statement: '',
      difficulty: 'Easy',
      topics: ['Array'],
      patterns: [],
      status: 'Solved',
      confidence: 5,
      timeSpentMinutes: 10,
      hintsUsed: 0,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: 'Existing notes',
      language: 'python',
      dateFirstAttempt: null,
      dateSolved: null,
    });

    const mockImportPayload: ExportData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      problems: [
        {
          ...existing,
          title: 'This Should Not Overwrite',
        },
        {
          id: 'new-problem-uuid-999',
          number: 2,
          title: 'Add Two Numbers',
          url: null,
          statement: '',
          difficulty: 'Medium',
          topics: ['Linked List'],
          patterns: [],
          status: 'Not Started',
          confidence: null,
          timeSpentMinutes: null,
          hintsUsed: 0,
          starred: false,
          userTimeComplexity: null,
          userSpaceComplexity: null,
          notes: '',
          language: 'python',
          dateAdded: new Date().toISOString(),
          dateFirstAttempt: null,
          dateSolved: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      attempts: [],
      mentorMessages: [],
      noteReviews: [],
    };

    const result = await importDatabase(mockImportPayload, 'merge');

    expect(result.importedProblems).toBe(1); // Only the new one imported
    expect(await db.problems.count()).toBe(2);

    const preserved = await db.problems.get(existing.id);
    expect(preserved?.title).toBe('Two Sum Existing'); // Unmodified
  });

  it('validateExportPayload rejects invalid JSON or wrong schemaVersion', () => {
    const invalidJson = validateExportPayload('{ invalid json');
    expect(invalidJson.valid).toBe(false);
    expect(invalidJson.error).toContain('Could not parse JSON');

    const wrongVersion = validateExportPayload(JSON.stringify({ schemaVersion: 999 }));
    expect(wrongVersion.valid).toBe(false);
    expect(wrongVersion.error).toContain('Unsupported schema version');

    const missingProblems = validateExportPayload(JSON.stringify({ schemaVersion: 1 }));
    expect(missingProblems.valid).toBe(false);
    expect(missingProblems.error).toContain('problems array is missing');
  });
});
