import { describe, it, expect, beforeEach } from 'vitest';
import { db, problemsRepo, attemptsRepo, mentorRepo, revisionsRepo } from '../db';

describe('Revisions & Intelligent Record Keeping', () => {
  beforeEach(async () => {
    await db.problems.clear();
    await db.attempts.clear();
    await db.mentorMessages.clear();
    await db.noteReviews.clear();
    await db.revisions.clear();
  });

  it('archives current session data and resets active workspace to a clean slate', async () => {
    // 1. Create a problem
    const problem = await problemsRepo.create({
      title: 'Two Sum',
      number: 1,
      difficulty: 'Easy',
      statement: 'Given an array of integers...',
    });

    // 2. Add an attempt
    await attemptsRepo.create({
      problemId: problem.id,
      code: 'def twoSum(nums, target): return [0, 1]',
      language: 'python',
      userComment: 'Initial brute force attempt',
    });

    // 3. Unlock a mentor hint
    await mentorRepo.saveMessage({
      problemId: problem.id,
      level: 1,
      content: 'Think about using a hash map to look up complements.',
      model: 'gemini-1.5-flash',
    });

    // 4. Mark problem solved with time, confidence, and notes
    await problemsRepo.completeReview(problem.id, {
      confidence: 4,
      timeSpentMinutes: 25,
      notes: 'Remember complement logic: target - num in map.',
    });

    // Verify initial active state
    const beforeAttempts = await db.attempts.where('problemId').equals(problem.id).toArray();
    expect(beforeAttempts).toHaveLength(1);
    const beforeHints = await db.mentorMessages.where('problemId').equals(problem.id).toArray();
    expect(beforeHints).toHaveLength(1);

    // 5. Trigger "Revise Now" (startNewRevision)
    const { problem: resetProblem, revision } = await problemsRepo.startNewRevision(problem.id);

    // Verify Revision Record
    expect(revision.revisionNumber).toBe(0);
    expect(revision.problemId).toBe(problem.id);
    expect(revision.attemptsCount).toBe(1);
    expect(revision.attempts).toHaveLength(1);
    expect(revision.attempts[0].code).toContain('def twoSum');
    expect(revision.mentorMessages).toHaveLength(1);
    expect(revision.mentorMessages[0].content).toContain('hash map');
    expect(revision.hintsUsed).toBe(1);
    expect(revision.notes).toContain('Remember complement logic');
    expect(revision.timeSpentMinutes).toBe(25);
    expect(revision.confidence).toBe(4);

    // Verify Active Workspace is Clean Slate (no active attempts, no active hints, reset timer)
    expect(resetProblem.status).toBe('In Progress');
    expect(resetProblem.hintsUsed).toBe(0);
    expect(resetProblem.confidence).toBeNull();
    expect(resetProblem.timeSpentMinutes).toBeNull();
    expect(resetProblem.notes).toBe('');

    const activeAttemptsAfter = await db.attempts.where('problemId').equals(problem.id).toArray();
    expect(activeAttemptsAfter).toHaveLength(0);

    const activeHintsAfter = await db.mentorMessages
      .where('problemId')
      .equals(problem.id)
      .toArray();
    expect(activeHintsAfter).toHaveLength(0);

    // Verify revisionsRepo can retrieve the archived revision
    const archivedList = await revisionsRepo.listForProblem(problem.id);
    expect(archivedList).toHaveLength(1);
    expect(archivedList[0].id).toBe(revision.id);
  });

  it('supports multiple sequential revision sessions with monotonic revision numbers', async () => {
    const problem = await problemsRepo.create({
      title: 'Valid Parentheses',
      number: 20,
      difficulty: 'Easy',
    });

    // Session 1: 2 attempts, solved in 30 mins
    await attemptsRepo.create({
      problemId: problem.id,
      code: 'def isValid(s): pass',
      language: 'python',
    });
    await attemptsRepo.create({
      problemId: problem.id,
      code: 'def isValid(s): return True',
      language: 'python',
    });
    await problemsRepo.completeReview(problem.id, {
      confidence: 3,
      timeSpentMinutes: 30,
    });

    // Archive Rev 1
    const { revision: rev1 } = await problemsRepo.startNewRevision(problem.id);
    expect(rev1.revisionNumber).toBe(0);
    expect(rev1.attemptsCount).toBe(2);
    expect(rev1.timeSpentMinutes).toBe(30);

    // Session 2: 1 attempt, solved in 10 mins (unassisted)
    await attemptsRepo.create({
      problemId: problem.id,
      code: 'def isValid(s): stack = []; ...',
      language: 'python',
    });
    await problemsRepo.completeReview(problem.id, {
      confidence: 5,
      timeSpentMinutes: 10,
    });

    // Archive Rev 2
    const { revision: rev2 } = await problemsRepo.startNewRevision(problem.id);
    expect(rev2.revisionNumber).toBe(1);
    expect(rev2.attemptsCount).toBe(1);
    expect(rev2.timeSpentMinutes).toBe(10);
    expect(rev2.confidence).toBe(5);

    // List returns newest first
    const revs = await revisionsRepo.listForProblem(problem.id);
    expect(revs).toHaveLength(2);
    expect(revs[0].revisionNumber).toBe(1);
    expect(revs[1].revisionNumber).toBe(0);
  });

  it('cascades deletion of revisions when problem is deleted', async () => {
    const problem = await problemsRepo.create({
      title: 'LRU Cache',
      number: 146,
      difficulty: 'Medium',
    });

    await attemptsRepo.create({
      problemId: problem.id,
      code: 'class LRUCache: pass',
      language: 'python',
    });

    await problemsRepo.startNewRevision(problem.id);

    const revsBefore = await revisionsRepo.listForProblem(problem.id);
    expect(revsBefore).toHaveLength(1);

    // Delete problem
    await problemsRepo.delete(problem.id);

    const revsAfter = await revisionsRepo.listForProblem(problem.id);
    expect(revsAfter).toHaveLength(0);
  });
});
