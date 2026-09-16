import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../pages/SettingsPage';
import { ProblemForm } from '../components/problem/ProblemForm';
import { AttemptsTab } from '../components/problem/AttemptsTab';
import { Header } from '../components/layout/Header';
import {
  settingsRepo,
  clearAllLocalData,
  problemsRepo,
} from '../db';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider } from '../context/ThemeContext';
import type { Problem } from '../types';

describe('Settings sync, temperature debounce, and logo verification', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Header logo with /favicon.svg', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>
    );

    const logoImg = screen.getByAltText('Leetcode DSA Tracker');
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute('src', '/favicon.svg');
  });

  it('syncs default language (e.g. java) from settings into ProblemForm for new problem', async () => {
    // Set defaultLanguage in settings to java
    await settingsRepo.update({ defaultLanguage: 'java' });

    render(
      <MemoryRouter>
        <ThemeProvider>
          <ToastProvider>
            <ProblemForm
              onSubmit={async () => { }}
              submitButtonText="Create Problem"
            />
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    // Verify language select defaults to 'java'
    await waitFor(() => {
      // The language field is now a <select>, whose selected text is 'Java'
      const langSelect = screen.getByDisplayValue(/java/i) as HTMLSelectElement;
      expect(langSelect.value).toBe('java');
    });
  });

  it('syncs default language (e.g. java) into AttemptsTab when 0 attempts exist', async () => {
    await settingsRepo.update({ defaultLanguage: 'java' });

    const problem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: 'Find two numbers',
      difficulty: 'Easy',
      topics: ['Array'],
      patterns: ['Two Pointers'],
      status: 'Not Started',
      confidence: null,
      timeSpentMinutes: null,
      hintsUsed: 0,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: '',
      language: 'python', // Legacy or seeded value
      dateFirstAttempt: null,
      dateSolved: null,
    });

    render(
      <ThemeProvider>
        <ToastProvider>
          <AttemptsTab
            problem={problem as Problem}
            attempts={[]}
            onProblemUpdated={() => { }}
          />
        </ToastProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      const attemptLangSelect = screen.getByLabelText(/language:/i) as HTMLSelectElement;
      expect(attemptLangSelect.value).toBe('java');
    });
  });

  it('debounces temperature change by 2 seconds and only notifies once if changed', async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </ThemeProvider>
    );

    // Wait for settings to load and find temperature slider
    const slider = (await screen.findByLabelText(/Model Temperature/i)) as HTMLInputElement;
    expect(slider).toBeInTheDocument();

    // Move temperature slider
    fireEvent.change(slider, { target: { value: '0.75' } });

    // Immediately after moving slider, UI reflects 0.75 but NO toast is shown yet
    expect(slider.value).toBe('0.75');
    expect(screen.queryByText('Setting updated')).not.toBeInTheDocument();

    // After 2 seconds, notification appears and database is updated
    await waitFor(
      async () => {
        expect(screen.getByText('Setting updated')).toBeInTheDocument();
        const updatedSettings = await settingsRepo.get();
        expect(updatedSettings.temperature).toBe(0.75);
      },
      { timeout: 3500 }
    );
  });

  it('does NOT show notification if temperature is moved and restored to original within 2 seconds', async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </ThemeProvider>
    );

    const slider = (await screen.findByLabelText(/Model Temperature/i)) as HTMLInputElement;
    const initialVal = slider.value; // e.g. "0.4"

    // Move temperature away
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(slider.value).toBe('0.8');

    // Immediately restore back to initial value within debounce window
    fireEvent.change(slider, { target: { value: initialVal } });
    expect(slider.value).toBe(initialVal);

    // Wait 2.2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2200));

    // No notification should be shown because setting did not actually change
    expect(screen.queryByText('Setting updated')).not.toBeInTheDocument();
  });
});

