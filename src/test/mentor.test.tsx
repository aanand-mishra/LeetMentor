import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MentorTab } from '../components/problem/MentorTab';
import { problemsRepo, mentorRepo, clearAllLocalData, db } from '../db';
import { ToastProvider } from '../context/ToastContext';
import type { Problem, MentorMessage } from '../types';

describe('FR-5 — AI Mentor: Progressive Hints Acceptance Criteria', () => {
  let sampleProblem: Problem;

  beforeEach(async () => {
    await clearAllLocalData();
    sampleProblem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: 'Given an array of integers nums and an integer target...',
      difficulty: 'Easy',
      topics: ['Array', 'Hash Table'],
      patterns: ['Hash Map'],
      status: 'Not Started',
      confidence: null,
      timeSpentMinutes: null,
      hintsUsed: 0,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: '',
      language: 'python',
      dateFirstAttempt: null,
      dateSolved: null,
    });
  });

  it('Level 3 cannot be unlocked while Level 2 is locked; button disabled with explanatory tooltip (FR-5 Acceptance)', async () => {
    render(
      <ToastProvider>
        <MentorTab
          problem={sampleProblem}
          mentorMessages={[]}
          onProblemUpdated={vi.fn()}
        />
      </ToastProvider>
    );

    // Card 1 is unlockable
    const unlockL1Btn = screen.getByRole('button', { name: /Unlock Nudge/i });
    expect(unlockL1Btn).not.toBeDisabled();

    // Card 2 is locked (needs L1)
    const unlockL2Btn = screen.getByRole('button', { name: /Unlock Pattern/i });
    expect(unlockL2Btn).toBeDisabled();
    expect(unlockL2Btn).toHaveAttribute('title', 'Unlock Level 1 (Nudge) first');

    // Card 3 is locked (needs L2)
    const unlockL3Btn = screen.getByRole('button', { name: /Unlock Pseudocode/i });
    expect(unlockL3Btn).toBeDisabled();
    expect(unlockL3Btn).toHaveAttribute('title', 'Unlock Level 2 (Pattern) first');

    // Card 4 is locked (needs L3)
    const unlockL4Btn = screen.getByRole('button', { name: /Unlock Solution/i });
    expect(unlockL4Btn).toBeDisabled();
  });

  it('unlocked content is served from IndexedDB on revisit with no network request (FR-5 Acceptance)', async () => {
    // Pre-populate IndexedDB with an unlocked Level 1 hint
    const savedMsg = await mentorRepo.saveMessage({
      problemId: sampleProblem.id,
      level: 1,
      content: 'Persisted Nudge: Think about what brute-force recalculates repeatedly.',
      model: 'gemini-1.5-flash',
    });

    const messages = await mentorRepo.listForProblem(sampleProblem.id);
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe(savedMsg.id);

    const onUnlockRequested = vi.fn();

    render(
      <ToastProvider>
        <MentorTab
          problem={{ ...sampleProblem, hintsUsed: 1 }}
          mentorMessages={messages}
          onProblemUpdated={vi.fn()}
          onUnlockRequested={onUnlockRequested}
        />
      </ToastProvider>
    );

    // Unlocked content should render immediately
    expect(
      screen.getByText(/Persisted Nudge: Think about what brute-force recalculates repeatedly./i)
    ).toBeInTheDocument();

    // No network call should have occurred
    expect(onUnlockRequested).not.toHaveBeenCalled();

    // Level 1 shows Regenerate, Level 2 is now unlockable
    expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
    const unlockL2Btn = screen.getByRole('button', { name: /Unlock Pattern/i });
    expect(unlockL2Btn).not.toBeDisabled();
  });

  it('unlocking Level 2 sets hintsUsed to 2 and auto-transitions Not Started to In Progress (FR-5 Acceptance)', async () => {
    const user = userEvent.setup();
    const onProblemUpdated = vi.fn();

    // First unlock level 1
    await mentorRepo.saveMessage({
      problemId: sampleProblem.id,
      level: 1,
      content: 'Level 1 content',
      model: 'gemini-1.5-flash',
    });

    const messages = await mentorRepo.listForProblem(sampleProblem.id);

    render(
      <ToastProvider>
        <MentorTab
          problem={{ ...sampleProblem, hintsUsed: 1 }}
          mentorMessages={messages}
          onProblemUpdated={onProblemUpdated}
        />
      </ToastProvider>
    );

    const unlockL2Btn = screen.getByRole('button', { name: /Unlock Pattern/i });
    await user.click(unlockL2Btn);

    await waitFor(async () => {
      expect(onProblemUpdated).toHaveBeenCalled();
    });

    // Check IndexedDB
    const updatedProblem = await db.problems.get(sampleProblem.id);
    expect(updatedProblem?.hintsUsed).toBe(2);
    expect(updatedProblem?.status).toBe('In Progress');
    expect(updatedProblem?.dateFirstAttempt).toBeTruthy();

    const storedMessages = await db.mentorMessages.where('problemId').equals(sampleProblem.id).toArray();
    expect(storedMessages.length).toBe(2);
    expect(storedMessages.some((m: MentorMessage) => m.level === 2)).toBe(true);
  });

  it('Level 4 confirmation dialog defaults focus to the cancel action (FR-5 Acceptance)', async () => {
    const user = userEvent.setup();

    // Pre-unlock levels 1, 2, and 3
    for (let lvl = 1; lvl <= 3; lvl++) {
      await mentorRepo.saveMessage({
        problemId: sampleProblem.id,
        level: lvl as 1 | 2 | 3,
        content: `Level ${lvl} content`,
        model: 'gemini-1.5-flash',
      });
    }

    const messages = await mentorRepo.listForProblem(sampleProblem.id);

    render(
      <ToastProvider>
        <MentorTab
          problem={{ ...sampleProblem, hintsUsed: 3 }}
          mentorMessages={messages}
          onProblemUpdated={vi.fn()}
        />
      </ToastProvider>
    );

    // Level 4 is ready to unlock
    const unlockL4Btn = screen.getByRole('button', { name: /Unlock Solution/i });
    expect(unlockL4Btn).not.toBeDisabled();

    await user.click(unlockL4Btn);

    // Confirmation dialog should be visible with verbatim copy per FR-5.2
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByText(/This reveals the full solution\. You've unlocked 3 hints so far\. Continue\?/i)
      ).toBeInTheDocument();
    });

    // Cancel button must be focused by default per FR-5.2
    const cancelBtn = screen.getByRole('button', { name: /Not yet, let me try again/i });
    expect(cancelBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(document.activeElement).toBe(cancelBtn);
    });

    // Dismiss with cancel
    await user.click(cancelBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirms there is NO free-form chat input anywhere in the Mentor tab (FR-5.5)', () => {
    const { container } = render(
      <ToastProvider>
        <MentorTab
          problem={sampleProblem}
          mentorMessages={[]}
          onProblemUpdated={vi.fn()}
        />
      </ToastProvider>
    );

    // Check that there are no input or textarea elements
    const inputs = container.querySelectorAll('input, textarea');
    expect(inputs.length).toBe(0);
  });
});
